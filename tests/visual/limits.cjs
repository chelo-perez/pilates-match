// Prueba de límites de propuestas (red de prueba QA):
//  A) Freemium (1/mes) que ya envió 1 → intenta la 2ª
//  B) Starter (5/mes) que ya envió 5 → intenta la 6ª
// En cada caso: qué ve en la app y si la base la rechaza aunque se intente saltear la app.
const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const [,, OUT = 'shots', BASE = 'http://localhost:8081'] = process.argv
fs.mkdirSync(OUT, { recursive: true })
const URL = 'https://tkhaiovstwgqzabvxxss.supabase.co'
const KEY = fs.readFileSync(__dirname + '/seed.mjs', 'utf8').match(/const KEY = '([^']+)'/)[1]
const PASS = 'e2e-Test-Password-1'
const login = async (email) => { const c = createClient(URL, KEY, { auth: { persistSession: false } }); const r = await c.auth.signInWithPassword({ email, password: PASS }); if (r.error) throw r.error; return c }

;(async () => {
  const admin = await login('qa-camara@qa.pilatesmatch.test')
  const studio = await login('visual-estudio@e2e.pilatesmatch.test')
  const { data: st } = await studio.from('studios').select('id').single()
  const { data: ins } = await studio.from('instructors').select('id').eq('full_name', 'Marcelo Pérez').single()
  const memb = async () => (await studio.from('memberships').select('plan_type, matches_used_month, matches_limit').eq('studio_id', st.id).single()).data
  const count = async () => (await studio.from('matches').select('id', { count: 'exact', head: true }).eq('studio_id', st.id)).count

  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []; p.on('pageerror', e => errors.push(e.message.slice(0, 160)))
  const shot = async (n) => { await p.waitForTimeout(2200); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log('   📸', n) }
  const tap = (s, exact = false) => p.getByText(s, { exact }).last().click({ timeout: 8000 })
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(3500)
  await tap('Continuar con email')
  await p.getByPlaceholder('hola@mipilates.com').fill('visual-estudio@e2e.pilatesmatch.test'); await p.getByPlaceholder('••••••••').fill(PASS)
  await tap('Iniciar sesión', true); await p.waitForTimeout(5000)

  const attempt = async (tag) => {
    console.log(`   plan: ${JSON.stringify(await memb())} · propuestas en la base: ${await count()}`)
    await tap('Buscar', true); await p.waitForTimeout(2000); await p.getByRole('switch').first().click(); await p.waitForTimeout(2000)
    await tap('Marcelo'); await p.mouse.wheel(0, 2000); await p.waitForTimeout(800); await shot(`${tag}1-perfil`)
    const txt = await p.evaluate(() => document.body.innerText)
    console.log('   botón en el perfil:', /Pedir match/.test(txt) ? '"Pedir match"' : /Ver mi plan/.test(txt) ? '"Ver mi plan" (bloqueado)' : '¿?')
    if (/Pedir match/.test(txt)) {
      await tap('Pedir match'); await p.mouse.wheel(0, 2000); await p.waitForTimeout(600); await shot(`${tag}2-formulario`)
      const t2 = await p.evaluate(() => document.body.innerText)
      if (/Enviar solicitud/.test(t2)) { await tap('Enviar solicitud'); await p.waitForTimeout(3500) }
      await shot(`${tag}3-resultado`)
    } else {
      await tap('Ver mi plan', true); await shot(`${tag}2-al-tocar`)
    }
    // Intento directo a la base, salteando la app
    const d = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10)
    const r = await studio.from('matches').insert({ studio_id: st.id, instructor_id: ins.id, class_type: 'reemplazo', class_date: d, start_time: '10:00', end_time: '11:00', status: 'pendiente' })
    console.log('   intento directo a la base:', r.error ? `RECHAZADO (${r.error.message})` : 'ACEPTADO ⚠️')
    console.log(`   después: ${JSON.stringify(await memb())} · propuestas en la base: ${await count()}`)
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(4500)
  }

  console.log('A) FREEMIUM, 2ª propuesta'); await attempt('a')

  const end = new Date(); end.setMonth(end.getMonth() + 1)
  const { error } = await admin.from('memberships').update({
    plan_type: 'starter', matches_limit: 5, matches_used_month: 5, status: 'activa',
    last_reset_date: new Date().toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10),
  }).eq('studio_id', st.id)
  if (error) throw error
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(4500)
  console.log('B) STARTER con 5 usadas, 6ª propuesta'); await attempt('b')
  console.log('ERRORES DE LA APP:', JSON.stringify(errors))
  await b.close()
})().catch(e => { console.error('FALLÓ:', e.message); process.exit(1) })
