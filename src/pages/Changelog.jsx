import { ArrowLeft, CheckCircle, Plus, Wrench, AlertTriangle, Sparkles, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'

const versions = [
  {
    version: '2.6.1',
    date: '17/01/2026',
    type: 'fix',
    changes: [
      { type: 'fix', text: 'Correction portail stagiaire : émargements enregistrés dans attendance_halfdays (morning/afternoon)' },
      { type: 'fix', text: 'Correction évaluations à chaud : questionnaire_submitted et submitted_at correctement renseignés' },
      { type: 'fix', text: 'Correction formulaire réclamations : vérification de session fonctionnelle' },
      { type: 'fix', text: 'Restauration design formulaire réclamations (logo Access Campus, couleurs, champ téléphone)' },
      { type: 'fix', text: 'Configuration variables environnement Vercel pour accès anonyme Supabase' },
      { type: 'improve', text: 'Requêtes Supabase optimisées avec maybeSingle() au lieu de single()' },
    ]
  },
  {
    version: '2.6.0',
    date: '17/01/2026',
    type: 'major',
    changes: [
      { type: 'new', text: '🔒 Codes d\'accès à 6 chiffres par stagiaire pour sécuriser le portail QR' },
      { type: 'new', text: '🔒 Verrouillage automatique après 5 tentatives échouées (15 min)' },
      { type: 'new', text: '🔒 Protection anti-bruteforce avec compteur de tentatives' },
      { type: 'new', text: 'Onglet "Portail QR" dans SessionDetail pour gérer les codes d\'accès' },
      { type: 'new', text: 'Génération et régénération de codes par l\'administrateur' },
      { type: 'new', text: 'Envoi des codes par email aux stagiaires' },
      { type: 'new', text: 'Affichage QR Code + codes d\'accès pour impression' },
      { type: 'new', text: '🔒 Protection honeypot anti-spam sur formulaire réclamations' },
      { type: 'new', text: 'Vérification de référence session obligatoire avant réclamation' },
      { type: 'improve', text: 'Architecture RPC sécurisée (SECURITY DEFINER)' },
      { type: 'improve', text: 'Nouvelles colonnes : access_code, access_code_attempts, access_code_locked' },
    ]
  },
  {
    version: '2.5.25',
    date: '15/01/2026',
    type: 'fix',
    changes: [
      { type: 'fix', text: 'Calcul résultats sessions demi-journées corrigé' },
      { type: 'fix', text: 'Sauvegarde champs CSP et job_title dans fiche stagiaire' },
      { type: 'fix', text: 'Filtres RGPD statistiques fonctionnels' },
    ]
  },
  {
    version: '2.5.24',
    date: '10/01/2026',
    type: 'new',
    changes: [
      { type: 'new', text: 'Module Réclamations intégré dans Non-conformités avec source, canal, délais AR/clôture' },
      { type: 'new', text: 'Alertes visuelles pour réclamations en retard (AR 48h, clôture 5j ouvrés)' },
      { type: 'new', text: 'Référence automatique réclamations (REC-YYYY-NNN)' },
      { type: 'new', text: 'Documents sous-traitance éditables : Contrat, Charte qualité, NDA' },
      { type: 'new', text: 'Plan d\'actions avec responsable, échéance, statut, priorité' },
      { type: 'new', text: 'Procédures complètes : Besoin, Conception, Réalisation, Évaluation, Handicap, RGPD' },
      { type: 'fix', text: 'RDD : comptage sessions et stagiaires corrigé (8/10, 60 stagiaires)' },
      { type: 'fix', text: 'RDD : score satisfaction calculé depuis évaluations à chaud (colonnes q_*)' },
      { type: 'fix', text: 'RDD : taux de recommandation depuis would_recommend' },
      { type: 'fix', text: 'Filtres Audit RGPD fonctionnels (requêtes directes)' },
      { type: 'fix', text: 'Création réclamations : gestion session_id null' },
      { type: 'improve', text: 'Affichage satisfaction : message clair si aucune évaluation' },
    ]
  },
  {
    version: '2.5.23',
    date: '09/01/2026',
    type: 'new',
    changes: [
      { type: 'new', text: 'Module Qualité complet : Documents, Registres, Revue Direction' },
      { type: 'new', text: 'Documents éditables : bouton "Éditer" sur désignations, procédures, checklists' },
      { type: 'new', text: 'Logigrammes format tableau : Acteur | Étape | Délai | Output' },
      { type: 'new', text: 'Pack Qualité : 40 documents avec pieds de page complets' },
      { type: 'improve', text: 'Menu réorganisé : Documents + Docs vierges, Tests dans Formations' },
      { type: 'fix', text: 'Correction alerte J+90 (table evaluations_cold)' },
    ]
  },
  {
    version: '2.5.22',
    date: '09/01/2026',
    type: 'new',
    changes: [
      { type: 'new', text: 'Système de notifications avec rappels hebdomadaires automatiques' },
      { type: 'new', text: 'Rappels : veille (lundi), matériel (samedi), audit interne (1er juillet)' },
      { type: 'new', text: 'Alertes anniversaires certifications formateurs (J-30)' },
      { type: 'new', text: 'Upload documents réclamations depuis le portail public' },
      { type: 'new', text: 'Cloche de notification dans le header avec badge' },
      { type: 'fix', text: 'Correction upload fichiers sur réclamations' },
      { type: 'fix', text: 'Correction doublons alertes qualité (contrainte unique)' },
    ]
  },
  {
    version: '2.5.21',
    date: '06/01/2026',
    type: 'new',
    changes: [
      { type: 'new', text: 'Module Process : éditeur visuel de logigrammes avec drag & drop' },
      { type: 'new', text: 'Formes logigramme : Début/Fin, Action, Décision, Document, Sous-process' },
      { type: 'new', text: 'Connexions automatiques entre étapes avec flèches' },
      { type: 'new', text: 'Propriétés des étapes : responsable, document lié, délai, outil, catégorie' },
      { type: 'new', text: 'Liens entre process (sous-process)' },
      { type: 'new', text: 'Versioning des process avec historique' },
      { type: 'new', text: 'Export PNG avec code et version (PR-XXX-V1)' },
      { type: 'new', text: 'Gestion des catégories et responsables' },
      { type: 'new', text: '3 process pré-créés : Formation standard, NC, Réclamations' },
      { type: 'improve', text: 'Nouvel onglet Process dans Qualiopi (entre Documents et Veille)' },
    ]
  },
  {
    version: '2.5.20',
    date: '06/01/2026',
    type: 'fix',
    changes: [
      { type: 'fix', text: 'Correction portail stagiaire : redirection vers Google avant signature complète' },
      { type: 'fix', text: 'Correction logique de détermination d\'étape (vérifier présences avant évaluation)' },
      { type: 'fix', text: 'Correction état asynchrone attendanceData lors du chargement initial' },
      { type: 'new', text: 'Support des sessions demi-journée (1 seul émargement par jour)' },
      { type: 'new', text: 'Nouveau champ "Type de journée" dans le formulaire de session' },
      { type: 'improve', text: 'Labels neutres : "1ère/2ème demi-journée" au lieu de "Matin/Après-midi"' },
      { type: 'improve', text: 'Ajout de logs détaillés pour le debugging du portail stagiaire' },
    ]
  },
  {
    version: '2.5.19',
    date: '06/01/2026',
    type: 'minor',
    changes: [
      { type: 'fix', text: 'Correction affichage complet alertes qualité (Formation, Date, Formateur, Stagiaire)' },
      { type: 'fix', text: 'Correction création de non-conformité depuis une alerte (tous champs requis)' },
      { type: 'fix', text: 'Suppression des requêtes Supabase avec jointures (erreurs 400)' },
      { type: 'improve', text: 'Enrichissement des données alertes via le store existant' },
      { type: 'improve', text: 'Modal de traitement avec toutes les informations' },
    ]
  },
  {
    version: '2.5.18',
    date: '06/01/2026',
    type: 'minor',
    changes: [
      { type: 'new', text: 'Alertes Qualité automatiques pour notes 1-3/5 avec détail (session, stagiaire, critère)' },
      { type: 'new', text: 'Traitement des alertes avec commentaire, date et utilisateur' },
      { type: 'new', text: 'Création/liaison de non-conformités depuis les alertes' },
      { type: 'new', text: 'Section Alertes Qualité dans le Dashboard (remplace Terminé Récemment)' },
      { type: 'new', text: 'Texte explicatif calcul des indicateurs (page Indicateurs)' },
      { type: 'new', text: 'Texte explicatif référentiel Qualiopi (page Qualiopi)' },
      { type: 'improve', text: 'Clic sur alerte → navigation vers la session concernée' },
    ]
  },
  {
    version: '2.5.17',
    date: '06/01/2026',
    type: 'minor',
    changes: [
      { type: 'fix', text: 'Correction persistance des présences (demi-journées) après actualisation' },
      { type: 'fix', text: 'Correction persistance des objectifs de formation après actualisation' },
      { type: 'fix', text: 'Création tables manquantes (attendance_halfdays, session_documents, trainee_objectives)' },
      { type: 'fix', text: 'Indicateurs : utilisation des nouvelles colonnes d\'évaluation (q_org_*, q_contenu_*, q_formateur_*, q_global_*)' },
      { type: 'fix', text: 'Score Global précis à 2 décimales (4.99 au lieu de 5.0)' },
      { type: 'improve', text: 'Évaluations : notes à NULL par défaut (l\'utilisateur doit cliquer pour noter)' },
      { type: 'improve', text: 'Indicateurs reflètent uniquement les notes réellement saisies' },
    ]
  },
  {
    version: '2.5.16',
    date: '04/01/2026',
    type: 'minor',
    changes: [
      { type: 'new', text: 'Page Qualiopi complète avec 4 onglets (Dashboard, Documents, Veille, Sources)' },
      { type: 'new', text: 'Widget HTML indicateurs Qualiopi intégrable sur site web' },
      { type: 'new', text: '8 documents PDF professionnels (Politique Qualité, Charte Déontologie, Procédures, CGV, Règlement, Livret)' },
      { type: 'new', text: 'Préparation audit Qualiopi 67 questions' },
      { type: 'fix', text: 'Statut session automatique "Terminée" à J+1' },
      { type: 'fix', text: 'Calcul taux de recommandation corrigé' },
      { type: 'fix', text: 'Affichage documents HTML (détection automatique)' },
    ]
  },
  {
    version: '2.5.15',
    date: '04/01/2026',
    type: 'minor',
    changes: [
      { type: 'new', text: 'Gestion du matériel de formation' },
      { type: 'new', text: 'Renommage CACES → Conduite (R485, R489)' },
      { type: 'new', text: 'Convocations batch (envoi groupé)' },
      { type: 'improve', text: 'Gestion des statuts de session' },
    ]
  },
  {
    version: '2.5.14',
    date: '03/01/2026',
    type: 'minor',
    changes: [
      { type: 'new', text: 'Évaluations à chaud avec 14 critères détaillés (Organisation, Contenu, Formateur, Perception)' },
      { type: 'new', text: 'Bouton "Recommanderiez-vous cette formation ?"' },
      { type: 'new', text: 'Commentaires généraux et projet de formation' },
      { type: 'fix', text: 'Sauvegarde des évaluations manuelles' },
    ]
  },
  {
    version: '2.5',
    date: '01/01/2026',
    type: 'major',
    changes: [
      { type: 'new', text: 'Thèmes de formation (SST, Incendie, Ergonomie, Habilitation Électrique, Conduite R489, Conduite R485)' },
      { type: 'new', text: 'Tests de positionnement par thème (page dédiée)' },
      { type: 'new', text: 'Duplication des formations en un clic' },
      { type: 'new', text: 'Duplication des sessions (dates vides, statut brouillon)' },
      { type: 'new', text: 'Filtres avancés stagiaires (recherche, entreprise)' },
      { type: 'new', text: 'Case Intra-entreprise avec adresse automatique' },
      { type: 'new', text: 'Logo personnalisable sur tous les documents PDF' },
      { type: 'fix', text: 'Indicateurs à 0% quand aucune donnée' },
      { type: 'fix', text: 'Tous documents : ☐/☑/○ au lieu de &' },
    ]
  },
  {
    version: '2.3',
    date: '31/12/2025',
    type: 'major',
    changes: [
      { type: 'new', text: 'Dashboard avec 4 indicateurs (satisfaction, recommandation, présence, réponse)' },
      { type: 'new', text: 'Indicateur Complétude cliquable avec rapport téléchargeable' },
      { type: 'new', text: 'Indicateur Qualiopi cliquable avec rapport non-conformités' },
      { type: 'new', text: 'Onglet "Suivi & Évaluations" dans les sessions' },
      { type: 'new', text: 'Présence par journée (tableau stagiaires × dates)' },
      { type: 'new', text: 'Évaluations stagiaires (questionnaire reçu, note /5, recommandation)' },
      { type: 'new', text: 'Évaluation formateur (6 critères /5)' },
      { type: 'new', text: 'Upload documents scannés sur sessions' },
      { type: 'new', text: 'Upload documents sur stagiaires' },
      { type: 'new', text: 'Documents vierges avec indicateurs Qualiopi' },
      { type: 'new', text: 'Tests de positionnement SST, Incendie, G&P, Élec, Conduite' },
    ]
  },
  {
    version: '2.2',
    date: '30/12/2025',
    type: 'minor',
    changes: [
      { type: 'new', text: 'Gestion des non-conformités Qualiopi' },
      { type: 'new', text: 'Certificats formateurs avec dates expiration' },
      { type: 'new', text: 'Documents vierges téléchargeables' },
      { type: 'improve', text: 'Amélioration du tableau de bord' },
    ]
  },
  {
    version: '2.1',
    date: '29/12/2025',
    type: 'minor',
    changes: [
      { type: 'new', text: 'Génération Convention de formation' },
      { type: 'new', text: 'Génération Émargement' },
      { type: 'new', text: 'Génération Certificat de réalisation' },
      { type: 'new', text: 'Génération Attestation de présence' },
      { type: 'new', text: 'Génération Programme' },
      { type: 'new', text: 'QR Code émargement numérique' },
      { type: 'improve', text: 'Référence session automatique (SES-YYYY-XXX)' },
    ]
  },
  {
    version: '2.0',
    date: '28/12/2025',
    type: 'major',
    changes: [
      { type: 'new', text: 'Refonte complète de l\'interface' },
      { type: 'new', text: 'Gestion des stagiaires' },
      { type: 'new', text: 'Gestion des formateurs' },
      { type: 'new', text: 'Gestion des sessions de formation' },
      { type: 'new', text: 'Inscription stagiaires aux sessions' },
      { type: 'new', text: 'Assignation formateurs aux sessions' },
      { type: 'improve', text: 'Interface responsive mobile' },
    ]
  },
  {
    version: '1.0',
    date: '27/12/2025',
    type: 'major',
    changes: [
      { type: 'new', text: 'Création de l\'application' },
      { type: 'new', text: 'Gestion des clients' },
      { type: 'new', text: 'Gestion des formations (catalogue)' },
      { type: 'new', text: 'Authentification sécurisée' },
      { type: 'new', text: 'Tableau de bord basique' },
    ]
  },
]

const getTypeIcon = (type) => {
  switch (type) {
    case 'new': return <Plus className="w-4 h-4 text-green-600" />
    case 'improve': return <Sparkles className="w-4 h-4 text-blue-600" />
    case 'fix': return <Wrench className="w-4 h-4 text-orange-600" />
    case 'warning': return <AlertTriangle className="w-4 h-4 text-red-600" />
    case 'security': return <Shield className="w-4 h-4 text-purple-600" />
    default: return <CheckCircle className="w-4 h-4 text-gray-600" />
  }
}

const getTypeLabel = (type) => {
  switch (type) {
    case 'new': return 'Nouveau'
    case 'improve': return 'Amélioration'
    case 'fix': return 'Correction'
    case 'warning': return 'Important'
    case 'security': return 'Sécurité'
    default: return 'Autre'
  }
}

const getVersionBadge = (type) => {
  switch (type) {
    case 'major': return 'bg-primary-100 text-primary-700'
    case 'minor': return 'bg-gray-100 text-gray-700'
    case 'fix': return 'bg-orange-100 text-orange-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

export default function Changelog() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/parametres" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historique des versions</h1>
          <p className="text-gray-500">Évolutions et améliorations de l'application</p>
        </div>
      </div>
      
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
        
        <div className="space-y-8">
          {versions.map((v, idx) => (
            <div key={v.version} className="relative pl-20">
              {/* Version badge on timeline */}
              <div className={`absolute left-0 w-16 h-16 rounded-full flex items-center justify-center ${idx === 0 ? 'bg-primary-600 text-white' : 'bg-white border-2 border-gray-200 text-gray-700'}`}>
                <span className="text-lg font-bold">V{v.version}</span>
              </div>
              
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold">Version {v.version}</h2>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getVersionBadge(v.type)}`}>
                      {v.type === 'major' ? 'Majeure' : v.type === 'fix' ? 'Correctif' : 'Mineure'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{v.date}</span>
                </div>
                
                <div className="space-y-2">
                  {v.changes.map((change, cidx) => (
                    <div key={cidx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                      {getTypeIcon(change.type)}
                      <div className="flex-1">
                        <span className="text-sm">{change.text}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        change.type === 'new' ? 'bg-green-100 text-green-700' :
                        change.type === 'improve' ? 'bg-blue-100 text-blue-700' :
                        change.type === 'fix' ? 'bg-orange-100 text-orange-700' :
                        change.type === 'security' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {getTypeLabel(change.type)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">Access Formation © 2024-2026</p>
        <p className="text-xs mt-1">Développé avec ❤️ pour la qualité de vos formations</p>
      </div>
    </div>
  )
}
