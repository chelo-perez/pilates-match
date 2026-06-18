// src/types/database.ts
// Auto-generado desde el schema de Supabase

export type UserRole = 'estudio' | 'instructor' | 'camara_admin'
export type VerificationStatus = 'pendiente' | 'verificado' | 'rechazado' | 'inactivo'
export type MembershipStatus = 'activa' | 'vencida' | 'cancelada'
export type ClassType = 'regular' | 'reemplazo'
export type MatchStatus = 'pendiente' | 'aceptado' | 'rechazado' | 'expirado' | 'cancelado'
export type DayOfWeek = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
export type Specialty = 'mat' | 'reformer' | 'cadillac' | 'chair' | 'barrel' | 'prenatal' | 'terapeutico' | 'adultos_mayores'
export type SpecialtyLevel = 'basico' | 'intermedio' | 'avanzado'
export type MatchTariffStatus = 'ok' | 'parcial' | 'sin_match'

// ── Database row types ──────────────────────────────────────

export interface User {
  id: string
  email: string
  role: UserRole
  camara_id: string | null
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Studio {
  id: string
  user_id: string
  name: string
  description: string | null
  neighborhood: string
  address: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  instagram: string | null
  camara_code: string | null
  is_member: boolean
  member_since: string | null
  created_at: string
  updated_at: string
}

export interface Membership {
  id: string
  studio_id: string
  status: MembershipStatus
  start_date: string
  end_date: string
  monthly_price_ars: number
  matches_used_month: number
  matches_limit: number | null   // null = ilimitado
  last_reset_date: string
  created_at: string
  updated_at: string
}

export interface Instructor {
  id: string
  user_id: string | null
  full_name: string
  dni: string | null
  email: string | null
  phone: string | null
  neighborhood: string | null
  bio: string | null
  avatar_url: string | null
  verification_status: VerificationStatus
  verified_at: string | null
  verified_by: string | null
  added_by_studio: string | null
  created_at: string
  updated_at: string
}

export interface Certification {
  id: string
  instructor_id: string
  name: string
  institution: string
  year: number | null
  hours: number | null
  document_url: string | null
  verified: boolean
  verified_at: string | null
  created_at: string
}

export interface InstructorSpecialty {
  id: string
  instructor_id: string
  specialty: Specialty
  level: SpecialtyLevel | null
}

export interface Availability {
  id: string
  instructor_id: string
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
  class_type: ClassType
  is_active: boolean
  created_at: string
}

export interface InstructorZone {
  id: string
  instructor_id: string
  neighborhood: string
}

export interface InstructorRate {
  id: string
  instructor_id: string
  rate_regular: number
  rate_replacement: number
  updated_at: string
}

export interface StudioBudget {
  id: string
  studio_id: string
  max_regular: number
  max_replacement: number
  updated_at: string
}

export interface Evaluation {
  id: string
  studio_id: string
  instructor_id: string
  class_type: ClassType
  class_date: string
  score_technique: number
  score_punctuality: number
  score_student_care: number
  score_presentation: number
  average_score: number
  comment: string | null
  created_at: string
}

export interface Match {
  id: string
  studio_id: string
  instructor_id: string
  class_type: ClassType
  class_date: string
  start_time: string
  end_time: string
  status: MatchStatus
  note_studio: string | null
  note_instructor: string | null
  agreed_rate: number | null
  created_at: string
  responded_at: string | null
  expires_at: string
}

export interface RateRange {
  id: string
  class_type: ClassType
  min_ars: number
  max_ars: number
  updated_at: string
  updated_by: string | null
}

// ── Extended / joined types ─────────────────────────────────

export interface InstructorStats {
  total_evaluations: number
  avg_score: number
  avg_technique: number
  avg_punctuality: number
  avg_student_care: number
  avg_presentation: number
}

export interface InstructorWithDetails extends Instructor {
  certifications: Certification[]
  specialties: InstructorSpecialty[]
  availability: Availability[]
  zones: InstructorZone[]
  rates: InstructorRate | null
  stats: InstructorStats | null
}

export interface InstructorSearchResult extends Instructor {
  stats: InstructorStats | null
  specialties: InstructorSpecialty[]
  zones: InstructorZone[]
  rates: InstructorRate | null
  tariff_status_regular: MatchTariffStatus
  tariff_status_replacement: MatchTariffStatus
  distance_km: number | null
}

export interface EvaluationWithStudio extends Evaluation {
  studio: Pick<Studio, 'id' | 'name' | 'neighborhood'>
}

export interface EvaluationWithInstructor extends Evaluation {
  instructor: Pick<Instructor, 'id' | 'full_name' | 'avatar_url'>
}

export interface StudioWithMembership extends Studio {
  membership: Membership | null
}

// ── Form types ──────────────────────────────────────────────

export interface CreateEvaluationDTO {
  instructor_id: string
  class_type: ClassType
  class_date: string
  score_technique: number
  score_punctuality: number
  score_student_care: number
  score_presentation: number
  comment?: string
}

export interface CreateMatchDTO {
  instructor_id: string
  class_type: ClassType
  class_date: string
  start_time: string
  end_time: string
  note_studio?: string
}

export interface InstructorSearchFilters {
  neighborhood?: string
  day_of_week?: DayOfWeek
  start_time?: string
  specialties?: Specialty[]
  min_score?: number
  class_type?: ClassType
  has_tariff_match?: boolean
}

export interface UpdateRatesDTO {
  rate_regular: number
  rate_replacement: number
}

export interface UpdateBudgetDTO {
  max_regular: number
  max_replacement: number
}
