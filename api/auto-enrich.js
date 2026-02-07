/**
 * ============================================================================
 * API - AUTO-ENRICHISSEMENT PROSPECT v2
 * ============================================================================
 * 
 * À METTRE : afm-app-main/api/auto-enrich.js
 * 
 * v1 échouait car Pages Jaunes et Google bloquent les IP datacenter (Vercel).
 * v2 utilise :
 *   1. DuckDuckGo HTML (ne bloque pas les serveurs) → téléphone + site web
 *   2. Bing Search (fallback) → téléphone + site web
 *   3. Scraping direct du site web → email + téléphone
 * 
 * 100% gratuit, aucune API payante
 * ============================================================================
 */

// ---- DUCKDUCKGO SEARCH ----

async function searchDuckDuckGo(name, city) {
  try {
    const query = `${name} ${city} téléphone`
    const url = `https://html.duckduckgo.com/html/`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `q=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(10000),
    })
    
    if (!response.ok) {
      console.log('DDG status:', response.status)
      return { phone: null, site_web: null }
    }
    
    const html = await response.text()
    console.log('DDG response length:', html.length)
    
    return extractFromSearchResults(html)
  } catch (error) {
    console.error('DuckDuckGo failed:', error.message)
    return { phone: null, site_web: null }
  }
}


// ---- BING SEARCH (fallback) ----

async function searchBing(name, city) {
  try {
    const query = encodeURIComponent(`${name} ${city} téléphone`)
    const url = `https://www.bing.com/search?q=${query}&setlang=fr`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })
    
    if (!response.ok) {
      console.log('Bing status:', response.status)
      return { phone: null, site_web: null }
    }
    
    const html = await response.text()
    console.log('Bing response length:', html.length)
    
    return extractFromSearchResults(html)
  } catch (error) {
    console.error('Bing failed:', error.message)
    return { phone: null, site_web: null }
  }
}


// ---- EXTRACTION DEPUIS RÉSULTATS DE RECHERCHE ----

function extractFromSearchResults(html) {
  let phone = null
  let site_web = null
  
  // Extraction téléphone - numéros français
  const phoneRegex = /(?:(?:\+33|0033)[\s.]?|0)[1-9](?:[\s.]?\d{2}){4}/g
  const phoneMatches = html.match(phoneRegex) || []
  
  for (const raw of phoneMatches) {
    const cleaned = cleanPhone(raw)
    if (cleaned) {
      phone = cleaned
      break
    }
  }
  
  // Extraction site web - URLs hors annuaires
  const urlRegex = /https?:\/\/(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.(?:fr|com|net|org|eu|io|bzh|asso\.fr|gouv\.fr))\b[^\s"'<>]*/gi
  const urlMatches = html.match(urlRegex) || []
  
  const excludedDomains = [
    'google', 'bing', 'duckduckgo', 'yahoo', 'qwant',
    'pagesjaunes', 'societe.com', 'infogreffe', 'pappers', 
    'verif.com', 'manageo', 'annuaire', 'kompass',
    'linkedin', 'facebook', 'youtube', 'twitter', 'instagram', 
    'wikipedia', 'tiktok', 'pinterest',
    'tripadvisor', 'indeed', 'glassdoor',
    'apple.com', 'microsoft.com', 'amazon',
    'w3.org', 'schema.org', 'cloudflare',
    'bing.com', 'duckduckgo.com',
  ]
  
  for (const url of urlMatches) {
    try {
      const domain = new URL(url).hostname.toLowerCase().replace('www.', '')
      if (!excludedDomains.some(ex => domain.includes(ex)) && domain.length > 3) {
        site_web = `https://${domain}`
        break
      }
    } catch {
      continue
    }
  }
  
  return { phone, site_web }
}


// ---- NETTOYAGE TÉLÉPHONE ----

function cleanPhone(raw) {
  if (!raw) return null
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+33')) digits = '0' + digits.slice(3)
  if (digits.startsWith('0033')) digits = '0' + digits.slice(4)
  if (digits.startsWith('33') && digits.length === 11) digits = '0' + digits.slice(2)
  
  if (/^0[1-9]\d{8}$/.test(digits)) {
    // Exclure numéros surtaxés
    if (digits.startsWith('08') && !digits.startsWith('080')) return null
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
  }
  return null
}


// ---- SCRAPING SITE WEB POUR EMAIL + TÉLÉPHONE ----

async function scrapeWebsite(siteUrl) {
  if (!siteUrl) return { email: null, phone: null }
  
  let baseUrl = siteUrl
  if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl
  baseUrl = baseUrl.replace(/\/+$/, '')
  
  const pagesToCheck = [
    baseUrl,
    baseUrl + '/contact',
    baseUrl + '/contactez-nous',
    baseUrl + '/nous-contacter',
    baseUrl + '/mentions-legales',
    baseUrl + '/a-propos',
  ]
  
  const emails = new Set()
  const phones = []
  
  for (const pageUrl of pagesToCheck) {
    try {
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(6000),
      })
      
      if (!response.ok) continue
      
      const html = await response.text()
      
      // Emails
      const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
      for (const em of emailMatches) {
        if (isValidBusinessEmail(em.toLowerCase())) emails.add(em.toLowerCase())
      }
      
      // mailto: links
      const mailtoMatches = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi) || []
      for (const m of mailtoMatches) {
        const em = m.replace('mailto:', '').toLowerCase()
        if (isValidBusinessEmail(em)) emails.add(em)
      }
      
      // Téléphones
      const phoneMatches = html.match(/(?:(?:\+33|0033)[\s.]?|0)[1-9](?:[\s.]?\d{2}){4}/g) || []
      for (const raw of phoneMatches) {
        const cleaned = cleanPhone(raw)
        if (cleaned && !phones.includes(cleaned)) phones.push(cleaned)
      }
      
      // Si on a email + tel, on peut s'arrêter
      if (emails.size > 0 && phones.length > 0) break
      
    } catch {
      continue
    }
  }
  
  // Prioriser les emails contact, info, etc.
  let bestEmail = null
  if (emails.size > 0) {
    const list = [...emails]
    const priority = ['contact', 'info', 'accueil', 'commercial', 'direction', 'rh', 'formation']
    list.sort((a, b) => {
      const ap = priority.findIndex(p => a.split('@')[0].includes(p))
      const bp = priority.findIndex(p => b.split('@')[0].includes(p))
      if (ap !== -1 && bp === -1) return -1
      if (ap === -1 && bp !== -1) return 1
      if (ap !== -1 && bp !== -1) return ap - bp
      return 0
    })
    bestEmail = list[0]
  }
  
  return { email: bestEmail, phone: phones[0] || null }
}

function isValidBusinessEmail(email) {
  const excludedPrefixes = [
    'noreply', 'no-reply', 'no_reply', 'webmaster', 'admin', 'postmaster',
    'mailer-daemon', 'root', 'bounce', 'unsubscribe', 'newsletter',
    'notification', 'example', 'test', 'demo', 'null', 'privacy',
    'abuse', 'hostmaster', 'support@wordpress', 'support@wix',
  ]
  const excludedDomains = [
    'example.com', 'test.com', 'wordpress.com', 'wix.com',
    'squarespace.com', 'google.com', 'gmail.com', 'yahoo.com',
    'hotmail.com', 'outlook.com', 'sentry.io', 'github.com',
    'gravatar.com', 'w3.org', 'schema.org', 'jquery.com',
    'cloudflare.com', 'gstatic.com', 'googleapis.com',
    'facebook.com', 'twitter.com', 'instagram.com',
    'youtube.com', 'linkedin.com', 'recaptcha.net',
  ]
  
  const prefix = email.split('@')[0]
  const domain = email.split('@')[1]
  if (!domain) return false
  if (excludedPrefixes.some(ex => prefix.startsWith(ex))) return false
  if (excludedDomains.some(ex => domain === ex || domain.endsWith('.' + ex))) return false
  if (email.includes('..') || email.startsWith('.') || prefix.length > 50) return false
  if (domain.length < 4) return false
  return true
}


// ---- HANDLER ----

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  const { name, city, postal_code, siren, site_web: existingSiteWeb } = req.body
  if (!name) return res.status(400).json({ error: 'name requis' })
  
  const result = { phone: null, site_web: null, email: null, sources: [], debug: {} }
  const cityOrPostal = city || postal_code || ''
  
  try {
    console.log(`\n=== Auto-enrich: "${name}" (${cityOrPostal}) ===`)
    
    // Étape 1 : DuckDuckGo
    console.log('Step 1: DuckDuckGo...')
    const ddg = await searchDuckDuckGo(name, cityOrPostal)
    result.debug.ddg = ddg
    if (ddg.phone) { result.phone = ddg.phone; result.sources.push('DuckDuckGo') }
    if (ddg.site_web) { result.site_web = ddg.site_web; result.sources.push('DuckDuckGo') }
    
    // Étape 2 : Bing (fallback)
    if (!result.phone || !result.site_web) {
      console.log('Step 2: Bing...')
      const bing = await searchBing(name, cityOrPostal)
      result.debug.bing = bing
      if (!result.phone && bing.phone) { result.phone = bing.phone; result.sources.push('Bing') }
      if (!result.site_web && bing.site_web) { result.site_web = bing.site_web; result.sources.push('Bing') }
    }
    
    // Étape 3 : Scraping du site web
    const siteToScrape = result.site_web || existingSiteWeb
    if (siteToScrape) {
      console.log('Step 3: Scraping', siteToScrape)
      const site = await scrapeWebsite(siteToScrape)
      result.debug.site = site
      if (site.email) { result.email = site.email; result.sources.push('Site web') }
      if (!result.phone && site.phone) { result.phone = site.phone; result.sources.push('Site web') }
    }
    
    console.log(`=== Result: phone=${result.phone}, site=${result.site_web}, email=${result.email} ===\n`)
    
    return res.status(200).json({
      success: true,
      phone: result.phone,
      site_web: result.site_web,
      email: result.email,
      sources: [...new Set(result.sources)],
      debug: result.debug,
    })
    
  } catch (error) {
    console.error('Auto-enrich error:', error)
    return res.status(200).json({
      success: true, ...result, warning: error.message,
    })
  }
}
