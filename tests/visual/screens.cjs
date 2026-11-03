// Saca capturas de la app (versión web) logueándose con las cuentas de tests/visual/seed.mjs.
// Uso: node tests/visual/screens.cjs <rol: estudio|instructora> <carpeta-salida> [url]
const { chromium } = require('playwright')
const [,, ROLE = 'estudio', OUT = 'shots', BASE = 'http://localhost:8081'] = process.argv
const EMAIL = ROLE === 'estudio' ? 'visual-estudio@e2e.pilatesmatch.test' : 'visual-instructora@e2e.pilatesmatch.test'
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true })

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const errors = []
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)))
  p.on('response', r => { if (r.status() >= 400 && r.url().includes('supabase')) errors.push(`${r.status()} ${r.url().split('?')[0].slice(-60)}`) })
  let n = 0
  const shot = async (name) => { await p.waitForTimeout(2500); const f = `${OUT}/${ROLE}-${String(++n).padStart(2, '0')}-${name}.png`; await p.screenshot({ path: f }); console.log('📸', f) }
  const click = async (text) => { await p.getByText(text, { exact: false }).first().click({ timeout: 8000 }) }

  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000)
  await click('Iniciar sesión con email')
  await p.waitForTimeout(800)
  await shot('login-email')
  await p.getByPlaceholder('hola@mipilates.com').fill(EMAIL)
  await p.getByPlaceholder('••••••••').fill('e2e-Test-Password-1')
  await p.getByText('Iniciar sesión', { exact: true }).last().click()
  await p.waitForTimeout(5000)
  await shot('inicio')
  const TABS = { estudio: ['Buscar', 'Historial', 'Evaluar'], instructora: ['Propuestas', 'Horarios', 'Tarifas', 'Perfil'] }
  const all = await p.evaluate(() => document.body.innerText)
  const tabs = ['Inicio', ...(TABS[ROLE] || [])]
  console.log('TEXTO INICIO:', all.slice(0, 400).replace(/\n+/g, ' | '))
  console.log('TABS:', JSON.stringify(tabs))
  for (const t of tabs.slice(1)) { try { await p.getByText(t, { exact: true }).last().click(); await shot('tab-' + t.toLowerCase().replace(/\W+/g, '-')) } catch (e) { console.log('no pude abrir', t) } }
  console.log('ERRORES:', JSON.stringify(errors.slice(0, 15)))
  await b.close()
})()
