import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { downloadDocument, downloadAllDocuments } from '../lib/pdfGenerator'
import { 
  ArrowLeft, Calendar, MapPin, Users, Clock, FileText, QrCode, UserPlus, UserMinus,
  Download, CheckCircle, AlertCircle, Copy, ExternalLink, X, Edit, Trash2, Save,
  FileSignature, Send, Printer, RefreshCw, FileStack
} from 'lucide-react'
import { format } from 'date-fns'
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
  { id: 'convention', name: 'Convention de formation', icon: FileSignature, forAll: true },
  { id: 'programme', name: 'Programme de formation', icon: FileText, forAll: true },
  { id: 'convocation', name: 'Convocation', icon: Send, forEach: true },
  { id: 'emargement', name: 'Feuille d\'émargement', icon: FileText, forAll: true },
  { id: 'attestation', name: 'Attestation de présence', icon: FileText, forEach: true },
  { id: 'certificat', name: 'Certificat de réalisation', icon: CheckCircle, forEach: true },
  { id: 'evaluation', name: 'Évaluation à chaud', icon: FileText, forEach: true },
  { id: 'evaluationFroid', name: 'Évaluation à froid', icon: FileText, forEach: true },
]

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { 
    sessions, fetchSessions, updateSession, deleteSession,
    trainees, fetchTrainees, addTraineeToSession, removeTraineeFromSession,
    trainers, fetchTrainers,
    attendances, fetchAttendances,
  } = useDataStore()
  
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showAddTrainee, setShowAddTrainee] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [selectedTrainees, setSelectedTrainees] = useState([])
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [generatingDoc, setGeneratingDoc] = useState(null)
  
  // Formulaire d'édition
  const [editForm, setEditForm] = useState({})
  
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchSessions(), fetchTrainees(), fetchTrainers()])
      setLoading(false)
    }
    loadData()
  }, [])
  
  useEffect(() => {
    const found = sessions.find(s => s.id === id)
    if (found) {
      setSession(found)
      fetchAttendances(id)
      
      // Générer le QR code
      const attendanceUrl = `${window.location.origin}/emargement/${found.attendance_token}`
      QRCode.toDataURL(attendanceUrl, { width: 256, margin: 2 })
        .then(url => setQrCodeUrl(url))
      
      // Initialiser le formulaire d'édition
      setEditForm({
        start_date: found.start_date,
        end_date: found.end_date,
        start_time: found.start_time || '09:00',
        end_time: found.end_time || '17:00',
        location: found.location || '',
        room: found.room || '',
        status: found.status,
        notes: found.notes || '',
        price_override_enabled: found.price_override_enabled || false,
        price_override: found.price_override || '',
      })
    }
  }, [sessions, id])
  
  const copyAttendanceLink = () => {
    const url = `${window.location.origin}/emargement/${session.attendance_token}`
    navigator.clipboard.writeText(url)
    toast.success('Lien copié !')
  }
  
  const handleAddTrainee = async () => {
    if (selectedTrainees.length === 0) return
    
    for (const traineeId of selectedTrainees) {
      await addTraineeToSession(id, traineeId)
    }
    toast.success(`${selectedTrainees.length} stagiaire(s) ajouté(s)`)
    setShowAddTrainee(false)
    setSelectedTrainees([])
  }
  
  const handleRemoveTrainee = async (traineeId) => {
    if (!confirm('Retirer ce stagiaire de la session ?')) return
    const { error } = await removeTraineeFromSession(id, traineeId)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Stagiaire retiré')
    }
  }
  
  const handleSaveEdit = async () => {
    const { error } = await updateSession(id, editForm)
    if (error) {
      toast.error('Erreur lors de la mise à jour')
    } else {
      toast.success('Session mise à jour')
      setShowEdit(false)
    }
  }
  
  const handleDelete = async () => {
    if (!confirm('Supprimer cette session ? Cette action est irréversible.')) return
    const { error } = await deleteSession(id)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Session supprimée')
      navigate('/sessions')
    }
  }
  
  const handleGenerateDoc = (docType, trainee = null) => {
    setGeneratingDoc(docType)
    
    try {
      const sessionTrainees = session.session_trainees?.map(st => st.trainees) || []
      const trainer = session.session_trainers?.[0]?.trainers || null
      
      downloadDocument(docType, session, {
        trainees: sessionTrainees,
        trainee: trainee,
        client: session.clients,
        trainer: trainer,
        course: session.courses,
        attendances: attendances,
      })
      
      toast.success('Document généré !')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de la génération')
    } finally {
      setGeneratingDoc(null)
    }
  }
  
  const handleGenerateAllForTrainee = (trainee) => {
    ['convocation', 'attestation', 'certificat'].forEach(docType => {
      setTimeout(() => handleGenerateDoc(docType, trainee), 500)
    })
  }
  
  const handleGenerateAllDocs = (docType) => {
    setGeneratingDoc(`all_${docType}`)
    
    try {
      const sessionTrainees = session.session_trainees?.map(st => st.trainees) || []
      const trainer = session.session_trainers?.[0]?.trainers || null
      
      downloadAllDocuments(docType, session, sessionTrainees, {
        client: session.clients,
        trainer: trainer,
        attendances: attendances,
      })
      
      toast.success('Documents générés !')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de la génération')
    } finally {
      setGeneratingDoc(null)
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  
  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Session non trouvée</p>
        <Link to="/sessions" className="text-primary-600 hover:underline mt-2 inline-block">
          Retour aux sessions
        </Link>
      </div>
    )
  }
  
  const sessionTrainees = session.session_trainees?.map(st => ({ ...st.trainees, status: st.status })) || []
  const enrolledTraineeIds = sessionTrainees.map(t => t.id)
  const availableTrainees = trainees.filter(t => !enrolledTraineeIds.includes(t.id))
  const trainer = session.session_trainers?.[0]?.trainers || null
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/sessions" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Retour aux sessions
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{session.reference}</h1>
            <span className={`badge ${statusLabels[session.status]?.class || 'badge-gray'}`}>
              {statusLabels[session.status]?.label || session.status}
            </span>
          </div>
          <p className="text-gray-600 mt-1">{session.courses?.title}</p>
          <p className="text-gray-500 text-sm">{session.clients?.name}</p>
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => setShowEdit(true)} className="btn btn-secondary flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Modifier
          </button>
          <button onClick={handleDelete} className="btn btn-danger flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Infos principales */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Dates
          </h3>
          <p className="text-sm text-gray-600">
            {format(new Date(session.start_date), 'd MMMM yyyy', { locale: fr })}
            {session.end_date !== session.start_date && (
              <><br />au {format(new Date(session.end_date), 'd MMMM yyyy', { locale: fr })}</>
            )}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {session.start_time || '09:00'} - {session.end_time || '17:00'}
          </p>
        </div>
        
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Lieu
          </h3>
          <p className="text-sm text-gray-600">{session.location || 'À définir'}</p>
          {session.room && <p className="text-sm text-gray-500">Salle : {session.room}</p>}
        </div>
        
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Durée
          </h3>
          <p className="text-sm text-gray-600">{session.courses?.duration_hours}h de formation</p>
          <p className="text-sm text-gray-500">{sessionTrainees.length} stagiaire(s)</p>
        </div>
        
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            Émargement
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setShowQR(true)} className="btn btn-secondary btn-sm flex-1">
              QR Code
            </button>
            <button onClick={copyAttendanceLink} className="btn btn-secondary btn-sm flex-1">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'Stagiaires' },
            { id: 'documents', label: 'Documents' },
            { id: 'attendance', label: 'Émargement' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Tab content: Stagiaires */}
      {activeTab === 'overview' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Stagiaires inscrits ({sessionTrainees.length})</h3>
            <button onClick={() => setShowAddTrainee(true)} className="btn btn-primary flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Ajouter
            </button>
          </div>
          
          {sessionTrainees.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun stagiaire inscrit</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {sessionTrainees.map((trainee) => (
                <div key={trainee.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {trainee.first_name} {trainee.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{trainee.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Boutons génération docs individuels */}
                    <button
                      onClick={() => handleGenerateDoc('convocation', trainee)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                      title="Convocation"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleGenerateDoc('attestation', trainee)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                      title="Attestation"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleGenerateDoc('certificat', trainee)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                      title="Certificat"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveTrainee(trainee.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                      title="Retirer"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Tab content: Documents */}
      {activeTab === 'documents' && (
        <div className="card">
          <h3 className="font-semibold mb-4">Générer des documents</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Documents pour toute la session */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Documents session</h4>
              <div className="space-y-2">
                {docTypes.filter(d => d.forAll).map(docType => (
                  <button
                    key={docType.id}
                    onClick={() => handleGenerateDoc(docType.id)}
                    disabled={generatingDoc === docType.id}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <docType.icon className="w-5 h-5 text-primary-600" />
                      <span>{docType.name}</span>
                    </div>
                    {generatingDoc === docType.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                ))}
              </div>
              
              {/* Boutons télécharger TOUT */}
              {sessionTrainees.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <FileStack className="w-4 h-4" />
                    Télécharger tout (tous stagiaires)
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleGenerateAllDocs('convocation')}
                      disabled={generatingDoc === 'all_convocation'}
                      className="btn btn-secondary flex items-center justify-center gap-2"
                    >
                      {generatingDoc === 'all_convocation' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Convocations
                    </button>
                    <button
                      onClick={() => handleGenerateAllDocs('attestation')}
                      disabled={generatingDoc === 'all_attestation'}
                      className="btn btn-secondary flex items-center justify-center gap-2"
                    >
                      {generatingDoc === 'all_attestation' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Attestations
                    </button>
                    <button
                      onClick={() => handleGenerateAllDocs('certificat')}
                      disabled={generatingDoc === 'all_certificat'}
                      className="btn btn-secondary flex items-center justify-center gap-2"
                    >
                      {generatingDoc === 'all_certificat' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Certificats
                    </button>
                    <button
                      onClick={() => handleGenerateAllDocs('evaluation')}
                      disabled={generatingDoc === 'all_evaluation'}
                      className="btn btn-secondary flex items-center justify-center gap-2"
                    >
                      {generatingDoc === 'all_evaluation' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Évaluations
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Documents individuels */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Documents par stagiaire</h4>
              {sessionTrainees.length === 0 ? (
                <p className="text-sm text-gray-500">Ajoutez d'abord des stagiaires</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {sessionTrainees.map(trainee => (
                    <div key={trainee.id} className="p-3 rounded-lg border border-gray-200">
                      <p className="font-medium text-sm mb-2">{trainee.first_name} {trainee.last_name}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGenerateDoc('convocation', trainee)}
                          className="btn btn-secondary btn-sm flex-1"
                          title="Convocation"
                        >
                          Conv.
                        </button>
                        <button
                          onClick={() => handleGenerateDoc('attestation', trainee)}
                          className="btn btn-secondary btn-sm flex-1"
                          title="Attestation"
                        >
                          Att.
                        </button>
                        <button
                          onClick={() => handleGenerateDoc('certificat', trainee)}
                          className="btn btn-secondary btn-sm flex-1"
                          title="Certificat"
                        >
                          Cert.
                        </button>
                        <button
                          onClick={() => handleGenerateDoc('evaluation', trainee)}
                          className="btn btn-secondary btn-sm flex-1"
                          title="Évaluation"
                        >
                          Éval.
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Tab content: Émargement */}
      {activeTab === 'attendance' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Historique des émargements</h3>
            <button
              onClick={() => handleGenerateDoc('emargement')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Imprimer feuille
            </button>
          </div>
          
          {attendances.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Aucun émargement enregistré</p>
              <div className="flex justify-center gap-4">
                <button onClick={() => setShowQR(true)} className="btn btn-primary">
                  Afficher QR Code
                </button>
                <button onClick={copyAttendanceLink} className="btn btn-secondary">
                  Copier le lien
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {attendances.map(att => (
                <div key={att.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {att.trainees?.first_name} {att.trainees?.last_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(att.date), 'd MMM yyyy', { locale: fr })} - 
                      {att.period === 'am' ? ' Matin' : att.period === 'pm' ? ' Après-midi' : ' Journée'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {att.signed_at && format(new Date(att.signed_at), 'HH:mm')}
                    </span>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Modal QR Code */}
      {showQR && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowQR(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm animate-fadeIn p-6 text-center">
              <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-lg font-semibold mb-4">QR Code Émargement</h2>
              
              {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-4" />}
              
              <p className="text-sm text-gray-500 mb-4">
                Scannez ce code pour accéder à la page d'émargement
              </p>
              
              <div className="flex gap-2">
                <button onClick={copyAttendanceLink} className="btn btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Copy className="w-4 h-4" />
                  Copier
                </button>
                <a
                  href={`${window.location.origin}/emargement/${session.attendance_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ouvrir
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Ajouter stagiaire */}
      {showAddTrainee && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddTrainee(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md animate-fadeIn">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Ajouter des stagiaires</h2>
                <button onClick={() => setShowAddTrainee(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4">
                {availableTrainees.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Tous les stagiaires sont déjà inscrits ou vous devez d'abord créer des stagiaires.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableTrainees.map(trainee => (
                      <label key={trainee.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTrainees.includes(trainee.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTrainees([...selectedTrainees, trainee.id])
                            } else {
                              setSelectedTrainees(selectedTrainees.filter(id => id !== trainee.id))
                            }
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <div>
                          <p className="font-medium">{trainee.first_name} {trainee.last_name}</p>
                          <p className="text-sm text-gray-500">{trainee.clients?.name || 'Sans entreprise'}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowAddTrainee(false)} className="btn btn-secondary">
                    Annuler
                  </button>
                  <button 
                    onClick={handleAddTrainee} 
                    className="btn btn-primary"
                    disabled={selectedTrainees.length === 0}
                  >
                    Ajouter ({selectedTrainees.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Modifier session */}
      {showEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowEdit(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg animate-fadeIn">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Modifier la session</h2>
                <button onClick={() => setShowEdit(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date de début</label>
                    <input
                      type="date"
                      value={editForm.start_date}
                      onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Date de fin</label>
                    <input
                      type="date"
                      value={editForm.end_date}
                      onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Heure début</label>
                    <input
                      type="time"
                      value={editForm.start_time}
                      onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Heure fin</label>
                    <input
                      type="time"
                      value={editForm.end_time}
                      onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="label">Lieu</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="input"
                  />
                </div>
                
                <div>
                  <label className="label">Salle</label>
                  <input
                    type="text"
                    value={editForm.room}
                    onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                    className="input"
                  />
                </div>
                
                {/* Prix spécifique pour cette session */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.price_override_enabled}
                      onChange={(e) => setEditForm({ ...editForm, price_override_enabled: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Modifier le prix pour cette session</span>
                  </label>
                  {editForm.price_override_enabled && (
                    <div className="mt-3">
                      <label className="label">Prix HT spécifique (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.price_override}
                        onChange={(e) => setEditForm({ ...editForm, price_override: e.target.value })}
                        className="input"
                        placeholder={session?.courses?.price_ht ? `Prix formation: ${session.courses.price_ht}€` : 'Montant HT'}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Ce prix sera utilisé à la place du prix standard de la formation
                      </p>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="label">Statut</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="input"
                  >
                    {Object.entries(statusLabels).map(([value, { label }]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="input"
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setShowEdit(false)} className="btn btn-secondary">
                    Annuler
                  </button>
                  <button onClick={handleSaveEdit} className="btn btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
