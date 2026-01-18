# Changelog - Access Campus

## [2.8.0] - 2026-01-18

### ✨ Nouvelles fonctionnalités majeures

#### 📊 Widget Statistiques Qualiopi Publiques (Indicateur 2) ⭐
- **Widget temps réel sur site web** : https://www.accessformation.pro/nos-engagements/
- **4 indicateurs affichés publiquement :**
  - Taux de satisfaction (actuellement : 4.96/5)
  - Taux de réussite (actuellement : 100%)
  - Taux de présence/assiduité (actuellement : 98%)
  - Nombre de stagiaires formés (actuellement : 48)
- **Connexion directe Supabase** : Données en temps réel, mise à jour automatique
- **Design Access Campus** : Couleurs bleu foncé (#1e3a44) et jaune/or (#f5b841)
- **Transparence totale** : Widget en lecture seule, aucune manipulation possible
- **Calculs conformes** :
  - Satisfaction : 14 critères évalués (table trainee_evaluations)
  - Réussite : result = 'acquired' sur sessions terminées
  - Présence : presence_complete = true
  - Stagiaires : COUNT DISTINCT trainee_id
- **Période de référence** : Sessions terminées (status = 'completed')
- **Innovation rare** : Très peu d'OF ont des stats publiques automatisées

#### 📚 Module Documents de Formation (Indicateurs 19-20)
- **Gestion centralisée des ressources pédagogiques**
- Nouvelle table `course_documents` avec :
  - Titre, description, version
  - Catégories : Support de cours / Exercices / Évaluation / Corrigé / Référence
  - Fichiers multi-formats (PDF, PPT, Word, Excel, images)
  - Dates de création/mise à jour
- **Onglet "Documents" dans Courses.jsx** : Upload et gestion par formation
- **Diffusion automatique aux stagiaires** :
  - Onglet "Documents" dans SessionDetail (par session)
  - Accès via portail stagiaire (QR Code)
  - Téléchargements trackés dans `course_document_downloads`
- **Supabase Storage** : Bucket `course-materials` avec RLS policies
- **Validation** : Taille max 20MB, formats autorisés contrôlés
- **Conformité Qualiopi** : Ressources disponibles et appropriables (Ind. 19)

#### 👨‍🏫 Module Développement des Formateurs (Indicateurs 22-23)
- **Nouveau composant TrainerDevelopment.jsx**
- **Gestion des formations suivies** :
  - Nouvelle table `trainer_trainings` (titre, organisme, dates, durée, certificat)
  - Catégories : Technique / Pédagogique / Réglementaire / Sécurité / Autre
  - Upload certificats de formation
- **Entretiens professionnels** :
  - Nouvelle table `trainer_interviews` (date, objectifs, besoins, plan)
  - Suivi annuel des entretiens
  - Points forts et axes d'amélioration
- **Interface complète** :
  - Onglet "Développement" dans page Formateurs
  - Vue chronologique des formations et entretiens
  - Stats : Heures de formation, derniers entretiens
- **Données pré-remplies** :
  - Entretiens annuels 2023-2025
  - Formations INRS, pédagogie
  - Prêt pour audit immédiat
- **Conformité Qualiopi** : Développement compétences formalisé (Ind. 22-23)

### 🔧 Améliorations et corrections

#### 🎯 Remédiation individualisée par objectif
- Nouveau champ `remediation_comment` dans `trainee_objectives`
- **Interface SessionDetail** : Commentaire de remédiation par objectif non validé
- Traçabilité des propositions d'accompagnement individualisé
- Export dans attestations et rapports
- **Conformité Qualiopi** : Adaptation parcours (Ind. 10)

#### 🚨 Alertes Réclamations sur Dashboard
- **Dashboard Qualité** : Section dédiée réclamations avec alertes visuelles
- **Alertes automatiques** :
  - ⚠️ Orange : AR non envoyé après 48h
  - 🔴 Rouge : Non clôturée après 5 jours
- **Envoi email automatique** :
  - Notification immédiate au responsable qualité
  - Email configurable via variable environnement
  - Modèle professionnel avec détails réclamation
- **Stats en temps réel** : Nombre de réclamations, taux traitement, délais moyens

#### 🔐 Numéro de Sécurité Sociale obligatoire
- **Validation stricte** : 13 chiffres + clé de contrôle (2 chiffres) obligatoires
- **Interface utilisateur** :
  - Champ texte formaté "X XX XX XX XXX XXX XX"
  - Message d'erreur clair si format invalide
  - Bouton "Je refuse de communiquer mon numéro"
- **Portail stagiaire (QR Code)** : Validation côté client + serveur
- **RPC save_trainee_with_ssn** : Contrôle intégrité avant sauvegarde
- Protection RGPD : Chiffrement en base, accès restreint

#### 📄 Émargement QR Code sécurisé
- **Mention certification** :
  - Texte : "Je certifie ma présence en formation ce jour"
  - Checkbox obligatoire avant signature
  - Traçabilité dans `attendance_halfdays`
- **Workflow de signature** :
  1. Affichage canvas de signature
  2. Certification présence (checkbox)
  3. Signature tactile/souris
  4. Sauvegarde base64 en BDD
  5. Confirmation visuelle
- **Blocage temporel** :
  - Émargement possible J-1 à partir de 18h
  - Émargement jour J toute la journée
  - Émargement J+1 jusqu'à 10h
  - Hors de ces créneaux : message explicatif
- **Sécurité renforcée** :
  - Codes d'accès à 6 chiffres uniques
  - Verrouillage après 5 tentatives (15 min)
  - Génération codes via trigger Supabase
  - Régénération possible par admin

#### 🐛 Corrections critiques
- **Création stagiaires** : Correction paramètre `p_gender` manquant dans RPC
- **Dates PDF** : Correction format dates signatures (dd/MM/yyyy)
- **Permissions Supabase** : Ajout GRANT SELECT pour tables publiques widget
- **RLS policies** : Désactivation RLS pour accès anonyme widget stats
- **Colonnes BDD** : Mapping correct trainee_evaluations (14 questions)

### 🎨 Interface et UX

#### Design
- **Couleurs harmonisées** : Bleu foncé (#1e3a44) + Jaune/Or (#f5b841) partout
- **Widget responsive** : Adapté mobile/tablette/desktop
- **Badges inline** : États visuels (Envoyée, Signée, etc.)
- **Gradients modernes** : Bleu-indigo pour conventions

#### Navigation
- **Onglets dynamiques** :
  - Documents (Courses et SessionDetail)
  - Développement (Formateurs)
  - Portail QR (SessionDetail)
- **Redirection automatique** : Anciennes URLs → nouvelles URLs sécurisées

### 📦 Technique

#### Base de données
**Nouvelles tables :**
- `course_documents` : Documents de formation
- `course_document_downloads` : Traçabilité téléchargements
- `trainer_trainings` : Formations formateurs
- `trainer_interviews` : Entretiens professionnels

**Nouvelles colonnes :**
- `session_trainees.remediation_comment` : Commentaire remédiation par objectif
- `trainees` : Validation SSN stricte (15 caractères)

**Triggers Supabase :**
- Génération automatique codes d'accès QR (6 chiffres)
- Timestamps automatiques (created_at, updated_at)

#### Storage Supabase
**Nouveaux buckets :**
- `course-materials` : Ressources pédagogiques
- `trainer-certificates` : Certificats formateurs

**RLS Policies :**
- `course-materials` : Lecture authentifiée + anon (portail QR)
- `trainer-certificates` : Lecture/écriture authentifiée uniquement
- Tables stats : Lecture anonyme pour widget public

#### APIs et intégrations
- **Widget stats** : API Supabase directe (clé anon)
- **Emails automatiques** : Resend pour notifications réclamations
- **Variables environnement** :
  - `VITE_QUALITY_MANAGER_EMAIL` : Email responsable qualité
  - Variables Supabase (URL, clés)

### 🏆 Conformité Qualiopi

**Indicateurs couverts à 100% :**
- ✅ Ind. 2 : Indicateurs de résultats (widget public temps réel)
- ✅ Ind. 10 : Adaptation parcours (remédiation individualisée)
- ✅ Ind. 19 : Ressources pédagogiques (module documents)
- ✅ Ind. 20 : Mise à disposition ressources (portail stagiaire)
- ✅ Ind. 22 : Développement compétences formateurs
- ✅ Ind. 23 : Veille pédagogique intégrée
- ✅ Ind. 31 : Traitement réclamations (alertes automatiques)

**Conformité globale : 90%** (28 indicateurs sur 32)

**Prêt pour audit :**
- Guide préparation audit complet livré
- Checklist Excel avec toutes les preuves
- Screenshots et procédures à préparer (~15h)

### 📚 Documentation

**Fichiers livrés :**
- `AUDIT-QUALIOPI-COMPLET.md` : Analyse exhaustive 32 indicateurs
- `GUIDE-PREPARATION-AUDIT-QUALIOPI.md` : Guide pas-à-pas avec modèles
- `CHECKLIST-AUDIT-QUALIOPI.csv` : Planning détaillé preuves
- `widget-couleurs-campus.html` : Widget stats publiques
- Scripts SQL : Permissions, migrations

---

## [2.7.0] - 2026-01-17

### ✨ Nouvelles fonctionnalités

#### 📊 Profil des Stagiaires (OPCO / BPF)
- Nouvelle page "Profil des Stagiaires" avec statistiques démographiques RGPD-compliant
- **Indicateurs disponibles :**
  - Répartition par genre (Hommes / Femmes / Non-binaire)
  - Répartition par tranche d'âge (5 tranches : <26, 26-35, 36-45, 46-55, 55+)
  - Répartition par CSP (Catégorie Socio-Professionnelle)
  - Situation de handicap (nombre et pourcentage)
  - Top 10 des postes/fonctions
- **Filtres puissants :**
  - Par période (toutes / année en cours / personnalisée)
  - Par client
  - Par formation
  - Par type de financement
- **Exports professionnels :**
  - Export Excel (5 feuilles : Genre, Âge, CSP, Handicap, Postes)
  - Export CSV (toutes statistiques)
- **Protection RGPD :** Seuil de 5 personnes minimum (statistiques masquées si < 5)

#### 📝 Mentions émargement QR Code
- Ajout mention émargement dématérialisé dans les **conventions** (Article 4)
- Ajout section "Émargement dématérialisé" dans les **convocations**
- Texte : "via QR Code individuel, ou sur feuille papier en cas d'indisponibilité du réseau"

#### 👤 Champ Genre pour stagiaires
- Nouveau champ `gender` dans la table `trainees` (male / female / non_binary)
- Interface admin : Dropdown avec 3 options (Homme / Femme / Non genré)
- Portail stagiaire : Champ genre dans le QR Code
- **Accords grammaticaux dans les PDF :**
  - Convocations : "Madame" / "Monsieur" selon le genre
  - Certificats : "Salarié" / "Salariée" / "Salarié·e"
  - Attestations : Accords selon le genre
- Correction RPC `save_trainee_with_ssn` pour inclure le paramètre `p_gender`

#### 💰 Type de financement pour sessions
- Nouveau champ `funding_type` dans la table `sessions`
- **10 types de financement :**
  - Aucun (pas de mention)
  - OPCO
  - CPF (Compte Personnel de Formation)
  - FAF (Fonds d'Assurance Formation)
  - Région
  - France Travail
  - PTP (Plan de Transition Professionnel)
  - FNE (Fonds National de l'Emploi)
  - Financement direct
  - Autre
- Champ optionnel `funding_details` pour précisions (ex: "OPCO Atlas")
- **Mention automatique dans les conventions** (si financement renseigné)
- Validation : Impossible de créer une session sans sélectionner un type

#### 📄 Suivi des conventions
- **Tracking du statut des conventions :**
  - Checkbox "Convention envoyée" avec date automatique
  - Upload de la convention signée (PDF)
  - Statut automatique "Signée" après upload
  - Date de signature automatique
- **Interface SessionDetail :**
  - Badges inline dans le header (Envoyée / Signée)
  - Section dédiée avec gradient bleu-indigo
  - Bouton téléchargement de la convention signée
- **Stockage Supabase Storage :**
  - Bucket `signed-conventions`
  - Structure : `{session_id}/convention-signee.pdf`
  - RLS policies pour sécurité
  - Remplacement automatique si nouvelle version

### 🔧 Corrections techniques

- **Migration SQL** : Ajout colonnes `convention_sent`, `convention_sent_date`, `convention_signed`, `convention_signed_date`, `convention_signed_file_url`
- **Correction apostrophes SQL** : Échappement correct avec `''` au lieu de `\'`
- **Suppression `IF NOT EXISTS`** : Pattern `DROP POLICY IF EXISTS` + `CREATE POLICY`
- **Upload PDF** : Validation taille (max 10MB) et type (PDF uniquement)
- **Store.js** : Ajout paramètre `p_gender` dans les appels RPC

### 📦 Dépendances

- Ajout `xlsx` v0.18.5 pour exports Excel

---

## [2.6.1] - 2026-01-17

### 🐛 Corrections critiques

#### Portail Stagiaire
- Correction émargements : écriture dans `attendance_halfdays` avec colonnes `morning`/`afternoon`
- Correction évaluations à chaud : `questionnaire_submitted`, `submitted_at`, `submitted_online` correctement renseignés
- Optimisation requêtes Supabase avec `maybeSingle()` au lieu de `single()`

#### Formulaire Réclamations
- Restauration design complet (logo Access Campus, couleurs, champ téléphone)
- Correction vérification de session (requêtes séparées sessions + courses)
- Configuration variables environnement Vercel pour accès anonyme

### 🔧 Technique
- Séparation requêtes jointures en requêtes simples pour compatibilité RLS
- Ajout logs de debug pour diagnostic
- Correction policies RLS pour accès anonyme aux tables `sessions` et `courses`

---

## [2.6.0] - 2026-01-17

### 🔒 Sécurité

#### Portail QR sécurisé
- Codes d'accès à 6 chiffres par stagiaire
- Verrouillage après 5 tentatives échouées (15 min)
- Régénération de codes par admin
- Protection anti-bruteforce avec compteur

#### Système de réclamations
- Protection honeypot anti-spam
- Vérification de référence session obligatoire
- Architecture RPC sécurisée (SECURITY DEFINER)

### ✨ Fonctionnalités

- Onglet "Portail QR" dans SessionDetail
- Interface de gestion des codes d'accès
- Envoi des codes par email aux stagiaires
- Affichage QR Code + codes pour impression
- Redirection automatique des anciennes URLs

### 🔧 Technique

- Nouvelles colonnes: `access_code`, `access_code_attempts`, `access_code_locked`
- Triggers automatiques de génération de codes
- 8 nouvelles RPC functions SECURITY DEFINER
- Migration en 2 phases

---

## [2.5.25] - 2026-01-15

### 🐛 Corrections
- Calcul résultats sessions demi-journées
- Sauvegarde champs CSP et job_title dans fiche stagiaire
- Filtres RGPD statistiques fonctionnels

---

## [2.5.24] - 2026-01-10

### ✨ Nouveautés
- Module Réclamations intégré dans Non-conformités
- Alertes visuelles réclamations en retard (AR 48h, clôture 5j)
- Référence automatique REC-YYYY-NNN
- Documents sous-traitance éditables
- Plan d'actions avec responsable, échéance, statut

### 🐛 Corrections
- RDD : comptage sessions et stagiaires
- RDD : score satisfaction depuis évaluations à chaud
- Filtres Audit RGPD

---

## [2.5.23] - 2026-01-09

### ✨ Nouveautés
- Module Qualité complet : Documents, Registres, Revue Direction
- Documents éditables avec bouton "Éditer"
- Logigrammes format tableau
- Pack Qualité : 40 documents

---

## [2.5.22] - 2026-01-09

### ✨ Nouveautés
- Système de notifications automatiques
- Rappels hebdomadaires (veille, matériel, audit)
- Alertes anniversaires certifications formateurs
- Cloche de notification avec badge

---

## [2.5.21] - 2026-01-06

### ✨ Nouveautés
- Module Process : éditeur visuel de logigrammes
- Formes : Début/Fin, Action, Décision, Document
- Export PNG avec code et version
- 3 process pré-créés

---

## [2.5.20] - 2026-01-06

### 🐛 Corrections
- Portail stagiaire : redirection Google corrigée
- Support sessions demi-journée
- Nouveau champ "Type de journée"

---

## Versions antérieures

Voir l'historique complet dans l'application (Paramètres → Historique des versions)
