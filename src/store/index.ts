// src/store/index.ts
// Estado global con Zustand — simple, sin boilerplate

import { create } from 'zustand'
import type { User, Membership, StudioWithMembership } from '../types/database'

// ── Auth Store ──────────────────────────────────────────────
// `user` NO se persiste: la sesión ya la guarda supabase-js y el perfil se
// vuelve a leer al abrir la app. Persistirlo mostraba datos viejos (o de una
// sesión vencida) antes de saber si había sesión.
interface AuthState {
  user: User | null
  session: any | null
  isLoading: boolean
  /** Tiene rol pero todavía no tiene fila en studios/instructors (p. ej. entró con Google). */
  needsOnboarding: boolean
  /** Hay un registro por email en curso: el listener de auth no debe cambiar de pantalla. */
  registering: boolean
  /** Hay sesión pero no se pudo leer el perfil (sin red, etc.). */
  profileError: boolean
  /** Entró desde el mail de "olvidé mi contraseña": hay que pedir la nueva. */
  passwordRecovery: boolean
  setUser: (user: User | null) => void
  setSession: (session: any | null) => void
  setLoading: (loading: boolean) => void
  setNeedsOnboarding: (v: boolean) => void
  setRegistering: (v: boolean) => void
  setProfileError: (v: boolean) => void
  setPasswordRecovery: (v: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  isLoading: true,
  needsOnboarding: false,
  registering: false,
  profileError: false,
  passwordRecovery: false,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  setNeedsOnboarding: (needsOnboarding) => set({ needsOnboarding }),
  setRegistering: (registering) => set({ registering }),
  setProfileError: (profileError) => set({ profileError }),
  setPasswordRecovery: (passwordRecovery) => set({ passwordRecovery }),
  reset: () => set({ user: null, session: null, needsOnboarding: false, registering: false, profileError: false, passwordRecovery: false }),
}))

// ── Studio Store ────────────────────────────────────────────
interface StudioState {
  studio: StudioWithMembership | null
  stats: {
    total_evaluations: number
    avg_score: number
    unique_instructors: number
    pending_evaluations: number
  } | null
  setStudio: (studio: StudioWithMembership | null) => void
  setStats: (stats: any) => void
  updateMembership: (membership: Membership) => void
}

export const useStudioStore = create<StudioState>()((set) => ({
  studio: null,
  stats: null,
  setStudio: (studio) => set({ studio }),
  setStats: (stats) => set({ stats }),
  updateMembership: (membership) =>
    set((state) => ({
      studio: state.studio ? { ...state.studio, membership } : null,
    })),
}))

// ── Search Store ────────────────────────────────────────────
interface SearchState {
  results: any[]
  filters: {
    neighborhood: string
    classType: 'regular' | 'reemplazo' | null
    dayOfWeek: string | null
    minScore: number
    onlyMatches: boolean
  }
  isSearching: boolean
  setResults: (results: any[]) => void
  setFilter: (key: string, value: any) => void
  clearFilters: () => void
  setSearching: (v: boolean) => void
}

const EMPTY_FILTERS: SearchState['filters'] = {
  neighborhood: '',
  classType: null,
  dayOfWeek: null,
  minScore: 0,
  onlyMatches: false,
}

export const useSearchStore = create<SearchState>()((set) => ({
  results: [],
  filters: EMPTY_FILTERS,
  isSearching: false,
  setResults: (results) => set({ results }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  clearFilters: () => set({ filters: EMPTY_FILTERS }),
  setSearching: (isSearching) => set({ isSearching }),
}))
