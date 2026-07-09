// Pantalla post-OAuth para nuevos usuarios — eligen su rol
import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { colors, spacing } from '../../components/ui'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const ROLES = [
  {
    key: 'instructor',
    icon: 'activity' as const,
    title: 'Soy instructor/a',
    desc: 'Ofrezco clases de Pilates y busco estudios donde trabajar',
    color: colors.sage,
    bg: colors.sageLight,
    note: 'Necesitás verificación de la Cámara para aparecer en búsquedas',
  },
  {
    key: 'estudio',
    icon: 'home' as const,
    title: 'Soy dueño/a de un estudio',
    desc: 'Busco instructores verificados para mis clases',
    color: '#0C447C',
    bg: '#E6F1FB',
    note: 'Empezás con 1 propuesta/mes gratis. Podés actualizar tu plan cuando quieras',
  },
]

export default function SelectRoleScreen({ navigation }: any) {
  const { user } = useAuthStore()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const handleSelect = async (role: string) => {
    setSelected(role)
    setLoading(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('No hay sesión activa')

      // Create user record
      await supabase.from('users').upsert({
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name ?? authUser.email?.split('@')[0],
        role,
      }, { onConflict: 'id' })

      if (role === 'instructor') {
        // Create instructor profile
        await supabase.from('instructors').upsert({
          user_id: authUser.id,
          full_name: authUser.user_metadata?.full_name ?? '',
          verification_status: 'pendiente',
          is_active: true,
        }, { onConflict: 'user_id' })
        navigation.replace('InstructorTabs')
      } else {
        // Create studio with Freemium membership
        const { data: studio } = await supabase.from('studios').upsert({
          user_id: authUser.id,
          name: authUser.user_metadata?.full_name ?? 'Mi estudio',
          neighborhood: '',
          is_member: false,
        }, { onConflict: 'user_id' }).select().single()

        if (studio) {
          // Auto-assign Freemium
          const end = new Date()
          end.setFullYear(end.getFullYear() + 10) // Freemium no vence
          await supabase.from('memberships').upsert({
            studio_id: studio.id,
            status: 'activa',
            plan_type: 'freemium',
            matches_limit: 1,
            matches_used_month: 0,
            start_date: new Date().toISOString().split('T')[0],
            end_date: end.toISOString().split('T')[0],
          }, { onConflict: 'studio_id' })
        }
        navigation.replace('EstudioHome')
      }
    } catch (e: any) {
      console.error(e)
      setLoading(false)
      setSelected(null)
    }
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 32 }]}>
      <View style={s.header}>
        <Text style={s.title}>¿Cómo querés usar la app?</Text>
        <Text style={s.subtitle}>Elegí tu rol para continuar. No se puede cambiar después.</Text>
      </View>

      <View style={s.roles}>
        {ROLES.map(role => (
          <TouchableOpacity
            key={role.key}
            style={[s.roleCard, { borderColor: role.color, backgroundColor: selected === role.key ? role.bg : colors.white }]}
            onPress={() => handleSelect(role.key)}
            disabled={loading}
            activeOpacity={0.85}
          >
            <View style={[s.roleIcon, { backgroundColor: role.bg }]}>
              <Feather name={role.icon} size={28} color={role.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.roleTitle, { color: role.color }]}>{role.title}</Text>
              <Text style={s.roleDesc}>{role.desc}</Text>
              <View style={s.roleNote}>
                <Feather name="info" size={11} color={colors.light} />
                <Text style={s.roleNoteTxt}>{role.note}</Text>
              </View>
            </View>
            {selected === role.key && loading ? (
              <ActivityIndicator size="small" color={role.color} />
            ) : (
              <Feather name="chevron-right" size={20} color={role.color} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.footer}>
        Si sos administrador de una Cámara, contactá directamente a Trabajo Más Fácil.
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.cream, paddingHorizontal: spacing.xl },
  header:       { marginBottom: spacing.xl },
  title:        { fontFamily: 'Nunito-Bold', fontSize: 26, color: colors.dark, marginBottom: 8 },
  subtitle:     { fontFamily: 'Nunito-Regular', fontSize: 14, color: colors.mid, lineHeight: 22 },
  roles:        { gap: spacing.md },
  roleCard:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderTopLeftRadius: 20, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 20, borderWidth: 1.5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  roleIcon:     { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roleTitle:    { fontFamily: 'Nunito-Bold', fontSize: 16, marginBottom: 4 },
  roleDesc:     { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 18, marginBottom: 8 },
  roleNote:     { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  roleNoteTxt:  { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, flex: 1, lineHeight: 16 },
  footer:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: colors.light, textAlign: 'center', marginTop: spacing.xl, lineHeight: 17 },
})
