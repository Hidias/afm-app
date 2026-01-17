import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { 
  User, GraduationCap, FileText, CheckCircle, AlertCircle, 
  Loader2, Calendar, Star, MessageSquare, ExternalLink, Shield
} from 'lucide-react'
import { format, parseISO, isToday, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'

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
  
  // Steps: 'select' | 'verify_code' | 'info_sheet' | 'attendance' | 'evaluation' | 'thank_you' | 'google_review' | 'thank_you_website'
  const [currentStep, setCurrentStep] = useState('select')
  
  // Code d'accès
  const [accessCode, setAccessCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [attemptsRemaining, setAttemptsRemaining] = useState(5)
  
  // Data
  const [infoSheet, setInfoSheet] = useState(null)
  const [attendanceData, setAttendanceData] = useState({})
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
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
          courses(title, duration_hours),
          clients(name),
          session_trainees(id, trainee_id, access_code, access_code_attempts, access_code_locked, trainees(id, first_name, last_name, email, phone, birth_date, social_security_number, refused_ssn, csp, job_title))
        `)
        .eq('attendance_token', token)
        .single()

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
      
      const traineesList = sessionData.session_trainees?.map(st => ({
        ...st.trainees,
        session_trainee_id: st.id,
        access_code: st.access_code,
        access_code_attempts: st.access_code_attempts || 0,
        access_code_locked: st.access_code_locked || false
      })).filter(Boolean) || []
      
      setTrainees(traineesList)
      setLoading(false)
    } catch (err) {
      console.error('Erreur:', err)
      setError('Erreur lors du chargement')
      setLoading(false)
    }
  }

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
      // Charger fiche de renseignement
      const { data: infoData } = await supabase
        .from('trainee_info_sheets')
        .select('*')
        .eq('session_id', session.id)
        .eq('trainee_id', trainee.id)
        .maybeSingle()
      
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
        rgpd_consent: infoData?.rgpd_consent || false,
      })

      // ============================================================
      // CORRECTION: Charger émargement depuis attendance_halfdays
      // ============================================================
      const { data: attendanceRecords } = await supabase
        .from('attendance_halfdays')
        .select('date, morning, afternoon')
        .eq('session_id', session.id)
        .eq('trainee_id', trainee.id)

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

      // Charger évaluation
      const { data: evalData } = await supabase
        .from('trainee_evaluations')
        .select('*')
        .eq('session_id', session.id)
        .eq('trainee_id', trainee.id)
        .maybeSingle()

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
      
      if (infoData && infoData.filled_at) {
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
      } else {
        setCurrentStep('info_sheet')
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
    if (!infoForm.ssn_refused && !infoForm.ssn) {
      errors.ssn = 'N° Sécurité Sociale requis ou cochez "Je refuse"'
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
        social_security_number: infoForm.ssn_refused ? null : infoForm.ssn,
        refused_ssn: infoForm.ssn_refused,
        csp: infoForm.csp || null,
        job_title: infoForm.job_title || null,
      }
      
      await supabase.from('trainees').update(traineeUpdate).eq('id', selectedTrainee.id)
      setSelectedTrainee({ ...selectedTrainee, ...traineeUpdate })
      
      const infoData = {
        session_id: session.id,
        trainee_id: selectedTrainee.id,
        email: infoForm.email,
        ssn: infoForm.ssn_refused ? null : infoForm.ssn,
        ssn_refused: infoForm.ssn_refused,
        last_training_year: infoForm.last_training_year ? parseInt(infoForm.last_training_year) : null,
        highest_diploma: infoForm.highest_diploma,
        csp: infoForm.csp || null,
        job_title: infoForm.job_title || null,
        training_expectations: infoForm.training_expectations,
        rgpd_consent: infoForm.rgpd_consent,
        rgpd_consent_date: new Date().toISOString(),
        filled_at: new Date().toISOString(),
        filled_online: true,
      }
      
      const { data: existing } = await supabase
        .from('trainee_info_sheets')
        .select('id')
        .eq('session_id', session.id)
        .eq('trainee_id', selectedTrainee.id)
        .maybeSingle()
      
      if (existing) {
        await supabase.from('trainee_info_sheets').update(infoData).eq('id', existing.id)
      } else {
        await supabase.from('trainee_info_sheets').insert(infoData)
      }
      
      setInfoSheet({ ...infoData, filled_at: new Date().toISOString() })
      setCurrentStep('attendance')
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de l\'enregistrement. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================
  // CORRECTION: Écrire dans attendance_halfdays avec morning/afternoon
  // ============================================================
  const handleToggleAttendance = async (date, period) => {
    const key = `${date}_${period}`
    const currentValue = attendanceData[key]
    const newValue = !currentValue

    // Mise à jour optimiste
    const newAttendanceData = { ...attendanceData, [key]: newValue }
    setAttendanceData(newAttendanceData)

    try {
      // Vérifier si une entrée existe pour cette date
      const { data: existing } = await supabase
        .from('attendance_halfdays')
        .select('id, morning, afternoon')
        .eq('session_id', session.id)
        .eq('trainee_id', selectedTrainee.id)
        .eq('date', date)
        .maybeSingle()

      if (existing) {
        // Mettre à jour l'entrée existante
        const updateData = {
          [period]: newValue,
          validated_at: new Date().toISOString(),
          validated_by: `${selectedTrainee.first_name} ${selectedTrainee.last_name}`,
        }
        
        const { error } = await supabase
          .from('attendance_halfdays')
          .update(updateData)
          .eq('id', existing.id)
        
        if (error) {
          console.error('Erreur update attendance_halfdays:', error)
          throw error
        }
      } else {
        // Créer une nouvelle entrée
        const insertData = {
          session_id: session.id,
          trainee_id: selectedTrainee.id,
          date: date,
          morning: period === 'morning' ? newValue : false,
          afternoon: period === 'afternoon' ? newValue : false,
          validated_at: new Date().toISOString(),
          validated_by: `${selectedTrainee.first_name} ${selectedTrainee.last_name}`,
        }
        
        const { error } = await supabase
          .from('attendance_halfdays')
          .insert(insertData)
        
        if (error) {
          console.error('Erreur insert attendance_halfdays:', error)
          throw error
        }
      }

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
      setAttendanceData({ ...attendanceData, [key]: currentValue })
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

      const { data: existing } = await supabase
        .from('trainee_evaluations')
        .select('id')
        .eq('session_id', session.id)
        .eq('trainee_id', selectedTrainee.id)
        .maybeSingle()

      console.log('Existing evaluation:', existing)

      if (existing) {
        const { data, error } = await supabase
          .from('trainee_evaluations')
          .update(evalData)
          .eq('id', existing.id)
          .select()
        
        console.log('Update result:', { data, error })
        
        if (error) {
          console.error('Erreur update evaluation:', error)
          throw error
        }
      } else {
        const { data, error } = await supabase
          .from('trainee_evaluations')
          .insert(evalData)
          .select()
        
        console.log('Insert result:', { data, error })
        
        if (error) {
          console.error('Erreur insert evaluation:', error)
          throw error
        }
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
                  onChange={(e) => setInfoForm({...infoForm, ssn: e.target.value})}
                  disabled={infoForm.ssn_refused}
                  placeholder={infoForm.ssn_refused ? 'Non communiqué' : ''}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${infoForm.ssn_refused ? 'bg-gray-100 text-gray-400' : ''}`}
                />
                {formErrors.ssn && <p className="text-xs text-red-600 mt-1">{formErrors.ssn}</p>}
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
          {currentStep === 'attendance' && selectedTrainee && (() => {
            const dates = session.start_date && session.end_date
              ? eachDayOfInterval({ start: parseISO(session.start_date), end: parseISO(session.end_date) })
              : []
            
            const todayIndex = dates.findIndex(d => format(d, 'yyyy-MM-dd') === today)
            const currentDate = todayIndex >= 0 ? dates[todayIndex] : null

            if (!currentDate) {
              return (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <p className="text-gray-600">Aucune session prévue aujourd'hui</p>
                </div>
              )
            }

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
          Access Formation • v2.6.1
        </p>
      </div>
    </div>
  )
}
