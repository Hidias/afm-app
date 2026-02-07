/**
 * ============================================================================
 * ENRICHISSEMENT RAPIDE AVEC AUTO-ENRICHIR
 * ============================================================================
 * 
 * À METTRE : afm-app-main/src/components/EnrichissementAuto.jsx
 * 
 * Charge les prospects sans téléphone et propose :
 * - Bouton "Auto-enrichir" → scrape Pages Jaunes + site web (1 clic)
 * - Pré-remplit téléphone, site web, email
 * - Tu vérifies et valides
 * - Workflow : 1 clic → vérifier → sauvegarder
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Search, Phone, Globe, Mail, CheckCircle, SkipForward,
  Building2, MapPin, RefreshCw, Zap, ExternalLink, Loader,
  ChevronLeft, ChevronRight, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function EnrichissementAuto() {
  const [prospects, setProspects] = useState([])
  const [current, setCurrent] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [totalNonEnrichis, setTotalNonEnrichis] = useState(0)
  const [departementFilter, setDepartementFilter] = useState('')
  const [effectifFilter, setEffectifFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Champs éditables
  const [phone, setPhone] = useState('')
  const [siteWeb, setSiteWeb] = useState('')
  const [email, setEmail] = useState('')
  
  // États auto-enrichissement
  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState(null)
  const [saving, setSaving] = useState(false)
  
  // Stats session
  const [sessionStats, setSessionStats] = useState({ enrichis: 0, passes: 0, autoOk: 0 })

  const departements = [...new Set(prospects.map(p => p.departement))].filter(Boolean).sort()
  const effectifs = [...new Set(prospects.map(p => p.effectif_label))].filter(Boolean).sort()

  useEffect(() => { loadProspects() }, [departementFilter, effectifFilter])

  async function loadProspects() {
    setLoading(true)
    try {
      let query = supabase
        .from('prospection_massive')
        .select('id, siret, siren, name, city, postal_code, phone, email, site_web, departement, effectif, effectif_label, quality_score, naf_label, dirigeant, adresse', { count: 'exact' })
        .is('phone', null)
        .order('quality_score', { ascending: false })
        .limit(100)

      if (departementFilter) query = query.eq('departement', departementFilter)
      if (effectifFilter) query = query.eq('effectif_label', effectifFilter)

      const { data, error, count } = await query
      if (error) throw error

      setProspects(data || [])
      setTotalNonEnrichis(count || 0)

      if (data && data.length > 0) {
        selectProspect(data[0], 0)
      }
    } catch (err) {
      console.error('Erreur chargement:', err)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  function selectProspect(prospect, index) {
    setCurrent(prospect)
    setCurrentIndex(index)
    setPhone(prospect.phone || '')
    setSiteWeb(prospect.site_web || '')
    setEmail(prospect.email || '')
    setEnrichResult(null)
  }

  // ---- AUTO-ENRICHIR ----
  async function autoEnrich() {
    if (!current) return
    setEnriching(true)
    setEnrichResult(null)

    try {
      const response = await fetch('/api/auto-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: current.name,
          city: current.city,
          postal_code: current.postal_code,
          site_web: siteWeb || current.site_web,
        })
      })

      const data = await response.json()
      setEnrichResult(data)

      // Pré-remplir les champs trouvés (sans écraser ce qui existe déjà)
      if (data.phone && !phone) setPhone(data.phone)
      if (data.site_web && !siteWeb) setSiteWeb(data.site_web)
      if (data.email && !email) setEmail(data.email)

      const found = [data.phone && 'tél', data.site_web && 'site', data.email && 'email'].filter(Boolean)
      if (found.length > 0) {
        toast.success(`Trouvé : ${found.join(', ')}`)
        setSessionStats(prev => ({ ...prev, autoOk: prev.autoOk + 1 }))
      } else {
        toast('Rien trouvé automatiquement', { icon: '🤷' })
      }
    } catch (error) {
      console.error('Auto-enrich error:', error)
      toast.error('Erreur auto-enrichissement')
    } finally {
      setEnriching(false)
    }
  }

  // ---- SAUVEGARDER ----
  async function handleSave() {
    if (!current) return
    if (!phone && !siteWeb && !email) {
      toast.error('Remplissez au moins un champ')
      return
    }

    setSaving(true)
    try {
      const updates = { updated_at: new Date().toISOString() }
      if (phone) updates.phone = phone
      if (siteWeb) updates.site_web = siteWeb
      if (email) updates.email = email

      const { error } = await supabase
        .from('prospection_massive')
        .update(updates)
        .eq('id', current.id)

      if (error) throw error

      toast.success('✅ Prospect enrichi !')
      setSessionStats(prev => ({ ...prev, enrichis: prev.enrichis + 1 }))
      goNext()
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  function goNext() {
    const nextIndex = currentIndex + 1
    if (nextIndex < prospects.length) {
      selectProspect(prospects[nextIndex], nextIndex)
    } else {
      loadProspects()
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      selectProspect(prospects[currentIndex - 1], currentIndex - 1)
    }
  }

  function handleSkip() {
    setSessionStats(prev => ({ ...prev, passes: prev.passes + 1 }))
    goNext()
  }

  // Ouvrir Google dans un nouvel onglet (fallback manuel)
  function openGoogle() {
    if (!current) return
    const query = encodeURIComponent(`${current.name} ${current.city} téléphone`)
    window.open(`https://www.google.com/search?q=${query}`, '_blank')
  }

  function openPagesJaunes() {
    if (!current) return
    const query = encodeURIComponent(current.name)
    const location = encodeURIComponent(current.city || '')
    window.open(`https://www.pagesjaunes.fr/annuaire/chercherlespros?quoiqui=${query}&ou=${location}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header + Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔍 Enrichissement rapide</h1>
          <p className="text-gray-600 mt-1">
            {totalNonEnrichis.toLocaleString()} prospects sans téléphone
            {departementFilter && ` (dép. ${departementFilter})`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
              ✅ {sessionStats.enrichis} enrichis
            </span>
            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-medium">
              🤖 {sessionStats.autoOk} auto
            </span>
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
              ⏭️ {sessionStats.passes} passés
            </span>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-3">
        <select value={departementFilter} onChange={(e) => setDepartementFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
          <option value="">Tous les dép.</option>
          {['22', '29', '35', '56', '44', '49', '53', '72', '85'].map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={effectifFilter} onChange={(e) => setEffectifFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
          <option value="">Tous effectifs</option>
          {effectifs.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={loadProspects} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg" title="Recharger">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {!current ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Tous les prospects sont enrichis !</h2>
          <p className="text-gray-600">Changez de filtre ou importez de nouveaux prospects</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          
          {/* Colonne gauche - Info entreprise */}
          <div className="col-span-1 space-y-3">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">{currentIndex + 1} / {prospects.length}</span>
                <div className="flex gap-1">
                  <button onClick={goPrev} disabled={currentIndex === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={goNext} disabled={currentIndex >= prospects.length - 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                {current.name}
              </h2>
              
              <div className="text-sm text-gray-600 space-y-1 mt-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {current.adresse && <span>{current.adresse}, </span>}
                  {current.postal_code} {current.city}
                </div>
                {current.departement && <div className="text-xs text-gray-500">Département {current.departement}</div>}
                {current.effectif_label && <div>👥 {current.effectif_label}</div>}
                {current.naf_label && <div className="text-xs">🏭 {current.naf_label}</div>}
                {current.dirigeant && <div>👤 {current.dirigeant}</div>}
                {current.siret && <div className="text-xs text-gray-400">SIRET: {current.siret}</div>}
                {current.quality_score && (
                  <div className="mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      current.quality_score >= 70 ? 'bg-green-100 text-green-800' :
                      current.quality_score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      Score: {current.quality_score}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Raccourcis recherche manuelle */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">🔗 Recherche manuelle</h3>
              <div className="space-y-2">
                <button onClick={openGoogle}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm text-blue-700 transition-colors">
                  <ExternalLink className="w-4 h-4" /> Google → {current.name}
                </button>
                <button onClick={openPagesJaunes}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-yellow-50 hover:bg-yellow-100 rounded-lg text-sm text-yellow-700 transition-colors">
                  <ExternalLink className="w-4 h-4" /> Pages Jaunes → {current.name}
                </button>
                {siteWeb && (
                  <a href={siteWeb.startsWith('http') ? siteWeb : `https://${siteWeb}`} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 rounded-lg text-sm text-green-700 transition-colors">
                    <Globe className="w-4 h-4" /> Ouvrir le site web
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Colonne droite - Enrichissement */}
          <div className="col-span-2 space-y-3">
            
            {/* BOUTON AUTO-ENRICHIR */}
            <button
              onClick={autoEnrich}
              disabled={enriching}
              className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold text-lg transition-all ${
                enriching
                  ? 'bg-purple-100 text-purple-400 cursor-wait'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
              }`}
            >
              {enriching ? (
                <>
                  <Loader className="w-6 h-6 animate-spin" />
                  Recherche en cours... (Pages Jaunes + site web)
                </>
              ) : (
                <>
                  <Zap className="w-6 h-6" />
                  ⚡ Auto-enrichir en 1 clic
                </>
              )}
            </button>

            {/* Résultat auto-enrichissement */}
            {enrichResult && (
              <div className={`rounded-lg p-3 text-sm ${
                enrichResult.sources?.length > 0 ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {enrichResult.sources?.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                  )}
                  <span className="font-medium">
                    {enrichResult.sources?.length > 0 
                      ? `Trouvé via ${[...new Set(enrichResult.sources)].join(' + ')}`
                      : 'Rien trouvé — utilisez les liens manuels ci-dessous'}
                  </span>
                </div>
                {enrichResult.warning && (
                  <div className="text-xs text-orange-600 mt-1">{enrichResult.warning}</div>
                )}
              </div>
            )}

            {/* Formulaire d'enrichissement */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">📋 Coordonnées</h3>
              
              {/* Téléphone */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Phone className="w-4 h-4" /> Téléphone
                  {enrichResult?.phone && phone === enrichResult.phone && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">auto</span>
                  )}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="02 98 XX XX XX"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
                />
              </div>

              {/* Site web */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Globe className="w-4 h-4" /> Site web
                  {enrichResult?.site_web && siteWeb === enrichResult.site_web && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">auto</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={siteWeb}
                    onChange={(e) => setSiteWeb(e.target.value)}
                    placeholder="https://www.exemple.fr"
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {siteWeb && (
                    <a href={siteWeb.startsWith('http') ? siteWeb : `https://${siteWeb}`} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg" title="Ouvrir">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-4 h-4" /> Email
                  {enrichResult?.email && email === enrichResult.email && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">auto</span>
                  )}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@entreprise.fr"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || (!phone && !siteWeb && !email)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-lg transition-colors ${
                  saving || (!phone && !siteWeb && !email)
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {saving ? (
                  <><Loader className="w-5 h-5 animate-spin" /> Sauvegarde...</>
                ) : (
                  <><CheckCircle className="w-5 h-5" /> 💾 Sauvegarder & Suivant</>
                )}
              </button>
              <button
                onClick={handleSkip}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 font-medium"
              >
                <SkipForward className="w-5 h-5" /> Passer
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
