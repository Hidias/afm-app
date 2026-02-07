/**
 * ============================================================================
 * PAGE ADMIN - IMPORT AUTOMATIQUE
 * ============================================================================
 * 
 * À METTRE : afm-app-main/src/pages/AdminImport.jsx
 * 
 * Page pour lancer l'import manuellement ou automatiquement
 * ============================================================================
 */

import { useState } from 'react'
import { Play, Check, X, Loader, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const DEPARTEMENTS = {
  '22': 'Côtes-d\'Armor',
  '29': 'Finistère',
  '35': 'Ille-et-Vilaine',
  '56': 'Morbihan',
  '44': 'Loire-Atlantique',
  '49': 'Maine-et-Loire',
  '53': 'Mayenne',
  '72': 'Sarthe',
  '85': 'Vendée'
}

export default function AdminImport() {
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({})
  const [stats, setStats] = useState(null)

  async function importDepartement(dept) {
    setProgress(prev => ({ ...prev, [dept]: 'loading' }))
    
    try {
      const response = await fetch('/api/import-departement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departement: dept })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setProgress(prev => ({ ...prev, [dept]: 'success' }))
        return data
      } else {
        setProgress(prev => ({ ...prev, [dept]: 'error' }))
        return null
      }
    } catch (error) {
      console.error(`Erreur département ${dept}:`, error)
      setProgress(prev => ({ ...prev, [dept]: 'error' }))
      return null
    }
  }

  async function lancerImport() {
    setImporting(true)
    setProgress({})
    setStats(null)
    
    toast('🚀 Import lancé ! Durée estimée : 30-45 minutes', { duration: 5000 })
    
    const resultats = {
      totalRecupere: 0,
      totalInsere: 0,
      totalDoublons: 0,
      byDept: {}
    }
    
    // Importer chaque département séquentiellement
    for (const dept of Object.keys(DEPARTEMENTS)) {
      const result = await importDepartement(dept)
      
      if (result) {
        resultats.totalRecupere += result.recupere
        resultats.totalInsere += result.insere
        resultats.totalDoublons += result.doublons
        resultats.byDept[dept] = result
      }
      
      // Pause entre départements
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    setStats(resultats)
    setImporting(false)
    
    toast.success(`✅ Import terminé ! ${resultats.totalInsere.toLocaleString()} prospects`)
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'loading':
        return <Loader className="w-5 h-5 animate-spin text-blue-500" />
      case 'success':
        return <Check className="w-5 h-5 text-green-500" />
      case 'error':
        return <X className="w-5 h-5 text-red-500" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔧 Administration - Import Prospects
          </h1>
          <p className="text-gray-600">
            Lancer manuellement l'import des prospects Bretagne + Pays de la Loire
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">🎯 Import Manuel</h2>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              • 9 départements à importer
            </p>
            <p className="text-sm text-gray-600 mb-2">
              • Durée totale : ~30-45 minutes
            </p>
            <p className="text-sm text-gray-600 mb-4">
              • Résultat attendu : 25 000 - 40 000 prospects
            </p>
          </div>
          
          <button
            onClick={lancerImport}
            disabled={importing}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
              importing
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {importing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Import en cours...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Lancer l'import maintenant
              </>
            )}
          </button>
        </div>

        {Object.keys(progress).length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">📊 Progression</h2>
            
            <div className="space-y-3">
              {Object.entries(DEPARTEMENTS).map(([code, name]) => (
                <div key={code} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(progress[code])}
                    <span className="font-medium">{code} - {name}</span>
                  </div>
                  
                  {stats?.byDept[code] && (
                    <span className="text-sm text-gray-600">
                      {stats.byDept[code].insere.toLocaleString()} prospects
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {stats && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-green-900 mb-4">
              ✅ Import Terminé !
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-green-700">Récupérés</p>
                <p className="text-2xl font-bold text-green-900">
                  {stats.totalRecupere.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-green-700">Insérés</p>
                <p className="text-2xl font-bold text-green-900">
                  {stats.totalInsere.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-green-700">Doublons</p>
                <p className="text-2xl font-bold text-green-900">
                  {stats.totalDoublons.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-green-700">Départements</p>
                <p className="text-2xl font-bold text-green-900">9/9</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Astuce</h3>
          <p className="text-sm text-blue-800">
            Pour automatiser cet import tous les soirs, configurez un cron job Supabase ou Vercel.
            Contactez votre développeur pour la mise en place.
          </p>
        </div>

      </div>
    </div>
  )
}
