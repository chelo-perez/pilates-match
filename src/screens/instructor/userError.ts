// src/screens/instructor/userError.ts
// Errores con un mensaje ya pensado para el usuario: se muestran tal cual.
// El resto pasa por humanizeError (mensaje genérico en castellano, detalle a la consola).
import { humanizeError } from '../../lib/errors'

export class UserError extends Error {}

export const errorText = (e: unknown): string =>
  e instanceof UserError ? e.message : humanizeError(e)
