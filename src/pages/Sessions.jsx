import { useEffect, useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { 
  Calendar, Plus, Search, MapPin, Users, Clock, ChevronRight, ChevronDown, X, Trash2, Copy, Building2, List, LayoutGrid, Briefcase, Euro
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import MultiSiretWizard from '../components/MultiSiretWizard'
import SessionPlanning from '../components/SessionPlanning'

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
    sessions, sessionsLoading, fetchSessions, createSession, deleteSession, duplicateSession,
    clients, fetchClients,
    courses, fetchCourses,
    trainers, fetchTrainers,
    trainees, fetchTrainees
  } = useDataStore()
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(location.state?.openNew || false)
  const [showMultiSiret, setShowMultiSiret] = useState(false)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'planning'
  
  // Filtres stagiaires
  const [traineeSearch, setTraineeSearch] = useState('')
  const [traineeClientFilter, setTraineeClientFilter] = useState('')
  
  // Inter-sessions toggle
  const [expandedGroups, setExpandedGroups] = useState({})
  
  // Contacts du client sélectionné
  const [clientContacts, setClientContacts] = useState([])
  
  const [formData, setFormData] = useState({
    course_id: '',
    client_id: '',
    contact_id: '', // ID du contact spécifique (optionnel)
    signatory_name: '',
    signatory_role: '',
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '17:00',
    day_type: 'full', // 'full' = journée complète (2 demi-journées), 'half' = demi-journée (1 seule)
    location: '',
    room: '',
    status: 'planned',
    is_intra: false,
    trainer_ids: [],
    trainee_ids: [],
    funding_type: 'none',
    funding_details: '',
    // Sous-traitance
    session_type: 'intra',
    subcontract_course_title: '',
    subcontract_client_ref: '',
    subcontract_nb_trainees: '',
    subcontract_daily_rate: '',
  })
  
  useEffect(() => {
    fetchSessions()
    fetchClients()
    fetchCourses()
    fetchTrainers()
    fetchTrainees()
  }, [])
  
  // Mise à jour automatique du statut des sessions terminées (J+1 après fin)
  useEffect(() => {
    const updateCompletedSessions = async () => {
      if (sessions.length === 0) return
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Sessions dont la date de fin est passée (J+1) et qui ne sont pas encore "completed"
      const sessionsToComplete = sessions.filter(s => {
        if (s.status === 'completed' || s.status_locked) return false
        if (!s.end_date) return false
        
        const endDate = new Date(s.end_date)
        endDate.setHours(0, 0, 0, 0)
        // J+1 : la session est terminée le lendemain de la date de fin
        const dayAfterEnd = new Date(endDate)
        dayAfterEnd.setDate(dayAfterEnd.getDate() + 1)
        
        return today >= dayAfterEnd
      })
      
      // Mettre à jour les sessions
      for (const session of sessionsToComplete) {
        await supabase
          .from('sessions')
          .update({ status: 'completed' })
          .eq('id', session.id)
      }
      
      // Recharger si des sessions ont été mises à jour
      if (sessionsToComplete.length > 0) {
        console.log(`${sessionsToComplete.length} session(s) passée(s) en "Terminée"`)
        fetchSessions()
      }
    }
    
    updateCompletedSessions()
  }, [sessions.length])
  
  useEffect(() => {
    if (location.state?.openNew) {
      setShowForm(true)
      window.history.replaceState({}, document.title)
    }
  }, [location])
  
  // Filtrer les stagiaires
  const filteredTrainees = useMemo(() => {
    return trainees.filter(t => {
      const matchSearch = !traineeSearch || 
        `${t.first_name} ${t.last_name}`.toLowerCase().includes(traineeSearch.toLowerCase())
      const matchClient = !traineeClientFilter || t.client_id === traineeClientFilter
      return matchSearch && matchClient
    })
  }, [trainees, traineeSearch, traineeClientFilter])
  
  // Quand is_intra change, mettre à jour le lieu
  useEffect(() => {
    if (formData.is_intra && formData.client_id) {
      const client = clients.find(c => c.id === formData.client_id)
      if (client) {
        const addr = [client.address, client.postal_code, client.city].filter(Boolean).join(', ')
        setFormData(prev => ({ ...prev, location: addr || 'Chez le client' }))
      }
    }
  }, [formData.is_intra, formData.client_id, clients])
  
  // Charger les contacts quand le client change
  useEffect(() => {
    const loadContacts = async () => {
      if (formData.client_id) {
        const { data } = await supabase
          .from('client_contacts')
          .select('*')
          .eq('client_id', formData.client_id)
          .order('is_primary', { ascending: false })
        setClientContacts(data || [])
      } else {
        setClientContacts([])
      }
      // Reset contact_id quand le client change
      setFormData(prev => ({ ...prev, contact_id: '', signatory_name: '', signatory_role: '' }))
    }
    loadContacts()
  }, [formData.client_id])
  
  const filteredSessions = sessions.filter(session => {
    const trainerName = session.trainers ? `${session.trainers.first_name} ${session.trainers.last_name}` : ''
    const searchFields = `${session.reference || ''} ${session.courses?.title || ''} ${session.clients?.name || ''} ${trainerName} ${session.location || ''} ${session.subcontract_course_title || ''} ${session.subcontract_client_ref || ''}`.toLowerCase()
    const matchSearch = !search || searchFields.includes(search.toLowerCase())
    
    const matchStatus = !statusFilter || session.status === statusFilter
    
    return matchSearch && matchStatus
  })
  
  // Regrouper les sessions inter-entreprises
  const groupedSessions = useMemo(() => {
    const interGroups = {}
    const soloSessions = []
    
    filteredSessions.forEach(session => {
      if (session.inter_group_id) {
        if (!interGroups[session.inter_group_id]) {
          interGroups[session.inter_group_id] = {
            id: session.inter_group_id,
            sessions: [],
            course: session.courses,
            start_date: session.start_date,
            end_date: session.end_date,
            location: session.location,

          }
        }
        interGroups[session.inter_group_id].sessions.push(session)
      } else {
        soloSessions.push({ type: 'solo', session })
      }
    })
    
    // Combiner : inter-groupes + sessions solo, triées par date
    const items = [
      ...Object.values(interGroups).map(g => ({ type: 'group', group: g })),
      ...soloSessions,
    ]
    
    // Trier par date de début décroissante
    items.sort((a, b) => {
      const dateA = a.type === 'group' ? a.group.start_date : a.session.start_date
      const dateB = b.type === 'group' ? b.group.start_date : b.session.start_date
      return (dateB || '').localeCompare(dateA || '')
    })
    
    return items
  }, [filteredSessions])
  
  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }
  
  const resetForm = () => {
    setFormData({
      course_id: '',
      client_id: '',
      contact_id: '',
      signatory_name: '',
      signatory_role: '',
      start_date: '',
      end_date: '',
      start_time: '09:00',
      end_time: '17:00',
      day_type: 'full',
      location: '',
      room: '',
      status: 'planned',
      is_intra: false,
      trainer_ids: [],
      trainee_ids: [],
      session_type: 'intra',
      subcontract_course_title: '',
      subcontract_client_ref: '',
      subcontract_nb_trainees: '',
      subcontract_daily_rate: '',
    })
    setClientContacts([])
    setTraineeSearch('')
    setTraineeClientFilter('')
    setShowForm(false)
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const isSub = formData.session_type === 'subcontract'
    
    if (isSub) {
      if (!formData.client_id || !formData.start_date || !formData.end_date || !formData.subcontract_course_title) {
        toast.error('Remplissez le client, les dates et l\'intitulé de la formation')
        return
      }
    } else {
      if (!formData.course_id || !formData.client_id || !formData.start_date || !formData.end_date) {
        toast.error('Veuillez remplir tous les champs obligatoires')
        return
      }
      if (!formData.funding_type || formData.funding_type === '') {
        toast.error('Le type de financement est obligatoire')
        return
      }
    }
    
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      toast.error('La date de fin ne peut pas être avant la date de début')
      return
    }
    
    const sessionData = {
      session_type: formData.session_type,
      course_id: isSub ? null : formData.course_id,
      client_id: formData.client_id,
      contact_id: formData.contact_id || null,
      signatory_name: isSub ? null : (formData.signatory_name || null),
      signatory_role: isSub ? null : (formData.signatory_role || null),
      start_date: formData.start_date,
      end_date: formData.end_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      day_type: formData.day_type || 'full',
      location: formData.location,
      room: formData.room,
      status: formData.status,
      is_intra: isSub ? true : formData.is_intra,
      trainer_ids: formData.trainer_ids,
      trainee_ids: isSub ? [] : formData.trainee_ids,
      funding_type: isSub ? 'none' : (formData.funding_type || 'none'),
      funding_details: isSub ? null : (formData.funding_details || null),
      subcontract_course_title: isSub ? formData.subcontract_course_title : null,
      subcontract_client_ref: isSub ? formData.subcontract_client_ref : null,
      subcontract_nb_trainees: isSub ? (parseInt(formData.subcontract_nb_trainees) || 0) : 0,
      subcontract_daily_rate: isSub ? (parseFloat(formData.subcontract_daily_rate) || null) : null,
    }
    
    const { error } = await createSession(sessionData)
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
  
  const handleDuplicate = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const { error } = await duplicateSession(id)
    if (error) {
      toast.error('Erreur lors de la duplication')
    } else {
      toast.success('Session dupliquée - Éditez les dates')
    }
  }
  
  const toggleTrainee = (traineeId) => {
    setFormData(prev => ({
      ...prev,
      trainee_ids: prev.trainee_ids.includes(traineeId)
        ? prev.trainee_ids.filter(id => id !== traineeId)
        : [...prev.trainee_ids, traineeId]
    }))
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
          <p className="text-gray-500 mt-1">{sessions.length} session(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle Liste / Planning */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 mr-2">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List className="w-4 h-4" />
              Liste
            </button>
            <button
              onClick={() => setViewMode('planning')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                ${viewMode === 'planning' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid className="w-4 h-4" />
              Planning
            </button>
          </div>
          <button onClick={() => setShowMultiSiret(true)} className="btn btn-secondary flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Multi-SIRET
          </button>
          <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle session
          </button>
        </div>
      </div>
      
      {/* Vue Planning */}
      {viewMode === 'planning' && (
        <SessionPlanning sessions={sessions} trainers={trainers} />
      )}
      
      {/* Vue Liste */}
      {viewMode === 'list' && <>
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
        ) : groupedSessions.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            {search || statusFilter ? 'Aucun résultat' : 'Aucune session - Créez-en une !'}
          </div>
        ) : (
          groupedSessions.map((item) => {
            // ─── Session inter-entreprises groupée ───────────────
            if (item.type === 'group') {
              const { group } = item
              const isExpanded = expandedGroups[group.id]
              const totalTrainees = group.sessions.reduce((sum, s) => sum + (s.session_trainees?.length || 0), 0)
              // Prix retiré de l'affichage liste
              
              return (
                <div key={group.id} className="rounded-xl border-2 border-purple-200 bg-purple-50/30 overflow-hidden">
                  {/* En-tête du groupe */}
                  <div
                    className="px-5 py-4 cursor-pointer hover:bg-purple-50 transition-colors"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="badge bg-purple-100 text-purple-700 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            Inter-entreprises • {group.sessions.length} entreprises
                          </span>
                          {(() => {
                            const statuses = [...new Set(group.sessions.map(s => s.status))]
                            if (statuses.length === 1) {
                              return <span className={`badge ${statusLabels[statuses[0]]?.class || 'badge-gray'}`}>
                                {statusLabels[statuses[0]]?.label || statuses[0]}
                              </span>
                            }
                            return null
                          })()}
                        </div>
                        
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {group.course?.title || 'Formation'}
                        </h3>
                        
                        {/* Badges entreprises */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {group.sessions.map(s => (
                            <span key={s.id} className="inline-flex items-center gap-1 text-xs bg-white border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                              {s.clients?.name || '?'}
                              <span className="text-purple-400">({s.session_trainees?.length || 0})</span>
                            </span>
                          ))}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 mt-2.5 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {group.start_date ? format(new Date(group.start_date), 'd MMM yyyy', { locale: fr }) : 'Date à définir'}
                            {group.end_date && group.end_date !== group.start_date && (
                              <> - {format(new Date(group.end_date), 'd MMM yyyy', { locale: fr })}</>
                            )}
                          </span>
                          {group.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {group.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {totalTrainees} stagiaire(s)
                          </span>

                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 mt-1">
                        <ChevronDown className={`w-5 h-5 text-purple-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Sessions du groupe (dépliées) */}
                  {isExpanded && (
                    <div className="border-t border-purple-200 divide-y divide-purple-100">
                      {group.sessions.map(session => (
                        <Link
                          key={session.id}
                          to={`/sessions/${session.id}`}
                          className="block px-5 py-3 hover:bg-white/80 transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-mono text-gray-400">{session.reference}</span>
                                <span className={`badge text-xs ${statusLabels[session.status]?.class || 'badge-gray'}`}>
                                  {statusLabels[session.status]?.label || session.status}
                                </span>
                              </div>
                              <p className="font-medium text-gray-900 mt-0.5">{session.clients?.name}</p>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                <span>{session.session_trainees?.length || 0} stagiaire(s)</span>

                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleDuplicate(session.id, e)}
                                className="p-1.5 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Dupliquer"
                              >
                                <Copy className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(session.id, e)}
                                className="p-1.5 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            
            // ─── Session solo (classique) ────────────────────────
            const session = item.session
            return (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className="card block hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-sm font-mono text-gray-500">{session.reference}</span>
                      <span className={`badge ${statusLabels[session.status]?.class || 'badge-gray'}`}>
                        {statusLabels[session.status]?.label || session.status}
                      </span>
                      {session.is_intra && session.session_type !== 'subcontract' && (
                        <span className="badge bg-purple-100 text-purple-700">Intra</span>
                      )}
                      {session.session_type === 'subcontract' && (
                        <span className="badge bg-amber-100 text-amber-800 flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />Sous-traitance
                        </span>
                      )}
                      {session.session_type === 'subcontract' && session.subcontract_invoiced && (
                        <span className="badge bg-green-100 text-green-700">Facturée</span>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {session.session_type === 'subcontract'
                        ? (session.subcontract_course_title || 'Formation sous-traitée')
                        : (session.courses?.title || 'Formation')
                      }
                    </h3>
                    <p className="text-gray-600">
                      {session.clients?.name}
                      {session.session_type === 'subcontract' && session.subcontract_client_ref && (
                        <span className="text-gray-400 ml-2">Réf: {session.subcontract_client_ref}</span>
                      )}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {session.start_date ? format(new Date(session.start_date), 'd MMM yyyy', { locale: fr }) : 'Date à définir'}
                        {session.end_date && session.end_date !== session.start_date && (
                          <> - {format(new Date(session.end_date), 'd MMM yyyy', { locale: fr })}</>
                        )}
                      </span>
                      
                      {(session.location_name || session.location) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {session.location_name || session.location}
                        </span>
                      )}
                      
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {session.session_type === 'subcontract'
                          ? `${session.subcontract_nb_trainees || 0} stagiaire(s)`
                          : `${session.session_trainees?.length || 0} stagiaire(s)`
                        }
                      </span>
                      
                      {session.session_type === 'subcontract' && session.subcontract_daily_rate && (
                        <span className="flex items-center gap-1 text-amber-700 font-medium">
                          <Euro className="w-4 h-4" />
                          {parseFloat(session.subcontract_daily_rate).toFixed(0)} €/j HT
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDuplicate(session.id, e)}
                      className="p-2 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Dupliquer"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(session.id, e)}
                      className="p-2 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
      </>}
      
      {/* Modal création */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl z-10">
              <h2 className="text-xl font-semibold">Nouvelle session</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Toggle type de session */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button type="button"
                  onClick={() => setFormData({ ...formData, session_type: 'intra' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all
                    ${formData.session_type !== 'subcontract' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Calendar className="w-4 h-4" />
                  Formation directe
                </button>
                <button type="button"
                  onClick={() => setFormData({ ...formData, session_type: 'subcontract', funding_type: 'none', course_id: '' })}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all
                    ${formData.session_type === 'subcontract' ? 'bg-amber-50 text-amber-800 shadow-sm border border-amber-200' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Briefcase className="w-4 h-4" />
                  Sous-traitance
                </button>
              </div>

              {/* ═══ FORMULAIRE SOUS-TRAITANCE ═══ */}
              {formData.session_type === 'subcontract' && (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <Briefcase className="w-4 h-4 inline mr-1.5" />
                    Session en tant que sous-traitant — formulaire simplifié
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Donneur d'ordre (OF) *</label>
                      <select value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} className="input" required>
                        <option value="">Sélectionner...</option>
                        <optgroup label="🎓 Organismes de formation">
                          {clients.filter(c => c.client_type === 'organisme_formation').map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Autres clients">
                          {clients.filter(c => c.client_type !== 'organisme_formation').map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="label">Leur référence</label>
                      <input type="text" value={formData.subcontract_client_ref} onChange={(e) => setFormData({ ...formData, subcontract_client_ref: e.target.value })} className="input" placeholder="Réf. du donneur d'ordre" />
                    </div>
                  </div>

                  <div>
                    <label className="label">Intitulé de la formation *</label>
                    <input type="text" value={formData.subcontract_course_title} onChange={(e) => setFormData({ ...formData, subcontract_course_title: e.target.value })} className="input" required placeholder="Ex: Formation SST - Initiale" />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Date de début *</label>
                      <input type="date" value={formData.start_date} required onChange={(e) => { const d = e.target.value; setFormData({ ...formData, start_date: d, end_date: formData.end_date && formData.end_date < d ? d : (formData.end_date || d) }) }} className="input" />
                    </div>
                    <div>
                      <label className="label">Date de fin *</label>
                      <input type="date" value={formData.end_date} min={formData.start_date} required onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="input" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div><label className="label">Heure début</label><input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} className="input" /></div>
                    <div><label className="label">Heure fin</label><input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} className="input" /></div>
                  </div>

                  <div>
                    <label className="label">Lieu</label>
                    <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input" placeholder="Adresse de la formation" />
                  </div>

                  <div>
                    <label className="label">Formateur</label>
                    <select value={formData.trainer_ids[0] || ''} onChange={(e) => setFormData({ ...formData, trainer_ids: e.target.value ? [e.target.value] : [] })} className="input">
                      <option value="">Sélectionner...</option>
                      {trainers.map(trainer => (
                        <option key={trainer.id} value={trainer.id}>{trainer.first_name} {trainer.last_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Nombre de stagiaires</label>
                      <input type="number" min="0" value={formData.subcontract_nb_trainees} onChange={(e) => setFormData({ ...formData, subcontract_nb_trainees: e.target.value })} className="input" placeholder="0" />
                    </div>
                    <div>
                      <label className="label">Tarif journalier HT (€)</label>
                      <div className="relative">
                        <input type="number" min="0" step="0.01" value={formData.subcontract_daily_rate} onChange={(e) => setFormData({ ...formData, subcontract_daily_rate: e.target.value })} className="input pr-8" placeholder="0.00" />
                        <Euro className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {formData.subcontract_daily_rate && formData.start_date && formData.end_date && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                      {(() => {
                        const days = Math.max(1, Math.round((new Date(formData.end_date) - new Date(formData.start_date)) / 86400000) + 1)
                        const total = days * parseFloat(formData.subcontract_daily_rate || 0)
                        return (
                          <div className="flex justify-between items-center">
                            <span className="text-green-800">{days} jour{days > 1 ? 's' : ''} × {parseFloat(formData.subcontract_daily_rate).toFixed(2)} €</span>
                            <span className="font-bold text-green-900 text-lg">{total.toFixed(2)} € HT</span>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </>
              )}

              {/* ═══ FORMULAIRE STANDARD (formation directe) ═══ */}
              {formData.session_type !== 'subcontract' && (
                <>
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
                        {course.title} ({course.duration_hours || course.duration || '?'}h)
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
              
              {/* Contact pour la session */}
              {formData.client_id && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <label className="label text-blue-800">Contact pour cette session</label>
                  <select
                    value={formData.contact_id}
                    onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                    className="input"
                  >
                    <option value="">📧 Contact générique (entreprise)</option>
                    {clientContacts.length > 0 && (
                      <>
                        <optgroup label="Contacts spécifiques">
                          {clientContacts.map(contact => (
                            <option key={contact.id} value={contact.id}>
                              👤 {contact.name}{contact.role ? ` (${contact.role})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    )}
                  </select>
                  <p className="text-xs text-blue-600 mt-1">
                    Ce contact sera mentionné sur les convocations
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="label text-xs text-blue-800">Signataire convention</label>
                      <input
                        type="text"
                        value={formData.signatory_name}
                        onChange={(e) => setFormData({ ...formData, signatory_name: e.target.value })}
                        className="input"
                        placeholder="Ex: Frédéric LE REGENT"
                      />
                    </div>
                    <div>
                      <label className="label text-xs text-blue-800">Fonction signataire</label>
                      <input
                        type="text"
                        value={formData.signatory_role}
                        onChange={(e) => setFormData({ ...formData, signatory_role: e.target.value })}
                        className="input"
                        placeholder="Ex: Dirigeant"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Si vide, le contact ci-dessus sera utilisé comme signataire sur la convention
                  </p>
                </div>
              )}
              
              {/* Dates */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Date de début *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => {
                      const newStart = e.target.value
                      const newEnd = formData.end_date && formData.end_date < newStart ? newStart : (formData.end_date || newStart)
                      setFormData({ ...formData, start_date: newStart, end_date: newEnd })
                    }}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Date de fin *</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    min={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>
              
              {/* Horaires */}
              <div className="grid md:grid-cols-3 gap-4">
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
                <div>
                  <label className="label">Type de journée</label>
                  <select
                    value={formData.day_type}
                    onChange={(e) => setFormData({ ...formData, day_type: e.target.value })}
                    className="input"
                  >
                    <option value="full">Journée complète (2 émargements/jour)</option>
                    <option value="half">Demi-journée (1 émargement/jour)</option>
                  </select>
                </div>
              </div>
              
              {/* Type de financement */}
              <div className="p-4 bg-blue-50 rounded-lg space-y-4">
                <h3 className="font-medium text-blue-900">Financement de la formation</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Type de financement *</label>
                    <select
                      value={formData.funding_type}
                      onChange={(e) => setFormData({ ...formData, funding_type: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">Sélectionner...</option>
                      <option value="none">Aucun (pas de mention)</option>
                      <option value="opco">OPCO</option>
                      <option value="cpf">CPF</option>
                      <option value="faf">FAF</option>
                      <option value="region">Région</option>
                      <option value="france_travail">France Travail</option>
                      <option value="ptp">PTP (Plan de Transition Professionnel)</option>
                      <option value="fne">FNE (Fonds National de l'Emploi)</option>
                      <option value="direct">Financement direct</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Précisions (optionnel)</label>
                    <input
                      type="text"
                      value={formData.funding_details}
                      onChange={(e) => setFormData({ ...formData, funding_details: e.target.value })}
                      className="input"
                      placeholder="Ex: OPCO Atlas, Région Bretagne..."
                    />
                  </div>
                </div>
                <p className="text-xs text-blue-600">
                  {formData.funding_type === 'none' 
                    ? 'Aucune mention de financement ne sera ajoutée à la convention' 
                    : 'Le type de financement sera mentionné dans la convention'}
                </p>
              </div>
              
              {/* Intra + Lieu */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_intra}
                    onChange={(e) => setFormData({ ...formData, is_intra: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="font-medium">Formation Intra-entreprise</span>
                    <p className="text-sm text-gray-500">La formation se déroule chez le client</p>
                  </div>
                </label>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Lieu</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="input"
                      placeholder={formData.is_intra ? 'Adresse du client' : 'Adresse ou "Distanciel"'}
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
              
              {/* Stagiaires avec filtres */}
              <div className="border rounded-lg p-4">
                <label className="label mb-3">Stagiaires à inscrire</label>
                
                {/* Filtres stagiaires */}
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un stagiaire..."
                      value={traineeSearch}
                      onChange={(e) => setTraineeSearch(e.target.value)}
                      className="input pl-8 py-1.5 text-sm"
                    />
                  </div>
                  <select
                    value={traineeClientFilter}
                    onChange={(e) => setTraineeClientFilter(e.target.value)}
                    className="input py-1.5 text-sm w-40"
                  >
                    <option value="">Toutes entreprises</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Liste stagiaires avec checkboxes */}
                <div className="max-h-48 overflow-y-auto border rounded bg-white">
                  {filteredTrainees.length === 0 ? (
                    <p className="text-sm text-gray-500 p-3 text-center">Aucun stagiaire trouvé</p>
                  ) : (
                    filteredTrainees.map(trainee => (
                      <label
                        key={trainee.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={formData.trainee_ids.includes(trainee.id)}
                          onChange={() => toggleTrainee(trainee.id)}
                          className="rounded border-gray-300 text-primary-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {trainee.first_name} {trainee.last_name}
                          </p>
                          {trainee.clients?.name && (
                            <p className="text-xs text-gray-500 truncate">{trainee.clients.name}</p>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.trainee_ids.length} stagiaire(s) sélectionné(s)
                </p>
              </div>
              </>)}
              
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
      )}
      
      {showMultiSiret && (
        <MultiSiretWizard
          onClose={() => setShowMultiSiret(false)}
          onCreated={() => setShowMultiSiret(false)}
        />
      )}
    </div>
  )
}
