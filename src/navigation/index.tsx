// src/navigation/index.tsx — versión simplificada sin bottom tabs nativos
import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View, Text, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../store'

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen'

// Placeholder screens para cada rol
function InstructorHome() {
  return <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'Nunito-Bold', fontSize: 22, color: '#4A5D4E' }}>Dashboard Instructor ✓</Text></View>
}
function StudioHome() {
  return <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'Nunito-Bold', fontSize: 22, color: '#4A5D4E' }}>Dashboard Estudio ✓</Text></View>
}
function CamaraHome() {
  return <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'Nunito-Bold', fontSize: 22, color: '#4A5D4E' }}>Dashboard Cámara ✓</Text></View>
}
function AdminHome() {
  return <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'Nunito-Bold', fontSize: 22, color: '#4A5D4E' }}>Panel Admin ✓</Text></View>
}
function Loading() {
  return <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#4A5D4E" size="large" /></View>
}

const Stack = createNativeStackNavigator()

export default function RootNavigator() {
  const { user, isLoading } = useAuthStore()

  if (isLoading) return <Loading />

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Sin sesión → Login
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.role === 'instructor' ? (
          <Stack.Screen name="InstructorTabs" component={InstructorHome} />
        ) : user.role === 'studio' ? (
          <Stack.Screen name="StudioTabs" component={StudioHome} />
        ) : user.role === 'camara_admin' ? (
          <Stack.Screen name="CamaraTabs" component={CamaraHome} />
        ) : user.role === 'super_admin' ? (
          <Stack.Screen name="AdminTabs" component={AdminHome} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
