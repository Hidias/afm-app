import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Users, Calendar, Euro, TrendingUp, Plus, Search, 
  Filter, CheckCircle, Clock, AlertCircle 
} from 'lucide-react'
import { format, isAfter, isBefore, startOfToday } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function SessionsInter() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    try {
      // Récupérer toutes les sessions inter
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          courses(id, title, code),
          trainers(id, first_name, last_name)
        `)
        .eq('session_type', 'inter')
        .order('start_date', { ascending: false })

      if (error) throw error

      // Pour chaque session, récupérer les stats
      const sessionsWithStats = await Promise.all(
        (data || []).map(async (session) => {
          // Compter les participants
          const { count: totalParticipants } = await supabase
            .from('session_trainees')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id)
            .neq('trainee_status', 'cancelled')

          // Compter les confirmés
          const { count: confirmedParticipants } = await supabase
            .from('session_trainees')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id)
            .eq('trainee_status', 'confirmed')

          // Récupérer le CA
          const { data: groups } = await supabase
            .from('session_groups')
            .select('price_total, payment_status, status')
            .eq('session_id', session.id)

          const ca_total = groups?.reduce((sum, g) => sum + (g.price_total || 0), 0) || 0
          const ca_confirmed = groups
            ?.filter(g => g.payment_status === 'confirmed')
            .reduce((sum, g) => sum + (g.price_total || 0), 0) || 0

          return {
            ...session,
            total_participants: totalParticipants || 0,
            confirmed_participants: confirmedParticipants || 0,
            ca_total,
            ca_confirmed
          }
        })
      )

      setSessions(sessionsWithStats)
    } catch (error) {
      console.error('Erreur chargement sessions:', error)
    }
    setLoading(false)
  }

  // Filtrer les sessions
  const filteredSessions = sessions.filter(session => {
    // Filtre par recherche
    const matchesSearch = 
      session.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.courses?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.location_city?.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtre par statut
    let matchesStatus = true
    const today = startOfToday()
    const startDate = new Date(session.start_date)
    const endDate = new Date(session.end_date)

    if (filterStatus === 'upcoming') {
      matchesStatus = isAfter(startDate, today)
    } else if (filterStatus === 'in_progress') {
      matchesStatus = isBefore(startDate, today) && isAfter(endDate, today)
    } else if (filterStatus === 'completed') {
      matchesStatus = isBefore(endDate, today)
    }

    return matchesSearch && matchesStatus
  })

  // Stats globales
  const stats = {
    total: sessions.length,
    upcoming: sessions.filter(s => isAfter(new Date(s.start_date), startOfToday())).length,
    in_progress: sessions.filter(s => {
      const today = startOfToday()
      return isBefore(new Date(s.start_date), today) && isAfter(new Date(s.end_date), today)
    }).length,
    total_participants: sessions.reduce((sum, s) => sum + s.total_participants, 0),
    total_ca: sessions.reduce((sum, s) => sum + s.ca_confirmed, 0)
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sessions Inter-Entreprise</h1>
          <p className="text-gray-500 mt-1">
            Gérez vos formations ouvertes à plusieurs entreprises
          </p>
        </div>
        <Link
          to="/sessions-inter/nouvelle"
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouvelle session inter
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Sessions</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.upcoming}</p>
              <p className="text-sm text-gray-500">À venir</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.in_progress}</p>
              <p className="text-sm text-gray-500">En cours</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500 p-3 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total_participants}</p>
              <p className="text-sm text-gray-500">Participants</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-3 rounded-lg">
              <Euro className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.total_ca.toLocaleString('fr-FR')}€
              </p>
              <p className="text-sm text-gray-500">CA confirmé</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher une session..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
          </div>

          {/* Filtre statut */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input"
            >
              <option value="all">Toutes les sessions</option>
              <option value="upcoming">À venir</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Terminées</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des sessions */}
      {filteredSessions.length === 0 ? (
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Aucune session inter-entreprise
          </h3>
          <p className="text-gray-500 mb-4">
            Créez votre première session inter pour commencer
          </p>
          <Link
            to="/sessions-inter/nouvelle"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Créer une session
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSessions.map((session) => {
            const today = startOfToday()
            const startDate = new Date(session.start_date)
            const endDate = new Date(session.end_date)
            
            let statusBadge = { text: 'Planifiée', color: 'blue' }
            if (isBefore(startDate, today) && isAfter(endDate, today)) {
              statusBadge = { text: 'En cours', color: 'orange' }
            } else if (isBefore(endDate, today)) {
              statusBadge = { text: 'Terminée', color: 'green' }
            }

            const fillRate = session.max_participants 
              ? Math.round((session.confirmed_participants / session.max_participants) * 100)
              : 0

            return (
              <Link
                key={session.id}
                to={`/sessions-inter/${session.id}`}
                className="card hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Infos principales */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {session.courses?.title || 'Formation'}
                      </h3>
                      <span className={`badge badge-${statusBadge.color}`}>
                        {statusBadge.text}
                      </span>
                      {session.is_public && (
                        <span className="badge badge-purple">Public</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      {/* Dates */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Dates</p>
                        <p className="text-sm font-medium text-gray-900">
                          {format(startDate, 'd MMM', { locale: fr })} - {format(endDate, 'd MMM yyyy', { locale: fr })}
                        </p>
                      </div>

                      {/* Lieu */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Lieu</p>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {session.location_city || 'Non défini'}
                        </p>
                      </div>

                      {/* Participants */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Participants</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {session.confirmed_participants}/{session.max_participants || '∞'}
                          </p>
                          {session.max_participants && (
                            <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[60px]">
                              <div
                                className={`h-2 rounded-full ${
                                  fillRate >= 90 ? 'bg-red-500' : fillRate >= 70 ? 'bg-orange-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(fillRate, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* CA */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Chiffre d'affaires</p>
                        <p className="text-sm font-medium text-emerald-600">
                          {session.ca_confirmed.toLocaleString('fr-FR')}€
                        </p>
                        {session.ca_total !== session.ca_confirmed && (
                          <p className="text-xs text-gray-400">
                            / {session.ca_total.toLocaleString('fr-FR')}€ total
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Formateur */}
                    {session.trainers && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>
                          Formateur : {session.trainers.first_name} {session.trainers.last_name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Badge alerte si minimum non atteint */}
                  {session.confirmed_participants < (session.min_participants || 4) && 
                   isAfter(startDate, today) && (
                    <div className="flex-shrink-0">
                      <div className="bg-orange-100 text-orange-700 px-3 py-2 rounded-lg text-sm font-medium">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        Min non atteint
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
