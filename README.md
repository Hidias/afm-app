# Access Campus v2.7.0

**Plateforme de gestion de formation Qualiopi-compliant**

## 🎯 À propos

Access Campus est une application complète de gestion de formations conçue pour les organismes de formation certifiés Qualiopi.

### ✨ Fonctionnalités principales

- 📊 **Gestion complète** : Clients, Formations, Sessions, Stagiaires, Formateurs
- 📝 **Documents automatisés** : Conventions, Convocations, Attestations, Certificats
- ✅ **Conformité Qualiopi** : Tous les indicateurs et documents requis
- 📱 **Portail stagiaire sécurisé** : Émargement QR Code, évaluations en ligne
- 📈 **Statistiques OPCO/BPF** : Profil des stagiaires, indicateurs démographiques
- 🔒 **RGPD-compliant** : Protection des données personnelles

## 🚀 Démarrage rapide

### Prérequis

- Node.js 18+
- Compte Supabase
- Vercel (pour le déploiement)

### Installation

```bash
# Cloner le repository
git clone https://github.com/votre-repo/access-campus.git
cd access-campus

# Installer les dépendances
npm install

# Configuration environnement (.env)
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anon

# Lancer en développement
npm run dev

# Build production
npm run build
```

## 📦 Technologies

- **Frontend** : React 18, Vite, TailwindCSS
- **Backend** : Supabase (PostgreSQL + Auth + Storage)
- **PDF** : jsPDF, jsPDF-AutoTable
- **État** : Zustand
- **Routing** : React Router v6
- **Exports** : XLSX, CSV

## 📋 Structure

```
access-campus/
├── src/
│   ├── components/      # Composants réutilisables
│   ├── pages/          # Pages de l'application
│   │   ├── public/     # Pages publiques (portail, QR)
│   │   └── ...         # Pages privées (admin)
│   ├── lib/            # Utilitaires (PDF, store, Supabase)
│   └── App.jsx         # Point d'entrée
├── public/             # Assets statiques
├── supabase/           # Migrations SQL
└── package.json
```

## 🔐 Sécurité

- **Authentification** : Supabase Auth avec RLS
- **Codes d'accès** : 6 chiffres par stagiaire
- **Anti-bruteforce** : Verrouillage après 5 tentatives
- **RGPD** : Seuil anonymisation, exports sécurisés

## 📊 Nouveautés v2.7.0

### Page "Profil des Stagiaires"
- Statistiques démographiques (genre, âge, CSP, handicap)
- Filtres puissants (période, client, formation, financement)
- Exports Excel/CSV pour OPCO et BPF

### Champ Genre
- Accords grammaticaux dans tous les PDF
- Madame/Monsieur dans convocations
- Salarié/Salariée dans certificats

### Type de Financement
- 10 types de financement pour sessions
- Mention automatique dans conventions

### Suivi Conventions
- Tracking envoyée/signée avec dates
- Upload PDF convention signée
- Stockage Supabase Storage

### Mentions QR Code
- Texte dans conventions (Article 4)
- Section dans convocations

## 📝 Documentation

- [Changelog](CHANGELOG.md) - Historique des versions
- [Guide Qualiopi](docs/QUALIOPI.md) - Conformité et indicateurs
- [API Supabase](docs/SUPABASE.md) - Schéma BDD et RLS

## 🤝 Support

Pour toute question ou problème :
- 📧 Email : support@access-formation.net
- 🐛 Issues : GitHub Issues

## 📄 Licence

Propriétaire - Access Formation © 2026

---

**Version actuelle** : v2.7.0  
**Dernière mise à jour** : 17 janvier 2026  
**Compatibilité** : Node 18+, React 18+
