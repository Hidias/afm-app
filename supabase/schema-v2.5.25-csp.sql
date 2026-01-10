-- Schema V2.5.25 - CSP, Poste, Départ anticipé, Indicateurs
-- Access Formation - Access Campus
-- Date: 10/01/2026

-- =====================================================
-- 1. FIX ATTENDANCE_TOKEN (sessions existantes)
-- =====================================================
UPDATE sessions
SET attendance_token = encode(gen_random_bytes(32), 'hex')
WHERE attendance_token IS NULL;

-- =====================================================
-- 2. AJOUT CSP ET JOB_TITLE (trainees)
-- =====================================================
ALTER TABLE trainees ADD COLUMN IF NOT EXISTS csp TEXT;
ALTER TABLE trainees ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE trainee_info_sheets ADD COLUMN IF NOT EXISTS csp TEXT;
ALTER TABLE trainee_info_sheets ADD COLUMN IF NOT EXISTS job_title TEXT;

-- =====================================================
-- 3. DÉPART ANTICIPÉ ET SITUATION (session_trainees)
-- =====================================================
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS early_departure BOOLEAN DEFAULT FALSE;
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS departure_date DATE;
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS departure_reason TEXT;
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS situation TEXT;
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS funding_type TEXT;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_session_trainees_early_departure ON session_trainees(early_departure) WHERE early_departure = TRUE;

-- Commentaires
COMMENT ON COLUMN trainees.csp IS 'Catégorie Socio-Professionnelle INSEE';
COMMENT ON COLUMN trainees.job_title IS 'Poste / Fonction du stagiaire';
COMMENT ON COLUMN session_trainees.early_departure IS 'Départ anticipé de la formation';
COMMENT ON COLUMN session_trainees.departure_date IS 'Date du départ anticipé';
COMMENT ON COLUMN session_trainees.departure_reason IS 'Motif du départ anticipé';
