-- ============================================================
-- SCHÉMA COMPLÉMENTAIRE AFM V2.0
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. MODIFICATION TABLE SESSIONS - Prix override
-- ============================================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS price_override_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS price_override DECIMAL(10,2);

-- Modifier le format de référence (SES au lieu de SESS)
-- Note: Les nouvelles sessions utiliseront SES-YYYY-XXXX

-- ============================================================
-- 2. TABLE DOCUMENT_TEMPLATES - RI et Livret d'accueil
-- ============================================================
CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_type VARCHAR(50) NOT NULL UNIQUE CHECK (template_type IN ('reglement_interieur', 'livret_accueil')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    version VARCHAR(10) DEFAULT 'V2.0',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID
);

-- Index
CREATE INDEX IF NOT EXISTS idx_doc_templates_type ON document_templates(template_type);

-- RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_doc_templates" ON document_templates;
CREATE POLICY "auth_doc_templates" ON document_templates FOR ALL USING (auth.role() = 'authenticated');

-- Contenu par défaut du Règlement Intérieur
INSERT INTO document_templates (template_type, title, content) VALUES (
    'reglement_interieur',
    'Règlement Intérieur',
    '## PRÉAMBULE

Le présent règlement intérieur a pour objet de définir les règles générales et permanentes relatives à l''organisation et au fonctionnement de la formation, conformément aux articles L.6352-3 à L.6352-5 et R.6352-1 à R.6352-15 du Code du travail.

## ARTICLE 1 - CHAMP D''APPLICATION

Le présent règlement s''applique à tous les stagiaires inscrits à une session de formation dispensée par Access Formation, et ce pour toute la durée de la formation suivie.

## ARTICLE 2 - ASSIDUITÉ ET PONCTUALITÉ

Les stagiaires sont tenus de suivre toutes les séquences programmées par le prestataire de formation, avec assiduité et sans interruption.
Toute absence ou retard doit être justifié auprès du responsable de formation.
En cas d''absence ou de retard, les stagiaires doivent avertir le formateur ou le secrétariat.

## ARTICLE 3 - DISCIPLINE GÉNÉRALE

Il est interdit aux stagiaires :
- D''introduire des boissons alcoolisées ou des substances illicites dans les locaux
- De se présenter en état d''ébriété ou sous l''emprise de substances
- D''utiliser leur téléphone portable pendant les sessions de formation
- De fumer dans les locaux (conformément au décret n°2006-1386 du 15/11/2006)

## ARTICLE 4 - SANCTIONS DISCIPLINAIRES

Tout agissement considéré comme fautif pourra, en fonction de sa nature et de sa gravité, faire l''objet de l''une ou l''autre des sanctions suivantes :
- Avertissement écrit
- Exclusion temporaire de la formation
- Exclusion définitive de la formation

## ARTICLE 5 - HYGIÈNE ET SÉCURITÉ

La prévention des risques d''accidents et de maladies est impérative et exige de chacun le respect total de toutes les prescriptions applicables en matière d''hygiène et de sécurité.
Les consignes générales et particulières de sécurité doivent être strictement respectées.

## ARTICLE 6 - REPRÉSENTATION DES STAGIAIRES

Pour les formations d''une durée supérieure à 500 heures, il est procédé à l''élection d''un délégué titulaire et d''un délégué suppléant.

## ARTICLE 7 - PUBLICITÉ DU RÈGLEMENT

Le présent règlement est affiché dans les locaux de formation et remis à chaque stagiaire.'
) ON CONFLICT (template_type) DO NOTHING;

-- Contenu par défaut du Livret d'Accueil
INSERT INTO document_templates (template_type, title, content) VALUES (
    'livret_accueil',
    'Livret d''Accueil du Stagiaire',
    '## BIENVENUE CHEZ ACCESS FORMATION

Nous sommes heureux de vous accueillir au sein de notre organisme de formation.
Ce livret a pour objectif de vous présenter notre structure et de vous accompagner tout au long de votre parcours.

## QUI SOMMES-NOUS ?

**Access Formation** est un organisme de formation professionnelle spécialisé dans la sécurité au travail.

**Nos coordonnées :**
- Adresse : 24 rue Kerbleiz, 29900 Concarneau
- Téléphone : 02 46 56 57 54
- Email : contact@accessformation.pro
- N° SIRET : 943 563 866 00012
- N° Déclaration d''activité : 53 29 10412 29

## VOTRE INTERLOCUTEUR

**Hicham SAÏDI** - Dirigeant et Formateur référent
- Responsable pédagogique
- Référent handicap
- Contact : contact@accessformation.pro

## DÉROULEMENT DE VOTRE FORMATION

### Avant la formation
- Vous recevrez une convocation avec les informations pratiques
- Le programme détaillé vous sera communiqué

### Pendant la formation
- Émargement obligatoire à chaque demi-journée
- Respect des horaires indiqués sur la convocation
- Participation active aux exercices pratiques

### Après la formation
- Remise de votre attestation de fin de formation
- Certificat de réalisation transmis à votre employeur
- Questionnaire de satisfaction à compléter

## ACCESSIBILITÉ

Access Formation s''engage à favoriser l''accès à la formation pour tous.
Si vous êtes en situation de handicap, contactez notre référent handicap pour étudier les adaptations possibles.

## RÉCLAMATIONS

En cas de difficulté, vous pouvez nous contacter :
- Par email : contact@accessformation.pro
- Par téléphone : 02 46 56 57 54
- Par courrier : 24 rue Kerbleiz, 29900 Concarneau

Toute réclamation sera traitée dans un délai de 15 jours.

## PROTECTION DES DONNÉES

Vos données personnelles sont collectées et traitées conformément au RGPD.
Vous disposez d''un droit d''accès, de rectification et de suppression.'
) ON CONFLICT (template_type) DO NOTHING;

-- ============================================================
-- 3. TABLE COURSES - Champs complémentaires (si pas déjà fait)
-- ============================================================
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_ht DECIMAL(10,2);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_ttc DECIMAL(10,2);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS prerequisites TEXT DEFAULT 'Aucun';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'Tout public';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS pedagogical_methods TEXT DEFAULT 'La formation est dispensée selon une pédagogie active et participative : alternance d''apports théoriques, d''exercices pratiques et de mises en situation. Les supports de formation sont remis aux participants.';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS evaluation_methods TEXT DEFAULT 'Évaluation formative pendant la formation (mises en situation, QCM, exercices pratiques). Évaluation sommative en fin de formation.';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS delivered_documents TEXT DEFAULT 'Une attestation de fin de formation, un certificat de réalisation.';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS program TEXT;

-- ============================================================
-- 4. TABLE CLIENTS - Champs complémentaires (si pas déjà fait)
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_function VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS siret VARCHAR(20);

-- ============================================================
-- 5. TABLE UPLOADED_DOCUMENTS (si pas déjà créée)
-- ============================================================
CREATE TABLE IF NOT EXISTS uploaded_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    category VARCHAR(50) DEFAULT 'other' CHECK (category IN ('programme', 'support', 'convocation', 'attestation', 'autre', 'other')),
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    trainee_id UUID REFERENCES trainees(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_uploaded_docs_session ON uploaded_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_course ON uploaded_documents(course_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_category ON uploaded_documents(category);

ALTER TABLE uploaded_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_uploaded_docs" ON uploaded_documents;
CREATE POLICY "auth_uploaded_docs" ON uploaded_documents FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 6. Mise à jour version dans org_settings
-- ============================================================
-- UPDATE org_settings SET app_version = 'V2.0' WHERE id IS NOT NULL;
