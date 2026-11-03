import React, { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import RootNavigator from './src/navigation'
import AnimatedSplash from './src/screens/auth/SplashScreen'
import { supabase } from './src/lib/supabase'
import { useAuthStore, useStudioStore, useSearchStore } from './src/store'
import { registerPushToken } from './src/lib/push'

SplashScreen.preventAutoHideAsync()
const queryClient = new QueryClient()

// Al cambiar de usuario hay que borrar todo lo que quedó en memoria del anterior:
// si no, la app muestra datos del usuario previo (p. ej. su estudio) hasta 5 min.
let lastUserId: string | null | undefined
function onUserChanged(userId: string | null) {
  if (lastUserId !== undefined && lastUserId !== userId) {
    queryClient.clear()
    useStudioStore.getState().setStudio(null)
    useStudioStore.getState().setStats(null)
    useSearchStore.getState().clearFilters()
    useSearchStore.getState().setResults([])
  }
  lastUserId = userId
}

export default function App() {
  const [showSplash, setShowSplash] = React.useState(true)
  const { setUser, setSession, setLoading } = useAuthStore()
  const [fontsLoaded] = useFonts({
    'Nunito-Regular':  require('./assets/fonts/Nunito-Regular.ttf'),
    'Nunito-Medium':   require('./assets/fonts/Nunito-Medium.ttf'),
    'Nunito-SemiBold': require('./assets/fonts/Nunito-SemiBold.ttf'),
    'Nunito-Bold':     require('./assets/fonts/Nunito-Bold.ttf'),
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
    const t = setTimeout(() => SplashScreen.hideAsync(), 3000)
    return () => clearTimeout(t)
  }, [fontsLoaded])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      onUserChanged(session?.user?.id ?? null)
      setSession(session)
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users').select('*').eq('id', session.user.id).single()
        setUser(profile)
        registerPushToken(session.user.id).catch(console.error)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    // Ojo: este callback NO puede esperar (await) otras llamadas a Supabase.
    // Si lo hace, la librería se traba al renovar la sesión y ninguna consulta
    // posterior responde (la app queda en "Cargando..."). Por eso el trabajo
    // se difiere con setTimeout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        onUserChanged(session?.user?.id ?? null)
        setSession(session)
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
        }
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          const userId = session.user.id
          setTimeout(async () => {
            const { data: profile } = await supabase
              .from('users')
              .select('*')
              .eq('id', userId)
              .single()
            if (profile?.role) {
              setUser(profile)
            }
            // else: new user without role — LoginScreen handles SelectRole navigation
            setLoading(false)
            registerPushToken(userId).catch(console.error)
          }, 0)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  if (!fontsLoaded) return (
    <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#4A5D4E" size="large" />
    </View>
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootNavigator />
        {showSplash && (
          <AnimatedSplash onFinish={() => setShowSplash(false)} />
        )}
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
