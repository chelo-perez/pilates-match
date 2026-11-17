// Instructivo al entrar a la app (como la guía de inicio de Facturo Más Fácil): pantallas que se superponen
// y señalan con una flecha cada sección del menú. Aparece en cada sesión hasta que la persona hace lo
// importante de su rol:
//   - Estudio: enviar su primera propuesta (o publicar una clase abierta).
//   - Instructor: quedar verificado por la entidad.
//   - Entidad: hasta que toca "Entendido" al final, o "No volver a mostrar".
// Se puede volver a ver desde el perfil (showGuide()).
import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions, LayoutRectangle } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store'
import { entity } from '../lib/entity'
import { colors } from './ui'

// ── Estado global: abrir la guía desde cualquier pantalla ─────────────
const useGuideStore = create<{ open: boolean; set: (v: boolean) => void }>(set => ({ open: false, set: open => set({ open }) }))
export const showGuide = () => useGuideStore.getState().set(true)

// Posiciones del menú lateral (portal de escritorio): las registra el menú con onLayout
const sideTargets = new Map<string, LayoutRectangle>()
export const registerGuideTarget = (name: string, r: LayoutRectangle) => { sideTargets.set(name, r) }

let shownThisSession = false
const doneKey = (uid: string) => `guide-done-v1-${uid}`

type Target = { tab: number; of: number } | { side: string } | null
interface Step { title: string; text: string; target?: Target; cta?: { label: string; go: (nav: any) => void } }

const WIDE = 900

function stepsFor(role: string, wide: boolean): Step[] {
  const e = entity()
  if (role === 'estudio') return [
    { title: '¡Bienvenido a Trabajo Más Fácil!', text: 'En un minuto te mostramos cómo cubrir tu primera clase con instructores verificados.' },
    { title: 'Buscar', target: { tab: 1, of: 4 }, text: 'Elegí el día y el horario de la clase. Te mostramos los instructores verificados que encajan, ordenados por compatibilidad.' },
    { title: 'Historial', target: { tab: 2, of: 4 }, text: 'Tus propuestas y en qué estado están. Cuando una clase se confirma, ves el contacto del instructor.' },
    { title: 'Evaluar', target: { tab: 3, of: 4 }, text: 'Después de cada clase contás cómo te fue. Ayuda a cuidar la calidad de la red.' },
    { title: 'Inicio', target: { tab: 0, of: 4 }, text: `Tu plan, los avisos que te quedan este mes y los beneficios de tu red.` },
    { title: '¿Arrancamos?', text: 'Buscá un instructor para tu próxima clase. Esta guía aparece hasta que envíes tu primera propuesta.',
      cta: { label: 'Buscar instructor', go: nav => nav.navigate('EstudioHome', { screen: 'Search' }) } },
  ]
  if (role === 'instructor') return [
    { title: '¡Bienvenido a Trabajo Más Fácil!', text: 'En un minuto te mostramos cómo empezar a recibir propuestas de los estudios de tu red.' },
    { title: 'Perfil', target: { tab: 4, of: 5 }, text: `Cargá tus certificados. ${e.La} los revisa y te verifica: recién ahí aparecés en las búsquedas de los estudios.` },
    { title: 'Horarios', target: { tab: 2, of: 5 }, text: 'Cuándo podés tomar reemplazos y en qué zonas trabajás. Las clases regulares te las proponen los estudios.' },
    { title: 'Tarifas', target: { tab: 3, of: 5 }, text: 'Cuánto cobrás por clase. Es privada: los estudios no la ven, solo te avisamos si su oferta la cubre.' },
    { title: 'Propuestas', target: { tab: 1, of: 5 }, text: 'Te llega un aviso y respondés con un toque: aceptás, rechazás o proponés otro monto.' },
    { title: 'Completá tu perfil', text: `Con tus certificados cargados, ${e.la} te puede verificar. Esta guía aparece hasta que estés verificado.`,
      cta: { label: 'Ir a mi perfil', go: nav => nav.navigate('InstructorTabs', { screen: 'InstructorPerfil' }) } },
  ]
  // Entidad
  if (wide) return [
    { title: `Bienvenido al portal ${e.de}`, text: 'Desde acá verificás instructores, gestionás los estudios de tu red y seguís la actividad.' },
    { title: 'Resumen', target: { side: 'EntityResumen' }, text: 'Lo que tenés para hacer: instructores por verificar, avisos para aprobar y facturas.' },
    { title: 'Instructores', target: { side: 'AdminInstructores' }, text: 'Abrí cada certificado, aprobalo o rechazalo, y verificá al instructor para que aparezca en las búsquedas.' },
    { title: 'Estudios', target: { side: 'AdminEstudios' }, text: 'Hacé socios a los estudios, cambiá su plan o bloqueales las propuestas.' },
    { title: 'Patrocinios', target: { side: 'AdminPatrocinios' }, text: 'Beneficios y formaciones para tu red: aprobá los que te propone la plataforma o cargá los que consigas.' },
    { title: 'Reportes y pagos', target: { side: 'EntityReportes' }, text: 'La actividad de la red y lo que corresponde pagar o cobrar cada mes.' },
    { title: '¡Listo!', text: 'Podés volver a ver esta guía desde "Perfil y equipo".' },
  ]
  return [
    { title: `Bienvenido al panel ${e.de}`, text: 'Desde acá verificás instructores y gestionás los estudios de tu red.' },
    { title: 'Instructores', target: { tab: 1, of: 5 }, text: 'Abrí cada certificado, aprobalo o rechazalo, y verificá al instructor para que aparezca en las búsquedas.' },
    { title: 'Estudios', target: { tab: 2, of: 5 }, text: 'Hacé socios a los estudios, cambiá su plan o bloqueales las propuestas.' },
    { title: 'Tarifas', target: { tab: 3, of: 5 }, text: 'El rango de referencia que ven los instructores al cargar sus tarifas.' },
    { title: 'Reportes', target: { tab: 4, of: 5 }, text: 'La actividad de la red y lo que corresponde pagar o cobrar cada mes.' },
    { title: '¡Listo!', text: 'En la compu tenés el portal completo, con patrocinios y más detalle. Podés volver a ver esta guía desde tu perfil.' },
  ]
}

/** ¿La persona ya hizo lo importante de su rol? (entonces la guía no aparece sola) */
async function keyActionDone(role: string, uid: string): Promise<boolean> {
  if (role === 'estudio') {
    const { data: st } = await supabase.from('studios').select('id').eq('user_id', uid).maybeSingle()
    if (!st) return false
    const [m, oc] = await Promise.all([
      supabase.from('matches').select('id', { count: 'exact', head: true }).eq('studio_id', st.id),
      supabase.from('open_classes').select('id', { count: 'exact', head: true }).eq('studio_id', st.id),
    ])
    return (m.count ?? 0) + (oc.count ?? 0) > 0
  }
  if (role === 'instructor') {
    const { data } = await supabase.from('instructors').select('verification_status').eq('user_id', uid).maybeSingle()
    return data?.verification_status === 'verificado'
  }
  return false
}

export default function AppGuide({ navigationRef }: { navigationRef: any }) {
  const user = useAuthStore(s => s.user)
  const open = useGuideStore(s => s.open), setOpen = useGuideStore(s => s.set)
  const [i, setI] = useState(0)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const role = user?.role as string | undefined
  const wide = width >= WIDE && role === 'camara_admin'
  const steps = useMemo(() => (role ? stepsFor(role, wide) : []), [role, wide])

  // Abrir sola una vez por sesión, si corresponde
  useEffect(() => {
    if (!user?.id || !role || shownThisSession || !['estudio', 'instructor', 'camara_admin'].includes(role)) return
    let alive = true
    ;(async () => {
      try { if (await AsyncStorage.getItem(doneKey(user.id))) return } catch { /* sin storage: sigue */ }
      if (await keyActionDone(role, user.id).catch(() => true)) return
      // Un momento para que termine la animación de entrada
      setTimeout(() => { if (alive && !shownThisSession) { shownThisSession = true; setI(0); setOpen(true) } }, 1200)
    })()
    return () => { alive = false }
  }, [user?.id, role])

  useEffect(() => { if (open) setI(0) }, [open])

  if (!open || !steps.length) return null
  const step = steps[Math.min(i, steps.length - 1)]
  const last = i === steps.length - 1
  const close = () => { shownThisSession = true; setOpen(false) }
  const never = async () => { close(); try { if (user?.id) await AsyncStorage.setItem(doneKey(user.id), '1') } catch {} }
  const finish = async () => { if (role === 'camara_admin') await never(); else close() }

  // Dónde está lo que se señala
  let ring: { x: number; y: number; w: number; h: number } | null = null
  const t = step.target
  if (t && 'tab' in t && box.w) {
    const tabH = 70 + (insets.bottom || 0)
    const w = box.w / t.of
    ring = { x: w * t.tab + w / 2 - 34, y: box.h - tabH + 2, w: 68, h: 58 }
  } else if (t && 'side' in t) {
    const r = sideTargets.get(t.side)
    if (r) ring = { x: r.x - 4, y: r.y - 4, w: r.width + 8, h: r.height + 8 }
  }
  const sideMode = !!ring && !!t && 'side' in t
  const cardStyle = !ring ? s.cardCenter
    : sideMode ? { position: 'absolute' as const, left: ring.x + ring.w + 40, top: Math.max(24, ring.y - 30), width: 380 }
    : { position: 'absolute' as const, left: 16, right: 16, bottom: box.h - ring.y + 46 }

  return (
    <View style={StyleSheet.absoluteFill} onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Pressable style={s.dim} onPress={() => {}} accessibilityLabel="Guía de uso" />
      {ring ? (
        <>
          <View pointerEvents="none" style={[s.ring, { left: ring.x, top: ring.y, width: ring.w, height: ring.h }]} />
          <View pointerEvents="none" style={sideMode
            ? { position: 'absolute', left: ring.x + ring.w + 8, top: ring.y + ring.h / 2 - 14 }
            : { position: 'absolute', left: ring.x + ring.w / 2 - 14, top: ring.y - 36 }}>
            <Feather name={sideMode ? 'arrow-left' : 'arrow-down'} size={28} color={colors.white} />
          </View>
        </>
      ) : null}
      <View style={[s.card, cardStyle, !ring && { maxWidth: 420 }]}>
        <Text style={s.count}>{i + 1} de {steps.length}</Text>
        <Text style={s.title}>{step.title}</Text>
        <Text style={s.text}>{step.text}</Text>
        <View style={s.row}>
          {i > 0 ? <Pressable onPress={() => setI(i - 1)} hitSlop={8}><Text style={s.back}>Anterior</Text></Pressable> : <View />}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {last && step.cta ? (
              <Pressable style={s.btn} onPress={() => { close(); try { step.cta!.go(navigationRef) } catch {} }}>
                <Text style={s.btnTxt}>{step.cta.label}</Text>
              </Pressable>
            ) : (
              <Pressable style={s.btn} onPress={() => (last ? finish() : setI(i + 1))}>
                <Text style={s.btnTxt}>{last ? 'Entendido' : i === 0 ? 'Mostrame' : 'Siguiente'}</Text>
              </Pressable>
            )}
          </View>
        </View>
        <View style={s.footRow}>
          {!last ? <Pressable onPress={close} hitSlop={8}><Text style={s.skip}>Ahora no</Text></Pressable> : <View />}
          <Pressable onPress={never} hitSlop={8}><Text style={s.skip}>No volver a mostrar</Text></Pressable>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  dim:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,25,27,0.72)' },
  ring:       { position: 'absolute', borderRadius: 16, borderWidth: 3, borderColor: colors.white, backgroundColor: 'rgba(255,255,255,0.12)' },
  card:       { backgroundColor: colors.white, borderRadius: 18, padding: 20, ...(Platform.OS === 'web' ? { boxShadow: '0 12px 40px rgba(0,0,0,0.25)' } : { elevation: 8 }) } as any,
  cardCenter: { position: 'absolute', left: 20, right: 20, top: '30%', alignSelf: 'center', marginHorizontal: 'auto' } as any,
  count:      { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.light, letterSpacing: 0.5 },
  title:      { fontFamily: 'Nunito-Bold', fontSize: 19, color: colors.dark, marginTop: 4 },
  text:       { fontFamily: 'Nunito-Regular', fontSize: 14, lineHeight: 21, color: colors.mid, marginTop: 6 },
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  back:       { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.mid },
  btn:        { backgroundColor: colors.sage, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18 },
  btnTxt:     { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.white },
  footRow:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  skip:       { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.light },
})
