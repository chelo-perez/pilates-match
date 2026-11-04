// src/screens/auth/SelectRoleScreen.tsx
// Onboarding para cuentas sin perfil: quien entró con Google/Apple, o quien
// cortó el registro a la mitad. Elige el rol, completa nombre y barrio, y se
// crea el estudio (con plan Freemium) o el perfil de instructor.
import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { humanizeError } from '../../lib/errors'
import { syncAuthUser, signOutNow } from '../../lib/auth'
import { toLocalISODate } from '../../lib/dates'
import BarrioSelect from '../../components/BarrioSelect'
import { useAuthStore } from '../../store'
import { Button, Input, colors, radius, spacing, typography } from '../../components/ui'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

type Role = 'instructor' | 'estudio'

const ROLES: { key: Role; icon: 'activity' | 'home'; title: string; desc: string; note: string }[] = [
  {
    key: 'estudio',
    icon: 'home',
    title: 'Tengo un estudio',
    desc: 'Busco instructores verificados para clases regulares y reemplazos',
    note: 'Empezás con el plan Freemium: 1 propuesta por mes sin costo',
  },
  {
    key: 'instructor',
    icon: 'activity',
    title: 'Soy instructor/a',
    desc: 'Doy clases de Pilates y busco estudios donde trabajar',
    note: 'La Cámara verifica tu perfil antes de que aparezcas en las búsquedas',
  },
]

/** Inserta y, si ya existía (23505), lo da por bueno: permite reintentar sin romper. */
async function insertIgnoringDuplicate(table: string, row: Record<string, any>) {
  const { error } = await supabase.from(table).insert(row)
  if (error && error.code !== '23505') throw error
}

export default function SelectRoleScreen() {
  const { toast, showToast, hideToast } = useToast()
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.user)
  const insets = useSafeAreaInsets()
  const authUser = session?.user
  const metaName: string = authUser?.user_metadata?.full_name ?? profile?.full_name ?? ''

  const [role, setRole] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [barrio, setBarrio] = useState('')
  const [errors, setErrors] = useState<{ name?: string; barrio?: string }>({})
  const [saving, setSaving] = useState(false)

  const pickRole = (r: Role) => {
    setRole(r)
    setName(r === 'instructor' ? metaName : '')
    setErrors({})
  }

  const submit = async () => {
    if (!role || !authUser) return
    const e: typeof errors = {}
    if (name.trim().length < 2) e.name = role === 'estudio' ? 'Escribí el nombre del estudio' : 'Escribí tu nombre y apellido'
    if (!barrio) e.barrio = 'Elegí un barrio'
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    try {
      // 1. Rol en users (el trigger handle_new_user ya creó la fila; la base
      //    solo deja elegir entre estudio e instructor)
      const { error: userError } = await supabase.from('users').upsert({
        id: authUser.id,
        email: authUser.email,
        full_name: role === 'instructor' ? name.trim() : (metaName || null),
        role,
      }, { onConflict: 'id' })
      if (userError) throw userError

      if (role === 'instructor') {
        await insertIgnoringDuplicate('instructors', {
          user_id: authUser.id,
          full_name: name.trim(),
          email: authUser.email,
          neighborhood: barrio,
          verification_status: 'pendiente',
          is_active: true,
        })
      } else {
        await insertIgnoringDuplicate('studios', {
          user_id: authUser.id,
          name: name.trim(),
          neighborhood: barrio,
          owner_name: metaName || null,
          owner_email: authUser.email,
        })
        const { data: studio, error: studioError } = await supabase
          .from('studios').select('id').eq('user_id', authUser.id).single()
        if (studioError) throw studioError

        const end = new Date()
        end.setFullYear(end.getFullYear() + 10) // Freemium no vence
        await insertIgnoringDuplicate('memberships', {
          studio_id: studio.id,
          status: 'activa',
          plan_type: 'freemium',
          matches_limit: 1,
          matches_used_month: 0,
          start_date: toLocalISODate(new Date()),
          end_date: toLocalISODate(end),
        })
      }
      // Relee el perfil: RootNavigator pasa solo a las pantallas del rol
      await syncAuthUser(authUser.id)
    } catch (err) {
      showToast(humanizeError(err), 'error')
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.cream }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[s.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <View style={s.progress}>
          <View style={[s.progressDot, s.progressDotActive]} />
          <View style={[s.progressDot, role && s.progressDotActive]} />
        </View>

        {!role ? (
          <>
            <Text style={s.title}>¿Cómo vas a usar la app?</Text>
            <Text style={s.subtitle}>Elegí una opción para crear tu perfil.</Text>
            <View style={s.roles}>
              {ROLES.map(r => (
                <TouchableOpacity key={r.key} style={s.roleCard} onPress={() => pickRole(r.key)} activeOpacity={0.85}>
                  <View style={s.roleIcon}>
                    <Feather name={r.icon} size={26} color={colors.sage} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.roleTitle}>{r.title}</Text>
                    <Text style={s.roleDesc}>{r.desc}</Text>
                    <View style={s.roleNote}>
                      <Feather name="info" size={12} color={colors.light} />
                      <Text style={s.roleNoteTxt}>{r.note}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.sage} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.footer}>
              ¿Administrás una Cámara? Escribinos y te damos el acceso.
            </Text>
          </>
        ) : (
          <>
            <Text style={s.title}>{role === 'estudio' ? 'Tu estudio' : 'Tus datos'}</Text>
            <Text style={s.subtitle}>
              {role === 'estudio'
                ? 'Así te van a ver los instructores. Después podés completar el resto desde tu perfil.'
                : 'La Cámara usa estos datos para verificarte. Después podés sumar certificados y tarifas.'}
            </Text>
            <Input
              label={role === 'estudio' ? 'NOMBRE DEL ESTUDIO' : 'NOMBRE Y APELLIDO'}
              placeholder={role === 'estudio' ? 'Studio Zen Palermo' : 'Martina Ruiz'}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              error={errors.name}
            />
            <BarrioSelect label={role === 'estudio' ? 'BARRIO DEL ESTUDIO' : 'BARRIO DONDE VIVÍS'}
              value={barrio} onChange={setBarrio} error={errors.barrio} />

            <Button label="Crear perfil" onPress={submit} isLoading={saving} size="lg" fullWidth style={{ marginTop: spacing.lg }} />
            <Button label="← Elegir otra opción" variant="ghost" onPress={() => setRole(null)} disabled={saving} fullWidth style={{ marginTop: spacing.sm }} />
          </>
        )}

        <TouchableOpacity style={s.otherAccount} onPress={() => signOutNow()} disabled={saving}>
          <Text style={s.otherAccountTxt}>
            {authUser?.email ? `Entraste como ${authUser.email}. ` : ''}
            <Text style={{ fontFamily: 'Nunito-SemiBold', color: colors.sage }}>Usar otra cuenta</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:   { flexGrow: 1, paddingHorizontal: spacing.lg },
  progress:    { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xl },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.sageLight },
  progressDotActive: { backgroundColor: colors.sage },
  title:       { fontFamily: 'Nunito-Bold', fontSize: 26, color: colors.dark, marginBottom: spacing.sm },
  subtitle:    { ...typography.body, marginBottom: spacing.xl },
  roles:       { gap: spacing.md },
  roleCard:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.white, ...radius.leafLg, borderWidth: 1, borderColor: colors.mint, ...{ shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 } },
  roleIcon:    { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sageLight },
  roleTitle:   { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.sage, marginBottom: 4 },
  roleDesc:    { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 18, marginBottom: 8 },
  roleNote:    { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  roleNoteTxt: { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.light, flex: 1, lineHeight: 16 },
  fieldLabel:  { ...typography.caption, marginBottom: spacing.sm },
  chipGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  errorText:   { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.redTx, marginTop: spacing.xs },
  footer:      { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.light, textAlign: 'center', marginTop: spacing.xl, lineHeight: 17 },
  otherAccount:    { alignItems: 'center', marginTop: spacing.xl, padding: spacing.sm },
  otherAccountTxt: { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, textAlign: 'center' },
})
