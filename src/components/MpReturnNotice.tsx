// Web: al volver de Mercado Pago (conexión ?mp=ok|error, o pago ?pago=ok|pendiente|error), avisa el resultado y limpia la URL.
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

export default function MpReturnNotice() {
  const qc = useQueryClient()
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const mp = q.get('mp'), pago = q.get('pago')
    if (pago) {
      window.history.replaceState(null, '', window.location.pathname)
      qc.invalidateQueries()
      setTimeout(() => window.alert(pago === 'ok' ? 'Pago recibido. En unos segundos lo vas a ver confirmado en la clase.'
        : pago === 'pendiente' ? 'Mercado Pago está procesando el pago. Te avisamos cuando se acredite.'
        : 'El pago no se completó. Podés volver a intentarlo desde la clase.'), 2500)
      return
    }
    if (!mp) return
    const msg = q.get('mp_msg')
    window.history.replaceState(null, '', window.location.pathname)
    qc.invalidateQueries({ queryKey: ['mp-connection'] })
    setTimeout(() => window.alert(mp === 'ok'
      ? 'Mercado Pago conectado. Los reemplazos te los pagan por la app y la plata llega directo a tu cuenta.'
      : (msg || 'No se pudo conectar Mercado Pago. Probá de nuevo.')), 2500)
  }, [])
  return null
}
