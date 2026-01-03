import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { 
  Building2, GraduationCap, Users, Calendar, FileText, ArrowRight, 
  CheckCircle, AlertTriangle, UserCheck, AlertCircle, 
  Send, Clock, User, XCircle
} from 'lucide-react'
import { format, isAfter, isBefore, startOfToday, addDays, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Dashboard() {
  const { 
    clients, fetchClients, courses, fetchCourses, trainees, fetchTrainees,
    sessions, fetchSessions
  } = useDataStore()
  
  const [nonConformites, setNonConformites] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Horloge temps réel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  
  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    await Promise.all([fetchClients(), fetchCourses(), fetchTrainees(), fetchSessions()])
    
    // Charger les non-conformités ouvertes
    const { data: nc } = await supabase
      .from('non_conformites')
      .select('*')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
    setNonConformites(nc || [])
    
    setLoading(false)
  }
  
  const today = startOfToday()
  const next30Days = addDays(today, 30)
  
  // Sessions à venir (30 prochains jours)
  const upcomingSessions = sessions
    .filter(s => {
      const startDate = new Date(s.start_date)
      return s.status === 'planned' && isAfter(startDate, today) && isBefore(startDate, next30Days)
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
  
  // Sessions sans formateur
  const sessionsWithoutTrainer = sessions.filter(s => 
    (s.status === 'planned' || s.status === 'draft') && !s.trainer_id
  )
  
  // Sessions en cours (à surveiller)
  const sessionsInProgress = sessions.filter(s => s.status === 'in_progress')
  
  // Sessions terminées récemment (7 derniers jours)
  const recentlyCompleted = sessions.filter(s => {
    if (s.status !== 'completed') return false
    const endDate = new Date(s.end_date)
    const daysSinceEnd = differenceInDays(today, endDate)
    return daysSinceEnd >= 0 && daysSinceEnd <= 7
  })
  
  // Compteurs
  const completedSessions = sessions.filter(s => s.status === 'completed')
  const personnesFormees = completedSessions.reduce((total, s) => {
    return total + (s.session_trainees?.length || 0)
  }, 0)
  
  const stats = [
    { name: 'Personnes formées', value: personnesFormees, icon: UserCheck, href: '/sessions', color: 'bg-blue-500' },
    { name: 'Formations', value: courses.length, icon: GraduationCap, href: '/formations', color: 'bg-purple-500' },
    { name: 'Clients', value: clients.length, icon: Building2, href: '/clients', color: 'bg-green-500' },
    { name: 'Sessions réalisées', value: completedSessions.length, icon: CheckCircle, href: '/sessions', color: 'bg-orange-500' },
  ]
  
  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 mt-1">{format(today, "EEEE d MMMM yyyy", { locale: fr })}</p>
        </div>
        
        {/* Horloge temps réel */}
        <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border px-4 py-3">
          <Clock className="w-5 h-5 text-primary-500" />
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 font-mono tabular-nums">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs text-gray-500">Heure de Paris</p>
          </div>
        </div>
      </div>
      
      {/* Alertes prioritaires */}
      {(sessionsWithoutTrainer.length > 0 || nonConformites.length > 0 || sessionsInProgress.length > 0) && (
        <div className="grid md:grid-cols-3 gap-4">
          {sessionsWithoutTrainer.length > 0 && (
            <div className="card bg-red-50 border-red-200 border p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="font-semibold text-red-700">Sessions sans formateur</p>
                  <p className="text-2xl font-bold text-red-600">{sessionsWithoutTrainer.length}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {sessionsWithoutTrainer.slice(0, 3).map(s => (
                  <Link key={s.id} to={`/sessions/${s.id}`} className="block text-sm text-red-700 hover:underline">
                    • {s.courses?.title} - {format(new Date(s.start_date), 'd MMM', { locale: fr })}
                  </Link>
                ))}
                {sessionsWithoutTrainer.length > 3 && (
                  <p className="text-xs text-red-500">+ {sessionsWithoutTrainer.length - 3} autres...</p>
                )}
              </div>
            </div>
          )}
          
          {nonConformites.length > 0 && (
            <div className="card bg-orange-50 border-orange-200 border p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="font-semibold text-orange-700">Non-conformités ouvertes</p>
                  <p className="text-2xl font-bold text-orange-600">{nonConformites.length}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {nonConformites.slice(0, 3).map(nc => (
                  <Link key={nc.id} to="/non-conformites" className="block text-sm text-orange-700 hover:underline">
                    • {nc.title}
                  </Link>
                ))}
                {nonConformites.length > 3 && (
                  <p className="text-xs text-orange-500">+ {nonConformites.length - 3} autres...</p>
                )}
              </div>
            </div>
          )}
          
          {sessionsInProgress.length > 0 && (
            <div className="card bg-blue-50 border-blue-200 border p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="font-semibold text-blue-700">Sessions en cours</p>
                  <p className="text-2xl font-bold text-blue-600">{sessionsInProgress.length}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {sessionsInProgress.slice(0, 3).map(s => (
                  <Link key={s.id} to={`/sessions/${s.id}`} className="block text-sm text-blue-700 hover:underline">
                    • {s.courses?.title} - {s.clients?.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Stats compteurs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.name} to={stat.href} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className={`${stat.color} p-3 rounded-lg`}><stat.icon className="w-6 h-6 text-white" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.name}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sessions à venir */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-500" />
              Sessions à venir (30 jours)
            </h2>
            <Link to="/sessions" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Voir tout <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {upcomingSessions.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Aucune session planifiée</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {upcomingSessions.map((session) => {
                const daysUntil = differenceInDays(new Date(session.start_date), today)
                return (
                  <Link key={session.id} to={`/sessions/${session.id}`} className="block p-3 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{session.courses?.title || 'Formation'}</p>
                        <p className="text-sm text-gray-500 truncate">{session.clients?.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {session.trainer_id ? (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <User className="w-3 h-3" /> Formateur assigné
                            </span>
                          ) : (
                            <span className="text-xs text-red-600 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Sans formateur
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <span className={`badge ${daysUntil <= 7 ? 'badge-red' : daysUntil <= 14 ? 'badge-yellow' : 'badge-blue'}`}>
                          {format(new Date(session.start_date), 'd MMM', { locale: fr })}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">J-{daysUntil}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
        
        {/* Sessions terminées récemment */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Terminées récemment
            </h2>
            <Link to="/sessions" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Voir tout <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {recentlyCompleted.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Aucune session terminée récemment</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentlyCompleted.map((session) => (
                <Link key={session.id} to={`/sessions/${session.id}`} className="block p-3 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{session.courses?.title || 'Formation'}</p>
                      <p className="text-sm text-gray-500 truncate">{session.clients?.name}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {session.session_trainees?.length || 0} stagiaire(s)
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <span className="badge badge-green">
                        {format(new Date(session.end_date), 'd MMM', { locale: fr })}
                      </span>
                      <p className="text-xs text-green-600 mt-1 flex items-center justify-end gap-1">
                        <Send className="w-3 h-3" /> À finaliser
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Actions rapides */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link to="/sessions" state={{ openNew: true }} className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <Calendar className="w-5 h-5 text-primary-600" /><span className="font-medium text-gray-700">Nouvelle session</span>
          </Link>
          <Link to="/clients" state={{ openNew: true }} className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <Building2 className="w-5 h-5 text-primary-600" /><span className="font-medium text-gray-700">Nouveau client</span>
          </Link>
          <Link to="/stagiaires" state={{ openNew: true }} className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <Users className="w-5 h-5 text-primary-600" /><span className="font-medium text-gray-700">Nouveau stagiaire</span>
          </Link>
          <Link to="/non-conformites" className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors">
            <AlertTriangle className="w-5 h-5 text-orange-600" /><span className="font-medium text-gray-700">Non-conformités</span>
          </Link>
        </div>
      </div>
      
      {/* Mention légale */}
      <div className="text-center text-xs text-gray-400 p-4 bg-primary-500/5 rounded-lg border border-primary-500/10">
        <p className="font-medium text-primary-600">Access Campus - Version 2.5.12</p>
        <p>© {new Date().getFullYear()} Access Formation - Tous droits réservés</p>
        <p>Données protégées conformément au RGPD</p>
      </div>
    </div>
  )
}
