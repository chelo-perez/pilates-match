import React, { useEffect, useCallback } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'

SplashScreen.preventAutoHideAsync()

export default function App() {
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

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Text style={styles.title}>PilatesMatch</Text>
        <Text style={styles.sub}>App funcionando ✓</Text>
      </View>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Nunito-Bold', fontSize: 28, color: '#4A5D4E', marginBottom: 8 },
  sub:   { fontFamily: 'Nunito-Regular', fontSize: 14, color: '#9A9A9A' },
})
