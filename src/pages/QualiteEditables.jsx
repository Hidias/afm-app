import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  FileText, Download, ChevronDown, ChevronRight,
  Building2, ClipboardList, Table, Users2, BarChart3,
  Loader2, RefreshCw
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { format, subYears } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

// ===== CONFIG ENTREPRISE (FIXE) =====
const ORG = {
  nom: 'Access Formation', forme: 'SARL', siret: '943 563 866 00012',
  nda: '53 29 10261 29', adresse: '24 rue Kerbleiz', cp: '29900', ville: 'Concarneau',
  tel: '02 46 56 57 54', email: 'contact@accessformation.pro',
}

const RESP = {
  hicham: { nom: 'Hicham SAIDI', roles: ['Responsable Qualité', 'Veille légale', 'Réclamations', 'RGPD', 'Commercial', 'Planification'], formations: ['SST', 'Incendie', 'Habilitation électrique'] },
  maxime: { nom: 'Maxime LANGLAIS', roles: ['Ingénierie pédagogique', 'Veille métiers', 'Amélioration continue', 'Déontologie', 'Handicap'], formations: ['SST', 'Gestes & postures', 'Incendie', 'Conduite de chariots'] },
}

// ===== DÉSIGNATIONS =====
const DESIGNATIONS = {
  'des-qual': { role: 'Responsable Qualité', personne: 'hicham', missions: ['Piloter le système qualité', 'Suivre les indicateurs', 'Préparer les audits', 'Proposer les améliorations', 'Garantir la conformité Qualiopi'] },
  'des-hand': { role: 'Référent Handicap', personne: 'maxime', missions: ['Accueillir les PSH', 'Identifier les besoins d\'adaptation', 'Lien avec partenaires (Agefiph, MDPH)', 'Sensibiliser l\'équipe', 'Suivre les aménagements'] },
  'des-deon': { role: 'Référent Déontologie', personne: 'maxime', missions: ['Veiller au respect des règles éthiques', 'Traiter les signalements', 'Conseiller la direction', 'Sensibiliser l\'équipe'] },
  'des-recl': { role: 'Référent Réclamations', personne: 'hicham', missions: ['Réceptionner les réclamations', 'Analyser les causes', 'Clôturer sous 5 jours ouvrés', 'Communiquer les résultats', 'Proposer des actions préventives'] },
  'des-veil': { role: 'Référent Veille', personne: 'hicham', missions: ['Veille réglementaire mensuelle', 'Suivre les référentiels INRS/CACES', 'Informer l\'équipe sous 30 jours', 'Mettre à jour les documents'] },
  'des-amel': { role: 'Référent Amélioration Continue', personne: 'maxime', missions: ['Analyser les NC', 'Suivre les actions correctives sous 5 jours', 'Animer l\'amélioration continue', 'Mesurer l\'efficacité', 'Préparer la RDD'] },
  'des-rgpd': { role: 'DPO', personne: 'hicham', missions: ['Conformité RGPD', 'Registre des traitements', 'Répondre aux demandes de droits', 'Sensibiliser le personnel', 'Gérer les violations'] },
}

// ===== PROCÉDURES AVEC SWIMLANES =====
const PROCEDURES = {
  'proc-recl': {
    objectif: 'Définir les modalités de traitement des réclamations pour garantir la satisfaction et l\'amélioration continue.',
    responsable: 'Hicham SAIDI', indicateurs: ['Nombre de réclamations', 'Délai moyen (cible: 5j)', 'Taux de clôture'],
    documents: ['Formulaire réclamation', 'Registre réclamations', 'Fiche action'],
    swimlanes: [
      { acteur: 'Client/Stagiaire', etapes: [{ label: 'Émet réclamation', type: 'start' }] },
      { acteur: 'Réf. Réclamations', etapes: [
        { label: 'Enregistre', delai: 'Immédiat' }, { label: 'Accuse réception', delai: '48h' },
        { label: 'Analyse causes', delai: '2j' }, { label: 'Fondée ?', type: 'decision' },
        { label: 'Propose solution' }, { label: 'Met en œuvre' }, { label: 'Vérifie efficacité' },
        { label: 'Clôture', type: 'end', delai: '5j ouvrés max' }
      ]},
      { acteur: 'Direction', etapes: [{ label: 'Valide solution', type: 'decision' }] },
    ],
  },
  'proc-nc': {
    objectif: 'Définir les modalités de détection et traitement des non-conformités pour l\'amélioration continue.',
    responsable: 'Maxime LANGLAIS', indicateurs: ['Nombre de NC', 'Délai traitement (cible: 5j)', 'Taux NC récurrentes'],
    documents: ['Fiche NC', 'Registre NC', 'Plan d\'actions'],
    swimlanes: [
      { acteur: 'Équipe', etapes: [{ label: 'Détecte NC', type: 'start' }] },
      { acteur: 'Réf. Amélioration', etapes: [
        { label: 'Enregistre', delai: 'Immédiat' }, { label: 'Analyse 5P', delai: '2j' },
        { label: 'Définit action corrective' }, { label: 'Vérifie efficacité' },
        { label: 'Efficace ?', type: 'decision' }, { label: 'Clôture NC', type: 'end' }
      ]},
      { acteur: 'Direction', etapes: [{ label: 'Valide action', type: 'decision' }] },
      { acteur: 'Responsable désigné', etapes: [{ label: 'Met en œuvre', delai: '5j ouvrés' }] },
    ],
  },
  'proc-sat': {
    objectif: 'Définir les modalités de recueil et d\'analyse de la satisfaction des parties prenantes.',
    responsable: 'Hicham SAIDI', indicateurs: ['Score satisfaction (cible: >4/5)', 'Taux de réponse', 'Taux recommandation'],
    documents: ['Questionnaire à chaud', 'Questionnaire J+90', 'Tableau indicateurs'],
    swimlanes: [
      { acteur: 'Formateur', etapes: [{ label: 'Fin formation', type: 'start' }, { label: 'Distribue éval.', delai: 'Immédiat' }] },
      { acteur: 'Stagiaire', etapes: [{ label: 'Complète évaluation' }] },
      { acteur: 'Access Campus', etapes: [{ label: 'Enregistre', type: 'action' }, { label: 'Envoie J+90', delai: '90 jours' }, { label: 'Alerte si <4', type: 'action' }] },
      { acteur: 'Réf. Qualité', etapes: [{ label: 'Analyse mensuelle' }, { label: 'Score <4 ?', type: 'decision' }, { label: 'Action corrective' }, { label: 'Publie indicateurs', type: 'end' }] },
    ],
  },
  'proc-veille': {
    objectif: 'Définir les modalités de veille légale, réglementaire et pédagogique.',
    responsable: 'Hicham SAIDI', indicateurs: ['Nombre de veilles', 'Délai mise à jour (cible: 30j)'],
    documents: ['Registre veille', 'Sources de veille'],
    sources: ['Code du travail', 'INRS (SST, R485, R489)', 'NF C18-510', 'Légifrance', 'Centre Inffo'],
    swimlanes: [
      { acteur: 'Réf. Veille', etapes: [
        { label: 'Consulte sources', type: 'start', delai: 'Mensuel' }, { label: 'Identifie évolution' },
        { label: 'Impact AF ?', type: 'decision' }, { label: 'Analyse impact' }, { label: 'Archive', type: 'end' }
      ]},
      { acteur: 'Direction', etapes: [{ label: 'Valide actions', type: 'decision' }] },
      { acteur: 'Responsable', etapes: [{ label: 'Met à jour docs', delai: '30j max' }] },
    ],
  },
}

// ===== STRUCTURE DOCUMENTS =====
const QUALITY_DOCS = {
  gouvernance: { name: 'Gouvernance', icon: Building2, color: 'blue', docs: [
    { id: 'organigramme', name: 'Organigramme', code: 'ORG-AF-001' },
    { id: 'des-qual', name: 'Désignation Responsable Qualité', code: 'AF-DESQUAL' },
    { id: 'des-hand', name: 'Désignation Référent Handicap', code: 'AF-DESHAND' },
    { id: 'des-deon', name: 'Désignation Référent Déontologie', code: 'AF-DESDEON' },
    { id: 'des-recl', name: 'Désignation Référent Réclamations', code: 'AF-DESRECL' },
    { id: 'des-veil', name: 'Désignation Référent Veille', code: 'AF-DESVEIL' },
    { id: 'des-amel', name: 'Désignation Référent Amélioration', code: 'AF-DESAMEL' },
    { id: 'des-rgpd', name: 'Désignation DPO/RGPD', code: 'AF-DESRGPD' },
  ]},
  procedures: { name: 'Procédures', icon: ClipboardList, color: 'green', docs: [
    { id: 'proc-recl', name: 'Traitement des réclamations', code: 'AF-RECL', indicateur: '31' },
    { id: 'proc-nc', name: 'Non-conformités', code: 'AF-NC', indicateur: '32' },
    { id: 'proc-sat', name: 'Évaluation satisfaction', code: 'AF-SAT', indicateur: '30-31' },
    { id: 'proc-veille', name: 'Veille réglementaire', code: 'AF-VEILLE', indicateur: '23-25' },
  ]},
  registres: { name: 'Registres', icon: Table, color: 'purple', docs: [
    { id: 'reg-recl', name: 'Registre réclamations', code: 'AF-REGREC', table: 'reclamations' },
    { id: 'reg-nc', name: 'Registre non-conformités', code: 'AF-REGNC', table: 'non_conformites' },
    { id: 'reg-veille', name: 'Registre veille', code: 'AF-REGVEI', table: 'veille_reglementaire' },
    { id: 'reg-mat', name: 'Registre matériel', code: 'AF-REGMAT', table: 'equipment_catalog' },
  ]},
  pilotage: { name: 'Pilotage', icon: BarChart3, color: 'teal', docs: [
    { id: 'rdd', name: 'Revue de direction', code: 'AF-RDD', computed: true },
    { id: 'indicateurs', name: 'Tableau indicateurs', code: 'AF-INDIC', computed: true },
  ]},
  soustraitance: { name: 'Sous-traitance', icon: Users2, color: 'gray', docs: [
    { id: 'contrat-st', name: 'Contrat sous-traitance', code: 'AF-CTRAIT' },
    { id: 'charte-st', name: 'Charte qualité prestataire', code: 'AF-CHARTE' },
    { id: 'nda', name: 'Accord de confidentialité', code: 'AF-NDA' },
  ]},
}

// ===== COMPOSANT PRINCIPAL =====
export default function QualiteEditables() {
  const [expandedCats, setExpandedCats] = useState(['gouvernance'])
  const [activeTab, setActiveTab] = useState('documents')
  const [generating, setGenerating] = useState(false)
  const [registreData, setRegistreData] = useState({})
  const [loadingData, setLoadingData] = useState(false)
  const [rddData, setRddData] = useState(null)
  
  const toggleCat = (id) => setExpandedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  const getColor = (c) => ({ blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500', teal: 'bg-teal-500', gray: 'bg-gray-500' }[c] || 'bg-gray-500')
  
  // Charger registre
  const loadRegistre = async (table) => {
    setLoadingData(true)
    const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false })
    setRegistreData(prev => ({ ...prev, [table]: data || [] }))
    setLoadingData(false)
  }
  
  // Charger RDD (année glissante août)
  const loadRDD = async () => {
    setLoadingData(true)
    const now = new Date()
    const startDate = now.getMonth() >= 7 ? new Date(now.getFullYear(), 7, 1) : new Date(now.getFullYear() - 1, 7, 1)
    const startStr = format(startDate, 'yyyy-MM-dd')
    
    try {
      const [sessionsRes, evalRes, reclRes, ncRes] = await Promise.all([
        supabase.from('sessions').select('id, status, trainees_count').gte('start_date', startStr),
        supabase.from('session_trainees').select('hot_eval_score, hot_eval_recommendation').not('hot_eval_score', 'is', null),
        supabase.from('reclamations').select('id, status').gte('created_at', startStr),
        supabase.from('non_conformites').select('id, status').gte('created_at', startStr),
      ])
      
      const sessions = sessionsRes.data || []
      const evals = evalRes.data || []
      const recl = reclRes.data || []
      const ncs = ncRes.data || []
      
      const scores = evals.map(e => e.hot_eval_score).filter(Boolean)
      const avgScore = scores.length > 0 ? (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1) : '-'
      const recos = evals.filter(e => e.hot_eval_recommendation !== null)
      const tauxReco = recos.length > 0 ? Math.round((recos.filter(e => e.hot_eval_recommendation).length / recos.length) * 100) : '-'
      
      setRddData({
        periode: { start: startDate, end: now },
        sessions: { total: sessions.length, terminees: sessions.filter(s => s.status === 'completed').length },
        stagiaires: sessions.reduce((acc, s) => acc + (s.trainees_count || 0), 0),
        satisfaction: { score: avgScore, tauxReco },
        reclamations: { total: recl.length, cloturees: recl.filter(r => r.status === 'resolved').length },
        nc: { total: ncs.length, cloturees: ncs.filter(n => n.status === 'closed').length },
      })
    } catch (e) { console.error(e); toast.error('Erreur chargement RDD') }
    setLoadingData(false)
  }
  
  useEffect(() => { if (activeTab === 'rdd') loadRDD() }, [activeTab])
  
  // ===== GÉNÉRATION PDF =====
  const generatePDF = async (docId, docInfo) => {
    setGenerating(true)
    try {
      const doc = new jsPDF()
      const w = doc.internal.pageSize.getWidth()
      const h = doc.internal.pageSize.getHeight()
      const v = '2.5.23'
      const d = format(new Date(), 'dd/MM/yyyy')
      
      const header = () => { doc.setFontSize(9); doc.setTextColor(100); doc.text(`${ORG.nom} ${ORG.forme} - ${ORG.siret}`, 20, 15); doc.text(`${ORG.adresse}, ${ORG.cp} ${ORG.ville}`, 20, 20) }
      const footer = (p = 1) => { doc.setFontSize(8); doc.setTextColor(128); doc.text(`${docInfo.code}-V${v}`, 20, h - 10); doc.text(d, w/2, h - 10, { align: 'center' }); doc.text(`Page ${p}`, w - 20, h - 10, { align: 'right' }) }
      const title = (t, y = 35) => { doc.setFontSize(14); doc.setTextColor(0); doc.setFont(undefined, 'bold'); doc.text(t.toUpperCase(), w/2, y, { align: 'center' }); doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(100); doc.text(`${docInfo.code}-V${v}`, w/2, y + 6, { align: 'center' }); return y + 15 }
      
      header()
      let y = title(docInfo.name)
      
      if (docId === 'organigramme') {
        // Gouvernance
        doc.setFillColor(37, 99, 235); doc.rect(20, y, w - 40, 10, 'F')
        doc.setTextColor(255); doc.setFontSize(10); doc.setFont(undefined, 'bold')
        doc.text('GOUVERNANCE (co-direction 50/50)', w/2, y + 7, { align: 'center' })
        y += 15
        
        const colW = (w - 50) / 2
        doc.setTextColor(0); doc.setFillColor(245, 245, 245)
        
        // Hicham
        doc.rect(20, y, colW, 45, 'F')
        doc.setFont(undefined, 'bold'); doc.setFontSize(10)
        doc.text(RESP.hicham.nom, 20 + colW/2, y + 8, { align: 'center' })
        doc.setFont(undefined, 'normal'); doc.setFontSize(8)
        let yr = y + 14
        RESP.hicham.roles.forEach(r => { doc.text(`• ${r}`, 24, yr); yr += 4.5 })
        
        // Maxime
        doc.rect(30 + colW, y, colW, 45, 'F')
        doc.setFont(undefined, 'bold'); doc.setFontSize(10)
        doc.text(RESP.maxime.nom, 30 + colW + colW/2, y + 8, { align: 'center' })
        doc.setFont(undefined, 'normal'); doc.setFontSize(8)
        yr = y + 14
        RESP.maxime.roles.forEach(r => { doc.text(`• ${r}`, 34 + colW, yr); yr += 4.5 })
        y += 55
        
        // Équipe pédagogique
        doc.setFillColor(34, 197, 94); doc.rect(20, y, w - 40, 10, 'F')
        doc.setTextColor(255); doc.setFontSize(10); doc.setFont(undefined, 'bold')
        doc.text('ÉQUIPE PÉDAGOGIQUE', w/2, y + 7, { align: 'center' })
        y += 15; doc.setTextColor(0); doc.setFontSize(9); doc.setFont(undefined, 'normal')
        doc.text(`${RESP.hicham.nom} : ${RESP.hicham.formations.join(', ')}`, 25, y); y += 6
        doc.text(`${RESP.maxime.nom} : ${RESP.maxime.formations.join(', ')}`, 25, y); y += 12
        doc.setFontSize(8); doc.setTextColor(100)
        doc.text('Outils : Sellsy (CRM) • Access Campus (formations) | Périmètre : Bretagne & Pays de la Loire', 25, y)
        
      } else if (docId.startsWith('des-')) {
        const info = DESIGNATIONS[docId]
        const pers = RESP[info.personne]
        const dateStr = format(new Date(), 'd MMMM yyyy', { locale: fr })
        
        doc.setFontSize(11); doc.setTextColor(0)
        doc.text('Je soussigné, Access Formation SARL, représenté par ses co-gérants,', 20, y); y += 12
        doc.text('Désigne par la présente :', 20, y); y += 10
        doc.setFont(undefined, 'bold'); doc.setFontSize(14)
        doc.text(pers.nom, 40, y); y += 10
        doc.setFont(undefined, 'normal'); doc.setFontSize(11)
        doc.text(`en qualité de ${info.role}.`, 20, y); y += 8
        doc.text(`Désignation effective au ${dateStr}.`, 20, y); y += 15
        
        doc.setFont(undefined, 'bold'); doc.text('Missions :', 20, y); y += 7
        doc.setFont(undefined, 'normal'); doc.setFontSize(10)
        info.missions.forEach(m => { doc.text(`• ${m}`, 25, y); y += 6 })
        
        y = 210
        doc.setFontSize(11)
        doc.text(`Fait à ${ORG.ville}, le ${dateStr}`, 20, y); y += 12
        doc.text('Les Co-gérants,', 20, y); y += 15
        doc.text('Hicham SAIDI', 35, y); doc.text('Maxime LANGLAIS', 115, y)
        
      } else if (docId.startsWith('proc-')) {
        const proc = PROCEDURES[docId]
        if (!proc) { doc.text('Procédure en cours de rédaction.', 20, y) }
        else {
          // Cartouche
          doc.setFillColor(245, 245, 245); doc.rect(20, y, w - 40, 20, 'F')
          doc.setFontSize(9); doc.setTextColor(0)
          doc.text(`Indicateur Qualiopi : ${docInfo.indicateur || '-'}`, 25, y + 6)
          doc.text(`Responsable : ${proc.responsable}`, 25, y + 12)
          doc.text(`Révision : Annuelle | ${d}`, 120, y + 6)
          y += 28
          
          // Objectif
          doc.setFont(undefined, 'bold'); doc.setFontSize(11); doc.text('1. OBJECTIF', 20, y); y += 7
          doc.setFont(undefined, 'normal'); doc.setFontSize(10)
          const objLines = doc.splitTextToSize(proc.objectif, w - 45)
          doc.text(objLines, 25, y); y += objLines.length * 5 + 8
          
          // Indicateurs
          doc.setFont(undefined, 'bold'); doc.setFontSize(11); doc.text('2. INDICATEURS', 20, y); y += 7
          doc.setFont(undefined, 'normal'); doc.setFontSize(10)
          proc.indicateurs.forEach(ind => { doc.text(`• ${ind}`, 25, y); y += 5 }); y += 8
          
          // Documents
          doc.setFont(undefined, 'bold'); doc.setFontSize(11); doc.text('3. DOCUMENTS', 20, y); y += 7
          doc.setFont(undefined, 'normal'); doc.setFontSize(10)
          proc.documents.forEach(docName => { doc.text(`• ${docName}`, 25, y); y += 5 }); y += 8
          
          // Sources si veille
          if (proc.sources) {
            doc.setFont(undefined, 'bold'); doc.setFontSize(11); doc.text('4. SOURCES DE VEILLE', 20, y); y += 7
            doc.setFont(undefined, 'normal'); doc.setFontSize(10)
            proc.sources.forEach(src => { doc.text(`• ${src}`, 25, y); y += 5 }); y += 8
          }
          
          // Page 2: Swimlane
          doc.addPage(); header(); y = 35
          doc.setFont(undefined, 'bold'); doc.setFontSize(11)
          doc.text(`${proc.sources ? '5' : '4'}. LOGIGRAMME`, 20, y); y += 10
          
          const laneH = 28; const acteurW = 45
          doc.setFontSize(8)
          
          proc.swimlanes.forEach((lane, idx) => {
            if (y + laneH > h - 25) { footer(doc.internal.getNumberOfPages()); doc.addPage(); header(); y = 35 }
            
            // Fond
            doc.setFillColor(idx % 2 === 0 ? 250 : 242, idx % 2 === 0 ? 250 : 242, idx % 2 === 0 ? 252 : 247)
            doc.rect(20, y, w - 40, laneH, 'F')
            doc.setDrawColor(220); doc.rect(20, y, w - 40, laneH)
            
            // Acteur
            doc.setFillColor(59, 130, 246); doc.rect(20, y, acteurW, laneH, 'F')
            doc.setTextColor(255); doc.setFont(undefined, 'bold')
            const actLines = doc.splitTextToSize(lane.acteur, acteurW - 6)
            doc.text(actLines, 23, y + laneH/2 - (actLines.length - 1) * 2)
            
            // Étapes
            doc.setTextColor(0); doc.setFont(undefined, 'normal')
            const etapeW = Math.min(50, (w - 40 - acteurW - 20) / Math.max(lane.etapes.length, 1))
            lane.etapes.forEach((et, i) => {
              const bx = 20 + acteurW + 8 + i * (etapeW + 4)
              const by = y + 4; const bh = laneH - 8
              
              // Couleur
              if (et.type === 'start') doc.setFillColor(34, 197, 94)
              else if (et.type === 'end') doc.setFillColor(239, 68, 68)
              else if (et.type === 'decision') doc.setFillColor(251, 191, 36)
              else doc.setFillColor(59, 130, 246)
              
              doc.roundedRect(bx, by, etapeW, bh, 2, 2, 'F')
              doc.setTextColor(et.type === 'decision' ? 0 : 255); doc.setFontSize(7)
              const etLines = doc.splitTextToSize(et.label, etapeW - 4)
              doc.text(etLines, bx + 2, by + 5)
              
              if (et.delai) { doc.setFontSize(6); doc.setTextColor(et.type === 'decision' ? 80 : 220); doc.text(et.delai, bx + 2, by + bh - 2) }
              
              // Flèche
              if (i < lane.etapes.length - 1) {
                doc.setDrawColor(150); doc.setLineWidth(0.3)
                doc.line(bx + etapeW, by + bh/2, bx + etapeW + 3, by + bh/2)
              }
            })
            y += laneH + 2
          })
          
          y += 5; doc.setFontSize(8); doc.setTextColor(100)
          doc.text('Légende : Vert=Début | Bleu=Action | Jaune=Décision | Rouge=Fin', 25, y)
          footer(doc.internal.getNumberOfPages())
        }
        
      } else if (docId === 'rdd' && rddData) {
        const periodeStr = `${format(rddData.periode.start, 'MMMM yyyy', { locale: fr })} - ${format(rddData.periode.end, 'MMMM yyyy', { locale: fr })}`
        doc.setFillColor(245, 245, 245); doc.rect(20, y, w - 40, 12, 'F')
        doc.setFontSize(10); doc.setTextColor(0)
        doc.text(`Période : ${periodeStr}`, 25, y + 5)
        doc.text(`Participants : Direction`, 25, y + 10)
        y += 20
        
        const section = (titre, items, color) => {
          doc.setFillColor(...color); doc.rect(20, y, w - 40, 8, 'F')
          doc.setTextColor(255); doc.setFont(undefined, 'bold'); doc.setFontSize(10)
          doc.text(titre, 25, y + 6); y += 12
          doc.setTextColor(0); doc.setFont(undefined, 'normal'); doc.setFontSize(10)
          items.forEach(item => { doc.text(`• ${item}`, 25, y); y += 6 }); y += 5
        }
        
        section('1. FORMATIONS', [`Sessions : ${rddData.sessions.terminees}/${rddData.sessions.total}`, `Stagiaires : ${rddData.stagiaires}`], [59, 130, 246])
        section('2. SATISFACTION', [`Score moyen : ${rddData.satisfaction.score}/5`, `Recommandation : ${rddData.satisfaction.tauxReco}%`], [34, 197, 94])
        section('3. RÉCLAMATIONS', [`Total : ${rddData.reclamations.total}`, `Clôturées : ${rddData.reclamations.cloturees}`], [239, 68, 68])
        section('4. NON-CONFORMITÉS', [`Total : ${rddData.nc.total}`, `Clôturées : ${rddData.nc.cloturees}`], [251, 191, 36])
        
        doc.setFont(undefined, 'bold'); doc.setFontSize(10)
        doc.text('5. OBJECTIFS ATTEINTS', 20, y); y += 8
        doc.setFont(undefined, 'normal'); doc.text('________________________________________________', 25, y); y += 15
        doc.setFont(undefined, 'bold'); doc.text('6. DÉCISIONS / ACTIONS', 20, y); y += 8
        doc.setFont(undefined, 'normal'); doc.text('________________________________________________', 25, y); y += 15
        doc.setFont(undefined, 'bold'); doc.text('7. OBJECTIFS N+1', 20, y); y += 8
        doc.setFont(undefined, 'normal'); doc.text('________________________________________________', 25, y)
        
      } else if (docId.startsWith('reg-') && docInfo.table) {
        const { data } = await supabase.from(docInfo.table).select('*').order('created_at', { ascending: false }).limit(30)
        doc.setFontSize(9); doc.text(`Export ${d} - ${data?.length || 0} enregistrement(s)`, 20, y); y += 8
        
        if (data?.length > 0) {
          doc.setFillColor(240, 240, 240); doc.rect(20, y, w - 40, 7, 'F')
          doc.setFont(undefined, 'bold'); doc.setFontSize(8)
          doc.text('Date', 22, y + 5); doc.text('Description', 50, y + 5); doc.text('Statut', 150, y + 5)
          y += 9; doc.setFont(undefined, 'normal')
          
          data.forEach(item => {
            if (y > h - 25) { footer(doc.internal.getNumberOfPages()); doc.addPage(); header(); y = 35 }
            doc.text(format(new Date(item.created_at), 'dd/MM/yy'), 22, y)
            const desc = (item.subject || item.description || item.titre || item.name || '-').substring(0, 60)
            doc.text(desc, 50, y)
            doc.text(item.status || '-', 150, y)
            y += 5
          })
        } else { doc.text('Aucun enregistrement.', 20, y) }
        
      } else {
        doc.setFontSize(10); doc.text('Document en cours de rédaction.', 20, y)
      }
      
      footer()
      doc.save(`${docInfo.code}-V${v}.pdf`)
      toast.success('PDF généré !')
    } catch (e) { console.error(e); toast.error('Erreur PDF') }
    setGenerating(false)
  }
  
  // ===== RENDU =====
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents Qualité</h1>
        <p className="text-gray-500">Pack Qualiopi V2.5.23 - Audit fin janvier</p>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[{ id: 'documents', icon: FileText, label: 'Documents' }, { id: 'registres', icon: Table, label: 'Registres' }, { id: 'rdd', icon: BarChart3, label: 'Revue Direction' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>
      
      {/* Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-3">
          {Object.entries(QUALITY_DOCS).map(([catId, cat]) => {
            const Icon = cat.icon; const isExp = expandedCats.includes(catId)
            return (
              <div key={catId} className="card p-0 overflow-hidden">
                <button onClick={() => toggleCat(catId)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getColor(cat.color)} text-white`}><Icon className="w-5 h-5" /></div>
                    <div className="text-left"><h3 className="font-semibold">{cat.name}</h3><p className="text-sm text-gray-500">{cat.docs.length} docs</p></div>
                  </div>
                  {isExp ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                </button>
                {isExp && (
                  <div className="border-t divide-y">
                    {cat.docs.map(docItem => (
                      <div key={docItem.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gray-400" />
                          <div>
                            <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded mr-2">{docItem.code}</span>
                            <span>{docItem.name}</span>
                            {docItem.indicateur && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Q{docItem.indicateur}</span>}
                            {docItem.table && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Temps réel</span>}
                          </div>
                        </div>
                        <button onClick={() => generatePDF(docItem.id, docItem)} disabled={generating} className="btn btn-sm btn-primary flex items-center gap-1">
                          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      
      {/* Registres */}
      {activeTab === 'registres' && (
        <div className="space-y-4">
          <p className="text-sm text-blue-700 bg-blue-50 p-3 rounded-lg">Registres liés aux données de l'app. Cliquez "Charger" pour voir les données en temps réel.</p>
          {QUALITY_DOCS.registres.docs.map(reg => (
            <div key={reg.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div><h3 className="font-semibold">{reg.name}</h3><p className="text-sm text-gray-500">{reg.code}</p></div>
                <div className="flex gap-2">
                  <button onClick={() => loadRegistre(reg.table)} disabled={loadingData} className="btn btn-sm btn-secondary flex items-center gap-1">
                    {loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Charger
                  </button>
                  <button onClick={() => generatePDF(reg.id, reg)} className="btn btn-sm btn-primary flex items-center gap-1"><Download className="w-4 h-4" /> PDF</button>
                </div>
              </div>
              {registreData[reg.table] && (
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Description</th><th className="px-3 py-2">Statut</th></tr></thead>
                    <tbody className="divide-y">
                      {registreData[reg.table].slice(0, 5).map((item, i) => (
                        <tr key={i}><td className="px-3 py-2">{format(new Date(item.created_at), 'dd/MM/yy')}</td><td className="px-3 py-2">{(item.subject || item.description || item.name || '-').substring(0, 50)}</td><td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded text-xs ${item.status === 'resolved' || item.status === 'closed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{item.status || '-'}</span></td></tr>
                      ))}
                    </tbody>
                  </table>
                  {registreData[reg.table].length > 5 && <p className="text-center text-sm text-gray-500 py-2 bg-gray-50">+ {registreData[reg.table].length - 5} autres</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* RDD */}
      {activeTab === 'rdd' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="font-semibold text-lg">Revue de Direction</h3><p className="text-sm text-gray-500">Année glissante depuis août {rddData ? format(rddData.periode.start, 'yyyy') : ''}</p></div>
              <div className="flex gap-2">
                <button onClick={loadRDD} disabled={loadingData} className="btn btn-sm btn-secondary flex items-center gap-1">{loadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Actualiser</button>
                <button onClick={() => generatePDF('rdd', { id: 'rdd', name: 'Revue de direction', code: 'AF-RDD' })} disabled={!rddData} className="btn btn-sm btn-primary flex items-center gap-1"><Download className="w-4 h-4" /> PDF</button>
              </div>
            </div>
            {rddData ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg"><p className="text-2xl font-bold text-blue-700">{rddData.sessions.terminees}</p><p className="text-sm text-blue-600">Sessions terminées</p></div>
                <div className="p-4 bg-green-50 rounded-lg"><p className="text-2xl font-bold text-green-700">{rddData.stagiaires}</p><p className="text-sm text-green-600">Stagiaires formés</p></div>
                <div className="p-4 bg-purple-50 rounded-lg"><p className="text-2xl font-bold text-purple-700">{rddData.satisfaction.score}/5</p><p className="text-sm text-purple-600">Satisfaction</p></div>
                <div className="p-4 bg-orange-50 rounded-lg"><p className="text-2xl font-bold text-orange-700">{rddData.satisfaction.tauxReco}%</p><p className="text-sm text-orange-600">Recommandation</p></div>
                <div className="p-4 bg-red-50 rounded-lg"><p className="text-2xl font-bold text-red-700">{rddData.reclamations.total}</p><p className="text-sm text-red-600">Réclamations</p></div>
                <div className="p-4 bg-yellow-50 rounded-lg"><p className="text-2xl font-bold text-yellow-700">{rddData.nc.total}</p><p className="text-sm text-yellow-600">Non-conformités</p></div>
              </div>
            ) : (
              <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /><p className="text-gray-500 mt-2">Chargement...</p></div>
            )}
          </div>
        </div>
      )}
      
      <p className="text-center text-sm text-gray-500">Documents conformes Qualiopi</p>
    </div>
  )
}
