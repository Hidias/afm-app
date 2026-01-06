# 🔧 INSTRUCTIONS DE MISE À JOUR - AFM v2.0

Votre application actuelle ne fonctionne pas car **les tables n'ont pas été créées dans Supabase**.

Suivez ces étapes dans l'ordre :

---

## ÉTAPE 1 : Créer les tables dans Supabase (⚠️ OBLIGATOIRE)

C'est l'étape la plus importante ! Sans ça, rien ne fonctionne.

1. Allez sur **https://supabase.com** et ouvrez votre projet
2. Cliquez sur **SQL Editor** dans le menu à gauche (icône terminal)
3. Cliquez sur **"New query"**
4. **Copiez TOUT le contenu du fichier `schema.sql`** (je vous l'ai fourni)
5. **Collez-le dans l'éditeur**
6. Cliquez sur **"Run"** (bouton vert)
7. Vous devriez voir **"Success"** en bas

### Comment vérifier que ça a fonctionné :
1. Dans Supabase, cliquez sur **"Table Editor"** (icône tableau à gauche)
2. Vous devez voir ces tables :
   - ✅ clients
   - ✅ courses
   - ✅ trainers
   - ✅ trainees
   - ✅ sessions
   - ✅ session_trainers
   - ✅ session_trainees
   - ✅ attendances
   - ✅ documents
   - ✅ org_settings

Si vous voyez ces tables → Passez à l'étape 2 !

---

## ÉTAPE 2 : Mettre à jour le code sur GitHub

### Option A : Remplacer tous les fichiers (plus simple)

1. Allez sur **https://github.com** → votre repository `afm-app`
2. Supprimez TOUS les fichiers existants :
   - Cliquez sur chaque fichier/dossier
   - Cliquez sur les "..." → "Delete file"
   - Ou utilisez "Delete directory" pour les dossiers
3. Une fois vidé, cliquez sur **"Add file"** → **"Upload files"**
4. Dézippez le fichier `afm-app-v2.zip` sur votre ordinateur
5. Ouvrez le dossier `afm-app-v2`
6. Sélectionnez TOUT le contenu (Ctrl+A) et glissez-le dans GitHub
7. Cliquez sur **"Commit changes"**

### Option B : Via l'interface GitHub (fichier par fichier)

Si l'option A ne fonctionne pas, vous pouvez remplacer chaque fichier un par un.

---

## ÉTAPE 3 : Redéployer sur Vercel

Vercel détecte automatiquement les changements sur GitHub et redéploie.

1. Allez sur **https://vercel.com**
2. Ouvrez votre projet
3. Vérifiez que le déploiement est en cours ou terminé
4. Si besoin, cliquez sur **"Redeploy"** → **"Redeploy"**

---

## ÉTAPE 4 : Tester l'application

1. Allez sur **https://afm-accessformation.vercel.app**
2. Connectez-vous avec votre email
3. Testez :
   - ✅ Créer un client
   - ✅ Créer une formation
   - ✅ Créer un formateur
   - ✅ Créer des stagiaires
   - ✅ Créer une session (avec stagiaires)
   - ✅ Aller dans la session → onglet Documents → Générer PDF
   - ✅ Scanner le QR code d'émargement
   - ✅ Signer sur le téléphone

---

## 🆘 PROBLÈMES COURANTS

### "relation does not exist" ou erreur de base de données
→ Le schéma SQL n'a pas été exécuté. Refaites l'étape 1.

### Les PDF ne se téléchargent pas
→ Vérifiez que vous avez bien mis à jour le code (étape 2)

### Le lien d'émargement affiche "Session non trouvée"
→ Les politiques RLS bloquent l'accès. Refaites l'étape 1 avec le nouveau schéma.

### "Failed to fetch" ou erreur réseau
→ Vérifiez vos variables Vercel (VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY)

---

## 📋 CE QUI EST INCLUS DANS LA V2

### ✅ Fonctionnalités complètes :
- Gestion clients (CRUD complet)
- Catalogue formations (CRUD complet)
- Gestion formateurs (CRUD complet)
- Gestion stagiaires (CRUD complet)
- Sessions de formation (CRUD complet + modification)
- Ajout/suppression de stagiaires dans les sessions
- **Génération de PDF** :
  - Convention de formation
  - Programme de formation
  - Convocation (par stagiaire)
  - Feuille d'émargement
  - Attestation de présence (par stagiaire)
  - Certificat de réalisation (par stagiaire)
  - Fiche évaluation satisfaction
- **Émargement numérique** :
  - QR Code unique par session
  - Page publique de signature
  - Signature tactile (doigt/souris)
  - Choix matin/après-midi/journée
  - Horodatage et preuve

### 📄 Documents conformes Qualiopi :
- Articles L6353-1 à L6353-9 du Code du travail
- Mentions obligatoires
- Numérotation automatique
- Horodatage des signatures

---

## 🚀 PROCHAINES ÉTAPES (si vous voulez)

Une fois que tout fonctionne, on pourra ajouter :
- Envoi automatique par email (convocations, etc.)
- Questionnaires de satisfaction en ligne
- Tableau de bord avec statistiques
- Export Excel des données
- Personnalisation du logo/charte graphique

Dites-moi quand l'application fonctionne et on continue !
