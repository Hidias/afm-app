-- Schema V2.5.25 - Ajout CSP, Poste et Fix attendance_token
-- Access Formation - Access Campus
-- Date: 10/01/2026

-- =====================================================
-- 1. FIX ATTENDANCE_TOKEN (IMPORTANT - À EXÉCUTER EN PREMIER)
-- =====================================================

-- Backfill les sessions existantes sans token
UPDATE sessions
SET attendance_token = encode(gen_random_bytes(32), 'hex')
WHERE attendance_token IS NULL;

-- Optionnel : Ajouter un default pour les futures créations (backup si l'app oublie)
-- ALTER TABLE sessions ALTER COLUMN attendance_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

-- =====================================================
-- 2. AJOUT CSP ET JOB_TITLE
-- =====================================================

-- Ajouter colonnes CSP et job_title à la table trainees
ALTER TABLE trainees ADD COLUMN IF NOT EXISTS csp TEXT;
ALTER TABLE trainees ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Ajouter colonnes CSP et job_title à la table trainee_info_sheets (si elle existe)
ALTER TABLE trainee_info_sheets ADD COLUMN IF NOT EXISTS csp TEXT;
ALTER TABLE trainee_info_sheets ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Commentaires
COMMENT ON COLUMN trainees.csp IS 'Catégorie Socio-Professionnelle INSEE';
COMMENT ON COLUMN trainees.job_title IS 'Poste / Fonction du stagiaire';
