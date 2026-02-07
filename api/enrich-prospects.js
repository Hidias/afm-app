/**
 * ============================================================================
 * API ENDPOINT - ENRICHISSEMENT PROSPECTS PAR SCRAPING SITE WEB
 * ============================================================================
 * 
 * Scrape les sites web des prospects pour extraire emails et téléphones
 * Traite un batch de prospects à chaque appel
 * Peut être appelé manuellement ou via cron
 * 
 * POST /api/enrich-prospects
 * Body: { batch_size: 20 }  (optionnel, défaut 20)
 * 
 * GET /api/enrich-prospects  (pour le cron)
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_BATCH_SIZE = 20
const FETCH_TIMEOUT = 8000 // 8 secondes par site max
const CONTACT_PATHS = [
  '/contact',
  '/nous-contacter',
  '/contactez-nous',
  '/contact-us',
  '/mentions-legales',
  '/mentions',
  '/a-propos',
  '/about',
  '/qui-sommes-nous',
]

// Emails génériques à garder (utiles pour la prospection)
const VALID_GENERIC_PREFIXES = [
  'contact', 'info', 'accueil', 'commercial', 'direction',
  'rh', 'formation', 'admin', 'secretariat', 'comptabilite',
  'bonjour', 'hello', 'bienvenue'
]

// Emails à ignorer
const BLACKLISTED_PREFIXES = [
  'noreply', 'no-reply', 'no_reply', 'unsubscribe',
  'mailer-daemon', 'postmaster', 'webmaster', 'root',
  'abuse', 'spam', 'newsletter', 'notification',
  'wordpress', 'woocommerce', 'prestashop', 'drupal'
]

const BLACKLISTED_DOMAINS = [
  'example.com', 'test.com', 'sentry.io', 'googleapis.com',
  'w3.org', 'schema.org', 'facebook.com', 'twitter.com',
  'instagram.com', 'linkedin.com', 'youtube.com', 'google.com',
  'gravatar.com', 'wp.com', 'wordpress.com', 'cloudflare.com'
]

// ============================================================================
// EXTRACTION EMAILS
// ============================================================================

function extractEmails(html, url) {
  const emails = new Set()

  // Regex email standard
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const matches = html.match(emailRegex) || []

  for (const email of matches) {
    const lower = email.toLowerCase().trim()
    const prefix = lower.split('@')[0]
    const domain = lower.split('@')[1]

    // Filtrer les indésirables
    if (BLACKLISTED_PREFIXES.some(bp => prefix.startsWith(bp))) continue
    if (BLACKLISTED_DOMAINS.some(bd => domain.includes(bd))) continue
    if (domain.endsWith('.png') || domain.endsWith('.jpg') || domain.endsWith('.gif')) continue
    if (lower.length > 60) continue

    emails.add(lower)
  }

  // Chercher aussi les mailto: dans le HTML
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g
  let mailtoMatch
  while ((mailtoMatch = mailtoRegex.exec(html)) !== null) {
    const email = mailtoMatch[1].toLowerCase().trim()
    const prefix = email.split('@')[0]
    const domain = email.split('@')[1]
    if (!BLACKLISTED_PREFIXES.some(bp => prefix.startsWith(bp)) &&
        !BLACKLISTED_DOMAINS.some(bd => domain.includes(bd))) {
      emails.add(email)
    }
  }

  return [...emails]
}

// ============================================================================
// EXTRACTION TELEPHONES (format français)
// ============================================================================

function extractPhones(html) {
  const phones = new Set()

  // Nettoyer le HTML des tags pour éviter les faux positifs
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')

  // Formats français : 01-09, +33, 0033
  const phonePatterns = [
    // +33 6 12 34 56 78 ou +33 612345678
    /(?:\+33|0033)\s?[1-9](?:[\s.\-]?\d{2}){4}/g,
    // 06 12 34 56 78 ou 06.12.34.56.78 ou 06-12-34-56-78
    /0[1-9](?:[\s.\-]?\d{2}){4}/g,
  ]

  for (const pattern of phonePatterns) {
    const matches = text.match(pattern) || []
    for (const match of matches) {
      // Normaliser le numéro
      let phone = match.replace(/[\s.\-]/g, '')

      // Convertir +33 ou 0033 en 0
      if (phone.startsWith('+33')) phone = '0' + phone.slice(3)
      if (phone.startsWith('0033')) phone = '0' + phone.slice(4)

      // Vérifier que c'est un numéro valide (10 chiffres commençant par 0)
      if (/^0[1-9]\d{8}$/.test(phone)) {
        // Formater proprement : 06 12 34 56 78
        const formatted = phone.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
        phones.add(formatted)
      }
    }
  }

  // Filtrer les numéros suspects (séries répétitives)
  return [...phones].filter(p => {
    const digits = p.replace(/\s/g, '')
    // Exclure 0000000000, 0123456789, etc.
    if (/^(\d)\1{9}$/.test(digits)) return false
    if (digits === '0123456789') return false
    return true
  })
}

// ============================================================================
// SCRAPING D'UNE URL
// ============================================================================

async function fetchPage(url, timeout = FETCH_TIMEOUT) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
      },
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null

    const html = await response.text()
    // Limiter la taille pour éviter les problèmes mémoire
    return html.slice(0, 500000)
  } catch (error) {
    return null
  }
}

function normalizeUrl(siteWeb) {
  let url = siteWeb.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  // Enlever le trailing slash
  url = url.replace(/\/+$/, '')
  return url
}

// ============================================================================
// ENRICHISSEMENT D'UN PROSPECT
// ============================================================================

async function enrichProspect(prospect) {
  const result = {
    emails: [],
    phones: [],
    pages_scraped: 0,
    errors: [],
  }

  const baseUrl = normalizeUrl(prospect.site_web)

  // 1. Scraper la page d'accueil
  const homepage = await fetchPage(baseUrl)
  if (!homepage) {
    // Essayer en http si https échoue
    const httpUrl = baseUrl.replace('https://', 'http://')
    const httpPage = await fetchPage(httpUrl)
    if (!httpPage) {
      result.errors.push('Site inaccessible')
      return result
    }
    result.emails.push(...extractEmails(httpPage, httpUrl))
    result.phones.push(...extractPhones(httpPage))
    result.pages_scraped++
  } else {
    result.emails.push(...extractEmails(homepage, baseUrl))
    result.phones.push(...extractPhones(homepage))
    result.pages_scraped++
  }

  // 2. Scraper les pages contact (max 3 pour rester rapide)
  let contactPagesScraped = 0
  for (const path of CONTACT_PATHS) {
    if (contactPagesScraped >= 3) break

    const contactUrl = baseUrl + path
    const contactPage = await fetchPage(contactUrl, 5000) // timeout plus court
    if (contactPage) {
      result.emails.push(...extractEmails(contactPage, contactUrl))
      result.phones.push(...extractPhones(contactPage))
      result.pages_scraped++
      contactPagesScraped++
    }
  }

  // 3. Dédupliquer
  result.emails = [...new Set(result.emails)]
  result.phones = [...new Set(result.phones)]

  return result
}

// ============================================================================
// SÉLECTION DU MEILLEUR EMAIL/PHONE
// ============================================================================

function selectBestEmail(emails) {
  if (emails.length === 0) return null

  // Prioriser : contact@ > info@ > direction@ > rh@ > autres
  const priority = ['contact', 'info', 'accueil', 'direction', 'rh', 'formation', 'commercial']

  for (const prefix of priority) {
    const found = emails.find(e => e.startsWith(prefix + '@'))
    if (found) return found
  }

  // Sinon prendre le premier qui n'est pas un prénom (plus court = plus générique = mieux)
  return emails.sort((a, b) => a.length - b.length)[0]
}

function selectBestPhone(phones) {
  if (phones.length === 0) return null

  // Prioriser les fixes (01-05) pour les entreprises, puis portables (06-07)
  const fixes = phones.filter(p => /^0[1-5]/.test(p))
  if (fixes.length > 0) return fixes[0]

  return phones[0]
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const batchSize = req.body?.batch_size || DEFAULT_BATCH_SIZE

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // 1. Récupérer les prospects à enrichir
    //    - Qui ont un site_web
    //    - Qui n'ont pas encore été enrichis avec succès
    //    - Qui n'ont pas déjà un email ET un phone
    //    - Max 3 tentatives
    const { data: prospects, error: fetchError } = await supabase
      .from('prospection_massive')
      .select('id, siret, name, site_web, phone, email, enrichment_attempts')
      .not('site_web', 'is', null)
      .neq('site_web', '')
      .lt('enrichment_attempts', 3)
      .or('enrichment_status.is.null,enrichment_status.neq.success')
      .order('quality_score', { ascending: false })
      .limit(batchSize)

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message })
    }

    if (!prospects || prospects.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Aucun prospect à enrichir',
        stats: { total: 0 }
      })
    }

    // 2. Enrichir chaque prospect
    const stats = {
      total: prospects.length,
      emails_found: 0,
      phones_found: 0,
      both_found: 0,
      failed: 0,
      already_had_data: 0,
    }

    for (const prospect of prospects) {
      try {
        const result = await enrichProspect(prospect)

        const bestEmail = selectBestEmail(result.emails)
        const bestPhone = selectBestPhone(result.phones)

        const hasNewEmail = bestEmail && !prospect.email
        const hasNewPhone = bestPhone && !prospect.phone

        // Préparer la mise à jour
        const update = {
          enrichment_attempts: (prospect.enrichment_attempts || 0) + 1,
          enrichment_last_attempt: new Date().toISOString(),
          enrichment_sources_tried: ['site_web'],
          updated_at: new Date().toISOString(),
        }

        if (bestEmail && !prospect.email) {
          update.email = bestEmail
          update.email_source = 'site_web'
          stats.emails_found++
        }

        if (bestPhone && !prospect.phone) {
          update.phone = bestPhone
          update.phone_source = 'site_web'
          stats.phones_found++
        }

        if ((bestEmail || prospect.email) && (bestPhone || prospect.phone)) {
          update.enrichment_status = 'success'
          if (hasNewEmail && hasNewPhone) stats.both_found++
        } else if (bestEmail || bestPhone || prospect.email || prospect.phone) {
          update.enrichment_status = 'partial'
        } else {
          update.enrichment_status = 'no_data'
          if (result.errors.length > 0) {
            update.enrichment_errors = result.errors
          }
        }

        // Recalculer quality_score
        let scoreBonus = 0
        if (update.email || prospect.email) scoreBonus += 10
        if (update.phone || prospect.phone) scoreBonus += 10

        // Sauvegarder
        await supabase
          .from('prospection_massive')
          .update(update)
          .eq('id', prospect.id)

        // Petit délai entre chaque prospect pour ne pas surcharger
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        stats.failed++
        // Marquer l'échec
        await supabase
          .from('prospection_massive')
          .update({
            enrichment_attempts: (prospect.enrichment_attempts || 0) + 1,
            enrichment_last_attempt: new Date().toISOString(),
            enrichment_status: 'error',
            enrichment_errors: [error.message],
          })
          .eq('id', prospect.id)
      }
    }

    return res.status(200).json({
      success: true,
      stats,
      message: `✅ ${stats.emails_found} emails et ${stats.phones_found} téléphones trouvés sur ${stats.total} prospects`
    })

  } catch (error) {
    console.error('Erreur enrichissement:', error)
    return res.status(500).json({ error: error.message })
  }
}
