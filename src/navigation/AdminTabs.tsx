// Paneles de escritorio con menú lateral fijo:
// - AdminTabs: la plataforma (super_admin). En el celular, pestañas abajo.
// - EntityPortal: la entidad de una red (camara_admin). En el celular se usan las pestañas de siempre (CamaraTabs).
import React from 'react'
import { View, Text, Pressable, StyleSheet, Image } from 'react-native'
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
import AdminSponsorsScreen from '../screens/admin/AdminSponsorsScreen'
import AdminSponsorEditScreen from '../screens/admin/AdminSponsorEditScreen'
import EntityHomeScreen from '../screens/admin/EntityHomeScreen'
import CamaraRateRangesScreen from '../screens/camara/RateRangesScreen'
import CamaraReportsScreen from '../screens/camara/ReportsScreen'
import CamaraProfileEditScreen from '../screens/camara/ProfileEditScreen'
import { InPanel } from '../components/admin/panelContext'
import { activeBrand } from '../lib/brand'
import { useCamara } from '../lib/platform'
import { registerGuideTarget } from '../components/AppGuide'

type Item = { name: string; label: string; short: string; icon: any; component: any }
type Hidden = { name: string; component: any; parent?: string }

/** Pantalla pensada para el celular dentro del portal: encabezado de escritorio y ancho máximo */
const asPanel = (C: any) => function PanelScreen(props: any) {
  return (
    <InPanel.Provider value>
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 980, alignSelf: 'center', paddingHorizontal: 16 }}><C {...props} /></View>
      </View>
    </InPanel.Provider>
  )
}

// Pantallas del panel que no van en el menú (fichas y notificaciones): se abren desde las tablas
const HIDDEN: Hidden[] = [
  { name: 'AdminInstructorDetail', component: AdminInstructorDetailScreen, parent: 'AdminInstructores' },
  { name: 'AdminStudioDetail', component: AdminStudioDetailScreen, parent: 'AdminEstudios' },
  { name: 'AdminNotificaciones', component: AdminNotificationsScreen },
  { name: 'PlatformCamaraEdit', component: PlatformCamaraEditScreen, parent: 'AdminRedes' },
  { name: 'AdminSponsorEdit', component: AdminSponsorEditScreen, parent: 'AdminPatrocinios' },
]

const Tab = createBottomTabNavigator()

const ITEMS: Item[] = [
  { name: 'AdminResumen',      label: 'Resumen',      short: 'Resumen',  icon: 'grid',        component: AdminHomeScreen },
  { name: 'AdminRedes',        label: 'Redes',        short: 'Redes',    icon: 'share-2',     component: AdminNetworksScreen },
  { name: 'AdminInstructores', label: 'Instructores', short: 'Instruct.', icon: 'user-check', component: AdminInstructorsScreen },
  { name: 'AdminEstudios',     label: 'Estudios',     short: 'Estudios', icon: 'home',        component: AdminStudiosScreen },
  { name: 'AdminActividad',    label: 'Actividad',    short: 'Actividad', icon: 'activity',   component: AdminActivityScreen },
  { name: 'AdminPatrocinios',  label: 'Patrocinios',  short: 'Patroc.',  icon: 'gift',        component: AdminSponsorsScreen },
  { name: 'AdminCobros',       label: 'Cobros',       short: 'Cobros',   icon: 'dollar-sign', component: AdminBillingScreen },
]

const ENTITY_ITEMS: Item[] = [
  { name: 'EntityResumen',     label: 'Resumen',      short: 'Resumen',  icon: 'grid',        component: EntityHomeScreen },
  { name: 'AdminInstructores', label: 'Instructores', short: 'Instruct.', icon: 'user-check', component: AdminInstructorsScreen },
  { name: 'AdminEstudios',     label: 'Estudios',     short: 'Estudios', icon: 'home',        component: AdminStudiosScreen },
  { name: 'AdminActividad',    label: 'Actividad',    short: 'Actividad', icon: 'activity',   component: AdminActivityScreen },
  { name: 'AdminPatrocinios',  label: 'Patrocinios',  short: 'Patroc.',  icon: 'gift',        component: AdminSponsorsScreen },
  { name: 'EntityTarifas',     label: 'Tarifas',      short: 'Tarifas',  icon: 'sliders',     component: asPanel(CamaraRateRangesScreen) },
  { name: 'EntityReportes',    label: 'Reportes y pagos', short: 'Reportes', icon: 'bar-chart-2', component: asPanel(CamaraReportsScreen) },
  { name: 'EntityPerfil',      label: 'Perfil y equipo', short: 'Perfil', icon: 'settings',   component: asPanel(CamaraProfileEditScreen) },
]
const ENTITY_HIDDEN: Hidden[] = [
  { name: 'AdminInstructorDetail', component: AdminInstructorDetailScreen, parent: 'AdminInstructores' },
  { name: 'AdminStudioDetail', component: AdminStudioDetailScreen, parent: 'AdminEstudios' },
  { name: 'AdminNotificaciones', component: AdminNotificationsScreen },
  { name: 'AdminSponsorEdit', component: AdminSponsorEditScreen, parent: 'AdminPatrocinios' },
]

function EntityBrand() {
  const camaraId = useAuthStore(s => s.user?.camara_id) as string | undefined
  const { data: camara } = useCamara(camaraId)
  const logo = activeBrand?.logos?.markDark ?? (camara as any)?.logo_url
  return (
    <View style={s.brand}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {logo ? <Image source={{ uri: logo }} style={s.entityLogo} resizeMode="contain" />
          : <View style={[s.entityLogo, s.entityLogoFallback]}><Text style={s.entityLetter}>{(camara?.name ?? 'R')[0]}</Text></View>}
        <Text style={s.entityName} numberOfLines={2}>{camara?.name ?? 'Tu red'}</Text>
      </View>
      <Text style={s.brandTxt}>Portal de la entidad</Text>
    </View>
  )
}

/** Registra dónde está cada ítem del menú, para que la guía de uso lo señale */
function GuideTargetView({ name, children }: { name: string; children: React.ReactNode }) {
  const ref = React.useRef<View>(null)
  const measure = () => ref.current?.measureInWindow?.((x, y, width, height) => registerGuideTarget(name, { x, y, width, height }))
  return <View ref={ref} onLayout={measure}>{children}</View>
}

function Sidebar({ state, navigation, items, hidden, entity }: BottomTabBarProps & { items: Item[]; hidden: Hidden[]; entity?: boolean }) {
  const email = useAuthStore(s => s.user?.email)
  const unread = useUnreadNotifications()
  const insets = useSafeAreaInsets()
  const ITEMS = items, HIDDEN = hidden
  return (
    <View style={[s.side, { paddingTop: insets.top + 22 }]}>
      {entity ? <EntityBrand /> : (
        <View style={s.brand}>
          <BrandLogo width={92} />
          <Text style={s.brandTxt}>Panel de la plataforma</Text>
        </View>
      )}
      <View style={{ gap: 2, marginTop: 18 }}>
        {state.routes.map((r, i) => {
          const item = ITEMS.find(x => x.name === r.name)
          if (!item) return null
          // Una ficha abierta deja marcada la sección de la que viene
          const current = state.routes[state.index]?.name
          const on = current === r.name || HIDDEN.find(h => h.name === current)?.parent === r.name
          return (
            <GuideTargetView key={r.key} name={r.name}>
              <Pressable onPress={() => navigation.navigate(r.name)} accessibilityRole="link" accessibilityState={{ selected: on }}
                style={({ hovered }: any) => [s.item, on && s.itemOn, hovered && !on && s.itemHover]}>
                <Feather name={item.icon} size={17} color={on ? colors.white : 'rgba(255,255,255,0.65)'} />
                <Text style={[s.itemTxt, on && s.itemTxtOn]}>{item.label}</Text>
              </Pressable>
            </GuideTargetView>
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
  return <PanelTabs items={ITEMS} hidden={HIDDEN} />
}

/** Portal de la entidad en la compu (en pantallas angostas, RootNavigator usa CamaraTabs) */
export function EntityPortal() {
  return <PanelTabs items={ENTITY_ITEMS} hidden={ENTITY_HIDDEN} entity />
}

function PanelTabs({ items: ITEMS, hidden: HIDDEN, entity }: { items: Item[]; hidden: Hidden[]; entity?: boolean }) {
  const wide = useIsWide()
  const insets = useSafeAreaInsets()
  return (
    <Tab.Navigator
      backBehavior="history"
      tabBar={wide ? (p) => <Sidebar {...p} items={ITEMS} hidden={HIDDEN} entity={entity} /> : undefined}
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
  entityLogo:{ width: 40, height: 40, borderRadius: 10 },
  entityLogoFallback: { backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  entityLetter: { fontFamily: 'Nunito-Bold', fontSize: 18, color: colors.white },
  entityName:{ flex: 1, fontFamily: 'Nunito-Bold', fontSize: 14, lineHeight: 18, color: colors.white },
  logout:    { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
})
