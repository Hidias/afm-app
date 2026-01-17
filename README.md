# Migration AFM v2.6.0 - Sécurisation Portail QR

## 🎯 Objectif

Sécurisation du portail QR et du système de réclamations.

## 🔑 Nouveautés

- **Codes d'accès 6 chiffres** pour chaque stagiaire
- **Verrouillage automatique** après 5 tentatives
- **Protection anti-spam** pour réclamations
- **Architecture RPC** sécurisée

## 📦 Contenu

- `sql/` : Scripts de migration BDD
- `frontend/` : Fichiers React mis à jour
- `docs/` : Documentation installation
- `package.json` : Version 2.6.0
- `CHANGELOG.md` : Historique

## 🚀 Installation rapide

```bash
# 1. Backup BDD (Supabase Dashboard)

# 2. Migration SQL
psql -f sql/01-migration-security-v2.6.0.sql

# 3. Frontend
cp frontend/TraineePortal.jsx src/pages/
cp frontend/Reclamation.jsx src/pages/

# 4. Build
npm install
npm run build
```

## 📖 Documentation

Voir `docs/README-INSTALLATION.md` pour instructions détaillées.

## ⚠️ Important

- ✅ AFM v2.5.25+ requis
- ✅ Migration en 2 phases
- ✅ Rétrocompatibilité URLs
- ✅ Aucune perte de données

**Version : 2.6.0** | **Date : 2026-01-17**
