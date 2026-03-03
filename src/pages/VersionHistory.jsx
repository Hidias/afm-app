import { History, ArrowLeft, CheckCircle, Star, Zap, Bug, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

const versions = [
  {
    version: 'V2.8.0',
    date: '18/01/2026',
    type: 'major',
    changes: [
      '⭐ Widget statistiques Qualiopi temps réel sur site web public (Indicateur 2)',
      '📊 4 indicateurs publics : Satisfaction 4.96/5, Réussite 100%, Présence 98%, 48 stagiaires',
      '🔗 Connexion directe Supabase, mise à jour automatique, design Access Campus',
      '📚 Module Documents de Formation : ressources pédagogiques par formation (Ind. 19-20)',
      '📄 Upload multi-formats (PDF, PPT, Word, Excel), catégories (Support/Exercices/Évaluation)',
      '📥 Diffusion automatique via portail stagiaire QR Code, téléchargements trackés',
      '👨‍🏫 Module Développement Formateurs : formations suivies + entretiens (Ind. 22-23)',
      '🎓 Tables trainer_trainings et trainer_interviews, upload certificats',
      '📅 Données pré-remplies 2023-2025, prêt pour audit immédiat',
      '🎯 Remédiation individualisée par objectif dans session_trainees',
      '🚨 Alertes réclamations sur dashboard avec emails automatiques responsable qualité',
      '🔐 Numéro Sécurité Sociale obligatoire : 13 chiffres + clé (2 chiffres)',
      '✍️ Émargement QR sécurisé : certification présence + signature + blocage temporel',
      '🏆 Conformité Qualiopi : 90% (28/32 indicateurs) avec guide audit complet',
      '🐛 Corrections : RPC p_gender, dates PDF, permissions Supabase, RLS widget',
    ]
  },
  {
    version: 'V2.7.0',
    date: '17/01/2026',
    type: 'major',
    changes: [
      '📊 Profil des Stagiaires : stats RGPD (genre, âge, CSP, handicap, postes)',
      '📈 Filtres puissants (période, client, formation, financement) + exports Excel/CSV',
      '🔒 Protection RGPD : seuil 5 personnes minimum pour affichage stats',
      '📝 Mentions émargement QR Code dans conventions et convocations',
      '👤 Champ Genre pour stagiaires (male/female/non_binary)',
      '📄 Accords grammaticaux automatiques dans tous les PDF (Madame/Monsieur)',
      '💰 Type de financement sessions : 10 types (OPCO, CPF, FAF, etc.)',
      '📋 Suivi conventions : statuts Envoyée/Signée, upload PDF signée',
      '☁️ Stockage Supabase : bucket signed-conventions avec RLS',
      '🔧 Corrections : RPC save_trainee_with_ssn, apostrophes SQL, Store.js',
    ]
  },
  {
    version: 'V2.6.1',
    date: '17/01/2026',
    type: 'patch',
    changes: [
      '🐛 Portail Stagiaire : émargements attendance_halfdays (morning/afternoon)',
      '🐛 Évaluations à chaud : questionnaire_submitted correctement renseigné',
      '⚡ Optimisation requêtes Supabase avec maybeSingle()',
      '🎨 Formulaire Réclamations : design complet restauré',
      '🔧 RLS policies : accès anonyme sessions et courses',
    ]
  },
  {
    version: 'V2.6.0',
    date: '17/01/2026',
    type: 'major',
    changes: [
      '🔒 Portail QR sécurisé : codes 6 chiffres par stagiaire',
      '⚠️ Verrouillage après 5 tentatives (15 min), régénération admin',
      '🛡️ Protection anti-bruteforce avec compteur',
      '🚨 Système réclamations : honeypot anti-spam, RPC SECURITY DEFINER',
      '📱 Onglet "Portail QR" dans SessionDetail avec gestion codes',
      '📧 Envoi codes par email, affichage QR + codes impression',
      '🔧 8 nouvelles RPC functions, triggers génération automatique',
    ]
  },
  {
    version: 'V2.5.25',
    date: '15/01/2026',
    type: 'patch',
    changes: [
      '🐛 Calcul résultats sessions demi-journées',
      '🐛 Sauvegarde champs CSP et job_title dans fiche stagiaire',
      '🐛 Filtres RGPD statistiques fonctionnels',
    ]
  },
  {
    version: 'V2.5.24',
    date: '10/01/2026',
    type: 'major',
    changes: [
      '🆕 Module Réclamations intégré dans Non-conformités avec source, canal, délais AR/clôture',
      '⚠️ Alertes visuelles pour réclamations en retard (AR 48h, clôture 5j ouvrés)',
      '🔢 Référence automatique réclamations (REC-YYYY-NNN)',
      '📄 Documents sous-traitance éditables : Contrat, Charte qualité, NDA',
      '📋 Plan d\'actions avec responsable, échéance, statut, priorité',
      '📝 Procédures complètes : Besoin, Conception, Réalisation, Évaluation, Handicap, RGPD',
      '🔧 RDD : comptage sessions et stagiaires corrigé',
      '🔧 RDD : score satisfaction calculé depuis évaluations à chaud',
      '🔧 Filtres Audit RGPD fonctionnels',
      '🔧 Création réclamations : gestion session_id null',
    ]
  },
  {
    version: 'V2.5.23',
    date: '09/01/2026',
    type: 'minor',
    changes: [
      '🆕 Module Qualité complet : Documents, Registres, Revue Direction',
      '📝 Documents éditables : bouton "Éditer" sur désignations, procédures, checklists',
      '📊 Logigrammes format tableau : Acteur | Étape | Délai | Output',
      '📦 Pack Qualité : 40 documents avec pieds de page complets',
      '🔧 Correction alerte J+90 (table evaluations_cold)',
    ]
  },
  {
    version: 'V2.5.22',
    date: '09/01/2026',
    type: 'minor',
    changes: [
      '🔔 Système de notifications avec rappels hebdomadaires automatiques',
      '📅 Rappels : veille (lundi), matériel (samedi), audit interne (1er juillet)',
      '🎂 Alertes anniversaires certifications formateurs (J-30)',
      '📎 Upload documents réclamations depuis le portail public',
      '🔧 Correction doublons alertes qualité (contrainte unique)',
    ]
  },
  {
    version: 'V2.5.21',
    date: '06/01/2026',
    type: 'minor',
    changes: [
      '🆕 Module Process : éditeur visuel de logigrammes',
      '🔷 Formes disponibles : Début/Fin, Action, Décision, Document',
      '📥 Export PNG avec code et version intégrés',
      '📋 3 process pré-créés : Inscription, Facturation, Réclamation',
      '🔧 Canvas drag & drop avec zoom/pan',
    ]
  },
  {
    version: 'V2.5.20',
    date: '06/01/2026',
    type: 'patch',
    changes: [
      '🐛 Portail stagiaire : redirection Google Calendar corrigée',
      '📅 Support sessions demi-journée : matin/après-midi séparés',
      '🆕 Nouveau champ "Type de journée" (journée complète / demi-journée)',
      '🔧 Calculs présence adaptés aux demi-journées',
    ]
  }
]

export default function VersionHistory() {
  const getBadgeColor = (type) => {
    switch (type) {
      case 'major':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'minor':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'patch':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case 'major':
        return <Star className="w-5 h-5" />
      case 'minor':
        return <Zap className="w-5 h-5" />
      case 'patch':
        return <Bug className="w-5 h-5" />
      default:
        return <CheckCircle className="w-5 h-5" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/parametres"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux paramètres
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <History className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Historique des versions
            </h1>
          </div>
          <p className="text-gray-600">
            Changelog complet depuis la V1.0
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Ligne verticale */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Versions */}
          {versions.map((version, index) => (
            <div key={version.version} className="relative mb-12 ml-16">
              {/* Point sur la timeline */}
              <div className={`absolute -left-[34px] top-0 p-1.5 rounded-full border-2 ${
                index === 0 
                  ? 'bg-blue-500 border-blue-200' 
                  : 'bg-white border-gray-300'
              }`}>
                {index === 0 && getIcon(version.type)}
                {index > 0 && <CheckCircle className="w-5 h-5 text-gray-400" />}
              </div>

              {/* Carte version */}
              <div className={`bg-white rounded-lg shadow-sm border-2 ${
                index === 0 
                  ? 'border-blue-200 ring-2 ring-blue-100' 
                  : 'border-gray-200'
              } p-6`}>
                {/* En-tête */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-gray-900">
                        {version.version}
                      </h2>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getBadgeColor(version.type)}`}>
                        {version.type === 'major' && '🚀 Majeure'}
                        {version.type === 'minor' && '✨ Mineure'}
                        {version.type === 'patch' && '🔧 Correctif'}
                      </span>
                      {index === 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                          📍 Actuelle
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      📅 {version.date}
                    </p>
                  </div>
                </div>

                {/* Changements */}
                <div className="space-y-2">
                  {version.changes.map((change, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-lg mt-0.5">{change.split(' ')[0]}</span>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {change.substring(change.indexOf(' ') + 1)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Fin de timeline */}
          <div className="relative ml-16">
            <div className="absolute -left-[34px] top-0 p-2 rounded-full bg-gray-100 border-2 border-gray-300">
              <Plus className="w-4 h-4 text-gray-400" />
            </div>
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
              <p className="text-sm text-gray-500">
                Plus de 20 versions antérieures disponibles dans le CHANGELOG complet
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
