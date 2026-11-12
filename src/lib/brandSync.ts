// Mantiene la marca guardada en el dispositivo igual a la de la red del usuario.
// - Con sesión: la red del usuario (entidad, estudio o instructor). Sin red con marca: sin co-marca.
// - Sin sesión: si se entró con el link de una red (?red=capiaf), su marca; si no, la que ya había.
// Cuando cambia, `switchBrand` la guarda y recarga la app una vez.
import { useEffect } from 'react'
import { supabase } from './supabase'
import { useAuthStore } from '../store'
import { brandFromRow, requestedSlug, switchBrand, NetworkBrand } from './brand'

async function fetchBrand(args: { slug?: string; id?: string }): Promise<NetworkBrand | null | undefined> {
  const { data, error } = await supabase.rpc('network_brand', { p_slug: args.slug ?? null, p_id: args.id ?? null })
  if (error) return undefined // sin red o sin la migración: no tocar nada
  return brandFromRow(data)
}

async function myCamaraId(user: any): Promise<string | null> {
  if (user.camara_id) return user.camara_id
  if (user.role !== 'estudio' && user.role !== 'instructor') return null
  const table = user.role === 'estudio' ? 'studios' : 'instructors'
  const { data } = await supabase.from(table).select('camara_id').eq('user_id', user.id).maybeSingle()
  return (data as any)?.camara_id ?? null
}

export function useNetworkBrandSync() {
  const user = useAuthStore(s => s.user)
  const isLoading = useAuthStore(s => s.isLoading)
  // Mientras se registra todavía no tiene red: se conserva la del link
  const pending = useAuthStore(s => s.needsOnboarding || s.registering)

  useEffect(() => {
    if (isLoading || pending) return
    let cancel = false
    ;(async () => {
      let next: NetworkBrand | null | undefined
      if (user) {
        const id = await myCamaraId(user)
        next = id ? await fetchBrand({ id }) : null
      } else {
        const slug = requestedSlug()
        if (!slug) return
        next = await fetchBrand({ slug })
      }
      if (!cancel && next !== undefined) await switchBrand(next)
    })()
    return () => { cancel = true }
  }, [user?.id, user?.camara_id, isLoading, pending])
}
