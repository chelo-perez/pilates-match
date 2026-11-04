// src/screens/auth/RegisterRoleScreen.tsx
import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import BackLink from '../../components/BackLink'
import { colors, spacing, radius, typography } from '../../components/ui'

const ROLES = [
  {
    key: 'estudio',
    icon: 'home' as const,
    title: 'Tengo un estudio',
    desc: 'Busco instructores verificados para clases regulares y reemplazos',
    next: 'RegisterStudio',
  },
  {
    key: 'instructor',
    icon: 'activity' as const,
    title: 'Soy instructor/a',
    desc: 'Doy clases de Pilates y busco estudios donde trabajar',
    next: 'RegisterInstructor',
  },
]

type Props = NativeStackScreenProps<any, 'RegisterRole'>

export default function RegisterRoleScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={{ backgroundColor: colors.cream }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <BackLink onPress={() => navigation.goBack()} style={{ marginBottom: spacing.xl }} />

      <Text style={styles.title}>¿Cómo vas a usar{'\n'}Trabajo Más Fácil?</Text>
      <Text style={styles.sub}>Elegí una opción para crear tu cuenta</Text>

      <View style={styles.roles}>
        {ROLES.map(role => (
          <TouchableOpacity
            key={role.key}
            style={styles.roleCard}
            onPress={() => navigation.navigate(role.next, { role: role.key })}
            activeOpacity={0.85}
          >
            <View style={styles.roleIcon}>
              <Feather name={role.icon} size={26} color={colors.sage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleTitle}>{role.title}</Text>
              <Text style={styles.roleDesc}>{role.desc}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.sage} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.loginText}>
          ¿Ya tenés cuenta? <Text style={{ color: colors.sage, fontFamily: 'Nunito-SemiBold' }}>Iniciá sesión</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: spacing.lg },
  title:     { fontFamily: 'Nunito-Bold', fontSize: 26, color: colors.dark, marginBottom: spacing.sm },
  sub:       { ...typography.body, marginBottom: spacing.xl },
  roles:     { gap: spacing.md },
  roleCard:  {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.white, ...radius.leafLg,
    borderWidth: 1, borderColor: colors.mint,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  roleIcon:  { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sageLight },
  roleTitle: { fontFamily: 'Nunito-Bold', fontSize: 16, color: colors.sage, marginBottom: 4 },
  roleDesc:  { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 18 },
  loginLink: { alignItems: 'center', marginTop: spacing.xl },
  loginText: { ...typography.body },
})
