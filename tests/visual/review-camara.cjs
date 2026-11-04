// Revisión visual del panel de la entidad con el administrador de la "Red de prueba (QA)".
// Requiere `node tests/visual/seed.mjs` antes. Uso: node tests/visual/review-camara.cjs <carpeta> [url]
const { chromium } = require('playwright')
const [,, OUT = 'shots', BASE = 'http://localhost:8081'] = process.argv
require('fs').mkdirSync(OUT, { recursive: true })
;(async () => {
  const b = await chromium.launch()
  const errors = []
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  p.on('pageerror', e => errors.push(e.message.slice(0, 160)))
  p.on('response', r => { if (r.status() >= 400 && r.url().includes('supabase')) errors.push(`${r.status()} ${r.url().split('?')[0].slice(-60)}`) })
  const shot = async (n) => { await p.waitForTimeout(2200); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log('📸', n) }
  const tap = (s, exact = false) => p.getByText(s, { exact }).last().click({ timeout: 8000 })
  const back = async () => { await p.getByLabel(/^Volver a /).last().click({ timeout: 8000 }); await p.waitForTimeout(1500) }
  const step = async (name, fn) => { try { await fn() } catch (e) { console.log(`✗ ${name}: ${e.message.split('\n')[0].slice(0, 120)}`) } }

  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(3500)
  await tap('Continuar con email')
  await p.getByPlaceholder('hola@mipilates.com').fill('qa-camara@qa.pilatesmatch.test')
  await p.getByPlaceholder('••••••••').fill('e2e-Test-Password-1')
  await tap('Iniciar sesión', true); await p.waitForTimeout(6000)

  await step('inicio', async () => { await shot('c01-inicio'); await p.mouse.wheel(0, 1200); await shot('c02-inicio-abajo'); await p.mouse.wheel(0, -3000) })
  await step('verificar', async () => { await tap('Lucía Fernández'); await shot('c03-verificar'); await p.mouse.wheel(0, 1500); await shot('c04-verificar-abajo'); await back() })
  await step('notif', async () => { await p.getByLabel(/Notificaciones/).first().click(); await shot('c05-notificaciones'); await back() })
  await step('perfil', async () => { await p.mouse.click(195, 105); await shot('c06-perfil'); await p.mouse.wheel(0, 1500); await shot('c07-perfil-equipo'); await back() })
  await step('instructores', async () => { await tap('Instructores', true); await shot('c08-instructores') })
  await step('estudios', async () => { await tap('Estudios', true); await shot('c09-estudios'); await tap('Estudio Núcleo'); await shot('c10-detalle-estudio'); await p.mouse.wheel(0, 1500); await shot('c11-detalle-estudio-abajo'); await back() })
  await step('tarifas', async () => { await tap('Tarifas', true); await shot('c12-tarifas') })
  await step('reportes', async () => { await tap('Reportes', true); await shot('c13-reportes'); await p.mouse.wheel(0, 1500); await shot('c14-reportes-2'); await p.mouse.wheel(0, 1500); await shot('c15-reportes-3') })
  console.log('ERRORES:', JSON.stringify(errors.slice(0, 15)))
  await b.close()
})()
