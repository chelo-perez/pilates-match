// src/navigation/index.tsx
import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
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

function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#4A5D4E" size="large" />
    </View>
  )
}

function AdminHome() {
  const { reset } = useAuthStore()
  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9F6', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 22, color: '#4A5D4E' }}>Panel Admin ✓</Text>
      <TouchableOpacity
        onPress={async () => { await supabase.auth.signOut(); reset() }}
        style={{ backgroundColor: '#4A5D4E', borderRadius: 10, padding: 12, paddingHorizontal: 24 }}
      >
        <Text style={{ fontFamily: 'Nunito-Bold', color: '#fff' }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  )
}

const noHeader = { headerShown: false }

export default function RootNavigator() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <Loading />

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={noHeader}>
        {!user ? (
          // ── Auth ──────────────────────────────────────
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="RegisterRole" component={RegisterRoleScreen} />
            <Stack.Screen name="RegisterInstructor" component={RegisterInstructorScreen} />
            <Stack.Screen name="RegisterStudio" component={RegisterStudioScreen} />
          </>
        ) : user.role === 'instructor' ? (
          // ── Instructor ────────────────────────────────
          <>
            <Stack.Screen name="InstructorTabs" component={InstructorDashboardScreen} />
            <Stack.Screen name="InstructorMatches" component={InstructorMatchesScreen} />
            <Stack.Screen name="InstructorAvailability" component={InstructorAvailabilityScreen} />
            <Stack.Screen name="InstructorProfileEdit" component={InstructorProfileEditScreen} />
            <Stack.Screen name="InstructorRates" component={InstructorRatesScreen} />
            <Stack.Screen name="EvaluateStudio" component={EvaluateStudioScreen} />
          </>
        ) : user.role === 'estudio' ? (
          // ── Studio ────────────────────────────────────
          <>
            <Stack.Screen name="EstudioHome" component={StudioHomeScreen} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="InstructorProfile" component={InstructorProfileScreen} />
            <Stack.Screen name="RequestMatch" component={RequestMatchScreen} />
            <Stack.Screen name="EvaluateInstructor" component={EvaluateInstructorScreen} />
            <Stack.Screen name="HistoryList" component={StudioHistoryScreen} />
            <Stack.Screen name="MembershipPaywall" component={MembershipPaywallScreen} />
            <Stack.Screen name="PendingEvaluations" component={PendingEvaluationsScreen} />
          </>
        ) : user.role === 'camara_admin' ? (
          // ── Camara ────────────────────────────────────
          <>
            <Stack.Screen name="CamaraTabs" component={CamaraDashboardScreen} />
            <Stack.Screen name="Directorio" component={CamaraDirectoryScreen} />
            <Stack.Screen name="Estudios" component={CamaraStudiosScreen} />
            <Stack.Screen name="Tarifas" component={CamaraRateRangesScreen} />
            <Stack.Screen name="VerifyInstructor" component={VerifyInstructorScreen} />
            <Stack.Screen name="Reportes" component={CamaraReportsScreen} />
          </>
        ) : user.role === 'super_admin' ? (
          // ── Super Admin ───────────────────────────────
          <Stack.Screen name="AdminTabs" component={AdminHome} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
