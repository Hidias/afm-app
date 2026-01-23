import { useState } from 'react'
import { X, Play } from 'lucide-react'
import {
  generateAccessCode,
  createGroup,
  calculateSessionRevenue,
  checkMinParticipants,
  checkMaxParticipants
} from '../lib/inter-backend'

export default function TestInterBackend({ onClose }) {
  const [sessionId, setSessionId] = useState('')
  const [traineeId, setTraineeId] = useState('')
  const [clientId, setClientId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const runTest = async (testName, testFn) => {
    setLoading(true)
    setResult(null)
    try {
      const res = await testFn()
      setResult({ success: true, test: testName, data: res })
    } catch (error) {
      setResult({ success: false, test: testName, error: error.message })
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">🧪 Test Backend Inter-Entreprise</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Inputs */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Session ID</label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="UUID"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Trainee ID</label>
              <input
                type="text"
                value={traineeId}
                onChange={(e) => setTraineeId(e.target.value)}
                placeholder="UUID"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="UUID"
                className="input"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => runTest('Générer code', () => generateAccessCode(sessionId, traineeId))}
              disabled={!sessionId || !traineeId || loading}
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Générer code
            </button>

            <button
              onClick={() => runTest('Créer groupe', () => createGroup({
                session_id: sessionId,
                client_id: clientId,
                nb_personnes: 5,
                price_per_person: 300
              }))}
              disabled={!sessionId || !clientId || loading}
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Créer groupe
            </button>

            <button
              onClick={() => runTest('Calculer CA', () => calculateSessionRevenue(sessionId))}
              disabled={!sessionId || loading}
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Calculer CA
            </button>

            <button
              onClick={() => runTest('Vérifier min', () => checkMinParticipants(sessionId))}
              disabled={!sessionId || loading}
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Vérifier min
            </button>

            <button
              onClick={() => runTest('Vérifier max', () => checkMaxParticipants(sessionId))}
              disabled={!sessionId || loading}
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Vérifier max
            </button>
          </div>

          {/* Result */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          )}

          {result && (
            <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-bold ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {result.success ? '✅' : '❌'} {result.test}
                </span>
              </div>
              <pre className="text-sm overflow-x-auto bg-white p-3 rounded border">
                {JSON.stringify(result.data || result.error, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
