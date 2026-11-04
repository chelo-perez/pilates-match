// Equipo de una Cámara: administradores actuales, invitaciones pendientes y alta de nuevos.
// Lo usan la plataforma (Editar Cámara) y la propia Cámara (Perfil de la Cámara).
import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { errorText } from '../lib/errors'
import { useAuthStore } from '../store'
import { Button, Input, colors, spacing, radius, typography } from './ui'

const inviteText = (email: string, camara?: string) =>
  `Te sumé como administrador/a de ${camara ?? 'la Cámara'} en Trabajo Más Fácil. ` +
  `Descargá la app y registrate con este email: ${email}. Vas a entrar directo al panel de la Cámara.`

export default function CamaraTeam({ camaraId, camaraName }: { camaraId: string; camaraName?: string }) {
  const qc = useQueryClient()
  const myId = useAuthStore(s => s.user?.id)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const { data } = useQuery({
    queryKey: ['camara-team', camaraId],
    queryFn: async () => {
      const [a, i] = await Promise.all([
        supabase.from('users').select('id, email, full_name').eq('role', 'camara_admin').eq('camara_id', camaraId).order('created_at'),
        supabase.from('camara_admin_invites').select('email, created_at').eq('camara_id', camaraId).order('created_at'),
      ])
      return { admins: a.data ?? [], invites: i.error ? [] : (i.data ?? []) }
    },
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['camara-team', camaraId] })
  const share = (e: string) => Share.share({ message: inviteText(e, camaraName) }).catch(() => {})

  const add = async () => {
    const clean = email.trim().toLowerCase()
    try {
      setBusy(true)
      const { data: result, error } = await supabase.rpc('invite_camara_admin', { p_email: clean, p_camara: camaraId })
      if (error) throw error
      setEmail(''); refresh()
      if (result === 'invited') {
        Alert.alert('Invitación creada', `${clean} todavía no tiene cuenta. Mandale la invitación: cuando se registre con ese email entra directo como administrador/a.`,
          [{ text: 'Después' }, { text: 'Compartir', onPress: () => share(clean) }])
      } else {
        Alert.alert('Listo', `${clean} ya es administrador/a. La próxima vez que abra la app ve el panel de la Cámara.`)
      }
    } catch (e) { Alert.alert('No pudimos agregarlo', errorText(e)) }
    finally { setBusy(false) }
  }

  const remove = (u: any) => Alert.alert('Quitar administrador/a', `${u.full_name || u.email} deja de ver el panel de la Cámara.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Quitar', style: 'destructive', onPress: async () => {
      const { error } = await supabase.rpc('remove_camara_admin', { p_user: u.id })
      if (error) Alert.alert('No pudimos quitarlo', errorText(error)); else refresh()
    } },
  ])
  const cancelInvite = async (e: string) => {
    const { error } = await supabase.rpc('cancel_camara_invite', { p_email: e })
    if (error) Alert.alert('No pudimos cancelarla', errorText(error)); else refresh()
  }

  return (
    <View style={s.card}>
      <Text style={s.caption}>ADMINISTRADORES</Text>
      <Text style={s.hint}>Pueden verificar instructores, gestionar estudios y ver reportes y liquidaciones.</Text>

      {(data?.admins ?? []).map((u: any) => (
        <View key={u.id} style={s.row}>
          <View style={s.av}><Text style={s.avTxt}>{(u.full_name || u.email)[0].toUpperCase()}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>{u.full_name || u.email}{u.id === myId ? ' (vos)' : ''}</Text>
            {u.full_name ? <Text style={s.sub} numberOfLines={1}>{u.email}</Text> : null}
          </View>
          {u.id !== myId && (
            <TouchableOpacity onPress={() => remove(u)} hitSlop={10} accessibilityLabel={`Quitar a ${u.email}`}>
              <Feather name="user-x" size={18} color={colors.redTx} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {(data?.invites ?? []).map((i: any) => (
        <View key={i.email} style={s.row}>
          <View style={[s.av, { backgroundColor: colors.warnBg }]}><Feather name="clock" size={14} color={colors.warnTx} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>{i.email}</Text>
            <Text style={s.sub}>Invitación pendiente: todavía no se registró</Text>
          </View>
          <TouchableOpacity onPress={() => share(i.email)} hitSlop={10} accessibilityLabel="Compartir invitación">
            <Feather name="share-2" size={18} color={colors.sage} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => cancelInvite(i.email)} hitSlop={10} accessibilityLabel="Cancelar invitación">
            <Feather name="x" size={18} color={colors.mid} />
          </TouchableOpacity>
        </View>
      ))}

      <Input label="AGREGAR POR EMAIL" value={email} onChangeText={setEmail} placeholder="nombre@ejemplo.com"
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} containerStyle={{ marginTop: spacing.md }} />
      <Button label="Agregar administrador/a" variant="secondary" onPress={add} isLoading={busy} disabled={!email.trim()} fullWidth />
      <Text style={[s.hint, { marginTop: spacing.sm, marginBottom: 0 }]}>
        Si ya tiene cuenta, pasa a ser administrador/a al instante. Si no, le queda una invitación para cuando se registre.
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  card:    { backgroundColor: colors.white, ...radius.leaf, padding: spacing.md, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: spacing.md },
  caption: { ...typography.caption, marginBottom: 4 },
  hint:    { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid, lineHeight: 17, marginBottom: spacing.sm },
  row:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  av:      { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.sageLight, alignItems: 'center', justifyContent: 'center' },
  avTxt:   { fontFamily: 'Nunito-Bold', fontSize: 14, color: colors.sage },
  name:    { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: colors.dark },
  sub:     { fontFamily: 'Nunito-Regular', fontSize: 12, color: colors.mid },
})
