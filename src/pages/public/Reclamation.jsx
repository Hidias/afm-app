import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Send, CheckCircle, AlertCircle } from 'lucide-react'

export default function Reclamation() {
  const [formData, setFormData] = useState({
    sessionReference: '',
    traineeName: '',
    traineeEmail: '',
    description: '',
    honeypot: ''
  })
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { data } = await supabase.rpc('submit_complaint', {
      p_session_reference: formData.sessionReference,
      p_trainee_name: formData.traineeName,
      p_trainee_email: formData.traineeEmail,
      p_description: formData.description,
      p_honeypot: formData.honeypot
    })
    setLoading(false)
    if (data?.success) {
      setStatus('success')
      setMessage('Réclamation enregistrée')
      setFormData({sessionReference: '', traineeName: '', traineeEmail: '', description: '', honeypot: ''})
    } else {
      setStatus('error')
      setMessage(data?.error || 'Erreur')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Déposer une réclamation</h1>
        {status === 'success' && (
          <div className="mb-6 flex items-start gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-800">{message}</p>
          </div>
        )}
        {status === 'error' && (
          <div className="mb-6 flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-800">{message}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Référence de session *</label>
            <input type="text" required className="w-full px-3 py-2 border rounded-lg"
              value={formData.sessionReference}
              onChange={(e) => setFormData({...formData, sessionReference: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Votre nom *</label>
            <input type="text" required className="w-full px-3 py-2 border rounded-lg"
              value={formData.traineeName}
              onChange={(e) => setFormData({...formData, traineeName: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Votre email *</label>
            <input type="email" required className="w-full px-3 py-2 border rounded-lg"
              value={formData.traineeEmail}
              onChange={(e) => setFormData({...formData, traineeEmail: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <textarea required rows={6} className="w-full px-3 py-2 border rounded-lg"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>
          <input type="text" name="website" tabIndex="-1" autoComplete="off"
            style={{ position: 'absolute', left: '-9999px' }}
            value={formData.honeypot}
            onChange={(e) => setFormData({...formData, honeypot: e.target.value})} />
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />
            {loading ? 'Envoi...' : 'Envoyer'}
          </button>
        </form>
      </div>
    </div>
  )
}
