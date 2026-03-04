import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { X, Send, Loader, CheckCircle, AlertCircle, Mail, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { generatePDF } from '../lib/pdfGenerator'

export default function StageEmailModal({ session, onClose }) {
  const [trainees, setTrainees] = useState([])        // tous les stagiaires de la session
  const [selectedIds, setSelectedIds] = useState(new Set()) // stagiaires sélectionnés pour l'envoi
  const [emailBody, setEmailBody] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [step, setStep] = useState('preview')         // 'preview' | 'sending' | 'done'
  const [results, setResults] = useState([])          // { trainee, status: 'pending'|'sent'|'error'|'skipped', error }
  const [loading, setLoading] = useState(false)

  // ── Compte rendu post-formation ──
  const [evals, setEvals] = useState([])              // évaluations à chaud de la session
  const [evalsLoaded, setEvalsLoaded] = useState(false)
  const [compteRendu, setCompteRendu] = useState('')  // texte généré par l'IA
  const [crGenerating, setCrGenerating] = useState(false)
  const [crError, setCrError] = useState(null)

  const trainer = session?.trainers || null
  const ref = session?.reference || ''
  const courseTitle = session?.courses?.title || ''
  const startDate = session?.start_date ? new Date(session.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const endDate = session?.end_date ? new Date(session.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const formateur = trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Access Formation'

  // Charger les évaluations à chaud de la session
  useEffect(() => {
    const load = async () => {
      if (!session?.id) return
      const { data } = await supabase
        .from('trainee_evaluations')
        .select('*')
        .eq('session_id', session.id)
        .eq('eval_type', 'chaud')
      setEvals(data || [])
      setEvalsLoaded(true)
    }
    load()
  }, [session?.id])

  // Charger le document stagiaire de la formation
  const [docStagiaire, setDocStagiaire] = useState(null)

  useEffect(() => {
    const load = async () => {
      if (!session?.course_id) return
      const { data } = await supabase
        .from('course_documents')
        .select('*')
        .eq('course_id', session.course_id)
        .eq('type', 'document_stagiaire')
        .order('created_at', { ascending: false })
        .limit(1)
      if (data?.length) setDocStagiaire(data[0])
    }
    load()
  }, [session?.course_id])

  // Extraire les stagiaires depuis session.session_trainees (déjà chargés par le store)
  useEffect(() => {
    const list = session?.session_trainees?.map(st => ({
      ...st.trainees,
      result: st.result || null
    })) || []
    setTrainees(list)
    // Sélectionner par défaut tous les stagiaires avec un email
    setSelectedIds(new Set(list.filter(t => t.email).map(t => t.id)))
  }, [session])

  // Template du mail
  const buildTemplate = useCallback((prenom) => {
    return `Bonjour ${prenom},

Nous vous remercions d'avoir participé à la formation « ${courseTitle} » dispensée du ${startDate} au ${endDate}.

Nous espérons que cette formation vous a été bénéfique et vous a permis d'acquérir les compétences nécessaires.

Veuillez trouver ci-joint les documents suivants :
- Certificat de réalisation
- Attestation de présence
- Évaluation à froid${docStagiaire ? `\n- ${docStagiaire.title}` : ''}

Concernant l'évaluation à froid ci-jointe, nous vous invitons à la compléter et à nous la renvoyer à l'adresse contact@accessformation.pro.
Cela nous permettra de mesurer les apports concrets de cette formation pour vous.

Par ailleurs, vous pouvez également visiter notre site www.accessformation.pro pour découvrir l'ensemble de nos formations disponibles.

N'hésitez pas à nous contacter si vous avez des questions.

Cordialement,
${formateur}
Access Formation`
  }, [courseTitle, startDate, endDate, formateur, docStagiaire])

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
    const cert = await generatePDF('certificat', session, { trainee, trainer })
    if (cert) {
      const filename = `Certificat_${ref}_${trainee.last_name}.pdf`
      const path = `${basePath}/${filename}`
      const bytes = Uint8Array.from(atob(cert.base64), c => c.charCodeAt(0))
      await supabase.storage.from('documents').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
      uploads.push({ path, filename })
    }

    // Attestation
    const att = await generatePDF('attestation', session, { trainee, trainer })
    if (att) {
      const filename = `Attestation_${ref}_${trainee.last_name}.pdf`
      const path = `${basePath}/${filename}`
      const bytes = Uint8Array.from(atob(att.base64), c => c.charCodeAt(0))
      await supabase.storage.from('documents').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
      uploads.push({ path, filename })
    }

    // Évaluation à froid
    const evalF = await generatePDF('evaluationFroid', session, { trainee })
    if (evalF) {
      const filename = `EvaluationFroid_${ref}_${trainee.last_name}.pdf`
      const path = `${basePath}/${filename}`
      const bytes = Uint8Array.from(atob(evalF.base64), c => c.charCodeAt(0))
      await supabase.storage.from('documents').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
      uploads.push({ path, filename })
    }

    // Document stagiaire depuis la formation
    if (docStagiaire) {
      try {
        const response = await fetch(docStagiaire.file_url)
        if (response.ok) {
          const blob = await response.blob()
          const path = `${basePath}/${docStagiaire.file_name}`
          await supabase.storage.from('documents').upload(path, blob, { contentType: blob.type || 'application/pdf', upsert: true })
          uploads.push({ path, filename: docStagiaire.file_name })
        }
      } catch (e) {
        console.error('Erreur téléchargement document stagiaire:', e)
      }
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

    // On n'envoie qu'aux stagiaires sélectionnés
    const targets = trainees.filter(t => selectedIds.has(t.id))

    const initialResults = targets.map(t => ({
      trainee: t,
      status: 'pending',
      error: null
    }))
    setResults(initialResults)

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]

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
        if (i < targets.length - 1) await new Promise(r => setTimeout(r, 1500))

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

  // ── Génération du compte rendu ──
  const Q_LABELS = {
    q_org_documents:          'Organisation — Documents préparés',
    q_org_accueil:            'Organisation — Accueil',
    q_org_locaux:             'Organisation — Locaux',
    q_org_materiel:           'Organisation — Matériel',
    q_contenu_organisation:   'Contenu — Organisation',
    q_contenu_supports:       'Contenu — Supports',
    q_contenu_duree:          'Contenu — Durée',
    q_contenu_programme:      'Contenu — Programme',
    q_formateur_pedagogie:    'Formateur — Pédagogie',
    q_formateur_expertise:    'Formateur — Expertise',
    q_formateur_progression:  'Formateur — Progression',
    q_formateur_moyens:       'Formateur — Moyens',
    q_global_adequation:      'Global — Adéquation',
    q_global_competences:     'Global — Compétences acquises',
  }
  const Q_KEYS = Object.keys(Q_LABELS)

  const computeEvalData = () => {
    if (!evals.length) return null

    // Score moyen par question
    const scores = {}
    Q_KEYS.forEach(key => {
      const vals = evals.map(e => e[key]).filter(v => v !== null && v !== undefined).map(Number)
      scores[key] = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null
    })

    // Score global
    const allScores = Q_KEYS.flatMap(key => evals.map(e => e[key]).filter(v => v !== null && v !== undefined).map(Number))
    const globalScore = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2) : null

    // Taux de recommandation
    const withReco = evals.filter(e => e.would_recommend !== null && e.would_recommend !== undefined)
    const tauxReco = withReco.length ? Math.round((withReco.filter(e => e.would_recommend === true).length / withReco.length) * 100) : null

    // Commentaires libres (non vides)
    const comments = evals
      .map(e => (e.comments || e.comment || '').trim())
      .filter(c => c.length > 0)

    return { scores, globalScore, tauxReco, comments, total: evals.length, totalTrainees: trainees.length }
  }

  const generateCompteRendu = async () => {
    const evalData = computeEvalData()
    if (!evalData) return

    setCrGenerating(true)
    setCrError(null)

    // Construire le contexte pour l'IA
    const scoresText = Q_KEYS
      .filter(k => evalData.scores[k] !== null)
      .map(k => `- ${Q_LABELS[k]} : ${evalData.scores[k]}/5`)
      .join('\n')

    const commentsText = evalData.comments.length
      ? evalData.comments.map((c, i) => `${i + 1}. « ${c} »`).join('\n')
      : 'Aucun commentaire libre.'

    const prompt = `Tu es l'assistant de l'organisme de formation Access Formation (Concarneau, Bretagne).
Une session de formation s'est terminée. Voici les données d'évaluation à chaud remontées par les stagiaires :

Formation : ${courseTitle}
Référence : ${ref}
Dates : du ${startDate} au ${endDate}
Formateur : ${formateur}
Stagiaires ayant répondu : ${evalData.total} sur ${evalData.totalTrainees}
Score moyen global : ${evalData.globalScore}/5
Taux de recommandation : ${evalData.tauxReco !== null ? evalData.tauxReco + '%' : 'non calculé'}

Scores détaillés par question :
${scoresText}

Commentaires libres des stagiaires :
${commentsText}

Écris un compte rendu professionnel et synthétique de cette session de formation.
Le compte rendu doit :
- Reprendre les points forts identifiés grâce aux scores (les dimensions avec les meilleurs résultats)
- Mentionner les points à améliorer si des scores sont nettement plus bas (< 3.5)
- Intégrer naturellement les commentaires des stagiaires (sans les citer mot pour mot, mais en reflétant leur teneur)
- Être écrit en français, en style professionnel mais accessible
- Être concis : entre 80 et 150 mots
- Ne pas mentionner les chiffres bruts sauf le score global et le taux de recommandation

Réponds uniquement avec le texte du compte rendu, sans titre ni introduction.`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      setCompteRendu(text)
    } catch (e) {
      console.error('Erreur génération compte rendu:', e)
      setCrError('Erreur lors de la génération. Réessaie.')
    }

    setCrGenerating(false)
  }

  // Compteurs pour le résumé
  const selectedCount = selectedIds.size

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
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">
                    Destinataires — {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''} / {trainees.length}
                  </p>
                  <button
                    onClick={() => {
                      const allWithEmail = new Set(trainees.filter(t => t.email).map(t => t.id))
                      const allSelected = trainees.filter(t => t.email).every(t => selectedIds.has(t.id))
                      setSelectedIds(allSelected ? new Set() : allWithEmail)
                    }}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    {trainees.filter(t => t.email).every(t => selectedIds.has(t.id)) ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {trainees.map(t => (
                    <label
                      key={t.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        !t.email ? 'opacity-50 cursor-not-allowed' :
                        selectedIds.has(t.id) ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={t.email ? selectedIds.has(t.id) : false}
                        disabled={!t.email}
                        onChange={() => {
                          if (!t.email) return
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            next.has(t.id) ? next.delete(t.id) : next.add(t.id)
                            return next
                          })
                        }}
                        className="w-4 h-4 rounded accent-green-600"
                      />
                      <span className="text-sm font-medium text-gray-800">{t.first_name} {t.last_name}</span>
                      {t.email
                        ? <span className="text-xs text-gray-400 ml-auto">{t.email}</span>
                        : <span className="text-xs text-amber-600 italic ml-auto">pas d'email</span>
                      }
                    </label>
                  ))}
                </div>
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
                  {docStagiaire && (
                    <li>{docStagiaire.title} — <em>{docStagiaire.file_name}</em></li>
                  )}
                </ul>
              </div>

              {/* Compte rendu post-formation */}
              {evalsLoaded && (
                <div className="border border-purple-200 rounded-lg overflow-hidden">
                  {/* Header du bloc */}
                  <div className="bg-purple-50 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-purple-800">📋 Compte rendu de formation</p>
                      <p className="text-xs text-purple-600 mt-0.5">
                        {evals.length > 0
                          ? `${evals.length} évaluation${evals.length > 1 ? 's' : ''} à chaud disponible${evals.length > 1 ? 's' : ''} — Score moyen : ${computeEvalData()?.globalScore || '—'}/5 — Recommandation : ${computeEvalData()?.tauxReco !== null ? computeEvalData().tauxReco + '%' : '—'}`
                          : 'Aucune évaluation à chaud pour cette session'
                        }
                      </p>
                    </div>
                    {evals.length > 0 && (
                      <button
                        onClick={generateCompteRendu}
                        disabled={crGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {crGenerating ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <span>✨</span>}
                        {crGenerating ? 'Génération…' : (compteRendu ? 'Regénérer' : 'Générer avec l\'IA')}
                      </button>
                    )}
                  </div>

                  {/* Erreur */}
                  {crError && (
                    <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      {crError}
                    </div>
                  )}

                  {/* Commentaires libres des stagiaires */}
                  {evals.length > 0 && computeEvalData()?.comments.length > 0 && (
                    <div className="px-4 pt-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Commentaires des stagiaires</p>
                      <div className="space-y-1.5">
                        {computeEvalData().comments.map((c, i) => (
                          <p key={i} className="text-xs text-gray-600 italic bg-gray-50 border border-gray-200 rounded px-3 py-2">
                            « {c} »
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Texte généré — éditable */}
                  {compteRendu && (
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Texte généré</p>
                        <button
                          onClick={() => {
                            const newBody = emailBody + '\n\n--- Compte rendu de la formation ---\n' + compteRendu
                            setEmailBody(newBody)
                            toast.success('Compte rendu ajouté au corps du mail')
                          }}
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium underline"
                        >
                          + Ajouter au mail
                        </button>
                      </div>
                      <textarea
                        value={compteRendu}
                        onChange={e => setCompteRendu(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm text-gray-800 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                        rows={Math.max(3, compteRendu.split('\n').length + 1)}
                      />
                    </div>
                  )}

                  {/* État vide — pas d'évals */}
                  {evals.length === 0 && (
                    <p className="px-4 py-3 text-xs text-gray-500 italic">
                      Les évaluations à chaud n'ont pas encore été complétées pour cette session. Le compte rendu sera disponible une fois les évals reçues.
                    </p>
                  )}
                </div>
              )}

              {/* Bouton envoyer */}
              <button
                onClick={handleSend}
                disabled={selectedCount === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
                Envoyer à {selectedCount} stagiaire{selectedCount > 1 ? 's' : ''}
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
