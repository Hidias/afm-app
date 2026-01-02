import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { 
  Building2, GraduationCap, Users, Calendar, FileText, ArrowRight, 
  CheckCircle, ThumbsUp, UserCheck, ClipboardCheck, 
  MessageSquare, Award
} from 'lucide-react'
import { format, isAfter, isBefore, startOfToday, endOfMonth, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'

function StatBar({ label, value, icon: Icon }) {
  const getColor = (val) => val >= 85 ? 'bg-green-500' : val >= 75 ? 'bg-orange-500' : 'bg-red-500'
  const getBgColor = (val) => val >= 85 ? 'bg-green-100' : val >= 75 ? 'bg-orange-100' : 'bg-red-100'
  const getTextColor = (val) => val >= 85 ? 'text-green-600' : val >= 75 ? 'text-orange-600' : 'text-red-600'
  
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${getBgColor(value)}`}>
        <Icon className={`w-5 h-5 ${getTextColor(value)}`} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className={`text-sm font-bold ${getTextColor(value)}`}>{value}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${getColor(value)} rounded-full transition-all duration-500`} style={{ width: `${Math.min(value, 100)}%` }} />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { 
    clients, fetchClients, courses, fetchCourses, trainees, fetchTrainees,
    sessions, fetchSessions, documents, fetchDocuments,
    fetchGlobalStats
  } = useDataStore()
  
  const [globalStats, setGlobalStats] = useState({ tauxSatisfaction: 0, tauxRecommandation: 0, tauxPresence: 0, tauxReponse: 0 })
  
  useEffect(() => {
    fetchClients(); fetchCourses(); fetchTrainees(); fetchSessions(); fetchDocuments()
    fetchGlobalStats().then(setGlobalStats)
  }, [])
  
  const today = startOfToday()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  
  const monthSessions = sessions.filter(s => {
    const start = new Date(s.start_date)
    return isAfter(start, monthStart) && isBefore(start, monthEnd)
  })
  
  // Calculer le nombre de personnes formées (sessions terminées)
  const completedSessions = sessions.filter(s => s.status === 'completed')
  const personnesFormees = completedSessions.reduce((total, s) => {
    return total + (s.session_trainees?.length || 0)
  }, 0)
  
  const upcomingSessions = sessions.filter(s => s.status === 'planned' && isAfter(new Date(s.start_date), today)).slice(0, 5)
  
  const stats = [
    { name: 'Personnes formées', value: personnesFormees, icon: UserCheck, href: '/sessions', color: 'bg-blue-500' },
    { name: 'Formations', value: courses.length, icon: GraduationCap, href: '/formations', color: 'bg-purple-500' },
    { name: 'Sessions réalisées', value: completedSessions.length, icon: CheckCircle, href: '/sessions', color: 'bg-green-500' },
    { name: 'Sessions ce mois', value: monthSessions.length, icon: Calendar, href: '/sessions', color: 'bg-orange-500' },
  ]
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 mt-1">{format(today, "EEEE d MMMM yyyy", { locale: fr })}</p>
        </div>
      </div>
      
      {/* Indicateurs Qualiopi */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" /> Indicateurs de résultats
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <StatBar label="Taux de satisfaction" value={globalStats.tauxSatisfaction} icon={ThumbsUp} />
          <StatBar label="Taux de recommandation" value={globalStats.tauxRecommandation} icon={MessageSquare} />
          <StatBar label="Taux de présence" value={globalStats.tauxPresence} icon={UserCheck} />
          <StatBar label="Taux de réponse questionnaires" value={globalStats.tauxReponse} icon={ClipboardCheck} />
        </div>
      </div>
      
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
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Sessions à venir</h2>
            <Link to="/sessions" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">Voir tout <ArrowRight className="w-4 h-4" /></Link>
          </div>
          {upcomingSessions.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Aucune session planifiée</p>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <Link key={session.id} to={`/sessions/${session.id}`} className="block p-3 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{session.courses?.title || 'Formation'}</p>
                      <p className="text-sm text-gray-500">{session.clients?.name}</p>
                    </div>
                    <span className="badge badge-blue">{format(new Date(session.start_date), 'd MMM', { locale: fr })}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Documents récents</h2>
            <Link to="/documents" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">Voir tout <ArrowRight className="w-4 h-4" /></Link>
          </div>
          {documents.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Aucun document</p>
          ) : (
            <div className="space-y-3">
              {documents.slice(0, 5).map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                  <div className="p-2 bg-gray-100 rounded-lg"><FileText className="w-5 h-5 text-gray-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.number}</p>
                    <p className="text-sm text-gray-500">{doc.doc_type}</p>
                  </div>
                  <span className="badge badge-green"><CheckCircle className="w-3 h-3 mr-1" />Prêt</span>
                </div>
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
          <Link to="/documents-vierges" className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <FileText className="w-5 h-5 text-primary-600" /><span className="font-medium text-gray-700">Documents vierges</span>
          </Link>
        </div>
      </div>
      
      {/* Mention légale */}
      <div className="text-center text-xs text-gray-400 p-4 bg-gray-50 rounded-lg">
        <p className="font-medium">Application de gestion Access Formation - Version 2.5.5</p>
        <p>© {new Date().getFullYear()} Access Formation - Tous droits réservés - Usage exclusif</p>
        <p>Données protégées conformément au RGPD</p>
      </div>
    </div>
  )
}
