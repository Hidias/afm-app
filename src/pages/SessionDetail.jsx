import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { downloadDocument, downloadAllDocuments, setOrganization } from '../lib/pdfGenerator'
import { 
  ArrowLeft, Calendar, MapPin, Users, Clock, FileText, QrCode, UserPlus, UserMinus,
  Download, CheckCircle, AlertCircle, Copy, ExternalLink, X, Edit, Trash2, Save,
  FileSignature, Send, Upload, Eye, Star, ThumbsUp, ClipboardCheck, UserCheck, HelpCircle, Home, Target,
  Sun, Moon, Plus
} from 'lucide-react'
import { format, eachDayOfInterval, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'

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
  
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showAddTrainee, setShowAddTrainee] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [traineeFilterClient, setTraineeFilterClient] = useState('')
  const [editForm, setEditForm] = useState({})
  
  // Suivi
  const [presenceData, setPresenceData] = useState({})
  const [evaluationsData, setEvaluationsData] = useState({})
  const [coldEvaluationsData, setColdEvaluationsData] = useState({})
  const [trainerEval, setTrainerEval] = useState(null)
  const [sessionDocs, setSessionDocs] = useState([])
  const [uploadCategory, setUploadCategory] = useState('autre')
  const [uploading, setUploading] = useState(false)
  
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
  
  // Modal forçage résultat
  const [showForceModal, setShowForceModal] = useState(false)
  const [forceModalData, setForceModalData] = useState({ traineeId: null, newResult: null, reason: '' })
  
  // Modal certificat Non Acquis
  const [showCertificatModal, setShowCertificatModal] = useState(false)
  const [certificatModalData, setCertificatModalData] = useState({ trainee: null, proposal: '' })
  
  // Propositions de remédiation par stagiaire
  const [remediationProposals, setRemediationProposals] = useState({})
  
  // Modal email
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailModalData, setEmailModalData] = useState({ type: '', email: '', customEmail: '' })
  
  // Modal création nouveau stagiaire
  const [showNewTraineeModal, setShowNewTraineeModal] = useState(false)
  const [newTraineeForm, setNewTraineeForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', client_id: ''
  })
  
  const costTypes = [
    { value: 'material', label: 'Matériel (extincteurs, mannequins, etc.)' },
    { value: 'pedagogical', label: 'Coûts pédagogiques' },
    { value: 'travel', label: 'Déplacement' },
    { value: 'misc', label: 'Divers' },
    { value: 'other', label: 'Autre' }
  ]
  
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchSessions(), fetchTrainees(), fetchTrainers(), fetchClients(), fetchOrganization()])
      setLoading(false)
    }
    loadData()
  }, [])
  
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
      
      const attendanceUrl = `${window.location.origin}/emargement/${found.attendance_token}`
      QRCode.toDataURL(attendanceUrl, { width: 256, margin: 2 }).then(setQrCodeUrl)
      
      const currentTrainer = found.trainer_id || ''
      
      setEditForm({
        start_date: found.start_date,
        end_date: found.end_date,
        start_time: found.start_time || '09:00',
        end_time: found.end_time || '17:00',
        location: found.location || '',
        room: found.room || '',
        status: found.status,
        notes: found.notes || '',
        total_price: found.total_price || '',
        is_intra: found.is_intra || false,
        trainer_id: currentTrainer,
      })
    }
  }, [sessions, id])
  
  const loadSuiviData = async (sess) => {
    const { data: attendance } = await fetchAttendance(sess.id)
    const presMap = {}
    attendance?.forEach(a => {
      const key = `${a.trainee_id}_${a.date}`
      presMap[key] = a.present
    })
    setPresenceData(presMap)
    
    // Charger les présences demi-journées
    const { data: halfDays } = await supabase
      .from('attendance_halfdays')
      .select('*')
      .eq('session_id', sess.id)
    const halfDayMap = {}
    halfDays?.forEach(h => {
      // Normaliser le format de date (prendre uniquement YYYY-MM-DD)
      const dateStr = typeof h.date === 'string' ? h.date.substring(0, 10) : format(new Date(h.date), 'yyyy-MM-dd')
      // Convertir explicitement en booléen (PostgreSQL peut retourner 't'/'f' ou true/false)
      if (h.morning !== null && h.morning !== undefined) {
        halfDayMap[`${h.trainee_id}_${dateStr}_morning`] = h.morning === true || h.morning === 't' || h.morning === 'true'
      }
      if (h.afternoon !== null && h.afternoon !== undefined) {
        halfDayMap[`${h.trainee_id}_${dateStr}_afternoon`] = h.afternoon === true || h.afternoon === 't' || h.afternoon === 'true'
      }
    })
    setHalfDayAttendance(halfDayMap)
    
    const { data: evals } = await fetchTraineeEvaluations(sess.id)
    const evalMap = {}
    evals?.forEach(e => { evalMap[e.trainee_id] = e })
    
    // Initialiser les valeurs par défaut pour les stagiaires sans évaluation
    const defaultEvalValues = {
      questionnaire_submitted: true,
      q1_objectives: 5,
      q2_content: 5,
      q3_trainer: 5,
      q4_methods: 5,
      q5_materials: 5,
      q6_organization: 5,
      q7_duration: 5,
      q8_applicability: 5,
      satisfaction_score: 5,
      would_recommend: true
    }
    
    // Pour chaque stagiaire, vérifier si évaluation existe et initialiser les valeurs par défaut
    const traineesIds = sess.session_trainees?.map(st => st.trainee_id) || []
    for (const traineeId of traineesIds) {
      const existing = evalMap[traineeId]
      // Si pas d'évaluation ou évaluation incomplète (pas de questionnaire_submitted défini)
      if (!existing || existing.questionnaire_submitted === null || existing.questionnaire_submitted === undefined) {
        const merged = { ...defaultEvalValues, ...(existing || {}) }
        // S'assurer que les valeurs par défaut sont appliquées si non définies
        Object.keys(defaultEvalValues).forEach(key => {
          if (merged[key] === null || merged[key] === undefined) {
            merged[key] = defaultEvalValues[key]
          }
        })
        evalMap[traineeId] = merged
        // Sauvegarder en BDD seulement si c'est une nouvelle évaluation
        if (!existing) {
          await upsertTraineeEvaluation(sess.id, traineeId, defaultEvalValues)
        }
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
    await toggleTraineeObjective(session.id, traineeId, objectiveIndex, newValue)
    
    // Mettre à jour local
    setObjectivesData(prev => prev.map(o => 
      (o.trainee_id === traineeId && o.objective_index === objectiveIndex) 
        ? { ...o, validated: newValue }
        : o
    ))
    
    // Recalculer le résultat du stagiaire
    const result = await updateTraineeResult(session.id, traineeId)
    setTraineeResults(prev => ({ ...prev, [traineeId]: result.result }))
  }
  
  // Marquer tous les objectifs comme acquis pour tous les stagiaires
  const handleMarkAllAcquired = async () => {
    if (!confirm('Marquer tous les objectifs comme acquis pour tous les stagiaires ?')) return
    
    const objectives = getObjectivesList()
    if (objectives.length === 0 || sessionTrainees.length === 0) return
    
    // Mettre à jour l'état local immédiatement
    setObjectivesData(prev => prev.map(o => ({ ...o, validated: true })))
    
    // Sauvegarder en base et recalculer les résultats
    for (const trainee of sessionTrainees) {
      for (let idx = 0; idx < objectives.length; idx++) {
        const objData = objectivesData.find(o => o.trainee_id === trainee.id && o.objective_index === idx)
        if (objData && !objData.validated) {
          await toggleTraineeObjective(session.id, trainee.id, idx, true)
        }
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
    
    // Récupérer les objectifs non validés
    const traineeObjectives = objectivesData.filter(o => o.trainee_id === trainee.id)
    const failedObjectives = traineeObjectives
      .filter(o => !o.validated)
      .map(o => getObjectivesList()[o.objective_index])
      .filter(Boolean)
    
    // Générer le certificat avec les infos supplémentaires
    const trainer = session.trainers
    const stData = session.session_trainees?.find(st => st.trainee_id === trainee.id)
    const enrichedTrainee = { 
      ...trainee, 
      result: stData?.result || traineeResults[trainee.id] || 'not_acquired',
      remediation_proposal: proposal,
      failed_objectives: failedObjectives
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
    
    let remaining = totalHalfDays
    for (const day of days) {
      if (remaining <= 0) break
      const dateStr = format(day, 'yyyy-MM-dd')
      
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
    return halfDays
  }
  
  // Gérer le changement de présence demi-journée
  const handleHalfDayChange = async (traineeId, dateStr, period, present) => {
    const key = `${traineeId}_${dateStr}_${period}`
    const newAttendance = { ...halfDayAttendance, [key]: present }
    setHalfDayAttendance(newAttendance)
    
    // Sauvegarder en base
    const { data: existing } = await supabase
      .from('attendance_halfdays')
      .select('*')
      .eq('session_id', session.id)
      .eq('trainee_id', traineeId)
      .eq('date', dateStr)
      .single()
    
    const updateData = {
      session_id: session.id,
      trainee_id: traineeId,
      date: dateStr,
      [period]: present,
      validated_by: session.trainers ? `${session.trainers.first_name} ${session.trainers.last_name}` : 'Formateur',
      validated_at: new Date().toISOString(),
    }
    
    if (existing) {
      await supabase.from('attendance_halfdays').update(updateData).eq('id', existing.id)
    } else {
      await supabase.from('attendance_halfdays').insert([updateData])
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
    
    // Sauvegarder en base - grouper par date pour optimiser
    const validatedBy = session.trainers ? `${session.trainers.first_name} ${session.trainers.last_name}` : 'Formateur'
    const validatedAt = new Date().toISOString()
    
    for (const trainee of sessionTrainees) {
      // Grouper les demi-journées par date
      const dateMap = {}
      halfDays.forEach(hd => {
        if (!dateMap[hd.dateStr]) dateMap[hd.dateStr] = {}
        dateMap[hd.dateStr][hd.period] = true
      })
      
      for (const [dateStr, periods] of Object.entries(dateMap)) {
        const { data: existing } = await supabase
          .from('attendance_halfdays')
          .select('*')
          .eq('session_id', session.id)
          .eq('trainee_id', trainee.id)
          .eq('date', dateStr)
          .single()
        
        const updateData = {
          session_id: session.id,
          trainee_id: trainee.id,
          date: dateStr,
          morning: periods.morning || existing?.morning || false,
          afternoon: periods.afternoon || existing?.afternoon || false,
          validated_by: validatedBy,
          validated_at: validatedAt,
        }
        
        if (existing) {
          await supabase.from('attendance_halfdays').update(updateData).eq('id', existing.id)
        } else {
          await supabase.from('attendance_halfdays').insert([updateData])
        }
      }
      
      // Recalculer le résultat du stagiaire (au cas où tous ses objectifs étaient déjà validés)
      const result = await updateTraineeResult(session.id, trainee.id)
      if (result?.result) {
        setTraineeResults(prev => ({ ...prev, [trainee.id]: result.result }))
      }
      
      // Marquer présence complète
      await updatePresenceComplete(session.id, trainee.id, true)
    }
    
    toast.success('Tous les stagiaires marqués présents ✓')
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
    return session?.location || 'À définir'
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
    // Mise à jour des infos session
    const { trainer_id, ...sessionData } = editForm
    await updateSession(id, sessionData)
    
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
    // Recharger les sessions
    await fetchSessions()
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
    if (!confirm('Retirer ce stagiaire ?')) return
    const { error } = await removeTraineeFromSession(id, traineeId)
    if (error) {
      toast.error('Erreur lors du retrait')
    } else {
      toast.success('Stagiaire retiré')
      const { data } = await getSession(id)
      if (data) setSession(data)
    }
  }
  
  const handleDownload = (docType, trainee = null) => {
    const trainer = session.trainers
    const traineesWithResult = session.session_trainees?.map(st => ({ 
      ...st.trainees, 
      result: st.result || traineeResults[st.trainee_id] || null 
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
    
    // Pour les autres documents
    let enrichedTrainee = trainee
    if (trainee) {
      const stData = session.session_trainees?.find(st => st.trainee_id === trainee.id)
      enrichedTrainee = { ...trainee, result: stData?.result || traineeResults[trainee.id] || null }
    }
    // Ajouter les coûts pour la convention
    const costs = docType === 'convention' ? sessionCosts : []
    downloadDocument(docType, session, { trainees: traineesWithResult, trainee: enrichedTrainee, trainer, questions, costs })
    toast.success('Document généré')
  }
  
  const handleDownloadAll = (docType) => {
    const trainer = session.trainers
    const traineesWithResult = session.session_trainees?.map(st => ({ 
      ...st.trainees, 
      result: st.result || traineeResults[st.trainee_id] || null 
    })) || []
    downloadAllDocuments(docType, session, traineesWithResult, { trainer, questions })
    toast.success('Documents générés')
  }
  
  // Ouvrir modal email "Avant formation"
  const handleSendEmailBefore = () => {
    // Priorité : 1) Contact spécifique de la session, 2) Contact principal du client, 3) Email générique du client
    const sessionContact = session?.session_contact
    const primaryContact = session?.clients?.contacts?.find(c => c.is_primary)
    const firstContact = session?.clients?.contacts?.[0]
    
    const contactEmail = sessionContact?.email || primaryContact?.email || firstContact?.email || session?.clients?.email || ''
    const contactName = sessionContact?.name || primaryContact?.name || firstContact?.name || ''
    
    setEmailModalData({ type: 'before', email: contactEmail, contactName, customEmail: '' })
    setShowEmailModal(true)
  }
  
  // Ouvrir modal email "Après formation"
  const handleSendEmailAfter = () => {
    // Priorité : 1) Contact spécifique de la session, 2) Contact principal du client, 3) Email générique du client
    const sessionContact = session?.session_contact
    const primaryContact = session?.clients?.contacts?.find(c => c.is_primary)
    const firstContact = session?.clients?.contacts?.[0]
    
    const contactEmail = sessionContact?.email || primaryContact?.email || firstContact?.email || session?.clients?.email || ''
    const contactName = sessionContact?.name || primaryContact?.name || firstContact?.name || ''
    
    setEmailModalData({ type: 'after', email: contactEmail, contactName, customEmail: '' })
    setShowEmailModal(true)
  }
  
  // Confirmer envoi email et télécharger les docs
  const handleConfirmEmail = () => {
    const targetEmail = emailModalData.customEmail || emailModalData.email
    if (!targetEmail) {
      toast.error('Veuillez saisir une adresse email')
      return
    }
    
    const trainer = session.trainers
    const traineesWithResult = session.session_trainees?.map(st => ({ 
      ...st.trainees, 
      result: st.result || traineeResults[st.trainee_id] || null 
    })) || []
    const ref = session?.reference || ''
    const courseTitle = session?.courses?.title || ''
    const clientName = session?.clients?.name || ''
    const startDate = session?.start_date ? format(new Date(session.start_date), 'd MMMM yyyy', { locale: fr }) : ''
    
    if (emailModalData.type === 'before') {
      // Documents avant formation : Convention, Programme, Convocations
      const subject = encodeURIComponent(`${courseTitle} - Documents de formation - ${ref}`)
      const body = encodeURIComponent(
`Bonjour,

Veuillez trouver ci-joints les documents relatifs à la formation "${courseTitle}" prévue le ${startDate} :

- Convention de formation
- Programme de formation
- Convocations des stagiaires

Merci de nous retourner la convention signée avant le début de la formation.

Restant à votre disposition pour toute information complémentaire.

Bien cordialement,
${organization?.dirigeant || 'Access Formation'}
${organization?.name || ''}
${organization?.phone || ''}`)
      
      // Télécharger les documents
      downloadDocument('convention', session, { trainees: traineesWithResult, trainer, costs: sessionCosts })
      downloadDocument('programme', session, { trainer })
      downloadAllDocuments('convocation', session, traineesWithResult, { trainer })
      
      // Ouvrir le client mail
      window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`
      
    } else {
      // Documents après formation : Certificats, Attestations, Évaluations à froid
      const subject = encodeURIComponent(`${courseTitle} - Documents de fin de formation - ${ref}`)
      const body = encodeURIComponent(
`Bonjour,

Suite à la formation "${courseTitle}" qui s'est déroulée le ${startDate}, veuillez trouver ci-joints :

- Les certificats de réalisation
- Les attestations de présence
- Les questionnaires d'évaluation à froid (à compléter d'ici 90 jours)

Nous vous remercions pour votre confiance et restons à votre disposition.

Bien cordialement,
${organization?.dirigeant || 'Access Formation'}
${organization?.name || ''}
${organization?.phone || ''}`)
      
      // Télécharger les documents
      downloadAllDocuments('certificat', session, traineesWithResult, { trainer })
      downloadAllDocuments('attestation', session, traineesWithResult, { trainer })
      downloadAllDocuments('evaluationFroid', session, traineesWithResult, { trainer })
      
      // Ouvrir le client mail
      window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`
    }
    
    setShowEmailModal(false)
    toast.success('Documents téléchargés - Email prêt à envoyer')
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
        client_id: newTraineeForm.client_id || session?.client_id || null
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
    setNewTraineeForm({ first_name: '', last_name: '', email: '', phone: '', client_id: '' })
    setShowNewTraineeModal(false)
    toast.success(`${newTrainee.first_name} ${newTrainee.last_name} créé et ajouté à la session`)
  }
  
  const copyAttendanceLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/emargement/${session.attendance_token}`)
    toast.success('Lien copié !')
  }
  
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  if (!session) return <div className="text-center py-12"><p className="text-gray-500">Session non trouvée</p><Link to="/sessions" className="text-primary-600 hover:underline mt-2 inline-block">Retour</Link></div>
  
  const sessionTrainees = session.session_trainees?.map(st => ({ 
    ...st.trainees, 
    status: st.status, 
    result: st.result || traineeResults[st.trainee_id] || null 
  })) || []
  const enrolledTraineeIds = sessionTrainees.map(t => t.id)
  let availableTrainees = trainees.filter(t => !enrolledTraineeIds.includes(t.id))
  if (traineeFilterClient) availableTrainees = availableTrainees.filter(t => t.client_id === traineeFilterClient)
  const trainer = session.trainers
  const sessionDays = getSessionDays()
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/sessions" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"><ArrowLeft className="w-4 h-4" />Retour</Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{session.reference}</h1>
            <span className={`badge ${statusLabels[session.status]?.class}`}>{statusLabels[session.status]?.label}</span>
            {session.is_intra && <span className="badge bg-purple-100 text-purple-700 flex items-center gap-1"><Home className="w-3 h-3" />Intra</span>}
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
          <button onClick={() => setShowEdit(true)} className="btn btn-secondary flex items-center gap-2"><Edit className="w-4 h-4" />Modifier</button>
          <button onClick={handleDelete} className="btn btn-danger"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      
      {/* Infos */}
      <div className="grid md:grid-cols-4 gap-4">
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
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 overflow-x-auto">
          {[
            { id: 'overview', label: 'Stagiaires' },
            { id: 'presence', label: 'Présence' },
            { id: 'objectifs', label: 'Validation objectifs' },
            { id: 'suivi', label: 'Évaluations' },
            { id: 'costs', label: 'Coûts supplémentaires' },
            { id: 'documents', label: 'Documents' },
            { id: 'positionnement', label: 'Test positionnement' },
            { id: 'scans', label: 'Scans uploadés' },
            { id: 'attendance', label: 'QR Émargement' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
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
              {sessionTrainees.map(t => (
                <div key={t.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t.first_name} {t.last_name}</p>
                    <p className="text-sm text-gray-500">{t.email}</p>
                  </div>
                  <button onClick={() => handleRemoveTrainee(t.id)} className="text-red-600 hover:text-red-800"><UserMinus className="w-4 h-4" /></button>
                </div>
              ))}
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
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessionTrainees.map(t => {
                    const status = getTraineeHalfDayStatus(t.id)
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="py-3 px-2 font-medium sticky left-0 bg-white">
                          {t.first_name} {t.last_name?.toUpperCase()}
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
                              <td key={idx} className="text-center py-3 px-2">
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
                                  {isValidated ? 'Oui' : 'Non'}
                                </button>
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
          {/* Évaluations à chaud - Qualiopi complet */}
          <div className="card">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-orange-600" />Évaluations à chaud (stagiaires)</h3>
            <p className="text-sm text-gray-500 mb-4">
              Formation : <strong>{session.courses?.title || 'Non définie'}</strong> - Formateur : <strong>{trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Non assigné'}</strong>
            </p>
            {sessionTrainees.length === 0 ? <p className="text-gray-500">Aucun stagiaire</p> : (
              <div className="space-y-4">
                {sessionTrainees.map(t => {
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
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
                          {[
                            { key: 'q1_objectives', label: 'Clarté objectifs' },
                            { key: 'q6_organization', label: 'Accueil/Orga.' },
                            { key: 'q2_content', label: 'Pertinence contenu' },
                            { key: 'q5_materials', label: 'Supports péda.' },
                            { key: 'q3_trainer', label: 'Pédagogie formateur' },
                            { key: 'q7_duration', label: 'Rythme/Durée' },
                            { key: 'q4_methods', label: 'Conditions mat.' },
                            { key: 'q8_applicability', label: 'Utilité pro.' },
                            { key: 'satisfaction_score', label: 'Satisfaction globale' },
                          ].map(item => (
                            <div key={item.key} className="flex flex-col">
                              <span className="text-xs text-gray-500 mb-1">{item.label}</span>
                              <div className="flex gap-1">
                                {[1,2,3,4,5].map(n => (
                                  <button key={n} onClick={() => handleEvalChange(t.id, item.key, n)} className={`w-6 h-6 rounded text-xs ${eval_[item.key] === n ? 'bg-orange-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>{n}</button>
                                ))}
                              </div>
                            </div>
                          ))}
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 mb-1">Recommande ?</span>
                            <div className="flex gap-1">
                              <button onClick={() => handleEvalChange(t.id, 'would_recommend', true)} className={`px-3 py-1 rounded text-xs ${eval_.would_recommend === true ? 'bg-green-500 text-white' : 'bg-gray-100'}`}>Oui</button>
                              <button onClick={() => handleEvalChange(t.id, 'would_recommend', false)} className={`px-3 py-1 rounded text-xs ${eval_.would_recommend === false ? 'bg-red-500 text-white' : 'bg-gray-100'}`}>Non</button>
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
            {sessionTrainees.length === 0 ? <p className="text-gray-500">Aucun stagiaire</p> : (
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
                    {sessionTrainees.map(t => {
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
            )}}
          </div>
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
      
      {/* TAB: Documents */}
      {activeTab === 'documents' && (
        <div className="card">
          <h3 className="font-semibold mb-4">Générer des documents</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {docTypes.map(doc => (
              <div key={doc.id} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <doc.icon className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-sm">{doc.name}</span>
                  {doc.qualiopi && <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">Ind.{doc.qualiopi}</span>}
                </div>
                {doc.forAll && <button onClick={() => handleDownload(doc.id)} className="btn btn-sm btn-secondary w-full"><Download className="w-3 h-3 mr-1" />Télécharger</button>}
                {doc.forEach && (
                  <div className="space-y-1">
                    <button onClick={() => handleDownloadAll(doc.id)} className="btn btn-sm btn-secondary w-full text-xs">Tous les stagiaires</button>
                    {sessionTrainees.slice(0, 3).map(t => (
                      <button key={t.id} onClick={() => handleDownload(doc.id, t)} className="btn btn-sm btn-ghost w-full text-xs truncate">{t.first_name} {t.last_name}</button>
                    ))}
                    {sessionTrainees.length > 3 && <p className="text-xs text-gray-400 text-center">+{sessionTrainees.length - 3} autres</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
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
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => handleDownloadAll('positionnement')} 
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />Tous les stagiaires ({sessionTrainees.length})
                  </button>
                  {sessionTrainees.slice(0, 5).map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => handleDownload('positionnement', t)} 
                      className="btn btn-sm btn-secondary"
                    >
                      {t.first_name} {t.last_name?.charAt(0)}.
                    </button>
                  ))}
                  {sessionTrainees.length > 5 && (
                    <span className="text-sm text-gray-500 self-center">+{sessionTrainees.length - 5} autres</span>
                  )}
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
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-sm text-gray-500">{uploadCategories.find(c => c.id === doc.category)?.label || doc.category} • {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}</p>
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
      
      {/* TAB: QR Émargement */}
      {activeTab === 'attendance' && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><QrCode className="w-5 h-5" />Émargement numérique</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="text-center">
              {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-4" />}
              <p className="text-sm text-gray-500 mb-2">Les stagiaires scannent ce QR code pour signer</p>
              <button onClick={copyAttendanceLink} className="btn btn-secondary"><Copy className="w-4 h-4 mr-2" />Copier le lien</button>
            </div>
            <div>
              <h4 className="font-medium mb-3">Signatures reçues</h4>
              {attendances.length === 0 ? <p className="text-gray-500">Aucune signature</p> : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {attendances.map(a => (
                    <div key={a.id} className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{a.trainees?.first_name} {a.trainees?.last_name}</span>
                      <span className="text-xs text-gray-400 ml-auto">{format(new Date(a.signed_at), 'HH:mm')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Ajouter Stagiaire */}
      {showAddTrainee && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddTrainee(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Ajouter des stagiaires</h2>
                <button onClick={() => setShowAddTrainee(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 border-b">
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
                    value={editForm.is_intra ? (session?.clients?.address || 'Adresse client non renseignée') : editForm.location} 
                    onChange={(e) => setEditForm({...editForm, location: e.target.value})}
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
                <div>
                  <label className="label">Statut</label>
                  <select className="input" value={editForm.status} onChange={(e) => setEditForm({...editForm, status: e.target.value})}>
                    {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input" rows={3} value={editForm.notes} onChange={(e) => setEditForm({...editForm, notes: e.target.value})} />
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
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className={`p-4 border-b ${emailModalData.type === 'before' ? 'bg-blue-50' : 'bg-green-50'}`}>
              <h3 className={`text-lg font-semibold flex items-center gap-2 ${emailModalData.type === 'before' ? 'text-blue-700' : 'text-green-700'}`}>
                <Send className="w-5 h-5" />
                {emailModalData.type === 'before' ? 'Envoi avant formation' : 'Envoi après formation'}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Documents qui seront téléchargés :</label>
                <div className="bg-gray-50 rounded p-3 space-y-1 text-sm">
                  {emailModalData.type === 'before' ? (
                    <>
                      <p>📄 Convention de formation</p>
                      <p>📄 Programme de formation</p>
                      <p>📄 Convocations ({sessionTrainees.length} stagiaire{sessionTrainees.length > 1 ? 's' : ''})</p>
                    </>
                  ) : (
                    <>
                      <p>📄 Certificats de réalisation ({sessionTrainees.length})</p>
                      <p>📄 Attestations de présence ({sessionTrainees.length})</p>
                      <p>📄 Évaluations à froid ({sessionTrainees.length})</p>
                    </>
                  )}
                </div>
              </div>
              
              <div>
                <label className="label">Destinataire</label>
                {/* Contact de la session s'il existe */}
                {session?.session_contact && (
                  <div className="bg-accent-50 border border-accent-200 rounded-lg p-2 mb-2 text-sm">
                    <p className="text-accent-700 font-medium">Contact de cette session :</p>
                    <p className="text-accent-900">{session.session_contact.name} - {session.session_contact.email}</p>
                  </div>
                )}
                {(session?.clients?.contacts && session.clients.contacts.length > 0) || session?.clients?.email ? (
                  <select 
                    className="input w-full mb-2"
                    value={emailModalData.email}
                    onChange={(e) => setEmailModalData(prev => ({ ...prev, email: e.target.value, customEmail: '' }))}
                  >
                    <option value="">-- Sélectionner un contact --</option>
                    {session.session_contact && (
                      <option value={session.session_contact.email}>
                        ⭐ {session.session_contact.name} (Session) - {session.session_contact.email}
                      </option>
                    )}
                    {session.clients.contacts?.filter(c => c.id !== session?.contact_id).map(c => (
                      <option key={c.id} value={c.email}>
                        {c.name} {c.is_primary ? '(Principal)' : ''} - {c.email}
                      </option>
                    ))}
                    {session.clients?.email && (
                      <option value={session.clients.email}>
                        📧 Email générique: {session.clients.email}
                      </option>
                    )}
                  </select>
                ) : (
                  <p className="text-sm text-amber-600 mb-2 p-2 bg-amber-50 rounded">
                    ⚠️ Aucun contact enregistré pour ce client. Ajoutez des contacts dans la fiche client.
                  </p>
                )}
                <input 
                  type="email"
                  className="input w-full"
                  placeholder="Ou saisir une adresse email..."
                  value={emailModalData.customEmail}
                  onChange={(e) => setEmailModalData(prev => ({ ...prev, customEmail: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowEmailModal(false)} className="btn btn-secondary">Annuler</button>
              <button onClick={handleConfirmEmail} className="btn btn-primary flex items-center gap-2">
                <Send className="w-4 h-4" />
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
      
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
    </div>
  )
}
