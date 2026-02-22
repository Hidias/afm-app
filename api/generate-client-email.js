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
- NE PAS inclure de formule de politesse finale (Cordialement, etc.) → ajoutée avec la signature
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
    const textContent = data.content?.[0]?.text || ''

    try {
      const parsed = JSON.parse(textContent.trim())
      return res.status(200).json({ subject: parsed.subject, body: parsed.body })
    } catch (parseErr) {
      return res.status(200).json({
        subject: `Access Formation — ${clientName || ''}`,
        body: textContent,
      })
    }
  } catch (error) {
    console.error('generate-client-email error:', error)
    return res.status(500).json({ error: error.message })
  }
}
