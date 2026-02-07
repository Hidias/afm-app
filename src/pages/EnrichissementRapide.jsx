/**
 * ============================================================================
 * ENRICHISSEMENT RAPIDE - Semi-automatisé via Pages Jaunes
 * ============================================================================
 * 
 * Mode turbo : ouvre PJ dans un nouvel onglet (IP résidentielle = pas de blocage),
 * l'utilisateur copie le téléphone et le colle ici.
 * 
 * Raccourcis clavier :
 * - Entrée : Sauvegarder et passer au suivant
 * - Échap : Passer sans sauvegarder
 * - Ctrl+O : Ouvrir Pages Jaunes
 * ============================================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Search, SkipForward, Save, ExternalLink, Phone, Mail, Globe,
  ChevronRight, Zap, CheckCircle, XCircle, RefreshCw, Filter
} from 'lucide-react'

// Mapping code NAF (division 2 chiffres) → libellé secteur d'activité
const NAF_LABELS = {
  '01': 'Culture et production animale',
  '02': 'Sylviculture et exploitation forestière',
  '03': 'Pêche et aquaculture',
  '05': 'Extraction de houille et lignite',
  '06': 'Extraction d\'hydrocarbures',
  '07': 'Extraction de minerais métalliques',
  '08': 'Autres industries extractives',
  '09': 'Services de soutien aux industries extractives',
  '10': 'Industries alimentaires',
  '11': 'Fabrication de boissons',
  '12': 'Fabrication de produits à base de tabac',
  '13': 'Fabrication de textiles',
  '14': 'Industrie de l\'habillement',
  '15': 'Industrie du cuir et de la chaussure',
  '16': 'Travail du bois (menuiserie, charpente)',
  '17': 'Industrie du papier et du carton',
  '18': 'Imprimerie et reproduction',
  '20': 'Industrie chimique',
  '21': 'Industrie pharmaceutique',
  '22': 'Fabrication de produits en caoutchouc et plastique',
  '23': 'Fabrication de produits minéraux non métalliques',
  '24': 'Métallurgie',
  '25': 'Fabrication de produits métalliques',
  '26': 'Fabrication de produits informatiques et électroniques',
  '27': 'Fabrication d\'équipements électriques',
  '28': 'Fabrication de machines et équipements',
  '29': 'Industrie automobile',
  '30': 'Fabrication de matériels de transport',
  '31': 'Fabrication de meubles',
  '32': 'Autres industries manufacturières',
  '33': 'Réparation et installation de machines',
  '35': 'Production et distribution d\'électricité, gaz',
  '36': 'Captage, traitement et distribution d\'eau',
  '37': 'Collecte et traitement des eaux usées',
  '38': 'Collecte, traitement et élimination des déchets',
  '39': 'Dépollution et gestion des déchets',
  '41': 'Construction de bâtiments',
  '42': 'Génie civil',
  '43': 'Travaux de construction spécialisés',
  '45': 'Commerce et réparation automobiles',
  '46': 'Commerce de gros',
  '47': 'Commerce de détail',
  '49': 'Transports terrestres',
  '50': 'Transports par eau',
  '51': 'Transports aériens',
  '52': 'Entreposage et services auxiliaires des transports',
  '53': 'Activités de poste et de courrier',
  '55': 'Hébergement',
  '56': 'Restauration',
  '58': 'Édition',
  '59': 'Production de films, vidéo, musique',
  '60': 'Programmation et diffusion',
  '61': 'Télécommunications',
  '62': 'Programmation et conseil informatique',
  '63': 'Services d\'information',
  '64': 'Services financiers (banque)',
  '65': 'Assurance',
  '66': 'Activités auxiliaires de services financiers',
  '68': 'Activités immobilières',
  '69': 'Activités juridiques et comptables',
  '70': 'Conseil de gestion',
  '71': 'Architecture, ingénierie, contrôle technique',
  '72': 'Recherche-développement scientifique',
  '73': 'Publicité et études de marché',
  '74': 'Autres activités spécialisées (design, photo)',
  '75': 'Activités vétérinaires',
  '77': 'Activités de location',
  '78': 'Activités liées à l\'emploi (intérim)',
  '79': 'Agences de voyage et voyagistes',
  '80': 'Enquêtes et sécurité',
  '81': 'Services relatifs aux bâtiments (nettoyage)',
  '82': 'Services administratifs et de soutien',
  '84': 'Administration publique et défense',
  '85': 'Enseignement',
  '86': 'Activités pour la santé humaine',
  '87': 'Hébergement médico-social et social',
  '88': 'Action sociale sans hébergement',
  '90': 'Activités créatives, artistiques et de spectacle',
  '91': 'Bibliothèques, musées et patrimoine',
  '92': 'Organisation de jeux de hasard',
  '93': 'Activités sportives, récréatives et de loisirs',
  '94': 'Activités des organisations associatives',
  '95': 'Réparation d\'ordinateurs et de biens personnels',
  '96': 'Autres services personnels (coiffure, beauté)',
  '97': 'Activités des ménages en tant qu\'employeurs',
  '99': 'Organisations et organismes extraterritoriaux',
}

function getNafLabel(naf) {
  if (!naf) return null
  const code = naf.replace(/\./g, '').substring(0, 2)
  return NAF_LABELS[code] || naf
}

const EFFECTIF_LABELS = {
  '00': '0 sal.', '01': '1-2 sal.', '02': '3-5 sal.', '03': '6-9 sal.',
  '11': '10-19 sal.', '12': '20-49 sal.', '21': '50-99 sal.', '22': '100-199 sal.',
  '31': '200-249 sal.', '32': '250-499 sal.', '41': '500-999 sal.', '42': '1000-1999 sal.',
  '51': '2000-4999 sal.', '52': '5000-9999 sal.', '53': '10000+ sal.',
}

function getEffectifLabel(code) {
  if (!code) return null
  return EFFECTIF_LABELS[String(code)] || code + ' sal.'
}

export default function EnrichissementRapide() {
  const [prospects, setProspects] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [siteWeb, setSiteWeb] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dbStats, setDbStats] = useState({ done: 0, phones: 0, emails: 0, excluded: 0 })
  const [sessionStats, setSessionStats] = useState({ done: 0, phones: 0, emails: 0, excluded: 0 })
  const [totalRemaining, setTotalRemaining] = useState(0)
  const [departementFilter, setDepartementFilter] = useState('')
  const [departements, setDepartements] = useState([])

  const phoneRef = useRef(null)

  // Charger les départements disponibles
  useEffect(() => {
    async function loadDepartements() {
      const { data } = await supabase
        .from('prospection_massive')
        .select('departement')
        .is('phone', null)
      
      if (data) {
        const depts = [...new Set(data.map(d => d.departement).filter(Boolean))].sort()
        setDepartements(depts)
      }
    }
    loadDepartements()
  }, [])

  // Charger les stats globales depuis la base
  async function loadStats() {
    const [
      { count: doneCount },
      { count: phoneCount },
      { count: emailCount },
      { count: excludedCount },
    ] = await Promise.all([
      supabase.from('prospection_massive').select('id', { count: 'exact', head: true }).eq('enrichment_status', 'done').eq('phone_source', 'manual_pj'),
      supabase.from('prospection_massive').select('id', { count: 'exact', head: true }).not('phone', 'is', null).eq('phone_source', 'manual_pj'),
      supabase.from('prospection_massive').select('id', { count: 'exact', head: true }).not('email', 'is', null).eq('email_source', 'manual_pj'),
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

  // Charger un batch de prospects
  const loadProspects = useCallback(async () => {
    setLoading(true)
    
    let query = supabase
      .from('prospection_massive')
      .select('id, siret, siren, name, city, postal_code, address, naf, phone, email, site_web, departement, effectif, quality_score')
      .is('phone', null)
      .or('enrichment_status.is.null,enrichment_status.eq.pending,enrichment_status.eq.enriching')
      .order('quality_score', { ascending: false })
      .limit(100)

    if (departementFilter) {
      query = query.eq('departement', departementFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erreur chargement:', error)
      setLoading(false)
      return
    }

    // Dédupliquer par SIREN (garder le premier = meilleur score)
    const seen = new Set()
    const unique = (data || []).filter(p => {
      if (seen.has(p.siren)) return false
      seen.add(p.siren)
      return true
    }).slice(0, 50)

    setProspects(unique)
    setCurrentIndex(0)
    resetFields()

    // Compter le total restant (approximatif)
    let countQuery = supabase
      .from('prospection_massive')
      .select('id', { count: 'exact', head: true })
      .is('phone', null)
      .or('enrichment_status.is.null,enrichment_status.eq.pending,enrichment_status.eq.enriching')

    if (departementFilter) {
      countQuery = countQuery.eq('departement', departementFilter)
    }

    const { count } = await countQuery
    setTotalRemaining(count || 0)

    setLoading(false)
  }, [departementFilter])

  useEffect(() => {
    loadProspects()
  }, [loadProspects])

  const current = prospects[currentIndex]

  function resetFields() {
    setPhone('')
    setEmail('')
    setSiteWeb('')
  }

  // Passer au prospect suivant
  function goNext() {
    resetFields()
    if (currentIndex < prospects.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      // Recharger un nouveau batch
      loadProspects()
    }
    // Focus sur le champ téléphone
    setTimeout(() => phoneRef.current?.focus(), 100)
  }

  // Sauvegarder les données
  async function handleSave() {
    if (!current) return
    if (!phone && !email && !siteWeb) {
      goNext()
      return
    }

    setSaving(true)

    const update = {
      updated_at: new Date().toISOString(),
      enrichment_status: 'done',
      enrichment_last_attempt: new Date().toISOString(),
      enrichment_attempts: 99,
    }

    if (phone) {
      // Normaliser le téléphone
      let cleanPhone = phone.replace(/[\s.\-()]/g, '')
      if (cleanPhone.startsWith('+33')) cleanPhone = '0' + cleanPhone.slice(3)
      if (cleanPhone.startsWith('0033')) cleanPhone = '0' + cleanPhone.slice(4)
      
      if (/^0[1-9]\d{8}$/.test(cleanPhone)) {
        update.phone = cleanPhone.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
        update.phone_source = 'manual_pj'
      } else {
        update.phone = phone.trim()
        update.phone_source = 'manual_pj'
      }
    }

    if (email) {
      update.email = email.trim().toLowerCase()
      update.email_source = 'manual_pj'
    }

    if (siteWeb) {
      update.site_web = siteWeb.trim()
    }

    const { error } = await supabase
      .from('prospection_massive')
      .update(update)
      .eq('siren', current.siren)

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

  // Passer sans sauvegarder
  function handleSkip() {
    if (!current) return
    goNext()
  }

  // Marquer comme introuvable / exclu
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

  // Ouvrir Pages Jaunes
  function openPJ() {
    if (!current) return
    const cleanName = current.name
      .replace(/\b(SAS|SARL|SA|EURL|SCI|SNC|SASU)\b/gi, '')
      .replace(/[^\w\sÀ-ÿ-]/g, '')
      .trim()
    const city = current.city || ''
    const url = `https://www.pagesjaunes.fr/pagesblanches/recherche?quoiqui=${encodeURIComponent(cleanName)}&ou=${encodeURIComponent(city)}`
    window.open(url, '_blank')
  }

  // Ouvrir recherche Google
  function openGoogle() {
    if (!current) return
    const query = `${current.name} ${current.city || ''} téléphone`
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank')
  }

  // Ouvrir Societe.com
  function openSociete() {
    if (!current) return
    const query = current.siren || current.siret?.slice(0, 9) || current.name
    window.open(`https://www.societe.com/cgi-bin/search?champs=${encodeURIComponent(query)}`, '_blank')
  }

  // Raccourcis clavier
  useEffect(() => {
    function handleKeyDown(e) {
      // Ignorer si on tape dans un input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleSave()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          handleSkip()
        }
        return
      }

      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault()
        openPJ()
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        handleSkip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [current, phone, email, siteWeb])

  // Focus auto sur le champ téléphone
  useEffect(() => {
    if (current && phoneRef.current) {
      phoneRef.current.focus()
    }
  }, [currentIndex])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-3 text-lg">Chargement des prospects...</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Stats */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">⚡ Enrichissement Rapide</h1>
            <p className="text-gray-600 mt-1">
              {totalRemaining.toLocaleString()} prospects restants
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={departementFilter}
              onChange={(e) => setDepartementFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Tous les départements</option>
              {departements.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-2xl font-bold text-primary-600">{dbStats.done + sessionStats.done}</p>
            <p className="text-xs text-gray-500">Enrichis</p>
            {sessionStats.done > 0 && <p className="text-xs text-primary-400">+{sessionStats.done} cette session</p>}
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{dbStats.phones + sessionStats.phones}</p>
            <p className="text-xs text-gray-500">📞 Tels</p>
            {sessionStats.phones > 0 && <p className="text-xs text-green-400">+{sessionStats.phones} cette session</p>}
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{dbStats.emails + sessionStats.emails}</p>
            <p className="text-xs text-gray-500">📧 Emails</p>
            {sessionStats.emails > 0 && <p className="text-xs text-blue-400">+{sessionStats.emails} cette session</p>}
          </div>
          <div className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{dbStats.excluded + sessionStats.excluded}</p>
            <p className="text-xs text-gray-500">🚫 Supprimés</p>
            {sessionStats.excluded > 0 && <p className="text-xs text-red-300">+{sessionStats.excluded} cette session</p>}
          </div>
        </div>
      </div>

      {!current ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Tout est enrichi !</h2>
          <p className="text-gray-600">Aucun prospect restant à traiter.</p>
        </div>
      ) : (
        <>
          {/* Fiche Prospect */}
          <div className="bg-white rounded-lg shadow p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{current.name}</h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span>📍 {current.city} ({current.postal_code?.slice(0, 2)})</span>
                  {current.effectif && <span>👥 {getEffectifLabel(current.effectif)}</span>}
                </div>
                {current.address && (
                  <p className="text-sm text-gray-500 mt-1">🏠 {current.address}</p>
                )}
                {current.naf && (
                  <p className="text-sm text-gray-500 mt-1">🏭 {getNafLabel(current.naf)}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  SIRET: {current.siret} • Score: {current.quality_score}
                </p>
              </div>
              <div className="text-sm text-gray-400">
                {currentIndex + 1} / {prospects.length}
              </div>
            </div>

            {/* Boutons de recherche */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={openPJ}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Pages Jaunes
              </button>
              <button
                onClick={openGoogle}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                <Search className="w-4 h-4" />
                Google
              </button>
              <button
                onClick={openSociete}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Societe.com
              </button>
            </div>

            {/* Champs de saisie */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Phone className="w-4 h-4" />
                  Téléphone
                </label>
                <input
                  ref={phoneRef}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="02 98 12 34 56"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@entreprise.fr"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Globe className="w-4 h-4" />
                  Site web
                </label>
                <input
                  type="url"
                  value={siteWeb}
                  onChange={(e) => setSiteWeb(e.target.value)}
                  placeholder="www.entreprise.fr"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleNotFound}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors"
            >
              <XCircle className="w-5 h-5" />
              Exclure (fermé / pas intéressé)
            </button>

            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex items-center gap-2 px-5 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
              >
                <SkipForward className="w-5 h-5" />
                Passer
                <span className="text-xs text-gray-500 ml-1">(Échap)</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!phone && !email && !siteWeb)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  saving || (!phone && !email && !siteWeb)
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {saving ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Sauvegarder & Suivant
                <span className="text-xs text-green-200 ml-1">(Entrée)</span>
              </button>
            </div>
          </div>

          {/* Raccourcis clavier */}
          <div className="mt-6 text-center text-xs text-gray-400">
            <span className="inline-flex items-center gap-4">
              <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Entrée</kbd> Sauvegarder</span>
              <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Échap</kbd> Passer</span>
              <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Ctrl+O</kbd> Ouvrir PJ</span>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
