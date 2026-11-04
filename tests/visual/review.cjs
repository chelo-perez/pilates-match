// Revisión visual completa: recorre todas las pantallas a las que llegan las cuentas de prueba
// (registro, estudio e instructora) y saca una captura de cada una.
// Uso: node tests/visual/review.cjs <carpeta-salida> [url]
const { chromium } = require('playwright')
const [,, OUT = 'shots', BASE = 'http://localhost:8081'] = process.argv
const PASS = 'e2e-Test-Password-1'
require('fs').mkdirSync(OUT, { recursive: true })
;(async () => {
  const b = await chromium.launch()
  const errors = []
  const page = async () => {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } })
    p.on('pageerror', e => errors.push(e.message.slice(0, 160)))
    await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(3500)
    return p
  }
  const shot = async (p, n) => { await p.waitForTimeout(2200); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log('📸', n) }
  const tap = (p, s, exact = false) => p.getByText(s, { exact }).last().click({ timeout: 8000 })
  const back = async (p) => { await p.getByLabel(/^Volver a /).last().click({ timeout: 8000 }); await p.waitForTimeout(1500) }
  const login = async (p, email) => {
    await tap(p, 'Continuar con email')
    await p.getByPlaceholder('hola@mipilates.com').fill(email); await p.getByPlaceholder('••••••••').fill(PASS)
    await tap(p, 'Iniciar sesión', true); await p.waitForTimeout(5000)
  }
  const step = async (name, fn) => { try { await fn() } catch (e) { console.log(`✗ ${name}: ${e.message.split('\n')[0].slice(0, 120)}`) } }

  let p = await page()
  await step('login', async () => { await shot(p, 'a1-bienvenida'); await tap(p, 'Continuar con email'); await shot(p, 'a2-login') })
  await p.close(); p = await page()
  await step('registro', async () => {
    await tap(p, 'Registrate'); await shot(p, 'a3-elegir-rol')
    await tap(p, 'Tengo un estudio'); await shot(p, 'a4-registro-estudio')
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(3000)
    await tap(p, 'Registrate'); await tap(p, 'Soy instructor'); await shot(p, 'a5-registro-instructor')
  })
  await p.close()

  // Estudio
  p = await page(); await login(p, 'visual-estudio@e2e.pilatesmatch.test')
  await step('estudio', async () => {
    await shot(p, 'e01-inicio')
    await p.getByLabel(/Notificaciones/).first().click(); await shot(p, 'e02-notificaciones'); await back(p)
    await tap(p, 'Buscar', true); await shot(p, 'e03-buscar')
    await p.getByRole('switch').first().click(); await p.waitForTimeout(2000); await shot(p, 'e04-buscar-todos')
    await tap(p, 'Marcelo'); await shot(p, 'e05-perfil-instructor'); await back(p)
    await tap(p, 'Historial', true); await shot(p, 'e06-historial')
    await tap(p, 'Evaluaciones', true); await shot(p, 'e07-historial-evaluaciones')
    await tap(p, 'Evaluar', true); await shot(p, 'e08-evaluar')
    await tap(p, 'Evaluar a'); await shot(p, 'e09-evaluar-instructor'); await back(p)
    await tap(p, 'Inicio', true); await p.waitForTimeout(1500)
    await p.mouse.wheel(0, 1500); await shot(p, 'e10-inicio-abajo')
  })
  await step('estudio-plan', async () => { await tap(p, 'Ver mi plan'); await shot(p, 'e11-mi-plan'); await back(p) })
  await step('estudio-perfil', async () => { await tap(p, 'Inicio', true); await p.mouse.wheel(0, -3000); await p.waitForTimeout(800); await p.locator('text=E').first(); await p.mouse.click(195, 100); await shot(p, 'e12-perfil-estudio') })
  await p.close()
  p = await page(); await login(p, 'visual-estudio2@e2e.pilatesmatch.test')
  await step('pedir', async () => {
    await tap(p, 'Buscar', true); await p.waitForTimeout(2000); await p.getByRole('switch').first().click(); await p.waitForTimeout(2000)
    await tap(p, 'Marcelo'); await p.mouse.wheel(0, 2000); await p.waitForTimeout(800)
    await tap(p, 'Pedir match'); await shot(p, 'e13-pedir-clase')
  })
  await p.close()

  // Instructora
  p = await page(); await login(p, 'visual-instructora@e2e.pilatesmatch.test')
  await step('instructora', async () => {
    await shot(p, 'i01-inicio')
    await p.getByLabel(/Notificaciones/).first().click(); await shot(p, 'i02-notificaciones'); await back(p)
    await tap(p, 'Propuestas', true); await shot(p, 'i03-propuestas')
    await tap(p, 'Historial'); await shot(p, 'i04-propuestas-historial')
    await tap(p, 'Evaluar estudio'); await shot(p, 'i05-evaluar-estudio'); await back(p)
    await tap(p, 'Horarios', true); await shot(p, 'i06-horarios')
    await tap(p, 'Agregar horario', true); await shot(p, 'i07-agregar-horario'); await p.keyboard.press('Escape'); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(4000)
    await tap(p, 'Horarios', true); await tap(p, 'Zonas'); await shot(p, 'i08-zonas')
  })
  await step('instructora-2', async () => {
    await tap(p, 'Tarifas', true); await shot(p, 'i09-tarifas')
    await tap(p, 'Perfil', true); await shot(p, 'i10-perfil'); await p.mouse.wheel(0, 1500); await shot(p, 'i11-perfil-abajo')
  })
  await p.close()
  console.log('ERRORES:', JSON.stringify(errors.slice(0, 15)))
  await b.close()
})()
