import { ArrowLeft, CheckCircle, Plus, Wrench, AlertTriangle, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

const versions = [
  {
    version: '2.5.19',
    date: '06/01/2025',
    type: 'minor',
    changes: [
      { type: 'fix', text: 'Correction affichage des alertes qualité (Session, Stagiaire, Formation)' },
      { type: 'fix', text: 'Correction création de non-conformité depuis une alerte' },
      { type: 'fix', text: 'Suppression des jointures Supabase incompatibles' },
      { type: 'improve', text: 'Enrichissement des données alertes sans jointures' },
    ]
  },
  {
    version: '2.5.18',
    date: '06/01/2025',
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
    date: '06/01/2025',
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
    date: '04/01/2025',
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
    date: '04/01/2025',
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
    date: '03/01/2025',
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
    date: '01/01/2025',
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
      { type: 'fix', text: 'Sauvegarde paramètres organisation' },
      { type: 'fix', text: 'Création/modification formateurs' },
      { type: 'fix', text: 'Création sessions' },
      { type: 'fix', text: 'Non-conformités' },
    ]
  },
  {
    version: '2.4',
    date: '01/01/2025',
    type: 'major',
    changes: [
      { type: 'new', text: 'Tests de positionnement personnalisables par formation (QCM ou questions ouvertes)' },
      { type: 'new', text: 'Champ "Matériel à prévoir" sur les formations' },
      { type: 'new', text: 'Champ "Fonction" sur les contacts clients' },
      { type: 'new', text: 'Prix HT session (surcharge le prix formation)' },
      { type: 'new', text: 'Page Historique des versions' },
      { type: 'fix', text: 'Convention : mise en page exacte Word + coût HT affiché' },
      { type: 'fix', text: 'Convocation : ajout matériel, accessibilité, contacts' },
      { type: 'fix', text: 'Émargement : colonne N° Sécurité Sociale, retrait signature formateur' },
      { type: 'fix', text: 'Attestation : mise en page exacte Word' },
      { type: 'fix', text: 'Certificat : mise en page exacte Word officiel' },
      { type: 'fix', text: 'Évaluations : tableau 1-5 centré, "Très Satisfaisant", ○ au lieu de &' },
      { type: 'fix', text: 'Tous documents : ☐/☑/○ au lieu de &' },
    ]
  },
  {
    version: '2.3',
    date: '31/12/2024',
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
    date: '30/12/2024',
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
    date: '29/12/2024',
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
    date: '28/12/2024',
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
    date: '27/12/2024',
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
    default: return <CheckCircle className="w-4 h-4 text-gray-600" />
  }
}

const getTypeLabel = (type) => {
  switch (type) {
    case 'new': return 'Nouveau'
    case 'improve': return 'Amélioration'
    case 'fix': return 'Correction'
    case 'warning': return 'Important'
    default: return 'Autre'
  }
}

const getVersionBadge = (type) => {
  switch (type) {
    case 'major': return 'bg-primary-100 text-primary-700'
    case 'minor': return 'bg-gray-100 text-gray-700'
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
                      {v.type === 'major' ? 'Majeure' : 'Mineure'}
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
        <p className="text-sm">Access Formation © 2024-2025</p>
        <p className="text-xs mt-1">Développé avec ❤️ pour la qualité de vos formations</p>
      </div>
    </div>
  )
}
