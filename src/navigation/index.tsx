// src/navigation/index.tsx — con íconos Lottie animados
import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useAuthStore } from '../store'
import { supabase } from '../lib/supabase'
import LottieTab from '../components/LottieTab'

// Lottie assets
const ICONS = {
  home:     require('../../assets/lottie/tab-home.json'),
  inbox:    require('../../assets/lottie/tab-inbox.json'),
  calendar: require('../../assets/lottie/tab-calendar.json'),
  rates:    require('../../assets/lottie/tab-rates.json'),
  profile:  require('../../assets/lottie/tab-profile.json'),
  search:   require('../../assets/lottie/tab-search.json'),
  history:  require('../../assets/lottie/tab-history.json'),
  star:     require('../../assets/lottie/tab-star.json'),
  users:    require('../../assets/lottie/tab-users.json'),
  reports:  require('../../assets/lottie/tab-reports.json'),
}

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
import StudioDetailScreen from '../screens/camara/StudioDetailScreen'
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
    height: 64 + (insets.bottom || 0),
  }
}

function lottieIcon(source: any) {
  return ({ focused }: { focused: boolean }) => (
    <LottieTab source={source} focused={focused} size={26} />
  )
}

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

// ── INSTRUCTOR TABS ──────────────────────────────────────────
function InstructorTabs() {
  const tabStyle = useTabStyle()
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(tabStyle)}>
      <Tab.Screen name="InstructorInicio" component={InstructorDashboardScreen}
        options={{ tabBarLabel: 'Inicio', tabBarIcon: lottieIcon(ICONS.home) }} />
      <Tab.Screen name="InstructorPropuestas" component={InstructorMatchesScreen}
        options={{ tabBarLabel: 'Propuestas', tabBarIcon: lottieIcon(ICONS.inbox) }} />
      <Tab.Screen name="InstructorHorarios" component={InstructorAvailabilityScreen}
        options={{ tabBarLabel: 'Horarios', tabBarIcon: lottieIcon(ICONS.calendar) }} />
      <Tab.Screen name="InstructorTarifas" component={InstructorRatesScreen}
        options={{ tabBarLabel: 'Tarifas', tabBarIcon: lottieIcon(ICONS.rates) }} />
      <Tab.Screen name="InstructorPerfil" component={InstructorProfileEditScreen}
        options={{ tabBarLabel: 'Perfil', tabBarIcon: lottieIcon(ICONS.profile) }} />
    </Tab.Navigator>
  )
}

// ── STUDIO TABS ───────────────────────────────────────────────
function StudioTabs() {
  const tabStyle = useTabStyle()
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(tabStyle)}>
      <Tab.Screen name="EstudioHome" component={StudioHomeScreen}
        options={{ tabBarLabel: 'Inicio', tabBarIcon: lottieIcon(ICONS.home) }} />
      <Tab.Screen name="Search" component={SearchScreen}
        options={{ tabBarLabel: 'Buscar', tabBarIcon: lottieIcon(ICONS.search) }} />
      <Tab.Screen name="HistoryList" component={StudioHistoryScreen}
        options={{ tabBarLabel: 'Historial', tabBarIcon: lottieIcon(ICONS.history) }} />
      <Tab.Screen name="PendingEvaluations" component={PendingEvaluationsScreen}
        options={{ tabBarLabel: 'Evaluar', tabBarIcon: lottieIcon(ICONS.star) }} />
    </Tab.Navigator>
  )
}

// ── CAMARA TABS ───────────────────────────────────────────────
function CamaraTabs() {
  const tabStyle = useTabStyle()
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(tabStyle)}>
      <Tab.Screen name="CamaraTabs" component={CamaraDashboardScreen}
        options={{ tabBarLabel: 'Inicio', tabBarIcon: lottieIcon(ICONS.home) }} />
      <Tab.Screen name="Directorio" component={CamaraDirectoryScreen}
        options={{ tabBarLabel: 'Directorio', tabBarIcon: lottieIcon(ICONS.users) }} />
      <Tab.Screen name="Estudios" component={CamaraStudiosScreen}
        options={{ tabBarLabel: 'Estudios', tabBarIcon: lottieIcon(ICONS.history) }} />
      <Tab.Screen name="Tarifas" component={CamaraRateRangesScreen}
        options={{ tabBarLabel: 'Tarifas', tabBarIcon: lottieIcon(ICONS.rates) }} />
      <Tab.Screen name="Reportes" component={CamaraReportsScreen}
        options={{ tabBarLabel: 'Reportes', tabBarIcon: lottieIcon(ICONS.reports) }} />
    </Tab.Navigator>
  )
}

// ── ADMIN ──────────────────────────────────────────────────────
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

// ── ROOT NAVIGATOR ─────────────────────────────────────────────
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
        <Stack.Screen name="StudioDetail" component={StudioDetailScreen} />
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
