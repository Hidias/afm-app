-- ═══════════════════════════════════════════════════════════════════
-- SCHEMA QUALIOPI V2.5 - Tables pour la gestion qualité
-- À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Table des documents Qualiopi (CGV, Procédures, etc.)
CREATE TABLE IF NOT EXISTS qualiopi_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- cgv, reglement, livret, procedure_reclamation, procedure_veille, procedure_handicap, politique_qualite, charte_deontologie
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche par type
CREATE INDEX IF NOT EXISTS idx_qualiopi_documents_type ON qualiopi_documents(type);

-- Contrainte unique sur le type (un seul document par type)
ALTER TABLE qualiopi_documents DROP CONSTRAINT IF EXISTS unique_doc_type;
ALTER TABLE qualiopi_documents ADD CONSTRAINT unique_doc_type UNIQUE (type);

-- Table des sources de veille (configurables)
CREATE TABLE IF NOT EXISTS veille_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'legale', -- legale, metiers, pedagogique
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des réclamations
CREATE TABLE IF NOT EXISTS reclamations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  trainee_id UUID REFERENCES trainees(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  subject TEXT NOT NULL,
  description TEXT,
  source TEXT, -- stagiaire, client, formateur, autre
  
  status TEXT DEFAULT 'new', -- new, in_progress, resolved, closed
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  
  action_taken TEXT,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les réclamations
CREATE INDEX IF NOT EXISTS idx_reclamations_status ON reclamations(status);
CREATE INDEX IF NOT EXISTS idx_reclamations_created ON reclamations(created_at DESC);

-- Vérifier si veille_qualiopi existe, sinon la créer
CREATE TABLE IF NOT EXISTS veille_qualiopi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'legale', -- legale, metiers, pedagogique
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT,
  sujet TEXT NOT NULL,
  description TEXT,
  action_menee TEXT,
  impact TEXT DEFAULT 'moyen', -- faible, moyen, fort
  statut TEXT DEFAULT 'a_traiter', -- a_traiter, en_cours, traite, archive
  responsable TEXT,
  date_traitement DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour veille
CREATE INDEX IF NOT EXISTS idx_veille_type ON veille_qualiopi(type);
CREATE INDEX IF NOT EXISTS idx_veille_statut ON veille_qualiopi(statut);
CREATE INDEX IF NOT EXISTS idx_veille_date ON veille_qualiopi(date DESC);

-- ═══════════════════════════════════════════════════════════════════
-- DONNÉES INITIALES - Sources de veille par défaut
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO veille_sources (name, url, type, description) VALUES 
  ('INRS', 'https://www.inrs.fr', 'legale', 'Institut National de Recherche et de Sécurité'),
  ('Légifrance', 'https://www.legifrance.gouv.fr', 'legale', 'Service public de diffusion du droit'),
  ('France Compétences', 'https://www.francecompetences.fr', 'legale', 'Autorité nationale de financement et régulation'),
  ('OPPBTP', 'https://www.preventionbtp.fr', 'legale', 'Organisme Professionnel de Prévention du BTP'),
  ('CARIF-OREF Bretagne', 'https://www.gref-bretagne.com', 'metiers', 'Centre Animation Ressources Information Formation'),
  ('Centre Inffo', 'https://www.centre-inffo.fr', 'pedagogique', 'Centre pour le développement de l''information sur la formation')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- POLITIQUES RLS (Row Level Security)
-- ═══════════════════════════════════════════════════════════════════

-- Activer RLS
ALTER TABLE qualiopi_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE reclamations ENABLE ROW LEVEL SECURITY;

-- Policies pour qualiopi_documents
DROP POLICY IF EXISTS "Users can view qualiopi_documents" ON qualiopi_documents;
CREATE POLICY "Users can view qualiopi_documents" ON qualiopi_documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert qualiopi_documents" ON qualiopi_documents;
CREATE POLICY "Users can insert qualiopi_documents" ON qualiopi_documents FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update qualiopi_documents" ON qualiopi_documents;
CREATE POLICY "Users can update qualiopi_documents" ON qualiopi_documents FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete qualiopi_documents" ON qualiopi_documents;
CREATE POLICY "Users can delete qualiopi_documents" ON qualiopi_documents FOR DELETE USING (true);

-- Policies pour veille_sources
DROP POLICY IF EXISTS "Users can view veille_sources" ON veille_sources;
CREATE POLICY "Users can view veille_sources" ON veille_sources FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage veille_sources" ON veille_sources;
CREATE POLICY "Users can manage veille_sources" ON veille_sources FOR ALL USING (true);

-- Policies pour reclamations
DROP POLICY IF EXISTS "Users can view reclamations" ON reclamations;
CREATE POLICY "Users can view reclamations" ON reclamations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage reclamations" ON reclamations;
CREATE POLICY "Users can manage reclamations" ON reclamations FOR ALL USING (true);

-- ═══════════════════════════════════════════════════════════════════
-- FIN DU SCRIPT
-- ═══════════════════════════════════════════════════════════════════
