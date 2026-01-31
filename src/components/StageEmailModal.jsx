import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { X, Send, Loader, CheckCircle, AlertCircle, Mail, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { generatePDF } from '../lib/pdfGenerator'

export default function StageEmailModal({ session, onClose }) {
  const [trainees, setTrainees] = useState([])        // tous les stagiaires de la session
  const [emailBody, setEmailBody] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [step, setStep] = useState('preview')         // 'preview' | 'sending' | 'done'
  const [results, setResults] = useState([])          // { trainee, status: 'pending'|'sent'|'error'|'skipped', error }
  const [loading, setLoading] = useState(false)

  const trainer = session?.trainers || null
  const ref = session?.reference || ''
  const courseTitle = session?.courses?.title || ''
  const startDate = session?.start_date ? new Date(session.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const endDate = session?.end_date ? new Date(session.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const formateur = trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Access Formation'

  // Extraire les stagiaires depuis session.session_trainees (déjà chargés par le store)
  useEffect(() => {
    const list = session?.session_trainees?.map(st => ({
      ...st.trainees,
      result: st.result || null
    })) || []
    setTrainees(list)
  }, [session])

  // Template du mail
  const buildTemplate = useCallback((prenom) => {
    return `Bonjour ${prenom},

Nous vous remercions d'avoir participé à la formation « ${courseTitle} » dispensée du ${startDate} au ${endDate}.

Nous espérons que cette formation vous a été bénéfique et vous a permis d'acquérir les compétences nécessaires.

Veuillez trouver ci-joint les documents suivants :
- Certificat de réalisation
- Attestation de présence
- Évaluation à froid

Concernant l'évaluation à froid ci-jointe, nous vous invitons à la compléter après quelques semaines de pratique et à nous la renvoyer à l'adresse contact@accessformation.pro. Cela nous permettra de mesurer les apports concrets de cette formation pour vous.

Par ailleurs, n'hésitez pas à visiter notre site www.accessformation.pro pour découvrir l'ensemble de nos formations disponibles.

N'hésitez pas à nous contacter si vous avez des questions.

Cordialement,
${formateur}
Access Formation`
  }, [courseTitle, startDate, endDate, formateur])

  // Init subject + body avec le premier prénom dispo (template générique)
  useEffect(() => {
    setEmailSubject(`Documents de formation – ${courseTitle} (${ref})`)
    setEmailBody(buildTemplate('[Prénom]'))
  }, [courseTitle, ref, buildTemplate])

  // Générer les PJ pour un stagiaire et les uploader en storage
  const uploadAttachments = async (trainee) => {
    const uploads = []
    const basePath = `stagiaire-emails/${session.id}/${trainee.id}`

    // Certificat
    const cert = generatePDF('certificat', session, { trainee, trainer })
    if (cert) {
      const filename = `Certificat_${ref}_${trainee.last_name}.pdf`
      const path = `${basePath}/${filename}`
      const bytes = Uint8Array.from(atob(cert.base64), c => c.charCodeAt(0))
      await supabase.storage.from('documents').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
      uploads.push({ path, filename })
    }

    // Attestation
    const att = generatePDF('attestation', session, { trainee, trainer })
    if (att) {
      const filename = `Attestation_${ref}_${trainee.last_name}.pdf`
      const path = `${basePath}/${filename}`
      const bytes = Uint8Array.from(atob(att.base64), c => c.charCodeAt(0))
      await supabase.storage.from('documents').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
      uploads.push({ path, filename })
    }

    // Évaluation à froid
    const evalF = generatePDF('evaluationFroid', session, { trainee })
    if (evalF) {
      const filename = `EvaluationFroid_${ref}_${trainee.last_name}.pdf`
      const path = `${basePath}/${filename}`
      const bytes = Uint8Array.from(atob(evalF.base64), c => c.charCodeAt(0))
      await supabase.storage.from('documents').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
      uploads.push({ path, filename })
    }

    return uploads
  }

  // Envoyer tous les emails
  const handleSend = async () => {
    setLoading(true)
    setStep('sending')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Non authentifié')
      setStep('preview')
      setLoading(false)
      return
    }

    const initialResults = trainees.map(t => ({
      trainee: t,
      status: t.email ? 'pending' : 'skipped',
      error: t.email ? null : 'Pas d\'email'
    }))
    setResults(initialResults)

    for (let i = 0; i < trainees.length; i++) {
      const t = trainees[i]
      if (!t.email) continue

      try {
        // Personnaliser le body avec le prénom de ce stagiaire
        const personalizedBody = emailBody.replace(/\[Prénom\]/g, t.first_name)

        // Générer les PDFs et les uploader en storage
        const attachmentPaths = await uploadAttachments(t)

        // Envoyer — on passe les paths, l'API télécharge depuis storage
        const response = await fetch('/api/send-email-stagiaire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            to: t.email,
            subject: emailSubject,
            body: personalizedBody,
            attachmentPaths,
            sessionId: session.id,
            traineeId: t.id
          })
        })

        const result = await response.json()

        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: response.ok ? 'sent' : 'error', error: response.ok ? null : result.error } : r
        ))

        // Nettoyer les fichiers du storage après envoi réussi
        if (response.ok && attachmentPaths.length > 0) {
          const paths = attachmentPaths.map(a => a.path)
          await supabase.storage.from('documents').remove(paths)
        }

        if (!response.ok) {
          console.error(`Erreur envoi à ${t.first_name} ${t.last_name}:`, result.error)
        }

        // Petit délai entre les envois pour éviter de surcharger le SMTP
        if (i < trainees.length - 1) await new Promise(r => setTimeout(r, 1500))

      } catch (err) {
        console.error(`Erreur pour ${t.first_name}:`, err)
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', error: err.message } : r
        ))
      }
    }

    setStep('done')
    setLoading(false)
  }

  // Compteurs pour le résumé
  const withEmail = trainees.filter(t => t.email).length
  const withoutEmail = trainees.filter(t => !t.email).length

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-primary-600 text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Envoyer documents aux stagiaires
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-primary-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">

          {/* === PREVIEW === */}
          {step === 'preview' && (
            <div className="space-y-5">

              {/* Résumé destinataires */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Destinataires ({trainees.length} stagiaires)</p>
                <div className="flex flex-wrap gap-2">
                  {trainees.map(t => (
                    <span
                      key={t.id}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        t.email ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {t.email ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {t.first_name} {t.last_name}
                      {!t.email && <span className="ml-1 italic">(pas d'email)</span>}
                    </span>
                  ))}
                </div>
                {withoutEmail > 0 && (
                  <p className="text-xs text-amber-700 mt-2">
                    ⚠ {withoutEmail} stagiaire{withoutEmail > 1 ? 's' : ''} sans email — ils ne recevront pas de mail.
                  </p>
                )}
              </div>

              {/* Objet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objet</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Corps — editable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Corps du mail
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    Utilisez [Prénom] pour insérer automatiquement le prénom de chaque stagiaire
                  </span>
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full h-80 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono resize-none"
                />
              </div>

              {/* PJ par stagiaire */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-blue-800 mb-1 flex items-center gap-1">
                  <FileText className="w-4 h-4" /> Pièces jointes (générées par stagiaire)
                </p>
                <ul className="text-sm text-blue-700 space-y-0.5 ml-4 list-disc">
                  <li>Certificat de réalisation — <em>Certificat_{ref}_[Nom].pdf</em></li>
                  <li>Attestation de présence — <em>Attestation_{ref}_[Nom].pdf</em></li>
                  <li>Évaluation à froid — <em>EvaluationFroid_{ref}_[Nom].pdf</em></li>
                </ul>
              </div>

              {/* Bouton envoyer */}
              <button
                onClick={handleSend}
                disabled={withEmail === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
                Envoyer à {withEmail} stagiaire{withEmail > 1 ? 's' : ''}
              </button>
            </div>
          )}

          {/* === SENDING === */}
          {step === 'sending' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Loader className="w-6 h-6 text-primary-600 animate-spin" />
                <p className="text-gray-700 font-medium">Envoi en cours...</p>
              </div>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    r.status === 'sent' ? 'bg-green-50' :
                    r.status === 'error' ? 'bg-red-50' :
                    r.status === 'skipped' ? 'bg-gray-100' :
                    'bg-blue-50'
                  }`}>
                    {r.status === 'sent' && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {r.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                    {r.status === 'skipped' && <AlertCircle className="w-4 h-4 text-gray-400" />}
                    {r.status === 'pending' && <Loader className="w-4 h-4 text-blue-600 animate-spin" />}
                    <span className={`font-medium ${
                      r.status === 'sent' ? 'text-green-800' :
                      r.status === 'error' ? 'text-red-800' :
                      r.status === 'skipped' ? 'text-gray-500' :
                      'text-blue-800'
                    }`}>
                      {r.trainee.first_name} {r.trainee.last_name}
                    </span>
                    {r.status === 'sent' && <span className="text-green-600 text-xs ml-auto">Envoyé ✓</span>}
                    {r.status === 'error' && <span className="text-red-600 text-xs ml-auto">{r.error}</span>}
                    {r.status === 'skipped' && <span className="text-gray-500 text-xs ml-auto">Skippé (pas d'email)</span>}
                    {r.status === 'pending' && <span className="text-blue-600 text-xs ml-auto">En attente...</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === DONE === */}
          {step === 'done' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle className="w-14 h-14 text-green-600 mx-auto mb-3" />
                <p className="text-lg font-semibold text-gray-900">Envoi terminé</p>
                <p className="text-sm text-gray-600 mt-1">
                  {results.filter(r => r.status === 'sent').length} email{results.filter(r => r.status === 'sent').length > 1 ? 's' : ''} envoyé{results.filter(r => r.status === 'sent').length > 1 ? 's' : ''} avec succès
                </p>
              </div>

              {/* Détail final */}
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    r.status === 'sent' ? 'bg-green-50' :
                    r.status === 'error' ? 'bg-red-50' : 'bg-gray-100'
                  }`}>
                    {r.status === 'sent' && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {r.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                    {r.status === 'skipped' && <AlertCircle className="w-4 h-4 text-gray-400" />}
                    <span className="font-medium">{r.trainee.first_name} {r.trainee.last_name}</span>
                    {r.status === 'sent' && <span className="text-green-600 text-xs ml-auto">Envoyé ✓</span>}
                    {r.status === 'error' && <span className="text-red-600 text-xs ml-auto">{r.error}</span>}
                    {r.status === 'skipped' && <span className="text-gray-500 text-xs ml-auto">Pas d'email</span>}
                  </div>
                ))}
              </div>

              <button
                onClick={onClose}
                className="w-full mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
