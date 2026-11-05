// "Salir" del encabezado (mismo botón en el Inicio de todos los perfiles).
import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { confirmSignOut } from '../lib/auth'
import { colors } from './ui'

export default function LogoutPill() {
  return (
    <TouchableOpacity style={s.pill} onPress={() => confirmSignOut()} accessibilityRole="button" accessibilityLabel="Cerrar sesión" hitSlop={8}>
      <Feather name="log-out" size={13} color={colors.white} />
      <Text style={s.txt}>Salir</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  txt:  { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.white },
})
