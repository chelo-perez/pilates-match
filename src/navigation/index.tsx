// src/navigation/index.tsx — con íconos Lottie animados
//
// Qué stack se muestra depende SOLO del store de auth (src/lib/auth.ts):
//   sin sesión (o registro en curso) → Login / registro
//   sesión sin perfil leído           → error con reintento
//   sesión sin estudio/instructor     → SelectRole (onboarding)
//   rol                               → tabs del rol
// Las pantallas no hacen navigation.replace() entre stacks: cambian el store.
import React, { useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { View } from 'react-native'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useAuthStore } from '../store'
import { syncAuthUser, signOutNow } from '../lib/auth'
import { listenForNotifications } from '../lib/notifications'
import LottieTab from '../components/LottieTab'
import { ErrorState, LoadingScreen, Button, colors, spacing } from '../components/ui'

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
import SelectRoleScreen from '../screens/auth/SelectRoleScreen'
import RegisterRoleScreen from '../screens/auth/RegisterRoleScreen'
import RegisterInstructorScreen from '../screens/auth/RegisterInstructorScreen'
import RegisterStudioScreen from '../screens/auth/RegisterStudioScreen'
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen'

// Instructor
import InstructorDashboardScreen from '../screens/instructor/DashboardScreen'
import InstructorMatchesScreen from '../screens/instructor/MatchesScreen'
import InstructorAvailabilityScreen from '../screens/instructor/AvailabilityScreen'
import InstructorProfileEditScreen from '../screens/instructor/ProfileEditScreen'
import InstructorRatesScreen from '../screens/instructor/RatesScreen'
import EvaluateStudioScreen from '../screens/instructor/EvaluateStudioScreen'

// Studio
import StudioHomeScreen from '../screens/studio/HomeScreen'
import StudioProfileEditScreen from '../screens/studio/ProfileEditScreen'
import MembershipScreen from '../screens/studio/MembershipScreen'
import SearchScreen from '../screens/studio/SearchScreen'
import InstructorProfileScreen from '../screens/studio/InstructorProfileScreen'
import RequestMatchScreen from '../screens/studio/RequestMatchScreen'
import EvaluateInstructorScreen from '../screens/studio/EvaluateInstructorScreen'
import StudioHistoryScreen from '../screens/studio/HistoryScreen'
import MembershipPaywallScreen from '../screens/studio/MembershipPaywallScreen'
import PendingEvaluationsScreen from '../screens/studio/PendingEvaluationsScreen'

// Camara
import CamaraDashboardScreen from '../screens/camara/DashboardScreen'
import CamaraProfileEditScreen from '../screens/camara/ProfileEditScreen'
import CamaraDirectoryScreen from '../screens/camara/DirectoryScreen'
import CamaraStudiosScreen from '../screens/camara/StudiosScreen'
import StudioDetailScreen from '../screens/camara/StudioDetailScreen'
import CamaraRateRangesScreen from '../screens/camara/RateRangesScreen'
import VerifyInstructorScreen from '../screens/camara/VerifyInstructorScreen'
import CamaraReportsScreen from '../screens/camara/ReportsScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator<any>()
const noHeader = { headerShown: false }

export const navigationRef = createNavigationContainerRef<any>()

function useTabStyle() {
  const insets = useSafeAreaInsets()
  return {
    backgroundColor: colors.white,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
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
  tabBarActiveTintColor: colors.sage,
  tabBarInactiveTintColor: colors.light,
  tabBarLabelStyle: { fontFamily: 'Nunito-SemiBold', fontSize: 11, marginTop: 2 },
})

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
      <Tab.Screen name="EstudioInicio" component={StudioHomeScreen}
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
      <Tab.Screen name="CamaraInicio" component={CamaraDashboardScreen}
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

// ── Sesión sin perfil (sin red al abrir) ──────────────────────
function ProfileErrorScreen() {
  const session = useAuthStore((s) => s.session)
  const [retrying, setRetrying] = React.useState(false)
  const retry = async () => {
    if (!session?.user?.id) return
    setRetrying(true)
    await syncAuthUser(session.user.id)
    setRetrying(false)
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, paddingBottom: spacing.xl }}>
      {retrying ? <LoadingScreen message="Reintentando..." /> : (
        <ErrorState message="No pudimos cargar tu cuenta." onRetry={retry} />
      )}
      <Button label="Cerrar sesión" variant="ghost" onPress={() => signOutNow()} style={{ alignSelf: 'center' }} />
    </View>
  )
}

// ── Notificaciones: tocar una propuesta abre "Propuestas" ─────
function useNotificationRouting(role: string | undefined) {
  useEffect(() => {
    if (!role) return
    return listenForNotifications(
      () => {},
      (response) => {
        const data: any = response.notification.request.content.data ?? {}
        if (!navigationRef.isReady()) return
        if (role === 'instructor' && data.match_id) {
          navigationRef.navigate('InstructorTabs', { screen: 'InstructorPropuestas' })
        }
      },
    )
  }, [role])
}

// ── ROOT NAVIGATOR ─────────────────────────────────────────────
export default function RootNavigator() {
  const { user, session, isLoading, needsOnboarding, registering, profileError, passwordRecovery } = useAuthStore()
  useNotificationRouting(user?.role)

  if (isLoading) return <LoadingScreen />

  const isAdmin = user?.role === 'camara_admin' || user?.role === 'super_admin'

  let screens: React.ReactNode
  if (!session || registering) {
    screens = (
      <>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="RegisterRole" component={RegisterRoleScreen} />
        <Stack.Screen name="RegisterInstructor" component={RegisterInstructorScreen} />
        <Stack.Screen name="RegisterStudio" component={RegisterStudioScreen} />
      </>
    )
  } else if (passwordRecovery) {
    screens = <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
  } else if (!user && profileError) {
    screens = <Stack.Screen name="ProfileError" component={ProfileErrorScreen} />
  } else if (!user || (needsOnboarding && !isAdmin)) {
    screens = <Stack.Screen name="SelectRole" component={SelectRoleScreen} />
  } else if (user.role === 'instructor') {
    screens = (
      <>
        <Stack.Screen name="InstructorTabs" component={InstructorTabs} />
        <Stack.Screen name="EvaluateStudio" component={EvaluateStudioScreen} />
      </>
    )
  } else if (user.role === 'estudio') {
    screens = (
      <>
        <Stack.Screen name="EstudioHome" component={StudioTabs} />
        <Stack.Screen name="InstructorProfile" component={InstructorProfileScreen} />
        <Stack.Screen name="RequestMatch" component={RequestMatchScreen} />
        <Stack.Screen name="EvaluateInstructor" component={EvaluateInstructorScreen} />
        <Stack.Screen name="MembershipPaywall" component={MembershipPaywallScreen} />
        <Stack.Screen name="Membership" component={MembershipScreen} />
        <Stack.Screen name="StudioProfileEdit" component={StudioProfileEditScreen} />
      </>
    )
  } else {
    // camara_admin y super_admin (is_admin en la base) usan el panel de la Cámara
    screens = (
      <>
        <Stack.Screen name="CamaraTabs" component={CamaraTabs} />
        <Stack.Screen name="VerifyInstructor" component={VerifyInstructorScreen} />
        <Stack.Screen name="StudioDetail" component={StudioDetailScreen} />
        <Stack.Screen name="CamaraProfileEdit" component={CamaraProfileEditScreen} />
      </>
    )
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={noHeader}>
        {screens}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
