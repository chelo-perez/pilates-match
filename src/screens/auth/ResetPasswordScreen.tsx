// src/screens/auth/ResetPasswordScreen.tsx
// Se muestra al abrir el link del mail "olvidé mi contraseña".
import React, { useState } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { humanizeError } from '../../lib/errors'
import { signOutNow } from '../../lib/auth'
import { useAuthStore } from '../../store'
import { Button, Input, colors, spacing, typography } from '../../components/ui'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets()
  const { toast, showToast, hideToast } = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const save = async () => {
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setError(undefined)
    setSaving(true)
    try {
      const { error: e } = await supabase.auth.updateUser({ password })
      if (e) throw e
      showToast('Listo, ya cambiaste tu contraseña', 'success')
      setTimeout(() => useAuthStore.getState().setPasswordRecovery(false), 1200)
    } catch (e) {
      showToast(humanizeError(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.cream }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[s.container, { paddingTop: insets.top + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Nueva contraseña</Text>
        <Text style={s.sub}>Elegí una contraseña nueva para tu cuenta.</Text>
        <Input label="CONTRASEÑA NUEVA" placeholder="Mínimo 8 caracteres" value={password}
          onChangeText={setPassword} secureTextEntry textContentType="newPassword" />
        <Input label="REPETILA" placeholder="••••••••" value={confirm}
          onChangeText={setConfirm} secureTextEntry textContentType="newPassword" error={error} />
        <Button label="Guardar contraseña" onPress={save} isLoading={saving} size="lg" fullWidth />
        <Button label="Cancelar y salir" variant="ghost" onPress={() => signOutNow()} fullWidth style={{ marginTop: spacing.sm }} />
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl },
  title:     { ...typography.h2, marginBottom: spacing.xs },
  sub:       { ...typography.body, marginBottom: spacing.xl },
})
