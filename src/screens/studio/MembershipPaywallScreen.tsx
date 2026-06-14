// src/screens/studio/MembershipPaywallScreen.tsx
import React from 'react'
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native'
import { useMyStudio } from '../../hooks'
import { Button, Badge, colors, spacing, radius, typography } from '../../components/ui'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

const FEATURES = [
  { label: 'Matches por mes', free: '3', member: '∞' },
  { label: 'Badge de verificación', free: '—', member: '✓' },
  { label: 'Prioridad en búsquedas', free: '—', member: '✓' },
  { label: 'Historial completo', free: 'Últimas 3', member: '✓ Sin límite' },
  { label: 'Estadísticas del mercado', free: '—', member: '✓' },
]

type Props = NativeStackScreenProps<any, 'MembershipPaywall'>

export default function MembershipPaywallScreen({ navigation }: Props) {
  const { data: studio } = useMyStudio()
  const membership = studio?.membership

  const matchesUsed = membership?.matches_used_month ?? 0
  const matchesLimit = membership?.matches_limit ?? 3

  const handleJoin = () => {
    // Redirige al canal de la Cámara fuera de la app
    Linking.openURL('https://www.pilates.org.ar/asociate')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Icono + título */}
      <View style={styles.header}>
        <Text style={styles.icon}>🏛️</Text>
        <Text style={styles.title}>
          {matchesUsed >= matchesLimit
            ? `Usaste tus ${matchesLimit} matches de este mes`
            : 'Potenciá tu estudio'}
        </Text>
        <Text style={styles.sub}>
          Asociate a la Cámara de Pilates de C.A.B.A. y accedé a beneficios exclusivos.
        </Text>
      </View>

      {/* Tabla comparativa */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.thCell, { flex: 2 }]}>Beneficio</Text>
          <Text style={styles.thCell}>Sin socio</Text>
          <Text style={[styles.thCell, { color: colors.gold }]}>🏛️ Socio</Text>
        </View>
        {FEATURES.map((f, i) => (
          <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
            <Text style={[styles.tdCell, { flex: 2 }]}>{f.label}</Text>
            <Text style={[styles.tdCell, { color: colors.light }]}>{f.free}</Text>
            <Text style={[styles.tdCell, { color: colors.success, fontFamily: 'DM_Sans-SemiBold' }]}>{f.member}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <Button
        label="Quiero asociarme →"
        onPress={handleJoin}
        fullWidth size="lg"
        style={styles.cta}
      />

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          El pago del abono mensual se gestiona directamente con la Cámara. Una vez procesado, tu cuenta se actualiza automáticamente en la app.
        </Text>
      </View>

      <Button
        label="Recordarme el mes que viene"
        variant="ghost"
        onPress={() => navigation.goBack()}
        fullWidth
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  icon: { fontSize: 48, marginBottom: spacing.md },
  title: { fontFamily: 'Playfair_Display-Medium', fontSize: 22, color: colors.dark, textAlign: 'center', marginBottom: spacing.sm },
  sub: { ...typography.body, color: colors.mid, textAlign: 'center', lineHeight: 22 },
  table: { backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.xl, borderWidth: 0.5, borderColor: colors.border },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.sageLight, padding: spacing.md },
  thCell: { flex: 1, ...typography.label, color: colors.sage, textAlign: 'center', fontSize: 10 },
  tableRow: { flexDirection: 'row', padding: spacing.md },
  tableRowAlt: { backgroundColor: colors.cream },
  tdCell: { flex: 1, ...typography.small, color: colors.dark, textAlign: 'center' },
  cta: { marginBottom: spacing.md, backgroundColor: colors.gold },
  infoBox: { backgroundColor: colors.goldLight, borderRadius: radius.md, padding: spacing.md, borderWidth: 0.5, borderColor: colors.goldMid },
  infoText: { ...typography.small, color: colors.sandDark, lineHeight: 18, textAlign: 'center' },
})
