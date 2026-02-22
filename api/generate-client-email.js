// api/generate-client-email.js
// Génère un email professionnel à un client à partir d'un brief libre
// Utilise le contexte client (interactions, formations) pour personnaliser

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { brief, clientName, clientSector, contactName, senderName, recentInteractions, formations } = req.body

    if (!brief) {
      return res.status(400).json({ error: 'Brief requis' })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurée' })
    }

    // Construire le contexte
    const interactionsCtx = (recentInteractions || []).slice(0, 5).map(i =>
      `- ${i.date ? new Date(i.date).toLocaleDateString('fr-FR') : ''} : ${i.type} — ${i.title || ''} ${i.content ? '(' + i.content.slice(0, 100) + ')' : ''}`
    ).join('\n')

    const formationsCtx = (formations || []).map(f =>
      `- ${f.type_formation || ''} ${f.status ? '(' + f.status + ')' : ''}`
    ).join('\n')

    const prompt = `Tu es ${senderName || 'Hicham'}, co-dirigeant d'Access Formation, organisme de formation professionnelle santé/sécurité basé à Concarneau (Bretagne). Certifié Qualiopi, formations éligibles OPCO.

Génère un email professionnel à partir de ce brief.

CONTEXTE :
- Entreprise : ${clientName || 'Client'}
${clientSector ? '- Secteur : ' + clientSector : ''}
${contactName ? '- Contact : ' + contactName : ''}
${interactionsCtx ? '- Derniers échanges :\n' + interactionsCtx : ''}
${formationsCtx ? '- Formations :\n' + formationsCtx : ''}

BRIEF DE L'UTILISATEUR :
${brief}

RÈGLES :
- Ton professionnel mais chaleureux et direct
- Vouvoiement
- Court et efficace (5-10 lignes max)
- Pas de formule pompeuse
- NE PAS inclure de signature (ajoutée automatiquement)
- INTERDIT d'inclure une formule de politesse finale : pas de "Cordialement", "Bien cordialement", "À très bientôt", "Au plaisir", "Bonne journée", etc. La formule de clôture + signature sont ajoutées automatiquement après ton texte
- Le texte doit se terminer par la dernière phrase utile du message, RIEN d'autre
- Langue : français

Réponds UNIQUEMENT au format JSON suivant, sans backticks ni markdown :
{"subject": "l'objet de l'email", "body": "le corps de l'email en HTML simple (balises <p> uniquement)"}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic API error:', errText)
      return res.status(500).json({ error: 'Erreur API Anthropic' })
    }

    const data = await response.json()
    let textContent = (data.content?.[0]?.text || '').trim()

    // Nettoyer les artefacts markdown (```json ... ```)
    textContent = textContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()

    try {
      const parsed = JSON.parse(textContent)
      // Nettoyer le body de tout résidu JSON/markdown
      const cleanBody = (parsed.body || '').replace(/["\s}`]+$/, '').replace(/^["\s{`]+/, '').trim()
      const cleanSubject = (parsed.subject || '').replace(/["`]+/g, '').trim()
      return res.status(200).json({ subject: cleanSubject, body: cleanBody })
    } catch (parseErr) {
      // Fallback : extraire le body manuellement
      const subjectMatch = textContent.match(/"subject"\s*:\s*"([^"]*)"/)
      const bodyMatch = textContent.match(/"body"\s*:\s*"([\s\S]*?)"\s*}/)
      return res.status(200).json({
        subject: subjectMatch?.[1] || `Access Formation — ${clientName || ''}`,
        body: (bodyMatch?.[1] || textContent).replace(/\\n/g, '\n').replace(/["`}]+$/g, '').trim(),
      })
    }
  } catch (error) {
    console.error('generate-client-email error:', error)
    return res.status(500).json({ error: error.message })
  }
}
