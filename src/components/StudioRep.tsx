// Reputación agregada del estudio (clases, pago, "pagó lo acordado"): la ve el instructor
// antes de aceptar una propuesta o anotarse en una clase abierta.
import React from 'react'
import { Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { colors } from './ui'
import { reliabilityWarning, useReliability } from '../lib/matchFlow'

/** Lo que el instructor ve del estudio antes de aceptar (agregados que calcula el servidor) */
export default function StudioRep({ studioId }: { studioId: string }) {
  const { data: r } = useQuery({
    queryKey: ['studio-reputation', studioId],
    queryFn: async () => { const { data } = await supabase.rpc('studio_reputation', { p_studio_id: studioId }); return data as any },
    staleTime: 5 * 60_000,
  })
  const { data: rel } = useReliability({ studioId })
  const warn = reliabilityWarning(rel)
  if (!r) return null
  if (warn) return <Text style={[s.repTxt, { color: colors.warnTx }]}><Feather name="alert-triangle" size={11} /> {warn}</Text>
  if (!r.classes && !r.evals) return <Text style={s.repTxt}>Sin historial en la app todavía</Text>
  const bad = r.paid_total > 0 && r.paid_ok < r.paid_total
  const parts = [
    r.classes ? `${r.classes} clase${r.classes === 1 ? '' : 's'}` : null,
    r.avg_payment != null ? `pago ${r.avg_payment}/10` : null,
    r.paid_total > 0 ? `pagó lo acordado ${r.paid_ok}/${r.paid_total}` : null,
  ].filter(Boolean)
  return (
    <Text style={[s.repTxt, bad && { color: colors.warnTx }]}>
      <Feather name={bad ? 'alert-triangle' : 'shield'} size={11} /> {parts.join(' · ')}
    </Text>
  )
}


const s = StyleSheet.create({
  repTxt: { fontFamily: 'Nunito-SemiBold', fontSize: 11, color: colors.sage, marginTop: 2 },
})
