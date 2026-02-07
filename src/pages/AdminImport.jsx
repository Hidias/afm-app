/**
 * ============================================================================
 * PAGE ADMIN - IMPORT PROSPECTS PAR TRANCHE
 * ============================================================================
 * 
 * À METTRE : afm-app-main/src/pages/AdminImport.jsx
 * 
 * Import par tranche d'effectif pour contourner la limite API 10k résultats
 * Chaque département × tranche = 1 appel API séparé
 * ============================================================================
 */

import { useState, useRef } from 'react'
import { Play, Check, X, Loader, RefreshCw, Square, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

const DEPARTEMENTS = {
  '22': "Côtes-d'Armor",
  '29': 'Finistère',
  '35': 'Ille-et-Vilaine',
  '56': 'Morbihan',
  '44': 'Loire-Atlantique',
  '49': 'Maine-et-Loire',
  '53': 'Mayenne',
  '72': 'Sarthe',
  '85': 'Vendée'
}

const TRANCHES = [
  { code: '53', label: '10000+ sal.' },
  { code: '52', label: '5000-9999' },
  { code: '51', label: '2000-4999' },
  { code: '42', label: '1000-1999' },
  { code: '41', label: '500-999' },
  { code: '32', label: '250-499' },
  { code: '31', label: '200-249' },
  { code: '22', label: '100-199' },
  { code: '21', label: '50-99' },
  { code: '12', label: '20-49' },
  { code: '11', label: '10-19' },
  { code: '03', label: '6-9' },
  { code: '02', label: '3-5' },
  { code: '01', label: '1-2' },
]

export default function AdminImport() {
  const [importing, setImporting] = useState(false)
  const [currentDept, setCurrentDept] = useState(null)
  const [currentTranche, setCurrentTranche] = useState(null)
  const [deptProgress, setDeptProgress] = useState({})
  const [totalStats, setTotalStats] = useState({ recupere: 0, filtre: 0, insere: 0, doublons: 0 })
  const [expandedDepts, setExpandedDepts] = useState({})
  const [selectedDepts, setSelectedDepts] = useState(Object.keys(DEPARTEMENTS))
  const stopRef = useRef(false)

  // Enrichissement
  const [enriching, setEnriching] = useState(false)
  const [enrichBatchSize, setEnrichBatchSize] = useState(20)
  const [enrichStats, setEnrichStats] = useState(null)
  const [enrichHistory, setEnrichHistory] = useState([])

  function toggleDept(code) {
    setSelectedDepts(prev => 
      prev.includes(code) ? prev.filter(d => d !== code) : [...prev, code]
    )
  }

  function toggleExpand(code) {
    setExpandedDepts(prev => ({ ...prev, [code]: !prev[code] }))
  }

  async function importTrancheForDept(dept, trancheCode) {
    try {
      const response = await fetch('/api/import-departement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departement: dept, tranche_effectif: trancheCode })
      })
      
      const data = await response.json()
      return data
    } catch (error) {
      console.error(`Erreur dept ${dept} tranche ${trancheCode}:`, error)
      return { success: false, error: error.message }
    }
  }

  async function lancerImport() {
    setImporting(true)
    stopRef.current = false
    setDeptProgress({})
    setTotalStats({ recupere: 0, filtre: 0, insere: 0, doublons: 0 })
    
    const deptsToImport = selectedDepts.sort()
    toast(`🚀 Import lancé : ${deptsToImport.length} départements × ${TRANCHES.length} tranches`, { duration: 5000 })
    
    let grandTotal = { recupere: 0, filtre: 0, insere: 0, doublons: 0 }
    
    for (const dept of deptsToImport) {
      if (stopRef.current) break
      
      setCurrentDept(dept)
      setExpandedDepts(prev => ({ ...prev, [dept]: true }))
      
      setDeptProgress(prev => ({
        ...prev,
        [dept]: { status: 'loading', tranches: {}, total: { recupere: 0, filtre: 0, insere: 0 } }
      }))
      
      let deptTotal = { recupere: 0, filtre: 0, insere: 0, doublons: 0 }
      
      for (const tranche of TRANCHES) {
        if (stopRef.current) break
        
        setCurrentTranche(tranche.code)
        
        setDeptProgress(prev => ({
          ...prev,
          [dept]: {
            ...prev[dept],
            tranches: {
              ...prev[dept].tranches,
              [tranche.code]: { status: 'loading' }
            }
          }
        }))
        
        const result = await importTrancheForDept(dept, tranche.code)
        
        if (result.success) {
          deptTotal.recupere += result.recupere || 0
          deptTotal.filtre += result.filtre || 0
          deptTotal.insere += result.insere || 0
          deptTotal.doublons += result.doublons || 0
          
          setDeptProgress(prev => ({
            ...prev,
            [dept]: {
              ...prev[dept],
              tranches: {
                ...prev[dept].tranches,
                [tranche.code]: {
                  status: 'success',
                  recupere: result.recupere || 0,
                  filtre: result.filtre || 0,
                  insere: result.insere || 0
                }
              },
              total: { ...deptTotal }
            }
          }))
        } else {
          setDeptProgress(prev => ({
            ...prev,
            [dept]: {
              ...prev[dept],
              tranches: {
                ...prev[dept].tranches,
                [tranche.code]: { status: 'error', error: result.error }
              }
            }
          }))
        }
        
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      grandTotal.recupere += deptTotal.recupere
      grandTotal.filtre += deptTotal.filtre
      grandTotal.insere += deptTotal.insere
      grandTotal.doublons += deptTotal.doublons
      setTotalStats({ ...grandTotal })
      
      setDeptProgress(prev => ({
        ...prev,
        [dept]: { ...prev[dept], status: stopRef.current ? 'stopped' : 'success' }
      }))
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    setCurrentDept(null)
    setCurrentTranche(null)
    setImporting(false)
    
    if (stopRef.current) {
      toast('⏹ Import arrêté', { duration: 3000 })
    } else {
      toast.success(`✅ Import terminé ! ${grandTotal.insere.toLocaleString()} prospects insérés`)
    }
  }

  function arreterImport() {
    stopRef.current = true
    toast('⏹ Arrêt demandé, fin de la tranche en cours...', { duration: 3000 })
  }

  // ---- Enrichissement ----
  async function lancerEnrichissement() {
    setEnriching(true)
    setEnrichStats(null)
    toast('🔍 Enrichissement lancé...', { duration: 3000 })
    
    try {
      const response = await fetch('/api/enrich-prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_size: enrichBatchSize })
      })
      
      const data = await response.json()
      setEnrichStats(data)
      setEnrichHistory(prev => [...prev, data])
      
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error('Erreur: ' + (data.error || 'inconnue'))
      }
    } catch (error) {
      toast.error('Erreur: ' + error.message)
    }
    
    setEnriching(false)
  }

  async function lancerEnrichissementBoucle() {
    setEnriching(true)
    setEnrichHistory([])
    toast('🔄 Enrichissement en boucle (5 batchs)...', { duration: 5000 })
    
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch('/api/enrich-prospects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_size: enrichBatchSize })
        })
        
        const data = await response.json()
        setEnrichStats(data)
        setEnrichHistory(prev => [...prev, data])
        
        if (!data.success || data.stats?.total === 0) break
        
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error) {
        toast.error('Erreur batch ' + (i + 1) + ': ' + error.message)
        break
      }
    }
    
    toast.success('✅ Enrichissement en boucle terminé !')
    setEnriching(false)
  }

  // Calcul progression globale
  const completedTranches = Object.values(deptProgress).reduce((sum, dept) => {
    return sum + Object.values(dept.tranches || {}).filter(t => t.status === 'success' || t.status === 'error').length
  }, 0)
  const totalTranches = selectedDepts.length * TRANCHES.length
  const progressPercent = totalTranches > 0 ? Math.round((completedTranches / totalTranches) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔧 Import Prospects
          </h1>
          <p className="text-gray-600">
            Import par tranche d'effectif — aucune limite de résultats
          </p>
        </div>

        {/* SÉLECTION DÉPARTEMENTS */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">📍 Départements à importer</h2>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(DEPARTEMENTS).map(([code, name]) => (
              <button
                key={code}
                onClick={() => toggleDept(code)}
                disabled={importing}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDepts.includes(code)
                    ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-500 border-2 border-transparent'
                } ${importing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:opacity-80'}`}
              >
                {code} - {name}
              </button>
            ))}
          </div>

          <div className="text-sm text-gray-500 mb-4">
            {selectedDepts.length} départements × {TRANCHES.length} tranches = {selectedDepts.length * TRANCHES.length} appels API
            <span className="ml-2 text-gray-400">• SCI et auto-entrepreneurs exclus</span>
          </div>
          
          <div className="flex gap-3">
            {!importing ? (
              <button
                onClick={lancerImport}
                disabled={selectedDepts.length === 0}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
                  selectedDepts.length === 0
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Play className="w-5 h-5" />
                Lancer l'import
              </button>
            ) : (
              <button
                onClick={arreterImport}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white"
              >
                <Square className="w-5 h-5" />
                Arrêter
              </button>
            )}
          </div>
        </div>

        {/* PROGRESSION */}
        {(importing || completedTranches > 0) && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">📊 Progression</h2>
              <div className="flex items-center gap-4 text-sm">
                {importing && currentDept && (
                  <span className="text-blue-600 flex items-center gap-1">
                    <Loader className="w-4 h-4 animate-spin" />
                    {DEPARTEMENTS[currentDept]} — {TRANCHES.find(t => t.code === currentTranche)?.label || '...'} sal.
                  </span>
                )}
                <span className="font-mono text-gray-600">
                  {completedTranches}/{totalTranches} ({progressPercent}%)
                </span>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600">Récupérés API</p>
                <p className="text-xl font-bold text-blue-900">{totalStats.recupere.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600">Après filtres</p>
                <p className="text-xl font-bold text-green-900">{totalStats.filtre.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-xs text-emerald-600">Nouveaux insérés</p>
                <p className="text-xl font-bold text-emerald-900">{totalStats.insere.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600">Déjà en base</p>
                <p className="text-xl font-bold text-gray-700">{totalStats.doublons.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2">
              {Object.entries(DEPARTEMENTS).filter(([code]) => selectedDepts.includes(code)).map(([code, name]) => {
                const dept = deptProgress[code]
                if (!dept) return (
                  <div key={code} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-gray-400">
                    <div className="w-5 h-5" />
                    <span className="font-medium">{code} - {name}</span>
                    <span className="text-xs ml-auto">En attente</span>
                  </div>
                )
                
                const deptTranchesCompleted = Object.values(dept.tranches || {}).filter(t => t.status === 'success').length
                const deptTranchesError = Object.values(dept.tranches || {}).filter(t => t.status === 'error').length
                const isExpanded = expandedDepts[code]
                
                return (
                  <div key={code}>
                    <div
                      onClick={() => toggleExpand(code)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        dept.status === 'loading' ? 'bg-blue-50' :
                        dept.status === 'success' ? 'bg-green-50' :
                        dept.status === 'stopped' ? 'bg-yellow-50' :
                        'bg-gray-50'
                      }`}
                    >
                      {dept.status === 'loading' && <Loader className="w-5 h-5 animate-spin text-blue-500" />}
                      {dept.status === 'success' && <Check className="w-5 h-5 text-green-500" />}
                      {dept.status === 'stopped' && <Square className="w-5 h-5 text-yellow-500" />}
                      
                      <span className="font-medium">{code} - {name}</span>
                      
                      <div className="flex items-center gap-2 ml-auto text-sm">
                        {dept.total && dept.total.insere > 0 && (
                          <span className="text-green-700 font-medium">
                            {dept.total.insere.toLocaleString()} insérés
                          </span>
                        )}
                        <span className="text-gray-500">
                          {deptTranchesCompleted}/{TRANCHES.length}
                          {deptTranchesError > 0 && <span className="text-red-500 ml-1">({deptTranchesError} err)</span>}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="ml-8 mt-1 mb-2 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-1">
                        {TRANCHES.map(tranche => {
                          const t = dept.tranches?.[tranche.code]
                          return (
                            <div
                              key={tranche.code}
                              className={`text-xs px-2 py-1.5 rounded text-center ${
                                !t ? 'bg-gray-100 text-gray-400' :
                                t.status === 'loading' ? 'bg-blue-100 text-blue-700' :
                                t.status === 'success' ? (t.insere > 0 ? 'bg-green-100 text-green-800' : 'bg-green-50 text-green-600') :
                                'bg-red-100 text-red-700'
                              }`}
                            >
                              <div className="font-medium">{tranche.label}</div>
                              {t?.status === 'loading' && <Loader className="w-3 h-3 animate-spin mx-auto mt-0.5" />}
                              {t?.status === 'success' && (
                                <div>{t.insere > 0 ? `+${t.insere}` : '0 new'}</div>
                              )}
                              {t?.status === 'error' && <div>❌</div>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ENRICHISSEMENT */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4">🔍 Enrichissement - Scraping Sites Web</h2>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              • Scrape les sites web des prospects pour extraire emails & téléphones
            </p>
            <p className="text-sm text-gray-600 mb-2">
              • Traite {enrichBatchSize} prospects par batch (~2-3 minutes)
            </p>
            <p className="text-sm text-gray-600 mb-4">
              • ⏰ Cron automatique chaque nuit à 3h du matin
            </p>
          </div>
          
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-gray-700">Batch size :</label>
            <select
              value={enrichBatchSize}
              onChange={(e) => setEnrichBatchSize(Number(e.target.value))}
              className="border rounded px-3 py-1 text-sm"
              disabled={enriching}
            >
              <option value={10}>10 (rapide ~1 min)</option>
              <option value={20}>20 (normal ~2 min)</option>
              <option value={50}>50 (long ~5 min)</option>
            </select>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={lancerEnrichissement}
              disabled={enriching}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
                enriching
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {enriching ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Enrichissement en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Lancer l'enrichissement
                </>
              )}
            </button>
            
            <button
              onClick={lancerEnrichissementBoucle}
              disabled={enriching}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
                enriching
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
            >
              🔄 Enrichir en boucle (5 batchs)
            </button>
          </div>
        </div>

        {enrichStats && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mt-4">
            <h2 className="text-lg font-semibold text-purple-900 mb-4">
              {enrichStats.message}
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-purple-700">Traités</p>
                <p className="text-2xl font-bold text-purple-900">{enrichStats.stats?.total || 0}</p>
              </div>
              <div>
                <p className="text-sm text-purple-700">📧 Emails</p>
                <p className="text-2xl font-bold text-green-700">{enrichStats.stats?.emails_found || 0}</p>
              </div>
              <div>
                <p className="text-sm text-purple-700">📞 Téléphones</p>
                <p className="text-2xl font-bold text-green-700">{enrichStats.stats?.phones_found || 0}</p>
              </div>
              <div>
                <p className="text-sm text-purple-700">❌ Échecs</p>
                <p className="text-2xl font-bold text-red-700">{enrichStats.stats?.failed || 0}</p>
              </div>
            </div>

            {enrichHistory.length > 1 && (
              <div className="mt-4 pt-4 border-t border-purple-200">
                <p className="text-sm font-semibold text-purple-800 mb-2">Historique des batchs :</p>
                {enrichHistory.map((h, i) => (
                  <p key={i} className="text-xs text-purple-700">
                    Batch {i + 1}: {h.stats?.emails_found || 0} emails, {h.stats?.phones_found || 0} tels sur {h.stats?.total || 0} prospects
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Infos</h3>
          <p className="text-sm text-blue-800 mb-1">
            <strong>Import :</strong> 14 tranches d'effectif par département — SCI et auto-entrepreneurs exclus
          </p>
          <p className="text-sm text-blue-800 mb-1">
            <strong>Enrichissement :</strong> Cron automatique à 3h du matin (20 prospects/nuit)
          </p>
          <p className="text-sm text-blue-800">
            <strong>Rapport phoning :</strong> Email hebdo chaque lundi à 8h
          </p>
        </div>

      </div>
    </div>
  )
}
