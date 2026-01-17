# Changelog - AFM

## [2.6.0] - 2026-01-17

### 🔒 Sécurité

#### Portail QR sécurisé
- Codes d'accès à 6 chiffres par stagiaire
- Verrouillage après 5 tentatives échouées
- Régénération de codes par admin
- Protection anti-bruteforce

#### Système de réclamations
- Protection honeypot anti-spam
- Vérification de référence obligatoire
- Architecture RPC sécurisée

### ✨ Fonctionnalités

- 8 nouvelles RPC functions SECURITY DEFINER
- Table public_portal_tokens pour gestion des tokens
- Onglet "Portail QR" dans SessionDetail
- Interface de gestion des codes d'accès
- Redirection automatique des anciennes URLs

### 🔧 Technique

- Nouvelles colonnes: access_code, code_generated_at, failed_attempts, locked_until
- Triggers automatiques de génération de codes
- Backfill automatique des codes existants
- Migration en 2 phases (Phase 2 optionnelle pour durcissement RLS)

### 🚀 Migration

```bash
# Phase 1 (obligatoire)
psql -f sql/01-migration-security-v2.6.0.sql
cp frontend/TraineePortal.jsx src/pages/
cp frontend/Reclamation.jsx src/pages/

# Phase 2 (optionnel, après tests)
psql -f sql/02-rls-hardening-qr-only.sql
```

---

## [2.5.25] - 2026-01-15

### 🐛 Corrections
- Calcul résultats demi-journées
- Sauvegarde champs csp et job_title
- Filtres RGPD statistiques
