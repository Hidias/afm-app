# AFM - Access Formation Manager V2.5

Application web de gestion de formations professionnelles conforme aux exigences **Qualiopi**.

## 🎯 Fonctionnalités

### Gestion des données
- **Clients** : Fiche entreprise complète (SIRET, contacts)
- **Formations** : Catalogue avec objectifs pédagogiques, test de positionnement personnalisable
- **Formateurs** : Profil avec certificats et alertes d'expiration
- **Stagiaires** : Fiche individuelle avec documents (CV, diplômes)
- **Sessions** : Planification avec prix personnalisables, lieu intra/externe

### Documents Qualiopi (11 types PDF)
| Code | Document | Description |
|------|----------|-------------|
| AF-CONV | Convention | Convention de formation professionnelle |
| AF-PROG | Programme | Programme détaillé de la formation |
| AF-CONVOC | Convocation | Convocation nominative stagiaire |
| AF-EMARG | Émargement | Feuille de présence (format paysage) |
| AF-ATTP | Attestation | Attestation de présence |
| AF-CERT | Certificat | Certificat de réalisation |
| AF-EVAL | Éval. à chaud | Évaluation satisfaction fin de formation |
| AF-EVALF | Éval. à froid | Évaluation impact à J+30/60 |
| AF-EVAL-F | Éval. formateur | Auto-évaluation formateur |
| AF-POS | Positionnement | Test de positionnement initial |
| AF-BESOIN | Analyse besoin | Fiche analyse des besoins (Ind. 4) |

### Conformité Qualiopi
- Suivi des 32 indicateurs du RNQ
- Checklist par session
- Rapports de complétude (Dossiers + Qualiopi)
- Gestion des non-conformités (Ind. 31, 32)

### Fonctionnalités avancées
- **Émargement numérique** : QR code + signature tactile
- **Logo paramétrable** : Sur tous les documents
- **Règlement intérieur** : Éditeur WYSIWYG intégré
- **Livret d'accueil** : Éditeur WYSIWYG intégré
- **Dashboard** : 6 indicateurs clés en temps réel

## 🛠 Stack technique

- **Frontend** : React 18 + Vite + Tailwind CSS
- **Backend** : Supabase (PostgreSQL + Auth + Storage)
- **PDF** : jsPDF + jsPDF-AutoTable
- **State** : Zustand
- **Déploiement** : Vercel

## 📦 Installation

### Prérequis
- Node.js 18+
- Compte Supabase
- Compte Vercel (optionnel)

### 1. Cloner et installer

```bash
git clone <repo>
cd afm-v2.5
npm install
```

### 2. Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Exécuter le script SQL `schema-v2.5.sql` dans l'éditeur SQL
3. Configurer les buckets Storage :
   - `documents` (public) : CV, diplômes, certificats
   - `logos` (public) : Logo organisation

### 3. Variables d'environnement

Copier `.env.example` vers `.env` :

```bash
cp .env.example .env
```

Remplir les valeurs :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-clé-anon
```

### 4. Lancer en développement

```bash
npm run dev
```

L'application est accessible sur `http://localhost:5173`

## 🚀 Déploiement Vercel

1. Connecter le repo GitHub à Vercel
2. Configurer les variables d'environnement
3. Déployer

## 📁 Structure du projet

```
afm-v2.5/
├── schema-v2.5.sql          # Schéma base de données
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx              # Routes
    ├── index.css            # Styles globaux
    ├── components/
    │   └── Layout.jsx       # Layout avec sidebar
    ├── lib/
    │   ├── supabase.js      # Client + helpers
    │   ├── store.js         # État global Zustand
    │   └── pdfGenerator.js  # Générateurs PDF
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Settings.jsx
        ├── Clients.jsx / ClientForm.jsx
        ├── Courses.jsx / CourseForm.jsx
        ├── Trainers.jsx / TrainerForm.jsx
        ├── Trainees.jsx / TraineeForm.jsx
        ├── Sessions.jsx / SessionForm.jsx / SessionDetail.jsx
        ├── NonConformities.jsx / NonConformityForm.jsx
        ├── DocumentsVierges.jsx
        ├── CompletenessReport.jsx
        ├── QualiopiReport.jsx
        └── SignaturePage.jsx    # Page publique émargement
```

## 🔐 Sécurité

- Authentification Supabase Auth (email/password)
- Row Level Security (RLS) sur toutes les tables
- Page émargement publique avec accès restreint

## 📋 Configuration Qualiopi

Les 32 indicateurs Qualiopi sont préchargés dans la table `qualiopi_indicators`.
Chaque session peut être validée indicateur par indicateur.

## 🎨 Personnalisation

### Logo
1. Aller dans Paramètres
2. Uploader le logo (PNG/JPG, max 500KB)
3. Le logo apparaît sur tous les documents PDF

### Documents vierges
1. Aller dans Paramètres
2. Éditer le Règlement Intérieur (HTML)
3. Éditer le Livret d'Accueil (HTML)

## 📞 Support

Pour toute question ou problème, contacter le développeur.

---

**AFM V2.5** - Développé avec ❤️ pour la conformité Qualiopi
