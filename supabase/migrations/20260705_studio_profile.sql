-- Agregar campos de perfil al estudio para el sistema de match

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS equipment   text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS budget_regular     integer  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS budget_replacement integer  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bio         text     DEFAULT NULL;

COMMENT ON COLUMN studios.equipment           IS 'Equipamiento disponible: reformer, cadillac, mat, chair, barrel, tower';
COMMENT ON COLUMN studios.budget_regular      IS 'Presupuesto máximo por hora para clase regular (ARS)';
COMMENT ON COLUMN studios.budget_replacement  IS 'Presupuesto máximo por hora para reemplazo (ARS)';

-- Logo para estudios y cámaras
ALTER TABLE studios ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL;
ALTER TABLE camaras ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL;
