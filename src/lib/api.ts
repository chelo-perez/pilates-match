// src/lib/api.ts
// Capa de servicios - toda la lógica de negocio vive aquí
// Los screens y hooks solo llaman funciones de este archivo

import { supabase, db } from './supabase'
import type {
  Instructor, InstructorWithDetails, InstructorSearchResult,
  InstructorSearchFilters, Studio, StudioWithMembership,
  Evaluation, EvaluationWithInstructor, Match,
  CreateEvaluationDTO, CreateMatchDTO,
  UpdateRatesDTO, UpdateBudgetDTO,
  Membership, InstructorStats, MatchTariffStatus
} from '../types/database'

// ============================================================
// AUTH
// ============================================================
export const authAPI = {
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  signUp: async (email: string, password: string, role: string, name: string) => {
    console.log('signUp - URL usada:', supabase.supabaseUrl ?? 'NO URL')
    console.log('signUp - email:', email, 'role:', role)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, full_name: name } }
    })
    console.log('signUp - data:', JSON.stringify(data?.user?.id ?? 'null'))
    console.log('signUp - error:', JSON.stringify(error))
    if (error) throw error
    return data
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  getSession: async () => {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  getUser: async () => {
    const { data } = await supabase.auth.getUser()
    return data.user
  },
}

// ============================================================
// STUDIO
// ============================================================
export const studioAPI = {
  getMyStudio: async (): Promise<StudioWithMembership | null> => {
    const user = await authAPI.getUser()
    if (!user) return null

    const { data: studio, error } = await db.studios()
      .select(`*, membership:memberships(*)`)
      .eq('user_id', user.id)
      .single()

    if (error) throw error
    return studio as StudioWithMembership
  },

  updateStudio: async (studioId: string, updates: Partial<Studio>) => {
    const { data, error } = await db.studios()
      .update(updates)
      .eq('id', studioId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  getMembership: async (studioId: string): Promise<Membership | null> => {
    const { data, error } = await db.memberships()
      .select('*')
      .eq('studio_id', studioId)
      .eq('status', 'activa')
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  getBudget: async (studioId: string) => {
    const { data, error } = await db.budgets()
      .select('*')
      .eq('studio_id', studioId)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  upsertBudget: async (studioId: string, budget: UpdateBudgetDTO) => {
    const { data, error } = await db.budgets()
      .upsert({ studio_id: studioId, ...budget }, { onConflict: 'studio_id' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  canMatch: async (studioId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('can_studio_match', {
      p_studio_id: studioId
    })
    if (error) throw error
    return data
  },

  getStats: async (studioId: string) => {
    const [evaluationsRes, instructorsRes, pendingRes] = await Promise.all([
      db.evaluations().select('average_score', { count: 'exact' }).eq('studio_id', studioId),
      db.evaluations().select('instructor_id').eq('studio_id', studioId),
      // Evaluaciones pendientes: clases recientes sin evaluar
      db.matches()
        .select('*', { count: 'exact' })
        .eq('studio_id', studioId)
        .eq('status', 'aceptado')
        .lt('class_date', new Date().toISOString().split('T')[0])
    ])

    const scores = evaluationsRes.data?.map(e => e.average_score) ?? []
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const uniqueInstructors = new Set(instructorsRes.data?.map(e => e.instructor_id) ?? []).size

    return {
      total_evaluations: evaluationsRes.count ?? 0,
      avg_score: Math.round(avgScore * 10) / 10,
      unique_instructors: uniqueInstructors,
      pending_evaluations: pendingRes.count ?? 0,
    }
  },
}

// ============================================================
// INSTRUCTOR
// ============================================================
export const instructorAPI = {
  search: async (
    studioId: string,
    filters: InstructorSearchFilters = {}
  ): Promise<InstructorSearchResult[]> => {
    let query = db.instructors()
      .select(`
        *,
        specialties:instructor_specialties(specialty, level),
        zones:instructor_zones(neighborhood),
        rates:instructor_rates(rate_regular, rate_replacement),
        availability(day_of_week, start_time, end_time, class_type, is_active)
      `)
      .eq('verification_status', 'verificado')

    if (filters.neighborhood) {
      query = query.contains('zones', [{ neighborhood: filters.neighborhood }])
    }
    if (filters.specialties?.length) {
      query = query.overlaps('specialties.specialty', filters.specialties)
    }

    const { data: instructors, error } = await query
    if (error) throw error
    if (!instructors?.length) return []

    // Obtener presupuesto del estudio para calcular match de tarifas
    const budget = await studioAPI.getBudget(studioId)

    // Calcular stats y match de tarifas en paralelo
    const results = await Promise.all(
      instructors.map(async (instructor) => {
        const stats = await instructorAPI.getStats(instructor.id)
        const rates = instructor.rates as any

        let tariffRegular: MatchTariffStatus = 'sin_match'
        let tariffReplacement: MatchTariffStatus = 'sin_match'

        if (budget && rates) {
          tariffRegular = rates.rate_regular <= budget.max_regular ? 'ok' : 'sin_match'
          tariffReplacement = rates.rate_replacement <= budget.max_replacement ? 'ok' : 'sin_match'
        }

        return {
          ...instructor,
          stats,
          tariff_status_regular: tariffRegular,
          tariff_status_replacement: tariffReplacement,
          distance_km: null, // TODO: calcular con Google Maps si hay lat/lng del estudio
        } as InstructorSearchResult
      })
    )

    // Filtrar por score mínimo si se pide
    const filtered = filters.min_score
      ? results.filter(r => (r.stats?.avg_score ?? 0) >= filters.min_score!)
      : results

    // Ordenar: match completo primero, luego por score
    return filtered.sort((a, b) => {
      const aScore = (a.tariff_status_regular === 'ok' ? 1 : 0) + (a.tariff_status_replacement === 'ok' ? 1 : 0)
      const bScore = (b.tariff_status_regular === 'ok' ? 1 : 0) + (b.tariff_status_replacement === 'ok' ? 1 : 0)
      if (bScore !== aScore) return bScore - aScore
      return (b.stats?.avg_score ?? 0) - (a.stats?.avg_score ?? 0)
    })
  },

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
      .single()

    if (error) throw error
    const stats = await instructorAPI.getStats(instructorId)
    return { ...data, stats } as InstructorWithDetails
  },

  getStats: async (instructorId: string): Promise<InstructorStats | null> => {
    const { data, error } = await supabase.rpc('get_instructor_stats', {
      p_instructor_id: instructorId
    })
    if (error) return null
    return data?.[0] ?? null
  },

  updateRates: async (instructorId: string, rates: UpdateRatesDTO) => {
    const { data, error } = await db.rates()
      .upsert({ instructor_id: instructorId, ...rates }, { onConflict: 'instructor_id' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  upsertAvailability: async (instructorId: string, slots: Omit<any, 'id' | 'instructor_id' | 'created_at'>[]) => {
    // Borrar y reemplazar disponibilidad
    await db.availability().delete().eq('instructor_id', instructorId)
    if (!slots.length) return []

    const { data, error } = await db.availability()
      .insert(slots.map(s => ({ ...s, instructor_id: instructorId })))
      .select()
    if (error) throw error
    return data
  },

  upsertZones: async (instructorId: string, neighborhoods: string[]) => {
    await db.zones().delete().eq('instructor_id', instructorId)
    if (!neighborhoods.length) return []

    const { data, error } = await db.zones()
      .insert(neighborhoods.map(n => ({ instructor_id: instructorId, neighborhood: n })))
      .select()
    if (error) throw error
    return data
  },

  // Para la Cámara
  getPending: async () => {
    const { data, error } = await db.instructors()
      .select(`*, certifications(*)`)
      .eq('verification_status', 'pendiente')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  verify: async (instructorId: string, approved: boolean) => {
    const user = await authAPI.getUser()
    const { data, error } = await db.instructors()
      .update({
        verification_status: approved ? 'verificado' : 'rechazado',
        verified_at: approved ? new Date().toISOString() : null,
        verified_by: approved ? user?.id : null,
      })
      .eq('id', instructorId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  claimProfile: async (instructorId: string) => {
    // El instructor reclama su perfil ya existente en el directorio
    const user = await authAPI.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await db.instructors()
      .update({ user_id: user.id })
      .eq('id', instructorId)
      .is('user_id', null)  // solo si no tiene dueño
      .select()
      .single()
    if (error) throw error
    return data
  },
}

// ============================================================
// EVALUACIONES
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

  getByInstructor: async (instructorId: string, studioId?: string): Promise<EvaluationWithInstructor[]> => {
    let query = db.evaluations()
      .select(`*, studio:studios(id, name, neighborhood)`)
      .eq('instructor_id', instructorId)
      .order('class_date', { ascending: false })

    if (studioId) query = query.eq('studio_id', studioId)

    const { data, error } = await query
    if (error) throw error
    return data as any
  },

  getPendingForStudio: async (studioId: string) => {
    // Matches aceptados con fecha pasada que no tienen evaluacion
    const { data: completedMatches, error } = await db.matches()
      .select(`*, instructor:instructors(id, full_name, avatar_url)`)
      .eq('studio_id', studioId)
      .eq('status', 'aceptado')
      .lt('class_date', new Date().toISOString().split('T')[0])
      .order('class_date', { ascending: false })
      .limit(20)

    if (error) throw error

    // Filtrar los que ya tienen evaluación
    const evaluated = await db.evaluations()
      .select('instructor_id, class_date')
      .eq('studio_id', studioId)

    const evaluatedSet = new Set(
      evaluated.data?.map(e => `${e.instructor_id}_${e.class_date}`) ?? []
    )

    return completedMatches?.filter(m =>
      !evaluatedSet.has(`${m.instructor_id}_${m.class_date}`)
    ) ?? []
  },

  getStudioHistory: async (studioId: string, limit = 20) => {
    const { data, error } = await db.evaluations()
      .select(`*, instructor:instructors(id, full_name, avatar_url)`)
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data as any
  },
}

// ============================================================
// MATCHES
// ============================================================
export const matchAPI = {
  create: async (studioId: string, dto: CreateMatchDTO): Promise<Match> => {
    // Verificar que el estudio puede hacer match
    const canMatch = await studioAPI.canMatch(studioId)
    if (!canMatch) throw new Error('MATCH_LIMIT_REACHED')

    const { data, error } = await db.matches()
      .insert({ studio_id: studioId, ...dto })
      .select()
      .single()
    if (error) throw error

    // Incrementar contador de matches del mes
    await supabase.rpc('increment_match_counter', { p_studio_id: studioId })

    return data
  },

  getByStudio: async (studioId: string, status?: string) => {
    let query = db.matches()
      .select(`*, instructor:instructors(id, full_name, avatar_url, neighborhood)`)
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return data
  },

  updateStatus: async (matchId: string, status: string, note?: string) => {
    const { data, error } = await db.matches()
      .update({
        status,
        note_instructor: note,
        responded_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .select()
      .single()
    if (error) throw error
    return data
  },
}

// ============================================================
// CÁMARA
// ============================================================
export const camaraAPI = {
  getDashboardStats: async () => {
    const [studiosRes, instructorsRes, pendingRes, membersRes] = await Promise.all([
      db.studios().select('*', { count: 'exact', head: true }),
      db.instructors().select('*', { count: 'exact', head: true }).eq('verification_status', 'verificado'),
      db.instructors().select('*', { count: 'exact', head: true }).eq('verification_status', 'pendiente'),
      db.studios().select('*', { count: 'exact', head: true }).eq('is_member', true),
    ])

    return {
      total_studios: studiosRes.count ?? 0,
      verified_instructors: instructorsRes.count ?? 0,
      pending_verifications: pendingRes.count ?? 0,
      member_studios: membersRes.count ?? 0,
      non_member_studios: (studiosRes.count ?? 0) - (membersRes.count ?? 0),
    }
  },

  getAllStudios: async () => {
    const { data, error } = await db.studios()
      .select(`*, membership:memberships(status, end_date, matches_used_month)`)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  updateRateRanges: async (classType: string, min: number, max: number) => {
    const user = await authAPI.getUser()
    const { data, error } = await db.rateRanges()
      .upsert(
        { class_type: classType, min_ars: min, max_ars: max, updated_by: user?.id },
        { onConflict: 'class_type' }
      )
      .select()
      .single()
    if (error) throw error
    return data
  },

  addInstructor: async (instructorData: Omit<Instructor, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await db.instructors()
      .insert(instructorData)
      .select()
      .single()
    if (error) throw error
    return data
  },
}

// ============================================================
// NOTIFICACIONES (Expo Push)
// ============================================================
export const notificationAPI = {
  registerToken: async (userId: string, token: string) => {
    await supabase.from('push_tokens').upsert({ user_id: userId, token }, { onConflict: 'user_id' })
  },

  sendMatchNotification: async (matchId: string) => {
    // Llamar Edge Function que envía la push notification
    await supabase.functions.invoke('send-match-notification', { body: { match_id: matchId } })
  },
}


// ============================================================
// INSTRUCTOR — matches recibidos (agregado en refactor)
// ============================================================
// (ver matchAPI.updateStatus que ya existe — se reutiliza desde MatchesScreen)
