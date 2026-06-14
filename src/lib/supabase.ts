// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
// database.types se genera con: npm run db:types
// Por ahora usamos any para no bloquear el desarrollo

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// DEBUG — verificar que las variables se leen correctamente
console.log('SUPABASE_URL:', SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : 'UNDEFINED')
console.log('ANON_KEY:', SUPABASE_ANON_KEY ? 'OK (empieza con: ' + SUPABASE_ANON_KEY.substring(0, 10) + ')' : 'UNDEFINED')

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ── Typed query helpers ─────────────────────────────────────

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

// ── Storage helpers ─────────────────────────────────────────

export const storage = {
  avatars: supabase.storage.from('avatars'),
  certifications: supabase.storage.from('certifications'),

  uploadAvatar: async (userId: string, file: Blob) => {
    const path = `${userId}/avatar.jpg`
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (error) throw error
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  },

  uploadCertification: async (instructorId: string, certId: string, file: Blob) => {
    const path = `${instructorId}/${certId}.pdf`
    const { data, error } = await supabase.storage
      .from('certifications')
      .upload(path, file, { upsert: true })
    if (error) throw error
    // Signed URL con 24h expiry (documentos privados)
    const { data: signed } = await supabase.storage
      .from('certifications')
      .createSignedUrl(path, 86400)
    return signed?.signedUrl
  },
}
