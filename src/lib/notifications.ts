// src/lib/notifications.ts
// Manejo completo de push notifications con Expo

import { Platform, Alert } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { supabase } from './supabase'

// Configurar cómo se muestran las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

/**
 * Solicita permisos y registra el token en Supabase.
 * Llamar desde App.tsx al inicio de sesión.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    // Android necesita canal de notificaciones
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('matches', {
        name: 'Solicitudes de cobertura',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4A5D4E',
        sound: 'default',
      })
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    // Verificar si ya tiene permisos
    const { status: existing } = await Notifications.getPermissionsAsync()
    let finalStatus = existing

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      // El usuario rechazó — no insistir, no es bloqueante
      console.log('[Notifications] Permisos no otorgados')
      return
    }

    // Obtener token de Expo Push
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    if (!projectId) {
      console.warn('[Notifications] EXPO_PUBLIC_PROJECT_ID no configurado')
      return
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId })

    // Guardar en Supabase
    const { error } = await supabase
      .from('push_tokens')
      .upsert({ user_id: userId, token: token.data }, { onConflict: 'user_id' })

    if (error) {
      console.error('[Notifications] Error guardando token:', error.message)
    } else {
      console.log('[Notifications] Token registrado correctamente')
    }
  } catch (err) {
    // No bloquear el arranque de la app por errores de notificaciones
    console.error('[Notifications] Error en setup:', err)
  }
}

/**
 * Escuchar notificaciones recibidas mientras la app está abierta.
 * Devuelve una función de limpieza para usar en useEffect.
 */
export function listenForNotifications(
  onNotification: (notification: Notifications.Notification) => void,
  onResponse:     (response: Notifications.NotificationResponse) => void,
) {
  const notifSub = Notifications.addNotificationReceivedListener(onNotification)
  const respSub  = Notifications.addNotificationResponseReceivedListener(onResponse)

  return () => {
    notifSub.remove()
    respSub.remove()
  }
}
