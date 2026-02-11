/**
 * ============================================================================
 * API - LA BONNE BOÎTE (France Travail) — Signal recrutement
 * ============================================================================
 * 
 * À METTRE : afm-app-main/api/bonne-boite.js
 * 
 * Interroge l'API La Bonne Boîte pour trouver les entreprises qui recrutent
 * autour d'une position géographique, puis croise avec notre base.
 * 
 * ENV REQUISES dans Vercel :
 *   FT_CLIENT_ID     = client_id du compte francetravail.io
 *   FT_CLIENT_SECRET  = client_secret du compte francetravail.io
 * 
 * Coût : 100% GRATUIT
 * Rate limit : raisonnable (pas documenté précisément, ~100 req/min)
 * ============================================================================
 */

export const config = { maxDuration: 25 }

// Codes ROME pertinents pour Access Formation
// BTP, Industrie, Logistique, Maintenance → besoins SST/CACES/Incendie/Elec
const ROME_CODES_BY_SECTOR = {
  btp: ['F1701', 'F1702', 'F1703', 'F1704', 'F1301', 'F1302', 'F1601', 'F1602', 'F1603', 'F1606', 'F1607', 'F1608', 'F1609', 'F1610', 'F1611'],
  industrie: ['H2901', 'H2902', 'H2903', 'H2906', 'H2909', 'H2910', 'H2912', 'H2913', 'H2914', 'H3101', 'H3102', 'H3201', 'H3202', 'H3203', 'H3301', 'H3302', 'H3303'],
  logistique: ['N1101', 'N1103', 'N1104', 'N1105', 'N1201', 'N1202', 'N1301', 'N1302', 'N1303'],
  maintenance: ['I1301', 'I1302', 'I1303', 'I1304', 'I1305', 'I1306', 'I1307', 'I1308', 'I1309', 'I1310'],
}

async function getAccessToken() {
  const resp = await fetch(
    'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.FT_CLIENT_ID,
        client_secret: process.env.FT_CLIENT_SECRET,
        scope: 'api_labonneboitev1',
      }),
    }
  )
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Auth France Travail failed: ${resp.status} ${text}`)
  }
  const data = await resp.json()
  return data.access_token
}

async function queryBonneBoite(token, latitude, longitude, romeCodes, distance = 30) {
  const results = []
  
  // On requête par lot de 3 codes ROME max pour rester performant
  for (let i = 0; i < romeCodes.length; i += 3) {
    const batch = romeCodes.slice(i, i + 3).join(',')
    try {
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        rome_codes: batch,
        distance: distance.toString(),
        page_size: '100',
      })
      
      const resp = await fetch(
        `https://api.francetravail.io/partenaire/labonneboite/v1/company/?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      if (!resp.ok) continue
      
      const data = await resp.json()
      if (data.companies) {
        results.push(...data.companies)
      }
    } catch (err) {
      console.error(`Erreur Bonne Boîte batch ${batch}:`, err.message)
    }
  }
  
  // Dédupliquer par SIRET
  const seen = new Set()
  return results.filter(r => {
    if (!r.siret || seen.has(r.siret)) return false
    seen.add(r.siret)
    return true
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  
  const { latitude, longitude, distance, sectors } = req.body
  
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'latitude et longitude requis' })
  }
  
  // Sélectionner les codes ROME selon les secteurs demandés (ou tous)
  const selectedSectors = sectors || Object.keys(ROME_CODES_BY_SECTOR)
  const romeCodes = selectedSectors.flatMap(s => ROME_CODES_BY_SECTOR[s] || [])
  
  if (romeCodes.length === 0) {
    return res.status(400).json({ error: 'Aucun code ROME pour ces secteurs' })
  }
  
  try {
    const token = await getAccessToken()
    const companies = await queryBonneBoite(token, latitude, longitude, romeCodes, distance || 50)
    
    // Transformer en format simplifié avec score
    const enriched = companies.map(c => ({
      siret: c.siret,
      name: c.name,
      naf: c.naf,
      naf_text: c.naf_text,
      city: c.city,
      lat: c.lat,
      lon: c.lon,
      headcount_text: c.headcount_text,
      distance: c.distance,
      // Score brut Bonne Boîte (basé sur la position dans les résultats)
      // Plus l'entreprise est haut dans la liste, plus elle recrute
      recrute_score: Math.min(100, Math.round(c.score ? c.score * 100 : 50)),
    }))
    
    return res.status(200).json({
      count: enriched.length,
      companies: enriched,
      sectors_queried: selectedSectors,
      rome_codes_count: romeCodes.length,
    })
    
  } catch (err) {
    console.error('Erreur Bonne Boîte:', err)
    return res.status(500).json({ error: err.message })
  }
}
