# Changelog - Access Campus

## [2.5.24] - 2026-01-10

### Ajouté
- **Module Réclamations** intégré dans Non-conformités
  - Onglet dédié avec source (Client/Stagiaire/Financeur/Autre)
  - Canal de réception (Email/Téléphone/Courrier/Formulaire)
  - Calcul automatique des délais (AR 48h, Clôture 5j ouvrés)
  - Alertes visuelles pour retards
  - Timeline des dates (réception → AR → résolution → clôture)
  - Référence automatique (REC-YYYY-NNN)
  - Suppression possible en phase de test

- **Documents Qualité éditables supplémentaires**
  - Procédures : Analyse besoins, Conception, Réalisation, Évaluation, Handicap, RGPD
  - Sous-traitance : Contrat (champs structurés), Charte qualité, NDA
  - Plan d'actions avec responsable/échéance/statut/priorité

### Corrigé
- **RDD (Revue de Direction)** : comptage sessions et stagiaires corrigé
- **Filtres Audit RGPD** : requêtes directes sans RPC bugué
- **Index SQL** : gestion des conflits avec DROP IF EXISTS

---

## [2.5.23] - 2026-01-09

### Ajouté
- **Module Qualité complet** avec 3 onglets :
  - Documents : Gouvernance, Procédures, Checklists, Pilotage, Sous-traitance
  - Registres : Réclamations, NC, Veille, Matériel (liés aux données app)
  - Revue Direction : KPIs calculés automatiquement

- **Logigrammes professionnels** pour toutes les procédures
  - Format tableau : Acteur | Étape | Délai | Output
  - Éditable par l'utilisateur

- **Formulaires d'édition** pour tous les documents
  - Organigramme avec direction et formateurs
  - Désignations avec missions personnalisables
  - Procédures avec indicateurs et étapes

### Corrigé
- Requêtes RDD pour compter les sessions via relation `session_trainees`

---

## [2.5.22] - 2026-01-08

### Ajouté
- Notifications système avec historique
- Intégration réclamations depuis évaluations

---

## [2.5.21] - 2026-01-07

### Ajouté
- Processus métier complets (données de référence)
- Swimlane diagrams pour procédures

---

## [2.5.20] - 2026-01-06

### Ajouté
- Amélioration interface qualité

---

## [2.5.19] - 2026-01-05

### Corrigé
- Stabilisation générale

---

## [2.5.18] - 2026-01-04

### Ajouté
- Alertes qualité automatiques

---

## [2.5.17] - 2026-01-03

### Ajouté
- Système de veille réglementaire

---

## [2.5.16] - 2026-01-02

### Ajouté
- Module indicateurs Qualiopi complet

---

## [2.5.15] - 2025-12-28

### Ajouté
- Gestion du matériel et équipements

---

## [2.5.14] - 2025-12-27

### Ajouté
- Évaluations à froid (J+90)
- Export RGPD complet
- Audit logs

---

## [2.5.13] - 2025-12-26

### Ajouté
- Amélioration des évaluations à chaud

---

## [2.5.12] - 2025-12-25

### Ajouté
- Module veille Qualiopi

---

## [2.5.11] - 2025-12-24

### Ajouté
- Améliorations interface

---

## [2.5.10] - 2025-12-23

### Ajouté
- Gestion avancée des stagiaires

---

## [2.5.0] - 2025-12-20

### Ajouté
- Version majeure avec refonte complète
- Logo paramétrable
- Règlement intérieur éditable
- Livret d'accueil personnalisable
- Conformité Qualiopi renforcée
