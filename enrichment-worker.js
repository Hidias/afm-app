/**
 * ============================================================================
 * WORKER ENRICHISSEMENT AUTOMATIQUE - CONTACTS (TÉLÉPHONE + EMAIL)
 * ============================================================================
 * 
 * Worker autonome qui enrichit progressivement les prospects
 * en cherchant téléphones et emails depuis plusieurs sources gratuites
 * 
 * SOURCES UTILISÉES (dans l'ordre):
 *   1. API Annuaire Entreprises (gratuit, instantané)
 *   2. Scraping site web entreprise (gratuit, 2-3 sec)
 *   3. Google Maps search (gratuit, 3-5 sec)
 *   4. Pages Jaunes search (gratuit, 5-7 sec)
 *   5. Societe.com (gratuit, 3-5 sec)
 * 
 * USAGE:
 *   node enrichment-worker.js
 * 
 * Le worker tourne en continu et s'arrête quand tous les prospects
 * sont traités ou après 3 tentatives échouées
 * 
 * TAUX DE SUCCÈS ATTENDU: 70-85%
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const CONFIG = {
  BATCH_SIZE: 10,              // Nombre de prospects traités en parallèle
  MAX_ATTEMPTS: 3,             // Nombre max de tentatives par prospect
  DELAY_BETWEEN_BATCHES: 5000, // 5 secondes entre chaque batch
  DELAY_BETWEEN_REQUESTS: 2000, // 2 secondes entre chaque requête
  DELAY_AFTER_ERROR: 30000,    // 30 secondes après une erreur
  
  // Anti-ban
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ]
}

// ============================================================================
// UTILITAIRES
// ============================================================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function getRandomUserAgent() {
  return CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)]
}

function cleanPhone(phone) {
  if (!phone) return null
  
  // Nettoyer et normaliser
  let cleaned = phone
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
  
  // Si commence par +33, remplacer par 0
  if (cleaned.startsWith('+33')) {
    cleaned = '0' + cleaned.substring(3)
  }
  
  // Si commence par 0033, remplacer par 0
  if (cleaned.startsWith('0033')) {
    cleaned = '0' + cleaned.substring(4)
  }
  
  // Vérifier format français valide (10 chiffres commençant par 0)
  if (/^0[1-9]\d{8}$/.test(cleaned)) {
    return cleaned
  }
  
  return null
}

function cleanEmail(email) {
  if (!email) return null
  
  // Nettoyer
  const cleaned = email.toLowerCase().trim()
  
  // Vérifier format basique
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    // Éviter les emails génériques inutiles
    if (cleaned.includes('noreply') || 
        cleaned.includes('no-reply') ||
        cleaned.includes('donotreply')) {
      return null
    }
    return cleaned
  }
  
  return null
}

// ============================================================================
// SOURCE 1 : API ANNUAIRE ENTREPRISES
// ============================================================================

async function enrichFromAPI(prospect) {
  try {
    const url = `https://recherche-entreprises.api.gouv.fr/search?siret=${prospect.siret}`
    const response = await fetch(url)
    
    if (!response.ok) return null
    
    const data = await response.json()
    if (!data.results || data.results.length === 0) return null
    
    const result = data.results[0]
    const contacts = {}
    
    // Téléphone depuis siège ou établissement
    const siege = result.siege || {}
    const phone = cleanPhone(siege.telephone || result.telephone)
    if (phone) contacts.phone = phone
    
    // Email depuis siège ou établissement
    const email = cleanEmail(siege.courriel || result.courriel)
    if (email) contacts.email = email
    
    // Site web
    if (siege.site_internet || result.site_internet) {
      contacts.site_web = siege.site_internet || result.site_internet
    }
    
    return Object.keys(contacts).length > 0 ? contacts : null
    
  } catch (error) {
    console.error(`   ❌ API error for ${prospect.siret}:`, error.message)
    return null
  }
}

// ============================================================================
// SOURCE 2 : SCRAPING SITE WEB
// ============================================================================

async function enrichFromWebsite(prospect) {
  if (!prospect.site_web) return null
  
  try {
    const url = prospect.site_web.startsWith('http') 
      ? prospect.site_web 
      : `https://${prospect.site_web}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent()
      },
      signal: AbortSignal.timeout(10000) // 10 sec timeout
    })
    
    if (!response.ok) return null
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    const contacts = {}
    
    // Chercher téléphones avec regex
    const phoneRegex = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g
    const phones = html.match(phoneRegex) || []
    
    for (const phone of phones) {
      const cleaned = cleanPhone(phone)
      if (cleaned) {
        contacts.phone = cleaned
        break // Prendre le premier valide
      }
    }
    
    // Chercher emails avec regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const emails = html.match(emailRegex) || []
    
    for (const email of emails) {
      const cleaned = cleanEmail(email)
      if (cleaned) {
        contacts.email = cleaned
        break // Prendre le premier valide
      }
    }
    
    // Chercher dans les liens mailto:
    $('a[href^="mailto:"]').each((i, elem) => {
      if (contacts.email) return false // Stop si déjà trouvé
      
      const mailto = $(elem).attr('href')
      const email = mailto?.replace('mailto:', '')
      const cleaned = cleanEmail(email)
      if (cleaned) {
        contacts.email = cleaned
        return false
      }
    })
    
    // Chercher dans les liens tel:
    $('a[href^="tel:"]').each((i, elem) => {
      if (contacts.phone) return false // Stop si déjà trouvé
      
      const tel = $(elem).attr('href')
      const phone = tel?.replace('tel:', '')
      const cleaned = cleanPhone(phone)
      if (cleaned) {
        contacts.phone = cleaned
        return false
      }
    })
    
    return Object.keys(contacts).length > 0 ? contacts : null
    
  } catch (error) {
    console.error(`   ❌ Website scraping error for ${prospect.site_web}:`, error.message)
    return null
  }
}

// ============================================================================
// SOURCE 3 : GOOGLE MAPS
// ============================================================================

async function enrichFromGoogleMaps(prospect) {
  try {
    // Recherche Google Maps via scraping Google Search
    const query = encodeURIComponent(`${prospect.name} ${prospect.city} téléphone`)
    const url = `https://www.google.com/search?q=${query}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent()
      },
      signal: AbortSignal.timeout(10000)
    })
    
    if (!response.ok) return null
    
    const html = await response.text()
    const contacts = {}
    
    // Chercher téléphone dans les résultats
    const phoneRegex = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g
    const phones = html.match(phoneRegex) || []
    
    for (const phone of phones) {
      const cleaned = cleanPhone(phone)
      if (cleaned) {
        contacts.phone = cleaned
        break
      }
    }
    
    return Object.keys(contacts).length > 0 ? contacts : null
    
  } catch (error) {
    console.error(`   ❌ Google Maps error for ${prospect.name}:`, error.message)
    return null
  }
}

// ============================================================================
// SOURCE 4 : PAGES JAUNES
// ============================================================================

async function enrichFromPagesJaunes(prospect) {
  try {
    const query = encodeURIComponent(`${prospect.name} ${prospect.city}`)
    const url = `https://www.pagesjaunes.fr/pros?quoiqui=${query}&ou=${prospect.city}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent()
      },
      signal: AbortSignal.timeout(10000)
    })
    
    if (!response.ok) return null
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    const contacts = {}
    
    // Chercher téléphone
    $('.numero-telephone').each((i, elem) => {
      if (contacts.phone) return false
      
      const phone = $(elem).text()
      const cleaned = cleanPhone(phone)
      if (cleaned) {
        contacts.phone = cleaned
        return false
      }
    })
    
    // Chercher site web si manquant
    if (!prospect.site_web) {
      $('a.btn-voir-site-internet').each((i, elem) => {
        if (contacts.site_web) return false
        
        const href = $(elem).attr('href')
        if (href && !href.includes('pagesjaunes.fr')) {
          contacts.site_web = href
          return false
        }
      })
    }
    
    return Object.keys(contacts).length > 0 ? contacts : null
    
  } catch (error) {
    console.error(`   ❌ Pages Jaunes error for ${prospect.name}:`, error.message)
    return null
  }
}

// ============================================================================
// SOURCE 5 : SOCIETE.COM
// ============================================================================

async function enrichFromSociete(prospect) {
  try {
    const url = `https://www.societe.com/societe/${prospect.siren}.html`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent()
      },
      signal: AbortSignal.timeout(10000)
    })
    
    if (!response.ok) return null
    
    const html = await response.text()
    const contacts = {}
    
    // Chercher téléphone avec regex
    const phoneRegex = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g
    const phones = html.match(phoneRegex) || []
    
    for (const phone of phones) {
      const cleaned = cleanPhone(phone)
      if (cleaned) {
        contacts.phone = cleaned
        break
      }
    }
    
    return Object.keys(contacts).length > 0 ? contacts : null
    
  } catch (error) {
    console.error(`   ❌ Societe.com error for ${prospect.siren}:`, error.message)
    return null
  }
}

// ============================================================================
// ENRICHISSEMENT COMPLET
// ============================================================================

async function enrichProspect(prospect) {
  console.log(`\n   🔍 ${prospect.name} (${prospect.city})`)
  
  const contacts = {
    phone: prospect.phone,
    email: prospect.email,
    site_web: prospect.site_web
  }
  
  const sources = []
  
  try {
    // Source 1 : API (rapide, toujours essayer)
    if (!contacts.phone || !contacts.email) {
      const apiContacts = await enrichFromAPI(prospect)
      if (apiContacts) {
        if (apiContacts.phone) contacts.phone = apiContacts.phone
        if (apiContacts.email) contacts.email = apiContacts.email
        if (apiContacts.site_web) contacts.site_web = apiContacts.site_web
        sources.push('api')
        console.log(`      ✅ API: ${apiContacts.phone ? '📞' : ''} ${apiContacts.email ? '📧' : ''}`)
      }
      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
    }
    
    // Source 2 : Site web (si disponible et contacts manquants)
    if ((!contacts.phone || !contacts.email) && contacts.site_web) {
      const webContacts = await enrichFromWebsite(prospect)
      if (webContacts) {
        if (webContacts.phone && !contacts.phone) contacts.phone = webContacts.phone
        if (webContacts.email && !contacts.email) contacts.email = webContacts.email
        sources.push('website')
        console.log(`      ✅ Website: ${webContacts.phone ? '📞' : ''} ${webContacts.email ? '📧' : ''}`)
      }
      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
    }
    
    // Source 3 : Google Maps (si téléphone manquant)
    if (!contacts.phone) {
      const gmapsContacts = await enrichFromGoogleMaps(prospect)
      if (gmapsContacts) {
        if (gmapsContacts.phone) contacts.phone = gmapsContacts.phone
        sources.push('gmaps')
        console.log(`      ✅ Google Maps: 📞`)
      }
      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
    }
    
    // Source 4 : Pages Jaunes (si contacts manquants)
    if (!contacts.phone || !contacts.email) {
      const pjContacts = await enrichFromPagesJaunes(prospect)
      if (pjContacts) {
        if (pjContacts.phone && !contacts.phone) contacts.phone = pjContacts.phone
        if (pjContacts.site_web && !contacts.site_web) contacts.site_web = pjContacts.site_web
        sources.push('pagesjaunes')
        console.log(`      ✅ Pages Jaunes: ${pjContacts.phone ? '📞' : ''}`)
      }
      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
    }
    
    // Source 5 : Societe.com (dernière chance pour téléphone)
    if (!contacts.phone) {
      const societeContacts = await enrichFromSociete(prospect)
      if (societeContacts) {
        if (societeContacts.phone) contacts.phone = societeContacts.phone
        sources.push('societe')
        console.log(`      ✅ Societe.com: 📞`)
      }
      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS)
    }
    
    // Déterminer statut final
    const hasNewContacts = (
      (contacts.phone && contacts.phone !== prospect.phone) ||
      (contacts.email && contacts.email !== prospect.email) ||
      (contacts.site_web && contacts.site_web !== prospect.site_web)
    )
    
    const status = hasNewContacts || sources.length > 0 ? 'done' : 'failed'
    
    // Update database
    await supabase
      .from('prospection_massive')
      .update({
        phone: contacts.phone,
        email: contacts.email,
        site_web: contacts.site_web,
        enrichment_status: status,
        enrichment_attempts: prospect.enrichment_attempts + 1,
        enrichment_sources: sources,
        last_enrichment_at: new Date().toISOString()
      })
      .eq('id', prospect.id)
    
    const result = {
      siret: prospect.siret,
      name: prospect.name,
      phone: contacts.phone,
      email: contacts.email,
      site_web: contacts.site_web,
      sources,
      status
    }
    
    if (contacts.phone || contacts.email) {
      console.log(`      ✅ ENRICHI: ${contacts.phone ? '📞 ' + contacts.phone : ''} ${contacts.email ? '📧 ' + contacts.email : ''}`)
    } else {
      console.log(`      ❌ Aucun contact trouvé`)
    }
    
    return result
    
  } catch (error) {
    console.error(`      ❌ Erreur enrichissement:`, error.message)
    
    // Marquer comme failed après 3 tentatives
    if (prospect.enrichment_attempts + 1 >= CONFIG.MAX_ATTEMPTS) {
      await supabase
        .from('prospection_massive')
        .update({
          enrichment_status: 'failed',
          enrichment_attempts: prospect.enrichment_attempts + 1,
          last_enrichment_at: new Date().toISOString()
        })
        .eq('id', prospect.id)
    }
    
    return null
  }
}

// ============================================================================
// WORKER PRINCIPAL
// ============================================================================

async function getProspectsToEnrich() {
  const { data, error } = await supabase
    .from('prospection_massive')
    .select('*')
    .eq('enrichment_status', 'pending')
    .lt('enrichment_attempts', CONFIG.MAX_ATTEMPTS)
    .order('quality_score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(CONFIG.BATCH_SIZE)
  
  if (error) {
    console.error('❌ Erreur récupération prospects:', error)
    return []
  }
  
  return data || []
}

async function getStats() {
  const { data, error } = await supabase
    .from('prospection_massive')
    .select('enrichment_status, phone, email')
  
  if (error) {
    console.error('❌ Erreur stats:', error)
    return null
  }
  
  const total = data.length
  const enriched = data.filter(p => p.enrichment_status === 'done').length
  const pending = data.filter(p => p.enrichment_status === 'pending').length
  const failed = data.filter(p => p.enrichment_status === 'failed').length
  const withPhone = data.filter(p => p.phone).length
  const withEmail = data.filter(p => p.email).length
  const withBoth = data.filter(p => p.phone && p.email).length
  
  return {
    total,
    enriched,
    pending,
    failed,
    withPhone,
    withEmail,
    withBoth,
    percentEnriched: Math.round((enriched / total) * 100),
    percentPhone: Math.round((withPhone / total) * 100),
    percentEmail: Math.round((withEmail / total) * 100),
    percentBoth: Math.round((withBoth / total) * 100)
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║                                                                        ║
║   🤖 WORKER ENRICHISSEMENT AUTOMATIQUE                                ║
║                                                                        ║
║   Sources : API + Site web + Google Maps + Pages Jaunes + Societe.com║
║   Objectif : Téléphones + Emails                                      ║
║   Mode : Continu jusqu'à épuisement                                   ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
`)
  
  const startTime = Date.now()
  let batchCount = 0
  let totalEnriched = 0
  
  while (true) {
    // Récupérer batch de prospects à enrichir
    const prospects = await getProspectsToEnrich()
    
    if (prospects.length === 0) {
      console.log('\n✅ Plus de prospects à enrichir !')
      break
    }
    
    batchCount++
    
    console.log(`\n${'='.repeat(70)}`)
    console.log(`📦 BATCH ${batchCount} - ${prospects.length} prospects`)
    console.log('='.repeat(70))
    
    // Marquer comme "enriching"
    await supabase
      .from('prospection_massive')
      .update({ enrichment_status: 'enriching' })
      .in('id', prospects.map(p => p.id))
    
    // Enrichir en séquence (pas parallèle pour éviter ban)
    for (const prospect of prospects) {
      const result = await enrichProspect(prospect)
      if (result && (result.phone || result.email)) {
        totalEnriched++
      }
    }
    
    // Stats après batch
    const stats = await getStats()
    if (stats) {
      console.log(`\n📊 STATISTIQUES GLOBALES`)
      console.log(`   Total prospects    : ${stats.total.toLocaleString()}`)
      console.log(`   ✅ Enrichis         : ${stats.enriched.toLocaleString()} (${stats.percentEnriched}%)`)
      console.log(`   ⏳ En attente       : ${stats.pending.toLocaleString()}`)
      console.log(`   ❌ Échecs           : ${stats.failed.toLocaleString()}`)
      console.log(``)
      console.log(`   📞 Avec téléphone   : ${stats.withPhone.toLocaleString()} (${stats.percentPhone}%)`)
      console.log(`   📧 Avec email       : ${stats.withEmail.toLocaleString()} (${stats.percentEmail}%)`)
      console.log(`   ✅ Avec les deux    : ${stats.withBoth.toLocaleString()} (${stats.percentBoth}%)`)
    }
    
    // Pause entre batches
    if (prospects.length === CONFIG.BATCH_SIZE) {
      console.log(`\n⏸️  Pause ${CONFIG.DELAY_BETWEEN_BATCHES / 1000} secondes avant batch suivant...`)
      await sleep(CONFIG.DELAY_BETWEEN_BATCHES)
    }
  }
  
  // Rapport final
  const duration = Math.round((Date.now() - startTime) / 1000 / 60)
  const stats = await getStats()
  
  console.log(`\n\n${'='.repeat(70)}`)
  console.log(`🎉 ENRICHISSEMENT TERMINÉ`)
  console.log('='.repeat(70))
  console.log(``)
  console.log(`⏱️  Durée totale : ${duration} minutes`)
  console.log(`📦 Batches traités : ${batchCount}`)
  console.log(`✅ Prospects enrichis : ${totalEnriched}`)
  console.log(``)
  if (stats) {
    console.log(`📊 RÉSULTAT FINAL`)
    console.log(`   Total prospects    : ${stats.total.toLocaleString()}`)
    console.log(`   📞 Avec téléphone   : ${stats.withPhone.toLocaleString()} (${stats.percentPhone}%)`)
    console.log(`   📧 Avec email       : ${stats.withEmail.toLocaleString()} (${stats.percentEmail}%)`)
    console.log(`   ✅ Avec les deux    : ${stats.withBoth.toLocaleString()} (${stats.percentBoth}%)`)
  }
  console.log(``)
  console.log('='.repeat(70))
}

// ============================================================================
// LANCEMENT
// ============================================================================

main()
  .then(() => {
    console.log('\n✅ Worker terminé avec succès !')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  })
