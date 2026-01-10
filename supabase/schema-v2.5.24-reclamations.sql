-- Schema V2.5.24 - Réclamations, Veille, Corrections
-- Access Formation - Access Campus

-- =====================================================
-- TABLE RECLAMATIONS (complète)
-- =====================================================
DROP TABLE IF EXISTS reclamations CASCADE;

CREATE TABLE reclamations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identification
  reference TEXT UNIQUE, -- REC-YYYY-NNN
  
  -- Source et canal
  source TEXT NOT NULL DEFAULT 'client', -- client, stagiaire, financeur, autre
  canal TEXT NOT NULL DEFAULT 'email', -- email, telephone, courrier, formulaire, autre
  
  -- Contenu
  subject TEXT NOT NULL,
  description TEXT,
  
  -- Lien session (optionnel)
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  
  -- Dates de suivi (pour calcul délais)
  date_reception TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_accuse TIMESTAMPTZ, -- Accusé réception (objectif: 48h)
  date_analyse TIMESTAMPTZ, -- Analyse terminée
  date_resolution TIMESTAMPTZ, -- Solution proposée
  date_cloture TIMESTAMPTZ, -- Clôture (objectif: 5j ouvrés)
  
  -- Traitement
  cause_analysis TEXT,
  solution_proposed TEXT,
  action_taken TEXT,
  preventive_action TEXT,
  
  -- Responsable
  responsable TEXT DEFAULT 'Hicham SAIDI',
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'open', -- open, acknowledged, in_progress, resolved, closed
  
  -- Satisfaction du réclamant
  satisfaction_resolved BOOLEAN, -- Le réclamant est satisfait ?
  
  -- Méta
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_reclamations_status ON reclamations(status);
CREATE INDEX idx_reclamations_date ON reclamations(date_reception);
CREATE INDEX idx_reclamations_reference ON reclamations(reference);

-- Fonction pour générer la référence automatique
CREATE OR REPLACE FUNCTION generate_reclamation_reference()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT;
  seq_num INTEGER;
  new_ref TEXT;
BEGIN
  year_str := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM 'REC-' || year_str || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM reclamations
  WHERE reference LIKE 'REC-' || year_str || '-%';
  
  new_ref := 'REC-' || year_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  NEW.reference := new_ref;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reclamation_reference
  BEFORE INSERT ON reclamations
  FOR EACH ROW
  WHEN (NEW.reference IS NULL)
  EXECUTE FUNCTION generate_reclamation_reference();

-- RLS
ALTER TABLE reclamations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reclamations_all" ON reclamations;
CREATE POLICY "reclamations_all" ON reclamations FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TABLE VEILLE REGLEMENTAIRE (mise à jour)
-- =====================================================
DROP TABLE IF EXISTS veille_reglementaire CASCADE;

CREATE TABLE veille_reglementaire (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identification
  reference TEXT UNIQUE, -- VEILLE-YYYY-NNN
  
  -- Source et type
  source TEXT NOT NULL, -- 'Code du travail', 'INRS', 'Légifrance', etc.
  type_evolution TEXT NOT NULL DEFAULT 'reglementaire', -- reglementaire, normatif, pedagogique
  
  -- Contenu
  titre TEXT NOT NULL,
  description TEXT,
  url_source TEXT,
  
  -- Impact
  impact_af TEXT, -- faible, moyen, fort
  domaines_impactes TEXT[], -- ['SST', 'CACES', 'Incendie', etc.]
  
  -- Actions
  action_requise BOOLEAN DEFAULT false,
  action_description TEXT,
  responsable TEXT,
  delai_mise_a_jour DATE,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'identified', -- identified, analyzed, actioned, archived
  
  -- Dates
  date_veille DATE NOT NULL DEFAULT CURRENT_DATE,
  date_analyse DATE,
  date_mise_a_jour DATE,
  
  -- Méta
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_veille_status ON veille_reglementaire(status);
CREATE INDEX idx_veille_date ON veille_reglementaire(date_veille);

-- Référence automatique
CREATE OR REPLACE FUNCTION generate_veille_reference()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  year_str := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM 'VEILLE-' || year_str || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM veille_reglementaire
  WHERE reference LIKE 'VEILLE-' || year_str || '-%';
  
  NEW.reference := 'VEILLE-' || year_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_veille_reference
  BEFORE INSERT ON veille_reglementaire
  FOR EACH ROW
  WHEN (NEW.reference IS NULL)
  EXECUTE FUNCTION generate_veille_reference();

-- RLS
ALTER TABLE veille_reglementaire ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "veille_all" ON veille_reglementaire;
CREATE POLICY "veille_all" ON veille_reglementaire FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- FONCTION AUDIT LOGS CORRIGÉE
-- =====================================================
CREATE OR REPLACE FUNCTION get_audit_logs(
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL,
  p_from_date TIMESTAMPTZ DEFAULT NULL,
  p_to_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  log_timestamp TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.user_id,
    a.user_email,
    a.action,
    a.entity_type,
    a.entity_id,
    a.entity_name,
    a.details,
    a.ip_address,
    a.user_agent,
    COALESCE(a.timestamp, a.created_at) as log_timestamp
  FROM audit_logs a
  WHERE 
    (p_entity_type IS NULL OR a.entity_type = p_entity_type)
    AND (p_entity_id IS NULL OR a.entity_id = p_entity_id)
    AND (p_action IS NULL OR a.action = p_action)
    AND (p_user_email IS NULL OR a.user_email ILIKE '%' || p_user_email || '%')
    AND (p_from_date IS NULL OR COALESCE(a.timestamp, a.created_at) >= p_from_date)
    AND (p_to_date IS NULL OR COALESCE(a.timestamp, a.created_at) <= p_to_date)
  ORDER BY COALESCE(a.timestamp, a.created_at) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TABLE QUALITY_DOCUMENTS (si pas existe)
-- =====================================================
CREATE TABLE IF NOT EXISTS quality_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id TEXT UNIQUE NOT NULL,
  code TEXT,
  name TEXT,
  content JSONB,
  version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quality_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quality_documents_all" ON quality_documents;
CREATE POLICY "quality_documents_all" ON quality_documents FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- VUE POUR STATISTIQUES RDD
-- =====================================================
CREATE OR REPLACE VIEW rdd_stats AS
SELECT 
  (SELECT COUNT(*) FROM sessions WHERE status = 'completed') as sessions_terminees,
  (SELECT COUNT(*) FROM sessions) as sessions_total,
  (SELECT COUNT(*) FROM session_trainees) as stagiaires_total,
  (SELECT ROUND(AVG(hot_eval_score)::numeric, 1) FROM session_trainees WHERE hot_eval_score IS NOT NULL) as satisfaction_moyenne,
  (SELECT COUNT(*) FROM reclamations) as reclamations_total,
  (SELECT COUNT(*) FROM reclamations WHERE status = 'closed') as reclamations_cloturees,
  (SELECT COUNT(*) FROM non_conformites) as nc_total,
  (SELECT COUNT(*) FROM non_conformites WHERE status = 'closed') as nc_cloturees;

-- =====================================================
-- COMMENTAIRES
-- =====================================================
COMMENT ON TABLE reclamations IS 'Registre des réclamations clients/stagiaires - Qualiopi indicateur 31';
COMMENT ON TABLE veille_reglementaire IS 'Registre de veille légale et réglementaire - Qualiopi indicateurs 23-25';
COMMENT ON TABLE quality_documents IS 'Documents qualité éditables stockés en JSON';
