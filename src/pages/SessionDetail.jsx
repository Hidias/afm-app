import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { downloadDocument, downloadAllDocuments, setOrganization } from '../lib/pdfGenerator'
import { 
  ArrowLeft, Calendar, MapPin, Users, Clock, FileText, QrCode, UserPlus, UserMinus,
  Download, CheckCircle, AlertCircle, Copy, ExternalLink, X, Edit, Trash2, Save,
  FileSignature, Send, Upload, Eye, Star, ThumbsUp, ClipboardCheck, UserCheck, HelpCircle, Home
} from 'lucide-react'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'

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
    
    const { data: evals } = await fetchTraineeEvaluations(sess.id)
    const evalMap = {}
    evals?.forEach(e => { evalMap[e.trainee_id] = e })
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
  }
  
  const loadQuestions = async (sess) => {
    if (sess.course_id) {
      const { data } = await fetchCourseQuestions(sess.course_id)
      setQuestions(data || [])
    }
  }
  
  const getSessionDays = () => {
    if (!session?.start_date || !session?.end_date) return []
    try {
      return eachDayOfInterval({ start: parseISO(session.start_date), end: parseISO(session.end_date) })
    } catch { return [] }
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
    const updated = { ...current, [field]: value }
    setEvaluationsData(prev => ({ ...prev, [traineeId]: updated }))
    await upsertTraineeEvaluation(session.id, traineeId, { [field]: value })
  }
  
  const handleColdEvalChange = async (traineeId, field, value) => {
    const current = coldEvaluationsData[traineeId] || {}
    const updated = { ...current, [field]: value }
    setColdEvaluationsData(prev => ({ ...prev, [traineeId]: updated }))
    await upsertColdEvaluation(session.id, traineeId, { [field]: value })
  }
  
  const handleTrainerEvalChange = async (field, value) => {
    const trainer = session.trainers
    if (!trainer) return toast.error('Aucun formateur assigné')
    setTrainerEval(prev => ({ ...prev, [field]: value }))
    await upsertTrainerEvaluation(session.id, trainer.id, { [field]: value })
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
    const sessionTrainees = session.session_trainees?.map(st => st.trainees) || []
    downloadDocument(docType, session, { trainees: sessionTrainees, trainee, trainer, questions })
    toast.success('Document généré')
  }
  
  const handleDownloadAll = (docType) => {
    const trainer = session.trainers
    const sessionTrainees = session.session_trainees?.map(st => st.trainees) || []
    downloadAllDocuments(docType, session, sessionTrainees, { trainer, questions })
    toast.success('Documents générés')
  }
  
  const copyAttendanceLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/emargement/${session.attendance_token}`)
    toast.success('Lien copié !')
  }
  
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  if (!session) return <div className="text-center py-12"><p className="text-gray-500">Session non trouvée</p><Link to="/sessions" className="text-primary-600 hover:underline mt-2 inline-block">Retour</Link></div>
  
  const sessionTrainees = session.session_trainees?.map(st => ({ ...st.trainees, status: st.status })) || []
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
        <div className="flex gap-2">
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
            { id: 'suivi', label: 'Suivi & Évaluations' },
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
            <button onClick={() => setShowAddTrainee(true)} className="btn btn-primary flex items-center gap-2"><UserPlus className="w-4 h-4" />Ajouter</button>
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
      
      {/* TAB: Suivi & Évaluations */}
      {activeTab === 'suivi' && (
        <div className="space-y-6">
          {/* Présence par journée */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><UserCheck className="w-5 h-5 text-green-600" />Présence par journée</h3>
            {sessionDays.length === 0 ? <p className="text-gray-500">Aucune journée</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4">Stagiaire</th>
                      {sessionDays.map(day => <th key={day.toISOString()} className="text-center px-2 py-2">{format(day, 'dd/MM', { locale: fr })}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionTrainees.map(t => (
                      <tr key={t.id} className="border-b">
                        <td className="py-2 pr-4 font-medium">{t.first_name} {t.last_name}</td>
                        {sessionDays.map(day => {
                          const key = `${t.id}_${format(day, 'yyyy-MM-dd')}`
                          return (
                            <td key={day.toISOString()} className="text-center px-2 py-2">
                              <input type="checkbox" checked={presenceData[key] || false} onChange={(e) => handlePresenceChange(t.id, day, e.target.checked)} className="w-5 h-5 text-green-600 rounded" />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Évaluations à chaud */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-orange-600" />Évaluations à chaud (stagiaires)</h3>
            {sessionTrainees.length === 0 ? <p className="text-gray-500">Aucun stagiaire</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Stagiaire</th>
                      <th className="text-center py-2">Questionnaire reçu</th>
                      <th className="text-center py-2">Note /5</th>
                      <th className="text-center py-2">Recommande ?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionTrainees.map(t => {
                      const eval_ = evaluationsData[t.id] || {}
                      return (
                        <tr key={t.id} className="border-b">
                          <td className="py-3 font-medium">{t.first_name} {t.last_name}</td>
                          <td className="text-center py-3">
                            <input type="checkbox" checked={eval_.questionnaire_submitted || false} onChange={(e) => handleEvalChange(t.id, 'questionnaire_submitted', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
                          </td>
                          <td className="text-center py-3">
                            <select value={eval_.satisfaction_score || ''} onChange={(e) => handleEvalChange(t.id, 'satisfaction_score', e.target.value || null)} className="border rounded px-2 py-1 w-16" disabled={!eval_.questionnaire_submitted}>
                              <option value="">-</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                            </select>
                          </td>
                          <td className="text-center py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handleEvalChange(t.id, 'would_recommend', true)} className={`px-2 py-1 rounded text-xs ${eval_.would_recommend === true ? 'bg-green-500 text-white' : 'bg-gray-100'}`} disabled={!eval_.questionnaire_submitted}>Oui</button>
                              <button onClick={() => handleEvalChange(t.id, 'would_recommend', false)} className={`px-2 py-1 rounded text-xs ${eval_.would_recommend === false ? 'bg-red-500 text-white' : 'bg-gray-100'}`} disabled={!eval_.questionnaire_submitted}>Non</button>
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
          
          {/* Évaluation formateur */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" />Évaluation par le formateur</h3>
            {!trainer ? <p className="text-gray-500">Aucun formateur assigné</p> : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Formateur : <strong>{trainer.first_name} {trainer.last_name}</strong></p>
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
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-purple-600" />Évaluations à froid (90 jours)</h3>
            {sessionTrainees.length === 0 ? <p className="text-gray-500">Aucun stagiaire</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Stagiaire</th>
                      <th className="text-center py-2">Envoyé</th>
                      <th className="text-center py-2">Reçu</th>
                      <th className="text-center py-2">Compétences appliquées</th>
                      <th className="text-center py-2">Impact métier</th>
                      <th className="text-center py-2">Recommande ?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionTrainees.map(t => {
                      const coldEval = coldEvaluationsData[t.id] || {}
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
                            <select value={coldEval.skills_applied || ''} onChange={(e) => handleColdEvalChange(t.id, 'skills_applied', e.target.value || null)} className="border rounded px-2 py-1 w-16" disabled={!coldEval.completed_at}>
                              <option value="">-</option>
                              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </td>
                          <td className="text-center py-3">
                            <select value={coldEval.job_impact || ''} onChange={(e) => handleColdEvalChange(t.id, 'job_impact', e.target.value || null)} className="border rounded px-2 py-1 w-16" disabled={!coldEval.completed_at}>
                              <option value="">-</option>
                              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </td>
                          <td className="text-center py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handleColdEvalChange(t.id, 'would_recommend', true)} className={`px-2 py-1 rounded text-xs ${coldEval.would_recommend === true ? 'bg-green-500 text-white' : 'bg-gray-100'}`} disabled={!coldEval.completed_at}>Oui</button>
                              <button onClick={() => handleColdEvalChange(t.id, 'would_recommend', false)} className={`px-2 py-1 rounded text-xs ${coldEval.would_recommend === false ? 'bg-red-500 text-white' : 'bg-gray-100'}`} disabled={!coldEval.completed_at}>Non</button>
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
            <button onClick={() => handleDownload('positionnement')} className="btn btn-primary flex items-center gap-2" disabled={questions.length === 0}>
              <Download className="w-4 h-4" />Télécharger le test
            </button>
          </div>
          
          {questions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <HelpCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Aucune question configurée pour cette formation.</p>
              <Link to="/formations" className="text-primary-600 hover:underline mt-2 inline-block">
                Configurer les questions →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{questions.length} question(s) configurée(s) pour <strong>{session.courses?.title}</strong></p>
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div key={q.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        {q.question_type === 'qcm' ? 'QCM' : 'Question ouverte'}
                      </span>
                      <span className="text-xs text-gray-400">#{idx + 1}</span>
                    </div>
                    <p className="font-medium">{q.question_text}</p>
                    {q.question_type === 'qcm' && (
                      <div className="mt-2 text-sm text-gray-600 space-y-1">
                        {q.option_a && <p>○ {q.option_a}</p>}
                        {q.option_b && <p>○ {q.option_b}</p>}
                        {q.option_c && <p>○ {q.option_c}</p>}
                      </div>
                    )}
                  </div>
                ))}
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
    </div>
  )
}
