import { History, ArrowLeft, CheckCircle, Star, Zap, Bug, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

const versions = [
  {
    version: 'V2.5.12',
    date: '04/01/2026',
    type: 'major',
    changes: [
      '🆕 PAGE VEILLE QUALIOPI : Suivi des 3 types de veille réglementaire',
      '📋 Veille légale et réglementaire (évolutions législatives)',
      '📋 Veille emplois et métiers (évolution des compétences)',
      '📋 Veille pédagogique et technologique (innovations)',
      '📋 Gestion des statuts : À traiter, En cours, Traité, Archivé',
      '📋 Suivi des actions menées avec responsable et dates',
      '♿ HANDICAP : Champ situation de handicap sur les stagiaires',
      '♿ Détails des besoins et adaptations mises en place',
      '♿ Badge visuel ♿ dans la liste des stagiaires',
      '🎯 Couleurs automatiques par thème de formation',
      '🎯 Secourisme=vert, Incendie=rouge, Hab.Élec=jaune, CACES=noir, Ergo=bleu',
      '✏️ Prénoms composés : Jean-Pierre, Marie-Claire correctement formatés',
      '🔧 Correction contacts client dans modal envoi email',
      '🔧 Contacts du client maintenant bien chargés et affichés',
    ]
  },
  {
    version: 'V2.5.12',
    date: '03/01/2026',
    type: 'major',
    changes: [
      '🎨 REBRANDING : AFM devient Access Campus',
      '🎨 Nouveau design : couleurs bleu pétrole + jaune or Access Formation',
      '🎨 Sidebar entièrement redesignée avec le thème Campus',
      '🎨 Page de connexion modernisée avec logo Access Formation',
      '🎨 Boutons jaune/or pour meilleure visibilité',
      '🎨 Toasts personnalisés aux couleurs Campus',
      '🎨 Messages interactifs "Campus vous demande..."',
      '📊 Indicateurs : distinction envoi/retour évaluations à froid',
      '📊 Taux d\'envoi éval à froid (objectif 100%)',
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
      'Sessions : validation date fin ≥ date début',
      'Sessions planifiées : passage auto en "Terminée" si date dépassée',
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
      'Bouton "Forcer le résultat" pour validation manuelle (exception)',
      'Optimisation performance : chargement sessions 10x plus rapide',
      'Paramètres : nettoyage auto SIRET/NDA (supprime espaces)',
      'Contacts clients : générique (entreprise) + spécifiques (personnes)',
      'Sessions : choix du contact pour convention/convocation',
      'Convention PDF utilise le contact choisi (spécifique ou générique)',
      'Fiche formateur : email/téléphone sur lignes séparées',
      'Fiche client restructurée avec contacts clairs',
      'Émargement vierge : sans dates + rectangle N° session',
      'Non-conformités : recherche par référence session',
      'Questions positionnement : table theme_questions (corrigé undefined)',
      'Nouvel onglet Présence par demi-journées (avant objectifs)',
      'Validation objectifs bloquée si présence < 100%',
      'Certificat = 100% présence + 100% objectifs validés',
      'Convocation : "demandons" pièce identité + N° sécu',
      'Convocation/Attestation : lieu = convention, signature + tampon',
    ]
  },
  {
    version: 'V2.5.5',
    date: '02/01/2026',
    type: 'minor',
    changes: [
      'Validation des objectifs par stagiaire (Oui/Non par objectif)',
      'Calcul automatique du résultat (Acquis si 100% objectifs + présence totale)',
      'Certificat et attestation avec signature et tampon',
      'Taux de réussite dans Indicateurs (pas Dashboard)',
      '9 critères Qualiopi dans les évaluations à chaud',
      'Évaluations à froid en format Oui/Non (5=Oui, 1=Non)',
      'Score global basé sur éval. chaud + formateur uniquement',
      'Objectifs de formation affichés dans les PDF d\'évaluation',
    ]
  },
  {
    version: 'V2.5.4',
    date: '02/01/2026',
    type: 'minor',
    changes: [
      'Évaluation à chaud Qualiopi complète (9 critères)',
      'Évaluation à froid complète (connaissances retenues, objectifs atteints)',
      'Affichage formation/formateur dans toutes les sections évaluations',
      'Export complet des données en JSON depuis Paramètres',
      'Dashboard : indicateurs basés uniquement sur sessions terminées',
      'Dashboard : retrait des indicateurs Qualiopi/Complétude (simplification)',
      'Documents : PDF multi-pages pour tous les stagiaires en un clic',
      'Documents : ajout Test de positionnement nominatif',
      'Correction upload certificats formateur',
    ]
  },
  {
    version: 'V2.5.3',
    date: '02/01/2026',
    type: 'patch',
    changes: [
      'Correction indicateurs : champs alignés avec ceux utilisés dans les sessions',
      'Correction table trainer_evaluations : colonnes correctes (group_motivation, etc.)',
      'Dashboard : "Stagiaires" remplacé par "Sessions réalisées"',
      'Évaluations à chaud : affichage note satisfaction, questionnaires reçus, recommandation',
    ]
  },
  {
    version: 'V2.5.2',
    date: '02/01/2026',
    type: 'patch',
    changes: [
      'Correction sauvegarde présences stagiaires (méthode insert/update explicite)',
      'Correction sauvegarde évaluations formateur',
      'Ajout section Évaluations à froid (90 jours) dans Suivi & Évaluations',
      'Renommage "Évaluations stagiaires" en "Évaluations à chaud"',
      'Ajout route /versions pour historique des versions',
      'Fonctions fetchColdEvaluations et upsertColdEvaluation',
    ]
  },
  {
    version: 'V2.5.1',
    date: '02/01/2026',
    type: 'patch',
    changes: [
      'Correction sauvegarde évaluations stagiaires (questionnaire reçu, notes, présence)',
      'Nouvel onglet Indicateurs de résultats avec filtres par thème/client/période',
      'Évaluations à chaud, formateur et à froid (90 jours) centralisées',
      'Dashboard : compteur "Personnes formées" (total stagiaires sessions terminées)',
      'Correction complétude : lieu non requis si session intra',
      'Création tables manquantes : attendances, session_documents, evaluations',
      'Uniformisation des numéros de version dans toute l\'application',
      'Historique complet des versions accessible depuis Paramètres',
    ]
  },
  {
    version: 'V2.5.0',
    date: '01/01/2026',
    type: 'minor',
    changes: [
      'Logo et tampon personnalisables (upload image)',
      'Règlement intérieur éditable avec versioning',
      'Livret d\'accueil éditable avec versioning',
      'Alignement complet avec le schéma de base de données Supabase',
      'Correction affichage formateur dans les sessions',
      'Correction création de sessions (référence unique)',
      'Durée en heures affichée correctement dans les certificats',
      'Tests de positionnement par thème de formation',
    ]
  },
  {
    version: 'V2.4.0',
    date: '15/12/2025',
    type: 'minor',
    changes: [
      'Module Non-conformités Qualiopi',
      'Gestion des certificats formateurs avec dates d\'expiration',
      'Alertes certificats expirant sous 30 jours',
      'Rapport de complétude des données',
      'Rapport Qualiopi avec indicateurs',
      'Page historique des versions',
    ]
  },
  {
    version: 'V2.3.0',
    date: '01/12/2025',
    type: 'minor',
    changes: [
      'Génération documents PDF : convention, programme, convocation',
      'Émargement, attestation, certificat de réalisation',
      'Évaluation à chaud et évaluation à froid',
      'QR Code pour émargement digital',
      'Export PDF de tous documents en lot',
    ]
  },
  {
    version: 'V2.2.0',
    date: '15/11/2025',
    type: 'minor',
    changes: [
      'Gestion des stagiaires avec informations complètes',
      'Attribution stagiaires aux sessions',
      'Suivi des présences par demi-journée',
      'Notes et résultats par stagiaire',
      'Liaison stagiaires-clients',
    ]
  },
  {
    version: 'V2.1.0',
    date: '01/11/2025',
    type: 'minor',
    changes: [
      'Gestion des formateurs avec spécialités',
      'Attribution formateurs aux sessions',
      'Profil formateur avec bio et certifications',
      'Taux horaire par formateur',
    ]
  },
  {
    version: 'V2.0.0',
    date: '15/10/2025',
    type: 'major',
    changes: [
      'Refonte complète de l\'interface utilisateur',
      'Migration vers React + Vite + Tailwind CSS',
      'Intégration Supabase (base de données + authentification)',
      'Gestion des sessions de formation',
      'Gestion des clients avec SIRET',
      'Catalogue des formations',
      'Dashboard avec statistiques',
    ]
  },
  {
    version: 'V1.5.0',
    date: '01/09/2025',
    type: 'minor',
    changes: [
      'Export des données en CSV',
      'Filtres avancés sur les listes',
      'Recherche globale',
      'Amélioration des performances',
    ]
  },
  {
    version: 'V1.4.0',
    date: '15/08/2025',
    type: 'minor',
    changes: [
      'Calendrier des sessions',
      'Vue planning mensuel',
      'Notifications email (préparation)',
    ]
  },
  {
    version: 'V1.3.0',
    date: '01/08/2025',
    type: 'minor',
    changes: [
      'Gestion des documents uploadés',
      'Stockage fichiers sécurisé',
      'Prévisualisation documents',
    ]
  },
  {
    version: 'V1.2.0',
    date: '15/07/2025',
    type: 'minor',
    changes: [
      'Gestion basique des formations',
      'Création/modification/suppression',
      'Informations : durée, prix, prérequis',
    ]
  },
  {
    version: 'V1.1.0',
    date: '01/07/2025',
    type: 'minor',
    changes: [
      'Authentification utilisateurs',
      'Gestion des rôles (admin/user)',
      'Protection des routes',
    ]
  },
  {
    version: 'V1.0.0',
    date: '15/06/2025',
    type: 'major',
    changes: [
      'Version initiale de l\'application AFM',
      'Structure de base du projet',
      'Page d\'accueil et navigation',
      'Configuration environnement de développement',
    ]
  },
]

const typeConfig = {
  major: { label: 'Majeure', color: 'bg-purple-100 text-purple-700', icon: Star },
  minor: { label: 'Mineure', color: 'bg-blue-100 text-blue-700', icon: Plus },
  patch: { label: 'Correctif', color: 'bg-green-100 text-green-700', icon: Bug },
}

export default function VersionHistory() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/parametres" className="btn btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />
            Historique des versions
          </h1>
          <p className="text-gray-600">Changelog complet depuis la V1.0</p>
        </div>
      </div>

      <div className="space-y-4">
        {versions.map((v, idx) => {
          const config = typeConfig[v.type]
          const Icon = config.icon
          return (
            <div key={idx} className={`card bg-white p-5 ${idx === 0 ? 'ring-2 ring-primary' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-gray-900">{v.version}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${config.color}`}>
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </span>
                  {idx === 0 && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary text-white">
                      Version actuelle
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">{v.date}</span>
              </div>
              <ul className="space-y-1.5">
                {v.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
