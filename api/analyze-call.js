// api/analyze-call.js
// Analyse IA d'une transcription d'appel téléphonique (côté serveur)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { transcript, client_name, contact_name, context } = req.body

    if (!transcript || transcript.trim().length < 20) {
      return res.status(400).json({ error: 'Transcription trop courte pour analyse' })
    }

    const SYSTEM_PROMPT = `Tu es l'assistant IA d'Access Formation, organisme de formation professionnelle en sécurité au travail (SST, Incendie, Habilitation électrique, Conduite d'engins R485/R489).

Tu analyses des transcriptions d'appels téléphoniques de prospection commerciale passés par Marine (chargée de développement).

CONTEXTE MÉTIER :
- Cible : entreprises de 6 à 499 salariés en Bretagne et Pays de la Loire
- Formations : SST (Sauveteur Secouriste du Travail), Incendie/EPI, Habilitation électrique, Conduite d'engins (R485, R489)
- Les formations SST sont obligatoires et doivent être recyclées tous les 24 mois
- Les OPCO financent souvent les formations (OCAPIAT, OPCO EP, Constructys, etc.)

RÈGLES D'ANALYSE :
- Extrais UNIQUEMENT ce qui est dit ou clairement impliqué dans la transcription
- N'invente aucune information absente
- Si un élément n'est pas mentionné, mets null
- Sois concis et factuel

RÉPONDS UNIQUEMENT en JSON valide (sans backticks, sans texte avant/après) avec cette structure :
{
  "resume": "Résumé factuel en 2-3 phrases max",
  "besoin": "Formation(s) identifiée(s), nombre de personnes, urgence",
  "objections": "Freins ou objections exprimés (budget, timing, direction...)",
  "interlocuteur": "Nom et fonction si mentionnés",
  "next_action": "Prochaine action concrète à faire",
  "relance_date_suggestion": "Dans X jours/semaines (ou null)",
  "temperature": "froid|tiede|chaud",
  "statut_suggere": "prospect|en_discussion|actif",
  "formations_identifiees": ["SST", "Incendie"],
  "nb_stagiaires_estime": null,
  "opco_mentionne": null,
  "tags": ["mot-clé1", "mot-clé2"]
}`

    const prompt = `Analyse cette transcription d'appel téléphonique :

PROSPECT : ${client_name || 'Non identifié'}
CONTACT : ${contact_name || 'Non identifié'}
${context ? `CONTEXTE : ${context}` : ''}

TRANSCRIPTION :
${transcript}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Erreur API Claude')
    }

    const data = await response.json()
    const text = data.content[0].text

    // Parser le JSON
    let analysis
    try {
      analysis = JSON.parse(text.replace(/```json?|```/g, '').trim())
    } catch {
      // Fallback : retourner le texte brut
      analysis = { resume: text, besoin: null, objections: null, temperature: 'tiede', statut_suggere: 'prospect' }
    }

    return res.status(200).json({ success: true, analysis })

  } catch (error) {
    console.error('Erreur analyse appel:', error)
    return res.status(500).json({
      error: 'Erreur lors de l\'analyse',
      details: error.message
    })
  }
}
