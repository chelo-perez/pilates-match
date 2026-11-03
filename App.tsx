import React, { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import RootNavigator from './src/navigation'
import AnimatedSplash from './src/screens/auth/SplashScreen'
import { queryClient } from './src/lib/queryClient'
import { subscribeAuth, subscribeDeepLinks } from './src/lib/auth'
import { colors } from './src/components/ui'

SplashScreen.preventAutoHideAsync()

export default function App() {
  const [showSplash, setShowSplash] = React.useState(true)
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

  // Sesión → perfil → navegación. El listener emite INITIAL_SESSION al
  // suscribirse, así que no hace falta llamar a getSession aparte.
  useEffect(() => subscribeAuth(), [])
  // Links entrantes: mail de "olvidé mi contraseña"
  useEffect(() => subscribeDeepLinks(), [])

  if (!fontsLoaded) return (
    <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.sage} size="large" />
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
