import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { 
  Building2, GraduationCap, Users, Calendar, FileText, ArrowRight, 
  CheckCircle, AlertCircle, Download, ThumbsUp, UserCheck, ClipboardCheck, 
  MessageSquare, Award, Shield
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
    fetchGlobalStats, fetchCompletudeReport, fetchQualiopiReport
  } = useDataStore()
  
  const [globalStats, setGlobalStats] = useState({ tauxSatisfaction: 0, tauxRecommandation: 0, tauxPresence: 0, tauxReponse: 0 })
  const [completude, setCompletude] = useState(100)
  const [completudeReport, setCompletudeReport] = useState([])
  const [qualiopiScore, setQualiopiScore] = useState(100)
  const [qualiopiIssues, setQualiopiIssues] = useState([])
  const [showCompletudeModal, setShowCompletudeModal] = useState(false)
  const [showQualiopiModal, setShowQualiopiModal] = useState(false)
  
  useEffect(() => {
    fetchClients(); fetchCourses(); fetchTrainees(); fetchSessions(); fetchDocuments()
    fetchGlobalStats().then(setGlobalStats)
    fetchCompletudeReport().then(r => { setCompletude(r.completude); setCompletudeReport(r.missing) })
    fetchQualiopiReport().then(r => { setQualiopiScore(r.score); setQualiopiIssues(r.issues) })
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
  
  const downloadReport = (type) => {
    const date = format(new Date(), 'dd/MM/yyyy HH:mm')
    let content = ''
    if (type === 'completude') {
      content = `RAPPORT DE COMPLÉTUDE\n${'='.repeat(40)}\nDate: ${date}\nTaux: ${completude}%\n\n`
      if (completudeReport.length === 0) content += 'Toutes les fiches sont complètes !'
      else completudeReport.forEach(i => { content += `${i.type}: ${i.name}\n  Manque: ${i.fields.join(', ')}\n\n` })
    } else {
      content = `RAPPORT QUALIOPI\n${'='.repeat(40)}\nDate: ${date}\nScore: ${qualiopiScore}%\n\n`
      if (qualiopiIssues.length === 0) content += 'Tous les indicateurs sont conformes !'
      else qualiopiIssues.forEach(i => { content += `Indicateur ${i.indicateur} - ${i.session}\n  ${i.probleme}\n\n` })
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `rapport_${type}_${format(new Date(), 'yyyyMMdd')}.txt`; a.click()
  }
  
  const getScoreColor = (val) => val >= 85 ? 'bg-green-100 text-green-700' : val >= 75 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 mt-1">{format(today, "EEEE d MMMM yyyy", { locale: fr })}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCompletudeModal(true)} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${getScoreColor(completude)}`}>
            <CheckCircle className="w-4 h-4" /> Complétude: {completude}%
          </button>
          <button onClick={() => setShowQualiopiModal(true)} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${getScoreColor(qualiopiScore)}`}>
            <Shield className="w-4 h-4" /> Qualiopi: {qualiopiScore}%
          </button>
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
        <p className="font-medium">Application de gestion Access Formation - Version 2.3</p>
        <p>© {new Date().getFullYear()} Access Formation - Tous droits réservés - Usage exclusif</p>
        <p>Données protégées conformément au RGPD</p>
      </div>
      
      {/* Modal Complétude */}
      {showCompletudeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCompletudeModal(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h2 className="text-lg font-semibold">Rapport de complétude</h2>
                  <p className={`text-sm ${completude >= 85 ? 'text-green-600' : completude >= 75 ? 'text-orange-600' : 'text-red-600'}`}>Taux: {completude}%</p>
                </div>
                <button onClick={() => downloadReport('completude')} className="btn btn-primary flex items-center gap-2"><Download className="w-4 h-4" /> Télécharger</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {completudeReport.length === 0 ? (
                  <div className="text-center py-8"><CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" /><p className="text-green-600 font-medium">Toutes les fiches sont complètes !</p></div>
                ) : (
                  <div className="space-y-3">
                    {completudeReport.map((item, idx) => (
                      <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4 text-red-500" /><span className="font-medium text-red-700">{item.type}: {item.name}</span></div>
                        <p className="text-sm text-red-600 ml-6">Manque: {item.fields.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t"><button onClick={() => setShowCompletudeModal(false)} className="btn btn-secondary w-full">Fermer</button></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Qualiopi */}
      {showQualiopiModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowQualiopiModal(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-blue-500" /> Conformité Qualiopi</h2>
                  <p className={`text-sm ${qualiopiScore >= 85 ? 'text-green-600' : qualiopiScore >= 75 ? 'text-orange-600' : 'text-red-600'}`}>Score: {qualiopiScore}%</p>
                </div>
                <button onClick={() => downloadReport('qualiopi')} className="btn btn-primary flex items-center gap-2"><Download className="w-4 h-4" /> Télécharger</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {qualiopiIssues.length === 0 ? (
                  <div className="text-center py-8"><CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" /><p className="text-green-600 font-medium">Tous les indicateurs sont conformes !</p></div>
                ) : (
                  <div className="space-y-3">
                    {qualiopiIssues.map((item, idx) => (
                      <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs font-bold rounded">Ind. {item.indicateur}</span>
                          <span className="font-medium text-amber-700">{item.session}</span>
                        </div>
                        <p className="text-sm text-amber-600 ml-6">{item.probleme}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t"><button onClick={() => setShowQualiopiModal(false)} className="btn btn-secondary w-full">Fermer</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
