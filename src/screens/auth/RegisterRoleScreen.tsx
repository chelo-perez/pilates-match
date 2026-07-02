// src/screens/auth/RegisterRoleScreen.tsx
import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { colors, spacing, radius, typography, shadows, Card } from '../../components/ui'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

const ROLES = [
  {
    key: 'estudio',
    icon: '🏢',
    title: 'Soy dueño de un estudio',
    desc: 'Evalúo instructores y busco reemplazos',
    bg: colors.sageLight,
    border: colors.sageMid,
    next: 'RegisterStudio',
  },
  {
    key: 'instructor',
    icon: '🧘',
    title: 'Soy instructor/a',
    desc: 'Ofrezco clases y reemplazos en estudios',
    bg: colors.sageLighter,
    border: colors.sage,
    next: 'RegisterInstructor',
  },
]

type Props = NativeStackScreenProps<any, 'RegisterRole'>

export default function RegisterRoleScreen({ navigation }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Volver</Text>
      </TouchableOpacity>

      <Text style={styles.title}>¿Cómo vas a usar{'\n'}PilatesMatch?</Text>
      <Text style={styles.sub}>Elegí tu rol para personalizar la experiencia</Text>

      <View style={styles.roles}>
        {ROLES.map(role => (
          <TouchableOpacity
            key={role.key}
            style={[styles.roleCard, { backgroundColor: role.bg, borderColor: role.border }]}
            onPress={() => navigation.navigate(role.next, { role: role.key })}
            activeOpacity={0.85}
          >
            <Text style={styles.roleIcon}>{role.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleTitle}>{role.title}</Text>
              <Text style={styles.roleDesc}>{role.desc}</Text>
            </View>
            <Text style={{ color: colors.mid, fontSize: 18 }}>›</Text>
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
  container: { flexGrow: 1, backgroundColor: colors.cream, padding: spacing.xl },
  backBtn: { marginBottom: spacing.xl },
  backText: { ...typography.body, color: colors.mid },
  title: { fontFamily: 'Nunito-Bold', fontSize: 26, color: colors.dark, marginBottom: spacing.sm },
  sub: { ...typography.body, color: colors.mid, marginBottom: spacing.xl },
  roles: { gap: spacing.md },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 20, borderWidth: 1,
  },
  roleIcon: { fontSize: 28 },
  roleTitle: { fontFamily: 'Nunito-SemiBold', fontSize: 15, color: colors.dark },
  roleDesc: { ...typography.small, color: colors.mid, marginTop: 2 },
  loginLink: { alignItems: 'center', marginTop: spacing.xl },
  loginText: { ...typography.body, color: colors.mid },
})
