import { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet'
import { supabase } from '../lib/supabase'
import { MapPin, Phone, Building2, Users, Navigation, RefreshCw, Loader2, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'

// Points de départ
const BASES = {
  concarneau: { name: 'Concarneau (Hicham)', lat: 47.8742, lng: -3.9196, emoji: '📍' },
  derval: { name: 'Derval (Maxime)', lat: 47.6639, lng: -1.6689, emoji: '📍' },
}

// Haversine distance en km
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Couleur selon effectif
function getColor(prospect) {
  if (prospect.prospection_status === 'pas_interesse') return '#9CA3AF'
  if (prospect.prospection_status === 'rdv_pris') return '#10B981'
  if (prospect.prospection_status === 'a_rappeler') return '#F59E0B'
  const eff = parseInt(prospect.effectif) || 0
  if (eff >= 50) return '#EF4444'
  if (eff >= 20) return '#F97316'
  if (eff >= 6) return '#EAB308'
  return '#94A3B8'
}

// Label effectif
function getEffectifLabel(eff) {
  const n = parseInt(eff) || 0
  if (n >= 250) return '250+ sal.'
  if (n >= 100) return '100-249 sal.'
  if (n >= 50) return '50-99 sal.'
  if (n >= 20) return '20-49 sal.'
  if (n >= 6) return '6-19 sal.'
  return n + ' sal.'
}

// Rayon du cercle selon quality_score
function getRadius(prospect) {
  const score = prospect.quality_score || 50
  return Math.max(4, Math.min(12, score / 10))
}

// Composant pour recentrer la carte
function MapRecenter({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [center, zoom])
  return null
}

export default function ProspectionCarte() {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [geocoding, setGeocoding] = useState(false)
  const [ungeocodedCount, setUngeocodedCount] = useState(0)
  
  // Filtres
  const [base, setBase] = useState('concarneau')
  const [maxRadius, setMaxRadius] = useState(0) // 0 = tous
  const [effectifFilter, setEffectifFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCircles, setShowCircles] = useState(true)
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [showFilters, setShowFilters] = useState(true)
  const [sortBy, setSortBy] = useState('priorite') // priorite | distance | potentiel

  const basePoint = BASES[base]

  useEffect(() => { loadProspects() }, [])

  async function loadProspects() {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_unique_prospects')
      if (error) throw error

      const withCoords = (data || []).filter(p => p.latitude && p.longitude)
      const withoutCoords = (data || []).filter(p => !p.latitude || !p.longitude)
      
      setProspects(withCoords)
      setUngeocodedCount(withoutCoords.length)
    } catch (err) {
      console.error('Erreur chargement:', err)
      toast.error('Erreur chargement prospects')
    } finally {
      setLoading(false)
    }
  }

  async function handleGeocode() {
    setGeocoding(true)
    try {
      const res = await fetch('/api/geocode-prospects', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success(`${data.geocoded} codes postaux géocodés`)
        await loadProspects()
      } else {
        toast.error('Erreur: ' + (data.error || 'Échec géocodage'))
      }
    } catch (err) {
      toast.error('Erreur géocodage: ' + err.message)
    } finally {
      setGeocoding(false)
    }
  }

  // Prospects enrichis avec distance et priorité
  const enrichedProspects = useMemo(() => {
    return prospects.map(p => {
      const dist = distanceKm(basePoint.lat, basePoint.lng, p.latitude, p.longitude)
      const potentiel = (p.quality_score || 50) + (parseInt(p.effectif) || 0) * 0.5
      const priorite = dist > 0 ? potentiel / Math.sqrt(dist) : potentiel * 10
      return { ...p, distance: dist, potentiel, priorite }
    })
  }, [prospects, base])

  // Filtrage
  const filtered = useMemo(() => {
    return enrichedProspects.filter(p => {
      if (maxRadius > 0 && p.distance > maxRadius) return false
      if (effectifFilter) {
        const eff = parseInt(p.effectif) || 0
        if (effectifFilter === '6-19' && (eff < 6 || eff > 19)) return false
        if (effectifFilter === '20-49' && (eff < 20 || eff > 49)) return false
        if (effectifFilter === '50-99' && (eff < 50 || eff > 99)) return false
        if (effectifFilter === '100+' && eff < 100) return false
      }
      if (statusFilter) {
        if (statusFilter === 'a_appeler' && p.prospection_status && p.prospection_status !== 'a_appeler') return false
        if (statusFilter === 'a_rappeler' && p.prospection_status !== 'a_rappeler') return false
        if (statusFilter === 'rdv_pris' && p.prospection_status !== 'rdv_pris') return false
        if (statusFilter === 'pas_interesse' && p.prospection_status !== 'pas_interesse') return false
      }
      return true
    })
  }, [enrichedProspects, maxRadius, effectifFilter, statusFilter])

  // Tri
  const sorted = useMemo(() => {
    const copy = [...filtered]
    if (sortBy === 'distance') copy.sort((a, b) => a.distance - b.distance)
    else if (sortBy === 'potentiel') copy.sort((a, b) => b.potentiel - a.potentiel)
    else copy.sort((a, b) => b.priorite - a.priorite) // priorité = potentiel / distance
    return copy
  }, [filtered, sortBy])

  // Stats
  const stats = useMemo(() => ({
    total: enrichedProspects.length,
    filtered: filtered.length,
    dans20km: enrichedProspects.filter(p => p.distance <= 20).length,
    dans50km: enrichedProspects.filter(p => p.distance <= 50).length,
    dans100km: enrichedProspects.filter(p => p.distance <= 100).length,
    aAppeler: filtered.filter(p => !p.prospection_status || p.prospection_status === 'a_appeler').length,
    rdvPris: filtered.filter(p => p.prospection_status === 'rdv_pris').length,
  }), [enrichedProspects, filtered])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🗺️ Carte Prospection</h1>
          <p className="text-gray-600 mt-1">
            {filtered.length} prospects affichés sur {enrichedProspects.length}
            {maxRadius > 0 && ` • Rayon ${maxRadius}km depuis ${BASES[base].name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ungeocodedCount > 0 && (
            <button onClick={handleGeocode} disabled={geocoding}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
              {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {geocoding ? 'Géocodage...' : `Géocoder ${ungeocodedCount} prospects`}
            </button>
          )}
          <button onClick={loadProspects} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contrôles */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Filter className="w-4 h-4" /> Filtres & contrôles
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>🔴 50+ sal.</span>
            <span>🟠 20-49</span>
            <span>🟡 6-19</span>
            <span className="text-gray-400">⚫ &lt;6</span>
            <span>🟢 RDV pris</span>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t">
            {/* Base de départ */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">📍 Base de départ</label>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {Object.entries(BASES).map(([key, val]) => (
                  <button key={key} onClick={() => setBase(key)}
                    className={'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ' +
                      (base === key ? 'bg-white shadow text-gray-900' : 'text-gray-600')}>
                    {val.name.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Rayon max */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">🎯 Rayon max</label>
              <select value={maxRadius} onChange={(e) => setMaxRadius(parseInt(e.target.value))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="0">Tous (pas de limite)</option>
                <option value="20">20 km ({stats.dans20km})</option>
                <option value="50">50 km ({stats.dans50km})</option>
                <option value="100">100 km ({stats.dans100km})</option>
                <option value="150">150 km</option>
                <option value="200">200 km</option>
              </select>
            </div>

            {/* Effectif */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">👥 Effectif</label>
              <select value={effectifFilter} onChange={(e) => setEffectifFilter(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Tous</option>
                <option value="6-19">6-19 sal.</option>
                <option value="20-49">20-49 sal.</option>
                <option value="50-99">50-99 sal.</option>
                <option value="100+">100+ sal.</option>
              </select>
            </div>

            {/* Statut */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">📊 Statut</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Tous</option>
                <option value="a_appeler">📞 À appeler ({stats.aAppeler})</option>
                <option value="a_rappeler">🟡 À rappeler</option>
                <option value="rdv_pris">🔥 RDV pris ({stats.rdvPris})</option>
                <option value="pas_interesse">❄️ Pas intéressé</option>
              </select>
            </div>

            {/* Tri */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">📈 Trier par</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="priorite">⭐ Priorité (potentiel ÷ distance)</option>
                <option value="distance">📏 Distance (plus proche)</option>
                <option value="potentiel">🔥 Potentiel (meilleur score)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Carte + Liste */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 340px)' }}>
        {/* Carte */}
        <div className="flex-1 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
          <MapContainer
            center={[basePoint.lat, basePoint.lng]}
            zoom={9}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <MapRecenter center={[basePoint.lat, basePoint.lng]} zoom={maxRadius <= 50 ? 10 : maxRadius <= 100 ? 9 : 8} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Cercles escargot */}
            {showCircles && (
              <>
                <Circle center={[basePoint.lat, basePoint.lng]} radius={20000}
                  pathOptions={{ color: '#3B82F6', weight: 1, fillOpacity: 0.03, dashArray: '5,10' }} />
                <Circle center={[basePoint.lat, basePoint.lng]} radius={50000}
                  pathOptions={{ color: '#6366F1', weight: 1, fillOpacity: 0.02, dashArray: '5,10' }} />
                <Circle center={[basePoint.lat, basePoint.lng]} radius={100000}
                  pathOptions={{ color: '#8B5CF6', weight: 1, fillOpacity: 0.01, dashArray: '5,10' }} />
              </>
            )}

            {/* Point de base */}
            <CircleMarker center={[basePoint.lat, basePoint.lng]} radius={10}
              pathOptions={{ color: '#1E40AF', fillColor: '#3B82F6', fillOpacity: 1, weight: 3 }}>
              <Popup>
                <strong>{basePoint.emoji} {basePoint.name}</strong><br />
                Base de départ
              </Popup>
            </CircleMarker>

            {/* Prospects */}
            {sorted.map(p => (
              <CircleMarker
                key={p.id}
                center={[p.latitude, p.longitude]}
                radius={getRadius(p)}
                pathOptions={{
                  color: selectedProspect?.id === p.id ? '#1E40AF' : '#fff',
                  fillColor: getColor(p),
                  fillOpacity: 0.85,
                  weight: selectedProspect?.id === p.id ? 3 : 1,
                }}
                eventHandlers={{
                  click: () => setSelectedProspect(p),
                }}
              >
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <strong>{p.name}</strong><br />
                    <span style={{ fontSize: 12, color: '#666' }}>{p.postal_code} {p.city}</span><br />
                    {p.phone && <a href={'tel:' + p.phone.replace(/\s/g, '')} style={{ color: '#2563EB', fontWeight: 'bold' }}>📞 {p.phone}</a>}
                    <br />
                    <span style={{ fontSize: 12 }}>
                      👥 {getEffectifLabel(p.effectif)} • 📏 {Math.round(p.distance)} km
                      {p.prospection_status === 'rdv_pris' && ' • 🔥 RDV pris'}
                      {p.prospection_status === 'a_rappeler' && ' • 🟡 À rappeler'}
                    </span>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Liste latérale */}
        <div className="w-80 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 bg-gray-50 border-b text-sm font-semibold text-gray-700 flex items-center justify-between">
            <span>📋 {sorted.length} prospects</span>
            <label className="flex items-center gap-1 text-xs font-normal cursor-pointer">
              <input type="checkbox" checked={showCircles} onChange={(e) => setShowCircles(e.target.checked)} className="rounded" />
              Cercles
            </label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sorted.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => setSelectedProspect(p)}
                className={'w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-blue-50 transition-colors ' +
                  (selectedProspect?.id === p.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : '')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getColor(p) }}></span>
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{p.postal_code} {p.city}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>👥 {getEffectifLabel(p.effectif)}</span>
                      <span>📏 {Math.round(p.distance)} km</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-bold text-primary-600">#{idx + 1}</span>
                    {p.prospection_status === 'rdv_pris' && <div className="text-xs text-green-600">🔥 RDV</div>}
                    {p.prospection_status === 'a_rappeler' && <div className="text-xs text-orange-600">🟡</div>}
                  </div>
                </div>
              </button>
            ))}
            {sorted.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">
                Aucun prospect dans ce périmètre
              </div>
            )}
          </div>

          {/* Détail prospect sélectionné */}
          {selectedProspect && (
            <div className="border-t bg-blue-50 p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{selectedProspect.name}</p>
                  <p className="text-xs text-gray-600">{selectedProspect.postal_code} {selectedProspect.city}</p>
                </div>
                <button onClick={() => setSelectedProspect(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
              </div>
              {selectedProspect.phone && (
                <a href={'tel:' + selectedProspect.phone.replace(/\s/g, '')}
                  className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 justify-center">
                  <Phone className="w-4 h-4" /> {selectedProspect.phone}
                </a>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded px-2 py-1.5">
                  <span className="text-gray-500">Effectif</span>
                  <p className="font-medium">{getEffectifLabel(selectedProspect.effectif)}</p>
                </div>
                <div className="bg-white rounded px-2 py-1.5">
                  <span className="text-gray-500">Distance</span>
                  <p className="font-medium">{Math.round(selectedProspect.distance)} km</p>
                </div>
                <div className="bg-white rounded px-2 py-1.5">
                  <span className="text-gray-500">Score</span>
                  <p className="font-medium">{selectedProspect.quality_score || '-'}</p>
                </div>
                <div className="bg-white rounded px-2 py-1.5">
                  <span className="text-gray-500">Priorité</span>
                  <p className="font-medium">#{sorted.findIndex(p => p.id === selectedProspect.id) + 1}</p>
                </div>
              </div>
              {selectedProspect.email && (
                <p className="text-xs text-gray-500 truncate">📧 {selectedProspect.email}</p>
              )}
              {selectedProspect.site_web && (
                <a href={(selectedProspect.site_web.startsWith('http') ? '' : 'https://') + selectedProspect.site_web}
                  target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                  🌐 {selectedProspect.site_web}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
