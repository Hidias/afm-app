// api/detect-opco.js
// Détection OPCO en 2 étapes : siret2idcc (gouv.fr) → CFADOCK (IDCC → OPCO)

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
    // ── Étape 1 : SIRET → IDCC via siret2idcc (API gouvernement) ──
    console.log('[detect-opco] Étape 1 : siret2idcc pour', cleanSiret)
    const idccResp = await fetch(`https://siret2idcc.fabrique.social.gouv.fr/api/v2/${cleanSiret}`)
    
    if (!idccResp.ok) {
      console.log('[detect-opco] siret2idcc status:', idccResp.status)
      // Fallback : essayer CFADOCK directement par SIRET
      return await tryCfadockBySiret(cleanSiret, res)
    }

    const idccData = await idccResp.json()
    console.log('[detect-opco] siret2idcc réponse:', JSON.stringify(idccData).substring(0, 500))

    // Extraire l'IDCC
    const entry = Array.isArray(idccData) ? idccData[0] : idccData
    const conventions = entry?.conventions || []
    const activeConvention = conventions.find(c => c.active) || conventions[0]
    
    if (!activeConvention || !activeConvention.num) {
      console.log('[detect-opco] Pas de convention trouvée, fallback CFADOCK par SIRET')
      return await tryCfadockBySiret(cleanSiret, res)
    }

    const idcc = parseInt(activeConvention.num)
    const conventionTitle = activeConvention.shortTitle || activeConvention.title || ''
    console.log('[detect-opco] IDCC trouvé:', idcc, '-', conventionTitle)

    // ── Étape 2 : IDCC → OPCO via CFADOCK ──
    console.log('[detect-opco] Étape 2 : CFADOCK avec IDCC', idcc)
    const cfaResp = await fetch(`https://www.cfadock.fr/api/opcos?idcc=${idcc}`, {
      headers: { 'Accept': 'application/json' }
    })

    if (!cfaResp.ok) {
      console.log('[detect-opco] CFADOCK par IDCC status:', cfaResp.status)
      // On a l'IDCC mais pas l'OPCO - retourner quand même l'IDCC
      return res.status(200).json({
        opco_name: null,
        status: 'IDCC_FOUND_NO_OPCO',
        idcc,
        convention: conventionTitle,
        message: `Convention trouvée (IDCC ${idcc}) mais OPCO non identifié`
      })
    }

    const cfaData = await cfaResp.json()
    console.log('[detect-opco] CFADOCK réponse:', JSON.stringify(cfaData).substring(0, 300))

    if (cfaData.ResultStatus === 'OK' && cfaData.OpcoName) {
      return res.status(200).json({
        opco_name: cfaData.OpcoName,
        opco_siren: cfaData.OpcoSiren || null,
        status: 'OK',
        idcc,
        convention: conventionTitle,
        naf_code: cfaData.FilterNAFCode || null,
        url: cfaData.Url || null,
      })
    }

    // CFADOCK n'a pas trouvé l'OPCO pour cet IDCC
    return res.status(200).json({
      opco_name: null,
      status: cfaData.ResultStatus || 'NOT_FOUND',
      idcc,
      convention: conventionTitle,
      message: `IDCC ${idcc} trouvé mais OPCO non référencé dans CFADOCK`
    })

  } catch (err) {
    console.error('[detect-opco] Erreur:', err)
    return res.status(500).json({ error: 'Erreur détection OPCO: ' + err.message })
  }
}

// Fallback : essayer CFADOCK directement avec le SIRET
async function tryCfadockBySiret(siret, res) {
  try {
    console.log('[detect-opco] Fallback CFADOCK par SIRET:', siret)
    const resp = await fetch(`https://www.cfadock.fr/api/opcos?siret=${siret}`, {
      headers: { 'Accept': 'application/json' }
    })
    if (!resp.ok) {
      return res.status(200).json({
        opco_name: null,
        status: 'NOT_FOUND',
        message: 'SIRET non trouvé dans les bases IDCC et CFADOCK'
      })
    }
    const data = await resp.json()
    if (data.ResultStatus === 'OK' && data.OpcoName) {
      return res.status(200).json({
        opco_name: data.OpcoName,
        opco_siren: data.OpcoSiren || null,
        status: 'OK',
        idcc: data.Idcc || null,
        naf_code: data.FilterNAFCode || null,
        url: data.Url || null,
      })
    }
    return res.status(200).json({
      opco_name: null,
      status: data.ResultStatus || 'NOT_FOUND',
      message: 'OPCO non trouvé pour ce SIRET'
    })
  } catch (err) {
    return res.status(200).json({
      opco_name: null,
      status: 'ERROR',
      message: 'Erreur recherche: ' + err.message
    })
  }
}
