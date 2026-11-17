// Web: al volver de conectar Mercado Pago (?mp=ok / ?mp=error), avisa el resultado y limpia la URL.
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

export default function MpReturnNotice() {
  const qc = useQueryClient()
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const mp = q.get('mp')
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
