import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Shield, CheckCircle, AlertCircle } from 'lucide-react'

export default function TraineePortal() {
  const { token } = useParams()
  const [step, setStep] = useState('select')
  const [trainees, setTrainees] = useState([])
  const [selectedTrainee, setSelectedTrainee] = useState(null)
  const [accessCode, setAccessCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [attemptsRemaining, setAttemptsRemaining] = useState(5)
  const [loading, setLoading] = useState(false)
  const [sessionData, setSessionData] = useState(null)
  const [formData, setFormData] = useState({})
  const [evaluationData, setEvaluationData] = useState({})

  useEffect(() => {
    loadTrainees()
  }, [token])

  const loadTrainees = async () => {
    const { data } = await supabase
      .from('session_trainees')
      .select('id, first_name, last_name, sessions!inner(id, formations!inner(title))')
    if (data) setTrainees(data)
  }

  const handleSelectTrainee = (trainee) => {
    setSelectedTrainee(trainee)
    setStep('verify')
    setAccessCode('')
    setCodeError('')
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { data } = await supabase.rpc('verify_portal_access', {
      p_token: token,
      p_trainee_id: selectedTrainee.id,
      p_access_code: accessCode
    })
    setLoading(false)
    if (!data?.success) {
      setCodeError(data?.error || 'Code incorrect')
      if (data?.attempts_remaining !== undefined) setAttemptsRemaining(data.attempts_remaining)
      return
    }
    await loadPortalData()
  }

  const loadPortalData = async () => {
    const { data } = await supabase.rpc('get_portal_data', {
      p_token: token,
      p_trainee_id: selectedTrainee.id
    })
    if (data && !data.error) {
      setSessionData(data)
      if (data.trainee.info_submitted) {
        if (data.trainee.attendance_submitted_at) {
          if (data.trainee.evaluation_submitted) setStep('thanks')
          else setStep('evaluation')
        } else setStep('attendance')
      } else setStep('info')
    }
  }

  const handleSubmitInfo = async (e) => {
    e.preventDefault()
    setLoading(true)
    await supabase.rpc('submit_trainee_info', {
      p_trainee_id: selectedTrainee.id,
      ...formData
    })
    setLoading(false)
    setStep('attendance')
  }

  const handleSubmitAttendance = async (status) => {
    await supabase.rpc('update_attendance_status', {
      p_trainee_id: selectedTrainee.id,
      p_attendance_status: status
    })
    setStep('evaluation')
  }

  const handleSubmitEvaluation = async (e) => {
    e.preventDefault()
    await supabase.rpc('submit_evaluation', {
      p_trainee_id: selectedTrainee.id,
      p_evaluation_data: evaluationData
    })
    setStep('thanks')
  }

  if (step === 'select') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Portail Stagiaire</h1>
          <div className="space-y-2">
            {trainees.map(t => (
              <button key={t.id} onClick={() => handleSelectTrainee(t)}
                className="w-full p-4 text-left border rounded-lg hover:bg-gray-50">
                <div className="font-medium">{t.first_name} {t.last_name}</div>
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
            <h1 className="text-2xl font-bold">Vérification d'accès</h1>
          </div>
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Code d'accès à 6 chiffres</label>
              <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                value={accessCode} onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border rounded-lg text-center text-2xl tracking-widest"
                placeholder="000000" required autoFocus />
            </div>
            {codeError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div className="text-sm text-red-800">
                  {codeError}
                  {attemptsRemaining > 0 && <div>Tentatives restantes : {attemptsRemaining}</div>}
                </div>
              </div>
            )}
            <button type="submit" disabled={loading || accessCode.length !== 6}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Vérification...' : 'Vérifier'}
            </button>
            <button type="button" onClick={() => setStep('select')}
              className="w-full text-gray-600 hover:text-gray-800">← Retour</button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'info') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Fiche de renseignements</h1>
          <form onSubmit={handleSubmitInfo} className="space-y-4">
            <input type="text" placeholder="Adresse" required className="w-full px-3 py-2 border rounded"
              onChange={(e) => setFormData({...formData, p_address: e.target.value})} />
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded">
              Suivant
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
          <h1 className="text-2xl font-bold mb-6">Confirmation de présence</h1>
          <div className="space-y-3">
            <button onClick={() => handleSubmitAttendance('present')}
              className="w-full p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              Je confirme ma présence
            </button>
            <button onClick={() => handleSubmitAttendance('absent')}
              className="w-full p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              Je signale mon absence
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
          <h1 className="text-2xl font-bold mb-6">Évaluation</h1>
          <form onSubmit={handleSubmitEvaluation} className="space-y-4">
            <select required className="w-full px-3 py-2 border rounded"
              onChange={(e) => setEvaluationData({...evaluationData, satisfaction: e.target.value})}>
              <option value="">Note</option>
              <option value="5">Excellent</option>
              <option value="4">Très bien</option>
              <option value="3">Bien</option>
            </select>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded">
              Envoyer
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
          <p className="text-gray-600">Vos informations ont été enregistrées.</p>
        </div>
      </div>
    )
  }

  return null
}
