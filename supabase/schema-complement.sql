-- ============================================================
-- SCHÉMA COMPLÉMENTAIRE AFM V2
-- À exécuter APRÈS le schéma principal
-- ============================================================

-- ============================================================
-- MODIFICATIONS TABLE COURSES (Formations)
-- ============================================================
-- Tarif de la formation
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_ht DECIMAL(10,2);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_ttc DECIMAL(10,2);

-- Prérequis et public concerné (si pas déjà présents)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS prerequisites TEXT DEFAULT 'Aucun';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'Tout public';

-- Moyens et modalités pédagogiques
ALTER TABLE courses ADD COLUMN IF NOT EXISTS pedagogical_methods TEXT DEFAULT 'La formation est dispensée selon une pédagogie active et participative : alternance d''apports théoriques, d''exercices pratiques et de mises en situation. Les supports de formation sont remis aux participants.';

-- Modalités de suivi et d'évaluation
ALTER TABLE courses ADD COLUMN IF NOT EXISTS evaluation_methods TEXT DEFAULT 'Évaluation formative pendant la formation (mises en situation, QCM, exercices pratiques). Évaluation sommative en fin de formation.';

-- Documents délivrés
ALTER TABLE courses ADD COLUMN IF NOT EXISTS delivered_documents TEXT DEFAULT 'Une attestation de fin de formation, un certificat de réalisation.';

-- Programme PDF uploadé
ALTER TABLE courses ADD COLUMN IF NOT EXISTS program_file_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS program_file_name VARCHAR(255);

-- ============================================================
-- MODIFICATIONS TABLE CLIENTS (Entreprises)
-- ============================================================
-- Contact principal de l'entreprise
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_function VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);

-- SIRET si pas déjà présent
ALTER TABLE clients ADD COLUMN IF NOT EXISTS siret VARCHAR(20);

-- ============================================================
-- TABLE: NON_CONFORMITES (Gestion des non-conformités Qualiopi)
-- ============================================================
CREATE TABLE IF NOT EXISTS non_conformites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Source de la NC
    source VARCHAR(30) NOT NULL CHECK (source IN ('evaluation', 'audit', 'reclamation', 'interne', 'autre')),
    source_id UUID,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    
    -- Description
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    critere_qualiopi VARCHAR(50),
    
    -- Gravité et statut
    severity VARCHAR(20) DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    
    -- Analyse
    cause_analysis TEXT,
    
    -- Action corrective
    corrective_action TEXT,
    action_responsible VARCHAR(255),
    action_deadline DATE,
    action_completed_at TIMESTAMPTZ,
    
    -- Action préventive
    preventive_action TEXT,
    
    -- Vérification efficacité
    effectiveness_check TEXT,
    effectiveness_verified_at TIMESTAMPTZ,
    effectiveness_verified_by VARCHAR(255),
    
    -- Documents joints
    attachments JSONB DEFAULT '[]',
    
    -- Méta
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Index
CREATE INDEX IF NOT EXISTS idx_nc_status ON non_conformites(status);
CREATE INDEX IF NOT EXISTS idx_nc_session ON non_conformites(session_id);
CREATE INDEX IF NOT EXISTS idx_nc_source ON non_conformites(source);

-- RLS
ALTER TABLE non_conformites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_nc" ON non_conformites;
CREATE POLICY "auth_nc" ON non_conformites FOR ALL USING (auth.role() = 'authenticated');

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_nc_updated_at ON non_conformites;
CREATE TRIGGER update_nc_updated_at BEFORE UPDATE ON non_conformites 
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLE: UPLOADED_DOCUMENTS (Documents uploadés)
-- ============================================================
CREATE TABLE IF NOT EXISTS uploaded_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    category VARCHAR(50) DEFAULT 'other' CHECK (category IN ('programme', 'support', 'convocation', 'attestation', 'autre', 'other')),
    
    -- Relations optionnelles
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    trainee_id UUID REFERENCES trainees(id) ON DELETE SET NULL,
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- Index
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_session ON uploaded_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_course ON uploaded_documents(course_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_category ON uploaded_documents(category);

-- RLS
ALTER TABLE uploaded_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_uploaded_docs" ON uploaded_documents;
CREATE POLICY "auth_uploaded_docs" ON uploaded_documents FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- Mettre à jour org_settings avec le texte NDA complet
-- ============================================================
UPDATE org_settings 
SET nda = '53 29 10412 29 attribué par la DREETS de la Bretagne'
WHERE id IS NOT NULL;
