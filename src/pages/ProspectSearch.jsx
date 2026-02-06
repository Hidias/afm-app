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

// Fonction de calcul de distance (formule Haversine)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  return Math.round(distance) // Distance en km, arrondie
}

// Fonction de suggestions formations
const suggestFormations = (prospect) => {
  if (!prospect.naf) return []
  
  const nafCode = prospect.naf.substring(0, 2)
  return NAF_TO_FORMATIONS[nafCode] || ['SST / MAC SST', 'Incendie (EPI, extincteurs)']
}

export default function ProspectSearch() {
  // État recherche
  const [searchMode, setSearchMode] = useState('departement') // 'ville' ou 'departement'
  const [ville, setVille] = useState('')
  const [villeSuggestions, setVilleSuggestions] = useState([]) // NOUVEAU - Suggestions autocomplétion
  const [villeSelected, setVilleSelected] = useState(null) // NOUVEAU - Ville sélectionnée avec GPS
  const [showSuggestions, setShowSuggestions] = useState(false) // NOUVEAU - Afficher suggestions
  const [radiusKm, setRadiusKm] = useState(30)
  const [departementsSelected, setDepartementsSelected] = useState([])
  
  // Critères entreprise - NOUVEAU SYSTÈME TRANCHES
  const [tranchesEffectif, setTranchesEffectif] = useState([]) // Codes INSEE sélectionnés
  const [formesJuridiques, setFormesJuridiques] = useState(['SARL', 'SAS', 'SASU', 'SA'])
  const [secteursSelected, setSecteursSelected] = useState([])
  
  // Mapping tranches effectif INSEE
  const TRANCHES_EFFECTIF = [
    { code: '01', label: '1-2 salariés', min: 1, max: 2, apiPatterns: ['1 ou 2', '01'] },
    { code: '02', label: '3-5 salariés', min: 3, max: 5, apiPatterns: ['3 à 5', '02'] },
    { code: '03', label: '6-9 salariés', min: 6, max: 9, apiPatterns: ['6 à 9', '03'] },
    { code: '11', label: '10-19 salariés', min: 10, max: 19, apiPatterns: ['10 à 19', '11'] },
    { code: '12', label: '20-49 salariés', min: 20, max: 49, apiPatterns: ['20 à 49', '12'] },
    { code: '21', label: '50-99 salariés', min: 50, max: 99, apiPatterns: ['50 à 99', '21'] },
    { code: '22', label: '100-199 salariés', min: 100, max: 199, apiPatterns: ['100 à 199', '22'] },
    { code: '31', label: '200-249 salariés', min: 200, max: 249, apiPatterns: ['200 à 249', '31'] },
    { code: '32', label: '250-499 salariés', min: 250, max: 499, apiPatterns: ['250 à 499', '32'] },
    { code: '41', label: '500-999 salariés', min: 500, max: 999, apiPatterns: ['500 à 999', '41'] },
    { code: '42', label: '1 000-1 999 salariés', min: 1000, max: 1999, apiPatterns: ['1 000 à 1 999', '42'] },
    { code: '51', label: '2 000-4 999 salariés', min: 2000, max: 4999, apiPatterns: ['2 000 à 4 999', '51'] },
    { code: '52', label: '5 000-9 999 salariés', min: 5000, max: 9999, apiPatterns: ['5 000 à 9 999', '52'] },
    { code: '53', label: '10 000+ salariés', min: 10000, max: 999999, apiPatterns: ['10 000', '53'] }
  ]
  
  // Helper: Vérifier si effectif API correspond à une tranche sélectionnée
  const matchesSelectedTranches = (effectifAPI, selectedCodes) => {
    if (!effectifAPI || selectedCodes.length === 0) return true
    
    // Convertir en lowercase pour comparaison
    const effectifLower = effectifAPI.toLowerCase()
    
    // Vérifier si l'effectif API correspond à une des tranches sélectionnées
    return selectedCodes.some(code => {
      const tranche = TRANCHES_EFFECTIF.find(t => t.code === code)
      if (!tranche) return false
      
      // Chercher si un des patterns API correspond
      return tranche.apiPatterns.some(pattern => 
        effectifLower.includes(pattern.toLowerCase())
      )
    })
  }
  
  // Helper: Convertir effectif API en label lisible
  const getEffectifLabel = (effectifAPI) => {
    if (!effectifAPI) return 'Non renseigné'
    
    const effectifLower = effectifAPI.toLowerCase()
    
    // Trouver la tranche correspondante
    const tranche = TRANCHES_EFFECTIF.find(t => 
      t.apiPatterns.some(pattern => effectifLower.includes(pattern.toLowerCase()))
    )
    
    return tranche ? tranche.label : effectifAPI // Fallback vers valeur API si inconnue
  }
  
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

  // Autocomplétion des villes via API geo.gouv.fr
  const searchCities = async (query) => {
    if (!query || query.length < 2) {
      setVilleSuggestions([])
      setShowSuggestions(false)
      return
    }
    
    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=nom,code,codesPostaux,codeDepartement,centre&limit=10`
      )
      const cities = await response.json()
      
      setVilleSuggestions(cities.map(city => ({
        nom: city.nom,
        code: city.code,
        codePostal: city.codesPostaux?.[0] || '',
        departement: city.codeDepartement,
        latitude: city.centre?.coordinates?.[1],
        longitude: city.centre?.coordinates?.[0]
      })))
      setShowSuggestions(true)
    } catch (error) {
      console.error('Erreur autocomplétion:', error)
      setVilleSuggestions([])
    }
  }

  // Sélectionner une ville
  const selectCity = (city) => {
    setVilleSelected(city)
    setVille(city.nom)
    setShowSuggestions(false)
    setVilleSuggestions([])
  }

  // Gestionnaire de changement du champ ville
  const handleVilleChange = (e) => {
    const value = e.target.value
    setVille(value)
    setVilleSelected(null)
    searchCities(value)
  }

  // Mapping département → départements voisins
  const getDepartementVoisins = (dept) => {
    const voisins = {
      '29': ['29', '22', '56'],
      '22': ['22', '29', '35', '56'],
      '35': ['35', '22', '44', '50', '53'],
      '44': ['44', '35', '49', '56', '85'],
      '56': ['56', '29', '22', '44'],
    }
    return voisins[dept] || [dept]
  }

  // Recherche via API Annuaire Entreprises
  const handleSearch = async () => {
    setSearching(true)
    setResults([])
    setDuplicates([])
    setSelectedResults([])
    setSearchProgress('Préparation de la recherche...')
    
    // Message info pour recherche approfondie
    toast.info(
      '🔍 Recherche approfondie : récupération maximale des prospects (jusqu\'à 5000). ' +
      'Temps estimé : 2-3 minutes.',
      { duration: 5000 }
    )
    
    try {
      // Construction de la requête API
      let apiUrl = 'https://recherche-entreprises.api.gouv.fr/search?'
      const params = new URLSearchParams()
      
      // LOG DÉBUT RECHERCHE
      console.group('🔍 NOUVELLE RECHERCHE LANCÉE - MODE BATCH MENSUEL')
      console.log('📍 Mode:', searchMode)
      console.log('🏢 Formes juridiques:', formesJuridiques)
      console.log('👥 Tranches effectif:', tranchesEffectif.length > 0 ? tranchesEffectif : 'AUCUN FILTRE (tous effectifs)')
      console.log('📦 Pagination: 200 pages max (5000 résultats)')
      console.log('⏱️ Temps estimé: 2-3 minutes')
      
      // Zone géographique
      if (searchMode === 'ville' && villeSelected) {
        // MODE VILLE avec GPS : Chercher dans département + voisins
        const deptsToSearch = getDepartementVoisins(villeSelected.departement)
        params.append('departement', deptsToSearch.join(','))
        setSearchProgress(`Recherche dans ${deptsToSearch.length} départements...`)
      } else if (searchMode === 'ville' && ville) {
        // Fallback si ville tapée mais pas sélectionnée
        toast.error('⚠️ Veuillez sélectionner une ville dans les suggestions')
        setSearching(false)
        setSearchProgress('')
        return
      } else if (searchMode === 'departement' && departementsSelected.length > 0) {
        params.append('departement', departementsSelected.join(','))
      } else {
        params.append('q', ville || 'Bretagne')
      }
      
      // Statut actif uniquement
      params.append('etat_administratif', 'A')
      
      // Limiter les résultats (max 25 par l'API)
      params.append('per_page', '25')
      
      // Faire 200 appels (pages 1-200) pour obtenir jusqu'à 5000 résultats
      // Mode BATCH MENSUEL : on récupère le MAX pour avoir toutes les PME
      const allResults = []
      const maxPages = 200
      const startTime = Date.now()
      
      for (let page = 1; page <= maxPages; page++) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        const minutes = Math.floor(elapsed / 60)
        const seconds = elapsed % 60
        setSearchProgress(
          `🔄 Page ${page}/${maxPages} | 📦 ${allResults.length} prospects | ⏱️ ${minutes}m ${seconds}s`
        )
        
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
        
        // DEBUG: Logger quelques effectifs pour voir le format API
        if (page === 1 && pageData.results.length > 0) {
          console.log('Exemples effectifs API (5 premiers):', 
            pageData.results.slice(0, 5).map(r => ({
              nom: r.nom_complet,
              effectif: r.tranche_effectif_salarie_entreprise || r.tranche_effectif_salarie
            }))
          )
        }
        
        if (pageData.results.length < 25) {
          break
        }
      }
      
      console.log('📦 Total résultats API récupérés:', allResults.length)
      console.log('🔄 Début du filtrage et enrichissement...')
      console.groupEnd()
      
      setSearchProgress(`Filtrage et enrichissement de ${allResults.length} prospects...`)
      
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
          // FILTRE 1 : Exclure auto-entrepreneurs
          if (r.nature_juridique === '1000') {
            return false
          }
          
          // FILTRE 2 : Exclure associations, administrations, collectivités, syndicats
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
          
          // FILTRE 3 : Par effectif (codes INSEE)
          if (tranchesEffectif.length > 0) {
            const effectifAPI = r.tranche_effectif_salarie_entreprise || r.tranche_effectif_salarie
            
            // Vérifier si l'effectif API correspond aux tranches sélectionnées
            if (!matchesSelectedTranches(effectifAPI, tranchesEffectif)) {
              return false
            }
          }
          
          return true
        })
        .flatMap(r => {
          // Si l'entreprise a des établissements correspondants dans la zone, créer un prospect par établissement
          if (r.matching_etablissements && r.matching_etablissements.length > 0) {
            return r.matching_etablissements.map(etab => {
              // Calculer la distance si mode ville avec GPS
              let distance = null
              if (searchMode === 'ville' && villeSelected && villeSelected.latitude && villeSelected.longitude) {
                const lat = etab.latitude
                const lon = etab.longitude
                if (lat && lon) {
                  distance = calculateDistance(
                    villeSelected.latitude,
                    villeSelected.longitude,
                    lat,
                    lon
                  )
                }
              }
              
              return {
                nom_complet: r.nom_complet || r.nom_raison_sociale,
                siret: etab.siret, // SIRET de l'établissement local
                siren: r.siren,
                adresse: etab.adresse, // Adresse de l'établissement local
                code_postal: etab.code_postal,
                ville: etab.libelle_commune,
                forme_juridique: r.nature_juridique_entreprise || r.forme_juridique,
                naf: r.activite_principale,
                effectif: getEffectifLabel(r.tranche_effectif_salarie_entreprise || r.tranche_effectif_salarie),
                telephone: etab.telephone || null,
                email: etab.courriel || null,
                site_web: etab.site_internet || null,
                date_creation: r.date_creation,
                tva: r.numero_tva_intra,
                latitude: etab.latitude,
                longitude: etab.longitude,
                distance: distance, // Distance en km (null si pas de GPS)
              }
            })
          } else {
            // Pas d'établissements correspondants → utiliser le siège (comportement actuel)
            let distance = null
            if (searchMode === 'ville' && villeSelected && villeSelected.latitude && villeSelected.longitude) {
              const lat = r.siege?.latitude || r.latitude
              const lon = r.siege?.longitude || r.longitude
              if (lat && lon) {
                distance = calculateDistance(
                  villeSelected.latitude,
                  villeSelected.longitude,
                  lat,
                  lon
                )
              }
            }
            
            return [{
              nom_complet: r.nom_complet || r.nom_raison_sociale,
              siret: r.siege?.siret || r.siret,
              siren: r.siren,
              adresse: r.siege?.adresse || r.adresse,
              code_postal: r.siege?.code_postal || r.code_postal,
              ville: r.siege?.libelle_commune || r.libelle_commune,
              forme_juridique: r.nature_juridique_entreprise || r.forme_juridique,
              naf: r.activite_principale,
              effectif: getEffectifLabel(r.tranche_effectif_salarie_entreprise || r.tranche_effectif_salarie),
              telephone: r.siege?.telephone || null,
              email: r.siege?.courriel || null,
              site_web: r.siege?.site_internet || null,
              date_creation: r.date_creation,
              tva: r.numero_tva_intra,
              latitude: r.siege?.latitude || r.latitude,
              longitude: r.siege?.longitude || r.longitude,
              distance: distance,
            }]
          }
        })
        .filter(etab => {
          // FILTRE GPS sur les établissements individuels (après explosion)
          if (searchMode === 'ville' && villeSelected && villeSelected.latitude && villeSelected.longitude) {
            // Si l'établissement a des coordonnées GPS et une distance calculée
            if (etab.distance !== null && etab.distance !== undefined) {
              // Rejeter si hors du rayon
              if (etab.distance > radiusKm) {
                return false
              }
            }
            // Si pas de GPS, on garde pour l'instant (Hicham affinera plus tard)
          }
          return true
        })
        .map(p => ({
          ...p,
          quality_score: calculateQualityScore(p), // Calcul du score
          suggested_formations: suggestFormations(p), // Suggestions formations
        }))
        .slice(0, 5000) // LIMITE MAX 5000 POUR BATCH MENSUEL
      
      // SYSTÈME ANTI-ERREUR : Diagnostic détaillé si 0 résultat
      if (enrichedResults.length === 0) {
        console.group('🚨 DEBUG : Aucun résultat après filtrage')
        console.log('📊 Résultats API bruts:', allResults.length)
        console.log('🔍 Critères de filtrage appliqués:')
        console.log('  - Tranches effectif:', tranchesEffectif.length > 0 ? tranchesEffectif : 'AUCUN FILTRE')
        console.log('  - Mode recherche:', searchMode)
        console.log('  - Rayon GPS:', searchMode === 'ville' ? `${radiusKm}km` : 'N/A')
        
        // Analyser pourquoi 0 résultat
        if (allResults.length === 0) {
          console.error('❌ L\'API n\'a retourné AUCUN résultat')
          toast.error('Aucune entreprise trouvée dans cette zone. Essayez une autre ville ou département.')
        } else {
          // Il y a des résultats API mais tout est filtré
          console.log('📋 Distribution effectifs API (10 premiers):')
          allResults.slice(0, 10).forEach((r, i) => {
            const effectif = r.tranche_effectif_salarie_entreprise || r.tranche_effectif_salarie
            console.log(`  ${i+1}. ${r.nom_complet} → Effectif: "${effectif}"`)
          })
          
          if (tranchesEffectif.length > 0) {
            console.warn('⚠️ CAUSE : Filtres effectif trop restrictifs')
            console.log('💡 SOLUTION : Décochez certaines tranches ou enlevez le filtre effectif')
            toast.error(
              `${allResults.length} entreprises trouvées mais aucune ne correspond aux tranches sélectionnées (${tranchesEffectif.length} tranches). ` +
              'Essayez de décocher les filtres effectif ou sélectionnez d\'autres tranches.',
              { duration: 8000 }
            )
          } else {
            console.warn('⚠️ CAUSE : Filtrage par forme juridique ou localisation trop strict')
            toast.error(`${allResults.length} entreprises trouvées mais toutes filtrées. Vérifiez vos critères.`)
          }
        }
        console.groupEnd()
        setSearching(false)
        return
      }
      
      // LOG SUCCÈS
      console.log(`✅ ${enrichedResults.length} prospects trouvés après filtrage (${allResults.length} résultats API bruts)`)
      
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
      
      // Passer au tri par distance si mode ville avec GPS
      if (searchMode === 'ville' && villeSelected) {
        setSortBy('distance')
      }
      
      // Enregistrer l'historique
      await supabase.from('prospect_search_history').insert({
        search_criteria: {
          search_mode: searchMode,
          ville,
          radius_km: radiusKm,
          departements: departementsSelected,
          tranches_effectif: tranchesEffectif,
        },
        nb_results: enrichedResults.length,
        searched_by: 'Hicham',
      })
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const minutes = Math.floor(elapsed / 60)
      const seconds = elapsed % 60
      
      toast.success(
        `✅ ${enrichedResults.length} prospects trouvés sur ${allResults.length} entreprises analysées ! ⏱️ ${minutes}m ${seconds}s`,
        { duration: 6000 }
      )
      
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
      'Distance (km)',
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
      p.distance !== null ? p.distance : '',
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
    if (sortBy === 'distance') {
      // Tri par distance (ceux avec distance d'abord, puis par distance croissante)
      if (a.distance !== null && b.distance === null) return -1
      if (a.distance === null && b.distance !== null) return 1
      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance
      }
      return 0
    } else if (sortBy === 'score') {
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm text-gray-600 mb-1">📍 Ville de départ</label>
                  <input
                    type="text"
                    value={ville}
                    onChange={handleVilleChange}
                    onFocus={() => ville.length >= 2 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Tapez une ville..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {villeSelected && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ {villeSelected.nom} ({villeSelected.codePostal}) - Département {villeSelected.departement}
                    </p>
                  )}
                  
                  {/* Suggestions autocomplétion */}
                  {showSuggestions && villeSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {villeSuggestions.map((city, index) => (
                        <div
                          key={index}
                          onMouseDown={() => selectCity(city)}
                          className="px-3 py-2 hover:bg-primary-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{city.nom}</div>
                          <div className="text-xs text-gray-500">
                            {city.codePostal} - Département {city.departement}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">📏 Rayon de recherche</label>
                  <div className="space-y-2">
                    {[10, 20, 30, 50, 100].map(km => (
                      <label key={km} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="radius"
                          value={km}
                          checked={radiusKm === km}
                          onChange={(e) => setRadiusKm(parseInt(e.target.value))}
                          className="text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{km} km</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                💡 Sélectionnez une ville dans les suggestions • Distance GPS réelle calculée pour chaque prospect
              </p>
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

        {/* Effectifs - NOUVEAU SYSTÈME TRANCHES */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            👥 Effectif
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {TRANCHES_EFFECTIF.map(tranche => (
              <button
                key={tranche.code}
                onClick={() => {
                  setTranchesEffectif(prev =>
                    prev.includes(tranche.code)
                      ? prev.filter(c => c !== tranche.code)
                      : [...prev, tranche.code]
                  )
                }}
                className={`px-3 py-2 rounded-lg border text-sm text-left ${
                  tranchesEffectif.includes(tranche.code)
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-primary-300'
                }`}
              >
                {tranche.label}
              </button>
            ))}
          </div>
          {tranchesEffectif.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              {tranchesEffectif.length} tranche{tranchesEffectif.length > 1 ? 's' : ''} sélectionnée{tranchesEffectif.length > 1 ? 's' : ''}
            </p>
          )}
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
                {villeSelected && <option value="distance">📍 Par distance (km)</option>}
                <option value="score">🏆 Meilleur score</option>
                <option value="ville">🏙️ Par ville (A→Z)</option>
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
                            
                            {/* Distance (si disponible) */}
                            {prospect.distance !== null && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                📍 {prospect.distance} km
                              </span>
                            )}
                          </div>
                          
                          {/* Infos entreprise */}
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3 h-3" />
                              {prospect.adresse}, {prospect.code_postal} {prospect.ville}
                              {prospect.distance !== null && (
                                <span className="text-blue-600 font-medium">
                                  • {prospect.distance} km
                                </span>
                              )}
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
