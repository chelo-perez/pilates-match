// Patrocinios: "Beneficios de tu red" (descuentos, códigos) y formaciones, publicados como avisos pagos.
// La plataforma o la entidad cargan el aviso; la entidad de cada red lo aprueba; estudios e instructores
// lo ven según a quién va dirigido. Vistas y clics se registran para mostrarle resultados al patrocinador.
import { Linking, Platform, Share } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from './supabase'
import { UserError } from './errors'

export type SponsorKind = 'beneficio' | 'formacion'
export type Audience = 'estudio' | 'instructor' | 'ambos'
export type NetworkStatus = 'pendiente' | 'aprobado' | 'rechazado'

export interface SponsorOffer {
  id: string; kind: SponsorKind; sponsor_name: string; logo_url: string | null; title: string
  summary: string | null; details: string | null; perk: string | null; promo_code: string | null; url: string | null
  contact_whatsapp: string | null; audience: Audience; modality: 'presencial' | 'online' | 'mixta' | null
  course_start: string | null; course_hours: number | null; starts_on?: string; ends_on: string | null
  is_active?: boolean; origin?: 'plataforma' | 'entidad'; origin_camara_id?: string | null; created_at?: string
  networks?: SponsorNetwork[]
}
export interface SponsorNetwork {
  offer_id: string; camara_id: string; status: NetworkStatus; monthly_fee_ars: number; entity_share_pct: number | null
  note: string | null; decided_at: string | null; camara?: { name: string } | null
}

export const KIND_LABEL: Record<SponsorKind, string> = { beneficio: 'Beneficio', formacion: 'Formación' }
export const AUDIENCE_LABEL: Record<Audience, string> = { estudio: 'Estudios', instructor: 'Instructores', ambos: 'Estudios e instructores' }
export const STATUS_LABEL: Record<NetworkStatus, { label: string; tone: 'ok' | 'warn' | 'red' }> = {
  aprobado: { label: 'Publicado', tone: 'ok' }, pendiente: { label: 'Para aprobar', tone: 'warn' }, rechazado: { label: 'Rechazado', tone: 'red' },
}
export const MODALITY_LABEL = { presencial: 'Presencial', online: 'Online', mixta: 'Presencial y online' } as const

// ── Lo que ve un estudio o un instructor ─────────────────────────────
export const useMySponsorOffers = (enabled = true) =>
  useQuery({
    queryKey: ['my-sponsor-offers'],
    queryFn: async (): Promise<SponsorOffer[]> => {
      const { data, error } = await supabase.rpc('my_sponsor_offers')
      if (error) return []
      return (data ?? []) as SponsorOffer[]
    },
    enabled,
    staleTime: 5 * 60_000,
  })

/** Registra una vista o un clic (una vez por persona, aviso y día). Nunca interrumpe a la persona. */
export function trackSponsor(offerId: string, action: 'vista' | 'link' | 'codigo' | 'whatsapp') {
  supabase.rpc('track_sponsor', { p_offer: offerId, p_action: action }).then(() => {}, () => {})
}

export async function openOfferLink(o: SponsorOffer) {
  if (!o.url) return
  trackSponsor(o.id, 'link')
  const url = /^https?:\/\//i.test(o.url) ? o.url : `https://${o.url}`
  Linking.openURL(url).catch(() => {})
}

export function openOfferWhatsapp(o: SponsorOffer) {
  if (!o.contact_whatsapp) return
  trackSponsor(o.id, 'whatsapp')
  let n = o.contact_whatsapp.replace(/\D/g, '')
  if (!n.startsWith('54')) n = '549' + n.replace(/^0/, '').replace(/^15/, '')
  const text = encodeURIComponent(`Hola, vi "${o.title}" en Trabajo Más Fácil.`)
  Linking.openURL(`https://wa.me/${n}?text=${text}`).catch(() => {})
}

/** Copia el código (web) o lo comparte (celular, sin librería de portapapeles). Devuelve si se copió. */
export async function copyOfferCode(o: SponsorOffer): Promise<boolean> {
  if (!o.promo_code) return false
  trackSponsor(o.id, 'codigo')
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    try { await navigator.clipboard.writeText(o.promo_code); return true } catch { /* sigue con compartir */ }
  }
  try { await Share.share({ message: o.promo_code }) } catch { /* canceló */ }
  return false
}

// ── Paneles: plataforma y entidad ────────────────────────────────────
const SELECT = '*, networks:sponsor_offer_networks(offer_id, camara_id, status, monthly_fee_ars, entity_share_pct, note, decided_at, camara:camaras(name))'

/** Avisos visibles para quien administra (la plataforma: todos; la entidad: los de su red y los propios) */
export const useSponsorOffers = () =>
  useQuery({
    queryKey: ['sponsor-offers'],
    queryFn: async (): Promise<SponsorOffer[]> => {
      const { data, error } = await supabase.from('sponsor_offers').select(SELECT).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as any
    },
  })

export interface SponsorStat { offer_id: string; camara_id: string; vistas: number; links: number; codigos: number; whatsapp: number }
export const useSponsorStats = (days = 30) =>
  useQuery({
    queryKey: ['sponsor-stats', days],
    queryFn: async (): Promise<SponsorStat[]> => {
      const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)
      const { data, error } = await supabase.rpc('sponsor_stats', { p_since: since })
      if (error) return []
      return (data ?? []).map((r: any) => ({ ...r, vistas: Number(r.vistas), links: Number(r.links), codigos: Number(r.codigos), whatsapp: Number(r.whatsapp) }))
    },
  })

/** Suma de resultados de un aviso (en todas las redes que ve quien consulta) */
export function statsFor(stats: SponsorStat[], offerId: string, camaraId?: string) {
  const rows = stats.filter(s => s.offer_id === offerId && (!camaraId || s.camara_id === camaraId))
  const sum = (k: keyof SponsorStat) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0)
  const clicks = sum('links') + sum('codigos') + sum('whatsapp')
  return { vistas: sum('vistas'), clicks }
}

export type OfferDraft = Omit<SponsorOffer, 'id' | 'networks'> & { id?: string }
export type NetworkDraft = { camara_id: string; monthly_fee_ars: number; entity_share_pct?: number | null }

export const SPONSOR_KEYS = [['sponsor-offers'], ['sponsor-stats'], ['my-sponsor-offers']]

export function useSaveOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ offer, networks, isPlatform }: { offer: OfferDraft; networks: NetworkDraft[]; isPlatform: boolean }) => {
      const { id, ...fields } = offer as any
      for (const k of ['networks', 'created_at', 'origin', 'origin_camara_id']) delete fields[k]
      let offerId = id
      if (offerId) {
        const { data, error } = await supabase.from('sponsor_offers').update(fields).eq('id', offerId).select('id')
        if (error) throw error
        if (!data?.length) throw new UserError('No tenés permiso para editar este aviso.')
      } else {
        const origin = isPlatform ? { origin: 'plataforma' } : { origin: 'entidad', origin_camara_id: networks[0]?.camara_id }
        const { data, error } = await supabase.from('sponsor_offers').insert({ ...fields, ...origin }).select('id').single()
        if (error) throw error
        offerId = data.id
      }
      // Redes: agrega las nuevas y actualiza montos (la plataforma también puede quitar redes)
      const { data: current } = await supabase.from('sponsor_offer_networks').select('camara_id').eq('offer_id', offerId)
      const have = new Set((current ?? []).map((r: any) => r.camara_id))
      const want = new Set(networks.map(n => n.camara_id))
      for (const n of networks) {
        const row: any = { offer_id: offerId, camara_id: n.camara_id, monthly_fee_ars: n.monthly_fee_ars }
        if (isPlatform && n.entity_share_pct != null) row.entity_share_pct = n.entity_share_pct
        const { error } = have.has(n.camara_id)
          ? await supabase.from('sponsor_offer_networks').update(row).eq('offer_id', offerId).eq('camara_id', n.camara_id)
          : await supabase.from('sponsor_offer_networks').insert(row)
        if (error) throw error
      }
      if (isPlatform) {
        const gone = [...have].filter(c => !want.has(c))
        if (gone.length) {
          const { error } = await supabase.from('sponsor_offer_networks').delete().eq('offer_id', offerId).in('camara_id', gone)
          if (error) throw error
        }
      }
      return offerId as string
    },
    onSuccess: () => SPONSOR_KEYS.forEach(queryKey => qc.invalidateQueries({ queryKey })),
  })
}

/** La entidad aprueba o rechaza un aviso para su red */
export function useDecideOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ offerId, camaraId, status, note }: { offerId: string; camaraId: string; status: NetworkStatus; note?: string }) => {
      const { data, error } = await supabase.from('sponsor_offer_networks').update({ status, note: note ?? null })
        .eq('offer_id', offerId).eq('camara_id', camaraId).select('offer_id')
      if (error) throw error
      if (!data?.length) throw new UserError('No tenés permiso para decidir sobre este aviso.')
    },
    onSuccess: () => SPONSOR_KEYS.forEach(queryKey => qc.invalidateQueries({ queryKey })),
  })
}

export function useDeleteOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase.from('sponsor_offers').delete().eq('id', offerId)
      if (error) throw error
    },
    onSuccess: () => SPONSOR_KEYS.forEach(queryKey => qc.invalidateQueries({ queryKey })),
  })
}

/** Sube una imagen elegida (web o celular) al bucket público de imágenes y devuelve su URL */
export async function uploadSponsorLogo(uri: string, userId: string): Promise<string> {
  const path = `${userId}/sponsor-${Date.now()}.jpg`
  let body: any
  if (Platform.OS === 'web') {
    body = await (await fetch(uri)).blob()
  } else {
    const cacheUri = FileSystem.cacheDirectory + 'sponsor_' + Date.now() + '.jpg'
    await FileSystem.copyAsync({ from: uri, to: cacheUri })
    const base64 = await FileSystem.readAsStringAsync(cacheUri, { encoding: FileSystem.EncodingType.Base64 })
    const bin = atob(base64); body = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) body[i] = bin.charCodeAt(i)
  }
  const { error } = await supabase.storage.from('avatars').upload(path, body, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}
