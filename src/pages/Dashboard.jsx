import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { 
  Building2, 
  GraduationCap, 
  Users, 
  Calendar,
  FileText,
  ClipboardList,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle
} from 'lucide-react'
import { format, isAfter, isBefore, startOfToday, endOfMonth, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Dashboard() {
  const { 
    clients, fetchClients,
    courses, fetchCourses,
    trainees, fetchTrainees,
    sessions, fetchSessions,
    documents, fetchDocuments
  } = useDataStore()
  
  useEffect(() => {
    fetchClients()
    fetchCourses()
    fetchTrainees()
    fetchSessions()
    fetchDocuments()
  }, [])
  
  const today = startOfToday()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  
  // Sessions en cours
  const activeSessions = sessions.filter(s => 
    s.status === 'in_progress' || 
    (s.status === 'planned' && isBefore(new Date(s.start_date), today))
  )
  
  // Sessions ce mois-ci
  const monthSessions = sessions.filter(s => {
    const start = new Date(s.start_date)
    return isAfter(start, monthStart) && isBefore(start, monthEnd)
  })
  
  // Sessions à venir
  const upcomingSessions = sessions
    .filter(s => s.status === 'planned' && isAfter(new Date(s.start_date), today))
    .slice(0, 5)
  
  // Stats
  const stats = [
    { 
      name: 'Clients', 
      value: clients.length, 
      icon: Building2, 
      href: '/clients',
      color: 'bg-blue-500'
    },
    { 
      name: 'Formations', 
      value: courses.length, 
      icon: GraduationCap, 
      href: '/formations',
      color: 'bg-purple-500'
    },
    { 
      name: 'Stagiaires', 
      value: trainees.length, 
      icon: Users, 
      href: '/stagiaires',
      color: 'bg-green-500'
    },
    { 
      name: 'Sessions ce mois', 
      value: monthSessions.length, 
      icon: Calendar, 
      href: '/sessions',
      color: 'bg-orange-500'
    },
  ]
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 mt-1">
          {format(today, "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="card hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.name}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {/* Contenu principal */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sessions à venir */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Sessions à venir</h2>
            <Link to="/sessions" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Voir tout <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {upcomingSessions.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Aucune session planifiée</p>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/sessions/${session.id}`}
                  className="block p-3 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {session.courses?.title || 'Formation'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {session.clients?.name}
                      </p>
                    </div>
                    <span className="badge badge-blue">
                      {format(new Date(session.start_date), 'd MMM', { locale: fr })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        
        {/* Activité récente */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Documents récents</h2>
            <Link to="/documents" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Voir tout <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {documents.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Aucun document</p>
          ) : (
            <div className="space-y-3">
              {documents.slice(0, 5).map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-100"
                >
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.number}</p>
                    <p className="text-sm text-gray-500">{doc.doc_type}</p>
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
      </div>
      
      {/* Raccourcis */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            to="/sessions"
            state={{ openNew: true }}
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
          >
            <Calendar className="w-5 h-5 text-primary-600" />
            <span className="font-medium text-gray-700">Nouvelle session</span>
          </Link>
          
          <Link
            to="/clients"
            state={{ openNew: true }}
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
          >
            <Building2 className="w-5 h-5 text-primary-600" />
            <span className="font-medium text-gray-700">Nouveau client</span>
          </Link>
          
          <Link
            to="/stagiaires"
            state={{ openNew: true }}
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
          >
            <Users className="w-5 h-5 text-primary-600" />
            <span className="font-medium text-gray-700">Nouveau stagiaire</span>
          </Link>
          
          <Link
            to="/formations"
            state={{ openNew: true }}
            className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
          >
            <GraduationCap className="w-5 h-5 text-primary-600" />
            <span className="font-medium text-gray-700">Nouvelle formation</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
