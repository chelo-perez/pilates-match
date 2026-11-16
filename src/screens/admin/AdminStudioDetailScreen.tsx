// Ficha de un estudio en el panel.
// - Entidad de la red: cambia el plan (socio o no), bloquea propuestas y deja notas internas.
// - Plataforma: solo lectura.
import React, { useState } from 'react'
import { View, Text, StyleSheet, Platform, Alert, Modal, Pressable, TextInput } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { errorText, UserError } from '../../lib/errors'
import { useCamara, useCamaras } from '../../lib/platform'
import { useAuthStore } from '../../store'
import { PLANS } from '../../constants/plans'
import { applyPlan, planDurationLabel, PlanKey, STUDIO_KEYS } from '../camara/planUtils'
import { formatARS } from '../../lib/payments'
import { reliabilityWarning, useReliability, PLACEMENT_STATUS } from '../../lib/matchFlow'
import { ADMIN_KEYS, matchState, one, PLAN_LABEL, shortDate, useAdminMatches, useIsEntity, usedThisMonth } from '../../lib/admin'
import { SPECIALTY_LABELS } from '../../constants/labels'
import { ActionButton, AdminPage, Card, CellTitle, Columns, DataTable, Field, Kpi, KpiGrid, Notice, Pill } from '../../components/admin/AdminUI'
import { Avatar, ErrorState, LoadingScreen, colors, spacing } from '../../components/ui'

const say = (msg: string) => Platform.OS === 'web' ? window.alert(msg) : Alert.alert('', msg)
const ask = (title: string, msg: string, onOk: () => void) => Platform.OS === 'web'
  ? (window.confirm(`${title}\n\n${msg}`) && onOk())
  : Alert.alert(title, msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', onPress: onOk }])

export default function AdminStudioDetailScreen({ navigation, route }: any) {
  const id: string | undefined = route?.params?.studioId
  const { data: st, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-studio', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('studios').select('*, user:users(email), membership:memberships(*)').eq('id', id!).maybeSingle()
      if (error) throw error
      return data as any
    },
    enabled: !!id,
  })
  const { data: pay } = useQuery({
    queryKey: ['admin-studio-pay', id],
    queryFn: async () => {
      const { data } = await supabase.from('studio_evaluations').select('paid_as_agreed').eq('studio_id', id!).not('paid_as_agreed', 'is', null)
      const rows = data ?? []
      return { total: rows.length, ok: rows.filter((r: any) => r.paid_as_agreed).length }
    },
    enabled: !!id,
  })
  const { data: camaras = [] } = useCamaras()
  const { data: matches = [] } = useAdminMatches()
  const { data: rel } = useReliability({ studioId: id })
  const isEntity = useIsEntity()
  const qc = useQueryClient()
  const user = useAuthStore(x => x.user)
  const { data: myCamara } = useCamara(isEntity ? (user?.camara_id as string | undefined) : undefined)
  const [planOpen, setPlanOpen] = useState(false)
  const [plan, setPlan] = useState<PlanKey>('socio')
  const [planNote, setPlanNote] = useState('')
  const [note, setNote] = useState('')
  const { data: notes = [] } = useQuery({
    queryKey: ['studio-detail', id, 'notes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('camara_studio_notes').select('id, note, created_at').eq('studio_id', id!).order('created_at', { ascending: false }).limit(10)
      if (error) throw error
      return data ?? []
    },
    enabled: !!id && isEntity,
  })
  const refresh = () => [...STUDIO_KEYS, ...ADMIN_KEYS, ['admin-studio']].forEach(queryKey => qc.invalidateQueries({ queryKey }))
  const planMut = useMutation({
    mutationFn: () => applyPlan(id!, plan, planNote),
    onSuccess: r => { refresh(); setPlanOpen(false); setPlanNote(''); if (r?.noteSaved === false) say('Plan actualizado, pero no pudimos guardar el motivo.') },
    onError: (e: any) => say(errorText(e)),
  })
  const blockMut = useMutation({
    mutationFn: async (block: boolean) => {
      const { data, error } = await supabase.from('memberships').update({ status: block ? 'cancelada' : 'activa' }).eq('studio_id', id!).select('id')
      if (error) throw error
      if (!data?.length) throw new UserError('El estudio no tiene un plan para bloquear. Asignale uno primero.')
    },
    onSuccess: refresh,
    onError: (e: any) => say(errorText(e)),
  })
  const noteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('camara_studio_notes').insert({ studio_id: id, note: note.trim() })
      if (error) throw error
    },
    onSuccess: () => { setNote(''); qc.invalidateQueries({ queryKey: ['studio-detail', id, 'notes'] }) },
    onError: (e: any) => say(errorText(e)),
  })

  if (isLoading) return <LoadingScreen />
  if (isError || !st) return <ErrorState message="No encontramos el estudio." onRetry={refetch} />
  const net = camaras.find(c => c.id === st.camara_id)
  const m = one<any>(st.membership)
  const mine = matches.filter(x => one<any>(x.studio)?.id === st.id)
  const warn = reliabilityWarning(rel)
  const blocked = m?.status === 'cancelada'
  const perMember = (myCamara as any)?.billing_model === 'per_member'
  const plans = PLANS.filter((p: any) => !(perMember && p.key === 'starter'))
  const openPlan = (k?: PlanKey) => { setPlan(k ?? (st.is_member ? 'freemium' : 'socio')); setPlanNote(''); setPlanOpen(true) }
  const entity = net ? `${(net as any).entity_article === 'el' ? 'el' : 'la'} ${(net as any).entity_type ?? 'Cámara'}` : 'la entidad de su red'

  return (
    <AdminPage title={st.name} subtitle={`${net?.name ?? 'Sin red'} · ${st.neighborhood ?? 'Sin barrio'}`}
      onBack={() => navigation.goBack()} backLabel="Estudios"
      actions={<>
        <Pill label={st.is_member ? 'Socio' : 'No socio'} tone={st.is_member ? 'ok' : 'neutral'} />
        {blocked ? <Pill label="Bloqueado" tone="red" /> : null}
        {!st.user_id ? <Pill label="Sin cuenta" tone="warn" /> : null}
        {isEntity ? <ActionButton label={st.is_member ? 'Quitar de socios' : 'Hacer socio'} icon={st.is_member ? 'user-minus' : 'user-plus'} variant="secondary"
          onPress={() => openPlan(st.is_member ? 'freemium' : 'socio')} /> : null}
        {isEntity ? <ActionButton label="Cambiar plan" icon="award" onPress={() => openPlan(m?.plan_type)} /> : null}
      </>}>
      {!isEntity ? <Notice icon="info">El plan y la condición de socio los maneja {entity}. Desde la plataforma ves el detalle.</Notice> : null}
      {isEntity && blocked ? <Notice icon="slash" tone="warn">Este estudio está bloqueado: no puede enviar propuestas nuevas. Puede seguir entrando a la app.</Notice> : null}

      <KpiGrid>
        <Kpi label="Plan" value={m ? PLAN_LABEL[m.plan_type] ?? m.plan_type : 'Sin plan'} icon="award" hint={m ? (m.status === 'activa' ? `Vence ${shortDate(m.end_date)}` : `Plan ${m.status}`) : undefined} tone={m?.status === 'activa' ? 'brand' : 'warn'} />
        <Kpi label="Avisos del mes" value={m ? `${usedThisMonth(m)}${m.matches_limit != null ? ` / ${m.matches_limit}` : ''}` : '—'} icon="send" hint={m?.matches_limit == null ? 'Sin límite' : 'Cubiertos este mes'} />
        <Kpi label="Pagó lo acordado" value={pay?.total ? `${pay.ok} / ${pay.total}` : '—'} icon="check-circle" tone={pay && pay.total && pay.ok < pay.total ? 'red' : 'ok'} hint="Según los instructores" />
        <Kpi label="Confiabilidad" value={warn ? 'Con alertas' : 'Sin alertas'} icon="shield" tone={warn ? 'red' : 'ok'} hint={warn ?? 'Sin cancelaciones tardías'} />
      </KpiGrid>

      <Columns min={420}>
        <Card title="Perfil">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Avatar name={st.name} source={st.logo_url} size={56} />
            <Text style={s.bio}>{st.bio || st.description || 'Sin descripción.'}</Text>
          </View>
          <Field label="Email" value={one<any>(st.user)?.email ?? st.owner_email} />
          <Field label="Responsable" value={st.owner_name} />
          <Field label="Teléfono" value={st.phone} />
          <Field label="Dirección" value={st.address} />
          <Field label="Instagram" value={st.instagram} />
          <Field label="CUIT" value={st.cuit} />
          <Field label="Se registró" value={shortDate(st.created_at)} />
          <Field label="Socio desde" value={st.member_since ? shortDate(st.member_since) : st.is_member ? '—' : 'No es socio'} />
        </Card>
        <Card title="Clases que necesita">
          <Field label="Equipamiento">
            <View style={s.chips}>{(st.equipment ?? []).length ? (st.equipment as string[]).map(e => <Pill key={e} label={SPECIALTY_LABELS[e] ?? e} tone="brand" />) : <Text style={s.muted}>—</Text>}</View>
          </Field>
          <Field label="Presupuesto regular" value={st.budget_regular ? `${formatARS(st.budget_regular)} / clase` : 'Sin cargar'} />
          <Field label="Presupuesto reemplazo" value={st.budget_replacement ? `${formatARS(st.budget_replacement)} / clase` : 'Sin cargar'} />
          <Field label="Créditos de incorporación" value={String(st.placement_credits ?? 0)} />
        </Card>
      </Columns>

      {isEntity ? (
        <Columns min={420}>
          <Card title="Notas internas" subtitle="Solo las ve la entidad">
            <TextInput style={s.input} value={note} onChangeText={setNote} multiline placeholder="Ej: pagó la cuota en efectivo el 3/11" placeholderTextColor={colors.light} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
              <ActionButton label="Guardar nota" variant="secondary" disabled={!note.trim()} loading={noteMut.isPending} onPress={() => noteMut.mutate()} />
            </View>
            {notes.length ? notes.map((n: any) => <Field key={n.id} label={shortDate(n.created_at)} value={n.note} />) : <Text style={s.muted}>Sin notas todavía.</Text>}
          </Card>
          <Card title="Propuestas nuevas" subtitle={blocked ? 'Bloqueadas: no puede enviar propuestas' : 'Habilitadas'}>
            <Text style={[s.bio, { marginBottom: 12 }]}>Si el estudio deja de cumplir las condiciones de la red, podés bloquearle las propuestas nuevas sin borrar su cuenta ni su historial.</Text>
            <View style={{ alignItems: 'flex-start' }}><ActionButton label={blocked ? 'Desbloquear estudio' : 'Bloquear propuestas'} icon={blocked ? 'unlock' : 'slash'} variant={blocked ? 'primary' : 'danger'}
              loading={blockMut.isPending}
              onPress={() => ask(blocked ? 'Desbloquear estudio' : 'Bloquear estudio',
                blocked ? `${st.name} va a poder volver a enviar propuestas.` : `${st.name} no va a poder enviar propuestas nuevas hasta que lo desbloquees.`,
                () => blockMut.mutate(!blocked))} /></View>
          </Card>
        </Columns>
      ) : null}

      <Card title="Propuestas" pad={false}>
        <View style={{ padding: 12, paddingTop: 0 }}>
          <DataTable rows={mine} keyOf={x => x.id} empty="Todavía no envió propuestas."
            onRowPress={x => one<any>(x.instructor)?.id && navigation.navigate('AdminInstructorDetail', { instructorId: one<any>(x.instructor).id })}
            columns={[
              { key: 'c', label: 'Clase', width: 160, render: x => <CellTitle title={shortDate(x.class_date)} sub={x.class_type === 'regular' ? 'Entrevista regular' : 'Reemplazo'} /> },
              { key: 'i', label: 'Instructor', flex: 2, render: x => <CellTitle title={one<any>(x.instructor)?.full_name ?? '—'} avatar={<Avatar name={one<any>(x.instructor)?.full_name ?? '?'} source={one<any>(x.instructor)?.avatar_url} size={28} />} /> },
              { key: 'm', label: 'Monto', width: 130, align: 'right', render: x => `${formatARS(Number(x.agreed_rate ?? x.offered_rate ?? 0))} / clase` },
              { key: 'e', label: 'Estado', flex: 1.5, align: 'right', render: x => {
                const y = matchState(x)
                return (
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Pill label={y.label} tone={y.tone} />
                    {x.placement_status && x.placement_status !== 'sin_cargo' ? <Pill label={`Cargo: ${PLACEMENT_STATUS[x.placement_status] ?? x.placement_status}`} tone="neutral" /> : null}
                  </View>
                )
              } },
            ]} />
        </View>
      </Card>

      <Modal visible={planOpen} transparent animationType="fade" onRequestClose={() => setPlanOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setPlanOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>Plan de {st.name}</Text>
            <Text style={s.sheetSub}>El plan Socio lo marca como socio de la entidad. Al cambiar, el contador de avisos del mes vuelve a cero.</Text>
            <View style={{ gap: 6 }}>
              {plans.map((p: any) => (
                <Pressable key={p.key} onPress={() => setPlan(p.key)} style={[s.reason, plan === p.key && s.reasonOn]}>
                  <Text style={[s.reasonTxt, plan === p.key && { color: colors.white }]}>
                    {p.label} · {p.limit == null ? 'sin límite de avisos' : `${p.limit} aviso${p.limit === 1 ? '' : 's'} por mes`} · {planDurationLabel(p.key)}{m?.plan_type === p.key ? '  (actual)' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={[s.input, { marginTop: spacing.sm }]} value={planNote} onChangeText={setPlanNote} multiline placeholder="Motivo del cambio (opcional). Ej: pagó la cuota anual" placeholderTextColor={colors.light} />
            <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
              <ActionButton label="Cancelar" variant="secondary" onPress={() => setPlanOpen(false)} />
              <ActionButton label="Confirmar" onPress={() => planMut.mutate()} loading={planMut.isPending}
                disabled={m?.plan_type === plan && m?.status === 'activa'} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminPage>
  )
}

const s = StyleSheet.create({
  bio:   { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  muted: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.light },
  input: { minHeight: 60, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark, textAlignVertical: 'top', marginBottom: 10, outlineStyle: 'none' } as any,
  overlay:   { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet:     { width: '100%', maxWidth: 520, backgroundColor: colors.white, borderRadius: 16, padding: spacing.lg },
  sheetTitle:{ fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark },
  sheetSub:  { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, marginTop: 4, marginBottom: spacing.md, lineHeight: 19 },
  reason:    { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  reasonOn:  { backgroundColor: colors.sage, borderColor: colors.sage },
  reasonTxt: { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark },
})
