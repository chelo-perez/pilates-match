// Pruebas automáticas de punta a punta contra el Supabase real.
//
// Recorren los flujos de la app con cuentas de prueba (@e2e.pilatesmatch.test)
// usando las mismas consultas que hacen las pantallas, y al final borran todo
// con la función e2e_cleanup (que solo puede borrar cuentas de ese dominio).
//
// Correr:  npm run test:e2e
//
// Si cambiás una consulta en una pantalla, actualizá la de acá también.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tkhaiovstwgqzabvxxss.supabase.co'
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGFpb3ZzdHdncXphYnZ4eHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MzU4NzksImV4cCI6MjA5NDMxMTg3OX0.KuuF4sOr4Bs51vvgCJQz0C1ophIyFLLpTNwFgrcS1Sc'

const RUN = Date.now().toString(36)
const PASSWORD = 'e2e-Test-Password-1'
const email = (name) => `e2e-${RUN}-${name}@e2e.pilatesmatch.test`
const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = client()

/** Crea una cuenta como lo hace authAPI.signUp y devuelve un cliente con sesión. */
async function signUp(name, role, fullName = `E2E ${name}`) {
  const c = client()
  const options = role ? { data: { role, full_name: fullName } } : { data: { full_name: fullName } }
  const { data, error } = await c.auth.signUp({ email: email(name), password: PASSWORD, options })
  assert.ifError(error)
  assert.ok(data.session, 'el signUp tiene que devolver sesión (confirmación automática)')
  return { c, user: data.user }
}

const ok = ({ data, error }, what) => { assert.ifError(error ? new Error(`${what}: ${error.message}`) : null); return data }

// Estado compartido entre pruebas (corren en orden)
const S = {}

// La limpieza solo la puede correr una cuenta de prueba: el administrador de la red de prueba (QA)
const cleaner = client()
const cleanup = async () => {
  if (!(await cleaner.auth.getSession()).data.session) {
    const r = await cleaner.auth.signInWithPassword({ email: 'qa-camara@qa.pilatesmatch.test', password: PASSWORD })
    if (r.error) return { data: null, error: r.error }
  }
  return cleaner.rpc('e2e_cleanup')
}

before(async () => { await cleanup() })
after(async () => {
  const { data, error } = await cleanup()
  if (error) console.error('No se pudo limpiar:', error.message)
  else console.log(`Limpieza: ${data} cuentas de prueba borradas`)
})

// ── Sin sesión ─────────────────────────────────────────────────────

test('sin sesión no se pueden leer usuarios ni instructores', async () => {
  for (const table of ['users', 'instructors', 'instructor_availabilities']) {
    const { data, error } = await anon.from(table).select('id').limit(1)
    assert.ok(error || data.length === 0, `${table} no debería ser legible sin sesión`)
  }
})

test('sin sesión la búsqueda de perfiles del registro funciona', async () => {
  const data = ok(await anon.rpc('search_unclaimed_instructors', { p_query: 'ana' }), 'search_unclaimed_instructors')
  assert.ok(Array.isArray(data))
})

test('sin sesión no se puede tocar el contador de matches', async () => {
  const { error } = await anon.rpc('increment_match_counter', { p_studio_id: '00000000-0000-0000-0000-000000000000' })
  assert.ok(error)
})

// ── Registro ───────────────────────────────────────────────────────

test('registrarse pidiendo rol de admin crea una cuenta de estudio', async () => {
  const { c, user } = await signUp('hacker', 'camara_admin')
  const me = ok(await c.from('users').select('role').eq('id', user.id).single(), 'leer users')
  assert.equal(me.role, 'estudio')
  // y tampoco puede cambiarse el rol después
  await c.from('users').update({ role: 'super_admin' }).eq('id', user.id)
  const again = ok(await c.from('users').select('role').eq('id', user.id).single(), 'leer users')
  assert.equal(again.role, 'estudio')
})

test('registro de estudio por email (RegisterStudioScreen)', async () => {
  const { c, user } = await signUp('estudio', 'estudio', 'E2E Estudio')
  // Pide ser socio: la base lo ignora
  const studio = ok(await c.from('studios').insert({
    user_id: user.id, name: 'E2E Estudio', neighborhood: 'Palermo',
    phone: null, camara_code: `E2E-${RUN}`, is_member: true, member_since: '2026-01-01',
  }).select('id, is_member').single(), 'crear estudio')
  assert.equal(studio.is_member, false, 'un estudio no puede darse membresía solo')

  // Membresía ilimitada propia: rechazada
  const bad = await c.from('memberships').insert({ studio_id: studio.id, status: 'activa', end_date: '2030-01-01', matches_limit: null })
  assert.ok(bad.error, 'no debería poder crearse una membresía ilimitada')

  // Freemium, como lo hace la pantalla
  ok(await c.from('memberships').insert({
    studio_id: studio.id, status: 'activa', plan_type: 'freemium',
    end_date: '2036-01-01', matches_limit: 1, matches_used_month: 0,
  }), 'crear membresía freemium')

  S.studio = { c, user, id: studio.id }
})

test('registro de estudio por Google (SelectRoleScreen)', async () => {
  const { c, user } = await signUp('estudio-google', null)
  ok(await c.from('users').upsert({ id: user.id, email: user.email, full_name: 'E2E Google', role: 'estudio' }, { onConflict: 'id' }), 'upsert users')
  const studio = ok(await c.from('studios').upsert({ user_id: user.id, name: 'E2E Google', neighborhood: '', is_member: false }, { onConflict: 'user_id' }).select().single(), 'upsert studios')
  ok(await c.from('memberships').upsert({
    studio_id: studio.id, status: 'activa', plan_type: 'freemium', matches_limit: 1, matches_used_month: 0,
    start_date: '2026-01-01', end_date: '2036-01-01',
  }, { onConflict: 'studio_id' }), 'upsert memberships')
})

test('registro de instructor por email (RegisterInstructorScreen)', async () => {
  const { c, user } = await signUp('instructor', 'instructor', 'E2E Instructora')
  const instr = ok(await c.from('instructors').insert({
    user_id: user.id, full_name: 'E2E Instructora', dni: '30123456', phone: '1155555555',
    neighborhood: 'Palermo', verification_status: 'verificado',
  }).select('id, verification_status').single(), 'crear instructor')
  assert.equal(instr.verification_status, 'pendiente', 'un instructor no puede crearse verificado')
  S.instructor = { c, user, id: instr.id }
})

test('registro de instructor por Google (SelectRoleScreen)', async () => {
  const { c, user } = await signUp('instructor-google', null)
  ok(await c.from('users').upsert({ id: user.id, email: user.email, full_name: 'E2E G', role: 'instructor' }, { onConflict: 'id' }), 'upsert users')
  ok(await c.from('instructors').upsert({ user_id: user.id, full_name: 'E2E G', verification_status: 'pendiente', is_active: true }, { onConflict: 'user_id' }), 'upsert instructors')
})

// ── Instructor ─────────────────────────────────────────────────────

test('el instructor edita su perfil pero no puede verificarse', async () => {
  const { c, id } = S.instructor
  ok(await c.from('instructors').update({ bio: 'Bio E2E', neighborhood: 'Belgrano', phone: '1144444444' }).eq('id', id), 'editar perfil')
  await c.from('instructors').update({ verification_status: 'verificado' }).eq('id', id)
  await c.from('instructors').update({ verification_note: 'me aprobé sola' }).eq('id', id)
  const me = ok(await c.from('instructors').select('bio, verification_status, verification_note').eq('id', id).single(), 'leer perfil')
  assert.equal(me.bio, 'Bio E2E')
  assert.equal(me.verification_status, 'pendiente')
  assert.equal(me.verification_note, null, 'el motivo de la Cámara no lo puede escribir el instructor')
})

test('el instructor carga tarifas, zonas y disponibilidad', async () => {
  const { c, id } = S.instructor
  ok(await c.from('instructor_rates').upsert({ instructor_id: id, rate_regular: 10000, rate_replacement: 12000 }, { onConflict: 'instructor_id' }), 'tarifas')
  await c.from('instructor_zones').delete().eq('instructor_id', id)
  ok(await c.from('instructor_zones').insert([{ instructor_id: id, neighborhood: 'Palermo' }]), 'zonas')
  await c.from('availability').delete().eq('instructor_id', id)
  ok(await c.from('availability').insert([{ instructor_id: id, day_of_week: 'lunes', start_time: '09:00:00', end_time: '12:00:00', class_type: 'regular', is_active: true }]), 'disponibilidad')
})

test('el instructor solo ve su propio usuario y su propio perfil', async () => {
  const { c } = S.instructor
  assert.equal(ok(await c.from('users').select('id'), 'users').length, 1)
  assert.equal(ok(await c.from('instructors').select('id'), 'instructors').length, 1)
})

// ── Estudio ────────────────────────────────────────────────────────

test('la búsqueda se calcula en el servidor para la clase pedida (SearchScreen)', async () => {
  const { c } = S.studio
  // La entidad de prueba verifica al instructor para que aparezca en las búsquedas
  ok(await cleaner.from('instructors').update({ verification_status: 'verificado' }).eq('id', S.instructor.id), 'verificar')
  const fits = ok(await c.rpc('search_instructors', { p_class_type: 'regular', p_days: ['lunes'], p_from: '09:00:00', p_to: '10:00:00' }), 'buscar')
  const me = fits.find(r => r.id === S.instructor.id)
  assert.ok(me, 'el instructor verificado aparece')
  assert.ok(me.match_reasons.includes('Disponible en ese horario'), 'cuenta la disponibilidad del lunes 9-12')
  assert.ok(!('rate_regular' in me) && !('offered_rate' in me), 'la búsqueda no expone tarifas')
  const miss = ok(await c.rpc('search_instructors', { p_class_type: 'regular', p_days: ['martes'], p_from: '09:00:00', p_to: '10:00:00' }), 'buscar martes')
  const me2 = miss.find(r => r.id === S.instructor.id)
  assert.ok(me2.missing_reasons.includes('Sin disponibilidad en ese horario'), 'el martes no está disponible')
  assert.ok(me.match_score > me2.match_score, 'el puntaje depende de la clase pedida')
  const asInstructor = await S.instructor.c.rpc('search_instructors', { p_class_type: 'regular', p_days: ['lunes'], p_from: '09:00:00', p_to: '10:00:00' })
  assert.ok(asInstructor.error, 'solo los estudios pueden buscar')
})

test('el instructor marca "me interesa" y el estudio lo ve (StudiosScreen / SearchScreen)', async () => {
  const { c, id } = S.instructor
  ok(await c.from('instructor_interests').insert({ instructor_id: id, studio_id: S.studio.id }), 'me interesa')
  const other = await c.from('instructor_interests').insert({ instructor_id: '00000000-0000-0000-0000-000000000001', studio_id: S.studio.id })
  assert.ok(other.error, 'no puede marcar en nombre de otro instructor')
  const seen = ok(await S.studio.c.from('instructor_interests').select('instructor_id').eq('studio_id', S.studio.id), 'el estudio lee')
  assert.ok(seen.some(r => r.instructor_id === id), 'el estudio ve quién se interesó')
  ok(await c.from('instructor_interests').delete().eq('instructor_id', id).eq('studio_id', S.studio.id), 'quitar marca')
})

test('el instructor ve la reputación agregada del estudio, no sus evaluaciones', async () => {
  const r = ok(await S.instructor.c.rpc('studio_reputation', { p_studio_id: S.studio.id }), 'studio_reputation')
  assert.ok('classes' in r && 'paid_total' in r)
  const asStudio = ok(await S.studio.c.rpc('studio_reputation', { p_studio_id: S.studio.id }), 'studio_reputation estudio')
  assert.equal(asStudio, null, 'el estudio no consulta su propia reputación por acá')
})

test('el estudio ve el puntaje de un instructor', async () => {
  const { c } = S.studio
  ok(await c.rpc('get_instructor_stats', { p_instructor_id: S.instructor.id }), 'get_instructor_stats')
})

test('el estudio no puede modificar instructores', async () => {
  const { c } = S.studio
  const { data } = await c.from('instructors').update({ bio: 'hackeado' }).eq('id', S.instructor.id).select()
  assert.equal((data ?? []).length, 0)
})

test('el estudio envía una propuesta y el límite Freemium frena la segunda', async () => {
  const { c, id } = S.studio
  assert.equal(ok(await c.rpc('can_studio_match', { p_studio_id: id }), 'can_studio_match'), true)
  const match = ok(await c.from('matches').insert({
    studio_id: id, instructor_id: S.instructor.id, class_type: 'regular',
    class_date: '2030-01-10', start_time: '09:00', end_time: '10:00', note_studio: 'E2E', offered_rate: 18000,
    schedule_days: ['lunes', 'miercoles'], schedule_from: '09:00', schedule_to: '12:00',
  }).select().single(), 'crear match regular con días y horario')
  assert.deepEqual(match.schedule_days, ['lunes', 'miercoles'])
  S.matchId = match.id

  assert.equal(ok(await c.rpc('can_studio_match', { p_studio_id: id }), 'can_studio_match'), false)
  const second = await c.from('matches').insert({
    studio_id: id, instructor_id: S.instructor.id, class_date: '2030-01-11', start_time: '09:00', end_time: '10:00', offered_rate: 18000,
  })
  assert.equal(second.error?.message, 'MATCH_LIMIT_REACHED')
})

test('el estudio no puede subirse el plan ni resetear el contador', async () => {
  const { c, id } = S.studio
  await c.from('memberships').update({ matches_limit: null, matches_used_month: 0 }).eq('studio_id', id)
  await c.from('studios').update({ is_member: true }).eq('id', id)
  const m = ok(await c.from('memberships').select('matches_limit, matches_used_month').eq('studio_id', id).single(), 'leer membresía')
  // La propuesta pendiente reserva lugar pero todavía no cuenta como aviso cubierto
  assert.deepEqual(m, { matches_limit: 1, matches_used_month: 0 })
  const q = ok(await c.rpc('studio_quota', { p_studio: id }), 'cuota')
  assert.deepEqual({ limit: q.limit, covered: q.covered, pending: q.pending, available: q.available }, { limit: 1, covered: 0, pending: 1, available: 0 })
  const s = ok(await c.from('studios').select('is_member').eq('id', id).single(), 'leer estudio')
  assert.equal(s.is_member, false)
})

// ── Instructor responde ────────────────────────────────────────────

test('el instructor ve la propuesta con la oferta y contraoferta (MatchesScreen)', async () => {
  const { c } = S.instructor
  const pending = ok(await c.from('matches').select('id, status, schedule_days, offered_rate').eq('status', 'pendiente'), 'matches pendientes')
  const mine = pending.find(m => m.id === S.matchId)
  assert.deepEqual(mine?.schedule_days, ['lunes', 'miercoles'], 'el instructor ve los días pedidos')
  assert.equal(mine?.offered_rate, 18000, 'el instructor ve la oferta por clase')

  // No puede cambiar nada de la propuesta salvo responderla
  await c.from('matches').update({ class_date: '2031-01-01', offered_rate: 99000 }).eq('id', S.matchId)
  const frozen = ok(await c.from('matches').select('class_date, offered_rate').eq('id', S.matchId).single(), 'leer')
  assert.deepEqual(frozen, { class_date: '2030-01-10', offered_rate: 18000 })

  ok(await c.from('matches').update({ counter_rate: 20000, note_instructor: 'Dale' }).eq('id', S.matchId), 'contraoferta')
  const m = ok(await c.from('matches').select('status, counter_rate, agreed_rate').eq('id', S.matchId).single(), 'leer match')
  assert.deepEqual(m, { status: 'pendiente', counter_rate: 20000, agreed_rate: null }, 'la contraoferta queda pendiente para el estudio')

  const again = await c.from('matches').update({ status: 'aceptado' }).eq('id', S.matchId)
  assert.match(again.error?.message ?? '', /esperando al estudio/, 'con contraoferta hecha, el instructor espera')
})

test('el estudio acepta la contraoferta y queda el monto acordado', async () => {
  const { c } = S.studio
  const seen = ok(await c.from('matches').select('counter_rate').eq('id', S.matchId).single(), 'ver contraoferta')
  assert.equal(seen.counter_rate, 20000)
  ok(await c.from('matches').update({ status: 'aceptado' }).eq('id', S.matchId), 'aceptar contraoferta')
  const m = ok(await c.from('matches').select('status, agreed_rate').eq('id', S.matchId).single(), 'leer match')
  assert.deepEqual(m, { status: 'aceptado', agreed_rate: 20000 })
  // Recién ahora la clase está cubierta: se descuenta del plan
  const q = ok(await c.rpc('studio_quota', { p_studio: S.studio.id }), 'cuota')
  assert.deepEqual({ covered: q.covered, pending: q.pending, available: q.available }, { covered: 1, pending: 0, available: 0 })
})

test('el estudio ve la respuesta del instructor', async () => {
  const { c } = S.studio
  const m = ok(await c.from('matches').select('status, note_instructor').eq('id', S.matchId).single(), 'leer match')
  assert.deepEqual(m, { status: 'aceptado', note_instructor: 'Dale' })
})

test('clase abierta: publicar reserva lugar, el instructor se anota, el estudio elige y recién ahí cuenta', async () => {
  const pub = (c) => c.rpc('publish_open_class', { p_class_type: 'reemplazo', p_class_date: '2030-01-14', p_start: '09:00:00', p_end: '10:00:00',
    p_days: null, p_from: null, p_to: null, p_offered: 15000, p_note: 'E2E abierta' })
  const limited = await pub(S.studio.c)
  assert.match(limited.error?.message ?? '', /MATCH_LIMIT_REACHED/, 'con el Freemium agotado no se puede publicar')
  // La entidad de prueba le da más propuestas al estudio
  ok(await cleaner.from('memberships').update({ matches_limit: 5 }).eq('studio_id', S.studio.id), 'subir plan')
  const openId = ok(await pub(S.studio.c), 'publicar')
  const after = ok(await S.studio.c.rpc('studio_quota', { p_studio: S.studio.id }), 'leer cuota')
  assert.deepEqual({ covered: after.covered, open: after.open, available: after.available }, { covered: 1, open: 1, available: 3 }, 'publicar reserva lugar sin consumir')

  const seen = ok(await S.instructor.c.from('open_classes').select('id, offered_rate, status').eq('status', 'abierta'), 'el instructor ve clases abiertas')
  assert.ok(seen.some(c => c.id === openId && c.offered_rate === 15000))
  ok(await S.instructor.c.from('open_class_applications').insert({ open_class_id: openId, instructor_id: S.instructor.id }), 'me anoto')
  const apps = ok(await S.studio.c.from('open_class_applications').select('instructor_id').eq('open_class_id', openId), 'el estudio ve anotados')
  assert.deepEqual(apps.map(a => a.instructor_id), [S.instructor.id])

  const wrong = await S.instructor.c.rpc('pick_open_class_applicant', { p_open_class: openId, p_instructor: S.instructor.id })
  assert.ok(wrong.error, 'solo el estudio elige')
  const matchId = ok(await S.studio.c.rpc('pick_open_class_applicant', { p_open_class: openId, p_instructor: S.instructor.id }), 'elegir')
  const m = ok(await S.studio.c.from('matches').select('status, agreed_rate, offered_rate').eq('id', matchId).single(), 'propuesta creada')
  assert.deepEqual(m, { status: 'aceptado', agreed_rate: 15000, offered_rate: 15000 })
  const oc = ok(await S.studio.c.from('open_classes').select('status, chosen_instructor_id').eq('id', openId).single(), 'clase cubierta')
  assert.deepEqual(oc, { status: 'cubierta', chosen_instructor_id: S.instructor.id })
  const used = ok(await S.studio.c.from('memberships').select('matches_used_month').eq('studio_id', S.studio.id).single(), 'leer plan')
  assert.equal(used.matches_used_month, 2, 'elegir instructor consumió el aviso')
  const gone = ok(await S.instructor.c.from('open_classes').select('id').eq('status', 'abierta'), 'ya no está abierta')
  assert.ok(!gone.some(c => c.id === openId))
})
