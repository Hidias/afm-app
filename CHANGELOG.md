# Changelog - AFM

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
