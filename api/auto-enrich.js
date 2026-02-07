/**
 * ============================================================================
 * API - AUTO-ENRICHISSEMENT PROSPECT
 * ============================================================================
 * 
 * À METTRE : afm-app-main/api/auto-enrich.js
 * 
 * Scrape Pages Jaunes + site web pour trouver téléphone, site web, email
 * 100% gratuit, aucune API payante
 * 
 * Usage: POST /api/auto-enrich
 * Body: { name: "Kera Sport", city: "Quimper", postal_code: "29000" }
 * Returns: { phone, site_web, email, source }
 * ============================================================================
 */

// ---- PAGES JAUNES ----

async function searchPagesJaunes(name, city) {
  try {
    const query = encodeURIComponent(name)
    const location = encodeURIComponent(city)
    const url = `https://www.pagesjaunes.fr/pagesblanches/recherche?quoiqui=${query}&ou=${location}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })
    
    if (!response.ok) {
      return await searchPagesJaunesPro(name, city)
    }
    
    const html = await response.text()
    return extractFromPagesJaunes(html)
  } catch (error) {
    console.log('Pages Blanches failed, trying Pages Jaunes Pro:', error.message)
    return await searchPagesJaunesPro(name, city)
  }
}

async function searchPagesJaunesPro(name, city) {
  try {
    const query = encodeURIComponent(name)
    const location = encodeURIComponent(city)
    const url = `https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${query}&ou=${location}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })
    
    if (!response.ok) return { phone: null, site_web: null }
    
    const html = await response.text()
    return extractFromPagesJaunes(html)
  } catch (error) {
    console.error('Pages Jaunes Pro failed:', error.message)
    return { phone: null, site_web: null }
  }
}

function extractFromPagesJaunes(html) {
  let phone = null
  let site_web = null
  
  // Extraction téléphone - plusieurs patterns
  const phonePatterns = [
    /class="[^"]*numero[^"]*"[^>]*>[\s\S]*?(0[1-9][\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2})/i,
    /tel:(\+?33|0)[1-9][\d\s.]{8,14}/i,
    /(?:data-phone|data-num)[^"]*"([^"]+)"/i,
    /(0[1-9][\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2})/,
  ]
  
  for (const pattern of phonePatterns) {
    const match = html.match(pattern)
    if (match) {
      const raw = match[1] || match[0]
      phone = cleanPhone(raw)
      if (phone) break
    }
  }
  
  // Extraction site web
  const sitePatterns = [
    /class="[^"]*site[_-]?web[^"]*"[^>]*href="([^"]+)"/i,
    /class="[^"]*website[^"]*"[^>]*href="([^"]+)"/i,
    /data-pjlb="web_url"[^>]*href="([^"]+)"/i,
    /href="(https?:\/\/(?:www\.)?[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}[^"]*)"[^>]*(?:rel="nofollow|target="_blank)[^>]*>(?:\s*(?:Site|Voir|Visiter|site\s*web))/i,
  ]
  
  for (const pattern of sitePatterns) {
    const match = html.match(pattern)
    if (match && match[1]) {
      site_web = match[1]
      if (site_web.includes('pagesjaunes.fr')) {
        const urlMatch = site_web.match(/[?&]url=([^&]+)/)
        if (urlMatch) site_web = decodeURIComponent(urlMatch[1])
        else site_web = null
      }
      if (site_web) break
    }
  }
  
  return { phone, site_web }
}

function cleanPhone(raw) {
  if (!raw) return null
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+33')) digits = '0' + digits.slice(3)
  if (digits.startsWith('33') && digits.length === 11) digits = '0' + digits.slice(2)
  if (/^0[1-9]\d{8}$/.test(digits)) {
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
  }
  return null
}


// ---- GOOGLE SEARCH FALLBACK ----

async function searchGoogle(name, city) {
  try {
    const query = encodeURIComponent(`${name} ${city} téléphone`)
    const url = `https://www.google.com/search?q=${query}&hl=fr&gl=fr`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    
    if (!response.ok) return { phone: null, site_web: null }
    
    const html = await response.text()
    
    let phone = null
    let site_web = null
    
    const phoneMatch = html.match(/(0[1-9][\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2})/)
    if (phoneMatch) phone = cleanPhone(phoneMatch[1])
    
    const siteMatches = html.matchAll(/href="(https?:\/\/(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})[^"]*)"[^>]*>/gi)
    const excludedDomains = ['google', 'pagesjaunes', 'societe.com', 'infogreffe', 'pappers', 'verif', 'manageo', 'annuaire', 'kompass', 'linkedin', 'facebook', 'youtube', 'twitter', 'instagram', 'wikipedia']
    
    for (const match of siteMatches) {
      const domain = match[2].toLowerCase()
      if (!excludedDomains.some(ex => domain.includes(ex))) {
        site_web = `https://${match[2]}`
        break
      }
    }
    
    return { phone, site_web }
  } catch (error) {
    console.error('Google search failed:', error.message)
    return { phone: null, site_web: null }
  }
}


// ---- SCRAPING SITE WEB POUR EMAIL ----

async function scrapeWebsiteForEmail(siteUrl) {
  if (!siteUrl) return null
  
  let baseUrl = siteUrl
  if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl
  baseUrl = baseUrl.replace(/\/+$/, '')
  
  const pagesToCheck = [
    baseUrl,
    baseUrl + '/contact',
    baseUrl + '/contact/',
    baseUrl + '/contactez-nous',
    baseUrl + '/nous-contacter',
    baseUrl + '/mentions-legales',
    baseUrl + '/mentions-legales/',
    baseUrl + '/a-propos',
  ]
  
  const emails = new Set()
  
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
      
      // Extraction emails par regex
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      const matches = html.match(emailRegex) || []
      
      for (const email of matches) {
        const lower = email.toLowerCase()
        if (isValidBusinessEmail(lower)) {
          emails.add(lower)
        }
      }
      
      // mailto: links
      const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
      const mailtoMatches = html.match(mailtoRegex) || []
      for (const m of mailtoMatches) {
        const email = m.replace('mailto:', '').toLowerCase()
        if (isValidBusinessEmail(email)) {
          emails.add(email)
        }
      }
      
      if (emails.size > 0) break
      
    } catch (error) {
      continue
    }
  }
  
  if (emails.size === 0) return null
  
  // Prioriser contact, info, etc
  const emailList = [...emails]
  const priorityPrefixes = ['contact', 'info', 'accueil', 'commercial', 'direction', 'rh', 'formation']
  
  const sorted = emailList.sort((a, b) => {
    const aPrefix = a.split('@')[0]
    const bPrefix = b.split('@')[0]
    const aPriority = priorityPrefixes.findIndex(p => aPrefix.includes(p))
    const bPriority = priorityPrefixes.findIndex(p => bPrefix.includes(p))
    if (aPriority !== -1 && bPriority === -1) return -1
    if (aPriority === -1 && bPriority !== -1) return 1
    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority
    return 0
  })
  
  return sorted[0]
}

function isValidBusinessEmail(email) {
  const excludedPrefixes = [
    'noreply', 'no-reply', 'no_reply',
    'webmaster', 'admin', 'postmaster',
    'mailer-daemon', 'root', 'bounce',
    'unsubscribe', 'newsletter',
    'support@wordpress', 'support@wix',
    'example', 'test', 'demo',
  ]
  
  const excludedDomains = [
    'example.com', 'test.com', 'wordpress.com', 'wix.com',
    'squarespace.com', 'google.com', 'gmail.com', 'yahoo.com',
    'hotmail.com', 'outlook.com', 'sentry.io', 'github.com',
    'gravatar.com', 'w3.org', 'schema.org', 'jquery.com',
    'cloudflare.com', 'gstatic.com', 'googleapis.com',
  ]
  
  const prefix = email.split('@')[0]
  const domain = email.split('@')[1]
  
  if (excludedPrefixes.some(ex => prefix.startsWith(ex))) return false
  if (excludedDomains.some(ex => domain === ex || domain.endsWith('.' + ex))) return false
  if (email.includes('..') || email.startsWith('.')) return false
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
  
  const { name, city, postal_code, site_web: existingSiteWeb } = req.body
  
  if (!name) return res.status(400).json({ error: 'name requis' })
  
  const result = {
    phone: null,
    site_web: null,
    email: null,
    sources: [],
  }
  
  try {
    // Étape 1 : Pages Jaunes
    console.log(`Auto-enrich: ${name} (${city})`)
    const pjResult = await searchPagesJaunes(name, city || postal_code || '')
    
    if (pjResult.phone) {
      result.phone = pjResult.phone
      result.sources.push('Pages Jaunes')
    }
    if (pjResult.site_web) {
      result.site_web = pjResult.site_web
      result.sources.push('Pages Jaunes')
    }
    
    // Étape 2 : Google fallback
    if (!result.phone || !result.site_web) {
      const googleResult = await searchGoogle(name, city || postal_code || '')
      
      if (!result.phone && googleResult.phone) {
        result.phone = googleResult.phone
        result.sources.push('Google')
      }
      if (!result.site_web && googleResult.site_web) {
        result.site_web = googleResult.site_web
        result.sources.push('Google')
      }
    }
    
    // Étape 3 : Scraper le site web pour l'email
    const siteToScrape = result.site_web || existingSiteWeb
    if (siteToScrape) {
      const email = await scrapeWebsiteForEmail(siteToScrape)
      if (email) {
        result.email = email
        result.sources.push('Site web')
      }
    }
    
    console.log(`Result: phone=${result.phone}, site=${result.site_web}, email=${result.email}`)
    
    return res.status(200).json({
      success: true,
      ...result,
    })
    
  } catch (error) {
    console.error('Auto-enrich error:', error)
    return res.status(200).json({
      success: true,
      ...result,
      warning: error.message,
    })
  }
}
