// Cuentas para la revisión de Google Play y datos de ejemplo para las capturas de la ficha.
// Usa el dominio @qa.pilatesmatch.test: quedan en la "Red de prueba (QA)" y la limpieza de los tests
// (e2e_cleanup) NO borra estas cuentas, aunque sí borra sus propuestas. Volver a correrlo recrea las propuestas.
//
// Uso: REVIEW_PASSWORD='...' node tests/visual/store-seed.mjs
// La contraseña no se guarda en el repo: es la que se carga en Play Console → Acceso a la app.
import { createClient } from '@supabase/supabase-js'

const URL = 'https://tkhaiovstwgqzabvxxss.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGFpb3ZzdHdncXphYnZ4eHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MzU4NzksImV4cCI6MjA5NDMxMTg3OX0.KuuF4sOr4Bs51vvgCJQz0C1ophIyFLLpTNwFgrcS1Sc'
const PASSWORD = process.env.REVIEW_PASSWORD
const QA_ADMIN = { email: 'qa-camara@qa.pilatesmatch.test', password: 'e2e-Test-Password-1' }
if (!PASSWORD) { console.error('Falta REVIEW_PASSWORD'); process.exit(1) }

export const REVIEW_STUDIO = 'revision-estudio@qa.pilatesmatch.test'
export const REVIEW_INSTRUCTOR = 'revision-instructora@qa.pilatesmatch.test'

const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }
const day = (n) => { const d = new Date(Date.now() + n * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

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

const INSTRUCTORS = [
  { email: REVIEW_INSTRUCTOR, name: 'Sofía Martínez', hood: 'Palermo', dni: '33444555', specs: ['reformer', 'mat', 'prenatal'],
    bio: 'Instructora de reformer y mat con 9 años de experiencia. Formación en pilates prenatal.', zones: ['Palermo', 'Belgrano', 'Colegiales'] },
  { email: 'demo-julieta@qa.pilatesmatch.test', name: 'Julieta Gómez', hood: 'Belgrano', dni: '35111222', specs: ['reformer', 'chair', 'barrel'],
    bio: 'Clases dinámicas de reformer y chair. Trabajo con grupos de hasta 8 personas.', zones: ['Belgrano', 'Núñez', 'Palermo'] },
  { email: 'demo-martina@qa.pilatesmatch.test', name: 'Martina López', hood: 'Palermo', dni: '36222333', specs: ['reformer', 'cadillac', 'terapeutico'],
    bio: 'Kinesióloga e instructora. Especializada en pilates terapéutico y rehabilitación.', zones: ['Palermo', 'Recoleta'] },
  { email: 'demo-camila@qa.pilatesmatch.test', name: 'Camila Rodríguez', hood: 'Colegiales', dni: '37333444', specs: ['mat', 'reformer', 'adultos_mayores'],
    bio: 'Mat y reformer para todos los niveles. Experiencia con adultos mayores.', zones: ['Colegiales', 'Palermo', 'Villa Crespo'] },
]

async function ensureInstructor(spec) {
  const { c, user } = await account(spec.email, 'instructor', spec.name)
  let row = must(await c.from('instructors').select('id').eq('user_id', user.id).maybeSingle(), 'buscar instructor')
  if (!row) {
    row = must(await c.from('instructors').insert({
      user_id: user.id, full_name: spec.name, dni: spec.dni, phone: '1150000000', neighborhood: spec.hood, bio: spec.bio,
    }).select('id').single(), `instructor ${spec.name}`)
    must(await c.from('instructor_rates').insert({ instructor_id: row.id, rate_regular: 20000, rate_replacement: 24000 }), 'tarifas')
    must(await c.from('instructor_zones').insert(spec.zones.map(neighborhood => ({ instructor_id: row.id, neighborhood }))), 'zonas')
    must(await c.from('instructor_specialties').insert(spec.specs.map(specialty => ({ instructor_id: row.id, specialty }))), 'especialidades')
    must(await c.from('availability').insert(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].flatMap(d => [
      { instructor_id: row.id, day_of_week: d, start_time: '07:00', end_time: '13:00', class_type: 'reemplazo', is_active: true },
      { instructor_id: row.id, day_of_week: d, start_time: '17:00', end_time: '21:00', class_type: 'regular', is_active: true },
    ])), 'disponibilidad')
    must(await c.from('certifications').insert({ instructor_id: row.id, name: 'Formación integral en Pilates', institution: 'Escuela de Pilates BA', year: 2017, hours: 300 }), 'certificado')
  }
  return { c, id: row.id }
}

async function main() {
  const qa = client()
  const ql = await qa.auth.signInWithPassword(QA_ADMIN)
  if (ql.error) throw new Error('admin de prueba: ' + ql.error.message)

  const ins = []
  for (const spec of INSTRUCTORS) ins.push(await ensureInstructor(spec))
  // La entidad de la red de prueba aprueba los certificados y verifica (en la app real lo hace la Cámara)
  for (const i of ins) {
    must(await qa.from('certifications').update({ review_status: 'approved', verified: true, verified_at: new Date().toISOString(), reviewed_at: new Date().toISOString() }).eq('instructor_id', i.id), 'certificados')
    must(await qa.from('instructors').update({ verification_status: 'verificado', verified_at: new Date().toISOString(), is_active: true }).eq('id', i.id), 'verificar')
  }

  const st = await account(REVIEW_STUDIO, 'estudio', 'Estudio Reformer Palermo')
  let studio = must(await st.c.from('studios').select('id').eq('user_id', st.user.id).maybeSingle(), 'buscar estudio')
  if (!studio) {
    studio = must(await st.c.from('studios').insert({
      user_id: st.user.id, name: 'Estudio Reformer Palermo', neighborhood: 'Palermo', phone: '1140000000', address: 'Gorriti 4500',
      equipment: ['reformer', 'mat', 'chair'], budget_regular: 20000, budget_replacement: 25000,
      bio: 'Estudio boutique con 8 reformers y clases de 7 a 21 h.',
    }).select('id').single(), 'estudio')
  }
  // Plan Socio (5 avisos por mes), asignado por la entidad
  must(await qa.from('memberships').upsert({
    studio_id: studio.id, status: 'activa', plan_type: 'socio', matches_limit: 5, matches_used_month: 0,
    last_reset_date: day(0), start_date: day(0), end_date: day(365),
  }, { onConflict: 'studio_id' }), 'plan socio')
  must(await qa.from('studios').update({ is_member: true, member_since: day(0) }).eq('id', studio.id), 'socio')

  // Propuestas: una confirmada para pasado mañana, una pendiente para la instructora de revisión y una pasada para evaluar
  const [sofia, julieta, martina] = ins
  const mk = async (insId, date, start, end, rate, note) => must(await st.c.from('matches').insert({
    studio_id: studio.id, instructor_id: insId, class_type: 'reemplazo', class_date: date, start_time: start, end_time: end, offered_rate: rate, note_studio: note,
  }).select('id').single(), 'propuesta')
  const m1 = await mk(julieta.id, day(2), '08:00', '12:00', 24000, 'Bloque de 4 clases de reformer intermedio.')
  must(await julieta.c.from('matches').update({ status: 'aceptado' }).eq('id', m1.id), 'aceptar')
  await mk(sofia.id, day(3), '09:00', '11:00', 24000, 'Reemplazo de dos clases de reformer. Grupo de 6 alumnas.')
  const m3 = await mk(martina.id, day(-2), '10:00', '11:00', 24000, 'Clase de reformer terapéutico.')
  must(await martina.c.from('matches').update({ status: 'aceptado' }).eq('id', m3.id), 'aceptar pasada')
  console.log('listo')
}

const isMain = import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] ?? '').href
if (isMain) await main()
