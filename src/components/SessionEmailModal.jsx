import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, FileText, Send, Loader, CheckCircle, AlertCircle, Upload, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SessionEmailModal({ session, emailType, onClose }) {
  const [step, setStep] = useState('compose') // 'compose', 'sending', 'sent'
  const [uploadedFiles, setUploadedFiles] = useState([])
  
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [toEmail, setToEmail] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userEmail, setUserEmail] = useState(null)

  useEffect(() => {
    loadUserEmail()
    initializeEmail()
  }, [])

  const loadUserEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data } = await supabase
      .from('user_email_configs')
      .select('email')
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (data) setUserEmail(data.email)
  }

  const initializeEmail = () => {
    // Déterminer le destinataire
    const sessionContact = session?.contact
    const primaryContact = session?.clients?.contacts?.find(c => c.is_primary)
    const firstContact = session?.clients?.contacts?.[0]
    const contactEmail = sessionContact?.email || primaryContact?.email || firstContact?.email || session?.clients?.email || ''
    
    setToEmail(contactEmail)

    // Générer le sujet et corps selon le type
    const ref = session?.reference || ''
    const courseTitle = session?.courses?.title || ''
    const clientName = session?.clients?.name || ''
    
    if (emailType === 'before') {
      setEmailSubject(`${courseTitle} - Documents de formation - ${ref}`)
      setEmailBody(`Bonjour,

Veuillez trouver ci-joints les documents relatifs à la formation "${courseTitle}" :

- Convention de formation
- Programme de formation
- Convocations des stagiaires

Merci de nous retourner la convention signée avant le début de la formation.

Restant à votre disposition pour toute information complémentaire.`)
    } else {
      setEmailSubject(`${courseTitle} - Documents de fin de formation - ${ref}`)
      setEmailBody(`Bonjour,

Suite à la formation "${courseTitle}", veuillez trouver ci-joints :

- Les certificats de réalisation
- Les attestations de présence
- Les questionnaires d'évaluation à froid (à compléter d'ici 90 jours)
- Les feuilles d'émargement

Nous vous remercions pour votre confiance et restons à votre disposition.`)
    }
  }

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} est trop volumineux (max 10MB)`)
        return
      }
      
      const reader = new FileReader()
      reader.onload = (event) => {
        setUploadedFiles(prev => [...prev, {
          id: Date.now() + Math.random(),
          name: file.name,
          size: file.size,
          base64: event.target.result.split(',')[1]
        }])
        toast.success(`${file.name} ajouté`)
      }
      reader.readAsDataURL(file)
    })
    
    e.target.value = ''
  }

  const handleRemoveFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
    toast.success('Fichier supprimé')
  }

  const handleSend = async () => {
    if (!toEmail || !emailSubject || !emailBody) {
      toast.error('Email, objet et corps obligatoires')
      return
    }

    if (!userEmail) {
      toast.error('Configurez votre email dans Paramètres')
      return
    }

    setLoading(true)
    setStep('sending')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Préparer les pièces jointes
      const attachments = uploadedFiles.map(file => ({
        filename: file.name,
        content: file.base64,
        encoding: 'base64',
        size: file.size
      }))

      // Envoyer via l'API
      const response = await fetch('/api/send-email-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          to: toEmail,
          subject: emailSubject,
          body: emailBody,
          attachments,
          sessionId: session.id,
          emailType
        })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      setStep('sent')
      toast.success('Email envoyé avec succès !')

      setTimeout(() => {
        onClose()
      }, 2000)

    } catch (err) {
      console.error('Erreur envoi:', err)
      setError(err.message)
      toast.error('Erreur lors de l\'envoi')
      setStep('compose')
    } finally {
      setLoading(false)
    }
  }

  const typeLabels = {
    before: { icon: '📤', title: 'Documents avant formation', color: 'blue' },
    after: { icon: '📥', title: 'Documents après formation', color: 'green' }
  }

  const currentType = typeLabels[emailType]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between bg-${currentType.color}-600 text-white`}>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>{currentType.icon}</span>
            {currentType.title}
          </h2>
          <button onClick={onClose} className={`p-1 hover:bg-${currentType.color}-700 rounded`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === 'compose' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destinataire</label>
                <input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="email@exemple.fr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objet</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Upload de fichiers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📎 Documents à joindre
                </label>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-yellow-800">
                    💡 <strong>Documents {emailType === 'before' ? 'avant' : 'après'} formation</strong> : 
                    Générez-les depuis la page de la session, puis uploadez-les ci-dessous.
                  </p>
                </div>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-3">
                  <label className="flex flex-col items-center cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600 text-center">
                      Ajouter des fichiers (PDF, Word, Excel, Images)
                      <br />
                      <span className="text-xs text-gray-500">Max 10MB par fichier</span>
                    </span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                    />
                  </label>
                </div>
                
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">Fichiers ajoutés ({uploadedFiles.length}) :</p>
                    {uploadedFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            ({(file.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(file.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSend}
                  disabled={loading || uploadedFiles.length === 0}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-${currentType.color}-600 text-white rounded-lg hover:bg-${currentType.color}-700 disabled:opacity-50`}
                >
                  {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Envoyer
                </button>
              </div>
            </div>
          )}

          {step === 'sending' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className={`w-12 h-12 text-${currentType.color}-600 animate-spin mb-4`} />
              <p className="text-gray-600">Envoi en cours...</p>
            </div>
          )}

          {step === 'sent' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
              <p className="text-xl font-semibold text-gray-900 mb-2">Email envoyé !</p>
              <p className="text-gray-600">L'email apparaîtra dans vos messages envoyés</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Erreur</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
