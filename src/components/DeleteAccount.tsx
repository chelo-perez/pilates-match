// "Eliminar mi cuenta" (Google Play lo exige). Borra el perfil y el acceso de forma definitiva.
// Si es un estudio con débito automático, primero se cancela la suscripción en Mercado Pago.
import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Alert } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { errorText } from '../lib/errors'
import { signOutNow } from '../lib/auth'
import { cancelSubscription } from '../lib/payments'
import { useAuthStore } from '../store'
import { Button, Input, colors, spacing, radius } from './ui'

const WHAT: Record<string, string> = {
  estudio: 'tu estudio, tus propuestas, tus evaluaciones y tu plan (si tenés débito automático, se cancela)',
  instructor: 'tu perfil, tus certificados, horarios, tarifas, propuestas y evaluaciones',
  camara_admin: 'tu acceso al panel. La entidad y su red no se borran',
}

export default function DeleteAccount() {
  const role = useAuthStore(s => s.user?.role) ?? 'estudio'
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  if (role === 'super_admin') return null

  const run = async () => {
    try {
      setBusy(true)
      if (role === 'estudio') await cancelSubscription().catch(() => {}) // sin suscripción o pagos sin configurar: sigue
      const { error } = await supabase.rpc('delete_my_account')
      if (error) throw error
      setOpen(false)
      await signOutNow()
    } catch (e) {
      setBusy(false)
      Alert.alert('No pudimos eliminar la cuenta', errorText(e))
    }
  }

  return (
    <View style={s.wrap}>
      <TouchableOpacity style={s.link} onPress={() => { setConfirm(''); setOpen(true) }} accessibilityRole="button">
        <Feather name="trash-2" size={14} color={colors.redTx} />
        <Text style={s.linkTxt}>Eliminar mi cuenta</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => !busy && setOpen(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.title}>Eliminar mi cuenta</Text>
            <Text style={s.body}>
              Se borran de forma definitiva {WHAT[role] ?? WHAT.estudio}. No se puede deshacer.
            </Text>
            <Input label='ESCRIBÍ "ELIMINAR" PARA CONFIRMAR' value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} />
            {busy ? <ActivityIndicator color={colors.redTx} style={{ marginVertical: spacing.md }} /> : (
              <>
                <Button label="Eliminar definitivamente" variant="danger" onPress={run} disabled={confirm.trim().toUpperCase() !== 'ELIMINAR'} fullWidth size="lg" />
                <TouchableOpacity onPress={() => setOpen(false)} style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                  <Text style={s.cancel}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:    { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  link:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  linkTxt: { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: colors.redTx },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  sheet:   { backgroundColor: colors.cream, ...radius.leaf, padding: spacing.lg },
  title:   { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.dark, marginBottom: 6 },
  body:    { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid, lineHeight: 19, marginBottom: spacing.md },
  cancel:  { fontFamily: 'Nunito-Bold', fontSize: 13, color: colors.mid },
})
