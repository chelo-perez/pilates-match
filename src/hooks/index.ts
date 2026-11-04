// src/hooks/index.ts
// Hooks de datos reutilizables con React Query.
// Las claves incluyen el userId cuando los datos dependen de quién está logueado.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore, useStudioStore } from '../store'
import { supabase } from '../lib/supabase'
import { studioAPI, instructorAPI, evaluationAPI, matchAPI } from '../lib/api'
import type { CreateEvaluationDTO, CreateMatchDTO } from '../types/database'

const useUserId = () => useAuthStore((s) => s.user?.id)

// ── Studio ──────────────────────────────────────────────────
/** Estudio del usuario logueado con su membresía. `data` es null si todavía no existe. */
export const useMyStudio = () => {
  const userId = useUserId()
  const setStudio = useStudioStore((s) => s.setStudio)
  return useQuery({
    queryKey: ['my-studio', userId],
    queryFn: async () => {
      const studio = await studioAPI.getMyStudio(userId)
      setStudio(studio)
      return studio
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  })
}

export const useStudioStats = (studioId: string | undefined) => {
  const setStats = useStudioStore((s) => s.setStats)
  return useQuery({
    queryKey: ['studio-stats', studioId],
    queryFn: async () => {
      const stats = await studioAPI.getStats(studioId!)
      setStats(stats)
      return stats
    },
    enabled: !!studioId,
    staleTime: 60 * 1000,
  })
}

export const useCanMatch = (studioId: string | undefined) =>
  useQuery({
    queryKey: ['can-match', studioId],
    queryFn: () => studioAPI.canMatch(studioId!),
    enabled: !!studioId,
  })

// ── Instructor ──────────────────────────────────────────────
/** Perfil de instructor del usuario logueado. `data` es null si todavía no existe. */
export const useMyInstructor = () => {
  const userId = useUserId()
  return useQuery({
    queryKey: ['my-instructor', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructors')
        .select('*, certifications(*), specialties:instructor_specialties(*), rates:instructor_rates(*), zones:instructor_zones(*)')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const rates = Array.isArray((data as any).rates) ? ((data as any).rates[0] ?? null) : (data as any).rates
      return { ...(data as any), rates }
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  })
}

/** Perfil de un instructor (con certificados, zonas, tarifas y stats). */
export const useInstructor = (instructorId: string | undefined) =>
  useQuery({
    queryKey: ['instructor', instructorId],
    queryFn: () => instructorAPI.getById(instructorId!),
    enabled: !!instructorId,
    staleTime: 5 * 60 * 1000,
  })

// ── Evaluaciones ────────────────────────────────────────────
export const useEvaluationHistory = (studioId: string | undefined) =>
  useQuery({
    queryKey: ['evaluation-history', studioId],
    queryFn: () => evaluationAPI.getStudioHistory(studioId!),
    enabled: !!studioId,
  })

export const useCreateEvaluation = () => {
  const qc = useQueryClient()
  const studio = useStudioStore((s) => s.studio)
  return useMutation({
    mutationFn: (dto: CreateEvaluationDTO) => {
      if (!studio?.id) throw new Error('No encontramos tu estudio')
      return evaluationAPI.create(studio.id, dto)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-evaluations'] })
      qc.invalidateQueries({ queryKey: ['evaluation-history'] })
      qc.invalidateQueries({ queryKey: ['studio-stats'] })
      qc.invalidateQueries({ queryKey: ['instructor'] })
      qc.invalidateQueries({ queryKey: ['instructor-detail'] })
      qc.invalidateQueries({ queryKey: ['camara-instructors'] })
    },
  })
}

// ── Matches ─────────────────────────────────────────────────
export const useCreateMatch = () => {
  const qc = useQueryClient()
  const studio = useStudioStore((s) => s.studio)
  return useMutation({
    mutationFn: (dto: CreateMatchDTO) => {
      if (!studio?.id) throw new Error('No encontramos tu estudio')
      return matchAPI.create(studio.id, dto)
    },
    onSettled: () => {
      // También al fallar por límite: el contador pudo haber cambiado
      qc.invalidateQueries({ queryKey: ['can-match'] })
      qc.invalidateQueries({ queryKey: ['my-studio'] })
      qc.invalidateQueries({ queryKey: ['studio-history-recent'] })
      qc.invalidateQueries({ queryKey: ['studio-matches'] })
      qc.invalidateQueries({ queryKey: ['studio-membership'] })
      qc.invalidateQueries({ queryKey: ['studio-stats'] })
    },
  })
}

// ── Invalidación del perfil de instructor ───────────────────
/** Llamar después de tocar certificados, datos o verificación de un instructor. */
export function invalidateInstructorProfile(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['my-instructor'] })
  qc.invalidateQueries({ queryKey: ['instructor'] })
  qc.invalidateQueries({ queryKey: ['instructor-detail'] })
  qc.invalidateQueries({ queryKey: ['camara-instructors'] })
}

// ── Notificaciones (campanita) ──────────────────────────────
// La key empieza con 'notifications': al llegar un aviso con la app abierta se invalida.
export const useNotificationsList = () => {
  const userId = useUserId()
  return useQuery({
    queryKey: ['notifications', userId, 'list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications').select('*')
        .order('created_at', { ascending: false }).limit(60)
      if (error) throw error
      return data ?? []
    },
    enabled: !!userId,
  })
}

export const useUnreadNotifications = () => {
  const userId = useUserId()
  const { data } = useQuery({
    queryKey: ['notifications', userId, 'unread'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
      if (error) return 0 // si la tabla todavía no existe, la campanita queda sin número
      return count ?? 0
    },
    enabled: !!userId,
    refetchInterval: 60_000,
  })
  return data ?? 0
}
