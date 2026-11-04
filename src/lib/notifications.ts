// src/lib/notifications.ts
// Push notifications con Expo: permisos, canales Android y token en Supabase.

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { supabase } from './supabase'
import { colors } from '../components/ui'

// Cómo se muestran las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Pide permisos y guarda el token en push_tokens. Nunca tira error:
 * las notificaciones no deben bloquear el uso de la app.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return // Emulador: no hay push

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Propuestas y novedades',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: colors.sage,
        sound: 'default',
      })
      await Notifications.setNotificationChannelAsync('urgente', {
        name: 'Reemplazos urgentes',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: colors.redTx,
        sound: 'default',
      })
    }

    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return // El usuario no quiso: no insistimos

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    if (!projectId) {
      if (__DEV__) console.warn('[push] falta extra.eas.projectId en app.json')
      return
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })

    // Un celular = un token: claim_push_token se lo saca a otras cuentas que se
    // usaron en este teléfono, así nadie recibe avisos de una cuenta ajena.
    const { error } = await supabase.rpc('claim_push_token', { p_token: token })
    if (error) {
      // Si la función todavía no existe en la base, guardamos como antes
      const { error: upErr } = await supabase
        .from('push_tokens')
        .upsert({ user_id: userId, token, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (upErr && __DEV__) console.warn('[push] no se guardó el token:', upErr.message)
    }
  } catch (err) {
    if (__DEV__) console.warn('[push] error en el registro:', err)
  }
}

/**
 * Escucha notificaciones recibidas y toques sobre ellas.
 * Devuelve una función de limpieza para usar en useEffect.
 */
export function listenForNotifications(
  onNotification: (notification: Notifications.Notification) => void,
  onResponse: (response: Notifications.NotificationResponse) => void,
) {
  const notifSub = Notifications.addNotificationReceivedListener(onNotification)
  const respSub = Notifications.addNotificationResponseReceivedListener(onResponse)
  return () => {
    notifSub.remove()
    respSub.remove()
  }
}
