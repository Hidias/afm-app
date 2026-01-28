import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { 
  User, GraduationCap, FileText, CheckCircle, AlertCircle, 
  Loader2, Calendar, Star, MessageSquare, ExternalLink, Shield
} from 'lucide-react'
import { format, parseISO, isToday, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import TraineeDocuments from '../../components/TraineeDocuments'
import PositioningTestForm from '../../components/PositioningTestForm'

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

// Fonction de formatage du numéro de Sécurité Sociale
const formatSSN = (value) => {
  // Enlever tout sauf les chiffres
  const numbers = value.replace(/\D/g, '')
  
  // Limiter à 15 chiffres max
  const truncated = numbers.slice(0, 15)
  
  // Formater : 1 23 45 67 890 123 45
  if (truncated.length <= 1) return truncated
  if (truncated.length <= 3) return `${truncated.slice(0, 1)} ${truncated.slice(1)}`
  if (truncated.length <= 5) return `${truncated.slice(0, 1)} ${truncated.slice(1, 3)} ${truncated.slice(3)}`
  if (truncated.length <= 7) return `${truncated.slice(0, 1)} ${truncated.slice(1, 3)} ${truncated.slice(3, 5)} ${truncated.slice(5)}`
  if (truncated.length <= 10) return `${truncated.slice(0, 1)} ${truncated.slice(1, 3)} ${truncated.slice(3, 5)} ${truncated.slice(5, 7)} ${truncated.slice(7)}`
  if (truncated.length <= 13) return `${truncated.slice(0, 1)} ${truncated.slice(1, 3)} ${truncated.slice(3, 5)} ${truncated.slice(5, 7)} ${truncated.slice(7, 10)} ${truncated.slice(10)}`
  // Avec clé (2 derniers chiffres)
  return `${truncated.slice(0, 1)} ${truncated.slice(1, 3)} ${truncated.slice(3, 5)} ${truncated.slice(5, 7)} ${truncated.slice(7, 10)} ${truncated.slice(10, 13)} ${truncated.slice(13)}`
}

// Fonction de validation de la clé de contrôle du numéro SS
const validateSSNKey = (ssn) => {
  // Enlever espaces
  const numbers = ssn.replace(/\s/g, '')
  
  // Doit faire 15 chiffres
  if (numbers.length !== 15) return false
  
  // Séparer numéro et clé
  const ssnNumber = numbers.slice(0, 13)
  const key = parseInt(numbers.slice(13, 15), 10)
  
  // Calcul clé de contrôle
  const calculatedKey = 97 - (parseInt(ssnNumber, 10) % 97)
  
  return key === calculatedKey
}

export default function TraineePortal() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  
  const [session, setSession] = useState(null)
  const [trainees, setTrainees] = useState([])
  const [selectedTrainee, setSelectedTrainee] = useState(null)
  
  // Steps: 'select' | 'verify_code' | 'info_sheet' | 'positioning_test' | 'attendance' | 'evaluation' | 'thank_you' | 'google_review' | 'thank_you_website'
  const [currentStep, setCurrentStep] = useState('select')
  const [showDocuments, setShowDocuments] = useState(false)
  
  // Code d'accès
  const [accessCode, setAccessCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [attemptsRemaining, setAttemptsRemaining] = useState(5)
  
  // Questions de positionnement
  const [positioningQuestions, setPositioningQuestions] = useState([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  
  // Data
  const [infoSheet, setInfoSheet] = useState(null)
  const [attendanceData, setAttendanceData] = useState({})
  const [certificationAccepted, setCertificationAccepted] = useState(false)
  const [signatureData, setSignatureData] = useState(null)
  const [showTimeWarning, setShowTimeWarning] = useState(false)
  const [timeWarningDetails, setTimeWarningDetails] = useState(null)
  const [evaluationData, setEvaluationData] = useState(null)
  
  // Forms
  const [infoForm, setInfoForm] = useState({
    first_name: '',
    last_name: '',
    birth_date_display: '',
    email: '',
    ssn: '',
    ssn_refused: false,
    last_training_year: '',
    highest_diploma: '',
    csp: '',
    job_title: '',
    training_expectations: '',
    gender: 'male',
    rgpd_consent: false,
  })
  
  const [formErrors, setFormErrors] = useState({})
  
  const formatBirthDateInput = (value) => {
    const digits = value.replace(/\D/g, '')
    let formatted = ''
    if (digits.length > 0) formatted = digits.slice(0, 2)
    if (digits.length > 2) formatted += '/' + digits.slice(2, 4)
    if (digits.length > 4) formatted += '/' + digits.slice(4, 8)
    return formatted
  }
  
  const parseBirthDateToISO = (displayDate) => {
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
    if (day < 1 || day > 31 || month < 1 || month > 12) return false
    if (year < 1900 || year > new Date().getFullYear()) return false
    const date = new Date(year, month - 1, day)
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year
  }
  
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  
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
      // Utiliser la fonction RPC pour contourner le problème CORS
      const { data: sessionData, error: sessionError } = await supabase
        .rpc('get_portal_session', { token_param: token })

      if (sessionError || !sessionData) {
        setError('Session non trouvée ou lien invalide')
        setLoading(false)
        return
      }

      // Déterminer les périodes selon le type de session
      let sessionPeriods = ['morning', 'afternoon']
      if (sessionData.day_type === 'half') {
        sessionPeriods = ['morning']
      }
      
      sessionData.periods = sessionPeriods
      setSession(sessionData)
      
      const traineesList = sessionData.trainees || []
      
      setTrainees(traineesList)
      setLoading(false)
    } catch (err) {
      console.error('Erreur:', err)
      setError('Erreur lors du chargement')
      setLoading(false)
    }
  }

  // Charger les questions de positionnement pour cette session
  const loadPositioningQuestions = async () => {
    if (!session?.courses?.theme_id) return
    
    try {
      setLoadingQuestions(true)
      
      // Récupérer les questions via le theme de la formation
      const { data: questions, error } = await supabase
        .from('theme_questions')
        .select('*')
        .eq('theme_id', session.courses.theme_id)
        .order('position')
      
      if (error) throw error
      
      setPositioningQuestions(questions || [])
    } catch (err) {
      console.error('Erreur chargement questions:', err)
    } finally {
      setLoadingQuestions(false)
    }
  }

  useEffect(() => {
    if (session?.courses?.theme_id) {
      loadPositioningQuestions()
    }
  }, [session])

  const handleSelectTrainee = (trainee) => {
    setSelectedTrainee(trainee)
    setAccessCode('')
    setCodeError('')
    setAttemptsRemaining(5 - (trainee.access_code_attempts || 0))
    
    // Si pas de code d'accès configuré ou codes désactivés, passer directement
    if (!trainee.access_code) {
      loadTraineeDataDirect(trainee)
    } else {
      setCurrentStep('verify_code')
    }
  }

  // Chargement direct sans vérification de code (fallback)
  const loadTraineeDataDirect = async (trainee) => {
    setSelectedTrainee(trainee)
    setSubmitting(true)
    await loadTraineeData(trainee)
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setCodeError('')

    try {
      // Vérification via RPC si disponible, sinon vérification directe
      const { data, error } = await supabase.rpc('verify_trainee_access_code', {
        p_session_trainee_id: selectedTrainee.session_trainee_id,
        p_access_code: accessCode
      })

      if (error) {
        // Fallback: vérification directe si RPC n'existe pas
        if (error.message?.includes('function') || error.code === '42883') {
          // Vérification directe
          if (accessCode === selectedTrainee.access_code) {
            await loadTraineeData(selectedTrainee)
            return
          } else {
            setCodeError('Code incorrect')
            setSubmitting(false)
            return
          }
        }
        throw error
      }

      if (!data?.success) {
        setCodeError(data?.error || 'Code incorrect')
        if (data?.attempts_remaining !== undefined) {
          setAttemptsRemaining(data.attempts_remaining)
        }
        if (data?.locked_until) {
          setCodeError(`Compte verrouillé jusqu'à ${new Date(data.locked_until).toLocaleTimeString('fr-FR')}`)
        }
        setSubmitting(false)
        return
      }

      await loadTraineeData(selectedTrainee)
      
    } catch (err) {
      console.error('Erreur:', err)
      setCodeError('Erreur lors de la vérification')
      setSubmitting(false)
    }
  }

  const loadTraineeData = async (trainee = selectedTrainee) => {
    try {
      // Charger toutes les données via RPC
      const { data: traineeData, error: traineeError } = await supabase.rpc('load_trainee_data', {
        p_token: token,
        p_trainee_id: trainee.id
      })
      
      if (traineeError) {
        console.error('Erreur chargement données:', traineeError)
        throw traineeError
      }
      
      const infoData = traineeData?.info_sheet
      const attendanceRecords = traineeData?.attendance || []
      const evalData = traineeData?.evaluation
      
      // Charger le statut du test de positionnement
      const { data: testStatus } = await supabase
        .from('session_trainees')
        .select('positioning_test_completed, positioning_test_completed_at')
        .eq('id', trainee.id)
        .single()
      
      // Mettre à jour trainee avec le statut du test
      trainee.positioning_test_completed = testStatus?.positioning_test_completed || false
      trainee.positioning_test_completed_at = testStatus?.positioning_test_completed_at
      
      setInfoSheet(infoData)
      
      let birthDateDisplay = ''
      if (trainee.birth_date) {
        const parts = trainee.birth_date.split('-')
        if (parts.length === 3) {
          birthDateDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`
        }
      }
      
      setInfoForm({
        first_name: trainee.first_name || '',
        last_name: trainee.last_name || '',
        birth_date_display: birthDateDisplay,
        email: trainee.email || '',
        ssn: infoData?.ssn || '',
        ssn_refused: infoData?.ssn_refused || false,
        last_training_year: infoData?.last_training_year?.toString() || '',
        highest_diploma: infoData?.highest_diploma || '',
        csp: trainee.csp || infoData?.csp || '',
        job_title: trainee.job_title || infoData?.job_title || '',
        training_expectations: infoData?.training_expectations || '',
        gender: trainee.gender || 'male',
        rgpd_consent: infoData?.rgpd_consent || false,
      })

      // Charger émargement
      const attendanceMap = {}
      attendanceRecords?.forEach(rec => {
        const dateStr = typeof rec.date === 'string' ? rec.date.substring(0, 10) : format(new Date(rec.date), 'yyyy-MM-dd')
        if (rec.morning) {
          attendanceMap[`${dateStr}_morning`] = true
        }
        if (rec.afternoon) {
          attendanceMap[`${dateStr}_afternoon`] = true
        }
      })
      setAttendanceData(attendanceMap)

      setEvaluationData(evalData)
      if (evalData) {
        setEvalForm({
          q_org_documents: evalData.q_org_documents || 5,
          q_org_accueil: evalData.q_org_accueil || 5,
          q_org_locaux: evalData.q_org_locaux || 5,
          q_org_materiel: evalData.q_org_materiel || 5,
          q_contenu_organisation: evalData.q_contenu_organisation || 5,
          q_contenu_supports: evalData.q_contenu_supports || 5,
          q_contenu_duree: evalData.q_contenu_duree || 5,
          q_contenu_programme: evalData.q_contenu_programme || 5,
          q_formateur_pedagogie: evalData.q_formateur_pedagogie || 5,
          q_formateur_expertise: evalData.q_formateur_expertise || 5,
          q_formateur_progression: evalData.q_formateur_progression || 5,
          q_formateur_moyens: evalData.q_formateur_moyens || 5,
          q_global_adequation: evalData.q_global_adequation || 5,
          q_global_competences: evalData.q_global_competences || 5,
          would_recommend: evalData.would_recommend ?? true,
          comment_general: evalData.comment_general || '',
          comment_projet: evalData.comment_projet || '',
        })
      }

      // Déterminer étape
      const today = getTodayFormation()
      
      // PRIORITÉ 1 : Fiche pas remplie
      if (!infoData || !infoData.filled_at) {
        setCurrentStep('info_sheet')
      }
      // PRIORITÉ 2 : Test de positionnement pas fait (si des questions existent)
      else if (!trainee.positioning_test_completed && positioningQuestions.length > 0) {
        setCurrentStep('positioning_test')
      }
      // PRIORITÉ 3 : Émargement et évaluation
      else {
        // Vérifier si toutes les périodes du jour sont cochées
        const allPeriodsChecked = session.periods.every(period => {
          const key = `${today}_${period}`
          return attendanceMap[key] === true
        })
        
        if (allPeriodsChecked) {
          const isLastDay = session.end_date && isToday(parseISO(session.end_date))
          if (isLastDay) {
            if (evalData && evalData.questionnaire_submitted) {
              setCurrentStep('thank_you')
            } else {
              setCurrentStep('evaluation')
            }
          } else {
            setCurrentStep('thank_you')
          }
        } else {
          setCurrentStep('attendance')
        }
      }
      
      setSubmitting(false)
    } catch (err) {
      console.error('Erreur chargement:', err)
      setCurrentStep('info_sheet')
      setSubmitting(false)
    }
  }

  const getTodayFormation = () => format(new Date(), 'yyyy-MM-dd')

  const handleSubmitInfoSheet = async (e) => {
    e.preventDefault()
    
    const errors = {}
    if (!infoForm.first_name) errors.first_name = 'Prénom requis'
    if (!infoForm.last_name) errors.last_name = 'Nom requis'
    if (!infoForm.email) {
      errors.email = 'Email requis'
    } else if (!isValidEmail(infoForm.email)) {
      errors.email = 'Email invalide'
    }
    if (!infoForm.birth_date_display) {
      errors.birth_date = 'Date de naissance requise'
    } else if (!isValidBirthDate(infoForm.birth_date_display)) {
      errors.birth_date = 'Date invalide (format JJ/MM/AAAA)'
    }
    
    // Validation numéro SS stricte
    if (!infoForm.ssn_refused) {
      const ssnNumbers = infoForm.ssn.replace(/\s/g, '')
      
      if (!ssnNumbers) {
        errors.ssn = 'N° Sécurité Sociale requis ou cochez "Je refuse"'
      } else if (ssnNumbers.length !== 15) {
        errors.ssn = 'Le numéro doit contenir exactement 15 chiffres (13 + 2 clé)'
      } else if (!/^\d{15}$/.test(ssnNumbers)) {
        errors.ssn = 'Le numéro ne doit contenir que des chiffres'
      } else if (!validateSSNKey(infoForm.ssn)) {
        errors.ssn = 'La clé de contrôle est incorrecte - Vérifiez votre numéro'
      }
    }
    
    if (!infoForm.highest_diploma) {
      errors.highest_diploma = 'Diplôme requis'
    }
    if (!infoForm.csp) {
      errors.csp = 'CSP requise'
    }
    if (!infoForm.job_title) {
      errors.job_title = 'Intitulé du poste requis'
    }
    if (!infoForm.training_expectations || infoForm.training_expectations.trim().length === 0) {
      errors.training_expectations = 'Vos attentes sont requises'
    }
    if (!infoForm.rgpd_consent) {
      errors.rgpd = 'Veuillez accepter les conditions RGPD'
    }
    
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return
    
    setSubmitting(true)
    try {
      const birthDateISO = parseBirthDateToISO(infoForm.birth_date_display)
      
      const traineeUpdate = {
        first_name: infoForm.first_name,
        last_name: infoForm.last_name,
        email: infoForm.email,
        birth_date: birthDateISO,
        social_security_number: infoForm.ssn_refused ? null : infoForm.ssn.replace(/\s/g, ''),
        refused_ssn: infoForm.ssn_refused,
        csp: infoForm.csp || null,
        job_title: infoForm.job_title || null,
        gender: infoForm.gender || 'male',
      }
      
      console.log('🔄 Mise à jour trainee avec:', traineeUpdate)
      
      const { data: updateData, error: updateError } = await supabase.rpc('update_trainee_data', {
        p_token: token,
        p_trainee_id: selectedTrainee.id,
        p_data: traineeUpdate
      })
      
      console.log('✅ Résultat update trainees:', { updateData, updateError })
      
      if (updateError) {
        throw updateError
      }
      
      setSelectedTrainee({ ...selectedTrainee, ...traineeUpdate })
      
      const { data: infoResult, error: infoError } = await supabase.rpc('save_trainee_info', {
        p_token: token,
        p_trainee_id: selectedTrainee.id,
        p_data: {
          email: infoForm.email,
          ssn: infoForm.ssn_refused ? null : infoForm.ssn.replace(/\s/g, ''),
          ssn_refused: infoForm.ssn_refused,
          last_training_year: infoForm.last_training_year ? parseInt(infoForm.last_training_year) : null,
          highest_diploma: infoForm.highest_diploma,
          csp: infoForm.csp || null,
          job_title: infoForm.job_title || null,
          training_expectations: infoForm.training_expectations,
          rgpd_consent: infoForm.rgpd_consent,
          rgpd_consent_date: new Date().toISOString(),
          filled_at: new Date().toISOString(),
          filled_online: true
        }
      })
      
      if (infoError) {
        console.error('Erreur sauvegarde fiche:', infoError)
        throw infoError
      }
      
      setInfoSheet({ 
        email: infoForm.email,
        ssn: infoForm.ssn_refused ? null : infoForm.ssn.replace(/\s/g, ''),
        ssn_refused: infoForm.ssn_refused,
        last_training_year: infoForm.last_training_year ? parseInt(infoForm.last_training_year) : null,
        highest_diploma: infoForm.highest_diploma,
        csp: infoForm.csp || null,
        job_title: infoForm.job_title || null,
        training_expectations: infoForm.training_expectations,
        rgpd_consent: infoForm.rgpd_consent,
        filled_at: new Date().toISOString() 
      })
      
      // Si des questions existent ET que le stagiaire n'a pas déjà fait le test
      if (positioningQuestions.length > 0 && !selectedTrainee.positioning_test_completed) {
        setCurrentStep('positioning_test')
      } else {
        setCurrentStep('attendance')
      }
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de l\'enregistrement. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // Gérer la completion du test de positionnement
  const handlePositioningTestComplete = async (testResults) => {
    try {
      setSubmitting(true)
      
      // Sauvegarder les résultats du test
      const { error: testError } = await supabase
        .from('trainee_positioning_tests')
        .insert([{
          session_trainee_id: selectedTrainee.id,
          session_id: session.id,
          responses: testResults.responses,
          total_questions: testResults.total_questions,
          correct_answers: testResults.correct_answers,
          critical_questions_count: testResults.critical_questions_count,
          critical_correct_count: testResults.critical_correct_count,
          score_percentage: testResults.score_percentage,
          level: testResults.level,
          duration_seconds: testResults.duration_seconds
        }])
      
      if (testError) throw testError
      
      // Marquer le test comme complété
      const { error: updateError } = await supabase
        .from('session_trainees')
        .update({
          positioning_test_completed: true,
          positioning_test_completed_at: new Date().toISOString()
        })
        .eq('id', selectedTrainee.id)
      
      if (updateError) throw updateError
      
      // Passer à l'émargement
      setCurrentStep('attendance')
    } catch (err) {
      console.error('Erreur sauvegarde test:', err)
      alert('Erreur lors de l\'enregistrement du test. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================

  // ========================================
  // FONCTIONS UTILITAIRES POUR ÉMARGEMENT
  // ========================================
  
  // Vérifier si on est dans le créneau horaire autorisé
  const checkTimeSlot = (period) => {
    if (!session?.start_time || !session?.end_time) return { allowed: true }
    
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = currentHour + currentMinute / 60
    
    // Parser les horaires de session (format "HH:MM")
    const [startHour, startMin] = session.start_time.split(':').map(Number)
    const [endHour, endMin] = session.end_time.split(':').map(Number)
    
    let allowedStart, allowedEnd
    
    if (period === 'morning') {
      // Matin : 1h avant début session jusqu'à 13h
      allowedStart = Math.max(0, startHour - 1)
      allowedEnd = 13
    } else {
      // Après-midi : 13h jusqu'à 1h après fin session
      allowedStart = 13
      allowedEnd = Math.min(24, endHour + 1)
    }
    
    const isInTimeSlot = currentTime >= allowedStart && currentTime <= allowedEnd
    
    return {
      allowed: isInTimeSlot,
      currentTime: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
      allowedStart: `${allowedStart}:00`,
      allowedEnd: `${allowedEnd}:00`,
      period: period === 'morning' ? 'matin' : 'après-midi'
    }
  }
  
  // Vérifier si c'est la première demi-journée
  const isFirstHalfDay = (date, period) => {
    if (!session?.start_date) return false
    const firstDate = format(parseISO(session.start_date), 'yyyy-MM-dd')
    return date === firstDate && period === 'morning'
  }

  // CORRECTION: Écrire dans attendance_halfdays avec morning/afternoon
  // ============================================================
  const handleToggleAttendance = async (date, period) => {
    const key = `${date}_${period}`
    const currentValue = attendanceData[key]
    const newValue = !currentValue
    
    // Vérifier si c'est la première demi-journée et si signature/certification sont OK
    const isFirst = isFirstHalfDay(date, period)
    if (isFirst && newValue) {
      if (!certificationAccepted) {
        alert('⚠️ Vous devez accepter la certification avant d\'émarger.')
        return
      }
      if (!signatureData) {
        alert('⚠️ Vous devez signer avant d\'émarger pour la première fois.')
        return
      }
    }
    
    // Vérifier le créneau horaire
    const timeCheck = checkTimeSlot(period)
    if (!timeCheck.allowed && newValue) {
      setTimeWarningDetails({
        ...timeCheck,
        onConfirm: () => {
          setShowTimeWarning(false)
          proceedWithAttendance(date, period, newValue, isFirst)
        },
        onCancel: () => {
          setShowTimeWarning(false)
        }
      })
      setShowTimeWarning(true)
      return
    }
    
    // Si tout est OK, procéder
    await proceedWithAttendance(date, period, newValue, isFirst)
  }
  
  const proceedWithAttendance = async (date, period, newValue, isFirst) => {
    const key = `${date}_${period}`

    // Mise à jour optimiste
    const newAttendanceData = { ...attendanceData, [key]: newValue }
    setAttendanceData(newAttendanceData)

    try {
      // Utiliser la fonction RPC pour sauvegarder la présence
      const { data: attendanceResult, error: attendanceError } = await supabase.rpc('save_single_attendance', {
        p_token: token,
        p_trainee_id: selectedTrainee.id,
        p_date: date,
        p_period: period,
        p_value: newValue,
        p_validated_by: `${selectedTrainee.first_name} ${selectedTrainee.last_name}`
      })
      
      if (attendanceError) {
        console.error('Erreur save attendance:', attendanceError)
        throw attendanceError
      }

      // ============================================================
      // CORRECTION CRITIQUE : Calculer et mettre à jour presence_complete
      // ============================================================
      
      // Calculer le nombre total de demi-journées de la formation
      const dates = session.start_date && session.end_date
        ? eachDayOfInterval({ start: parseISO(session.start_date), end: parseISO(session.end_date) })
        : []
      
      const totalHalfDays = dates.length * session.periods.length
      
      // Compter les présences validées dans newAttendanceData
      let presentCount = 0
      dates.forEach(d => {
        const dateStr = format(d, 'yyyy-MM-dd')
        session.periods.forEach(p => {
          const k = `${dateStr}_${p}`
          if (newAttendanceData[k] === true) {
            presentCount++
          }
        })
      })
      
      // Déterminer si présence complète (100%)
      const isComplete = presentCount === totalHalfDays && totalHalfDays > 0
      
      console.log('📊 Calcul presence_complete:', { 
        presentCount, 
        totalHalfDays, 
        isComplete,
        trainee: `${selectedTrainee.first_name} ${selectedTrainee.last_name}`
      })
      
      // Mettre à jour presence_complete dans session_trainees
      const { error: updateError } = await supabase
        .from('session_trainees')
        .update({ presence_complete: isComplete })
        .eq('session_id', session.id)
        .eq('trainee_id', selectedTrainee.id)
      
      if (updateError) {
        console.error('❌ Erreur update presence_complete:', updateError)
      } else {
        console.log('✅ presence_complete mis à jour:', isComplete)
      }
      
      // ============================================================
      // FIN CORRECTION
      // ============================================================

      // Vérifier si toutes les périodes du jour sont cochées
      const today = getTodayFormation()
      const allPeriodsChecked = session.periods.every(p => {
        const k = `${today}_${p}`
        return newAttendanceData[k] === true
      })

      if (allPeriodsChecked) {
        const isLastDay = session.end_date && isToday(parseISO(session.end_date))
        if (isLastDay) {
          if (evaluationData && evaluationData.questionnaire_submitted) {
            setCurrentStep('thank_you')
          } else {
            setCurrentStep('evaluation')
          }
        } else {
          setCurrentStep('thank_you')
        }
      }
    } catch (err) {
      console.error('Erreur émargement:', err)
      // Rollback
      const originalValue = !newValue
      setAttendanceData({ ...attendanceData, [key]: originalValue })
      alert('Erreur lors de l\'enregistrement')
    }
  }

  const handleSubmitEvaluation = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      // Lister explicitement tous les champs pour éviter les conflits
      const evalData = {
        session_id: session.id,
        trainee_id: selectedTrainee.id,
        q_org_documents: evalForm.q_org_documents,
        q_org_accueil: evalForm.q_org_accueil,
        q_org_locaux: evalForm.q_org_locaux,
        q_org_materiel: evalForm.q_org_materiel,
        q_contenu_organisation: evalForm.q_contenu_organisation,
        q_contenu_supports: evalForm.q_contenu_supports,
        q_contenu_duree: evalForm.q_contenu_duree,
        q_contenu_programme: evalForm.q_contenu_programme,
        q_formateur_pedagogie: evalForm.q_formateur_pedagogie,
        q_formateur_expertise: evalForm.q_formateur_expertise,
        q_formateur_progression: evalForm.q_formateur_progression,
        q_formateur_moyens: evalForm.q_formateur_moyens,
        q_global_adequation: evalForm.q_global_adequation,
        q_global_competences: evalForm.q_global_competences,
        would_recommend: evalForm.would_recommend,
        comment_general: evalForm.comment_general || null,
        comment_projet: evalForm.comment_projet || null,
        questionnaire_submitted: true,
        submitted_at: new Date().toISOString(),
        submitted_online: true,
      }

      console.log('Saving evaluation:', evalData)

      const { data: evalResult, error: evalError } = await supabase.rpc('save_evaluation', {
        p_token: token,
        p_trainee_id: selectedTrainee.id,
        p_eval_data: evalData
      })

      console.log('Save evaluation result:', { evalResult, evalError })

      if (evalError) {
        console.error('Erreur save evaluation:', evalError)
        throw evalError
      }
      
      // Calcul moyenne (exclure N/C = 0)
      const questionKeys = [
        'q_org_documents', 'q_org_accueil', 'q_org_locaux', 'q_org_materiel',
        'q_contenu_organisation', 'q_contenu_supports', 'q_contenu_duree', 'q_contenu_programme',
        'q_formateur_pedagogie', 'q_formateur_expertise', 'q_formateur_progression', 'q_formateur_moyens',
        'q_global_adequation', 'q_global_competences'
      ]
      const scores = questionKeys.map(k => evalForm[k]).filter(v => v > 0)
      const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      
      // Redirection : Google si moyenne ≥4.5 ET would_recommend, sinon site web
      if (evalForm.would_recommend && average >= 4.5) {
        setCurrentStep('google_review')
      } else {
        setCurrentStep('thank_you_website')
      }
    } catch (err) {
      console.error('Erreur:', err)
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

  // Vue Documents
  if (showDocuments) {
    return (
      <TraineeDocuments 
        session={session}
        traineeId={selectedTrainee?.id}
        onBack={() => setShowDocuments(false)}
      />
    )
  }

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
    : currentStep === 'verify_code' ? 'from-purple-600 to-purple-700'
    : 'from-green-600 to-green-700'

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-lg mx-auto">
        {/* En-tête */}
        <div className={`bg-gradient-to-r ${headerColor} rounded-t-xl p-5 text-white`}>
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">{session.courses?.title}</h1>
              <p className="text-sm opacity-90">{session.clients?.name}</p>
            </div>
          </div>
          {session.start_date && session.end_date && (
            <p className="text-sm opacity-80 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(parseISO(session.start_date), 'd MMM', { locale: fr })} - {format(parseISO(session.end_date), 'd MMM yyyy', { locale: fr })}
            </p>
          )}
        </div>

        {/* Contenu */}
        <div className="bg-white rounded-b-xl shadow-lg p-6">
          {/* STEP: Sélection */}
          {currentStep === 'select' && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Sélectionnez votre nom
              </h2>
              {trainees.map(trainee => (
                <button
                  key={trainee.id}
                  onClick={() => handleSelectTrainee(trainee)}
                  className="w-full p-4 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition"
                >
                  <div className="font-medium text-gray-900">
                    {trainee.first_name} {trainee.last_name}
                  </div>
                  {trainee.email && (
                    <div className="text-sm text-gray-500">{trainee.email}</div>
                  )}
                </button>
              ))}
              
              {/* Bouton Documents */}
              <div className="mt-6 pt-6 border-t">
                <button
                  onClick={() => setShowDocuments(true)}
                  className="w-full p-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-3 font-medium"
                >
                  <FileText className="w-5 h-5" />
                  📄 Consulter les documents de formation
                </button>
                <p className="text-xs text-center text-gray-500 mt-2">
                  Accédez aux supports pédagogiques et livrets
                </p>
              </div>
            </div>
          )}

          {/* STEP: Vérification code */}
          {currentStep === 'verify_code' && (
            <div>
              <div className="text-center mb-6">
                <Shield className="w-16 h-16 text-purple-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Vérification d'accès</h2>
                <p className="text-gray-600">
                  Bonjour <strong>{selectedTrainee.first_name} {selectedTrainee.last_name}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Code d'accès à 6 chiffres
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 border rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-purple-500"
                    placeholder="000000"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Vous avez reçu ce code par email ou de la part du formateur
                  </p>
                </div>

                {codeError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-800">
                      {codeError}
                      {attemptsRemaining > 0 && (
                        <div className="mt-1">Tentatives restantes : {attemptsRemaining}</div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || accessCode.length !== 6}
                  className="w-full py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  Vérifier
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep('select')
                    setSelectedTrainee(null)
                    setAccessCode('')
                    setCodeError('')
                  }}
                  className="w-full text-gray-600 hover:text-gray-800 transition text-sm"
                >
                  ← Changer de stagiaire
                </button>
              </form>
            </div>
          )}

          {/* STEP: Fiche info */}
          {currentStep === 'info_sheet' && selectedTrainee && (
            <form onSubmit={handleSubmitInfoSheet} className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Fiche de renseignement
              </h2>
              <p className="text-xs text-gray-500">1ère connexion uniquement • Ces informations sont confidentielles</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={infoForm.first_name}
                    onChange={(e) => setInfoForm({...infoForm, first_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  {formErrors.first_name && <p className="text-xs text-red-600 mt-1">{formErrors.first_name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nom *</label>
                  <input
                    type="text"
                    value={infoForm.last_name}
                    onChange={(e) => setInfoForm({...infoForm, last_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  {formErrors.last_name && <p className="text-xs text-red-600 mt-1">{formErrors.last_name}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date de naissance *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="JJ/MM/AAAA"
                  value={infoForm.birth_date_display}
                  onChange={(e) => setInfoForm({...infoForm, birth_date_display: formatBirthDateInput(e.target.value)})}
                  maxLength={10}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                {formErrors.birth_date && <p className="text-xs text-red-600 mt-1">{formErrors.birth_date}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Genre *</label>
                <select
                  value={infoForm.gender}
                  onChange={(e) => setInfoForm({...infoForm, gender: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="male">Homme</option>
                  <option value="female">Femme</option>
                  <option value="non_binary">Non genré</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={infoForm.email}
                  onChange={(e) => setInfoForm({...infoForm, email: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">N° Sécurité Sociale {!infoForm.ssn_refused && '*'}</label>
                <input
                  type="text"
                  value={infoForm.ssn}
                  onChange={(e) => {
                    const formatted = formatSSN(e.target.value)
                    setInfoForm({...infoForm, ssn: formatted})
                  }}
                  disabled={infoForm.ssn_refused}
                  placeholder={infoForm.ssn_refused ? 'Non communiqué' : '1 23 45 67 890 123 45'}
                  maxLength={21}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${
                    infoForm.ssn_refused ? 'bg-gray-100 text-gray-400' : ''
                  }`}
                />
                {formErrors.ssn && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.ssn}</p>
                )}
                {infoForm.ssn && !infoForm.ssn_refused && infoForm.ssn.replace(/\s/g, '').length === 15 && (
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    {validateSSNKey(infoForm.ssn) ? (
                      <>
                        <span className="text-green-600">✓</span> Numéro valide
                      </>
                    ) : (
                      <>
                        <span className="text-orange-600">⚠</span> Clé de contrôle incorrecte - Vérifiez votre saisie
                      </>
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Année dernière formation</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 2023"
                  maxLength={4}
                  value={infoForm.last_training_year}
                  onChange={(e) => setInfoForm({...infoForm, last_training_year: e.target.value.replace(/\D/g, '')})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Diplôme le plus élevé *</label>
                <select
                  value={infoForm.highest_diploma}
                  onChange={(e) => setInfoForm({...infoForm, highest_diploma: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">-- Sélectionner --</option>
                  <option value="Sans diplôme">Sans diplôme</option>
                  <option value="CAP/BEP">CAP/BEP</option>
                  <option value="Baccalauréat">Baccalauréat</option>
                  <option value="Bac+2">Bac+2 (BTS, DUT)</option>
                  <option value="Bac+3">Bac+3 (Licence)</option>
                  <option value="Bac+5">Bac+5 (Master)</option>
                  <option value="Bac+8">Bac+8 (Doctorat)</option>
                </select>
                {formErrors.highest_diploma && <p className="text-xs text-red-600 mt-1">{formErrors.highest_diploma}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Catégorie socio-professionnelle (CSP) *</label>
                <select
                  value={infoForm.csp}
                  onChange={(e) => setInfoForm({...infoForm, csp: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">-- Sélectionner --</option>
                  <option value="Agriculteurs exploitants">Agriculteurs exploitants</option>
                  <option value="Artisans, commerçants, chefs d'entreprise">Artisans, commerçants, chefs d'entreprise</option>
                  <option value="Cadres et professions intellectuelles supérieures">Cadres et professions intellectuelles supérieures</option>
                  <option value="Professions intermédiaires">Professions intermédiaires</option>
                  <option value="Employés">Employés</option>
                  <option value="Ouvriers">Ouvriers</option>
                  <option value="Retraités">Retraités</option>
                  <option value="Autres personnes sans activité professionnelle">Autres personnes sans activité professionnelle</option>
                </select>
                {formErrors.csp && <p className="text-xs text-red-600 mt-1">{formErrors.csp}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Intitulé du poste *</label>
                <input
                  type="text"
                  value={infoForm.job_title}
                  onChange={(e) => setInfoForm({...infoForm, job_title: e.target.value})}
                  placeholder="Ex: Technicien de maintenance"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                {formErrors.job_title && <p className="text-xs text-red-600 mt-1">{formErrors.job_title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mes attentes de la formation *</label>
                <textarea
                  value={infoForm.training_expectations}
                  onChange={(e) => setInfoForm({...infoForm, training_expectations: e.target.value})}
                  placeholder="Décrivez vos attentes, objectifs personnels, compétences à acquérir..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                />
                {formErrors.training_expectations && <p className="text-xs text-red-600 mt-1">{formErrors.training_expectations}</p>}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <label className="flex items-start gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={infoForm.ssn_refused}
                    onChange={(e) => setInfoForm({...infoForm, ssn_refused: e.target.checked, ssn: e.target.checked ? '' : infoForm.ssn})}
                    className="mt-0.5 rounded"
                  />
                  <span>Je refuse de communiquer mon numéro de Sécurité Sociale</span>
                </label>
                
                <label className="flex items-start gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={infoForm.rgpd_consent}
                    onChange={(e) => setInfoForm({...infoForm, rgpd_consent: e.target.checked})}
                    className="mt-0.5 rounded"
                  />
                  <span>
                    J'accepte que mes données personnelles soient collectées et traitées par Access Formation 
                    conformément au RGPD. Ces données serviront uniquement à la gestion de ma formation.
                  </span>
                </label>
                {formErrors.rgpd && <p className="text-xs text-red-600">{formErrors.rgpd}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Enregistrer et continuer
              </button>
            </form>
          )}

          {/* STEP: Émargement - CORRIGÉ */}
          {/* Modal warning horaire */}
          {showTimeWarning && timeWarningDetails && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-bold text-orange-600 mb-3">⚠️ Émargement hors créneau</h3>
                <p className="text-sm text-gray-700 mb-2">
                  Vous êtes actuellement hors du créneau horaire autorisé pour l'émargement {timeWarningDetails.period}.
                </p>
                <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
                  <p><strong>Heure actuelle :</strong> {timeWarningDetails.currentTime}</p>
                  <p><strong>Créneau autorisé :</strong> {timeWarningDetails.allowedStart} - {timeWarningDetails.allowedEnd}</p>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Voulez-vous quand même émarger ? (Le formateur pourra valider manuellement)
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={timeWarningDetails.onCancel}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={timeWarningDetails.onConfirm}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TEST DE POSITIONNEMENT */}
          {currentStep === 'positioning_test' && selectedTrainee && (
            <div className="max-w-4xl mx-auto p-4">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6">
                  <h2 className="text-2xl font-bold mb-2">Test de positionnement</h2>
                  <p className="text-purple-100">
                    Bienvenue {selectedTrainee.first_name} ! 
                    Quelques questions pour évaluer vos connaissances actuelles.
                  </p>
                  <p className="text-sm text-purple-200 mt-2">
                    ✓ Vos réponses nous aideront à adapter la formation à votre niveau
                  </p>
                </div>

                <div className="p-6">
                  {loadingQuestions ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
                      <p className="text-gray-600">Chargement des questions...</p>
                    </div>
                  ) : positioningQuestions.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">Aucune question disponible pour cette formation</p>
                      <button
                        onClick={() => setCurrentStep('attendance')}
                        className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Continuer sans test
                      </button>
                    </div>
                  ) : (
                    <PositioningTestForm
                      questions={positioningQuestions}
                      onComplete={handlePositioningTestComplete}
                      traineeName={`${selectedTrainee.first_name} ${selectedTrainee.last_name}`}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 'attendance' && selectedTrainee && (() => {
            const dates = session.start_date && session.end_date
              ? eachDayOfInterval({ start: parseISO(session.start_date), end: parseISO(session.end_date) })
              : []
            
            const todayIndex = dates.findIndex(d => format(d, 'yyyy-MM-dd') === today)
            const currentDate = todayIndex >= 0 ? dates[todayIndex] : null
            
            // Vérifier si on est AVANT la formation
            const isBeforeFormation = dates.length > 0 && !currentDate && new Date(today) < new Date(dates[0])

            // Si AVANT la formation : Message d'accès anticipé
            if (isBeforeFormation) {
              const formationStart = format(parseISO(dates[0]), 'dd/MM/yyyy', { locale: fr })
              return (
                <div className="max-w-2xl mx-auto p-4">
                  <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
                      <CheckCircle className="w-16 h-16 mx-auto mb-4" />
                      <h2 className="text-2xl font-bold text-center mb-2">
                        Parfait {selectedTrainee.first_name} !
                      </h2>
                      <p className="text-green-100 text-center">
                        Votre préparation est terminée
                      </p>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h3 className="font-semibold text-green-900 mb-2">✓ Votre fiche stagiaire est remplie</h3>
                        {positioningQuestions.length > 0 && (
                          <h3 className="font-semibold text-green-900 mb-2">✓ Votre test de positionnement est complété</h3>
                        )}
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                          <Calendar className="w-5 h-5" />
                          Rendez-vous le {formationStart}
                        </h3>
                        <p className="text-blue-800 text-sm">
                          Le jour de la formation, vous n'aurez plus qu'à signer votre présence !
                        </p>
                      </div>
                      
                      <div className="text-center pt-4">
                        <p className="text-gray-600 text-sm mb-4">
                          Vous recevrez un rappel par email avant le début de la formation.
                        </p>
                        <button
                          onClick={() => window.location.reload()}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Retour à l'accueil
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            // Si pas aujourd'hui ET pas avant : pas de session aujourd'hui
            if (!currentDate) {
              return (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <p className="text-gray-600">Aucune session prévue aujourd'hui</p>
                </div>
              )
            }

            const isFirst = isFirstHalfDay(today, 'morning')
            
            return (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Émargement {session.day_type === 'half' ? 'demi-journée' : 'demi-journées'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {session.day_type === 'half' ? 'Matin' : 'Matin + Après-midi'} du jour en cours
                  </p>
                </div>
                
                {/* Certification et signature (première demi-journée uniquement) */}
                {isFirst && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                    <div className="flex items-start gap-2">
                      <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-900 space-y-2">
                        <p className="font-medium">Certification et protection des données</p>
                        <p>
                          Je certifie que les informations renseignées (identité, coordonnées, etc.) sont exactes 
                          et que ma présence à cette formation est effective.
                        </p>
                        <p className="text-xs">
                          Je reconnais avoir pris connaissance de la politique de protection des données personnelles 
                          conformément au RGPD. Mes données seront traitées uniquement dans le cadre de cette formation 
                          et conservées selon les obligations légales (durée : 3 ans après la formation).
                        </p>
                      </div>
                    </div>
                    
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={certificationAccepted}
                        onChange={(e) => setCertificationAccepted(e.target.checked)}
                        className="mt-1 w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-blue-900">
                        J'accepte et certifie l'exactitude des informations
                      </span>
                    </label>
                    
                    {certificationAccepted && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-blue-900">Signature obligatoire :</p>
                        <canvas
                          ref={(canvas) => {
                            if (!canvas || signatureData) return
                            const ctx = canvas.getContext('2d')
                            canvas.width = canvas.offsetWidth
                            canvas.height = 100
                            ctx.strokeStyle = '#1e40af'
                            ctx.lineWidth = 2
                            ctx.lineCap = 'round'
                            
                            let drawing = false
                            const startDrawing = (e) => {
                              drawing = true
                              const rect = canvas.getBoundingClientRect()
                              const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
                              const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
                              ctx.beginPath()
                              ctx.moveTo(x, y)
                            }
                            const draw = (e) => {
                              if (!drawing) return
                              e.preventDefault()
                              const rect = canvas.getBoundingClientRect()
                              const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
                              const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
                              ctx.lineTo(x, y)
                              ctx.stroke()
                            }
                            const stopDrawing = () => {
                              if (drawing) {
                                setSignatureData(canvas.toDataURL())
                              }
                              drawing = false
                            }
                            
                            canvas.addEventListener('mousedown', startDrawing)
                            canvas.addEventListener('mousemove', draw)
                            canvas.addEventListener('mouseup', stopDrawing)
                            canvas.addEventListener('touchstart', startDrawing)
                            canvas.addEventListener('touchmove', draw)
                            canvas.addEventListener('touchend', stopDrawing)
                          }}
                          className="w-full border-2 border-blue-300 rounded bg-white"
                          style={{ touchAction: 'none' }}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSignatureData(null)
                              const canvas = document.querySelector('canvas')
                              if (canvas) {
                                const ctx = canvas.getContext('2d')
                                ctx.clearRect(0, 0, canvas.width, canvas.height)
                              }
                            }}
                            className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Effacer
                          </button>
                          {signatureData && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              Signature enregistrée
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">
                    <strong>{format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}</strong>
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Jour {todayIndex + 1}/{dates.length}
                  </p>
                </div>

                <div className="space-y-3">
                  {session.periods.map(period => {
                    const key = `${today}_${period}`
                    const isChecked = attendanceData[key] === true

                    return (
                      <div key={period} className="flex items-center justify-between p-4 border rounded-lg">
                        <span className="font-medium">
                          {period === 'morning' ? '🌅 Matin (9h-12h)' : '🌆 Après-midi (13h-17h)'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleAttendance(today, period)}
                          className={`px-4 py-2 rounded-lg font-semibold transition ${
                            isChecked
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {isChecked ? 'Présent ✓' : 'Signer'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* STEP: Thank you */}
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

          {/* STEP: Thank You + Website */}
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
          Access Formation • v2.7.2
        </p>
      </div>
    </div>
  )
}
