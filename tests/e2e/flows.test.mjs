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

before(async () => { await anon.rpc('e2e_cleanup') })
after(async () => {
  const { data, error } = await anon.rpc('e2e_cleanup')
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
  const me = ok(await c.from('instructors').select('bio, verification_status').eq('id', id).single(), 'leer perfil')
  assert.equal(me.bio, 'Bio E2E')
  assert.equal(me.verification_status, 'pendiente')
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

test('la búsqueda de instructores del estudio no da error (SearchScreen)', async () => {
  const { c } = S.studio
  ok(await c.from('instructors').select(`
      id, full_name, neighborhood, avatar_url,
      rates:instructor_rates(rate_regular, rate_replacement),
      specialties:instructor_specialties(specialty),
      zones:instructor_zones(neighborhood)
    `).eq('verification_status', 'verificado').eq('is_active', true), 'búsqueda')
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
    class_date: '2030-01-10', start_time: '09:00', end_time: '10:00', note_studio: 'E2E',
  }).select().single(), 'crear match')
  S.matchId = match.id

  assert.equal(ok(await c.rpc('can_studio_match', { p_studio_id: id }), 'can_studio_match'), false)
  const second = await c.from('matches').insert({
    studio_id: id, instructor_id: S.instructor.id, class_date: '2030-01-11', start_time: '09:00', end_time: '10:00',
  })
  assert.equal(second.error?.message, 'MATCH_LIMIT_REACHED')
})

test('el estudio no puede subirse el plan ni resetear el contador', async () => {
  const { c, id } = S.studio
  await c.from('memberships').update({ matches_limit: null, matches_used_month: 0 }).eq('studio_id', id)
  await c.from('studios').update({ is_member: true }).eq('id', id)
  const m = ok(await c.from('memberships').select('matches_limit, matches_used_month').eq('studio_id', id).single(), 'leer membresía')
  assert.deepEqual(m, { matches_limit: 1, matches_used_month: 1 })
  const s = ok(await c.from('studios').select('is_member').eq('id', id).single(), 'leer estudio')
  assert.equal(s.is_member, false)
})

// ── Instructor responde ────────────────────────────────────────────

test('el instructor ve la propuesta y la acepta (MatchesScreen)', async () => {
  const { c } = S.instructor
  const pending = ok(await c.from('matches').select('id, status').eq('status', 'pendiente'), 'matches pendientes')
  assert.ok(pending.some(m => m.id === S.matchId), 'la propuesta tiene que aparecerle al instructor')

  ok(await c.from('matches').update({ status: 'aceptado', note_instructor: 'Dale', responded_at: new Date().toISOString() }).eq('id', S.matchId), 'responder')
  const m = ok(await c.from('matches').select('status').eq('id', S.matchId).single(), 'leer match')
  assert.equal(m.status, 'aceptado', 'la respuesta tiene que guardarse')
})

test('el estudio ve la respuesta del instructor', async () => {
  const { c } = S.studio
  const m = ok(await c.from('matches').select('status, note_instructor').eq('id', S.matchId).single(), 'leer match')
  assert.deepEqual(m, { status: 'aceptado', note_instructor: 'Dale' })
})
