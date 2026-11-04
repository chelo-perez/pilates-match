// src/constants/labels.ts
// Textos para los valores de los enums de la base.
import type { MatchStatus, Specialty, VerificationStatus } from '../types/database'
import { entity } from '../lib/entity'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export const SPECIALTY_LABELS: Record<Specialty | string, string> = {
  mat:             'Mat',
  reformer:        'Reformer',
  cadillac:        'Cadillac',
  chair:           'Chair',
  barrel:          'Barrel',
  prenatal:        'Prenatal',
  terapeutico:     'Terapéutico',
  adultos_mayores: 'Adultos mayores',
}

export const CLASS_TYPE_LABELS: Record<'regular' | 'reemplazo', string> = {
  regular:   'Clase regular',
  reemplazo: 'Reemplazo',
}

export const DAY_LABELS: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
}

export const MATCH_STATUS: Record<MatchStatus | string, { label: string; variant: BadgeVariant }> = {
  pendiente: { label: 'Pendiente', variant: 'warning' },
  aceptado:  { label: 'Aceptada',  variant: 'success' },
  rechazado: { label: 'Rechazada', variant: 'danger' },
  expirado:  { label: 'Vencida',   variant: 'neutral' },
  cancelado: { label: 'Cancelada', variant: 'neutral' },
}

export const VERIFICATION_STATUS: Record<VerificationStatus | string, { label: string; variant: BadgeVariant; message: string }> = {
  pendiente:  { label: 'Pendiente',  variant: 'warning', get message() { return `${entity().La} está revisando tu perfil. Mientras tanto no aparecés en las búsquedas de los estudios.` } },
  verificado: { label: 'Verificado', variant: 'success', get message() { return `Tu perfil está verificado por ${entity().la} y aparece en las búsquedas.` } },
  rechazado:  { label: 'Rechazado',  variant: 'danger',  get message() { return `${entity().La} no pudo verificar tu perfil. Revisá el motivo, corregí tus datos y volvé a enviarlos.` } },
  inactivo:   { label: 'Inactivo',   variant: 'neutral', message: 'Tu perfil está inactivo y no aparece en las búsquedas.' },
}
