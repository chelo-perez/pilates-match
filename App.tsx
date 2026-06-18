import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'

SplashScreen.preventAutoHideAsync()

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

function LoginScreen({ navigation }: any) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 28, color: '#4A5D4E', marginBottom: 8 }}>PilatesMatch</Text>
      <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 14, color: '#9A9A9A', marginBottom: 40 }}>La comunidad de Pilates de Buenos Aires</Text>
      <TouchableOpacity
        onPress={() => navigation.replace('Main')}
        style={{ backgroundColor: '#4A5D4E', borderRadius: 12, padding: 16, width: '100%', alignItems: 'center' }}
      >
        <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 16, color: '#fff' }}>Iniciar sesión</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

function HomeTab() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 22, color: '#4A5D4E' }}>Inicio ✓</Text>
      <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 13, color: '#9A9A9A', marginTop: 6 }}>Navigation funcionando</Text>
    </SafeAreaView>
  )
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#4A5D4E',
      tabBarInactiveTintColor: '#9A9A9A',
      tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E2E2DE' },
      tabBarLabelStyle: { fontFamily: 'Nunito-SemiBold', fontSize: 10 }
    }}>
      <Tab.Screen name="Inicio" component={HomeTab} />
    </Tab.Navigator>
  )
}

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

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#4A5D4E" size="large" />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Main" component={MainTabs} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
