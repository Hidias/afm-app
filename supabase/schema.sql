-- ============================================================
-- SCHÉMA DE BASE DE DONNÉES POUR AFM (Access Formation Manager)
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- Activer l'extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: CLIENTS
-- ============================================================
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    siret VARCHAR(14),
    address TEXT,
    postal_code VARCHAR(10),
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'France',
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(500),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: COURSES (Formations)
-- ============================================================
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    objectives TEXT,
    prerequisites TEXT,
    program TEXT,
    duration_hours DECIMAL(5,1) NOT NULL,
    modality VARCHAR(20) DEFAULT 'presential' CHECK (modality IN ('presential', 'remote', 'hybrid')),
    certification VARCHAR(255),
    rncp_code VARCHAR(20),
    price_ht DECIMAL(10,2),
    min_trainees INTEGER DEFAULT 1,
    max_trainees INTEGER DEFAULT 12,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: TRAINERS (Formateurs)
-- ============================================================
CREATE TABLE trainers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    specialties TEXT,
    bio TEXT,
    is_internal BOOLEAN DEFAULT true,
    company VARCHAR(255),
    cv_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: TRAINEES (Stagiaires)
-- ============================================================
CREATE TABLE trainees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    birth_date DATE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    has_nir BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: SESSIONS
-- ============================================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference VARCHAR(50) UNIQUE NOT NULL,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME DEFAULT '09:00',
    end_time TIME DEFAULT '17:00',
    location VARCHAR(255),
    room VARCHAR(100),
    is_remote BOOLEAN DEFAULT false,
    remote_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('draft', 'planned', 'in_progress', 'completed', 'cancelled')),
    attendance_token VARCHAR(64) UNIQUE,
    checklist JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: SESSION_TRAINERS (Formateurs par session)
-- ============================================================
CREATE TABLE session_trainers (
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, trainer_id)
);

-- ============================================================
-- TABLE: SESSION_TRAINEES (Stagiaires inscrits)
-- ============================================================
CREATE TABLE session_trainees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    trainee_id UUID NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'confirmed', 'attended', 'partial', 'absent', 'cancelled')),
    quiz_score DECIMAL(5,2),
    quiz_passed BOOLEAN,
    certificate_issued BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (session_id, trainee_id)
);

-- ============================================================
-- TABLE: ATTENDANCES (Émargements)
-- ============================================================
CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    trainee_id UUID NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    period VARCHAR(10) NOT NULL CHECK (period IN ('am', 'pm', 'full')),
    signature_data TEXT,
    signature_hash VARCHAR(100),
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    geolocation JSONB,
    proof_hash VARCHAR(64),
    UNIQUE (session_id, trainee_id, date, period)
);

-- ============================================================
-- TABLE: DOCUMENTS
-- ============================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_type VARCHAR(30) NOT NULL,
    number VARCHAR(50) UNIQUE NOT NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    trainee_id UUID REFERENCES trainees(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'ready' CHECK (status IN ('generating', 'ready', 'error')),
    error_message TEXT,
    file_url VARCHAR(500),
    file_size INTEGER,
    file_hash VARCHAR(64),
    generated_data JSONB DEFAULT '{}',
    retention_until DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- ============================================================
-- TABLE: QUESTIONNAIRES
-- ============================================================
CREATE TABLE questionnaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    q_type VARCHAR(20) NOT NULL CHECK (q_type IN ('hot', 'cold', 'custom')),
    title VARCHAR(255) NOT NULL,
    questions JSONB NOT NULL DEFAULT '[]',
    auto_send BOOLEAN DEFAULT false,
    send_delay_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: QUESTIONNAIRE_RESPONSES
-- ============================================================
CREATE TABLE questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    trainee_id UUID REFERENCES trainees(id) ON DELETE SET NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    answers JSONB DEFAULT '{}',
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    reminder_sent_at TIMESTAMPTZ
);

-- ============================================================
-- INDEX
-- ============================================================
CREATE INDEX idx_sessions_dates ON sessions(start_date, end_date);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_token ON sessions(attendance_token);
CREATE INDEX idx_attendances_session ON attendances(session_id);
CREATE INDEX idx_attendances_date ON attendances(date);
CREATE INDEX idx_documents_session ON documents(session_id);
CREATE INDEX idx_documents_type ON documents(doc_type);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Activer RLS sur toutes les tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_trainees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- Politiques pour les utilisateurs authentifiés
-- (accès complet pour les utilisateurs connectés)
CREATE POLICY "Authenticated users can do everything" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON courses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON trainers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON trainees FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON sessions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON session_trainers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON session_trainees FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON documents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can do everything" ON questionnaires FOR ALL USING (auth.role() = 'authenticated');

-- Politiques pour l'émargement public (accès via token)
CREATE POLICY "Public attendance access" ON sessions FOR SELECT USING (attendance_token IS NOT NULL);
CREATE POLICY "Public attendance access" ON session_trainees FOR SELECT USING (true);
CREATE POLICY "Public attendance access" ON trainees FOR SELECT USING (true);
CREATE POLICY "Public attendance insert" ON attendances FOR INSERT WITH CHECK (true);
CREATE POLICY "Public attendance select" ON attendances FOR SELECT USING (true);

-- Politiques pour les questionnaires publics
CREATE POLICY "Public questionnaire access" ON questionnaire_responses FOR ALL USING (true);

-- ============================================================
-- TRIGGER: Updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_trainers_updated_at BEFORE UPDATE ON trainers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_trainees_updated_at BEFORE UPDATE ON trainees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
