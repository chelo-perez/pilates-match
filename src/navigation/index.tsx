// src/navigation/index.tsx — navegación completa con bottom tabs
import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Feather } from '@expo/vector-icons'
import { useAuthStore } from '../store'
import { supabase } from '../lib/supabase'

// Auth
import LoginScreen from '../screens/auth/LoginScreen'
import RegisterRoleScreen from '../screens/auth/RegisterRoleScreen'
import RegisterInstructorScreen from '../screens/auth/RegisterInstructorScreen'
import RegisterStudioScreen from '../screens/auth/RegisterStudioScreen'

// Instructor
import InstructorDashboardScreen from '../screens/instructor/DashboardScreen'
import InstructorMatchesScreen from '../screens/instructor/MatchesScreen'
import InstructorAvailabilityScreen from '../screens/instructor/AvailabilityScreen'
import InstructorProfileEditScreen from '../screens/instructor/ProfileEditScreen'
import InstructorRatesScreen from '../screens/instructor/RatesScreen'
import EvaluateStudioScreen from '../screens/instructor/EvaluateStudioScreen'

// Studio
import StudioHomeScreen from '../screens/studio/HomeScreen'
import SearchScreen from '../screens/studio/SearchScreen'
import InstructorProfileScreen from '../screens/studio/InstructorProfileScreen'
import RequestMatchScreen from '../screens/studio/RequestMatchScreen'
import EvaluateInstructorScreen from '../screens/studio/EvaluateInstructorScreen'
import StudioHistoryScreen from '../screens/studio/HistoryScreen'
import MembershipPaywallScreen from '../screens/studio/MembershipPaywallScreen'
import PendingEvaluationsScreen from '../screens/studio/PendingEvaluationsScreen'

// Camara
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

const tabBarStyle = {
  backgroundColor: '#FFFFFF',
  borderTopWidth: 1,
  borderTopColor: '#E2E2DE',
  paddingBottom: 16,
  paddingTop: 8,
  height: 80,
}

function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={SAGE} size="large" />
    </View>
  )
}

// ── INSTRUCTOR TABS ───────────────────────────────────────────
function InstructorTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle, tabBarActiveTintColor: SAGE,
      tabBarActiveBackgroundColor: '#F2F5F2', tabBarInactiveTintColor: LIGHT, tabBarLabelStyle: { fontFamily: 'Nunito-Bold', fontSize: 10 } }}>
      <Tab.Screen name="InstructorInicio" component={InstructorDashboardScreen} options={{ tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} /> }} />
      <Tab.Screen name="InstructorPropuestas" component={InstructorMatchesScreen} options={{ tabBarIcon: ({ color }) => <Feather name="inbox" size={22} color={color} /> }} />
      <Tab.Screen name="InstructorDisponibilidad" component={InstructorAvailabilityScreen} options={{ tabBarIcon: ({ color }) => <Feather name="calendar" size={22} color={color} /> }} />
      <Tab.Screen name="InstructorTarifas" component={InstructorRatesScreen} options={{ tabBarIcon: ({ color }) => <Feather name="dollar-sign" size={22} color={color} /> }} />
      <Tab.Screen name="InstructorPerfil" component={InstructorProfileEditScreen} options={{ tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tab.Navigator>
  )
}

// ── STUDIO TABS ───────────────────────────────────────────────
function StudioTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle, tabBarActiveTintColor: SAGE,
      tabBarActiveBackgroundColor: '#F2F5F2', tabBarInactiveTintColor: LIGHT, tabBarLabelStyle: { fontFamily: 'Nunito-Bold', fontSize: 10 } }}>
      <Tab.Screen name="EstudioHome" component={StudioHomeScreen} options={{ tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} /> }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarIcon: ({ color }) => <Feather name="search" size={22} color={color} /> }} />
      <Tab.Screen name="HistoryList" component={StudioHistoryScreen} options={{ tabBarIcon: ({ color }) => <Feather name="clock" size={22} color={color} /> }} />
      <Tab.Screen name="PendingEvaluations" component={PendingEvaluationsScreen} options={{ tabBarIcon: ({ color }) => <Feather name="star" size={22} color={color} /> }} />
    </Tab.Navigator>
  )
}

// ── CAMARA TABS ───────────────────────────────────────────────
function CamaraTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle, tabBarActiveTintColor: SAGE,
      tabBarActiveBackgroundColor: '#F2F5F2', tabBarInactiveTintColor: LIGHT, tabBarLabelStyle: { fontFamily: 'Nunito-Bold', fontSize: 10 } }}>
      <Tab.Screen name="CamaraTabs" component={CamaraDashboardScreen} options={{ tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} /> }} />
      <Tab.Screen name="Directorio" component={CamaraDirectoryScreen} options={{ tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} /> }} />
      <Tab.Screen name="Estudios" component={CamaraStudiosScreen} options={{ tabBarIcon: ({ color }) => <Feather name="briefcase" size={22} color={color} /> }} />
      <Tab.Screen name="Tarifas" component={CamaraRateRangesScreen} options={{ tabBarIcon: ({ color }) => <Feather name="dollar-sign" size={22} color={color} /> }} />
      <Tab.Screen name="Reportes" component={CamaraReportsScreen} options={{ tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={22} color={color} /> }} />
    </Tab.Navigator>
  )
}

// ── ADMIN ─────────────────────────────────────────────────────
function AdminHome() {
  const { reset } = useAuthStore()
  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 22, color: SAGE }}>Panel Admin ✓</Text>
      <TouchableOpacity
        onPress={async () => { await supabase.auth.signOut(); reset() }}
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
          // Auth
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="RegisterRole" component={RegisterRoleScreen} />
            <Stack.Screen name="RegisterInstructor" component={RegisterInstructorScreen} />
            <Stack.Screen name="RegisterStudio" component={RegisterStudioScreen} />
          </>
        ) : user.role === 'instructor' ? (
          // Instructor — tabs + pantallas extra en stack
          <>
            <Stack.Screen name="InstructorTabs" component={InstructorTabs} />
            <Stack.Screen name="EvaluateStudio" component={EvaluateStudioScreen} />
          </>
        ) : user.role === 'estudio' ? (
          // Studio — tabs + pantallas extra en stack
          <>
            <Stack.Screen name="EstudioHome" component={StudioTabs} />
            <Stack.Screen name="InstructorProfile" component={InstructorProfileScreen} />
            <Stack.Screen name="RequestMatch" component={RequestMatchScreen} />
            <Stack.Screen name="EvaluateInstructor" component={EvaluateInstructorScreen} />
            <Stack.Screen name="MembershipPaywall" component={MembershipPaywallScreen} />
          </>
        ) : user.role === 'camara_admin' ? (
          // Camara — tabs + pantallas extra en stack
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
