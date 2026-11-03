// src/constants/barrios.ts
// Barrios de CABA: lista única para estudios, instructores y filtros.

export const ZONAS_CABA: { nombre: string; barrios: string[] }[] = [
  { nombre: 'Norte', barrios: ['Belgrano', 'Núñez', 'Colegiales', 'Villa Urquiza', 'Villa Pueyrredón', 'Agronomía', 'Coghlan', 'Saavedra'] },
  { nombre: 'Palermo / Centro-Norte', barrios: ['Palermo', 'Villa Crespo', 'Chacarita', 'Paternal', 'Villa Ortúzar', 'Recoleta'] },
  { nombre: 'Oeste', barrios: ['Caballito', 'Almagro', 'Flores', 'Floresta', 'Monte Castro', 'Villa Real', 'Villa Luro', 'Versalles', 'Liniers', 'Mataderos', 'Villa del Parque', 'Villa Devoto', 'Villa General Mitre', 'Villa Santa Rita', 'Vélez Sarsfield', 'Parque Avellaneda'] },
  { nombre: 'Centro / Este', barrios: ['Balvanera', 'San Cristóbal', 'Monserrat', 'San Nicolás', 'Puerto Madero', 'Retiro', 'Constitución'] },
  { nombre: 'Sur', barrios: ['Boedo', 'Parque Chacabuco', 'Nueva Pompeya', 'Parque Patricios', 'Barracas', 'La Boca', 'San Telmo', 'Villa Lugano', 'Villa Riachuelo', 'Villa Soldati'] },
]

/** Los 48 barrios de CABA, ordenados alfabéticamente. */
export const BARRIOS_CABA: string[] = ZONAS_CABA
  .flatMap(z => z.barrios)
  .sort((a, b) => a.localeCompare(b, 'es'))
