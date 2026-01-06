import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { 
  BarChart3, Filter, Users, Star, TrendingUp, ThumbsUp, 
  Thermometer, Clock, Building, BookOpen, UserCheck, Target,
  Send, CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const ratingColor = (value, max = 5) => {
  const percent = (value / max) * 100
  if (percent >= 80) return 'text-green-600 bg-green-100'
  if (percent >= 60) return 'text-yellow-600 bg-yellow-100'
  return 'text-red-600 bg-red-100'
}

const ratingBg = (value, max = 5) => {
  const percent = (value / max) * 100
  if (percent >= 80) return 'bg-green-500'
  if (percent >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function Indicateurs() {
  const { sessions, fetchSessions, clients, fetchClients } = useDataStore()
  
  const [loading, setLoading] = useState(true)
  const [themes, setThemes] = useState([])
  const [traineeEvals, setTraineeEvals] = useState([])
  const [trainerEvals, setTrainerEvals] = useState([])
  const [coldEvals, setColdEvals] = useState([])
  const [traineeResults, setTraineeResults] = useState([])
  
  // Filtres
  const [filterTheme, setFilterTheme] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('all') // all, year, quarter, month
  
  const [activeTab, setActiveTab] = useState('hot') // hot, trainer, cold
  
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
        await fetchSessions()
        // Recharger les données pour mettre à jour les indicateurs
        loadData()
      }
    }
    
    updateCompletedSessions()
  }, [sessions.length])
  
  const loadData = async () => {
    setLoading(true)
    await Promise.all([fetchSessions(), fetchClients()])
    
    // Charger les thèmes
    const { data: themesData } = await supabase.from('training_themes').select('*').order('position')
    setThemes(themesData || [])
    
    // Charger toutes les évaluations
    const { data: hotEvals } = await supabase.from('trainee_evaluations').select('*')
    setTraineeEvals(hotEvals || [])
    
    const { data: tEvals } = await supabase.from('trainer_evaluations').select('*')
    setTrainerEvals(tEvals || [])
    
    const { data: cEvals } = await supabase.from('evaluations_cold').select('*')
    setColdEvals(cEvals || [])
    
    // Charger les résultats des stagiaires (Acquis/Non acquis) et présence
    const { data: results } = await supabase.from('session_trainees').select('session_id, trainee_id, result, presence_complete')
    setTraineeResults(results || [])
    
    setLoading(false)
  }
  
  // Filtrer les sessions selon les critères
  const getFilteredSessions = () => {
    let filtered = sessions.filter(s => s.status === 'completed')
    
    if (filterTheme) {
      filtered = filtered.filter(s => s.courses?.theme_id === filterTheme)
    }
    if (filterClient) {
      filtered = filtered.filter(s => s.client_id === filterClient)
    }
    if (filterPeriod !== 'all') {
      const now = new Date()
      let startDate
      if (filterPeriod === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1)
      } else if (filterPeriod === 'quarter') {
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
      } else if (filterPeriod === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      }
      filtered = filtered.filter(s => new Date(s.end_date) >= startDate)
    }
    
    return filtered
  }
  
  const filteredSessions = getFilteredSessions()
  const filteredSessionIds = filteredSessions.map(s => s.id)
  
  // Évaluations à chaud filtrées
  const filteredHotEvals = traineeEvals.filter(e => filteredSessionIds.includes(e.session_id))
  
  // Évaluations formateur filtrées
  const filteredTrainerEvals = trainerEvals.filter(e => filteredSessionIds.includes(e.session_id))
  
  // Évaluations à froid filtrées
  const filteredColdEvals = coldEvals.filter(e => filteredSessionIds.includes(e.session_id))
  
  // Calcul des moyennes pour évaluations à chaud (Qualiopi complet)
  const calcHotStats = () => {
    if (filteredHotEvals.length === 0) return null
    
    // Critères Qualiopi - utilise UNIQUEMENT les nouvelles colonnes (saisie manuelle)
    const criteriaGroups = [
      { 
        label: 'Organisation et accueil', 
        keys: ['q_org_accueil', 'q_org_documents', 'q_org_locaux', 'q_org_materiel'] 
      },
      { 
        label: 'Contenu et supports', 
        keys: ['q_contenu_supports', 'q_contenu_programme', 'q_contenu_organisation', 'q_contenu_duree'] 
      },
      { 
        label: 'Formateur / Pédagogie', 
        keys: ['q_formateur_pedagogie', 'q_formateur_expertise', 'q_formateur_progression', 'q_formateur_moyens'] 
      },
      { 
        label: 'Adéquation et compétences', 
        keys: ['q_global_adequation', 'q_global_competences'] 
      },
    ]
    
    // Calculer la moyenne pour chaque groupe
    const stats = criteriaGroups.map(group => {
      const allValues = []
      filteredHotEvals.forEach(e => {
        group.keys.forEach(key => {
          if (e[key] !== null && e[key] !== undefined && !isNaN(e[key])) {
            allValues.push(Number(e[key]))
          }
        })
      })
      const avg = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0
      return { label: group.label, avg: avg.toFixed(1), count: allValues.length }
    })
    
    // Calculer la satisfaction globale (moyenne de TOUTES les nouvelles colonnes uniquement)
    const allScores = []
    filteredHotEvals.forEach(e => {
      const newKeys = [
        'q_org_accueil', 'q_org_documents', 'q_org_locaux', 'q_org_materiel',
        'q_contenu_supports', 'q_contenu_programme', 'q_contenu_organisation', 'q_contenu_duree',
        'q_formateur_pedagogie', 'q_formateur_expertise', 'q_formateur_progression', 'q_formateur_moyens',
        'q_global_adequation', 'q_global_competences'
      ]
      newKeys.forEach(key => {
        if (e[key] !== null && e[key] !== undefined && !isNaN(e[key])) {
          allScores.push(Number(e[key]))
        }
      })
    })
    const globalAvg = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '0'
    
    // Taux de recommandation
    const evalsWithRecommend = filteredHotEvals.filter(e => e.would_recommend !== null && e.would_recommend !== undefined)
    const recommendCount = evalsWithRecommend.filter(e => e.would_recommend === true).length
    const recommendRate = evalsWithRecommend.length > 0 
      ? (recommendCount / evalsWithRecommend.length * 100).toFixed(0)
      : 0
    
    // Évaluations avec au moins une réponse (nouvelles colonnes)
    const evalsWithData = filteredHotEvals.filter(e => 
      e.q_org_accueil !== null ||
      e.q_formateur_pedagogie !== null ||
      e.q_global_adequation !== null
    )
    const questionnaireRate = filteredHotEvals.length > 0
      ? (evalsWithData.length / filteredHotEvals.length * 100).toFixed(0)
      : 0
    
    return { 
      stats,
      globalAvg,
      recommendRate, 
      questionnaireRate,
      totalWithResponse: evalsWithData.length,
      total: filteredHotEvals.length 
    }
  }
  
  // Calcul des moyennes pour évaluations formateur
  const calcTrainerStats = () => {
    if (filteredTrainerEvals.length === 0) return null
    
    const questions = [
      { key: 'group_motivation', label: 'Motivation du groupe' },
      { key: 'group_level', label: 'Niveau des stagiaires' },
      { key: 'material_conditions', label: 'Conditions matérielles' },
      { key: 'organization', label: 'Organisation' },
      { key: 'documentation', label: 'Documentation fournie' },
      { key: 'overall_score', label: 'Appréciation globale' },
    ]
    
    const stats = questions.map(q => {
      const values = filteredTrainerEvals.map(e => e[q.key]).filter(v => v !== null && v !== undefined)
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
      return { ...q, avg: avg.toFixed(1), count: values.length }
    })
    
    const objectivesValues = filteredTrainerEvals.map(e => e.objectives_achieved).filter(v => v !== null)
    const avgObjectives = objectivesValues.length > 0 
      ? (objectivesValues.reduce((a, b) => a + b, 0) / objectivesValues.length).toFixed(0)
      : 0
    
    return { stats, avgObjectives, total: filteredTrainerEvals.length }
  }
  
  // Calcul des taux pour évaluations à froid (5=Oui, 1=Non)
  const calcColdStats = () => {
    // Total stagiaires des sessions terminées (base pour le taux d'envoi)
    const completedSessionIds = filteredSessions.filter(s => s.status === 'completed').map(s => s.id)
    const totalTraineesInCompleted = traineeResults.filter(r => completedSessionIds.includes(r.session_id)).length
    
    if (totalTraineesInCompleted === 0) return null
    
    // Évaluations à froid des sessions filtrées
    const coldEvalsFiltered = coldEvals.filter(e => completedSessionIds.includes(e.session_id))
    
    // Taux d'envoi : combien ont été envoyées / total stagiaires
    const sentCount = coldEvalsFiltered.filter(e => e.sent_at).length
    const sendRate = (sentCount / totalTraineesInCompleted * 100).toFixed(0)
    
    // Taux de retour : combien reçues / envoyées
    const receivedCount = coldEvalsFiltered.filter(e => e.sent_at && e.completed_at).length
    const returnRate = sentCount > 0 ? (receivedCount / sentCount * 100).toFixed(0) : 0
    
    // Stats de satisfaction (uniquement sur les reçues)
    const receivedEvals = coldEvalsFiltered.filter(e => e.completed_at)
    
    const questions = [
      { key: 'skills_applied', label: 'Compétences mises en pratique' },
      { key: 'objectives_met', label: 'Objectifs atteints' },
      { key: 'knowledge_retained', label: 'Besoins satisfaits' },
      { key: 'job_impact', label: 'Amélioration du travail' },
    ]
    
    const stats = questions.map(q => {
      const responses = receivedEvals.filter(e => e[q.key] !== null && e[q.key] !== undefined)
      const yesCount = responses.filter(e => e[q.key] === 5 || e[q.key] === true).length
      const rate = responses.length > 0 ? (yesCount / responses.length * 100).toFixed(0) : 0
      return { ...q, rate, yesCount, count: responses.length }
    })
    
    // Recommandation (uniquement sur les reçues)
    const recommendCount = receivedEvals.filter(e => e.would_recommend === true).length
    const recommendResponses = receivedEvals.filter(e => e.would_recommend !== null && e.would_recommend !== undefined).length
    const recommendRate = recommendResponses > 0 
      ? (recommendCount / recommendResponses * 100).toFixed(0)
      : 0
    
    return { 
      stats, 
      recommendRate, 
      sendRate, 
      returnRate, 
      totalTrainees: totalTraineesInCompleted,
      sentCount,
      receivedCount,
      total: receivedEvals.length 
    }
  }
  
  // Calcul du taux de réussite (Acquis/Non acquis)
  const calcSuccessRate = () => {
    const completedSessionIds = filteredSessions.filter(s => s.status === 'completed').map(s => s.id)
    const filteredResults = traineeResults.filter(r => completedSessionIds.includes(r.session_id) && r.result)
    
    if (filteredResults.length === 0) return null
    
    const acquiredCount = filteredResults.filter(r => r.result === 'acquired').length
    const rate = (acquiredCount / filteredResults.length * 100).toFixed(0)
    
    return { rate, acquired: acquiredCount, total: filteredResults.length }
  }
  
  // Calcul du taux de présence (basé sur presence_complete)
  const calcPresenceRate = () => {
    const completedSessionIds = filteredSessions.filter(s => s.status === 'completed').map(s => s.id)
    const filteredResults = traineeResults.filter(r => completedSessionIds.includes(r.session_id))
    
    if (filteredResults.length === 0) return null
    
    const presentCount = filteredResults.filter(r => r.presence_complete === true).length
    const rate = (presentCount / filteredResults.length * 100).toFixed(0)
    
    return { rate, present: presentCount, total: filteredResults.length }
  }
  
  // Calcul du taux de recommandation global
  const calcGlobalRecommendRate = () => {
    const withResponse = filteredHotEvals.filter(e => e.would_recommend !== null && e.would_recommend !== undefined)
    if (withResponse.length === 0) return null
    
    const recommendCount = withResponse.filter(e => e.would_recommend === true).length
    const rate = (recommendCount / withResponse.length * 100).toFixed(0)
    
    return { rate, recommended: recommendCount, total: withResponse.length }
  }
  
  const hotStats = calcHotStats()
  const trainerStats = calcTrainerStats()
  const coldStats = calcColdStats()
  const successRate = calcSuccessRate()
  const presenceRate = calcPresenceRate()
  const globalRecommendRate = calcGlobalRecommendRate()
  
  // Calcul note globale (basé sur évaluations à chaud et formateur uniquement - PAS à froid)
  const globalScore = () => {
    let total = 0, count = 0
    if (hotStats && hotStats.stats && hotStats.stats.length > 0) {
      const avgAll = hotStats.stats.reduce((acc, s) => acc + parseFloat(s.avg), 0) / hotStats.stats.length
      if (avgAll > 0) { total += avgAll; count++ }
    }
    if (trainerStats && trainerStats.stats.length > 0) {
      const avgAll = trainerStats.stats.reduce((acc, s) => acc + parseFloat(s.avg), 0) / trainerStats.stats.length
      if (avgAll > 0) { total += avgAll; count++ }
    }
    return count > 0 ? (total / count).toFixed(1) : '-'
  }
  
  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="loading loading-lg"></div></div>
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Indicateurs de Résultats
          </h1>
          <p className="text-gray-600 mt-1">Synthèse des évaluations et indicateurs qualité</p>
        </div>
      </div>
      
      {/* Filtres */}
      <div className="card bg-white p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <Filter className="w-5 h-5 text-gray-500" />
          
          <select 
            className="input input-sm w-48"
            value={filterTheme}
            onChange={(e) => setFilterTheme(e.target.value)}
          >
            <option value="">Tous les thèmes</option>
            {themes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          
          <select 
            className="input input-sm w-48"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
          >
            <option value="">Tous les clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          
          <select 
            className="input input-sm w-40"
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
          >
            <option value="all">Toute période</option>
            <option value="year">Cette année</option>
            <option value="quarter">Ce trimestre</option>
            <option value="month">Ce mois</option>
          </select>
          
          <span className="text-sm text-gray-500">
            {filteredSessions.length} session(s) • {filteredHotEvals.length} éval. à chaud • {coldStats ? `${coldStats.sentCount} éval. à froid envoyées` : '0 éval. à froid'}
          </span>
        </div>
      </div>
      
      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`card p-4 ${ratingColor(parseFloat(globalScore()) || 0)}`}>
          <div className="flex items-center gap-3">
            <Star className="w-8 h-8" />
            <div>
              <p className="text-sm font-medium">Score Global</p>
              <p className="text-3xl font-bold">{globalScore()}/5</p>
            </div>
          </div>
        </div>
        
        <div className={`card p-4 ${successRate ? (parseInt(successRate.rate) >= 80 ? 'bg-green-100 text-green-700' : parseInt(successRate.rate) >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-500'}`}>
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8" />
            <div>
              <p className="text-sm font-medium">Taux de réussite</p>
              <p className="text-3xl font-bold">{successRate ? `${successRate.rate}%` : '-'}</p>
              {successRate && <p className="text-xs">{successRate.acquired}/{successRate.total} acquis</p>}
            </div>
          </div>
        </div>
        
        <div className={`card p-4 ${presenceRate ? (parseInt(presenceRate.rate) >= 80 ? 'bg-green-100 text-green-700' : parseInt(presenceRate.rate) >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-500'}`}>
          <div className="flex items-center gap-3">
            <UserCheck className="w-8 h-8" />
            <div>
              <p className="text-sm font-medium">Taux de présence</p>
              <p className="text-3xl font-bold">{presenceRate ? `${presenceRate.rate}%` : '-'}</p>
              {presenceRate && <p className="text-xs">{presenceRate.present}/{presenceRate.total} complet</p>}
            </div>
          </div>
        </div>
        
        <div className={`card p-4 ${globalRecommendRate ? (parseInt(globalRecommendRate.rate) >= 80 ? 'bg-green-100 text-green-700' : parseInt(globalRecommendRate.rate) >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-500'}`}>
          <div className="flex items-center gap-3">
            <ThumbsUp className="w-8 h-8" />
            <div>
              <p className="text-sm font-medium">Taux de recommandation</p>
              <p className="text-3xl font-bold">{globalRecommendRate ? `${globalRecommendRate.rate}%` : '-'}</p>
              {globalRecommendRate && <p className="text-xs">{globalRecommendRate.recommended}/{globalRecommendRate.total} recommandent</p>}
            </div>
          </div>
        </div>
      </div>
      
      {/* Compteurs d'évaluations */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card bg-white p-4">
          <div className="flex items-center gap-3">
            <Thermometer className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-sm text-gray-600">Éval. à chaud</p>
              <p className="text-2xl font-bold">{filteredHotEvals.length}</p>
            </div>
          </div>
        </div>
        
        <div className="card bg-white p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Éval. formateur</p>
              <p className="text-2xl font-bold">{filteredTrainerEvals.length}</p>
            </div>
          </div>
        </div>
        
        <div className="card bg-white p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-600">Éval. à froid</p>
              <p className="text-2xl font-bold">
                {coldStats ? coldStats.sentCount : 0}
                <span className="text-sm font-normal text-gray-500 ml-1">
                  envoyées
                </span>
              </p>
              {coldStats && coldStats.receivedCount > 0 && (
                <p className="text-xs text-green-600">{coldStats.receivedCount} reçues</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button 
          onClick={() => setActiveTab('hot')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'hot' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Thermometer className="w-4 h-4 inline mr-2" />
          À chaud ({filteredHotEvals.length})
        </button>
        <button 
          onClick={() => setActiveTab('trainer')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'trainer' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <UserCheck className="w-4 h-4 inline mr-2" />
          Formateur ({filteredTrainerEvals.length})
        </button>
        <button 
          onClick={() => setActiveTab('cold')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'cold' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          À froid ({coldStats ? `${coldStats.sentCount}/${coldStats.totalTrainees}` : '0'})
        </button>
      </div>
      
      {/* Contenu des tabs */}
      <div className="card bg-white p-6">
        {/* Évaluations à chaud */}
        {activeTab === 'hot' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-orange-500" />
              Évaluations à chaud (stagiaires) - Critères Qualiopi
            </h3>
            
            {!hotStats ? (
              <p className="text-gray-500 text-center py-8">Aucune évaluation à chaud pour les critères sélectionnés</p>
            ) : (
              <div className="space-y-6">
                {/* Critères Qualiopi */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hotStats.stats.map((stat, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{stat.label}</span>
                          <span className={`text-sm font-bold px-2 py-0.5 rounded ${ratingColor(parseFloat(stat.avg))}`}>
                            {stat.avg}/5
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${ratingBg(parseFloat(stat.avg))}`}
                            style={{ width: `${(parseFloat(stat.avg) / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Taux */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                  {/* Taux de questionnaires reçus */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">Questionnaires reçus</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${parseInt(hotStats.questionnaireRate) >= 80 ? 'bg-green-100 text-green-700' : parseInt(hotStats.questionnaireRate) >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {hotStats.questionnaireRate}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${parseInt(hotStats.questionnaireRate) >= 80 ? 'bg-green-500' : parseInt(hotStats.questionnaireRate) >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${hotStats.questionnaireRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Taux de recommandation */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">Taux de recommandation</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${parseInt(hotStats.recommendRate) >= 80 ? 'bg-green-100 text-green-700' : parseInt(hotStats.recommendRate) >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {hotStats.recommendRate}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${parseInt(hotStats.recommendRate) >= 80 ? 'bg-green-500' : parseInt(hotStats.recommendRate) >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${hotStats.recommendRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-500 text-center">
                  {hotStats.totalWithResponse} questionnaire(s) reçu(s) sur {hotStats.total} stagiaire(s)
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Évaluations formateur */}
        {activeTab === 'trainer' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-500" />
              Évaluations formateur
            </h3>
            
            {!trainerStats ? (
              <p className="text-gray-500 text-center py-8">Aucune évaluation formateur pour les critères sélectionnés</p>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trainerStats.stats.map((stat, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{stat.label}</span>
                          <span className={`text-sm font-bold px-2 py-0.5 rounded ${ratingColor(parseFloat(stat.avg))}`}>
                            {stat.avg}/5
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${ratingBg(parseFloat(stat.avg))}`}
                            style={{ width: `${(parseFloat(stat.avg) / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-4 flex items-center gap-8">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <span className="text-sm">Objectifs atteints (moyenne) : </span>
                    <span className={`font-bold px-2 py-1 rounded ${parseInt(trainerStats.avgObjectives) >= 80 ? 'bg-green-100 text-green-700' : parseInt(trainerStats.avgObjectives) >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {trainerStats.avgObjectives}%
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    Base : {trainerStats.total} session(s)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Évaluations à froid */}
        {activeTab === 'cold' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              Évaluations à froid (90 jours)
            </h3>
            
            {!coldStats ? (
              <p className="text-gray-500 text-center py-8">Aucune session terminée pour les critères sélectionnés</p>
            ) : (
              <div className="space-y-6">
                {/* Taux d'envoi et de retour */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-purple-700 flex items-center gap-2">
                        <Send className="w-4 h-4" /> Taux d'envoi
                      </span>
                      <span className={`text-xl font-bold ${parseInt(coldStats.sendRate) >= 100 ? 'text-green-600' : parseInt(coldStats.sendRate) >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {coldStats.sendRate}%
                      </span>
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full ${parseInt(coldStats.sendRate) >= 100 ? 'bg-green-500' : parseInt(coldStats.sendRate) >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(coldStats.sendRate, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-purple-600 mt-1">{coldStats.sentCount} envoyées / {coldStats.totalTrainees} stagiaires</p>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-700 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Taux de retour
                      </span>
                      <span className={`text-xl font-bold ${parseInt(coldStats.returnRate) >= 50 ? 'text-green-600' : parseInt(coldStats.returnRate) >= 25 ? 'text-yellow-600' : 'text-orange-600'}`}>
                        {coldStats.returnRate}%
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full ${parseInt(coldStats.returnRate) >= 50 ? 'bg-green-500' : parseInt(coldStats.returnRate) >= 25 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                        style={{ width: `${coldStats.returnRate}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-600 mt-1">{coldStats.receivedCount} reçues / {coldStats.sentCount} envoyées</p>
                  </div>
                </div>
                
                {/* Stats de satisfaction (seulement si des réponses reçues) */}
                {coldStats.total > 0 ? (
                  <>
                    <h4 className="font-medium text-gray-700 border-t pt-4">Résultats des évaluations reçues ({coldStats.total})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {coldStats.stats.map((stat, idx) => (
                        <div key={idx} className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">{stat.label}</span>
                              <span className={`text-sm font-bold px-2 py-0.5 rounded ${parseInt(stat.rate) >= 80 ? 'bg-green-100 text-green-700' : parseInt(stat.rate) >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {stat.rate}% Oui
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${parseInt(stat.rate) >= 80 ? 'bg-green-500' : parseInt(stat.rate) >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${stat.rate}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{stat.yesCount}/{stat.count} réponses</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border-t pt-4 flex flex-wrap items-center gap-8">
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="w-5 h-5 text-green-500" />
                        <span className="text-sm">Recommandation : </span>
                        <span className={`font-bold px-2 py-1 rounded ${parseInt(coldStats.recommendRate) >= 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {coldStats.recommendRate}%
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
                    <p>Aucune réponse reçue pour le moment</p>
                    <p className="text-sm mt-1">Les statistiques de satisfaction apparaîtront ici quand des stagiaires auront répondu</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
