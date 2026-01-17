# Changelog - AFM

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
