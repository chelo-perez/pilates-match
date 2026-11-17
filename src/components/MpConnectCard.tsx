// Instructor: conectar su Mercado Pago para cobrar los reemplazos por la app (cobro garantizado).
// Solo aparece si la red del instructor usa el cobro garantizado.
import React, { useState } from 'react'
import { View, Text, StyleSheet, Platform, Alert } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import { Button, colors, spacing } from './ui'
import { connectMp, disconnectMp, useMpConnection } from '../lib/matchFlow'
import { errorText } from '../lib/errors'

const say = (m: string) => Platform.OS === 'web' ? window.alert(m) : Alert.alert('', m)

export default function MpConnectCard({ compact }: { compact?: boolean }) {
  const { data: mp, refetch } = useMpConnection()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  if (!mp?.required) return null
  if (compact && mp.connected) return null

  const connect = async () => {
    setBusy(true)
    try { await connectMp(); await refetch() } catch (e) { say(errorText(e)) } finally { setBusy(false) }
  }
  const disconnect = async () => {
    const ok = Platform.OS === 'web' ? window.confirm('¿Desconectar tu Mercado Pago? No vas a poder aceptar reemplazos hasta que lo vuelvas a conectar.') : true
    if (!ok) return
    setBusy(true)
    try { await disconnectMp(); qc.invalidateQueries({ queryKey: ['mp-connection'] }) } catch (e) { say(errorText(e)) } finally { setBusy(false) }
  }

  return (
    <View style={[s.card, compact && s.compact, mp.connected && { borderColor: colors.okBg }]}>
      <View style={s.row}>
        <View style={[s.icon, { backgroundColor: mp.connected ? colors.okBg : colors.warnBg }]}>
          <Feather name={mp.connected ? 'check' : 'credit-card'} size={16} color={mp.connected ? colors.okTx : colors.warnTx} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{mp.connected ? 'Mercado Pago conectado' : 'Conectá tu Mercado Pago'}</Text>
          <Text style={s.sub}>{mp.connected
            ? `Los reemplazos te los pagan por la app y llegan a ${mp.email ?? 'tu cuenta'}. Recibís el 100% de lo acordado.`
            : 'En tu red los reemplazos se pagan por la app: el estudio paga antes de la clase y la plata llega directo a tu cuenta. Lo necesitás para aceptar reemplazos.'}</Text>
        </View>
      </View>
      {!compact ? (
        <View style={s.note}>
          <Feather name="info" size={13} color={colors.mid} style={{ marginTop: 2 }} />
          <Text style={s.noteTxt}>
            Siempre recibís al menos el 100% de lo acordado: el estudio paga también el costo de Mercado Pago. Ese costo depende del plazo de liberación que tengas en tu Mercado Pago: si la plata se libera a más días, el costo es menor y te queda un poco más.
          </Text>
        </View>
      ) : null}
      {mp.connected
        ? (!compact ? <Button label="Desconectar" variant="ghost" size="sm" onPress={disconnect} isLoading={busy} style={{ alignSelf: 'flex-start', marginTop: spacing.xs }} /> : null)
        : <Button label="Conectar Mercado Pago" onPress={connect} isLoading={busy} fullWidth style={{ marginTop: spacing.sm }} />}
    </View>
  )
}

const s = StyleSheet.create({
  card:    { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.warnBg, padding: spacing.md, marginTop: spacing.md },
  compact: { marginHorizontal: spacing.md, marginTop: 0, marginBottom: spacing.md },
  row:     { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon:    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title:   { fontFamily: 'Nunito-Bold', fontSize: 15, color: colors.dark },
  sub:     { fontFamily: 'Nunito-Regular', fontSize: 13, lineHeight: 19, color: colors.mid, marginTop: 2 },
  note:    { flexDirection: 'row', gap: 8, marginTop: spacing.sm, padding: 10, borderRadius: 10, backgroundColor: colors.sageLighter },
  noteTxt: { flex: 1, fontFamily: 'Nunito-Regular', fontSize: 12, lineHeight: 17, color: colors.mid },
})
