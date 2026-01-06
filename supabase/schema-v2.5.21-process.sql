-- V2.5.21 - Module Process / Logigrammes
-- Exécuter ce script dans Supabase SQL Editor

-- Table des catégories de process
CREATE TABLE IF NOT EXISTS process_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des responsables
CREATE TABLE IF NOT EXISTS process_responsibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table principale des process
CREATE TABLE IF NOT EXISTS processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- PR-001, PR-002, etc.
  title TEXT NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  category_id UUID REFERENCES process_categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- Table des étapes/formes du process
CREATE TABLE IF NOT EXISTS process_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('start', 'end', 'action', 'decision', 'document', 'subprocess')),
  title TEXT NOT NULL,
  description TEXT,
  responsible_id UUID REFERENCES process_responsibles(id),
  document_id UUID, -- Lien vers documents existants
  delay TEXT, -- Délai indicatif (ex: "J+1", "48h", "Immédiat")
  tool TEXT, -- Outil utilisé (Campus, Sellsy, etc.)
  category_id UUID REFERENCES process_categories(id),
  linked_process_id UUID REFERENCES processes(id), -- Pour les sous-process
  position_x FLOAT DEFAULT 100,
  position_y FLOAT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des connexions entre étapes
CREATE TABLE IF NOT EXISTS process_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
  from_step_id UUID REFERENCES process_steps(id) ON DELETE CASCADE,
  to_step_id UUID REFERENCES process_steps(id) ON DELETE CASCADE,
  label TEXT, -- Pour les décisions: "Oui", "Non"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table historique des versions
CREATE TABLE IF NOT EXISTS process_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  data JSONB NOT NULL, -- Snapshot complet du process
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Insérer les catégories par défaut
INSERT INTO process_categories (name, color) VALUES
  ('Commercial', '#3B82F6'),      -- Bleu
  ('Préparation', '#22C55E'),     -- Vert
  ('Formation', '#EAB308'),       -- Jaune
  ('Post-formation', '#F97316'),  -- Orange
  ('Qualité', '#EF4444')          -- Rouge
ON CONFLICT DO NOTHING;

-- Insérer les responsables par défaut
INSERT INTO process_responsibles (name) VALUES
  ('Hicham'),
  ('Maxime'),
  ('Client'),
  ('Stagiaire'),
  ('Formateur'),
  ('OPCO')
ON CONFLICT DO NOTHING;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_process_steps_process_id ON process_steps(process_id);
CREATE INDEX IF NOT EXISTS idx_process_connections_process_id ON process_connections(process_id);
CREATE INDEX IF NOT EXISTS idx_process_versions_process_id ON process_versions(process_id);

-- RLS Policies
ALTER TABLE process_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_responsibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_versions ENABLE ROW LEVEL SECURITY;

-- Policies pour lecture (tous les utilisateurs authentifiés)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read process_categories') THEN
    CREATE POLICY "Allow read process_categories" ON process_categories FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read process_responsibles') THEN
    CREATE POLICY "Allow read process_responsibles" ON process_responsibles FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read processes') THEN
    CREATE POLICY "Allow read processes" ON processes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read process_steps') THEN
    CREATE POLICY "Allow read process_steps" ON process_steps FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read process_connections') THEN
    CREATE POLICY "Allow read process_connections" ON process_connections FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow read process_versions') THEN
    CREATE POLICY "Allow read process_versions" ON process_versions FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Policies pour écriture
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow write process_categories') THEN
    CREATE POLICY "Allow write process_categories" ON process_categories FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow write process_responsibles') THEN
    CREATE POLICY "Allow write process_responsibles" ON process_responsibles FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow write processes') THEN
    CREATE POLICY "Allow write processes" ON processes FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow write process_steps') THEN
    CREATE POLICY "Allow write process_steps" ON process_steps FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow write process_connections') THEN
    CREATE POLICY "Allow write process_connections" ON process_connections FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow write process_versions') THEN
    CREATE POLICY "Allow write process_versions" ON process_versions FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- CRÉATION DES PROCESS INITIAUX
-- ═══════════════════════════════════════════════════════════════════

-- PR-001: Process Formation Standard
INSERT INTO processes (code, title, description, version, status) 
VALUES ('PR-001', 'Process formation standard', 'Process complet de la demande client à la clôture de formation', 1, 'active')
ON CONFLICT (code) DO NOTHING;

-- PR-002: Traitement des Non-Conformités  
INSERT INTO processes (code, title, description, version, status)
VALUES ('PR-002', 'Traitement des non-conformités', 'Process de gestion et résolution des non-conformités', 1, 'active')
ON CONFLICT (code) DO NOTHING;

-- PR-003: Gestion des Réclamations
INSERT INTO processes (code, title, description, version, status)
VALUES ('PR-003', 'Gestion des réclamations', 'Process de traitement des réclamations clients', 1, 'active')
ON CONFLICT (code) DO NOTHING;
