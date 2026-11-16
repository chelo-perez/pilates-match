// En la web, Alert.alert de React Native no muestra nada: las confirmaciones ("¿Bloquear estudio?",
// "¿Elegir a…?", "¿Cancelar suscripción?") quedaban sin respuesta y el botón no hacía nada.
// Acá se reemplaza por los diálogos del navegador: un botón → aviso; con "Cancelar" → confirmar.
import { Alert, Platform } from 'react-native'

type Btn = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: (v?: string) => void }

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  ;(Alert as any).alert = (title?: string, message?: string, buttons?: Btn[]) => {
    const text = [title, message].filter(Boolean).join('\n\n')
    const list = buttons ?? []
    const actions = list.filter(b => b.style !== 'cancel')
    const cancel = list.find(b => b.style === 'cancel')
    if (actions.length <= 1 && !cancel) { window.alert(text); actions[0]?.onPress?.(); return }
    // Una sola acción real: confirmar o cancelar
    if (actions.length === 1) {
      if (window.confirm(`${text}\n\n¿${actions[0].text ?? 'Aceptar'}?`)) actions[0].onPress?.()
      else cancel?.onPress?.()
      return
    }
    // Varias acciones: se elige por número
    const options = actions.map((b, i) => `${i + 1}. ${b.text}`).join('\n')
    const pick = window.prompt(`${text}\n\n${options}\n\nEscribí el número de la opción:`)
    const b = actions[Number(pick) - 1]
    if (b) b.onPress?.(); else cancel?.onPress?.()
  }
}
