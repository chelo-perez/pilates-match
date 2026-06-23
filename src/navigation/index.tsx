// src/navigation/index.tsx
import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Feather } from '@expo/vector-icons'
import { useAuthStore } from '../store'
import { supabase } from '../lib/supabase'

import LoginScreen from '../screens/auth/LoginScreen'
import RegisterRoleScreen from '../screens/auth/RegisterRoleScreen'
import RegisterInstructorScreen from '../screens/auth/RegisterInstructorScreen'
import RegisterStudioScreen from '../screens/auth/RegisterStudioScreen'

import InstructorDashboardScreen from '../screens/instructor/DashboardScreen'
import InstructorMatchesScreen from '../screens/instructor/MatchesScreen'
import InstructorAvailabilityScreen from '../screens/instructor/AvailabilityScreen'
import InstructorProfileEditScreen from '../screens/instructor/ProfileEditScreen'
import InstructorRatesScreen from '../screens/instructor/RatesScreen'
import EvaluateStudioScreen from '../screens/instructor/EvaluateStudioScreen'

import StudioHomeScreen from '../screens/studio/HomeScreen'
import SearchScreen from '../screens/studio/SearchScreen'
import InstructorProfileScreen from '../screens/studio/InstructorProfileScreen'
import RequestMatchScreen from '../screens/studio/RequestMatchScreen'
import EvaluateInstructorScreen from '../screens/studio/EvaluateInstructorScreen'
import StudioHistoryScreen from '../screens/studio/HistoryScreen'
import MembershipPaywallScreen from '../screens/studio/MembershipPaywallScreen'
import PendingEvaluationsScreen from '../screens/studio/PendingEvaluationsScreen'

import CamaraDashboardScreen from '../screens/camara/DashboardScreen'
import CamaraDirectoryScreen from '../screens/camara/DirectoryScreen'
import CamaraStudiosScreen from '../screens/camara/StudiosScreen'
import CamaraRateRangesScreen from '../screens/camara/RateRangesScreen'
import VerifyInstructorScreen from '../screens/camara/VerifyInstructorScreen'
import CamaraReportsScreen from '../screens/camara/ReportsScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator<any>()
const noHeader = { headerShown: false }
const SAGE = '#4A5D4E'
const LIGHT = '#9A9A9A'

function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={SAGE} size="large" />
    </View>
  )
}

function useTabStyle() {
  const insets = useSafeAreaInsets()
  return {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E2DE',
    paddingBottom: insets.bottom || 8,
    paddingTop: 8,
    height: 60 + (insets.bottom || 0),
  }
}

const tabOptions = (label: string, icon: string) => ({
  tabBarLabel: label,
  tabBarIcon: ({ color }: any) => <Feather name={icon as any} size={22} color={color} />,
})

const tabScreenOptions = (tabStyle: any) => ({
  headerShown: false,
  tabBarStyle: tabStyle,
  tabBarActiveTintColor: SAGE,
  tabBarInactiveTintColor: LIGHT,
  tabBarLabelStyle: { fontFamily: 'Nunito-SemiBold', fontSize: 10, marginTop: 2 },
})

function signOut(reset: () => void) {
  Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Salir', style: 'destructive', onPress: async () => {
      await supabase.auth.signOut()
      reset()
    }},
  ])
}

// ── INSTRUCTOR TABS ───────────────────────────────────────────
function InstructorTabs() {
  const tabStyle = useTabStyle()
  const { reset } = useAuthStore()
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(tabStyle)}>
      <Tab.Screen name="InstructorInicio" component={InstructorDashboardScreen} options={tabOptions('Inicio', 'home')} />
      <Tab.Screen name="InstructorPropuestas" component={InstructorMatchesScreen} options={tabOptions('Propuestas', 'inbox')} />
      <Tab.Screen name="InstructorHorarios" component={InstructorAvailabilityScreen} options={tabOptions('Horarios', 'calendar')} />
      <Tab.Screen name="InstructorTarifas" component={InstructorRatesScreen} options={tabOptions('Tarifas', 'dollar-sign')} />
      <Tab.Screen name="InstructorPerfil" component={InstructorProfileEditScreen} options={tabOptions('Perfil', 'user')} />
    </Tab.Navigator>
  )
}

// ── STUDIO TABS ───────────────────────────────────────────────
function StudioTabs() {
  const tabStyle = useTabStyle()
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(tabStyle)}>
      <Tab.Screen name="EstudioHome" component={StudioHomeScreen} options={tabOptions('Inicio', 'home')} />
      <Tab.Screen name="Search" component={SearchScreen} options={tabOptions('Buscar', 'search')} />
      <Tab.Screen name="HistoryList" component={StudioHistoryScreen} options={tabOptions('Historial', 'clock')} />
      <Tab.Screen name="PendingEvaluations" component={PendingEvaluationsScreen} options={tabOptions('Evaluar', 'star')} />
    </Tab.Navigator>
  )
}

// ── CAMARA TABS ───────────────────────────────────────────────
function CamaraTabs() {
  const tabStyle = useTabStyle()
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(tabStyle)}>
      <Tab.Screen name="CamaraTabs" component={CamaraDashboardScreen} options={tabOptions('Inicio', 'home')} />
      <Tab.Screen name="Directorio" component={CamaraDirectoryScreen} options={tabOptions('Directorio', 'users')} />
      <Tab.Screen name="Estudios" component={CamaraStudiosScreen} options={tabOptions('Estudios', 'briefcase')} />
      <Tab.Screen name="Tarifas" component={CamaraRateRangesScreen} options={tabOptions('Tarifas', 'dollar-sign')} />
      <Tab.Screen name="Reportes" component={CamaraReportsScreen} options={tabOptions('Reportes', 'bar-chart-2')} />
    </Tab.Navigator>
  )
}

// ── ADMIN ─────────────────────────────────────────────────────
function AdminHome() {
  const { reset } = useAuthStore()
  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 22, color: SAGE }}>Panel Admin</Text>
      <TouchableOpacity
        onPress={() => signOut(reset)}
        style={{ backgroundColor: SAGE, borderRadius: 10, padding: 12, paddingHorizontal: 24 }}
      >
        <Text style={{ fontFamily: 'Nunito-Bold', color: '#fff' }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── ROOT NAVIGATOR ────────────────────────────────────────────
export default function RootNavigator() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <Loading />

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={noHeader}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="RegisterRole" component={RegisterRoleScreen} />
            <Stack.Screen name="RegisterInstructor" component={RegisterInstructorScreen} />
            <Stack.Screen name="RegisterStudio" component={RegisterStudioScreen} />
          </>
        ) : user.role === 'instructor' ? (
          <>
            <Stack.Screen name="InstructorTabs" component={InstructorTabs} />
            <Stack.Screen name="EvaluateStudio" component={EvaluateStudioScreen} />
          </>
        ) : user.role === 'estudio' ? (
          <>
            <Stack.Screen name="EstudioHome" component={StudioTabs} />
            <Stack.Screen name="InstructorProfile" component={InstructorProfileScreen} />
            <Stack.Screen name="RequestMatch" component={RequestMatchScreen} />
            <Stack.Screen name="EvaluateInstructor" component={EvaluateInstructorScreen} />
            <Stack.Screen name="MembershipPaywall" component={MembershipPaywallScreen} />
          </>
        ) : user.role === 'camara_admin' ? (
          <>
            <Stack.Screen name="CamaraTabs" component={CamaraTabs} />
            <Stack.Screen name="VerifyInstructor" component={VerifyInstructorScreen} />
          </>
        ) : user.role === 'super_admin' ? (
          <Stack.Screen name="AdminTabs" component={AdminHome} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
