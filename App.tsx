import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'

SplashScreen.preventAutoHideAsync()

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 28, color: '#4A5D4E', marginBottom: 8 }}>PilatesMatch</Text>
      <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 14, color: '#9A9A9A', marginBottom: 40 }}>La comunidad de Pilates de Buenos Aires</Text>
      <TouchableOpacity onPress={onLogin} style={{ backgroundColor: '#4A5D4E', borderRadius: 12, padding: 16, width: '100%', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 16, color: '#fff' }}>Iniciar sesión</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 24, color: '#4A5D4E' }}>Bienvenido ✓</Text>
      <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 14, color: '#9A9A9A', marginTop: 8 }}>Sin react-navigation</Text>
    </SafeAreaView>
  )
}

export default function App() {
  const [screen, setScreen] = useState('login')
  const [fontsLoaded] = useFonts({
    'Nunito-Regular': require('./assets/fonts/Nunito-Regular.ttf'),
    'Nunito-Bold':    require('./assets/fonts/Nunito-Bold.ttf'),
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
    const t = setTimeout(() => SplashScreen.hideAsync(), 3000)
    return () => clearTimeout(t)
  }, [fontsLoaded])

  return (
    <SafeAreaProvider>
      {screen === 'login'
        ? <LoginScreen onLogin={() => setScreen('home')} />
        : <HomeScreen />
      }
    </SafeAreaProvider>
  )
}
