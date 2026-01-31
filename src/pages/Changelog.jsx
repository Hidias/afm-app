import { ArrowLeft, CheckCircle, Plus, Wrench, AlertTriangle, Sparkles, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'

const versions = [
  {
    version: '2.0.0',
    date: '31/01/2026',
    type: 'major',
    changes: [
      { type: 'new', text: 'Envoi individuel documents stagiaires (certificat, attestation, éval à froid) avec sélection par checkbox' },
      { type: 'new', text: 'Upload vers Supabase Storage avant envoi SMTP — contourne la limite 1MB Vercel' },
      { type: 'new', text: 'Nettoyage automatique du storage après envoi réussi' },
      { type: 'new', text: 'Émargement électronique avec signatures visuelles sur les PDF (checkmarks couleur-codées)' },
      { type: 'new', text: 'Signatures en temps réel : vert = stagiaire signé, bleu = validation manuelle' },
      { type: 'new', text: 'Timestamps de signature affichés sur les émargements' },
      { type: 'new', text: 'Prospection complète avec module analyse de besoins et PDF auto-attaché' },
      { type: 'new', text: 'Certification SST avec templates officiels INRS (FI, MAC)' },
      { type: 'new', text: 'Tests de positionnement avec génération PDF résultats' },
      { type: 'new', text: 'Email RDV compte-rendu avec analyse de besoins auto-attachée' },
      { type: 'new', text: 'Email session post-formation avec tous les documents' },
      { type: 'new', text: 'BCC automatique contact@accessformation.pro sur tous les emails' },
      { type: 'new', text: 'Noms de fichiers storage slugifiés (accents supprimés) avec noms originaux préservés en PJ' },
      { type: 'improve', text: 'Conformité RGPD : chaque stagiaire ne reçoit que ses propres documents' },
      { type: 'improve', text: 'Délai de 1.5s entre les envois SMTP pour éviter le rate limiting IONOS' },
      { type: 'fix', text: 'Nettoyage des versions incohérentes : package.json, pdfGenerator, TraineePortal, Changelog — tout aligné en 2.0.0' },
      { type: 'fix', text: 'Suppression des fichiers inutiles (logo.png, logo-access.png, stamp.png, .gitkeep, sstCompetencesConfig racine, VersionHistory.jsx)' },
    ]
  },
  {
    version: '1.9.0',
    date: '18/01/2026',
    type: 'major',
    changes: [
      { type: 'new', text: 'Widget statistiques Qualiopi temps réel sur site web public (Indicateur 2)' },
      { type: 'new', text: '4 indicateurs publics : Satisfaction 4.96/5, Réussite 100%, Présence 98%, 48 stagiaires' },
      { type: 'new', text: 'Connexion directe Supabase, mise à jour automatique, design Access Campus' },
      { type: 'new', text: 'Module Documents de Formation : ressources pédagogiques par formation (Ind. 19-20)' },
      { type: 'new', text: 'Upload multi-formats (PDF, PPT, Word, Excel), catégories (Support/Exercices/Évaluation)' },
      { type: 'new', text: 'Diffusion automatique via portail stagiaire QR Code, téléchargements trackés' },
      { type: 'new', text: 'Module Développement Formateurs : formations suivies + entretiens (Ind. 22-23)' },
      { type: 'new', text: 'Tables trainer_trainings et trainer_interviews, upload certificats' },
      { type: 'new', text: 'Données pré-remplies 2023-2025, prêt pour audit immédiat' },
      { type: 'new', text: 'Remédiation individualisée par objectif dans session_trainees' },
      { type: 'new', text: 'Alertes réclamations sur dashboard avec emails automatiques responsable qualité' },
      { type: 'new', text: 'Numéro Sécurité Sociale obligatoire : 13 chiffres + clé de contrôle (2 chiffres)' },
      { type: 'new', text: 'Émargement QR sécurisé : certification présence + signature + blocage temporel' },
      { type: 'new', text: 'Conformité Qualiopi : 90% (28/32 indicateurs) avec guide audit complet' },
      { type: 'fix', text: 'Corrections : RPC p_gender, dates PDF, permissions Supabase, RLS widget' },
    ]
  },
  {
    version: '1.8.0',
    date: '17/01/2026',
    type: 'major',
    changes: [
      { type: 'new', text: 'Page Profil des Stagiaires avec statistiques démographiques RGPD-compliant (genre, âge, CSP, handicap, postes)' },
      { type: 'new', text: 'Filtres puissants (période, client, formation, financement) + exports Excel/CSV' },
      { type: 'new', text: 'Protection RGPD : seuil 5 personnes minimum pour affichage statistiques' },
      { type: 'new', text: 'Mentions émargement QR Code dans conventions et convocations' },
      { type: 'new', text: 'Champ Genre pour stagiaires (male/female/non_binary)' },
      { type: 'new', text: 'Accords grammaticaux automatiques dans tous les PDF (Madame/Monsieur, Salarié/Salariée)' },
      { type: 'new', text: 'Type de financement sessions : 10 types (OPCO, CPF, FAF, Région, France Travail, etc.)' },
      { type: 'new', text: 'Suivi conventions : statuts Envoyée/Signée, upload PDF signée' },
      { type: 'new', text: 'Stockage Supabase : bucket signed-conventions avec RLS' },
      { type: 'fix', text: 'Corrections : RPC save_trainee_with_ssn, apostrophes SQL, Store.js' },
    ]
  },
  {
    version: '1.7.1',
    date: '17/01/2026',
    type: 'patch',
    changes: [
      { type: 'fix', text: 'Portail Stagiaire : émargements dans attendance_halfdays (morning/afternoon)' },
      { type: 'fix', text: 'Évaluations à chaud : questionnaire_submitted, submitted_at, submitted_online correctement renseignés' },
      { type: 'fix', text: 'Optimisation requêtes Supabase avec maybeSingle() au lieu de single()' },
      { type: 'fix', text: 'Formulaire Réclamations : design complet restauré (logo, couleurs, téléphone)' },
      { type: 'fix', text: 'RLS policies corrigées pour accès anonyme aux tables sessions et courses' },
    ]
  },
  {
    version: '1.7.0',
    date: '17/01/2026',
    type: 'major',
    changes: [
      { type: 'new', text: 'Portail QR sécurisé : codes d\'accès à 6 chiffres par stagiaire' },
      { type: 'new', text: 'Verrouillage après 5 tentatives échouées (15 min), régénération par admin' },
      { type: 'new', text: 'Protection anti-bruteforce avec compteur' },
      { type: 'new', text: 'Système de réclamations : honeypot anti-spam, vérification référence session' },
      { type: 'new', text: 'Onglet Portail QR dans SessionDetail avec gestion des codes' },
      { type: 'new', text: 'Envoi codes par email aux stagiaires, affichage QR + codes pour impression' },
      { type: 'new', text: '8 nouvelles fonctions RPC SECURITY DEFINER, triggers génération automatique codes' },
    ]
  },
  {
    version: '1.6.1',
    date: '15/01/2026',
    type: 'patch',
    changes: [
      { type: 'fix', text: 'Calcul résultats sessions demi-journées' },
      { type: 'fix', text: 'Sauvegarde champs CSP et job_title dans fiche stagiaire' },
      { type: 'fix', text: 'Filtres RGPD statistiques fonctionnels' },
    ]
  },
  {
    version: '1.6.0',
    date: '10/01/2026',
    type: 'major',
    changes: [
      { type: 'new', text: 'Module Réclamations intégré dans Non-conformités (source, canal, délais AR/clôture)' },
      { type: 'new', text: 'Alertes visuelles réclamations en retard (AR 48h orange, clôture 5j rouge)' },
      { type: 'new', text: 'Référence automatique REC-YYYY-NNN' },
      { type: 'new', text: 'Documents sous-traitance éditables' },
      { type: 'new', text: 'Plan d\'actions avec responsable, échéance, statut' },
      { type: 'fix', text: 'RDD : comptage sessions et stagiaires' },
      { type: 'fix', text: 'RDD : score satisfaction depuis évaluations à chaud' },
      { type: 'fix', text: 'Filtres Audit RGPD' },
    ]
  },
  {
    version: '1.5.0',
    date: '09/01/2026',
    type: 'major',
    changes: [
      { type: 'new', text: 'Module Qualité complet : Documents, Registres, Revue Direction' },
      { type: 'new', text: 'Documents éditables avec bouton Éditer' },
      { type: 'new', text: 'Logigrammes format tableau' },
      { type: 'new', text: 'Pack Qualité : 40 documents pré-fournis' },
    ]
  },
  {
    version: '1.4.0',
    date: '09/01/2026',
    type: 'major',
    changes: [
      { type: 'new', text: 'Système de notifications automatiques' },
      { type: 'new', text: 'Rappels hebdomadaires (veille, matériel, audit)' },
      { type: 'new', text: 'Alertes anniversaires certifications formateurs' },
      { type: 'new', text: 'Cloche de notification avec badge compteur' },
    ]
  },
  {
    version: '1.3.0',
    date: '06/01/2026',
    type: 'major',
    changes: [
      { type: 'new', text: 'Module Process : éditeur visuel de logigrammes' },
      { type: 'new', text: 'Formes : Début/Fin, Action, Décision, Document' },
      { type: 'new', text: 'Export PNG avec code et version' },
      { type: 'new', text: '3 process pré-créés' },
    ]
  },
  {
    version: '1.2.3',
    date: '06/01/2026',
    type: 'patch',
    changes: [
      { type: 'fix', text: 'Portail stagiaire : redirection Google corrigée' },
      { type: 'fix', text: 'Support sessions demi-journée' },
      { type: 'new', text: 'Nouveau champ Type de journée' },
    ]
  },
  {
    version: '1.2.2',
    date: '06/01/2026',
    type: 'patch',
    changes: [
      { type: 'fix', text: 'Correction affichage complet alertes qualité (Formation, Date, Formateur, Stagiaire)' },
      { type: 'fix', text: 'Correction création de non-conformité depuis une alerte (tous champs requis)' },
      { type: 'fix', text: 'Suppression des requêtes Supabase avec jointures (erreurs 400)' },
      { type: 'improve', text: 'Enrichissement des données alertes via le store existant' },
      { type: 'improve', text: 'Modal de traitement avec toutes les informations' },
    ]
  },
  {
    version: '1.2.1',
    date: '06/01/2026',
    type: 'patch',
    changes: [
      { type: 'new', text: 'Alertes Qualité automatiques pour notes 1-3/5 avec détail (session, stagiaire, critère)' },
      { type: 'new', text: 'Traitement des alertes avec commentaire, date et utilisateur' },
      { type: 'new', text: 'Création/liaison de non-conformités depuis les alertes' },
      { type: 'new', text: 'Section Alertes Qualité dans le Dashboard' },
      { type: 'new', text: 'Texte explicatif calcul des indicateurs (page Indicateurs)' },
      { type: 'new', text: 'Texte explicatif référentiel Qualiopi (page Qualiopi)' },
      { type: 'improve', text: 'Clic sur alerte → navigation vers la session concernée' },
    ]
  },
  {
    version: '1.2.0',
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
    version: '1.1.0',
    date: '04/01/2026',
    type: 'minor',
    changes: [
      { type: 'new', text: 'Page Qualiopi complète avec 4 onglets (Dashboard, Documents, Veille, Sources)' },
      { type: 'new', text: 'Widget HTML indicateurs Qualiopi intégrable sur site web' },
      { type: 'new', text: '8 documents PDF professionnels (Politique Qualité, Charte Déontologie, Procédures, CGV, Règlement, Livret)' },
      { type: 'new', text: 'Préparation audit Qualiopi 67 questions' },
      { type: 'fix', text: 'Statut session automatique Terminée à J+1' },
      { type: 'fix', text: 'Calcul taux de recommandation corrigé' },
      { type: 'fix', text: 'Affichage documents HTML (détection automatique)' },
    ]
  },
  {
    version: '1.0.5',
    date: '04/01/2026',
    type: 'patch',
    changes: [
      { type: 'new', text: 'Gestion du matériel de formation' },
      { type: 'new', text: 'Renommage CACES → Conduite (R485, R489)' },
      { type: 'new', text: 'Convocations batch (envoi groupé)' },
      { type: 'improve', text: 'Gestion des statuts de session' },
    ]
  },
  {
    version: '1.0.4',
    date: '03/01/2026',
    type: 'patch',
    changes: [
      { type: 'new', text: 'Évaluations à chaud avec 14 critères détaillés (Organisation, Contenu, Formateur, Perception)' },
      { type: 'new', text: 'Bouton Recommanderiez-vous cette formation ?' },
      { type: 'new', text: 'Commentaires généraux et projet de formation' },
      { type: 'fix', text: 'Sauvegarde des évaluations manuelles' },
    ]
  },
  {
    version: '1.0.3',
    date: '01/01/2026',
    type: 'patch',
    changes: [
      { type: 'new', text: 'Thèmes de formation (SST, Incendie, Ergonomie, Habilitation Électrique, Conduite R489, Conduite R485)' },
      { type: 'new', text: 'Tests de positionnement par thème (page dédiée)' },
      { type: 'new', text: 'Duplication des formations en un clic' },
      { type: 'new', text: 'Duplication des sessions (dates vides, statut brouillon)' },
      { type: 'new', text: 'Filtres avancés stagiaires (recherche, entreprise)' },
      { type: 'new', text: 'Case Intra-entreprise avec adresse automatique' },
      { type: 'new', text: 'Logo personnalisable sur tous les documents PDF' },
      { type: 'fix', text: 'Indicateurs à 0% quand aucune donnée' },
      { type: 'fix', text: 'Tous documents : cases à cocher correctement affichées' },
    ]
  },
  {
    version: '1.0.2',
    date: '31/12/2025',
    type: 'patch',
    changes: [
      { type: 'new', text: 'Dashboard avec 4 indicateurs (satisfaction, recommandation, présence, réponse)' },
      { type: 'new', text: 'Indicateur Complétude cliquable avec rapport téléchargeable' },
      { type: 'new', text: 'Indicateur Qualiopi cliquable avec rapport non-conformités' },
      { type: 'new', text: 'Onglet Suivi & Évaluations dans les sessions' },
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
    version: '1.0.1',
    date: '30/12/2025',
    type: 'patch',
    changes: [
      { type: 'new', text: 'Gestion des non-conformités Qualiopi' },
      { type: 'new', text: 'Certificats formateurs avec dates expiration' },
      { type: 'new', text: 'Documents vierges téléchargeables' },
      { type: 'improve', text: 'Amélioration du tableau de bord' },
    ]
  },
  {
    version: '1.0.0',
    date: '29/12/2025',
    type: 'major',
    changes: [
      { type: 'new', text: 'Génération Convention de formation' },
      { type: 'new', text: 'Génération Émargement' },
      { type: 'new', text: 'Génération Certificat de réalisation' },
      { type: 'new', text: 'Génération Attestation de présence' },
      { type: 'new', text: 'Génération Programme' },
      { type: 'new', text: 'QR Code émargement numérique' },
      { type: 'new', text: 'Référence session automatique (SES-YYYY-XXX)' },
      { type: 'new', text: 'Gestion des stagiaires' },
      { type: 'new', text: 'Gestion des formateurs' },
      { type: 'new', text: 'Gestion des sessions de formation' },
      { type: 'new', text: 'Inscription stagiaires aux sessions' },
      { type: 'new', text: 'Assignation formateurs aux sessions' },
      { type: 'new', text: 'Gestion des clients' },
      { type: 'new', text: 'Gestion des formations (catalogue)' },
      { type: 'new', text: 'Authentification sécurisée' },
      { type: 'new', text: 'Tableau de bord basique' },
      { type: 'new', text: 'Interface responsive mobile' },
    ]
  },
]

const typeLabels = {
  major: { label: 'Version majeure', color: 'bg-purple-100 text-purple-800' },
  minor: { label: 'Mise à jour', color: 'bg-blue-100 text-blue-800' },
  patch: { label: 'Correction', color: 'bg-gray-100 text-gray-700' },
}

const changeIcons = {
  new: <Plus className="w-4 h-4 text-green-600" />,
  fix: <Wrench className="w-4 h-4 text-amber-600" />,
  improve: <Sparkles className="w-4 h-4 text-blue-600" />,
  security: <Shield className="w-4 h-4 text-red-600" />,
}

export default function Changelog() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/settings" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historique des versions</h1>
          <p className="text-sm text-gray-500">Access Campus — v{versions[0].version}</p>
        </div>
      </div>

      <div className="space-y-6">
        {versions.map((v, idx) => (
          <div key={v.version} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header version */}
            <div className={`px-5 py-3 flex items-center justify-between ${idx === 0 ? 'bg-primary-50 border-b border-primary-200' : 'bg-gray-50 border-b border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${idx === 0 ? 'text-primary-700' : 'text-gray-800'}`}>
                  v{v.version}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeLabels[v.type]?.color}`}>
                  {typeLabels[v.type]?.label}
                </span>
                {idx === 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    CURRENT
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">{v.date}</span>
            </div>

            {/* Changes */}
            <div className="px-5 py-3 space-y-1.5">
              {v.changes.map((c, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex-shrink-0">{changeIcons[c.type] || changeIcons.new}</span>
                  <span className="text-sm text-gray-700">{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Légende */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs font-semibold text-gray-600 mb-2">Légende</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5"><Plus className="w-3.5 h-3.5 text-green-600" /><span className="text-xs text-gray-600">Nouvelle fonctionnalité</span></div>
          <div className="flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-amber-600" /><span className="text-xs text-gray-600">Correction</span></div>
          <div className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-blue-600" /><span className="text-xs text-gray-600">Amélioration</span></div>
          <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-red-600" /><span className="text-xs text-gray-600">Sécurité</span></div>
        </div>
      </div>
    </div>
  )
}
