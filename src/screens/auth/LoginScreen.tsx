import React, { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet, Image, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'

WebBrowser.maybeCompleteAuthSession()

const C = {
  sage: '#4A5D4E', sageLl: '#F2F5F2', cream: '#F9F9F6',
  dark: '#1A1A1A', mid: '#5C5C5C', light: '#9A9A9A',
  border: '#D8E2D8', red: '#8B1F1F', gold: '#B8960C',
}

export default function LoginScreen({ navigation }: any) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null)
  const [errors,   setErrors]   = useState<{ email?: string; password?: string }>({})
  const { setUser, setSession } = useAuthStore()
  const { toast, showToast, hideToast } = useToast()
  const insets = useSafeAreaInsets()

  const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'trabajomasfacil' })

  const validate = () => {
    const e: { email?: string; password?: string } = {}
    if (!email.trim()) e.email = 'El email es obligatorio'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Email inválido'
    if (!password) e.password = 'La contraseña es obligatoria'
    else if (password.length < 6) e.password = 'Mínimo 6 caracteres'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const navigateByRole = (role: string, nav: any) => {
    if (role === 'instructor')   nav.replace('InstructorTabs')
    else if (role === 'estudio') nav.replace('EstudioHome')
    else if (role === 'camara_admin') nav.replace('CamaraTabs')
    else if (role === 'super_admin')  nav.replace('AdminTabs')
    else nav.replace('SelectRole') // nuevo usuario sin rol
  }

  // ── Email + password ──
  const handleLogin = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      })
      if (error) throw error
      const { data: profile } = await supabase.from('users').select('*').eq('id', authData.user.id).single()
      if (profile) {
        setSession(authData.session)
        setUser(profile)
        navigateByRole(profile.role, navigation)
      } else {
        navigation.replace('SelectRole')
      }
    } catch (err: any) {
      showToast(err.message?.includes('Invalid') ? 'Email o contraseña incorrectos' : err.message ?? 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  // ── OAuth (Google / Apple) ──
  const handleOAuth = async (provider: 'google' | 'apple') => {
    setSocialLoading(provider)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      })
      if (error) throw error
      if (!data.url) throw new Error('No se obtuvo URL de autenticación')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
      if (result.type !== 'success') return

      const url = new URL(result.url)
      const accessToken  = url.searchParams.get('access_token')  || new URLSearchParams(url.hash.slice(1)).get('access_token')
      const refreshToken = url.searchParams.get('refresh_token') || new URLSearchParams(url.hash.slice(1)).get('refresh_token')

      if (!accessToken) throw new Error('No se pudo completar el login')

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken ?? '',
      })
      if (sessionError) throw sessionError

      setSession(sessionData.session)

      // Check if user has a profile with role
      const { data: profile } = await supabase.from('users').select('*').eq('id', sessionData.user!.id).maybeSingle()
      if (profile?.role) {
        setUser(profile)
        navigateByRole(profile.role, navigation)
      } else {
        // New user — create basic record and go to role selection
        navigation.replace('SelectRole')
      }
    } catch (e: any) {
      showToast('Error: ' + (e.message ?? 'No se pudo conectar'))
    } finally {
      setSocialLoading(null)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.cream }}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <View style={[s.hero, { paddingTop: insets.top + 32 }]}>
          <View style={s.hblob1} /><View style={s.hblob2} />
          <View style={s.heroInner}>
            <Image source={require('../../../assets/logo-white.png')} style={s.logoImg} resizeMode="contain" />
          </View>
          <View style={s.waveRow}>
            <View style={s.waveL} /><View style={s.waveR} />
          </View>
        </View>

        <View style={s.form}>

          {/* Social login */}
          <TouchableOpacity
            style={s.socialBtn}
            onPress={() => handleOAuth('google')}
            disabled={!!socialLoading}
            activeOpacity={0.85}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator size="small" color={C.dark} />
            ) : (
              <>
                <Text style={s.googleG}>G</Text>
                <Text style={s.socialTxt}>Continuar con Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.socialBtn, s.appleBtn]}
            onPress={() => handleOAuth('apple')}
            disabled={!!socialLoading}
            activeOpacity={0.85}
          >
            {socialLoading === 'apple' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="smartphone" size={18} color="#fff" />
                <Text style={[s.socialTxt, { color: '#fff' }]}>Continuar con Apple</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerTxt}>o con email</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Email + password */}
          <View style={s.field}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput
              style={[s.input, errors.email ? s.inputErr : null]}
              value={email} onChangeText={setEmail}
              placeholder="hola@mipilates.com" placeholderTextColor={C.light}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />
            {errors.email ? <Text style={s.err}>{errors.email}</Text> : null}
          </View>
          <View style={s.field}>
            <Text style={s.label}>CONTRASEÑA</Text>
            <TextInput
              style={[s.input, errors.password ? s.inputErr : null]}
              value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor={C.light}
              secureTextEntry
            />
            {errors.password ? <Text style={s.err}>{errors.password}</Text> : null}
          </View>

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Iniciar sesión</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.regLink} onPress={() => navigation.navigate('RegisterRole')}>
            <Text style={s.regTxt}>¿No tenés cuenta? <Text style={s.regBold}>Registrate</Text></Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>Con el aval de la Cámara de Pilates de la Ciudad Autónoma de Buenos Aires</Text>
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scroll:    { flexGrow: 1, backgroundColor: C.cream },
  hero:      { backgroundColor: '#3D5440', paddingHorizontal: 20, paddingBottom: 44, position: 'relative', overflow: 'hidden' },
  hblob1:    { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', top: -50, right: -50 },
  hblob2:    { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20 },
  heroInner: { alignItems: 'center', position: 'relative', zIndex: 1, paddingBottom: 8 },
  logoImg:   { width: 200, height: 120 },
  waveRow:   { position: 'absolute', bottom: -1, left: 0, right: 0, height: 28, flexDirection: 'row' },
  waveL:     { flex: 1, height: 28, backgroundColor: C.cream, borderTopRightRadius: 40 },
  waveR:     { flex: 1, height: 28, backgroundColor: C.cream, borderTopLeftRadius: 40 },
  form:      { padding: 20, paddingTop: 28 },
  // Social
  socialBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, elevation: 1 },
  appleBtn:   { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  googleG:    { fontSize: 18, fontFamily: 'Nunito-Bold', color: '#4285F4' },
  socialTxt:  { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: C.dark },
  // Divider
  divider:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine:{ flex: 1, height: 0.5, backgroundColor: C.border },
  dividerTxt: { fontFamily: 'Nunito-Regular', fontSize: 12, color: C.light },
  // Fields
  field:     { marginBottom: 14 },
  label:     { fontFamily: 'Nunito-Bold', fontSize: 9, color: C.light, letterSpacing: 0.8, marginBottom: 6 },
  input:     { backgroundColor: C.sageLl, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Nunito-Regular', color: C.dark },
  inputErr:  { borderColor: C.red },
  err:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: C.red, marginTop: 4 },
  btn:       { backgroundColor: C.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  btnTxt:    { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#fff' },
  regLink:   { alignItems: 'center', marginTop: 18 },
  regTxt:    { fontFamily: 'Nunito-Regular', fontSize: 13, color: C.mid },
  regBold:   { fontFamily: 'Nunito-Bold', color: C.sage },
  footer:    { fontFamily: 'Nunito-Regular', fontSize: 10, color: C.light, textAlign: 'center', marginTop: 8, marginBottom: 32, paddingHorizontal: 20 },
})
