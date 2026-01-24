import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { 
  Calendar, MapPin, User, Clock, CheckCircle, 
  AlertCircle, FileText, Star, ThumbsUp, MessageSquare,
  ExternalLink, Home
} from 'lucide-react'
import { format, parseISO, eachDayOfInterval, isToday, isBefore, isAfter, addHours, subHours } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import SignatureCanvas from 'react-signature-canvas'

export default function TraineePortalInter() {
  const { code } = useParams()
  const navigate = useNavigate()
  
  // States
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  
  const [portalData, setPortalData] = useState(null)
  const [session, setSession] = useState(null)
  const [trainee, setTrainee] = useState(null)
  
  // Steps: 'info_sheet' | 'attendance' | 'evaluation' | 'thank_you' | 'google_review' | 'thank_you_website'
  const [currentStep, setCurrentStep] = useState('info_sheet')
  const [showDocuments, setShowDocuments] = useState(false)
  
  // Data
  const [infoSheet, setInfoSheet] = useState(null)
  const [attendanceData, setAttendanceData] = useState({})
  const [certificationAccepted, setCertificationAccepted] = useState(false)
  const [signatureData, setSignatureData] = useState(null)
  const [signatureRef, setSignatureRef] = useState(null)
  const [showTimeWarning, setShowTimeWarning] = useState(false)
  const [timeWarningDetails, setTimeWarningDetails] = useState(null)
  const [evaluationData, setEvaluationData] = useState(null)
  
  // Forms
  const [infoForm, setInfoForm] = useState({
    first_name: '',
    last_name: '',
    birth_date_display: '',
    email: '',
    phone: '',
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
  
  const [evalForm, setEvalForm] = useState({
    q_org_documents: 5,
    q_org_accueil: 5,
    q_org_locaux: 5,
    q_org_materiel: 5,
    q_contenu_organisation: 5,
    q_contenu_supports: 5,
    q_contenu_duree: 5,
    q_contenu_programme: 5,
    q_formateur_pedagogie: 5,
    q_formateur_expertise: 5,
    q_formateur_progression: 5,
    q_formateur_moyens: 5,
    q_global_adequation: 5,
    q_global_competences: 5,
    would_recommend: true,
    comment_general: '',
    comment_projet: ''
  })
  
  const [formErrors, setFormErrors] = useState({})
  
  // Load data on mount
  useEffect(() => {
    if (code) {
      loadData()
    }
  }, [code])
  
  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: rpcError } = await supabase.rpc('load_inter_portal_data', {
        p_access_code: code
      })
      
      if (rpcError) throw rpcError
      if (!data) throw new Error('Aucune donnée trouvée')
      
      setPortalData(data)
      setSession(data.session)
      setTrainee(data.trainee)
      
      // Load info sheet
      const infoData = data.info_sheet
      setInfoSheet(infoData)
      
      let birthDateDisplay = ''
      if (data.trainee?.birth_date) {
        const parts = data.trainee.birth_date.split('-')
        if (parts.length === 3) {
          birthDateDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`
        }
      }
      
      setInfoForm({
        first_name: data.trainee?.first_name || '',
        last_name: data.trainee?.last_name || '',
        birth_date_display: birthDateDisplay,
        email: data.trainee?.email || '',
        phone: data.trainee?.phone || '',
        ssn: infoData?.ssn || '',
        ssn_refused: infoData?.ssn_refused || false,
        last_training_year: infoData?.last_training_year?.toString() || '',
        highest_diploma: infoData?.highest_diploma || '',
        csp: data.trainee?.csp || infoData?.csp || '',
        job_title: data.trainee?.job_title || infoData?.job_title || '',
        training_expectations: infoData?.training_expectations || '',
        gender: data.trainee?.gender || 'male',
        rgpd_consent: infoData?.rgpd_consent || false,
      })
      
      // Load attendance
      const attendanceMap = {}
      const attendanceRecords = data.attendance || []
      attendanceRecords.forEach(rec => {
        const dateStr = typeof rec.date === 'string' ? rec.date.substring(0, 10) : format(new Date(rec.date), 'yyyy-MM-dd')
        if (rec.morning) {
          attendanceMap[`${dateStr}_morning`] = true
        }
        if (rec.afternoon) {
          attendanceMap[`${dateStr}_afternoon`] = true
        }
      })
      setAttendanceData(attendanceMap)
      
      // Load evaluation
      const evalData = data.evaluation
      setEvaluationData(evalData)
      if (evalData) {
        setEvalForm({
          q_org_documents: evalData.q_org_documents || 0,
          q_org_accueil: evalData.q_org_accueil || 0,
          q_org_locaux: evalData.q_org_locaux || 0,
          q_org_materiel: evalData.q_org_materiel || 0,
          q_contenu_organisation: evalData.q_contenu_organisation || 0,
          q_contenu_supports: evalData.q_contenu_supports || 0,
          q_contenu_duree: evalData.q_contenu_duree || 0,
          q_contenu_programme: evalData.q_contenu_programme || 0,
          q_formateur_pedagogie: evalData.q_formateur_pedagogie || 0,
          q_formateur_expertise: evalData.q_formateur_expertise || 0,
          q_formateur_progression: evalData.q_formateur_progression || 0,
          q_formateur_moyens: evalData.q_formateur_moyens || 0,
          q_global_adequation: evalData.q_global_adequation || 0,
          q_global_competences: evalData.q_global_competences || 0,
          would_recommend: evalData.would_recommend || false,
          comment_general: evalData.comment_general || '',
          comment_projet: evalData.comment_projet || ''
        })
      }
      
      // Determine starting step
      determineStep(data)
      
    } catch (err) {
      console.error('Erreur chargement:', err)
      setError(err.message || 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }
  
  const determineStep = (data) => {
    // If info sheet not completed, start there
    if (!data.session_trainee?.info_sheet_completed) {
      setCurrentStep('info_sheet')
      return
    }
    
    // If evaluation completed, show thank you
    if (data.session_trainee?.evaluation_completed) {
      if (data.session_trainee?.google_review_clicked) {
        setCurrentStep('thank_you_website')
      } else {
        // Check if should redirect to Google
        const evalData = data.evaluation
        if (evalData) {
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
        } else {
          setCurrentStep('thank_you')
        }
      }
      return
    }
    
    // Check if last day and all periods checked
    const today = getTodayFormation()
    const isLastDay = data.session?.end_date && isToday(parseISO(data.session.end_date))
    
    if (isLastDay) {
      const allPeriodsChecked = data.session.periods?.every(p => {
        const k = `${today}_${p}`
        const attendanceMap = {}
        const attendanceRecords = data.attendance || []
        attendanceRecords.forEach(rec => {
          const dateStr = typeof rec.date === 'string' ? rec.date.substring(0, 10) : format(new Date(rec.date), 'yyyy-MM-dd')
          if (rec.morning) attendanceMap[`${dateStr}_morning`] = true
          if (rec.afternoon) attendanceMap[`${dateStr}_afternoon`] = true
        })
        return attendanceMap[k] === true
      }) || false
      
      if (allPeriodsChecked) {
        setCurrentStep('evaluation')
      } else {
        setCurrentStep('attendance')
      }
    } else {
      setCurrentStep('attendance')
    }
  }
  
  // Helper functions
  const formatBirthDateInput = (value) => {
    const digits = value.replace(/\D/g, '')
    let formatted = ''
    if (digits.length > 0) formatted = digits.slice(0, 2)
    if (digits.length > 2) formatted += '/' + digits.slice(2, 4)
    if (digits.length > 4) formatted += '/' + digits.slice(4, 8)
    return formatted
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
    return true
  }
  
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }
  
  const formatSSN = (value) => {
    const digits = value.replace(/\D/g, '')
    let formatted = ''
    // Format officiel : 1 89 10 46 102 036 44
    // Espaces après positions : 1, 3, 5, 7, 10, 13
    const spacePositions = [1, 3, 5, 7, 10, 13]
    
    for (let i = 0; i < digits.length && i < 15; i++) {
      formatted += digits[i]
      if (spacePositions.includes(i + 1) && i < 14) {
        formatted += ' '
      }
    }
    return formatted
  }
  
  const validateSSNKey = (ssn) => {
    const digits = ssn.replace(/\s/g, '')
    if (digits.length !== 15) return false
    const base = parseInt(digits.substring(0, 13), 10)
    const key = parseInt(digits.substring(13, 15), 10)
    const calculatedKey = 97 - (base % 97)
    return key === calculatedKey
  }
  
  const getTodayFormation = () => {
    return format(new Date(), 'yyyy-MM-dd')
  }
  
  const checkTimeSlot = (period) => {
    if (!session) return { allowed: true }
    
    const now = new Date()
    const sessionDate = getTodayFormation()
    
    // Parse session times
    const [startHour, startMin] = (session.start_time || '09:00').split(':').map(Number)
    const [endHour, endMin] = (session.end_time || '17:00').split(':').map(Number)
    
    const sessionStart = new Date()
    sessionStart.setHours(startHour, startMin, 0, 0)
    
    const sessionEnd = new Date()
    sessionEnd.setHours(endHour, endMin, 0, 0)
    
    if (period === 'morning') {
      const allowedStart = subHours(sessionStart, 1)
      const allowedEnd = new Date()
      allowedEnd.setHours(13, 0, 0, 0)
      
      if (isBefore(now, allowedStart) || isAfter(now, allowedEnd)) {
        return {
          allowed: false,
          period: 'du matin',
          window: `${format(allowedStart, 'HH:mm')} - 13:00`,
          message: 'Vous êtes en dehors du créneau horaire autorisé pour l\'émargement du matin.'
        }
      }
    } else {
      const allowedStart = new Date()
      allowedStart.setHours(13, 0, 0, 0)
      const allowedEnd = addHours(sessionEnd, 1)
      
      if (isBefore(now, allowedStart) || isAfter(now, allowedEnd)) {
        return {
          allowed: false,
          period: 'de l\'après-midi',
          window: `13:00 - ${format(allowedEnd, 'HH:mm')}`,
          message: 'Vous êtes en dehors du créneau horaire autorisé pour l\'émargement de l\'après-midi.'
        }
      }
    }
    
    return { allowed: true }
  }
  
  const isFirstHalfDay = (date, period) => {
    if (!session?.start_date) return false
    const firstDate = format(parseISO(session.start_date), 'yyyy-MM-dd')
    return date === firstDate && period === 'morning'
  }
  
  // Submit functions
  const handleSubmitInfoSheet = async (e) => {
    e.preventDefault()
    setFormErrors({})
    
    // Validation
    const errors = {}
    if (!infoForm.first_name) errors.first_name = 'Requis'
    if (!infoForm.last_name) errors.last_name = 'Requis'
    if (!infoForm.birth_date_display || !isValidBirthDate(infoForm.birth_date_display)) {
      errors.birth_date_display = 'Date invalide (JJ/MM/AAAA)'
    }
    if (infoForm.email && !isValidEmail(infoForm.email)) {
      errors.email = 'Email invalide'
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
      errors.rgpd_consent = 'Vous devez accepter'
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    
    setSubmitting(true)
    
    try {
      const { data, error } = await supabase.rpc('save_inter_info_sheet', {
        p_access_code: code,
        p_data: infoForm
      })
      
      if (error) throw error
      
      toast.success('Fiche enregistrée avec succès!')
      setCurrentStep('attendance')
      await loadData()
      
    } catch (err) {
      console.error('Erreur:', err)
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setSubmitting(false)
    }
  }
  
  const handleToggleAttendance = async (date, period) => {
    const key = `${date}_${period}`
    const currentValue = attendanceData[key]
    const newValue = !currentValue
    
    // Check if first half day
    const isFirst = isFirstHalfDay(date, period)
    if (isFirst && newValue) {
      if (!certificationAccepted) {
        toast.error('⚠️ Vous devez accepter la certification avant d\'émarger.')
        return
      }
      if (!signatureData) {
        toast.error('⚠️ Vous devez signer avant d\'émarger pour la première fois.')
        return
      }
    }
    
    // Check time slot
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
    
    await proceedWithAttendance(date, period, newValue, isFirst)
  }
  
  const proceedWithAttendance = async (date, period, newValue, isFirst) => {
    const key = `${date}_${period}`
    
    // Optimistic update
    const newAttendanceData = { ...attendanceData, [key]: newValue }
    setAttendanceData(newAttendanceData)
    
    try {
      const { data, error } = await supabase.rpc('save_inter_attendance', {
        p_access_code: code,
        p_date: date,
        p_period: period,
        p_value: newValue,
        p_validated_by: `${trainee.first_name} ${trainee.last_name}`
      })
      
      if (error) throw error
      
      // Calculate presence_complete
      const dates = session.start_date && session.end_date
        ? eachDayOfInterval({ start: parseISO(session.start_date), end: parseISO(session.end_date) })
        : []
      
      const totalHalfDays = dates.length * (session.day_type === 'half' ? 1 : 2)
      
      let presentCount = 0
      dates.forEach(d => {
        const dateStr = format(d, 'yyyy-MM-dd')
        const periods = session.day_type === 'half' ? ['morning'] : ['morning', 'afternoon']
        periods.forEach(p => {
          const k = `${dateStr}_${p}`
          if (newAttendanceData[k] === true) {
            presentCount++
          }
        })
      })
      
      const isComplete = presentCount === totalHalfDays && totalHalfDays > 0
      
      // Update presence_complete
      await supabase
        .from('session_trainees')
        .update({ presence_complete: isComplete })
        .eq('session_id', session.id)
        .eq('trainee_id', trainee.id)
      
      // Check if all periods of today are checked
      const today = getTodayFormation()
      const periods = session.day_type === 'half' ? ['morning'] : ['morning', 'afternoon']
      const allPeriodsChecked = periods.every(p => {
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
      setAttendanceData({ ...attendanceData, [key]: !newValue })
      toast.error('Erreur lors de l\'enregistrement')
    }
  }
  
  const handleSubmitEvaluation = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const evalData = {
        ...evalForm,
        session_id: session.id,
        trainee_id: trainee.id,
        questionnaire_submitted: true,
        submitted_at: new Date().toISOString(),
        submitted_online: true,
      }
      
      const { data, error } = await supabase.rpc('save_inter_evaluation', {
        p_access_code: code,
        p_eval_data: evalData
      })
      
      if (error) throw error
      
      // Calculate average
      const questionKeys = [
        'q_org_documents', 'q_org_accueil', 'q_org_locaux', 'q_org_materiel',
        'q_contenu_organisation', 'q_contenu_supports', 'q_contenu_duree', 'q_contenu_programme',
        'q_formateur_pedagogie', 'q_formateur_expertise', 'q_formateur_progression', 'q_formateur_moyens',
        'q_global_adequation', 'q_global_competences'
      ]
      const scores = questionKeys.map(k => evalForm[k]).filter(v => v > 0)
      const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      
      // Redirect: Google if >= 4.5 AND would_recommend, else website
      if (evalForm.would_recommend && average >= 4.5) {
        setCurrentStep('google_review')
      } else {
        setCurrentStep('thank_you_website')
      }
    } catch (err) {
      console.error('Erreur:', err)
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setSubmitting(false)
    }
  }
  
  const handleGoogleReviewClick = async () => {
    // Mark as clicked
    await supabase
      .from('session_trainees')
      .update({ google_review_clicked: true })
      .eq('session_id', session.id)
      .eq('trainee_id', trainee.id)
    
    // Open Google review
    window.open('https://g.page/r/CfwKCH8cKfE8EBM/review', '_blank')
    
    setCurrentStep('thank_you_website')
  }
  
  // Render functions
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
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-8 h-8" />
            <h2 className="text-xl font-bold">Erreur</h2>
          </div>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full btn btn-primary"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }
  
  const headerColor = currentStep === 'evaluation' ? 'from-orange-500 to-orange-600' 
    : currentStep === 'google_review' ? 'from-green-500 to-green-600'
    : 'from-blue-500 to-purple-600'
  
  return (
    <div className="min-h-screen bg-gradient-to-br ${headerColor}">
      {/* Header */}
      <div className={`bg-gradient-to-r ${headerColor} text-white py-6 shadow-lg`}>
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">{session?.course_title}</h1>
              <div className="flex flex-wrap gap-4 text-sm opacity-90">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {session?.start_date && format(parseISO(session.start_date), 'dd/MM/yyyy', { locale: fr })}
                  {session?.end_date && ` - ${format(parseISO(session.end_date), 'dd/MM/yyyy', { locale: fr })}`}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {session?.start_time} - {session?.end_time}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {session?.location_name}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-5 h-5" />
              <div>
                <div className="font-medium">{trainee?.first_name} {trainee?.last_name}</div>
                <div className="opacity-75 text-xs">Code: {code}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-xl p-6">
          
          {/* STEP: Info Sheet */}
          {currentStep === 'info_sheet' && (
            <form onSubmit={handleSubmitInfoSheet} className="space-y-5">
              <div className="border-b pb-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Fiche de renseignement</h2>
                <p className="text-sm text-gray-600 mt-1">Merci de compléter vos informations</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                {formErrors.birth_date_display && <p className="text-xs text-red-600 mt-1">{formErrors.birth_date_display}</p>}
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
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={infoForm.email}
                  onChange={(e) => setInfoForm({...infoForm, email: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={infoForm.phone}
                  onChange={(e) => setInfoForm({...infoForm, phone: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">N° Sécurité Sociale {!infoForm.ssn_refused && '*'}</label>
                <input
                  type="text"
                  value={infoForm.ssn}
                  onChange={(e) => setInfoForm({...infoForm, ssn: formatSSN(e.target.value)})}
                  disabled={infoForm.ssn_refused}
                  placeholder={infoForm.ssn_refused ? 'Non communiqué' : '1 89 10 46 102 036 44'}
                  maxLength={21}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${
                    infoForm.ssn_refused ? 'bg-gray-100 text-gray-400' : ''
                  }`}
                />
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
                  <option value="">Sélectionner...</option>
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
                  <option value="">Sélectionner...</option>
                  <option value="Agriculteurs exploitants">Agriculteurs exploitants</option>
                  <option value="Artisans, commerçants, chefs d'entreprise">Artisans, commerçants, chefs d'entreprise</option>
                  <option value="Cadres et professions intellectuelles supérieures">Cadres et professions intellectuelles supérieures</option>
                  <option value="Professions intermédiaires">Professions intermédiaires</option>
                  <option value="Employés">Employés</option>
                  <option value="Ouvriers">Ouvriers</option>
                  <option value="Retraités">Retraités</option>
                  <option value="Autres sans activité professionnelle">Autres sans activité professionnelle</option>
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
                {formErrors.rgpd_consent && <p className="text-xs text-red-600">{formErrors.rgpd_consent}</p>}
              </div>
              
              <button
                type="submit"
                disabled={submitting}
                className="w-full btn btn-primary btn-lg"
              >
                {submitting ? 'Enregistrement...' : 'Valider'}
              </button>
            </form>
          )}
          
          {/* STEP: Attendance */}
          {currentStep === 'attendance' && (() => {
            const dates = session.start_date && session.end_date
              ? eachDayOfInterval({ start: parseISO(session.start_date), end: parseISO(session.end_date) })
              : []
            
            const periods = session.day_type === 'half' ? ['morning'] : ['morning', 'afternoon']
            
            return (
              <div className="space-y-6">
                <div className="border-b pb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Émargement {session.day_type === 'half' ? 'demi-journée' : 'demi-journées'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Cochez votre présence</p>
                </div>
                
                {/* Certification (première fois seulement) */}
                {isFirstHalfDay(getTodayFormation(), 'morning') && !attendanceData[`${getTodayFormation()}_morning`] && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-4">
                    <h3 className="font-medium text-orange-900">Avant votre premier émargement</h3>
                    
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={certificationAccepted}
                        onChange={(e) => setCertificationAccepted(e.target.checked)}
                        className="mt-1"
                      />
                      <span className="text-sm text-gray-700">
                        Je certifie l'exactitude des informations fournies
                      </span>
                    </label>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Signature *</label>
                      <div className="border-2 border-gray-300 rounded-lg bg-white">
                        <SignatureCanvas
                          ref={(ref) => setSignatureRef(ref)}
                          canvasProps={{
                            className: 'w-full h-32',
                            style: { touchAction: 'none' }
                          }}
                          onEnd={() => {
                            if (signatureRef && !signatureRef.isEmpty()) {
                              setSignatureData(signatureRef.toDataURL())
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (signatureRef) {
                              signatureRef.clear()
                              setSignatureData(null)
                            }
                          }}
                          className="text-sm text-gray-600 hover:text-gray-900"
                        >
                          Effacer
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Attendance grid */}
                <div className="space-y-4">
                  {dates.map(date => {
                    const dateStr = format(date, 'yyyy-MM-dd')
                    const isToday = getTodayFormation() === dateStr
                    
                    return (
                      <div key={dateStr} className={`border rounded-lg p-4 ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}>
                        <div className="font-medium mb-3">
                          {format(date, 'EEEE dd MMMM yyyy', { locale: fr })}
                          {isToday && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Aujourd'hui</span>}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {periods.map(period => {
                            const key = `${dateStr}_${period}`
                            const isChecked = attendanceData[key] === true
                            const periodLabel = period === 'morning' ? '☀️ Matin' : '🌙 Après-midi'
                            
                            return (
                              <button
                                key={period}
                                type="button"
                                onClick={() => handleToggleAttendance(dateStr, period)}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                  isChecked
                                    ? 'bg-green-100 border-green-500 text-green-900'
                                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{periodLabel}</span>
                                  {isChecked && <CheckCircle className="w-5 h-5 text-green-600" />}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
          
          {/* STEP: Evaluation */}
          {currentStep === 'evaluation' && (
            <form onSubmit={handleSubmitEvaluation} className="space-y-6">
              <div className="border-b pb-4">
                <h2 className="text-2xl font-bold text-orange-900">Évaluation de la formation</h2>
                <p className="text-sm text-gray-600 mt-1">Votre avis est précieux pour nous améliorer</p>
              </div>
              
              {/* Organisation */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="bg-orange-100 text-orange-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                  Organisation
                </h3>
                
                <div className="space-y-3 pl-8">
                  <div>
                    <label className="block text-sm mb-2">Documents transmis avant la formation</label>
                    <RatingButtons questionKey="q_org_documents" currentValue={evalForm.q_org_documents} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Accueil</label>
                    <RatingButtons questionKey="q_org_accueil" currentValue={evalForm.q_org_accueil} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Locaux et équipements</label>
                    <RatingButtons questionKey="q_org_locaux" currentValue={evalForm.q_org_locaux} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Matériel pédagogique</label>
                    <RatingButtons questionKey="q_org_materiel" currentValue={evalForm.q_org_materiel} />
                  </div>
                </div>
              </div>
              
              {/* Contenu */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="bg-orange-100 text-orange-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                  Contenu de la formation
                </h3>
                
                <div className="space-y-3 pl-8">
                  <div>
                    <label className="block text-sm mb-2">Organisation du programme</label>
                    <RatingButtons questionKey="q_contenu_organisation" currentValue={evalForm.q_contenu_organisation} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Supports pédagogiques</label>
                    <RatingButtons questionKey="q_contenu_supports" currentValue={evalForm.q_contenu_supports} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Durée de la formation</label>
                    <RatingButtons questionKey="q_contenu_duree" currentValue={evalForm.q_contenu_duree} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Correspondance avec le programme</label>
                    <RatingButtons questionKey="q_contenu_programme" currentValue={evalForm.q_contenu_programme} />
                  </div>
                </div>
              </div>
              
              {/* Formateur */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="bg-orange-100 text-orange-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                  Le formateur
                </h3>
                
                <div className="space-y-3 pl-8">
                  <div>
                    <label className="block text-sm mb-2">Pédagogie et clarté</label>
                    <RatingButtons questionKey="q_formateur_pedagogie" currentValue={evalForm.q_formateur_pedagogie} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Expertise technique</label>
                    <RatingButtons questionKey="q_formateur_expertise" currentValue={evalForm.q_formateur_expertise} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Progression pédagogique</label>
                    <RatingButtons questionKey="q_formateur_progression" currentValue={evalForm.q_formateur_progression} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Moyens et méthodes</label>
                    <RatingButtons questionKey="q_formateur_moyens" currentValue={evalForm.q_formateur_moyens} />
                  </div>
                </div>
              </div>
              
              {/* Global */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="bg-orange-100 text-orange-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">4</span>
                  Appréciation globale
                </h3>
                
                <div className="space-y-3 pl-8">
                  <div>
                    <label className="block text-sm mb-2">Adéquation avec vos attentes</label>
                    <RatingButtons questionKey="q_global_adequation" currentValue={evalForm.q_global_adequation} />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Acquisition de compétences</label>
                    <RatingButtons questionKey="q_global_competences" currentValue={evalForm.q_global_competences} />
                  </div>
                </div>
              </div>
              
              {/* Would recommend */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Recommanderiez-vous cette formation ?</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEvalForm({...evalForm, would_recommend: true})}
                      className={`px-4 py-1.5 rounded text-sm font-medium ${
                        evalForm.would_recommend ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-green-50'
                      }`}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      onClick={() => setEvalForm({...evalForm, would_recommend: false})}
                      className={`px-4 py-1.5 rounded text-sm font-medium ${
                        evalForm.would_recommend === false ? 'bg-red-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-red-50'
                      }`}
                    >
                      Non
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Comments */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Commentaires généraux (optionnel)</label>
                  <textarea
                    value={evalForm.comment_general}
                    onChange={(e) => setEvalForm({...evalForm, comment_general: e.target.value})}
                    placeholder="Points forts, points d'amélioration..."
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Projet d'utilisation (optionnel)</label>
                  <textarea
                    value={evalForm.comment_projet}
                    onChange={(e) => setEvalForm({...evalForm, comment_projet: e.target.value})}
                    placeholder="Comment comptez-vous appliquer ces compétences ?"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    rows={3}
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={submitting}
                className="w-full btn btn-lg bg-orange-600 hover:bg-orange-700 text-white"
              >
                {submitting ? 'Enregistrement...' : 'Valider l\'évaluation'}
              </button>
            </form>
          )}
          
          {/* STEP: Google Review */}
          {currentStep === 'google_review' && (
            <div className="text-center space-y-6 py-8">
              <div className="flex justify-center">
                <div className="bg-green-100 rounded-full p-6">
                  <Star className="w-16 h-16 text-green-600" />
                </div>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Merci pour votre retour ! 🎉</h2>
                <p className="text-gray-600">
                  Votre avis est très positif ! Seriez-vous d'accord pour laisser un avis Google ?
                </p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={handleGoogleReviewClick}
                  className="w-full btn btn-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                >
                  <Star className="w-5 h-5" />
                  Laisser un avis Google
                </button>
                
                <button
                  onClick={() => setCurrentStep('thank_you_website')}
                  className="w-full btn btn-lg btn-secondary"
                >
                  Non merci, continuer
                </button>
              </div>
            </div>
          )}
          
          {/* STEP: Thank You Website */}
          {currentStep === 'thank_you_website' && (
            <div className="text-center space-y-6 py-8">
              <div className="flex justify-center">
                <div className="bg-blue-100 rounded-full p-6">
                  <CheckCircle className="w-16 h-16 text-blue-600" />
                </div>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Merci pour votre participation ! 🎓</h2>
                <p className="text-gray-600 mb-4">
                  Votre formation est terminée. N'hésitez pas à visiter notre site web pour découvrir nos autres formations.
                </p>
              </div>
              
              <button
                onClick={() => window.open('https://accessformation.pro', '_blank')}
                className="btn btn-lg btn-primary flex items-center justify-center gap-2 mx-auto"
              >
                <ExternalLink className="w-5 h-5" />
                Visiter le site web
              </button>
            </div>
          )}
          
          {/* STEP: Thank You */}
          {currentStep === 'thank_you' && (
            <div className="text-center space-y-6 py-8">
              <div className="flex justify-center">
                <div className="bg-green-100 rounded-full p-6">
                  <CheckCircle className="w-16 h-16 text-green-600" />
                </div>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Merci ! ✅</h2>
                <p className="text-gray-600">
                  À demain pour la suite de la formation !
                </p>
              </div>
            </div>
          )}
          
        </div>
      </div>
      
      {/* Time Warning Modal */}
      {showTimeWarning && timeWarningDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-orange-600 mb-3">⚠️ Émargement hors créneau</h3>
            <p className="text-gray-700 mb-4">{timeWarningDetails.message}</p>
            <p className="text-sm text-gray-600 mb-6">
              Créneau autorisé : {timeWarningDetails.window}
            </p>
            <div className="flex gap-3">
              <button
                onClick={timeWarningDetails.onCancel}
                className="flex-1 btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={timeWarningDetails.onConfirm}
                className="flex-1 btn btn-primary"
              >
                Continuer quand même
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
