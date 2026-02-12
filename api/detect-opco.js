// api/detect-opco.js
// Proxy pour l'API CFADOCK (contourne CORS)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { siret } = req.query
  if (!siret || siret.replace(/\s/g, '').length < 9) {
    return res.status(400).json({ error: 'SIRET invalide (min 9 chiffres)' })
  }

  const cleanSiret = siret.replace(/\s/g, '')

  try {
    const url = `https://www.cfadock.fr/api/opcos?siret=${cleanSiret}`
    console.log('[detect-opco] Appel CFADOCK:', url)

    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    })

    const text = await resp.text()
    console.log('[detect-opco] Reponse CFADOCK status:', resp.status, 'body:', text.substring(0, 500))

    if (!resp.ok) {
      return res.status(resp.status).json({ error: `CFADOCK a repondu ${resp.status}`, raw: text.substring(0, 200) })
    }

    const data = JSON.parse(text)

    // L'API retourne un objet unique : { OpcoName, OpcoSiren, ResultStatus, Idcc, ... }
    return res.status(200).json({
      opco_name: data.OpcoName || null,
      opco_siren: data.OpcoSiren || null,
      status: data.ResultStatus || 'UNKNOWN',
      idcc: data.Idcc || null,
      naf_code: data.FilterNAFCode || null,
      url: data.Url || null,
    })
  } catch (err) {
    console.error('[detect-opco] Erreur:', err)
    return res.status(500).json({ error: 'Erreur appel CFADOCK: ' + err.message })
  }
}
