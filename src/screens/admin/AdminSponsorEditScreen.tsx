// Cargar o editar un aviso de patrocinio (beneficio o formación).
// - Plataforma: lo publica en las redes que elige, con el monto mensual de cada una y el porcentaje de la entidad.
// - Entidad: carga los que consiguió ella (quedan publicados en su red) y ve los que le propone la plataforma
//   para aprobarlos o rechazarlos.
import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TextInput, Switch, Platform, Alert, Pressable } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useAuthStore } from '../../store'
import { useCamaras } from '../../lib/platform'
import { formatARS } from '../../lib/payments'
import { errorText } from '../../lib/errors'
import { useIsEntity } from '../../lib/admin'
import { usePhotoCropper } from '../../components/PhotoCropper'
import {
  AUDIENCE_LABEL, Audience, MODALITY_LABEL, NetworkDraft, OfferDraft, STATUS_LABEL, SponsorKind,
  statsFor, uploadSponsorLogo, useDecideOffer, useDeleteOffer, useSaveOffer, useSponsorOffers, useSponsorStats,
} from '../../lib/sponsors'
import { ActionButton, AdminPage, Card, Columns, Field, Kpi, KpiGrid, Notice, Pill, Segmented } from '../../components/admin/AdminUI'
import { LoadingScreen, colors } from '../../components/ui'
import { SponsorLogo } from './AdminSponsorsScreen'

const say = (msg: string) => Platform.OS === 'web' ? window.alert(msg) : Alert.alert('', msg)
const ask = (msg: string) => Platform.OS === 'web' ? window.confirm(msg) : true
const toDmy = (iso?: string | null) => iso ? iso.split('-').reverse().join('/') : ''
const toIso = (dmy: string): string | null | undefined => {
  if (!dmy.trim()) return null
  const m = dmy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return undefined
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

const EMPTY: OfferDraft = {
  kind: 'beneficio', sponsor_name: '', logo_url: null, title: '', summary: '', details: '', perk: '', promo_code: '', url: '',
  contact_whatsapp: '', audience: 'ambos', modality: null, course_start: null, course_hours: null, starts_on: new Date().toISOString().slice(0, 10),
  ends_on: null, is_active: true,
}

function Input({ label, value, onChange, placeholder, multiline, hint, keyboard }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; hint?: string; keyboard?: 'numeric' | 'url' | 'phone-pad'
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.lbl}>{label}</Text>
      <TextInput style={[s.input, multiline && { minHeight: 84, textAlignVertical: 'top' }]} value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={colors.light} multiline={multiline} keyboardType={keyboard === 'numeric' ? 'number-pad' : keyboard === 'url' ? 'url' : keyboard ?? 'default'}
        autoCapitalize={keyboard === 'url' ? 'none' : 'sentences'} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  )
}

export default function AdminSponsorEditScreen({ navigation, route }: any) {
  const offerId: string | undefined = route?.params?.offerId
  const isEntity = useIsEntity()
  const user = useAuthStore(x => x.user)
  const camaraId = user?.camara_id as string | undefined
  const { data: offers = [], isLoading } = useSponsorOffers()
  const { data: stats = [] } = useSponsorStats(30)
  const { data: camaras = [] } = useCamaras()
  const save = useSaveOffer(), decide = useDecideOffer(), del = useDeleteOffer()
  const { pickPhoto, cropModal } = usePhotoCropper('Ajustá el logo')
  const existing = offers.find(o => o.id === offerId)

  const [f, setF] = useState<OfferDraft>(EMPTY)
  const [starts, setStarts] = useState(toDmy(EMPTY.starts_on))
  const [ends, setEnds] = useState('')
  const [courseStart, setCourseStart] = useState('')
  const [nets, setNets] = useState<Record<string, NetworkDraft>>({})
  const [uploading, setUploading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Lo que la entidad puede editar: solo lo que cargó ella. Lo que propone la plataforma, lo aprueba o rechaza.
  const readOnly = !!existing && isEntity && !(existing.origin === 'entidad' && existing.origin_camara_id === camaraId)
  const myNet = existing?.networks?.find(n => n.camara_id === camaraId)
  const myCamara = camaras.find(c => c.id === camaraId) as any

  useEffect(() => {
    if (loaded || (offerId && !existing)) return
    if (existing) {
      setF({ ...EMPTY, ...existing } as OfferDraft)
      setStarts(toDmy(existing.starts_on)); setEnds(toDmy(existing.ends_on)); setCourseStart(toDmy(existing.course_start))
      setNets(Object.fromEntries((existing.networks ?? []).map(n => [n.camara_id, { camara_id: n.camara_id, monthly_fee_ars: Number(n.monthly_fee_ars), entity_share_pct: n.entity_share_pct }])))
    } else if (isEntity && camaraId) {
      setNets({ [camaraId]: { camara_id: camaraId, monthly_fee_ars: 0 } })
    }
    setLoaded(true)
  }, [existing, offerId, isEntity, camaraId, loaded])

  const set = <K extends keyof OfferDraft>(k: K, v: OfferDraft[K]) => setF(x => ({ ...x, [k]: v }))
  const total = useMemo(() => Object.values(nets).reduce((a, n) => a + Number(n.monthly_fee_ars || 0), 0), [nets])
  const toggleNet = (id: string, def: number) => setNets(x => {
    const y = { ...x }; if (y[id]) delete y[id]; else y[id] = { camara_id: id, monthly_fee_ars: 0, entity_share_pct: def }; return y
  })

  const pickLogo = async () => {
    let uri: string | null
    try { uri = await pickPhoto() } catch (e) { say(errorText(e)); return }
    if (!uri || !user?.id) return
    try { setUploading(true); set('logo_url', await uploadSponsorLogo(uri, user.id)) }
    catch (e) { say(errorText(e)) } finally { setUploading(false) }
  }

  const submit = () => {
    const s1 = toIso(starts), e1 = toIso(ends), c1 = toIso(courseStart)
    if (!f.sponsor_name.trim()) return say('Escribí el nombre del patrocinador.')
    if (!f.title.trim()) return say('Escribí el título del aviso.')
    if (s1 === undefined || e1 === undefined || c1 === undefined) return say('Revisá las fechas: el formato es dd/mm/aaaa.')
    if (!Object.keys(nets).length) return say('Elegí al menos una red donde publicarlo.')
    if (!f.url?.trim() && !f.promo_code?.trim() && !f.contact_whatsapp?.trim()) return say('Agregá al menos una forma de aprovecharlo: link, código o WhatsApp.')
    const offer: OfferDraft = {
      ...f, sponsor_name: f.sponsor_name.trim(), title: f.title.trim(),
      starts_on: s1 ?? new Date().toISOString().slice(0, 10), ends_on: e1, course_start: f.kind === 'formacion' ? c1 : null,
      modality: f.kind === 'formacion' ? f.modality : null, course_hours: f.kind === 'formacion' ? f.course_hours : null,
      ...(offerId ? { id: offerId } : {}),
    }
    save.mutate({ offer, networks: Object.values(nets), isPlatform: !isEntity }, {
      onSuccess: () => navigation.navigate('AdminPatrocinios'),
      onError: (e: any) => say(errorText(e)),
    })
  }

  if (isLoading || (offerId && !loaded && existing)) return <LoadingScreen />
  if (offerId && !existing) return <AdminPage title="Aviso" onBack={() => navigation.goBack()} backLabel="Patrocinios"><Notice icon="alert-circle" tone="warn">No encontramos este aviso.</Notice></AdminPage>

  const x = existing ? statsFor(stats, existing.id, isEntity ? camaraId : undefined) : null

  // ── Entidad viendo un aviso que propone la plataforma ──
  if (readOnly && existing) {
    const st = myNet ? STATUS_LABEL[myNet.status] : null
    return (
      <AdminPage title={existing.title} subtitle={`${existing.sponsor_name} · ${existing.kind === 'formacion' ? 'Formación' : 'Beneficio'}`}
        onBack={() => navigation.goBack()} backLabel="Patrocinios"
        actions={<>
          {st ? <Pill label={st.label} tone={st.tone} /> : null}
          {myNet && myNet.status !== 'rechazado' ? <ActionButton label={myNet.status === 'aprobado' ? 'Dejar de publicar' : 'Rechazar'} variant="danger"
            onPress={() => decide.mutate({ offerId: existing.id, camaraId: camaraId!, status: 'rechazado' }, { onError: (e: any) => say(errorText(e)) })} /> : null}
          {myNet && myNet.status !== 'aprobado' ? <ActionButton label="Aprobar" icon="check" loading={decide.isPending}
            onPress={() => decide.mutate({ offerId: existing.id, camaraId: camaraId!, status: 'aprobado' }, { onError: (e: any) => say(errorText(e)) })} /> : null}
        </>}>
        <Notice icon="info">Lo propone la plataforma. Solo se publica en tu red si lo aprobás, y podés dejar de publicarlo cuando quieras.</Notice>
        <KpiGrid>
          <Kpi label="Te corresponde por mes" value={formatARS(Number(myNet?.monthly_fee_ars ?? 0) * Number(myNet?.entity_share_pct ?? 0) / 100)} icon="dollar-sign"
            hint={`${Number(myNet?.entity_share_pct ?? 0)}% de ${formatARS(Number(myNet?.monthly_fee_ars ?? 0))}`} />
          <Kpi label="Lo vieron" value={x?.vistas ?? 0} icon="eye" hint="Personas de tu red · 30 días" />
          <Kpi label="Lo usaron" value={x?.clicks ?? 0} icon="mouse-pointer" hint="Link, código o WhatsApp · 30 días" />
        </KpiGrid>
        <Card title="Aviso">
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 }}>
            <SponsorLogo o={existing} size={56} />
            <Text style={s.previewTitle}>{existing.title}</Text>
          </View>
          <Field label="Beneficio" value={existing.perk} />
          <Field label="Para" value={AUDIENCE_LABEL[existing.audience]} />
          <Field label="Detalle" value={existing.details || existing.summary} />
          {existing.kind === 'formacion' ? <Field label="Formación" value={[existing.modality ? MODALITY_LABEL[existing.modality] : null, existing.course_hours ? `${existing.course_hours} h` : null, existing.course_start ? `empieza el ${toDmy(existing.course_start)}` : null].filter(Boolean).join(' · ') || null} /> : null}
          <Field label="Código" value={existing.promo_code} />
          <Field label="Link" value={existing.url} />
          <Field label="WhatsApp" value={existing.contact_whatsapp} />
          <Field label="Vigencia" value={`${toDmy(existing.starts_on)} – ${existing.ends_on ? toDmy(existing.ends_on) : 'sin fecha de fin'}`} />
        </Card>
      </AdminPage>
    )
  }

  return (
    <AdminPage title={existing ? 'Editar aviso' : 'Nuevo aviso'} subtitle={existing ? existing.sponsor_name : isEntity ? 'Un beneficio o una formación que consiguió tu entidad' : 'Un beneficio o una formación para publicar en las redes'}
      onBack={() => navigation.goBack()} backLabel="Patrocinios"
      actions={<>
        {existing ? <ActionButton label="Eliminar" variant="danger" icon="trash-2" onPress={() => { if (ask('¿Eliminar este aviso? Deja de verse en todas las redes.')) del.mutate(existing.id, { onSuccess: () => navigation.navigate('AdminPatrocinios'), onError: (e: any) => say(errorText(e)) }) }} /> : null}
        <ActionButton label="Guardar" icon="check" onPress={submit} loading={save.isPending} />
      </>}>
      {x ? (
        <KpiGrid>
          <Kpi label="Lo vieron" value={x.vistas} icon="eye" hint="Personas distintas · 30 días" />
          <Kpi label="Lo usaron" value={x.clicks} icon="mouse-pointer" hint="Link, código o WhatsApp · 30 días" />
          <Kpi label="Paga por mes" value={formatARS(total)} icon="dollar-sign" hint={`${Object.keys(nets).length} red${Object.keys(nets).length === 1 ? '' : 'es'}`} />
        </KpiGrid>
      ) : null}

      <Columns min={440}>
        <View style={{ gap: 20 }}>
          <Card title="Aviso">
            <View style={{ marginBottom: 14 }}>
              <Segmented value={f.kind} onChange={(k: SponsorKind) => set('kind', k)} items={[{ key: 'beneficio', label: 'Beneficio' }, { key: 'formacion', label: 'Formación' }]} />
            </View>
            <Input label="Patrocinador" value={f.sponsor_name} onChange={v => set('sponsor_name', v)} placeholder="Ej: Reformers del Sur" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <SponsorLogo o={{ logo_url: f.logo_url, sponsor_name: f.sponsor_name || '?' }} size={52} />
              <ActionButton label={uploading ? 'Subiendo…' : f.logo_url ? 'Cambiar logo' : 'Subir logo'} icon="upload" variant="secondary" onPress={pickLogo} disabled={uploading} />
              {f.logo_url ? <Text style={s.link} onPress={() => set('logo_url', null)}>Quitar</Text> : null}
            </View>
            <Input label="Título" value={f.title} onChange={v => set('title', v)} placeholder={f.kind === 'formacion' ? 'Ej: Formación en Pilates para adultos mayores' : 'Ej: Descuento en reformers y accesorios'} />
            <Input label="Beneficio destacado" value={f.perk ?? ''} onChange={v => set('perk', v)} placeholder="Ej: 15% de descuento · Primera clase sin cargo" hint="Se muestra resaltado. Corto y concreto." />
            <Input label="Resumen" value={f.summary ?? ''} onChange={v => set('summary', v)} placeholder="Una línea que se ve en la lista" />
            <Input label="Detalle y condiciones" value={f.details ?? ''} onChange={v => set('details', v)} multiline placeholder="Qué incluye, cómo se aprovecha y cualquier condición" />
          </Card>

          {f.kind === 'formacion' ? (
            <Card title="Formación">
              <Text style={s.lbl}>Modalidad</Text>
              <View style={{ marginBottom: 14 }}>
                <Segmented value={(f.modality ?? 'presencial') as any} onChange={(m: any) => set('modality', m)}
                  items={[{ key: 'presencial', label: 'Presencial' }, { key: 'online', label: 'Online' }, { key: 'mixta', label: 'Mixta' }]} />
              </View>
              <Input label="Horas" value={f.course_hours ? String(f.course_hours) : ''} onChange={v => set('course_hours', parseInt(v.replace(/\D/g, ''), 10) || null)} keyboard="numeric" placeholder="Ej: 120" />
              <Input label="Empieza el" value={courseStart} onChange={setCourseStart} placeholder="dd/mm/aaaa" />
            </Card>
          ) : null}
        </View>

        <View style={{ gap: 20 }}>
          <Card title="Cómo se aprovecha" subtitle="Al menos uno">
            <Input label="Código de descuento" value={f.promo_code ?? ''} onChange={v => set('promo_code', v.toUpperCase())} placeholder="Ej: RED15" />
            <Input label="Link" value={f.url ?? ''} onChange={v => set('url', v)} keyboard="url" placeholder="Ej: tienda.com/pilates" />
            <Input label="WhatsApp" value={f.contact_whatsapp ?? ''} onChange={v => set('contact_whatsapp', v)} keyboard="phone-pad" placeholder="Ej: 11 5555 6666" />
          </Card>

          <Card title="Publicación">
            <Text style={s.lbl}>Para</Text>
            <View style={{ marginBottom: 14 }}>
              <Segmented value={f.audience} onChange={(a: Audience) => set('audience', a)}
                items={[{ key: 'ambos', label: 'Todos' }, { key: 'estudio', label: 'Estudios' }, { key: 'instructor', label: 'Instructores' }]} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Input label="Desde" value={starts} onChange={setStarts} placeholder="dd/mm/aaaa" /></View>
              <View style={{ flex: 1 }}><Input label="Hasta (opcional)" value={ends} onChange={setEnds} placeholder="dd/mm/aaaa" /></View>
            </View>
            <View style={s.switchRow}>
              <Text style={s.switchLbl}>Activo</Text>
              <Switch value={f.is_active !== false} onValueChange={v => set('is_active', v)} trackColor={{ false: colors.border, true: colors.sageMid }} thumbColor={f.is_active !== false ? colors.sage : colors.white} />
            </View>
          </Card>

          <Card title={isEntity ? 'Monto' : 'Redes y monto mensual'} subtitle={isEntity ? 'Lo que paga el patrocinador por mes' : 'Cada entidad lo aprueba antes de que se vea en su red'}>
            {isEntity ? (
              <>
                <Input label="Monto mensual ($)" value={nets[camaraId!]?.monthly_fee_ars ? String(nets[camaraId!].monthly_fee_ars) : ''} keyboard="numeric" placeholder="0"
                  onChange={v => setNets({ [camaraId!]: { camara_id: camaraId!, monthly_fee_ars: parseInt(v.replace(/\D/g, ''), 10) || 0 } })} />
                <Text style={s.hint}>Lo consiguió tu entidad: te corresponde el {Number(existing ? (myNet?.entity_share_pct ?? myCamara?.sponsor_share_own_pct ?? 70) : (myCamara?.sponsor_share_own_pct ?? 70))}% y se publica en tu red sin aprobación.</Text>
              </>
            ) : camaras.filter(c => c.is_active).map(c => {
              const n = nets[c.id]; const net = existing?.networks?.find(y => y.camara_id === c.id)
              const def = Number((c as any).sponsor_share_platform_pct ?? 20)
              return (
                <View key={c.id} style={s.netRow}>
                  <Pressable onPress={() => toggleNet(c.id, def)} style={s.check} accessibilityRole="checkbox" accessibilityState={{ checked: !!n }}>
                    <Feather name={n ? 'check-square' : 'square'} size={18} color={n ? colors.sage : colors.light} />
                    <Text style={s.netName} numberOfLines={1}>{c.name}</Text>
                  </Pressable>
                  {net ? <Pill label={STATUS_LABEL[net.status].label} tone={STATUS_LABEL[net.status].tone} /> : null}
                  {n ? (
                    <>
                      <TextInput style={[s.input, s.small]} value={n.monthly_fee_ars ? String(n.monthly_fee_ars) : ''} placeholder="$ / mes" placeholderTextColor={colors.light} keyboardType="number-pad"
                        onChangeText={v => setNets(x => ({ ...x, [c.id]: { ...n, monthly_fee_ars: parseInt(v.replace(/\D/g, ''), 10) || 0 } }))} />
                      <TextInput style={[s.input, s.pct]} value={n.entity_share_pct != null ? String(n.entity_share_pct) : ''} placeholder="%" placeholderTextColor={colors.light} keyboardType="number-pad"
                        onChangeText={v => setNets(x => ({ ...x, [c.id]: { ...n, entity_share_pct: Math.min(100, parseInt(v.replace(/\D/g, ''), 10) || 0) } }))} />
                    </>
                  ) : null}
                </View>
              )
            })}
            {!isEntity ? <Text style={[s.hint, { marginTop: 8 }]}>Monto mensual por red y porcentaje para la entidad. Si la entidad consiguió al patrocinador, cargalo desde su portal.</Text> : null}
            {!isEntity && total ? <Text style={s.total}>Total: {formatARS(total)} por mes</Text> : null}
          </Card>
        </View>
      </Columns>
      {cropModal}
    </AdminPage>
  )
}

const s = StyleSheet.create({
  lbl:          { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.mid, marginBottom: 6 },
  input:        { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.dark, backgroundColor: colors.white, outlineStyle: 'none' } as any,
  hint:         { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.light, marginTop: 4, lineHeight: 17 },
  link:         { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  switchRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLbl:    { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  netRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  check:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  netName:      { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark, flexShrink: 1 },
  small:        { width: 110, paddingVertical: 7 },
  pct:          { width: 56, paddingVertical: 7, textAlign: 'center' } as any,
  total:        { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.dark, marginTop: 10, textAlign: 'right' },
  previewTitle: { flex: 1, fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.dark },
})
