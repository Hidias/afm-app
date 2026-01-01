import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Search, Calendar, MapPin, Users, ChevronRight, Eye } from 'lucide-react'

const statusColors = {
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const statusLabels = {
  planned: 'Planifiée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

export default function Sessions() {
  const { sessions, courses, clients, trainers, loadSessions } = useStore()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClient, setFilterClient] = useState('')

  const getCourseName = (courseId) => courses.find(c => c.id === courseId)?.title || '-'
  const getClientName = (clientId) => clients.find(c => c.id === clientId)?.name || '-'
  const getTrainerName = (trainerId) => {
    const t = trainers.find(tr => tr.id === trainerId)
    return t ? `${t.first_name} ${t.last_name}` : '-'
  }

  const filtered = sessions.filter(s => {
    const matchSearch = s.reference?.toLowerCase().includes(search.toLowerCase()) ||
      getCourseName(s.course_id).toLowerCase().includes(search.toLowerCase()) ||
      getClientName(s.client_id).toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || s.status === filterStatus
    const matchClient = !filterClient || s.client_id === filterClient
    return matchSearch && matchStatus && matchClient
  })

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette session ?')) return
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Session supprimée')
      loadSessions()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
          <p className="text-gray-500">{sessions.length} session(s)</p>
        </div>
        <Link
          to="/sessions/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Nouvelle session
        </Link>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">Tous les statuts</option>
          <option value="planned">Planifiée</option>
          <option value="in_progress">En cours</option>
          <option value="completed">Terminée</option>
          <option value="cancelled">Annulée</option>
        </select>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">Tous les clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {filtered.map((session) => (
          <div
            key={session.id}
            className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-mono text-gray-500">{session.reference}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[session.status]}`}>
                    {statusLabels[session.status]}
                  </span>
                  {session.is_intra && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      Intra
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  {getCourseName(session.course_id)}
                </h3>
                <p className="text-gray-600">{getClientName(session.client_id)}</p>
              </div>
              <Link
                to={`/sessions/${session.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg"
              >
                <Eye className="h-4 w-4" />
                Voir
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(session.start_date)} → {formatDate(session.end_date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{session.is_intra ? 'Chez le client' : (session.location || '-')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{session.session_trainees?.length || 0} stagiaire(s)</span>
              </div>
              {session.trainer_id && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Formateur :</span>
                  <span>{getTrainerName(session.trainer_id)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <div className="text-sm">
                <span className="text-gray-500">Prix :</span>
                <span className="ml-2 font-medium text-gray-900">
                  {session.use_custom_price
                    ? `${session.custom_price_ht}€ HT (personnalisé)`
                    : `${courses.find(c => c.id === session.course_id)?.price_ht || 0}€ HT`}
                </span>
              </div>
              <button
                onClick={() => handleDelete(session.id)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl">
          Aucune session trouvée
        </div>
      )}
    </div>
  )
}
