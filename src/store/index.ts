// src/store/index.ts
// Estado global con Zustand — simple, sin boilerplate

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { User, Studio, Membership, Instructor, StudioWithMembership } from '../types/database'

// ── Auth Store ──────────────────────────────────────────────
interface AuthState {
  user: User | null
  session: any | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setSession: (session: any | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isLoading: false,
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => set({ user: null, session: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user }),
    }
  )
)

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

export const useSearchStore = create<SearchState>()((set) => ({
  results: [],
  filters: {
    neighborhood: '',
    classType: null,
    dayOfWeek: null,
    minScore: 0,
    onlyMatches: false,
  },
  isSearching: false,
  setResults: (results) => set({ results }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  clearFilters: () =>
    set({
      filters: {
        neighborhood: '',
        classType: null,
        dayOfWeek: null,
        minScore: 0,
        onlyMatches: false,
      },
    }),
  setSearching: (isSearching) => set({ isSearching }),
}))
