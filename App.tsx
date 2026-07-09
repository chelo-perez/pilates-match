import React, { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import RootNavigator from './src/navigation'
import AnimatedSplash from './src/screens/auth/SplashScreen'
import { supabase } from './src/lib/supabase'
import { useAuthStore } from './src/store'
import { registerPushToken } from './src/lib/push'

SplashScreen.preventAutoHideAsync()
const queryClient = new QueryClient()

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
        }
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          // Load user profile from DB
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()
          if (profile?.role) {
            setUser(profile)
          }
          // else: new user without role — LoginScreen handles SelectRole navigation
          setLoading(false)
          registerPushToken(session.user.id).catch(console.error)
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
