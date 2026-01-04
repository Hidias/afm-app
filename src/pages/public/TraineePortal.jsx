import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { 
  User, Briefcase, GraduationCap, FileText, CheckCircle, AlertCircle, 
  Loader2, Calendar, Sun, Moon, Star, MessageSquare, ExternalLink
} from 'lucide-react'
import { format, parseISO, isToday, isBefore, startOfDay, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'

const knowledgeLevels = [
  { value: 1, label: 'Aucune' },
  { value: 2, label: 'Faible' },
  { value: 3, label: 'Moyen' },
  { value: 4, label: 'Bon' },
  { value: 5, label: 'Expert' },
]

const ratingLabels = ['Mauvais', 'Passable', 'Moyen', 'Satisfaisant', 'Très satisfaisant']

const evalQuestions = {
  organisation: [
    { key: 'q_org_documents', label: 'Communication des documents avant la formation' },
    { key: 'q_org_accueil', label: 'Accueil sur le lieu de la formation' },
    { key: 'q_org_locaux', label: 'Qualité des locaux' },
    { key: 'q_org_materiel', label: 'Adéquation des moyens matériels' },
  ],
  contenu: [
    { key: 'q_contenu_organisation', label: 'Organisation et déroulement' },
    { key: 'q_contenu_supports', label: 'Qualité des supports pédagogiques' },
    { key: 'q_contenu_duree', label: 'Durée de la formation' },
    { key: 'q_contenu_programme', label: 'Respect du programme' },
  ],
  formateur: [
    { key: 'q_formateur_pedagogie', label: 'Pédagogie du formateur' },
    { key: 'q_formateur_expertise', label: 'Expertise du formateur' },
    { key: 'q_formateur_progression', label: 'Progression (rythme)' },
    { key: 'q_formateur_moyens', label: 'Moyens mis à disposition' },
  ],
  global: [
    { key: 'q_global_adequation', label: 'Adéquation formation / métier' },
    { key: 'q_global_competences', label: 'Amélioration de vos connaissances' },
  ]
}

const GOOGLE_REVIEW_URL = 'https://g.page/r/CdNbodNlTStbEBM/review'

export default function TraineePortal() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  
  const [session, setSession] = useState(null)
  const [trainees, setTrainees] = useState([])
  const [selectedTrainee, setSelectedTrainee] = useState(null)
  
  // Steps: 'select' | 'info_sheet' | 'attendance' | 'evaluation' | 'thank_you' | 'google_review'
  const [currentStep, setCurrentStep] = useState('select')
  
  // Data
  const [infoSheet, setInfoSheet] = useState(null)
  const [attendanceData, setAttendanceData] = useState({}) // { date_period: true/false }
  const [evaluationData, setEvaluationData] = useState(null)
  
  // Forms
  const [infoForm, setInfoForm] = useState({
    job_title: '',
    job_since: '',
    knowledge_level: 1,
    company_address: '',
    last_training_year: '',
    highest_diploma: '',
    needs_and_expectations: '',
    rgpd_consent: false,
  })
  
  const [evalForm, setEvalForm] = useState({
    q_org_documents: 5, q_org_accueil: 5, q_org_locaux: 5, q_org_materiel: 5,
    q_contenu_organisation: 5, q_contenu_supports: 5, q_contenu_duree: 5, q_contenu_programme: 5,
    q_formateur_pedagogie: 5, q_formateur_expertise: 5, q_formateur_progression: 5, q_formateur_moyens: 5,
    q_global_adequation: 5, q_global_competences: 5,
    would_recommend: true,
    comment_general: '',
    comment_projet: '',
  })

  useEffect(() => {
    loadSession()
  }, [token])

  const loadSession = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
          courses(title, duration_hours),
          clients(name),
          session_trainees(trainee_id, trainees(id, first_name, last_name, email, phone))
        `)
        .eq('attendance_token', token)
        .single()

      if (sessionError || !sessionData) {
        setError('Session non trouvée ou lien invalide')
        setLoading(false)
        return
      }

      setSession(sessionData)
      const traineesList = sessionData.session_trainees?.map(st => st.trainees).filter(Boolean) || []
      setTrainees(traineesList)
      setLoading(false)
    } catch (err) {
      console.error('Erreur:', err)
      setError('Erreur lors du chargement')
      setLoading(false)
    }
  }

  const handleSelectTrainee = async (trainee) => {
    setSelectedTrainee(trainee)
    setSubmitting(true)
    
    try {
      // Charger la fiche de renseignement
      const { data: infoData } = await supabase
        .from('trainee_info_sheets')
        .select('*')
        .eq('session_id', session.id)
        .eq('trainee_id', trainee.id)
        .single()
      
      setInfoSheet(infoData)
      
      if (infoData) {
        setInfoForm({
          job_title: infoData.job_title || '',
          job_since: infoData.job_since || '',
          knowledge_level: infoData.knowledge_level || 1,
          company_address: infoData.company_address || '',
          last_training_year: infoData.last_training_year || '',
          highest_diploma: infoData.highest_diploma || '',
          needs_and_expectations: infoData.needs_and_expectations || '',
          rgpd_consent: infoData.rgpd_consent || false,
        })
      }
      
      // Charger les émargements
      const { data: attendances } = await supabase
        .from('attendance_halfdays')
        .select('*')
        .eq('session_id', session.id)
        .eq('trainee_id', trainee.id)
      
      const attMap = {}
      attendances?.forEach(a => {
        attMap[`${a.date}_${a.period}`] = a.present
      })
      setAttendanceData(attMap)
      
      // Charger l'évaluation
      const { data: evalData } = await supabase
        .from('trainee_evaluations')
        .select('*')
        .eq('session_id', session.id)
        .eq('trainee_id', trainee.id)
        .single()
      
      setEvaluationData(evalData)
      
      if (evalData) {
        setEvalForm({
          q_org_documents: evalData.q_org_documents ?? 5,
          q_org_accueil: evalData.q_org_accueil ?? 5,
          q_org_locaux: evalData.q_org_locaux ?? 5,
          q_org_materiel: evalData.q_org_materiel ?? 5,
          q_contenu_organisation: evalData.q_contenu_organisation ?? 5,
          q_contenu_supports: evalData.q_contenu_supports ?? 5,
          q_contenu_duree: evalData.q_contenu_duree ?? 5,
          q_contenu_programme: evalData.q_contenu_programme ?? 5,
          q_formateur_pedagogie: evalData.q_formateur_pedagogie ?? 5,
          q_formateur_expertise: evalData.q_formateur_expertise ?? 5,
          q_formateur_progression: evalData.q_formateur_progression ?? 5,
          q_formateur_moyens: evalData.q_formateur_moyens ?? 5,
          q_global_adequation: evalData.q_global_adequation ?? 5,
          q_global_competences: evalData.q_global_competences ?? 5,
          would_recommend: evalData.would_recommend ?? true,
          comment_general: evalData.comment_general || '',
          comment_projet: evalData.comment_projet || '',
        })
      }
      
      // Déterminer l'étape
      if (!infoData?.filled_at) {
        setCurrentStep('info_sheet')
      } else if (isLastDay() && evalData?.questionnaire_submitted) {
        setCurrentStep('google_review')
      } else if (isLastDay() && allTodayAttendanceDone()) {
        setCurrentStep('evaluation')
      } else {
        setCurrentStep('attendance')
      }
      
    } catch (err) {
      console.error('Erreur chargement données:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Helpers pour les jours de formation
  const getFormationDays = () => {
    if (!session?.start_date || !session?.end_date) return []
    try {
      const start = parseISO(session.start_date)
      const end = parseISO(session.end_date)
      return eachDayOfInterval({ start, end })
    } catch {
      return []
    }
  }

  const getTodayFormation = () => {
    const days = getFormationDays()
    const today = startOfDay(new Date())
    return days.find(d => startOfDay(d).getTime() === today.getTime())
  }

  const isLastDay = () => {
    if (!session?.end_date) return false
    const endDate = startOfDay(parseISO(session.end_date))
    const today = startOfDay(new Date())
    return endDate.getTime() === today.getTime()
  }

  const getDayLabel = (date) => {
    return format(date, 'EEEE d MMMM', { locale: fr })
  }

  const allTodayAttendanceDone = () => {
    const today = getTodayFormation()
    if (!today) return false
    const dateStr = format(today, 'yyyy-MM-dd')
    return attendanceData[`${dateStr}_morning`] && attendanceData[`${dateStr}_afternoon`]
  }

  // Soumission fiche de renseignement
  const handleSubmitInfoSheet = async (e) => {
    e.preventDefault()
    if (!infoForm.rgpd_consent) {
      alert('Veuillez accepter les conditions RGPD.')
      return
    }
    
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('trainee_info_sheets')
        .upsert({
          session_id: session.id,
          trainee_id: selectedTrainee.id,
          ...infoForm,
          last_training_year: infoForm.last_training_year ? parseInt(infoForm.last_training_year) : null,
          rgpd_consent_date: new Date().toISOString(),
          filled_at: new Date().toISOString(),
          filled_online: true,
        }, { onConflict: 'session_id,trainee_id' })

      if (error) throw error
      
      setInfoSheet({ ...infoForm, filled_at: new Date().toISOString() })
      setCurrentStep('attendance')
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de l\'enregistrement')
    } finally {
      setSubmitting(false)
    }
  }

  // Soumission émargement
  const handleSignAttendance = async (period) => {
    const today = getTodayFormation()
    if (!today) return
    
    const dateStr = format(today, 'yyyy-MM-dd')
    const key = `${dateStr}_${period}`
    
    // Déjà signé ?
    if (attendanceData[key]) return
    
    setSubmitting(true)
    try {
      // D'abord essayer INSERT
      const { data, error } = await supabase
        .from('attendance_halfdays')
        .insert({
          session_id: session.id,
          trainee_id: selectedTrainee.id,
          date: dateStr,
          period: period,
          present: true,
          signed_at: new Date().toISOString(),
        })
        .select()

      if (error) {
        console.error('Erreur insert attendance:', error)
        // Si erreur de conflit, essayer UPDATE
        if (error.code === '23505') {
          const { error: updateError } = await supabase
            .from('attendance_halfdays')
            .update({ present: true, signed_at: new Date().toISOString() })
            .eq('session_id', session.id)
            .eq('trainee_id', selectedTrainee.id)
            .eq('date', dateStr)
            .eq('period', period)
          
          if (updateError) {
            console.error('Erreur update attendance:', updateError)
            throw updateError
          }
        } else {
          throw error
        }
      }
      
      // Seulement si pas d'erreur, mettre à jour l'état local
      const newAttendance = { ...attendanceData, [key]: true }
      setAttendanceData(newAttendance)
      
      // Vérifier si toutes les demi-journées d'aujourd'hui sont signées
      const morningDone = newAttendance[`${dateStr}_morning`]
      const afternoonDone = newAttendance[`${dateStr}_afternoon`]
      
      if (morningDone && afternoonDone) {
        if (isLastDay()) {
          setCurrentStep('evaluation')
        } else {
          setCurrentStep('thank_you')
        }
      }
    } catch (err) {
      console.error('Erreur complète:', err)
      alert('Erreur lors de l\'enregistrement. Veuillez réessayer.')
      // NE PAS mettre à jour l'état local en cas d'erreur
    } finally {
      setSubmitting(false)
    }
  }

  // Soumission évaluation
  const handleSubmitEvaluation = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const { error } = await supabase
        .from('trainee_evaluations')
        .upsert({
          session_id: session.id,
          trainee_id: selectedTrainee.id,
          ...evalForm,
          questionnaire_submitted: true,
          submitted_at: new Date().toISOString(),
          submitted_online: true,
        }, { onConflict: 'session_id,trainee_id' })

      if (error) throw error
      
      setCurrentStep('google_review')
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de l\'enregistrement')
    } finally {
      setSubmitting(false)
    }
  }

  const RatingButtons = ({ questionKey, currentValue }) => (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        onClick={() => setEvalForm({...evalForm, [questionKey]: 0})}
        className={`px-2 py-1 text-xs rounded border ${
          currentValue === 0 ? 'bg-gray-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
        }`}
      >
        N/C
      </button>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => setEvalForm({...evalForm, [questionKey]: n})}
          className={`w-9 h-9 rounded border text-sm ${
            currentValue === n ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 hover:bg-orange-50'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )

  // ============ RENDER ============

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Erreur</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  const today = getTodayFormation()
  const headerColor = currentStep === 'evaluation' ? 'from-orange-500 to-orange-600' 
    : currentStep === 'info_sheet' ? 'from-blue-600 to-blue-700'
    : 'from-green-600 to-green-700'

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-lg mx-auto">
        {/* En-tête */}
        <div className={`bg-gradient-to-r ${headerColor} rounded-t-xl p-5 text-white`}>
          <h1 className="text-lg font-bold">{session?.courses?.title || 'Formation'}</h1>
          <p className="text-white/80 text-sm mt-1">{session?.clients?.name}</p>
          {today && (
            <p className="text-white/90 text-sm mt-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {getDayLabel(today)}
              {isLastDay() && <span className="bg-white/20 px-2 py-0.5 rounded text-xs">Dernier jour</span>}
            </p>
          )}
        </div>

        <div className="bg-white rounded-b-xl shadow-lg p-5">
          
          {/* STEP: Sélection stagiaire */}
          {currentStep === 'select' && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Sélectionnez votre nom
              </h2>
              
              {trainees.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun stagiaire inscrit.</p>
              ) : (
                <div className="space-y-2">
                  {trainees.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTrainee(t)}
                      disabled={submitting}
                      className="w-full p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left disabled:opacity-50"
                    >
                      <p className="font-medium">{t.first_name} {t.last_name?.toUpperCase()}</p>
                      <p className="text-sm text-gray-500">{t.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP: Fiche de renseignement */}
          {currentStep === 'info_sheet' && selectedTrainee && (
            <form onSubmit={handleSubmitInfoSheet} className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Fiche de renseignements</h2>
                <button type="button" onClick={() => setCurrentStep('select')} className="text-sm text-blue-600">
                  ← Changer
                </button>
              </div>
              
              <p className="text-sm text-gray-500">
                {selectedTrainee.first_name} {selectedTrainee.last_name?.toUpperCase()}
              </p>

              {/* Infos pro */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2 text-sm">
                  <Briefcase className="w-4 h-4" /> Informations professionnelles
                </h3>
                
                <input
                  type="text"
                  placeholder="Poste exercé"
                  value={infoForm.job_title}
                  onChange={(e) => setInfoForm({...infoForm, job_title: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                
                <input
                  type="text"
                  placeholder="Dans ce poste depuis (ex: 3 ans)"
                  value={infoForm.job_since}
                  onChange={(e) => setInfoForm({...infoForm, job_since: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                
                <textarea
                  placeholder="Adresse de l'entreprise"
                  value={infoForm.company_address}
                  onChange={(e) => setInfoForm({...infoForm, company_address: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                />
              </div>

              {/* Formation */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2 text-sm">
                  <GraduationCap className="w-4 h-4" /> Parcours
                </h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Dernière formation (année)"
                    value={infoForm.last_training_year}
                    onChange={(e) => setInfoForm({...infoForm, last_training_year: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Plus haut diplôme"
                    value={infoForm.highest_diploma}
                    onChange={(e) => setInfoForm({...infoForm, highest_diploma: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                
                <div>
                  <p className="text-sm text-gray-700 mb-2">Niveau de connaissance :</p>
                  <div className="flex flex-wrap gap-1">
                    {knowledgeLevels.map(l => (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => setInfoForm({...infoForm, knowledge_level: l.value})}
                        className={`px-3 py-1.5 rounded text-sm ${
                          infoForm.knowledge_level === l.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Attentes */}
              <div>
                <h3 className="font-medium text-gray-900 flex items-center gap-2 text-sm mb-2">
                  <FileText className="w-4 h-4" /> Vos attentes
                </h3>
                <textarea
                  placeholder="Quels sont vos besoins et attentes ?"
                  value={infoForm.needs_and_expectations}
                  onChange={(e) => setInfoForm({...infoForm, needs_and_expectations: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                />
              </div>

              {/* RGPD */}
              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={infoForm.rgpd_consent}
                  onChange={(e) => setInfoForm({...infoForm, rgpd_consent: e.target.checked})}
                  className="w-5 h-5 mt-0.5 rounded"
                />
                <span className="text-xs text-gray-600">
                  J'accepte que mes données soient traitées par Access Formation dans le cadre de cette formation (RGPD). Conservation : 5 ans maximum.
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting || !infoForm.rgpd_consent}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Continuer vers l'émargement
              </button>
            </form>
          )}

          {/* STEP: Émargement */}
          {currentStep === 'attendance' && selectedTrainee && today && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Émargement</h2>
                <button onClick={() => setCurrentStep('select')} className="text-sm text-blue-600">
                  ← Changer
                </button>
              </div>
              
              <p className="text-sm text-gray-500 mb-4">
                {selectedTrainee.first_name} {selectedTrainee.last_name?.toUpperCase()}
              </p>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="font-medium text-gray-900 mb-1">{getDayLabel(today)}</p>
                <p className="text-xs text-gray-500">Confirmez votre présence pour chaque demi-journée</p>
              </div>

              <div className="space-y-3">
                {/* Matin */}
                {(() => {
                  const dateStr = format(today, 'yyyy-MM-dd')
                  const morningKey = `${dateStr}_morning`
                  const morningDone = attendanceData[morningKey]
                  
                  return (
                    <div className={`p-4 rounded-lg border-2 ${morningDone ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Sun className={`w-6 h-6 ${morningDone ? 'text-green-600' : 'text-yellow-500'}`} />
                          <div>
                            <p className="font-medium">Matin</p>
                            <p className="text-xs text-gray-500">1ère demi-journée</p>
                          </div>
                        </div>
                        {morningDone ? (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle className="w-5 h-5" /> Signé
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSignAttendance('morning')}
                            disabled={submitting}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                          >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Je confirme'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Après-midi */}
                {(() => {
                  const dateStr = format(today, 'yyyy-MM-dd')
                  const afternoonKey = `${dateStr}_afternoon`
                  const afternoonDone = attendanceData[afternoonKey]
                  
                  return (
                    <div className={`p-4 rounded-lg border-2 ${afternoonDone ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Moon className={`w-6 h-6 ${afternoonDone ? 'text-green-600' : 'text-blue-500'}`} />
                          <div>
                            <p className="font-medium">Après-midi</p>
                            <p className="text-xs text-gray-500">2ème demi-journée</p>
                          </div>
                        </div>
                        {afternoonDone ? (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle className="w-5 h-5" /> Signé
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSignAttendance('afternoon')}
                            disabled={submitting}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                          >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Je confirme'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {allTodayAttendanceDone() && !isLastDay() && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="font-medium text-green-800">Merci !</p>
                  <p className="text-sm text-green-600">Votre présence pour aujourd'hui est enregistrée.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP: Thank you (non dernier jour) */}
          {currentStep === 'thank_you' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Merci !</h2>
              <p className="text-gray-600">Votre présence pour aujourd'hui est enregistrée.</p>
              <p className="text-sm text-gray-500 mt-4">À demain pour la suite de la formation !</p>
            </div>
          )}

          {/* STEP: Évaluation */}
          {currentStep === 'evaluation' && selectedTrainee && (
            <form onSubmit={handleSubmitEvaluation} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-orange-500" />
                  Évaluation à chaud
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Échelle : 1 (Mauvais) → 5 (Très satisfaisant) • N/C = Non concerné
                </p>
              </div>

              {/* Organisation */}
              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-2 pb-1 border-b">📋 Organisation</h3>
                <div className="space-y-3">
                  {evalQuestions.organisation.map(q => (
                    <div key={q.key} className="flex flex-col gap-1">
                      <span className="text-xs text-gray-700">{q.label}</span>
                      <RatingButtons questionKey={q.key} currentValue={evalForm[q.key]} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Contenu */}
              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-2 pb-1 border-b">📚 Contenu</h3>
                <div className="space-y-3">
                  {evalQuestions.contenu.map(q => (
                    <div key={q.key} className="flex flex-col gap-1">
                      <span className="text-xs text-gray-700">{q.label}</span>
                      <RatingButtons questionKey={q.key} currentValue={evalForm[q.key]} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Formateur */}
              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-2 pb-1 border-b">👨‍🏫 Formateur</h3>
                <div className="space-y-3">
                  {evalQuestions.formateur.map(q => (
                    <div key={q.key} className="flex flex-col gap-1">
                      <span className="text-xs text-gray-700">{q.label}</span>
                      <RatingButtons questionKey={q.key} currentValue={evalForm[q.key]} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Global */}
              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-2 pb-1 border-b">⭐ Global</h3>
                <div className="space-y-3">
                  {evalQuestions.global.map(q => (
                    <div key={q.key} className="flex flex-col gap-1">
                      <span className="text-xs text-gray-700">{q.label}</span>
                      <RatingButtons questionKey={q.key} currentValue={evalForm[q.key]} />
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-gray-700">Recommanderiez-vous cette formation ?</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEvalForm({...evalForm, would_recommend: true})}
                        className={`px-4 py-1.5 rounded text-sm ${
                          evalForm.would_recommend ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-green-50'
                        }`}
                      >
                        Oui
                      </button>
                      <button
                        type="button"
                        onClick={() => setEvalForm({...evalForm, would_recommend: false})}
                        className={`px-4 py-1.5 rounded text-sm ${
                          evalForm.would_recommend === false ? 'bg-red-600 text-white' : 'bg-gray-100 hover:bg-red-50'
                        }`}
                      >
                        Non
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Commentaires */}
              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-2 pb-1 border-b flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Commentaires
                </h3>
                <textarea
                  placeholder="Commentaire général (remarques, suggestions)"
                  value={evalForm.comment_general}
                  onChange={(e) => setEvalForm({...evalForm, comment_general: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                  rows={2}
                />
                <textarea
                  placeholder="Projet de formation (besoins futurs)"
                  value={evalForm.comment_projet}
                  onChange={(e) => setEvalForm({...evalForm, comment_projet: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Envoyer mon évaluation
              </button>
            </form>
          )}

          {/* STEP: Google Review */}
          {currentStep === 'google_review' && (
            <div className="text-center py-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Merci !</h2>
              <p className="text-gray-600 mb-6">Votre évaluation a été enregistrée avec succès.</p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 mb-3">
                  <strong>Une dernière chose...</strong><br />
                  Votre avis compte ! Aidez-nous en laissant un avis sur Google.
                </p>
                <a
                  href={GOOGLE_REVIEW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600"
                >
                  <Star className="w-5 h-5" />
                  Laisser un avis Google
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              
              <p className="text-xs text-gray-400">Vous pouvez fermer cette page.</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Access Formation • Qualiopi
        </p>
      </div>
    </div>
  )
}
