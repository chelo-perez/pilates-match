// src/lib/auth.ts
// Sesión, perfil y onboarding. Toda la lógica de "a qué pantalla va el usuario"
// vive acá; RootNavigator solo lee el store.

import { Alert, Linking } from 'react-native'
import * as AuthSession from 'expo-auth-session'
import { supabase } from './supabase'
import { queryClient } from './queryClient'
import { registerPushToken } from './notifications'
import { useAuthStore, useStudioStore, useSearchStore } from '../store'
import type { User } from '../types/database'

// ── Limpieza de datos del usuario anterior ──────────────────
let lastUserId: string | null | undefined
export function onUserChanged(userId: string | null) {
  if (lastUserId !== undefined && lastUserId !== userId) {
    queryClient.clear()
    useStudioStore.getState().setStudio(null)
    useStudioStore.getState().setStats(null)
    useSearchStore.getState().clearFilters()
    useSearchStore.getState().setResults([])
  }
  lastUserId = userId
}

// ── Perfil ──────────────────────────────────────────────────
/**
 * Lee la fila de `users` y decide si falta el onboarding.
 * Ojo: el trigger handle_new_user crea SIEMPRE la fila en users (con rol
 * 'estudio' si el signUp no trajo rol, como pasa con Google/Apple). Por eso
 * el rol no alcanza: hay que ver si existe el estudio o el perfil de instructor.
 */
export async function loadProfile(userId: string): Promise<{ profile: User | null; needsOnboarding: boolean }> {
  const { data: profile, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!profile) return { profile: null, needsOnboarding: true }

  let needsOnboarding = false
  if (profile.role === 'estudio' || profile.role === 'instructor') {
    const table = profile.role === 'estudio' ? 'studios' : 'instructors'
    const { data, error: e2 } = await supabase.from(table).select('id').eq('user_id', userId).maybeSingle()
    if (e2) throw e2
    needsOnboarding = !data
  }
  return { profile: profile as User, needsOnboarding }
}

let pushRegisteredFor: string | null = null

/** Vuelve a leer el perfil y actualiza el store (y con eso, la navegación). */
export async function syncAuthUser(userId: string) {
  const st = useAuthStore.getState()
  try {
    const { profile, needsOnboarding } = await loadProfile(userId)
    st.setUser(profile)
    st.setNeedsOnboarding(needsOnboarding)
    st.setProfileError(false)
    if (profile && pushRegisteredFor !== userId) {
      pushRegisteredFor = userId
      registerPushToken(userId)
    }
  } catch (e) {
    if (__DEV__) console.warn('[auth] no se pudo leer el perfil', e)
    // Si ya teníamos usuario (p. ej. renovación de token sin red) lo mantenemos
    if (!useAuthStore.getState().user) st.setProfileError(true)
  } finally {
    st.setLoading(false)
  }
}

// ── Redirecciones (OAuth y "olvidé mi contraseña") ──────────
/** URL de vuelta a la app. Tiene que estar en Auth → URL Configuration → Redirect URLs de Supabase. */
export function authRedirectUrl(path?: string) {
  return AuthSession.makeRedirectUri({ scheme: 'trabajomasfacil', path })
}

/**
 * Toma la URL con la que vuelve Supabase (tokens en el #hash, o ?code= en PKCE)
 * y abre la sesión. Devuelve true si había credenciales.
 */
export async function handleAuthRedirect(url: string): Promise<boolean> {
  const hashPart = url.includes('#') ? url.slice(url.indexOf('#') + 1) : ''
  const noHash = url.split('#')[0]
  const queryPart = noHash.includes('?') ? noHash.slice(noHash.indexOf('?') + 1) : ''
  const params = new URLSearchParams(hashPart)
  const q = new URLSearchParams(queryPart)
  const errorDesc = params.get('error_description') ?? q.get('error_description')
  if (errorDesc) throw new Error(errorDesc)

  const isRecovery = (params.get('type') ?? q.get('type')) === 'recovery' || url.includes('reset-password')
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token') ?? ''
  const code = q.get('code')

  if (isRecovery) useAuthStore.getState().setPasswordRecovery(true)
  if (accessToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    if (error) throw error
    return true
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    return true
  }
  if (isRecovery) useAuthStore.getState().setPasswordRecovery(false)
  return false
}

/** Escucha links entrantes (mail de "olvidé mi contraseña"). */
export function subscribeDeepLinks() {
  const handle = (url: string | null) => {
    if (!url || !(url.includes('access_token') || url.includes('code=') || url.includes('error_description'))) return
    handleAuthRedirect(url).catch((e) => {
      useAuthStore.getState().setPasswordRecovery(false)
      if (__DEV__) console.warn('[auth] link inválido', e)
      Alert.alert('Link vencido', 'El link ya no es válido. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".')
    })
  }
  Linking.getInitialURL().then(handle).catch(() => {})
  const sub = Linking.addEventListener('url', ({ url }) => handle(url))
  return () => sub.remove()
}

// ── Listener de sesión ──────────────────────────────────────
export function subscribeAuth() {
  // Ojo: este callback NO puede esperar (await) otras llamadas a Supabase.
  // Si lo hace, la librería se traba al renovar la sesión y ninguna consulta
  // posterior responde. Por eso el trabajo se difiere con setTimeout.
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    const st = useAuthStore.getState()
    onUserChanged(session?.user?.id ?? null)
    st.setSession(session)

    if (event === 'PASSWORD_RECOVERY') st.setPasswordRecovery(true)

    if (!session?.user) {
      pushRegisteredFor = null
      st.reset()
      st.setLoading(false)
      return
    }
    // Durante un registro por email la pantalla de registro termina de crear
    // el perfil y después llama a syncAuthUser; si cambiáramos de pantalla
    // ahora, el registro quedaría a medias y sus errores no se verían.
    if (st.registering) return

    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED'
      || (event === 'TOKEN_REFRESHED' && !st.user)) {
      const userId = session.user.id
      // Sin perfil todavía: mostramos "cargando" en vez de una pantalla intermedia
      if (!st.user) st.setLoading(true)
      setTimeout(() => { syncAuthUser(userId) }, 0)
    }
  })
  return () => subscription.unsubscribe()
}

// ── Registro por email ──────────────────────────────────────
// Mientras `registering` es true, el listener no cambia de pantalla: la
// pantalla de registro crea el estudio/instructor y recién después llama a
// finishRegistration(). Si algo falla, la persona sigue en el formulario y
// puede corregir y reintentar (se reutiliza la sesión ya creada).

export type SignUpResult = { userId: string; isCamaraAdmin?: boolean } | { needsConfirmation: true; email: string }

export async function startRegistration(
  email: string, password: string, role: 'estudio' | 'instructor', name: string,
): Promise<SignUpResult> {
  const st = useAuthStore.getState()
  const clean = email.trim().toLowerCase()

  // Reintento: la cuenta ya se creó en un intento anterior
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user && session.user.email?.toLowerCase() === clean) {
    st.setRegistering(true)
    return { userId: session.user.id }
  }

  st.setRegistering(true)
  const { data, error } = await supabase.auth.signUp({
    email: clean,
    password,
    options: { data: { role, full_name: name } },
  })
  if (error) { st.setRegistering(false); throw error }
  if (!data.session || !data.user) {
    // El proyecto pide confirmar el email: no hay sesión todavía
    st.setRegistering(false)
    return { needsConfirmation: true, email: clean }
  }
  // Invitado/a como administrador/a de una Cámara: no crea estudio ni perfil de instructor
  const { data: prof } = await supabase.from('users').select('role').eq('id', data.user.id).maybeSingle()
  if (prof?.role === 'camara_admin') {
    await finishRegistration(data.user.id)
    return { userId: data.user.id, isCamaraAdmin: true }
  }
  return { userId: data.user.id }
}

/** Termina el registro: relee el perfil y RootNavigator pasa a las pantallas del rol. */
export async function finishRegistration(userId: string) {
  useAuthStore.getState().setRegistering(false)
  await syncAuthUser(userId)
}

/** La persona salió del formulario a mitad: si ya hay cuenta, la mandamos al onboarding. */
export function abandonRegistration() {
  const st = useAuthStore.getState()
  if (!st.registering) return
  st.setRegistering(false)
  const uid = st.session?.user?.id
  if (uid) syncAuthUser(uid)
}

// ── Cerrar sesión ───────────────────────────────────────────
export async function signOutNow() {
  // Este celular deja de recibir los avisos de la cuenta que cierra sesión
  const uid = (await supabase.auth.getSession()).data.session?.user.id
  if (uid) await supabase.from('push_tokens').delete().eq('user_id', uid).then(() => {}, () => {})
  const { error } = await supabase.auth.signOut()
  if (error) {
    // Aunque falle en el servidor (sin red), cerramos localmente
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  }
  onUserChanged(null)
  useAuthStore.getState().reset()
}

export function confirmSignOut() {
  Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Salir', style: 'destructive', onPress: () => { signOutNow() } },
  ])
}
