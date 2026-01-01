import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  FileCheck,
  ThumbsUp,
  Clock,
  ClipboardCheck,
} from 'lucide-react'

function StatCard({ title, value, icon: Icon, color, link, subtitle }) {
  const getColorClass = (val) => {
    if (val >= 85) return 'completeness-green'
    if (val >= 75) return 'completeness-orange'
    return 'completeness-red'
  }
  
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    dynamic: getColorClass(value),
  }

  const content = (
    <div className={`bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow ${link ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${color === 'dynamic' ? getColorClass(value).split(' ')[0].replace('bg-', 'text-').replace('-50', '-600') : ''}`}>
            {typeof value === 'number' && title.includes('%') ? `${value}%` : value}
            {typeof value === 'number' && !title.includes('%') && subtitle !== false && '%'}
          </p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color] || colorClasses.blue}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )

  if (link) {
    return <Link to={link}>{content}</Link>
  }
  return content
}

export default function Dashboard() {
  const { sessions, clients, trainees, stats, loadAllData, calculateStats } = useStore()

  useEffect(() => {
    calculateStats()
  }, [sessions, clients, trainees])

  // Sessions à venir
  const upcomingSessions = sessions
    .filter(s => new Date(s.start_date) >= new Date() && s.status !== 'cancelled')
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 5)

  // Sessions en cours
  const activeSessions = sessions.filter(s => s.status === 'in_progress')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500">Vue d'ensemble de votre activité de formation</p>
      </div>

      {/* Indicateurs de complétude cliquables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          title="Complétude Dossiers"
          value={stats.completionDossiers}
          icon={FileCheck}
          color="dynamic"
          link="/completude"
          subtitle="Cliquez pour voir les détails"
        />
        <StatCard
          title="Complétude Qualiopi"
          value={stats.completionQualiopi}
          icon={CheckCircle}
          color="dynamic"
          link="/qualiopi"
          subtitle="Cliquez pour voir les détails"
        />
      </div>

      {/* Indicateurs de performance */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Indicateurs de performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Taux de satisfaction"
            value={stats.satisfactionRate}
            icon={ThumbsUp}
            color="dynamic"
          />
          <StatCard
            title="Taux de recommandation"
            value={stats.recommendationRate}
            icon={TrendingUp}
            color="dynamic"
          />
          <StatCard
            title="Taux de présence"
            value={stats.presenceRate}
            icon={Clock}
            color="dynamic"
          />
          <StatCard
            title="Questionnaires remplis"
            value={stats.questionnaireRate}
            icon={ClipboardCheck}
            color="dynamic"
          />
        </div>
      </div>

      {/* Statistiques générales */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Vue d'ensemble</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Sessions totales"
            value={sessions.length}
            icon={Calendar}
            color="blue"
            subtitle={false}
          />
          <StatCard
            title="Sessions en cours"
            value={activeSessions.length}
            icon={BarChart3}
            color="green"
            subtitle={false}
          />
          <StatCard
            title="Clients"
            value={clients.length}
            icon={Users}
            color="purple"
            subtitle={false}
          />
          <StatCard
            title="Stagiaires"
            value={trainees.length}
            icon={Users}
            color="orange"
            subtitle={false}
          />
        </div>
      </div>

      {/* Sessions à venir */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Sessions à venir</h2>
          <Link to="/sessions" className="text-sm text-primary-600 hover:text-primary-700">
            Voir toutes →
          </Link>
        </div>
        
        {upcomingSessions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune session à venir</p>
        ) : (
          <div className="space-y-3">
            {upcomingSessions.map((session) => (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {session.reference} - {session.course?.title}
                  </p>
                  <p className="text-sm text-gray-500">
                    {session.client?.name} • {session.session_trainees?.length || 0} stagiaire(s)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(session.start_date), 'dd MMM yyyy', { locale: fr })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {session.trainer?.first_name} {session.trainer?.last_name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Légende notation */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Légende des notations</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-700 rounded font-bold">1</span>
            <span className="text-sm text-gray-600">Très insuffisant</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center bg-orange-100 text-orange-700 rounded font-bold">2</span>
            <span className="text-sm text-gray-600">Passable</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center bg-yellow-100 text-yellow-700 rounded font-bold">3</span>
            <span className="text-sm text-gray-600">Moyen</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center bg-lime-100 text-lime-700 rounded font-bold">4</span>
            <span className="text-sm text-gray-600">Satisfaisant</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-700 rounded font-bold">5</span>
            <span className="text-sm text-gray-600">Très satisfaisant</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-500">
            <span className="inline-block w-3 h-3 rounded bg-green-500 mr-2"></span>
            85-100% : Conforme
            <span className="inline-block w-3 h-3 rounded bg-orange-500 ml-4 mr-2"></span>
            75-84% : À surveiller
            <span className="inline-block w-3 h-3 rounded bg-red-500 ml-4 mr-2"></span>
            &lt;75% : Non conforme
          </p>
        </div>
      </div>
    </div>
  )
}
