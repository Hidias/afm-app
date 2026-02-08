import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { 
  Phone, CheckCircle, RefreshCw, SkipForward,
  Building2, MapPin, Mail, List, Search, Sparkles, Loader2, Map as MapIcon, Navigation, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Points de départ
const BASES = {
  concarneau: { name: 'Concarneau', who: 'Hicham', lat: 47.8742, lng: -3.9196 },
  derval: { name: 'Derval', who: 'Maxime', lat: 47.6639, lng: -1.6689 },
}

// Distance Haversine en km
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Couleur point carte
function getMapColor(p) {
  if (p.prospection_status === 'pas_interesse') return '#9CA3AF'
  if (p.prospection_status === 'rdv_pris') return '#10B981'
  if (p.prospection_status === 'a_rappeler') return '#F59E0B'
  const eff = parseInt(p.effectif) || 0
  if (eff >= 50) return '#EF4444'
  if (eff >= 20) return '#F97316'
  if (eff >= 6) return '#EAB308'
  return '#94A3B8'
}

// Recentrer la carte
function MapRecenter({ center, zoom }) {
  const map = useMap()
  useEffect(() => { map.setView(center, zoom) }, [center, zoom])
  return null
}

const FORMATIONS = [
  'SST / MAC SST',
  'Initiation gestes de premiers secours (4h+)',
  'Gestes & Postures / TMS',
  'Incendie (EPI, extincteurs, évacuation)',
  'Habilitation électrique B0/H0V',
  'Conduite chariot élévateur R489',
  'Conduite gerbeur R485',
  'DUERP (Document Unique)',
  'Formation sur mesure'
]

const TEMPLATES_NOTES = [
  { label: '🔥 Intéressé - Veut devis', value: 'Intéressé. Demande devis pour [X] personnes. Formations : [liste]. Budget disponible.' },
  { label: '🟡 À rappeler', value: 'À rappeler le [date] à [heure]. Raison : [Dirigeant absent / En réunion / Demande rappel]' },
  { label: '❄️ Déjà prestataire', value: 'Travaille déjà avec [nom organisme]. À recontacter dans [3/6 mois] pour renouvellement.' },
  { label: '📞 Message laissé', value: 'Message laissé. Email de présentation envoyé. À relancer dans 2 jours si pas de retour.' },
  { label: '⚠️ Barrage secrétariat', value: 'Barrage secrétariat. Contact décideur : [Nom] [Email]. Mail envoyé.' },
  { label: '📧 Envoyer mail', value: 'Envoyer un mail de présentation à [email]. Rappeler dans 48h.' },
  { label: '🏢 Voir siège', value: 'Contacter le siège au [numéro]. Demander [nom/service].' },
]

const CALL_RESULTS = [
  { id: 'chaud', label: '🔥 Intéressé', sublabel: 'Veut un RDV', color: 'green' },
  { id: 'tiede', label: '🟡 Tiède', sublabel: 'À rappeler', color: 'orange' },
  { id: 'froid', label: '❄️ Pas intéressé', sublabel: 'Archiver', color: 'blue' },
  { id: 'no_answer', label: '📞 Pas de réponse', sublabel: 'Répondeur', color: 'gray' },
  { id: 'blocked', label: '⚠️ Barrage', sublabel: 'Secrétariat', color: 'red' },
  { id: 'wrong_number', label: '❌ Numéro erroné', sublabel: 'À corriger', color: 'purple' },
]

const COLOR_MAP = {
  green: { active: 'bg-green-500 text-white border-green-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
  orange: { active: 'bg-orange-500 text-white border-orange-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
  blue: { active: 'bg-blue-500 text-white border-blue-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
  gray: { active: 'bg-gray-500 text-white border-gray-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
  red: { active: 'bg-red-500 text-white border-red-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
  purple: { active: 'bg-purple-500 text-white border-purple-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
}

export default function MarinePhoning() {
  // Mapping tranche effectifs INSEE
  const EFFECTIF_LABELS = {
    '00': '0 sal.', '01': '1-2 sal.', '02': '3-5 sal.', '03': '6-9 sal.',
    '11': '10-19 sal.', '12': '20-49 sal.', '21': '50-99 sal.', '22': '100-199 sal.',
    '31': '200-249 sal.', '32': '250-499 sal.', '41': '500-999 sal.', '42': '1000-1999 sal.',
    '51': '2000-4999 sal.', '52': '5000-9999 sal.', '53': '10000+ sal.',
  }
  const getEffectifLabel = (code) => code ? (EFFECTIF_LABELS[String(code)] || code + ' sal.') : null
  const { user } = useAuthStore()
  const ADMIN_EMAIL = 'hicham.saidi@accessformation.pro'
  const isAdmin = user?.email === ADMIN_EMAIL
  const CALLERS = ['Marine', 'Hicham', 'Maxime']
  const getCallerFromEmail = (email) => {
    if (email === 'hicham.saidi@accessformation.pro') return 'Hicham'
    if (email === 'maxime.langlais@accessformation.pro') return 'Maxime'
    return 'Marine' // contact@ ou autre = Marine
  }
  const [callerName, setCallerName] = useState(getCallerFromEmail(user?.email))

  const [prospects, setProspects] = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [departementFilter, setDepartementFilter] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [totalCount, setTotalCount] = useState(0)

  const [contactName, setContactName] = useState('')
  const [contactFunction, setContactFunction] = useState('Dirigeant')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [callResult, setCallResult] = useState('chaud')
  const [formationsSelected, setFormationsSelected] = useState([])
  const [notes, setNotes] = useState('')
  const [createRdv, setCreateRdv] = useState(false)
  const [rdvAssignedTo, setRdvAssignedTo] = useState('Hicham')
  const [rdvDate, setRdvDate] = useState('')
  const [needsCallback, setNeedsCallback] = useState(false)
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('14:00')
  const [callbackReason, setCallbackReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [callHistory, setCallHistory] = useState([])
  const [duplicates, setDuplicates] = useState([])
  const [statusFilter, setStatusFilter] = useState('a_appeler')
  const [effectifFilter, setEffectifFilter] = useState('')
  const [mapBase, setMapBase] = useState('concarneau')
  const [mapRadius, setMapRadius] = useState(0)
  const [showCircles, setShowCircles] = useState(true)
  const [mapSelected, setMapSelected] = useState(null)

  const departements = [...new Set(prospects.map(p => p.departement))].filter(Boolean).sort()

  useEffect(() => { loadProspects() }, [])

  async function loadProspects() {
    setLoading(true)
    try {
      // Appel RPC — dédup SIREN côté serveur, une seule requête
      const { data, error } = await supabase.rpc('get_unique_prospects')
      if (error) throw error

      // Trier par quality_score desc
      const sorted = (data || []).sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))

      setProspects(sorted)
      setTotalCount(sorted.length)

      if (viewMode === 'file' && sorted.length > 0 && !current) {
        selectProspect(sorted[0])
      }
    } catch (err) {
      console.error('Erreur chargement:', err)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  function selectProspect(prospect) {
    setCurrent(prospect)
    setContactName('')
    setContactFunction('Dirigeant')
    setContactEmail(prospect.email || '')
    setContactMobile('')
    setCallResult('chaud')
    setFormationsSelected([])
    setNotes('')
    setCreateRdv(false)
    setRdvAssignedTo('Hicham')
    setRdvDate('')
    setNeedsCallback(false)
    setCallbackDate('')
    setCallbackTime('14:00')
    setCallbackReason('')
    // Charger le résumé IA
    loadAiSummary(prospect)
    // Charger l'historique d'appels
    loadCallHistory(prospect)
    // Chercher les doublons
    loadDuplicates(prospect)
  }

  async function loadDuplicates(prospect) {
    setDuplicates([])
    try {
      const found = []
      const myId = prospect.id
      const mySiren = prospect.siren

      // 1. Même SIREN (autres établissements du même groupe)
      if (mySiren) {
        const { data } = await supabase
          .from('prospection_massive')
          .select('id, name, city, departement, phone, prospection_status')
          .eq('siren', mySiren)
          .neq('id', myId)
          .limit(10)
        if (data?.length) {
          data.forEach(d => found.push({ ...d, reason: 'Même SIREN (groupe)' }))
        }
      }

      // 2. Même téléphone
      if (prospect.phone) {
        const cleanPhone = prospect.phone.replace(/\s/g, '')
        const { data } = await supabase
          .from('prospection_massive')
          .select('id, name, city, departement, phone, prospection_status')
          .neq('id', myId)
          .or(`phone.eq.${cleanPhone},phone.eq.${prospect.phone}`)
          .limit(10)
        if (data?.length) {
          data.filter(d => !found.some(f => f.id === d.id))
            .forEach(d => found.push({ ...d, reason: 'Même téléphone' }))
        }
      }

      // 3. Même email (sauf génériques)
      if (prospect.email) {
        const emailPrefix = prospect.email.split('@')[0]?.toLowerCase()
        const isGeneric = ['contact', 'info', 'accueil', 'commercial', 'admin', 'bonjour', 'hello'].includes(emailPrefix)
        if (!isGeneric) {
          const { data } = await supabase
            .from('prospection_massive')
            .select('id, name, city, departement, phone, prospection_status')
            .eq('email', prospect.email)
            .neq('id', myId)
            .limit(10)
          if (data?.length) {
            data.filter(d => !found.some(f => f.id === d.id))
              .forEach(d => found.push({ ...d, reason: 'Même email' }))
          }
        }
      }

      // 4. Même site web (domaine)
      if (prospect.site_web) {
        const domain = prospect.site_web.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
        if (domain && domain.length > 3) {
          const { data } = await supabase
            .from('prospection_massive')
            .select('id, name, city, departement, phone, prospection_status, site_web')
            .neq('id', myId)
            .ilike('site_web', `%${domain}%`)
            .limit(10)
          if (data?.length) {
            data.filter(d => !found.some(f => f.id === d.id))
              .forEach(d => found.push({ ...d, reason: 'Même site web' }))
          }
        }
      }

      setDuplicates(found)
    } catch (err) {
      console.error('Erreur doublons:', err)
    }
  }

  async function loadCallHistory(prospect) {
    setCallHistory([])
    try {
      // Trouver le client correspondant par SIREN
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('siren', prospect.siren)
        .limit(1)
      
      if (clients && clients.length > 0) {
        const { data: calls } = await supabase
          .from('prospect_calls')
          .select('*')
          .eq('client_id', clients[0].id)
          .order('created_at', { ascending: false })
          .limit(5)
        setCallHistory(calls || [])
        
        // Pré-remplir avec le dernier contact connu
        if (calls && calls.length > 0) {
          const last = calls[0]
          if (last.contact_name) setContactName(last.contact_name)
          if (last.contact_function) setContactFunction(last.contact_function)
          if (last.contact_email) setContactEmail(last.contact_email)
          if (last.contact_mobile) setContactMobile(last.contact_mobile)
        }
      }
    } catch (err) {
      console.error('Erreur historique appels:', err)
    }
  }

  async function loadAiSummary(prospect) {
    // Si déjà en cache dans la base
    if (prospect.ai_summary) {
      setAiSummary(prospect.ai_summary)
      return
    }
    
    setAiSummary('')
    setAiSummaryLoading(true)
    try {
      const res = await fetch('/api/generate-prospect-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prospect.name,
          city: prospect.city,
          naf: prospect.naf,
          effectif: prospect.effectif,
          site_web: prospect.site_web,
          siret: prospect.siret,
        })
      })
      const data = await res.json()
      if (data.success && data.summary) {
        setAiSummary(data.summary)
        // Sauvegarder en cache dans la base
        await supabase
          .from('prospection_massive')
          .update({ ai_summary: data.summary })
          .eq('id', prospect.id)
        // Mettre à jour le prospect local
        prospect.ai_summary = data.summary
      }
    } catch (err) {
      console.error('Erreur résumé IA:', err)
    } finally {
      setAiSummaryLoading(false)
    }
  }

  async function findOrCreateClient(prospect) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('siren', prospect.siren)
      .maybeSingle()

    if (existing) return existing.id

    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        name: prospect.name,
        address: prospect.city ? prospect.postal_code + ' ' + prospect.city : null,
        postal_code: prospect.postal_code,
        city: prospect.city,
        siret: prospect.siret,
        siren: prospect.siren,
        contact_phone: prospect.phone,
        email: prospect.email || null,
        website: prospect.site_web || null,
        taille_entreprise: prospect.effectif || null,
        status: 'prospect',
        type: 'prospect',
      })
      .select('id')
      .single()

    if (error) throw error
    return newClient.id
  }

  async function handleSave() {
    if (!current) return
    setSaving(true)

    try {
      const clientId = await findOrCreateClient(current)

      const { data: insertedCall, error: callError } = await supabase
        .from('prospect_calls')
        .insert({
          client_id: clientId,
          called_by: callerName,
          contact_name: contactName || null,
          contact_function: contactFunction || null,
          contact_email: contactEmail || null,
          contact_mobile: contactMobile || null,
          call_result: callResult,
          formations_mentioned: formationsSelected.length > 0 ? formationsSelected : null,
          notes: notes || null,
          rdv_created: createRdv,
          needs_callback: needsCallback,
          callback_date: needsCallback ? callbackDate : null,
          callback_time: needsCallback ? callbackTime : null,
          callback_reason: needsCallback ? callbackReason : null,
        })
        .select()
        .single()

      if (callError) throw callError

      // Mettre à jour client
      const clientUpdates = {}
      if (contactName) clientUpdates.contact_name = contactName
      if (contactEmail) clientUpdates.contact_email = contactEmail
      if (contactMobile) clientUpdates.mobile = contactMobile
      if (contactFunction) clientUpdates.contact_function = contactFunction
      if (Object.keys(clientUpdates).length > 0) {
        await supabase.from('clients').update(clientUpdates).eq('id', clientId)
      }

      // Créer RDV
      if (createRdv && rdvDate) {
        const { data: insertedRdv, error: rdvError } = await supabase
          .from('prospect_rdv')
          .insert({
            client_id: clientId,
            rdv_date: rdvDate,
            rdv_type: 'decouverte',
            conducted_by: rdvAssignedTo,
            status: 'a_prendre',
            contact_name: contactName || null,
            contact_email: contactEmail || null,
            contact_phone: contactMobile || null,
            formations_interet: formationsSelected.length > 0 ? formationsSelected : null,
            notes: 'Créé par ' + callerName + ' suite à appel téléphonique.\n\nNotes:\n' + notes,
            temperature: 'chaud',
            source: 'phoning_' + callerName.toLowerCase().replace(' ', '_'),
          })
          .select()
          .single()

        if (rdvError) throw rdvError
        await supabase.from('prospect_calls').update({ rdv_id: insertedRdv.id }).eq('id', insertedCall.id)

        // Créer notification pour le dashboard
        await supabase.from('notifications').insert({
          title: '🔥 Nouveau RDV phoning — ' + current.name,
          message: callerName + ' a décroché un RDV pour ' + rdvAssignedTo + ' le ' + new Date(rdvDate).toLocaleDateString('fr-FR') + (formationsSelected.length > 0 ? ' • ' + formationsSelected.join(', ') : ''),
          type: 'rdv_phoning',
          link: '/prospection/' + insertedRdv.id,
        })
      }

      // Mettre à jour prospection_massive
      let newStatus = null
      if (callResult === 'chaud') newStatus = 'rdv_pris'
      else if (callResult === 'froid') newStatus = 'pas_interesse'
      else if (callResult === 'tiede' || callResult === 'no_answer' || callResult === 'blocked') newStatus = 'a_rappeler'
      else if (callResult === 'wrong_number') newStatus = 'numero_errone'

      await supabase
        .from('prospection_massive')
        .update({
          contacted: true,
          contacted_at: new Date().toISOString(),
          prospection_status: newStatus,
          prospection_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('siren', current.siren)

      let message = '✅ Appel enregistré'
      if (createRdv) message += ' • RDV créé pour ' + rdvAssignedTo
      if (needsCallback) {
        message += ' • Rappel programmé'
        // Notification rappel
        await supabase.from('notifications').insert({
          title: '🔔 Rappel phoning — ' + current.name,
          message: callerName + ' → rappeler le ' + new Date(callbackDate).toLocaleDateString('fr-FR') + ' à ' + callbackTime + (callbackReason ? ' (' + callbackReason + ')' : '') + (contactName ? ' • Contact : ' + contactName : ''),
          type: 'rappel_phoning',
          link: '/prospection-massive',
          metadata: {
            callback_date: callbackDate,
            callback_time: callbackTime,
            prospect_name: current.name,
            prospect_phone: current.phone,
            contact_name: contactName,
          }
        })
        // Envoyer email rappel avec .ics
        try {
          await fetch('/api/send-callback-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prospectName: current.name,
              prospectPhone: current.phone,
              contactName: contactName,
              contactFunction: contactFunction,
              callbackDate,
              callbackTime,
              callbackReason,
              callerName,
              notes,
            })
          })
        } catch (emailErr) {
          console.error('Erreur envoi email rappel:', emailErr)
        }
      }
      toast.success(message)

      goNext()
      await loadProspects()

    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur: ' + (error.message || 'Échec sauvegarde'))
    } finally {
      setSaving(false)
    }
  }

  function goNext() {
    if (!current || viewMode === 'list') {
      setCurrent(null)
      return
    }
    const idx = prospects.findIndex(p => p.id === current.id)
    if (idx < prospects.length - 1) {
      selectProspect(prospects[idx + 1])
    } else {
      setCurrent(null)
      loadProspects()
    }
  }

  function handleSkip() {
    if (!current) return
    toast.info('Prospect passé')
    goNext()
  }

  const STATUS_FILTERS = [
    { id: 'a_appeler', label: '📞 À appeler', count: prospects.filter(p => !p.prospection_status || p.prospection_status === 'a_appeler').length },
    { id: 'a_rappeler', label: '🟡 Tiède / À rappeler', count: prospects.filter(p => p.prospection_status === 'a_rappeler').length },
    { id: 'rdv_pris', label: '🔥 Intéressé - RDV à prendre', count: prospects.filter(p => p.prospection_status === 'rdv_pris').length },
    { id: 'pas_interesse', label: '❄️ Pas intéressé', count: prospects.filter(p => p.prospection_status === 'pas_interesse').length },
    { id: 'numero_errone', label: '❌ Numéro erroné', count: prospects.filter(p => p.prospection_status === 'numero_errone').length },
    { id: 'tous', label: '📋 Tous', count: prospects.length },
  ]

  const filtered = prospects.filter(p => {
    // Filtre statut
    if (statusFilter === 'a_appeler' && p.prospection_status && p.prospection_status !== 'a_appeler') return false
    if (statusFilter === 'a_rappeler' && p.prospection_status !== 'a_rappeler') return false
    if (statusFilter === 'rdv_pris' && p.prospection_status !== 'rdv_pris') return false
    if (statusFilter === 'pas_interesse' && p.prospection_status !== 'pas_interesse') return false
    if (statusFilter === 'numero_errone' && p.prospection_status !== 'numero_errone') return false
    // Filtre département
    if (departementFilter && p.departement !== departementFilter) return false
    // Filtre effectif
    if (effectifFilter) {
      const eff = parseInt(p.effectif) || 0
      if (effectifFilter === '6-19' && (eff < 6 || eff > 19)) return false
      if (effectifFilter === '20-49' && (eff < 20 || eff > 49)) return false
      if (effectifFilter === '50-99' && (eff < 50 || eff > 99)) return false
      if (effectifFilter === '100-249' && (eff < 100 || eff > 249)) return false
      if (effectifFilter === '250+' && eff < 250) return false
    }
    // Filtre recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return p.name?.toLowerCase().includes(term) || p.city?.toLowerCase().includes(term) || p.phone?.includes(term)
    }
    return true
  })

  // Enrichir avec distance pour la carte
  const basePoint = BASES[mapBase]
  const mapProspects = useMemo(() => {
    return filtered
      .filter(p => p.latitude && p.longitude)
      .map(p => {
        const dist = distanceKm(basePoint.lat, basePoint.lng, p.latitude, p.longitude)
        const potentiel = (p.quality_score || 50) + (parseInt(p.effectif) || 0) * 0.5
        const priorite = dist > 0 ? potentiel / Math.sqrt(dist) : potentiel * 10
        return { ...p, distance: dist, potentiel, priorite }
      })
      .filter(p => mapRadius === 0 || p.distance <= mapRadius)
      .sort((a, b) => b.priorite - a.priorite)
  }, [filtered, mapBase, mapRadius])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // 📥 Export CSV au format Sheets Marine
  function exportCSV() {
    const headers = ['Société','ID','Type','Forme','NAF','VILLE','CP','Nom','Prénom','Mail','Téléphone','Fonction','Appel abouti','Appel non abouti','Suivi','RDV à prendre']
    
    const rows = filtered.map(p => {
      const status = p.prospection_status
      const suivi = status === 'rdv_pris' ? 'RDV pris' 
        : status === 'a_rappeler' ? 'À rappeler'
        : status === 'pas_interesse' ? 'Pas intéressé'
        : status === 'injoignable' ? 'Injoignable'
        : status === 'numero_errone' ? 'Numéro erroné'
        : ''
      
      let tel = p.phone || ''
      if (tel.startsWith('0')) tel = '+33' + tel.slice(1).replace(/\s/g, '')
      
      return [
        p.name || '',
        p.siren || '',
        'P',
        '',
        p.naf || '',
        p.city || '',
        p.postal_code || '',
        '', '', // Nom, Prénom contact
        p.email || '',
        tel,
        '', '', '', // Fonction, Appel abouti, Appel non abouti
        suivi,
        status === 'rdv_pris' ? 'Oui' : '',
      ]
    })
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => {
        const s = String(cell).replace(/"/g, '""')
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
      }).join(','))
      .join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `phoning_export_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📞 Phoning</h1>
          <p className="text-gray-600 mt-1">{filtered.length} prospects affichés sur {prospects.length}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {CALLERS.map(c => (
              <button key={c} onClick={() => setCallerName(c)}
                className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (callerName === c ? 'bg-white shadow text-gray-900' : 'text-gray-600')}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('list')}
              className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600')}>
              <List className="w-4 h-4 inline mr-1" /> Liste
            </button>
            <button onClick={() => { setViewMode('file'); if (filtered.length > 0 && !current) selectProspect(filtered[0]) }}
              className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (viewMode === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600')}>
              <SkipForward className="w-4 h-4 inline mr-1" /> File
            </button>
            <button onClick={() => setViewMode('carte')}
              className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (viewMode === 'carte' ? 'bg-white shadow text-gray-900' : 'text-gray-600')}>
              <MapIcon className="w-4 h-4 inline mr-1" /> Carte
            </button>
          </div>
        </div>
      </div>

      {/* Filtres statut */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button key={s.id} onClick={() => setStatusFilter(s.id)}
            className={'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ' +
              (statusFilter === s.id
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}>
            {s.label} <span className="ml-1 font-bold">{s.count}</span>
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom, ville, téléphone..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
        </div>
        <select value={departementFilter} onChange={(e) => setDepartementFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
          <option value="">Tous les dép.</option>
          {departements.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={effectifFilter} onChange={(e) => setEffectifFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
          <option value="">Tous effectifs</option>
          <option value="6-19">6-19 sal.</option>
          <option value="20-49">20-49 sal.</option>
          <option value="50-99">50-99 sal.</option>
          <option value="100-249">100-249 sal.</option>
          <option value="250+">250+ sal.</option>
        </select>
        <button onClick={loadProspects} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg" title="Rafraîchir">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button onClick={exportCSV} className="px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium" title="Exporter CSV">
          📥 CSV
        </button>
      </div>

      {filtered.length === 0 && !current && viewMode !== 'carte' ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucun prospect à appeler</h2>
          <p className="text-gray-600">Enrichissez des prospects dans l'onglet Enrichissement</p>
        </div>
      ) : viewMode === 'carte' ? (
        <div className="space-y-3">
          {/* Contrôles carte */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {Object.entries(BASES).map(([key, val]) => (
                <button key={key} onClick={() => setMapBase(key)}
                  className={'px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
                    (mapBase === key ? 'bg-white shadow text-gray-900' : 'text-gray-600')}>
                  📍 {val.name} ({val.who})
                </button>
              ))}
            </div>
            <select value={mapRadius} onChange={(e) => setMapRadius(parseInt(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <option value="0">Tous (pas de limite)</option>
              <option value="20">≤ 20 km</option>
              <option value="50">≤ 50 km</option>
              <option value="100">≤ 100 km</option>
              <option value="150">≤ 150 km</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showCircles} onChange={(e) => setShowCircles(e.target.checked)} className="rounded" />
              Cercles distance
            </label>
            <span className="text-sm text-gray-500 ml-auto">
              {mapProspects.length} prospects sur la carte
              {mapRadius > 0 && ` • ≤ ${mapRadius}km de ${BASES[mapBase].name}`}
            </span>
          </div>

          {/* Légende */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1"></span>50+ sal.</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1"></span>20-49</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-1"></span>6-19</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-gray-400 mr-1"></span>&lt;6</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span>RDV pris</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-amber-400 mr-1"></span>À rappeler</span>
          </div>

          {/* Carte + Liste */}
          <div className="flex gap-4" style={{ height: 'calc(100vh - 380px)' }}>
            {/* Carte */}
            <div className="flex-1 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
              <MapContainer
                center={[basePoint.lat, basePoint.lng]}
                zoom={9}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <MapRecenter center={[basePoint.lat, basePoint.lng]} zoom={mapRadius <= 20 ? 11 : mapRadius <= 50 ? 10 : mapRadius <= 100 ? 9 : 8} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

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

                {/* Base marker */}
                <CircleMarker center={[basePoint.lat, basePoint.lng]} radius={10}
                  pathOptions={{ color: '#1E40AF', fillColor: '#3B82F6', fillOpacity: 1, weight: 3 }}>
                  <Popup><strong>📍 {basePoint.name}</strong><br />Base de départ — {basePoint.who}</Popup>
                </CircleMarker>

                {/* Prospects */}
                {mapProspects.map(p => (
                  <CircleMarker
                    key={p.id}
                    center={[p.latitude, p.longitude]}
                    radius={Math.max(4, Math.min(12, (p.quality_score || 50) / 10))}
                    pathOptions={{
                      color: mapSelected?.id === p.id ? '#1E40AF' : '#fff',
                      fillColor: getMapColor(p),
                      fillOpacity: 0.85,
                      weight: mapSelected?.id === p.id ? 3 : 1,
                    }}
                    eventHandlers={{ click: () => setMapSelected(p) }}
                  >
                    <Popup>
                      <div style={{ minWidth: 200 }}>
                        <strong>{p.name}</strong><br />
                        <span style={{ fontSize: 12, color: '#666' }}>{p.postal_code} {p.city}</span><br />
                        {p.phone && <a href={'tel:' + p.phone.replace(/\s/g, '')} style={{ color: '#2563EB', fontWeight: 'bold' }}>📞 {p.phone}</a>}<br />
                        <span style={{ fontSize: 12 }}>
                          👥 {getEffectifLabel(p.effectif)} • 📏 {Math.round(p.distance)} km
                        </span>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>

            {/* Liste latérale triée par priorité */}
            <div className="w-72 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-3 bg-gray-50 border-b text-xs font-semibold text-gray-700">
                ⭐ Triés par priorité (potentiel ÷ distance)
              </div>
              <div className="flex-1 overflow-y-auto">
                {mapProspects.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => { setMapSelected(p); selectProspect(p) }}
                    className={'w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-blue-50 transition-colors ' +
                      (mapSelected?.id === p.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : '')}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getMapColor(p) }}></span>
                          <p className="text-xs font-medium text-gray-900 truncate">{p.name}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{p.city} • 👥 {getEffectifLabel(p.effectif)} • 📏 {Math.round(p.distance)}km</p>
                      </div>
                      <span className="text-xs font-bold text-primary-600">#{idx + 1}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Détail prospect sélectionné */}
              {mapSelected && (
                <div className="border-t bg-blue-50 p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="font-bold text-gray-900 text-sm">{mapSelected.name}</p>
                    <button onClick={() => setMapSelected(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                  </div>
                  <p className="text-xs text-gray-600">{mapSelected.postal_code} {mapSelected.city} • 📏 {Math.round(mapSelected.distance)} km</p>
                  {mapSelected.phone && (
                    <a href={'tel:' + mapSelected.phone.replace(/\s/g, '')}
                      className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 justify-center">
                      <Phone className="w-4 h-4" /> {mapSelected.phone}
                    </a>
                  )}
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="bg-white rounded px-2 py-1"><span className="text-gray-500">Effectif</span><p className="font-medium">{getEffectifLabel(mapSelected.effectif)}</p></div>
                    <div className="bg-white rounded px-2 py-1"><span className="text-gray-500">Score</span><p className="font-medium">{mapSelected.quality_score || '-'}</p></div>
                  </div>
                  <button onClick={() => { selectProspect(mapSelected); setViewMode('file') }}
                    className="w-full px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                    Ouvrir la fiche →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Liste (gauche) */}
          {(viewMode === 'list' || (viewMode === 'file' && !current)) && (
            <div className={(current ? 'w-1/3' : 'w-full') + ' space-y-2 max-h-[70vh] overflow-y-auto'}>
              {filtered.map((p) => (
                <button key={p.id} onClick={() => selectProspect(p)}
                  className={'w-full text-left p-3 rounded-lg border transition-colors ' +
                    (current?.id === p.id ? 'bg-primary-50 border-primary-300 ring-2 ring-primary-200' : 'bg-white border-gray-200 hover:bg-gray-50')}>
                  <div className="flex justify-between items-start">
                    <div className="font-semibold text-gray-900 text-sm">{p.name}</div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{p.quality_score}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">📍 {p.city} ({p.departement}) {p.effectif && '• 👥 ' + getEffectifLabel(p.effectif)}</div>
                  <div className="text-sm text-primary-600 font-medium mt-1">📞 {p.phone}</div>
                  {p.prospection_status === 'a_rappeler' && (
                    <span className="inline-block mt-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">🟡 Tiède / À rappeler</span>
                  )}
                  {p.prospection_status === 'rdv_pris' && (
                    <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">🔥 Intéressé - RDV à prendre</span>
                  )}
                  {p.prospection_status === 'pas_interesse' && (
                    <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">❄️ Pas intéressé</span>
                  )}
                  {p.prospection_status === 'numero_errone' && (
                    <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">❌ Numéro erroné</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Fiche d'appel (droite) */}
          {current && (
            <div className={(viewMode === 'list' ? 'w-2/3' : 'w-full') + ' bg-white rounded-lg border border-gray-200 p-6 space-y-5 max-h-[70vh] overflow-y-auto'}>
              
              {/* Info entreprise */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5" />{current.name}
                    </h2>
                    <div className="text-sm text-gray-600 space-y-1 mt-2">
                      <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{current.postal_code} {current.city} ({current.departement})</div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <a href={'tel:' + current.phone?.replace(/\s/g, '')} className="text-primary-600 hover:underline font-bold text-lg">{current.phone}</a>
                      </div>
                      {current.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4" /><a href={'mailto:' + current.email} className="text-primary-600 hover:underline">{current.email}</a></div>}
                      {current.effectif && <div>👥 {getEffectifLabel(current.effectif)}</div>}
                      {current.siret && <div className="text-xs">SIRET: {current.siret}</div>}
                    </div>
                  </div>
                  {viewMode === 'file' && <span className="text-sm text-gray-500">{prospects.findIndex(p => p.id === current.id) + 1} / {filtered.length}</span>}
                </div>
              </div>

              {/* Alerte doublons */}
              {duplicates.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Informations similaires trouvées ({duplicates.length})
                  </div>
                  <div className="space-y-1">
                    {duplicates.map((d, i) => {
                      const statusLabel = d.prospection_status === 'rdv_pris' ? '✅ RDV pris'
                        : d.prospection_status === 'a_rappeler' ? '🔄 À rappeler'
                        : d.prospection_status === 'pas_interesse' ? '❌ Pas intéressé'
                        : d.prospection_status === 'a_appeler' ? '📞 À appeler'
                        : d.prospection_status === 'injoignable' ? '📵 Injoignable'
                        : '⬜ Non traité'
                      return (
                        <div key={i} className="text-xs text-amber-800 flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{d.name}</span>
                          <span className="text-amber-600">({d.city || d.departement})</span>
                          <span className="bg-amber-100 px-1.5 py-0.5 rounded">{d.reason}</span>
                          <span>{statusLabel}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Résumé IA */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Résumé IA</span>
                  {current.site_web && (
                    <a href={(current.site_web.startsWith('http') ? '' : 'https://') + current.site_web} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-amber-600 hover:underline ml-auto">🌐 {current.site_web}</a>
                  )}
                </div>
                {aiSummaryLoading ? (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyse en cours...
                  </div>
                ) : aiSummary ? (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{aiSummary}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Aucun résumé disponible</p>
                )}
              </div>

              {/* Historique des appels */}
              {callHistory.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-orange-800">📞 Historique ({callHistory.length} appel{callHistory.length > 1 ? 's' : ''})</span>
                  </div>
                  <div className="space-y-2">
                    {callHistory.map(call => (
                      <div key={call.id} className="text-sm border-l-2 border-orange-300 pl-3 py-1">
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="font-medium">{new Date(call.created_at).toLocaleDateString('fr-FR')} à {new Date(call.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>par {call.called_by}</span>
                          <span className={
                            call.call_result === 'chaud' ? 'text-green-600 font-bold' :
                            call.call_result === 'tiede' ? 'text-orange-600 font-bold' :
                            call.call_result === 'froid' ? 'text-blue-600 font-bold' :
                            call.call_result === 'no_answer' ? 'text-gray-500' :
                            call.call_result === 'blocked' ? 'text-yellow-600' :
                            'text-red-600 font-bold'
                          }>
                            {call.call_result === 'chaud' ? '🔥 Intéressé' :
                             call.call_result === 'tiede' ? '🟡 Tiède' :
                             call.call_result === 'froid' ? '❄️ Pas intéressé' :
                             call.call_result === 'no_answer' ? '📞 Pas de réponse' :
                             call.call_result === 'blocked' ? '⚠️ Barrage' :
                             call.call_result === 'wrong_number' ? '❌ N° erroné' : call.call_result}
                          </span>
                        </div>
                        {call.contact_name && <div className="text-gray-600">👤 {call.contact_name}{call.contact_function ? ' — ' + call.contact_function : ''}</div>}
                        {call.notes && <div className="text-gray-700 mt-1">{call.notes}</div>}
                        {call.formations_mentioned && <div className="text-gray-500 text-xs mt-1">Formations : {call.formations_mentioned.join(', ')}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interlocuteur */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">👤 Interlocuteur contacté</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Nom</label>
                    <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                      placeholder="Mme Dupont" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Fonction</label>
                    <select value={contactFunction} onChange={(e) => setContactFunction(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                      <option value="Dirigeant">Dirigeant</option>
                      <option value="RH">RH</option>
                      <option value="QHSE">QHSE</option>
                      <option value="Resp formation">Resp formation</option>
                      <option value="Secrétariat">Secrétariat</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Email</label>
                    <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="m.dupont@entreprise.fr" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Mobile direct</label>
                    <input type="tel" value={contactMobile} onChange={(e) => setContactMobile(e.target.value)}
                      placeholder="06 XX XX XX XX" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                </div>
              </div>

              {/* Résultat */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">🎯 Résultat de l'appel</h3>
                <div className="grid grid-cols-3 gap-2">
                  {CALL_RESULTS.map(r => (
                    <button key={r.id} onClick={() => setCallResult(r.id)}
                      className={'px-3 py-2.5 rounded-lg border text-center transition-colors ' +
                        (callResult === r.id ? COLOR_MAP[r.color].active : COLOR_MAP[r.color].inactive)}>
                      {r.label}<br/><span className="text-xs">{r.sublabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Formations */}
              {(callResult === 'chaud' || callResult === 'tiede') && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">🎓 Formations évoquées</h3>
                  <div className="space-y-2">
                    {FORMATIONS.map((f) => (
                      <label key={f} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formationsSelected.includes(f)}
                          onChange={(e) => e.target.checked ? setFormationsSelected([...formationsSelected, f]) : setFormationsSelected(formationsSelected.filter(x => x !== f))}
                          className="rounded" />
                        <span className="text-sm">{f}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">📝 Notes & observations</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {TEMPLATES_NOTES.map((t) => (
                    <button key={t.label} onClick={() => setNotes(t.value)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-left">{t.label}</button>
                  ))}
                </div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes, observations, consignes (contacter tel numéro, voir avec le siège, envoyer un mail, etc.)..."
                  rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>

              {/* RDV */}
              {callResult === 'chaud' && (
                <div className="bg-green-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input type="checkbox" checked={createRdv} onChange={(e) => setCreateRdv(e.target.checked)} className="rounded" />
                    <span className="font-semibold text-gray-900">📅 Créer RDV pour Hicham/Maxime</span>
                  </label>
                  {createRdv && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Date souhaitée</label>
                        <input type="date" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Assigné à</label>
                        <div className="flex gap-2">
                          {['Hicham', 'Maxime'].map(name => (
                            <button key={name} onClick={() => setRdvAssignedTo(name)}
                              className={'flex-1 px-3 py-2 rounded-lg border ' + (rdvAssignedTo === name ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-700 border-gray-300')}>
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rappel */}
              {(callResult === 'tiede' || callResult === 'no_answer' || callResult === 'blocked') && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input type="checkbox" checked={needsCallback} onChange={(e) => setNeedsCallback(e.target.checked)} className="rounded" />
                    <span className="font-semibold text-gray-900">🔔 Programmer un rappel</span>
                  </label>
                  {needsCallback && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Date</label>
                        <input type="date" value={callbackDate} onChange={(e) => setCallbackDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Heure</label>
                        <input type="time" value={callbackTime} onChange={(e) => setCallbackTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Raison</label>
                        <input type="text" value={callbackReason} onChange={(e) => setCallbackReason(e.target.value)}
                          placeholder="Dirigeant absent" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t sticky bottom-0 bg-white">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                  {saving ? (<><RefreshCw className="w-5 h-5 animate-spin" /> Enregistrement...</>) : (<><CheckCircle className="w-5 h-5" /> 💾 Enregistrer & Suivant</>)}
                </button>
                <button onClick={handleSkip}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
                  <SkipForward className="w-5 h-5" /> Passer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
