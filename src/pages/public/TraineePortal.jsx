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

  useEffect(() => {
    loadTrainees()
  }, [token])

  const loadTrainees = async () => {
    const { data, error } = await supabase.rpc('get_portal_trainees', {
      p_token: token
    })
    
    if (!error && data) {
      setTrainees(data)
    }
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
      return
    }

    // Code correct - afficher la confirmation
    setStep('success')
  }

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
                Le formateur vous communique ce code à l'oral
              </p>
            </div>

            {codeError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  {codeError}
                  {attemptsRemaining > 0 && attemptsRemaining < 5 && (
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

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Accès validé !</h1>
          <p className="text-gray-600 mb-4">
            Bonjour {selectedTrainee.first_name} {selectedTrainee.last_name}
          </p>
          <p className="text-gray-600">
            Votre présence a été enregistrée pour la formation :<br/>
            <strong>{selectedTrainee.formation_title}</strong>
          </p>
        </div>
      </div>
    )
  }

  return null
}
