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

// Mapping NAF → Formations suggérées
const NAF_TO_FORMATIONS = {
  // BTP & Construction
  '41': ['SST / MAC SST', 'Gestes & Postures / TMS', 'R408 Échafaudage', 'CACES R482'],
  '42': ['SST / MAC SST', 'Gestes & Postures / TMS', 'R408 Échafaudage', 'CACES R482'],
  '43': ['SST / MAC SST', 'Gestes & Postures / TMS', 'Habilitation électrique (B0/H0V)'],
  // Industrie
  '10': ['SST / MAC SST', 'Gestes & Postures / TMS', 'Habilitation électrique (B0/H0V)'],
  '11': ['SST / MAC SST', 'Gestes & Postures / TMS', 'CACES'],
  '20': ['SST / MAC SST', 'Gestes & Postures / TMS', 'CACES'],
  '22': ['SST / MAC SST', 'Gestes & Postures / TMS', 'CACES'],
  '23': ['SST / MAC SST', 'Gestes & Postures / TMS', 'CACES'],
  '24': ['SST / MAC SST', 'Gestes & Postures / TMS', 'Habilitation électrique (B0/H0V)'],
  '25': ['SST / MAC SST', 'Gestes & Postures / TMS', 'CACES'],
  '28': ['SST / MAC SST', 'Gestes & Postures / TMS', 'Habilitation électrique (B0/H0V)'],
  // Logistique & Transport
  '49': ['SST / MAC SST', 'Gestes & Postures / TMS', 'CACES R489'],
  '52': ['SST / MAC SST', 'Gestes & Postures / TMS', 'CACES R489'],
  '53': ['SST / MAC SST', 'Gestes & Postures / TMS', 'CACES R489'],
  // Commerce
  '45': ['SST / MAC SST', 'Incendie (EPI, extincteurs)', 'Gestes & Postures / TMS'],
  '46': ['SST / MAC SST', 'Gestes & Postures / TMS', 'CACES R489'],
  '47': ['SST / MAC SST', 'Incendie (EPI, extincteurs)', 'Gestes & Postures / TMS'],
  // Services
  '81': ['SST / MAC SST', 'Gestes & Postures / TMS', 'Habilitation électrique (B0/H0V)'],
  '95': ['SST / MAC SST', 'Gestes & Postures / TMS', 'Habilitation électrique (B0/H0V)'],
}

// Fonction de calcul du score qualité (0-100)
const calculateQualityScore = (prospect) => {
  let score = 50 // Base score
  
  // Effectif (sweet spot 20-200)
  if (prospect.effectif) {
    const effectif = prospect.effectif.toLowerCase()
    if (effectif.includes('20 à 49') || effectif.includes('50 à 99') || effectif.includes('100 à 199')) {
      score += 20 // Sweet spot
    } else if (effectif.includes('10 à 19') || effectif.includes('200 à 249')) {
      score += 10 // Bon
    } else if (effectif.includes('250 à 499')) {
      score += 5 // Acceptable
    }
  }
  
  // Secteur à risque (besoin formation)
  if (prospect.naf) {
    const nafCode = prospect.naf.substring(0, 2)
    if (NAF_TO_FORMATIONS[nafCode]) {
      score += 15 // Secteur avec besoin formation
    }
  }
  
  // Coordonnées disponibles
  if (prospect.telephone) score += 10
  if (prospect.email) score += 10
  if (prospect.site_web) score += 5
  
  // Âge entreprise (moins de 5 ans = dynamique)
  if (prospect.date_creation) {
    const anneeCreation = new Date(prospect.date_creation).getFullYear()
    const age = new Date().getFullYear() - anneeCreation
    if (age < 5) score += 5
    if (age > 20) score -= 5
  }
  
  return Math.min(100, Math.max(0, score))
}

// Fonction de suggestions formations
const suggestFormations = (prospect) => {
  if (!prospect.naf) return []
  
  const nafCode = prospect.naf.substring(0, 2)
  return NAF_TO_FORMATIONS[nafCode] || ['SST / MAC SST', 'Incendie (EPI, extincteurs)']
}

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
  const [searchProgress, setSearchProgress] = useState('') // NOUVEAU - Compteur temps réel
  const [results, setResults] = useState([])
  const [duplicates, setDuplicates] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [sortBy, setSortBy] = useState('score') // NOUVEAU - Tri (score, ville, effectif, new)
  
  // Import
  const [selectedResults, setSelectedResults] = useState([])
  const [importing, setImporting] = useState(false)

  // Recherche via API Annuaire Entreprises
  const handleSearch = async () => {
    setSearching(true)
    setResults([])
    setDuplicates([])
    setSelectedResults([])
    setSearchProgress('Préparation de la recherche...')
    
    try {
      // Construction de la requête API
      let apiUrl = 'https://recherche-entreprises.api.gouv.fr/search?'
      const params = new URLSearchParams()
      
      // Zone géographique - Support multi-villes
      if (searchMode === 'ville' && ville) {
        // Support multi-villes : "Concarneau, Quimper, Brest"
        const villes = ville.split(',').map(v => v.trim()).filter(Boolean)
        if (villes.length === 1) {
          params.append('q', villes[0])
        } else {
          // Pour multi-villes, on fait une recherche large et on filtre après
          params.append('q', villes.join(' OR '))
        }
      } else if (searchMode === 'departement' && departementsSelected.length > 0) {
        params.append('departement', departementsSelected.join(','))
      } else {
        params.append('q', ville || 'Bretagne')
      }
      
      // Statut actif uniquement
      params.append('etat_administratif', 'A')
      
      // Limiter les résultats (max 25 par l'API)
      params.append('per_page', '25')
      
      // Faire 4 appels (pages 1-4) pour obtenir jusqu'à 100 résultats
      const allResults = []
      
      for (let page = 1; page <= 4; page++) {
        setSearchProgress(`Recherche en cours... ${allResults.length} prospects (page ${page}/4)`)
        
        const pageParams = new URLSearchParams(params)
        pageParams.append('page', page)
        const pageUrl = apiUrl + pageParams.toString()
        
        console.log(`API URL (page ${page}):`, pageUrl)
        
        const pageResponse = await fetch(pageUrl)
        
        if (!pageResponse.ok) {
          if (page === 1) {
            const errorText = await pageResponse.text()
            console.error('API Error Response:', errorText)
            throw new Error(`API error: ${pageResponse.status}`)
          } else {
            console.log(`Arrêt pagination à la page ${page}`)
            break
          }
        }
        
        const pageData = await pageResponse.json()
        
        if (!pageData.results || pageData.results.length === 0) {
          break
        }
        
        allResults.push(...pageData.results)
        
        if (pageData.results.length < 25) {
          break
        }
      }
      
      setSearchProgress(`Filtrage et enrichissement de ${allResults.length} prospects...`)
      
      console.log('Total résultats récupérés:', allResults.length)
      
      if (allResults.length === 0) {
        toast.error('Aucun prospect trouvé avec ces critères')
        setSearching(false)
        setSearchProgress('')
        return
      }
      
      // Support multi-villes pour le filtrage
      const villesFilter = searchMode === 'ville' && ville 
        ? ville.split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
        : []
      
      // Enrichir et FILTRER les résultats côté client
      let enrichedResults = allResults
        .filter(r => {
          // FILTRE 1 : Par ville (si mode ville) - Matching EXACT de la ville
          if (searchMode === 'ville' && villesFilter.length > 0) {
            const rVille = (r.siege?.libelle_commune || r.libelle_commune || '')
              .toLowerCase()
              .trim()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlever accents
            
            const matchesAnyVille = villesFilter.some(v => {
              const vNormalized = v.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              // Matching EXACT ou début de ville (pour "Concarneau" vs "Concarneau-sur-Mer")
              return rVille === vNormalized || rVille.startsWith(vNormalized + '-')
            })
            
            if (!matchesAnyVille) {
              return false
            }
          }
          
          // FILTRE 2 : Exclure auto-entrepreneurs
          if (r.nature_juridique === '1000') {
            return false
          }
          
          // FILTRE 3 : Exclure associations, administrations, collectivités, syndicats
          const natureJuridique = r.nature_juridique || ''
          
          // Associations (92xx)
          if (natureJuridique.startsWith('92')) {
            return false
          }
          
          // Administrations publiques (71xx, 72xx, 73xx, 74xx)
          if (natureJuridique.startsWith('71') || 
              natureJuridique.startsWith('72') || 
              natureJuridique.startsWith('73') || 
              natureJuridique.startsWith('74')) {
            return false
          }
          
          // Collectivités territoriales (75xx)
          if (natureJuridique.startsWith('75')) {
            return false
          }
          
          // Syndicats (91xx)
          if (natureJuridique.startsWith('91')) {
            return false
          }
          
          // Fondations (93xx)
          if (natureJuridique.startsWith('93')) {
            return false
          }
          
          // FILTRE 4 : Par effectif (approximatif via la tranche)
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
        .map(p => ({
          ...p,
          quality_score: calculateQualityScore(p), // Calcul du score
          suggested_formations: suggestFormations(p), // Suggestions formations
        }))
        .slice(0, 100)
      
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
      setSearchProgress('')
      
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
      setSearchProgress('')
    }
  }

  // Export CSV
  const exportToCSV = () => {
    const prospectsToExport = selectedResults.map(index => results[index])
    
    // Headers CSV
    const headers = [
      'Nom',
      'SIRET',
      'Adresse',
      'Code Postal',
      'Ville',
      'Téléphone',
      'Email',
      'Site Web',
      'Effectif',
      'Score',
      'Formations suggérées'
    ]
    
    // Données
    const rows = prospectsToExport.map(p => [
      p.nom_complet,
      p.siret || '',
      p.adresse || '',
      p.code_postal || '',
      p.ville || '',
      p.telephone || '',
      p.email || '',
      p.site_web || '',
      p.effectif || '',
      p.quality_score || 0,
      (p.suggested_formations || []).join(' | ')
    ])
    
    // Créer le CSV
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n')
    
    // Télécharger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `prospects_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    
    toast.success(`${prospectsToExport.length} prospects exportés en CSV`)
  }

  // Tri des résultats
  const sortedResults = [...results].sort((a, b) => {
    const isDuplicateA = duplicates.some(d => d.siret === a.siret)
    const isDuplicateB = duplicates.some(d => d.siret === b.siret)
    
    // Les nouveaux en premier
    if (isDuplicateA && !isDuplicateB) return 1
    if (!isDuplicateA && isDuplicateB) return -1
    
    // Puis trier selon le critère choisi
    if (sortBy === 'score') {
      return (b.quality_score || 0) - (a.quality_score || 0)
    } else if (sortBy === 'ville') {
      return (a.ville || '').localeCompare(b.ville || '')
    } else if (sortBy === 'effectif') {
      // Tri approximatif par effectif
      const getEffectifValue = (e) => {
        if (!e) return 0
        if (e.includes('10 à 19')) return 15
        if (e.includes('20 à 49')) return 35
        if (e.includes('50 à 99')) return 75
        if (e.includes('100 à 199')) return 150
        if (e.includes('200 à 249')) return 225
        if (e.includes('250 à 499')) return 375
        if (e.includes('500')) return 500
        return 0
      }
      return getEffectifValue(b.effectif) - getEffectifValue(a.effectif)
    } else if (sortBy === 'new') {
      // Nouveaux d'abord
      if (isDuplicateA && !isDuplicateB) return 1
      if (!isDuplicateA && isDuplicateB) return -1
      return (b.quality_score || 0) - (a.quality_score || 0)
    }
    return 0
  })

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
                <label className="block text-sm text-gray-600 mb-1">Ville(s)</label>
                <input
                  type="text"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="Concarneau, Quimper, Brest"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">💡 Séparez par des virgules pour chercher plusieurs villes</p>
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
            ⚠️ Exclus automatiquement : Auto-entrepreneurs, Associations, Administrations, Collectivités, Syndicats, Fondations
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
              {searchProgress || 'Recherche en cours...'}
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
            <div className="flex items-center gap-3">
              {/* Tri */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="score">🏆 Meilleur score</option>
                <option value="ville">📍 Par ville (A→Z)</option>
                <option value="effectif">👥 Par effectif</option>
                <option value="new">🆕 Nouveaux d'abord</option>
              </select>
              
              {/* Export CSV */}
              <button
                onClick={exportToCSV}
                disabled={selectedResults.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV ({selectedResults.length})
              </button>
              
              {/* Sélectionner tout */}
              <button
                onClick={toggleAll}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {selectedResults.length === results.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>
          </div>

          {/* Liste des résultats */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sortedResults.map((prospect, sortedIndex) => {
              // Trouver l'index original pour la sélection
              const index = results.findIndex(r => r.siret === prospect.siret)
              const isDuplicate = duplicates.some(d => d.siret === prospect.siret)
              const isSelected = selectedResults.includes(index)
              
              // Couleur du score
              const getScoreColor = (score) => {
                if (score >= 80) return 'text-green-600 bg-green-50'
                if (score >= 60) return 'text-blue-600 bg-blue-50'
                if (score >= 40) return 'text-orange-600 bg-orange-50'
                return 'text-gray-600 bg-gray-50'
              }
              
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
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {/* Nom + Badges */}
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h3 className="font-semibold text-gray-900">{prospect.nom_complet}</h3>
                            
                            {/* Badge Doublon */}
                            {isDuplicate && (
                              <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-medium rounded">
                                ⚠️ Doublon
                              </span>
                            )}
                            
                            {/* Badge Nouveau */}
                            {!isDuplicate && (
                              <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded">
                                🆕 Nouveau
                              </span>
                            )}
                            
                            {/* Score */}
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getScoreColor(prospect.quality_score)}`}>
                              🏆 {prospect.quality_score}/100
                            </span>
                          </div>
                          
                          {/* Infos entreprise */}
                          <div className="text-sm text-gray-600 space-y-1">
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
                            
                            {/* Formations suggérées */}
                            {prospect.suggested_formations && prospect.suggested_formations.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="text-xs font-medium text-gray-700 mb-1">
                                  🎓 Formations suggérées :
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {prospect.suggested_formations.slice(0, 3).map((formation, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                                    >
                                      {formation}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Checkbox visuel */}
                        {isDuplicate ? null : isSelected ? (
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
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
