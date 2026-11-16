import React, { useEffect } from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import RootNavigator from './src/navigation'
import AnimatedSplash from './src/screens/auth/SplashScreen'
import { queryClient } from './src/lib/queryClient'
import { subscribeAuth, subscribeDeepLinks } from './src/lib/auth'
import { brandFontFiles, ensureLocalMark } from './src/lib/brand'
import { useAuthStore } from './src/store'
import './src/lib/webAlert' // confirmaciones visibles en la web

SplashScreen.preventAutoHideAsync()

export default function App() {
  const [showSplash, setShowSplash] = React.useState(true)
  // Tipografías de la red (o Nunito): ver src/lib/brand.ts
  const [fontsLoaded] = useFonts(brandFontFiles())
  // El inicio animado se va cuando la app ya sabe a qué pantalla ir (sin pantalla de carga en el medio)
  const authReady = !useAuthStore(s => s.isLoading)
  useEffect(() => { ensureLocalMark() }, [])

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
    const t = setTimeout(() => SplashScreen.hideAsync(), 3000)
    return () => clearTimeout(t)
  }, [fontsLoaded])

  // Sesión → perfil → navegación. El listener emite INITIAL_SESSION al
  // suscribirse, así que no hace falta llamar a getSession aparte.
  useEffect(() => subscribeAuth(), [])
  // Links entrantes: mail de "olvidé mi contraseña"
  useEffect(() => subscribeDeepLinks(), [])

  // Mientras cargan las tipografías sigue la pantalla de inicio fija: mismo color, sin parpadeo
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#163235' }} />

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootNavigator />
        {showSplash && (
          <AnimatedSplash ready={authReady} onFinish={() => setShowSplash(false)} />
        )}
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
