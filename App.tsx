import React, { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { supabase } from './src/lib/supabase'

SplashScreen.preventAutoHideAsync()

export default function App() {
  const [status, setStatus] = useState('Conectando...')
  const [fontsLoaded] = useFonts({
    'Nunito-Regular': require('./assets/fonts/Nunito-Regular.ttf'),
    'Nunito-Bold':    require('./assets/fonts/Nunito-Bold.ttf'),
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
    const t = setTimeout(() => SplashScreen.hideAsync(), 3000)
    return () => clearTimeout(t)
  }, [fontsLoaded])

  useEffect(() => {
    supabase.from('users').select('count').single()
      .then(({ data, error }) => {
        if (error) setStatus('Error: ' + error.message)
        else setStatus('Supabase OK ✓')
      })
  }, [])

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 28, color: '#4A5D4E', marginBottom: 16 }}>Trabajo Más Fácil</Text>
        <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 14, color: '#9A9A9A' }}>{status}</Text>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}