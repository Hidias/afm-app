-- Schema V2.5.25 - Alignement Qualiopi
-- Access Formation - Access Campus
-- Date: 10/01/2026

-- =====================================================
-- TABLE TRAINEES - Ajout champs Qualiopi
-- =====================================================

-- CSP - Catégorie Socio-Professionnelle (INSEE)
ALTER TABLE trainees ADD COLUMN IF NOT EXISTS csp TEXT;

-- Poste / Fonction (texte libre)
ALTER TABLE trainees ADD COLUMN IF NOT EXISTS job_title TEXT;

-- =====================================================
-- TABLE TRAINEE_INFO_SHEETS - Ajout champs portail
-- =====================================================

-- Vérifier si la table existe, sinon la créer
CREATE TABLE IF NOT EXISTS trainee_info_sheets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
  email TEXT,
  ssn TEXT,
  ssn_refused BOOLEAN DEFAULT false,
  last_training_year INTEGER,
  highest_diploma TEXT,
  rgpd_consent BOOLEAN DEFAULT false,
  rgpd_consent_date TIMESTAMPTZ,
  filled_at TIMESTAMPTZ,
  filled_online BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, trainee_id)
);

-- CSP saisi par le stagiaire
ALTER TABLE trainee_info_sheets ADD COLUMN IF NOT EXISTS csp TEXT;

-- Poste saisi par le stagiaire
ALTER TABLE trainee_info_sheets ADD COLUMN IF NOT EXISTS job_title TEXT;

-- =====================================================
-- TABLE SESSION_TRAINEES - Ajout champs session
-- =====================================================

-- Situation à l'entrée de la formation
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS situation TEXT;
-- Valeurs: 'cdi', 'cdd', 'interim', 'demandeur_emploi', 'independant', 'autre'

-- Type de financement
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS funding_type TEXT;
-- Valeurs: 'opco', 'cpf', 'employeur', 'personnel', 'pole_emploi', 'autre'

-- Départ anticipé
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS early_departure BOOLEAN DEFAULT false;
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS departure_date DATE;
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS departure_reason TEXT;

-- Résultat (si pas déjà présent)
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS result TEXT;
-- Valeurs: 'acquired', 'not_acquired', 'in_progress'

-- Présence complète (si pas déjà présent)
ALTER TABLE session_trainees ADD COLUMN IF NOT EXISTS presence_complete BOOLEAN DEFAULT false;

-- =====================================================
-- INDEX pour performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_session_trainees_early_departure ON session_trainees(early_departure) WHERE early_departure = true;
CREATE INDEX IF NOT EXISTS idx_session_trainees_situation ON session_trainees(situation);
CREATE INDEX IF NOT EXISTS idx_session_trainees_funding ON session_trainees(funding_type);

-- =====================================================
-- RLS (si nécessaire)
-- =====================================================
ALTER TABLE trainee_info_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trainee_info_sheets_all" ON trainee_info_sheets;
CREATE POLICY "trainee_info_sheets_all" ON trainee_info_sheets FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- COMMENTAIRES
-- =====================================================
COMMENT ON COLUMN trainees.csp IS 'Catégorie Socio-Professionnelle INSEE';
COMMENT ON COLUMN trainees.job_title IS 'Poste / Fonction du stagiaire';
COMMENT ON COLUMN session_trainees.situation IS 'Situation à l''entrée: cdi, cdd, interim, demandeur_emploi, independant, autre';
COMMENT ON COLUMN session_trainees.funding_type IS 'Type de financement: opco, cpf, employeur, personnel, pole_emploi, autre';
COMMENT ON COLUMN session_trainees.early_departure IS 'Départ anticipé de la formation';
COMMENT ON COLUMN session_trainees.departure_date IS 'Date du départ anticipé';
COMMENT ON COLUMN session_trainees.departure_reason IS 'Motif du départ anticipé';
