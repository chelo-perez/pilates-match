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
import { SvgXml } from 'react-native-svg'
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
              <SvgXml xml={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>'} width="20" height="20" />
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
              <SvgXml xml={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 814 1000"><path fill="white" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 420.3 8.4 303.4 8.4 207.4c0-169.2 110.6-258.7 219.4-258.7 75.4 0 138.4 50 185.7 50 45.2 0 116.5-53.3 201.7-53.3zM656.3 0C629.1 26.8 594.2 87 594.2 154.5c0 8.2 1.3 16.5 2.6 21.4 4.5.6 9 1.3 13.5 1.3 63.5 0 117.8-48.8 147.4-100.7 19.5-33.8 35.1-87 35.1-139.5z"/></svg>'} width="18" height="22" />
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
  googleTxt:    { fontFamily: 'Nunito-Bold', fontSize: 15, color: '#1A1A1A' },

  appleBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
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
