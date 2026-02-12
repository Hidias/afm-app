// api/detect-opco.js
// Proxy pour l'API CFADOCK (contourne CORS)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { siret } = req.query
  if (!siret || siret.length < 9) {
    return res.status(400).json({ error: 'SIRET invalide (min 9 chiffres)' })
  }

  try {
    const resp = await fetch(`https://www.cfadock.fr/api/opcos?siret=${siret}`)
    
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `CFADOCK a répondu ${resp.status}` })
    }

    const data = await resp.json()
    return res.status(200).json(data)
  } catch (err) {
    console.error('Erreur proxy CFADOCK:', err)
    return res.status(500).json({ error: 'Erreur appel CFADOCK: ' + err.message })
  }
}
