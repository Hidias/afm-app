import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  FileText, Download, ChevronDown, ChevronRight, Save, X, Edit,
  Building2, ClipboardList, Table, Users2, BarChart3,
  Loader2, RefreshCw, Plus, Trash2
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

// ===== CONFIG ENTREPRISE (FIXE) =====
const ORG = {
  nom: 'Access Formation', forme: 'SARL', siret: '943 563 866 00012',
  nda: '53 29 10261 29', adresse: '24 rue Kerbleiz', cp: '29900', ville: 'Concarneau',
  tel: '02 46 56 57 54', email: 'contact@accessformation.pro',
}

const RESP = {
  hicham: { nom: 'Hicham SAIDI', roles: ['Responsable Qualité', 'Veille légale', 'Réclamations', 'RGPD', 'Commercial', 'Planification'] },
  maxime: { nom: 'Maxime LANGLAIS', roles: ['Ingénierie pédagogique', 'Veille métiers', 'Amélioration continue', 'Déontologie', 'Handicap'] },
}

// ===== STRUCTURE DOCUMENTS =====
const QUALITY_DOCS = {
  gouvernance: { name: 'Gouvernance', icon: Building2, color: 'blue', docs: [
    { id: 'organigramme', name: 'Organigramme', code: 'ORG-AF-001', editable: true },
    { id: 'des-qual', name: 'Désignation Responsable Qualité', code: 'AF-DESQUAL', editable: true },
    { id: 'des-hand', name: 'Désignation Référent Handicap', code: 'AF-DESHAND', editable: true },
    { id: 'des-deon', name: 'Désignation Référent Déontologie', code: 'AF-DESDEON', editable: true },
    { id: 'des-recl', name: 'Désignation Référent Réclamations', code: 'AF-DESRECL', editable: true },
    { id: 'des-veil', name: 'Désignation Référent Veille', code: 'AF-DESVEIL', editable: true },
    { id: 'des-amel', name: 'Désignation Référent Amélioration', code: 'AF-DESAMEL', editable: true },
    { id: 'des-rgpd', name: 'Désignation DPO/RGPD', code: 'AF-DESRGPD', editable: true },
  ]},
  procedures: { name: 'Procédures', icon: ClipboardList, color: 'green', docs: [
    { id: 'proc-recl', name: 'Traitement des réclamations', code: 'AF-RECL', indicateur: '31', editable: true },
    { id: 'proc-nc', name: 'Non-conformités', code: 'AF-NC', indicateur: '32', editable: true },
    { id: 'proc-sat', name: 'Évaluation satisfaction', code: 'AF-SAT', indicateur: '30-31', editable: true },
    { id: 'proc-veille', name: 'Veille réglementaire', code: 'AF-VEILLE', indicateur: '23-25', editable: true },
  ]},
  registres: { name: 'Registres', icon: Table, color: 'purple', docs: [
    { id: 'reg-recl', name: 'Registre réclamations', code: 'AF-REGREC', table: 'reclamations' },
    { id: 'reg-nc', name: 'Registre non-conformités', code: 'AF-REGNC', table: 'non_conformites' },
    { id: 'reg-veille', name: 'Registre veille', code: 'AF-REGVEI', table: 'veille_reglementaire', editable: true },
    { id: 'reg-mat', name: 'Registre matériel', code: 'AF-REGMAT', table: 'equipment_catalog' },
  ]},
  pilotage: { name: 'Pilotage', icon: BarChart3, color: 'teal', docs: [
    { id: 'rdd', name: 'Revue de direction', code: 'AF-RDD', computed: true },
  ]},
}

// ===== DONNÉES PAR DÉFAUT DES DOCUMENTS =====
const DEFAULT_DATA = {
  'des-qual': { personne: 'Hicham SAIDI', role: 'Responsable Qualité', date: format(new Date(), 'yyyy-MM-dd'), missions: ['Piloter le système qualité', 'Suivre les indicateurs', 'Préparer les audits', 'Proposer les améliorations', 'Garantir la conformité Qualiopi'] },
  'des-hand': { personne: 'Maxime LANGLAIS', role: 'Référent Handicap', date: format(new Date(), 'yyyy-MM-dd'), missions: ['Accueillir les PSH', 'Identifier les besoins d\'adaptation', 'Lien avec Agefiph/MDPH', 'Sensibiliser l\'équipe', 'Suivre les aménagements'] },
  'des-deon': { personne: 'Maxime LANGLAIS', role: 'Référent Déontologie', date: format(new Date(), 'yyyy-MM-dd'), missions: ['Veiller au respect des règles éthiques', 'Traiter les signalements', 'Conseiller la direction', 'Sensibiliser l\'équipe'] },
  'des-recl': { personne: 'Hicham SAIDI', role: 'Référent Réclamations', date: format(new Date(), 'yyyy-MM-dd'), missions: ['Réceptionner les réclamations', 'Analyser les causes', 'Clôturer sous 5 jours ouvrés', 'Communiquer les résultats', 'Proposer des actions préventives'] },
  'des-veil': { personne: 'Hicham SAIDI', role: 'Référent Veille', date: format(new Date(), 'yyyy-MM-dd'), missions: ['Veille réglementaire mensuelle', 'Suivre les référentiels INRS/CACES', 'Informer l\'équipe sous 30 jours', 'Mettre à jour les documents'] },
  'des-amel': { personne: 'Maxime LANGLAIS', role: 'Référent Amélioration Continue', date: format(new Date(), 'yyyy-MM-dd'), missions: ['Analyser les NC', 'Suivre les actions correctives', 'Animer l\'amélioration continue', 'Mesurer l\'efficacité', 'Préparer la RDD'] },
  'des-rgpd': { personne: 'Hicham SAIDI', role: 'DPO', date: format(new Date(), 'yyyy-MM-dd'), missions: ['Conformité RGPD', 'Registre des traitements', 'Répondre aux demandes de droits', 'Sensibiliser le personnel', 'Gérer les violations'] },
  'proc-recl': { 
    objectif: 'Définir les modalités de traitement des réclamations pour garantir la satisfaction des parties prenantes.',
    responsable: 'Hicham SAIDI',
    delaiAccuse: '48h',
    delaiCloture: '5 jours ouvrés',
    indicateurs: ['Nombre de réclamations', 'Délai moyen de traitement', 'Taux de clôture'],
    etapes: ['Réception', 'Enregistrement', 'Accusé réception (48h)', 'Analyse causes', 'Proposition solution', 'Validation direction', 'Mise en œuvre', 'Vérification efficacité', 'Clôture (5j max)']
  },
  'proc-nc': {
    objectif: 'Définir les modalités de traitement des non-conformités pour l\'amélioration continue.',
    responsable: 'Maxime LANGLAIS',
    delaiTraitement: '5 jours ouvrés',
    indicateurs: ['Nombre de NC', 'Délai de traitement', 'Taux NC récurrentes'],
    etapes: ['Détection', 'Enregistrement', 'Analyse 5P', 'Action corrective', 'Validation', 'Mise en œuvre', 'Vérification efficacité', 'Clôture']
  },
  'proc-sat': {
    objectif: 'Définir les modalités de recueil et d\'analyse de la satisfaction.',
    responsable: 'Hicham SAIDI',
    indicateurs: ['Score satisfaction (cible: >4/5)', 'Taux de réponse', 'Taux recommandation'],
    etapes: ['Fin formation', 'Distribution éval. à chaud', 'Collecte réponses', 'Envoi J+90 automatique', 'Analyse mensuelle', 'Actions si score <4', 'Publication indicateurs']
  },
  'proc-veille': {
    objectif: 'Définir les modalités de veille légale, réglementaire et pédagogique.',
    responsable: 'Hicham SAIDI',
    frequence: 'Mensuelle',
    delaiMiseAJour: '30 jours',
    sources: ['Code du travail', 'INRS (SST, R485, R489)', 'NF C18-510', 'Légifrance', 'Centre Inffo'],
    etapes: ['Consultation sources', 'Identification évolutions', 'Analyse impact', 'Validation actions', 'Mise à jour documents', 'Archivage']
  },
}

// ===== COMPOSANT PRINCIPAL =====
export default function QualiteEditables() {
  const [expandedCats, setExpandedCats] = useState(['gouvernance'])
  const [activeTab, setActiveTab] = useState('documents')
  const [generating, setGenerating] = useState(false)
  const [editingDoc, setEditingDoc] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedDocs, setSavedDocs] = useState({})
  const [registreData, setRegistreData] = useState({})
  const [loadingData, setLoadingData] = useState(false)
  const [rddData, setRddData] = useState(null)
  
  // Charger les documents sauvegardés
  useEffect(() => {
    loadSavedDocs()
  }, [])
  
  const loadSavedDocs = async () => {
    const { data } = await supabase.from('quality_documents').select('*')
    if (data) {
      const docs = {}
      data.forEach(d => { docs[d.doc_id] = d.content })
      setSavedDocs(docs)
    }
  }
  
  const toggleCat = (id) => setExpandedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  const getColor = (c) => ({ blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500', teal: 'bg-teal-500', gray: 'bg-gray-500' }[c] || 'bg-gray-500')
  
  // Ouvrir l'éditeur
  const openEditor = (docId) => {
    const saved = savedDocs[docId]
    const defaults = DEFAULT_DATA[docId] || {}
    setEditData(saved || defaults)
    setEditingDoc(docId)
  }
  
  // Sauvegarder le document
  const saveDocument = async () => {
    setSaving(true)
    try {
      const docInfo = findDocInfo(editingDoc)
      const { error } = await supabase.from('quality_documents').upsert({
        doc_id: editingDoc,
        code: docInfo?.code || editingDoc,
        name: docInfo?.name || editingDoc,
        content: editData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'doc_id' })
      
      if (error) throw error
      
      setSavedDocs(prev => ({ ...prev, [editingDoc]: editData }))
      toast.success('Document sauvegardé !')
      setEditingDoc(null)
    } catch (e) {
      console.error(e)
      toast.error('Erreur de sauvegarde')
    }
    setSaving(false)
  }
  
  const findDocInfo = (docId) => {
    for (const cat of Object.values(QUALITY_DOCS)) {
      const doc = cat.docs.find(d => d.id === docId)
      if (doc) return doc
    }
    return null
  }
  
  // Charger registre
  const loadRegistre = async (table) => {
    setLoadingData(true)
    try {
      const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false })
      if (error) {
        console.error(error)
        toast.error(`Erreur: ${error.message}`)
      } else {
        setRegistreData(prev => ({ ...prev, [table]: data || [] }))
      }
    } catch (e) {
      console.error(e)
    }
    setLoadingData(false)
  }
  
  // Charger RDD
  const loadRDD = async () => {
    setLoadingData(true)
    const now = new Date()
    // Année glissante depuis août - ou toutes les données si avant août
    const startDate = now.getMonth() >= 7 ? new Date(now.getFullYear(), 7, 1) : new Date(now.getFullYear() - 1, 7, 1)
    const startStr = format(startDate, 'yyyy-MM-dd')
    
    try {
      // Sessions avec leurs stagiaires (relation)
      const { data: sessions, error: sessErr } = await supabase
        .from('sessions')
        .select('id, status, start_date, session_trainees(id)')
      
      if (sessErr) console.error('Sessions error:', sessErr)
      
      // Évaluations à chaud
      const { data: evals, error: evalErr } = await supabase
        .from('session_trainees')
        .select('hot_eval_score, hot_eval_recommendation')
        .not('hot_eval_score', 'is', null)
      
      if (evalErr) console.error('Evals error:', evalErr)
      
      // Réclamations (toutes)
      const { data: recl, error: reclErr } = await supabase
        .from('reclamations')
        .select('id, status')
      
      if (reclErr) console.error('Reclamations error:', reclErr)
      
      // Non-conformités (toutes)
      const { data: ncs, error: ncErr } = await supabase
        .from('non_conformites')
        .select('id, status')
      
      if (ncErr) console.error('NC error:', ncErr)
      
      const allSessions = sessions || []
      const allEvals = evals || []
      const allRecl = recl || []
      const allNcs = ncs || []
      
      // Filtrer les sessions de la période (ou toutes si pas de filtre strict)
      const filteredSessions = allSessions.filter(s => {
        if (!s.start_date) return true // Inclure si pas de date
        return new Date(s.start_date) >= startDate
      })
      
      // Compter les stagiaires via la relation
      const totalStagiaires = filteredSessions.reduce((acc, s) => acc + (s.session_trainees?.length || 0), 0)
      
      const scores = allEvals.map(e => e.hot_eval_score).filter(Boolean)
      const avgScore = scores.length > 0 ? (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1) : 'N/A'
      const recos = allEvals.filter(e => e.hot_eval_recommendation !== null)
      const tauxReco = recos.length > 0 ? Math.round((recos.filter(e => e.hot_eval_recommendation).length / recos.length) * 100) : 'N/A'
      
      setRddData({
        periode: { start: startDate, end: now },
        sessions: { 
          total: filteredSessions.length, 
          terminees: filteredSessions.filter(s => s.status === 'completed').length 
        },
        stagiaires: totalStagiaires,
        satisfaction: { score: avgScore, tauxReco },
        reclamations: { total: allRecl.length, cloturees: allRecl.filter(r => r.status === 'resolved').length },
        nc: { total: allNcs.length, cloturees: allNcs.filter(n => n.status === 'closed').length },
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
      const data = savedDocs[docId] || DEFAULT_DATA[docId] || {}
      
      const header = () => { doc.setFontSize(9); doc.setTextColor(100); doc.text(`${ORG.nom} ${ORG.forme} - ${ORG.siret}`, 20, 15); doc.text(`${ORG.adresse}, ${ORG.cp} ${ORG.ville}`, 20, 20) }
      const footer = () => { doc.setFontSize(8); doc.setTextColor(128); doc.text(`${docInfo.code}-V${v}`, 20, h - 10); doc.text(d, w/2, h - 10, { align: 'center' }) }
      const title = (t, y = 35) => { doc.setFontSize(14); doc.setTextColor(0); doc.setFont(undefined, 'bold'); doc.text(t.toUpperCase(), w/2, y, { align: 'center' }); doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(100); doc.text(`${docInfo.code}-V${v}`, w/2, y + 6, { align: 'center' }); return y + 15 }
      
      header()
      let y = title(docInfo.name)
      
      if (docId.startsWith('des-')) {
        // Lettre de désignation
        const dateStr = data.date ? format(new Date(data.date), 'd MMMM yyyy', { locale: fr }) : format(new Date(), 'd MMMM yyyy', { locale: fr })
        doc.setFontSize(11); doc.setTextColor(0)
        doc.text('Je soussigné, Access Formation SARL, représenté par ses co-gérants,', 20, y); y += 12
        doc.text('Désigne par la présente :', 20, y); y += 10
        doc.setFont(undefined, 'bold'); doc.setFontSize(14)
        doc.text(data.personne || 'Non défini', 40, y); y += 10
        doc.setFont(undefined, 'normal'); doc.setFontSize(11)
        doc.text(`en qualité de ${data.role || 'Non défini'}.`, 20, y); y += 8
        doc.text(`Désignation effective au ${dateStr}.`, 20, y); y += 15
        
        doc.setFont(undefined, 'bold'); doc.text('Missions :', 20, y); y += 7
        doc.setFont(undefined, 'normal'); doc.setFontSize(10)
        ;(data.missions || []).forEach(m => { doc.text(`• ${m}`, 25, y); y += 6 })
        
        y = 210
        doc.setFontSize(11)
        doc.text(`Fait à ${ORG.ville}, le ${dateStr}`, 20, y); y += 12
        doc.text('Les Co-gérants,', 20, y); y += 15
        doc.text('Hicham SAIDI', 35, y); doc.text('Maxime LANGLAIS', 115, y)
        
      } else if (docId.startsWith('proc-')) {
        // Procédure
        doc.setFillColor(245, 245, 245); doc.rect(20, y, w - 40, 20, 'F')
        doc.setFontSize(9); doc.setTextColor(0)
        doc.text(`Indicateur Qualiopi : ${docInfo.indicateur || '-'}`, 25, y + 6)
        doc.text(`Responsable : ${data.responsable || '-'}`, 25, y + 12)
        doc.text(`Révision : Annuelle | ${d}`, 120, y + 6)
        y += 28
        
        doc.setFont(undefined, 'bold'); doc.setFontSize(11); doc.text('1. OBJECTIF', 20, y); y += 7
        doc.setFont(undefined, 'normal'); doc.setFontSize(10)
        const objLines = doc.splitTextToSize(data.objectif || '', w - 45)
        doc.text(objLines, 25, y); y += objLines.length * 5 + 8
        
        if (data.delaiAccuse || data.delaiCloture || data.delaiTraitement) {
          doc.setFont(undefined, 'bold'); doc.setFontSize(11); doc.text('2. DÉLAIS', 20, y); y += 7
          doc.setFont(undefined, 'normal'); doc.setFontSize(10)
          if (data.delaiAccuse) { doc.text(`• Accusé réception : ${data.delaiAccuse}`, 25, y); y += 5 }
          if (data.delaiCloture) { doc.text(`• Clôture : ${data.delaiCloture}`, 25, y); y += 5 }
          if (data.delaiTraitement) { doc.text(`• Traitement : ${data.delaiTraitement}`, 25, y); y += 5 }
          if (data.delaiMiseAJour) { doc.text(`• Mise à jour : ${data.delaiMiseAJour}`, 25, y); y += 5 }
          y += 5
        }
        
        if (data.indicateurs?.length) {
          doc.setFont(undefined, 'bold'); doc.setFontSize(11); doc.text('3. INDICATEURS', 20, y); y += 7
          doc.setFont(undefined, 'normal'); doc.setFontSize(10)
          data.indicateurs.forEach(ind => { doc.text(`• ${ind}`, 25, y); y += 5 }); y += 5
        }
        
        if (data.sources?.length) {
          doc.setFont(undefined, 'bold'); doc.setFontSize(11); doc.text('4. SOURCES', 20, y); y += 7
          doc.setFont(undefined, 'normal'); doc.setFontSize(10)
          data.sources.forEach(src => { doc.text(`• ${src}`, 25, y); y += 5 }); y += 5
        }
        
        if (data.etapes?.length) {
          doc.setFont(undefined, 'bold'); doc.setFontSize(11); doc.text(`${data.sources ? '5' : '4'}. ÉTAPES DU PROCESSUS`, 20, y); y += 10
          doc.setFontSize(9)
          data.etapes.forEach((et, i) => {
            doc.setFillColor(59, 130, 246)
            doc.roundedRect(25, y, 120, 8, 2, 2, 'F')
            doc.setTextColor(255)
            doc.text(`${i + 1}. ${et}`, 30, y + 5.5)
            doc.setTextColor(0)
            if (i < data.etapes.length - 1) { doc.text('↓', 85, y + 12) }
            y += 12
          })
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
        
      } else if (docId.startsWith('reg-') && docInfo.table) {
        const tableData = registreData[docInfo.table] || []
        doc.setFontSize(9); doc.text(`Export ${d} - ${tableData.length} enregistrement(s)`, 20, y); y += 8
        
        if (tableData.length > 0) {
          doc.setFillColor(240, 240, 240); doc.rect(20, y, w - 40, 7, 'F')
          doc.setFont(undefined, 'bold'); doc.setFontSize(8)
          doc.text('Date', 22, y + 5); doc.text('Description', 50, y + 5); doc.text('Statut', 150, y + 5)
          y += 9; doc.setFont(undefined, 'normal')
          
          tableData.slice(0, 25).forEach(item => {
            doc.text(format(new Date(item.created_at), 'dd/MM/yy'), 22, y)
            const desc = (item.subject || item.description || item.titre || item.name || '-').substring(0, 55)
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
  
  // ===== MODAL ÉDITEUR =====
  const renderEditor = () => {
    if (!editingDoc) return null
    const docInfo = findDocInfo(editingDoc)
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b flex items-center justify-between bg-gray-50">
            <div>
              <h2 className="font-bold text-lg">{docInfo?.name}</h2>
              <p className="text-sm text-gray-500">{docInfo?.code}</p>
            </div>
            <button onClick={() => setEditingDoc(null)} className="p-2 hover:bg-gray-200 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto flex-1">
            {editingDoc.startsWith('des-') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Personne désignée</label>
                  <select 
                    value={editData.personne || ''} 
                    onChange={e => setEditData({...editData, personne: e.target.value})}
                    className="input w-full"
                  >
                    <option value="Hicham SAIDI">Hicham SAIDI</option>
                    <option value="Maxime LANGLAIS">Maxime LANGLAIS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fonction</label>
                  <input 
                    type="text" 
                    value={editData.role || ''} 
                    onChange={e => setEditData({...editData, role: e.target.value})}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date de désignation</label>
                  <input 
                    type="date" 
                    value={editData.date || ''} 
                    onChange={e => setEditData({...editData, date: e.target.value})}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Missions</label>
                  {(editData.missions || []).map((m, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input 
                        type="text" 
                        value={m} 
                        onChange={e => {
                          const newMissions = [...(editData.missions || [])]
                          newMissions[i] = e.target.value
                          setEditData({...editData, missions: newMissions})
                        }}
                        className="input flex-1"
                      />
                      <button onClick={() => {
                        const newMissions = (editData.missions || []).filter((_, idx) => idx !== i)
                        setEditData({...editData, missions: newMissions})
                      }} className="btn btn-sm btn-secondary"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setEditData({...editData, missions: [...(editData.missions || []), '']})} className="btn btn-sm btn-secondary">
                    <Plus className="w-4 h-4 mr-1" /> Ajouter mission
                  </button>
                </div>
              </div>
            )}
            
            {editingDoc.startsWith('proc-') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Objectif</label>
                  <textarea 
                    value={editData.objectif || ''} 
                    onChange={e => setEditData({...editData, objectif: e.target.value})}
                    className="input w-full h-24"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Responsable</label>
                  <select 
                    value={editData.responsable || ''} 
                    onChange={e => setEditData({...editData, responsable: e.target.value})}
                    className="input w-full"
                  >
                    <option value="Hicham SAIDI">Hicham SAIDI</option>
                    <option value="Maxime LANGLAIS">Maxime LANGLAIS</option>
                  </select>
                </div>
                {editingDoc === 'proc-recl' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Délai accusé réception</label>
                        <input type="text" value={editData.delaiAccuse || ''} onChange={e => setEditData({...editData, delaiAccuse: e.target.value})} className="input w-full" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Délai clôture</label>
                        <input type="text" value={editData.delaiCloture || ''} onChange={e => setEditData({...editData, delaiCloture: e.target.value})} className="input w-full" />
                      </div>
                    </div>
                  </>
                )}
                {editingDoc === 'proc-nc' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Délai traitement</label>
                    <input type="text" value={editData.delaiTraitement || ''} onChange={e => setEditData({...editData, delaiTraitement: e.target.value})} className="input w-full" />
                  </div>
                )}
                {editingDoc === 'proc-veille' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Fréquence</label>
                        <input type="text" value={editData.frequence || ''} onChange={e => setEditData({...editData, frequence: e.target.value})} className="input w-full" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Délai mise à jour</label>
                        <input type="text" value={editData.delaiMiseAJour || ''} onChange={e => setEditData({...editData, delaiMiseAJour: e.target.value})} className="input w-full" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Sources de veille</label>
                      {(editData.sources || []).map((s, i) => (
                        <div key={i} className="flex gap-2 mb-2">
                          <input type="text" value={s} onChange={e => {
                            const newSources = [...(editData.sources || [])]
                            newSources[i] = e.target.value
                            setEditData({...editData, sources: newSources})
                          }} className="input flex-1" />
                          <button onClick={() => setEditData({...editData, sources: (editData.sources || []).filter((_, idx) => idx !== i)})} className="btn btn-sm btn-secondary"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                      <button onClick={() => setEditData({...editData, sources: [...(editData.sources || []), '']})} className="btn btn-sm btn-secondary"><Plus className="w-4 h-4 mr-1" /> Ajouter source</button>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Indicateurs</label>
                  {(editData.indicateurs || []).map((ind, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input type="text" value={ind} onChange={e => {
                        const newInd = [...(editData.indicateurs || [])]
                        newInd[i] = e.target.value
                        setEditData({...editData, indicateurs: newInd})
                      }} className="input flex-1" />
                      <button onClick={() => setEditData({...editData, indicateurs: (editData.indicateurs || []).filter((_, idx) => idx !== i)})} className="btn btn-sm btn-secondary"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setEditData({...editData, indicateurs: [...(editData.indicateurs || []), '']})} className="btn btn-sm btn-secondary"><Plus className="w-4 h-4 mr-1" /> Ajouter indicateur</button>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Étapes du processus</label>
                  {(editData.etapes || []).map((et, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <span className="w-8 text-center text-gray-500">{i + 1}.</span>
                      <input type="text" value={et} onChange={e => {
                        const newEt = [...(editData.etapes || [])]
                        newEt[i] = e.target.value
                        setEditData({...editData, etapes: newEt})
                      }} className="input flex-1" />
                      <button onClick={() => setEditData({...editData, etapes: (editData.etapes || []).filter((_, idx) => idx !== i)})} className="btn btn-sm btn-secondary"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setEditData({...editData, etapes: [...(editData.etapes || []), '']})} className="btn btn-sm btn-secondary"><Plus className="w-4 h-4 mr-1" /> Ajouter étape</button>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
            <button onClick={() => setEditingDoc(null)} className="btn btn-secondary">Annuler</button>
            <button onClick={saveDocument} disabled={saving} className="btn btn-primary flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // ===== RENDU =====
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents Qualité</h1>
        <p className="text-gray-500">Pack Qualiopi V2.5.23 - Documents éditables</p>
      </div>
      
      <div className="flex gap-2 border-b">
        {[{ id: 'documents', icon: FileText, label: 'Documents' }, { id: 'registres', icon: Table, label: 'Registres' }, { id: 'rdd', icon: BarChart3, label: 'Revue Direction' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>
      
      {activeTab === 'documents' && (
        <div className="space-y-3">
          {Object.entries(QUALITY_DOCS).filter(([k]) => k !== 'registres' && k !== 'pilotage').map(([catId, cat]) => {
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
                            {savedDocs[docItem.id] && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Édité</span>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {docItem.editable && (
                            <button onClick={() => openEditor(docItem.id)} className="btn btn-sm btn-secondary flex items-center gap-1">
                              <Edit className="w-4 h-4" /> Éditer
                            </button>
                          )}
                          <button onClick={() => generatePDF(docItem.id, docItem)} disabled={generating} className="btn btn-sm btn-primary flex items-center gap-1">
                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      
      {activeTab === 'registres' && (
        <div className="space-y-4">
          <p className="text-sm text-blue-700 bg-blue-50 p-3 rounded-lg">Les registres sont liés aux données de l'application. Cliquez "Charger" pour voir les données.</p>
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
              {registreData[reg.table] !== undefined && (
                <div className="border rounded overflow-hidden">
                  {registreData[reg.table].length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50"><tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Description</th><th className="px-3 py-2">Statut</th></tr></thead>
                      <tbody className="divide-y">
                        {registreData[reg.table].slice(0, 5).map((item, i) => (
                          <tr key={i}><td className="px-3 py-2">{format(new Date(item.created_at), 'dd/MM/yy')}</td><td className="px-3 py-2">{(item.subject || item.description || item.name || '-').substring(0, 50)}</td><td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded text-xs ${item.status === 'resolved' || item.status === 'closed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{item.status || '-'}</span></td></tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-center text-gray-500 py-4">Aucun enregistrement dans ce registre</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
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
                <div className="p-4 bg-blue-50 rounded-lg"><p className="text-2xl font-bold text-blue-700">{rddData.sessions.terminees}/{rddData.sessions.total}</p><p className="text-sm text-blue-600">Sessions</p></div>
                <div className="p-4 bg-green-50 rounded-lg"><p className="text-2xl font-bold text-green-700">{rddData.stagiaires}</p><p className="text-sm text-green-600">Stagiaires</p></div>
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
      
      {renderEditor()}
    </div>
  )
}
