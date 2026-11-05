// Capturas en alta resolución para la ficha de Play Store (cuentas de prueba).
const { chromium } = require('playwright')
const [,, OUT = 'shots', BASE = 'http://localhost:8081'] = process.argv
require('fs').mkdirSync(OUT, { recursive: true })
const PASS = 'e2e-Test-Password-1'
;(async () => {
  const b = await chromium.launch()
  const page = async () => { const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }); await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(3500); return p }
  const shot = async (p, n) => { await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log('📸', n) }
  const tap = (p, s, exact = false) => p.getByText(s, { exact }).last().click({ timeout: 8000 })
  const login = async (p, email) => { await tap(p, 'Continuar con email'); await p.getByPlaceholder('hola@mipilates.com').fill(email); await p.getByPlaceholder('••••••••').fill(PASS); await tap(p, 'Iniciar sesión', true); await p.waitForTimeout(5000) }
  let p = await page(); await shot(p, '0-bienvenida'); await p.close()
  p = await page(); await login(p, 'visual-estudio2@e2e.pilatesmatch.test')
  await shot(p, '1-estudio-inicio')
  await tap(p, 'Buscar', true); await p.waitForTimeout(1500); await p.getByRole('switch').first().click(); await shot(p, '2-buscar')
  await tap(p, 'Marcelo'); await shot(p, '3-perfil-instructor')
  await p.mouse.wheel(0, 2000); await p.waitForTimeout(800); await tap(p, 'Pedir match'); await shot(p, '4-pedir-clase')
  await p.close()
  p = await page(); await login(p, 'visual-instructora@e2e.pilatesmatch.test')
  await tap(p, 'Propuestas', true); await tap(p, 'Historial'); await shot(p, '5-propuestas')
  await tap(p, 'Horarios', true); await shot(p, '6-horarios')
  await tap(p, 'Tarifas', true); await shot(p, '7-tarifas')
  await p.close()
  p = await page(); await login(p, 'qa-camara@qa.pilatesmatch.test'); await shot(p, '8-entidad-inicio')
  await tap(p, 'Lucía Fernández'); await shot(p, '9-verificar')
  await b.close()
})()
