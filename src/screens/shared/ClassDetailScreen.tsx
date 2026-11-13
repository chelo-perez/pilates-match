// Ficha de una clase confirmada (estudio e instructor ven la misma, cada uno desde su lado).
// Reemplazo: cuándo y dónde, contacto, recordatorio en el calendario, cancelar con motivo,
// "¿Se dio la clase?" y evaluación. Regular: entrevista con clase de prueba y, después,
// el estudio decide si la suma como clase regular.
import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store'
import { errorText } from '../../lib/errors'
import { DAYS_SHORT, publishOpenClass, money } from '../../lib/openClasses'
import {
  addToCalendar, cancelConfirmed, matchEnd, confirmHeld, decideHire, endRegular, isConfirmed, matchStart, MATCH_KEYS,
  openCall, openMaps, openWhatsApp, phaseOf, useEvaluated, useMatchContact, useMatchDetail, waNumber,
} from '../../lib/matchFlow'
import HeroHeader from '../../components/HeroHeader'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { Button, EmptyState, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'

const DAY_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const hhmm = (t?: string | null) => String(t ?? '').slice(0, 5)
const longDate = (iso: string) => {
  const s = new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
function timeUntil(d: Date) {
  const min = Math.round((d.getTime() - Date.now()) / 60000)
  if (min < 60) return `en ${Math.max(min, 1)} min`
  const h = Math.round(min / 60)
  if (h < 24) return `en ${h} h`
  const days = Math.round(h / 24)
  return days === 1 ? 'mañana' : `en ${days} días`
}

const REASONS: Record<'estudio' | 'instructor', string[]> = {
  instructor: ['Me enfermé', 'Surgió un imprevisto', 'Me superpuse con otra clase'],
  estudio: ['Ya no necesito el reemplazo', 'Se suspendió la clase', 'Surgió un imprevisto'],
}

export default function ClassDetailScreen({ navigation, route }: any) {
  const matchId: string | undefined = route?.params?.matchId
  const role = useAuthStore(s => s.user?.role)
  const side: 'estudio' | 'instructor' = role === 'instructor' ? 'instructor' : 'estudio'
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()
  const { toast, showToast, hideToast } = useToast()
  const { data: m, isLoading, refetch } = useMatchDetail(matchId)
  const phase = phaseOf(m)
  const confirmed = isConfirmed(m)
  const { data: contact } = useMatchContact(matchId, confirmed)
  const { data: evaluated } = useEvaluated(m, side)
  const [busy, setBusy] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState<'cancel' | 'end' | null>(null)
  const [reason, setReason] = useState('')

  if (isLoading) return <LoadingScreen />
  if (!m) return <EmptyState icon="calendar" title="No encontramos esta clase" action="Volver" onAction={() => navigation.goBack()} />

  const isRegular = m.class_type === 'regular'
  const other = side === 'estudio'
    ? { name: m.instructor?.full_name ?? 'Instructor', area: m.instructor?.neighborhood, photo: m.instructor?.avatar_url }
    : { name: m.studio?.name ?? 'Estudio', area: m.studio?.neighborhood, photo: m.studio?.logo_url }
  const firstName = other.name.split(' ')[0]
  const start = matchStart(m)
  const late = start.getTime() - Date.now() < 24 * 3600_000
  const held = side === 'estudio' ? m.held_studio : m.held_instructor
  const scheduleDays: string[] = (m.schedule_days ?? []).slice().sort((a: string, b: string) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
  const schedule = scheduleDays.length ? `${scheduleDays.map(d => DAYS_SHORT[d] ?? d).join(', ')} · ${hhmm(m.schedule_from)}–${hhmm(m.schedule_to)}` : null
  const eventTitle = `${isRegular ? 'Clase de prueba' : 'Reemplazo'} · ${other.name}`
  const address = side === 'instructor' ? contact?.address : null
  // Un reemplazo suele ser un bloque de varias horas: una clase por hora
  const blockHours = Math.max(1, Math.floor((matchEnd(m).getTime() - start.getTime()) / 3600_000))

  const refresh = () => { MATCH_KEYS.forEach(k => qc.invalidateQueries({ queryKey: k })); refetch() }
  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    try { setBusy(key); await fn(); refresh(); if (ok) showToast(ok); return true }
    catch (e) { showToast(errorText(e), 'error'); return false }
    finally { setBusy(null) }
  }
  const goEvaluate = () => side === 'estudio'
    ? navigation.navigate('EvaluateInstructor', { matchId: m.id, instructorId: m.instructor_id, classDate: m.class_date, classType: m.class_type })
    : navigation.navigate('EvaluateStudio', { matchId: m.id, studioId: m.studio_id, studioName: other.name, classDate: m.class_date, classType: m.class_type, agreedRate: m.agreed_rate ?? null })
  const republish = () => run('republish', async () => {
    await publishOpenClass({
      classType: m.class_type, classDate: m.class_date, start: hhmm(m.start_time), end: hhmm(m.end_time),
      days: isRegular ? m.schedule_days : undefined, from: isRegular ? hhmm(m.schedule_from) : undefined, to: isRegular ? hhmm(m.schedule_to) : undefined,
      offered: Number(m.agreed_rate ?? m.offered_rate), note: m.note_studio ?? undefined,
    })
    navigation.navigate('StudioOpenClasses')
  })
  const submitCancel = () => run('cancel', async () => {
    if (cancelOpen === 'end') await endRegular(m.id, reason)
    else await cancelConfirmed(m.id, reason)
    setCancelOpen(null); setReason('')
  }, cancelOpen === 'end' ? 'Clase regular terminada' : 'Clase cancelada. Le avisamos.')

  // ── Estado ──
  const title =
    phase === 'cancelada' ? 'Clase cancelada'
    : phase === 'contratado' ? 'Clase regular activa'
    : phase === 'cerrada' ? (m.hire_status === 'no_sigue' ? 'No siguió' : 'Clase regular terminada')
    : isRegular ? 'Entrevista y clase de prueba' : 'Reemplazo confirmado'

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader title={title} subtitle={other.name} onBack={() => navigation.goBack()} backLabel="Volver" />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>

        {/* Lo que pasa ahora */}
        {phase === 'proxima' || phase === 'en_curso' ? (
          <View style={[s.banner, { backgroundColor: colors.okBg }]}>
            <Feather name="check-circle" size={18} color={colors.okTx} />
            <View style={{ flex: 1 }}>
              <Text style={[s.bannerTitle, { color: colors.okTx }]}>
                {phase === 'en_curso' ? 'En curso ahora' : `Confirmada · ${timeUntil(start)}`}
              </Text>
              <Text style={s.bannerTxt}>Les avisamos a los dos el día anterior y 2 horas antes.</Text>
            </View>
          </View>
        ) : null}

        {phase === 'terminada' && side === 'estudio' && isRegular ? (
          <View style={s.ask}>
            <Text style={s.askTitle}>¿Cómo te fue con {firstName}?</Text>
            <Text style={s.askTxt}>Si la sumás, queda como clase regular activa con los días y el monto acordados.</Text>
            <View style={s.askRow}>
              <Button label="No sigo" variant="secondary" style={{ flex: 1 }} isLoading={busy === 'nohire'}
                onPress={() => run('nohire', () => decideHire(m.id, false), 'Listo. Podés evaluar la clase de prueba.')} />
              <Button label="La sumo" style={{ flex: 1.4 }} isLoading={busy === 'hire'}
                onPress={() => run('hire', () => decideHire(m.id, true), `${firstName} ya es parte de tu equipo`)} />
            </View>
          </View>
        ) : phase === 'terminada' && held == null ? (
          <View style={s.ask}>
            <Text style={s.askTitle}>{isRegular ? '¿Se dio la clase de prueba?' : '¿Se dio la clase?'}</Text>
            <Text style={s.askTxt}>Confirmalo para cerrar la clase. Así la red sabe qué clases se dieron de verdad.</Text>
            <View style={s.askRow}>
              <Button label="No se dio" variant="secondary" style={{ flex: 1 }} isLoading={busy === 'noheld'}
                onPress={() => run('noheld', () => confirmHeld(m.id, false), 'Lo registramos')} />
              <Button label="Sí, se dio" style={{ flex: 1.4 }} isLoading={busy === 'held'}
                onPress={() => run('held', () => confirmHeld(m.id, true)).then(ok => { if (ok && !evaluated) goEvaluate() })} />
            </View>
          </View>
        ) : null}

        {phase === 'contratado' ? (
          <View style={[s.banner, { backgroundColor: colors.okBg }]}>
            <Feather name="repeat" size={18} color={colors.okTx} />
            <View style={{ flex: 1 }}>
              <Text style={[s.bannerTitle, { color: colors.okTx }]}>Activa desde el {shortDate(m.hire_decided_at)}</Text>
              {schedule ? <Text style={s.bannerTxt}>{schedule}</Text> : null}
            </View>
          </View>
        ) : null}

        {phase === 'cerrada' ? (
          <View style={[s.banner, { backgroundColor: colors.sageLighter }]}>
            <Feather name="info" size={18} color={colors.mid} />
            <Text style={[s.bannerTxt, { flex: 1 }]}>
              {m.hire_status === 'no_sigue'
                ? 'Después de la clase de prueba, el estudio decidió no seguir.'
                : `La terminó ${m.ended_by === side ? 'vos' : m.ended_by === 'estudio' ? 'el estudio' : 'el instructor'} el ${shortDate(m.ended_at)}.`}
              {m.cancel_reason ? ` "${m.cancel_reason}"` : ''}
            </Text>
          </View>
        ) : null}

        {phase === 'cancelada' ? (
          <View style={[s.banner, { backgroundColor: colors.redBg }]}>
            <Feather name="x-circle" size={18} color={colors.redTx} />
            <View style={{ flex: 1 }}>
              <Text style={[s.bannerTitle, { color: colors.redTx }]}>
                {m.cancelled_by ? `La canceló ${m.cancelled_by === side ? 'vos' : m.cancelled_by === 'estudio' ? 'el estudio' : 'el instructor'}` : 'Cancelada'}
                {m.late_cancel ? ' con menos de 24 h' : ''}
              </Text>
              {m.cancel_reason ? <Text style={s.bannerTxt}>"{m.cancel_reason}"</Text> : null}
            </View>
          </View>
        ) : null}
        {phase === 'cancelada' && side === 'estudio' && m.cancelled_by === 'instructor' && start > new Date() ? (
          <Button label="Publicar como clase abierta" onPress={republish} isLoading={busy === 'republish'} fullWidth size="lg"
            icon={<Feather name="radio" size={16} color={colors.white} />} style={{ marginBottom: spacing.md }} />
        ) : null}

        {/* Cuándo y dónde */}
        <View style={s.card}>
          <Text style={s.caption}>{isRegular ? 'ENTREVISTA Y CLASE DE PRUEBA' : 'CUÁNDO Y DÓNDE'}</Text>
          <Row icon="calendar" text={longDate(m.class_date)} />
          <Row icon="clock" text={`${hhmm(m.start_time)} a ${hhmm(m.end_time)}`} />
          {side === 'instructor' ? (
            address
              ? <Row icon="map-pin" text={address} link onPress={() => openMaps(address, other.area)} />
              : <Row icon="map-pin" text={other.area ? `${other.area} · pedile la dirección al estudio` : 'Pedile la dirección al estudio'} />
          ) : other.area ? <Row icon="map-pin" text={`Barrio: ${other.area}`} /> : null}
          {isRegular && schedule ? <Row icon="repeat" text={`Después, si la suman: ${schedule}`} /> : null}
          {confirmed && phase !== 'contratado' && phase !== 'terminada' ? (
            <TouchableOpacity style={s.calBtn} onPress={() => addToCalendar(m, eventTitle, address ?? undefined,
              `Confirmada en Trabajo Más Fácil. ${m.agreed_rate ? `${money(m.agreed_rate)} por clase.` : ''}`)}>
              <Feather name="calendar" size={14} color={colors.sage} />
              <Text style={s.calTxt}>Agregar al calendario</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Monto */}
        <View style={s.card}>
          <Text style={s.caption}>ACORDADO</Text>
          <Text style={s.amount}>{money(m.agreed_rate ?? m.offered_rate)}<Text style={s.amountPer}> por clase</Text></Text>
          {!isRegular && blockHours > 1 ? (
            <Text style={s.blockTotal}>Total del bloque: {money(Number(m.agreed_rate ?? m.offered_rate) * blockHours)} ({blockHours} clases)</Text>
          ) : null}
          {isRegular ? (
            <Text style={s.small}>{m.trial_paid ? 'La clase de prueba se paga con ese monto.' : 'La clase de prueba es sin cargo; el monto rige si la suman como clase regular.'}</Text>
          ) : null}
          {m.note_studio ? <Text style={s.note}>Nota del estudio: "{m.note_studio}"</Text> : null}
        </View>

        {/* Contacto: solo con la clase confirmada */}
        {confirmed ? (
          <View style={s.card}>
            <Text style={s.caption}>CONTACTO</Text>
            {contact?.phone ? (
              <View style={s.contactRow}>
                {waNumber(contact.phone) ? (
                  <Button label="WhatsApp" style={{ flex: 1 }} onPress={() => openWhatsApp(contact.phone,
                    side === 'estudio' ? `Hola ${firstName}, te escribo de ${m.studio?.name ?? 'el estudio'} por la clase del ${shortDate(m.class_date + 'T12:00:00')} a las ${hhmm(m.start_time)}.`
                      : `Hola, soy ${m.instructor?.full_name ?? 'el instructor'}, por la clase del ${shortDate(m.class_date + 'T12:00:00')} a las ${hhmm(m.start_time)}.`)}
                    icon={<Feather name="message-circle" size={16} color={colors.white} />} />
                ) : null}
                <Button label="Llamar" variant="secondary" style={{ flex: 1 }} onPress={() => openCall(contact.phone)}
                  icon={<Feather name="phone" size={16} color={colors.sage} />} />
              </View>
            ) : <Text style={s.small}>{side === 'estudio' ? `${firstName} no cargó su teléfono.` : 'El estudio no cargó su teléfono.'}</Text>}
            <Text style={s.small}>Coordinen los detalles del día por WhatsApp. Si algo cambia, cancelá desde la app: así le avisamos y queda registrado.</Text>
          </View>
        ) : null}

        {/* Evaluación */}
        {held === true || m.hire_status ? (
          evaluated
            ? <Text style={s.done}>✓ Ya evaluaste esta clase</Text>
            : <Button label={side === 'estudio' ? `Evaluar a ${firstName}` : 'Evaluar al estudio'} variant="secondary" onPress={goEvaluate} fullWidth
                icon={<Feather name="star" size={15} color={colors.sage} />} style={{ marginBottom: spacing.md }} />
        ) : null}

        {/* Cancelar o terminar */}
        {phase === 'proxima' ? (
          <TouchableOpacity style={s.cancelLink} onPress={() => { setReason(''); setCancelOpen('cancel') }}>
            <Text style={s.cancelTxt}>{isRegular ? 'No puedo ir a la entrevista' : 'Cancelar la clase'}</Text>
          </TouchableOpacity>
        ) : phase === 'contratado' ? (
          <TouchableOpacity style={s.cancelLink} onPress={() => { setReason(''); setCancelOpen('end') }}>
            <Text style={s.cancelTxt}>Terminar la clase regular</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={!!cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{cancelOpen === 'end' ? 'Terminar la clase regular' : isRegular ? 'Cancelar la entrevista' : 'Cancelar la clase'}</Text>
            <Text style={s.sheetSub}>
              {cancelOpen === 'end'
                ? `Le avisamos a ${firstName}. Contale el motivo.`
                : side === 'instructor'
                  ? `Le avisamos al estudio al instante para que busque a otra persona.${late ? ' Faltan menos de 24 h: queda registrado como cancelación tardía.' : ''}`
                  : `Le avisamos a ${firstName}.${late ? ' Faltan menos de 24 h: queda registrado como cancelación tardía.' : ''}`}
            </Text>
            {cancelOpen === 'cancel' ? (
              <View style={s.chips}>
                {REASONS[side].map(r => (
                  <TouchableOpacity key={r} style={[s.chip, reason === r && s.chipOn]} onPress={() => setReason(r)}>
                    <Text style={[s.chipTxt, reason === r && s.chipTxtOn]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <TextInput style={s.input} value={reason} onChangeText={setReason} placeholder="Motivo" placeholderTextColor={colors.light} multiline maxLength={200} />
            <Button label={cancelOpen === 'end' ? 'Terminar' : 'Cancelar la clase'} variant="danger" onPress={submitCancel}
              isLoading={busy === 'cancel'} disabled={reason.trim().length < 3} fullWidth size="lg" />
            <TouchableOpacity onPress={() => setCancelOpen(null)} style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <Text style={s.back}>Volver</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

function Row({ icon, text, link, onPress }: { icon: any; text: string; link?: boolean; onPress?: () => void }) {
  const body = (
    <View style={s.row}>
      <Feather name={icon} size={15} color={colors.sage} />
      <Text style={[s.rowTxt, link && s.link]}>{text}</Text>
    </View>
  )
  return onPress ? <TouchableOpacity onPress={onPress}>{body}</TouchableOpacity> : body
}

const s = StyleSheet.create({
  content:    { padding: spacing.md },
  banner:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, ...radius.leaf, marginBottom: spacing.md },
  bannerTitle:{ fontFamily: 'Nunito-Bold', fontSize: 14 },
  bannerTxt:  { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17, marginTop: 2 },
  ask:        { backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 1.5, borderColor: colors.sage, marginBottom: spacing.md },
  askTitle:   { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.dark },
  askTxt:     { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17, marginTop: 4 },
  askRow:     { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  card:       { backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.md, gap: 8 },
  caption:    { ...typography.caption },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTxt:     { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark, flex: 1 },
  link:       { color: colors.sage, textDecorationLine: 'underline' },
  calBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.sageLighter },
  calTxt:     { fontFamily: 'Nunito-Bold', fontSize: 12, color: colors.sage },
  amount:     { fontFamily: 'Nunito-Bold', fontSize: 22, color: colors.sage },
  blockTotal: { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark },
  amountPer:  { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid },
  small:      { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17 },
  note:       { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, fontStyle: 'italic' },
  contactRow: { flexDirection: 'row', gap: spacing.sm },
  done:       { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.okTx, textAlign: 'center', marginBottom: spacing.md },
  cancelLink: { alignSelf: 'center', paddingVertical: spacing.sm },
  cancelTxt:  { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.redTx },
  overlay:    { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  sheet:      { backgroundColor: colors.cream, borderRadius: 20, padding: spacing.lg },
  sheetTitle: { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark, marginBottom: 6 },
  sheetSub:   { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19, marginBottom: spacing.md },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  chip:       { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border },
  chipOn:     { backgroundColor: colors.sage, borderColor: colors.sage },
  chipTxt:    { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid },
  chipTxtOn:  { color: colors.white },
  input:      { backgroundColor: colors.white, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border, padding: spacing.sm + 2, minHeight: 64, textAlignVertical: 'top', fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark, marginBottom: spacing.md },
  back:       { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.mid },
})
