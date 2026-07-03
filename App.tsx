import React, { useEffect, Component } from 'react'
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import RootNavigator from './src/navigation'
import { supabase } from './src/lib/supabase'
import { useAuthStore } from './src/store'
import { registerPushToken } from './src/lib/push'

SplashScreen.preventAutoHideAsync()
const queryClient = new QueryClient()

// ── Error Boundary — muestra el error en pantalla en vez de crashear ──
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    const { error } = this.state
    if (error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#1A1A1A', padding: 20, paddingTop: 60 }}>
          <Text style={{ color: '#FF6B6B', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
            ⚠️ Error en la app
          </Text>
          <Text style={{ color: '#FFD0D0', fontSize: 13, marginBottom: 16 }}>
            {(error as any).message}
          </Text>
          <Text style={{ color: '#999', fontSize: 11, fontFamily: 'monospace' }}>
            {(error as any).stack}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ error: null })}
            style={{ marginTop: 24, backgroundColor: '#4A5D4E', padding: 12, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Reintentar</Text>
          </TouchableOpacity>
        </ScrollView>
      )
    }
    return this.props.children
  }
}

export default function App() {
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
        if (event === 'SIGNED_OUT') { setUser(null); setLoading(false) }
        if (event === 'SIGNED_IN' && session?.user) {
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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <RootNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
