// src/lib/api.ts
// Capa de servicios: consultas a Supabase que comparten varias pantallas.
// Toda función revisa `error` y lo tira; la pantalla lo muestra con humanizeError().

import { supabase, db } from './supabase'
import { todayISO } from './dates'
import type {
  StudioWithMembership, Evaluation, Match,
  CreateEvaluationDTO, CreateMatchDTO, UpdateRatesDTO,
  InstructorStats, InstructorWithDetails,
} from '../types/database'

// ============================================================
// AUTH
// ============================================================
export const authAPI = {
  getUser: async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    return data.user
  },
}

// ============================================================
// STUDIO
// ============================================================
export const studioAPI = {
  /** El estudio del usuario logueado, con su membresía (null si todavía no lo creó). */
  getMyStudio: async (userId?: string): Promise<StudioWithMembership | null> => {
    const uid = userId ?? (await authAPI.getUser())?.id
    if (!uid) return null
    const { data, error } = await db.studios()
      .select('*, membership:memberships(*)')
      .eq('user_id', uid)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    // memberships.studio_id es UNIQUE → PostgREST devuelve objeto, pero por las dudas
    const m = (data as any).membership
    return { ...(data as any), membership: Array.isArray(m) ? (m[0] ?? null) : (m ?? null) } as StudioWithMembership
  },

  canMatch: async (studioId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('can_studio_match', { p_studio_id: studioId })
    if (error) throw error
    return !!data
  },

  getStats: async (studioId: string) => {
    const [evaluationsRes, pendingRes] = await Promise.all([
      db.evaluations().select('average_score, instructor_id').eq('studio_id', studioId),
      db.matches()
        .select('id', { count: 'exact', head: true })
        .eq('studio_id', studioId)
        .eq('status', 'aceptado')
        .lt('class_date', todayISO()),
    ])
    if (evaluationsRes.error) throw evaluationsRes.error
    if (pendingRes.error) throw pendingRes.error

    const evals = evaluationsRes.data ?? []
    const scores = evals.map(e => Number(e.average_score)).filter(n => Number.isFinite(n))
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

    return {
      total_evaluations: evals.length,
      avg_score: Math.round(avgScore * 10) / 10,
      unique_instructors: new Set(evals.map(e => e.instructor_id)).size,
      // Clases aceptadas ya dictadas menos las evaluadas (aproximado: evaluations no tiene match_id)
      pending_evaluations: Math.max(0, (pendingRes.count ?? 0) - evals.length),
    }
  },
}

// ============================================================
// INSTRUCTOR
// ============================================================
export const instructorAPI = {
  getById: async (instructorId: string): Promise<InstructorWithDetails | null> => {
    const { data, error } = await db.instructors()
      .select(`
        *,
        certifications(*),
        specialties:instructor_specialties(*),
        availability(*),
        zones:instructor_zones(*),
        rates:instructor_rates(*)
      `)
      .eq('id', instructorId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const stats = await instructorAPI.getStats(instructorId)
    const rates = Array.isArray((data as any).rates) ? ((data as any).rates[0] ?? null) : (data as any).rates
    return { ...(data as any), rates, stats } as InstructorWithDetails
  },

  /** Estadísticas de evaluaciones; null si todavía no tiene o si falla (no bloquea la pantalla). */
  getStats: async (instructorId: string): Promise<InstructorStats | null> => {
    const { data, error } = await supabase.rpc('get_instructor_stats', { p_instructor_id: instructorId })
    if (error) {
      if (__DEV__) console.warn('[api] get_instructor_stats', error.message)
      return null
    }
    return (Array.isArray(data) ? data[0] : data) ?? null
  },

  updateRates: async (instructorId: string, rates: UpdateRatesDTO) => {
    const { data, error } = await db.rates()
      .upsert({ instructor_id: instructorId, ...rates, updated_at: new Date().toISOString() }, { onConflict: 'instructor_id' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** La Cámara aprueba o rechaza. `note` queda en verification_note (el instructor la ve). */
  verify: async (instructorId: string, approved: boolean, note?: string | null) => {
    const user = await authAPI.getUser()
    const updates: Record<string, any> = {
      verification_status: approved ? 'verificado' : 'rechazado',
      verified_at: approved ? new Date().toISOString() : null,
      verified_by: approved ? user?.id ?? null : null,
    }
    if (note !== undefined) updates.verification_note = note
    const { data, error } = await db.instructors()
      .update(updates)
      .eq('id', instructorId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** El instructor reclama un perfil que la Cámara cargó; la base valida el DNI. */
  claimProfile: async (instructorId: string, dni: string) => {
    const { data, error } = await supabase.rpc('claim_instructor_profile', {
      p_instructor_id: instructorId, p_dni: dni,
    })
    if (error) throw error
    return data
  },
}

// ============================================================
// EVALUACIONES (estudio → instructor)
// ============================================================
export const evaluationAPI = {
  create: async (studioId: string, dto: CreateEvaluationDTO): Promise<Evaluation> => {
    const { data, error } = await db.evaluations()
      .insert({ studio_id: studioId, ...dto })
      .select()
      .single()
    if (error) throw error
    return data
  },

  getStudioHistory: async (studioId: string, limit = 20) => {
    const { data, error } = await db.evaluations()
      .select('*, instructor:instructors(id, full_name, avatar_url)')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as any[]
  },
}

// ============================================================
// MATCHES (propuestas)
// ============================================================
export const matchAPI = {
  /**
   * Crea la propuesta. El límite del plan lo controla un trigger: si se pasa,
   * el insert falla con 'MATCH_LIMIT_REACHED' (se re-tira como Error con ese mensaje).
   */
  create: async (studioId: string, dto: CreateMatchDTO): Promise<Match> => {
    const row = {
      studio_id: studioId,
      instructor_id: dto.instructor_id,
      class_type: dto.class_type,
      class_date: dto.class_date,
      start_time: dto.start_time,
      end_time: dto.end_time,
      note_studio: dto.note_studio ?? null,
      offered_rate: dto.offered_rate,
      schedule_days: dto.class_type === 'regular' ? (dto.schedule_days ?? null) : null,
      schedule_from: dto.class_type === 'regular' ? (dto.schedule_from ?? null) : null,
      schedule_to: dto.class_type === 'regular' ? (dto.schedule_to ?? null) : null,
      ...(dto.class_type === 'regular' && (dto as any).trial_paid ? { trial_paid: true } : {}),
    }
    const { data, error } = await db.matches().insert(row).select().single()
    if (error) {
      if ((error.message ?? '').includes('MATCH_LIMIT_REACHED')) throw new Error('MATCH_LIMIT_REACHED')
      throw error
    }
    return data
  },

  /** El estudio responde una contraoferta del instructor, o cancela una propuesta pendiente */
  studioRespond: async (matchId: string, status: 'aceptado' | 'rechazado' | 'cancelado') => {
    const { data, error } = await db.matches().update({ status }).eq('id', matchId).eq('status', 'pendiente').select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Esta propuesta ya no está pendiente.')
  },

  getByStudio: async (studioId: string, status?: string) => {
    let query = db.matches()
      .select('*, instructor:instructors(id, full_name, avatar_url, neighborhood, phone, email)')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return data ?? []
  },
}

// ============================================================
// CÁMARA
// ============================================================
export const camaraAPI = {
  updateRateRanges: async (classType: 'regular' | 'reemplazo', min: number, max: number) => {
    const user = await authAPI.getUser()
    const { data, error } = await db.rateRanges()
      .upsert(
        { class_type: classType, min_ars: min, max_ars: max, updated_by: user?.id ?? null, updated_at: new Date().toISOString() },
        { onConflict: 'class_type' },
      )
      .select()
      .single()
    if (error) throw error
    return data
  },
}
