import React, { useState } from 'react'
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Alert
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store'
import Toast from '../../components/Toast'
import { useToast } from '../../hooks/useToast'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen({ navigation }: any) {
  const [showEmail, setShowEmail]   = useState(false)
  const [email,    setEmail]        = useState('')
  const [password, setPassword]     = useState('')
  const [loading,  setLoading]      = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null)
  const { setUser, setSession } = useAuthStore()
  const { toast, showToast, hideToast } = useToast()
  const insets = useSafeAreaInsets()
  const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'trabajomasfacil' })

  const navigateByRole = (role: string) => {
    if (role === 'instructor')    navigation.replace('InstructorTabs')
    else if (role === 'estudio')  navigation.replace('EstudioHome')
    else if (role === 'camara_admin') navigation.replace('CamaraTabs')
    else if (role === 'super_admin')  navigation.replace('AdminTabs')
    else navigation.replace('SelectRole')
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setSocialLoading(provider)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data.url) throw new Error('No se obtuvo URL de autenticación')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
      if (result.type !== 'success') return

      const params = new URLSearchParams(new URL(result.url).hash.slice(1))
      const accessToken  = params.get('access_token')
      const refreshToken = params.get('refresh_token') ?? ''
      if (!accessToken) throw new Error('No se pudo completar el login')

      const { data: sd, error: se } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      if (se) throw se
      setSession(sd.session)

      const { data: profile } = await supabase.from('users').select('*').eq('id', sd.user!.id).maybeSingle()
      if (profile?.role) { setUser(profile); navigateByRole(profile.role) }
      else navigation.replace('SelectRole')
    } catch (e: any) {
      showToast(e.message ?? 'Error al conectar con ' + provider)
    } finally {
      setSocialLoading(null)
    }
  }

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) { showToast('Completá email y contraseña'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error) throw error
      const { data: profile } = await supabase.from('users').select('*').eq('id', data.user.id).single()
      if (profile) { setSession(data.session); setUser(profile); navigateByRole(profile.role) }
      else navigation.replace('SelectRole')
    } catch (e: any) {
      showToast(e.message?.includes('Invalid') ? 'Email o contraseña incorrectos' : e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Blobs decorativos */}
      <View style={s.blob1} />
      <View style={s.blob2} />
      <View style={s.blob3} />

      {/* Logo centrado */}
      <View style={s.logoWrap}>
        <Image
          source={require('../../../assets/logo-white.png')}
          style={s.logo}
          resizeMode="contain"
        />
      </View>

      {/* Tagline */}
      <View style={s.taglineWrap}>
        <Text style={s.tagline}>La comunidad de Pilates</Text>
        <Text style={s.taglineBold}>de Buenos Aires</Text>
      </View>

      {/* Botones sociales */}
      <View style={s.buttons}>
        <TouchableOpacity
          style={s.googleBtn}
          onPress={() => handleOAuth('google')}
          disabled={!!socialLoading}
          activeOpacity={0.88}
        >
          {socialLoading === 'google' ? (
            <ActivityIndicator size="small" color="#1A1A1A" />
          ) : (
            <>
              <View style={s.gIcon}>
                <Text style={s.gLetter}>G</Text>
              </View>
              <Text style={s.googleTxt}>Continuar con Google</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.appleBtn}
          onPress={() => handleOAuth('apple')}
          disabled={!!socialLoading}
          activeOpacity={0.88}
        >
          {socialLoading === 'apple' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={s.appleIcon}></Text>
              <Text style={s.appleTxt}>Continuar con Apple</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.emailLink} onPress={() => setShowEmail(true)}>
          <Text style={s.emailLinkTxt}>Iniciar sesión con email →</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.registerLink} onPress={() => navigation.navigate('RegisterRole')}>
          <Text style={s.registerTxt}>¿No tenés cuenta? <Text style={s.registerBold}>Registrate</Text></Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <Text style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        Con el aval de la Cámara de Pilates de la Ciudad Autónoma de Buenos Aires
      </Text>

      {/* Modal email */}
      <Modal visible={showEmail} transparent animationType="slide" onRequestClose={() => setShowEmail(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Iniciar sesión</Text>
            <Text style={s.modalSub}>con tu email y contraseña</Text>

            <Text style={s.fieldLabel}>EMAIL</Text>
            <TextInput
              style={s.fieldInput}
              value={email} onChangeText={setEmail}
              placeholder="hola@mipilates.com"
              placeholderTextColor="#9A9A9A"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={s.fieldLabel}>CONTRASEÑA</Text>
            <TextInput
              style={s.fieldInput}
              value={password} onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9A9A9A"
              secureTextEntry
            />

            <TouchableOpacity
              style={[s.loginBtn, loading && { opacity: 0.7 }]}
              onPress={handleEmailLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnTxt}>Iniciar sesión</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowEmail(false)}>
              <Text style={s.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  )
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#1E2E22', alignItems: 'center', justifyContent: 'space-between' },

  // Blobs decorativos
  blob1:        { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,208,96,0.06)', top: -80, right: -80 },
  blob2:        { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(74,93,78,0.4)', bottom: 100, left: -60 },
  blob3:        { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.03)', top: '40%', right: -40 },

  // Logo
  logoWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  logo:         { width: 260, height: 200 },

  // Tagline
  taglineWrap:  { alignItems: 'center', marginBottom: 40 },
  tagline:      { fontFamily: 'Nunito-Regular', fontSize: 14, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.3 },
  taglineBold:  { fontFamily: 'Nunito-Bold', fontSize: 14, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 },

  // Botones
  buttons:      { width: '100%', paddingHorizontal: 28, gap: 12, marginBottom: 8 },

  googleBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  gIcon:        { width: 22, height: 22, borderRadius: 11, backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center' },
  gLetter:      { fontFamily: 'Nunito-Bold', fontSize: 13, color: '#fff' },
  googleTxt:    { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#1A1A1A' },

  appleBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  appleIcon:    { fontFamily: 'Nunito-Bold', fontSize: 18, color: '#fff' },
  appleTxt:     { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#fff' },

  emailLink:    { alignItems: 'center', paddingVertical: 4 },
  emailLinkTxt: { fontFamily: 'Nunito-SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.45)', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.25)', paddingBottom: 2 },

  registerLink: { alignItems: 'center', paddingVertical: 4 },
  registerTxt:  { fontFamily: 'Nunito-Regular', fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  registerBold: { fontFamily: 'Nunito-Bold', color: '#FFD060' },

  footer:       { fontFamily: 'Nunito-Regular', fontSize: 9, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingHorizontal: 40, letterSpacing: 0.3 },

  // Modal email
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: '#F9F9F6', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40 },
  modalTitle:   { fontFamily: 'Nunito-Bold', fontSize: 22, color: '#1A1A1A', marginBottom: 2 },
  modalSub:     { fontFamily: 'Nunito-Regular', fontSize: 13, color: '#5C5C5C', marginBottom: 20 },
  fieldLabel:   { fontFamily: 'Nunito-Bold', fontSize: 9, color: '#9A9A9A', letterSpacing: 0.8, marginBottom: 5 },
  fieldInput:   { backgroundColor: '#F2F5F2', borderRadius: 12, borderWidth: 0.5, borderColor: '#D8E2D8', paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, fontFamily: 'Nunito-Regular', color: '#1A1A1A', marginBottom: 14 },
  loginBtn:     { backgroundColor: '#4A5D4E', borderRadius: 999, padding: 16, alignItems: 'center', marginTop: 4 },
  loginBtnTxt:  { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#fff' },
  cancelBtn:    { alignItems: 'center', padding: 14 },
  cancelTxt:    { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: '#9A9A9A' },
})
