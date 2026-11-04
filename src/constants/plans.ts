// src/constants/plans.ts
import type { Membership } from '../types/database'

export type PlanKey = 'freemium' | 'starter' | 'socio' | 'premium'

/** limit: propuestas por mes (null = ilimitado). Solo 'socio' marca is_member. */
export const PLANS: { key: PlanKey; label: string; limit: number | null }[] = [
  { key: 'freemium', label: 'Freemium',     limit: 1 },
  { key: 'starter',  label: 'Starter',      limit: 5 },
  { key: 'socio',    label: 'Socio',       limit: 5 },
  { key: 'premium',  label: 'Premium',      limit: null },
]

export function planLabel(key: string | null | undefined): string {
  return PLANS.find(p => p.key === key)?.label ?? 'Freemium'
}

/** Propuestas usadas este mes: 0 si el último reinicio es de un mes anterior. */
export function usedThisMonth(m: Pick<Membership, 'matches_used_month' | 'last_reset_date'> | null | undefined): number {
  if (!m) return 0
  if (m.last_reset_date) {
    const [y, mo] = m.last_reset_date.split('-').map(Number)
    const now = new Date()
    if (y < now.getFullYear() || (y === now.getFullYear() && mo - 1 < now.getMonth())) return 0
  }
  return m.matches_used_month ?? 0
}
