import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'

SplashScreen.preventAutoHideAsync()
const Stack = createStackNavigator()

function LoginScreen({ navigation }: any) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 28, color: '#4A5D4E', marginBottom: 40 }}>Trabajo Más Fácil</Text>
      <TouchableOpacity
        onPress={() => navigation.replace('Home')}
        style={{ backgroundColor: '#4A5D4E', borderRadius: 12, padding: 16, width: '100%', alignItems: 'center' }}
      >
        <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 16, color: '#fff' }}>Entrar</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 22, color: '#4A5D4E' }}>Stack clásico ✓</Text>
    </SafeAreaView>
  )
}

export default function App() {
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
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
