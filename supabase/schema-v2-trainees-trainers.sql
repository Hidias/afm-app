-- ============================================================
-- AFM V2.0 - MISE À JOUR STAGIAIRES ET FORMATEURS
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Nouveaux champs pour les stagiaires
ALTER TABLE trainees ADD COLUMN IF NOT EXISTS social_security_number VARCHAR(20);
ALTER TABLE trainees ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE trainees ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- 2. Nouveaux champs pour les formateurs
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS specialties TEXT;
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS qualifications TEXT;
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS certification_number VARCHAR(100);

-- 3. Vérification
SELECT 'Champs ajoutés avec succès' AS status;
