// Dueño de la plataforma: alta y edición de una red (entidad que la coordina, sector, % de reparto, precios y equipo).
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Switch, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { errorText, UserError } from '../../lib/errors'
import { useBillingPreview, useCamara } from '../../lib/platform'
import { formatARS } from '../../lib/payments'
import { completePalette } from '../../lib/brand'
import { Image } from 'react-native'

// Colores base que edita la plataforma; el resto de la paleta se deriva de ellos
const BASE_COLORS: { key: string; label: string; hint: string }[] = [
  { key: 'sage',   label: 'PRINCIPAL',  hint: 'Botones, íconos y textos destacados' },
  { key: 'forest', label: 'ENCABEZADO', hint: 'Fondo de los encabezados' },
  { key: 'gold',   label: 'ACENTO',     hint: 'Números y detalles' },
  { key: 'cream',  label: 'FONDO',      hint: 'Fondo de las pantallas' },
  { key: 'dark',   label: 'TEXTO',      hint: 'Texto principal' },
]
const DERIVED: Record<string, string[]> = {
  sage: ['sageMid', 'sageLight', 'sageLighter', 'mint'], forest: ['forestDark', 'forestDeep', 'toastOkBg'], gold: ['goldLight', 'goldBright'],
}
const HEXRE = /^#[0-9a-fA-F]{6}$/
import { useQuery } from '@tanstack/react-query'
import { ENTITY_TYPES } from '../../lib/entity'
import { usePlanPrices } from '../../lib/payments'
import HeroHeader from '../../components/HeroHeader'
import CamaraTeam from '../../components/CamaraTeam'
import { Button, Input, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'

const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const digits = (s: string) => s.replace(/\D/g, '')

export default function PlatformCamaraEditScreen({ navigation, route }: any) {
  const camaraId: string | undefined = route.params?.camaraId
  const isNew = !camaraId
  const qc = useQueryClient()
  const { data: camara, isLoading } = useCamara(camaraId)
  const { data: prices = [] } = usePlanPrices(camaraId, 'info')

  const [f, setF] = useState({
    name: '', entity_type: 'Cámara', entity_article: 'la' as 'la' | 'el', sector: '', business_label: '', instructor_label: '', pct: '25', cuit: '', email: '', active: true,
    starter: '', premium: '',
    billing_model: 'subscriptions' as 'subscriptions' | 'per_member', min_members: '0', price_index: 'fixed' as 'fixed' | 'avg_hour',
    placement_enabled: true, placement_max: '2',
  })
  const { data: preview } = useBillingPreview(camaraId)
  // Co-marca
  const [brand, setBrand] = useState<any>({ enabled: false, short_name: '', colors: {}, fonts: {}, logos: {} })
  const [brandColors, setBrandColors] = useState<Record<string, string>>({})
  const setB = (patch: any) => setBrand((b: any) => ({ ...b, ...patch }))
  // Escalas marginales del cobro por socio: desde qué socio rige cada precio
  const [tiers, setTiers] = useState<{ from: string; price: string; factor: string }[]>([{ from: '1', price: '', factor: '1' }])
  const { data: savedTiers = [] } = useQuery({
    queryKey: ['member-tiers', camaraId],
    queryFn: async () => {
      const { data } = await supabase.from('member_price_tiers').select('from_count, price_ars, hour_factor').eq('camara_id', camaraId!).order('from_count')
      return (data ?? []) as { from_count: number; price_ars: number; hour_factor: number }[]
    },
    enabled: !!camaraId,
  })
  useEffect(() => {
    if (savedTiers.length) setTiers(savedTiers.map(t => ({ from: String(t.from_count), price: String(Math.round(t.price_ars)), factor: String(Number(t.hour_factor ?? 1)).replace('.', ',') })))
  }, [JSON.stringify(savedTiers)])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const set = (k: keyof typeof f) => (v: any) => setF(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!camara) return
    setF(p => ({
      ...p, name: camara.name ?? '', entity_type: camara.entity_type ?? 'Cámara', entity_article: camara.entity_article ?? 'la', sector: camara.sector ?? '', business_label: camara.business_label ?? '',
      instructor_label: camara.instructor_label ?? '', pct: String(camara.revenue_share_pct ?? ''), cuit: camara.cuit ?? '',
      email: camara.contact_email ?? '', active: camara.is_active,
      billing_model: camara.billing_model === 'per_member' ? 'per_member' : 'subscriptions', min_members: String(camara.min_billable_members ?? 0),
      price_index: camara.price_index === 'avg_hour' ? 'avg_hour' : 'fixed',
      placement_enabled: (camara as any).placement_enabled ?? true, placement_max: String((camara as any).placement_max_blocks ?? 2),
    }))
    const b: any = (camara as any).brand ?? {}
    setBrand({ enabled: !!b.enabled, short_name: b.short_name ?? '', colors: b.colors ?? {}, fonts: b.fonts ?? {}, logos: b.logos ?? {} })
    setBrandColors(Object.fromEntries(BASE_COLORS.map(c => [c.key, b.colors?.[c.key] ?? ''])))
  }, [camara?.id])
  useEffect(() => {
    const get = (k: string) => prices.find(p => p.plan_type === k)?.price_ars
    setF(p => ({ ...p, starter: get('starter') ? String(get('starter')) : '', premium: get('premium') ? String(get('premium')) : '' }))
  }, [JSON.stringify(prices), camaraId])

  const save = async () => {
    try {
      setSaving(true)
      const pct = Number(f.pct.replace(',', '.'))
      if (!f.name.trim()) throw new UserError('Poné el nombre de la entidad.')
      if (!f.business_label.trim()) throw new UserError('Poné cómo se llama el negocio (ej: Gimnasio).')
      if (isNaN(pct) || pct < 0 || pct > 100) throw new UserError('El porcentaje tiene que estar entre 0 y 100.')
      const perMember = f.billing_model === 'per_member'
      const byHour = f.price_index === 'avg_hour'
      const tierRows = tiers.map(t => ({
        from_count: parseInt(digits(t.from), 10), price_ars: parseInt(digits(t.price), 10) || 0,
        hour_factor: Number(String(t.factor).replace(',', '.')) || 0,
      })).filter(t => t.from_count > 0 && (byHour ? t.hour_factor > 0 : t.price_ars > 0))
      if (perMember) {
        if (!tierRows.length) throw new UserError('Cargá al menos una escala de precio por socio.')
        if (!tierRows.some(t => t.from_count === 1)) throw new UserError('La primera escala tiene que empezar en el socio 1.')
        if (new Set(tierRows.map(t => t.from_count)).size !== tierRows.length) throw new UserError('Dos escalas empiezan en el mismo socio.')
      }
      // Co-marca: si cambió un color base, se descartan sus tonos derivados (se recalculan solos)
      const colorsOut: Record<string, string> = { ...(brand.colors ?? {}) }
      for (const c of BASE_COLORS) {
        const v = brandColors[c.key]?.trim()
        if (v && !HEXRE.test(v)) throw new UserError(`El color ${c.label.toLowerCase()} tiene que ser como #3F5A4C.`)
        if ((v || '') !== (brand.colors?.[c.key] ?? '')) (DERIVED[c.key] ?? []).forEach(k => delete colorsOut[k])
        if (v) colorsOut[c.key] = v.toUpperCase(); else delete colorsOut[c.key]
      }
      if (brand.enabled && !colorsOut.sage) throw new UserError('Para activar la marca, cargá al menos el color principal.')
      const brandOut = { ...brand, short_name: brand.short_name.trim() || null, colors: colorsOut }
      const row = {
        name: f.name.trim(), entity_type: f.entity_type.trim() || 'Organización', entity_article: f.entity_article, sector: f.sector.trim() || slugify(f.business_label), business_label: f.business_label.trim(),
        instructor_label: f.instructor_label.trim() || 'Instructor/a', revenue_share_pct: pct,
        cuit: f.cuit.trim() || null, contact_email: f.email.trim().toLowerCase() || null, is_active: f.active,
        billing_model: f.billing_model, min_billable_members: Math.max(0, parseInt(digits(f.min_members), 10) || 0), price_index: f.price_index,
        placement_enabled: f.placement_enabled, placement_max_blocks: Math.min(7, Math.max(1, parseInt(digits(f.placement_max), 10) || 2)),
        brand: brandOut,
      }
      let id = camaraId
      if (isNew) {
        const { data, error } = await supabase.from('camaras')
          .insert({ ...row, slug: `${slugify(f.name)}-${Date.now().toString(36)}`, country: 'Argentina' }).select('id').single()
        if (error) throw error
        id = data.id
      } else {
        const { error } = await supabase.from('camaras').update(row).eq('id', id!)
        if (error) throw error
      }
      // Escalas por socio (se reemplazan completas)
      if (!isNew || perMember) {
        const { error: delErr } = await supabase.from('member_price_tiers').delete().eq('camara_id', id!)
        if (delErr) throw delErr
        if (perMember) {
          const { error: insErr } = await supabase.from('member_price_tiers').insert(tierRows.map(t => ({ ...t, camara_id: id })))
          if (insErr) throw insErr
        }
      }
      // Precios: vacío = el plan no se puede contratar en esa red (con cobro por socio, Starter no existe)
      for (const plan of ['starter', 'premium'] as const) {
        const n = perMember && plan === 'starter' ? 0 : parseInt(digits(f[plan]), 10)
        const { error } = n > 0
          ? await supabase.from('plan_prices').upsert({ camara_id: id, plan_type: plan, price_ars: n, active: true, updated_at: new Date().toISOString() })
          : await supabase.from('plan_prices').delete().eq('camara_id', id!).eq('plan_type', plan)
        if (error) throw error
      }
      await Promise.all(['platform-camaras', 'camara', 'plan-prices', 'active-camaras', 'platform-counts', 'member-tiers', 'billing-preview', 'camara-contact']
        .map(k => qc.invalidateQueries({ queryKey: [k] })))
      if (isNew) navigation.replace('PlatformCamaraEdit', { camaraId: id })
      else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch (e) { Alert.alert('No pudimos guardar', errorText(e)) }
    finally { setSaving(false) }
  }

  if (!isNew && isLoading) return <LoadingScreen />

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader title={isNew ? 'Nueva red' : 'Editar red'} subtitle={camara?.name} onBack={() => navigation.goBack()} backLabel="Redes" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.caption}>ENTIDAD QUE COORDINA LA RED</Text>
            <Text style={s.label}>TIPO</Text>
            <View style={s.chips}>
              {ENTITY_TYPES.map(o => {
                const on = f.entity_type === o.type
                return (
                  <TouchableOpacity key={o.type} style={[s.chip, on && s.chipOn]}
                    onPress={() => setF(p => ({ ...p, entity_type: o.type, entity_article: o.article }))}>
                    <Text style={[s.chipTxt, on && s.chipTxtOn]}>{o.type}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text style={s.hint}>La app la nombra así: "{f.entity_article === 'el' ? 'El' : 'La'} {f.entity_type} verifica tu perfil".</Text>
            <Input label="NOMBRE" value={f.name} onChangeText={set('name')} placeholder="Cámara de Gimnasios de CABA" />
            <Input label="CUIT" value={f.cuit} onChangeText={set('cuit')} keyboardType="number-pad" placeholder="30-12345678-9" />
            <Input label="EMAIL DE CONTACTO" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
            <View style={s.switchRow}>
              <Text style={s.switchTxt}>Activa (aparece en el registro)</Text>
              <Switch value={f.active} onValueChange={set('active')} trackColor={{ true: colors.sage, false: colors.border }} thumbColor={colors.white} />
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.caption}>LA RED</Text>
            <Text style={s.hint}>Así se ve la opción cuando alguien se registra.</Text>
            <Input label="NEGOCIO" value={f.business_label} onChangeText={set('business_label')} placeholder="Gimnasio" />
            <Input label="INSTRUCTOR" value={f.instructor_label} onChangeText={set('instructor_label')} placeholder="Entrenador/a personal" />
          </View>

          <View style={s.card}>
            <Text style={s.caption}>COBROS</Text>
            <Text style={s.label}>MODELO</Text>
            <View style={s.chips}>
              {([['per_member', 'La entidad paga por socio'], ['subscriptions', 'Cada estudio paga su plan']] as const).map(([k, l]) => {
                const on = f.billing_model === k
                return (
                  <TouchableOpacity key={k} style={[s.chip, on && s.chipOn]} onPress={() => set('billing_model')(k)}>
                    <Text style={[s.chipTxt, on && s.chipTxtOn]}>{l}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {f.billing_model === 'per_member' ? (
              <>
                <Text style={s.hint}>
                  La entidad contrata la app para su red y paga cada mes por cada sede socia con cuenta creada (cada sede busca en su propio barrio). Los socios tienen 5 avisos cubiertos por mes;
                  Premium queda como upgrade que paga el estudio. Starter no se ofrece.
                </Text>
                <Text style={s.label}>PRECIO POR SEDE</Text>
                <View style={s.chips}>
                  {([['avg_hour', 'Según la hora profe promedio'], ['fixed', 'Monto fijo']] as const).map(([k, l]) => {
                    const on = f.price_index === k
                    return (
                      <TouchableOpacity key={k} style={[s.chip, on && s.chipOn]} onPress={() => set('price_index')(k)}>
                        <Text style={[s.chipTxt, on && s.chipTxtOn]}>{l}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {f.price_index === 'avg_hour' ? (
                  <Text style={s.hint}>
                    Cada escala es un factor de la hora profe promedio de la red (lo acordado en las clases cubiertas de los últimos 90 días; si hay pocas, las tarifas de los instructores verificados).
                    {preview?.current_avg_hour ? ` Hoy el promedio es ${formatARS(Number(preview.current_avg_hour))}.` : ' Todavía no hay promedio: mientras tanto rige el monto fijo de cada escala.'}
                  </Text>
                ) : null}
                <Text style={s.label}>ESCALAS (POR SEDE CON CUENTA, POR MES)</Text>
                {tiers.map((t, i) => (
                  <View key={i} style={s.tierRow}>
                    <View style={{ width: 90 }}>
                      <Input label="DESDE LA SEDE" value={t.from} onChangeText={v => setTiers(ts => ts.map((x, j) => j === i ? { ...x, from: v } : x))} keyboardType="number-pad" editable={i > 0} />
                    </View>
                    {f.price_index === 'avg_hour' ? (
                      <View style={{ width: 90 }}>
                        <Input label="× HORA PROFE" value={t.factor} onChangeText={v => setTiers(ts => ts.map((x, j) => j === i ? { ...x, factor: v } : x))} keyboardType="decimal-pad" placeholder="1" />
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Input label={f.price_index === 'avg_hour' ? 'ARS SI NO HAY PROMEDIO' : 'ARS POR SEDE'} value={t.price} onChangeText={v => setTiers(ts => ts.map((x, j) => j === i ? { ...x, price: v } : x))} keyboardType="number-pad" placeholder="Ej: 17000" />
                    </View>
                    {i > 0 ? (
                      <TouchableOpacity onPress={() => setTiers(ts => ts.filter((_, j) => j !== i))} hitSlop={10} style={s.tierDel}>
                        <Text style={s.tierDelTxt}>✕</Text>
                      </TouchableOpacity>
                    ) : <View style={s.tierDel} />}
                  </View>
                ))}
                <TouchableOpacity onPress={() => setTiers(ts => [...ts, { from: '', price: '', factor: '1' }])} style={{ alignSelf: 'flex-start', paddingVertical: 4, marginBottom: spacing.sm }}>
                  <Text style={s.addTxt}>+ Agregar escala</Text>
                </TouchableOpacity>
                <Text style={s.hint}>
                  {f.price_index === 'avg_hour'
                    ? 'Ejemplo: factor 1 desde la sede 1 y 0,85 desde la 51. Con hora profe de $17.000 y 75 sedes: 50 × $17.000 + 25 × $14.500.'
                    : 'Ejemplo: $17.000 desde la sede 1 y $14.500 desde la 51. Con 75 sedes se cobran 50 × $17.000 + 25 × $14.500.'}
                  {preview ? ` Hoy: ${preview.members} sedes con cuenta, ${formatARS(Number(preview.amount_ars))} por mes.` : ''}
                </Text>
                <Input label="MÍNIMO DE SEDES A FACTURAR (0 = SIN MÍNIMO)" value={f.min_members} onChangeText={set('min_members')} keyboardType="number-pad" />
                <Input label="PREMIUM PARA SOCIOS (SIN LÍMITE) — ARS, VACÍO = NO SE OFRECE" value={f.premium} onChangeText={set('premium')} keyboardType="number-pad" placeholder="Ej: 30000" />
              </>
            ) : (
              <>
                <Input label="PARTE DE LA ENTIDAD (%)" value={f.pct} onChangeText={set('pct')} keyboardType="decimal-pad" />
                <Text style={s.hint}>Precio mensual que pagan los estudios de esta red. Dejalo vacío si el plan no se ofrece.</Text>
                <Input label="STARTER (5 AVISOS CUBIERTOS/MES) — ARS" value={f.starter} onChangeText={set('starter')} keyboardType="number-pad" placeholder="Ej: 15000" />
                <Input label="PREMIUM (SIN LÍMITE) — ARS" value={f.premium} onChangeText={set('premium')} keyboardType="number-pad" placeholder="Ej: 30000" />
              </>
            )}
          </View>

          <View style={s.card}>
            <Text style={s.caption}>CLASES REGULARES: CARGO DE INCORPORACIÓN</Text>
            <View style={s.switchRow}>
              <Text style={s.switchTxt}>Cobrar al incorporar una profe</Text>
              <Switch value={f.placement_enabled} onValueChange={set('placement_enabled')} trackColor={{ true: colors.sage, false: colors.border }} thumbColor={colors.white} />
            </View>
            <Text style={s.hint}>
              El estudio paga 1 bloque de 4 clases (al monto acordado) por cada día de la semana que suma, antes de la clase de prueba.
              Si los dos siguen, se cobra; si la profe no sigue, se devuelve; si el estudio no sigue, queda como crédito.
            </Text>
            {f.placement_enabled ? (
              <Input label="MÁXIMO DE BLOQUES" value={f.placement_max} onChangeText={set('placement_max')} keyboardType="number-pad" placeholder="2" />
            ) : null}
          </View>

          <View style={s.card}>
            <Text style={s.caption}>MARCA DE LA RED (CO-MARCA)</Text>
            <View style={s.switchRow}>
              <Text style={s.switchTxt}>La app usa la marca de la red</Text>
              <Switch value={!!brand.enabled} onValueChange={v => setB({ enabled: v })} trackColor={{ true: colors.sage, false: colors.border }} thumbColor={colors.white} />
            </View>
            <Text style={s.hint}>
              Los usuarios de la red ven la app con estos colores, tipografías y logos, con "con Trabajo Más Fácil" chico.
              {camara?.slug ? ` Link de la red: app.trabajo.masfacil.com.ar/?red=${camara.slug}` : ''}
            </Text>
            <Input label="NOMBRE CORTO" value={brand.short_name ?? ''} onChangeText={v => setB({ short_name: v })} placeholder="CAPIAF" />
            {BASE_COLORS.map(c => {
              const v = brandColors[c.key] ?? ''
              const ok = HEXRE.test(v)
              return (
                <View key={c.key} style={s.colorRow}>
                  <View style={[s.swatch, { backgroundColor: ok ? v : colors.white }]} />
                  <View style={{ flex: 1 }}>
                    <Input label={`${c.label} · ${c.hint.toUpperCase()}`} value={v} autoCapitalize="characters" placeholder="#3F5A4C"
                      onChangeText={t => setBrandColors(p => ({ ...p, [c.key]: t.startsWith('#') || !t ? t : '#' + t }))} />
                  </View>
                </View>
              )
            })}
            {brandColors.sage && HEXRE.test(brandColors.sage) ? (
              <View style={s.paletteRow}>
                {Object.values(completePalette({ ...Object.fromEntries(Object.entries(brandColors).filter(([, v]) => HEXRE.test(v))) } as any)).slice(0, 12).map((hex, i) => (
                  <View key={i} style={[s.paletteDot, { backgroundColor: hex as string }]} />
                ))}
              </View>
            ) : null}
            <Text style={s.label}>TIPOGRAFÍA DE TEXTOS</Text>
            <View style={s.chips}>
              {([[null, 'Nunito'], ['jost', 'Jost']] as const).map(([k, l]) => {
                const on = (brand.fonts?.body ?? null) === k
                return <TouchableOpacity key={l} style={[s.chip, on && s.chipOn]} onPress={() => setB({ fonts: { ...brand.fonts, body: k } })}><Text style={[s.chipTxt, on && s.chipTxtOn]}>{l}</Text></TouchableOpacity>
              })}
            </View>
            <Text style={s.label}>TIPOGRAFÍA DE TÍTULOS</Text>
            <View style={s.chips}>
              {([[null, 'Igual que los textos'], ['dm-serif', 'DM Serif Display']] as const).map(([k, l]) => {
                const on = (brand.fonts?.title ?? null) === k
                return <TouchableOpacity key={l} style={[s.chip, on && s.chipOn]} onPress={() => setB({ fonts: { ...brand.fonts, title: k } })}><Text style={[s.chipTxt, on && s.chipTxtOn]}>{l}</Text></TouchableOpacity>
              })}
            </View>
            <Text style={s.hint}>Si la red usa otra tipografía, avisanos y la sumamos.</Text>
            {([['markDark', 'ISOLOGO SOBRE FONDO OSCURO (PNG TRANSPARENTE)', colors.forest], ['mark', 'ISOLOGO SOBRE FONDO CLARO', colors.white], ['wide', 'LOGO HORIZONTAL', colors.white]] as const).map(([k, l, bg]) => (
              <View key={k}>
                <Input label={l} value={brand.logos?.[k] ?? ''} onChangeText={v => setB({ logos: { ...brand.logos, [k]: v.trim() || null } })} autoCapitalize="none" placeholder="https://…" />
                {brand.logos?.[k] ? (
                  <View style={[s.logoPreview, { backgroundColor: bg }]}>
                    <Image source={{ uri: brand.logos[k] }} style={{ width: k === 'wide' ? 220 : 64, height: k === 'wide' ? 34 : 64 }} resizeMode="contain" />
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <Button label={saved ? '✓ Cambios guardados' : isNew ? 'Crear red' : 'Guardar cambios'} onPress={save} isLoading={saving}
            fullWidth size="lg" style={saved ? { backgroundColor: colors.forest } : undefined} />
          {saved ? <Text style={s.savedTxt}>Los cambios ya rigen para esta red.</Text> : null}

          {!isNew && camaraId ? <View style={{ marginTop: spacing.md }}><CamaraTeam camaraId={camaraId} camaraName={camara?.name} /></View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  content:   { padding: spacing.md, paddingBottom: 80 },
  card:      { backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.md },
  caption:   { ...typography.caption, marginBottom: spacing.sm },
  hint:      { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17, marginBottom: spacing.sm },
  label:     { ...typography.caption, color: colors.light, marginBottom: 6 },
  chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  chip:      { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 0.5, borderColor: colors.border },
  chipOn:    { backgroundColor: colors.sage, borderColor: colors.sage },
  chipTxt:   { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.mid },
  chipTxtOn: { color: colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchTxt: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark },
  colorRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch:    { width: 30, height: 30, borderRadius: 15, borderWidth: 0.5, borderColor: colors.border, marginTop: 8 },
  paletteRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  paletteDot:{ width: 22, height: 22, borderRadius: 11, borderWidth: 0.5, borderColor: colors.border },
  logoPreview:{ alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderRadius: 10, marginTop: -6, marginBottom: spacing.md, borderWidth: 0.5, borderColor: colors.border },
  tierRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tierDel:   { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  tierDelTxt:{ fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.mid },
  addTxt:    { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.sage },
  savedTxt:  { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.okTx, textAlign: 'center', marginTop: spacing.sm },
})
