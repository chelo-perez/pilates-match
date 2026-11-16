// Panel de la plataforma (super_admin). En la compu: menú lateral fijo. En el celular: pestañas abajo.
import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../store'
import { confirmSignOut } from '../lib/auth'
import { useUnreadNotifications } from '../hooks'
import BrandLogo from '../components/BrandLogo'
import { useIsWide } from '../components/admin/AdminUI'
import { colors } from '../components/ui'
import AdminHomeScreen from '../screens/admin/AdminHomeScreen'
import AdminNetworksScreen from '../screens/admin/AdminNetworksScreen'
import AdminInstructorsScreen from '../screens/admin/AdminInstructorsScreen'
import AdminStudiosScreen from '../screens/admin/AdminStudiosScreen'
import AdminActivityScreen from '../screens/admin/AdminActivityScreen'
import AdminBillingScreen from '../screens/admin/AdminBillingScreen'
import AdminInstructorDetailScreen from '../screens/admin/AdminInstructorDetailScreen'
import AdminStudioDetailScreen from '../screens/admin/AdminStudioDetailScreen'
import AdminNotificationsScreen from '../screens/admin/AdminNotificationsScreen'
import PlatformCamaraEditScreen from '../screens/platform/CamaraEditScreen'

// Pantallas del panel que no van en el menú (fichas y notificaciones): se abren desde las tablas
const HIDDEN: { name: string; component: any; parent?: string }[] = [
  { name: 'AdminInstructorDetail', component: AdminInstructorDetailScreen, parent: 'AdminInstructores' },
  { name: 'AdminStudioDetail', component: AdminStudioDetailScreen, parent: 'AdminEstudios' },
  { name: 'AdminNotificaciones', component: AdminNotificationsScreen },
  { name: 'PlatformCamaraEdit', component: PlatformCamaraEditScreen, parent: 'AdminRedes' },
]

const Tab = createBottomTabNavigator()

const ITEMS: { name: string; label: string; short: string; icon: any; component: any }[] = [
  { name: 'AdminResumen',      label: 'Resumen',      short: 'Resumen',  icon: 'grid',        component: AdminHomeScreen },
  { name: 'AdminRedes',        label: 'Redes',        short: 'Redes',    icon: 'share-2',     component: AdminNetworksScreen },
  { name: 'AdminInstructores', label: 'Instructores', short: 'Instruct.', icon: 'user-check', component: AdminInstructorsScreen },
  { name: 'AdminEstudios',     label: 'Estudios',     short: 'Estudios', icon: 'home',        component: AdminStudiosScreen },
  { name: 'AdminActividad',    label: 'Actividad',    short: 'Actividad', icon: 'activity',   component: AdminActivityScreen },
  { name: 'AdminCobros',       label: 'Cobros',       short: 'Cobros',   icon: 'dollar-sign', component: AdminBillingScreen },
]

function Sidebar({ state, navigation }: BottomTabBarProps) {
  const email = useAuthStore(s => s.user?.email)
  const unread = useUnreadNotifications()
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.side, { paddingTop: insets.top + 22 }]}>
      <View style={s.brand}>
        <BrandLogo width={92} />
        <Text style={s.brandTxt}>Panel de la plataforma</Text>
      </View>
      <View style={{ gap: 2, marginTop: 18 }}>
        {state.routes.map((r, i) => {
          const item = ITEMS.find(x => x.name === r.name)
          if (!item) return null
          // Una ficha abierta deja marcada la sección de la que viene
          const current = state.routes[state.index]?.name
          const on = current === r.name || HIDDEN.find(h => h.name === current)?.parent === r.name
          return (
            <Pressable key={r.key} onPress={() => navigation.navigate(r.name)} accessibilityRole="link" accessibilityState={{ selected: on }}
              style={({ hovered }: any) => [s.item, on && s.itemOn, hovered && !on && s.itemHover]}>
              <Feather name={item.icon} size={17} color={on ? colors.white : 'rgba(255,255,255,0.65)'} />
              <Text style={[s.itemTxt, on && s.itemTxtOn]}>{item.label}</Text>
            </Pressable>
          )
        })}
      </View>
      <View style={{ flex: 1 }} />
      <Pressable onPress={() => navigation.navigate('AdminNotificaciones')}
        style={({ hovered }: any) => [s.item, state.routes[state.index]?.name === 'AdminNotificaciones' && s.itemOn, hovered && s.itemHover]}>
        <Feather name="bell" size={17} color="rgba(255,255,255,0.75)" />
        <Text style={s.itemTxt}>Notificaciones</Text>
        {unread > 0 ? <View style={s.badge}><Text style={s.badgeTxt}>{unread > 9 ? '9+' : unread}</Text></View> : null}
      </Pressable>
      <View style={s.user}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.userLbl}>Sesión</Text>
          <Text style={s.userTxt} numberOfLines={1}>{email ?? ''}</Text>
        </View>
        <Pressable onPress={() => confirmSignOut()} style={({ hovered }: any) => [s.logout, hovered && s.itemHover]} accessibilityRole="button" accessibilityLabel="Cerrar sesión">
          <Feather name="log-out" size={16} color={colors.white} />
        </Pressable>
      </View>
    </View>
  )
}

export default function AdminTabs() {
  const wide = useIsWide()
  const insets = useSafeAreaInsets()
  return (
    <Tab.Navigator
      backBehavior="history"
      tabBar={wide ? (p) => <Sidebar {...p} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarActiveTintColor: colors.sage,
        tabBarInactiveTintColor: colors.sageMid,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border, height: 64 + (insets.bottom || 0), paddingBottom: insets.bottom || 8, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: 'Nunito-SemiBold', fontSize: 10 },
      }}>
      {ITEMS.map(it => (
        <Tab.Screen key={it.name} name={it.name} component={it.component}
          options={{ tabBarLabel: it.short, tabBarIcon: ({ color }) => <Feather name={it.icon} size={20} color={color} /> }} />
      ))}
      {HIDDEN.map(it => (
        <Tab.Screen key={it.name} name={it.name} component={it.component}
          options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      ))}
    </Tab.Navigator>
  )
}

const s = StyleSheet.create({
  side:      { width: 236, backgroundColor: colors.forestDeep, paddingHorizontal: 14, paddingBottom: 18 },
  brand:     { paddingHorizontal: 8, gap: 8 },
  brandTxt:  { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  item:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  itemOn:    { backgroundColor: colors.sage },
  itemHover: { backgroundColor: 'rgba(255,255,255,0.08)' },
  itemTxt:   { fontFamily: 'Nunito-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.75)', flex: 1 },
  itemTxtOn: { color: colors.white, fontFamily: 'Nunito-Bold' },
  badge:     { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.redTx, alignItems: 'center', justifyContent: 'center' },
  badgeTxt:  { fontFamily: 'Nunito-Bold', fontSize: 11, color: colors.white },
  user:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 12, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  userLbl:   { fontFamily: 'Nunito-SemiBold', fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 },
  userTxt:   { fontFamily: 'Nunito-SemiBold', fontSize: 12, color: colors.white },
  logout:    { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
})
