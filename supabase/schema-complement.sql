-- ============================================================
-- SCHÉMA COMPLÉMENTAIRE - NON-CONFORMITÉS ET PROGRAMMES
-- À exécuter APRÈS le schéma principal
-- ============================================================

-- Ajouter le champ program_url à la table courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS program_url VARCHAR(500);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS program_filename VARCHAR(255);

-- ============================================================
-- TABLE: NON_CONFORMITES (Gestion des non-conformités Qualiopi)
-- ============================================================
CREATE TABLE IF NOT EXISTS non_conformites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Source de la NC
    source VARCHAR(30) NOT NULL CHECK (source IN ('evaluation', 'audit', 'reclamation', 'interne', 'autre')),
    source_id UUID, -- ID de l'évaluation, réclamation, etc.
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    
    -- Description
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    critere_qualiopi VARCHAR(50), -- Ex: "Critère 7.1", "Indicateur 22"
    
    -- Gravité et statut
    severity VARCHAR(20) DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    
    -- Analyse
    cause_analysis TEXT, -- Analyse des causes (5 pourquoi, Ishikawa, etc.)
    
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
CREATE POLICY "auth_nc" ON non_conformites FOR ALL USING (auth.role() = 'authenticated');

-- Trigger updated_at
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
CREATE POLICY "auth_uploaded_docs" ON uploaded_documents FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- VUE: Évaluations avec alertes (pour détection NC)
-- ============================================================
CREATE OR REPLACE VIEW evaluation_alerts AS
SELECT 
    qr.id as response_id,
    qr.session_id,
    qr.trainee_id,
    qr.answers,
    qr.completed_at,
    s.reference as session_reference,
    c.title as course_title,
    t.first_name || ' ' || t.last_name as trainee_name,
    -- Calcul du score moyen si les réponses sont numériques (1-5)
    CASE 
        WHEN jsonb_typeof(qr.answers) = 'object' THEN
            (SELECT AVG(value::numeric) FROM jsonb_each_text(qr.answers) WHERE value ~ '^[0-9]+$')
        ELSE NULL
    END as average_score
FROM questionnaire_responses qr
LEFT JOIN sessions s ON qr.session_id = s.id
LEFT JOIN courses c ON s.course_id = c.id
LEFT JOIN trainees t ON qr.trainee_id = t.id
WHERE qr.is_completed = true;
