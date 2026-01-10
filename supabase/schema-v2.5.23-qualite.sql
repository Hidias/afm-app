-- Migration V2.5.23 : Documents Qualité et Programme formations
-- À exécuter dans Supabase SQL Editor

-- ========================================
-- 1. Table pour stocker les documents qualité éditables
-- ========================================
CREATE TABLE IF NOT EXISTS quality_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id VARCHAR(50) UNIQUE NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  content JSONB DEFAULT '{}',
  version VARCHAR(10) DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_quality_documents_doc_id ON quality_documents(doc_id);
CREATE INDEX IF NOT EXISTS idx_quality_documents_code ON quality_documents(code);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_quality_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_quality_documents_updated_at ON quality_documents;
CREATE TRIGGER trigger_quality_documents_updated_at
  BEFORE UPDATE ON quality_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_quality_documents_updated_at();

-- ========================================
-- 2. Colonne programme PDF pour les formations
-- ========================================
ALTER TABLE courses ADD COLUMN IF NOT EXISTS program_url TEXT;
COMMENT ON COLUMN courses.program_url IS 'URL du programme PDF de la formation';

-- ========================================
-- 3. Table registre veille réglementaire
-- ========================================
CREATE TABLE IF NOT EXISTS veille_reglementaire (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_veille DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'legal', 'reglementaire', 'pedagogique', 'metier'
  titre VARCHAR(500) NOT NULL,
  description TEXT,
  impact TEXT,
  action_requise TEXT,
  responsable VARCHAR(100),
  date_application DATE,
  statut VARCHAR(20) DEFAULT 'a_traiter', -- 'a_traiter', 'en_cours', 'traite', 'sans_objet'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_veille_date ON veille_reglementaire(date_veille DESC);
CREATE INDEX IF NOT EXISTS idx_veille_statut ON veille_reglementaire(statut);

-- ========================================
-- 4. Table registre traitements RGPD
-- ========================================
CREATE TABLE IF NOT EXISTS rgpd_traitements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_traitement VARCHAR(255) NOT NULL,
  finalite TEXT NOT NULL,
  base_legale VARCHAR(100) NOT NULL, -- 'consentement', 'contrat', 'obligation_legale', 'interet_legitime'
  categories_personnes TEXT[], -- ['stagiaires', 'clients', 'formateurs']
  categories_donnees TEXT[], -- ['identite', 'contact', 'formation', 'evaluation']
  destinataires TEXT[],
  transfert_hors_ue BOOLEAN DEFAULT FALSE,
  duree_conservation VARCHAR(100),
  mesures_securite TEXT,
  responsable VARCHAR(100),
  date_creation DATE DEFAULT CURRENT_DATE,
  date_mise_a_jour DATE DEFAULT CURRENT_DATE,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les traitements standards
INSERT INTO rgpd_traitements (nom_traitement, finalite, base_legale, categories_personnes, categories_donnees, destinataires, duree_conservation, mesures_securite, responsable) VALUES
('Gestion des stagiaires', 'Suivi des formations, émargement, évaluations, attestations', 'contrat', ARRAY['stagiaires'], ARRAY['identite', 'contact', 'presence', 'evaluations'], ARRAY['Direction', 'Formateurs', 'OPCO/Financeurs'], '5 ans après dernière formation', 'Accès restreint, chiffrement, sauvegardes', 'Hicham SAIDI'),
('Gestion commerciale', 'Prospection, devis, facturation, suivi client', 'contrat', ARRAY['clients', 'prospects'], ARRAY['identite', 'contact', 'historique_commandes'], ARRAY['Direction'], '5 ans après dernière commande', 'Accès restreint Sellsy', 'Hicham SAIDI'),
('Gestion des formateurs', 'Suivi des compétences, planning, rémunération', 'contrat', ARRAY['formateurs'], ARRAY['identite', 'contact', 'qualifications', 'planning'], ARRAY['Direction'], 'Durée collaboration + 5 ans', 'Accès restreint', 'Hicham SAIDI')
ON CONFLICT DO NOTHING;

-- ========================================
-- 5. Table audits internes
-- ========================================
CREATE TABLE IF NOT EXISTS audits_internes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_audit DATE NOT NULL,
  auditeur VARCHAR(100) NOT NULL,
  processus_audite VARCHAR(255) NOT NULL,
  indicateurs_qualiopi VARCHAR(50), -- ex: '1-4', '9-11'
  constats_positifs TEXT,
  points_amelioration TEXT,
  non_conformites TEXT,
  actions_decidees TEXT,
  conclusion TEXT,
  date_prochaine_action DATE,
  statut VARCHAR(20) DEFAULT 'planifie', -- 'planifie', 'realise', 'cloture'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 6. Table revues de direction
-- ========================================
CREATE TABLE IF NOT EXISTS revues_direction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_reunion DATE NOT NULL,
  participants TEXT NOT NULL,
  bilan_formations JSONB, -- {sessions: x, stagiaires: x, taux_reussite: x}
  bilan_satisfaction JSONB, -- {score_moyen: x, taux_recommandation: x}
  bilan_reclamations JSONB, -- {nombre: x, delai_moyen: x}
  bilan_nc JSONB, -- {nombre: x, cloturees: x}
  objectifs_atteints TEXT,
  decisions_actions TEXT,
  objectifs_annee TEXT,
  pv_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 7. RLS Policies
-- ========================================
ALTER TABLE quality_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_reglementaire ENABLE ROW LEVEL SECURITY;
ALTER TABLE rgpd_traitements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits_internes ENABLE ROW LEVEL SECURITY;
ALTER TABLE revues_direction ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "quality_documents_all" ON quality_documents;
DROP POLICY IF EXISTS "veille_all" ON veille_reglementaire;
DROP POLICY IF EXISTS "rgpd_all" ON rgpd_traitements;
DROP POLICY IF EXISTS "audits_all" ON audits_internes;
DROP POLICY IF EXISTS "rdd_all" ON revues_direction;

-- Policies pour authenticated users
CREATE POLICY "quality_documents_all" ON quality_documents FOR ALL USING (true);
CREATE POLICY "veille_all" ON veille_reglementaire FOR ALL USING (true);
CREATE POLICY "rgpd_all" ON rgpd_traitements FOR ALL USING (true);
CREATE POLICY "audits_all" ON audits_internes FOR ALL USING (true);
CREATE POLICY "rdd_all" ON revues_direction FOR ALL USING (true);

-- ========================================
-- 8. Vérification
-- ========================================
SELECT 'Tables créées avec succès' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('quality_documents', 'veille_reglementaire', 'rgpd_traitements', 'audits_internes', 'revues_direction');
