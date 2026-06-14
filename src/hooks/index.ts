// src/hooks/index.ts
// Hooks de datos reutilizables con React Query

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore, useStudioStore } from '../store'
import {
  studioAPI, instructorAPI, evaluationAPI, matchAPI, camaraAPI
} from '../lib/api'
import type { CreateEvaluationDTO, CreateMatchDTO, InstructorSearchFilters } from '../types/database'

// ── Auth hooks ──────────────────────────────────────────────
export const useUser = () => useAuthStore((s) => s.user)
export const useIsLoading = () => useAuthStore((s) => s.isLoading)

// ── Studio hooks ────────────────────────────────────────────
export const useMyStudio = () => {
  const setStudio = useStudioStore((s) => s.setStudio)
  return useQuery({
    queryKey: ['my-studio'],
    queryFn: async () => {
      const studio = await studioAPI.getMyStudio()
      setStudio(studio)
      return studio
    },
    staleTime: 5 * 60 * 1000, // 5 min
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
    staleTime: 2 * 60 * 1000,
  })
}

export const useCanMatch = (studioId: string | undefined) =>
  useQuery({
    queryKey: ['can-match', studioId],
    queryFn: () => studioAPI.canMatch(studioId!),
    enabled: !!studioId,
  })

// ── Instructor hooks ────────────────────────────────────────
export const useInstructorSearch = (studioId: string | undefined, filters: InstructorSearchFilters) =>
  useQuery({
    queryKey: ['instructor-search', studioId, filters],
    queryFn: () => instructorAPI.search(studioId!, filters),
    enabled: !!studioId,
    staleTime: 30 * 1000, // 30s — búsquedas son más volátiles
  })

export const useInstructor = (instructorId: string | undefined) =>
  useQuery({
    queryKey: ['instructor', instructorId],
    queryFn: () => instructorAPI.getById(instructorId!),
    enabled: !!instructorId,
    staleTime: 5 * 60 * 1000,
  })

export const usePendingInstructors = () =>
  useQuery({
    queryKey: ['pending-instructors'],
    queryFn: instructorAPI.getPending,
    staleTime: 60 * 1000,
  })

// ── Evaluation hooks ────────────────────────────────────────
export const usePendingEvaluations = (studioId: string | undefined) =>
  useQuery({
    queryKey: ['pending-evaluations', studioId],
    queryFn: () => evaluationAPI.getPendingForStudio(studioId!),
    enabled: !!studioId,
    staleTime: 60 * 1000,
  })

export const useEvaluationHistory = (studioId: string | undefined) =>
  useQuery({
    queryKey: ['evaluation-history', studioId],
    queryFn: () => evaluationAPI.getStudioHistory(studioId!),
    enabled: !!studioId,
  })

export const useInstructorEvaluations = (instructorId: string | undefined, studioId?: string) =>
  useQuery({
    queryKey: ['instructor-evaluations', instructorId, studioId],
    queryFn: () => evaluationAPI.getByInstructor(instructorId!, studioId),
    enabled: !!instructorId,
  })

export const useCreateEvaluation = () => {
  const qc = useQueryClient()
  const studio = useStudioStore((s) => s.studio)

  return useMutation({
    mutationFn: (dto: CreateEvaluationDTO) =>
      evaluationAPI.create(studio!.id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-evaluations'] })
      qc.invalidateQueries({ queryKey: ['evaluation-history'] })
      qc.invalidateQueries({ queryKey: ['studio-stats'] })
      qc.invalidateQueries({ queryKey: ['instructor'] })
    },
  })
}

// ── Match hooks ─────────────────────────────────────────────
export const useCreateMatch = () => {
  const qc = useQueryClient()
  const studio = useStudioStore((s) => s.studio)

  return useMutation({
    mutationFn: (dto: CreateMatchDTO) =>
      matchAPI.create(studio!.id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['can-match'] })
      qc.invalidateQueries({ queryKey: ['my-studio'] })
    },
  })
}

export const useVerifyInstructor = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      instructorAPI.verify(id, approved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-instructors'] })
      qc.invalidateQueries({ queryKey: ['instructor'] })
    },
  })
}

// ── Cámara hooks ────────────────────────────────────────────
export const useCamaraDashboard = () =>
  useQuery({
    queryKey: ['camara-dashboard'],
    queryFn: camaraAPI.getDashboardStats,
    staleTime: 2 * 60 * 1000,
  })

export const useCamaraStudios = () =>
  useQuery({
    queryKey: ['camara-studios'],
    queryFn: camaraAPI.getAllStudios,
    staleTime: 2 * 60 * 1000,
  })

// ── Instructor matches hook ──────────────────────────────────
export const useInstructorMatches = (instructorId: string | undefined, status?: string) =>
  useQuery({
    queryKey: ['instructor-matches', instructorId, status],
    queryFn: async () => {
      let query = (await import('../lib/supabase')).supabase
        .from('matches')
        .select('*, studio:studios(id, name, neighborhood, address, phone)')
        .eq('instructor_id', instructorId!)
        .order('class_date', { ascending: false })

      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
    enabled: !!instructorId,
    refetchInterval: 30_000,
  })

// ── Can studio send proposals ─────────────────────────────────
export const useCanPropose = (studioId: string | undefined) =>
  useQuery({
    queryKey: ['can-propose', studioId],
    queryFn: async () => {
      const { data } = await (await import('../lib/supabase')).supabase
        .rpc('can_studio_send_proposal', { p_studio_id: studioId! })
      return data ?? true
    },
    enabled: !!studioId,
    refetchInterval: 60_000,
  })

// ── Studio evaluations (by instructor) ────────────────────────
export const useInstructorStudioEvals = (instructorId: string | undefined) =>
  useQuery({
    queryKey: ['instructor-studio-evals', instructorId],
    queryFn: async () => {
      const { data, error } = await (await import('../lib/supabase')).supabase
        .from('studio_evaluations')
        .select('*, studio:studios(id, name, neighborhood)')
        .eq('instructor_id', instructorId!)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data ?? []
    },
    enabled: !!instructorId,
  })

// ── Camara reports ────────────────────────────────────────────
export const useCamaraReports = (period: 'month' | 'quarter' | 'year' = 'month') =>
  useQuery({
    queryKey: ['camara-reports', period],
    queryFn: async () => {
      const { camaraAPI } = await import('../lib/api')
      return camaraAPI.getDashboardStats()
    },
    staleTime: 5 * 60_000,
  })
