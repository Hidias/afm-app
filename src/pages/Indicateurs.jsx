import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { 
  BarChart3, Filter, Users, Star, TrendingUp, ThumbsUp, 
  Thermometer, Clock, Building, BookOpen, UserCheck, Target
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
    
    // Charger les résultats des stagiaires (Acquis/Non acquis)
    const { data: results } = await supabase.from('session_trainees').select('session_id, trainee_id, result')
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
    
    // Critères Qualiopi
    const criteria = [
      { key: 'q1_objectives', label: 'Clarté des objectifs' },
      { key: 'q6_organization', label: 'Accueil et organisation' },
      { key: 'q2_content', label: 'Pertinence du contenu' },
      { key: 'q5_materials', label: 'Supports pédagogiques' },
      { key: 'q3_trainer', label: 'Pédagogie du formateur' },
      { key: 'q7_duration', label: 'Rythme et durée' },
      { key: 'q4_methods', label: 'Conditions matérielles' },
      { key: 'q8_applicability', label: 'Utilité professionnelle' },
      { key: 'satisfaction_score', label: 'Satisfaction globale' },
    ]
    
    const stats = criteria.map(c => {
      const values = filteredHotEvals.map(e => e[c.key]).filter(v => v !== null && v !== undefined)
      const avg = values.length > 0 ? values.reduce((a, b) => a + Number(b), 0) / values.length : 0
      return { ...c, avg: avg.toFixed(1), count: values.length }
    })
    
    const recommendCount = filteredHotEvals.filter(e => e.would_recommend === true).length
    const totalWithResponse = filteredHotEvals.filter(e => e.questionnaire_submitted).length
    const recommendRate = totalWithResponse > 0 
      ? (recommendCount / totalWithResponse * 100).toFixed(0)
      : 0
    
    const questionnaireRate = filteredHotEvals.length > 0
      ? (totalWithResponse / filteredHotEvals.length * 100).toFixed(0)
      : 0
    
    return { 
      stats,
      recommendRate, 
      questionnaireRate,
      totalWithResponse,
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
    if (filteredColdEvals.length === 0) return null
    
    const questions = [
      { key: 'skills_applied', label: 'Compétences mises en pratique' },
      { key: 'objectives_met', label: 'Objectifs atteints' },
      { key: 'knowledge_retained', label: 'Besoins satisfaits' },
      { key: 'job_impact', label: 'Amélioration du travail' },
    ]
    
    const stats = questions.map(q => {
      const responses = filteredColdEvals.filter(e => e[q.key] !== null && e[q.key] !== undefined)
      const yesCount = responses.filter(e => e[q.key] === 5 || e[q.key] === true).length
      const rate = responses.length > 0 ? (yesCount / responses.length * 100).toFixed(0) : 0
      return { ...q, rate, yesCount, count: responses.length }
    })
    
    const recommendCount = filteredColdEvals.filter(e => e.would_recommend === true).length
    const recommendResponses = filteredColdEvals.filter(e => e.would_recommend !== null && e.would_recommend !== undefined).length
    const recommendRate = recommendResponses > 0 
      ? (recommendCount / recommendResponses * 100).toFixed(0)
      : 0
    
    const completedCount = filteredColdEvals.filter(e => e.completed_at).length
    const responseRate = filteredColdEvals.length > 0
      ? (completedCount / filteredColdEvals.length * 100).toFixed(0)
      : 0
    
    return { stats, recommendRate, responseRate, total: filteredColdEvals.length }
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
  
  const hotStats = calcHotStats()
  const trainerStats = calcTrainerStats()
  const coldStats = calcColdStats()
  const successRate = calcSuccessRate()
  
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
            {filteredSessions.length} session(s) • {filteredHotEvals.length} éval. à chaud • {filteredColdEvals.length} éval. à froid
          </span>
        </div>
      </div>
      
      {/* Score global */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className={`card p-4 ${ratingColor(parseFloat(globalScore()) || 0)}`}>
          <div className="flex items-center gap-3">
            <Star className="w-8 h-8" />
            <div>
              <p className="text-sm font-medium">Score Global</p>
              <p className="text-3xl font-bold">{globalScore()}/5</p>
            </div>
          </div>
        </div>
        
        <div className={`card p-4 ${successRate ? (parseInt(successRate.rate) >= 80 ? 'bg-green-100 text-green-700' : parseInt(successRate.rate) >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700') : 'bg-white'}`}>
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8" />
            <div>
              <p className="text-sm font-medium">Taux de réussite</p>
              <p className="text-3xl font-bold">{successRate ? `${successRate.rate}%` : '-'}</p>
              {successRate && <p className="text-xs">{successRate.acquired}/{successRate.total} acquis</p>}
            </div>
          </div>
        </div>
        
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
            <UserCheck className="w-8 h-8 text-blue-500" />
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
              <p className="text-2xl font-bold">{filteredColdEvals.length}</p>
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
          À froid ({filteredColdEvals.length})
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
              <p className="text-gray-500 text-center py-8">Aucune évaluation à froid pour les critères sélectionnés</p>
            ) : (
              <div className="space-y-6">
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
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-500" />
                    <span className="text-sm">Taux de réponse : </span>
                    <span className="font-bold">{coldStats.responseRate}%</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    Base : {coldStats.total} évaluation(s)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
