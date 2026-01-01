import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import {
  ArrowLeft, Save, FileText, Users, Calendar, ClipboardCheck,
  Upload, CheckCircle, XCircle, Download, Trash2, Plus, User, QrCode
} from 'lucide-react'
import { generatePDF } from '../lib/pdfGenerator'

// Composant QR Code
function QRCodeDisplay({ sessionId }) {
  const [qrUrl, setQrUrl] = useState('')
  
  useEffect(() => {
    const generateQR = async () => {
      const url = `${window.location.origin}/signature/${sessionId}`
      try {
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 150,
          margin: 2,
          color: { dark: '#2980b9', light: '#ffffff' }
        })
        setQrUrl(qrDataUrl)
      } catch (err) {
        console.error('Erreur génération QR:', err)
      }
    }
    if (sessionId) generateQR()
  }, [sessionId])
  
  if (!qrUrl) return <div className="w-[150px] h-[150px] bg-gray-100 animate-pulse rounded-lg" />
  
  return (
    <div className="bg-white p-3 rounded-xl shadow-sm">
      <img src={qrUrl} alt="QR Code émargement" className="w-[150px] h-[150px]" />
    </div>
  )
}

const tabs = [
  { id: 'info', name: 'Informations', icon: FileText },
  { id: 'trainees', name: 'Stagiaires', icon: Users },
  { id: 'attendance', name: 'Présences', icon: Calendar },
  { id: 'evaluations', name: 'Évaluations', icon: ClipboardCheck },
  { id: 'documents', name: 'Documents', icon: Upload },
  { id: 'qualiopi', name: 'Qualiopi', icon: CheckCircle },
]

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { courses, clients, trainers, trainees, qualiopiIndicators, organization, loadSessions } = useStore()
  
  const [activeTab, setActiveTab] = useState('info')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [session, setSession] = useState(null)
  const [sessionTrainees, setSessionTrainees] = useState([])
  const [attendances, setAttendances] = useState([])
  const [evaluationsHot, setEvaluationsHot] = useState([])
  const [evaluationsCold, setEvaluationsCold] = useState([])
  const [evaluationTrainer, setEvaluationTrainer] = useState(null)
  const [sessionDocuments, setSessionDocuments] = useState([])
  const [qualiopiChecklist, setQualiopiChecklist] = useState([])
  const [viewingSignature, setViewingSignature] = useState(null)

  const [formData, setFormData] = useState({
    course_id: '',
    client_id: '',
    trainer_id: '',
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '17:00',
    location: '',
    is_intra: false,
    use_custom_price: false,
    custom_price_ht: '',
    status: 'planned',
    notes: '',
  })

  useEffect(() => {
    if (id && id !== 'new') {
      loadSession()
    } else {
      setLoading(false)
    }
  }, [id])

  const loadSession = async () => {
    setLoading(true)
    try {
      // Charger la session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single()

      if (sessionError) throw sessionError
      setSession(sessionData)
      setFormData({
        course_id: sessionData.course_id || '',
        client_id: sessionData.client_id || '',
        trainer_id: sessionData.trainer_id || '',
        start_date: sessionData.start_date || '',
        end_date: sessionData.end_date || '',
        start_time: sessionData.start_time || '09:00',
        end_time: sessionData.end_time || '17:00',
        location: sessionData.location || '',
        is_intra: sessionData.is_intra || false,
        use_custom_price: sessionData.use_custom_price || false,
        custom_price_ht: sessionData.custom_price_ht || '',
        status: sessionData.status || 'planned',
        notes: sessionData.notes || '',
      })

      // Charger les stagiaires de la session
      const { data: stData } = await supabase
        .from('session_trainees')
        .select('*, trainee:trainees(*)')
        .eq('session_id', id)
      setSessionTrainees(stData || [])

      // Charger les présences
      const { data: attData } = await supabase
        .from('daily_attendances')
        .select('*')
        .eq('session_id', id)
      setAttendances(attData || [])

      // Charger les évaluations à chaud
      const { data: evalHotData } = await supabase
        .from('evaluations_hot')
        .select('*, trainee:trainees(*)')
        .eq('session_id', id)
      setEvaluationsHot(evalHotData || [])

      // Charger les évaluations à froid
      const { data: evalColdData } = await supabase
        .from('evaluations_cold')
        .select('*, trainee:trainees(*)')
        .eq('session_id', id)
      setEvaluationsCold(evalColdData || [])

      // Charger l'évaluation formateur
      const { data: evalTrainerData } = await supabase
        .from('evaluations_trainer')
        .select('*')
        .eq('session_id', id)
        .single()
      setEvaluationTrainer(evalTrainerData)

      // Charger les documents
      const { data: docsData } = await supabase
        .from('session_documents')
        .select('*')
        .eq('session_id', id)
      setSessionDocuments(docsData || [])

      // Charger la checklist Qualiopi
      const { data: qualiopiData } = await supabase
        .from('session_qualiopi_indicators')
        .select('*')
        .eq('session_id', id)
      setQualiopiChecklist(qualiopiData || [])

    } catch (error) {
      console.error('Error loading session:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (id === 'new') {
        const { data, error } = await supabase
          .from('sessions')
          .insert([formData])
          .select()
          .single()
        if (error) throw error
        toast.success('Session créée')
        navigate(`/sessions/${data.id}`)
      } else {
        const { error } = await supabase
          .from('sessions')
          .update(formData)
          .eq('id', id)
        if (error) throw error
        toast.success('Session mise à jour')
        loadSession()
      }
      loadSessions()
    } catch (error) {
      console.error('Error saving session:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTrainee = async (traineeId) => {
    try {
      const { error } = await supabase
        .from('session_trainees')
        .insert([{ session_id: id, trainee_id: traineeId }])
      if (error) throw error
      toast.success('Stagiaire ajouté')
      loadSession()
    } catch (error) {
      toast.error('Erreur')
    }
  }

  const handleRemoveTrainee = async (sessionTraineeId) => {
    if (!confirm('Retirer ce stagiaire ?')) return
    try {
      const { error } = await supabase
        .from('session_trainees')
        .delete()
        .eq('id', sessionTraineeId)
      if (error) throw error
      toast.success('Stagiaire retiré')
      loadSession()
    } catch (error) {
      toast.error('Erreur')
    }
  }

  const toggleQualiopiIndicator = async (indicatorId, currentlyValidated) => {
    try {
      const existing = qualiopiChecklist.find(q => q.indicator_id === indicatorId)
      if (existing) {
        const { error } = await supabase
          .from('session_qualiopi_indicators')
          .update({ 
            is_validated: !currentlyValidated,
            validated_at: !currentlyValidated ? new Date().toISOString() : null
          })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('session_qualiopi_indicators')
          .insert([{ 
            session_id: id, 
            indicator_id: indicatorId,
            is_validated: true,
            validated_at: new Date().toISOString()
          }])
        if (error) throw error
      }
      loadSession()
    } catch (error) {
      toast.error('Erreur')
    }
  }

  const handleGeneratePDF = async (docType) => {
    try {
      const course = courses.find(c => c.id === formData.course_id)
      const client = clients.find(c => c.id === formData.client_id)
      const trainer = trainers.find(t => t.id === formData.trainer_id)
      
      await generatePDF(docType, {
        session: { ...session, ...formData },
        course,
        client,
        trainer,
        trainees: sessionTrainees.map(st => st.trainee),
        organization,
      })
      toast.success('Document généré')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Erreur lors de la génération')
    }
  }

  const getAvailableTrainees = () => {
    const assignedIds = sessionTrainees.map(st => st.trainee_id)
    return trainees.filter(t => 
      t.client_id === formData.client_id && !assignedIds.includes(t.id)
    )
  }

  const isIndicatorValidated = (indicatorId) => {
    const item = qualiopiChecklist.find(q => q.indicator_id === indicatorId)
    return item?.is_validated || false
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sessions')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {id === 'new' ? 'Nouvelle session' : session?.reference}
            </h1>
            {session && (
              <p className="text-gray-500">
                {courses.find(c => c.id === session.course_id)?.title}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Tabs */}
      {id !== 'new' && (
        <div className="border-b">
          <nav className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        {/* Info Tab */}
        {(activeTab === 'info' || id === 'new') && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formation *</label>
                <select
                  value={formData.course_id}
                  onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Sélectionner une formation</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formateur</label>
                <select
                  value={formData.trainer_id}
                  onChange={(e) => setFormData({ ...formData, trainer_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Sélectionner un formateur</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="planned">Planifiée</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminée</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date début *</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date fin *</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure début</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure fin</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_intra}
                  onChange={(e) => setFormData({ ...formData, is_intra: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Formation Intra (chez le client)</span>
              </label>
            </div>

            {!formData.is_intra && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Adresse de la formation"
                />
              </div>
            )}

            <div className="border-t pt-6 space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.use_custom_price}
                  onChange={(e) => setFormData({ ...formData, use_custom_price: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Utiliser un prix personnalisé</span>
              </label>

              {formData.use_custom_price && (
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix HT (€)</label>
                  <input
                    type="number"
                    value={formData.custom_price_ht}
                    onChange={(e) => setFormData({ ...formData, custom_price_ht: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    step="0.01"
                  />
                </div>
              )}

              {!formData.use_custom_price && formData.course_id && (
                <p className="text-sm text-gray-500">
                  Prix par défaut : {courses.find(c => c.id === formData.course_id)?.price_ht || 0}€ HT
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Trainees Tab */}
        {activeTab === 'trainees' && id !== 'new' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Stagiaires inscrits ({sessionTrainees.length})</h3>
              {getAvailableTrainees().length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddTrainee(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="">+ Ajouter un stagiaire</option>
                  {getAvailableTrainees().map((t) => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                  ))}
                </select>
              )}
            </div>

            {sessionTrainees.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Aucun stagiaire inscrit
              </div>
            ) : (
              <div className="space-y-2">
                {sessionTrainees.map((st) => (
                  <div key={st.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">{st.trainee?.first_name} {st.trainee?.last_name}</p>
                        <p className="text-sm text-gray-500">{st.trainee?.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveTrainee(st.id)}
                      className="p-2 text-red-500 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && id !== 'new' && (
          <div className="space-y-6">
            {/* QR Code Section */}
            <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <QRCodeDisplay sessionId={id} />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Émargement numérique
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Scannez ce QR code ou partagez le lien ci-dessous pour permettre aux stagiaires de signer électroniquement.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/signature/${id}`}
                      className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/signature/${id}`)
                        toast.success('Lien copié !')
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                    >
                      Copier le lien
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="font-medium">Feuille de présence</h3>
              <button
                onClick={() => handleGeneratePDF('emargement')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Download className="h-4 w-4" />
                Générer PDF
              </button>
            </div>

            {sessionTrainees.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Ajoutez d'abord des stagiaires
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border px-4 py-2 text-left">Stagiaire</th>
                      <th className="border px-4 py-2 text-center">Matin</th>
                      <th className="border px-4 py-2 text-center">Après-midi</th>
                      <th className="border px-4 py-2 text-center">Signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionTrainees.map((st) => {
                      const att = attendances.find(a => a.trainee_id === st.trainee_id)
                      return (
                        <tr key={st.id}>
                          <td className="border px-4 py-2">
                            {st.trainee?.first_name} {st.trainee?.last_name}
                          </td>
                          <td className="border px-4 py-2 text-center">
                            {att?.morning_present ? (
                              <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="border px-4 py-2 text-center">
                            {att?.afternoon_present ? (
                              <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-5 w-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="border px-4 py-2 text-center">
                            {att?.signature_url ? (
                              <button
                                onClick={() => setViewingSignature(att.signature_url)}
                                className="text-green-600 text-sm hover:underline"
                              >
                                Voir signature
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Modal signature */}
            {viewingSignature && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setViewingSignature(null)}>
                <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                  <h3 className="font-medium mb-4">Signature</h3>
                  <img src={viewingSignature} alt="Signature" className="w-full border rounded-lg" />
                  <button
                    onClick={() => setViewingSignature(null)}
                    className="mt-4 w-full px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Evaluations Tab */}
        {activeTab === 'evaluations' && id !== 'new' && (
          <div className="space-y-8">
            {/* Évaluations à chaud */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Évaluations à chaud ({evaluationsHot.length}/{sessionTrainees.length})</h3>
                <button
                  onClick={() => handleGeneratePDF('eval_chaud')}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Générer formulaire vierge
                </button>
              </div>
              {evaluationsHot.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucune évaluation reçue</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {evaluationsHot.map((ev) => (
                    <div key={ev.id} className="p-4 bg-gray-50 rounded-lg">
                      <p className="font-medium">{ev.trainee?.first_name} {ev.trainee?.last_name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-gray-500">Moyenne :</span>
                        <span className="font-medium">
                          {((ev.q1 + ev.q2 + ev.q3 + ev.q4 + ev.q5 + ev.q6) / 6).toFixed(1)}/5
                        </span>
                      </div>
                      <p className="text-sm mt-1">
                        Recommande : {ev.would_recommend ? '✓ Oui' : '✗ Non'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Évaluations à froid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Évaluations à froid ({evaluationsCold.length}/{sessionTrainees.length})</h3>
                <button
                  onClick={() => handleGeneratePDF('eval_froid')}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Générer formulaire vierge
                </button>
              </div>
              {evaluationsCold.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucune évaluation reçue</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {evaluationsCold.map((ev) => (
                    <div key={ev.id} className="p-4 bg-gray-50 rounded-lg">
                      <p className="font-medium">{ev.trainee?.first_name} {ev.trainee?.last_name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-gray-500">Moyenne :</span>
                        <span className="font-medium">
                          {((ev.q1 + ev.q2 + ev.q3 + ev.q4) / 4).toFixed(1)}/5
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Évaluation formateur */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Évaluation par le formateur</h3>
                <button
                  onClick={() => handleGeneratePDF('eval_formateur')}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Générer formulaire vierge
                </button>
              </div>
              {evaluationTrainer ? (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><span className="text-gray-500">Motivation groupe :</span> {evaluationTrainer.q1}/5</div>
                    <div><span className="text-gray-500">Niveau stagiaires :</span> {evaluationTrainer.q2}/5</div>
                    <div><span className="text-gray-500">Conditions matérielles :</span> {evaluationTrainer.q3}/5</div>
                    <div><span className="text-gray-500">Organisation :</span> {evaluationTrainer.q4}/5</div>
                    <div><span className="text-gray-500">Objectifs atteints :</span> {evaluationTrainer.q5}/5</div>
                    <div><span className="text-gray-500">Ambiance :</span> {evaluationTrainer.q6}/5</div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Non renseignée</p>
              )}
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && id !== 'new' && (
          <div className="space-y-6">
            <h3 className="font-medium">Générer les documents</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { id: 'convention', name: 'Convention', code: 'AF-CONV' },
                { id: 'programme', name: 'Programme', code: 'AF-PROG' },
                { id: 'convocation', name: 'Convocation', code: 'AF-CONVOC' },
                { id: 'emargement', name: 'Feuille émargement', code: 'AF-EMARG' },
                { id: 'attestation', name: 'Attestation présence', code: 'AF-ATTP' },
                { id: 'certificat', name: 'Certificat réalisation', code: 'AF-CERT' },
                { id: 'eval_chaud', name: 'Évaluation à chaud', code: 'AF-EVAL' },
                { id: 'eval_froid', name: 'Évaluation à froid', code: 'AF-EVALF' },
                { id: 'eval_formateur', name: 'Évaluation formateur', code: 'AF-EVAL-F' },
                { id: 'positionnement', name: 'Test positionnement', code: 'AF-POS' },
                { id: 'besoin', name: 'Analyse besoin', code: 'AF-BESOIN' },
              ].map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleGeneratePDF(doc.id)}
                  className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-8 w-8 text-primary-600" />
                  <span className="text-sm font-medium text-center">{doc.name}</span>
                  <span className="text-xs text-gray-500">{doc.code}</span>
                </button>
              ))}
            </div>

            <div className="border-t pt-6">
              <h3 className="font-medium mb-4">Documents scannés</h3>
              {sessionDocuments.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun document uploadé</p>
              ) : (
                <div className="space-y-2">
                  {sessionDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <span>{doc.name}</span>
                        <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-200 rounded">{doc.category}</span>
                      </div>
                      <a href={doc.file_url} target="_blank" className="text-primary-600 text-sm">
                        Voir
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Qualiopi Tab */}
        {activeTab === 'qualiopi' && id !== 'new' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Checklist Qualiopi</h3>
              <div className="text-sm text-gray-500">
                {qualiopiChecklist.filter(q => q.is_validated).length} / {qualiopiIndicators.length} indicateurs validés
              </div>
            </div>

            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7].map((criterionNum) => {
                const criterionIndicators = qualiopiIndicators.filter(i => i.criterion === criterionNum)
                if (criterionIndicators.length === 0) return null
                
                return (
                  <div key={criterionNum} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 font-medium">
                      Critère {criterionNum}
                    </div>
                    <div className="divide-y">
                      {criterionIndicators.map((indicator) => (
                        <div
                          key={indicator.id}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50"
                        >
                          <button
                            onClick={() => toggleQualiopiIndicator(indicator.id, isIndicatorValidated(indicator.id))}
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                              isIndicatorValidated(indicator.id)
                                ? 'bg-green-500 border-green-500'
                                : 'border-gray-300'
                            }`}
                          >
                            {isIndicatorValidated(indicator.id) && (
                              <CheckCircle className="h-4 w-4 text-white" />
                            )}
                          </button>
                          <div className="flex-1">
                            <span className="font-mono text-sm text-gray-500 mr-2">
                              Ind. {indicator.number}
                            </span>
                            <span className="text-sm">{indicator.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
