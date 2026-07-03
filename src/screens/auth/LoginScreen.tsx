// src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import { colors, spacing, radius, Input } from '../../components/ui'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function LoginScreen({ navigation }: any) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState<{ email?: string; password?: string }>({})
  const { setUser, setSession } = useAuthStore()
  const { toast, showToast, hideToast } = useToast()
  const insets = useSafeAreaInsets()

  const validate = () => {
    const e: { email?: string; password?: string } = {}
    if (!email.trim())              e.email    = 'El email es obligatorio'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Email inválido'
    if (!password)                  e.password = 'La contraseña es obligatoria'
    else if (password.length < 6)   e.password = 'Mínimo 6 caracteres'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleLogin = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) throw error

      const { data: profile, error: profileError } = await supabase
        .from('users').select('*').eq('id', authData.user.id).single()
      if (profileError) throw profileError

      setSession(authData.session)
      setUser(profile)

      const role = profile.role
      if      (role === 'instructor')               navigation.replace('InstructorTabs')
      else if (role === 'studio' || role === 'estudio') navigation.replace('EstudioHome')
      else if (role === 'camara_admin')             navigation.replace('CamaraTabs')
      else if (role === 'super_admin')              navigation.replace('AdminTabs')

    } catch (err: any) {
      showToast(err.message?.includes('Invalid') ? 'Email o contraseña incorrectos' : err.message ?? 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.cream }}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Hero con gradiente */}
        <View style={[s.hero, { paddingTop: insets.top + 24 }]}>
          <View style={s.hblob1} />
          <View style={s.hblob2} />
          <View style={s.heroInner}>
            <View style={s.logoRing}>
              <Text style={s.logoTxt}>TF</Text>
            </View>
            <Text style={s.appName}>Trabajo Más Fácil</Text>
            <Text style={s.appSub}>La comunidad de Pilates de Buenos Aires</Text>
          </View>
          <Svg width="100%" height={28} viewBox="0 0 375 28" preserveAspectRatio="none" style={s.wave}>
            <Path d="M0,14 C93,28 187,0 280,14 C327,21 351,24 375,14 L375,28 L0,28 Z" fill={colors.cream} />
          </Svg>
        </View>
        <View style={s.form}>
          <Input
            label="Email"
            placeholder="hola@mipilates.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <Input
            label="Contraseña"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnTxt}>Iniciar sesión</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.registerLink} onPress={() => navigation.navigate('RegisterRole')}>
            <Text style={s.registerTxt}>
              ¿No tenés cuenta?{' '}
              <Text style={s.registerBold}>Registrate</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>Avalado por la Cámara de Pilates de Buenos Aires</Text>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scroll:       { flexGrow: 1, backgroundColor: colors.cream },
  hero:         { backgroundColor: '#3D5440', paddingHorizontal: spacing.md, paddingBottom: 44, position: 'relative', overflow: 'hidden' },
  hblob1:       { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', top: -50, right: -50 },
  hblob2:       { position: 'absolute', width: 120, height: 120, borderRadius: 60,  backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20 },
  heroInner:    { alignItems: 'center', position: 'relative', zIndex: 1, paddingBottom: 8 },
  wave:         { position: 'absolute', bottom: 0, left: 0, right: 0 },
  logoRing:     { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoTxt:      { fontFamily: 'Nunito-Bold', fontSize: 22, color: '#fff' },
  appName:      { fontFamily: 'Nunito-Bold', fontSize: 24, color: '#fff', letterSpacing: -0.3, marginBottom: 6 },
  appSub:       { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  form:         { padding: spacing.md, paddingTop: spacing.lg },
  btn:          { backgroundColor: colors.sage, ...radius.md, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  btnDisabled:  { opacity: 0.65 },
  btnTxt:       { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#fff' },
  registerLink: { alignItems: 'center', marginTop: spacing.lg },
  registerTxt:  { fontFamily: 'Nunito-Regular', fontSize: 13, color: colors.mid },
  registerBold: { fontFamily: 'Nunito-Bold', color: colors.sage },
  footer:       { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: colors.light, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl },
})
