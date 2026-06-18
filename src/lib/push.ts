import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Configurar cómo se muestran las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// Registrar dispositivo y guardar token en Supabase
export async function registerPushToken(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications solo funcionan en dispositivo físico')
    return null
  }

  // Pedir permisos
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Permisos de notificación denegados')
    return null
  }

  // Canal para Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Trabajo Más Fácil',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    })

    await Notifications.setNotificationChannelAsync('urgente', {
      name: 'Reemplazos Urgentes',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      sound: 'default',
      lightColor: '#C0392B',
    })
  }

  // Obtener token
  const token = (await Notifications.getExpoPushTokenAsync()).data

  // Guardar en Supabase
  await supabase.from('push_tokens').upsert({
    user_id: userId,
    token,
    platform: Platform.OS,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return token
}

// Tipos de notificación
export type NotifType =
  | 'nueva_propuesta'
  | 'reemplazo_urgente'
  | 'propuesta_aceptada'
  | 'propuesta_rechazada'
  | 'nueva_evaluacion'
  | 'recordatorio_evaluacion'
  | 'perfil_visitado'

// Enviar notificación push desde el cliente (solo para testing)
// En producción esto se hace desde Supabase Edge Functions
export async function sendPushNotification(
  token: string,
  type: NotifType,
  data: Record<string, any>
) {
  const messages: Record<NotifType, { title: string; body: string; channelId?: string }> = {
    nueva_propuesta: {
      title: '📋 Nueva propuesta',
      body: `${data.studio} te invita a dar una clase de ${data.disciplina}`,
    },
    reemplazo_urgente: {
      title: '⚡ Reemplazo urgente',
      body: `${data.studio} necesita cobertura hoy · $${data.tarifa}`,
      channelId: 'urgente',
    },
    propuesta_aceptada: {
      title: '✅ Propuesta aceptada',
      body: `${data.instructor} aceptó la clase del ${data.fecha}`,
    },
    propuesta_rechazada: {
      title: 'Propuesta rechazada',
      body: `${data.instructor} no puede cubrir la clase del ${data.fecha}`,
    },
    nueva_evaluacion: {
      title: '⭐ Nueva evaluación',
      body: `${data.evaluador} te calificó con ${data.score}`,
    },
    recordatorio_evaluacion: {
      title: '🔔 Recordatorio',
      body: `Tenés ${data.horas} horas para evaluar a ${data.nombre}`,
    },
    perfil_visitado: {
      title: '👁 Tu perfil fue visto',
      body: `${data.count} estudios visitaron tu perfil hoy`,
    },
  }

  const msg = messages[type]

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title: msg.title,
      body: msg.body,
      channelId: msg.channelId || 'default',
      data: { type, ...data },
      sound: 'default',
      priority: type === 'reemplazo_urgente' ? 'high' : 'normal',
    }),
  })
}
