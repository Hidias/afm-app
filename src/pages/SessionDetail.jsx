import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { 
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Clock,
  FileText,
  QrCode,
  UserPlus,
  Download,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  X
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

export default function SessionDetail() {
  const { id } = useParams()
  const { 
    sessions, fetchSessions, updateSession, addTraineeToSession,
    trainees, fetchTrainees,
    attendances, fetchAttendances,
    documents, fetchDocuments
  } = useDataStore()
  
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showAddTrainee, setShowAddTrainee] = useState(false)
  const [selectedTrainee, setSelectedTrainee] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [showQR, setShowQR] = useState(false)
  
  useEffect(() => {
    fetchSessions()
    fetchTrainees()
    fetchDocuments(id)
    fetchAttendances(id)
  }, [id])
  
  useEffect(() => {
    const found = sessions.find(s => s.id === id)
    if (found) {
      setSession(found)
      setLoading(false)
      
      // Générer le QR code
      const attendanceUrl = `${window.location.origin}/emargement/${found.attendance_token}`
      QRCode.toDataURL(attendanceUrl, { width: 256, margin: 2 })
        .then(url => setQrCodeUrl(url))
    }
  }, [sessions, id])
  
  const copyAttendanceLink = () => {
    const url = `${window.location.origin}/emargement/${session.attendance_token}`
    navigator.clipboard.writeText(url)
    toast.success('Lien copié !')
  }
  
  const handleAddTrainee = async () => {
    if (!selectedTrainee) return
    
    const { error } = await addTraineeToSession(id, selectedTrainee)
    if (error) {
      toast.error('Erreur lors de l\'ajout')
    } else {
      toast.success('Stagiaire ajouté')
      setShowAddTrainee(false)
      setSelectedTrainee('')
    }
  }
  
  const updateStatus = async (newStatus) => {
    const { error } = await updateSession(id, { status: newStatus })
    if (error) {
      toast.error('Erreur lors de la mise à jour')
    } else {
      toast.success('Statut mis à jour')
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
  
  // Stagiaires déjà inscrits
  const enrolledTraineeIds = session.session_trainees?.map(st => st.trainee_id) || []
  const availableTrainees = trainees.filter(t => !enrolledTraineeIds.includes(t.id))
  
  // Documents de cette session
  const sessionDocuments = documents.filter(d => d.session_id === id)
  
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
        </div>
        
        <div className="flex gap-2">
          <select
            value={session.status}
            onChange={(e) => updateStatus(e.target.value)}
            className="input w-auto"
          >
            {Object.entries(statusLabels).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Infos principales */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-3">Informations</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              {format(new Date(session.start_date), 'd MMMM yyyy', { locale: fr })}
              {session.end_date !== session.start_date && (
                <> au {format(new Date(session.end_date), 'd MMMM yyyy', { locale: fr })}</>
              )}
            </div>
            {session.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                {session.location}
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4" />
              {session.courses?.duration_hours}h de formation
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="w-4 h-4" />
              {session.session_trainees?.length || 0} stagiaire(s) inscrit(s)
            </div>
          </div>
        </div>
        
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-3">Client</h3>
          <p className="font-medium">{session.clients?.name}</p>
        </div>
        
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-3">Émargement</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowQR(true)}
              className="btn btn-secondary flex items-center gap-2 flex-1"
            >
              <QrCode className="w-4 h-4" />
              QR Code
            </button>
            <button
              onClick={copyAttendanceLink}
              className="btn btn-secondary flex items-center gap-2 flex-1"
            >
              <Copy className="w-4 h-4" />
              Copier lien
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
      
      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Stagiaires inscrits</h3>
            <button
              onClick={() => setShowAddTrainee(true)}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Ajouter
            </button>
          </div>
          
          {session.session_trainees?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun stagiaire inscrit</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {session.session_trainees?.map(({ trainee_id, trainees: trainee, status }) => (
                <div key={trainee_id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {trainee?.first_name} {trainee?.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{trainee?.email}</p>
                  </div>
                  <span className={`badge ${status === 'attended' ? 'badge-green' : 'badge-gray'}`}>
                    {status === 'enrolled' ? 'Inscrit' : status === 'attended' ? 'Présent' : status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'documents' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Documents</h3>
          </div>
          
          {sessionDocuments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun document</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {sessionDocuments.map(doc => (
                <div key={doc.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{doc.number}</p>
                      <p className="text-sm text-gray-500">{doc.doc_type}</p>
                    </div>
                  </div>
                  <span className="badge badge-green">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Prêt
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'attendance' && (
        <div className="card">
          <h3 className="font-semibold mb-4">Historique des émargements</h3>
          
          {attendances.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun émargement enregistré</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {attendances.map(att => (
                <div key={att.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {att.trainees?.first_name} {att.trainees?.last_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(att.date), 'd MMM yyyy', { locale: fr })} - {att.period === 'am' ? 'Matin' : att.period === 'pm' ? 'Après-midi' : 'Journée'}
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500" />
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
              <button 
                onClick={() => setShowQR(false)} 
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-lg font-semibold mb-4">QR Code Émargement</h2>
              
              {qrCodeUrl && (
                <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-4" />
              )}
              
              <p className="text-sm text-gray-500 mb-4">
                Scannez ce code pour accéder à la page d'émargement
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={copyAttendanceLink}
                  className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copier le lien
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
                <h2 className="text-lg font-semibold">Ajouter un stagiaire</h2>
                <button onClick={() => setShowAddTrainee(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4">
                <label className="label">Stagiaire</label>
                <select
                  value={selectedTrainee}
                  onChange={(e) => setSelectedTrainee(e.target.value)}
                  className="input"
                >
                  <option value="">Sélectionner...</option>
                  {availableTrainees.map(trainee => (
                    <option key={trainee.id} value={trainee.id}>
                      {trainee.first_name} {trainee.last_name}
                    </option>
                  ))}
                </select>
                
                {availableTrainees.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Tous les stagiaires sont déjà inscrits ou vous devez d'abord créer des stagiaires.
                  </p>
                )}
                
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowAddTrainee(false)} className="btn btn-secondary">
                    Annuler
                  </button>
                  <button 
                    onClick={handleAddTrainee} 
                    className="btn btn-primary"
                    disabled={!selectedTrainee}
                  >
                    Ajouter
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
