import { History, ArrowLeft, CheckCircle, Star, Zap, Bug, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

const versions = [
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
      '🆕 MODULE PROCESS : Éditeur visuel de logigrammes',
      '🎨 6 formes : Début/Fin, Action, Décision, Document, Sous-process',
      '🔗 Connexions automatiques avec flèches entre étapes',
      '✏️ Propriétés : titre, description, responsable, délai, outil',
      '🔀 Liens entre process (sous-process)',
      '💾 Versioning des process avec historique',
      '📸 Export PNG avec code et version (PR-XXX-V1)',
      '📄 Export Document HTML imprimable (tableau descriptif)',
      '👥 Gestion des responsables (Hicham, Maxime, Formateur, etc.)',
      '📋 3 process pré-créés : Formation standard, NC, Réclamations',
      '🎯 Nouvel onglet Process dans Qualiopi',
    ]
  },
  {
    version: 'V2.5.20',
    date: '06/01/2026',
    type: 'minor',
    changes: [
      '🔧 PORTAIL STAGIAIRE : Correction redirection Google prématurée',
      '🔧 Correction erreur signature émargement (structure BDD)',
      '🆕 Support sessions demi-journée (1 émargement/jour)',
      '🆕 Champ day_type sur sessions (full/half)',
      '📝 Labels neutres : 1ère/2ème demi-journée',
      '🔧 Logique étapes portail : présences vérifiées AVANT évaluation',
    ]
  },
  {
    version: 'V2.5.19',
    date: '06/01/2026',
    type: 'minor',
    changes: [
      '🔧 ALERTES QUALITÉ : Affichage correct session/date/formateur/stagiaire',
      '🔧 Création NC depuis alerte avec tous les champs requis',
      '🔧 Suppression jointures Supabase (erreurs 400)',
      '🔧 Enrichissement données via store Zustand',
    ]
  },
  {
    version: 'V2.5.18',
    date: '06/01/2026',
    type: 'minor',
    changes: [
      '🆕 ALERTES QUALITÉ : Système complet de détection',
      '⚠️ Alertes automatiques pour notes inférieure ou égale à 3',
      '📝 Textes explicatifs par indicateur (info bulles)',
      '🔄 Workflow traitement : À traiter, En cours, Traité',
      '🔗 Création NC directement depuis une alerte',
    ]
  },
  {
    version: 'V2.5.17',
    date: '06/01/2026',
    type: 'minor',
    changes: [
      '🔧 INDICATEURS QUALIOPI : Corrections calculs',
      '📊 Indicateurs par critère Qualiopi (1 à 7)',
      '📄 Documents procédures Qualiopi (réclamation, veille, handicap)',
      '📸 Génération PDF programmes depuis Canva',
    ]
  },
  {
    version: 'V2.5.16',
    date: '06/01/2026',
    type: 'minor',
    changes: [
      '🆕 AUDIT QUALIOPI : Préparation audit avec indicateurs',
      '📋 Convocations avec statut d envoi',
      '🔧 Corrections diverses statuts sessions',
    ]
  },
  {
    version: 'V2.5.15',
    date: '05/01/2026',
    type: 'minor',
    changes: [
      '🆕 MATÉRIEL FORMATEUR : Gestion équipements formation',
      '🔄 Renommage CACES vers Conduite (plus générique)',
      '📧 Convocations avec rappel prérequis et matériel',
      '📊 Statuts sessions améliorés',
    ]
  },
  {
    version: 'V2.5.14',
    date: '05/01/2026',
    type: 'major',
    changes: [
      '🔧 CORRECTION : Émargement toujours 10 lignes (X remplis + lignes vides)',
      '🔧 CORRECTION : Duplication sessions fonctionne à nouveau',
      '🎨 Nouveau thème : Prévention (couleur orange)',
      '🏭 Matériel requis (formateur) ajouté aux formations',
      '📝 Matériel requis renommé Matériel requis (stagiaires)',
      '🏥 FORPREV : Checkbox pour sessions SST/secourisme',
      '🏥 Suivi génération cartes FORPREV par session',
      '📋 FICHE RENSEIGNEMENTS STAGIAIRE (nouveau document)',
      '📋 Informations : poste, ancienneté, diplôme, niveau, attentes',
      '📋 Disponible en document vierge + session',
      '⭐ ÉVALUATION À CHAUD V2 : 14 nouvelles questions',
      '⭐ 4 catégories : Organisation, Contenu, Formateur, Global',
      '⭐ Échelle 1-5 (Mauvais à Très satisfaisant)',
      '⭐ Champs commentaires : général + projet formation',
    ]
  },
  {
    version: 'V2.5.13',
    date: '05/01/2026',
    type: 'major',
    changes: [
      '🔐 RGPD : Chiffrement des N° de sécurité sociale (AES-256)',
      '📝 AUDIT LOGS : Journal complet des accès et modifications',
      '📤 EXPORT RGPD : Bouton export sur fiche stagiaire',
      '🗑️ PURGE AUTOMATIQUE : Détection stagiaires de plus de 5 ans',
    ]
  },
  {
    version: 'V2.5.12',
    date: '04/01/2026',
    type: 'major',
    changes: [
      '🆕 PAGE VEILLE QUALIOPI : Suivi des 3 types de veille réglementaire',
      '📋 Veille légale, métiers, pédagogique',
      '♿ HANDICAP : Champ situation de handicap sur les stagiaires',
      '🎯 Couleurs automatiques par thème de formation',
      '✏️ Prénoms composés correctement formatés',
      '🔧 Correction contacts client dans modal envoi email',
    ]
  },
  {
    version: 'V2.5.11',
    date: '03/01/2026',
    type: 'major',
    changes: [
      '🎨 REBRANDING : AFM devient Access Campus',
      '🎨 Nouveau design : couleurs bleu pétrole + jaune or Access Formation',
      '🎨 Sidebar entièrement redesignée avec le thème Campus',
      '🎨 Page de connexion modernisée avec logo Access Formation',
      '🎨 Boutons jaune/or pour meilleure visibilité',
      '🎨 Toasts personnalisés aux couleurs Campus',
      '🎨 Messages interactifs Campus vous demande...',
      '📊 Indicateurs : distinction envoi/retour évaluations à froid',
      '📊 Taux d envoi éval à froid (objectif 100%)',
      '📊 Taux de retour éval à froid (réponses reçues)',
      '🔧 Correction modification stagiaires (nouveaux champs)',
      '🔧 HashRouter : refresh page fonctionne partout',
      '🔧 Correction évaluation formateur (champs null)',
      '🔧 Tri stagiaires par entreprise',
    ]
  },
  {
    version: 'V2.5.10',
    date: '03/01/2026',
    type: 'minor',
    changes: [
      '🆕 Stagiaires : date de naissance + refus N° sécu',
      '🆕 Ajout multiple de stagiaires (formulaire groupé)',
      'Migration auto des dates de naissance depuis les notes (format JJ/MM/AAAA)',
      'Sessions : validation date fin supérieure ou égale à date début',
      'Sessions planifiées : passage auto en Terminée si date dépassée',
      'Évaluations : clic sur même valeur = remise à vide',
      'Dashboard : vue commerciale (alertes, sessions sans formateur, NC)',
      'Indicateurs : taux présence + recommandation en haut',
      'Taux de présence basé sur champ presence_complete',
    ]
  },
  {
    version: 'V2.5.6',
    date: '02/01/2026',
    type: 'minor',
    changes: [
      '🆕 Import Sellsy : importation CSV des clients avec contacts',
      'Bouton Forcer le résultat pour validation manuelle (exception)',
      'Optimisation performance : chargement sessions 10x plus rapide',
      'Paramètres : nettoyage auto SIRET/NDA (supprime espaces)',
      'Contacts clients : générique (entreprise) + spécifiques (personnes)',
      'Sessions : choix du contact pour convention/convocation',
      'Convention PDF utilise le contact choisi (spécifique ou générique)',
      'Fiche formateur : email/téléphone sur lignes séparées',
      'Fiche client restructurée avec contacts clairs',
    ]
  },
  {
    version: 'V2.5.5',
    date: '01/01/2026',
    type: 'minor',
    changes: [
      '🆕 Génération automatique des références sessions (SES-XXXXXXXX)',
      'Corrections diverses sur les calculs indicateurs',
      'Amélioration affichage mobile',
    ]
  },
  {
    version: 'V2.5.0',
    date: '31/12/2025',
    type: 'major',
    changes: [
      '🆕 VERSION MAJEURE : Refonte complète de l application',
      '📊 Nouveau dashboard avec indicateurs Qualiopi',
      '📋 Gestion complète des sessions de formation',
      '👥 Gestion des stagiaires et formateurs',
      '📄 Génération PDF des documents (convention, convocation, attestation)',
      '✅ Portail stagiaire pour émargement et évaluation',
      '⚡ Évaluation à chaud avec calcul satisfaction',
      '📈 Indicateurs de performance en temps réel',
    ]
  },
]

export default function VersionHistory() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <History className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold">Historique des versions</h1>
            <p className="text-gray-500">Changelog complet depuis la V1.0</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {versions.map((v, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold">{v.version}</h2>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  v.type === 'major' 
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {v.type === 'major' ? '⭐ Majeure' : 'Mineure'}
                </span>
              </div>
              <span className="text-sm text-gray-500">{v.date}</span>
            </div>
            <div className="p-6">
              <ul className="space-y-2">
                {v.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
