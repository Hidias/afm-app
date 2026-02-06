import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Search, Building2, MapPin, Users, Filter, Download, 
  CheckCircle, AlertCircle, RefreshCw, Plus, X
} from 'lucide-react'
import toast from 'react-hot-toast'

// Secteurs d'activité détaillés
const SECTEURS = {
  'BTP & Construction': ['Gros œuvre', 'Second œuvre', 'Travaux publics', 'Promotion immobilière'],
  'Industrie': ['Agroalimentaire', 'Métallurgie & Mécanique', 'Plasturgie & Chimie', 'Textile', 'Bois & Ameublement'],
  'Logistique & Transport': ['Transport routier marchandises', 'Transport de personnes', 'Entreposage', 'Messagerie'],
  'Commerce': ['Commerce de détail', 'Commerce de gros', 'Garage & Automobile', 'Commerce alimentaire'],
  'Services': ['Nettoyage', 'Sécurité & Gardiennage', 'Maintenance', 'Services informatiques', 'Intérim'],
  'Agriculture & Pêche': ['Agriculture', 'Pêche & Aquaculture', 'Exploitation forestière'],
  'Santé & Social': ['EHPAD', 'Hôpitaux & Cliniques', 'Laboratoires', 'Services à la personne'],
  'Hôtellerie & Restauration': ['Hôtels', 'Restaurants', 'Traiteurs & Cantines'],
}

const DEPARTEMENTS = [
  { code: '29', nom: 'Finistère' },
  { code: '22', nom: 'Côtes-d\'Armor' },
  { code: '35', nom: 'Ille-et-Vilaine' },
  { code: '56', nom: 'Morbihan' },
  { code: '44', nom: 'Loire-Atlantique' },
]

export default function ProspectSearch() {
  // État recherche
  const [searchMode, setSearchMode] = useState('ville') // 'ville' ou 'departement'
  const [ville, setVille] = useState('Concarneau')
  const [radiusKm, setRadiusKm] = useState(30)
  const [departementsSelected, setDepartementsSelected] = useState(['29', '44'])
  
  // Critères entreprise
  const [effectifMin, setEffectifMin] = useState(10)
  const [effectifMax, setEffectifMax] = useState(500)
  const [formesJuridiques, setFormesJuridiques] = useState(['SARL', 'SAS', 'SASU', 'SA'])
  const [secteursSelected, setSecteursSelected] = useState([])
  
  // Résultats
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState([])
  const [duplicates, setDuplicates] = useState([])
  const [showResults, setShowResults] = useState(false)
  
  // Import
  const [selectedResults, setSelectedResults] = useState([])
  const [importing, setImporting] = useState(false)

  // Recherche via API Annuaire Entreprises
  const handleSearch = async () => {
    setSearching(true)
    setResults([])
    setDuplicates([])
    setSelectedResults([])
    
    try {
      // Construction de la requête API - VERSION ULTRA SIMPLIFIÉE
      let apiUrl = 'https://recherche-entreprises.api.gouv.fr/search?'
      const params = new URLSearchParams()
      
      // Zone géographique - SIMPLIFIÉ
      if (searchMode === 'ville' && ville) {
        // Recherche textuelle simple (l'API cherchera dans tous les champs)
        params.append('q', ville)
      } else if (searchMode === 'departement' && departementsSelected.length > 0) {
        // Recherche par département (ça c'est supporté)
        params.append('departement', departementsSelected.join(','))
      } else {
        // Fallback : recherche large
        params.append('q', ville || 'Bretagne')
      }
      
      // Statut actif uniquement
      params.append('etat_administratif', 'A')
      
      // Limiter les résultats (max 25 par l'API)
      params.append('per_page', '25')
      
      // Faire 4 appels (pages 1-4) pour obtenir jusqu'à 100 résultats
      const allResults = []
      
      for (let page = 1; page <= 4; page++) {
        const pageParams = new URLSearchParams(params)
        pageParams.append('page', page)
        const pageUrl = apiUrl + pageParams.toString()
        
        console.log(`API URL (page ${page}):`, pageUrl)
        
        const pageResponse = await fetch(pageUrl)
        
        if (!pageResponse.ok) {
          if (page === 1) {
            // Erreur sur la première page = erreur critique
            const errorText = await pageResponse.text()
            console.error('API Error Response:', errorText)
            throw new Error(`API error: ${pageResponse.status}`)
          } else {
            // Erreur sur pages suivantes = on arrête juste la pagination
            console.log(`Arrêt pagination à la page ${page}`)
            break
          }
        }
        
        const pageData = await pageResponse.json()
        
        if (!pageData.results || pageData.results.length === 0) {
          // Plus de résultats, on arrête
          break
        }
        
        allResults.push(...pageData.results)
        
        // Si moins de 25 résultats, c'est la dernière page
        if (pageData.results.length < 25) {
          break
        }
      }
      
      console.log('Total résultats récupérés:', allResults.length)
      
      if (allResults.length === 0) {
        toast.error('Aucun prospect trouvé avec ces critères')
        setSearching(false)
        return
      }
      
      // Enrichir et FILTRER les résultats côté client
      let enrichedResults = allResults
        .filter(r => {
          // FILTRE 1 : Par ville (si mode ville)
          if (searchMode === 'ville' && ville) {
            const rVille = (r.siege?.libelle_commune || r.libelle_commune || '').toLowerCase()
            if (!rVille.includes(ville.toLowerCase())) {
              return false
            }
          }
          
          // FILTRE 2 : Exclure auto-entrepreneurs
          if (r.nature_juridique === '1000') {
            return false
          }
          
          // FILTRE 3 : Par effectif (approximatif via la tranche)
          if (r.tranche_effectif_salarie_entreprise || r.tranche_effectif_salarie) {
            const effectif = r.tranche_effectif_salarie_entreprise || r.tranche_effectif_salarie
            // Exclure les très petites
            if (effectif.includes('0 salarié') || 
                effectif.includes('1 ou 2') || 
                effectif.includes('3 à 5') || 
                effectif.includes('6 à 9')) {
              if (effectifMin >= 10) return false
            }
            // Exclure les très grandes
            if (effectifMax <= 500) {
              if (effectif.includes('500 à') || 
                  effectif.includes('1 000 à') || 
                  effectif.includes('2 000 à') || 
                  effectif.includes('5 000 à') ||
                  effectif.includes('10 000')) {
                return false
              }
            }
          }
          
          return true
        })
        .map(r => ({
          nom_complet: r.nom_complet || r.nom_raison_sociale,
          siret: r.siege?.siret || r.siret,
          siren: r.siren,
          adresse: r.siege?.adresse || r.adresse,
          code_postal: r.siege?.code_postal || r.code_postal,
          ville: r.siege?.libelle_commune || r.libelle_commune,
          forme_juridique: r.nature_juridique_entreprise || r.forme_juridique,
          naf: r.activite_principale,
          effectif: r.tranche_effectif_salarie_entreprise || r.tranche_effectif_salarie,
          telephone: r.siege?.telephone || null,
          email: r.siege?.courriel || null,
          site_web: r.siege?.site_internet || null,
          date_creation: r.date_creation,
          tva: r.numero_tva_intra,
        }))
        .slice(0, 100) // Limiter à 100 max
      
      if (enrichedResults.length === 0) {
        toast.error('Aucun prospect trouvé après filtrage. Essayez des critères plus larges.')
        setSearching(false)
        return
      }
      
      // Détecter les doublons dans la base
      const siretsToCheck = enrichedResults
        .map(r => r.siret)
        .filter(Boolean)
      
      if (siretsToCheck.length > 0) {
        const { data: existingClients } = await supabase
          .from('clients')
          .select('siret, name, id')
          .in('siret', siretsToCheck)
        
        setDuplicates(existingClients || [])
      }
      
      setResults(enrichedResults)
      setSelectedResults(enrichedResults.map((_, i) => i))
      setShowResults(true)
      
      // Enregistrer l'historique
      await supabase.from('prospect_search_history').insert({
        search_criteria: {
          search_mode: searchMode,
          ville,
          radius_km: radiusKm,
          departements: departementsSelected,
          effectif_min: effectifMin,
          effectif_max: effectifMax,
        },
        nb_results: enrichedResults.length,
        searched_by: 'Hicham',
      })
      
      toast.success(`${enrichedResults.length} prospects trouvés !`)
      
    } catch (error) {
      console.error('Erreur recherche:', error)
      toast.error('Erreur lors de la recherche : ' + error.message)
    } finally {
      setSearching(false)
    }
  }

  // Import des prospects sélectionnés
  const handleImport = async () => {
    if (selectedResults.length === 0) {
      toast.error('Sélectionnez au moins un prospect')
      return
    }
    
    setImporting(true)
    
    try {
      const prospectsToImport = selectedResults.map(index => results[index])
      
      // Filtrer les doublons
      const duplicateSirets = new Set(duplicates.map(d => d.siret))
      const newProspects = prospectsToImport.filter(p => !duplicateSirets.has(p.siret))
      
      if (newProspects.length === 0) {
        toast.error('Tous les prospects sélectionnés sont déjà dans la base')
        setImporting(false)
        return
      }
      
      // Préparer les données pour insertion
      const clientsData = newProspects.map(p => ({
        name: p.nom_complet,
        siret: p.siret,
        siren: p.siren,
        address: p.adresse,
        postal_code: p.code_postal,
        city: p.ville,
        forme_juridique: p.forme_juridique,
        naf: p.naf,
        taille_entreprise: p.effectif,
        contact_phone: p.telephone,
        email: p.email,
        website: p.site_web,
        tva: p.tva,
        type: 'prospect',
        status: 'prospect',
        proprietaire: null, // Sera assigné plus tard
      }))
      
      // Insérer dans clients
      const { data: insertedClients, error } = await supabase
        .from('clients')
        .insert(clientsData)
        .select()
      
      if (error) throw error
      
      // Ajouter dans la file d'attente Marine
      const queueData = insertedClients.map(client => ({
        client_id: client.id,
        priority: 2, // Normal
        zone_geo: client.city,
        status: 'pending',
        notes: `Importé le ${new Date().toLocaleDateString('fr-FR')}`,
      }))
      
      await supabase.from('marine_queue').insert(queueData)
      
      // Mettre à jour l'historique
      await supabase
        .from('prospect_search_history')
        .update({ nb_imported: newProspects.length })
        .order('searched_at', { ascending: false })
        .limit(1)
      
      toast.success(`${newProspects.length} prospects importés avec succès !`)
      
      // Réinitialiser
      setShowResults(false)
      setResults([])
      setSelectedResults([])
      
    } catch (error) {
      console.error('Erreur import:', error)
      toast.error('Erreur lors de l\'importation')
    } finally {
      setImporting(false)
    }
  }

  // Toggle sélection
  const toggleSelection = (index) => {
    setSelectedResults(prev => 
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const toggleAll = () => {
    setSelectedResults(prev => 
      prev.length === results.length ? [] : results.map((_, i) => i)
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🔍 Recherche Prospects</h1>
        <p className="text-gray-600 mt-1">
          Recherche via API Annuaire Entreprises (gratuit et illimité)
        </p>
      </div>

      {/* Formulaire de recherche */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        
        {/* Mode de recherche */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📍 Zone géographique
          </label>
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setSearchMode('ville')}
              className={`px-4 py-2 rounded-lg border ${
                searchMode === 'ville'
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Ville + Rayon
            </button>
            <button
              onClick={() => setSearchMode('departement')}
              className={`px-4 py-2 rounded-lg border ${
                searchMode === 'departement'
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Départements
            </button>
          </div>

          {searchMode === 'ville' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ville</label>
                <input
                  type="text"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="Concarneau"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Rayon (km)</label>
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="0">Ville uniquement</option>
                  <option value="10">10 km</option>
                  <option value="20">20 km</option>
                  <option value="30">30 km</option>
                  <option value="50">50 km</option>
                  <option value="100">100 km</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {DEPARTEMENTS.map(dept => (
                <button
                  key={dept.code}
                  onClick={() => {
                    setDepartementsSelected(prev =>
                      prev.includes(dept.code)
                        ? prev.filter(c => c !== dept.code)
                        : [...prev, dept.code]
                    )
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${
                    departementsSelected.includes(dept.code)
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {dept.code} - {dept.nom}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Effectifs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            👥 Effectif
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Minimum</label>
              <input
                type="number"
                value={effectifMin}
                onChange={(e) => setEffectifMin(Number(e.target.value))}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Maximum</label>
              <input
                type="number"
                value={effectifMax}
                onChange={(e) => setEffectifMax(Number(e.target.value))}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Formes juridiques */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            🏢 Forme juridique
          </label>
          <div className="flex flex-wrap gap-2">
            {['SARL', 'SAS', 'SASU', 'SA', 'EURL', 'SNC'].map(forme => (
              <button
                key={forme}
                onClick={() => {
                  setFormesJuridiques(prev =>
                    prev.includes(forme)
                      ? prev.filter(f => f !== forme)
                      : [...prev, forme]
                  )
                }}
                className={`px-3 py-1.5 rounded-lg border text-sm ${
                  formesJuridiques.includes(forme)
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {forme}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ⚠️ Auto-entrepreneurs exclus automatiquement
          </p>
        </div>

        {/* Bouton recherche */}
        <button
          onClick={handleSearch}
          disabled={searching}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {searching ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Recherche en cours...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              🤖 Lancer la recherche (API Gratuite)
            </>
          )}
        </button>
      </div>

      {/* Résultats */}
      {showResults && results.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {results.length} prospects trouvés
              </h2>
              {duplicates.length > 0 && (
                <p className="text-sm text-orange-600 mt-1">
                  ⚠️ {duplicates.length} doublons détectés (déjà dans la base)
                </p>
              )}
            </div>
            <button
              onClick={toggleAll}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              {selectedResults.length === results.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>

          {/* Liste des résultats */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((prospect, index) => {
              const isDuplicate = duplicates.some(d => d.siret === prospect.siret)
              const isSelected = selectedResults.includes(index)
              
              return (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${
                    isDuplicate
                      ? 'bg-orange-50 border-orange-200'
                      : isSelected
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected && !isDuplicate}
                      onChange={() => !isDuplicate && toggleSelection(index)}
                      disabled={isDuplicate}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{prospect.nom_complet}</h3>
                          <div className="text-sm text-gray-600 space-y-1 mt-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3 h-3" />
                              {prospect.adresse}, {prospect.code_postal} {prospect.ville}
                            </div>
                            {prospect.siret && (
                              <div>🔢 SIRET: {prospect.siret}</div>
                            )}
                            {prospect.telephone && (
                              <div>📞 {prospect.telephone}</div>
                            )}
                            {prospect.email && (
                              <div>📧 {prospect.email}</div>
                            )}
                            {prospect.effectif && (
                              <div className="flex items-center gap-2">
                                <Users className="w-3 h-3" />
                                {prospect.effectif}
                              </div>
                            )}
                          </div>
                        </div>
                        {isDuplicate ? (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                            ⚠️ Doublon
                          </span>
                        ) : isSelected ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bouton import */}
          <div className="pt-4 border-t">
            <button
              onClick={handleImport}
              disabled={importing || selectedResults.length === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Importer {selectedResults.filter(i => !duplicates.some(d => d.siret === results[i].siret)).length} prospects
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              Les prospects seront ajoutés à la file d'attente de Marine
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
