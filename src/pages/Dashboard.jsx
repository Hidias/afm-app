import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { 
  Building2, GraduationCap, Users, Calendar, FileText, ArrowRight, 
  CheckCircle, AlertTriangle, UserCheck, AlertCircle, 
  Send, Clock, User, XCircle, Shield, Trash2, ExternalLink
} from 'lucide-react'
import { format, isAfter, isBefore, startOfToday, addDays, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Dashboard() {
  const { 
    clients, fetchClients, courses, fetchCourses, trainees, fetchTrainees,
    sessions, fetchSessions, getPurgeStats
  } = useDataStore()
  const navigate = useNavigate()
  
  const [nonConformites, setNonConformites] = useState([])
  const [qualityAlerts, setQualityAlerts] = useState([])
  const [purgeStats, setPurgeStats] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadData()
  }, [])
  
  // Mise à jour automatique du statut des sessions terminées
  useEffect(() => {
    const updateCompletedSessions = async () => {
      if (sessions.length === 0) return
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const sessionsToComplete = sessions.filter(s => {
        if (s.status === 'completed' || s.status_locked) return false
        if (!s.end_date) return false
        
        const endDate = new Date(s.end_date)
        endDate.setHours(0, 0, 0, 0)
        const dayAfterEnd = new Date(endDate)
        dayAfterEnd.setDate(dayAfterEnd.getDate() + 1)
        
        return today >= dayAfterEnd
      })
      
      for (const session of sessionsToComplete) {
        await supabase
          .from('sessions')
          .update({ status: 'completed' })
          .eq('id', session.id)
      }
      
      if (sessionsToComplete.length > 0) {
        fetchSessions()
      }
    }
    
    updateCompletedSessions()
  }, [sessions.length])
  
  const loadData = async () => {
    await Promise.all([fetchClients(), fetchCourses(), fetchTrainees(), fetchSessions()])
    
    // Charger les non-conformités ouvertes
    const { data: nc } = await supabase
      .from('non_conformites')
      .select('*')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
    setNonConformites(nc || [])
    
    // Charger les alertes qualité non traitées (sans jointures)
    const { data: alerts } = await supabase
      .from('quality_alerts')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10)
    
    // Enrichir les alertes avec les infos de session/stagiaire (SANS JOINTURES)
    if (alerts && alerts.length > 0) {
      const sessionIds = [...new Set(alerts.map(a => a.session_id).filter(Boolean))]
      const traineeIds = [...new Set(alerts.map(a => a.trainee_id).filter(Boolean))]
      
      // Requêtes simples SANS jointures
      const [sessionsResult, traineesResult] = await Promise.all([
        sessionIds.length > 0 
          ? supabase.from('sessions').select('id, reference, course_id').in('id', sessionIds)
          : { data: [] },
        traineeIds.length > 0
          ? supabase.from('trainees').select('id, first_name, last_name').in('id', traineeIds)
          : { data: [] }
      ])
      
      // Récupérer les noms des formations séparément
      const courseIds = [...new Set((sessionsResult.data || []).map(s => s.course_id).filter(Boolean))]
      const coursesResult = courseIds.length > 0
        ? await supabase.from('courses').select('id, name').in('id', courseIds)
        : { data: [] }
      
      const coursesMap = {}
      ;(coursesResult.data || []).forEach(c => { coursesMap[c.id] = c })
      
      const sessionsMap = {}
      ;(sessionsResult.data || []).forEach(s => { 
        sessionsMap[s.id] = {
          ...s,
          courses: coursesMap[s.course_id] || null
        }
      })
      
      const traineesMap = {}
      ;(traineesResult.data || []).forEach(t => { traineesMap[t.id] = t })
      
      const enrichedAlerts = alerts.map(alert => ({
        ...alert,
        sessions: sessionsMap[alert.session_id] || null,
        trainees: traineesMap[alert.trainee_id] || null
      }))
      
      setQualityAlerts(enrichedAlerts)
    } else {
      setQualityAlerts([])
    }
    
    // Charger les stats de purge RGPD
    try {
      const { data: stats } = await getPurgeStats()
      if (stats && stats.length > 0) {
        setPurgeStats(stats[0])
      }
    } catch (e) {
      console.warn('Purge stats not available:', e)
    }
    
    setLoading(false)
  }
  
  // Générer les notifications automatiques (rappels hebdomadaires)
  useEffect(() => {
    const generateAutoNotifications = async () => {
      const today = new Date()
      const dayOfWeek = today.getDay() // 0=dimanche, 1=lundi, 6=samedi
      const dayOfMonth = today.getDate()
      const month = today.getMonth() + 1 // 1-12
      const todayKey = format(today, 'yyyy-MM-dd')
      
      // Vérifier si on a déjà généré les notifs aujourd'hui (via localStorage)
      const lastGenKey = `notif_gen_${todayKey}`
      if (localStorage.getItem(lastGenKey)) return
      
      const notificationsToCreate = []
      
      // Lundi = rappel veille
      if (dayOfWeek === 1) {
        notificationsToCreate.push({
          type: 'veille',
          title: 'Veille réglementaire à réaliser',
          message: 'Rappel hebdomadaire : effectuez votre veille Qualiopi',
          link: '/veille-qualiopi'
        })
      }
      
      // Samedi = vérification matériel
      if (dayOfWeek === 6) {
        notificationsToCreate.push({
          type: 'materiel',
          title: 'Vérification matériel',
          message: 'Rappel hebdomadaire : vérifiez le matériel de formation',
          link: '/parametres'
        })
      }
      
      // 1er juillet = audit interne
      if (dayOfMonth === 1 && month === 7) {
        notificationsToCreate.push({
          type: 'audit',
          title: 'Audit interne annuel',
          message: 'C\'est le moment de planifier votre audit interne Qualiopi',
          link: '/qualiopi'
        })
      }
      
      // 1er août = revue de direction
      if (dayOfMonth === 1 && month === 8) {
        notificationsToCreate.push({
          type: 'revue_direction',
          title: 'Revue de direction annuelle',
          message: 'Rappel : la revue de direction annuelle doit être réalisée',
          link: '/qualiopi'
        })
      }
      
      // Créer les notifications
      if (notificationsToCreate.length > 0) {
        for (const notif of notificationsToCreate) {
          await supabase.from('notifications').insert(notif)
        }
      }
      
      // Marquer comme fait pour aujourd'hui
      localStorage.setItem(lastGenKey, 'done')
    }
    
    // Exécuter après le chargement initial
    if (!loading && sessions.length > 0) {
      generateAutoNotifications()
    }
  }, [loading, sessions.length])
  
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
  
  // Sessions à J+90 (évaluation à froid)
  const sessionsJ90 = sessions.filter(s => {
    if (s.status !== 'completed') return false
    if (!s.end_date) return false
    const endDate = new Date(s.end_date)
    const daysSinceEnd = differenceInDays(today, endDate)
    return daysSinceEnd >= 85 && daysSinceEnd <= 95 // Fenêtre de 10 jours autour de J+90
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
      </div>
      
      {/* Alertes prioritaires */}
      {(sessionsWithoutTrainer.length > 0 || nonConformites.length > 0 || sessionsInProgress.length > 0 || (purgeStats && purgeStats.trainees_to_purge > 0) || sessionsJ90.length > 0) && (
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
          
          {sessionsJ90.length > 0 && (
            <div className="card bg-teal-50 border-teal-200 border p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-teal-500" />
                <div>
                  <p className="font-semibold text-teal-700">Évaluation à froid (J+90)</p>
                  <p className="text-2xl font-bold text-teal-600">{sessionsJ90.length}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {sessionsJ90.slice(0, 3).map(s => (
                  <Link key={s.id} to={`/sessions/${s.id}`} className="block text-sm text-teal-700 hover:underline">
                    • {s.courses?.title} - Fin: {format(new Date(s.end_date), 'd MMM', { locale: fr })}
                  </Link>
                ))}
                {sessionsJ90.length > 3 && (
                  <p className="text-xs text-teal-500">+ {sessionsJ90.length - 3} autres...</p>
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
          
          {purgeStats && purgeStats.trainees_to_purge > 0 && (
            <div className="card bg-purple-50 border-purple-200 border p-4">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="font-semibold text-purple-700">RGPD - Stagiaires à purger</p>
                  <p className="text-2xl font-bold text-purple-600">{purgeStats.trainees_to_purge}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-purple-600">
                Stagiaires sans formation depuis + de 5 ans
              </p>
              <Link to="/stagiaires" className="mt-2 inline-flex items-center gap-1 text-sm text-purple-700 hover:underline">
                Voir la liste <ArrowRight className="w-3 h-3" />
              </Link>
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
        
        {/* Alertes Qualité */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Alertes Qualité
              {qualityAlerts.length > 0 && (
                <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{qualityAlerts.length}</span>
              )}
            </h2>
            <Link to="/indicateurs" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Voir tout <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {qualityAlerts.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Aucune alerte qualité en attente</p>
              <p className="text-xs text-gray-400">Les notes de 1 à 3 génèrent des alertes</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {qualityAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className="p-3 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/sessions/${alert.session_id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${alert.score === 1 ? 'bg-red-500 text-white' : alert.score === 2 ? 'bg-orange-500 text-white' : 'bg-yellow-500 text-white'}`}>
                          {alert.score}/5
                        </span>
                        <span className="font-medium text-sm truncate">{alert.criterion_label}</span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {alert.sessions?.reference} - {alert.trainees?.first_name} {alert.trainees?.last_name}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                  </div>
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
          <Link to="/non-conformites" className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors">
            <AlertTriangle className="w-5 h-5 text-orange-600" /><span className="font-medium text-gray-700">Non-conformités</span>
          </Link>
        </div>
      </div>
      
      {/* Mention légale */}
      <div className="text-center text-xs text-gray-400 p-4 bg-primary-500/5 rounded-lg border border-primary-500/10">
        <p className="font-medium text-primary-600">Access Campus - Version 2.5.21</p>
        <p>© {new Date().getFullYear()} Access Formation - Tous droits réservés</p>
        <p>Données protégées conformément au RGPD</p>
      </div>
    </div>
  )
}
