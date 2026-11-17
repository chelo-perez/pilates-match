// Cuentas para que una persona de confianza pruebe la app en la red de prueba, desde los tres lados:
// entidad (administra la red de prueba), estudio (plan Socio) e instructor (verificado, con disponibilidad).
// Uso: TESTER_PASSWORD=... node tests/visual/tester-seed.mjs   (se puede correr de nuevo: no duplica)
import { createClient } from '@supabase/supabase-js'

const URL = 'https://tkhaiovstwgqzabvxxss.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGFpb3ZzdHdncXphYnZ4eHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MzU4NzksImV4cCI6MjA5NDMxMTg3OX0.KuuF4sOr4Bs51vvgCJQz0C1ophIyFLLpTNwFgrcS1Sc'
const PASSWORD = process.env.TESTER_PASSWORD
if (!PASSWORD || PASSWORD.length < 10) throw new Error('Falta TESTER_PASSWORD')
const QA_ADMIN = { email: 'qa-camara@qa.pilatesmatch.test', password: 'e2e-Test-Password-1' }
const QA_CAMARA = 'afcfd179-fa3c-4a6b-8d2a-91e935b23334'

export const TESTER = {
  entidad: 'prueba-entidad@qa.pilatesmatch.test',
  estudio: 'prueba-estudio@qa.pilatesmatch.test',
  instructor: 'prueba-instructor@qa.pilatesmatch.test',
}

const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

async function account(email, role, full_name) {
  const c = client()
  let r = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (r.error) {
    must(await c.auth.signUp({ email, password: PASSWORD, options: { data: { role, full_name } } }), `alta ${email}`)
    r = await c.auth.signInWithPassword({ email, password: PASSWORD })
    if (r.error) throw new Error(`login ${email}: ${r.error.message}`)
  }
  return { c, user: r.data.user }
}

async function main() {
  const qa = client()
  if ((await qa.auth.signInWithPassword(QA_ADMIN)).error) throw new Error('admin de prueba')

  // Entidad: la cuenta nace como estudio; después se la pasa a administradora de la red de prueba por SQL:
  //   update users set role='camara_admin', camara_id='<QA_CAMARA>' where email='prueba-entidad@qa.pilatesmatch.test'
  await account(TESTER.entidad, 'estudio', 'Entidad de prueba')

  // Instructor verificado, con disponibilidad para reemplazos de mañana y tarde
  const ins = await account(TESTER.instructor, 'instructor', 'Instructor de prueba')
  let inst = must(await ins.c.from('instructors').select('id').eq('user_id', ins.user.id).maybeSingle(), 'buscar instructor')
  if (!inst) {
    inst = must(await ins.c.from('instructors').insert({
      user_id: ins.user.id, full_name: 'Instructor de prueba', dni: '30999888', phone: '1150000001', neighborhood: 'Palermo',
      bio: 'Cuenta para probar la app del lado del instructor.',
    }).select('id').single(), 'instructor')
    must(await ins.c.from('instructor_rates').insert({ instructor_id: inst.id, rate_regular: 20000, rate_replacement: 24000 }), 'tarifas')
    must(await ins.c.from('instructor_zones').insert(['Palermo', 'Belgrano', 'Colegiales'].map(neighborhood => ({ instructor_id: inst.id, neighborhood }))), 'zonas')
    must(await ins.c.from('instructor_specialties').insert(['reformer', 'mat', 'chair'].map(specialty => ({ instructor_id: inst.id, specialty }))), 'especialidades')
    must(await ins.c.from('availability').insert(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'].flatMap(d => [
      { instructor_id: inst.id, day_of_week: d, start_time: '07:00', end_time: '13:00', class_type: 'reemplazo', is_active: true },
      { instructor_id: inst.id, day_of_week: d, start_time: '17:00', end_time: '21:00', class_type: 'reemplazo', is_active: true },
    ])), 'disponibilidad')
    must(await ins.c.from('certifications').insert({ instructor_id: inst.id, name: 'Formación integral en Pilates', institution: 'Escuela de Pilates BA', year: 2018, hours: 300 }), 'certificado')
  }
  must(await qa.from('certifications').update({ review_status: 'approved', verified: true, verified_at: new Date().toISOString(), reviewed_at: new Date().toISOString() }).eq('instructor_id', inst.id), 'certificado ok')
  must(await qa.from('instructors').update({ verification_status: 'verificado', verified_at: new Date().toISOString(), is_active: true }).eq('id', inst.id), 'verificar')

  // Estudio socio con plan Socio
  const st = await account(TESTER.estudio, 'estudio', 'Estudio de prueba')
  let studio = must(await st.c.from('studios').select('id').eq('user_id', st.user.id).maybeSingle(), 'buscar estudio')
  if (!studio) {
    studio = must(await st.c.from('studios').insert({
      user_id: st.user.id, name: 'Estudio de prueba', neighborhood: 'Palermo', phone: '1140000001', address: 'Honduras 4800',
      equipment: ['reformer', 'mat', 'chair'], budget_regular: 20000, budget_replacement: 25000,
      bio: 'Cuenta para probar la app del lado del estudio.',
    }).select('id').single(), 'estudio')
  }
  must(await qa.from('memberships').upsert({
    studio_id: studio.id, status: 'activa', plan_type: 'socio', matches_limit: 5, matches_used_month: 0,
    last_reset_date: day(0), start_date: day(0), end_date: day(365),
  }, { onConflict: 'studio_id' }), 'plan socio')
  must(await qa.from('studios').update({ is_member: true, member_since: day(0) }).eq('id', studio.id), 'socio')
  console.log('listo')
}

await main()
