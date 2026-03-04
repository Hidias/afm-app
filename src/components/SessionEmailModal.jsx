import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, FileText, Send, Loader, CheckCircle, AlertCircle, Upload, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { generatePDF, generateAllPDF } from '../lib/pdfGenerator'
import { getNeedsAnalysisPDFBytes } from '../lib/needsAnalysisPDF'
import { generateSatisfactionEntreprisePDF } from '../lib/satisfactionEntreprisePDF'

export default function SessionEmailModal({ session, emailType, sessionCosts, questions, traineeResults, onClose }) {
  const [step, setStep] = useState('generating') // 'generating', 'compose', 'sending', 'sent'
  const [generatedFiles, setGeneratedFiles] = useState([])
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [generationLog, setGenerationLog] = useState([])

  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [toEmail, setToEmail] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userEmail, setUserEmail] = useState(null)

  // ── Compte rendu post-formation ──
  const [evals, setEvals] = useState([])
  const [evalsLoaded, setEvalsLoaded] = useState(false)
  const [compteRendu, setCompteRendu] = useState('')
  const [crGenerating, setCrGenerating] = useState(false)
  const [crError, setCrError] = useState(null)

  useEffect(() => {
    loadUserEmail()
    initializeEmail()
    generateAllDocuments()
    // Charger les évals à chaud uniquement pour « après formation »
    if (emailType === 'after' && session?.id) {
      // D'abord récupérer les trainee_id valides de la session
      supabase
        .from('session_trainees')
        .select('trainee_id')
        .eq('session_id', session.id)
        .then(({ data: stData }) => {
          const validIds = (stData || []).map(st => st.trainee_id)
          // Puis charger les évals et filtrer sur ces IDs uniquement
          supabase
            .from('trainee_evaluations')
            .select('*')
            .eq('session_id', session.id)
            .then(({ data }) => {
              const filtered = (data || []).filter(e => validIds.includes(e.trainee_id))
              setEvals(filtered)
              setEvalsLoaded(true)
            })
        })
    }
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
    const sessionContact = session?.contact
    const primaryContact = session?.clients?.contacts?.find(c => c.is_primary)
    const firstContact = session?.clients?.contacts?.[0]
    const contactEmail = sessionContact?.email || primaryContact?.email || firstContact?.email || session?.clients?.email || ''
    setToEmail(contactEmail)

    const ref = session?.reference || ''
    const courseTitle = session?.courses?.title || ''

    if (emailType === 'before') {
      setEmailSubject(`${courseTitle} - Documents de formation - ${ref}`)
      setEmailBody(`Bonjour,

Veuillez trouver ci-joints les documents relatifs à la formation "${courseTitle}" :

- Convention de formation
- Programme de formation
- Convocations des stagiaires
- Analyse du besoin de formation
- Notice stagiaire — Passeport de Prévention
- Notice employeur — Passeport de Prévention
- Décharge de refus de communication du NIR

Merci de nous retourner la convention signée ainsi que l'analyse du besoin complétée et signée avant le début de la formation.

Concernant le Passeport de Prévention : conformément au Décret n° 2025-748 du 1er août 2025, nous déclarons les formations santé-sécurité dans le Passeport de prévention national. La notice stagiaire est à remettre à chaque participant. Si un salarié refuse de communiquer son NIR, merci de lui faire signer la décharge jointe.

Concernant les convocations, chacune contient un QR code permettant aux stagiaires de se connecter à notre portail en ligne. Ils pourront y renseigner leurs informations personnelles ainsi que participer à un test de positionnement avant le début de la formation. Ce test n'a aucun caractère certificatif : il vise uniquement à évaluer leur niveau de connaissances préalable afin de mieux adapter la formation à leur niveau.

Restant à votre disposition pour toute information complémentaire.`)
    } else {
      setEmailSubject(`${courseTitle} - Documents de fin de formation - ${ref}`)
      setEmailBody(`Bonjour,

Suite à la formation "${courseTitle}", veuillez trouver ci-joints :

- Les certificats de réalisation
- Les attestations de présence
- Les questionnaires d'évaluation à froid (à compléter d'ici 90 jours)
- Le questionnaire de satisfaction entreprise

Nous vous serions reconnaissants de bien vouloir compléter et nous retourner le questionnaire de satisfaction entreprise afin de nous permettre d'améliorer continuellement la qualité de nos prestations.

Nous vous remercions pour votre confiance et restons à votre disposition.`)
    }
  }

  // ─── Génération automatique de tous les documents ───
  const generateAllDocuments = async () => {
    const trainer = session?.trainers || null
    const traineesWithResult = session?.session_trainees?.map(st => ({
      ...st.trainees,
      result: st.result || (traineeResults && traineeResults[st.trainee_id]) || null,
      access_code: st.access_code
    })) || []

    const files = []
    const addLog = (msg) => setGenerationLog(prev => [...prev, msg])

    try {
      if (emailType === 'before') {
        // ── CONVENTION ──
        addLog('Convention...')
        const convention = await generatePDF('convention', session, {
          trainees: traineesWithResult,
          trainer,
          costs: sessionCosts || []
        })
        if (convention) {
          files.push({ id: 'convention', name: convention.filename, base64: convention.base64, size: convention.size })
          addLog('✅ Convention générée')
        }

        // ── PROGRAMME (courses.program_url uniquement) ──
        addLog('Programme...')
        try {
          const { data: course } = await supabase
            .from('courses')
            .select('program_url, title')
            .eq('id', session.course_id)
            .single()

          if (course?.program_url) {
            const response = await fetch(course.program_url)
            if (response.ok) {
              const blob = await response.blob()
              const base64 = await blobToBase64(blob)
              const programmeName = `Programme_${course.title || 'formation'}.pdf`
              files.push({ id: 'programme', name: programmeName, base64, size: base64.length })
              addLog('✅ Programme récupéré')
            } else {
              addLog('⚠️ Erreur téléchargement programme')
            }
          } else {
            addLog('⚠️ Programme non trouvé — uploadez-le dans la formation')
          }
        } catch (e) {
          console.error('Erreur récupération programme:', e)
          addLog('⚠️ Erreur récupération programme')
        }

        // ── CONVOCATIONS INDIVIDUELLES (un PDF par stagiaire) ──
        addLog(`Convocations individuelles (${traineesWithResult.length} stagiaires)...`)
        for (const trainee of traineesWithResult) {
          try {
            const convoc = await generatePDF('convocation', session, { trainee, trainer })
            if (convoc) {
              files.push({ id: `convocation_${trainee.id}`, name: convoc.filename, base64: convoc.base64, size: convoc.size })
            }
          } catch (err) {
            console.error(`Erreur convocation ${trainee.last_name}:`, err)
            addLog(`⚠️ Erreur convocation ${trainee.first_name} ${trainee.last_name}`)
          }
        }
        addLog(`✅ ${traineesWithResult.length} convocation(s) générée(s)`)

        // ── ANALYSE DU BESOIN (préfillée) ──
        addLog('Analyse du besoin...')
        try {
          const startDate = session?.start_date ? new Date(session.start_date).toLocaleDateString('fr-FR') : ''
          const endDate = session?.end_date ? new Date(session.end_date).toLocaleDateString('fr-FR') : ''
          const analysisData = {
            analysis_date: new Date().toISOString().split('T')[0],
            location_type: session?.is_intra ? 'client' : 'nos_locaux',
            location_client_address: session?.is_intra ? (session?.clients?.address || '') : '',
            location_name: session?.location_name || '',
            preferred_dates: startDate === endDate ? startDate : `${startDate} au ${endDate}`
          }
          const analyseBytes = await getNeedsAnalysisPDFBytes(session, analysisData, false, null)
          if (analyseBytes) {
            files.push({ id: 'analyseBesoin', name: `Analyse_Besoin_${session?.reference || 'session'}.pdf`, arrayBuffer: analyseBytes, size: analyseBytes.byteLength })
            addLog('✅ Analyse du besoin générée')
          }
        } catch (e) {
          console.error('Erreur génération analyse besoin:', e)
          addLog('⚠️ Erreur génération analyse du besoin')
        }

        // ── DOCUMENTS PASSEPORT PRÉVENTION (3 PDF depuis Storage) ──
        addLog('Documents Passeport Prévention...')
        const passeportDocs = [
          { id: 'notice_stagiaire_pp', path: 'templates/passeport-prevention/Notice_Passeport_Prevention_Stagiaire_AccessFormation.pdf', name: 'Notice_Stagiaire_Passeport_Prevention.pdf' },
          { id: 'notice_employeur_pp', path: 'templates/passeport-prevention/Notice_Passeport_Prevention_Employeur_AccessFormation.pdf', name: 'Notice_Employeur_Passeport_Prevention.pdf' },
          { id: 'decharge_nir_pp', path: 'templates/passeport-prevention/Decharge_Refus_NIR_Passeport_Prevention_AccessFormation.pdf', name: 'Decharge_Refus_NIR_Passeport_Prevention.pdf' },
        ]
        for (const doc of passeportDocs) {
          try {
            const { data: blob, error: dlError } = await supabase.storage
              .from('documents')
              .download(doc.path)
            if (dlError) throw dlError
            const base64 = await blobToBase64(blob)
            files.push({ id: doc.id, name: doc.name, base64, size: base64.length })
          } catch (e) {
            console.error(`Erreur téléchargement ${doc.name}:`, e)
            addLog(`⚠️ ${doc.name} non trouvé dans Storage`)
          }
        }
        addLog('✅ Documents Passeport Prévention ajoutés')

      } else {
        // ── CERTIFICATS ──
        addLog(`Certificats (${traineesWithResult.length} stagiaires)...`)
        const certificats = await generateAllPDF('certificat', session, traineesWithResult, { trainer })
        if (certificats) {
          files.push({ id: 'certificats', name: certificats.filename, base64: certificats.base64, size: certificats.size })
          addLog('✅ Certificats générés')
        }

        // ── ATTESTATIONS ──
        addLog(`Attestations (${traineesWithResult.length} stagiaires)...`)
        const attestations = await generateAllPDF('attestation', session, traineesWithResult, { trainer })
        if (attestations) {
          files.push({ id: 'attestations', name: attestations.filename, base64: attestations.base64, size: attestations.size })
          addLog('✅ Attestations générées')
        }

        // ── EVALUATIONS À FROID ──
        addLog(`Évaluations à froid (${traineesWithResult.length} stagiaires)...`)
        const evaluationsFroid = await generateAllPDF('evaluationFroid', session, traineesWithResult, { trainer })
        if (evaluationsFroid) {
          files.push({ id: 'evaluationsFroid', name: evaluationsFroid.filename, base64: evaluationsFroid.base64, size: evaluationsFroid.size })
          addLog('✅ Évaluations à froid générées')
        }

        // ── QUESTIONNAIRE SATISFACTION ENTREPRISE ──
        addLog('Questionnaire satisfaction entreprise...')
        try {
          const satisfactionPDF = await generateSatisfactionEntreprisePDF(session, session?.clients)
          if (satisfactionPDF) {
            files.push({ id: 'satisfactionEntreprise', name: satisfactionPDF.filename, base64: satisfactionPDF.base64, size: satisfactionPDF.size })
            addLog('✅ Questionnaire satisfaction entreprise généré')
          }
        } catch (e) {
          console.error('Erreur génération questionnaire satisfaction:', e)
          addLog('⚠️ Erreur génération questionnaire satisfaction')
        }
      }

      setGeneratedFiles(files)
      setStep('compose')

    } catch (err) {
      console.error('Erreur génération documents:', err)
      setError('Erreur lors de la génération : ' + err.message)
      setGeneratedFiles(files)
      setStep('compose')
    }
  }

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // ─── Mise à jour automatique checklist après envoi ───
  const updateChecklistItems = async (codes) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const now = new Date().toISOString()
      const today = now.split('T')[0]

      for (const code of codes) {
        const { data: existing } = await supabase
          .from('session_checklists')
          .select('id', 'is_checked')
          .eq('session_id', session.id)
          .eq('item_code', code)
          .maybeSingle()

        if (existing) {
          if (!existing.is_checked) {
            await supabase
              .from('session_checklists')
              .update({
                is_checked: true,
                checked_at: now,
                checked_by: user?.id,
                date_realized: today
              })
              .eq('id', existing.id)
          }
        } else {
          await supabase
            .from('session_checklists')
            .insert({
              session_id: session.id,
              item_code: code,
              is_checked: true,
              checked_at: now,
              checked_by: user?.id,
              date_realized: today
            })
        }
      }

      // Sync aussi les colonnes sur la table sessions (utilisées par le bloc "Suivi Convention")
      if (codes.includes('convention_envoyee')) {
        await supabase
          .from('sessions')
          .update({ convention_sent: true, convention_sent_date: now })
          .eq('id', session.id)
      }
    } catch (err) {
      console.error('Erreur mise à jour checklist:', err)
    }
  }

  // ─── Upload manuel supplémentaire ───
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
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleRemoveFile = (fileId, isGenerated) => {
    if (isGenerated) {
      setGeneratedFiles(prev => prev.filter(f => f.id !== fileId))
    } else {
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
    }
  }

  // ─── Envoi ───
  const handleSend = async () => {
    if (!toEmail || !emailSubject || !emailBody) {
      toast.error('Email, objet et corps obligatoires')
      return
    }
    if (!userEmail) {
      toast.error('Configurez votre email dans Paramètres')
      return
    }

    // Avertir si un compte rendu IA a été généré mais pas encore inséré dans le corps du mail
    if (compteRendu && !emailBody.includes(compteRendu)) {
      toast.error('Le compte rendu IA a été généré mais n\'a pas été ajouté au mail. Cliquez sur "+ Ajouter au mail" avant d\'envoyer.', { duration: 5000 })
      return
    }

    const allFiles = [...generatedFiles, ...uploadedFiles]
    if (allFiles.length === 0) {
      toast.error('Aucun document à envoyer')
      return
    }

    setLoading(true)
    setStep('sending')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // 1) Upload chaque fichier dans Supabase Storage
      const prefix = `${session.id}/${Date.now()}`
      const uploadedPaths = []

      // Slugify pour le chemin storage (pas d'accents, espaces, apostrophes)
      const slugify = (name) => name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents → base
        .replace(/[^a-zA-Z0-9._-]/g, '-')                // caractères spéciaux → tiret
        .replace(/-+/g, '-')                              // tirets multiples → un seul

      for (const file of allFiles) {
        const blob = file.arrayBuffer
          ? new Blob([file.arrayBuffer], { type: 'application/pdf' })
          : new Blob([Uint8Array.from(atob(file.base64), c => c.charCodeAt(0))], { type: 'application/pdf' })
        const safeFileName = slugify(file.name)
        const storagePath = `${prefix}/${safeFileName}`

        const { error: uploadError } = await supabase.storage
          .from('session-email-docs')
          .upload(storagePath, blob, { upsert: true })

        if (uploadError) {
          console.error('Upload échoué pour', file.name, uploadError)
          throw new Error(`Erreur upload : ${file.name}`)
        }

        uploadedPaths.push({ path: storagePath, filename: file.name })
      }

      // 2) Appeler l'API avec les chemins (léger)
      const response = await fetch('/api/send-email-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          to: toEmail,
          subject: emailSubject,
          body: emailBody,
          attachmentPaths: uploadedPaths,
          sessionId: session.id,
          emailType
        })
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.details)

      // 3) Mise à jour automatique checklist
      const checklistCodes = emailType === 'before'
        ? ['convention_envoyee', 'convocations_envoyees']
        : ['certificats_envoyes']
      await updateChecklistItems(checklistCodes)

      setStep('sent')
      toast.success('Email envoyé avec succès !')
      setTimeout(() => onClose(true), 2000)

    } catch (err) {
      console.error('Erreur envoi:', err)
      setError(err.message)
      toast.error('Erreur lors de l\'envoi : ' + err.message)
      setStep('compose')
    } finally {
      setLoading(false)
    }
  }

  // ─── Compte rendu : calcul + génération IA ───
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
    const scores = {}
    Q_KEYS.forEach(key => {
      const vals = evals.map(e => e[key]).filter(v => v !== null && v !== undefined).map(Number)
      scores[key] = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null
    })
    const allScores = Q_KEYS.flatMap(key => evals.map(e => e[key]).filter(v => v !== null && v !== undefined).map(Number))
    const globalScore = allScores.length ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2) : null
    const withReco = evals.filter(e => e.would_recommend !== null && e.would_recommend !== undefined)
    const tauxReco = withReco.length ? Math.round((withReco.filter(e => e.would_recommend === true).length / withReco.length) * 100) : null
    const TEST_WORDS = ['test', 'test123', 'aaa', 'bbb', 'ccc', 'xxx', 'asdf', 'qwerty', 'blah', 'ok', 'oui', 'non']
    const comments = evals.flatMap(e => [
      (e.comments || '').trim(),
      (e.comment_general || '').trim(),
      (e.comment_projet || '').trim()
    ]).filter(c => {
      if (c.length < 15) return false
      if (TEST_WORDS.includes(c.toLowerCase())) return false
      return true
    })
    return { scores, globalScore, tauxReco, comments, total: evals.length }
  }

  const generateCompteRendu = async () => {
    const evalData = computeEvalData()
    if (!evalData) return
    setCrGenerating(true)
    setCrError(null)

    const ref = session?.reference || ''
    const courseTitle = session?.courses?.title || ''
    const startDate = session?.start_date ? new Date(session.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    const endDate = session?.end_date ? new Date(session.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    const trainer = session?.trainers
    const formateur = trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Access Formation'

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
Stagiaires ayant répondu : ${evalData.total} sur ${evalData.total}
Score moyen global : ${evalData.globalScore}/5
Taux de recommandation : ${evalData.tauxReco !== null ? evalData.tauxReco + '%' : 'non calculé'}

Scores détaillés par question :
${scoresText}

Commentaires libres des stagiaires :
${commentsText}

Écris un compte rendu professionnel et synthétique de cette session de formation.
Le compte rendu doit :
- Être écrit en première personne (« j'ai animé », « les stagiaires ont bien accueilli », etc.) comme si c'est le formateur lui-même qui écrivait
- Rester modeste : éviter les supérlatifs sur le formateur, ne pas se vanter
- Reprendre les points forts identifiés grâce aux scores (les dimensions avec les meilleurs résultats)
- Mentionner les points à améliorer si des scores sont nettement plus bas (< 3.5)
- Refléter la teneur des commentaires des stagiaires de façon naturelle, sans les citer mot pour mot
- Être concis et direct : entre 80 et 120 mots, pas de remplissage
- Ne pas mentionner les chiffres bruts sauf le score global et le taux de recommandation

Réponds uniquement avec le texte du compte rendu, sans titre ni introduction.`

    try {
      const response = await fetch('/api/generate-compte-rendu-formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erreur génération')
      setCompteRendu(data.text || '')
    } catch (e) {
      console.error('Erreur génération compte rendu:', e)
      setCrError('Erreur lors de la génération. Réessaie.')
    }
    setCrGenerating(false)
  }

  // ─── Render ───
  const isBefore = emailType === 'before'
  const headerBg = isBefore ? 'bg-blue-600' : 'bg-green-600'
  const btnBg = isBefore ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
  const icon = isBefore ? '📤' : '📥'
  const title = isBefore ? 'Documents avant formation' : 'Documents après formation'
  const totalFiles = generatedFiles.length + uploadedFiles.length

  const formatSize = (size) => {
    if (size > 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + ' MB'
    return (size / 1024).toFixed(0) + ' KB'
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">

        {/* Header */}
        <div className={`${headerBg} text-white p-4 flex items-center justify-between flex-shrink-0`}>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>{icon}</span> {title}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="p-5 overflow-y-auto flex-1">

          {/* ── GÉNÉRATION EN COURS ── */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <Loader className="w-12 h-12 text-blue-600 animate-spin" />
              <p className="text-lg font-semibold text-gray-800">Génération des documents…</p>
              <div className="w-full max-w-sm bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-1">
                {generationLog.map((msg, i) => (
                  <p key={i} className={`text-sm ${msg.startsWith('✅') ? 'text-green-700' : msg.startsWith('⚠️') ? 'text-amber-600' : 'text-gray-500'}`}>
                    {msg}
                  </p>
                ))}
                {generationLog.length === 0 && <p className="text-sm text-gray-400 italic">En attente…</p>}
              </div>
            </div>
          )}

          {/* ── COMPOSITION ── */}
          {step === 'compose' && (
            <div className="space-y-4">
              {/* Destinataire */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destinataire</label>
                <input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="email@exemple.fr"
                />
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

              {/* Corps */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                />
              </div>

              {/* Compte rendu post-formation — uniquement « après formation » */}
              {!isBefore && evalsLoaded && (() => {
                const evalData = computeEvalData()
                return (
                  <div className="border border-purple-200 rounded-lg overflow-hidden">
                    {/* Header */}
                    <div className="bg-purple-50 px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-purple-800">📋 Compte rendu de formation</p>
                        <p className="text-xs text-purple-600 mt-0.5">
                          {evals.length > 0
                            ? `${evals.length} stagiaire${evals.length > 1 ? 's' : ''} — Score moyen : ${evalData?.globalScore || '—'}/5 — Recommandation : ${evalData?.tauxReco !== null ? evalData.tauxReco + '%' : '—'}`
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
                          {crGenerating ? 'Génération…' : (compteRendu ? 'Regénérer' : "Générer avec l'IA")}
                        </button>
                      )}
                    </div>

                    {/* Erreur */}
                    {crError && (
                      <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        {crError}
                      </div>
                    )}

                    {/* Commentaires verbatim */}
                    {evals.length > 0 && evalData?.comments.length > 0 && (
                      <div className="px-4 pt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Commentaires des stagiaires</p>
                        <div className="space-y-1.5">
                          {evalData.comments.map((c, i) => (
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
                              setEmailBody(prev => prev + '\n\n--- Compte rendu de la formation ---\n' + compteRendu)
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

                    {/* Pas d'évals */}
                    {evals.length === 0 && (
                      <p className="px-4 py-3 text-xs text-gray-500 italic">
                        Les évaluations à chaud ne sont pas encore disponibles pour cette session.
                      </p>
                    )}
                  </div>
                )
              })()}

              {/* Documents générés */}
              {generatedFiles.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    📎 Documents générés ({generatedFiles.length})
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-lg divide-y divide-green-200">
                    {generatedFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm text-gray-800 truncate">{file.name}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(file.size)}</span>
                        </div>
                        <button onClick={() => handleRemoveFile(file.id, true)} className="p-1 hover:bg-green-100 rounded flex-shrink-0">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avertissement programme manquant */}
              {isBefore && generatedFiles.every(f => f.id !== 'programme') && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Le programme n'a pas été trouvé dans <strong>Documents de formation</strong>. 
                    Uploadez-le manuellement ci-dessous ou dans la page du cours.
                  </p>
                </div>
              )}

              {/* Upload supplémentaire */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ajouter des fichiers supplémentaires
                </label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">Choisir des fichiers</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  />
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg divide-y divide-gray-200">
                    {uploadedFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-800 truncate">{file.name}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(file.size)}</span>
                        </div>
                        <button onClick={() => handleRemoveFile(file.id, false)} className="p-1 hover:bg-gray-200 rounded flex-shrink-0">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Erreur */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* ── ENVOI EN COURS ── */}
          {step === 'sending' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-gray-600">Envoi de l'email avec {totalFiles} document(s)…</p>
            </div>
          )}

          {/* ── ENVOYÉ ── */}
          {step === 'sent' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <CheckCircle className="w-14 h-14 text-green-600" />
              <p className="text-lg font-semibold text-gray-900">Email envoyé !</p>
              <p className="text-sm text-gray-500">Il apparaîtra dans vos messages envoyés.</p>
            </div>
          )}
        </div>

        {/* Footer — boutons fixes en bas */}
        {step === 'compose' && (
          <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-100">
              Annuler
            </button>
            <button
              onClick={handleSend}
              disabled={totalFiles === 0}
              className={`${btnBg} text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-40`}
            >
              <Send className="w-4 h-4" />
              Envoyer · {totalFiles} doc{totalFiles !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
