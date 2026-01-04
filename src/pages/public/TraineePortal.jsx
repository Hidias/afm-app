import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { 
  User, GraduationCap, FileText, CheckCircle, AlertCircle, 
  Loader2, Calendar, Sun, Moon, Star, MessageSquare, ExternalLink
} from 'lucide-react'
import { format, parseISO, isToday, isBefore, startOfDay, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'

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
  
  // Steps: 'select' | 'info_sheet' | 'attendance' | 'evaluation' | 'thank_you' | 'google_review' | 'thank_you_website'
  const [currentStep, setCurrentStep] = useState('select')
  
  // Data
  const [infoSheet, setInfoSheet] = useState(null)
  const [attendanceData, setAttendanceData] = useState({}) // { date_period: true/false }
  const [evaluationData, setEvaluationData] = useState(null)
  
  // Forms
  const [infoForm, setInfoForm] = useState({
    first_name: '',
    last_name: '',
    birth_date_display: '', // Format affiché: DD/MM/YYYY
    email: '',
    ssn: '',
    ssn_refused: false,
    last_training_year: '',
    highest_diploma: '',
    rgpd_consent: false,
  })
  
  const [formErrors, setFormErrors] = useState({})
  
  // Helpers pour la date DD/MM/YYYY
  const formatBirthDateInput = (value) => {
    // Supprimer tout sauf les chiffres
    const digits = value.replace(/\D/g, '')
    
    // Formater avec les /
    let formatted = ''
    if (digits.length > 0) {
      formatted = digits.slice(0, 2)
    }
    if (digits.length > 2) {
      formatted += '/' + digits.slice(2, 4)
    }
    if (digits.length > 4) {
      formatted += '/' + digits.slice(4, 8)
    }
    return formatted
  }
  
  const parseBirthDateToISO = (displayDate) => {
    // Convertir DD/MM/YYYY en YYYY-MM-DD
    const parts = displayDate.split('/')
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`
    }
    return null
  }
  
  const isValidBirthDate = (displayDate) => {
    if (!displayDate || displayDate.length !== 10) return false
    const parts = displayDate.split('/')
    if (parts.length !== 3) return false
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const year = parseInt(parts[2], 10)
    if (isNaN(day) || isNaN(month) || isNaN(year)) return false
    if (day < 1 || day > 31) return false
    if (month < 1 || month > 12) return false
    if (year < 1900 || year > new Date().getFullYear()) return false
    // Vérifier que la date est valide
    const date = new Date(year, month - 1, day)
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year
  }
  
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }
  
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
      
      // Convertir birth_date YYYY-MM-DD en DD/MM/YYYY pour l'affichage
      let birthDateDisplay = ''
      if (trainee.birth_date) {
        const parts = trainee.birth_date.split('-')
        if (parts.length === 3) {
          birthDateDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`
        }
      }
      
      // Pré-remplir avec les infos du stagiaire
      setInfoForm({
        first_name: trainee.first_name || '',
        last_name: trainee.last_name || '',
        birth_date_display: birthDateDisplay,
        email: trainee.email || infoData?.email || '',
        ssn: infoData?.ssn || '',
        ssn_refused: infoData?.ssn_refused || false,
        last_training_year: infoData?.last_training_year || '',
        highest_diploma: infoData?.highest_diploma || '',
        rgpd_consent: infoData?.rgpd_consent || false,
      })
      
      if (infoData) {
        setInfoSheet(infoData)
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
        // Calculer la moyenne pour déterminer la redirection
        const questionKeys = [
          'q_org_documents', 'q_org_accueil', 'q_org_locaux', 'q_org_materiel',
          'q_contenu_organisation', 'q_contenu_supports', 'q_contenu_duree', 'q_contenu_programme',
          'q_formateur_pedagogie', 'q_formateur_expertise', 'q_formateur_progression', 'q_formateur_moyens',
          'q_global_adequation', 'q_global_competences'
        ]
        const scores = questionKeys.map(k => evalData[k]).filter(v => v > 0)
        const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
        
        if (evalData.would_recommend && average >= 4.5) {
          setCurrentStep('google_review')
        } else {
          setCurrentStep('thank_you_website')
        }
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
    
    // Validation
    const errors = {}
    
    if (!infoForm.first_name.trim()) {
      errors.first_name = 'Le prénom est requis'
    }
    if (!infoForm.last_name.trim()) {
      errors.last_name = 'Le nom est requis'
    }
    if (!isValidBirthDate(infoForm.birth_date_display)) {
      errors.birth_date = 'Format de date invalide (JJ/MM/AAAA)'
    }
    if (!infoForm.email.trim()) {
      errors.email = 'L\'email est requis'
    } else if (!isValidEmail(infoForm.email)) {
      errors.email = 'Format d\'email invalide'
    }
    if (!infoForm.ssn_refused && (!infoForm.ssn || infoForm.ssn.length !== 15)) {
      errors.ssn = 'Le numéro doit contenir 15 chiffres'
    }
    if (!infoForm.rgpd_consent) {
      errors.rgpd = 'Veuillez accepter les conditions RGPD'
    }
    
    setFormErrors(errors)
    
    if (Object.keys(errors).length > 0) {
      return
    }
    
    setSubmitting(true)
    try {
      // Convertir la date DD/MM/YYYY en YYYY-MM-DD
      const birthDateISO = parseBirthDateToISO(infoForm.birth_date_display)
      
      // 1. Mettre à jour la fiche stagiaire (trainees)
      const traineeUpdate = {
        first_name: infoForm.first_name,
        last_name: infoForm.last_name,
        email: infoForm.email,
        birth_date: birthDateISO,
        social_security_number: infoForm.ssn_refused ? null : infoForm.ssn,
        refused_ssn: infoForm.ssn_refused,
      }
      
      const { error: traineeError } = await supabase
        .from('trainees')
        .update(traineeUpdate)
        .eq('id', selectedTrainee.id)
      
      if (traineeError) {
        console.error('Erreur update trainee:', traineeError)
        throw traineeError
      }
      
      // Mettre à jour selectedTrainee localement
      setSelectedTrainee({ ...selectedTrainee, ...traineeUpdate })
      
      // 2. Sauvegarder la fiche de renseignement
      const infoData = {
        session_id: session.id,
        trainee_id: selectedTrainee.id,
        email: infoForm.email,
        ssn: infoForm.ssn_refused ? null : infoForm.ssn,
        ssn_refused: infoForm.ssn_refused,
        last_training_year: infoForm.last_training_year ? parseInt(infoForm.last_training_year) : null,
        highest_diploma: infoForm.highest_diploma,
        rgpd_consent: infoForm.rgpd_consent,
        rgpd_consent_date: new Date().toISOString(),
        filled_at: new Date().toISOString(),
        filled_online: true,
      }
      
      // Vérifier si existe déjà
      const { data: existing } = await supabase
        .from('trainee_info_sheets')
        .select('id')
        .eq('session_id', session.id)
        .eq('trainee_id', selectedTrainee.id)
        .single()
      
      let error
      if (existing) {
        const { error: updateError } = await supabase
          .from('trainee_info_sheets')
          .update(infoData)
          .eq('id', existing.id)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('trainee_info_sheets')
          .insert(infoData)
        error = insertError
      }

      if (error) {
        console.error('Erreur info sheet:', error)
        throw error
      }
      
      setInfoSheet({ ...infoData, filled_at: new Date().toISOString() })
      setCurrentStep('attendance')
    } catch (err) {
      console.error('Erreur complète:', err)
      alert('Erreur lors de l\'enregistrement. Veuillez réessayer.')
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
      // Préparer les données
      const evalData = {
        session_id: session.id,
        trainee_id: selectedTrainee.id,
        ...evalForm,
        questionnaire_submitted: true,
        submitted_at: new Date().toISOString(),
        submitted_online: true,
      }
      
      // D'abord essayer de mettre à jour si existe déjà
      const { data: existing } = await supabase
        .from('trainee_evaluations')
        .select('id')
        .eq('session_id', session.id)
        .eq('trainee_id', selectedTrainee.id)
        .single()
      
      let error
      if (existing) {
        // Update
        const { error: updateError } = await supabase
          .from('trainee_evaluations')
          .update(evalData)
          .eq('id', existing.id)
        error = updateError
      } else {
        // Insert
        const { error: insertError } = await supabase
          .from('trainee_evaluations')
          .insert(evalData)
        error = insertError
      }

      if (error) {
        console.error('Erreur évaluation:', error)
        throw error
      }
      
      // Calculer la moyenne (exclure N/C = 0)
      const questionKeys = [
        'q_org_documents', 'q_org_accueil', 'q_org_locaux', 'q_org_materiel',
        'q_contenu_organisation', 'q_contenu_supports', 'q_contenu_duree', 'q_contenu_programme',
        'q_formateur_pedagogie', 'q_formateur_expertise', 'q_formateur_progression', 'q_formateur_moyens',
        'q_global_adequation', 'q_global_competences'
      ]
      const scores = questionKeys.map(k => evalForm[k]).filter(v => v > 0) // Exclure N/C (0)
      const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      
      // Redirection conditionnelle
      if (evalForm.would_recommend && average >= 4.5) {
        setCurrentStep('google_review')
      } else {
        setCurrentStep('thank_you_website')
      }
    } catch (err) {
      console.error('Erreur complète:', err)
      alert('Erreur lors de l\'enregistrement. Veuillez réessayer.')
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

              {/* Identité */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2 text-sm">
                  <User className="w-4 h-4" /> Identité
                </h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      placeholder="Prénom *"
                      value={infoForm.first_name}
                      onChange={(e) => {
                        setInfoForm({...infoForm, first_name: e.target.value})
                        setFormErrors({...formErrors, first_name: null})
                      }}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${formErrors.first_name ? 'border-red-500' : ''}`}
                    />
                    {formErrors.first_name && <p className="text-xs text-red-500 mt-1">{formErrors.first_name}</p>}
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="NOM *"
                      value={infoForm.last_name}
                      onChange={(e) => {
                        setInfoForm({...infoForm, last_name: e.target.value.toUpperCase()})
                        setFormErrors({...formErrors, last_name: null})
                      }}
                      className={`w-full px-3 py-2 border rounded-lg text-sm uppercase ${formErrors.last_name ? 'border-red-500' : ''}`}
                    />
                    {formErrors.last_name && <p className="text-xs text-red-500 mt-1">{formErrors.last_name}</p>}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date de naissance *</label>
                  <input
                    type="text"
                    placeholder="JJ/MM/AAAA"
                    value={infoForm.birth_date_display}
                    onChange={(e) => {
                      const formatted = formatBirthDateInput(e.target.value)
                      setInfoForm({...infoForm, birth_date_display: formatted})
                      setFormErrors({...formErrors, birth_date: null})
                    }}
                    maxLength={10}
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${formErrors.birth_date ? 'border-red-500' : ''}`}
                  />
                  {formErrors.birth_date && <p className="text-xs text-red-500 mt-1">{formErrors.birth_date}</p>}
                </div>
                
                <div>
                  <input
                    type="email"
                    placeholder="Adresse email *"
                    value={infoForm.email}
                    onChange={(e) => {
                      setInfoForm({...infoForm, email: e.target.value})
                      setFormErrors({...formErrors, email: null})
                    }}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${formErrors.email ? 'border-red-500' : ''}`}
                  />
                  {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                  {!formErrors.email && <p className="text-xs text-gray-500 mt-1">Pour recevoir votre certificat de compétences</p>}
                </div>
              </div>

              {/* N° Sécurité sociale */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4" /> N° Sécurité sociale
                </h3>
                <p className="text-xs text-gray-500">Requis pour votre Passeport Prévention</p>
                
                <div>
                  <input
                    type="text"
                    placeholder="15 chiffres"
                    value={infoForm.ssn}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 15)
                      setInfoForm({...infoForm, ssn: value, ssn_refused: false})
                      setFormErrors({...formErrors, ssn: null})
                    }}
                    disabled={infoForm.ssn_refused}
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-mono tracking-wider ${formErrors.ssn ? 'border-red-500' : ''} ${infoForm.ssn_refused ? 'bg-gray-100 text-gray-400' : ''}`}
                    maxLength={15}
                  />
                  {formErrors.ssn && !infoForm.ssn_refused && <p className="text-xs text-red-500 mt-1">{formErrors.ssn}</p>}
                  {!formErrors.ssn && infoForm.ssn && infoForm.ssn.length < 15 && !infoForm.ssn_refused && (
                    <p className="text-xs text-amber-600 mt-1">{15 - infoForm.ssn.length} chiffre(s) restant(s)</p>
                  )}
                  {infoForm.ssn.length === 15 && <p className="text-xs text-green-600 mt-1">✓ 15 chiffres</p>}
                </div>
              </div>

              {/* Formation / Parcours */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2 text-sm">
                  <GraduationCap className="w-4 h-4" /> Parcours
                </h3>
                
                <input
                  type="number"
                  placeholder="Dernière formation dans ce domaine (année)"
                  value={infoForm.last_training_year}
                  onChange={(e) => setInfoForm({...infoForm, last_training_year: e.target.value})}
                  min="1950"
                  max={new Date().getFullYear()}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                
                <select
                  value={infoForm.highest_diploma}
                  onChange={(e) => setInfoForm({...infoForm, highest_diploma: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">-- Plus haut niveau scolaire --</option>
                  <option value="Aucun diplôme">Aucun diplôme</option>
                  <option value="Brevet">Brevet des collèges</option>
                  <option value="CAP/BEP">CAP / BEP</option>
                  <option value="Baccalauréat">Baccalauréat</option>
                  <option value="Bac+2">Bac+2 (BTS, DUT)</option>
                  <option value="Bac+3">Bac+3 (Licence)</option>
                  <option value="Bac+5">Bac+5 (Master, Ingénieur)</option>
                  <option value="Bac+8">Bac+8 (Doctorat)</option>
                </select>
              </div>

              {/* RGPD + Refus SSN */}
              <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={infoForm.rgpd_consent}
                    onChange={(e) => {
                      setInfoForm({...infoForm, rgpd_consent: e.target.checked})
                      setFormErrors({...formErrors, rgpd: null})
                    }}
                    className="w-5 h-5 mt-0.5 rounded"
                  />
                  <span className={`text-xs ${formErrors.rgpd ? 'text-red-600' : 'text-gray-600'}`}>
                    J'accepte que mes données soient traitées par Access Formation dans le cadre de cette formation et pour la gestion de mon Passeport Prévention (RGPD). Conservation : 5 ans maximum.
                  </span>
                </label>
                
                <label className={`flex items-center gap-3 cursor-pointer ${infoForm.ssn ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={infoForm.ssn_refused}
                    onChange={(e) => {
                      if (!infoForm.ssn) {
                        setInfoForm({...infoForm, ssn_refused: e.target.checked})
                        setFormErrors({...formErrors, ssn: null})
                      }
                    }}
                    disabled={infoForm.ssn.length > 0}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-xs text-gray-600">
                    Je refuse de communiquer mon numéro de sécurité sociale
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
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

          {/* STEP: Thank You + Website Redirect */}
          {currentStep === 'thank_you_website' && (
            <div className="text-center py-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Merci pour votre retour !</h2>
              <p className="text-gray-600 mb-6">
                Votre évaluation a été enregistrée avec succès.<br />
                Nous prenons en compte tous vos commentaires pour améliorer nos formations.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 mb-3">
                  Découvrez toutes nos formations sur notre site internet
                </p>
                <a
                  href="https://www.accessformation.pro/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                >
                  Visiter notre site
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
