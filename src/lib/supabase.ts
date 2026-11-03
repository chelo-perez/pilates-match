// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// La URL y la anon key salen del entorno (EXPO_PUBLIC_*). La anon key es
// pública por diseño (la seguridad la da RLS), así que se deja un valor por
// defecto para que los builds sin .env sigan funcionando.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tkhaiovstwgqzabvxxss.supabase.co'
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGFpb3ZzdHdncXphYnZ4eHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MzU4NzksImV4cCI6MjA5NDMxMTg3OX0.KuuF4sOr4Bs51vvgCJQz0C1ophIyFLLpTNwFgrcS1Sc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ── Atajos por tabla ────────────────────────────────────────

export const db = {
  users: () => supabase.from('users'),
  studios: () => supabase.from('studios'),
  memberships: () => supabase.from('memberships'),
  instructors: () => supabase.from('instructors'),
  certifications: () => supabase.from('certifications'),
  specialties: () => supabase.from('instructor_specialties'),
  availability: () => supabase.from('availability'),
  zones: () => supabase.from('instructor_zones'),
  rates: () => supabase.from('instructor_rates'),
  budgets: () => supabase.from('studio_budgets'),
  evaluations: () => supabase.from('evaluations'),
  matches: () => supabase.from('matches'),
  rateRanges: () => supabase.from('rate_ranges'),
}

// ── Storage ─────────────────────────────────────────────────
// Buckets que existen: 'avatars' (público, path `${user.id}/...`) y
// 'certifications' (privado, path `${instructor.id}/...`, sin upsert).

export const storage = {
  /** Sube la foto de perfil y devuelve la URL pública (con cache-buster). */
  uploadAvatar: async (userId: string, file: Blob | ArrayBuffer, ext = 'jpg', contentType = 'image/jpeg') => {
    const path = `${userId}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType })
    if (error) throw error
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?t=' + Date.now()
  },

  /**
   * Sube el documento de un certificado y devuelve el PATH (guardarlo en
   * certifications.document_url). No hay policy de UPDATE: cada subida usa un
   * nombre nuevo.
   */
  uploadCertification: async (
    instructorId: string, certId: string, file: Blob | ArrayBuffer,
    ext = 'pdf', contentType = 'application/pdf',
  ): Promise<string> => {
    const path = `${instructorId}/${certId}-${Date.now()}.${ext.replace(/^\./, '').toLowerCase()}`
    const { error } = await supabase.storage.from('certifications').upload(path, file, { upsert: false, contentType })
    if (error) throw error
    return path
  },

  /** URL firmada temporal (10 min) para ver un certificado. */
  certificationUrl: async (path: string, expiresIn = 600): Promise<string> => {
    const { data, error } = await supabase.storage.from('certifications').createSignedUrl(path, expiresIn)
    if (error) throw error
    return data.signedUrl
  },
}
