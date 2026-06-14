import React, { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'

import { supabase } from './src/lib/supabase'
import { db } from './src/lib/supabase'
import { useAuthStore } from './src/store'
import RootNavigator from './src/navigation'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2 * 60 * 1000 } },
})

function AppWithAuth() {
  const { setUser, setSession, setLoading } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        try {
          const { data: profile } = await db.users()
            .select('*')
            .eq('id', session.user.id)
            .single()
          setUser(profile)
        } catch {
          setUser(null)
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const { data: profile } = await db.users()
              .select('*')
              .eq('id', session.user.id)
              .single()
            setUser(profile)
          } catch {
            setUser(null)
          }
        }
        if (event === 'SIGNED_OUT') {
          setUser(null)
          queryClient.clear()
        }
        if (event === 'TOKEN_REFRESHED') setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return <RootNavigator />
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Nunito-Regular':  require('./assets/fonts/Nunito-Regular.ttf'),
    'Nunito-Medium':   require('./assets/fonts/Nunito-Medium.ttf'),
    'Nunito-SemiBold': require('./assets/fonts/Nunito-SemiBold.ttf'),
    'Nunito-Bold':     require('./assets/fonts/Nunito-Bold.ttf'),
  })

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync()
    const t = setTimeout(() => SplashScreen.hideAsync(), 4000)
    return () => clearTimeout(t)
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#4A5D4E" size="large" />
      </View>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppWithAuth />
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
