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

-- 3. Table pour les certificats des formateurs
CREATE TABLE IF NOT EXISTS trainer_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  certificate_type VARCHAR(100), -- SST, Habilitation, CACES, etc.
  file_path TEXT,
  file_name VARCHAR(255),
  expiry_date DATE,
  no_expiry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table pour les documents uploadés dans les sessions
CREATE TABLE IF NOT EXISTS session_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL, -- emargement, evaluation, certification_sst, autre
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS
ALTER TABLE trainer_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage trainer certificates" ON trainer_certificates
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage session documents" ON session_documents
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Index pour performance
CREATE INDEX IF NOT EXISTS idx_trainer_certificates_trainer ON trainer_certificates(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_certificates_expiry ON trainer_certificates(expiry_date);
CREATE INDEX IF NOT EXISTS idx_session_documents_session ON session_documents(session_id);

-- 7. Vérification
SELECT 'Tables créées avec succès' AS status;
