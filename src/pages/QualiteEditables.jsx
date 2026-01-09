import { useState, useEffect } from 'react'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { 
  FileText, Download, Save, Edit, X, Plus, Trash2, ChevronDown, ChevronRight,
  Building2, ClipboardList, Table, CheckSquare, Users2, BarChart3, Shield,
  AlertTriangle, Calendar, User, Loader2, Eye, RefreshCw
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

// ===== CONFIGURATION DES DOCUMENTS =====
const QUALITY_DOCS = {
  gouvernance: {
    name: 'Gouvernance',
    icon: Building2,
    color: 'blue',
    docs: [
      { id: 'organigramme', name: 'Organigramme', code: 'ORG-AF-001' },
      { id: 'des-qual', name: 'Désignation Responsable Qualité', code: 'AF-DESQUAL' },
      { id: 'des-hand', name: 'Désignation Référent Handicap', code: 'AF-DESHAND' },
      { id: 'des-deon', name: 'Désignation Référent Déontologie', code: 'AF-DESDEON' },
      { id: 'des-recl', name: 'Désignation Référent Réclamations', code: 'AF-DESRECL' },
      { id: 'des-veil', name: 'Désignation Référent Veille', code: 'AF-DESVEIL' },
      { id: 'des-amel', name: 'Désignation Référent Amélioration', code: 'AF-DESAMEL' },
      { id: 'des-rgpd', name: 'Désignation Référent RGPD', code: 'AF-DESRGPD' },
    ]
  },
  procedures: {
    name: 'Procédures',
    icon: ClipboardList,
    color: 'green',
    docs: [
      { id: 'proc-info', name: 'Information du public', code: 'AF-INFO', indicateur: '1' },
      { id: 'proc-besoin', name: 'Analyse des besoins', code: 'AF-BESOIN', indicateur: '4' },
      { id: 'proc-concep', name: 'Conception des formations', code: 'AF-CONCEP', indicateur: '5' },
      { id: 'proc-real', name: 'Réalisation des formations', code: 'AF-REAL', indicateur: '9-11' },
      { id: 'proc-eval', name: 'Évaluation des acquis', code: 'AF-EVAL', indicateur: '11' },
      { id: 'proc-sat', name: 'Satisfaction', code: 'AF-SAT', indicateur: '30-31' },
      { id: 'proc-recl', name: 'Réclamations', code: 'AF-RECL', indicateur: '31' },
      { id: 'proc-nc', name: 'Non-conformités', code: 'AF-NC', indicateur: '32' },
      { id: 'proc-veille', name: 'Veille réglementaire', code: 'AF-VEILLE', indicateur: '23-25' },
      { id: 'proc-rgpd', name: 'Protection des données', code: 'AF-RGPD', indicateur: '1' },
      { id: 'proc-hand', name: 'Accessibilité handicap', code: 'AF-HAND', indicateur: '26' },
      { id: 'proc-form', name: 'Gestion des formateurs', code: 'AF-FORM', indicateur: '21' },
      { id: 'proc-mat', name: 'Gestion du matériel', code: 'AF-MAT', indicateur: '9' },
      { id: 'proc-doc', name: 'Gestion documentaire', code: 'AF-DOC', indicateur: '32' },
      { id: 'proc-amel', name: 'Amélioration continue', code: 'AF-AMEL', indicateur: '32' },
    ]
  },
  registres: {
    name: 'Registres',
    icon: Table,
    color: 'purple',
    docs: [
      { id: 'reg-recl', name: 'Registre réclamations', code: 'AF-REGREC', linked: 'reclamations' },
      { id: 'reg-nc', name: 'Registre non-conformités', code: 'AF-REGNC', linked: 'non_conformites' },
      { id: 'reg-veille', name: 'Registre veille', code: 'AF-REGVEI' },
      { id: 'reg-mat', name: 'Registre matériel', code: 'AF-REGMAT', linked: 'equipment_catalog' },
      { id: 'reg-rgpd', name: 'Registre traitements RGPD', code: 'AF-REGRGPD' },
      { id: 'reg-audit', name: 'Registre audits internes', code: 'AF-REGAUD' },
      { id: 'reg-prest', name: 'Évaluation prestataires', code: 'AF-REGPRE' },
    ]
  },
  checklists: {
    name: 'Checklists',
    icon: CheckSquare,
    color: 'orange',
    docs: [
      { id: 'check-audit', name: 'Checklist audit interne', code: 'AF-CHKAUD' },
      { id: 'check-accueil', name: 'Checklist accueil stagiaire', code: 'AF-CHKACC' },
      { id: 'check-cloture', name: 'Checklist clôture session', code: 'AF-CHKCLO' },
      { id: 'check-materiel', name: 'Checklist matériel formation', code: 'AF-CHKMAT' },
    ]
  },
  pilotage: {
    name: 'Pilotage',
    icon: BarChart3,
    color: 'teal',
    docs: [
      { id: 'rdd', name: 'Revue de direction', code: 'AF-RDD' },
      { id: 'plan-actions', name: 'Plan d\'actions', code: 'AF-PLAN' },
      { id: 'indicateurs', name: 'Tableau des indicateurs', code: 'AF-INDIC', linked: 'computed' },
    ]
  },
  soustraitance: {
    name: 'Sous-traitance',
    icon: Users2,
    color: 'gray',
    docs: [
      { id: 'contrat-st', name: 'Contrat sous-traitance', code: 'AF-CTRAIT' },
      { id: 'charte-st', name: 'Charte qualité prestataire', code: 'AF-CHARTE' },
      { id: 'nda', name: 'Accord de confidentialité (NDA)', code: 'AF-NDA' },
    ]
  },
}

// ===== ORGANISATION =====
const ORGANISATION = {
  nom: 'Access Formation',
  forme: 'SARL',
  siret: '943 563 866 00012',
  nda: '53 29 10261 29',
  tva: 'FR71943563866',
  capital: '2500',
  rcs: 'Quimper',
  adresse: '24 rue Kerbleiz',
  cp: '29900',
  ville: 'Concarneau',
  tel: '02 46 56 57 54',
  email: 'contact@accessformation.pro',
  perimetre: 'Bretagne & Pays de la Loire',
  type: 'Formations intra-entreprise',
}

const RESPONSABLES = {
  hicham: {
    nom: 'Hicham SAIDI',
    roles: ['Qualité', 'Veille légale', 'Réclamations', 'RGPD', 'Commercial', 'Planification', 'Archivage'],
    formations: ['SST', 'Incendie', 'Habilitation électrique'],
  },
  maxime: {
    nom: 'Maxime LANGLAIS', 
    roles: ['Pédagogie', 'Veille métiers', 'Amélioration continue', 'Déontologie', 'Handicap'],
    formations: ['SST', 'Gestes & postures', 'Incendie', 'Conduite de chariots'],
  },
}

const DESIGNATIONS = {
  'des-qual': { role: 'Responsable Qualité', personne: 'hicham', missions: [
    'Piloter et animer le système de management de la qualité',
    'Assurer le suivi des indicateurs de performance',
    'Préparer et suivre les audits internes et externes',
    'Proposer les actions d\'amélioration continue',
    'Garantir la conformité au référentiel Qualiopi',
  ]},
  'des-hand': { role: 'Référent Handicap', personne: 'maxime', missions: [
    'Accueillir et informer les personnes en situation de handicap',
    'Identifier les besoins d\'adaptation des formations',
    'Assurer le lien avec les partenaires spécialisés (Agefiph, Cap Emploi, MDPH)',
    'Sensibiliser l\'équipe pédagogique aux enjeux de l\'accessibilité',
    'Suivre les aménagements mis en place',
  ]},
  'des-deon': { role: 'Référent Déontologie', personne: 'maxime', missions: [
    'Veiller au respect des règles déontologiques et éthiques',
    'Traiter les signalements de manquements éventuels',
    'Conseiller la direction sur les questions éthiques',
    'Sensibiliser l\'équipe aux bonnes pratiques professionnelles',
  ]},
  'des-recl': { role: 'Référent Réclamations', personne: 'hicham', missions: [
    'Réceptionner et enregistrer les réclamations clients et stagiaires',
    'Analyser les causes et proposer des solutions adaptées',
    'Assurer le suivi et la clôture des réclamations dans les délais',
    'Communiquer les résultats aux parties prenantes',
    'Proposer des actions préventives',
  ]},
  'des-veil': { role: 'Référent Veille', personne: 'hicham', missions: [
    'Assurer une veille réglementaire (Code du travail, formation professionnelle)',
    'Suivre les évolutions des référentiels (INRS, NF C18-510, CACES...)',
    'Informer l\'équipe des évolutions impactant l\'activité',
    'Mettre à jour les documents et procédures concernés',
  ]},
  'des-amel': { role: 'Référent Amélioration Continue', personne: 'maxime', missions: [
    'Analyser les non-conformités et dysfonctionnements',
    'Proposer et suivre les actions correctives et préventives',
    'Animer les démarches d\'amélioration continue',
    'Mesurer l\'efficacité des actions menées',
    'Préparer les éléments pour la revue de direction',
  ]},
  'des-rgpd': { role: 'Délégué à la Protection des Données', personne: 'hicham', missions: [
    'Veiller à la conformité RGPD des traitements de données',
    'Tenir à jour le registre des traitements',
    'Répondre aux demandes d\'exercice de droits des personnes',
    'Sensibiliser le personnel à la protection des données',
    'Gérer les éventuelles violations de données',
  ]},
}

// ===== COMPOSANT PRINCIPAL =====
export default function QualiteEditables() {
  const { organization } = useDataStore()
  const [expandedCats, setExpandedCats] = useState(['gouvernance'])
  const [editingDoc, setEditingDoc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedDocs, setSavedDocs] = useState({})
  const [generating, setGenerating] = useState(false)
  
  // Charger les documents sauvegardés
  useEffect(() => {
    loadSavedDocs()
  }, [])
  
  const loadSavedDocs = async () => {
    const { data } = await supabase
      .from('quality_documents')
      .select('*')
    if (data) {
      const docs = {}
      data.forEach(d => { docs[d.doc_id] = d })
      setSavedDocs(docs)
    }
  }
  
  const toggleCat = (id) => {
    setExpandedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }
  
  const getColorClass = (color) => {
    const colors = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      orange: 'bg-orange-500',
      teal: 'bg-teal-500',
      gray: 'bg-gray-500',
      red: 'bg-red-500',
    }
    return colors[color] || 'bg-gray-500'
  }
  
  const hasData = (docId) => savedDocs[docId]?.content
  
  // ===== GÉNÉRATION PDF =====
  const generatePDF = (docId, docInfo) => {
    setGenerating(true)
    
    try {
      const doc = new jsPDF()
      const w = doc.internal.pageSize.getWidth()
      const version = '2.5.23'
      const dateStr = format(new Date(), 'dd/MM/yyyy')
      
      // En-tête standard
      const addHeader = () => {
        doc.setFontSize(9)
        doc.setTextColor(100)
        doc.text(`${ORGANISATION.nom} ${ORGANISATION.forme}`, 20, 15)
        doc.text(`${ORGANISATION.adresse}, ${ORGANISATION.cp} ${ORGANISATION.ville}`, 20, 20)
        doc.text(`Tél : ${ORGANISATION.tel} - ${ORGANISATION.email}`, 20, 25)
        doc.text(`SIRET : ${ORGANISATION.siret}`, w - 20, 15, { align: 'right' })
        doc.text(`NDA : ${ORGANISATION.nda}`, w - 20, 20, { align: 'right' })
      }
      
      // Pied de page standard
      const addFooter = (pageNum = 1, totalPages = 1) => {
        doc.setFontSize(8)
        doc.setTextColor(128)
        doc.text(`${docInfo.code}-V${version} - ${dateStr}`, 20, 285)
        doc.text(`Page ${pageNum}/${totalPages}`, w - 20, 285, { align: 'right' })
        doc.text('Access Formation - Organisme de formation', w / 2, 290, { align: 'center' })
      }
      
      addHeader()
      
      // Titre
      doc.setFontSize(14)
      doc.setTextColor(0)
      doc.setFont(undefined, 'bold')
      doc.text(docInfo.name.toUpperCase(), w / 2, 45, { align: 'center' })
      
      // Code et version
      doc.setFontSize(9)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(100)
      doc.text(`${docInfo.code}-V${version} - ${dateStr}`, w / 2, 52, { align: 'center' })
      
      // Contenu selon le type
      let y = 70
      doc.setFontSize(10)
      doc.setTextColor(0)
      
      if (docId === 'organigramme') {
        generateOrganigramme(doc, y)
      } else if (docId.startsWith('des-')) {
        generateDesignation(doc, docId, y)
      } else if (docId.startsWith('proc-')) {
        generateProcedure(doc, docId, docInfo, y)
      } else if (docId.startsWith('reg-')) {
        generateRegistre(doc, docId, docInfo, y)
      } else if (docId === 'rdd') {
        generateRDD(doc, y)
      } else {
        // Document générique
        doc.text('Document en cours de rédaction.', 20, y)
      }
      
      addFooter()
      doc.save(`${docInfo.code}-V${version}.pdf`)
      toast.success('PDF généré !')
      
    } catch (error) {
      console.error(error)
      toast.error('Erreur génération PDF')
    }
    
    setGenerating(false)
  }
  
  // ===== GÉNÉRATION ORGANIGRAMME =====
  const generateOrganigramme = (doc, startY) => {
    const w = doc.internal.pageSize.getWidth()
    let y = startY
    
    // Titre section gouvernance
    doc.setFillColor(59, 130, 246)
    doc.rect(20, y, w - 40, 8, 'F')
    doc.setTextColor(255)
    doc.setFont(undefined, 'bold')
    doc.text('GOUVERNANCE (matricielle)', w / 2, y + 6, { align: 'center' })
    
    y += 15
    doc.setTextColor(0)
    
    // Deux colonnes pour Hicham et Maxime
    const colW = (w - 50) / 2
    
    // Hicham
    doc.setFillColor(240, 240, 240)
    doc.rect(20, y, colW, 45, 'F')
    doc.setFont(undefined, 'bold')
    doc.text(RESPONSABLES.hicham.nom, 20 + colW/2, y + 8, { align: 'center' })
    doc.setFont(undefined, 'normal')
    doc.setFontSize(8)
    doc.text('Co-direction (50/50)', 20 + colW/2, y + 14, { align: 'center' })
    let yRoles = y + 20
    RESPONSABLES.hicham.roles.forEach(r => {
      doc.text(`• ${r}`, 25, yRoles)
      yRoles += 4
    })
    
    // Maxime
    doc.setFillColor(240, 240, 240)
    doc.rect(30 + colW, y, colW, 45, 'F')
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text(RESPONSABLES.maxime.nom, 30 + colW + colW/2, y + 8, { align: 'center' })
    doc.setFont(undefined, 'normal')
    doc.setFontSize(8)
    doc.text('Co-direction (50/50)', 30 + colW + colW/2, y + 14, { align: 'center' })
    yRoles = y + 20
    RESPONSABLES.maxime.roles.forEach(r => {
      doc.text(`• ${r}`, 35 + colW, yRoles)
      yRoles += 4
    })
    
    y += 55
    
    // Tableau des fonctions
    doc.setFontSize(10)
    doc.setFillColor(59, 130, 246)
    doc.rect(20, y, w - 40, 8, 'F')
    doc.setTextColor(255)
    doc.setFont(undefined, 'bold')
    doc.text('FONCTIONS TRANSVERSES (Responsable / Appui)', w / 2, y + 6, { align: 'center' })
    
    y += 12
    doc.setTextColor(0)
    doc.setFontSize(8)
    
    const fonctions = [
      ['Pilotage qualité', 'Hicham SAIDI', 'Maxime LANGLAIS'],
      ['Veille légale et réglementaire', 'Hicham SAIDI', 'Maxime LANGLAIS'],
      ['Veille métiers / pédagogique', 'Maxime LANGLAIS', 'Hicham SAIDI'],
      ['Traitement des réclamations', 'Hicham SAIDI', 'Maxime LANGLAIS'],
      ['Amélioration continue', 'Maxime LANGLAIS', 'Hicham SAIDI'],
      ['RGPD / conformité', 'Hicham SAIDI', 'Maxime LANGLAIS'],
      ['Référent Déontologie', 'Maxime LANGLAIS', 'Hicham SAIDI'],
      ['Référent Handicap', 'Maxime LANGLAIS', 'Hicham SAIDI'],
    ]
    
    // En-têtes tableau
    doc.setFillColor(230, 230, 230)
    doc.rect(20, y, 80, 6, 'F')
    doc.rect(100, y, 45, 6, 'F')
    doc.rect(145, y, 45, 6, 'F')
    doc.setFont(undefined, 'bold')
    doc.text('Fonction', 22, y + 4)
    doc.text('Responsable (R)', 102, y + 4)
    doc.text('Appui (S)', 147, y + 4)
    y += 6
    
    doc.setFont(undefined, 'normal')
    fonctions.forEach(([fn, r, s]) => {
      doc.text(fn, 22, y + 4)
      doc.text(r, 102, y + 4)
      doc.text(s, 147, y + 4)
      y += 5
    })
    
    y += 10
    
    // Équipe pédagogique
    doc.setFontSize(10)
    doc.setFillColor(34, 197, 94)
    doc.rect(20, y, w - 40, 8, 'F')
    doc.setTextColor(255)
    doc.setFont(undefined, 'bold')
    doc.text('ÉQUIPE PÉDAGOGIQUE', w / 2, y + 6, { align: 'center' })
    
    y += 12
    doc.setTextColor(0)
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    doc.text(`${RESPONSABLES.hicham.nom} : ${RESPONSABLES.hicham.formations.join(', ')}`, 22, y)
    y += 6
    doc.text(`${RESPONSABLES.maxime.nom} : ${RESPONSABLES.maxime.formations.join(', ')}`, 22, y)
    
    y += 12
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(`Outils : Sellsy (CRM, devis, facturation) - Access Campus (documents formation)`, 22, y)
    y += 5
    doc.text(`Périmètre : ${ORGANISATION.type} - ${ORGANISATION.perimetre}`, 22, y)
  }
  
  // ===== GÉNÉRATION DÉSIGNATION =====
  const generateDesignation = (doc, docId, startY) => {
    const w = doc.internal.pageSize.getWidth()
    const info = DESIGNATIONS[docId]
    if (!info) return
    
    const personne = RESPONSABLES[info.personne]
    const dateStr = format(new Date(), 'd MMMM yyyy', { locale: fr })
    let y = startY
    
    doc.setFontSize(11)
    doc.text('Je soussigné, Access Formation SARL, représenté par ses co-gérants,', 20, y)
    y += 15
    doc.text('Désigne par la présente :', 20, y)
    y += 12
    doc.setFont(undefined, 'bold')
    doc.setFontSize(14)
    doc.text(personne.nom, 40, y)
    y += 12
    doc.setFont(undefined, 'normal')
    doc.setFontSize(11)
    doc.text(`en qualité de ${info.role} de l'organisme de formation.`, 20, y)
    y += 15
    doc.text(`Cette désignation prend effet à compter du ${dateStr}.`, 20, y)
    y += 20
    
    // Missions
    doc.setFont(undefined, 'bold')
    doc.text('Missions confiées :', 20, y)
    y += 8
    doc.setFont(undefined, 'normal')
    doc.setFontSize(10)
    info.missions.forEach(m => {
      doc.text(`• ${m}`, 25, y)
      y += 6
    })
    
    // Signature
    y = 220
    doc.setFontSize(11)
    doc.text(`Fait à ${ORGANISATION.ville}, le ${dateStr}`, 20, y)
    y += 15
    doc.text('Les Co-gérants,', 20, y)
    y += 20
    doc.text('Hicham SAIDI', 30, y)
    doc.text('Maxime LANGLAIS', 120, y)
  }
  
  // ===== GÉNÉRATION PROCÉDURE =====
  const generateProcedure = (doc, docId, docInfo, startY) => {
    const w = doc.internal.pageSize.getWidth()
    let y = startY
    
    // Cartouche
    doc.setFillColor(240, 240, 240)
    doc.rect(20, y, w - 40, 25, 'F')
    doc.setFontSize(9)
    doc.text(`Indicateur(s) Qualiopi : ${docInfo.indicateur || '-'}`, 25, y + 6)
    doc.text(`Responsable : ${docId.includes('veille') || docId.includes('recl') || docId.includes('rgpd') ? 'Hicham SAIDI' : 'Maxime LANGLAIS'}`, 25, y + 12)
    doc.text(`Fréquence de révision : Annuelle`, 25, y + 18)
    doc.text(`Dernière révision : ${format(new Date(), 'dd/MM/yyyy')}`, 120, y + 18)
    
    y += 35
    
    // Objectif
    doc.setFont(undefined, 'bold')
    doc.setFontSize(11)
    doc.text('1. OBJECTIF', 20, y)
    y += 8
    doc.setFont(undefined, 'normal')
    doc.setFontSize(10)
    
    const objectifs = {
      'proc-info': 'Définir les modalités d\'information du public sur les prestations proposées, les délais d\'accès et les résultats obtenus.',
      'proc-besoin': 'Définir les modalités d\'analyse des besoins du bénéficiaire et d\'adaptation de la prestation.',
      'proc-concep': 'Définir les modalités de conception et d\'adaptation des formations aux besoins identifiés.',
      'proc-real': 'Définir les modalités de réalisation des actions de formation.',
      'proc-eval': 'Définir les modalités d\'évaluation des acquis des stagiaires.',
      'proc-sat': 'Définir les modalités de recueil et de traitement des appréciations des parties prenantes.',
      'proc-recl': 'Définir les modalités de traitement des réclamations et des difficultés rencontrées.',
      'proc-nc': 'Définir les modalités de traitement des non-conformités et des actions correctives.',
      'proc-veille': 'Définir les modalités de veille légale, réglementaire et pédagogique.',
      'proc-rgpd': 'Définir les modalités de protection des données personnelles.',
      'proc-hand': 'Définir les modalités de prise en compte du handicap.',
      'proc-form': 'Définir les modalités de gestion des compétences des formateurs.',
      'proc-mat': 'Définir les modalités de gestion du matériel pédagogique.',
      'proc-doc': 'Définir les modalités de gestion documentaire.',
      'proc-amel': 'Définir les modalités d\'amélioration continue.',
    }
    
    const lines = doc.splitTextToSize(objectifs[docId] || 'Objectif de la procédure.', w - 45)
    doc.text(lines, 25, y)
    y += lines.length * 5 + 10
    
    // Domaine d'application
    doc.setFont(undefined, 'bold')
    doc.setFontSize(11)
    doc.text('2. DOMAINE D\'APPLICATION', 20, y)
    y += 8
    doc.setFont(undefined, 'normal')
    doc.setFontSize(10)
    doc.text('Cette procédure s\'applique à l\'ensemble des actions de formation dispensées par Access Formation.', 25, y)
    y += 15
    
    // Logigramme simplifié
    doc.setFont(undefined, 'bold')
    doc.setFontSize(11)
    doc.text('3. LOGIGRAMME', 20, y)
    y += 10
    
    // Étapes selon la procédure
    const etapes = {
      'proc-recl': ['Réception réclamation', 'Enregistrement (Access Campus)', 'Analyse causes', 'Proposition solution', 'Mise en œuvre', 'Vérification efficacité', 'Clôture'],
      'proc-nc': ['Détection NC', 'Enregistrement', 'Analyse causes (5P)', 'Action corrective', 'Mise en œuvre', 'Vérification efficacité', 'Clôture'],
      'proc-sat': ['Envoi questionnaire', 'Collecte réponses', 'Analyse résultats', 'Actions si score <4', 'Communication résultats'],
    }
    
    const defaultEtapes = ['Identification besoin', 'Planification', 'Réalisation', 'Contrôle', 'Amélioration']
    const steps = etapes[docId] || defaultEtapes
    
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    steps.forEach((step, i) => {
      doc.setFillColor(59, 130, 246)
      doc.roundedRect(25, y, 80, 8, 2, 2, 'F')
      doc.setTextColor(255)
      doc.text(`${i + 1}. ${step}`, 30, y + 5.5)
      doc.setTextColor(0)
      if (i < steps.length - 1) {
        doc.text('↓', 65, y + 12)
      }
      y += 14
    })
    
    y += 10
    
    // Documents associés
    doc.setFont(undefined, 'bold')
    doc.setFontSize(11)
    doc.setTextColor(0)
    doc.text('4. DOCUMENTS ASSOCIÉS', 20, y)
    y += 8
    doc.setFont(undefined, 'normal')
    doc.setFontSize(10)
    doc.text('• Registre associé (Access Campus)', 25, y)
    y += 5
    doc.text('• Tableau des indicateurs', 25, y)
  }
  
  // ===== GÉNÉRATION REGISTRE =====
  const generateRegistre = (doc, docId, docInfo, startY) => {
    doc.setFontSize(10)
    doc.text('Ce registre est géré automatiquement dans Access Campus.', 20, startY)
    doc.text('Exportez les données depuis l\'application pour obtenir la version à jour.', 20, startY + 8)
    
    if (docInfo.linked) {
      doc.text(`Table source : ${docInfo.linked}`, 20, startY + 20)
    }
  }
  
  // ===== GÉNÉRATION RDD =====
  const generateRDD = (doc, startY) => {
    const w = doc.internal.pageSize.getWidth()
    let y = startY
    
    doc.setFontSize(10)
    
    const sections = [
      'Date de la réunion : _______________',
      'Participants : Direction (Hicham SAIDI, Maxime LANGLAIS)',
      '',
      '1. BILAN DES FORMATIONS RÉALISÉES',
      '   - Nombre de sessions : ___',
      '   - Nombre de stagiaires formés : ___',
      '   - Taux de réussite moyen : ___%',
      '',
      '2. BILAN SATISFACTION',
      '   - Score satisfaction moyen : ___/5',
      '   - Taux de recommandation : ___%',
      '',
      '3. BILAN RÉCLAMATIONS',
      '   - Nombre de réclamations : ___',
      '   - Délai moyen de traitement : ___ jours',
      '',
      '4. BILAN NON-CONFORMITÉS',
      '   - Nombre de NC : ___',
      '   - NC clôturées : ___',
      '',
      '5. ATTEINTE DES OBJECTIFS N-1',
      '   ________________________________________________',
      '',
      '6. DÉCISIONS ET ACTIONS',
      '   ________________________________________________',
      '',
      '7. OBJECTIFS ANNÉE N+1',
      '   ________________________________________________',
    ]
    
    sections.forEach(line => {
      doc.text(line, 20, y)
      y += 6
    })
  }
  
  // ===== RENDU =====
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents Qualité</h1>
          <p className="text-gray-500">Pack documentaire Qualiopi - V2.5.23</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadSavedDocs} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>
      
      {/* Info */}
      <div className="card bg-gradient-to-r from-primary-50 to-accent-50 border-primary-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <Shield className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Pack Qualité Access Formation</h3>
            <p className="text-sm text-gray-600 mt-1">
              Documents conformes au référentiel Qualiopi. Cliquez sur "Générer PDF" pour obtenir chaque document complété.
            </p>
            <p className="text-xs text-gray-500 mt-2">Version 2.5.23 • {format(new Date(), 'dd/MM/yyyy')}</p>
          </div>
        </div>
      </div>
      
      {/* Catégories */}
      <div className="space-y-3">
        {Object.entries(QUALITY_DOCS).map(([catId, cat]) => {
          const Icon = cat.icon
          const isExpanded = expandedCats.includes(catId)
          
          return (
            <div key={catId} className="card p-0 overflow-hidden">
              <button
                onClick={() => toggleCat(catId)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getColorClass(cat.color)} text-white`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                    <p className="text-sm text-gray-500">{cat.docs.length} documents</p>
                  </div>
                </div>
                {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              </button>
              
              {isExpanded && (
                <div className="border-t divide-y">
                  {cat.docs.map(docItem => (
                    <div key={docItem.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded mr-2">{docItem.code}</span>
                          <span className="text-gray-900">{docItem.name}</span>
                          {docItem.indicateur && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              Q{docItem.indicateur}
                            </span>
                          )}
                          {docItem.linked && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                              Lié app
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => generatePDF(docItem.id, docItem)}
                        disabled={generating}
                        className="btn btn-sm btn-primary flex items-center gap-1"
                      >
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Générer PDF
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Footer */}
      <div className="text-center text-sm text-gray-500 py-4">
        <p>Documents conformes au référentiel Qualiopi</p>
        <p className="mt-1">Audit initial prévu : fin janvier 2026</p>
      </div>
    </div>
  )
}
