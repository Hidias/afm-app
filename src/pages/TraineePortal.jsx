import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Shield, Lock, CheckCircle, AlertCircle } from 'lucide-react'

export default function TraineePortal() {
  const { token } = useParams()
  const navigate = useNavigate()
  
  const [step, setStep] = useState('select') // select, verify, info, attendance, evaluation, thanks
  const [trainees, setTrainees] = useState([])
  const [selectedTrainee, setSelectedTrainee] = useState(null)
  const [accessCode, setAccessCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [attemptsRemaining, setAttemptsRemaining] = useState(5)
  const [loading, setLoading] = useState(false)
  
  const [sessionData, setSessionData] = useState(null)
  const [formData, setFormData] = useState({})
  const [evaluationData, setEvaluationData] = useState({})

  // Charger la liste des stagiaires
  useEffect(() => {
    loadTrainees()
  }, [token])

  const loadTrainees = async () => {
    const { data, error } = await supabase
      .rpc('get_portal_trainees', { p_token: token })

    if (!error && data) {
      setTrainees(data)
    }
  }

  // Sélection du stagiaire
  const handleSelectTrainee = (trainee) => {
    setSelectedTrainee(trainee)
    setStep('verify')
    setAccessCode('')
    setCodeError('')
  }

  // Vérification du code d'accès
  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    setCodeError('')

    const { data, error } = await supabase.rpc('verify_trainee_access_code', {
      p_session_trainee_id: selectedTrainee.id,
      p_access_code: accessCode
    })

    setLoading(false)

    if (error || !data?.success) {
      setCodeError(data?.error || 'Erreur de vérification')
      if (data?.attempts_remaining !== undefined) {
        setAttemptsRemaining(data.attempts_remaining)
      }
      if (data?.locked_until) {
        setCodeError(`Compte verrouillé jusqu'à ${new Date(data.locked_until).toLocaleTimeString()}`)
      }
      return
    }

    // Code correct - charger les données
    await loadPortalData()
  }

  const loadPortalData = async () => {
    const { data, error } = await supabase.rpc('get_portal_data', {
      p_token: token,
      p_trainee_id: selectedTrainee.id
    })

    if (!error && data && !data.error) {
      setSessionData(data)
      
      // Vérifier si les étapes sont déjà complétées
      if (data.trainee.info_submitted) {
        if (data.trainee.attendance_submitted_at) {
          if (data.trainee.evaluation_submitted) {
            setStep('thanks')
          } else {
            setStep('evaluation')
          }
        } else {
          setStep('attendance')
        }
      } else {
        setStep('info')
      }
    }
  }

  // Soumission de la fiche renseignements
  const handleSubmitInfo = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.rpc('submit_trainee_info', {
      p_trainee_id: selectedTrainee.id,
      p_address: formData.address,
      p_postal_code: formData.postal_code,
      p_city: formData.city,
      p_birthdate: formData.birthdate,
      p_social_security: formData.social_security,
      p_job_title: formData.job_title,
      p_csp: formData.csp,
      p_education_level: formData.education_level,
      p_employment_status: formData.employment_status,
      p_contract_type: formData.contract_type
    })

    setLoading(false)

    if (!error && data?.success) {
      setStep('attendance')
    }
  }

  // Mise à jour du statut de présence
  const handleSubmitAttendance = async (status) => {
    setLoading(true)

    const { data, error } = await supabase.rpc('update_attendance_status', {
      p_trainee_id: selectedTrainee.id,
      p_attendance_status: status
    })

    setLoading(false)

    if (!error && data?.success) {
      setStep('evaluation')
    }
  }

  // Soumission de l'évaluation
  const handleSubmitEvaluation = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.rpc('submit_evaluation', {
      p_trainee_id: selectedTrainee.id,
      p_evaluation_data: evaluationData
    })

    setLoading(false)

    if (!error && data?.success) {
      setStep('thanks')
    }
  }

  // Rendu des différentes étapes
  if (step === 'select') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Portail Stagiaire</h1>
          <p className="text-gray-600 mb-4">Sélectionnez votre nom :</p>
          <div className="space-y-2">
            {trainees.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelectTrainee(t)}
                className="w-full p-4 text-left border rounded-lg hover:bg-gray-50 transition"
              >
                <div className="font-medium">{t.first_name} {t.last_name}</div>
                <div className="text-sm text-gray-500">{t.formation_title}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
          <div className="text-center mb-6">
            <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Vérification d'accès</h1>
            <p className="text-gray-600">
              Bonjour {selectedTrainee.first_name} {selectedTrainee.last_name}
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
                className="w-full px-4 py-3 border rounded-lg text-center text-2xl tracking-widest"
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
              disabled={loading || accessCode.length !== 6}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Vérification...' : 'Vérifier'}
            </button>

            <button
              type="button"
              onClick={() => setStep('select')}
              className="w-full text-gray-600 hover:text-gray-800 transition"
            >
              ← Retour
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'info') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h1 className="text-2xl font-bold">Fiche de renseignements</h1>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Formation : <strong>{sessionData?.formation?.title}</strong>
          </p>

          <form onSubmit={handleSubmitInfo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Adresse *</label>
              <input type="text" required className="w-full px-3 py-2 border rounded-lg" 
                value={formData.address || ''} onChange={(e) => setFormData({...formData, address: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code postal *</label>
                <input type="text" required className="w-full px-3 py-2 border rounded-lg"
                  value={formData.postal_code || ''} onChange={(e) => setFormData({...formData, postal_code: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ville *</label>
                <input type="text" required className="w-full px-3 py-2 border rounded-lg"
                  value={formData.city || ''} onChange={(e) => setFormData({...formData, city: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date de naissance *</label>
              <input type="date" required className="w-full px-3 py-2 border rounded-lg"
                value={formData.birthdate || ''} onChange={(e) => setFormData({...formData, birthdate: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">N° Sécurité Sociale</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg"
                value={formData.social_security || ''} onChange={(e) => setFormData({...formData, social_security: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Fonction/Métier</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg"
                value={formData.job_title || ''} onChange={(e) => setFormData({...formData, job_title: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">CSP (Catégorie Socio-Professionnelle)</label>
              <select className="w-full px-3 py-2 border rounded-lg"
                value={formData.csp || ''} onChange={(e) => setFormData({...formData, csp: e.target.value})}>
                <option value="">-- Choisir --</option>
                <option value="Agriculteurs exploitants">Agriculteurs exploitants</option>
                <option value="Artisans, commerçants">Artisans, commerçants</option>
                <option value="Cadres">Cadres</option>
                <option value="Professions intermédiaires">Professions intermédiaires</option>
                <option value="Employés">Employés</option>
                <option value="Ouvriers">Ouvriers</option>
                <option value="Retraités">Retraités</option>
                <option value="Sans activité">Sans activité</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              {loading ? 'Enregistrement...' : 'Suivant'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'attendance') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Émargement</h1>
          <p className="text-gray-600 mb-6">Confirmez votre présence pour cette session :</p>
          <div className="space-y-3">
            <button onClick={() => handleSubmitAttendance('present')} disabled={loading}
              className="w-full p-4 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition">
              <div className="font-medium text-green-800">✓ Je confirme ma présence</div>
            </button>
            <button onClick={() => handleSubmitAttendance('absent')} disabled={loading}
              className="w-full p-4 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition">
              <div className="font-medium text-red-800">✗ Je signale mon absence</div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'evaluation') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Évaluation de la formation</h1>
          <form onSubmit={handleSubmitEvaluation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Comment évaluez-vous cette formation ? *</label>
              <select required className="w-full px-3 py-2 border rounded-lg"
                value={evaluationData.satisfaction || ''} onChange={(e) => setEvaluationData({...evaluationData, satisfaction: e.target.value})}>
                <option value="">-- Choisir --</option>
                <option value="5">Excellent</option>
                <option value="4">Très bien</option>
                <option value="3">Bien</option>
                <option value="2">Moyen</option>
                <option value="1">Insuffisant</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Le formateur était-il pédagogue ? *</label>
              <select required className="w-full px-3 py-2 border rounded-lg"
                value={evaluationData.pedagogy || ''} onChange={(e) => setEvaluationData({...evaluationData, pedagogy: e.target.value})}>
                <option value="">-- Choisir --</option>
                <option value="5">Excellent</option>
                <option value="4">Très bien</option>
                <option value="3">Bien</option>
                <option value="2">Moyen</option>
                <option value="1">Insuffisant</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Les objectifs de la formation étaient-ils clairs ? *</label>
              <select required className="w-full px-3 py-2 border rounded-lg"
                value={evaluationData.objectives || ''} onChange={(e) => setEvaluationData({...evaluationData, objectives: e.target.value})}>
                <option value="">-- Choisir --</option>
                <option value="5">Très clairs</option>
                <option value="4">Clairs</option>
                <option value="3">Moyennement clairs</option>
                <option value="2">Peu clairs</option>
                <option value="1">Pas clairs</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Commentaires (optionnel)</label>
              <textarea className="w-full px-3 py-2 border rounded-lg" rows={4}
                placeholder="Vos remarques, suggestions..."
                value={evaluationData.comments || ''} onChange={(e) => setEvaluationData({...evaluationData, comments: e.target.value})} />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              {loading ? 'Envoi...' : 'Envoyer l\'évaluation'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'thanks') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Merci !</h1>
          <p className="text-gray-600 mb-4">
            Vos informations ont bien été enregistrées.
          </p>
          <p className="text-sm text-gray-500">
            Nous vous souhaitons une excellente formation.
          </p>
        </div>
      </div>
    )
  }

  return null
}
