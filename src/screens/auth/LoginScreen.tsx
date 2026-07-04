import React, { useState } from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const C = { sage: '#4A5D4E', sageLl: '#F2F5F2', cream: '#F9F9F6', dark: '#1A1A1A', mid: '#5C5C5C', light: '#9A9A9A', border: '#D8E2D8', red: '#8B1F1F', gold: '#B8960C' }

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
    if (!email.trim()) e.email = 'El email es obligatorio'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Email inválido'
    if (!password) e.password = 'La contraseña es obligatoria'
    else if (password.length < 6) e.password = 'Mínimo 6 caracteres'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleLogin = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error) throw error
      const { data: profile, error: profileError } = await supabase.from('users').select('*').eq('id', authData.user.id).single()
      if (profileError) throw profileError
      setSession(authData.session)
      setUser(profile)
      const role = profile.role
      if (role === 'instructor') navigation.replace('InstructorTabs')
      else if (role === 'studio' || role === 'estudio') navigation.replace('EstudioHome')
      else if (role === 'camara_admin') navigation.replace('CamaraTabs')
      else if (role === 'super_admin') navigation.replace('AdminTabs')
    } catch (err: any) {
      showToast(err.message?.includes('Invalid') ? 'Email o contraseña incorrectos' : err.message ?? 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.cream }}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <View style={[s.hero, { paddingTop: insets.top + 32 }]}>
          <View style={s.hblob1} /><View style={s.hblob2} />
          <View style={s.heroInner}>
            <View style={s.logoRing}><Text style={s.logoTxt}>TF</Text></View>
            <Text style={s.appName}>Trabajo Más Fácil</Text>
            <Text style={s.appSub}>La comunidad de Pilates de Buenos Aires</Text>
          </View>
          <View style={s.waveRow}>
            <View style={s.waveL} /><View style={s.waveR} />
          </View>
        </View>

        {/* Form */}
        <View style={s.form}>
          <View style={s.field}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput style={[s.input, errors.email ? s.inputErr : null]} value={email} onChangeText={setEmail} placeholder="hola@mipilates.com" placeholderTextColor={C.light} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            {errors.email ? <Text style={s.err}>{errors.email}</Text> : null}
          </View>
          <View style={s.field}>
            <Text style={s.label}>CONTRASEÑA</Text>
            <TextInput style={[s.input, errors.password ? s.inputErr : null]} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={C.light} secureTextEntry />
            {errors.password ? <Text style={s.err}>{errors.password}</Text> : null}
          </View>
          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Iniciar sesión</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.regLink} onPress={() => navigation.navigate('RegisterRole')}>
            <Text style={s.regTxt}>¿No tenés cuenta? <Text style={s.regBold}>Registrate</Text></Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>Avalado por la Cámara de Pilates de Buenos Aires</Text>
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
  waveRow:   { position: 'absolute', bottom: -1, left: 0, right: 0, height: 28, flexDirection: 'row' },
  waveL:     { flex: 1, height: 28, backgroundColor: C.cream, borderTopRightRadius: 40 },
  waveR:     { flex: 1, height: 28, backgroundColor: C.cream, borderTopLeftRadius: 40 },
  logoRing:  { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoTxt:   { fontFamily: 'Nunito-Bold', fontSize: 22, color: '#fff' },
  appName:   { fontFamily: 'Nunito-Bold', fontSize: 24, color: '#fff', letterSpacing: -0.3, marginBottom: 6 },
  appSub:    { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  form:      { padding: 20, paddingTop: 24 },
  field:     { marginBottom: 16 },
  label:     { fontFamily: 'Nunito-Bold', fontSize: 9, color: C.light, letterSpacing: 0.8, marginBottom: 6 },
  input:     { backgroundColor: C.sageLl, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Nunito-Regular', color: C.dark },
  inputErr:  { borderColor: C.red },
  err:       { fontFamily: 'Nunito-Regular', fontSize: 11, color: C.red, marginTop: 4 },
  btn:       { backgroundColor: C.sage, borderTopLeftRadius: 14, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  btnTxt:    { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#fff' },
  regLink:   { alignItems: 'center', marginTop: 20 },
  regTxt:    { fontFamily: 'Nunito-Regular', fontSize: 13, color: C.mid },
  regBold:   { fontFamily: 'Nunito-Bold', color: C.sage },
  footer:    { fontFamily: 'Nunito-Regular', fontSize: 10, color: C.light, textAlign: 'center', marginTop: 8, marginBottom: 32 },
})
