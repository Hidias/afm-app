-- ============================================================
-- MISE À JOUR V2.5 - À exécuter sur base V2.4 existante
-- NE PAS réexécuter si déjà fait
-- ============================================================

-- 1. Ajouter colonnes logo à la table organization (si elle existe) ou créer
-- ============================================================
DO $$ 
BEGIN
    -- Vérifier si organization_settings existe
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'organization_settings') THEN
        CREATE TABLE organization_settings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) DEFAULT 'Access Formation',
            address TEXT DEFAULT '24 rue Kerbleiz',
            postal_code VARCHAR(10) DEFAULT '29900',
            city VARCHAR(100) DEFAULT 'Concarneau',
            phone VARCHAR(20) DEFAULT '06 30 14 54 57',
            email VARCHAR(255) DEFAULT 'contact@accessformation.pro',
            siret VARCHAR(20) DEFAULT '92443619100015',
            nda VARCHAR(50) DEFAULT '53290981029',
            logo_url TEXT,
            logo_base64 TEXT,
            stamp_url TEXT,
            stamp_base64 TEXT,
            reglement_interieur TEXT,
            livret_accueil TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Insérer les données par défaut
        INSERT INTO organization_settings (name) VALUES ('Access Formation');
    ELSE
        -- Ajouter les colonnes si elles n'existent pas
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organization_settings' AND column_name = 'logo_base64') THEN
            ALTER TABLE organization_settings ADD COLUMN logo_base64 TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organization_settings' AND column_name = 'stamp_base64') THEN
            ALTER TABLE organization_settings ADD COLUMN stamp_base64 TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organization_settings' AND column_name = 'reglement_interieur') THEN
            ALTER TABLE organization_settings ADD COLUMN reglement_interieur TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'organization_settings' AND column_name = 'livret_accueil') THEN
            ALTER TABLE organization_settings ADD COLUMN livret_accueil TEXT;
        END IF;
    END IF;
END $$;

-- 2. Ajouter champs courses si manquants
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'pedagogical_methods') THEN
        ALTER TABLE courses ADD COLUMN pedagogical_methods TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'materials') THEN
        ALTER TABLE courses ADD COLUMN materials TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'positioning_questions') THEN
        ALTER TABLE courses ADD COLUMN positioning_questions JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 3. Ajouter champs clients (contact) si manquants
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'contact_name') THEN
        ALTER TABLE clients ADD COLUMN contact_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'contact_function') THEN
        ALTER TABLE clients ADD COLUMN contact_function VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'contact_email') THEN
        ALTER TABLE clients ADD COLUMN contact_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'contact_phone') THEN
        ALTER TABLE clients ADD COLUMN contact_phone VARCHAR(20);
    END IF;
END $$;

-- 4. Ajouter champs stagiaires si manquants
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'trainees' AND column_name = 'social_security_number') THEN
        ALTER TABLE trainees ADD COLUMN social_security_number VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'trainees' AND column_name = 'phone') THEN
        ALTER TABLE trainees ADD COLUMN phone VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'trainees' AND column_name = 'address') THEN
        ALTER TABLE trainees ADD COLUMN address TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'trainees' AND column_name = 'postal_code') THEN
        ALTER TABLE trainees ADD COLUMN postal_code VARCHAR(10);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'trainees' AND column_name = 'city') THEN
        ALTER TABLE trainees ADD COLUMN city VARCHAR(100);
    END IF;
END $$;

-- 5. Créer table indicateurs Qualiopi si n'existe pas
-- ============================================================
CREATE TABLE IF NOT EXISTS qualiopi_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number INTEGER UNIQUE NOT NULL,
    criterion INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    proof_elements TEXT[],
    is_common BOOLEAN DEFAULT true
);

-- Insérer les 32 indicateurs si la table est vide
INSERT INTO qualiopi_indicators (number, criterion, title, is_common) 
SELECT * FROM (VALUES
    (1, 1, 'Diffusion d''une information accessible au public sur les prestations', true),
    (2, 1, 'Diffusion d''indicateurs de résultats adaptés', true),
    (3, 1, 'Taux d''obtention des certifications préparées (si applicable)', false),
    (4, 2, 'Analyse du besoin du bénéficiaire', true),
    (5, 2, 'Définition des objectifs et contenus adaptés', true),
    (6, 2, 'Adéquation contenus/objectifs', true),
    (7, 2, 'Adaptation des parcours aux publics (si applicable)', false),
    (8, 2, 'Procédures de positionnement et d''évaluation', true),
    (9, 3, 'Information des publics sur les conditions d''accueil', true),
    (10, 3, 'Adaptation aux PSH, mobilité et accessibilité', true),
    (11, 3, 'Délais d''accès à la prestation', true),
    (12, 4, 'Engagement des bénéficiaires et prévention des ruptures', true),
    (13, 4, 'Coordination des apprentis (si applicable)', false),
    (14, 4, 'Exercice de la citoyenneté (si applicable)', false),
    (15, 4, 'Parcours d''accompagnement VAE (si applicable)', false),
    (16, 4, 'Respect des règles de présentation à la certification', true),
    (17, 5, 'Moyens humains et techniques mobilisés', true),
    (18, 5, 'Coordination des intervenants internes/externes', true),
    (19, 5, 'Ressources pédagogiques des bénéficiaires', true),
    (20, 5, 'Personnel dédié (si applicable)', false),
    (21, 6, 'Compétences des intervenants', true),
    (22, 6, 'Entretien et développement des compétences', true),
    (23, 7, 'Recueil des appréciations des parties prenantes', true),
    (24, 7, 'Traitement des réclamations et aléas', true),
    (25, 7, 'Traitement des difficultés rencontrées', true),
    (26, 7, 'Mesures d''amélioration continue', true),
    (27, 7, 'Actions correctives issues des évaluations', true),
    (28, 7, 'Veille légale et réglementaire', true),
    (29, 7, 'Veille sur les évolutions métiers', true),
    (30, 7, 'Veille sur les innovations pédagogiques', true),
    (31, 7, 'Actions d''amélioration suite aux veilles', true),
    (32, 7, 'Mise en œuvre de la veille', true)
) AS v(number, criterion, title, is_common)
WHERE NOT EXISTS (SELECT 1 FROM qualiopi_indicators LIMIT 1);

-- 6. Créer table non-conformités si n'existe pas
-- ============================================================
CREATE TABLE IF NOT EXISTS non_conformities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source VARCHAR(50) DEFAULT 'internal' CHECK (source IN ('internal', 'claim', 'audit')),
    severity VARCHAR(20) DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
    root_cause TEXT,
    corrective_actions TEXT,
    preventive_actions TEXT,
    responsible VARCHAR(255),
    due_date DATE,
    closed_at TIMESTAMPTZ,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RLS Policies
-- ============================================================
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_organization" ON organization_settings;
CREATE POLICY "auth_organization" ON organization_settings FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE qualiopi_indicators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_indicators" ON qualiopi_indicators;
CREATE POLICY "public_indicators" ON qualiopi_indicators FOR SELECT USING (true);

ALTER TABLE non_conformities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_nc" ON non_conformities;
CREATE POLICY "auth_nc" ON non_conformities FOR ALL USING (auth.role() = 'authenticated');

-- 8. Storage bucket pour les documents (si pas déjà fait)
-- ============================================================
-- À faire manuellement dans Supabase Dashboard > Storage:
-- Créer bucket "documents" avec accès public

SELECT 'Mise à jour V2.5 terminée !' as message;
