import React, { useEffect } from 'react'
import { View, Text } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'

SplashScreen.preventAutoHideAsync()

export default function App() {
  const [fontsLoaded] = useFonts({
    'Nunito-Regular':  require('./assets/fonts/Nunito-Regular.ttf'),
    'Nunito-Bold':     require('./assets/fonts/Nunito-Bold.ttf'),
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
    const t = setTimeout(() => SplashScreen.hideAsync(), 3000)
    return () => clearTimeout(t)
  }, [fontsLoaded])

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 28, color: '#4A5D4E' }}>PilatesMatch</Text>
        <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 14, color: '#9A9A9A', marginTop: 8 }}>Con SafeArea</Text>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
