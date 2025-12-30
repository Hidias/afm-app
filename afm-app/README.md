# 🎓 Access Formation Manager (AFM)

Application de gestion des formations pour Access Formation.

---

## 📋 GUIDE D'INSTALLATION PAS À PAS

Ce guide est conçu pour quelqu'un sans expérience technique. Suivez chaque étape dans l'ordre.

---

## ÉTAPE 1 : Créer un compte Supabase (Base de données)

**Temps estimé : 5 minutes**

1. Allez sur **https://supabase.com**
2. Cliquez sur **"Start your project"** (bouton vert)
3. Connectez-vous avec votre compte **GitHub** ou **Google**
   - Si vous n'avez pas de compte GitHub, créez-en un sur github.com (gratuit)
4. Cliquez sur **"New Project"**
5. Remplissez :
   - **Name** : `afm-accessformation`
   - **Database Password** : Inventez un mot de passe complexe et **NOTEZ-LE**
   - **Region** : Choisissez `West EU (Paris)` ou le plus proche
6. Cliquez sur **"Create new project"**
7. Attendez 2-3 minutes que le projet se crée

### Récupérer vos clés Supabase :
1. Dans votre projet Supabase, allez dans **Settings** (engrenage en bas à gauche)
2. Cliquez sur **API**
3. Notez ces 2 informations :
   - **Project URL** : `https://xxxxx.supabase.co`
   - **anon public key** : une longue chaîne de caractères

---

## ÉTAPE 2 : Créer les tables dans Supabase

**Temps estimé : 3 minutes**

1. Dans Supabase, cliquez sur **SQL Editor** (icône terminal à gauche)
2. Cliquez sur **"New query"**
3. Copiez TOUT le contenu du fichier `supabase/schema.sql` (je vous l'ai créé)
4. Collez-le dans l'éditeur SQL
5. Cliquez sur **"Run"** (bouton vert)
6. Vous devriez voir "Success. No rows returned" - c'est normal !

---

## ÉTAPE 3 : Créer les utilisateurs autorisés

**Temps estimé : 5 minutes**

1. Dans Supabase, allez dans **Authentication** (icône personnage à gauche)
2. Cliquez sur **"Add user"** puis **"Create new user"**
3. Créez chaque utilisateur :

   **Utilisateur 1 :**
   - Email : `hicham.saidi@accessformation.pro`
   - Password : (choisissez un mot de passe)
   - Cochez "Auto Confirm User"
   
   **Utilisateur 2 :**
   - Email : `maxime.langlais@accessformation.pro`
   - Password : (choisissez un mot de passe)
   - Cochez "Auto Confirm User"
   
   **Utilisateur 3 :**
   - Email : `contact@accessformation.pro`
   - Password : (choisissez un mot de passe)
   - Cochez "Auto Confirm User"

4. **IMPORTANT** : Notez les mots de passe quelque part de sécurisé !

---

## ÉTAPE 4 : Créer un compte Vercel (Hébergement)

**Temps estimé : 3 minutes**

1. Allez sur **https://vercel.com**
2. Cliquez sur **"Sign Up"**
3. Choisissez **"Continue with GitHub"** (utilisez le même compte que Supabase)
4. Autorisez Vercel à accéder à votre GitHub

---

## ÉTAPE 5 : Mettre le code sur GitHub

**Temps estimé : 10 minutes**

1. Allez sur **https://github.com**
2. Connectez-vous
3. Cliquez sur le **"+"** en haut à droite, puis **"New repository"**
4. Remplissez :
   - **Repository name** : `afm-app`
   - Cochez **"Private"** (important pour la sécurité)
5. Cliquez sur **"Create repository"**

### Option A : Si vous avez Git installé sur votre ordinateur
```bash
cd afm-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/VOTRE-USERNAME/afm-app.git
git push -u origin main
```

### Option B : Si vous n'avez pas Git (plus simple)
1. Téléchargez le dossier `afm-app` que je vous fournis (en ZIP)
2. Sur GitHub, dans votre nouveau repository, cliquez sur **"uploading an existing file"**
3. Glissez-déposez tous les fichiers du dossier `afm-app`
4. Cliquez sur **"Commit changes"**

---

## ÉTAPE 6 : Déployer sur Vercel

**Temps estimé : 5 minutes**

1. Retournez sur **https://vercel.com**
2. Cliquez sur **"Add New..."** puis **"Project"**
3. Trouvez votre repository `afm-app` et cliquez sur **"Import"**
4. Dans **"Environment Variables"**, ajoutez ces 2 variables :

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` (votre URL Supabase) |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` (votre clé anon Supabase) |

5. Cliquez sur **"Deploy"**
6. Attendez 2-3 minutes
7. Vercel vous donne une URL du type `afm-app-xxxx.vercel.app`

🎉 **Votre application est en ligne !**

---

## ÉTAPE 7 : Connecter votre domaine IONOS

**Temps estimé : 10 minutes**

1. Dans Vercel, allez dans votre projet
2. Cliquez sur **"Settings"** puis **"Domains"**
3. Tapez : `app.accessformation.pro`
4. Cliquez sur **"Add"**
5. Vercel vous montre les enregistrements DNS à créer

### Dans IONOS :
1. Connectez-vous à votre espace IONOS
2. Allez dans **Domaines & SSL** > **accessformation.pro**
3. Cliquez sur **DNS**
4. Ajoutez un enregistrement **CNAME** :
   - **Nom** : `app`
   - **Valeur** : `cname.vercel-dns.com`
5. Sauvegardez

⏳ Attendez 10-30 minutes que le DNS se propage.

---

## ÉTAPE 8 : Tester votre application

1. Allez sur **https://app.accessformation.pro**
2. Connectez-vous avec un des emails autorisés
3. Testez :
   - ✅ Créer un client
   - ✅ Créer une formation
   - ✅ Créer un stagiaire
   - ✅ Créer une session
   - ✅ Scanner le QR code d'émargement

---

## 🆘 EN CAS DE PROBLÈME

### "Invalid login credentials"
→ Vérifiez que l'email est exactement comme créé dans Supabase (avec @accessformation.pro)

### "Failed to fetch" ou erreur réseau
→ Vérifiez vos variables d'environnement dans Vercel (VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY)

### Le site ne se charge pas sur app.accessformation.pro
→ Le DNS peut prendre jusqu'à 24h pour se propager. Testez d'abord avec l'URL Vercel.

### Besoin d'aide ?
Envoyez-moi une capture d'écran de l'erreur et je vous aiderai !

---

## 📁 STRUCTURE DES FICHIERS

```
afm-app/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── lib/
│   │   ├── supabase.js      ← Configuration Supabase
│   │   └── store.js         ← Gestion des données
│   ├── components/
│   │   ├── Layout.jsx       ← Menu principal
│   │   └── PublicLayout.jsx
│   └── pages/
│       ├── Login.jsx
│       ├── Dashboard.jsx
│       ├── Clients.jsx
│       ├── Courses.jsx
│       ├── Trainers.jsx
│       ├── Trainees.jsx
│       ├── Sessions.jsx
│       ├── SessionDetail.jsx
│       ├── Documents.jsx
│       ├── Questionnaires.jsx
│       ├── Settings.jsx
│       └── public/
│           ├── Attendance.jsx  ← Page émargement (accessible sans login)
│           └── Questionnaire.jsx
└── supabase/
    └── schema.sql           ← Structure de la base de données
```

---

## 🔐 SÉCURITÉ

- ✅ Seuls les 3 emails autorisés peuvent se connecter
- ✅ Données hébergées en Europe (Supabase région Paris)
- ✅ Connexion HTTPS obligatoire
- ✅ Mots de passe hashés automatiquement
- ✅ Pages d'émargement accessibles uniquement via token unique

---

## 💰 COÛTS

| Service | Coût |
|---------|------|
| Supabase (Free tier) | 0 € |
| Vercel (Hobby) | 0 € |
| Domaine IONOS | Déjà payé |
| **Total** | **0 €/mois** |

Le plan gratuit Supabase inclut :
- 500 MB de base de données
- 1 GB de stockage fichiers
- 50,000 utilisateurs actifs/mois

C'est largement suffisant pour votre usage (~40 sessions/mois).

---

## 🚀 ÉVOLUTIONS FUTURES

Cette version 1.0 inclut :
- ✅ Gestion clients
- ✅ Catalogue formations
- ✅ Gestion formateurs
- ✅ Gestion stagiaires
- ✅ Sessions de formation
- ✅ Émargement avec signature + QR code
- ✅ Liste des documents

À venir (me demander) :
- 📄 Génération automatique des PDF (convention, attestation...)
- 📊 Questionnaires de satisfaction
- 📈 Tableau de bord statistiques
- 🏆 Module Qualiopi/RNQ complet
