/**
 * ============================================================================
 * API ENDPOINT - IMPORT UN DÉPARTEMENT
 * ============================================================================
 * 
 * À METTRE : afm-app-main/api/import-departement.js
 * 
 * Cet endpoint importe les prospects d'UN SEUL département
 * Peut être appelé 9 fois (1 fois par département)
 * Durée : 3-5 minutes par département
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const TRANCHES_EFFECTIF = ['03', '11', '12', '21', '22', '31', '32']
const FORMES_JURIDIQUES = ['5498', '5499', '5505', '5510', '5546', '5547']
const API_BASE_URL = 'https://recherche-entreprises.api.gouv.fr/search'
const MAX_PAGES = 200

function getEffectifLabel(code) {
  const labels = {
    '03': '6-9 salariés',
    '11': '10-19 salariés',
    '12': '20-49 salariés',
    '21': '50-99 salariés',
    '22': '100-199 salariés',
    '31': '200-249 salariés',
    '32': '250-499 salariés',
  }
  return labels[code] || 'NN'
}

function calculateQualityScore(prospect) {
  let score = 50
  if (['12', '21', '22'].includes(prospect.effectif)) score += 20
  if (['03', '11', '31', '32'].includes(prospect.effectif)) score += 10
  if (prospect.latitude && prospect.longitude) score += 10
  if (prospect.site_web) score += 10
  if (prospect.naf?.startsWith('41') || prospect.naf?.startsWith('42') || 
      prospect.naf?.startsWith('43') || prospect.naf?.startsWith('10') || 
      prospect.naf?.startsWith('25') || prospect.naf?.startsWith('62')) {
    score += 10
  }
  return Math.min(100, score)
}

async function fetchDepartement(dept) {
  const allResults = []
  let page = 1
  
  while (page <= MAX_PAGES) {
    try {
      const params = new URLSearchParams({
        departement: dept,
        etat_administratif: 'A',
        per_page: '25',
        page: page.toString()
      })
      
      const response = await fetch(`${API_BASE_URL}?${params}`)
      
      if (!response.ok) break
      
      const data = await response.json()
      
      if (!data.results || data.results.length === 0) break
      
      allResults.push(...data.results)
      page++
      
      await new Promise(resolve => setTimeout(resolve, 200))
      
    } catch (error) {
      console.error(`Erreur page ${page}:`, error)
      break
    }
  }
  
  return allResults
}

function transformAndFilter(results, dept) {
  const prospects = []
  
  for (const r of results) {
    if (!FORMES_JURIDIQUES.includes(r.nature_juridique)) continue
    
    const effectifCode = r.tranche_effectif_salarie_entreprise || r.tranche_effectif_salarie
    if (!TRANCHES_EFFECTIF.includes(effectifCode)) continue
    
    const etablissements = r.matching_etablissements || []
    
    if (etablissements.length > 0) {
      for (const etab of etablissements) {
        prospects.push({
          siret: etab.siret,
          siren: r.siren,
          name: r.nom_complet || r.nom_raison_sociale,
          address: etab.adresse,
          postal_code: etab.code_postal,
          city: etab.libelle_commune,
          departement: dept,
          effectif: effectifCode,
          effectif_label: getEffectifLabel(effectifCode),
          forme_juridique: r.nature_juridique,
          naf: r.activite_principale,
          latitude: etab.latitude || null,
          longitude: etab.longitude || null,
          site_web: etab.site_internet || r.siege?.site_internet || null,
          phone: etab.telephone || null,
          email: etab.courriel || null,
        })
      }
    } else {
      const siege = r.siege || {}
      prospects.push({
        siret: siege.siret || r.siret,
        siren: r.siren,
        name: r.nom_complet || r.nom_raison_sociale,
        address: siege.adresse || r.adresse,
        postal_code: siege.code_postal || r.code_postal,
        city: siege.libelle_commune || r.libelle_commune,
        departement: dept,
        effectif: effectifCode,
        effectif_label: getEffectifLabel(effectifCode),
        forme_juridique: r.nature_juridique,
        naf: r.activite_principale,
        latitude: siege.latitude || r.latitude || null,
        longitude: siege.longitude || r.longitude || null,
        site_web: siege.site_internet || null,
        phone: siege.telephone || null,
        email: siege.courriel || null,
      })
    }
  }
  
  return prospects
}

async function insertProspects(supabase, prospects) {
  const prospectsWithScore = prospects.map(p => ({
    ...p,
    quality_score: calculateQualityScore(p)
  }))
  
  const BATCH_SIZE = 1000
  let inserted = 0
  let duplicates = 0
  
  for (let i = 0; i < prospectsWithScore.length; i += BATCH_SIZE) {
    const batch = prospectsWithScore.slice(i, i + BATCH_SIZE)
    
    try {
      const { error } = await supabase
        .from('prospection_massive')
        .upsert(batch, { onConflict: 'siret', ignoreDuplicates: true })
      
      if (error) {
        if (error.code === '23505') {
          duplicates += batch.length
        }
      } else {
        inserted += batch.length
      }
    } catch (error) {
      console.error('Erreur insertion:', error)
    }
  }
  
  return { inserted, duplicates }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { departement } = req.body
  
  if (!departement) {
    return res.status(400).json({ error: 'departement requis' })
  }
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // 1. Récupération
    const results = await fetchDepartement(departement)
    
    // 2. Transformation
    const prospects = transformAndFilter(results, departement)
    
    // 3. Insertion
    const { inserted, duplicates } = await insertProspects(supabase, prospects)
    
    // 4. Détection multi-établissements
    await supabase.rpc('update_multi_etablissements')
    
    return res.status(200).json({
      success: true,
      departement,
      recupere: results.length,
      filtre: prospects.length,
      insere: inserted,
      doublons: duplicates
    })
    
  } catch (error) {
    console.error('Erreur:', error)
    return res.status(500).json({ 
      error: error.message,
      departement 
    })
  }
}
