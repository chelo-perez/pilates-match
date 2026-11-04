// Recorre pantallas internas (no solo pestañas) con las cuentas de tests/visual/seed.mjs.
// Uso: node tests/visual/tour.cjs <carpeta-salida> [url]
const { chromium } = require('playwright')
const [,, OUT = 'shots', BASE = 'http://localhost:8081'] = process.argv
const PASS = 'e2e-Test-Password-1'
;(async () => {
  const b = await chromium.launch()
  const errors = []
  const page = async () => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } })
    p.on('pageerror', e => errors.push(e.message.slice(0, 160)))
    p.on('response', r => { if (r.status() >= 400 && r.url().includes('supabase')) errors.push(`${r.status()} ${r.url().split('?')[0].slice(-50)}`) })
    await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(3500)
    return p
  }
  const shot = async (p, n) => { await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log('📸', n) }
  const tap = (p, s, exact = false) => p.getByText(s, { exact }).last().click({ timeout: 8000 })
  const login = async (p, email) => {
    await tap(p, 'Continuar con email')
    await p.getByPlaceholder('hola@mipilates.com').fill(email); await p.getByPlaceholder('••••••••').fill(PASS)
    await tap(p, 'Iniciar sesión', true); await p.waitForTimeout(5000)
  }
  const step = async (name, fn) => { try { await fn() } catch (e) { console.log(`✗ ${name}: ${e.message.split('\n')[0].slice(0, 120)}`) } }

  // Registro
  let p = await page()
  await step('registro', async () => {
    await tap(p, 'Registrate'); await shot(p, 'r1-elegir-rol')
    await tap(p, 'Tengo un estudio'); await shot(p, 'r2-registro-estudio'); await tap(p, 'Elegí el barrio'); await shot(p, 'r2b-selector-barrio')
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(3000)
    await tap(p, 'Registrate'); await tap(p, 'Soy instructor'); await shot(p, 'r3-registro-instructor')
  })
  await p.close()

  // Estudio con propuesta aceptada ayer
  p = await page(); await login(p, 'visual-estudio@e2e.pilatesmatch.test')
  await step('evaluar', async () => { await tap(p, 'Evaluar', true); await shot(p, 'e1-pendientes'); await tap(p, 'Evaluar a'); await shot(p, 'e2-evaluar-instructor'); await p.mouse.wheel(0, 900); await shot(p, 'e2b-evaluar-instructor') })
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(4000)
  await step('historial', async () => { await tap(p, 'Historial', true); await shot(p, 'e3-historial') })
  await step('paywall', async () => {
    await tap(p, 'Buscar', true); await p.waitForTimeout(2000); await p.getByRole('switch').first().click(); await p.waitForTimeout(2000)
    await tap(p, 'Marcelo'); await shot(p, 'e4-perfil-instructor'); await p.mouse.wheel(0, 2000); await p.waitForTimeout(800)
    await tap(p, 'Ver mi plan', true); await shot(p, 'e5-paywall'); await p.mouse.wheel(0, 900); await shot(p, 'e5b-paywall')
  })
  await p.close()

  // Estudio sin propuestas: formulario de pedir clase
  p = await page(); await login(p, 'visual-estudio2@e2e.pilatesmatch.test')
  await step('pedir', async () => {
    await tap(p, 'Buscar', true); await p.waitForTimeout(2000); await p.getByRole('switch').first().click(); await p.waitForTimeout(2000)
    await tap(p, 'Marcelo'); await p.mouse.wheel(0, 2000); await p.waitForTimeout(800)
    await tap(p, 'Pedir match'); await shot(p, 'e6-pedir-reemplazo')
    await tap(p, 'Regular', true); await shot(p, 'e7-pedir-regular'); await p.mouse.wheel(0, 900); await shot(p, 'e8-pedir-regular-2')
  })
  await p.close()

  // Instructora: historial y evaluar estudio
  p = await page(); await login(p, 'visual-instructora@e2e.pilatesmatch.test')
  await step('instructora', async () => {
    await tap(p, 'Propuestas', true); await tap(p, 'Historial'); await shot(p, 'i1-historial')
    await tap(p, 'Evaluar estudio'); await shot(p, 'i2-evaluar-estudio')
  })
  await p.close()
  console.log('ERRORES:', JSON.stringify(errors.slice(0, 15)))
  await b.close()
})()
