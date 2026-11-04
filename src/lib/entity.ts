// Red y entidad: cada red la coordina una entidad (Cámara, Asociación, Colegio, Escuela...).
// Los textos de la app la nombran por su tipo: "la Cámara verifica tu perfil", "el Colegio...".
import { useEffect } from 'react'
import { create } from 'zustand'
import { supabase } from './supabase'

export const ENTITY_TYPES: { type: string; article: 'la' | 'el' }[] = [
  { type: 'Cámara', article: 'la' }, { type: 'Asociación', article: 'la' }, { type: 'Colegio', article: 'el' },
  { type: 'Consejo', article: 'el' }, { type: 'Escuela', article: 'la' }, { type: 'Federación', article: 'la' },
  { type: 'Cooperativa', article: 'la' }, { type: 'Organización', article: 'la' },
]

interface EntityState { type: string; article: 'la' | 'el'; name: string | null; set: (e: Partial<EntityState>) => void }
const useEntityStore = create<EntityState>()(set => ({ type: 'Cámara', article: 'la', name: null, set: e => set(e) }))

export interface EntityWords {
  type: string; name: string | null
  la: string; La: string; de: string; a: string   // "la Cámara", "La Cámara", "de la Cámara", "a la Cámara"
}
const words = (type: string, article: 'la' | 'el', name: string | null): EntityWords => {
  const la = `${article} ${type}`
  return {
    type, name, la, La: la.charAt(0).toUpperCase() + la.slice(1),
    de: article === 'el' ? `del ${type}` : `de la ${type}`,
    a: article === 'el' ? `al ${type}` : `a la ${type}`,
  }
}

/** Palabras para nombrar a la entidad de la red de quien usa la app (reactivo) */
export function useEntity(): EntityWords {
  const { type, article, name } = useEntityStore()
  return words(type, article, name)
}
/** Lo mismo, fuera de un componente (por ejemplo en constantes) */
export const entity = (): EntityWords => { const s = useEntityStore.getState(); return words(s.type, s.article, s.name) }

/** Carga la entidad de la red de la persona al entrar (o la principal si todavía no tiene red) */
export function useLoadEntity(userId: string | undefined, role: string | undefined, camaraId: string | null | undefined) {
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let id = camaraId ?? null
      if (!id && userId && role === 'estudio') {
        const { data } = await supabase.from('studios').select('camara_id').eq('user_id', userId).maybeSingle()
        id = data?.camara_id ?? null
      } else if (!id && userId && role === 'instructor') {
        const { data } = await supabase.from('instructors').select('camara_id').eq('user_id', userId).maybeSingle()
        id = data?.camara_id ?? null
      }
      let q = supabase.from('camaras').select('name, entity_type, entity_article')
      q = id ? q.eq('id', id) : q.eq('is_active', true).order('created_at').limit(1)
      const { data, error } = await q.maybeSingle()
      if (cancelled || error || !data) return
      useEntityStore.getState().set({
        type: (data as any).entity_type ?? 'Cámara',
        article: (data as any).entity_article === 'el' ? 'el' : 'la',
        name: data.name ?? null,
      })
    })()
    return () => { cancelled = true }
  }, [userId, role, camaraId])
}
