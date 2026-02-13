/**
 * ============================================================================
 * ENRICHISSEMENT RAPIDE v3 — Mini-Lusha
 * ============================================================================
 * 
 * Enrichissement semi-automatique avec 3 API intégrées :
 *   1. API Recherche Entreprises → dirigeant, email patterns (GRATUIT)
 *   2. API La Bonne Boîte → signal recrutement géolocalisé
 *   3. API Offres d'Emploi → offres actives par département
 * 
 * + Fallback manuel : Pages Jaunes, Google, Societe.com
 * 
 * Raccourcis clavier :
 * - Entrée : Sauvegarder et passer au suivant
 * - Échap  : Passer sans sauvegarder
 * - Ctrl+O : Ouvrir Pages Jaunes
 * ============================================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Search, SkipForward, Save, ExternalLink, Phone, Mail, Globe,
  Zap, CheckCircle, XCircle, RefreshCw, Loader, User, Briefcase,
  TrendingUp, Building2, MapPin, ChevronDown, ChevronUp, Copy, Check, Edit3
} from 'lucide-react'

// ─── Constantes & helpers ───────────────────────────────────────────────────

const NAF_LABELS = {
  '01': 'Culture et production animale', '02': 'Sylviculture', '03': 'Pêche et aquaculture',
  '10': 'Industries alimentaires', '11': 'Fabrication de boissons', '13': 'Fabrication de textiles',
  '14': 'Industrie de l\'habillement', '16': 'Travail du bois', '18': 'Imprimerie',
  '20': 'Industrie chimique', '22': 'Caoutchouc et plastique', '23': 'Produits minéraux',
  '24': 'Métallurgie', '25': 'Produits métalliques', '28': 'Machines et équipements',
  '29': 'Industrie automobile', '31': 'Fabrication de meubles', '33': 'Réparation de machines',
  '35': 'Électricité, gaz', '38': 'Collecte et traitement des déchets',
  '41': 'Construction de bâtiments', '42': 'Génie civil', '43': 'Travaux de construction spécialisés',
  '45': 'Commerce et réparation auto', '46': 'Commerce de gros', '47': 'Commerce de détail',
  '49': 'Transports terrestres', '52': 'Entreposage et transports', '55': 'Hébergement',
  '56': 'Restauration', '62': 'Programmation informatique', '64': 'Services financiers',
  '68': 'Activités immobilières', '69': 'Juridique et comptable', '70': 'Conseil de gestion',
  '71': 'Architecture, ingénierie', '73': 'Publicité', '77': 'Location',
  '78': 'Intérim', '80': 'Enquêtes et sécurité', '81': 'Services bâtiments (nettoyage)',
  '82': 'Services administratifs', '85': 'Enseignement', '86': 'Santé',
  '87': 'Hébergement médico-social', '88': 'Action sociale', '93': 'Activités sportives',
  '96': 'Autres services personnels',
}

function getNafLabel(naf) {
  if (!naf) return null
  const code = naf.replace(/\./g, '').substring(0, 2)
  return NAF_LABELS[code] || naf
}

const EFFECTIF_LABELS = {
  '00': '0 sal.', '01': '1-2', '02': '3-5', '03': '6-9',
  '11': '10-19', '12': '20-49', '21': '50-99', '22': '100-199',
  '31': '200-249', '32': '250-499', '41': '500-999', '42': '1000+',
}

function getEffectifLabel(code) {
  if (!code) return null
  return EFFECTIF_LABELS[String(code)] || code + ' sal.'
}

// Mapping code INSEE → nombre réel (pour scoring/tri)
const EFFECTIF_TO_NUM = {
  '00': 0, '01': 1, '02': 3, '03': 6, '11': 10, '12': 20,
  '21': 50, '22': 100, '31': 200, '32': 250, '41': 500,
  '42': 1000, '51': 2000, '52': 5000, '53': 10000,
}

// Mapping filtre UI → codes INSEE
const EFFECTIF_FILTER_CODES = {
  '1-5': ['01', '02'],
  '6-19': ['03', '11'],
  '20-49': ['12'],
  '50-99': ['21'],
  '100-249': ['22', '31'],
  '250+': ['32', '41', '42', '51', '52', '53'],
}

// Groupement forme juridique
function getFormeGroup(code) {
  if (!code) return null
  const n = parseInt(code)
  if (!n) return null
  if (n >= 5505 && n <= 5599) return 'SAS/SASU'
  if ((n >= 5306 && n <= 5308) || n === 5370 || n === 5385 || (n >= 5410 && n <= 5443) || n === 5600) return 'SARL/EURL'
  if ((n >= 5191 && n <= 5199) || (n >= 5451 && n <= 5499) || n === 5699 || (n >= 5700 && n <= 5800)) return 'SA/SCA'
  if (n === 1000) return 'EI'
  if (n >= 9100 && n <= 9399) return 'Association'
  if ((n >= 3000 && n <= 3999) || (n >= 7000 && n <= 7999)) return 'Public'
  return 'Autre'
}

function getFormeLabel(code) {
  const group = getFormeGroup(code)
  return group || ''
}

const BASES = {
  concarneau: { name: 'Concarneau', who: 'Hicham', lat: 47.8742, lng: -3.9196 },
  derval: { name: 'Derval', who: 'Maxime', lat: 47.6639, lng: -1.6689 },
}

const DEPT_CENTERS = {
  '22': { lat: 48.45, lng: -2.99 }, '29': { lat: 48.39, lng: -4.32 },
  '35': { lat: 48.11, lng: -1.67 }, '44': { lat: 47.25, lng: -1.57 },
  '49': { lat: 47.47, lng: -0.55 }, '53': { lat: 48.07, lng: -0.77 },
  '56': { lat: 47.75, lng: -2.76 }, '72': { lat: 47.99, lng: 0.20 },
  '85': { lat: 46.67, lng: -1.43 },
}

const SORT_MODES = [
  { id: 'smart', label: '🎯 Priorité' },
  { id: 'proche', label: '📏 Proximité' },
  { id: 'gros', label: '🏢 Effectif' },
  { id: 'score', label: '⭐ Score' },
]

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Composant principal ────────────────────────────────────────────────────

export default function EnrichissementRapide() {
  // État principal
  const [prospects, setProspects] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [siteWeb, setSiteWeb] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Stats
  const [dbStats, setDbStats] = useState({ done: 0, phones: 0, emails: 0, excluded: 0 })
  const [sessionStats, setSessionStats] = useState({ done: 0, phones: 0, emails: 0, excluded: 0 })
  const [totalRemaining, setTotalRemaining] = useState(0)

  // Filtres
  const [departementFilter, setDepartementFilter] = useState('')
  const [effectifFilter, setEffectifFilter] = useState('')
  const [formeFilter, setFormeFilter] = useState('')
  const [proximityBase, setProximityBase] = useState('concarneau')
  const [sortMode, setSortMode] = useState('smart')
  const [radiusFilter, setRadiusFilter] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  // Mini-Lusha : enrichissement API
  const [lusha, setLusha] = useState(null)          // résultat enrich-entreprise
  const [lushaLoading, setLushaLoading] = useState(false)
  const [signaux, setSignaux] = useState(null)       // résultat offres-emploi
  const [signauxLoading, setSignauxLoading] = useState(false)
  const [showSignaux, setShowSignaux] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(null)

  // Scraping
  const [scraping, setScraping] = useState(false)

  // Édition fiche (identité)
  const [editName, setEditName] = useState('')
  const [editSiren, setEditSiren] = useState('')
  const [editSiret, setEditSiret] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editPostalCode, setEditPostalCode] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const isManualProspect = (p) => !p || p.siren?.startsWith('MANUAL_') || !p.city || !p.postal_code

  const phoneRef = useRef(null)
  const departements = ['22', '29', '35', '44', '49', '53', '56', '72', '85']

  // ─── Stats globales ─────────────────────────────────────────────────────

  async function loadStats() {
    const [
      { count: doneCount },
      { count: phoneCount },
      { count: emailCount },
      { count: excludedCount },
    ] = await Promise.all([
      supabase.from('prospection_massive').select('id', { count: 'exact', head: true }).eq('enrichment_status', 'done'),
      supabase.from('prospection_massive').select('id', { count: 'exact', head: true }).not('phone', 'is', null),
      supabase.from('prospection_massive').select('id', { count: 'exact', head: true }).not('email', 'is', null),
      supabase.from('prospection_massive').select('id', { count: 'exact', head: true }).eq('enrichment_status', 'failed').eq('enrichment_attempts', 99),
    ])
    setDbStats({
      done: doneCount || 0,
      phones: phoneCount || 0,
      emails: emailCount || 0,
      excluded: excludedCount || 0,
    })
  }

  useEffect(() => { loadStats() }, [])

  // ─── Recherche ──────────────────────────────────────────────────────────

  async function handleSearch(term) {
    setSearchTerm(term)
    if (!term || term.length < 2) { setSearchResults(null); return }
    setSearching(true)
    try {
      const isNumeric = /^\d+$/.test(term.replace(/\s/g, ''))
      let query = supabase
        .from('prospection_massive')
        .select('id, siret, siren, name, city, postal_code, address, naf, phone, email, site_web, departement, effectif, quality_score, enrichment_status, latitude, longitude, forme_juridique')
        .order('quality_score', { ascending: false })
        .limit(500)
      if (isNumeric) {
        const clean = term.replace(/\s/g, '')
        query = query.or(`siret.ilike.%${clean}%,siren.ilike.%${clean}%`)
      } else {
        query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%`)
      }
      const { data, error } = await query
      if (error) throw error
      const seen = new Set()
      const unique = (data || []).filter(p => {
        if (seen.has(p.siren)) return false
        seen.add(p.siren)
        return true
      })
      setSearchResults(unique)
    } catch (err) {
      console.error('Erreur recherche:', err)
    } finally {
      setSearching(false)
    }
  }

  function selectSearchResult(prospect) {
    setSearchResults(null)
    setSearchTerm('')
    setProspects([prospect])
    setCurrentIndex(0)
    resetFields()
    if (prospect.phone) setPhone(prospect.phone)
    if (prospect.email) setEmail(prospect.email)
    if (prospect.site_web) setSiteWeb(prospect.site_web)
  }

  // ─── Chargement des prospects ───────────────────────────────────────────

  const loadProspects = useCallback(async () => {
    setLoading(true)
    const base = BASES[proximityBase]
    let nearbyDepts = null
    if (base && radiusFilter > 0) {
      const marginRadius = radiusFilter + 50
      nearbyDepts = Object.entries(DEPT_CENTERS)
        .filter(([_, center]) => distanceKm(base.lat, base.lng, center.lat, center.lng) <= marginRadius)
        .map(([dept]) => dept)
    }

    let query = supabase
      .from('prospection_massive')
      .select('id, siret, siren, name, city, postal_code, address, naf, phone, email, site_web, departement, effectif, quality_score, latitude, longitude, forme_juridique')
      .is('phone', null)
      .or('enrichment_status.is.null,enrichment_status.eq.pending,enrichment_status.eq.enriching')
      .order('quality_score', { ascending: false })
      .limit(200)

    if (departementFilter) {
      query = query.eq('departement', departementFilter)
    } else if (nearbyDepts && nearbyDepts.length > 0) {
      query = query.in('departement', nearbyDepts)
    }
    if (effectifFilter) {
      const codes = EFFECTIF_FILTER_CODES[effectifFilter]
      if (codes) query = query.in('effectif', codes)
    }
    if (formeFilter) {
      // Map forme group to codes — filter client-side after fetch
    }

    const { data, error } = await query
    if (error) { console.error('Erreur chargement:', error); setLoading(false); return }

    const seenSiren = new Set()
    const seenName = new Set()
    let unique = (data || []).filter(p => {
      if (seenSiren.has(p.siren)) return false
      const normName = (p.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (seenName.has(normName)) return false
      seenSiren.add(p.siren)
      seenName.add(normName)
      // Filtre forme juridique côté client
      if (formeFilter && getFormeGroup(p.forme_juridique) !== formeFilter) return false
      return true
    }).slice(0, 50)

    if (base) {
      unique.forEach(p => {
        // Distance GPS réelle si disponible, sinon fallback centre département
        if (p.latitude && p.longitude) {
          p._dist = distanceKm(base.lat, base.lng, p.latitude, p.longitude)
        } else {
          const dept = p.departement || (p.postal_code || '').slice(0, 2)
          const center = DEPT_CENTERS[dept]
          p._dist = center ? distanceKm(base.lat, base.lng, center.lat, center.lng) : null
        }
        const eff = EFFECTIF_TO_NUM[String(p.effectif)] || 5
        p._smart = p._dist != null && p._dist > 0
          ? (eff * 2 + (p.quality_score || 50)) / Math.sqrt(p._dist)
          : (eff * 2 + (p.quality_score || 50)) * 0.5
      })
      if (sortMode === 'smart') unique.sort((a, b) => b._smart - a._smart)
      else if (sortMode === 'proche') unique.sort((a, b) => (a._dist ?? 9999) - (b._dist ?? 9999))
      else if (sortMode === 'gros') unique.sort((a, b) => (EFFECTIF_TO_NUM[String(b.effectif)] || 0) - (EFFECTIF_TO_NUM[String(a.effectif)] || 0))
    }

    setProspects(unique)
    setCurrentIndex(0)
    resetFields()

    let countQuery = supabase
      .from('prospection_massive')
      .select('id', { count: 'exact', head: true })
      .is('phone', null)
      .or('enrichment_status.is.null,enrichment_status.eq.pending,enrichment_status.eq.enriching')
    if (departementFilter) countQuery = countQuery.eq('departement', departementFilter)
    else if (nearbyDepts && nearbyDepts.length > 0) countQuery = countQuery.in('departement', nearbyDepts)
    if (effectifFilter) {
      const codes = EFFECTIF_FILTER_CODES[effectifFilter]
      if (codes) countQuery = countQuery.in('effectif', codes)
    }
    const { count } = await countQuery
    setTotalRemaining(count || 0)

    setLoading(false)
  }, [departementFilter, proximityBase, sortMode, radiusFilter, effectifFilter, formeFilter])

  useEffect(() => { loadProspects() }, [loadProspects])

  const current = prospects[currentIndex]

  function resetFields() {
    setPhone('')
    setEmail('')
    setSiteWeb('')
    setLusha(null)
    setSignaux(null)
    setShowSignaux(false)
    setCopiedEmail(null)
    setEditName('')
    setEditSiren('')
    setEditSiret('')
    setEditCity('')
    setEditPostalCode('')
    setEditAddress('')
    setShowEditModal(false)
  }

  // ─── Mini-Lusha : Auto-enrichissement API ───────────────────────────────

  // Pré-remplir les champs identité quand la fiche change
  useEffect(() => {
    if (!current) return
    setEditName(current.name || '')
    setEditSiren(current.siren?.startsWith('MANUAL_') ? '' : (current.siren || ''))
    setEditSiret(current.siret?.startsWith('MANUAL_') || current.siret?.startsWith('INCONNU') ? '' : (current.siret || ''))
    setEditCity(current.city || '')
    setEditPostalCode(current.postal_code || '')
    setEditAddress(current.address || '')
  }, [current?.id])

  useEffect(() => {
    if (!current?.siren) return
    enrichViaAPI(current)
  }, [current?.siren])

  async function enrichViaAPI(prospect) {
    setLushaLoading(true)
    setLusha(null)
    try {
      const res = await fetch('/api/enrich-entreprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          siren: prospect.siren,
          site_web: prospect.site_web || siteWeb 
        })
      })
      if (res.ok) {
        const data = await res.json()
        setLusha(data)
        // Auto-remplir le site web si trouvé via API
        if (data.domain && !siteWeb && !prospect.site_web) {
          const site = 'www.' + data.domain
          setSiteWeb(site)
          // Auto-scraper le site pour trouver tél + email
          setTimeout(() => autoScrape(site), 500)
        }
      }
    } catch (err) {
      console.error('Erreur enrichissement API:', err)
    } finally {
      setLushaLoading(false)
    }
  }

  // Charger les signaux recrutement
  async function loadSignaux() {
    if (!current) return
    if (signaux) { setShowSignaux(!showSignaux); return }
    
    setSignauxLoading(true)
    setShowSignaux(true)
    try {
      const dept = current.departement || (current.postal_code || '').slice(0, 2)
      const nafCode = current.naf ? current.naf.replace(/\./g, '').substring(0, 2) : null
      
      const res = await fetch('/api/offres-emploi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departement: dept, ...(nafCode ? { codeNAF: nafCode } : {}) })
      })
      if (res.ok) {
        const data = await res.json()
        // Chercher si cette entreprise est dans les résultats
        const normName = (current.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        const match = data.entreprises?.find(e => {
          const en = (e.nom || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
          return en === normName || en.includes(normName) || normName.includes(en)
        })
        setSignaux({
          total_offres: data.total_offres,
          total_entreprises: data.entreprises_qui_recrutent,
          match: match || null,
          top5: (data.entreprises || []).slice(0, 5),
          departement: dept,
          secteur: nafCode ? getNafLabel(current.naf) : null,
        })
      }
    } catch (err) {
      console.error('Erreur signaux:', err)
    } finally {
      setSignauxLoading(false)
    }
  }

  // Copier un email pattern
  function copyEmail(emailAddr) {
    navigator.clipboard.writeText(emailAddr)
    setCopiedEmail(emailAddr)
    setEmail(emailAddr)
    setTimeout(() => setCopiedEmail(null), 2000)
  }

  // ─── Scraper site web ───────────────────────────────────────────────────

  async function scrapeWebsite() {
    if (!siteWeb || scraping) return
    setScraping(true)
    try {
      const res = await fetch('/api/scrape-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: siteWeb })
      })
      const data = await res.json()
      if (data.success) {
        if (data.phone && !phone) setPhone(data.phone)
        if (data.email && !email) setEmail(data.email)
      }
    } catch (err) {
      console.error('Erreur scraping:', err)
    } finally {
      setScraping(false)
    }
  }

  // 🔍 Auto-scrape (appelé automatiquement quand site web trouvé)
  async function autoScrape(url) {
    if (!url || scraping) return
    setScraping(true)
    try {
      const res = await fetch('/api/scrape-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const data = await res.json()
      if (data.success) {
        if (data.phone) setPhone(data.phone)
        if (data.email) setEmail(data.email)
      }
    } catch (err) {
      console.error('Erreur auto-scrape:', err)
    } finally {
      setScraping(false)
    }
  }

  // 🔍 Recherche coordonnées : tente Google → scrape
  async function rechercherCoordonnees() {
    if (!current) return
    // Si on a un site web, scraper directement
    if (siteWeb) {
      scrapeWebsite()
      return
    }
    // Sinon ouvrir Google pour chercher le site
    const query = `${current.name} ${current.city || ''} site officiel`
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank')
  }

  // ─── Navigation & sauvegarde ────────────────────────────────────────────

  function goNext() {
    resetFields()
    if (currentIndex < prospects.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      loadProspects()
    }
    setTimeout(() => phoneRef.current?.focus(), 100)
  }

  async function handleSave() {
    if (!current) return
    if (!phone && !email && !siteWeb) { goNext(); return }

    setSaving(true)
    const update = {
      updated_at: new Date().toISOString(),
      enrichment_status: 'done',
      enrichment_last_attempt: new Date().toISOString(),
      enrichment_attempts: 99,
    }

    if (phone) {
      let cleanPhone = phone.replace(/[\s.\-()]/g, '')
      if (cleanPhone.startsWith('+33')) cleanPhone = '0' + cleanPhone.slice(3)
      if (cleanPhone.startsWith('0033')) cleanPhone = '0' + cleanPhone.slice(4)
      if (/^0[1-9]\d{8}$/.test(cleanPhone)) {
        update.phone = cleanPhone.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
      } else {
        update.phone = phone.trim()
      }
      update.phone_source = 'manual_pj'
    }

    if (email) {
      update.email = email.trim().toLowerCase()
      update.email_source = lusha?.email_patterns?.includes(email.trim().toLowerCase()) ? 'api_pattern' : 'manual_pj'
    }

    if (siteWeb) update.site_web = siteWeb.trim()

    // Champs identité (si modifiés)
    if (editName && editName !== current.name) update.name = editName.trim().toUpperCase()
    if (editCity && editCity !== current.city) update.city = editCity.trim()
    if (editPostalCode && editPostalCode !== current.postal_code) {
      update.postal_code = editPostalCode.trim()
      update.departement = editPostalCode.trim().substring(0, 2)
    }
    if (editAddress && editAddress !== current.address) update.address = editAddress.trim()
    if (editSiren && editSiren !== current.siren && !current.siren?.startsWith('MANUAL_')) {
      // SIREN modifié mais pas un placeholder → update normal
      update.siren = editSiren.trim()
    }
    if (editSiret && editSiret !== current.siret) update.siret = editSiret.trim()

    // Cas spécial : remplacement du SIREN placeholder MANUAL_xxx
    const sirenChanged = editSiren && current.siren?.startsWith('MANUAL_') && editSiren.trim().length >= 9

    // Sauvegarder le dirigeant si trouvé via API
    if (lusha?.dirigeant_nom) {
      update.dirigeant_nom = lusha.dirigeant_nom
      update.dirigeant_prenom = lusha.dirigeant_prenom
      update.dirigeant_fonction = lusha.dirigeant_qualite
    }

    const { error } = await supabase
      .from('prospection_massive')
      .update({ ...update, ...(sirenChanged ? { siren: editSiren.trim() } : {}) })
      .eq('siren', current.siren)

    // Si SIRET placeholder aussi, mettre à jour
    if (!error && editSiret && (current.siret?.startsWith('MANUAL_') || current.siret?.startsWith('INCONNU'))) {
      await supabase
        .from('prospection_massive')
        .update({ siret: editSiret.trim() })
        .eq('siren', sirenChanged ? editSiren.trim() : current.siren)
    }

    // Marquer les doublons (même nom)
    if (!error && current.name) {
      await supabase
        .from('prospection_massive')
        .update({
          enrichment_status: 'done',
          enrichment_last_attempt: new Date().toISOString(),
          enrichment_attempts: 99,
          ...(update.phone ? { phone: update.phone, phone_source: update.phone_source } : {}),
          ...(update.site_web ? { site_web: update.site_web } : {}),
          ...(update.email ? { email: update.email, email_source: update.email_source } : {}),
        })
        .ilike('name', current.name)
        .neq('siren', current.siren)
    }

    if (!error) {
      setSessionStats(prev => ({
        done: prev.done + 1,
        phones: prev.phones + (phone ? 1 : 0),
        emails: prev.emails + (email ? 1 : 0),
        excluded: prev.excluded,
      }))
      setTotalRemaining(prev => prev - 1)
    }

    setSaving(false)
    goNext()
  }

  function handleSkip() { if (current) goNext() }

  async function handleNotFound() {
    if (!current) return
    await supabase
      .from('prospection_massive')
      .update({
        enrichment_status: 'failed',
        enrichment_attempts: 99,
        enrichment_last_attempt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('siren', current.siren)
    setSessionStats(prev => ({ ...prev, excluded: prev.excluded + 1 }))
    setTotalRemaining(prev => prev - 1)
    goNext()
  }

  // ─── Liens externes ────────────────────────────────────────────────────

  function openPJ() {
    if (!current) return
    const cleanName = current.name.replace(/\b(SAS|SARL|SA|EURL|SCI|SNC|SASU)\b/gi, '').replace(/[^\w\sÀ-ÿ-]/g, '').trim()
    window.open(`https://www.pagesjaunes.fr/pagesblanches/recherche?quoiqui=${encodeURIComponent(cleanName)}&ou=${encodeURIComponent(current.city || '')}`, '_blank')
  }

  function openGoogle() {
    if (!current) return
    window.open(`https://www.google.com/search?q=${encodeURIComponent(`${current.name} ${current.city || ''} téléphone`)}`, '_blank')
  }

  function openSociete() {
    if (!current) return
    window.open(`https://www.societe.com/cgi-bin/search?champs=${encodeURIComponent(current.siren || current.name)}`, '_blank')
  }

  // ─── Raccourcis clavier ─────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        if (e.key === 'Enter') { e.preventDefault(); handleSave() }
        if (e.key === 'Escape') { e.preventDefault(); handleSkip() }
        return
      }
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); openPJ() }
      if (e.key === 'Enter') { e.preventDefault(); handleSave() }
      if (e.key === 'Escape') { e.preventDefault(); handleSkip() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [current, phone, email, siteWeb])

  // ─── RENDU ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-3" />
          <p className="text-gray-500">Chargement des prospects...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* ─── Header + Stats ─────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-500" />
              Mini-Lusha
              <span className="text-sm font-normal text-gray-400 ml-2">Enrichissement intelligent</span>
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {totalRemaining.toLocaleString()} prospects restants
              {radiusFilter > 0 && ` • ≤ ${radiusFilter}km de ${BASES[proximityBase].name}`}
            </p>
          </div>
          <button onClick={loadProspects}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Recharger
          </button>
        </div>

        {/* Stats compactes */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Enrichis', val: dbStats.done + sessionStats.done, session: sessionStats.done, color: 'text-primary-600' },
            { label: '📞 Tels', val: dbStats.phones + sessionStats.phones, session: sessionStats.phones, color: 'text-green-600' },
            { label: '📧 Emails', val: dbStats.emails + sessionStats.emails, session: sessionStats.emails, color: 'text-blue-600' },
            { label: '🚫 Exclus', val: dbStats.excluded + sessionStats.excluded, session: sessionStats.excluded, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-3 py-2 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
              {s.session > 0 && <p className="text-xs text-gray-400">+{s.session}</p>}
            </div>
          ))}
        </div>

        {/* Filtres compacts */}
        <div className="bg-white rounded-lg border border-gray-200 p-2.5 mb-3 flex items-center gap-2 flex-wrap text-xs">
          <div className="flex bg-gray-100 rounded-md p-0.5">
            {SORT_MODES.map(m => (
              <button key={m.id} onClick={() => setSortMode(m.id)}
                className={'px-2.5 py-1 rounded-md font-medium transition-colors ' +
                  (sortMode === m.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex bg-gray-100 rounded-md p-0.5">
            {Object.entries(BASES).map(([key, val]) => (
              <button key={key} onClick={() => setProximityBase(key)}
                className={'px-2.5 py-1 rounded-md font-medium transition-colors ' +
                  (proximityBase === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                📍 {val.name}
              </button>
            ))}
          </div>
          <select value={radiusFilter} onChange={(e) => setRadiusFilter(parseInt(e.target.value))}
            className="border rounded-md px-2 py-1 text-xs">
            <option value="0">∞ km</option>
            <option value="30">≤ 30km</option>
            <option value="50">≤ 50km</option>
            <option value="100">≤ 100km</option>
            <option value="150">≤ 150km</option>
          </select>
          <select value={departementFilter} onChange={(e) => setDepartementFilter(e.target.value)}
            className="border rounded-md px-2 py-1 text-xs">
            <option value="">Tous dép.</option>
            {departements.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={effectifFilter} onChange={(e) => setEffectifFilter(e.target.value)}
            className="border rounded-md px-2 py-1 text-xs">
            <option value="">Effectif</option><option value="1-5">1-5</option><option value="6-19">6-19</option><option value="20-49">20-49</option><option value="50-99">50-99</option><option value="100-249">100-249</option><option value="250+">250+</option>
          </select>
          <select value={formeFilter} onChange={(e) => setFormeFilter(e.target.value)}
            className="border rounded-md px-2 py-1 text-xs">
            <option value="">Forme jur.</option><option value="SAS/SASU">SAS/SASU</option><option value="SARL/EURL">SARL/EURL</option><option value="SA/SCA">SA/SCA</option><option value="EI">EI</option><option value="Association">Association</option><option value="Public">Public</option><option value="Autre">Autre</option>
          </select>
          <span className="text-gray-400 ml-auto">{prospects.length} chargés</span>
        </div>

        {/* Recherche */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher par nom, ville ou SIRET..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm" />
          {searchTerm && (
            <button onClick={() => { setSearchTerm(''); setSearchResults(null) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <XCircle className="w-4 h-4" />
            </button>
          )}
          {searchResults !== null && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-72 overflow-y-auto">
              {searching ? (
                <div className="p-4 text-center text-gray-500 text-sm"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Recherche...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">Aucun résultat</div>
              ) : (
                searchResults.map(p => (
                  <button key={p.id} onClick={() => selectSearchResult(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 text-sm">{p.name}</span>
                      <span className="flex items-center gap-2 text-xs">
                        {p.enrichment_status === 'done' && <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded">✓ Enrichi</span>}
                        {p.enrichment_status === 'failed' && <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">✗ Exclu</span>}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      📍 {p.city} ({p.departement}) {p.effectif && '• 👥 ' + getEffectifLabel(p.effectif)} {p.phone && '• 📞 ' + p.phone}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Fiche Prospect ─────────────────────────────────────────── */}
      {!current ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Tout est enrichi !</h2>
          <p className="text-gray-600">Aucun prospect restant à traiter.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* En-tête prospect */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    {current.name}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-600 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {current.city} ({current.postal_code?.slice(0, 2)})</span>
                    {current.effectif && <span>👥 {getEffectifLabel(current.effectif)}</span>}
                    {current.forme_juridique && <span className="text-gray-400">{getFormeLabel(current.forme_juridique)}</span>}
                    {current.naf && <span className="text-gray-400">{getNafLabel(current.naf)}</span>}
                  </div>
                  {current.address && <p className="text-xs text-gray-400 mt-1">{current.address}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    SIREN: {current.siren} • Score: {current.quality_score}
                    {current._dist != null && <span className="ml-2 text-primary-600 font-medium">📏 ~{Math.round(current._dist)}km</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowEditModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-medium border border-amber-200 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" /> Modifier
                  </button>
                  <span className="text-sm text-gray-400 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                    {currentIndex + 1}/{prospects.length}
                  </span>
                </div>
              </div>
            </div>

            {/* ─── Champs identité (si fiche incomplète) ───────────── */}
            {isManualProspect(current) && (
              <div className="px-6 py-3 bg-amber-50/50 border-b border-amber-100">
                <p className="text-xs font-medium text-amber-700 mb-2">⚠️ Fiche incomplète — compléter les infos :</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">SIREN</label>
                    <input type="text" value={editSiren} onChange={e => setEditSiren(e.target.value)}
                      placeholder="123456789" maxLength={9}
                      className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">SIRET</label>
                    <input type="text" value={editSiret} onChange={e => setEditSiret(e.target.value)}
                      placeholder="12345678901234" maxLength={14}
                      className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Code postal</label>
                    <input type="text" value={editPostalCode} onChange={e => setEditPostalCode(e.target.value)}
                      placeholder="29000" maxLength={5}
                      className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Ville</label>
                    <input type="text" value={editCity} onChange={e => setEditCity(e.target.value)}
                      placeholder="Concarneau"
                      className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 bg-white" />
                  </div>
                </div>
              </div>
            )}

            <div className="p-6">
              {/* ─── Bloc Mini-Lusha : Dirigeant + Emails ───────────── */}
              <div className="mb-5">
                {lushaLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                    <Loader className="w-4 h-4 animate-spin" /> Recherche du dirigeant...
                  </div>
                ) : lusha ? (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        {lusha.dirigeant_nom ? (
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-amber-600" />
                            <span className="font-semibold text-gray-900">
                              {lusha.dirigeant_prenom} {lusha.dirigeant_nom}
                            </span>
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              {lusha.dirigeant_qualite}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-amber-700 mb-2">Aucun dirigeant trouvé</p>
                        )}

                        {/* Autres dirigeants */}
                        {(() => {
                          const autres = (lusha.tous_dirigeants || []).filter(d => d.nom && d.nom !== lusha.dirigeant_nom)
                          return autres.length > 0 && (
                            <div className="text-xs text-gray-500 mb-2">
                              Aussi : {autres.slice(0, 3).map(d => `${d.prenom || ''} ${d.nom} (${d.qualite || '?'})`.trim()).join(' • ')}
                            </div>
                          )
                        })()}

                        {/* Email patterns */}
                        {lusha.email_patterns?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="text-xs text-gray-500 flex items-center gap-1 mr-1">
                              <Mail className="w-3 h-3" /> Emails possibles :
                            </span>
                            {lusha.email_patterns.slice(0, 6).map(ep => (
                              <button key={ep} onClick={() => copyEmail(ep)}
                                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all ${
                                  copiedEmail === ep
                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                    : email === ep
                                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                      : 'bg-white text-gray-600 border border-gray-200 hover:border-amber-300 hover:bg-amber-50'
                                }`}>
                                {copiedEmail === ep ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {ep}
                              </button>
                            ))}
                          </div>
                        )}

                        {lusha.domain && !lusha.email_patterns?.length && (
                          <p className="text-xs text-amber-600 mt-1">
                            Domaine : {lusha.domain} — pas de dirigeant pour générer les patterns
                          </p>
                        )}

                        {!lusha.domain && !lusha.email_patterns?.length && lusha.dirigeant_nom && (
                          <p className="text-xs text-amber-600 mt-2">
                            💡 Pas de site web trouvé — entre un site ci-dessous pour générer les emails du dirigeant
                          </p>
                        )}
                      </div>

                      {/* Infos complémentaires */}
                      <div className="text-right text-xs text-gray-500 ml-4 shrink-0">
                        {lusha.effectif_actuel && lusha.effectif_actuel !== 'NN' && (
                          <p>Effectif API : <strong>{lusha.effectif_actuel}</strong></p>
                        )}
                        {lusha.etat_administratif === 'A' && (
                          <p className="text-green-600">✓ Active</p>
                        )}
                        {lusha.etat_administratif === 'C' && (
                          <p className="text-red-600 font-semibold">✗ Cessée</p>
                        )}
                      </div>
                    </div>

                    {/* Bouton rechercher coordonnées */}
                    <div className="mt-3 pt-3 border-t border-amber-200 flex items-center gap-2">
                      <button onClick={rechercherCoordonnees}
                        disabled={scraping}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                        {scraping ? (
                          <><Loader className="w-3.5 h-3.5 animate-spin" /> Recherche...</>
                        ) : (
                          <><Search className="w-3.5 h-3.5" /> {siteWeb ? 'Scraper le site' : 'Chercher coordonnées'}</>
                        )}
                      </button>
                      {siteWeb && lusha.dirigeant_nom && !lusha.email_patterns?.length && (
                        <button onClick={() => enrichViaAPI({ ...current, site_web: siteWeb })}
                          disabled={lushaLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-sm font-medium transition-colors">
                          <Mail className="w-3.5 h-3.5" /> Générer emails
                        </button>
                      )}
                      {scraping && <span className="text-xs text-amber-600">⏳ Scraping du site en cours...</span>}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 py-2">
                    Pas de données API disponibles
                  </div>
                )}
              </div>

              {/* ─── Signaux recrutement ────────────────────────────── */}
              <div className="mb-5">
                <button onClick={loadSignaux}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
                  {signauxLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                  Signaux recrutement
                  {signaux && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      signaux.match ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {signaux.match ? `${signaux.match.count} offre(s) !` : `${signaux.total_offres} dans le secteur`}
                    </span>
                  )}
                  {showSignaux ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                
                {showSignaux && signaux && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    {signaux.match ? (
                      <div className="mb-2">
                        <p className="font-semibold text-green-700 flex items-center gap-1">
                          <Briefcase className="w-4 h-4" />
                          🔥 Cette entreprise recrute ! {signaux.match.count} offre(s) active(s)
                        </p>
                        <div className="mt-1 text-xs text-gray-600">
                          {signaux.match.offres?.slice(0, 3).map((o, i) => (
                            <p key={i} className="ml-5">• {o.intitule || o.titre} ({o.lieu || ''})</p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-blue-700 mb-2">
                        Pas d'offre directe, mais <strong>{signaux.total_offres} offres</strong> dans le dép. {signaux.departement}
                        {signaux.secteur && <> en <strong>{signaux.secteur}</strong></>}
                      </p>
                    )}
                    {signaux.top5?.length > 0 && (
                      <details className="text-xs text-gray-600">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                          Top recruteurs du secteur ({signaux.total_entreprises} entreprises)
                        </summary>
                        <div className="mt-1 ml-4">
                          {signaux.top5.map((e, i) => (
                            <p key={i}>{e.nom} — {e.count} offre(s)</p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>

              {/* ─── Recherche manuelle ─────────────────────────────── */}
              <div className="flex gap-2 mb-5">
                <button onClick={openPJ}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Pages Jaunes
                </button>
                <button onClick={openGoogle}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                  <Search className="w-3.5 h-3.5" /> Google
                </button>
                <button onClick={openSociete}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Societe.com
                </button>
              </div>

              {/* ─── Champs de saisie ──────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <Phone className="w-4 h-4" /> Téléphone
                  </label>
                  <input ref={phoneRef} type="tel" value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="02 98 12 34 56"
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <Mail className="w-4 h-4" /> Email
                    {lusha?.email_patterns?.includes(email) && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">pattern</span>
                    )}
                  </label>
                  <input type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@entreprise.fr"
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <Globe className="w-4 h-4" /> Site web
                  </label>
                  <div className="flex gap-2">
                    <input type="url" value={siteWeb}
                      onChange={(e) => setSiteWeb(e.target.value)}
                      onBlur={() => { if (siteWeb && !phone) scrapeWebsite() }}
                      placeholder="www.entreprise.fr"
                      className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                    {siteWeb && (
                      <button onClick={scrapeWebsite} disabled={scraping}
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium whitespace-nowrap">
                        {scraping ? '⏳' : '🔍'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Actions ──────────────────────────────────────────── */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button onClick={handleNotFound}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium text-sm transition-colors">
                <XCircle className="w-4 h-4" /> Exclure
              </button>
              <div className="flex gap-3">
                <button onClick={handleSkip}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-sm transition-colors">
                  <SkipForward className="w-4 h-4" /> Passer
                  <kbd className="text-xs bg-gray-300 px-1.5 py-0.5 rounded ml-1">Échap</kbd>
                </button>
                <button onClick={handleSave}
                  disabled={saving || (!phone && !email && !siteWeb)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    saving || (!phone && !email && !siteWeb)
                      ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}>
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Sauvegarder
                  <kbd className="text-xs bg-green-700 px-1.5 py-0.5 rounded ml-1">Entrée</kbd>
                </button>
              </div>
            </div>
          </div>

          {/* Raccourcis */}
          <div className="mt-3 text-center text-xs text-gray-400">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Entrée</kbd> Sauvegarder
            <span className="mx-3">•</span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Échap</kbd> Passer
            <span className="mx-3">•</span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Ctrl+O</kbd> Pages Jaunes
          </div>
        </>
      )}

      {/* ─── Modal Modifier la fiche ─────────────────────────────── */}
      {showEditModal && current && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">✏️ Modifier la fiche</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SIREN</label>
                  <input type="text" value={editSiren} onChange={e => setEditSiren(e.target.value)}
                    placeholder="123456789" maxLength={9}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SIRET</label>
                  <input type="text" value={editSiret} onChange={e => setEditSiret(e.target.value)}
                    placeholder="12345678901234" maxLength={14}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)}
                  placeholder="12 rue du Port"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                  <input type="text" value={editPostalCode} onChange={e => setEditPostalCode(e.target.value)}
                    placeholder="29000" maxLength={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <input type="text" value={editCity} onChange={e => setEditCity(e.target.value)}
                    placeholder="Concarneau"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="02 98 XX XX XX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="contact@..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Site web</label>
                  <input type="text" value={siteWeb} onChange={e => setSiteWeb(e.target.value)}
                    placeholder="www...."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Fermer</button>
              <button onClick={() => { setShowEditModal(false); handleSave() }}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
