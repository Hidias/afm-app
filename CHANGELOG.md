# Changelog — Access Campus

## [2.0.0] — 31/01/2026

### ✨ Nouvelles fonctionnalités

- Envoi individuel documents stagiaires (certificat, attestation, éval à froid) avec sélection par checkbox
- Upload vers Supabase Storage avant envoi SMTP — contourne la limite 1MB Vercel
- Nettoyage automatique du storage après envoi réussi
- Émargement électronique avec signatures visuelles sur les PDF (checkmarks couleur-codées)
- Signatures en temps réel : vert = stagiaire signé, bleu = validation manuelle
- Timestamps de signature affichés sur les émargements
- Prospection complète avec module analyse de besoins et PDF auto-attaché
- Certification SST avec templates officiels INRS (FI, MAC)
- Tests de positionnement avec génération PDF résultats
- Email RDV compte-rendu avec analyse de besoins auto-attachée
- Email session post-formation avec tous les documents
- BCC automatique contact@accessformation.pro sur tous les emails
- Noms de fichiers storage slugifiés (accents supprimés) avec noms originaux préservés en PJ

### 🔧 Améliorations

- Conformité RGPD : chaque stagiaire ne reçoit que ses propres documents
- Délai de 1.5s entre les envois SMTP pour éviter le rate limiting IONOS

### 🐛 Corrections

- Nettoyage des versions incohérentes : package.json, pdfGenerator, TraineePortal, Changelog — tout aligné en 2.0.0
- Suppression des fichiers inutiles (logo.png, logo-access.png, stamp.png, .gitkeep, sstCompetencesConfig racine, VersionHistory.jsx)

---

## [1.9.0] — 18/01/2026

### ✨ Nouvelles fonctionnalités

- Widget statistiques Qualiopi temps réel sur site web public (Indicateur 2)
- 4 indicateurs publics : Satisfaction 4.96/5, Réussite 100%, Présence 98%, 48 stagiaires
- Connexion directe Supabase, mise à jour automatique, design Access Campus
- Module Documents de Formation : ressources pédagogiques par formation (Ind. 19-20)
- Upload multi-formats (PDF, PPT, Word, Excel), catégories (Support/Exercices/Évaluation)
- Diffusion automatique via portail stagiaire QR Code, téléchargements trackés
- Module Développement Formateurs : formations suivies + entretiens (Ind. 22-23)
- Tables trainer_trainings et trainer_interviews, upload certificats
- Données pré-remplies 2023-2025, prêt pour audit immédiat
- Remédiation individualisée par objectif dans session_trainees
- Alertes réclamations sur dashboard avec emails automatiques responsable qualité
- Numéro Sécurité Sociale obligatoire : 13 chiffres + clé de contrôle (2 chiffres)
- Émargement QR sécurisé : certification présence + signature + blocage temporel
- Conformité Qualiopi : 90% (28/32 indicateurs) avec guide audit complet

### 🐛 Corrections

- Corrections : RPC p_gender, dates PDF, permissions Supabase, RLS widget

---

## [1.8.0] — 17/01/2026

### ✨ Nouvelles fonctionnalités

- Page Profil des Stagiaires avec statistiques démographiques RGPD-compliant (genre, âge, CSP, handicap, postes)
- Filtres puissants (période, client, formation, financement) + exports Excel/CSV
- Protection RGPD : seuil 5 personnes minimum pour affichage statistiques
- Mentions émargement QR Code dans conventions et convocations
- Champ Genre pour stagiaires (male/female/non_binary)
- Accords grammaticaux automatiques dans tous les PDF (Madame/Monsieur, Salarié/Salariée)
- Type de financement sessions : 10 types (OPCO, CPF, FAF, Région, France Travail, etc.)
- Suivi conventions : statuts Envoyée/Signée, upload PDF signée
- Stockage Supabase : bucket signed-conventions avec RLS

### 🐛 Corrections

- Corrections : RPC save_trainee_with_ssn, apostrophes SQL, Store.js

---

## [1.7.1] — 17/01/2026

### 🐛 Corrections

- Portail Stagiaire : émargements dans attendance_halfdays (morning/afternoon)
- Évaluations à chaud : questionnaire_submitted, submitted_at, submitted_online correctement renseignés
- Optimisation requêtes Supabase avec maybeSingle() au lieu de single()
- Formulaire Réclamations : design complet restauré (logo, couleurs, téléphone)
- RLS policies corrigées pour accès anonyme aux tables sessions et courses

---

## [1.7.0] — 17/01/2026

### ✨ Nouvelles fonctionnalités

- Portail QR sécurisé : codes d'accès à 6 chiffres par stagiaire
- Verrouillage après 5 tentatives échouées (15 min), régénération par admin
- Protection anti-bruteforce avec compteur
- Système de réclamations : honeypot anti-spam, vérification référence session
- Onglet Portail QR dans SessionDetail avec gestion des codes
- Envoi codes par email aux stagiaires, affichage QR + codes pour impression
- 8 nouvelles fonctions RPC SECURITY DEFINER, triggers génération automatique codes

---

## [1.6.1] — 15/01/2026

### 🐛 Corrections

- Calcul résultats sessions demi-journées
- Sauvegarde champs CSP et job_title dans fiche stagiaire
- Filtres RGPD statistiques fonctionnels

---

## [1.6.0] — 10/01/2026

### ✨ Nouvelles fonctionnalités

- Module Réclamations intégré dans Non-conformités (source, canal, délais AR/clôture)
- Alertes visuelles réclamations en retard (AR 48h orange, clôture 5j rouge)
- Référence automatique REC-YYYY-NNN
- Documents sous-traitance éditables
- Plan d'actions avec responsable, échéance, statut

### 🐛 Corrections

- RDD : comptage sessions et stagiaires
- RDD : score satisfaction depuis évaluations à chaud
- Filtres Audit RGPD

---

## [1.5.0] — 09/01/2026

### ✨ Nouvelles fonctionnalités

- Module Qualité complet : Documents, Registres, Revue Direction
- Documents éditables avec bouton Éditer
- Logigrammes format tableau
- Pack Qualité : 40 documents pré-fournis

---

## [1.4.0] — 09/01/2026

### ✨ Nouvelles fonctionnalités

- Système de notifications automatiques
- Rappels hebdomadaires (veille, matériel, audit)
- Alertes anniversaires certifications formateurs
- Cloche de notification avec badge compteur

---

## [1.3.0] — 06/01/2026

### ✨ Nouvelles fonctionnalités

- Module Process : éditeur visuel de logigrammes
- Formes : Début/Fin, Action, Décision, Document
- Export PNG avec code et version
- 3 process pré-créés

---

## [1.2.3] — 06/01/2026

### 🐛 Corrections

- Portail stagiaire : redirection Google corrigée
- Support sessions demi-journée
- Nouveau champ Type de journée

---

## [1.2.2] — 06/01/2026

### 🐛 Corrections

- Correction affichage complet alertes qualité (Formation, Date, Formateur, Stagiaire)
- Correction création de non-conformité depuis une alerte (tous champs requis)
- Suppression des requêtes Supabase avec jointures (erreurs 400)
- Enrichissement des données alertes via le store existant
- Modal de traitement avec toutes les informations

---

## [1.2.1] — 06/01/2026

### ✨ Nouvelles fonctionnalités

- Alertes Qualité automatiques pour notes 1-3/5 avec détail (session, stagiaire, critère)
- Traitement des alertes avec commentaire, date et utilisateur
- Création/liaison de non-conformités depuis les alertes
- Section Alertes Qualité dans le Dashboard
- Texte explicatif calcul des indicateurs (page Indicateurs)
- Texte explicatif référentiel Qualiopi (page Qualiopi)
- Clic sur alerte → navigation vers la session concernée

---

## [1.2.0] — 06/01/2026

### 🐛 Corrections

- Correction persistance des présences (demi-journées) après actualisation
- Correction persistance des objectifs de formation après actualisation
- Création tables manquantes (attendance_halfdays, session_documents, trainee_objectives)
- Indicateurs : utilisation des nouvelles colonnes d'évaluation (q_org_*, q_contenu_*, q_formateur_*, q_global_*)
- Score Global précis à 2 décimales (4.99 au lieu de 5.0)
- Évaluations : notes à NULL par défaut (l'utilisateur doit cliquer pour noter)
- Indicateurs reflètent uniquement les notes réellement saisies

---

## [1.1.0] — 04/01/2026

### ✨ Nouvelles fonctionnalités

- Page Qualiopi complète avec 4 onglets (Dashboard, Documents, Veille, Sources)
- Widget HTML indicateurs Qualiopi intégrable sur site web
- 8 documents PDF professionnels (Politique Qualité, Charte Déontologie, Procédures, CGV, Règlement, Livret)
- Préparation audit Qualiopi 67 questions

### 🐛 Corrections

- Statut session automatique Terminée à J+1
- Calcul taux de recommandation corrigé
- Affichage documents HTML (détection automatique)

---

## [1.0.5] — 04/01/2026

### ✨ Nouvelles fonctionnalités

- Gestion du matériel de formation
- Renommage CACES → Conduite (R485, R489)
- Convocations batch (envoi groupé)
- Gestion des statuts de session

---

## [1.0.4] — 03/01/2026

### ✨ Nouvelles fonctionnalités

- Évaluations à chaud avec 14 critères détaillés (Organisation, Contenu, Formateur, Perception)
- Bouton Recommanderiez-vous cette formation ?
- Commentaires généraux et projet de formation

### 🐛 Corrections

- Sauvegarde des évaluations manuelles

---

## [1.0.3] — 01/01/2026

### ✨ Nouvelles fonctionnalités

- Thèmes de formation (SST, Incendie, Ergonomie, Habilitation Électrique, Conduite R489, Conduite R485)
- Tests de positionnement par thème (page dédiée)
- Duplication des formations en un clic
- Duplication des sessions (dates vides, statut brouillon)
- Filtres avancés stagiaires (recherche, entreprise)
- Case Intra-entreprise avec adresse automatique
- Logo personnalisable sur tous les documents PDF

### 🐛 Corrections

- Indicateurs à 0% quand aucune donnée
- Tous documents : cases à cocher correctement affichées

---

## [1.0.2] — 31/12/2025

### ✨ Nouvelles fonctionnalités

- Dashboard avec 4 indicateurs (satisfaction, recommandation, présence, réponse)
- Indicateur Complétude cliquable avec rapport téléchargeable
- Indicateur Qualiopi cliquable avec rapport non-conformités
- Onglet Suivi & Évaluations dans les sessions
- Présence par journée (tableau stagiaires × dates)
- Évaluations stagiaires (questionnaire reçu, note /5, recommandation)
- Évaluation formateur (6 critères /5)
- Upload documents scannés sur sessions et stagiaires
- Documents vierges avec indicateurs Qualiopi
- Tests de positionnement SST, Incendie, G&P, Élec, Conduite

---

## [1.0.1] — 30/12/2025

### ✨ Nouvelles fonctionnalités

- Gestion des non-conformités Qualiopi
- Certificats formateurs avec dates expiration
- Documents vierges téléchargeables
- Amélioration du tableau de bord

---

## [1.0.0] — 29/12/2025

### ✨ Version initiale

- Création de l'application Access Campus
- Gestion des clients, formations (catalogue), stagiaires, formateurs
- Gestion des sessions de formation avec inscription stagiaires et assignation formateurs
- Génération de documents : Convention, Émargement, Certificat, Attestation, Programme
- QR Code émargement numérique
- Référence session automatique (SES-YYYY-XXX)
- Authentification sécurisée
- Tableau de bord basique
- Interface responsive mobile
