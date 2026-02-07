// api/generate-prospect-summary.js
// Génère un résumé IA du prospect : scrape le site web si dispo + analyse NAF/nom

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { name, city, naf, effectif, site_web, siret } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Nom requis' })
    }

    // Tenter de scraper le site web si disponible
    let siteContent = ''
    if (site_web) {
      try {
        let url = site_web.trim()
        if (!url.startsWith('http')) url = 'https://' + url
        
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        
        const siteRes = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AccessFormation/1.0)' }
        })
        clearTimeout(timeout)
        
        if (siteRes.ok) {
          const html = await siteRes.text()
          // Extraire le texte brut (title + meta description + body text)
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
          const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
          const bodyText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 2000)
          
          const parts = []
          if (titleMatch) parts.push('Titre: ' + titleMatch[1].trim())
          if (metaMatch) parts.push('Description: ' + metaMatch[1].trim())
          if (bodyText) parts.push('Contenu: ' + bodyText.slice(0, 1500))
          siteContent = parts.join('\n')
        }
      } catch (e) {
        // Site inaccessible, on continue sans
        console.log('Site inaccessible:', site_web, e.message)
      }
    }

    const prompt = `Analyse ce prospect et génère un résumé BREF (3-4 lignes max) pour préparer un appel commercial de formation professionnelle.

INFORMATIONS PROSPECT :
- Entreprise : ${name}
- Ville : ${city || 'Inconnue'}
- Code NAF : ${naf || 'Inconnu'}
- Effectif : ${effectif || 'Inconnu'}
- SIRET : ${siret || ''}
${siteContent ? `\nCONTENU DU SITE WEB :\n${siteContent}` : ''}

INSTRUCTIONS :
1. Résume l'activité de l'entreprise en 1 phrase
2. Identifie les formations pertinentes parmi : SST/MAC SST, Incendie (EPI/extincteurs/évacuation), Habilitation électrique, CACES (chariots/nacelles), Gestes et postures
3. Si le site donne des infos utiles (clients, secteur, risques), mentionne-les
4. Sois concis et utile pour un commercial qui va appeler

FORMAT : Texte brut, pas de markdown, pas de puces, pas de titres. Juste 3-4 lignes directement exploitables.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Erreur API Claude')
    }

    const data = await response.json()
    const summary = data.content[0].text

    return res.status(200).json({ success: true, summary })

  } catch (error) {
    console.error('Erreur génération résumé:', error)
    return res.status(500).json({
      error: 'Erreur lors de la génération du résumé',
      details: error.message
    })
  }
}
