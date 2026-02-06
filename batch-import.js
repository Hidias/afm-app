/**
 * ============================================================================
 * RÉCUPÉRATION MASSIVE BRETAGNE + PAYS DE LA LOIRE
 * ============================================================================
 * 
 * Script autonome qui récupère automatiquement tous les prospects
 * de 9 départements et les insère dans la table prospection_massive
 * 
 * USAGE:
 *   node batch-import.js
 * 
 * DURÉE ESTIMÉE: 30-45 minutes
 * RÉSULTAT ATTENDU: 25 000 - 40 000 prospects
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js'

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Départements à récupérer
const DEPARTEMENTS = {
  bretagne: ['22', '29', '35', '56'],
  paysDeLaLoire: ['44', '49', '53', '72', '85']
}

// Tranches effectif ciblées (6 à 499 salariés)
const TRANCHES_EFFECTIF = [
  '03', // 6-9 salariés
  '11', // 10-19 salariés
  '12', // 20-49 salariés
  '21', // 50-99 salariés
  '22', // 100-199 salariés
  '31', // 200-249 salariés
  '32', // 250-499 salariés
]

// Formes juridiques acceptées (que des vraies entreprises)
const FORMES_JURIDIQUES = ['5498', '5499', '5505', '5510', '5546', '5547']
// 5498 = SARL
// 5499 = SAS
// 5505 = SA
// 5510 = SASU
// 5546 = EURL
// 5547 = SELURL

const API_BASE_URL = 'https://recherche-entreprises.api.gouv.fr/search'
const MAX_PAGES_PER_DEPT = 200 // 5000 résultats max par département

// ============================================================================
// CONFIGURATION DÉDOUBLONNAGE
// ============================================================================

// OPTION A : false = Garder tous les établissements (RECOMMANDÉ pour phoning)
//            → SUPER U Rennes, SUPER U Lorient, SUPER U Vannes = 3 prospects
// OPTION B : true = 1 seul par nom d'entreprise (évite doublons visuels)
//            → SUPER U = 1 prospect seulement
const DEDUPLICATE_BY_NAME = false // Change en true si tu veux dédoublonner

// ============================================================================
// UTILITAIRES
// ============================================================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function getEffectifLabel(code) {
  const labels = {
    '00': 'NN',
    '01': '1-2 salariés',
    '02': '3-5 salariés',
    '03': '6-9 salariés',
    '11': '10-19 salariés',
    '12': '20-49 salariés',
    '21': '50-99 salariés',
    '22': '100-199 salariés',
    '31': '200-249 salariés',
    '32': '250-499 salariés',
    '41': '500-999 salariés',
    '42': '1 000-1 999 salariés',
    '51': '2 000-4 999 salariés',
    '52': '5 000-9 999 salariés',
    '53': '10 000+ salariés',
  }
  return labels[code] || 'NN'
}

function calculateQualityScore(prospect) {
  let score = 50 // Base
  
  // Bonus effectif ciblé
  if (['12', '21', '22'].includes(prospect.effectif_code)) score += 20
  if (['03', '11', '31', '32'].includes(prospect.effectif_code)) score += 10
  
  // Bonus coordonnées GPS
  if (prospect.latitude && prospect.longitude) score += 10
  
  // Bonus site web
  if (prospect.site_web) score += 10
  
  // Bonus NAF intéressant (BTP, industrie, services)
  if (prospect.naf?.startsWith('41') || // Construction
      prospect.naf?.startsWith('42') || // Génie civil
      prospect.naf?.startsWith('43') || // Travaux spécialisés
      prospect.naf?.startsWith('10') || // Industries alimentaires
      prospect.naf?.startsWith('25') || // Métallurgie
      prospect.naf?.startsWith('62')) { // Programmation informatique
    score += 10
  }
  
  return Math.min(100, score)
}

// ============================================================================
// RÉCUPÉRATION API
// ============================================================================

async function fetchDepartement(dept) {
  console.log(`\n📍 DÉPARTEMENT ${dept}`)
  console.log('='.repeat(60))
  
  const allResults = []
  let page = 1
  
  while (page <= MAX_PAGES_PER_DEPT) {
    try {
      const params = new URLSearchParams({
        departement: dept,
        etat_administratif: 'A', // ✅ FILTRE ACTIF : Uniquement entreprises ACTIVES (pas fermées)
        per_page: '25',
        page: page.toString()
      })
      
      const url = `${API_BASE_URL}?${params}`
      const response = await fetch(url)
      
      if (!response.ok) {
        console.error(`❌ Erreur API page ${page}: ${response.status}`)
        break
      }
      
      const data = await response.json()
      
      if (!data.results || data.results.length === 0) {
        console.log(`✅ Fin pagination (page ${page - 1})`)
        break
      }
      
      allResults.push(...data.results)
      
      // Progress
      if (page % 10 === 0) {
        console.log(`   📦 Page ${page}/${MAX_PAGES_PER_DEPT} | ${allResults.length} résultats`)
      }
      
      page++
      
      // Rate limiting
      await sleep(200)
      
    } catch (error) {
      console.error(`❌ Erreur page ${page}:`, error.message)
      await sleep(5000) // Wait longer on error
      break
    }
  }
  
  console.log(`✅ Total récupéré: ${allResults.length} entreprises`)
  return allResults
}

// ============================================================================
// TRANSFORMATION ET FILTRAGE
// ============================================================================

function transformAndFilter(results, dept) {
  console.log(`\n🔄 Transformation et filtrage...`)
  
  const prospects = []
  
  for (const r of results) {
    // Filtrer formes juridiques
    if (!FORMES_JURIDIQUES.includes(r.nature_juridique)) {
      continue
    }
    
    // Filtrer effectif
    const effectifCode = r.tranche_effectif_salarie_entreprise || r.tranche_effectif_salarie
    if (!TRANCHES_EFFECTIF.includes(effectifCode)) {
      continue
    }
    
    // Exploser les établissements
    const etablissements = r.matching_etablissements || []
    
    if (etablissements.length > 0) {
      // Plusieurs établissements → créer 1 prospect par établissement
      for (const etab of etablissements) {
        prospects.push({
          siret: etab.siret,
          siren: r.siren,
          name: r.nom_complet || r.nom_raison_sociale,
          address: etab.adresse,
          postal_code: etab.code_postal,
          city: etab.libelle_commune,
          departement: dept,
          effectif: getEffectifLabel(effectifCode),
          effectif_code: effectifCode,
          forme_juridique: r.nature_juridique,
          naf: r.activite_principale,
          naf_label: r.libelle_activite_principale,
          date_creation: r.date_creation,
          latitude: etab.latitude || null,
          longitude: etab.longitude || null,
          site_web: etab.site_internet || r.siege?.site_internet || null,
        })
      }
    } else {
      // Pas d'établissements → utiliser le siège
      const siege = r.siege || {}
      prospects.push({
        siret: siege.siret || r.siret,
        siren: r.siren,
        name: r.nom_complet || r.nom_raison_sociale,
        address: siege.adresse || r.adresse,
        postal_code: siege.code_postal || r.code_postal,
        city: siege.libelle_commune || r.libelle_commune,
        departement: dept,
        effectif: getEffectifLabel(effectifCode),
        effectif_code: effectifCode,
        forme_juridique: r.nature_juridique,
        naf: r.activite_principale,
        naf_label: r.libelle_activite_principale,
        date_creation: r.date_creation,
        latitude: siege.latitude || r.latitude || null,
        longitude: siege.longitude || r.longitude || null,
        site_web: siege.site_internet || null,
      })
    }
  }
  
  console.log(`✅ ${prospects.length} prospects après filtrage`)
  
  // Dédoublonnage par nom si activé
  if (DEDUPLICATE_BY_NAME) {
    const seenNames = new Set()
    const uniqueProspects = []
    
    for (const prospect of prospects) {
      const normalizedName = prospect.name.toUpperCase().trim()
      
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName)
        uniqueProspects.push(prospect)
      }
    }
    
    console.log(`🔄 Dédoublonnage par nom activé`)
    console.log(`   Avant : ${prospects.length} prospects`)
    console.log(`   Après : ${uniqueProspects.length} prospects (-${prospects.length - uniqueProspects.length} doublons)`)
    
    return uniqueProspects
  }
  
  return prospects
}

// ============================================================================
// INSERTION DATABASE
// ============================================================================

async function insertProspects(prospects) {
  console.log(`\n💾 Insertion dans la base...`)
  
  // Calculer quality_score pour chaque prospect
  const prospectsWithScore = prospects.map(p => ({
    ...p,
    quality_score: calculateQualityScore(p)
  }))
  
  // Batch insert (1000 par batch pour éviter timeout)
  const BATCH_SIZE = 1000
  let inserted = 0
  let duplicates = 0
  
  for (let i = 0; i < prospectsWithScore.length; i += BATCH_SIZE) {
    const batch = prospectsWithScore.slice(i, i + BATCH_SIZE)
    
    try {
      const { data, error } = await supabase
        .from('prospection_massive')
        .upsert(batch, {
          onConflict: 'siret',
          ignoreDuplicates: false
        })
      
      if (error) {
        // Si erreur duplicate key, c'est OK
        if (error.code === '23505') {
          duplicates += batch.length
        } else {
          console.error(`❌ Erreur insertion batch ${i}:`, error)
        }
      } else {
        inserted += batch.length
      }
      
      if ((i + BATCH_SIZE) % 5000 === 0) {
        console.log(`   💾 ${i + BATCH_SIZE} / ${prospectsWithScore.length} prospects insérés`)
      }
      
    } catch (error) {
      console.error(`❌ Erreur batch ${i}:`, error.message)
    }
  }
  
  console.log(`✅ Insertion terminée: ${inserted} nouveaux, ${duplicates} doublons ignorés`)
  return { inserted, duplicates }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║                                                                        ║
║   🚀 RÉCUPÉRATION MASSIVE BRETAGNE + PAYS DE LA LOIRE                ║
║                                                                        ║
║   Départements : 9 (22, 29, 35, 56, 44, 49, 53, 72, 85)              ║
║   Effectif     : 6 - 499 salariés                                     ║
║   Formes       : SARL, SAS, SASU, SA, EURL                            ║
║                                                                        ║
║   Durée estimée : 30-45 minutes                                       ║
║   Résultat attendu : 25 000 - 40 000 prospects                       ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
`)
  
  const startTime = Date.now()
  const stats = {
    totalRecupere: 0,
    totalFiltre: 0,
    totalInsere: 0,
    totalDoublons: 0,
    byDept: {}
  }
  
  // Récupérer tous les départements
  const allDepts = [...DEPARTEMENTS.bretagne, ...DEPARTEMENTS.paysDeLaLoire]
  
  for (let i = 0; i < allDepts.length; i++) {
    const dept = allDepts[i]
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`DÉPARTEMENT ${i + 1}/${allDepts.length} : ${dept}`)
    console.log('='.repeat(60))
    
    try {
      // 1. Récupérer de l'API
      const results = await fetchDepartement(dept)
      stats.totalRecupere += results.length
      
      // 2. Transformer et filtrer
      const prospects = transformAndFilter(results, dept)
      stats.totalFiltre += prospects.length
      
      // 3. Insérer dans la base
      const { inserted, duplicates } = await insertProspects(prospects)
      stats.totalInsere += inserted
      stats.totalDoublons += duplicates
      
      stats.byDept[dept] = {
        recupere: results.length,
        filtre: prospects.length,
        insere: inserted,
        doublons: duplicates
      }
      
      console.log(`\n✅ DÉPARTEMENT ${dept} TERMINÉ`)
      console.log(`   📦 Récupéré: ${results.length}`)
      console.log(`   ✅ Filtré: ${prospects.length}`)
      console.log(`   💾 Inséré: ${inserted}`)
      console.log(`   ⚠️  Doublons: ${duplicates}`)
      
      // Détecter et marquer les multi-établissements
      console.log(`\n🔍 Détection des multi-établissements...`)
      try {
        const { error: funcError } = await supabase.rpc('update_multi_etablissements')
        if (funcError) {
          console.error(`   ⚠️  Erreur détection multi-établissements:`, funcError.message)
        } else {
          console.log(`   ✅ Multi-établissements détectés et marqués`)
        }
      } catch (error) {
        console.error(`   ⚠️  Erreur détection multi-établissements:`, error.message)
      }
      
      // Pause entre départements
      if (i < allDepts.length - 1) {
        console.log(`\n⏸️  Pause 10 secondes avant département suivant...`)
        await sleep(10000)
      }
      
    } catch (error) {
      console.error(`\n❌ ERREUR DÉPARTEMENT ${dept}:`, error)
      stats.byDept[dept] = { error: error.message }
    }
  }
  
  // ========================================================================
  // RAPPORT FINAL
  // ========================================================================
  
  const duration = Math.round((Date.now() - startTime) / 1000 / 60)
  
  console.log(`\n\n${'='.repeat(70)}`)
  console.log(`🎉 RÉCUPÉRATION MASSIVE TERMINÉE`)
  console.log('='.repeat(70))
  console.log(``)
  console.log(`⏱️  Durée totale : ${duration} minutes`)
  console.log(``)
  console.log(`📊 STATISTIQUES GLOBALES`)
  console.log(`   📦 Total récupéré API  : ${stats.totalRecupere.toLocaleString()}`)
  console.log(`   ✅ Total après filtres : ${stats.totalFiltre.toLocaleString()}`)
  console.log(`   💾 Total inséré        : ${stats.totalInsere.toLocaleString()}`)
  console.log(`   ⚠️  Total doublons      : ${stats.totalDoublons.toLocaleString()}`)
  console.log(``)
  console.log(`📍 PAR DÉPARTEMENT`)
  for (const [dept, data] of Object.entries(stats.byDept)) {
    if (data.error) {
      console.log(`   ${dept}: ❌ Erreur - ${data.error}`)
    } else {
      console.log(`   ${dept}: ${data.insere.toLocaleString()} prospects (${data.doublons} doublons)`)
    }
  }
  console.log(``)
  console.log(`🎯 PROCHAINE ÉTAPE`)
  console.log(`   Lancer le worker d'enrichissement:`)
  console.log(`   → node enrichment-worker.js`)
  console.log(``)
  console.log('='.repeat(70))
}

// ============================================================================
// LANCEMENT
// ============================================================================

main()
  .then(() => {
    console.log('\n✅ Script terminé avec succès !')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  })
