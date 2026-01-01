import { ArrowLeft, Calendar, CheckCircle, Zap, FileText, Users, Settings, BarChart3, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'

const versions = [
  {
    version: 'V2.4',
    date: '01/01/2025',
    icon: Zap,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    changes: [
      'Convention : coût HT affiché (depuis session ou formation)',
      'Convocation : mise en page Word, matériel, accessibilité, contacts',
      'Émargement : colonne N° Sécurité Sociale, sans signature formateur',
      'Attestation : mise en page Word exacte',
      'Certificat : mise en page Word exacte avec ☐/☑',
      'Évaluation à chaud : tableau centré 1-5, "Très Satisfaisant", question recommandation',
      'Évaluation à froid : ○ au lieu de &',
      'Évaluation formateur : ○ au lieu de &',
      'Tests de positionnement : questions personnalisables par formation (QCM/Ouvertes)',
      'Champ "Matériel requis" sur les formations',
      'Champ "Fonction du contact" sur les clients',
      'Test de positionnement accessible directement dans la session',
      'Page historique des versions',
    ]
  },
  {
    version: 'V2.3',
    date: '31/12/2024',
    icon: BarChart3,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    changes: [
      'Dashboard : 4 indicateurs de résultats (satisfaction, recommandation, présence, réponse)',
      'Dashboard : indicateur complétude cliquable avec rapport',
      'Dashboard : indicateur Qualiopi cliquable avec rapport',
      'SessionDetail : onglet Suivi & Évaluations',
      'Présence par journée avec tableau stagiaires × dates',
      'Évaluations stagiaires (questionnaire reçu, note /5, recommandation)',
      'Évaluation formateur (6 critères /5)',
      'Upload de documents scannés sur les sessions',
      'Upload de documents sur les stagiaires',
      'Référence session SES-XXXX sur tous les documents',
    ]
  },
  {
    version: 'V2.2',
    date: '30/12/2024',
    icon: Shield,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    changes: [
      'Gestion des non-conformités Qualiopi',
      'Génération de tous les documents PDF (convention, certificat, etc.)',
      'Page Documents Vierges avec indicateurs Qualiopi',
      'Tests de positionnement prédéfinis (SST, Incendie, G&P, Électrique, CACES)',
      'Formulaires pour les analyses de besoin',
    ]
  },
  {
    version: 'V2.1',
    date: '29/12/2024',
    icon: FileText,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    changes: [
      'Génération PDF des documents de formation',
      'Convention, programme, convocation, émargement',
      'Attestation, certificat de réalisation',
      'Évaluations à chaud et à froid',
      'QR Code pour émargement numérique',
    ]
  },
  {
    version: 'V2.0',
    date: '28/12/2024',
    icon: Users,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    changes: [
      'Gestion des stagiaires',
      'Gestion des formateurs avec certificats',
      'Gestion des sessions avec affectation stagiaires/formateurs',
      'Dashboard avec statistiques',
      'Interface responsive',
    ]
  },
  {
    version: 'V1.0',
    date: '27/12/2024',
    icon: Settings,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    changes: [
      'Version initiale',
      'Gestion des clients',
      'Gestion des formations (catalogue)',
      'Authentification utilisateur',
      'Interface de base',
    ]
  },
]

export default function VersionHistory() {
  return (
    <div className="space-y-6">
      <div>
        <Link to="/parametres" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" />Retour aux paramètres
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Historique des versions</h1>
        <p className="text-gray-500">Évolution de l'application AFM - Access Formation Manager</p>
      </div>
      
      <div className="relative">
        {/* Ligne verticale */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        <div className="space-y-8">
          {versions.map((v, idx) => (
            <div key={v.version} className="relative flex gap-4">
              {/* Icône */}
              <div className={`relative z-10 w-12 h-12 rounded-full ${v.bgColor} flex items-center justify-center flex-shrink-0`}>
                <v.icon className={`w-6 h-6 ${v.color}`} />
              </div>
              
              {/* Contenu */}
              <div className="flex-1 card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${v.color}`}>{v.version}</span>
                    {idx === 0 && <span className="badge badge-green">Actuelle</span>}
                  </div>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />{v.date}
                  </span>
                </div>
                
                <ul className="space-y-2">
                  {v.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="card bg-primary-50 border-primary-200">
        <h3 className="font-semibold text-primary-900 mb-2">🚀 Prochaines évolutions prévues</h3>
        <ul className="text-sm text-primary-700 space-y-1">
          <li>• Envoi automatique des convocations par email</li>
          <li>• Signature électronique des documents</li>
          <li>• Export des données pour les OPCO</li>
          <li>• Tableau de bord avancé avec graphiques</li>
        </ul>
      </div>
    </div>
  )
}
