// Dueño de la plataforma: alta y edición de una Cámara (sector, % de reparto, precios y admins).
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { errorText, UserError } from '../../lib/errors'
import { rpc, useCamara } from '../../lib/platform'
import { usePlanPrices } from '../../lib/payments'
import HeroHeader from '../../components/HeroHeader'
import { Button, Input, LoadingScreen, colors, spacing, radius, typography } from '../../components/ui'

const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const digits = (s: string) => s.replace(/\D/g, '')

export default function PlatformCamaraEditScreen({ navigation, route }: any) {
  const camaraId: string | undefined = route.params?.camaraId
  const isNew = !camaraId
  const qc = useQueryClient()
  const { data: camara, isLoading } = useCamara(camaraId)
  const { data: prices = [] } = usePlanPrices(camaraId)
  const { data: admins = [], refetch: refetchAdmins } = useQuery({
    queryKey: ['camara-admins', camaraId],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('id, email, full_name').eq('role', 'camara_admin').eq('camara_id', camaraId!)
      return data ?? []
    },
    enabled: !!camaraId,
  })

  const [f, setF] = useState({
    name: '', sector: '', business_label: '', instructor_label: '', pct: '25', cuit: '', email: '', active: true,
    starter: '', premium: '',
  })
  const [adminEmail, setAdminEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const set = (k: keyof typeof f) => (v: any) => setF(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!camara) return
    setF(p => ({
      ...p, name: camara.name ?? '', sector: camara.sector ?? '', business_label: camara.business_label ?? '',
      instructor_label: camara.instructor_label ?? '', pct: String(camara.revenue_share_pct ?? ''), cuit: camara.cuit ?? '',
      email: camara.contact_email ?? '', active: camara.is_active,
    }))
  }, [camara?.id])
  useEffect(() => {
    const get = (k: string) => prices.find(p => p.plan_type === k)?.price_ars
    setF(p => ({ ...p, starter: get('starter') ? String(get('starter')) : '', premium: get('premium') ? String(get('premium')) : '' }))
  }, [JSON.stringify(prices), camaraId])

  const save = async () => {
    try {
      setSaving(true)
      const pct = Number(f.pct.replace(',', '.'))
      if (!f.name.trim()) throw new UserError('Poné el nombre de la Cámara.')
      if (!f.business_label.trim()) throw new UserError('Poné cómo se llama el negocio (ej: Gimnasio).')
      if (isNaN(pct) || pct < 0 || pct > 100) throw new UserError('El porcentaje tiene que estar entre 0 y 100.')
      const row = {
        name: f.name.trim(), sector: f.sector.trim() || slugify(f.business_label), business_label: f.business_label.trim(),
        instructor_label: f.instructor_label.trim() || 'Instructor/a', revenue_share_pct: pct,
        cuit: f.cuit.trim() || null, contact_email: f.email.trim().toLowerCase() || null, is_active: f.active,
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
      // Precios: vacío = el plan no se puede contratar en esa red
      for (const plan of ['starter', 'premium'] as const) {
        const n = parseInt(digits(f[plan]), 10)
        const { error } = n > 0
          ? await supabase.from('plan_prices').upsert({ camara_id: id, plan_type: plan, price_ars: n, active: true, updated_at: new Date().toISOString() })
          : await supabase.from('plan_prices').delete().eq('camara_id', id!).eq('plan_type', plan)
        if (error) throw error
      }
      await Promise.all(['platform-camaras', 'camara', 'plan-prices', 'active-camaras', 'platform-counts']
        .map(k => qc.invalidateQueries({ queryKey: [k] })))
      if (isNew) navigation.replace('PlatformCamaraEdit', { camaraId: id })
      else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch (e) { Alert.alert('No pudimos guardar', errorText(e)) }
    finally { setSaving(false) }
  }

  const addAdmin = async () => {
    try {
      await rpc('platform_set_camara_admin', { p_email: adminEmail, p_camara: camaraId })
      setAdminEmail(''); refetchAdmins()
      Alert.alert('Listo', 'La próxima vez que entre a la app va a ver el panel de la Cámara.')
    } catch (e) { Alert.alert('No pudimos nombrarlo', errorText(e)) }
  }

  if (!isNew && isLoading) return <LoadingScreen />

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <HeroHeader title={isNew ? 'Nueva Cámara' : 'Editar Cámara'} subtitle={camara?.name} onBack={() => navigation.goBack()} backLabel="Cámaras" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.caption}>LA CÁMARA</Text>
            <Input label="NOMBRE" value={f.name} onChangeText={set('name')} placeholder="Cámara de Gimnasios de CABA" />
            <Input label="CUIT" value={f.cuit} onChangeText={set('cuit')} keyboardType="number-pad" placeholder="30-12345678-9" />
            <Input label="EMAIL DE CONTACTO" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
            <View style={s.switchRow}>
              <Text style={s.switchTxt}>Activa (aparece en el registro)</Text>
              <Switch value={f.active} onValueChange={set('active')} trackColor={{ true: colors.sage, false: colors.border }} thumbColor={colors.white} />
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.caption}>SECTOR</Text>
            <Text style={s.hint}>Así se ve la opción cuando alguien se registra.</Text>
            <Input label="NEGOCIO" value={f.business_label} onChangeText={set('business_label')} placeholder="Gimnasio" />
            <Input label="INSTRUCTOR" value={f.instructor_label} onChangeText={set('instructor_label')} placeholder="Entrenador/a personal" />
          </View>

          <View style={s.card}>
            <Text style={s.caption}>COBROS</Text>
            <Input label="PARTE DE LA CÁMARA (%)" value={f.pct} onChangeText={set('pct')} keyboardType="decimal-pad" />
            <Text style={s.hint}>Precio mensual que pagan los estudios de esta red. Dejalo vacío si el plan no se ofrece.</Text>
            <Input label="STARTER (5 PROPUESTAS/MES) — ARS" value={f.starter} onChangeText={set('starter')} keyboardType="number-pad" placeholder="Ej: 15000" />
            <Input label="PREMIUM (SIN LÍMITE) — ARS" value={f.premium} onChangeText={set('premium')} keyboardType="number-pad" placeholder="Ej: 30000" />
          </View>

          <Button label={saved ? '✓ Cambios guardados' : isNew ? 'Crear Cámara' : 'Guardar cambios'} onPress={save} isLoading={saving}
            fullWidth size="lg" style={saved ? { backgroundColor: colors.forest } : undefined} />
          {saved ? <Text style={s.savedTxt}>Los precios y el porcentaje ya rigen para esta red.</Text> : null}

          {!isNew && (
            <View style={[s.card, { marginTop: spacing.md }]}>
              <Text style={s.caption}>ADMINISTRADORES</Text>
              {admins.length === 0 ? <Text style={s.hint}>Todavía no tiene administradores.</Text> : admins.map((a: any) => (
                <Text key={a.id} style={s.admin}>{a.full_name ? `${a.full_name} · ` : ''}{a.email}</Text>
              ))}
              <Text style={s.hint}>La persona tiene que tener una cuenta creada en la app.</Text>
              <Input label="EMAIL" value={adminEmail} onChangeText={setAdminEmail} keyboardType="email-address" autoCapitalize="none" />
              <Button label="Nombrar administrador" variant="secondary" onPress={addAdmin} disabled={!adminEmail.trim()} fullWidth />
            </View>
          )}
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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchTxt: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.dark },
  savedTxt:  { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.okTx, textAlign: 'center', marginTop: spacing.sm },
  admin:     { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.dark, paddingVertical: 4 },
})
