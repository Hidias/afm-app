import { useState } from 'react'
import { X, Mail, Send, CheckCircle, AlertCircle, Eye, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { prepareEmailData } from '../lib/emailTemplates'

export default function SendEmailsModal({ group, session, trainees, onClose, onSuccess }) {
  const [sending, setSending] = useState(false)
  const [selectedTrainees, setSelectedTrainees] = useState([])
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [sendResults, setSendResults] = useState(null)

  // Filtrer les stagiaires qui ont un email ET un code d'accès
  const eligibleTrainees = trainees.filter(
    st => st.trainees?.email && st.access_code
  )

  const toggleTrainee = (traineeId) => {
    setSelectedTrainees(prev =>
      prev.includes(traineeId)
        ? prev.filter(id => id !== traineeId)
        : [...prev, traineeId]
    )
  }

  const selectAll = () => {
    setSelectedTrainees(eligibleTrainees.map(t => t.id))
  }

  const deselectAll = () => {
    setSelectedTrainees([])
  }

  const handlePreview = (trainee) => {
    try {
      const data = prepareEmailData(trainee, session, group)
      setPreviewData(data)
      setShowPreview(true)
    } catch (error) {
      toast.error('Erreur lors de la prévisualisation')
      console.error(error)
    }
  }

  const handleSendEmails = async () => {
    if (selectedTrainees.length === 0) {
      toast.error('Sélectionnez au moins un stagiaire')
      return
    }

    // Confirmation
    if (!window.confirm(`Envoyer ${selectedTrainees.length} email(s) de convocation ?`)) {
      return
    }

    setSending(true)
    const results = { success: [], errors: [] }

    try {
      // Pour chaque stagiaire sélectionné
      for (const traineeId of selectedTrainees) {
        const trainee = eligibleTrainees.find(t => t.id === traineeId)
        if (!trainee) continue

        try {
          // Préparer les données de l'email
          const emailData = prepareEmailData(trainee, session, group)

          // Appel à l'API d'envoi d'email
          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailData)
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Erreur envoi email')
          }

          results.success.push({
            traineeId,
            name: `${trainee.trainees.first_name} ${trainee.trainees.last_name}`,
            email: trainee.trainees.email
          })

        } catch (error) {
          console.error('Erreur envoi email:', error)
          results.errors.push({
            traineeId,
            name: `${trainee.trainees.first_name} ${trainee.trainees.last_name}`,
            error: error.message
          })
        }
      }

      setSendResults(results)

      if (results.success.length > 0) {
        toast.success(`${results.success.length} email(s) envoyé(s) avec succès !`)
      }

      if (results.errors.length > 0) {
        toast.error(`${results.errors.length} erreur(s) lors de l'envoi`)
      }

      // Si tout est OK, recharger les données
      if (results.errors.length === 0) {
        setTimeout(() => {
          onSuccess()
        }, 2000)
      }

    } catch (error) {
      console.error('Erreur globale:', error)
      toast.error('Erreur lors de l\'envoi des emails')
    } finally {
      setSending(false)
    }
  }

  // Vue des résultats d'envoi
  if (sendResults) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Résultat de l'envoi
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Succès */}
            {sendResults.success.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">
                    {sendResults.success.length} email(s) envoyé(s) avec succès
                  </h3>
                </div>
                <div className="space-y-2">
                  {sendResults.success.map((item, i) => (
                    <div key={i} className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="font-medium text-green-900">{item.name}</p>
                      <p className="text-sm text-green-700">{item.email}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Erreurs */}
            {sendResults.errors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-red-900">
                    {sendResults.errors.length} erreur(s)
                  </h3>
                </div>
                <div className="space-y-2">
                  {sendResults.errors.map((item, i) => (
                    <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="font-medium text-red-900">{item.name}</p>
                      <p className="text-sm text-red-700">{item.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t flex justify-end">
            <button onClick={onClose} className="btn btn-primary">
              Fermer
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Vue de prévisualisation
  if (showPreview && previewData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Prévisualisation de l'email
            </h2>
            <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-500">Destinataire</p>
              <p className="font-medium">{previewData.to}</p>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">Sujet</p>
              <p className="font-medium">{previewData.subject}</p>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <iframe
                srcDoc={previewData.html}
                className="w-full h-[600px] border-0"
                title="Prévisualisation email"
              />
            </div>
          </div>

          <div className="p-6 border-t flex justify-end">
            <button onClick={() => setShowPreview(false)} className="btn btn-secondary">
              Fermer
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Vue principale de sélection
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900">
              Envoyer les convocations par email
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Groupe : {group.clients?.name || 'Entreprise'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {eligibleTrainees.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Aucun stagiaire éligible</p>
              <p className="text-sm text-gray-400">
                Les stagiaires doivent avoir un email et un code d'accès
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Actions de sélection */}
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    Tout sélectionner
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-sm text-gray-600 hover:underline"
                  >
                    Tout désélectionner
                  </button>
                </div>
                {selectedTrainees.length > 0 && (
                  <span className="text-sm font-medium text-primary-600">
                    {selectedTrainees.length} sélectionné(s)
                  </span>
                )}
              </div>

              {/* Liste des stagiaires */}
              <div className="space-y-2">
                {eligibleTrainees.map((trainee) => (
                  <div
                    key={trainee.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      selectedTrainees.includes(trainee.id)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTrainees.includes(trainee.id)}
                        onChange={() => toggleTrainee(trainee.id)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">
                          {trainee.trainees.first_name} {trainee.trainees.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{trainee.trainees.email}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Code : <span className="font-mono">{trainee.access_code}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => handlePreview(trainee)}
                        className="btn btn-sm flex items-center gap-1"
                        title="Prévisualiser l'email"
                      >
                        <Eye className="w-4 h-4" />
                        Aperçu
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {eligibleTrainees.length} stagiaire(s) éligible(s)
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn btn-secondary" disabled={sending}>
              Annuler
            </button>
            <button
              onClick={handleSendEmails}
              disabled={sending || selectedTrainees.length === 0}
              className="btn btn-primary flex items-center gap-2"
            >
              {sending ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Envoyer {selectedTrainees.length > 0 ? `(${selectedTrainees.length})` : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
