-- ═══════════════════════════════════════════════════════════════════════════
-- SCHEMA AFM V2.5 - ACCESS FORMATION MANAGER
-- ═══════════════════════════════════════════════════════════════════════════

-- Supprimer les tables si elles existent (dans l'ordre des dépendances)
DROP TABLE IF EXISTS session_qualiopi_indicators CASCADE;
DROP TABLE IF EXISTS qualiopi_indicators CASCADE;
DROP TABLE IF EXISTS session_documents CASCADE;
DROP TABLE IF EXISTS trainee_documents CASCADE;
DROP TABLE IF EXISTS trainer_certificates CASCADE;
DROP TABLE IF EXISTS attendances CASCADE;
DROP TABLE IF EXISTS daily_attendances CASCADE;
DROP TABLE IF EXISTS evaluations_hot CASCADE;
DROP TABLE IF EXISTS evaluations_cold CASCADE;
DROP TABLE IF EXISTS evaluations_trainer CASCADE;
DROP TABLE IF EXISTS positioning_results CASCADE;
DROP TABLE IF EXISTS session_trainees CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS trainees CASCADE;
DROP TABLE IF EXISTS trainers CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS non_conformities CASCADE;
DROP TABLE IF EXISTS organization_settings CASCADE;
DROP TABLE IF EXISTS document_templates CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: organization_settings (Paramètres de l'organisation + logo)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE organization_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT 'Access Formation',
  address TEXT,
  postal_code VARCHAR(10),
  city VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  siret VARCHAR(14),
  nda VARCHAR(50), -- Numéro de déclaration d'activité
  logo_url TEXT, -- URL du logo uploadé
  logo_base64 TEXT, -- Logo en base64 pour les PDFs
  primary_color VARCHAR(7) DEFAULT '#2563eb',
  -- Règlement intérieur (contenu HTML)
  reglement_interieur TEXT,
  reglement_version VARCHAR(10) DEFAULT 'V1.0',
  reglement_updated_at TIMESTAMP WITH TIME ZONE,
  -- Livret d'accueil (contenu HTML)
  livret_accueil TEXT,
  livret_version VARCHAR(10) DEFAULT 'V1.0',
  livret_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insérer les paramètres par défaut
INSERT INTO organization_settings (name, reglement_interieur, livret_accueil) VALUES (
  'Access Formation',
  '<h1>RÈGLEMENT INTÉRIEUR</h1>
<h2>Article 1 - Objet et champ d''application</h2>
<p>Le présent règlement intérieur s''applique à l''ensemble des stagiaires inscrits aux formations dispensées par Access Formation.</p>

<h2>Article 2 - Discipline générale</h2>
<p>Il est formellement interdit aux stagiaires :</p>
<ul>
<li>D''introduire des boissons alcoolisées dans les locaux</li>
<li>De se présenter aux formations en état d''ébriété ou sous l''emprise de stupéfiants</li>
<li>D''emporter ou de modifier les supports de formation</li>
<li>De manger dans les salles de formation</li>
<li>D''utiliser leur téléphone portable pendant les sessions</li>
</ul>

<h2>Article 3 - Horaires</h2>
<p>Les stagiaires doivent se conformer aux horaires fixés et communiqués par l''organisme de formation. En cas d''absence ou de retard, le stagiaire doit en avertir le formateur.</p>

<h2>Article 4 - Absences</h2>
<p>En cas d''absence, le stagiaire doit en informer l''organisme de formation et fournir un justificatif dans les 48 heures.</p>

<h2>Article 5 - Hygiène et sécurité</h2>
<p>La prévention des risques d''accidents et de maladies est impérative. À cet effet, les consignes générales et particulières de sécurité doivent être strictement respectées.</p>

<h2>Article 6 - Sanctions</h2>
<p>Tout manquement du stagiaire à l''une des prescriptions du présent règlement pourra faire l''objet d''une sanction prononcée par le responsable de l''organisme de formation.</p>',
  '<h1>LIVRET D''ACCUEIL</h1>
<h2>Bienvenue chez Access Formation</h2>
<p>Nous sommes heureux de vous accueillir au sein de notre organisme de formation.</p>

<h2>Présentation de l''organisme</h2>
<p>Access Formation est un organisme de formation professionnelle certifié Qualiopi.</p>

<h2>Vos interlocuteurs</h2>
<p>Notre équipe est à votre disposition pour répondre à toutes vos questions.</p>

<h2>Déroulement de votre formation</h2>
<ul>
<li>Accueil et émargement</li>
<li>Présentation du programme</li>
<li>Sessions de formation</li>
<li>Évaluations</li>
<li>Remise des attestations</li>
</ul>

<h2>Vos droits et devoirs</h2>
<p>En tant que stagiaire, vous bénéficiez de droits et devez respecter certaines obligations définies dans le règlement intérieur.</p>

<h2>Accessibilité</h2>
<p>Nos formations sont accessibles aux personnes en situation de handicap. Contactez-nous pour étudier les modalités d''adaptation.</p>

<h2>Contact</h2>
<p>Pour toute question, n''hésitez pas à nous contacter.</p>'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: qualiopi_indicators (Les 32 indicateurs Qualiopi)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE qualiopi_indicators (
  id SERIAL PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  criterion INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_applicable BOOLEAN DEFAULT TRUE, -- Certains sont "si applicable"
  applicable_condition TEXT, -- Condition d'applicabilité
  documents_required TEXT[], -- Documents associés
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insérer les 32 indicateurs Qualiopi
INSERT INTO qualiopi_indicators (number, criterion, title, description, is_applicable, applicable_condition, documents_required) VALUES
(1, 1, 'Information du public', 'Le prestataire diffuse une information accessible au public', TRUE, NULL, ARRAY['Site web', 'Plaquette']),
(2, 1, 'Indicateurs de résultats', 'Le prestataire diffuse des indicateurs de résultats adaptés', TRUE, NULL, ARRAY['Statistiques', 'Taux de satisfaction']),
(3, 1, 'Certification obtenue', 'Lorsque le prestataire met en œuvre des prestations conduisant à une certification professionnelle', FALSE, 'Formation certifiante', ARRAY['Référentiel certification']),
(4, 2, 'Analyse du besoin', 'Le prestataire analyse le besoin du bénéficiaire', TRUE, NULL, ARRAY['AF-BESOIN']),
(5, 2, 'Objectifs et contenu', 'Le prestataire définit les objectifs opérationnels et évaluables', TRUE, NULL, ARRAY['AF-CONV', 'AF-PROG']),
(6, 2, 'Adaptation aux publics', 'Le prestataire établit les contenus et modalités adaptés', TRUE, NULL, ARRAY['AF-PROG']),
(7, 2, 'Sous-traitance', 'Lorsque le prestataire met en œuvre des prestations en sous-traitance', FALSE, 'Sous-traitance', ARRAY['Contrat sous-traitance']),
(8, 2, 'Positionnement', 'Le prestataire détermine les procédures de positionnement et d''évaluation', TRUE, NULL, ARRAY['AF-POS']),
(9, 3, 'Information conditions', 'Le prestataire informe le public sur les conditions de déroulement', TRUE, NULL, ARRAY['AF-CONVOC', 'AF-PROG']),
(10, 3, 'Adaptation modalités', 'Le prestataire met en œuvre et adapte la prestation, l''accompagnement', TRUE, NULL, ARRAY['Feuille émargement']),
(11, 3, 'Atteinte objectifs', 'Le prestataire évalue l''atteinte des objectifs', TRUE, NULL, ARRAY['AF-CERT']),
(12, 3, 'Alternance', 'Le prestataire décrit et met en œuvre les modalités de coordination avec les entreprises', FALSE, 'Alternance', ARRAY['Livret alternance']),
(13, 3, 'Formation en situation', 'Le prestataire met en œuvre des modalités de formation en situation de travail', FALSE, 'AFEST', ARRAY['Protocole AFEST']),
(14, 4, 'Moyens pédagogiques', 'Le prestataire met à disposition des moyens humains et techniques adaptés', TRUE, NULL, ARRAY['Liste équipements']),
(15, 4, 'Coordination intervenants', 'Le prestataire coordonne les différents intervenants internes et externes', TRUE, NULL, ARRAY['Planning formateurs']),
(16, 4, 'Ressources pédagogiques', 'Le prestataire met à disposition du bénéficiaire des ressources pédagogiques', TRUE, NULL, ARRAY['Supports formation']),
(17, 4, 'Moyens humains', 'Le prestataire dispose de moyens humains dédiés', TRUE, NULL, ARRAY['CV formateurs', 'AF-EVAL-F']),
(18, 5, 'Compétences formateurs', 'Le prestataire mobilise et coordonne les différents intervenants', TRUE, NULL, ARRAY['CV formateurs']),
(19, 5, 'Compétences internes', 'Le prestataire dispose du personnel dédié aux missions de référent', TRUE, NULL, ARRAY['Organigramme']),
(20, 5, 'Formation continue formateurs', 'Le prestataire entretient et développe les compétences de ses salariés', TRUE, NULL, ARRAY['Plan formation']),
(21, 5, 'Compétences formateurs', 'Le prestataire s''assure de l''adéquation des qualifications du personnel', TRUE, NULL, ARRAY['Certificats formateurs']),
(22, 6, 'Engagement démarche qualité', 'Le prestataire réalise une veille légale et réglementaire', TRUE, NULL, ARRAY['Veille juridique']),
(23, 6, 'Veille emplois compétences', 'Le prestataire réalise une veille sur les évolutions des compétences', TRUE, NULL, ARRAY['Veille métiers']),
(24, 6, 'Veille technologique', 'Le prestataire réalise une veille sur les innovations pédagogiques', TRUE, NULL, ARRAY['Veille pédagogique']),
(25, 6, 'Réseau partenaires', 'Le prestataire mobilise les expertises, outils et réseaux nécessaires', TRUE, NULL, ARRAY['Liste partenaires']),
(26, 6, 'Socio-économique', 'Le prestataire réalise une veille sur les évolutions du marché', TRUE, NULL, ARRAY['Veille marché']),
(27, 6, 'Handicap', 'Le prestataire prend en compte les besoins des personnes en situation de handicap', TRUE, NULL, ARRAY['Référent handicap', 'Procédure accessibilité']),
(28, 6, 'Sous-traitance pilotage', 'Lorsque le prestataire fait appel à la sous-traitance', FALSE, 'Sous-traitance', ARRAY['Suivi sous-traitants']),
(29, 7, 'Recueil appréciations', 'Le prestataire recueille les appréciations des parties prenantes', TRUE, NULL, ARRAY['AF-EVAL', 'AF-EVALF']),
(30, 7, 'Traitement appréciations', 'Le prestataire met en œuvre des modalités de traitement des difficultés', TRUE, NULL, ARRAY['Analyse évaluations']),
(31, 7, 'Mesures amélioration', 'Le prestataire met en œuvre des mesures d''amélioration à partir de l''analyse', TRUE, NULL, ARRAY['Plan amélioration']),
(32, 7, 'Réclamations', 'Le prestataire traite les réclamations, difficultés et aléas', TRUE, NULL, ARRAY['Registre réclamations', 'Non-conformités']);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: clients
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  postal_code VARCHAR(10),
  city VARCHAR(100),
  siret VARCHAR(14),
  -- Contact principal
  contact_name VARCHAR(255),
  contact_function VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: courses (Formations)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  objectives TEXT[], -- Liste des objectifs
  duration_days INTEGER DEFAULT 1,
  duration_hours INTEGER DEFAULT 7,
  price_ht DECIMAL(10,2),
  prerequisites TEXT,
  target_audience TEXT,
  teaching_methods TEXT,
  evaluation_methods TEXT,
  materials TEXT, -- Matériel à prévoir
  -- Test de positionnement personnalisable
  positioning_questions JSONB DEFAULT '[]'::jsonb,
  -- Indicateurs Qualiopi associés
  qualiopi_indicators INTEGER[] DEFAULT ARRAY[5, 6, 8],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: trainers (Formateurs)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE trainers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  specialties TEXT[],
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: trainer_certificates (Certificats formateurs)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE trainer_certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  issuer VARCHAR(255),
  obtained_date DATE,
  expiry_date DATE,
  document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: trainees (Stagiaires)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE trainees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  birth_date DATE,
  birth_place VARCHAR(255),
  address TEXT,
  postal_code VARCHAR(10),
  city VARCHAR(100),
  social_security_number VARCHAR(15),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  job_title VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: trainee_documents (Documents stagiaires - pas de pièce d'identité)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE trainee_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'Autre', -- CV, Diplôme, Autre
  document_url TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: sessions
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference VARCHAR(20) NOT NULL UNIQUE, -- SES-2025-0001
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL, -- Assignable + modifiable
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME DEFAULT '09:00',
  end_time TIME DEFAULT '17:00',
  -- Lieu
  location_name VARCHAR(255),
  location_address TEXT,
  location_postal_code VARCHAR(10),
  location_city VARCHAR(100),
  is_intra BOOLEAN DEFAULT FALSE, -- Si coché, utilise l'adresse client
  is_remote BOOLEAN DEFAULT FALSE, -- Formation à distance
  remote_link TEXT, -- Lien visio si à distance
  -- Prix
  use_custom_price BOOLEAN DEFAULT FALSE,
  custom_price_ht DECIMAL(10,2),
  -- Statut
  status VARCHAR(50) DEFAULT 'planned', -- planned, in_progress, completed, cancelled
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: session_trainees (Stagiaires inscrits aux sessions)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE session_trainees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
  registration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Résultat final
  result VARCHAR(50), -- acquired, not_acquired, in_progress
  UNIQUE(session_id, trainee_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: daily_attendances (Présence par journée)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE daily_attendances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  morning_present BOOLEAN DEFAULT FALSE,
  afternoon_present BOOLEAN DEFAULT FALSE,
  signature_url TEXT, -- Signature numérique
  signed_at TIMESTAMP WITH TIME ZONE,
  ip_address VARCHAR(45),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, trainee_id, date)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: evaluations_hot (Évaluation à chaud)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE evaluations_hot (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
  -- Questions notées de 1 à 5
  q1_objectives INTEGER CHECK (q1_objectives BETWEEN 1 AND 5), -- Les objectifs ont été atteints
  q2_content INTEGER CHECK (q2_content BETWEEN 1 AND 5), -- Le contenu était adapté
  q3_pedagogy INTEGER CHECK (q3_pedagogy BETWEEN 1 AND 5), -- Les méthodes pédagogiques
  q4_trainer INTEGER CHECK (q4_trainer BETWEEN 1 AND 5), -- Le formateur
  q5_organization INTEGER CHECK (q5_organization BETWEEN 1 AND 5), -- L'organisation
  q6_materials INTEGER CHECK (q6_materials BETWEEN 1 AND 5), -- Les supports
  -- Recommandation
  would_recommend BOOLEAN,
  -- Commentaires
  strengths TEXT,
  improvements TEXT,
  general_comments TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, trainee_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: evaluations_cold (Évaluation à froid)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE evaluations_cold (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
  -- Questions notées de 1 à 5
  q1_application INTEGER CHECK (q1_application BETWEEN 1 AND 5), -- Mise en application
  q2_impact INTEGER CHECK (q2_impact BETWEEN 1 AND 5), -- Impact sur le travail
  q3_skills INTEGER CHECK (q3_skills BETWEEN 1 AND 5), -- Compétences acquises
  q4_satisfaction INTEGER CHECK (q4_satisfaction BETWEEN 1 AND 5), -- Satisfaction globale
  -- Commentaires
  concrete_examples TEXT,
  additional_needs TEXT,
  general_comments TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, trainee_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: evaluations_trainer (Évaluation formateur)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE evaluations_trainer (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
  -- Critères notés de 1 à 5
  q1_motivation INTEGER CHECK (q1_motivation BETWEEN 1 AND 5), -- Motivation du groupe
  q2_level INTEGER CHECK (q2_level BETWEEN 1 AND 5), -- Niveau des stagiaires
  q3_conditions INTEGER CHECK (q3_conditions BETWEEN 1 AND 5), -- Conditions matérielles
  q4_organization INTEGER CHECK (q4_organization BETWEEN 1 AND 5), -- Organisation générale
  q5_objectives INTEGER CHECK (q5_objectives BETWEEN 1 AND 5), -- Objectifs atteints
  q6_ambiance INTEGER CHECK (q6_ambiance BETWEEN 1 AND 5), -- Ambiance générale
  -- Commentaires
  positive_points TEXT,
  difficulties TEXT,
  suggestions TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, trainer_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: positioning_results (Résultats test positionnement)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE positioning_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
  answers JSONB NOT NULL, -- Réponses au questionnaire
  score INTEGER,
  level VARCHAR(50), -- débutant, intermédiaire, avancé
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, trainee_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: session_documents (Documents uploadés par session)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE session_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL, -- 'emargement', 'evaluation', 'certification_sst', 'autre'
  description TEXT,
  document_url TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: session_qualiopi_indicators (Checklist Qualiopi par session)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE session_qualiopi_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  indicator_number INTEGER REFERENCES qualiopi_indicators(number) ON DELETE CASCADE,
  is_validated BOOLEAN DEFAULT FALSE,
  validated_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(session_id, indicator_number)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: non_conformities
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE non_conformities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference VARCHAR(20) NOT NULL UNIQUE, -- NC-2025-0001
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  source VARCHAR(100), -- réclamation, audit, interne
  severity VARCHAR(50) DEFAULT 'minor', -- minor, major, critical
  status VARCHAR(50) DEFAULT 'open', -- open, in_progress, closed
  root_cause TEXT,
  corrective_action TEXT,
  preventive_action TEXT,
  responsible VARCHAR(255),
  due_date DATE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- FONCTIONS ET TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Fonction pour générer la référence session
CREATE OR REPLACE FUNCTION generate_session_reference()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT;
  next_num INTEGER;
BEGIN
  year_str := EXTRACT(YEAR FROM NEW.start_date)::TEXT;
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM 'SES-' || year_str || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM sessions
  WHERE reference LIKE 'SES-' || year_str || '-%';
  
  NEW.reference := 'SES-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_session_reference
  BEFORE INSERT ON sessions
  FOR EACH ROW
  WHEN (NEW.reference IS NULL)
  EXECUTE FUNCTION generate_session_reference();

-- Fonction pour générer la référence non-conformité
CREATE OR REPLACE FUNCTION generate_nc_reference()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT;
  next_num INTEGER;
BEGIN
  year_str := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM 'NC-' || year_str || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM non_conformities
  WHERE reference LIKE 'NC-' || year_str || '-%';
  
  NEW.reference := 'NC-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_nc_reference
  BEFORE INSERT ON non_conformities
  FOR EACH ROW
  WHEN (NEW.reference IS NULL)
  EXECUTE FUNCTION generate_nc_reference();

-- Fonction de mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER trigger_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_courses_updated BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_trainers_updated BEFORE UPDATE ON trainers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_trainees_updated BEFORE UPDATE ON trainees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_sessions_updated BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_nc_updated BEFORE UPDATE ON non_conformities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_org_updated BEFORE UPDATE ON organization_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Activer RLS sur toutes les tables
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualiopi_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainees ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_trainees ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations_hot ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations_cold ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations_trainer ENABLE ROW LEVEL SECURITY;
ALTER TABLE positioning_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_qualiopi_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_conformities ENABLE ROW LEVEL SECURITY;

-- Policies pour utilisateurs authentifiés
CREATE POLICY "auth_full_access" ON organization_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON qualiopi_indicators FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON courses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON trainers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON trainer_certificates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON trainees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON trainee_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON session_trainees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON daily_attendances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON evaluations_hot FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON evaluations_cold FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON evaluations_trainer FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON positioning_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON session_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON session_qualiopi_indicators FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON non_conformities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policies pour accès public (émargement via QR code)
CREATE POLICY "public_read_sessions" ON sessions FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_trainees" ON session_trainees FOR SELECT TO anon USING (true);
CREATE POLICY "public_insert_attendance" ON daily_attendances FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "public_read_attendance" ON daily_attendances FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_indicators" ON qualiopi_indicators FOR SELECT TO anon USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES POUR PERFORMANCES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_sessions_dates ON sessions(start_date, end_date);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_client ON sessions(client_id);
CREATE INDEX idx_sessions_trainer ON sessions(trainer_id);
CREATE INDEX idx_session_trainees_session ON session_trainees(session_id);
CREATE INDEX idx_daily_attendances_session ON daily_attendances(session_id);
CREATE INDEX idx_daily_attendances_date ON daily_attendances(date);
CREATE INDEX idx_evaluations_hot_session ON evaluations_hot(session_id);
CREATE INDEX idx_evaluations_cold_session ON evaluations_cold(session_id);
CREATE INDEX idx_nc_status ON non_conformities(status);

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN DU SCHEMA V2.5
-- ═══════════════════════════════════════════════════════════════════════════
