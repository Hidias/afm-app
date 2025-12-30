import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { 
  Calendar, Plus, Search, MapPin, Users, Clock, ChevronRight, X, Edit, Trash2
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

const statusLabels = {
  draft: { label: 'Brouillon', class: 'badge-gray' },
  planned: { label: 'Planifiée', class: 'badge-blue' },
  in_progress: { label: 'En cours', class: 'badge-yellow' },
  completed: { label: 'Terminée', class: 'badge-green' },
  cancelled: { label: 'Annulée', class: 'badge-red' },
}

export default function Sessions() {
  const location = useLocation()
  const { 
    sessions, sessionsLoading, fetchSessions, createSession, deleteSession,
    clients, fetchClients,
    courses, fetchCourses,
    trainers, fetchTrainers,
    trainees, fetchTrainees
  } = useDataStore()
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(location.state?.openNew || false)
  const [formData, setFormData] = useState({
    course_id: '',
    client_id: '',
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '17:00',
    location: '',
    room: '',
    status: 'planned',
    trainer_ids: [],
    trainee_ids: [],
  })
  
  useEffect(() => {
    fetchSessions()
    fetchClients()
    fetchCourses()
    fetchTrainers()
    fetchTrainees()
  }, [])
  
  useEffect(() => {
    if (location.state?.openNew) {
      setShowForm(true)
      window.history.replaceState({}, document.title)
    }
  }, [location])
  
  const filteredSessions = sessions.filter(session => {
    const matchSearch = 
      session.reference?.toLowerCase().includes(search.toLowerCase()) ||
      session.courses?.title?.toLowerCase().includes(search.toLowerCase()) ||
      session.clients?.name?.toLowerCase().includes(search.toLowerCase())
    
    const matchStatus = !statusFilter || session.status === statusFilter
    
    return matchSearch && matchStatus
  })
  
  const resetForm = () => {
    setFormData({
      course_id: '',
      client_id: '',
      start_date: '',
      end_date: '',
      start_time: '09:00',
      end_time: '17:00',
      location: '',
      room: '',
      status: 'planned',
      trainer_ids: [],
      trainee_ids: [],
    })
    setShowForm(false)
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.course_id || !formData.client_id || !formData.start_date || !formData.end_date) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    
    const { error } = await createSession(formData)
    if (error) {
      toast.error('Erreur lors de la création')
      console.error(error)
    } else {
      toast.success('Session créée avec succès')
      resetForm()
    }
  }
  
  const handleDelete = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Supprimer cette session ?')) return
    
    const { error } = await deleteSession(id)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Session supprimée')
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
          <p className="text-gray-500 mt-1">{sessions.length} session(s)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle session
        </button>
      </div>
      
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-full sm:w-48"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(statusLabels).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      
      {/* Liste */}
      <div className="space-y-4">
        {sessionsLoading ? (
          <div className="card p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            {search || statusFilter ? 'Aucun résultat' : 'Aucune session - Créez-en une !'}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <Link
              key={session.id}
              to={`/sessions/${session.id}`}
              className="card block hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-gray-500">{session.reference}</span>
                    <span className={`badge ${statusLabels[session.status]?.class || 'badge-gray'}`}>
                      {statusLabels[session.status]?.label || session.status}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {session.courses?.title || 'Formation'}
                  </h3>
                  <p className="text-gray-600">{session.clients?.name}</p>
                  
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(session.start_date), 'd MMM yyyy', { locale: fr })}
                      {session.end_date !== session.start_date && (
                        <> - {format(new Date(session.end_date), 'd MMM yyyy', { locale: fr })}</>
                      )}
                    </span>
                    
                    {session.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {session.location}
                      </span>
                    )}
                    
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {session.session_trainees?.length || 0} stagiaire(s)
                    </span>
                    
                    {session.courses?.duration_hours && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {session.courses.duration_hours}h
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(session.id, e)}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition-opacity"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      
      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Nouvelle session</h2>
                <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Formation et Client */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Formation *</label>
                    <select
                      value={formData.course_id}
                      onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>
                          {course.code} - {course.title} ({course.duration_hours}h)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="label">Client *</label>
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Dates */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date de début *</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value, end_date: formData.end_date || e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Date de fin *</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                </div>
                
                {/* Horaires */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Heure de début</label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Heure de fin</label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                
                {/* Lieu */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Lieu</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="input"
                      placeholder="Adresse ou 'Distanciel'"
                    />
                  </div>
                  <div>
                    <label className="label">Salle</label>
                    <input
                      type="text"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="input"
                      placeholder="Salle de réunion, etc."
                    />
                  </div>
                </div>
                
                {/* Formateur */}
                <div>
                  <label className="label">Formateur(s)</label>
                  <select
                    multiple
                    value={formData.trainer_ids}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      trainer_ids: Array.from(e.target.selectedOptions, opt => opt.value) 
                    })}
                    className="input h-24"
                  >
                    {trainers.map(trainer => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.first_name} {trainer.last_name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Ctrl+clic pour sélectionner plusieurs</p>
                </div>
                
                {/* Stagiaires */}
                <div>
                  <label className="label">Stagiaires à inscrire</label>
                  <select
                    multiple
                    value={formData.trainee_ids}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      trainee_ids: Array.from(e.target.selectedOptions, opt => opt.value) 
                    })}
                    className="input h-32"
                  >
                    {trainees.map(trainee => (
                      <option key={trainee.id} value={trainee.id}>
                        {trainee.first_name} {trainee.last_name} {trainee.clients?.name ? `(${trainee.clients.name})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Ctrl+clic pour sélectionner plusieurs. Vous pourrez aussi les ajouter après.</p>
                </div>
                
                {/* Statut */}
                <div>
                  <label className="label">Statut</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input"
                  >
                    {Object.entries(statusLabels).map(([value, { label }]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={resetForm} className="btn btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Créer la session
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
