-- ============================================================
-- AFM V2.1 - NOUVELLES FONCTIONNALITÉS
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. CERTIFICATS FORMATEURS (avec dates d'expiration)
CREATE TABLE IF NOT EXISTS trainer_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  certificate_type VARCHAR(100), -- SST, Habilitation électrique, CACES, etc.
  issue_date DATE,
  expiry_date DATE, -- NULL si pas de date d'expiration
  no_expiry BOOLEAN DEFAULT FALSE, -- true si le certificat n'expire jamais
  file_url TEXT, -- URL du fichier uploadé
  file_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche par formateur
CREATE INDEX IF NOT EXISTS idx_trainer_certificates_trainer ON trainer_certificates(trainer_id);

-- 2. ANALYSE DU BESOIN EN FORMATION
CREATE TABLE IF NOT EXISTS training_needs_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  -- Informations générales
  analysis_date DATE DEFAULT CURRENT_DATE,
  contact_name VARCHAR(255),
  contact_function VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(255),
  -- Contexte de la demande
  request_context TEXT, -- Pourquoi cette formation ?
  company_activity TEXT, -- Activité de l'entreprise
  -- Profil des participants
  participant_count INTEGER,
  participant_profiles TEXT, -- Fonctions, niveaux
  previous_training TEXT, -- Formations antérieures sur le sujet
  experience_level VARCHAR(50), -- Débutant, Intermédiaire, Confirmé
  -- Objectifs et attentes
  expected_objectives TEXT,
  specific_needs TEXT,
  practical_situations TEXT, -- Situations de travail à aborder
  -- Contraintes
  preferred_dates TEXT,
  preferred_location VARCHAR(255),
  budget_constraints TEXT,
  other_constraints TEXT,
  -- Validation
  validated_by VARCHAR(255),
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. DOCUMENTS SCANNÉS (uploadés par l'utilisateur)
CREATE TABLE IF NOT EXISTS session_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL, -- 'emargement_signe', 'evaluation_remplie', 'certificat_sst', 'autre'
  custom_type VARCHAR(255), -- Si document_type = 'autre', précision
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche par session
CREATE INDEX IF NOT EXISTS idx_session_documents_session ON session_documents(session_id);

-- 4. TESTS DE POSITIONNEMENT (modèles par type de formation)
CREATE TABLE IF NOT EXISTS positioning_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL, -- 'SST', 'INCENDIE', 'GESTES_POSTURES', 'ELEC_B0H0', 'ELEC_BS', 'ELEC_BE', 'CACES_R485', 'CACES_R489'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  questions JSONB NOT NULL, -- [{question: "", type: "qcm"|"open", options: []}]
  version VARCHAR(20) DEFAULT '1.0',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. RLS (Row Level Security)
ALTER TABLE trainer_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_needs_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE positioning_tests ENABLE ROW LEVEL SECURITY;

-- Policies pour trainer_certificates
CREATE POLICY "Users can view trainer_certificates" ON trainer_certificates FOR SELECT USING (true);
CREATE POLICY "Users can insert trainer_certificates" ON trainer_certificates FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update trainer_certificates" ON trainer_certificates FOR UPDATE USING (true);
CREATE POLICY "Users can delete trainer_certificates" ON trainer_certificates FOR DELETE USING (true);

-- Policies pour training_needs_analysis
CREATE POLICY "Users can view training_needs_analysis" ON training_needs_analysis FOR SELECT USING (true);
CREATE POLICY "Users can insert training_needs_analysis" ON training_needs_analysis FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update training_needs_analysis" ON training_needs_analysis FOR UPDATE USING (true);
CREATE POLICY "Users can delete training_needs_analysis" ON training_needs_analysis FOR DELETE USING (true);

-- Policies pour session_documents
CREATE POLICY "Users can view session_documents" ON session_documents FOR SELECT USING (true);
CREATE POLICY "Users can insert session_documents" ON session_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update session_documents" ON session_documents FOR UPDATE USING (true);
CREATE POLICY "Users can delete session_documents" ON session_documents FOR DELETE USING (true);

-- Policies pour positioning_tests
CREATE POLICY "Users can view positioning_tests" ON positioning_tests FOR SELECT USING (true);
CREATE POLICY "Users can insert positioning_tests" ON positioning_tests FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update positioning_tests" ON positioning_tests FOR UPDATE USING (true);
CREATE POLICY "Users can delete positioning_tests" ON positioning_tests FOR DELETE USING (true);

-- 6. DONNÉES INITIALES - Tests de positionnement
INSERT INTO positioning_tests (code, name, description, questions) VALUES
('SST', 'Sauveteur Secouriste du Travail', 'Test de positionnement pour formation SST', '[
  {"question": "Avez-vous déjà suivi une formation aux premiers secours ?", "type": "qcm", "options": ["Oui, récemment (moins de 2 ans)", "Oui, il y a longtemps", "Non, jamais"]},
  {"question": "Connaissez-vous la conduite à tenir face à une victime inconsciente ?", "type": "qcm", "options": ["Oui, parfaitement", "Partiellement", "Non"]},
  {"question": "Savez-vous utiliser un défibrillateur automatique ?", "type": "qcm", "options": ["Oui", "Non"]},
  {"question": "Quelles sont vos attentes concernant cette formation ?", "type": "open", "options": []},
  {"question": "Y a-t-il des situations particulières dans votre travail nécessitant des gestes de secours spécifiques ?", "type": "open", "options": []}
]'::jsonb),

('INCENDIE', 'Lutte contre l''incendie', 'Test de positionnement pour formation incendie', '[
  {"question": "Avez-vous déjà manipulé un extincteur ?", "type": "qcm", "options": ["Oui, en situation réelle", "Oui, en formation", "Non, jamais"]},
  {"question": "Connaissez-vous les différents types d''extincteurs ?", "type": "qcm", "options": ["Oui", "Partiellement", "Non"]},
  {"question": "Avez-vous déjà participé à un exercice d''évacuation ?", "type": "qcm", "options": ["Oui", "Non"]},
  {"question": "Êtes-vous guide-file ou serre-file dans votre entreprise ?", "type": "qcm", "options": ["Oui", "Non", "Je ne sais pas"]},
  {"question": "Quels sont les risques incendie spécifiques à votre poste de travail ?", "type": "open", "options": []}
]'::jsonb),

('GESTES_POSTURES', 'Gestes et Postures', 'Test de positionnement pour formation gestes et postures', '[
  {"question": "Votre travail implique-t-il des manutentions manuelles régulières ?", "type": "qcm", "options": ["Oui, quotidiennement", "Occasionnellement", "Rarement"]},
  {"question": "Ressentez-vous des douleurs liées à votre activité professionnelle ?", "type": "qcm", "options": ["Oui, souvent", "Parfois", "Non"]},
  {"question": "Si oui, où se situent ces douleurs ?", "type": "open", "options": []},
  {"question": "Avez-vous déjà suivi une formation gestes et postures ?", "type": "qcm", "options": ["Oui", "Non"]},
  {"question": "Quelles sont les principales tâches physiques que vous effectuez ?", "type": "open", "options": []}
]'::jsonb),

('ELEC_B0H0', 'Habilitation électrique B0H0V', 'Test de positionnement pour habilitation B0H0V (non électricien)', '[
  {"question": "Travaillez-vous à proximité d''installations électriques ?", "type": "qcm", "options": ["Oui, régulièrement", "Occasionnellement", "Rarement"]},
  {"question": "Connaissez-vous les dangers de l''électricité ?", "type": "qcm", "options": ["Oui", "Partiellement", "Non"]},
  {"question": "Avez-vous déjà été habilité électriquement ?", "type": "qcm", "options": ["Oui, habilitation en cours", "Oui, mais périmée", "Non, jamais"]},
  {"question": "Dans quel contexte êtes-vous amené à travailler près d''installations électriques ?", "type": "open", "options": []}
]'::jsonb),

('ELEC_BS', 'Habilitation électrique BS', 'Test de positionnement pour habilitation BS (interventions simples)', '[
  {"question": "Effectuez-vous des interventions électriques simples (remplacement fusibles, réarmement) ?", "type": "qcm", "options": ["Oui, régulièrement", "Occasionnellement", "Non"]},
  {"question": "Avez-vous des connaissances de base en électricité ?", "type": "qcm", "options": ["Oui", "Partiellement", "Non"]},
  {"question": "Avez-vous déjà une habilitation électrique ?", "type": "qcm", "options": ["Oui, en cours de validité", "Oui, mais périmée", "Non"]},
  {"question": "Quels types d''interventions électriques êtes-vous amené à réaliser ?", "type": "open", "options": []}
]'::jsonb),

('ELEC_BE', 'Habilitation électrique BE Manœuvre', 'Test de positionnement pour habilitation BE Manœuvre', '[
  {"question": "Effectuez-vous des manœuvres sur des équipements électriques ?", "type": "qcm", "options": ["Oui, régulièrement", "Occasionnellement", "Non"]},
  {"question": "Connaissez-vous la différence entre manœuvre d''exploitation et de consignation ?", "type": "qcm", "options": ["Oui", "Non"]},
  {"question": "Avez-vous déjà une habilitation électrique ?", "type": "qcm", "options": ["Oui, en cours de validité", "Oui, mais périmée", "Non"]},
  {"question": "Sur quels types d''équipements effectuez-vous des manœuvres ?", "type": "open", "options": []}
]'::jsonb),

('CACES_R485', 'CACES R485 - Chariots gerbeurs', 'Test de positionnement pour CACES R485', '[
  {"question": "Avez-vous déjà conduit un chariot gerbeur ?", "type": "qcm", "options": ["Oui, régulièrement", "Occasionnellement", "Non, jamais"]},
  {"question": "Possédez-vous un CACES R485 ?", "type": "qcm", "options": ["Oui, en cours de validité", "Oui, mais périmé", "Non"]},
  {"question": "Sur quel(s) type(s) de chariot travaillez-vous ou allez-vous travailler ?", "type": "open", "options": []},
  {"question": "Dans quel environnement utilisez-vous ou allez-vous utiliser ce matériel ?", "type": "open", "options": []}
]'::jsonb),

('CACES_R489', 'CACES R489 - Chariots élévateurs', 'Test de positionnement pour CACES R489', '[
  {"question": "Avez-vous déjà conduit un chariot élévateur ?", "type": "qcm", "options": ["Oui, régulièrement", "Occasionnellement", "Non, jamais"]},
  {"question": "Possédez-vous un CACES R489 ?", "type": "qcm", "options": ["Oui, en cours de validité", "Oui, mais périmé", "Non"]},
  {"question": "Quelle(s) catégorie(s) de chariot utilisez-vous ou allez-vous utiliser ?", "type": "qcm", "options": ["Cat 1A - Transpalette", "Cat 1B - Gerbeur", "Cat 3 - Chariot élévateur frontal", "Cat 5 - Chariot embarqué", "Autre"]},
  {"question": "Quelles sont vos principales tâches avec ce matériel ?", "type": "open", "options": []}
]'::jsonb)

ON CONFLICT (code) DO NOTHING;

-- 7. Vérification
SELECT 'Tables V2.1 créées avec succès' AS status;
