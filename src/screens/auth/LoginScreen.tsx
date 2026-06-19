import React, { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const { setUser, setSession } = useAuthStore()

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
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) throw error

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (profileError) throw profileError

      setSession(authData.session)
      setUser(profile)

      const role = profile.role
      if (role === 'instructor') navigation.replace('InstructorTabs')
      else if (role === 'studio' || role === 'estudio') navigation.replace('EstudioHome')
      else if (role === 'camara_admin') navigation.replace('CamaraTabs')
      else if (role === 'super_admin') navigation.replace('AdminTabs')

    } catch (err: any) {
      Alert.alert('Error al iniciar sesión', err.message || 'Verificá tu email y contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#F9F9F6' }}
    >
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Text style={s.logoText}>TF</Text>
          </View>
          <Text style={s.appName}>Trabajo Más Fácil</Text>
          <Text style={s.appSub}>La comunidad de Pilates de Buenos Aires</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          {/* Email */}
          <View style={s.field}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput
              style={[s.input, errors.email ? s.inputError : null]}
              value={email}
              onChangeText={setEmail}
              placeholder="hola@mipilates.com"
              placeholderTextColor="#9A9A9A"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.email ? <Text style={s.error}>{errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View style={s.field}>
            <Text style={s.label}>CONTRASEÑA</Text>
            <TextInput
              style={[s.input, errors.password ? s.inputError : null]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9A9A9A"
              secureTextEntry
            />
            {errors.password ? <Text style={s.error}>{errors.password}</Text> : null}
          </View>

          {/* Botón */}
          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnTxt}>Iniciar sesión</Text>
            }
          </TouchableOpacity>

          {/* Registro */}
          <TouchableOpacity
            style={s.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={s.registerTxt}>
              ¿No tenés cuenta?{' '}
              <Text style={s.registerBold}>Registrate</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>Avalado por la Cámara de Pilates de Buenos Aires</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const C = { sage: '#4A5D4E', sageLl: '#F2F5F2', cream: '#F9F9F6', dark: '#1A1A1A', mid: '#5C5C5C', light: '#9A9A9A', border: '#E2E2DE', red: '#C0392B' }

const s = StyleSheet.create({
  container:    { flexGrow: 1, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoWrap:     { alignItems: 'center', marginBottom: 32 },
  logoCircle:   { width: 72, height: 72, borderRadius: 36, backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoText:     { fontSize: 24, fontFamily: 'Nunito-Bold', color: '#fff' },
  appName:      { fontSize: 26, fontFamily: 'Nunito-Bold', color: C.dark, marginBottom: 6 },
  appSub:       { fontSize: 13, fontFamily: 'Nunito-Regular', color: C.light, textAlign: 'center' },
  card:         { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  field:        { marginBottom: 16 },
  label:        { fontSize: 10, fontFamily: 'Nunito-Bold', color: C.light, letterSpacing: 0.8, marginBottom: 6 },
  input:        { backgroundColor: C.sageLl, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Nunito-Regular', color: C.dark },
  inputError:   { borderColor: C.red },
  error:        { fontSize: 11, fontFamily: 'Nunito-Regular', color: C.red, marginTop: 4 },
  btn:          { backgroundColor: C.sage, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled:  { opacity: 0.7 },
  btnTxt:       { fontSize: 15, fontFamily: 'Nunito-Bold', color: '#fff' },
  registerLink: { alignItems: 'center', marginTop: 16 },
  registerTxt:  { fontSize: 13, fontFamily: 'Nunito-Regular', color: C.mid },
  registerBold: { fontFamily: 'Nunito-Bold', color: C.sage },
  footer:       { fontSize: 11, fontFamily: 'Nunito-Regular', color: C.light, textAlign: 'center', marginTop: 24 },
})
