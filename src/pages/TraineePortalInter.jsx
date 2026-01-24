import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SignatureCanvas from 'react-signature-canvas'
import { 
  User, GraduationCap, FileText, CheckCircle, AlertCircle, 
  Loader2, Calendar, Star, MessageSquare, ExternalLink, Building2,
  Clock, MapPin, PenTool, Trash2
} from 'lucide-react'
import { format, parseISO, isToday, isBefore, isAfter, eachDayOfInterval, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

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
  const numbers = value.replace(/\D/g, '')
  const truncated = numbers.slice(0, 15)
  
  if (truncated.length <= 1) return truncated
  if (truncated.length <= 3) return `${truncated.slice(0, 1)} ${truncated.slice(1)}`
  if (truncated.length <= 5) return `${truncated.slice(0, 1)} ${truncated.slice(1, 3)} ${truncated.slice(3)}`
  if (truncated.length <= 7) return `${truncated.slice(0, 1)} ${truncated.slice(1, 3)} ${truncated.slice(3, 5)} ${truncated.slice(5)}`
  if (truncated.length <= 10) return `${truncated.slice(0, 1)} ${truncated.slice(1, 3)} ${truncated.slice(3, 5)} ${truncated.slice(5, 7)} ${truncated.slice(7)}`
  if (truncated.length <= 13) return `${truncated.slice(0, 1)} ${truncated.slice(1, 3)} ${truncated.slice(3, 5)} ${truncated.slice(5, 7)} ${truncated.slice(7, 10)} ${truncated.slice(10)}`
  return `${truncated.slice(0, 1)} ${truncated.slice(1, 3)} ${truncated.slice(3, 5)} ${truncated.slice(5, 7)} ${truncated.slice(7, 10)} ${truncated.slice(10, 13)} ${truncated.slice(13)}`
}

export default function TraineePortalInter() {
  const { code } = useParams()
  const sigPadRef = useRef(null)
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  
  const [sessionTrainee, setSessionTrainee] = useState(null)
  const [session, setSession] = useState(null)
  const [trainee, setTrainee] = useState(null)
  const [course, setCourse] = useState(null)
  const [company, setCompany] = useState(null)
  
  // États selon timing
  const [canFillInfoSheet, setCanFillInfoSheet] = useState(false)
  const [canSign, setCanSign] = useState(false)
  const [canEvaluate, setCanEvaluate] = useState(false)
  const [currentDay, setCurrentDay] = useState(null)
  const [totalDays, setTotalDays] = useState(0)
  
  // Steps: 'loading' | 'info_sheet' | 'dashboard' | 'attendance' | 'evaluation' | 'google_review' | 'thank_you'
  const [currentStep, setCurrentStep] = useState('loading')
  
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
  
  const [formErrors, setFormErrors] = useState({})
  
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
    loadData()
  }, [code])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Charger session_trainee par access_code
      const { data: stData, error: stError } = await supabase
        .from('session_trainees')
        .select(`
          *,
          trainees (*),
          session_groups (
            *,
            clients (*)
          )
        `)
        .eq('access_code', code)
        .single()

      if (stError || !stData) {
        setError('Code d\'accès invalide ou session non trouvée')
        setLoading(false)
        return
      }

      setSessionTrainee(stData)
      setTrainee(stData.trainees)
      setCompany(stData.session_groups?.clients)

      // Charger la session inter
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions_inter')
        .select(`
          *,
          courses (*)
        `)
        .eq('id', stData.session_groups.session_id)
        .single()

      if (sessionError || !sessionData) {
        setError('Session non trouvée')
        setLoading(false)
        return
      }

      setSession(sessionData)
      setCourse(sessionData.courses)

      // Calculer le nombre de jours
      const days = eachDayOfInterval({
        start: parseISO(sessionData.start_date),
        end: parseISO(sessionData.end_date)
      })
      setTotalDays(days.length)

      // Pré-remplir le formulaire si fiche déjà complétée
      if (stData.info_sheet_data) {
        setInfoForm(stData.info_sheet_data)
      } else {
        // Pré-remplir avec les données du stagiaire
        setInfoForm(prev => ({
          ...prev,
          first_name: stData.trainees.first_name || '',
          last_name: stData.trainees.last_name || '',
          email: stData.trainees.email || '',
          phone: stData.trainees.phone || '',
        }))
      }

      // Déterminer l'état selon timing
      determineState(sessionData, stData, days)
      
    } catch (err) {
      console.error('Erreur:', err)
      setError('Erreur lors du chargement')
      setLoading(false)
    }
  }

  const determineState = (sessionData, stData, allDays) => {
    const today = startOfDay(new Date())
    const startDate = startOfDay(parseISO(sessionData.start_date))
    const endDate = startOfDay(parseISO(sessionData.end_date))
    
    const isBeforeStart = isBefore(today, startDate)
    const isDuringSession = !isBefore(today, startDate) && !isAfter(today, endDate)
    const isAfterEnd = isAfter(today, endDate)

    // Fiche de renseignement (avant ou pendant si pas complétée)
    setCanFillInfoSheet(!stData.info_sheet_completed)
    
    // Émargement (seulement pendant la session)
    setCanSign(isDuringSession)
    
    // Évaluation (seulement après la fin)
    setCanEvaluate(isAfterEnd && !stData.evaluation_completed)

    // Déterminer le jour actuel si pendant la session
    if (isDuringSession) {
      const todayIndex = allDays.findIndex(day => 
        format(startOfDay(day), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
      )
      if (todayIndex >= 0) {
        setCurrentDay(todayIndex + 1)
      }
    }

    // Déterminer l'étape initiale
    if (!stData.info_sheet_completed) {
      setCurrentStep('info_sheet')
    } else {
      setCurrentStep('dashboard')
    }

    setLoading(false)
  }

  // Formatage date naissance
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

  const handleSubmitInfoSheet = async (e) => {
    e.preventDefault()
    
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
    if (!infoForm.rgpd_consent) {
      errors.rgpd_consent = 'Vous devez accepter'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSubmitting(true)

    try {
      // Sauvegarder la fiche
      const { error: updateError } = await supabase
        .from('session_trainees')
        .update({
          info_sheet_data: infoForm,
          info_sheet_completed: true,
          info_sheet_completed_at: new Date().toISOString()
        })
        .eq('id', sessionTrainee.id)

      if (updateError) throw updateError

      toast.success('Fiche enregistrée avec succès !')

      // Mettre à jour l'état local
      setSessionTrainee(prev => ({
        ...prev,
        info_sheet_completed: true,
        info_sheet_data: infoForm
      }))

      setCurrentStep('dashboard')
      setCanFillInfoSheet(false)

    } catch (err) {
      console.error('Erreur:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartAttendance = () => {
    setCurrentStep('attendance')
  }

  const handleSubmitAttendance = async () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      toast.error('Veuillez signer avant de valider')
      return
    }

    setSubmitting(true)

    try {
      const signatureData = sigPadRef.current.toDataURL()
      const attendanceKey = `attendance_day_${currentDay}`
      
      const attendanceValue = {
        signed_at: new Date().toISOString(),
        signature: signatureData
      }

      const { error } = await supabase
        .from('session_trainees')
        .update({
          [attendanceKey]: attendanceValue
        })
        .eq('id', sessionTrainee.id)

      if (error) throw error

      toast.success('Présence enregistrée !')

      // Recharger les données
      await loadData()
      setCurrentStep('dashboard')

    } catch (err) {
      console.error('Erreur:', err)
      toast.error('Erreur lors de la signature')
    } finally {
      setSubmitting(false)
    }
  }

  const clearSignature = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear()
    }
  }

  const handleSubmitEvaluation = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('session_trainees')
        .update({
          evaluation_data: evalForm,
          evaluation_completed: true,
          evaluation_completed_at: new Date().toISOString()
        })
        .eq('id', sessionTrainee.id)

      if (error) throw error

      // Calculer note moyenne pour avis Google
      const ratings = Object.keys(evalForm)
        .filter(k => k.startsWith('q_'))
        .map(k => evalForm[k] === 'N/C' ? 0 : evalForm[k])
        .filter(r => r > 0)
      
      const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length

      // Si note >= 4/5 (80%), proposer avis Google
      if (avgRating >= 4) {
        setCurrentStep('google_review')
      } else {
        setCurrentStep('thank_you')
      }

    } catch (err) {
      console.error('Erreur:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSubmitting(false)
    }
  }

  // Rating buttons component
  const RatingButtons = ({ questionKey, currentValue }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(rating => (
        <button
          key={rating}
          type="button"
          onClick={() => setEvalForm({...evalForm, [questionKey]: rating})}
          className={`w-10 h-10 rounded text-sm ${
            currentValue === rating
              ? 'bg-orange-500 text-white font-bold'
              : 'bg-gray-100 hover:bg-orange-100'
          }`}
        >
          {rating}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setEvalForm({...evalForm, [questionKey]: 'N/C'})}
        className={`px-3 h-10 rounded text-xs ${
          currentValue === 'N/C'
            ? 'bg-gray-600 text-white font-bold'
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
      >
        N/C
      </button>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erreur</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <GraduationCap className="w-12 h-12 text-primary-600 flex-shrink-0" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {course?.title || 'Formation'}
              </h1>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Du {format(parseISO(session.start_date), 'dd MMMM', { locale: fr })} 
                    {' au '}
                    {format(parseISO(session.end_date), 'dd MMMM yyyy', { locale: fr })}
                    {totalDays > 1 && ` (${totalDays} jours)`}
                  </span>
                </div>
                {session.location_city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {session.location_address && `${session.location_address}, `}
                      {session.location_postal_code} {session.location_city}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{trainee.first_name} {trainee.last_name}</span>
                </div>
                {company && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>{company.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          
          {/* STEP: Info Sheet */}
          {currentStep === 'info_sheet' && (
            <form onSubmit={handleSubmitInfoSheet} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-primary-600" />
                  Fiche de renseignement
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Veuillez compléter vos informations {canSign ? 'avant de signer votre présence' : 'avant la formation'}
                </p>
              </div>

              {/* Identité */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={infoForm.first_name}
                    onChange={(e) => setInfoForm({...infoForm, first_name: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${formErrors.first_name ? 'border-red-500' : ''}`}
                  />
                  {formErrors.first_name && <p className="text-xs text-red-500 mt-1">{formErrors.first_name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nom *</label>
                  <input
                    type="text"
                    value={infoForm.last_name}
                    onChange={(e) => setInfoForm({...infoForm, last_name: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${formErrors.last_name ? 'border-red-500' : ''}`}
                  />
                  {formErrors.last_name && <p className="text-xs text-red-500 mt-1">{formErrors.last_name}</p>}
                </div>
              </div>

              {/* Genre */}
              <div>
                <label className="block text-sm font-medium mb-2">Genre *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={infoForm.gender === 'male'}
                      onChange={(e) => setInfoForm({...infoForm, gender: e.target.value})}
                    />
                    <span className="text-sm">Homme</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={infoForm.gender === 'female'}
                      onChange={(e) => setInfoForm({...infoForm, gender: e.target.value})}
                    />
                    <span className="text-sm">Femme</span>
                  </label>
                </div>
              </div>

              {/* Date de naissance */}
              <div>
                <label className="block text-sm font-medium mb-1">Date de naissance * (JJ/MM/AAAA)</label>
                <input
                  type="text"
                  value={infoForm.birth_date_display}
                  onChange={(e) => setInfoForm({...infoForm, birth_date_display: formatBirthDateInput(e.target.value)})}
                  placeholder="JJ/MM/AAAA"
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${formErrors.birth_date_display ? 'border-red-500' : ''}`}
                />
                {formErrors.birth_date_display && <p className="text-xs text-red-500 mt-1">{formErrors.birth_date_display}</p>}
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={infoForm.email}
                    onChange={(e) => setInfoForm({...infoForm, email: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${formErrors.email ? 'border-red-500' : ''}`}
                  />
                  {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
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
              </div>

              {/* SSN */}
              <div>
                <label className="block text-sm font-medium mb-1">Numéro de Sécurité Sociale</label>
                <input
                  type="text"
                  value={infoForm.ssn}
                  onChange={(e) => setInfoForm({...infoForm, ssn: formatSSN(e.target.value)})}
                  disabled={infoForm.ssn_refused}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="1 23 45 67 890 123 45"
                />
                <label className="flex items-center gap-2 mt-2 text-sm">
                  <input
                    type="checkbox"
                    checked={infoForm.ssn_refused}
                    onChange={(e) => setInfoForm({...infoForm, ssn_refused: e.target.checked, ssn: ''})}
                  />
                  Je refuse de communiquer mon numéro de SS
                </label>
              </div>

              {/* Formation précédente */}
              <div>
                <label className="block text-sm font-medium mb-1">Année de dernière formation</label>
                <input
                  type="text"
                  value={infoForm.last_training_year}
                  onChange={(e) => setInfoForm({...infoForm, last_training_year: e.target.value})}
                  placeholder="Ex: 2023"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              {/* Diplôme */}
              <div>
                <label className="block text-sm font-medium mb-1">Diplôme le plus élevé</label>
                <select
                  value={infoForm.highest_diploma}
                  onChange={(e) => setInfoForm({...infoForm, highest_diploma: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Sélectionnez...</option>
                  <option value="Aucun">Aucun</option>
                  <option value="CAP/BEP">CAP/BEP</option>
                  <option value="Bac">Bac</option>
                  <option value="Bac+2">Bac+2</option>
                  <option value="Bac+3">Bac+3</option>
                  <option value="Bac+5">Bac+5</option>
                  <option value="Doctorat">Doctorat</option>
                </select>
              </div>

              {/* CSP */}
              <div>
                <label className="block text-sm font-medium mb-1">Catégorie socio-professionnelle (CSP)</label>
                <select
                  value={infoForm.csp}
                  onChange={(e) => setInfoForm({...infoForm, csp: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Sélectionnez...</option>
                  <option value="Employé">Employé</option>
                  <option value="Ouvrier">Ouvrier</option>
                  <option value="Agent de maîtrise">Agent de maîtrise</option>
                  <option value="Cadre">Cadre</option>
                  <option value="Chef d'entreprise">Chef d'entreprise</option>
                  <option value="Demandeur d'emploi">Demandeur d'emploi</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              {/* Poste */}
              <div>
                <label className="block text-sm font-medium mb-1">Intitulé du poste actuel</label>
                <input
                  type="text"
                  value={infoForm.job_title}
                  onChange={(e) => setInfoForm({...infoForm, job_title: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              {/* Attentes */}
              <div>
                <label className="block text-sm font-medium mb-1">Vos attentes concernant cette formation</label>
                <textarea
                  value={infoForm.training_expectations}
                  onChange={(e) => setInfoForm({...infoForm, training_expectations: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                  placeholder="Qu'attendez-vous de cette formation ?"
                />
              </div>

              {/* RGPD */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={infoForm.rgpd_consent}
                    onChange={(e) => setInfoForm({...infoForm, rgpd_consent: e.target.checked})}
                    className="mt-1"
                  />
                  <span className="text-sm">
                    J'accepte que mes données personnelles soient traitées dans le cadre de ma formation 
                    conformément au RGPD. Ces données ne seront utilisées que pour la gestion de la formation 
                    et ne seront pas communiquées à des tiers. *
                  </span>
                </label>
                {formErrors.rgpd_consent && (
                  <p className="text-red-500 text-xs mt-2">{formErrors.rgpd_consent}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Valider ma fiche
              </button>
            </form>
          )}

          {/* STEP: Dashboard */}
          {currentStep === 'dashboard' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Tableau de bord</h2>
              
              {/* Fiche complétée */}
              <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Fiche de renseignement</span>
                  </div>
                  <span className="text-sm text-green-600">Complétée ✓</span>
                </div>
              </div>

              {/* Émargement */}
              {canSign && currentDay && (
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <PenTool className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">Émargement Jour {currentDay}/{totalDays}</span>
                    </div>
                    {sessionTrainee[`attendance_day_${currentDay}`] ? (
                      <span className="text-sm text-green-600">Signé ✓</span>
                    ) : (
                      <span className="text-sm text-orange-600">À faire</span>
                    )}
                  </div>
                  {!sessionTrainee[`attendance_day_${currentDay}`] && (
                    <button
                      onClick={handleStartAttendance}
                      className="w-full mt-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <PenTool className="w-4 h-4" />
                      Signer ma présence
                    </button>
                  )}
                </div>
              )}

              {/* Évaluation */}
              {canEvaluate && (
                <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-orange-600" />
                      <span className="font-medium">Évaluation de la formation</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Merci de prendre quelques minutes pour évaluer cette formation
                  </p>
                  <button
                    onClick={() => setCurrentStep('evaluation')}
                    className="w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2"
                  >
                    <Star className="w-4 h-4" />
                    Évaluer la formation
                  </button>
                </div>
              )}

              {/* Message d'attente */}
              {!canSign && !canEvaluate && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-5 h-5" />
                    <span className="text-sm">
                      {isBefore(startOfDay(new Date()), startOfDay(parseISO(session.start_date)))
                        ? `Formation prévue le ${format(parseISO(session.start_date), 'dd MMMM yyyy', { locale: fr })}`
                        : 'Aucune action en attente'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP: Attendance */}
          {currentStep === 'attendance' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-2">
                  <PenTool className="w-5 h-5 text-blue-600" />
                  Émargement - Jour {currentDay}/{totalDays}
                </h2>
                <p className="text-sm text-gray-600">
                  {format(parseISO(session.start_date), 'EEEE dd MMMM yyyy', { locale: fr })}
                </p>
              </div>

              <div className="border-2 border-gray-300 rounded-lg p-4">
                <label className="block text-sm font-medium mb-2">Signez dans le cadre ci-dessous :</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
                  <SignatureCanvas
                    ref={sigPadRef}
                    canvasProps={{
                      className: 'w-full h-48'
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="mt-2 text-sm text-red-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Effacer
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep('dashboard')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmitAttendance}
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  Valider ma signature
                </button>
              </div>
            </div>
          )}

          {/* STEP: Evaluation */}
          {currentStep === 'evaluation' && (
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

          {/* STEP: Thank You */}
          {currentStep === 'thank_you' && (
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
          Access Formation • Portail Stagiaire Inter-Entreprise
        </p>
      </div>
    </div>
  )
}
