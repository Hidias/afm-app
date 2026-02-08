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

    const prompt = `Tu génères une FICHE PROSPECT pour un opérateur téléphonique d'Access Formation (organisme de formation sécurité, Concarneau).

CE N'EST PAS UN PITCH. C'est une fiche d'intelligence rapide que l'opérateur lit en 10 secondes avant d'appeler.

INFORMATIONS PROSPECT :
- Nom entreprise : ${name}
- Ville : ${city || 'Inconnue'}
- Code NAF : ${naf || 'Inconnu'}
- Effectif : ${effectif || 'Inconnu'}
- SIRET : ${siret || ''}
${siteContent ? `\nSITE WEB :\n${siteContent}` : ''}

NOTRE OFFRE (utilise UNIQUEMENT ces termes) :
- SST initial (14h, groupes 4-10 pers.) / MAC SST recyclage (7h)
- Initiation gestes de premiers secours (4h) — alternative SST pour petites structures
- Incendie : EPI, manipulation extincteurs, évacuation
- Habilitation électrique B0/H0V uniquement (non-électriciens)
- Conduite chariots R489 / gerbeurs R485 (formation INTERNE, jamais dire "CACES")
- Gestes & Postures / Prévention TMS
- DUERP (Document Unique) — obligatoire toute entreprise
- Conseil sur mesure : analyse de postes de travail, formations adaptées (notre spécialité)

RÈGLES MÉTIER — QUAND PROPOSER QUOI :
- < 10 salariés → Initiation 4h (moins contraignant que SST 14h qui impose 4-10 pers.)
- ≥ 10 salariés → SST initial 14h pertinent (groupe possible), MAC SST si déjà formés
- Si l'entreprise veut du SST même en petit effectif → c'est possible
- Incendie → OBLIGATOIRE toute entreprise : manipulation extincteurs + exercice évacuation 2x/an → d'où l'intérêt de former des EPI (manip extincteurs + guide-file/serre-file)
- Entrepôt / logistique / stockage / magasin avec réserve → Conduite chariots R489 et/ou gerbeurs R485
- Manutention / port de charges / posture debout / travail répétitif → Gestes & Postures + analyse de poste sur mesure
- Travail à proximité d'installations électriques (bureaux, ateliers, maintenance) → Habilitation B0/H0V
- DUERP → obligatoire TOUTE entreprise dès 1 salarié, toujours le mentionner
- Conseil sur mesure / analyse de poste → notre spécialité, à proposer dès qu'il y a des risques spécifiques
- ⚠️ JAMAIS mentionner "CACES" — on fait de la formation interne conduite
- ⚠️ JAMAIS d'habilitation autre que B0/H0V

FORMAT OBLIGATOIRE (bullet points, texte brut, pas de markdown) :

🏢 [Nom commercial + enseigne/groupe si identifiable, activité en 5 mots max]
⚠️ Risques : [risques métier principaux, séparés par virgules]
📋 Obligations : [ce qui s'applique selon effectif — SST ou initiation, DUERP]
🎯 À proposer : [2-3 formations prioritaires avec raison courte]
💡 Accroche : [1 angle d'approche personnalisé basé sur l'activité réelle]

IMPORTANT :
- Pas de formule de politesse, pas de "n'hésitez pas"
- Pas de texte à réciter — juste des faits
- Si le site web ou le nom révèle un groupe/enseigne (ex: Intersport, Leclerc...), le mentionner
- Chaque ligne doit être ultra-concise`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
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
