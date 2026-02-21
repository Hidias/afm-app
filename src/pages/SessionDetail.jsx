import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useDataStore, useAuthStore } from '../lib/store'
import { downloadDocument, downloadAllDocuments, generatePDF, generateAllPDF, setOrganization } from '../lib/pdfGenerator'
import { 
  ArrowLeft, Calendar, MapPin, Users, Clock, FileText, QrCode, UserPlus, UserMinus,
  Download, CheckCircle, AlertCircle, Copy, ExternalLink, X, Edit, Trash2, Save,
  FileSignature, Send, Upload, Eye, Star, ThumbsUp, ClipboardCheck, UserCheck, HelpCircle, Home, Target,
  Sun, Moon, Plus, ChevronDown, Search, LogOut, MessageSquare, CheckCircle2, FileCheck, Mail, Archive, Receipt
} from 'lucide-react'
import { format, eachDayOfInterval, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import SessionDocumentAccess from '../components/SessionDocumentAccess'
import SSTCertificationTab from '../components/SSTCertificationTab'
import DateTimePickerModal from '../components/DateTimePickerModal'
import SessionChecklist from '../components/SessionChecklist'
import SessionNeedsAnalysis from '../components/SessionNeedsAnalysis'
import SessionEmailModal from '../components/SessionEmailModal'
import StageEmailModal from '../components/StageEmailModal'
import { SignatureAuditBadge } from '../components/SignaturePad'
import { getNeedsAnalysisPDFBytes } from '../lib/needsAnalysisPDF'

const statusLabels = {
  draft: { label: 'Brouillon', class: 'badge-gray' },
  planned: { label: 'Planifiée', class: 'badge-blue' },
  in_progress: { label: 'En cours', class: 'badge-yellow' },
  completed: { label: 'Terminée', class: 'badge-green' },
  cancelled: { label: 'Annulée', class: 'badge-red' },
}

const docTypes = [
  { id: 'convention', name: 'Convention', icon: FileSignature, forAll: true, qualiopi: 5 },
  { id: 'programme', name: 'Programme', icon: FileText, forAll: true, qualiopi: 5 },
  { id: 'convocation', name: 'Convocation', icon: Send, forEach: true },
  { id: 'ficheRenseignements', name: 'Fiche renseignements', icon: FileText, forEach: true, qualiopi: 8 },
  { id: 'emargement', name: 'Émargement', icon: FileText, forAll: true, qualiopi: 11 },
  { id: 'attestation', name: 'Attestation', icon: FileText, forEach: true },
  { id: 'certificat', name: 'Certificat', icon: CheckCircle, forEach: true, qualiopi: 11 },
  { id: 'evaluation', name: 'Éval. à chaud', icon: ClipboardCheck, forEach: true, qualiopi: 30 },
  { id: 'evaluationFroid', name: 'Éval. à froid', icon: ClipboardCheck, forEach: true, qualiopi: 30 },
  { id: 'positionnement', name: 'Test positionnement', icon: FileText, forEach: true, qualiopi: 8 },
]

const uploadCategories = [
  { id: 'emargement', label: 'Émargement signé' },
  { id: 'evaluation', label: 'Évaluations remplies' },
  { id: 'certification_sst', label: 'Certification SST' },
  { id: 'autre', label: 'Autre document' },
]

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { 
    sessions, fetchSessions, updateSession, deleteSession, getSession,
    trainees, fetchTrainees, addTraineeToSession, removeTraineeFromSession,
    trainers, fetchTrainers, clients, fetchClients,
    attendances, fetchAttendances,
    fetchAttendance, upsertAttendance,
    fetchTraineeEvaluations, upsertTraineeEvaluation,
    fetchTrainerEvaluation, upsertTrainerEvaluation,
    fetchColdEvaluations, upsertColdEvaluation,
    fetchSessionDocuments, uploadSessionDocument, deleteSessionDocument, getSessionDocumentUrl,
    fetchCourseQuestions, addTrainerToSession, removeTrainerFromSession,
    organization, fetchOrganization,
    fetchTraineeObjectives, initializeTraineeObjectives, toggleTraineeObjective, updateTraineeResult, forceTraineeResult,
    updateRemediationProposal, updatePresenceComplete,
  } = useDataStore()
  
  const { user } = useAuthStore()
  
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showAddTrainee, setShowAddTrainee] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showSessionEmailModal, setShowSessionEmailModal] = useState(false)
  const [showStageEmailModal, setShowStageEmailModal] = useState(false)
  const [sessionEmailType, setSessionEmailType] = useState(null) // 'before' ou 'after'
  const [showInvoicePrompt, setShowInvoicePrompt] = useState(false)
  const [sessionHasInvoice, setSessionHasInvoice] = useState(null) // null = loading, true/false
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [traineeFilterClient, setTraineeFilterClient] = useState('')
  const [traineeSearch, setTraineeSearch] = useState('')
  const [editForm, setEditForm] = useState({})
  
  // Suivi
  const [presenceData, setPresenceData] = useState({})
  const [evaluationsData, setEvaluationsData] = useState({})
  const [coldEvaluationsData, setColdEvaluationsData] = useState({})
  const [trainerEval, setTrainerEval] = useState(null)
  const [sessionDocs, setSessionDocs] = useState([])
  const [uploadCategory, setUploadCategory] = useState('autre')
  const [uploading, setUploading] = useState(false)
  const [sendingHotEvalReminder, setSendingHotEvalReminder] = useState(false)
  
  // Fiches de renseignement
  const [infoSheets, setInfoSheets] = useState({}) // { traineeId: infoSheetData }
  const [showInfoSheet, setShowInfoSheet] = useState(false)
  const [selectedTraineeInfo, setSelectedTraineeInfo] = useState(null)
  
  // Test de positionnement
  const [showPositioningTest, setShowPositioningTest] = useState(false)
  const [selectedPositioningTest, setSelectedPositioningTest] = useState(null)
  const [loadingPositioningTest, setLoadingPositioningTest] = useState(false)
  
  // Suivi convention
  const [uploadingConvention, setUploadingConvention] = useState(false)
  
  // Modals date/heure pour tracking documents
  const [dateTimeModal, setDateTimeModal] = useState({
    isOpen: false,
    type: null, // 'convention_sent' ou 'convention_signed'
    currentDate: null
  })
  
  // Questions positionnement
  const [questions, setQuestions] = useState([])
  
  // Objectifs stagiaires
  const [objectivesData, setObjectivesData] = useState([])
  const [traineeResults, setTraineeResults] = useState({})
  
  // Présence demi-journées
  const [halfDayAttendance, setHalfDayAttendance] = useState({}) // { traineeId_date_period: boolean }
  
  // Coûts supplémentaires session
  const [sessionCosts, setSessionCosts] = useState([])
  const [showAddCost, setShowAddCost] = useState(false)
  const [costForm, setCostForm] = useState({
    cost_type: 'material',
    label: '',
    amount: '',
    per_trainee: false,
    notes: ''
  })
  
  // Financements multi-financeurs
  const [sessionFundings, setSessionFundings] = useState([])
  const [showAddFunding, setShowAddFunding] = useState(false)
  const [editingFunding, setEditingFunding] = useState(null)
  const [fundingForm, setFundingForm] = useState({
    funder_type: 'entreprise',
    funder_name: '',
    funder_client_id: '',
    funder_contact_name: '',
    funder_contact_email: '',
    funder_address: '',
    funder_siret: '',
    amount_ht: '',
    percentage: '',
    dossier_number: '',
    notes: '',
    use_percentage: false
  })

  const FUNDER_TYPES = [
    { value: 'entreprise', label: 'Entreprise', color: 'blue' },
    { value: 'opco', label: 'OPCO', color: 'purple' },
    { value: 'cpf', label: 'CPF', color: 'green' },
    { value: 'pole_emploi', label: 'France Travail', color: 'orange' },
    { value: 'region', label: 'Région', color: 'teal' },
    { value: 'stagiaire', label: 'Stagiaire', color: 'yellow' },
    { value: 'autre', label: 'Autre', color: 'gray' },
  ]

  // Modal forçage résultat
  const [showForceModal, setShowForceModal] = useState(false)
  const [forceModalData, setForceModalData] = useState({ traineeId: null, newResult: null, reason: '' })
  
  // Modal certificat Non Acquis
  const [showCertificatModal, setShowCertificatModal] = useState(false)
  const [certificatModalData, setCertificatModalData] = useState({ trainee: null, proposal: '' })
  
  // Sélection documents/stagiaires
  const [docSelection, setDocSelection] = useState({
    selectedTrainees: [], // IDs des stagiaires sélectionnés
    expandedDoc: null, // ID du document dont le dropdown est ouvert
  })
  
  // Matériel session
  const [sessionEquipment, setSessionEquipment] = useState([])
  const [equipmentCatalog, setEquipmentCatalog] = useState([])
  const [showAddEquipmentModal, setShowAddEquipmentModal] = useState(false)
  
  // Propositions de remédiation par stagiaire
  const [remediationProposals, setRemediationProposals] = useState({})
  
  // Modal création nouveau stagiaire
  const [showNewTraineeModal, setShowNewTraineeModal] = useState(false)
  const [newTraineeForm, setNewTraineeForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', client_id: '', gender: 'male'
  })
  
  // Départ anticipé
  const [showDepartureModal, setShowDepartureModal] = useState(false)
  const [departureTrainee, setDepartureTrainee] = useState(null)
  const [departureForm, setDepartureForm] = useState({
    departure_date: '',
    departure_reason: ''
  })
  
  // Codes d'accès stagiaires
  const [accessCodes, setAccessCodes] = useState({}) // { trainee_id: { code, attempts, locked } }
  
  // Modal Attentes & Observations
  const [showExpectationsModal, setShowExpectationsModal] = useState(false)
  const [expectationsModalData, setExpectationsModalData] = useState({
    trainee: null,
    expectations: '',
    observation: '',
    stId: null // session_trainees.id
  })
  const [savingExpectations, setSavingExpectations] = useState(false)
  
  const costTypes = [
    { value: 'material', label: 'Matériel (extincteurs, mannequins, etc.)' },
    { value: 'pedagogical', label: 'Coûts pédagogiques' },
    { value: 'travel', label: 'Déplacement' },
    { value: 'misc', label: 'Divers' },
    { value: 'other', label: 'Autre' }
  ]
  
  // Charger les codes d'accès
  const loadAccessCodes = async (sessionId) => {
    const { data, error } = await supabase
      .from('session_trainees')
      .select('trainee_id, access_code, access_code_attempts, access_code_locked')
      .eq('session_id', sessionId)
    
    if (!error && data) {
      const codes = {}
      data.forEach(st => {
        codes[st.trainee_id] = {
          code: st.access_code,
          attempts: st.access_code_attempts || 0,
          locked: st.access_code_locked || false
        }
      })
      setAccessCodes(codes)
    }
  }
  
  // Régénérer un code d'accès
  const handleRegenerateCode = async (traineeId) => {
    const stData = session.session_trainees?.find(st => st.trainee_id === traineeId)
    if (!stData) {
      toast.error('Stagiaire non trouvé')
      return
    }
    
    const { data, error } = await supabase.rpc('admin_regenerate_access_code', {
      p_session_trainee_id: stData.id
    })
    
    if (error) {
      toast.error('Erreur lors de la régénération du code')
      console.error(error)
      return
    }
    
    if (data?.success) {
      toast.success(`Code régénéré : ${data.code}`)
      await loadAccessCodes(session.id)
    } else {
      toast.error(data?.error || 'Erreur lors de la régénération')
    }
  }
  
  // Ouvrir le modal attentes/observations
  const openExpectationsModal = (trainee) => {
    const stData = session.session_trainees?.find(st => st.trainee_id === trainee.id)
    const infoSheet = infoSheets[trainee.id]
    
    setExpectationsModalData({
      trainee,
      expectations: infoSheet?.training_expectations || '',
      observation: stData?.admin_observation || '',
      stId: stData?.id
    })
    setShowExpectationsModal(true)
  }
  
  // Déterminer la couleur de l'icône attentes
  const getExpectationsIconColor = (trainee) => {
    const infoSheet = infoSheets[trainee.id]
    const stData = session.session_trainees?.find(st => st.trainee_id === trainee.id)
    
    const hasExpectations = infoSheet?.training_expectations && infoSheet.training_expectations.trim().length > 0
    const hasObservation = stData?.admin_observation && stData.admin_observation.trim().length > 0
    
    if (!hasExpectations && !hasObservation) {
      // Rien de saisi → transparent/gris
      return 'text-gray-300 hover:text-gray-500'
    }
    if (hasExpectations && !hasObservation) {
      // Stagiaire a saisi mais pas d'observation → rouge
      return 'text-red-500 hover:text-red-600'
    }
    // Observation présente → bleu
    return 'text-blue-600 hover:text-blue-700'
  }
  
  // Sauvegarder attentes et observation
  const handleSaveExpectations = async () => {
    setSavingExpectations(true)
    try {
      const { trainee, expectations, observation, stId } = expectationsModalData
      
      // DEBUG: Afficher les valeurs
      console.log('💾 Sauvegarde attentes/observation:', {
        trainee_id: trainee?.id,
        trainee_name: `${trainee?.first_name} ${trainee?.last_name}`,
        stId,
        expectations,
        observation
      })
      
      // 1. Mettre à jour les attentes dans trainee_info_sheets (si modifiées)
      if (infoSheets[trainee.id]) {
        await supabase
          .from('trainee_info_sheets')
          .update({ training_expectations: expectations })
          .eq('id', infoSheets[trainee.id].id)
        
        // Mettre à jour le state local
        setInfoSheets(prev => ({
          ...prev,
          [trainee.id]: { ...prev[trainee.id], training_expectations: expectations }
        }))
      } else if (expectations) {
        // Créer une fiche si elle n'existe pas mais qu'on a des attentes
        const { data: newSheet } = await supabase
          .from('trainee_info_sheets')
          .insert({
            session_id: session.id,
            trainee_id: trainee.id,
            training_expectations: expectations
          })
          .select()
          .single()
        
        if (newSheet) {
          setInfoSheets(prev => ({
            ...prev,
            [trainee.id]: newSheet
          }))
        }
      }
      
      // 2. Mettre à jour l'observation dans session_trainees
      console.log('🔄 Mise à jour session_trainees avec:', { stId, observation })
      
      const { data: updateData, error: updateError } = await supabase
        .from('session_trainees')
        .update({ admin_observation: observation || null })
        .eq('id', stId)
        .select()
      
      console.log('✅ Résultat update session_trainees:', { updateData, updateError })
      
      if (updateError) {
        throw updateError
      }
      
      // 3. Créer notification si attentes stagiaire ET pas encore de notification
      const hasExpectations = expectations && expectations.trim().length > 0
      const hasObservation = observation && observation.trim().length > 0
      const stData = session.session_trainees?.find(st => st.trainee_id === trainee.id)
      
      if (hasExpectations && !hasObservation && !stData?.expectations_notification_sent) {
        // Trouver le formateur assigné
        const assignedTrainer = session.session_trainers?.[0]?.trainer_id
        if (assignedTrainer) {
          // Créer la notification
          await supabase.from('notifications').insert({
            type: 'expectations',
            title: 'Nouvelles attentes stagiaire',
            message: `${trainee.first_name} ${trainee.last_name} a renseigné ses attentes pour la session ${session.reference}`,
            link: `/sessions/${session.id}`,
            metadata: {
              session_id: session.id,
              trainee_id: trainee.id,
              trainee_name: `${trainee.first_name} ${trainee.last_name}`
            }
          })
          
          // Marquer la notification comme envoyée
          await supabase
            .from('session_trainees')
            .update({ expectations_notification_sent: true })
            .eq('id', stId)
        }
      }
      
      toast.success('Enregistré')
      setShowExpectationsModal(false)
      
      // Recharger la session pour mettre à jour l'affichage
      await fetchSessions()
      
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSavingExpectations(false)
    }
  }
  
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchSessions(), fetchTrainees(), fetchTrainers(), fetchClients(), fetchOrganization()])
      setLoading(false)
    }
    loadData()
  }, [])
  
  // Charger les fiches de renseignements
  const loadInfoSheets = async (sessionId) => {
    try {
      const { data, error } = await supabase
        .from('trainee_info_sheets')
        .select('*')
        .eq('session_id', sessionId)
      
      if (error) {
        console.error('Erreur chargement infoSheets:', error)
        return
      }
      
      // Transformer en objet { traineeId: infoSheet }
      const sheetsMap = {}
      data?.forEach(sheet => {
        sheetsMap[sheet.trainee_id] = sheet
      })
      
      setInfoSheets(sheetsMap)
      console.log('📄 InfoSheets chargées:', sheetsMap)
    } catch (err) {
      console.error('Erreur loadInfoSheets:', err)
    }
  }
  
  // Mettre à jour les infos organisation pour les PDF
  useEffect(() => {
    if (organization) {
      setOrganization(organization)
    }
  }, [organization])
  
  useEffect(() => {
    const found = sessions.find(s => s.id === id)
    if (found) {
      setSession(found)
      fetchAttendances(id)
      loadSuiviData(found)
      loadQuestions(found)
      loadObjectives(found)
      loadSessionEquipment(found.id)
      loadAccessCodes(found.id) // Charger les codes d'accès
      loadInfoSheets(found.id) // 📄 Charger les fiches de renseignements
      
      // Vérifier si une facture existe pour cette session
      supabase.from('invoices').select('id').eq('session_id', found.id).limit(1)
        .then(({ data }) => setSessionHasInvoice(data && data.length > 0))
      
      // QR Code unifié - Portail stagiaire
      if (found.attendance_token) {
        const portalUrl = `${window.location.origin}/#/portail/${found.attendance_token}`
        QRCode.toDataURL(portalUrl, { width: 256, margin: 2 })
          .then(setQrCodeUrl)
          .catch(err => console.error('Erreur génération QR:', err))
      }
      
      const currentTrainer = found.trainer_id || ''
      
      // Formater les dates au format YYYY-MM-DD pour les inputs date
      const formatDate = (d) => d ? d.substring(0, 10) : ''
      
      setEditForm({
        start_date: formatDate(found.start_date),
        end_date: formatDate(found.end_date),
        start_time: found.start_time || '09:00',
        end_time: found.end_time || '17:00',
        location_name: found.location_name || found.location || '',
        status: found.status,
        notes: found.notes || '',
        total_price: found.total_price || '',
        is_intra: found.is_intra || false,
        trainer_id: currentTrainer,
        requires_forprev: found.requires_forprev || false,
        forprev_done: found.forprev_done || false,
        contact_id: found.contact_id || '',
        signatory_name: found.signatory_name || '',
        signatory_role: found.signatory_role || '',
      })
    }
  }, [sessions, id])
  
  // Charger le matériel de la session
  const loadSessionEquipment = async (sessionId) => {
    // Charger le catalogue
    const { data: catalog } = await supabase
      .from('equipment_catalog')
      .select('*')
      .order('theme')
      .order('name')
    setEquipmentCatalog(catalog || [])
    
    // Charger le matériel de la session
    const { data: equipment } = await supabase
      .from('session_equipment')
      .select('*, equipment_catalog(*)')
      .eq('session_id', sessionId)
    setSessionEquipment(equipment || [])
  }
  
  // Générer/recalculer le matériel depuis la formation
  const generateEquipmentFromCourse = async () => {
    if (!session) return
    
    const nbTrainees = sessionTrainees.length || 1
    
    // Récupérer le matériel de la formation
    const { data: courseEquipment } = await supabase
      .from('course_equipment')
      .select('equipment_id, equipment_catalog(ratio_per_persons)')
      .eq('course_id', session.course_id)
    
    if (!courseEquipment || courseEquipment.length === 0) {
      toast.error('Aucun matériel configuré pour cette formation')
      return
    }
    
    // Supprimer l'existant
    await supabase.from('session_equipment').delete().eq('session_id', session.id)
    
    // Calculer et insérer
    for (const ce of courseEquipment) {
      const ratio = ce.equipment_catalog?.ratio_per_persons
      const quantity = ratio ? Math.ceil(nbTrainees / ratio) : 1
      
      await supabase.from('session_equipment').insert({
        session_id: session.id,
        equipment_id: ce.equipment_id,
        quantity_required: quantity
      })
    }
    
    await loadSessionEquipment(session.id)
    toast.success(`Matériel généré pour ${nbTrainees} stagiaire(s)`)
  }
  
  // Toggle préparé
  const toggleEquipmentPrepared = async (eqId, isPrepared) => {
    await supabase
      .from('session_equipment')
      .update({ 
        is_prepared: isPrepared,
        prepared_by: isPrepared ? user?.email : null,
        prepared_at: isPrepared ? new Date().toISOString() : null
      })
      .eq('id', eqId)
    
    setSessionEquipment(sessionEquipment.map(eq => 
      eq.id === eqId ? { 
        ...eq, 
        is_prepared: isPrepared,
        prepared_by: isPrepared ? user?.email : null,
        prepared_at: isPrepared ? new Date().toISOString() : null
      } : eq
    ))
  }
  
  // Ajouter un équipement à la session
  const addEquipmentToSession = async (equipmentId) => {
    const equipment = equipmentCatalog.find(e => e.id === equipmentId)
    if (!equipment) return
    
    const nbTrainees = sessionTrainees.length || 1
    const quantity = equipment.ratio_per_persons 
      ? Math.ceil(nbTrainees / equipment.ratio_per_persons) 
      : 1
    
    const { error } = await supabase.from('session_equipment').insert({
      session_id: session.id,
      equipment_id: equipmentId,
      quantity_required: quantity
    })
    
    if (error) {
      if (error.code === '23505') {
        toast.error('Équipement déjà ajouté')
      } else {
        toast.error('Erreur lors de l\'ajout')
      }
      return
    }
    
    await loadSessionEquipment(session.id)
    setShowAddEquipmentModal(false)
    toast.success('Équipement ajouté')
  }
  
  // Supprimer un équipement de la session
  const removeEquipmentFromSession = async (eqId) => {
    await supabase.from('session_equipment').delete().eq('id', eqId)
    setSessionEquipment(sessionEquipment.filter(eq => eq.id !== eqId))
    toast.success('Équipement retiré')
  }
  
  const loadSuiviData = async (sess) => {
    const { data: attendance } = await fetchAttendance(sess.id)
    const presMap = {}
    attendance?.forEach(a => {
      const key = `${a.trainee_id}_${a.date}`
      presMap[key] = a.present
    })
    setPresenceData(presMap)
    
    // Charger les présences demi-journées
    const { data: halfDays, error: halfDaysError } = await supabase
      .from('attendance_halfdays')
      .select('*')
      .eq('session_id', sess.id)
    
    console.log('=== Chargement présences ===')
    console.log('session_id:', sess.id)
    console.log('halfDays from DB:', halfDays)
    console.log('halfDaysError:', halfDaysError)
    
    const halfDayMap = {}
    halfDays?.forEach(h => {
      // Normaliser le format de date
      const dateStr = typeof h.date === 'string' ? h.date.substring(0, 10) : format(new Date(h.date), 'yyyy-MM-dd')
      
      console.log('Processing halfday:', h, 'dateStr:', dateStr)
      
      // Format avec colonnes morning/afternoon (format actuel)
      if (h.morning !== null && h.morning !== undefined) {
        const isMorningPresent = h.morning === true || h.morning === 't' || h.morning === 'true'
        halfDayMap[`${h.trainee_id}_${dateStr}_morning`] = isMorningPresent
        console.log(`  morning: ${isMorningPresent}`)
      }
      if (h.afternoon !== null && h.afternoon !== undefined) {
        const isAfternoonPresent = h.afternoon === true || h.afternoon === 't' || h.afternoon === 'true'
        halfDayMap[`${h.trainee_id}_${dateStr}_afternoon`] = isAfternoonPresent
        console.log(`  afternoon: ${isAfternoonPresent}`)
      }
      
      // Compatibilité ancien format avec period/present (si jamais)
      if (h.period && h.present !== null && h.present !== undefined) {
        const isPresent = h.present === true || h.present === 't' || h.present === 'true'
        halfDayMap[`${h.trainee_id}_${dateStr}_${h.period}`] = isPresent
        console.log(`  period ${h.period}: ${isPresent}`)
      }
    })
    console.log('halfDayMap final:', halfDayMap)
    setHalfDayAttendance(halfDayMap)
    
    // Charger les fiches de renseignement
    const { data: infoSheetsData } = await supabase
      .from('trainee_info_sheets')
      .select('*')
      .eq('session_id', sess.id)
    const infoMap = {}
    infoSheetsData?.forEach(info => {
      infoMap[info.trainee_id] = info
    })
    setInfoSheets(infoMap)
    
    const { data: evals } = await fetchTraineeEvaluations(sess.id)
    const evalMap = {}
    evals?.forEach(e => { evalMap[e.trainee_id] = e })
    
    // Initialiser les valeurs par défaut pour les stagiaires sans évaluation
    // Les notes sont à NULL par défaut - l'utilisateur doit cliquer pour donner une note
    const defaultEvalValues = {
      questionnaire_submitted: false,
      // Organisation - NULL par défaut
      q_org_documents: null,
      q_org_accueil: null,
      q_org_locaux: null,
      q_org_materiel: null,
      // Contenu - NULL par défaut
      q_contenu_organisation: null,
      q_contenu_supports: null,
      q_contenu_duree: null,
      q_contenu_programme: null,
      // Formateur - NULL par défaut
      q_formateur_pedagogie: null,
      q_formateur_expertise: null,
      q_formateur_progression: null,
      q_formateur_moyens: null,
      // Perception globale - NULL par défaut
      q_global_adequation: null,
      q_global_competences: null,
      would_recommend: null,
      // Commentaires
      comment_general: '',
      comment_projet: '',
      // Compatibilité anciennes questions - NULL par défaut
      q1_objectives: null,
      q2_content: null,
      q3_trainer: null,
      q4_methods: null,
      q5_materials: null,
      q6_organization: null,
      q7_duration: null,
      q8_applicability: null,
      satisfaction_score: null
    }
    
    // Pour chaque stagiaire, vérifier si évaluation existe
    const traineesIds = sess.session_trainees?.map(st => st.trainee_id) || []
    for (const traineeId of traineesIds) {
      const existing = evalMap[traineeId]
      // Si pas d'évaluation, créer une entrée vide (sans notes par défaut)
      if (!existing) {
        evalMap[traineeId] = { ...defaultEvalValues }
        // Créer l'entrée en BDD sans notes (juste pour lier le stagiaire à la session)
        await upsertTraineeEvaluation(sess.id, traineeId, { questionnaire_submitted: false })
      }
    }
    
    setEvaluationsData(evalMap)
    
    // Évaluations à froid
    const { data: coldEvals } = await fetchColdEvaluations(sess.id)
    const coldEvalMap = {}
    coldEvals?.forEach(e => { coldEvalMap[e.trainee_id] = e })
    setColdEvaluationsData(coldEvalMap)
    
    const { data: tEval } = await fetchTrainerEvaluation(sess.id)
    setTrainerEval(tEval)
    
    const { data: docs } = await fetchSessionDocuments(sess.id)
    setSessionDocs(docs || [])
    
    // Charger les coûts supplémentaires
    const { data: costs } = await supabase
      .from('session_costs')
      .select('*')
      .eq('session_id', sess.id)
      .order('created_at', { ascending: true })
    setSessionCosts(costs || [])
    
    // Charger les financements multi-financeurs
    const { data: fundings } = await supabase
      .from('session_fundings')
      .select('*, clients:funder_client_id(name, siret, address, postal_code, city)')
      .eq('session_id', sess.id)
      .order('created_at', { ascending: true })
    setSessionFundings(fundings || [])
  }
  
  const loadQuestions = async (sess) => {
    if (sess.course_id) {
      const { data } = await fetchCourseQuestions(sess.course_id)
      setQuestions(data || [])
    }
  }
  
  const loadObjectives = async (sess) => {
    const data = await fetchTraineeObjectives(sess.id)
    setObjectivesData(data || [])
    
    // Charger les résultats et propositions de remédiation depuis session_trainees
    const results = {}
    const proposals = {}
    sess.session_trainees?.forEach(st => {
      results[st.trainee_id] = st.result
      if (st.remediation_proposal) {
        proposals[st.trainee_id] = st.remediation_proposal
      }
    })
    setTraineeResults(results)
    setRemediationProposals(proposals)
  }
  
  // Parser les objectifs de la formation
  const getObjectivesList = () => {
    const objectives = session?.courses?.objectives || ''
    return objectives.split('\n').map(o => o.trim()).filter(o => o.length > 0)
  }
  
  // Initialiser les objectifs pour tous les stagiaires
  const handleInitObjectives = async () => {
    const objectives = getObjectivesList()
    if (objectives.length === 0) {
      toast.error('Aucun objectif défini pour cette formation')
      return
    }
    
    await initializeTraineeObjectives(session.id, sessionTrainees, objectives)
    await loadObjectives(session)
    toast.success('Objectifs initialisés')
  }
  
  // Valider/invalider un objectif pour un stagiaire
  const handleToggleObjective = async (traineeId, objectiveIndex, currentValue) => {
    const newValue = !currentValue
    const result = await toggleTraineeObjective(session.id, traineeId, objectiveIndex, newValue)
    
    // Mettre à jour local - ajouter si n'existe pas, modifier sinon
    setObjectivesData(prev => {
      const exists = prev.some(o => o.trainee_id === traineeId && o.objective_index === objectiveIndex)
      if (exists) {
        return prev.map(o => 
          (o.trainee_id === traineeId && o.objective_index === objectiveIndex) 
            ? { ...o, validated: newValue }
            : o
        )
      } else {
        // Ajouter le nouvel objectif
        return [...prev, {
          id: result.data?.id,
          session_id: session.id,
          trainee_id: traineeId,
          objective_index: objectiveIndex,
          validated: newValue
        }]
      }
    })
    
    // Recalculer le résultat du stagiaire
    const traineeResult = await updateTraineeResult(session.id, traineeId)
    setTraineeResults(prev => ({ ...prev, [traineeId]: traineeResult.result }))
  }
  
  // Mettre à jour le commentaire de remédiation pour un objectif
  const handleUpdateRemediationComment = async (traineeId, objectiveIndex, comment) => {
    const objData = objectivesData.find(o => o.trainee_id === traineeId && o.objective_index === objectiveIndex)
    if (!objData?.id) return
    
    // Mettre à jour en BDD
    const { error } = await supabase
      .from('trainee_objectives')
      .update({ remediation_comment: comment || null })
      .eq('id', objData.id)
    
    if (error) {
      console.error('Erreur mise à jour commentaire:', error)
      toast.error('Erreur lors de la sauvegarde')
      return
    }
    
    // Mettre à jour local
    setObjectivesData(prev => prev.map(o => 
      o.id === objData.id ? { ...o, remediation_comment: comment } : o
    ))
  }
  
  // Marquer tous les objectifs comme acquis pour tous les stagiaires
  const handleMarkAllAcquired = async () => {
    if (!confirm('Marquer tous les objectifs comme acquis pour tous les stagiaires ?')) return
    
    const objectives = getObjectivesList()
    if (objectives.length === 0 || sessionTrainees.length === 0) return
    
    // Créer la liste complète des objectifs pour l'état local
    const newObjectivesData = []
    sessionTrainees.forEach(trainee => {
      objectives.forEach((_, idx) => {
        newObjectivesData.push({
          session_id: session.id,
          trainee_id: trainee.id,
          objective_index: idx,
          validated: true
        })
      })
    })
    setObjectivesData(newObjectivesData)
    
    // Sauvegarder en base et recalculer les résultats
    for (const trainee of sessionTrainees) {
      for (let idx = 0; idx < objectives.length; idx++) {
        // Toujours créer/mettre à jour l'objectif
        await toggleTraineeObjective(session.id, trainee.id, idx, true)
      }
      
      // Recalculer le résultat du stagiaire
      const result = await updateTraineeResult(session.id, trainee.id)
      if (result?.result) {
        setTraineeResults(prev => ({ ...prev, [trainee.id]: result.result }))
      }
    }
    
    toast.success('Tous les objectifs marqués acquis ✓')
  }
  
  // Ouvrir la modal de forçage du résultat
  const openForceModal = (traineeId, newResult) => {
    setForceModalData({ traineeId, newResult, reason: '' })
    setShowForceModal(true)
  }
  
  // Confirmer le forçage du résultat
  const handleConfirmForce = async () => {
    const { traineeId, newResult, reason } = forceModalData
    if (!reason.trim()) {
      toast.error('Veuillez saisir une justification')
      return
    }
    
    const result = await forceTraineeResult(session.id, traineeId, newResult, reason)
    setTraineeResults(prev => ({ ...prev, [traineeId]: result.result }))
    setShowForceModal(false)
    setForceModalData({ traineeId: null, newResult: null, reason: '' })
    toast.success(`Résultat forcé : ${newResult === 'acquired' ? 'ACQUIS' : 'NON ACQUIS'}`)
  }
  
  // Ouvrir la modal certificat Non Acquis
  const openCertificatNonAcquisModal = (trainee) => {
    const courseTitle = session?.courses?.title || 'la formation'
    const existingProposal = remediationProposals[trainee.id] || `Repasser le module ${courseTitle}`
    setCertificatModalData({ trainee, proposal: existingProposal })
    setShowCertificatModal(true)
  }
  
  // Télécharger le certificat Non Acquis après validation de la proposition
  const handleDownloadCertificatNonAcquis = async () => {
    const { trainee, proposal } = certificatModalData
    
    // Sauvegarder la proposition en base
    await updateRemediationProposal(session.id, trainee.id, proposal)
    setRemediationProposals(prev => ({ ...prev, [trainee.id]: proposal }))
    
    // Récupérer les objectifs non validés avec leurs commentaires
    const traineeObjectives = objectivesData.filter(o => o.trainee_id === trainee.id)
    const failedObjectivesWithComments = traineeObjectives
      .filter(o => !o.validated)
      .map(o => ({
        text: getObjectivesList()[o.objective_index],
        comment: o.remediation_comment || null
      }))
      .filter(o => o.text) // Ne garder que ceux qui ont un texte
    
    // Générer le certificat avec les infos supplémentaires
    const trainer = session.trainers
    const stData = session.session_trainees?.find(st => st.trainee_id === trainee.id)
    const enrichedTrainee = { 
      ...trainee, 
      result: stData?.result || traineeResults[trainee.id] || 'not_acquired',
      remediation_proposal: proposal,
      failed_objectives: failedObjectivesWithComments.map(o => o.text), // Garder la compat
      failed_objectives_with_comments: failedObjectivesWithComments // Nouveau format
    }
    
    downloadDocument('certificat', session, { trainee: enrichedTrainee, trainer })
    setShowCertificatModal(false)
    toast.success('Certificat généré')
  }
  
  // === Gestion des coûts supplémentaires ===
  const handleAddCost = async () => {
    if (!costForm.label || !costForm.amount) {
      toast.error('Veuillez remplir le libellé et le montant')
      return
    }
    
    const { data, error } = await supabase
      .from('session_costs')
      .insert({
        session_id: session.id,
        cost_type: costForm.cost_type,
        label: costForm.label,
        amount: parseFloat(costForm.amount),
        per_trainee: costForm.per_trainee,
        notes: costForm.notes || null,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error adding cost:', error)
      toast.error('Erreur lors de l\'ajout du coût')
      return
    }
    
    setSessionCosts(prev => [...prev, data])
    setCostForm({ cost_type: 'material', label: '', amount: '', per_trainee: false, notes: '' })
    setShowAddCost(false)
    toast.success('Coût ajouté ✓')
  }
  
  const handleDeleteCost = async (costId) => {
    if (!confirm('Supprimer ce coût ?')) return
    
    const { error } = await supabase
      .from('session_costs')
      .delete()
      .eq('id', costId)
    
    if (error) {
      toast.error('Erreur lors de la suppression')
      return
    }
    
    setSessionCosts(prev => prev.filter(c => c.id !== costId))
    toast.success('Coût supprimé')
  }

  // ============================================================
  // GESTION FINANCEMENTS MULTI-FINANCEURS
  // ============================================================

  const getSessionTotalHT = () => {
    const basePrice = parseFloat(session?.total_price || session?.courses?.price_ht || 0)
    const costsTotal = calculateTotalCosts()
    return basePrice + costsTotal
  }

  const getFundingTotal = () => {
    return sessionFundings.reduce((sum, f) => sum + parseFloat(f.amount_ht || 0), 0)
  }

  const getFundingCoverage = () => {
    const total = getSessionTotalHT()
    if (!total) return 0
    return Math.round((getFundingTotal() / total) * 100)
  }

  const resetFundingForm = () => {
    setFundingForm({
      funder_type: 'entreprise', funder_name: '', funder_client_id: '',
      funder_contact_name: '', funder_contact_email: '', funder_address: '',
      funder_siret: '', amount_ht: '', percentage: '', dossier_number: '', notes: '',
      use_percentage: false
    })
    setEditingFunding(null)
  }

  const handleAddFunding = async () => {
    if (!fundingForm.funder_name) {
      toast.error('Veuillez indiquer le nom du financeur')
      return
    }
    const totalHT = getSessionTotalHT()
    let amountHt = parseFloat(fundingForm.amount_ht || 0)
    let pct = parseFloat(fundingForm.percentage || 0)

    if (fundingForm.use_percentage && pct > 0 && totalHT > 0) {
      amountHt = Math.round((totalHT * pct / 100) * 100) / 100
    } else if (amountHt > 0 && totalHT > 0) {
      pct = Math.round((amountHt / totalHT) * 10000) / 100
    }

    if (amountHt <= 0) {
      toast.error('Le montant doit être supérieur à 0')
      return
    }

    const payload = {
      session_id: session.id,
      funder_type: fundingForm.funder_type,
      funder_name: fundingForm.funder_name,
      funder_client_id: fundingForm.funder_client_id || null,
      funder_contact_name: fundingForm.funder_contact_name || null,
      funder_contact_email: fundingForm.funder_contact_email || null,
      funder_address: fundingForm.funder_address || null,
      funder_siret: fundingForm.funder_siret || null,
      amount_ht: amountHt,
      percentage: pct || null,
      dossier_number: fundingForm.dossier_number || null,
      notes: fundingForm.notes || null,
      status: 'pending'
    }

    if (editingFunding) {
      const { data, error } = await supabase
        .from('session_fundings')
        .update(payload)
        .eq('id', editingFunding.id)
        .select('*, clients:funder_client_id(name, siret, address, postal_code, city)')
        .single()

      if (error) { toast.error('Erreur modification'); console.error(error); return }
      setSessionFundings(prev => prev.map(f => f.id === editingFunding.id ? data : f))
      toast.success('Financement modifié ✓')
    } else {
      const { data, error } = await supabase
        .from('session_fundings')
        .insert(payload)
        .select('*, clients:funder_client_id(name, siret, address, postal_code, city)')
        .single()

      if (error) { toast.error('Erreur ajout financement'); console.error(error); return }
      setSessionFundings(prev => [...prev, data])
      toast.success('Financement ajouté ✓')
    }

    resetFundingForm()
    setShowAddFunding(false)
  }

  const handleDeleteFunding = async (fundingId) => {
    if (!confirm('Supprimer ce financement ?')) return
    const { error } = await supabase.from('session_fundings').delete().eq('id', fundingId)
    if (error) { toast.error('Erreur suppression'); return }
    setSessionFundings(prev => prev.filter(f => f.id !== fundingId))
    toast.success('Financement supprimé')
  }

  const handleEditFunding = (funding) => {
    setEditingFunding(funding)
    setFundingForm({
      funder_type: funding.funder_type,
      funder_name: funding.funder_name || '',
      funder_client_id: funding.funder_client_id || '',
      funder_contact_name: funding.funder_contact_name || '',
      funder_contact_email: funding.funder_contact_email || '',
      funder_address: funding.funder_address || '',
      funder_siret: funding.funder_siret || '',
      amount_ht: funding.amount_ht || '',
      percentage: funding.percentage || '',
      dossier_number: funding.dossier_number || '',
      notes: funding.notes || '',
      use_percentage: false
    })
    setShowAddFunding(true)
  }

  const handleFundingStatus = async (fundingId, newStatus) => {
    const { error } = await supabase
      .from('session_fundings')
      .update({ status: newStatus })
      .eq('id', fundingId)
    if (error) { toast.error('Erreur changement statut'); return }
    setSessionFundings(prev => prev.map(f => f.id === fundingId ? { ...f, status: newStatus } : f))
    toast.success(`Statut → ${newStatus}`)
  }

  const handleGenerateFundingInvoice = (funding) => {
    // Rediriger vers la page factures avec pré-remplissage
    const params = new URLSearchParams({
      from_session: session.id,
      funder_name: funding.funder_name || '',
      funder_type: funding.funder_type || '',
      funder_client_id: funding.funder_client_id || '',
      funder_amount: funding.amount_ht || '',
      funder_siret: funding.funder_siret || '',
      funder_email: funding.funder_contact_email || '',
      funder_dossier: funding.dossier_number || '',
      funding_id: funding.id
    })
    navigate(`/invoices?${params.toString()}`)
  }

  const handlePrefillClientFunding = (clientId) => {
    const client = clients.find(c => c.id === clientId)
    if (client) {
      setFundingForm(prev => ({
        ...prev,
        funder_client_id: clientId,
        funder_name: prev.funder_name || client.name,
        funder_siret: prev.funder_siret || client.siret || '',
        funder_address: prev.funder_address || [client.address, client.postal_code, client.city].filter(Boolean).join(', '),
        funder_contact_email: prev.funder_contact_email || client.contact_email || ''
      }))
    }
  }
  
  // ============================================================
  // GESTION SUIVI CONVENTION
  // ============================================================
  
  // Marquer la convention comme envoyée
  const handleConventionSent = async (checked) => {
    if (checked) {
      // Ouvrir le popup pour choisir la date/heure
      setDateTimeModal({
        isOpen: true,
        type: 'convention_sent',
        currentDate: session.convention_sent_date || new Date().toISOString()
      })
    } else {
      // Décocher = supprimer la date
      const updateData = {
        convention_sent: false,
        convention_sent_date: null
      }
      
      const { error } = await supabase
        .from('sessions')
        .update(updateData)
        .eq('id', id)
      
      if (error) {
        toast.error('Erreur lors de la mise à jour')
        console.error(error)
        return
      }
      
      setSession({ ...session, ...updateData })
      toast.success('Envoi annulé')
    }
  }
  
  // Sauvegarder la date d'envoi de convention
  const saveConventionSentDate = async (datetime) => {
    const updateData = {
      convention_sent: true,
      convention_sent_date: datetime
    }
    
    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', id)
    
    if (error) {
      toast.error('Erreur lors de la mise à jour')
      console.error(error)
      return
    }
    
    setSession({ ...session, ...updateData })
    toast.success('Convention marquée comme envoyée')
  }
  
  // Modifier la date d'envoi de convention
  const editConventionSentDate = () => {
    setDateTimeModal({
      isOpen: true,
      type: 'convention_sent',
      currentDate: session.convention_sent_date
    })
  }
  
  // Upload de la convention signée
  const handleUploadConvention = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Vérifier que c'est un PDF
    if (file.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés')
      return
    }
    
    // Vérifier la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux (max 10MB)')
      return
    }
    
    setUploadingConvention(true)
    
    try {
      const filePath = `${id}/convention-signee.pdf`
      
      // Supprimer l'ancien fichier s'il existe
      if (session.convention_signed_file_url) {
        await supabase.storage
          .from('signed-conventions')
          .remove([session.convention_signed_file_url])
      }
      
      // Upload du nouveau fichier
      const { error: uploadError } = await supabase.storage
        .from('signed-conventions')
        .upload(filePath, file, { upsert: true })
      
      if (uploadError) {
        throw uploadError
      }
      
      // Ouvrir le popup pour choisir la date/heure de réception
      setDateTimeModal({
        isOpen: true,
        type: 'convention_signed',
        currentDate: new Date().toISOString(),
        filePath: filePath // Stocker le filePath pour l'utiliser après
      })
      
      setUploadingConvention(false)
    } catch (error) {
      console.error('Erreur upload:', error)
      toast.error('Erreur lors de l\'upload')
    } finally {
      setUploadingConvention(false)
      // Reset input
      e.target.value = ''
    }
  }
  
  // Sauvegarder la date de réception de la convention signée
  const saveConventionSignedDate = async (datetime) => {
    const updateData = {
      convention_signed: true,
      convention_signed_date: datetime,
      convention_signed_file_url: dateTimeModal.filePath
    }
    
    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', id)
    
    if (error) {
      toast.error('Erreur lors de la mise à jour')
      console.error(error)
      return
    }
    
    setSession({ ...session, ...updateData })
    toast.success('Convention signée uploadée avec succès')
  }
  
  // Modifier la date de réception de la convention signée
  const editConventionSignedDate = () => {
    setDateTimeModal({
      isOpen: true,
      type: 'convention_signed',
      currentDate: session.convention_signed_date
    })
  }
  
  // Handler général pour le modal date/heure
  const handleDateTimeSave = (datetime) => {
    if (dateTimeModal.type === 'convention_sent') {
      saveConventionSentDate(datetime)
    } else if (dateTimeModal.type === 'convention_signed') {
      saveConventionSignedDate(datetime)
    }
  }
  
  // Télécharger la convention signée
  const handleDownloadConvention = async () => {
    if (!session.convention_signed_file_url) return
    
    try {
      const { data, error } = await supabase.storage
        .from('signed-conventions')
        .download(session.convention_signed_file_url)
      
      if (error) {
        throw error
      }
      
      // Créer un lien de téléchargement
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `Convention_Signee_${session.reference}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Convention téléchargée')
    } catch (error) {
      console.error('Erreur téléchargement:', error)
      toast.error('Erreur lors du téléchargement')
    }
  }
  
  // Calculer le total des coûts supplémentaires
  const calculateTotalCosts = () => {
    const nbTrainees = sessionTrainees.length || 1
    return sessionCosts.reduce((sum, cost) => {
      const amount = parseFloat(cost.amount) || 0
      return sum + (cost.per_trainee ? amount * nbTrainees : amount)
    }, 0)
  }
  
  // Vérifier si un stagiaire a tous ses objectifs validés
  const getTraineeObjectiveStatus = (traineeId) => {
    const traineeObjectives = objectivesData.filter(o => o.trainee_id === traineeId)
    if (traineeObjectives.length === 0) return null
    const validated = traineeObjectives.filter(o => o.validated).length
    return { validated, total: traineeObjectives.length, complete: validated === traineeObjectives.length }
  }
  
  // Vérifier la présence totale d'un stagiaire
  const getTraineePresenceStatus = (traineeId) => {
    const days = sessionDays
    if (days.length === 0) return { present: 0, total: 0, complete: true }
    
    let presentCount = 0
    days.forEach(day => {
      const key = `${traineeId}_${format(day, 'yyyy-MM-dd')}`
      if (presenceData[key]) presentCount++
    })
    
    return { present: presentCount, total: days.length, complete: presentCount === days.length }
  }
  
  const getSessionDays = () => {
    if (!session?.start_date || !session?.end_date) return []
    try {
      // Parser les dates sans problème de fuseau horaire (YYYY-MM-DD)
      const startParts = session.start_date.substring(0, 10).split('-')
      const endParts = session.end_date.substring(0, 10).split('-')
      const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]))
      const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]))
      return eachDayOfInterval({ start, end })
    } catch { return [] }
  }
  
  // Calculer le nombre de demi-journées basé sur la durée
  const getHalfDaysCount = () => {
    const durationHours = session?.courses?.duration_hours || session?.courses?.duration || 7
    // 7h = 2 demi-journées (1 jour), 3.5h = 1 demi-journée, 14h = 4 demi-journées
    return Math.ceil(durationHours / 3.5)
  }
  
  // Générer la liste des demi-journées
  const getHalfDaysList = () => {
    const days = getSessionDays()
    const totalHalfDays = getHalfDaysCount()
    const halfDays = []
    
    // Si day_type === 'half', une seule période par jour
    const isHalfDaySession = session?.day_type === 'half'
    const halfDayPeriod = isHalfDaySession && session?.start_time && parseInt(session.start_time.split(':')[0], 10) >= 12 ? 'afternoon' : 'morning'
    
    let remaining = totalHalfDays
    for (const day of days) {
      if (remaining <= 0) break
      const dateStr = format(day, 'yyyy-MM-dd')
      
      if (isHalfDaySession) {
        // Session demi-journée : une seule case par jour
        halfDays.push({ date: day, dateStr, period: halfDayPeriod, label: halfDayPeriod === 'afternoon' ? 'Après-midi' : 'Matin' })
        remaining--
      } else {
        // Session journée complète : matin + après-midi
        // Ajouter matin si il reste des demi-journées
        if (remaining > 0) {
          halfDays.push({ date: day, dateStr, period: 'morning', label: 'Matin' })
          remaining--
        }
        // Ajouter après-midi si il reste des demi-journées
        if (remaining > 0) {
          halfDays.push({ date: day, dateStr, period: 'afternoon', label: 'Après-midi' })
          remaining--
        }
      }
    }
    return halfDays
  }
  
  // Gérer le changement de présence demi-journée
  const handleHalfDayChange = async (traineeId, dateStr, period, present) => {
    console.log('=== handleHalfDayChange ===', { traineeId, dateStr, period, present })
    
    const key = `${traineeId}_${dateStr}_${period}`
    const newAttendance = { ...halfDayAttendance, [key]: present }
    setHalfDayAttendance(newAttendance)
    
    // Récupérer l'état actuel des deux demi-journées
    const morningKey = `${traineeId}_${dateStr}_morning`
    const afternoonKey = `${traineeId}_${dateStr}_afternoon`
    const currentMorning = period === 'morning' ? present : (newAttendance[morningKey] || false)
    const currentAfternoon = period === 'afternoon' ? present : (newAttendance[afternoonKey] || false)
    
    const updateData = {
      session_id: session.id,
      trainee_id: traineeId,
      date: dateStr,
      morning: currentMorning,
      afternoon: currentAfternoon,
      validated_by: session.trainers ? `${session.trainers.first_name} ${session.trainers.last_name}` : 'Formateur',
      validated_at: new Date().toISOString(),
    }
    
    console.log('updateData:', updateData)
    
    // Vérifier si une entrée existe déjà
    const { data: existing, error: selectError } = await supabase
      .from('attendance_halfdays')
      .select('id')
      .eq('session_id', session.id)
      .eq('trainee_id', traineeId)
      .eq('date', dateStr)
      .maybeSingle()
    
    console.log('existing:', existing, 'selectError:', selectError)
    
    if (existing?.id) {
      // Mettre à jour l'entrée existante
      const { data, error } = await supabase
        .from('attendance_halfdays')
        .update(updateData)
        .eq('id', existing.id)
        .select()
      console.log('UPDATE result:', data, 'error:', error)
      if (error) console.error('Erreur update présence:', error)
    } else {
      // Créer une nouvelle entrée
      const { data, error } = await supabase
        .from('attendance_halfdays')
        .insert(updateData)
        .select()
      console.log('INSERT result:', data, 'error:', error)
      if (error) console.error('Erreur insert présence:', error)
    }
    
    // Vérifier si 100% et mettre à jour presence_complete
    const halfDays = getHalfDaysList()
    let presentCount = 0
    halfDays.forEach(hd => {
      const k = `${traineeId}_${hd.dateStr}_${hd.period}`
      if (newAttendance[k]) presentCount++
    })
    const isComplete = presentCount === halfDays.length && halfDays.length > 0
    await updatePresenceComplete(session.id, traineeId, isComplete)
  }
  
  // Marquer tous les stagiaires présents à toutes les demi-journées
  const handleMarkAllPresent = async () => {
    if (!confirm('Marquer tous les stagiaires présents à toutes les demi-journées ?')) return
    
    const halfDays = getHalfDaysList()
    if (halfDays.length === 0 || sessionTrainees.length === 0) return
    
    // Mettre à jour l'état local immédiatement
    const newAttendance = { ...halfDayAttendance }
    sessionTrainees.forEach(trainee => {
      halfDays.forEach(hd => {
        const key = `${trainee.id}_${hd.dateStr}_${hd.period}`
        newAttendance[key] = true
      })
    })
    setHalfDayAttendance(newAttendance)
    
    // Sauvegarder en base
    const validatedBy = session.trainers ? `${session.trainers.first_name} ${session.trainers.last_name}` : 'Formateur'
    const validatedAt = new Date().toISOString()
    const isHalfDaySession = session?.day_type === 'half'
    const isAfternoonHalf = isHalfDaySession && session?.start_time && parseInt(session.start_time.split(':')[0], 10) >= 12
    
    for (const trainee of sessionTrainees) {
      // Grouper les demi-journées par date
      const dates = [...new Set(halfDays.map(hd => hd.dateStr))]
      
      for (const dateStr of dates) {
        const updateData = {
          session_id: session.id,
          trainee_id: trainee.id,
          date: dateStr,
          morning: isAfternoonHalf ? false : true,
          afternoon: isHalfDaySession && !isAfternoonHalf ? false : true,
          validated_by: validatedBy,
          validated_at: validatedAt,
        }
        
        // Vérifier si une entrée existe déjà
        const { data: existing } = await supabase
          .from('attendance_halfdays')
          .select('id')
          .eq('session_id', session.id)
          .eq('trainee_id', trainee.id)
          .eq('date', dateStr)
          .maybeSingle()
        
        if (existing?.id) {
          await supabase.from('attendance_halfdays').update(updateData).eq('id', existing.id)
        } else {
          await supabase.from('attendance_halfdays').insert(updateData)
        }
      }
      
      // Recalculer le résultat du stagiaire
      const result = await updateTraineeResult(session.id, trainee.id)
      if (result?.result) {
        setTraineeResults(prev => ({ ...prev, [trainee.id]: result.result }))
      }
      
      // Marquer présence complète
      await updatePresenceComplete(session.id, trainee.id, true)
    }
    
    toast.success('Tous les stagiaires marqués présents ✓')
  }
  
  // Gérer le départ anticipé
  const openDepartureModal = (trainee) => {
    setDepartureTrainee(trainee)
    const stData = session.session_trainees?.find(st => st.trainee_id === trainee.id)
    if (stData?.early_departure) {
      setDepartureForm({
        departure_date: stData.departure_date || '',
        departure_reason: stData.departure_reason || ''
      })
    } else {
      setDepartureForm({ departure_date: '', departure_reason: '' })
    }
    setShowDepartureModal(true)
  }
  
  const handleSaveDeparture = async () => {
    if (!departureTrainee) return
    if (!departureForm.departure_date) {
      toast.error('La date de départ est requise')
      return
    }
    if (!departureForm.departure_reason.trim()) {
      toast.error('Le motif de départ est requis')
      return
    }
    
    const { error } = await supabase
      .from('session_trainees')
      .update({
        early_departure: true,
        departure_date: departureForm.departure_date,
        departure_reason: departureForm.departure_reason
      })
      .eq('session_id', session.id)
      .eq('trainee_id', departureTrainee.id)
    
    if (error) {
      console.error('Erreur départ anticipé:', error)
      toast.error('Erreur lors de l\'enregistrement')
      return
    }
    
    toast.success('Départ anticipé enregistré')
    setShowDepartureModal(false)
    setDepartureTrainee(null)
    fetchSessions()
  }
  
  const handleCancelDeparture = async (trainee) => {
    if (!confirm('Annuler le départ anticipé de ce stagiaire ?')) return
    
    const { error } = await supabase
      .from('session_trainees')
      .update({
        early_departure: false,
        departure_date: null,
        departure_reason: null
      })
      .eq('session_id', session.id)
      .eq('trainee_id', trainee.id)
    
    if (error) {
      toast.error('Erreur lors de l\'annulation')
      return
    }
    
    toast.success('Départ anticipé annulé')
    fetchSessions()
  }
  
  // Vérifier si un stagiaire a 100% de présence (demi-journées)
  const getTraineeHalfDayStatus = (traineeId) => {
    const halfDays = getHalfDaysList()
    if (halfDays.length === 0) return { present: 0, total: 0, complete: true, percentage: 100 }
    
    let presentCount = 0
    halfDays.forEach(hd => {
      const key = `${traineeId}_${hd.dateStr}_${hd.period}`
      if (halfDayAttendance[key]) presentCount++
    })
    
    const percentage = Math.round((presentCount / halfDays.length) * 100)
    return { present: presentCount, total: halfDays.length, complete: presentCount === halfDays.length, percentage }
  }
  
  // Vérifier si le stagiaire peut avoir son certificat (100% présence + 100% objectifs)
  const canGetCertificate = (traineeId) => {
    const presence = getTraineeHalfDayStatus(traineeId)
    const objectives = getTraineeObjectiveStatus(traineeId)
    return presence.complete && objectives?.complete
  }
  
  // Obtenir le lieu (Intra = adresse client)
  const getDisplayLocation = () => {
    if (session?.is_intra && session?.clients?.address) {
      return session.clients.address
    }
    return session?.location_name || session?.location || 'À définir'
  }
  
  const handlePresenceChange = async (traineeId, date, present) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const key = `${traineeId}_${dateStr}`
    setPresenceData(prev => ({ ...prev, [key]: present }))
    await upsertAttendance(session.id, traineeId, dateStr, present)
  }
  
  const handleEvalChange = async (traineeId, field, value) => {
    const current = evaluationsData[traineeId] || {}
    // Si on clique sur la même valeur, remettre à null
    const newValue = current[field] === value ? null : value
    const updated = { ...current, [field]: newValue }
    setEvaluationsData(prev => ({ ...prev, [traineeId]: updated }))
    await upsertTraineeEvaluation(session.id, traineeId, { [field]: newValue })
  }
  
  const handleColdEvalChange = async (traineeId, field, value) => {
    const current = coldEvaluationsData[traineeId] || {}
    // Si on clique sur la même valeur, remettre à null
    const newValue = current[field] === value ? null : value
    const updated = { ...current, [field]: newValue }
    setColdEvaluationsData(prev => ({ ...prev, [traineeId]: updated }))
    await upsertColdEvaluation(session.id, traineeId, { [field]: newValue })
  }
  
  const handleTrainerEvalChange = async (field, value) => {
    const trainer = session.trainers
    if (!trainer) return toast.error('Aucun formateur assigné')
    // Si on clique sur la même valeur, remettre à null
    const newValue = trainerEval?.[field] === value ? null : value
    setTrainerEval(prev => ({ ...(prev || {}), [field]: newValue }))
    await upsertTrainerEvaluation(session.id, trainer.id, { [field]: newValue })
  }
  
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { error } = await uploadSessionDocument(session.id, file, uploadCategory)
    if (error) toast.error('Erreur upload')
    else {
      toast.success('Document uploadé')
      const { data } = await fetchSessionDocuments(session.id)
      setSessionDocs(data || [])
    }
    setUploading(false)
    e.target.value = ''
  }
  
  const handleDeleteDoc = async (doc) => {
    if (!confirm('Supprimer ce document ?')) return
    await deleteSessionDocument(doc.id, doc.file_path)
    setSessionDocs(prev => prev.filter(d => d.id !== doc.id))
    toast.success('Document supprimé')
  }
  
  const viewDoc = async (doc) => {
    const url = await getSessionDocumentUrl(doc.file_path)
    if (url) window.open(url, '_blank')
  }
  
  const handleDelete = async () => {
    if (!confirm('Supprimer cette session ?')) return
    await deleteSession(id)
    toast.success('Session supprimée')
    navigate('/sessions')
  }
  
  const handleSaveEdit = async () => {
    try {
      // Mise à jour des infos session
      const { trainer_id, ...sessionData } = editForm
      
      console.log('Saving session with data:', sessionData)
      
      // Si le statut a changé, verrouiller pour empêcher les changements automatiques
      if (sessionData.status !== session.status) {
        sessionData.status_locked = true
      }
      
      const { data, error } = await updateSession(id, sessionData)
      
      if (error) {
        toast.error(`Erreur: ${error.message || 'Modification échouée'}`)
        console.error('Update error:', error)
        return
      }
      
      console.log('Session updated:', data)
      
      // Mise à jour du formateur si changé
      const currentTrainerId = session.trainer_id
      if (trainer_id !== currentTrainerId) {
        // Retirer l'ancien formateur si présent
        if (currentTrainerId) {
          await removeTrainerFromSession(id, currentTrainerId)
        }
        // Ajouter le nouveau formateur si sélectionné
        if (trainer_id) {
          await addTrainerToSession(id, trainer_id)
        }
      }
      
      toast.success('Session modifiée')
      setShowEdit(false)
      
      // Recharger cette session spécifiquement
      const result = await getSession(id)
      if (result.data) setSession(result.data)
    } catch (err) {
      console.error('handleSaveEdit error:', err)
      toast.error('Erreur inattendue lors de la sauvegarde')
    }
  }
  
  const handleAddTrainee = async (traineeId) => {
    const { error } = await addTraineeToSession(id, traineeId)
    if (error) {
      toast.error('Erreur lors de l\'ajout')
      console.error(error)
    } else {
      toast.success('Stagiaire ajouté')
      // Recharger la session pour afficher le stagiaire
      const { data } = await getSession(id)
      if (data) setSession(data)
    }
  }
  
  const handleRemoveTrainee = async (traineeId) => {
    try {
      // Vérifier si le stagiaire a des données associées
      const [infoResult, attendResult, evalResult] = await Promise.all([
        supabase.from('trainee_info_sheets').select('id').eq('session_id', id).eq('trainee_id', traineeId).maybeSingle(),
        supabase.from('attendance_halfdays').select('id').eq('session_id', id).eq('trainee_id', traineeId).limit(1),
        supabase.from('trainee_evaluations').select('id').eq('session_id', id).eq('trainee_id', traineeId).maybeSingle()
      ])
      
      const hasData = infoResult.data || (attendResult.data && attendResult.data.length > 0) || evalResult.data
      
      if (hasData) {
        // Double confirmation pour stagiaire avec données
        if (!confirm('⚠️ Ce stagiaire a déjà des données enregistrées (fiche, émargements ou évaluation).\n\nÊtes-vous sûr de vouloir le retirer ?')) return
        if (!confirm('🚨 ATTENTION : Cette action supprimera TOUTES ses données pour cette session.\n\nConfirmer la suppression définitive ?')) return
      } else {
        // Simple confirmation
        if (!confirm('Retirer ce stagiaire de la session ?')) return
      }
      
      const { error } = await removeTraineeFromSession(id, traineeId)
      if (error) {
        toast.error('Erreur lors du retrait')
      } else {
        toast.success('Stagiaire retiré')
        const { data } = await getSession(id)
        if (data) setSession(data)
      }
    } catch (err) {
      console.error('Erreur vérification données:', err)
      // Fallback : simple confirmation
      if (!confirm('Retirer ce stagiaire de la session ?')) return
      const { error } = await removeTraineeFromSession(id, traineeId)
      if (error) {
        toast.error('Erreur lors du retrait')
      } else {
        toast.success('Stagiaire retiré')
        const { data } = await getSession(id)
        if (data) setSession(data)
      }
    }
  }
  
  // Upload carte FORPREV pour un stagiaire
  const handleUploadForprevCard = async (traineeId, file) => {
    if (!file) return
    
    try {
      toast.loading('Upload en cours...', { id: 'forprev-upload' })
      
      // Upload vers Supabase Storage
      const fileName = `forprev/${session.id}/${traineeId}_${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file)
      
      if (uploadError) throw uploadError
      
      // Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName)
      
      // Mettre à jour session_trainees
      const { error: updateError } = await supabase
        .from('session_trainees')
        .update({ 
          forprev_card_url: urlData.publicUrl,
          forprev_card_sent: false 
        })
        .eq('session_id', session.id)
        .eq('trainee_id', traineeId)
      
      if (updateError) throw updateError
      
      // Recharger la session
      const { data } = await getSession(id)
      if (data) setSession(data)
      
      toast.success('Carte FORPREV uploadée !', { id: 'forprev-upload' })
    } catch (error) {
      console.error('Erreur upload FORPREV:', error)
      toast.error('Erreur lors de l\'upload', { id: 'forprev-upload' })
    }
  }
  
  // ZIP des documents de session
  const [showZipDropdown, setShowZipDropdown] = useState(false)
  const [generatingZip, setGeneratingZip] = useState(false)

  const handleDownloadZip = async () => {
    setGeneratingZip(true)
    setShowZipDropdown(false)
    const toastId = toast.loading('Génération du ZIP en cours...')
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const ref = session?.reference || 'SESSION'
      const trainer = session.trainers
      const traineesWithResult = session.session_trainees?.map(st => ({
        ...st.trainees,
        result: st.result || traineeResults[st.trainee_id] || null,
        access_code: st.access_code
      })) || []

      // 1. Convention (non signée toujours)
      const convention = generatePDF('convention', session, { trainees: traineesWithResult, trainer, costs: sessionCosts })
      if (convention) zip.file(`Convention_${ref}.pdf`, convention.base64, { base64: true })

      // 2. Programme — fichier uploadé en priorité, sinon pdfGenerator
      let programmeAdded = false
      const programUrl = session?.courses?.program_url
      if (programUrl) {
        try {
          const res = await fetch(programUrl)
          if (res.ok) {
            const blob = await res.blob()
            zip.file(`Programme_${ref}.pdf`, blob)
            programmeAdded = true
          }
        } catch { /* fallback pdfGenerator */ }
      }
      if (!programmeAdded) {
        const programme = generatePDF('programme', session, { trainer })
        if (programme) zip.file(`Programme_${ref}.pdf`, programme.base64, { base64: true })
      }

      // 3. Convocations — tous stagiaires dans un seul PDF
      const convocations = await generateAllPDF('convocation', session, traineesWithResult, { trainer })
      if (convocations) {
        zip.file(`Convocations_${ref}.pdf`, convocations.base64, { base64: true })
        await supabase.from('session_trainees').update({ convocation_sent_at: new Date().toISOString() })
          .eq('session_id', session.id).is('convocation_sent_at', null)
      }

      // 4. Fiches de renseignements — titre rempli, juste nom/prénom, reste vierge
      const mergedFiches = await mergeMultiplePDFs(
        traineesWithResult.map(trainee => {
          const fiche = generatePDF('ficheRenseignements', session, {
            trainee: { last_name: trainee.last_name, first_name: trainee.first_name },
            isBlank: false,
            infoSheet: null
          })
          return fiche?.base64 || null
        }).filter(Boolean)
      )
      if (mergedFiches) zip.file(`Fiches_Renseignements_${ref}.pdf`, mergedFiches, { base64: true })

      // 5. Émargement — cartouche rempli, cases vierges (pas de attendanceData)
      const emargement = generatePDF('emargement', session, {
        trainees: traineesWithResult,
        trainer,
        isBlank: false,
        attendanceData: null
      })
      if (emargement) zip.file(`Emargement_${ref}.pdf`, emargement.base64, { base64: true })

      // 6. Éval à chaud — tous stagiaires dans un seul PDF
      const evalChaud = await generateAllPDF('evaluation', session, traineesWithResult, { trainer })
      if (evalChaud) zip.file(`Eval_Chaud_${ref}.pdf`, evalChaud.base64, { base64: true })

      // 7. Éval à froid — vierge
      const evalFroid = generatePDF('evaluationFroid', session, { isBlank: true })
      if (evalFroid) zip.file(`Eval_Froid_${ref}.pdf`, evalFroid.base64, { base64: true })

      // 8. Analyse de besoins
      const analyseBesoin = generatePDF('analyseBesoin', session, { isBlank: false })
      if (analyseBesoin) zip.file(`Analyse_Besoin_${ref}.pdf`, analyseBesoin.base64, { base64: true })

      // 9. Tests de positionnement — rempli si fait, sinon vierge, tous mergés en un seul PDF
      const testParts = []
      for (const trainee of traineesWithResult) {
        const stData = session.session_trainees?.find(st => st.trainee_id === trainee.id)
        if (stData?.positioning_test_completed) {
          try {
            const { data: testData } = await supabase.rpc('get_trainee_positioning_test', {
              p_session_id: session.id,
              p_trainee_id: trainee.id
            })
            if (testData) {
              const testPdf = generatePDF('testPositionnementRempli', session, { trainee, testData })
              if (testPdf) { testParts.push(testPdf.base64); continue }
            }
          } catch { /* fallback vierge */ }
        }
        const testVierge = generatePDF('positionnement', session, { trainee, isBlank: true, questions })
        if (testVierge) testParts.push(testVierge.base64)
      }
      if (testParts.length > 0) {
        const mergedTests = await mergeMultiplePDFs(testParts)
        if (mergedTests) zip.file(`Test_Positionnement_${ref}.pdf`, mergedTests, { base64: true })
      }

      // Télécharger le ZIP
      const content = await zip.generateAsync({ type: 'blob' })
      const url = window.URL.createObjectURL(content)
      const link = document.createElement('a')
      link.href = url
      link.download = `Documents_${ref}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => window.URL.revokeObjectURL(url), 100)

      toast.success('ZIP téléchargé avec succès !', { id: toastId })
    } catch (err) {
      console.error('Erreur génération ZIP:', err)
      toast.error('Erreur lors de la génération du ZIP', { id: toastId })
    } finally {
      setGeneratingZip(false)
    }
  }

  // ZIP rempli — tous les documents avec les données complètes
  const handleDownloadZipFilled = async () => {
    setGeneratingZip(true)
    setShowZipDropdown(false)
    const toastId = toast.loading('Génération du ZIP en cours...')
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const ref = session?.reference || 'SESSION'
      const trainer = session.trainers
      const traineesWithResult = session.session_trainees?.map(st => ({
        ...st.trainees,
        result: st.result || traineeResults[st.trainee_id] || null,
        access_code: st.access_code
      })) || []

      // 1. Convention — signée si uploadée, sinon générée
      if (session.convention_signed_file_url) {
        try {
          const { data: convBlob, error: convErr } = await supabase.storage
            .from('signed-conventions')
            .download(session.convention_signed_file_url)
          if (!convErr && convBlob) { zip.file(`Convention_${ref}.pdf`, convBlob) }
        } catch { /* fallback */ }
      }
      if (!zip.file(`Convention_${ref}.pdf`)) {
        const convention = generatePDF('convention', session, { trainees: traineesWithResult, trainer, costs: sessionCosts })
        if (convention) zip.file(`Convention_${ref}.pdf`, convention.base64, { base64: true })
      }

      // 2. Programme — fichier uploadé en priorité, sinon pdfGenerator
      let programmeAdded = false
      const programUrl = session?.courses?.program_url
      if (programUrl) {
        try {
          const res = await fetch(programUrl)
          if (res.ok) {
            const blob = await res.blob()
            zip.file(`Programme_${ref}.pdf`, blob)
            programmeAdded = true
          }
        } catch { /* fallback pdfGenerator */ }
      }
      if (!programmeAdded) {
        const programme = generatePDF('programme', session, { trainer })
        if (programme) zip.file(`Programme_${ref}.pdf`, programme.base64, { base64: true })
      }

      // 3. Convocations
      const convocations = await generateAllPDF('convocation', session, traineesWithResult, { trainer })
      if (convocations) {
        zip.file(`Convocations_${ref}.pdf`, convocations.base64, { base64: true })
        await supabase.from('session_trainees').update({ convocation_sent_at: new Date().toISOString() })
          .eq('session_id', session.id).is('convocation_sent_at', null)
      }

      // 4. Fiches de renseignements — remplies avec infoSheet
      const fichesParts = []
      for (const trainee of traineesWithResult) {
        const fiche = generatePDF('ficheRenseignements', session, {
          trainee,
          isBlank: false,
          infoSheet: infoSheets[trainee.id] || null
        })
        if (fiche) fichesParts.push(fiche.base64)
      }
      if (fichesParts.length > 0) {
        const mergedFiches = await mergeMultiplePDFs(fichesParts)
        if (mergedFiches) zip.file(`Fiches_Renseignements_${ref}.pdf`, mergedFiches, { base64: true })
      }

      // 5. Émargement — rempli avec données de présence
      const [{ data: signatures }, { data: halfDays }, { data: digitalSigs }] = await Promise.all([
        supabase.from('attendances').select('*').eq('session_id', session.id),
        supabase.from('attendance_halfdays').select('*').eq('session_id', session.id),
        supabase.from('document_signatures').select('*').eq('session_id', session.id).eq('document_type', 'emargement').eq('status', 'valid')
      ])
      const hasAttendance = (signatures && signatures.length > 0) || (halfDays && halfDays.length > 0) || (digitalSigs && digitalSigs.length > 0)
      const emargement = generatePDF('emargement', session, {
        trainees: traineesWithResult,
        trainer,
        isBlank: !hasAttendance,
        attendanceData: hasAttendance ? { signatures: signatures || [], halfdays: halfDays || [], digitalSignatures: digitalSigs || [] } : null
      })
      if (emargement) zip.file(`Emargement_${ref}.pdf`, emargement.base64, { base64: true })

      // 6. Éval à chaud — avec réponses des stagiaires
      const evalChaud = await generateAllPDF('evaluation', session, traineesWithResult, { trainer, evaluationsData })
      if (evalChaud) zip.file(`Eval_Chaud_${ref}.pdf`, evalChaud.base64, { base64: true })

      // 7. Éval à froid — vierge (pas de données disponibles)
      const evalFroid = generatePDF('evaluationFroid', session, { isBlank: true })
      if (evalFroid) zip.file(`Eval_Froid_${ref}.pdf`, evalFroid.base64, { base64: true })

      // 8. Analyse de besoins — remplie si existe dans session_needs_analysis, sinon générée
      try {
        const { data: analysisData } = await supabase
          .from('session_needs_analysis')
          .select('*')
          .eq('session_id', session.id)
          .single()
        if (analysisData) {
          const analyseBytes = await getNeedsAnalysisPDFBytes(session, analysisData, false, organization)
          if (analyseBytes) zip.file(`Analyse_Besoin_${ref}.pdf`, analyseBytes)
        }
      } catch { /* fallback */ }
      if (!zip.file(`Analyse_Besoin_${ref}.pdf`)) {
        const analyseBesoin = generatePDF('analyseBesoin', session, { isBlank: false })
        if (analyseBesoin) zip.file(`Analyse_Besoin_${ref}.pdf`, analyseBesoin.base64, { base64: true })
      }

      // 9. Certificats de réalisation
      const certificats = await generateAllPDF('certificat', session, traineesWithResult, { trainer })
      if (certificats) zip.file(`Certificats_${ref}.pdf`, certificats.base64, { base64: true })

      // 10. Attestations de présence
      const attestations = await generateAllPDF('attestation', session, traineesWithResult, { trainer })
      if (attestations) zip.file(`Attestations_${ref}.pdf`, attestations.base64, { base64: true })

      // 11. Tests de positionnement — rempli si fait, sinon vierge
      const testParts = []
      for (const trainee of traineesWithResult) {
        const stData = session.session_trainees?.find(st => st.trainee_id === trainee.id)
        if (stData?.positioning_test_completed) {
          try {
            const { data: testData } = await supabase.rpc('get_trainee_positioning_test', {
              p_session_id: session.id,
              p_trainee_id: trainee.id
            })
            if (testData) {
              const testPdf = generatePDF('testPositionnementRempli', session, { trainee, testData })
              if (testPdf) { testParts.push(testPdf.base64); continue }
            }
          } catch { /* fallback vierge */ }
        }
        const testVierge = generatePDF('positionnement', session, { trainee, isBlank: true, questions })
        if (testVierge) testParts.push(testVierge.base64)
      }
      if (testParts.length > 0) {
        const mergedTests = await mergeMultiplePDFs(testParts)
        if (mergedTests) zip.file(`Test_Positionnement_${ref}.pdf`, mergedTests, { base64: true })
      }

      // 12. Scans uploadés
      if (sessionDocs.length > 0) {
        for (const doc of sessionDocs) {
          if (!doc.file_url) continue
          try {
            const res = await fetch(doc.file_url)
            if (res.ok) {
              const cleanName = doc.file_name?.replace(/^\d+_/, '') || `scan_${doc.id}.pdf`
              zip.file(`Scans/${cleanName}`, await res.blob())
            }
          } catch { /* skip ce doc */ }
        }
      }

      // Télécharger le ZIP
      const content = await zip.generateAsync({ type: 'blob' })
      const url = window.URL.createObjectURL(content)
      const link = document.createElement('a')
      link.href = url
      link.download = `Documents_Remplis_${ref}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => window.URL.revokeObjectURL(url), 100)

      toast.success('ZIP rempli téléchargé avec succès !', { id: toastId })
    } catch (err) {
      console.error('Erreur génération ZIP rempli:', err)
      toast.error('Erreur lors de la génération du ZIP', { id: toastId })
    } finally {
      setGeneratingZip(false)
    }
  }

  // Helper : merger plusieurs PDFs base64 en un seul via pdf-lib
  const mergeMultiplePDFs = async (base64Array) => {
    try {
      const { PDFDocument } = await import('pdf-lib')
      const merged = await PDFDocument.create()
      for (const b64 of base64Array) {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
        const pdf = await PDFDocument.load(bytes)
        const indices = pdf.getPageIndices()
        const copiedPages = await merged.copyPages(pdf, indices)
        copiedPages.forEach(page => merged.addPage(page))
      }
      const out = await merged.save()
      // Convertir Uint8Array en base64
      let binary = ''
      out.forEach(byte => { binary += String.fromCharCode(byte) })
      return btoa(binary)
    } catch (err) {
      console.error('Erreur merge PDF:', err)
      return null
    }
  }

  const handleDownload = async (docType, trainee = null) => {
    const trainer = session.trainers
    const traineesWithResult = session.session_trainees?.map(st => ({ 
      ...st.trainees, 
      result: st.result || traineeResults[st.trainee_id] || null,
      access_code: st.access_code
    })) || []
    
    // Si on télécharge un certificat pour un stagiaire spécifique
    if (docType === 'certificat' && trainee) {
      const stData = session.session_trainees?.find(st => st.trainee_id === trainee.id)
      const result = stData?.result || traineeResults[trainee.id] || null
      
      // Si Non Acquis, ouvrir la modal pour saisir la proposition de remédiation
      if (result === 'not_acquired') {
        openCertificatNonAcquisModal(trainee)
        return
      }
      
      // Pour les Acquis, télécharger directement
      const enrichedTrainee = { ...trainee, result }
      downloadDocument(docType, session, { trainee: enrichedTrainee, trainer })
      toast.success('Certificat généré')
      return
    }
    
    // Pour le programme : utiliser le fichier uploadé sur la formation si disponible
    if (docType === 'programme') {
      const programUrl = session?.courses?.program_url
      if (programUrl) {
        try {
          const response = await fetch(programUrl)
          if (!response.ok) throw new Error('Erreur réseau')
          const blob = await response.blob()
          const blobUrl = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = blobUrl
          link.download = `Programme_${session?.reference || 'formation'}.pdf`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100)
          toast.success('Programme téléchargé')
        } catch {
          window.open(programUrl, '_blank')
        }
        return
      }
      // Aucun programme uploadé → on fall back sur la génération pdfGenerator
    }

    // Pour les autres documents
    let enrichedTrainee = trainee
    if (trainee) {
      const stData = session.session_trainees?.find(st => st.trainee_id === trainee.id)
      enrichedTrainee = { ...trainee, result: stData?.result || traineeResults[trainee.id] || null, access_code: stData?.access_code || trainee.access_code || null }
    }
    
    // Ajouter les coûts pour la convention
    const costs = docType === 'convention' ? sessionCosts : []
    
    // Ajouter l'infoSheet pour la fiche de renseignements
    const options = { trainees: traineesWithResult, trainee: enrichedTrainee, trainer, questions, costs }
    if (docType === 'ficheRenseignements' && trainee) {
      console.log('=== handleDownload DEBUG ficheRenseignements ===')
      console.log('trainee.id:', trainee.id)
      console.log('infoSheets:', infoSheets)
      console.log('infoSheets[trainee.id]:', infoSheets[trainee.id])
      options.infoSheet = infoSheets[trainee.id] || null
      console.log('options.infoSheet final:', options.infoSheet)
    }
    
    // Ajouter les données d'émargement pour le PDF émargement
    if (docType === 'emargement') {
      const [{ data: signatures }, { data: halfDays }, { data: digitalSigs }] = await Promise.all([
        supabase.from('attendances').select('*').eq('session_id', session.id),
        supabase.from('attendance_halfdays').select('*').eq('session_id', session.id),
        supabase.from('document_signatures').select('*').eq('session_id', session.id).eq('document_type', 'emargement').eq('status', 'valid')
      ])
      options.attendanceData = { signatures: signatures || [], halfdays: halfDays || [], digitalSignatures: digitalSigs || [] }
    }

    downloadDocument(docType, session, options)
    toast.success('Document généré')

    // Marquer convocation_sent_at si c'est une convocation
    if (docType === 'convocation' && trainee) {
      await supabase.from('session_trainees').update({ convocation_sent_at: new Date().toISOString() })
        .eq('session_id', session.id).eq('trainee_id', trainee.id).is('convocation_sent_at', null)
    }
  }
  
  const handleDownloadAll = async (docType) => {
    const trainer = session.trainers
    const traineesWithResult = session.session_trainees?.map(st => ({ 
      ...st.trainees, 
      result: st.result || traineeResults[st.trainee_id] || null,
      access_code: st.access_code
    })) || []
    await downloadAllDocuments(docType, session, traineesWithResult, { trainer, questions })
    toast.success('Documents générés')

    // Marquer convocation_sent_at pour tous les stagiaires
    if (docType === 'convocation') {
      await supabase.from('session_trainees').update({ convocation_sent_at: new Date().toISOString() })
        .eq('session_id', session.id).is('convocation_sent_at', null)
    }
  }
  
  // Télécharger le programme uploadé depuis course_documents
  const downloadUploadedProgramme = async (courseId) => {
    try {
      // Récupérer le programme depuis course_documents
      const { data, error } = await supabase
        .from('course_documents')
        .select('*')
        .eq('course_id', courseId)
        .eq('type', 'programme')
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error) {
        console.error('Erreur Supabase:', error)
        toast.error('Erreur lors de la récupération du programme')
        return
      }
      
      if (!data || data.length === 0) {
        toast.error('Programme non trouvé. Veuillez l\'uploader dans Documents de formations.')
        return
      }
      
      const programme = data[0]
      console.log('Programme trouvé:', programme.file_name, programme.file_url)
      
      // Méthode 1: Fetch + Blob (contourne les blocages popup)
      try {
        const response = await fetch(programme.file_url)
        if (!response.ok) throw new Error('Erreur réseau')
        
        const blob = await response.blob()
        const blobUrl = window.URL.createObjectURL(blob)
        
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = programme.file_name || 'programme.pdf'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Nettoyer l'URL blob
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100)
        
        console.log('✅ Programme téléchargé:', programme.file_name)
        
      } catch (fetchError) {
        // Fallback: ouverture directe dans nouvel onglet
        console.warn('Fetch échoué, fallback vers ouverture directe:', fetchError)
        window.open(programme.file_url, '_blank')
      }
      
    } catch (err) {
      console.error('Erreur téléchargement programme:', err)
      toast.error('Erreur lors du téléchargement du programme')
    }
  }
  
  // Ouvrir modal email "Avant formation"
  const handleSendEmailBefore = () => {
    setSessionEmailType('before')
    setShowSessionEmailModal(true)
  }
  
  // Ouvrir modal email "Après formation"
  const handleSendEmailAfter = () => {
    setSessionEmailType('after')
    setShowSessionEmailModal(true)
  }
  
  // Envoyer relance évaluations à chaud aux non-répondants
  const handleSendHotEvalReminder = async () => {
    // Identifier les stagiaires qui n'ont pas répondu
    const nonRespondants = sessionTraineesForEvals.filter(t => {
      const eval_ = evaluationsData[t.id] || {}
      return !eval_.questionnaire_submitted && t.email // A un email mais n'a pas répondu
    })
    
    if (nonRespondants.length === 0) {
      toast.error('Tous les stagiaires avec email ont déjà répondu')
      return
    }
    
    // Confirmer l'envoi
    const confirm = window.confirm(
      `Envoyer un email de relance à ${nonRespondants.length} stagiaire(s) qui n'ont pas encore rempli leur évaluation à chaud ?\n\n` +
      nonRespondants.map(t => `• ${t.first_name} ${t.last_name}`).join('\n')
    )
    
    if (!confirm) return
    
    setSendingHotEvalReminder(true)
    
    try {
      // Récupérer la config email de l'utilisateur
      const { data: { user } } = await supabase.auth.getUser()
      const { data: emailConfig } = await supabase
        .from('user_email_configs')
        .select('email')
        .eq('user_id', user.id)
        .maybeSingle()
      
      const fromEmail = emailConfig?.email || 'contact@accessformation.pro'
      
      let successCount = 0
      let errorCount = 0
      
      // Envoyer un email à chaque non-répondant
      for (const trainee of nonRespondants) {
        try {
          // Récupérer le access_code depuis session_trainees
          const { data: sessionTrainee } = await supabase
            .from('session_trainees')
            .select('access_code')
            .eq('session_id', session.id)
            .eq('trainee_id', trainee.id)
            .single()
          
          const accessCode = sessionTrainee?.access_code
          
          if (!accessCode) {
            console.error(`Pas d'access_code pour ${trainee.first_name} ${trainee.last_name}`)
            errorCount++
            continue
          }
          
          const evalLink = `${window.location.origin}/#/portail/${accessCode}/evaluation`
          
          const subject = `Rappel : Évaluation de la formation ${session.courses?.title || ''}`
          const body = `Bonjour ${trainee.first_name},

Suite à la formation "${session.courses?.title || ''}" du ${format(new Date(session.start_date), 'dd/MM/yyyy', { locale: fr })}, nous n'avons pas encore reçu votre évaluation à chaud.

Votre retour est très important pour nous permettre d'améliorer continuellement la qualité de nos formations.

Merci de bien vouloir prendre quelques minutes pour compléter l'évaluation en cliquant sur le lien ci-dessous :

${evalLink}

Nous vous remercions par avance pour votre contribution.

Cordialement,
${trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Access Formation'}`
          
          // Envoyer l'email via l'API
          const { error: sendError } = await supabase.functions.invoke('send-email-session', {
            body: {
              to: trainee.email,
              from: fromEmail,
              subject,
              body,
              attachments: []
            }
          })
          
          if (sendError) {
            console.error(`Erreur envoi à ${trainee.email}:`, sendError)
            errorCount++
          } else {
            successCount++
          }
        } catch (error) {
          console.error(`Erreur pour ${trainee.first_name} ${trainee.last_name}:`, error)
          errorCount++
        }
      }
      
      // Message de résultat
      if (successCount > 0) {
        toast.success(`${successCount} email(s) de relance envoyé(s) !`)
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} erreur(s) lors de l'envoi`)
      }
      
    } catch (error) {
      console.error('Erreur relance évaluations:', error)
      toast.error('Erreur lors de l\'envoi des relances')
    } finally {
      setSendingHotEvalReminder(false)
    }
  }
  
  // Créer un nouveau stagiaire depuis la session
  const handleCreateNewTrainee = async () => {
    if (!newTraineeForm.first_name || !newTraineeForm.last_name) {
      toast.error('Nom et prénom obligatoires')
      return
    }
    
    // Créer le stagiaire
    const { data: newTrainee, error } = await supabase
      .from('trainees')
      .insert({
        first_name: newTraineeForm.first_name,
        last_name: newTraineeForm.last_name,
        email: newTraineeForm.email || null,
        phone: newTraineeForm.phone || null,
        client_id: newTraineeForm.client_id || session?.client_id || null,
        gender: newTraineeForm.gender || 'male'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating trainee:', error)
      toast.error('Erreur lors de la création du stagiaire')
      return
    }
    
    // Ajouter le stagiaire à la session
    await addTraineeToSession(session.id, newTrainee.id)
    
    // Recharger la session
    const { data } = await getSession(id)
    if (data) setSession(data)
    
    // Réinitialiser le formulaire
    setNewTraineeForm({ first_name: '', last_name: '', email: '', phone: '', client_id: '', gender: 'male' })
    setShowNewTraineeModal(false)
    toast.success(`${newTrainee.first_name} ${newTrainee.last_name} créé et ajouté à la session`)
  }
  
  const copyAttendanceLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/#/portail/${session.attendance_token}`)
    toast.success('Lien copié !')
  }
  
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  if (!session) return <div className="text-center py-12"><p className="text-gray-500">Session non trouvée</p><Link to="/sessions" className="text-primary-600 hover:underline mt-2 inline-block">Retour</Link></div>
  
  const sessionTrainees = session.session_trainees?.map(st => ({ 
    ...st.trainees, 
    status: st.status, 
    result: st.result || traineeResults[st.trainee_id] || null,
    presence_complete: st.presence_complete,
    early_departure: st.early_departure
  })) || []
  
  // Liste filtrée pour les évaluations (seulement les présents)
  const sessionTraineesForEvals = sessionTrainees.filter(t => t.presence_complete === true)
  
  // Détecter si c'est une formation SST
  const isSST = session?.courses?.title?.toLowerCase().includes('sst') || 
                session?.courses?.title?.toLowerCase().includes('secouriste') ||
                session?.courses?.title?.toLowerCase().includes('sauveteur')
  
  const enrolledTraineeIds = sessionTrainees.map(t => t.id)
  let availableTrainees = trainees.filter(t => !enrolledTraineeIds.includes(t.id))
  if (traineeFilterClient) availableTrainees = availableTrainees.filter(t => t.client_id === traineeFilterClient)
  if (traineeSearch) {
    const searchLower = traineeSearch.toLowerCase()
    availableTrainees = availableTrainees.filter(t => 
      `${t.first_name} ${t.last_name}`.toLowerCase().includes(searchLower) ||
      t.email?.toLowerCase().includes(searchLower)
    )
  }
  const trainer = session.trainers
  const sessionDays = getSessionDays()
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link to="/sessions" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"><ArrowLeft className="w-4 h-4" />Retour</Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{session.reference}</h1>
            <span className={`badge ${statusLabels[session.status]?.class}`}>{statusLabels[session.status]?.label}</span>
            {session.is_intra && <span className="badge bg-purple-100 text-purple-700 flex items-center gap-1"><Home className="w-3 h-3" />Intra</span>}
            
            {/* Suivi Convention - inline */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-3">
              {session.convention_sent && (
                <span className="badge bg-blue-100 text-blue-700 flex items-center gap-1">
                  <Send className="w-3 h-3" />Envoyée
                </span>
              )}
              {session.convention_signed && (
                <span className="badge bg-green-100 text-green-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />Signée
                </span>
              )}
              {!session.convention_sent && !session.convention_signed && (
                <span className="badge bg-gray-100 text-gray-600 text-xs">
                  Convention en attente
                </span>
              )}
            </div>
          </div>
          <p className="text-gray-600 mt-1">{session.courses?.title}</p>
          <p className="text-gray-500 text-sm">{session.clients?.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {/* Boutons Email */}
          <button onClick={() => handleSendEmailBefore()} className="btn btn-secondary flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
            <Send className="w-4 h-4" />Avant formation
          </button>
          <button onClick={() => handleSendEmailAfter()} className="btn btn-secondary flex items-center gap-2 text-green-600 border-green-200 hover:bg-green-50">
            <Send className="w-4 h-4" />Après formation
          </button>
          <button onClick={() => setShowStageEmailModal(true)} className="btn btn-secondary flex items-center gap-2 text-purple-600 border-purple-200 hover:bg-purple-50">
            <Mail className="w-4 h-4" />Aux stagiaires
          </button>
          <button onClick={() => setShowEdit(true)} className="btn btn-secondary flex items-center gap-2"><Edit className="w-4 h-4" />Modifier</button>
          <button onClick={handleDelete} className="btn btn-danger"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      
      {/* Bannière création facture — après envoi "Après formation" */}
      {showInvoicePrompt && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center"><Receipt className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="font-semibold text-green-900">Documents après formation envoyés !</p>
              <p className="text-sm text-green-700">Créer la facture pour cette session ?</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInvoicePrompt(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Plus tard</button>
            <button onClick={() => navigate(`/factures?from_session=${session.id}`)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Créer la facture
            </button>
          </div>
        </div>
      )}

      {/* Bannière persistante — session terminée sans facture (hors Sellsy) */}
      {!showInvoicePrompt && session.status === 'completed' && sessionHasInvoice === false && !(session.notes || '').includes('Sellsy') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Formation terminée — aucune facture créée pour cette session
          </p>
          <button onClick={() => navigate(`/factures?from_session=${session.id}`)}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Créer la facture
          </button>
        </div>
      )}

      {/* Infos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2"><Calendar className="w-4 h-4" />Dates</h3>
          <p className="text-sm text-gray-600">{format(new Date(session.start_date), 'd MMM yyyy', { locale: fr })}{session.end_date !== session.start_date && ` - ${format(new Date(session.end_date), 'd MMM yyyy', { locale: fr })}`}</p>
          <p className="text-sm text-gray-500">{session.start_time} - {session.end_time}</p>
        </div>
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" />Lieu</h3>
          <p className="text-sm text-gray-600">{getDisplayLocation()}</p>
          {session.is_intra && <p className="text-xs text-purple-600 mt-1">(Chez le client)</p>}
        </div>
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2"><Users className="w-4 h-4" />Effectif</h3>
          <p className="text-sm text-gray-600">{sessionTrainees.length} stagiaire(s)</p>
        </div>
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2"><UserCheck className="w-4 h-4" />Formateur</h3>
          <p className="text-sm text-gray-600">{trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Non assigné'}</p>
        </div>
      </div>
      
      {/* Suivi Convention */}
      <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-blue-600" />
            Suivi Convention
          </h3>
          {session.convention_signed && (
            <span className="badge bg-green-100 text-green-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />Signée
            </span>
          )}
        </div>
        
        <div className="space-y-3">
          {/* Convention envoyée */}
          <label className="flex items-center gap-3 p-2 rounded hover:bg-white/50 transition-colors">
            <input
              type="checkbox"
              checked={session.convention_sent || false}
              onChange={(e) => handleConventionSent(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-700">Convention envoyée</span>
              {session.convention_sent_date && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">
                    Le {format(new Date(session.convention_sent_date), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                  </p>
                  <button
                    onClick={editConventionSentDate}
                    className="text-blue-600 hover:text-blue-800 text-xs underline"
                    title="Modifier la date/heure"
                  >
                    Modifier
                  </button>
                </div>
              )}
            </div>
          </label>
          
          {/* Upload convention signée */}
          <div className="border-t border-blue-200 pt-3">
            {!session.convention_signed ? (
              <div>
                <label className="btn btn-primary btn-sm w-full flex items-center justify-center gap-2 cursor-pointer">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleUploadConvention}
                    className="hidden"
                    disabled={uploadingConvention}
                  />
                  {uploadingConvention ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Upload en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Uploader convention signée (PDF)
                    </>
                  )}
                </label>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Le fichier sera automatiquement marqué comme signé
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
                  <CheckCircle2 className="w-4 h-4" />
                  <div className="flex-1">
                    <span className="font-medium">Convention signée reçue</span>
                    {session.convention_signed_date && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-green-600">
                          Le {format(new Date(session.convention_signed_date), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                        </p>
                        <button
                          onClick={editConventionSignedDate}
                          className="text-green-700 hover:text-green-900 text-xs underline"
                          title="Modifier la date/heure"
                        >
                          Modifier
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDownloadConvention}
                  className="btn btn-secondary btn-sm w-full flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Télécharger la convention signée
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Analyse du besoin */}
      <div className="card">
        <SessionNeedsAnalysis 
          session={session} 
          organization={organization}
        />
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-2 sm:gap-4 overflow-x-auto pb-px -mb-px">
          {[
            { id: 'overview', label: 'Stagiaires' },
            { id: 'presence', label: 'Présence' },
            { id: 'objectifs', label: 'Validation objectifs' },
            { id: 'suivi', label: 'Évaluations' },
            { id: 'materiel', label: '📦 Matériel' },
            { id: 'costs', label: 'Coûts supplémentaires' },
            { id: 'funding', label: `💰 Financement${sessionFundings.length > 0 ? ` (${sessionFundings.length})` : ''}` },
            { id: 'documents', label: 'Documents' },
            ...(isSST ? [{ id: 'sst_certification', label: '🏥 Certification SST' }] : []),
            { id: 'positionnement', label: 'Test positionnement' },
            { id: 'scans', label: 'Scans uploadés' },
            { id: 'attendance', label: 'QR Émargement' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 pt-2 px-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
          ))}
        </nav>
      </div>
      
      {/* TAB: Stagiaires */}
      {activeTab === 'overview' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Stagiaires ({sessionTrainees.length})</h3>
            <div className="flex gap-2">
              <button onClick={() => setShowAddTrainee(true)} className="btn btn-secondary flex items-center gap-2"><UserPlus className="w-4 h-4" />Ajouter existant</button>
              <button onClick={() => { setNewTraineeForm({ ...newTraineeForm, client_id: session?.client_id || '' }); setShowNewTraineeModal(true) }} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Créer nouveau</button>
            </div>
          </div>
          {sessionTrainees.length === 0 ? <p className="text-gray-500 text-center py-8">Aucun stagiaire</p> : (
            <div className="divide-y">
              {sessionTrainees.map(t => {
                const stData = session.session_trainees?.find(st => st.trainee_id === t.id)
                const hasForprevCard = stData?.forprev_card_url
                const result = stData?.result
                const hasInfoSheet = infoSheets[t.id]?.filled_at
                
                return (
                  <div key={t.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{t.first_name} {t.last_name}</p>
                        <p className="text-sm text-gray-500">{t.email}</p>
                      </div>
                      {result === 'acquis' && <span className="badge badge-green text-xs">✓ Acquis</span>}
                      {result === 'non_acquis' && <span className="badge badge-red text-xs">✗ Non acquis</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Bouton fiche de renseignement */}
                      <button 
                        onClick={() => {
                          setSelectedTraineeInfo({ trainee: t, info: infoSheets[t.id] || null })
                          setShowInfoSheet(true)
                        }}
                        className={`btn btn-sm flex items-center gap-1 ${hasInfoSheet ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        <FileText className="w-3 h-3" />
                        {hasInfoSheet ? 'Fiche ✓' : 'Fiche'}
                      </button>
                      
                      {/* Bouton test de positionnement */}
                      <button 
                        onClick={async () => {
                          setLoadingPositioningTest(true)
                          try {
                            const { data, error } = await supabase.rpc('get_trainee_positioning_test', {
                              p_session_id: session.id,
                              p_trainee_id: t.id
                            })
                            
                            if (error) throw error
                            
                            setSelectedPositioningTest({ trainee: t, test: data })
                            setShowPositioningTest(true)
                          } catch (err) {
                            console.error('Erreur chargement test:', err)
                            alert('Erreur lors du chargement du test')
                          } finally {
                            setLoadingPositioningTest(false)
                          }
                        }}
                        className={`btn btn-sm flex items-center gap-1 ${
                          stData?.positioning_test_completed 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                        disabled={loadingPositioningTest}
                      >
                        <Target className="w-3 h-3" />
                        {stData?.positioning_test_completed ? 'Test ✓' : 'Test'}
                      </button>
                      
                      {/* Upload carte FORPREV si session SST */}
                      {session.requires_forprev && result === 'acquis' && (
                        <>
                          {hasForprevCard ? (
                            <a 
                              href={stData.forprev_card_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="btn btn-sm bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Carte SST
                            </a>
                          ) : (
                            <label className="btn btn-sm bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center gap-1 cursor-pointer">
                              <Upload className="w-3 h-3" />
                              Carte FORPREV
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*,.pdf"
                                onChange={(e) => handleUploadForprevCard(t.id, e.target.files?.[0])}
                              />
                            </label>
                          )}
                        </>
                      )}
                      <button onClick={() => handleRemoveTrainee(t.id)} className="text-red-600 hover:text-red-800"><UserMinus className="w-4 h-4" /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
          {/* Bandeau FORPREV */}
          {session.requires_forprev && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-green-700 font-medium">🏥 Session FORPREV (SST)</span>
                  {session.forprev_done ? (
                    <span className="badge badge-green text-xs">✓ Cartes générées</span>
                  ) : (
                    <span className="badge badge-amber text-xs">⏳ En attente</span>
                  )}
                </div>
                <a 
                  href="https://www.forprev.fr/connexion" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 hover:underline flex items-center gap-1"
                >
                  Accéder à FORPREV <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-green-600 mt-1">
                Uploadez les cartes SST individuelles pour chaque stagiaire ayant validé la formation.
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* TAB: Présence (demi-journées) */}
      {activeTab === 'presence' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-600" />
                Feuille de présence par demi-journée
              </h3>
              <p className="text-sm text-gray-500">
                Durée formation : {session?.courses?.duration_hours || 7}h = {getHalfDaysCount()} demi-journée(s)
              </p>
            </div>
            {sessionTrainees.length > 0 && getHalfDaysCount() > 0 && (
              <button 
                onClick={handleMarkAllPresent}
                className="btn btn-primary flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Tous présents
              </button>
            )}
          </div>
          
          {sessionTrainees.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun stagiaire inscrit</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium sticky left-0 bg-white">Stagiaire</th>
                    {getHalfDaysList().map((hd, idx) => (
                      <th key={idx} className="text-center py-3 px-2 font-medium min-w-[80px]">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-gray-500">{format(hd.date, 'dd/MM', { locale: fr })}</span>
                          <span className="flex items-center gap-1">
                            {hd.period === 'morning' ? <Sun className="w-3 h-3 text-yellow-500" /> : <Moon className="w-3 h-3 text-blue-500" />}
                            {hd.label}
                          </span>
                        </div>
                      </th>
                    ))}
                    <th className="text-center py-3 px-2 font-medium">Total</th>
                    <th className="text-center py-3 px-2 font-medium">Statut</th>
                    <th className="text-center py-3 px-2 font-medium" title="Signature électronique">✍️</th>
                    <th className="text-center py-3 px-2 font-medium" title="Départ Anticipé">DA</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessionTrainees.map(t => {
                    const status = getTraineeHalfDayStatus(t.id)
                    const stData = session.session_trainees?.find(st => st.trainee_id === t.id)
                    const hasEarlyDeparture = stData?.early_departure
                    return (
                      <tr key={t.id} className={`hover:bg-gray-50 ${hasEarlyDeparture ? 'bg-red-50' : ''}`}>
                        <td className={`py-3 px-2 font-medium sticky left-0 ${hasEarlyDeparture ? 'bg-red-50' : 'bg-white'}`}>
                          <div className="flex items-center gap-2">
                            <span className={hasEarlyDeparture ? 'line-through text-gray-500' : ''}>
                              {t.first_name} {t.last_name?.toUpperCase()}
                            </span>
                            {hasEarlyDeparture && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Abandon</span>
                            )}
                          </div>
                        </td>
                        {getHalfDaysList().map((hd, idx) => {
                          const key = `${t.id}_${hd.dateStr}_${hd.period}`
                          const isPresent = halfDayAttendance[key]
                          return (
                            <td key={idx} className="text-center py-3 px-2">
                              <button
                                onClick={() => handleHalfDayChange(t.id, hd.dateStr, hd.period, !isPresent)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                  isPresent 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                                }`}
                              >
                                {isPresent ? <CheckCircle className="w-5 h-5" /> : <X className="w-4 h-4" />}
                              </button>
                            </td>
                          )
                        })}
                        <td className="text-center py-3 px-2">
                          <span className="font-medium">{status.present}/{status.total}</span>
                        </td>
                        <td className="text-center py-3 px-2">
                          {status.complete ? (
                            <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                              <CheckCircle className="w-4 h-4" /> 100%
                            </span>
                          ) : (
                            <span className="text-orange-600 font-medium">{status.percentage}%</span>
                          )}
                        </td>
                        <td className="text-center py-3 px-2">
                          <SignatureAuditBadge sessionId={session.id} documentType="emargement" traineeId={t.id} />
                        </td>
                        <td className="text-center py-3 px-2">
                          {hasEarlyDeparture ? (
                            <button
                              onClick={() => handleCancelDeparture(t)}
                              className="text-xs text-red-600 hover:text-red-800 underline"
                            >
                              Annuler
                            </button>
                          ) : (
                            <button
                              onClick={() => openDepartureModal(t)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Départ anticipé"
                            >
                              <LogOut className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Note :</strong> La présence à 100% est requise pour valider les objectifs de formation et délivrer le certificat de réalisation.
            </p>
          </div>
        </div>
      )}
      
      {/* TAB: Validation Objectifs */}
      {activeTab === 'objectifs' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Validation des objectifs de formation
              </h3>
              <div className="flex gap-2">
                {objectivesData.length > 0 && sessionTrainees.length > 0 && (
                  <button onClick={handleMarkAllAcquired} className="btn btn-primary flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Tous acquis
                  </button>
                )}
                {objectivesData.length === 0 && sessionTrainees.length > 0 && getObjectivesList().length > 0 && (
                  <button onClick={handleInitObjectives} className="btn btn-primary">
                    Initialiser les objectifs
                  </button>
                )}
              </div>
            </div>
            
            {/* Liste des objectifs de la formation */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-700 mb-2">Objectifs de la formation :</h4>
              {getObjectivesList().length === 0 ? (
                <p className="text-gray-500 italic">Aucun objectif défini. Ajoutez-les dans la fiche formation (un par ligne).</p>
              ) : (
                <ul className="list-disc list-inside space-y-1">
                  {getObjectivesList().map((obj, idx) => (
                    <li key={idx} className="text-sm text-gray-600">{obj}</li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Grille de validation */}
            {sessionTrainees.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun stagiaire inscrit</p>
            ) : objectivesData.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {getObjectivesList().length === 0 
                  ? 'Définissez d\'abord les objectifs dans la fiche formation'
                  : 'Cliquez sur "Initialiser les objectifs" pour commencer la validation'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-2 font-medium">Stagiaire</th>
                      {getObjectivesList().map((obj, idx) => (
                        <th key={idx} className="text-center py-3 px-2 font-medium min-w-[100px]" title={obj}>
                          Obj. {idx + 1}
                        </th>
                      ))}
                      <th className="text-center py-3 px-2 font-medium">Présence</th>
                      <th className="text-center py-3 px-2 font-medium">Résultat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionTrainees.map(trainee => {
                      const objStatus = getTraineeObjectiveStatus(trainee.id)
                      const presStatus = getTraineeHalfDayStatus(trainee.id)
                      const result = traineeResults[trainee.id]
                      const hasFullPresence = presStatus.complete
                      
                      return (
                        <tr key={trainee.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-2">
                            <div className="font-medium">{trainee.first_name} {trainee.last_name?.toUpperCase()}</div>
                          </td>
                          {getObjectivesList().map((obj, idx) => {
                            const objData = objectivesData.find(o => o.trainee_id === trainee.id && o.objective_index === idx)
                            const isValidated = objData?.validated || false
                            
                            return (
                              <td key={idx} className="py-3 px-2">
                                <div className="flex flex-col items-center gap-2">
                                  <button
                                    onClick={() => hasFullPresence && handleToggleObjective(trainee.id, idx, isValidated)}
                                    disabled={!hasFullPresence}
                                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                      !hasFullPresence
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : isValidated 
                                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                    title={!hasFullPresence ? 'Présence 100% requise' : ''}
                                  >
                                    {isValidated ? '✓' : '○'}
                                  </button>
                                  
                                  {/* Commentaire si objectif non acquis */}
                                  {!isValidated && hasFullPresence && (
                                    <textarea
                                      value={objData?.remediation_comment || ''}
                                      onChange={(e) => handleUpdateRemediationComment(trainee.id, idx, e.target.value)}
                                      placeholder="Actions correctives..."
                                      className="w-full min-w-[200px] text-xs px-2 py-1 border border-gray-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-orange-500"
                                      rows={2}
                                      onBlur={(e) => {
                                        if (e.target.value.trim()) {
                                          toast.success('💾 Commentaire sauvegardé', { duration: 1500 })
                                        }
                                      }}
                                    />
                                  )}
                                </div>
                              </td>
                            )
                          })}
                          <td className="text-center py-3 px-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              presStatus.complete 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {presStatus.present}/{presStatus.total} ({presStatus.percentage}%)
                            </span>
                          </td>
                          <td className="text-center py-3 px-2">
                            <div className="flex items-center justify-center gap-2">
                              {result === 'acquired' && (
                                <span className="px-3 py-1 rounded bg-green-500 text-white text-xs font-bold">
                                  ACQUIS
                                </span>
                              )}
                              {result === 'not_acquired' && (
                                <span className="px-3 py-1 rounded bg-red-500 text-white text-xs font-bold">
                                  NON ACQUIS
                                </span>
                              )}
                              {!result && objStatus && (
                                <span className="text-gray-400 text-xs">
                                  {objStatus.validated}/{objStatus.total} obj.
                                </span>
                              )}
                              {/* Bouton forcer le résultat */}
                              <div className="relative group">
                                <button className="text-xs text-gray-400 hover:text-gray-600 px-1" title="Forcer le résultat">
                                  ⚙️
                                </button>
                                <div className="absolute right-0 mt-1 w-32 bg-white border rounded shadow-lg hidden group-hover:block z-10">
                                  <button 
                                    onClick={() => openForceModal(trainee.id, 'acquired')}
                                    className="block w-full text-left px-3 py-2 text-xs hover:bg-green-50 text-green-700"
                                  >
                                    Forcer Acquis
                                  </button>
                                  <button 
                                    onClick={() => openForceModal(trainee.id, 'not_acquired')}
                                    className="block w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-700"
                                  >
                                    Forcer Non Acquis
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Légende */}
            <div className="mt-4 pt-4 border-t text-sm text-gray-500">
              <p><strong>Règle de validation :</strong> Un stagiaire obtient le résultat "Acquis" si tous ses objectifs sont validés ET s'il a été présent à toutes les journées de formation.</p>
              <p className="mt-1 text-xs"><strong>⚙️ Forcer :</strong> Permet de modifier manuellement le résultat en cas d'exception (rattrapage, absence justifiée validée...).</p>
            </div>
          </div>
        </div>
      )}
      
      {/* TAB: Suivi & Évaluations */}
      {activeTab === 'suivi' && (
        <div className="space-y-6">
          {/* Évaluations à chaud - qualité complet */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-orange-600" />Évaluations à chaud (stagiaires)</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Formation : <strong>{session.courses?.title || 'Non définie'}</strong> - Formateur : <strong>{trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Non assigné'}</strong>
                </p>
              </div>
              <button 
                onClick={handleSendHotEvalReminder}
                disabled={sendingHotEvalReminder}
                className="btn btn-secondary flex items-center gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                {sendingHotEvalReminder ? (
                  <><Loader className="w-4 h-4 animate-spin" />Envoi...</>
                ) : (
                  <><Send className="w-4 h-4" />Relancer les non-répondants</>
                )}
              </button>
            </div>
            {sessionTraineesForEvals.length === 0 ? <p className="text-gray-500">Aucun stagiaire avec présence validée</p> : (
              <div className="space-y-4">
                {sessionTraineesForEvals.map(t => {
                  const eval_ = evaluationsData[t.id] || {}
                  const isEnabled = eval_.questionnaire_submitted
                  return (
                    <div key={t.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">{t.first_name} {t.last_name}</span>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={eval_.questionnaire_submitted || false} onChange={(e) => handleEvalChange(t.id, 'questionnaire_submitted', e.target.checked)} className="w-4 h-4 text-orange-600 rounded" />
                          Questionnaire reçu
                        </label>
                      </div>
                      {isEnabled && (
                        <div className="space-y-4 text-sm">
                          {/* Organisation de la formation */}
                          <div>
                            <p className="font-medium text-gray-700 mb-2 text-xs uppercase">Organisation de la formation</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {[
                                { key: 'q_org_documents', label: 'Communication des documents avant la formation' },
                                { key: 'q_org_accueil', label: 'Accueil sur le lieu de la formation' },
                                { key: 'q_org_locaux', label: 'Qualité des locaux (salles, signalétique)' },
                                { key: 'q_org_materiel', label: 'Adéquation des moyens matériels' },
                              ].map(item => (
                                <div key={item.key} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                  <span className="text-xs text-gray-600 flex-1 mr-2">{item.label}</span>
                                  <div className="flex gap-1">
                                    {[1,2,3,4,5].map(n => (
                                      <button key={n} onClick={() => handleEvalChange(t.id, item.key, n)} className={`w-6 h-6 rounded text-xs ${eval_[item.key] === n ? 'bg-orange-500 text-white' : 'bg-white border hover:bg-gray-100'}`} title={['Mauvais','Passable','Moyen','Satisfaisant','Très satisfaisant'][n-1]}>{n}</button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Contenu de la formation */}
                          <div>
                            <p className="font-medium text-gray-700 mb-2 text-xs uppercase">Le contenu de la formation</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {[
                                { key: 'q_contenu_organisation', label: 'Organisation et déroulement' },
                                { key: 'q_contenu_supports', label: 'Qualité des supports pédagogiques' },
                                { key: 'q_contenu_duree', label: 'Durée de la formation' },
                                { key: 'q_contenu_programme', label: 'Respect du programme de formation' },
                              ].map(item => (
                                <div key={item.key} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                  <span className="text-xs text-gray-600 flex-1 mr-2">{item.label}</span>
                                  <div className="flex gap-1">
                                    {[1,2,3,4,5].map(n => (
                                      <button key={n} onClick={() => handleEvalChange(t.id, item.key, n)} className={`w-6 h-6 rounded text-xs ${eval_[item.key] === n ? 'bg-orange-500 text-white' : 'bg-white border hover:bg-gray-100'}`} title={['Mauvais','Passable','Moyen','Satisfaisant','Très satisfaisant'][n-1]}>{n}</button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Intervention de l'animateur */}
                          <div>
                            <p className="font-medium text-gray-700 mb-2 text-xs uppercase">L'intervention de l'animateur</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {[
                                { key: 'q_formateur_pedagogie', label: 'La pédagogie du formateur' },
                                { key: 'q_formateur_expertise', label: 'L\'expertise du formateur (maîtrise du sujet)' },
                                { key: 'q_formateur_progression', label: 'Progression de la formation (rythme)' },
                                { key: 'q_formateur_moyens', label: 'Adéquation des moyens mis à disposition' },
                              ].map(item => (
                                <div key={item.key} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                  <span className="text-xs text-gray-600 flex-1 mr-2">{item.label}</span>
                                  <div className="flex gap-1">
                                    {[1,2,3,4,5].map(n => (
                                      <button key={n} onClick={() => handleEvalChange(t.id, item.key, n)} className={`w-6 h-6 rounded text-xs ${eval_[item.key] === n ? 'bg-orange-500 text-white' : 'bg-white border hover:bg-gray-100'}`} title={['Mauvais','Passable','Moyen','Satisfaisant','Très satisfaisant'][n-1]}>{n}</button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Perception globale */}
                          <div>
                            <p className="font-medium text-gray-700 mb-2 text-xs uppercase">Perception globale</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {[
                                { key: 'q_global_adequation', label: 'Adéquation formation / métier ou secteur' },
                                { key: 'q_global_competences', label: 'Amélioration de vos connaissances' },
                              ].map(item => (
                                <div key={item.key} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                  <span className="text-xs text-gray-600 flex-1 mr-2">{item.label}</span>
                                  <div className="flex gap-1">
                                    {[1,2,3,4,5].map(n => (
                                      <button key={n} onClick={() => handleEvalChange(t.id, item.key, n)} className={`w-6 h-6 rounded text-xs ${eval_[item.key] === n ? 'bg-orange-500 text-white' : 'bg-white border hover:bg-gray-100'}`} title={['Mauvais','Passable','Moyen','Satisfaisant','Très satisfaisant'][n-1]}>{n}</button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                <span className="text-xs text-gray-600 flex-1 mr-2">Recommanderiez-vous cette formation ?</span>
                                <div className="flex gap-1">
                                  <button onClick={() => handleEvalChange(t.id, 'would_recommend', true)} className={`px-3 py-1 rounded text-xs ${eval_.would_recommend === true ? 'bg-green-500 text-white' : 'bg-white border'}`}>Oui</button>
                                  <button onClick={() => handleEvalChange(t.id, 'would_recommend', false)} className={`px-3 py-1 rounded text-xs ${eval_.would_recommend === false ? 'bg-red-500 text-white' : 'bg-white border'}`}>Non</button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Commentaires */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-500">Commentaire général</label>
                              <textarea 
                                className="input text-sm mt-1" 
                                rows={2} 
                                value={eval_.comment_general || ''} 
                                onChange={(e) => handleEvalChange(t.id, 'comment_general', e.target.value)}
                                placeholder="Remarques, suggestions..."
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Projet de formation</label>
                              <textarea 
                                className="input text-sm mt-1" 
                                rows={2} 
                                value={eval_.comment_projet || ''} 
                                onChange={(e) => handleEvalChange(t.id, 'comment_projet', e.target.value)}
                                placeholder="Besoins futurs en formation..."
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          {/* Évaluation formateur */}
          <div className="card">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" />Évaluation par le formateur</h3>
            <p className="text-sm text-gray-500 mb-4">
              Formation : <strong>{session.courses?.title || 'Non définie'}</strong> - Formateur : <strong>{trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Non assigné'}</strong>
            </p>
            {!trainer ? <p className="text-gray-500">Aucun formateur assigné</p> : (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { key: 'group_motivation', label: 'Motivation du groupe' },
                    { key: 'group_level', label: 'Niveau des stagiaires' },
                    { key: 'material_conditions', label: 'Conditions matérielles' },
                    { key: 'organization', label: 'Organisation' },
                    { key: 'documentation', label: 'Documentation fournie' },
                    { key: 'overall_score', label: 'Appréciation globale' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between">
                      <span className="text-sm">{item.label}</span>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(n => (
                          <button key={n} onClick={() => handleTrainerEvalChange(item.key, n)} className={`w-8 h-8 rounded ${trainerEval?.[item.key] === n ? 'bg-amber-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>{n}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium">Commentaires</label>
                  <textarea value={trainerEval?.comments || ''} onChange={(e) => handleTrainerEvalChange('comments', e.target.value)} className="input mt-1" rows={3} placeholder="Observations du formateur..." />
                </div>
              </div>
            )}
          </div>
          
          {/* Évaluations à froid (90 jours) */}
          <div className="card">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><Clock className="w-5 h-5 text-purple-600" />Évaluations à froid (90 jours)</h3>
            <p className="text-sm text-gray-500 mb-4">
              Formation : <strong>{session.courses?.title || 'Non définie'}</strong> - Formateur : <strong>{trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Non assigné'}</strong>
            </p>
            {sessionTraineesForEvals.length === 0 ? <p className="text-gray-500">Aucun stagiaire avec présence validée</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Stagiaire</th>
                      <th className="text-center py-2">Envoyé</th>
                      <th className="text-center py-2">Reçu</th>
                      <th className="text-center py-2">Compétences pratiquées</th>
                      <th className="text-center py-2">Objectifs atteints</th>
                      <th className="text-center py-2">Besoins satisfaits</th>
                      <th className="text-center py-2">Amélioration travail</th>
                      <th className="text-center py-2">Recommande ?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionTraineesForEvals.map(t => {
                      const coldEval = coldEvaluationsData[t.id] || {}
                      const isEnabled = !!coldEval.completed_at
                      return (
                        <tr key={t.id} className="border-b">
                          <td className="py-3 font-medium">{t.first_name} {t.last_name}</td>
                          <td className="text-center py-3">
                            <input type="checkbox" checked={!!coldEval.sent_at} onChange={(e) => handleColdEvalChange(t.id, 'sent_at', e.target.checked ? new Date().toISOString() : null)} className="w-5 h-5 text-purple-600 rounded" />
                          </td>
                          <td className="text-center py-3">
                            <input type="checkbox" checked={!!coldEval.completed_at} onChange={(e) => handleColdEvalChange(t.id, 'completed_at', e.target.checked ? new Date().toISOString() : null)} className="w-5 h-5 text-purple-600 rounded" disabled={!coldEval.sent_at} />
                          </td>
                          <td className="text-center py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleColdEvalChange(t.id, 'skills_applied', 5)} className={`px-2 py-1 rounded text-xs ${coldEval.skills_applied === 5 ? 'bg-green-500 text-white' : 'bg-gray-100'}`} disabled={!isEnabled}>Oui</button>
                              <button onClick={() => handleColdEvalChange(t.id, 'skills_applied', 1)} className={`px-2 py-1 rounded text-xs ${coldEval.skills_applied === 1 ? 'bg-red-500 text-white' : 'bg-gray-100'}`} disabled={!isEnabled}>Non</button>
                            </div>
                          </td>
                          <td className="text-center py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleColdEvalChange(t.id, 'objectives_met', 5)} className={`px-2 py-1 rounded text-xs ${coldEval.objectives_met === 5 ? 'bg-green-500 text-white' : 'bg-gray-100'}`} disabled={!isEnabled}>Oui</button>
                              <button onClick={() => handleColdEvalChange(t.id, 'objectives_met', 1)} className={`px-2 py-1 rounded text-xs ${coldEval.objectives_met === 1 ? 'bg-red-500 text-white' : 'bg-gray-100'}`} disabled={!isEnabled}>Non</button>
                            </div>
                          </td>
                          <td className="text-center py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleColdEvalChange(t.id, 'knowledge_retained', 5)} className={`px-2 py-1 rounded text-xs ${coldEval.knowledge_retained === 5 ? 'bg-green-500 text-white' : 'bg-gray-100'}`} disabled={!isEnabled}>Oui</button>
                              <button onClick={() => handleColdEvalChange(t.id, 'knowledge_retained', 1)} className={`px-2 py-1 rounded text-xs ${coldEval.knowledge_retained === 1 ? 'bg-red-500 text-white' : 'bg-gray-100'}`} disabled={!isEnabled}>Non</button>
                            </div>
                          </td>
                          <td className="text-center py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleColdEvalChange(t.id, 'job_impact', 5)} className={`px-2 py-1 rounded text-xs ${coldEval.job_impact === 5 ? 'bg-green-500 text-white' : 'bg-gray-100'}`} disabled={!isEnabled}>Oui</button>
                              <button onClick={() => handleColdEvalChange(t.id, 'job_impact', 1)} className={`px-2 py-1 rounded text-xs ${coldEval.job_impact === 1 ? 'bg-red-500 text-white' : 'bg-gray-100'}`} disabled={!isEnabled}>Non</button>
                            </div>
                          </td>
                          <td className="text-center py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleColdEvalChange(t.id, 'would_recommend', true)} className={`px-2 py-1 rounded text-xs ${coldEval.would_recommend === true ? 'bg-green-500 text-white' : 'bg-gray-100'}`} disabled={!isEnabled}>Oui</button>
                              <button onClick={() => handleColdEvalChange(t.id, 'would_recommend', false)} className={`px-2 py-1 rounded text-xs ${coldEval.would_recommend === false ? 'bg-red-500 text-white' : 'bg-gray-100'}`} disabled={!isEnabled}>Non</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* TAB: Matériel */}
      {activeTab === 'materiel' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                📦 Checklist Matériel
              </h3>
              <p className="text-sm text-gray-500">
                {sessionTrainees.length} stagiaire(s) inscrit(s) - quantités calculées automatiquement
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={generateEquipmentFromCourse}
                className="btn btn-secondary flex items-center gap-2"
              >
                🔄 Recalculer depuis formation
              </button>
              <button 
                onClick={() => setShowAddEquipmentModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />Ajouter
              </button>
            </div>
          </div>
          
          {sessionEquipment.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">Aucun matériel configuré pour cette session.</p>
              <button 
                onClick={generateEquipmentFromCourse}
                className="btn btn-primary"
              >
                Générer depuis la formation
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Statistiques */}
              <div className="flex gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{sessionEquipment.length}</p>
                  <p className="text-xs text-gray-500">Équipements</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {sessionEquipment.filter(e => e.is_prepared).length}
                  </p>
                  <p className="text-xs text-gray-500">Préparés</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {sessionEquipment.filter(e => !e.is_prepared).length}
                  </p>
                  <p className="text-xs text-gray-500">Restants</p>
                </div>
              </div>
              
              {/* Liste du matériel */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3">Équipement</th>
                      <th className="text-center p-3 w-24">Quantité</th>
                      <th className="text-center p-3 w-32">Préparé</th>
                      <th className="text-center p-3 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sessionEquipment.map(eq => (
                      <tr key={eq.id} className={eq.is_prepared ? 'bg-green-50' : ''}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{eq.equipment_catalog?.name}</span>
                            {eq.equipment_catalog?.is_consumable && (
                              <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Conso.</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {eq.equipment_catalog?.ratio_per_persons 
                              ? `1 pour ${eq.equipment_catalog.ratio_per_persons} pers.`
                              : '1 par session'}
                          </p>
                          {eq.is_prepared && eq.prepared_by && (
                            <p className="text-xs text-green-600 mt-0.5">
                              ✓ par {eq.prepared_by.split('@')[0]} le {format(new Date(eq.prepared_at), 'dd/MM HH:mm')}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-lg">{eq.quantity_required}</span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => toggleEquipmentPrepared(eq.id, !eq.is_prepared)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              eq.is_prepared 
                                ? 'bg-green-500 text-white hover:bg-green-600' 
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {eq.is_prepared ? '✓ Préparé' : 'À préparer'}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              if (confirm('Retirer cet équipement ?')) {
                                removeEquipmentFromSession(eq.id)
                              }
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Bouton tout marquer préparé */}
              {sessionEquipment.some(e => !e.is_prepared) && (
                <button
                  onClick={async () => {
                    const now = new Date().toISOString()
                    for (const eq of sessionEquipment.filter(e => !e.is_prepared)) {
                      await supabase
                        .from('session_equipment')
                        .update({ is_prepared: true, prepared_by: user?.email, prepared_at: now })
                        .eq('id', eq.id)
                    }
                    await loadSessionEquipment(session.id)
                    toast.success('Tout le matériel marqué comme préparé')
                  }}
                  className="btn btn-secondary w-full"
                >
                  ✓ Tout marquer comme préparé
                </button>
              )}
            </div>
          )}
          
          {/* Modal ajouter équipement */}
          {showAddEquipmentModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold">Ajouter un équipement</h3>
                  <button onClick={() => setShowAddEquipmentModal(false)}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                  {Object.entries(
                    equipmentCatalog.reduce((acc, eq) => {
                      if (!acc[eq.theme]) acc[eq.theme] = []
                      acc[eq.theme].push(eq)
                      return acc
                    }, {})
                  ).map(([theme, items]) => (
                    <div key={theme} className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{theme}</p>
                      <div className="space-y-1">
                        {items.map(eq => {
                          const alreadyAdded = sessionEquipment.some(se => se.equipment_id === eq.id)
                          return (
                            <button
                              key={eq.id}
                              onClick={() => !alreadyAdded && addEquipmentToSession(eq.id)}
                              disabled={alreadyAdded}
                              className={`w-full text-left p-2 rounded ${
                                alreadyAdded 
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                  : 'hover:bg-blue-50 cursor-pointer'
                              }`}
                            >
                              <span className="text-sm">{eq.name}</span>
                              {alreadyAdded && <span className="text-xs ml-2">(déjà ajouté)</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* TAB: Coûts supplémentaires */}
      {activeTab === 'costs' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Coûts supplémentaires</h3>
              <p className="text-sm text-gray-500">Frais additionnels à inclure dans la convention</p>
            </div>
            <button 
              onClick={() => setShowAddCost(true)} 
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />Ajouter un coût
            </button>
          </div>
          
          {sessionCosts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun coût supplémentaire</p>
          ) : (
            <div className="space-y-3">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-left py-2 px-3 font-medium">Libellé</th>
                    <th className="text-right py-2 px-3 font-medium">Montant</th>
                    <th className="text-center py-2 px-3 font-medium">Par stagiaire</th>
                    <th className="text-right py-2 px-3 font-medium">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessionCosts.map(cost => {
                    const typeLabel = costTypes.find(t => t.value === cost.cost_type)?.label || cost.cost_type
                    const totalAmount = cost.per_trainee 
                      ? parseFloat(cost.amount) * (sessionTrainees.length || 1)
                      : parseFloat(cost.amount)
                    return (
                      <tr key={cost.id}>
                        <td className="py-2 px-3">
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{typeLabel.split(' ')[0]}</span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium">{cost.label}</div>
                          {cost.notes && <div className="text-xs text-gray-500">{cost.notes}</div>}
                        </td>
                        <td className="py-2 px-3 text-right">{parseFloat(cost.amount).toFixed(2)} €</td>
                        <td className="py-2 px-3 text-center">
                          {cost.per_trainee ? (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              × {sessionTrainees.length} stagiaire{sessionTrainees.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">{totalAmount.toFixed(2)} €</td>
                        <td className="py-2 px-3">
                          <button 
                            onClick={() => handleDeleteCost(cost.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="4" className="py-2 px-3 text-right font-semibold">Total coûts supplémentaires</td>
                    <td className="py-2 px-3 text-right font-bold text-primary-600">{calculateTotalCosts().toFixed(2)} €</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="text-blue-800">
                  💡 Ces coûts seront ajoutés au prix de la formation dans la convention.
                  {session?.total_price && (
                    <span className="block mt-1 font-medium">
                      Total convention : {(parseFloat(session.total_price || 0) + calculateTotalCosts()).toFixed(2)} € HT
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
          
          {/* Modal ajout coût */}
          {showAddCost && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddCost(false)} />
              <div className="relative min-h-full flex items-center justify-center p-4">
                <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold">Ajouter un coût</h3>
                    <button onClick={() => setShowAddCost(false)}><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="label">Type de coût</label>
                      <select 
                        className="input" 
                        value={costForm.cost_type}
                        onChange={(e) => setCostForm({ ...costForm, cost_type: e.target.value })}
                      >
                        {costTypes.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Libellé *</label>
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="Ex: Location extincteurs"
                        value={costForm.label}
                        onChange={(e) => setCostForm({ ...costForm, label: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Montant HT (€) *</label>
                      <input 
                        type="number" 
                        className="input" 
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={costForm.amount}
                        onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="per_trainee" 
                        checked={costForm.per_trainee}
                        onChange={(e) => setCostForm({ ...costForm, per_trainee: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <label htmlFor="per_trainee" className="text-sm">
                        Multiplier par le nombre de stagiaires ({sessionTrainees.length})
                      </label>
                    </div>
                    {costForm.per_trainee && costForm.amount && (
                      <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                        Total calculé : {(parseFloat(costForm.amount) * sessionTrainees.length).toFixed(2)} €
                      </p>
                    )}
                    <div>
                      <label className="label">Notes (optionnel)</label>
                      <textarea 
                        className="input" 
                        rows="2"
                        placeholder="Détails supplémentaires..."
                        value={costForm.notes}
                        onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 p-4 border-t">
                    <button onClick={() => setShowAddCost(false)} className="btn btn-secondary">Annuler</button>
                    <button onClick={handleAddCost} className="btn btn-primary">Ajouter</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* TAB: Financement multi-financeurs */}
      {activeTab === 'funding' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Financement de la session</h3>
              <p className="text-sm text-gray-500">Répartition entre financeurs (OPCO, entreprise, CPF…)</p>
            </div>
            <button 
              onClick={() => { resetFundingForm(); setShowAddFunding(true) }} 
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />Ajouter un financeur
            </button>
          </div>

          {/* Barre de couverture */}
          {(() => {
            const totalHT = getSessionTotalHT()
            const fundingTotal = getFundingTotal()
            const coverage = getFundingCoverage()
            const diff = totalHT - fundingTotal
            const isOver = fundingTotal > totalHT
            const isExact = Math.abs(diff) < 0.01
            return (
              <div className="mb-5 p-4 rounded-lg border bg-gray-50">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">Couverture financière</span>
                  <span className={`font-bold ${isExact ? 'text-green-600' : isOver ? 'text-red-600' : 'text-orange-600'}`}>
                    {fundingTotal.toFixed(2)} € / {totalHT.toFixed(2)} € HT ({coverage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${isExact ? 'bg-green-500' : isOver ? 'bg-red-500' : coverage >= 80 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(coverage, 100)}%` }}
                  />
                </div>
                {!isExact && (
                  <p className={`text-xs mt-1 ${isOver ? 'text-red-600' : 'text-orange-600'}`}>
                    {isOver 
                      ? `⚠️ Surfinancement de ${(fundingTotal - totalHT).toFixed(2)} €` 
                      : `💡 Reste à financer : ${diff.toFixed(2)} € HT`}
                  </p>
                )}
                {isExact && sessionFundings.length > 0 && (
                  <p className="text-xs mt-1 text-green-600">✅ Financement complet</p>
                )}
              </div>
            )
          })()}

          {/* Liste des financeurs */}
          {sessionFundings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun financement renseigné — cliquez sur "Ajouter un financeur" pour commencer</p>
          ) : (
            <div className="space-y-3">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-left py-2 px-3 font-medium">Financeur</th>
                    <th className="text-right py-2 px-3 font-medium">Montant HT</th>
                    <th className="text-center py-2 px-3 font-medium">%</th>
                    <th className="text-left py-2 px-3 font-medium">N° dossier</th>
                    <th className="text-center py-2 px-3 font-medium">Statut</th>
                    <th className="text-center py-2 px-3 font-medium">Facture</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessionFundings.map(funding => {
                    const typeInfo = FUNDER_TYPES.find(t => t.value === funding.funder_type) || FUNDER_TYPES[6]
                    const statusColors = {
                      pending: 'bg-yellow-100 text-yellow-800',
                      invoiced: 'bg-blue-100 text-blue-800',
                      paid: 'bg-green-100 text-green-800',
                      refused: 'bg-red-100 text-red-800',
                      cancelled: 'bg-gray-100 text-gray-500',
                    }
                    const statusLabelsF = {
                      pending: 'En attente',
                      invoiced: 'Facturé',
                      paid: 'Payé',
                      refused: 'Refusé',
                      cancelled: 'Annulé',
                    }
                    return (
                      <tr key={funding.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-1 rounded-full bg-${typeInfo.color}-100 text-${typeInfo.color}-700`}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium">{funding.funder_name}</div>
                          {funding.funder_siret && <div className="text-xs text-gray-400">SIRET: {funding.funder_siret}</div>}
                          {funding.funder_contact_email && <div className="text-xs text-gray-400">{funding.funder_contact_email}</div>}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">{parseFloat(funding.amount_ht).toFixed(2)} €</td>
                        <td className="py-2 px-3 text-center text-gray-500">{funding.percentage ? `${funding.percentage}%` : '—'}</td>
                        <td className="py-2 px-3">
                          {funding.dossier_number ? (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{funding.dossier_number}</span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <select
                            value={funding.status}
                            onChange={(e) => handleFundingStatus(funding.id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${statusColors[funding.status] || ''}`}
                          >
                            <option value="pending">En attente</option>
                            <option value="invoiced">Facturé</option>
                            <option value="paid">Payé</option>
                            <option value="refused">Refusé</option>
                            <option value="cancelled">Annulé</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {funding.invoice_id ? (
                            <Link to={`/invoices?id=${funding.invoice_id}`} className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1">
                              <Receipt className="w-3 h-3" /> Voir
                            </Link>
                          ) : (
                            <button
                              onClick={() => handleGenerateFundingInvoice(funding)}
                              className="text-xs text-primary-600 hover:text-primary-800 flex items-center justify-center gap-1"
                            >
                              <FileText className="w-3 h-3" /> Facturer
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => handleEditFunding(funding)} className="p-1 text-gray-400 hover:text-blue-600" title="Modifier">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteFunding(funding.id)} className="p-1 text-gray-400 hover:text-red-600" title="Supprimer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="2" className="py-2 px-3 text-right font-semibold">Total financements</td>
                    <td className="py-2 px-3 text-right font-bold text-primary-600">{getFundingTotal().toFixed(2)} €</td>
                    <td className="py-2 px-3 text-center font-bold text-primary-600">{getFundingCoverage()}%</td>
                    <td colSpan="4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Quick action : pré-remplir avec le client de la session */}
          {sessionFundings.length === 0 && session?.client_id && (
            <div className="mt-4 flex gap-2 justify-center">
              <button
                onClick={() => {
                  const client = clients.find(c => c.id === session.client_id)
                  if (client) {
                    setFundingForm(prev => ({
                      ...prev,
                      funder_type: 'entreprise',
                      funder_name: client.name,
                      funder_client_id: client.id,
                      funder_siret: client.siret || '',
                      funder_address: [client.address, client.postal_code, client.city].filter(Boolean).join(', '),
                      funder_contact_email: client.contact_email || '',
                      amount_ht: getSessionTotalHT().toFixed(2)
                    }))
                    setShowAddFunding(true)
                  }
                }}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                💡 Pré-remplir avec le client de la session (100%)
              </button>
            </div>
          )}

          {/* Modal ajout/modification financeur */}
          {showAddFunding && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="fixed inset-0 bg-black/50" onClick={() => { setShowAddFunding(false); resetFundingForm() }} />
              <div className="relative min-h-full flex items-center justify-center p-4">
                <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold">
                      {editingFunding ? 'Modifier le financement' : 'Ajouter un financeur'}
                    </h3>
                    <button onClick={() => { setShowAddFunding(false); resetFundingForm() }}><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Type */}
                    <div>
                      <label className="label">Type de financeur *</label>
                      <select
                        className="input"
                        value={fundingForm.funder_type}
                        onChange={(e) => setFundingForm({ ...fundingForm, funder_type: e.target.value })}
                      >
                        {FUNDER_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Lier à un client existant */}
                    {(fundingForm.funder_type === 'opco' || fundingForm.funder_type === 'entreprise') && (
                      <div>
                        <label className="label">Lier à un client existant (optionnel)</label>
                        <select
                          className="input"
                          value={fundingForm.funder_client_id}
                          onChange={(e) => handlePrefillClientFunding(e.target.value)}
                        >
                          <option value="">— Saisie manuelle —</option>
                          {clients.filter(c => c.status === 'active' || c.status === 'client').map(c => (
                            <option key={c.id} value={c.id}>{c.name}{c.siret ? ` (${c.siret})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Nom */}
                    <div>
                      <label className="label">Nom du financeur *</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Ex: OPCO EP, AKTO, Uniformation..."
                        value={fundingForm.funder_name}
                        onChange={(e) => setFundingForm({ ...fundingForm, funder_name: e.target.value })}
                      />
                    </div>

                    {/* Montant : switch % / HT */}
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center gap-3 mb-2">
                        <label className="label mb-0">Mode de saisie :</label>
                        <button
                          type="button"
                          onClick={() => setFundingForm({ ...fundingForm, use_percentage: false })}
                          className={`text-xs px-3 py-1 rounded-full ${!fundingForm.use_percentage ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                        >
                          Montant HT
                        </button>
                        <button
                          type="button"
                          onClick={() => setFundingForm({ ...fundingForm, use_percentage: true })}
                          className={`text-xs px-3 py-1 rounded-full ${fundingForm.use_percentage ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                        >
                          Pourcentage
                        </button>
                      </div>
                      {fundingForm.use_percentage ? (
                        <div>
                          <label className="label">Pourcentage du total session *</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="input"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="50"
                              value={fundingForm.percentage}
                              onChange={(e) => {
                                const pct = e.target.value
                                const totalHT = getSessionTotalHT()
                                setFundingForm({ ...fundingForm, percentage: pct, amount_ht: totalHT > 0 ? (totalHT * parseFloat(pct || 0) / 100).toFixed(2) : '' })
                              }}
                            />
                            <span className="text-sm text-gray-500">%</span>
                          </div>
                          {fundingForm.percentage && getSessionTotalHT() > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              = {(getSessionTotalHT() * parseFloat(fundingForm.percentage) / 100).toFixed(2)} € HT
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="label">Montant HT (€) *</label>
                          <input
                            type="number"
                            className="input"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={fundingForm.amount_ht}
                            onChange={(e) => {
                              const amt = e.target.value
                              const totalHT = getSessionTotalHT()
                              setFundingForm({ ...fundingForm, amount_ht: amt, percentage: totalHT > 0 ? (parseFloat(amt || 0) / totalHT * 100).toFixed(2) : '' })
                            }}
                          />
                          {fundingForm.amount_ht && getSessionTotalHT() > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              = {(parseFloat(fundingForm.amount_ht) / getSessionTotalHT() * 100).toFixed(1)}% du total session
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* N° dossier */}
                    {(fundingForm.funder_type === 'opco' || fundingForm.funder_type === 'cpf' || fundingForm.funder_type === 'pole_emploi') && (
                      <div>
                        <label className="label">N° de dossier</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Référence dossier OPCO / CPF..."
                          value={fundingForm.dossier_number}
                          onChange={(e) => setFundingForm({ ...fundingForm, dossier_number: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Infos contact facturation */}
                    <details className="border rounded-lg">
                      <summary className="p-3 cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                        📧 Coordonnées de facturation (optionnel)
                      </summary>
                      <div className="p-3 pt-0 space-y-3">
                        <div>
                          <label className="label">SIRET</label>
                          <input type="text" className="input" value={fundingForm.funder_siret} onChange={(e) => setFundingForm({ ...fundingForm, funder_siret: e.target.value })} placeholder="N° SIRET" />
                        </div>
                        <div>
                          <label className="label">Nom du contact</label>
                          <input type="text" className="input" value={fundingForm.funder_contact_name} onChange={(e) => setFundingForm({ ...fundingForm, funder_contact_name: e.target.value })} placeholder="Nom du contact" />
                        </div>
                        <div>
                          <label className="label">Email de facturation</label>
                          <input type="email" className="input" value={fundingForm.funder_contact_email} onChange={(e) => setFundingForm({ ...fundingForm, funder_contact_email: e.target.value })} placeholder="email@opco.fr" />
                        </div>
                        <div>
                          <label className="label">Adresse</label>
                          <input type="text" className="input" value={fundingForm.funder_address} onChange={(e) => setFundingForm({ ...fundingForm, funder_address: e.target.value })} placeholder="Adresse de facturation" />
                        </div>
                      </div>
                    </details>

                    {/* Notes */}
                    <div>
                      <label className="label">Notes (optionnel)</label>
                      <textarea
                        className="input"
                        rows="2"
                        placeholder="Informations complémentaires..."
                        value={fundingForm.notes}
                        onChange={(e) => setFundingForm({ ...fundingForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 p-4 border-t">
                    <button onClick={() => { setShowAddFunding(false); resetFundingForm() }} className="btn btn-secondary">Annuler</button>
                    <button onClick={handleAddFunding} className="btn btn-primary">
                      {editingFunding ? 'Modifier' : 'Ajouter'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Documents */}
      {activeTab === 'documents' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Générer des documents</h3>
            {/* Bouton ZIP dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowZipDropdown(!showZipDropdown)}
                disabled={generatingZip}
                className="btn btn-primary flex items-center gap-2"
              >
                {generatingZip ? (
                  <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> Génération...</>
                ) : (
                  <><Archive className="w-4 h-4" /> Télécharger ZIP<ChevronDown className={`w-3 h-3 transition-transform ${showZipDropdown ? 'rotate-180' : ''}`} /></>
                )}
              </button>
              {showZipDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowZipDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    <button
                      onClick={handleDownloadZip}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900">📦 Documents vierges</p>
                      <p className="text-xs text-gray-500 mt-0.5">Tous les docs avec juste les noms — à remplir manuellement</p>
                    </button>
                    <div className="border-t border-gray-100" />
                    <button
                      onClick={handleDownloadZipFilled}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900">📦 Documents remplis</p>
                      <p className="text-xs text-gray-500 mt-0.5">Tous les docs avec les données existantes</p>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {docTypes.map(doc => (
              <div key={doc.id} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <doc.icon className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-sm">{doc.name}</span>
                  {doc.qualiopi && <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">Ind.{doc.qualiopi}</span>}
                </div>
                <div className="mb-2">
                  <SignatureAuditBadge sessionId={session.id} documentType={doc.id} />
                </div>
                {doc.forAll && <button onClick={() => handleDownload(doc.id)} className="btn btn-sm btn-secondary w-full"><Download className="w-3 h-3 mr-1" />Télécharger</button>}
                {doc.forEach && (
                  <div className="space-y-1 relative">
                    <button 
                      onClick={() => setDocSelection({...docSelection, expandedDoc: docSelection.expandedDoc === doc.id ? null : doc.id, selectedTrainees: []})}
                      className="btn btn-sm btn-secondary w-full text-xs flex items-center justify-between"
                    >
                      <span>Sélectionner stagiaires</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${docSelection.expandedDoc === doc.id ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Dropdown stagiaires */}
                    {docSelection.expandedDoc === doc.id && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {/* Tous les stagiaires */}
                        <button
                          onClick={() => {
                            const allIds = sessionTrainees.map(t => t.id)
                            const allSelected = allIds.every(id => docSelection.selectedTrainees.includes(id))
                            setDocSelection({
                              ...docSelection, 
                              selectedTrainees: allSelected ? [] : allIds
                            })
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2 border-b font-medium"
                        >
                          <input 
                            type="checkbox" 
                            checked={sessionTrainees.length > 0 && sessionTrainees.every(t => docSelection.selectedTrainees.includes(t.id))}
                            readOnly
                            className="w-4 h-4 rounded"
                          />
                          Tous les stagiaires ({sessionTrainees.length})
                        </button>
                        
                        {/* Liste des stagiaires */}
                        {sessionTrainees.map(t => (
                          <button
                            key={t.id}
                            onClick={() => {
                              const isSelected = docSelection.selectedTrainees.includes(t.id)
                              setDocSelection({
                                ...docSelection,
                                selectedTrainees: isSelected 
                                  ? docSelection.selectedTrainees.filter(id => id !== t.id)
                                  : [...docSelection.selectedTrainees, t.id]
                              })
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <input 
                              type="checkbox" 
                              checked={docSelection.selectedTrainees.includes(t.id)}
                              readOnly
                              className="w-4 h-4 rounded"
                            />
                            {t.first_name} {t.last_name}
                          </button>
                        ))}
                        
                        {/* Bouton générer */}
                        {docSelection.selectedTrainees.length > 0 && (
                          <div className="sticky bottom-0 bg-white border-t p-2">
                            <button
                              onClick={() => {
                                if (docSelection.selectedTrainees.length === sessionTrainees.length) {
                                  handleDownloadAll(doc.id)
                                } else {
                                  docSelection.selectedTrainees.forEach(traineeId => {
                                    const trainee = sessionTrainees.find(t => t.id === traineeId)
                                    if (trainee) handleDownload(doc.id, trainee)
                                  })
                                }
                                setDocSelection({...docSelection, expandedDoc: null, selectedTrainees: []})
                              }}
                              className="btn btn-sm btn-primary w-full"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Générer ({docSelection.selectedTrainees.length})
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Fermer dropdown si clic ailleurs */}
          {docSelection.expandedDoc && (
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setDocSelection({...docSelection, expandedDoc: null, selectedTrainees: []})}
            />
          )}
        </div>
      )}
      
      {/* TAB: Documents - FICHE DE CONTRÔLE */}
      {activeTab === 'documents' && (
        <div className="card mt-6">
          <div className="flex items-center gap-2 mb-4">
            <FileCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold">Fiche de contrôle formation</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Archivage papier</span>
          </div>
          <SessionChecklist session={session} />
        </div>
      )}
      
      {/* TAB: Test de positionnement */}
      {activeTab === 'positionnement' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><HelpCircle className="w-5 h-5 text-blue-600" />Test de positionnement</h3>
            <div className="flex gap-2">
              {questions.length > 0 && (
                <button 
                  onClick={() => handleDownload('positionnementCorrige')} 
                  className="btn btn-secondary flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Eye className="w-4 h-4" />Corrigé formateur
                </button>
              )}
            </div>
          </div>
          
          {questions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <HelpCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Aucune question configurée pour cette formation.</p>
              <Link to="/tests-positionnement" className="text-primary-600 hover:underline mt-2 inline-block">
                Configurer les questions →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{questions.length} question(s) configurée(s) pour <strong>{session.courses?.title}</strong></p>
              
              {/* Boutons de téléchargement */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800 mb-3">📄 Générer les tests de positionnement</p>
                <div className="flex flex-wrap gap-2 relative">
                  <button 
                    onClick={() => handleDownloadAll('positionnement')} 
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />Tous ({sessionTrainees.length})
                  </button>
                  
                  {/* Dropdown sélection individuelle */}
                  <div className="relative">
                    <button 
                      onClick={() => setDocSelection({...docSelection, expandedDoc: docSelection.expandedDoc === 'positionnement' ? null : 'positionnement', selectedTrainees: []})}
                      className="btn btn-secondary flex items-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      Sélectionner
                      <ChevronDown className={`w-3 h-3 transition-transform ${docSelection.expandedDoc === 'positionnement' ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {docSelection.expandedDoc === 'positionnement' && (
                      <div className="absolute z-20 left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {sessionTrainees.map(t => (
                          <button
                            key={t.id}
                            onClick={() => {
                              const isSelected = docSelection.selectedTrainees.includes(t.id)
                              setDocSelection({
                                ...docSelection,
                                selectedTrainees: isSelected 
                                  ? docSelection.selectedTrainees.filter(id => id !== t.id)
                                  : [...docSelection.selectedTrainees, t.id]
                              })
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <input 
                              type="checkbox" 
                              checked={docSelection.selectedTrainees.includes(t.id)}
                              readOnly
                              className="w-4 h-4 rounded"
                            />
                            {t.first_name} {t.last_name}
                          </button>
                        ))}
                        
                        {docSelection.selectedTrainees.length > 0 && (
                          <div className="sticky bottom-0 bg-white border-t p-2">
                            <button
                              onClick={() => {
                                docSelection.selectedTrainees.forEach(traineeId => {
                                  const trainee = sessionTrainees.find(t => t.id === traineeId)
                                  if (trainee) handleDownload('positionnement', trainee)
                                })
                                setDocSelection({...docSelection, expandedDoc: null, selectedTrainees: []})
                              }}
                              className="btn btn-sm btn-primary w-full"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Générer ({docSelection.selectedTrainees.length})
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Aperçu des questions */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase">Aperçu des questions</p>
                {questions.map((q, idx) => {
                  // Parser les options
                  let options = q.options
                  if (typeof options === 'string') {
                    try { options = JSON.parse(options) } catch { options = [] }
                  }
                  options = options || []
                  const isQCM = q.question_type === 'single_choice' || q.question_type === 'qcm'
                  
                  return (
                    <div key={q.id} className={`border rounded-lg p-3 ${q.critical ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          {isQCM ? 'QCM' : 'Ouverte'}
                        </span>
                        <span className="text-xs text-gray-400">Q{idx + 1}</span>
                        {q.critical && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Critique</span>}
                      </div>
                      <p className="font-medium text-sm">{q.question_text}</p>
                      {isQCM && options.length > 0 && (
                        <div className="mt-2 text-sm text-gray-600 space-y-1">
                          {options.map((opt, optIdx) => (
                            <p key={optIdx} className={q.correct_index === optIdx ? 'text-green-700 font-medium' : ''}>
                              {q.correct_index === optIdx ? '✓' : '○'} {opt}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* TAB: Scans uploadés */}
      {activeTab === 'scans' && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Upload className="w-5 h-5" />Documents scannés</h3>
          <div className="flex gap-3 mb-4">
            <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="input w-48">
              {uploadCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <label className="btn btn-primary flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />{uploading ? 'Upload...' : 'Ajouter un fichier'}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
          {sessionDocs.length === 0 ? <p className="text-gray-500 text-center py-8">Aucun document uploadé</p> : (
            <div className="divide-y">
              {sessionDocs.map(doc => (
                <div key={doc.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{doc.file_name?.replace(/^\d+_/, '') || doc.name || 'Document'}</p>
                    <p className="text-sm text-gray-500">{uploadCategories.find(c => c.id === doc.document_type)?.label || doc.document_type || doc.category} • {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => viewDoc(doc)} className="btn btn-sm btn-ghost"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteDoc(doc)} className="btn btn-sm btn-ghost text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* TAB: QR Code Stagiaires */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* QR Code Unifié - Portail Stagiaire */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary-600" />
              📱 QR Code Stagiaires
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded ml-2">Ind. 8, 11, 30</span>
            </h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="text-center">
                {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code Portail" className="mx-auto mb-4 border-2 border-primary-200 rounded-lg p-3 bg-white" style={{maxWidth: '200px'}} />}
                <p className="text-sm text-gray-600 mb-3 font-medium">Un seul QR code pour tout gérer</p>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/#/portail/${session.attendance_token}`)
                    toast.success('Lien copié !')
                  }} 
                  className="btn btn-primary"
                >
                  <Copy className="w-4 h-4 mr-2" />Copier le lien
                </button>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Flux stagiaire</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 p-2 bg-blue-50 rounded">
                    <span className="bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    <div>
                      <p className="font-medium text-blue-800">Fiche de renseignement</p>
                      <p className="text-xs text-blue-600">1ère connexion uniquement</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                    <span className="bg-green-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    <div>
                      <p className="font-medium text-green-800">Émargement demi-journées</p>
                      <p className="text-xs text-green-600">Matin + Après-midi du jour en cours</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-orange-50 rounded">
                    <span className="bg-orange-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                    <div>
                      <p className="font-medium text-orange-800">Évaluation à chaud</p>
                      <p className="text-xs text-orange-600">Dernier jour uniquement</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-yellow-50 rounded">
                    <span className="bg-yellow-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                    <div>
                      <p className="font-medium text-yellow-800">Avis Google</p>
                      <p className="text-xs text-yellow-600">Redirection automatique</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Document stagiaire pour QR code */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              📄 Document stagiaire (QR code)
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Activez l'accès au livret de formation pour les stagiaires via QR code
            </p>
            <SessionDocumentAccess 
              sessionId={session.id} 
              courseId={session.course_id} 
            />
          </div>

{/* Suivi des présences */}
<div className="card">
  <h3 className="font-semibold mb-4 flex items-center gap-2">
    <CheckCircle className="w-5 h-5 text-green-600" />
    Suivi des présences (via QR code)
  </h3>
  
  {sessionTrainees.length === 0 ? (
    <p className="text-gray-500 text-center py-4">Aucun stagiaire inscrit</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-2">Stagiaire</th>
            <th className="text-center py-2 px-1 w-10" title="Attentes & Observations">💬</th>
            <th className="text-center py-2 px-2">Code</th>
            <th className="text-center py-2 px-2">Fiche</th>
            <th className="text-center py-2 px-2">Éval.</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sessionTrainees.map(t => {
            const stData = session.session_trainees?.find(st => st.trainee_id === t.id)
            const infoSheet = infoSheets[t.id]
            const hasExpectations = infoSheet?.training_expectations && infoSheet.training_expectations.trim().length > 0
            const hasObservation = stData?.admin_observation && stData.admin_observation.trim().length > 0
            return (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="py-2 px-2">
                  <p className="font-medium">{t.first_name} {t.last_name?.toUpperCase()}</p>
                </td>
                <td className="text-center py-2 px-1">
                  <button
                    onClick={() => openExpectationsModal(t)}
                    className={`p-1 rounded transition ${getExpectationsIconColor(t)}`}
                    title={hasExpectations ? (hasObservation ? 'Attentes traitées' : 'Attentes à traiter !') : 'Attentes & Observations'}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </td>
                <td className="text-center py-2 px-2">
                  {accessCodes[t.id] ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className={`font-mono font-bold text-base ${
                        accessCodes[t.id].locked ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {accessCodes[t.id].code}
                      </span>
                      <button
                        onClick={() => handleRegenerateCode(t.id)}
                        className="p-1 hover:bg-gray-100 rounded transition"
                        title="Régénérer le code"
                      >
                        🔄
                      </button>
                      {accessCodes[t.id].locked && (
                        <span className="text-xs text-red-600" title="Compte verrouillé">🔒</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="text-center py-2 px-2">
                  <span className="text-gray-400">-</span>
                </td>
                <td className="text-center py-2 px-2">
                  <span className="text-gray-400">-</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )}
  
  <p className="text-xs text-gray-400 mt-4">
    💡 Les données de présence par demi-journée sont visibles dans l'onglet "Présence".
  </p>
</div>
        </div>
      )}
      
      {/* Modal Ajouter Stagiaire */}
      {showAddTrainee && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setShowAddTrainee(false); setTraineeSearch('') }} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Ajouter des stagiaires</h2>
                <button onClick={() => { setShowAddTrainee(false); setTraineeSearch('') }}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 border-b space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Rechercher un stagiaire..." 
                    className="input w-full pl-10" 
                    value={traineeSearch}
                    onChange={(e) => setTraineeSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <select value={traineeFilterClient} onChange={(e) => setTraineeFilterClient(e.target.value)} className="input w-full">
                  <option value="">Toutes les entreprises</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {availableTrainees.length === 0 ? <p className="text-gray-500 text-center py-4">Aucun stagiaire disponible</p> : (
                  <div className="space-y-2">
                    {availableTrainees.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div>
                          <p className="font-medium">{t.first_name} {t.last_name}</p>
                          <p className="text-sm text-gray-500">{t.clients?.name}</p>
                        </div>
                        <button onClick={() => handleAddTrainee(t.id)} className="btn btn-sm btn-primary"><UserPlus className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Modifier - COMPLET */}
      {showEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowEdit(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                <h2 className="text-lg font-semibold">Modifier la session</h2>
                <button onClick={() => setShowEdit(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date début</label>
                    <input type="date" className="input" value={editForm.start_date} onChange={(e) => setEditForm({...editForm, start_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Date fin</label>
                    <input type="date" className="input" value={editForm.end_date} onChange={(e) => setEditForm({...editForm, end_date: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Heure début</label>
                    <input type="time" className="input" value={editForm.start_time} onChange={(e) => setEditForm({...editForm, start_time: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Heure fin</label>
                    <input type="time" className="input" value={editForm.end_time} onChange={(e) => setEditForm({...editForm, end_time: e.target.value})} />
                  </div>
                </div>
                
                {/* Case Intra */}
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <input 
                    type="checkbox" 
                    id="is_intra" 
                    checked={editForm.is_intra} 
                    onChange={(e) => setEditForm({...editForm, is_intra: e.target.checked})}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                  <label htmlFor="is_intra" className="flex-1">
                    <span className="font-medium flex items-center gap-2"><Home className="w-4 h-4" />Formation Intra</span>
                    <p className="text-sm text-gray-500">La formation se déroule chez le client (adresse client utilisée sur les documents)</p>
                  </label>
                </div>
                
                {/* Lieu - désactivé si Intra */}
                <div>
                  <label className="label">Lieu {editForm.is_intra && <span className="text-purple-600 text-xs ml-2">(Adresse client utilisée)</span>}</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={editForm.is_intra ? (session?.clients?.address || 'Adresse client non renseignée') : editForm.location_name} 
                    onChange={(e) => setEditForm({...editForm, location_name: e.target.value})}
                    disabled={editForm.is_intra}
                  />
                </div>
                
                {/* Formateur */}
                <div>
                  <label className="label">Formateur</label>
                  <select className="input" value={editForm.trainer_id} onChange={(e) => setEditForm({...editForm, trainer_id: e.target.value})}>
                    <option value="">-- Non assigné --</option>
                    {trainers.map(t => (
                      <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="label">Prix total HT (€) - surcharge le prix formation</label>
                  <input type="number" className="input" value={editForm.total_price} onChange={(e) => setEditForm({...editForm, total_price: e.target.value})} placeholder="Laisser vide = prix formation" />
                </div>
                
                {/* Contact pour convocations */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <p className="font-medium text-blue-800 text-sm">📧 Contact & Signataire</p>
                  <div>
                    <label className="label text-xs">Contact convocations</label>
                    <select className="input" value={editForm.contact_id} onChange={(e) => setEditForm({...editForm, contact_id: e.target.value})}>
                      <option value="">Contact générique (entreprise)</option>
                      {(session?.clients?.contacts || []).map(c => (
                        <option key={c.id} value={c.id}>👤 {c.name}{c.role ? ` (${c.role})` : ''}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-0.5">Personne mentionnée sur les convocations</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Signataire convention</label>
                      <input type="text" className="input" value={editForm.signatory_name} onChange={(e) => setEditForm({...editForm, signatory_name: e.target.value})} placeholder="Ex: Frédéric LE REGENT" />
                    </div>
                    <div>
                      <label className="label text-xs">Fonction signataire</label>
                      <input type="text" className="input" value={editForm.signatory_role} onChange={(e) => setEditForm({...editForm, signatory_role: e.target.value})} placeholder="Ex: Dirigeant" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Si vide, le contact ci-dessus sera utilisé comme signataire sur la convention</p>
                </div>
                <div>
                  <label className="label flex items-center gap-2">
                    Statut
                    {session?.status_locked && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">🔒 Forcé</span>}
                  </label>
                  <select className="input" value={editForm.status} onChange={(e) => setEditForm({...editForm, status: e.target.value})}>
                    {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {session?.status_locked 
                      ? '⚠️ Statut verrouillé (pas de changement auto)' 
                      : 'Le statut change automatiquement selon les dates'}
                  </p>
                  {session?.status_locked && (
                    <button 
                      type="button"
                      onClick={async () => {
                        await updateSession(id, { status_locked: false })
                        toast.success('Statut déverrouillé - il suivra les dates automatiquement')
                        const result = await getSession(id)
                        if (result.data) setSession(result.data)
                      }}
                      className="text-xs text-blue-600 hover:underline mt-1"
                    >
                      🔓 Déverrouiller (revenir au mode automatique)
                    </button>
                  )}
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input" rows={3} value={editForm.notes} onChange={(e) => setEditForm({...editForm, notes: e.target.value})} />
                </div>
                
                {/* FORPREV - pour formations SST/secourisme */}
                <div className="col-span-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-medium text-green-800 mb-2">🏥 FORPREV (INRS) - Formations SST</p>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-green-600"
                        checked={editForm.requires_forprev} 
                        onChange={(e) => setEditForm({...editForm, requires_forprev: e.target.checked})}
                      />
                      <span className="text-sm text-gray-700">Formation nécessitant FORPREV</span>
                    </label>
                    {editForm.requires_forprev && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded text-green-600"
                          checked={editForm.forprev_done} 
                          onChange={(e) => setEditForm({...editForm, forprev_done: e.target.checked})}
                        />
                        <span className="text-sm text-gray-700">✓ Cartes générées sur FORPREV</span>
                      </label>
                    )}
                  </div>
                  {editForm.requires_forprev && !editForm.forprev_done && (
                    <p className="text-xs text-orange-600 mt-2">⚠️ Pensez à générer les cartes SST sur le site FORPREV de l'INRS</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
                <button onClick={() => setShowEdit(false)} className="btn btn-secondary">Annuler</button>
                <button onClick={handleSaveEdit} className="btn btn-primary"><Save className="w-4 h-4 mr-2" />Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* MODAL: Forcer le résultat */}
      {showForceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Forcer le résultat
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Vous allez forcer le résultat à <strong className={forceModalData.newResult === 'acquired' ? 'text-green-600' : 'text-red-600'}>
                  {forceModalData.newResult === 'acquired' ? 'ACQUIS' : 'NON ACQUIS'}
                </strong>.
              </p>
              <div>
                <label className="label">Justification (obligatoire)</label>
                <textarea 
                  className="input w-full" 
                  rows={3}
                  placeholder="Ex: Rattrapage effectué le..., Absence justifiée validée par..."
                  value={forceModalData.reason}
                  onChange={(e) => setForceModalData(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>
              <p className="text-xs text-gray-500">
                Cette justification sera enregistrée pour traçabilité mais n'apparaîtra pas sur les documents.
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowForceModal(false)} className="btn btn-secondary">Annuler</button>
              <button onClick={handleConfirmForce} className="btn btn-primary">Confirmer</button>
            </div>
          </div>
        </div>
      )}
      
      {/* MODAL: Certificat Non Acquis */}
      {showCertificatModal && certificatModalData.trainee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-4 border-b bg-red-50">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                Certificat - Résultat NON ACQUIS
              </h3>
              <p className="text-sm text-red-600 mt-1">
                {certificatModalData.trainee?.first_name} {certificatModalData.trainee?.last_name?.toUpperCase()}
              </p>
            </div>
            <div className="p-4 space-y-4">
              {/* Objectifs non validés */}
              <div>
                <label className="label text-red-700">Objectifs non validés :</label>
                <div className="bg-red-50 rounded p-3 space-y-1">
                  {(() => {
                    const traineeObjectives = objectivesData.filter(o => o.trainee_id === certificatModalData.trainee?.id)
                    const failedObjectives = traineeObjectives
                      .filter(o => !o.validated)
                      .map(o => getObjectivesList()[o.objective_index])
                      .filter(Boolean)
                    
                    return failedObjectives.length > 0 ? (
                      failedObjectives.map((obj, idx) => (
                        <p key={idx} className="text-sm text-red-700 flex items-start gap-2">
                          <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {obj}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">Aucun objectif non validé trouvé</p>
                    )
                  })()}
                </div>
              </div>
              
              {/* Proposition de remédiation */}
              <div>
                <label className="label">Proposition pour valider la formation :</label>
                <textarea 
                  className="input w-full" 
                  rows={3}
                  placeholder={`Repasser le module ${session?.courses?.title || 'formation'}`}
                  value={certificatModalData.proposal}
                  onChange={(e) => setCertificatModalData(prev => ({ ...prev, proposal: e.target.value }))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Cette proposition apparaîtra sur le certificat de réalisation.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowCertificatModal(false)} className="btn btn-secondary">Annuler</button>
              <button onClick={handleDownloadCertificatNonAcquis} className="btn btn-primary flex items-center gap-2">
                <Download className="w-4 h-4" />
                Télécharger le certificat
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* MODAL: Email */}
      
      {/* MODAL: Créer nouveau stagiaire */}
      {showNewTraineeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary-600" />
                Créer un nouveau stagiaire
              </h3>
              <p className="text-sm text-gray-500 mt-1">Sera automatiquement ajouté à cette session</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Prénom *</label>
                  <input 
                    type="text"
                    className="input w-full"
                    value={newTraineeForm.first_name}
                    onChange={(e) => setNewTraineeForm(prev => ({ ...prev, first_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Nom *</label>
                  <input 
                    type="text"
                    className="input w-full"
                    value={newTraineeForm.last_name}
                    onChange={(e) => setNewTraineeForm(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input 
                  type="email"
                  className="input w-full"
                  value={newTraineeForm.email}
                  onChange={(e) => setNewTraineeForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input 
                  type="tel"
                  className="input w-full"
                  value={newTraineeForm.phone}
                  onChange={(e) => setNewTraineeForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Genre</label>
                <select
                  className="input w-full"
                  value={newTraineeForm.gender}
                  onChange={(e) => setNewTraineeForm(prev => ({ ...prev, gender: e.target.value }))}
                >
                  <option value="male">Homme</option>
                  <option value="female">Femme</option>
                </select>
              </div>
              <div>
                <label className="label">Entreprise</label>
                <select 
                  className="input w-full"
                  value={newTraineeForm.client_id}
                  onChange={(e) => setNewTraineeForm(prev => ({ ...prev, client_id: e.target.value }))}
                >
                  <option value="">-- Aucune --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowNewTraineeModal(false)} className="btn btn-secondary">Annuler</button>
              <button onClick={handleCreateNewTrainee} className="btn btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Créer et ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fiche de Renseignement */}
      {showInfoSheet && selectedTraineeInfo && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowInfoSheet(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b bg-blue-50">
                <div>
                  <h2 className="text-lg font-semibold">Fiche de renseignement</h2>
                  <p className="text-sm text-gray-600">{selectedTraineeInfo.trainee?.first_name} {selectedTraineeInfo.trainee?.last_name?.toUpperCase()}</p>
                </div>
                <button onClick={() => setShowInfoSheet(false)}><X className="w-5 h-5" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {selectedTraineeInfo.info?.filled_at ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Remplie le {format(new Date(selectedTraineeInfo.info.filled_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}</span>
                      {selectedTraineeInfo.info.filled_online && <span className="badge badge-blue text-xs">En ligne</span>}
                    </div>
                    
                    {/* Coordonnées - Section importante */}
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                      <p className="text-xs text-amber-700 font-medium mb-2">📧 Coordonnées pour certificat et Passeport Prévention</p>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Email</p>
                          <p className="font-medium text-sm">{selectedTraineeInfo.info.email || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">N° Sécurité sociale</p>
                          {selectedTraineeInfo.info.ssn_refused ? (
                            <p className="text-sm text-red-600 italic">Refusé par le stagiaire</p>
                          ) : (
                            <p className="font-mono font-medium text-sm">{selectedTraineeInfo.info.ssn || '-'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-gray-500 mb-1">Dernière formation (domaine)</p>
                        <p className="font-medium">{selectedTraineeInfo.info.last_training_year || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-gray-500 mb-1">Plus haut diplôme</p>
                        <p className="font-medium">{selectedTraineeInfo.info.highest_diploma || '-'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-gray-500 mb-1">Consentement RGPD</p>
                        <p className="font-medium">{selectedTraineeInfo.info.rgpd_consent ? '✓ Accepté' : '✗ Non'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Fiche non remplie</p>
                    <p className="text-sm text-gray-400 mt-1">Le stagiaire n'a pas encore rempli sa fiche de renseignement via le QR code</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-2 p-4 border-t">
                <button onClick={() => setShowInfoSheet(false)} className="btn btn-secondary">Fermer</button>
                {selectedTraineeInfo.info?.filled_at && (
                  <button 
                    onClick={() => {
                      downloadDocument('ficheRenseignements', session, { 
                        trainee: selectedTraineeInfo.trainee, 
                        infoSheet: selectedTraineeInfo.info 
                      })
                      toast.success('PDF généré')
                    }}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Télécharger PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Test de positionnement */}
      {showPositioningTest && selectedPositioningTest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPositioningTest(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b bg-indigo-50">
                <div>
                  <h2 className="text-lg font-semibold">🎯 Test de positionnement</h2>
                  <p className="text-sm text-gray-600">{selectedPositioningTest.trainee?.first_name} {selectedPositioningTest.trainee?.last_name?.toUpperCase()}</p>
                </div>
                <button onClick={() => setShowPositioningTest(false)}><X className="w-5 h-5" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {selectedPositioningTest.test?.completed ? (
                  <div className="space-y-6">
                    {/* En-tête complété */}
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        Test complété le {format(new Date(selectedPositioningTest.test.completed_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                      </span>
                    </div>
                    
                    {/* Synthèse intelligente */}
                    {(() => {
                      const answers = selectedPositioningTest.test.answers || []
                      const criticalQuestions = answers.filter(a => a.critical && a.question_type === 'single_choice')
                      const correctCritical = criticalQuestions.filter(a => a.is_correct).length
                      const totalCritical = criticalQuestions.length
                      const failedCritical = criticalQuestions.filter(a => a.is_correct === false)
                      const dontKnow = answers.filter(a => a.selected_option_index === -1)
                      
                      const percentage = totalCritical > 0 ? Math.round((correctCritical / totalCritical) * 100) : 0
                      const color = percentage >= 80 ? 'green' : percentage >= 50 ? 'yellow' : 'red'
                      
                      return (
                        <div className={`bg-${color}-50 border-2 border-${color}-200 rounded-lg p-4`}>
                          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                            <Target className={`w-5 h-5 text-${color}-600`} />
                            Synthèse
                          </h3>
                          
                          <div className="space-y-3">
                            {/* Score questions critiques */}
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Questions critiques</p>
                              <div className="flex items-center gap-3">
                                <div className={`text-3xl font-bold text-${color}-600`}>
                                  {correctCritical}/{totalCritical}
                                </div>
                                <div className={`px-3 py-1 rounded-full text-sm font-medium bg-${color}-100 text-${color}-700`}>
                                  {percentage}%
                                </div>
                              </div>
                            </div>
                            
                            {/* Points de vigilance */}
                            {(failedCritical.length > 0 || dontKnow.length > 0) && (
                              <div className="pt-3 border-t border-gray-200">
                                <p className="text-sm font-medium text-orange-700 mb-2">⚠️ Points de vigilance :</p>
                                <ul className="space-y-2 text-sm">
                                  {failedCritical.map((q, idx) => {
                                    const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                                    return (
                                      <li key={idx} className="flex items-start gap-2">
                                        <span className="text-red-600 font-bold">✗</span>
                                        <div>
                                          <p className="font-medium text-gray-900">{q.question_text}</p>
                                          <p className="text-red-600">Réponse donnée : {options[q.selected_option_index]}</p>
                                          <p className="text-green-600 text-xs">Bonne réponse : {options[q.correct_index]}</p>
                                        </div>
                                      </li>
                                    )
                                  })}
                                  {dontKnow.map((q, idx) => (
                                    <li key={`dk-${idx}`} className="flex items-start gap-2">
                                      <HelpCircle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                      <div>
                                        <p className="font-medium text-gray-700">{q.question_text}</p>
                                        <p className="text-gray-500 italic text-xs">Réponse : "Je ne sais pas"</p>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Points forts */}
                            {correctCritical > 0 && (
                              <div className="pt-3 border-t border-gray-200">
                                <p className="text-sm font-medium text-green-700 mb-2">✅ Points forts :</p>
                                <p className="text-sm text-gray-600">
                                  {correctCritical} question{correctCritical > 1 ? 's critiques maîtrisées' : ' critique maîtrisée'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                    
                    {/* Toutes les questions/réponses */}
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Questions / Réponses</h3>
                      <div className="space-y-4">
                        {selectedPositioningTest.test.answers?.map((answer, idx) => {
                          const options = typeof answer.options === 'string' ? JSON.parse(answer.options) : (answer.options || [])
                          
                          return (
                            <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                              <div className="flex items-start gap-3 mb-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                  {idx + 1}
                                </span>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{answer.question_text}</p>
                                  {answer.critical && (
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                                      Question critique
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* QCM */}
                              {answer.question_type === 'single_choice' && (
                                <div className="ml-9 space-y-2">
                                  {options.map((opt, optIdx) => {
                                    const isSelected = answer.selected_option_index === optIdx
                                    const isCorrect = answer.correct_index === optIdx
                                    
                                    return (
                                      <div 
                                        key={optIdx}
                                        className={`p-2 rounded text-sm ${
                                          isSelected && answer.is_correct ? 'bg-green-100 text-green-800 font-medium' :
                                          isSelected && !answer.is_correct ? 'bg-red-100 text-red-800 font-medium' :
                                          isCorrect ? 'bg-green-50 text-green-700 border border-green-200' :
                                          'bg-white text-gray-600'
                                        }`}
                                      >
                                        {isSelected && '👉 '}
                                        {isCorrect && !isSelected && '✓ '}
                                        {opt}
                                      </div>
                                    )
                                  })}
                                  {answer.selected_option_index === -1 && (
                                    <div className="p-2 rounded text-sm bg-gray-100 text-gray-600 italic">
                                      👉 Je ne sais pas
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Question ouverte */}
                              {answer.question_type === 'open' && (
                                <div className="ml-9 p-3 bg-white rounded border">
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {answer.text_answer || <span className="italic text-gray-400">Non répondu</span>}
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Test de positionnement non complété</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-2 p-4 border-t">
                <button onClick={() => setShowPositioningTest(false)} className="btn btn-secondary">Fermer</button>
                {selectedPositioningTest.test?.completed && (
                  <button 
                    onClick={() => {
                      downloadDocument('testPositionnementRempli', session, { 
                        trainee: selectedPositioningTest.trainee, 
                        testData: selectedPositioningTest.test 
                      })
                      toast.success('PDF généré')
                    }}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Télécharger PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Départ Anticipé */}
      {showDepartureModal && departureTrainee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <LogOut className="w-5 h-5 text-red-600" />
                Départ anticipé
              </h3>
              <button onClick={() => setShowDepartureModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-gray-600">
                Enregistrer le départ anticipé de <strong>{departureTrainee.first_name} {departureTrainee.last_name}</strong>
              </p>
              
              <div>
                <label className="label">Date de départ *</label>
                <input
                  type="date"
                  className="input"
                  value={departureForm.departure_date}
                  onChange={(e) => setDepartureForm({...departureForm, departure_date: e.target.value})}
                  min={session?.start_date}
                  max={session?.end_date}
                />
              </div>
              
              <div>
                <label className="label">Motif du départ *</label>
                <select
                  className="input"
                  value={departureForm.departure_reason}
                  onChange={(e) => setDepartureForm({...departureForm, departure_reason: e.target.value})}
                >
                  <option value="">Sélectionner...</option>
                  <option value="Abandon volontaire">Abandon volontaire</option>
                  <option value="Maladie / Accident">Maladie / Accident</option>
                  <option value="Contrainte professionnelle">Contrainte professionnelle</option>
                  <option value="Contrainte personnelle">Contrainte personnelle</option>
                  <option value="Exclusion">Exclusion</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              
              {departureForm.departure_reason === 'Autre' && (
                <div>
                  <label className="label">Préciser le motif</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Motif personnalisé..."
                    onChange={(e) => setDepartureForm({...departureForm, departure_reason: e.target.value})}
                  />
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowDepartureModal(false)} className="btn btn-secondary">
                Annuler
              </button>
              <button onClick={handleSaveDeparture} className="btn bg-red-600 text-white hover:bg-red-700">
                Enregistrer le départ
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Attentes & Observations */}
      {showExpectationsModal && expectationsModalData.trainee && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowExpectationsModal(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold">Attentes & Observations</h2>
                </div>
                <button onClick={() => setShowExpectationsModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900">
                    {expectationsModalData.trainee.first_name} {expectationsModalData.trainee.last_name?.toUpperCase()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {expectationsModalData.trainee.email}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Attentes du stagiaire
                  </label>
                  <textarea
                    value={expectationsModalData.expectations}
                    onChange={(e) => setExpectationsModalData(prev => ({
                      ...prev,
                      expectations: e.target.value
                    }))}
                    placeholder="Attentes saisies par le stagiaire ou à saisir manuellement..."
                    className="input w-full h-24"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {expectationsModalData.expectations ? 'Modifiable par l\'admin' : 'Aucune attente renseignée'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observation / Adaptation
                  </label>
                  <textarea
                    value={expectationsModalData.observation}
                    onChange={(e) => setExpectationsModalData(prev => ({
                      ...prev,
                      observation: e.target.value
                    }))}
                    placeholder="Réponse aux attentes, adaptation prévue, remarques..."
                    className="input w-full h-24"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
                <button
                  onClick={() => setShowExpectationsModal(false)}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveExpectations}
                  disabled={savingExpectations}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {savingExpectations ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Certification SST */}
      {activeTab === 'sst_certification' && isSST && (
        <SSTCertificationTab
          session={session}
          sessionTrainees={sessionTrainees}
          trainer={trainer}
        />
      )}
      
      {/* Modal Date/Heure pour tracking documents */}
      <DateTimePickerModal
        isOpen={dateTimeModal.isOpen}
        onClose={() => setDateTimeModal({ isOpen: false, type: null, currentDate: null })}
        onSave={handleDateTimeSave}
        title={
          dateTimeModal.type === 'convention_sent' 
            ? 'Date et heure d\'envoi de la convention'
            : 'Date et heure de réception de la convention signée'
        }
        currentDate={dateTimeModal.currentDate}
      />

      {/* Modal Email Session */}
      {showSessionEmailModal && (
        <SessionEmailModal 
          session={session}
          emailType={sessionEmailType}
          sessionCosts={sessionCosts}
          questions={questions}
          traineeResults={traineeResults}
          onClose={async (wasSent) => {
            const wasAfter = sessionEmailType === 'after'
            setShowSessionEmailModal(false)
            setSessionEmailType(null)
            // Recharger la session pour refléter les mises à jour (convention_sent, etc.)
            const { data } = await getSession(id)
            if (data) setSession(data)
            // Si "Après formation" envoyé et pas de facture → proposer
            if (wasAfter && wasSent && !sessionHasInvoice) {
              setShowInvoicePrompt(true)
            }
          }}
        />
      )}

      {showStageEmailModal && (
        <StageEmailModal
          session={session}
          onClose={() => setShowStageEmailModal(false)}
        />
      )}
    </div>
  )
}
