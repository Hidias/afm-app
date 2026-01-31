import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, FileText, Send, Loader, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { downloadNeedsAnalysisPDF } from '../lib/needsAnalysisPDF'

const PROMPT_SYSTEM = `Tu es "AF Compte-rendu", assistant de rédaction de mails post-RDV pour Access Formation.

RÈGLES :
- Ton : pro, humain, chaleureux
- Phrase imposée : "Voici le récapitulatif des éléments abordés :"
- Pas de "Merci pour nos échanges", pas de "Si je reformule"
- Ne jamais écrire "Access Formation" dans le corps
- Liens URL en clair (pas de markdown)
- Ne pas inventer d'info absente

STRUCTURE MAIL :
1) Intro complète avec remerciement
2) "Voici le récapitulatif..." (5-9 puces)
3) "Prochaines étapes :" (De mon côté / De ton côté)
4) Clôture style Hicham : "Encore merci pour le temps accordé et pour ta confiance. À très bientôt,"

GÉNÈRE 3 OBJETS puis 1 MAIL COMPLET (sans signature)
`

export default function CompteRenduModal({ rdv, client, analysisData, onClose }) {
  const [step, setStep] = useState('notes') // 'notes', 'generating', 'preview', 'sending', 'sent'
  const [notesCRM, setNotesCRM] = useState(rdv?.notes_crm || '')
  const [attachPDF, setAttachPDF] = useState(true)
  const [customDocs, setCustomDocs] = useState([])
  
  const [generatedEmail, setGeneratedEmail] = useState(null)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [toEmail, setToEmail] = useState(rdv?.contact_email || client?.email || '')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Récupérer les infos utilisateur
  const [userEmail, setUserEmail] = useState(null)
  
  useEffect(() => {
    loadUserEmail()
  }, [])

  const loadUserEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data } = await supabase
      .from('user_email_configs')
      .select('email')
      .eq('user_id', user.id)
      .single()
    
    if (data) setUserEmail(data.email)
  }

  const handleGenerate = async () => {
    if (!notesCRM.trim()) {
      toast.error('Veuillez saisir des notes de RDV')
      return
    }

    setLoading(true)
    setError(null)
    setStep('generating')

    try {
      // Construire le contexte
      const context = {
        client: client?.name,
        contact: rdv?.contact_name,
        date: rdv?.rdv_date ? new Date(rdv.rdv_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : null,
        notes: notesCRM,
        analysis: analysisData ? {
          context_stakes: analysisData.context_stakes,
          objectives_description: analysisData.objectives_description,
          participants_count: analysisData.participants_count
        } : null
      }

      // Appeler l'API backend (pas directement Claude)
      const response = await fetch('/api/generate-compte-rendu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur API')
      }

      const data = await response.json()

      if (data.objets && data.mail) {
        setGeneratedEmail({ objets: data.objets, mail: data.mail })
        setEmailSubject(data.objets[0].replace(/^\d+\.\s*/, ''))
        setEmailBody(data.mail)
        setStep('preview')
      } else {
        throw new Error('Format de réponse inattendu')
      }

    } catch (err) {
      console.error('Erreur génération:', err)
      setError(err.message)
      toast.error('Erreur lors de la génération')
    } finally {
      setLoading(false)
    }
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
      const attachments = []
      
      if (attachPDF && analysisData) {
        // Générer le PDF de l'analyse
        const pdfBlob = await generateAnalysisPDFBlob()
        const pdfBase64 = await blobToBase64(pdfBlob)
        
        attachments.push({
          filename: `Analyse_Besoin_${client?.name?.replace(/\s/g, '_')}.pdf`,
          content: pdfBase64.split(',')[1],
          encoding: 'base64',
          size: pdfBlob.size
        })
      }

      // Envoyer via l'API
      const response = await fetch('/api/send-email-rdv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          to: toEmail,
          subject: emailSubject,
          body: emailBody,
          attachments,
          rdvId: rdv.id
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
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }

  const generateAnalysisPDFBlob = async () => {
    // Utiliser la fonction existante pour générer le PDF
    // Cette fonction doit retourner un Blob
    // À adapter selon ton implémentation actuelle
    return new Blob(['PDF content'], { type: 'application/pdf' })
  }

  const blobToBase64 = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-primary-600 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Compte-rendu de rendez-vous
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-primary-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Notes de RDV (en vrac)
                </label>
                <textarea
                  value={notesCRM}
                  onChange={(e) => setNotesCRM(e.target.value)}
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Tape tes notes en vrac ici...
Exemple :
- Besoin formation nouveaux entrants
- Habilitation électrique B0H0V
- Chariot R489 catégorie 3
- Pas de VGP à date
- etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📎 Documents à joindre
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={attachPDF}
                    onChange={(e) => setAttachPDF(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600"
                  />
                  <span className="text-sm">Analyse des besoins (PDF)</span>
                </label>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || !notesCRM.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? <Loader className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                Générer le compte-rendu
              </button>
            </div>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-12 h-12 text-primary-600 animate-spin mb-4" />
              <p className="text-gray-600">Génération du compte-rendu en cours...</p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destinataire</label>
                <input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Corps du mail</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full h-96 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                />
              </div>

              {attachPDF && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    📎 PJ : Analyse_Besoin_{client?.name?.replace(/\s/g, '_')}.pdf
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('notes')}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  ← Retour
                </button>
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Envoyer
                </button>
              </div>
            </div>
          )}

          {step === 'sending' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-12 h-12 text-green-600 animate-spin mb-4" />
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
