// Crea cuentas de prueba con datos para sacar capturas de la app (tests/visual/screens.mjs).
// Usa el dominio @e2e.pilatesmatch.test: se borran con `node tests/visual/seed.mjs --cleanup`.
import { createClient } from '@supabase/supabase-js'

const URL = 'https://tkhaiovstwgqzabvxxss.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGFpb3ZzdHdncXphYnZ4eHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MzU4NzksImV4cCI6MjA5NDMxMTg3OX0.KuuF4sOr4Bs51vvgCJQz0C1ophIyFLLpTNwFgrcS1Sc'
export const PASSWORD = 'e2e-Test-Password-1'
export const STUDIO_EMAIL = 'visual-estudio@e2e.pilatesmatch.test'
export const INSTRUCTOR_EMAIL = 'visual-instructora@e2e.pilatesmatch.test'
export const STUDIO2_EMAIL = 'visual-estudio2@e2e.pilatesmatch.test'
// Administrador de la "Red de prueba (QA)": solo ve esa red. Se crea una vez (por invitación) y no se borra.
// Todas las cuentas de prueba quedan en esa red (ver supabase/migrations/20261105c_red_de_prueba.sql).
export const QA_ADMIN_EMAIL = 'qa-camara@qa.pilatesmatch.test'
const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

async function signUp(email, role, full_name) {
  const c = client()
  const { data, error } = await c.auth.signUp({ email, password: PASSWORD, options: { data: { role, full_name } } })
  if (error) throw error
  return { c, user: data.user }
}

if (process.argv.includes('--cleanup')) {
  const r = await client().rpc('e2e_cleanup'); console.log('borradas:', r.data, r.error?.message ?? ''); process.exit(0)
}

await client().rpc('e2e_cleanup')

const ins = await signUp(INSTRUCTOR_EMAIL, 'instructor', 'Lucía Fernández')
const instructor = must(await ins.c.from('instructors').insert({
  user_id: ins.user.id, full_name: 'Lucía Fernández', dni: '30111222', phone: '1155550000',
  neighborhood: 'Palermo', bio: 'Instructora de reformer y mat. 8 años dando clases en estudios de Palermo y Belgrano.',
}).select('id').single(), 'instructor')
must(await ins.c.from('instructor_rates').insert({ instructor_id: instructor.id, rate_regular: 18000, rate_replacement: 22000 }), 'tarifas')
must(await ins.c.from('instructor_zones').insert([{ instructor_id: instructor.id, neighborhood: 'Palermo' }, { instructor_id: instructor.id, neighborhood: 'Belgrano' }]), 'zonas')
must(await ins.c.from('instructor_specialties').insert([{ instructor_id: instructor.id, specialty: 'reformer' }, { instructor_id: instructor.id, specialty: 'mat' }]), 'especialidades')
must(await ins.c.from('availability').insert([
  { instructor_id: instructor.id, day_of_week: 'lunes', start_time: '08:00', end_time: '12:00', class_type: 'regular', is_active: true },
  { instructor_id: instructor.id, day_of_week: 'miercoles', start_time: '17:00', end_time: '21:00', class_type: 'reemplazo', is_active: true },
]), 'disponibilidad')
must(await ins.c.from('certifications').insert({ instructor_id: instructor.id, name: 'Formación integral en Pilates', institution: 'Escuela de Pilates BA', year: 2018 }), 'certificado')

const st = await signUp(STUDIO_EMAIL, 'estudio', 'Estudio Núcleo')
const studio = must(await st.c.from('studios').insert({
  user_id: st.user.id, name: 'Estudio Núcleo', neighborhood: 'Palermo', phone: '1144440000',
  equipment: ['reformer', 'mat'], budget_regular: 20000, budget_replacement: 25000,
  bio: 'Estudio boutique con 6 reformers.',
}).select('id').single(), 'estudio')
must(await st.c.from('memberships').insert({ studio_id: studio.id, status: 'activa', plan_type: 'freemium', matches_limit: 1, matches_used_month: 0, end_date: '2036-01-01' }), 'membresía')
// Clase de ayer, aceptada: habilita "Evaluar" en los dos lados y agota el Freemium (1/mes)
const d = new Date(Date.now() - 864e5)
const ayer = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
must(await st.c.from('matches').insert({
  studio_id: studio.id, instructor_id: instructor.id, class_type: 'reemplazo',
  class_date: ayer, start_time: '18:00', end_time: '19:00', status: 'aceptado',
  note_studio: 'Reemplazo de la clase de reformer intermedio.', responded_at: new Date().toISOString(),
}), 'match')

// Segundo estudio, sin propuestas: para ver el formulario de pedir clase
const st2 = await signUp(STUDIO2_EMAIL, 'estudio', 'Estudio Pilates Sur')
const studio2 = must(await st2.c.from('studios').insert({
  user_id: st2.user.id, name: 'Estudio Pilates Sur', neighborhood: 'Belgrano', equipment: ['reformer'], budget_regular: 20000, budget_replacement: 25000,
}).select('id').single(), 'estudio 2')
must(await st2.c.from('memberships').insert({ studio_id: studio2.id, status: 'activa', plan_type: 'freemium', matches_limit: 1, matches_used_month: 0, end_date: '2036-01-01' }), 'membresía 2')

// Administrador de la red de prueba + un instructor del directorio (cargado por la entidad, verificado)
const qa = client()
let qaLogin = await qa.auth.signInWithPassword({ email: QA_ADMIN_EMAIL, password: PASSWORD })
if (qaLogin.error) {
  must(await qa.auth.signUp({ email: QA_ADMIN_EMAIL, password: PASSWORD, options: { data: { full_name: 'Admin de prueba' } } }), 'admin de prueba')
  qaLogin = await qa.auth.signInWithPassword({ email: QA_ADMIN_EMAIL, password: PASSWORD })
}
const role = must(await qa.from('users').select('role, camara_id').eq('id', qaLogin.data.user.id).single(), 'rol admin')
if (role.role !== 'camara_admin') throw new Error('El admin de prueba no quedó como administrador de la red de prueba')
const dir = must(await qa.from('instructors').insert({
  full_name: 'Marcelo Pérez', dni: '28999111', neighborhood: 'Otro', phone: '1166660000', camara_id: role.camara_id,
}).select('id').single(), 'instructor del directorio')
must(await qa.from('instructors').update({ verification_status: 'verificado', verified_at: new Date().toISOString() }).eq('id', dir.id), 'verificar directorio')

console.log('listo')
