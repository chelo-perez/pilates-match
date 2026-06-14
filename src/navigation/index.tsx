// src/navigation/index.tsx

import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { useAuthStore } from '../store'
import { colors } from '../components/ui'

import LoginScreen              from '../screens/auth/LoginScreen'
import RegisterRoleScreen       from '../screens/auth/RegisterRoleScreen'
import RegisterStudioScreen     from '../screens/auth/RegisterStudioScreen'
import RegisterInstructorScreen from '../screens/auth/RegisterInstructorScreen'

import StudioHomeScreen          from '../screens/studio/HomeScreen'
import SearchScreen              from '../screens/studio/SearchScreen'
import InstructorProfileScreen   from '../screens/studio/InstructorProfileScreen'
import RequestMatchScreen        from '../screens/studio/RequestMatchScreen'
import EvaluateInstructorScreen  from '../screens/studio/EvaluateInstructorScreen'
import StudioHistoryScreen       from '../screens/studio/HistoryScreen'
import MembershipPaywallScreen   from '../screens/studio/MembershipPaywallScreen'
import PendingEvaluationsScreen  from '../screens/studio/PendingEvaluationsScreen'

import InstructorDashboardScreen   from '../screens/instructor/DashboardScreen'
import InstructorAvailabilityScreen from '../screens/instructor/AvailabilityScreen'
import InstructorProfileEditScreen  from '../screens/instructor/ProfileEditScreen'
import InstructorRatesScreen        from '../screens/instructor/RatesScreen'
import InstructorMatchesScreen      from '../screens/instructor/MatchesScreen'
import EvaluateStudioScreen         from '../screens/instructor/EvaluateStudioScreen'

import CamaraDashboardScreen  from '../screens/camara/DashboardScreen'
import CamaraDirectoryScreen  from '../screens/camara/DirectoryScreen'
import CamaraStudiosScreen    from '../screens/camara/StudiosScreen'
import CamaraRateRangesScreen from '../screens/camara/RateRangesScreen'
import VerifyInstructorScreen from '../screens/camara/VerifyInstructorScreen'
import ReportsScreen          from '../screens/camara/ReportsScreen'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

// ── Tokens de navegación ──────────────────────────────────────
const TAB_BAR = {
  backgroundColor: colors.white,
  borderTopWidth:  0.5,
  borderTopColor:  colors.border,
  paddingBottom:   8,
  paddingTop:      4,
  height:          62,
}

const TAB_LABEL = {
  fontFamily: 'Nunito-SemiBold',
  fontSize:   10,
}

const HEADER_OPTS = (tint = colors.sage) => ({
  headerStyle:           { backgroundColor: colors.cream },
  headerTitleStyle:      { fontFamily: 'Nunito-Bold', color: colors.dark, fontSize: 17 },
  headerShadowVisible:   false,
  headerBackTitleVisible:false,
  headerTintColor:       tint,
  headerBackButtonMenuEnabled: false,
})

// ── Tab icon helper ───────────────────────────────────────────
const tabIcon = (name: string) =>
  ({ color, size }: { color: string; size: number }) =>
    <Feather name={name as any} size={size} color={color} />

// ── STUDIO ────────────────────────────────────────────────────
function StudioTabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor:   colors.sage,
      tabBarInactiveTintColor: colors.light,
      tabBarStyle:      TAB_BAR,
      tabBarLabelStyle: TAB_LABEL,
    }}>
      <Tab.Screen name="Inicio"    component={StudioHomeScreen}    options={{ tabBarIcon: tabIcon('home') }} />
      <Tab.Screen name="Buscar"    component={SearchScreen}        options={{ tabBarIcon: tabIcon('search') }} />
      <Tab.Screen name="Historial" component={StudioHistoryScreen} options={{ tabBarIcon: tabIcon('clock') }} />
    </Tab.Navigator>
  )
}

function StudioNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER_OPTS(colors.sage)}>
      <Stack.Screen name="StudioTabs"         component={StudioTabs}               options={{ headerShown: false }} />
      <Stack.Screen name="Search"             component={SearchScreen}             options={{ title: 'Buscar instructor' }} />
      <Stack.Screen name="InstructorProfile"  component={InstructorProfileScreen}  options={{ title: '' }} />
      <Stack.Screen name="RequestMatch"       component={RequestMatchScreen}       options={{ title: 'Enviar propuesta', presentation: 'modal' }} />
      <Stack.Screen name="EvaluateInstructor" component={EvaluateInstructorScreen} options={{ title: 'Evaluar instructor', presentation: 'modal' }} />
      <Stack.Screen name="PendingEvaluations" component={PendingEvaluationsScreen} options={{ title: 'Evaluaciones pendientes' }} />
      <Stack.Screen name="MembershipPaywall"  component={MembershipPaywallScreen}  options={{ title: 'Membresía Cámara', presentation: 'modal' }} />
    </Stack.Navigator>
  )
}

// ── INSTRUCTOR ────────────────────────────────────────────────
function InstructorTabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor:   colors.sage,
      tabBarInactiveTintColor: colors.light,
      tabBarStyle:      TAB_BAR,
      tabBarLabelStyle: TAB_LABEL,
    }}>
      <Tab.Screen name="Inicio"         component={InstructorDashboardScreen}    options={{ tabBarIcon: tabIcon('home') }} />
      <Tab.Screen name="Propuestas"     component={InstructorMatchesScreen}      options={{ tabBarIcon: tabIcon('bell') }} />
      <Tab.Screen name="Disponibilidad" component={InstructorAvailabilityScreen} options={{ tabBarIcon: tabIcon('calendar') }} />
      <Tab.Screen name="Perfil"         component={InstructorProfileEditScreen}  options={{ tabBarIcon: tabIcon('user') }} />
    </Tab.Navigator>
  )
}

function InstructorNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER_OPTS(colors.sage)}>
      <Stack.Screen name="InstructorTabs"  component={InstructorTabs}          options={{ headerShown: false }} />
      <Stack.Screen name="InstructorRates" component={InstructorRatesScreen}   options={{ title: 'Mis tarifas', presentation: 'modal' }} />
      <Stack.Screen name="EvaluateStudio"  component={EvaluateStudioScreen}    options={{ title: 'Evaluar estudio', presentation: 'modal' }} />
    </Stack.Navigator>
  )
}

// ── CÁMARA ────────────────────────────────────────────────────
function CamaraTabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor:   colors.gold,
      tabBarInactiveTintColor: colors.light,
      tabBarStyle:      { ...TAB_BAR, backgroundColor: '#FDFBF3' },
      tabBarLabelStyle: TAB_LABEL,
    }}>
      <Tab.Screen name="Dashboard"  component={CamaraDashboardScreen} options={{ tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} /> }} />
      <Tab.Screen name="Verificar"  component={CamaraDirectoryScreen} options={{ tabBarIcon: tabIcon('user-check') }} />
      <Tab.Screen name="Estudios"   component={CamaraStudiosScreen}   options={{ tabBarIcon: tabIcon('briefcase') }} />
      <Tab.Screen name="Reportes"   component={ReportsScreen}         options={{ tabBarIcon: tabIcon('pie-chart') }} />
    </Tab.Navigator>
  )
}

function CamaraNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER_OPTS(colors.gold)}>
      <Stack.Screen name="CamaraTabs"       component={CamaraTabs}             options={{ headerShown: false }} />
      <Stack.Screen name="VerifyInstructor" component={VerifyInstructorScreen} options={{ title: 'Verificar instructor' }} />
      <Stack.Screen name="RateRanges"       component={CamaraRateRangesScreen} options={{ title: 'Rangos de tarifas' }} />
    </Stack.Navigator>
  )
}

// ── AUTH ──────────────────────────────────────────────────────
function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Login"              component={LoginScreen} />
      <Stack.Screen name="RegisterRole"       component={RegisterRoleScreen} />
      <Stack.Screen name="RegisterStudio"     component={RegisterStudioScreen} />
      <Stack.Screen name="RegisterInstructor" component={RegisterInstructorScreen} />
    </Stack.Navigator>
  )
}

// ── ROOT ──────────────────────────────────────────────────────
function AppContent() {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.sage} size="large" />
      </View>
    )
  }

  if (!user) return <AuthNavigator />

  switch (user.role) {
    case 'instructor':   return <InstructorNavigator />
    case 'camara_admin': return <CamaraNavigator />
    default:             return <StudioNavigator />
  }
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <AppContent />
    </NavigationContainer>
  )
}
