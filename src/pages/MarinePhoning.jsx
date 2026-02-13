import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { 
  Phone, CheckCircle, RefreshCw, SkipForward,
  Building2, MapPin, Mail, List, Search, Sparkles, Loader2, Map as MapIcon, Navigation, AlertTriangle,
  Clock, PhoneOff, XCircle, Snowflake, Bell, Plus, Edit2, Briefcase, Send, ArrowLeft, MessageSquare, BarChart3
} from 'lucide-react'
import toast from 'react-hot-toast'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const BASES = {
  concarneau: { name: 'Concarneau', who: 'Hicham', lat: 47.8742, lng: -3.9196 },
  derval: { name: 'Derval', who: 'Maxime', lat: 47.6639, lng: -1.6689 },
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const EFFECTIF_NUM = {
  '00': 0, '01': 1, '02': 3, '03': 6, '11': 10, '12': 20,
  '21': 50, '22': 100, '31': 200, '32': 250, '41': 500,
  '42': 1000, '51': 2000, '52': 5000, '53': 10000,
}

function getMapColor(p) {
  if (p.prospection_status === 'pas_interesse') return '#9CA3AF'
  if (p.prospection_status === 'rdv_pris') return '#10B981'
  if (p.prospection_status === 'a_rappeler') return '#F59E0B'
  const eff = EFFECTIF_NUM[String(p.effectif)] || 0
  if (eff >= 50) return '#EF4444'
  if (eff >= 20) return '#F97316'
  if (eff >= 6) return '#EAB308'
  return '#94A3B8'
}

function MapRecenter({ center, zoom }) {
  const map = useMap()
  useEffect(() => { map.setView(center, zoom) }, [center, zoom])
  return null
}

const FORMATIONS = [
  'SST / MAC SST', 'Initiation gestes de premiers secours (4h+)',
  'Gestes & Postures / TMS', 'Incendie (EPI, extincteurs, évacuation)',
  'Habilitation électrique B0/H0V', 'Conduite chariot élévateur R489',
  'Conduite gerbeur R485', 'DUERP (Document Unique)', 'Formation sur mesure'
]

const TEMPLATES_NOTES = [
  { label: '🔥 Veut devis', value: 'Intéressé. Demande devis pour [X] personnes. Formations : [liste]. Budget disponible.' },
  { label: '🟡 À rappeler', value: 'À rappeler le [date] à [heure]. Raison : [Dirigeant absent / En réunion / Demande rappel]' },
  { label: '❄️ Déjà prestataire', value: 'Travaille déjà avec [nom organisme]. À recontacter dans [3/6 mois] pour renouvellement.' },
  { label: '📞 Message laissé', value: 'Message laissé. Email de présentation envoyé. À relancer dans 2 jours si pas de retour.' },
  { label: '⚠️ Barrage', value: 'Barrage secrétariat. Contact décideur : [Nom] [Email]. Mail envoyé.' },
  { label: '📧 Mail', value: 'Envoyer un mail de présentation à [email]. Rappeler dans 48h.' },
  { label: '🏢 Siège', value: 'Contacter le siège au [numéro]. Demander [nom/service].' },
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
  const EFFECTIF_LABELS = {
    '00': '0 sal.', '01': '1-2 sal.', '02': '3-5 sal.', '03': '6-9 sal.',
    '11': '10-19 sal.', '12': '20-49 sal.', '21': '50-99 sal.', '22': '100-199 sal.',
    '31': '200-249 sal.', '32': '250-499 sal.', '41': '500-999 sal.', '42': '1000-1999 sal.',
    '51': '2000-4999 sal.', '52': '5000-9999 sal.', '53': '10000+ sal.',
  }
  const getEffectifLabel = (code) => code ? (EFFECTIF_LABELS[String(code)] || code + ' sal.') : null

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

  // Groupement forme juridique — codes explicites
  const FORME_GROUP_CODES = {
    'SAS/SASU': ['5505','5510','5515','5520','5522','5525','5530','5532','5542','5548','5551','5558'],
    'SARL/EURL': ['5306','5307','5308','5370','5385','5410','5415','5422','5426','5430','5431','5432','5443','5600'],
    'SA/SCA': ['5191','5192','5193','5194','5195','5196','5199','5202','5451','5453','5454','5455','5458',
      '5460','5470','5485','5498','5499','5546','5547','5560','5599','5699','5710','5720','5785','5800'],
    'EI': ['1000'],
    'Association': ['9110','9210','9220','9221','9223','9224','9230','9300','9900','9970','9971','9972'],
    'Public': ['3110','3120','3210','3310','7111','7172','7210','7220','7230','7321','7322','7323',
      '7331','7346','7361','7362','7363','7364','7366','7372','7373','7383','7389','7430','7470','7530'],
  }
  const _CODE_TO_GROUP = {}
  Object.entries(FORME_GROUP_CODES).forEach(([group, codes]) => {
    codes.forEach(c => { _CODE_TO_GROUP[c] = group })
  })
  function getFormeGroup(code) {
    if (!code) return null
    return _CODE_TO_GROUP[String(code)] || 'Autre'
  }

  const FORMES_JURIDIQUES = {
    '1000':'EI','2110':'Indivision','2310':'GIE','2900':'Autre groupement',
    '3110':'Représentation État','3210':'SA éco. mixte','3310':'SA HLM',
    '4110':'SCI','4120':'SCI construction vente','4130':'SCI attribution',
    '5191':'SNC','5192':'SCS','5193':'SEP','5194':'SCOP','5195':'SA',
    '5196':'SA coopérative','5199':'Sté comm.','5202':'SCOP',
    '5306':'SARL','5307':'SARL assoc. unique','5308':'SARL HLM',
    '5310':'SAS','5370':'Sté prof. lib.','5385':'SAS',
    '5410':'SARL unipersonnelle','5415':'EURL','5422':'SARL',
    '5426':'SARL capital variable','5430':'SARL','5431':'SARL unique',
    '5432':'SARL','5443':'SARL exercice libéral',
    '5451':'SA','5453':'SA board','5454':'SA directoire',
    '5455':'SA unipersonnelle','5458':'SA prof. lib.',
    '5460':'SA coop.','5470':'SELAFA','5485':'SA capital variable',
    '5498':'SA coop.','5499':'SA coop.',
    '5505':'SAS','5510':'SAS','5515':'SASU','5520':'SAS capital variable',
    '5522':'SAS prof. lib.','5525':'SASU prof. lib.',
    '5530':'SAS coop.','5532':'SAS SPL','5542':'SAS intérêt collectif',
    '5546':'SA HLM','5547':'SE','5548':'SE SAS','5551':'SE SAS unipersonnelle',
    '5558':'SCOP','5599':'SA',
    '5600':'Autre SARL','5699':'Autre SA',
    '5710':'SCA','5720':'SCA intérêt collectif','5800':'SCOP',
    '6100':'Caisse épargne','6220':'Mutuelle','6316':'CUMA',
    '6317':'Coop. agricole','6411':'Mutuelle santé','6598':'MSA',
    '6521':'SCPI','6532':'Sté assurance mutuelle',
    '6540':'Syndicat copropriétaires','6551':'Fondation',
    '7111':'État','7210':'Commune','7220':'Département','7230':'Région',
    '7321':'CC','7322':'CA','7323':'Métropole',
    '7361':'CCI','7362':'Chambre métiers','7363':'Chambre agriculture',
    '7372':'Centre hospitalier','7373':'EHPAD public',
    '7383':'Établissement public','7430':'EPA national',
    '7470':'EPIC national','7530':'EPIC local',
    '8210':'Mutuelle','8321':'CSE','8331':'CSE',
    '8450':'Syndicat salariés','9210':'Association déclarée',
    '9220':'Association droit local','9221':'Association inscrite',
    '9224':'Association reconnue utilité publique',
    '9230':'Association loi 1901','9300':'Fondation',
    '9900':'Autre personne morale droit privé',
    '9970':'GCS','9971':'GCS pub.','9972':'GCS priv.'
  }
  const getFormeLabel = (code) => code ? (FORMES_JURIDIQUES[String(code)] || String(code)) : ''

  const { user } = useAuthStore()
  const ADMIN_EMAIL = 'hicham.saidi@accessformation.pro'
  const isAdmin = user?.email === ADMIN_EMAIL
  const CALLERS = ['Marine', 'Hicham', 'Maxime']
  const getCallerFromEmail = (email) => {
    if (email === 'hicham.saidi@accessformation.pro') return 'Hicham'
    if (email === 'maxime.langlais@accessformation.pro') return 'Maxime'
    return 'Marine'
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
  const [rdvDispoNote, setRdvDispoNote] = useState('')
  const [rdvUrgency, setRdvUrgency] = useState('')
  const [needsCallback, setNeedsCallback] = useState(false)
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('14:00')
  const [callbackReason, setCallbackReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const currentProspectRef = useRef(null)
  const prospectStartTime = useRef(null) // Timer invisible pour reporting
  const [callHistory, setCallHistory] = useState([])
  const [duplicates, setDuplicates] = useState([])
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [editPhoneValue, setEditPhoneValue] = useState('')
  const [statusFilter, setStatusFilter] = useState('a_appeler')
  const [effectifFilter, setEffectifFilter] = useState('')
  const [formeFilter, setFormeFilter] = useState('')
  const [mapBase, setMapBase] = useState('concarneau')
  const [mapRadius, setMapRadius] = useState(0)
  const [showCircles, setShowCircles] = useState(true)
  const [mapSelected, setMapSelected] = useState(null)
  const [dailyStats, setDailyStats] = useState({ total: 0, chaud: 0, tiede: 0, froid: 0, no_answer: 0, blocked: 0, wrong_number: 0 })
  const [todayCallbackSirens, setTodayCallbackSirens] = useState(new Set())
  const [callbackDetails, setCallbackDetails] = useState(new Map()) // siren → {date, time, reason, contact_name}
  const [showAddModal, setShowAddModal] = useState(false)
  const [newProspect, setNewProspect] = useState({ name: '', phone: '', city: '', postal_code: '', departement: '', siret: '', siren: '', email: '', notes: '' })
  const [detectingOpco, setDetectingOpco] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)
  // Stepped phoning flow
  const [phoningStep, setPhoningStep] = useState('initial') // initial | no_response | responded | interested | callback | transfer | not_interested
  const [transferReason, setTransferReason] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [notInterestedTag, setNotInterestedTag] = useState('')

  const listRef = useRef(null)
  const departements = [...new Set(prospects.map(p => p.departement))].filter(Boolean).sort()

  useEffect(() => { loadProspects(); loadDailyStats(); loadTodayCallbacks() }, [])

  // Scroll en haut quand on change de filtre
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [statusFilter, departementFilter, effectifFilter, formeFilter, searchTerm])

  async function loadProspects() {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_unique_prospects')
      if (error) throw error
      const sorted = (data || []).sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))
      setProspects(sorted)
      setTotalCount(sorted.length)
      if (viewMode === 'file' && sorted.length > 0 && !current) selectProspect(sorted[0])
    } catch (err) {
      console.error('Erreur chargement:', err)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  async function loadDailyStats() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase.from('prospect_calls').select('call_result').gte('called_at', today + 'T00:00:00').lte('called_at', today + 'T23:59:59')
      if (data) {
        const stats = { total: data.length, chaud: 0, tiede: 0, froid: 0, no_answer: 0, blocked: 0, wrong_number: 0 }
        data.forEach(c => { if (stats[c.call_result] !== undefined) stats[c.call_result]++ })
        setDailyStats(stats)
      }
    } catch (err) { console.error('Erreur stats:', err) }
  }

  async function loadTodayCallbacks() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase.from('prospect_calls')
        .select('client_id, callback_date, callback_time, callback_reason, contact_name, clients!inner(siren)')
        .eq('needs_callback', true).lte('callback_date', today)
        .order('callback_date', { ascending: true })
      if (data) {
        const sirens = new Set()
        const details = new Map()
        data.forEach(d => {
          const siren = d.clients?.siren
          if (!siren) return
          sirens.add(siren)
          // Keep earliest callback per siren
          if (!details.has(siren)) {
            details.set(siren, { date: d.callback_date, time: d.callback_time, reason: d.callback_reason, contact_name: d.contact_name })
          }
        })
        setTodayCallbackSirens(sirens)
        setCallbackDetails(details)
      }
    } catch (err) { console.error('Erreur callbacks:', err) }
  }

  function getElapsedSeconds() {
    if (!prospectStartTime.current) return null
    return Math.round((Date.now() - prospectStartTime.current) / 1000)
  }

  function selectProspect(prospect) {
    prospectStartTime.current = Date.now() // Démarrer le chrono
    currentProspectRef.current = prospect.id
    setCurrent(prospect)
    setContactName('')
    setContactFunction('Dirigeant')
    setContactEmail(prospect.email || '')
    setContactMobile('')
    setFormationsSelected([])
    setNotes('')
    setCreateRdv(false)
    setRdvAssignedTo('Hicham')
    setRdvDate('')
    setRdvDispoNote('')
    setRdvUrgency('')
    setNeedsCallback(false)
    setCallbackDate('')
    setCallbackTime('14:00')
    setCallbackReason('')
    setShowHistory(false)
    setEditingPhone(false)
    setEditPhoneValue('')
    setPhoningStep('initial')
    setTransferReason('')
    setTransferNote('')
    setNotInterestedTag('')
    // Pré-remplir résultat selon statut précédent
    if (prospect.prospection_status === 'a_rappeler') setCallResult('tiede')
    else if (prospect.prospection_status === 'rdv_pris') setCallResult('chaud')
    else setCallResult('chaud')
    loadAiSummary(prospect)
    loadCallHistory(prospect)
    loadDuplicates(prospect)
  }

  async function loadDuplicates(prospect) {
    setDuplicates([])
    setShowDuplicates(false)
    try {
      const found = []
      const myId = prospect.id
      if (prospect.siren) {
        const { data } = await supabase.from('prospection_massive').select('id, name, city, departement, phone, prospection_status').eq('siren', prospect.siren).neq('id', myId).limit(20)
        if (data) data.forEach(d => found.push({ ...d, reason: 'Même SIREN (groupe)' }))
      }
      if (prospect.phone) {
        const { data } = await supabase.from('prospection_massive').select('id, name, city, departement, phone, prospection_status').eq('phone', prospect.phone).neq('id', myId).limit(10)
        if (data) data.forEach(d => { if (!found.some(f => f.id === d.id)) found.push({ ...d, reason: 'Même téléphone' }) })
      }
      if (prospect.email) {
        const generic = ['contact@','info@','accueil@','reception@','secretariat@','administration@']
        if (!generic.some(g => prospect.email.toLowerCase().startsWith(g))) {
          const { data } = await supabase.from('prospection_massive').select('id, name, city, departement, phone, prospection_status').eq('email', prospect.email).neq('id', myId).limit(10)
          if (data) data.forEach(d => { if (!found.some(f => f.id === d.id)) found.push({ ...d, reason: 'Même email' }) })
        }
      }
      if (prospect.site_web) {
        const domain = prospect.site_web.replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].toLowerCase()
        if (domain && domain.includes('.')) {
          const { data } = await supabase.from('prospection_massive').select('id, name, city, departement, phone, prospection_status').ilike('site_web', '%' + domain + '%').neq('id', myId).limit(10)
          if (data) data.forEach(d => { if (!found.some(f => f.id === d.id)) found.push({ ...d, reason: 'Même site web' }) })
        }
      }
      setDuplicates(found)
    } catch (err) { console.error('Erreur doublons:', err) }
  }

  async function loadAiSummary(prospect) {
    const prospectId = prospect.id
    setAiSummary(prospect.ai_summary || '')
    if (prospect.ai_summary) return
    setAiSummaryLoading(true)
    try {
      const res = await fetch('/api/generate-prospect-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: prospect.name, city: prospect.city, naf: prospect.naf, effectif: prospect.effectif, site_web: prospect.site_web, siret: prospect.siret })
      })
      const data = await res.json()
      // Only update if we're still on the same prospect (prevents race condition)
      if (currentProspectRef.current !== prospectId) return
      if (data.success && data.summary) {
        setAiSummary(data.summary)
        await supabase.from('prospection_massive').update({ ai_summary: data.summary }).eq('id', prospect.id)
        prospect.ai_summary = data.summary
      }
    } catch (err) { console.error('Erreur résumé IA:', err) }
    finally { if (currentProspectRef.current === prospectId) setAiSummaryLoading(false) }
  }

  async function loadCallHistory(prospect) {
    setCallHistory([])
    setShowHistory(false)
    try {
      const { data: clientData } = await supabase.from('clients').select('id').eq('siren', prospect.siren).maybeSingle()
      if (clientData) {
        const { data: calls } = await supabase.from('prospect_calls').select('*').eq('client_id', clientData.id).order('called_at', { ascending: false }).limit(5)
        if (calls && calls.length > 0) {
          setCallHistory(calls)
          // Pré-remplir depuis le dernier appel
          const last = calls[0]
          if (last.formations_mentioned && last.formations_mentioned.length > 0) setFormationsSelected(last.formations_mentioned)
          if (last.contact_name && !contactName) setContactName(last.contact_name)
          if (last.contact_function) setContactFunction(last.contact_function)
          if (last.contact_email) setContactEmail(last.contact_email)
          if (last.contact_mobile) setContactMobile(last.contact_mobile)
        }
      }
    } catch (err) { console.error('Erreur historique:', err) }
  }

  async function savePhone(newPhone) {
    if (!current || !newPhone.trim()) return
    try {
      await supabase.from('prospection_massive').update({ phone: newPhone.trim() }).eq('id', current.id)
      current.phone = newPhone.trim()
      setCurrent({ ...current })
      const idx = prospects.findIndex(p => p.id === current.id)
      if (idx >= 0) { prospects[idx].phone = newPhone.trim() }
      setEditingPhone(false)
      toast.success('Téléphone mis à jour')
    } catch (err) {
      console.error('Erreur sauvegarde téléphone:', err)
      toast.error('Erreur: ' + err.message)
    }
  }

  async function findOrCreateClient(prospect) {
    const cleanSiren = prospect.siren && !prospect.siren.startsWith('MANUAL_') ? prospect.siren.slice(0, 9) : null
    const cleanSiret = prospect.siret && !prospect.siret.startsWith('MANUAL_') ? prospect.siret.slice(0, 14) : null
    if (cleanSiren) {
      const { data: existing } = await supabase.from('clients').select('id').eq('siren', cleanSiren).maybeSingle()
      if (existing) return existing.id
    }
    const { data: newClient, error } = await supabase.from('clients').insert({
      name: prospect.name, address: prospect.city ? prospect.postal_code + ' ' + prospect.city : null,
      postal_code: prospect.postal_code, city: prospect.city, siret: cleanSiret, siren: cleanSiren,
      contact_phone: prospect.phone, email: prospect.email || null, website: prospect.site_web || null,
      taille_entreprise: prospect.effectif || null, status: 'prospect', type: 'prospect',
    }).select('id').single()
    if (error) throw error
    return newClient.id
  }

  async function handleSave() {
    if (!current) return
    setSaving(true)
    try {
      const clientId = await findOrCreateClient(current)
      const { data: insertedCall, error: callError } = await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: callerName,
        contact_name: contactName || null, contact_function: contactFunction || null,
        contact_email: contactEmail || null, contact_mobile: contactMobile || null,
        call_result: callResult,
        formations_mentioned: formationsSelected.length > 0 ? formationsSelected : null,
        notes: notes || null, rdv_created: createRdv, needs_callback: needsCallback,
        callback_date: needsCallback ? callbackDate : null, callback_time: needsCallback ? callbackTime : null,
        callback_reason: needsCallback ? callbackReason : null, duration_seconds: getElapsedSeconds(),
      }).select().single()
      if (callError) throw callError

      const clientUpdates = {}
      if (contactName) clientUpdates.contact_name = contactName
      if (contactEmail) clientUpdates.contact_email = contactEmail
      if (contactMobile) clientUpdates.mobile = contactMobile
      if (contactFunction) clientUpdates.contact_function = contactFunction
      if (Object.keys(clientUpdates).length > 0) await supabase.from('clients').update(clientUpdates).eq('id', clientId)

      if (createRdv) {
        const isMarine = callerName === 'Marine'
        const dispoInfo = isMarine ? (rdvUrgency ? rdvUrgency + '. ' : '') + (rdvDispoNote || '') : ''
        const rdvNotes = isMarine
          ? '🔥 Prospect chaud signalé par Marine\n' + (dispoInfo ? 'Disponibilités : ' + dispoInfo + '\n' : '') + (contactName ? 'Contact : ' + contactName + (contactFunction ? ' (' + contactFunction + ')' : '') + '\n' : '') + (notes ? '\nNotes : ' + notes : '')
          : 'Créé par ' + callerName + ' suite à appel.\n\nNotes:\n' + notes

        const { data: insertedRdv, error: rdvError } = await supabase.from('prospect_rdv').insert({
          client_id: clientId,
          rdv_date: isMarine ? null : rdvDate || null,
          rdv_type: 'decouverte',
          conducted_by: isMarine ? null : rdvAssignedTo,
          status: 'a_prendre',
          contact_name: contactName || null, contact_email: contactEmail || null, contact_phone: contactMobile || null,
          formations_interet: formationsSelected.length > 0 ? formationsSelected : null,
          notes: rdvNotes,
          temperature: 'chaud', source: 'phoning_' + callerName.toLowerCase().replace(' ', '_'),
        }).select().single()
        if (rdvError) throw rdvError
        await supabase.from('prospect_calls').update({ rdv_id: insertedRdv.id }).eq('id', insertedCall.id)

        const notifMessage = isMarine
          ? 'Marine a un prospect chaud : ' + current.name + (current.city ? ' (' + current.city + ')' : '') + (dispoInfo ? ' • Dispo : ' + dispoInfo : '') + (formationsSelected.length > 0 ? ' • ' + formationsSelected.join(', ') : '') + (contactName ? ' • Contact : ' + contactName : '')
          : callerName + ' a décroché un RDV pour ' + rdvAssignedTo + ' le ' + new Date(rdvDate).toLocaleDateString('fr-FR') + (formationsSelected.length > 0 ? ' • ' + formationsSelected.join(', ') : '')

        await supabase.from('notifications').insert({
          title: '🔥 ' + (isMarine ? 'Prospect chaud' : 'Nouveau RDV') + ' — ' + current.name,
          message: notifMessage,
          type: 'rdv_phoning', link: '/prospection/' + insertedRdv.id,
        })

        // Email alerte prospect chaud / RDV
        try {
          await fetch('/api/send-callback-reminder', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prospectName: current.name,
              prospectPhone: current.phone,
              contactName,
              contactFunction,
              callbackDate: isMarine ? null : rdvDate,
              callbackTime: null,
              callbackReason: isMarine ? '🔥 PROSPECT CHAUD — ' + (rdvUrgency || '') + (rdvDispoNote ? ' — Dispo : ' + rdvDispoNote : '') : '📅 RDV planifié pour ' + rdvAssignedTo,
              callerName,
              notes: (formationsSelected.length > 0 ? 'Formations : ' + formationsSelected.join(', ') + '\n' : '') + (notes || ''),
            })
          })
        } catch (emailErr) { console.error('Erreur email RDV:', emailErr) }
      }

      let newStatus = callResult === 'chaud' ? 'rdv_pris' : callResult === 'froid' ? 'pas_interesse' : callResult === 'wrong_number' ? 'numero_errone' : 'a_rappeler'
      await supabase.from('prospection_massive').update({
        contacted: true, contacted_at: new Date().toISOString(), prospection_status: newStatus,
        prospection_notes: notes || null, updated_at: new Date().toISOString(),
      }).eq('siren', current.siren)

      let message = '✅ Appel enregistré'
      if (createRdv) message += callerName === 'Marine' ? ' • 🔥 Alerte prospect chaud envoyée' : ' • RDV créé pour ' + rdvAssignedTo
      if (needsCallback) {
        message += ' • Rappel programmé'
        await supabase.from('notifications').insert({
          title: '🔔 Rappel — ' + current.name,
          message: callerName + ' → rappeler le ' + new Date(callbackDate).toLocaleDateString('fr-FR') + ' à ' + callbackTime + (callbackReason ? ' (' + callbackReason + ')' : '') + (contactName ? ' • ' + contactName : ''),
          type: 'rappel_phoning', link: '/prospection-massive',
          metadata: { callback_date: callbackDate, callback_time: callbackTime, prospect_name: current.name, prospect_phone: current.phone, contact_name: contactName }
        })
        try {
          await fetch('/api/send-callback-reminder', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prospectName: current.name, prospectPhone: current.phone, contactName, contactFunction, callbackDate, callbackTime, callbackReason, callerName, notes })
          })
        } catch (emailErr) { console.error('Erreur email:', emailErr) }
      }
      toast.success(message)
      loadDailyStats()
      loadTodayCallbacks()
      goNext()
      await loadProspects()
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur: ' + (error.message || 'Échec sauvegarde'))
    } finally { setSaving(false) }
  }

  async function handleResetStatus() {
    if (!current) return
    setSaving(true)
    try {
      await supabase.from('prospection_massive').update({
        prospection_status: 'a_appeler', contacted: false, contacted_at: null, updated_at: new Date().toISOString()
      }).eq('siren', current.siren)
      toast.success('↩️ Remis dans la file')
      setCurrent(null)
      await loadProspects()
      loadDailyStats()
      loadTodayCallbacks()
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur: ' + error.message)
    } finally { setSaving(false) }
  }

  async function handleQuickAction(result) {
    if (!current) return
    setSaving(true)
    try {
      const clientId = await findOrCreateClient(current)
      await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: callerName, call_result: result,
        notes: result === 'no_answer' ? 'Pas de réponse' : result === 'wrong_number' ? 'Numéro erroné' : 'Pas intéressé',
        duration_seconds: getElapsedSeconds(),
      })
      const newStatus = result === 'froid' ? 'pas_interesse' : result === 'wrong_number' ? 'numero_errone' : 'a_rappeler'
      await supabase.from('prospection_massive').update({
        contacted: true, contacted_at: new Date().toISOString(), prospection_status: newStatus, updated_at: new Date().toISOString()
      }).eq('siren', current.siren)
      const labels = { no_answer: '📞 Injoignable', wrong_number: '❌ N° erroné', froid: '❄️ Pas intéressé' }
      toast.success(labels[result] + ' — suivant')
      loadDailyStats()
      loadTodayCallbacks()
      goNext()
      await loadProspects()
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur: ' + error.message)
    } finally { setSaving(false) }
  }

  function goNext() {
    if (!current || viewMode === 'list') { setCurrent(null); return }
    const list = viewMode === 'carte' ? mapProspects : filtered
    const idx = list.findIndex(p => p.id === current.id)
    if (idx < list.length - 1) selectProspect(list[idx + 1])
    else { setCurrent(null); loadProspects() }
  }

  function handleSkip() { if (!current) return; toast('Prospect passé', { icon: '⏭️' }); goNext() }

  // === OPCO Detection ===
  async function autoDetectOpco() {
    if (!current) return
    const siret = (current.siret || '').replace(/\s/g, '')
    if (!siret || siret.length < 9 || siret.startsWith('MANUAL_')) return toast.error('SIRET valide requis')
    setDetectingOpco(true)
    try {
      const res = await fetch(`/api/detect-opco?siret=${siret}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur API')
      const updates = {}
      const ent = data.entreprise
      if (ent) {
        if (ent.address) updates.address = ent.address
        if (ent.postal_code) updates.postal_code = ent.postal_code
        if (ent.city) updates.city = ent.city.toUpperCase()
      }
      if (data.status === 'OK' && data.opco_name) updates.opco_name = data.opco_name
      if (Object.keys(updates).length > 0) {
        await supabase.from('prospection_massive').update(updates).eq('id', current.id)
        Object.assign(current, updates)
        setProspects(prev => prev.map(p => p.id === current.id ? { ...p, ...updates } : p))
      }
      if (data.opco_name) toast.success(`OPCO : ${data.opco_name}${ent?.city ? ' • ' + ent.city : ''}`)
      else if (ent?.address) toast('Adresse enrichie', { icon: '📍' })
      else toast.error(data.message || 'Aucune info trouvée')
    } catch (err) { toast.error('Erreur : ' + err.message) }
    finally { setDetectingOpco(false) }
  }

  // === Stepped flow handlers ===
  async function handleNoResponse(messageLaisse) {
    if (!current) return
    setSaving(true)
    try {
      const clientId = await findOrCreateClient(current)
      const now = new Date()
      const noteText = `${callerName} — ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — ${messageLaisse ? 'Message laissé' : 'Pas de réponse'}`
      await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: callerName, call_result: 'no_answer',
        notes: noteText, duration_seconds: getElapsedSeconds(),
      })
      await supabase.from('prospection_massive').update({
        contacted: true, contacted_at: now.toISOString(), prospection_status: 'a_rappeler',
        prospection_notes: noteText, updated_at: now.toISOString(),
      }).eq('siren', current.siren)
      toast.success(messageLaisse ? '📨 Message laissé — suivant' : '📵 Pas de réponse — suivant')
      loadDailyStats(); loadTodayCallbacks(); goNext(); await loadProspects()
    } catch (error) { toast.error('Erreur: ' + error.message) }
    finally { setSaving(false) }
  }

  async function handleNotInterested(tag) {
    if (!current) return
    setSaving(true)
    try {
      const clientId = await findOrCreateClient(current)
      const noteText = `❄️ ${tag}` + (notes ? '\n' + notes : '')
      await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: callerName, call_result: 'froid',
        contact_name: contactName || null, contact_function: contactFunction || null,
        notes: noteText, duration_seconds: getElapsedSeconds(),
      })
      await supabase.from('prospection_massive').update({
        contacted: true, contacted_at: new Date().toISOString(), prospection_status: 'pas_interesse',
        prospection_notes: noteText, updated_at: new Date().toISOString(),
      }).eq('siren', current.siren)
      toast.success('❄️ ' + tag + ' — suivant')
      loadDailyStats(); loadTodayCallbacks(); goNext(); await loadProspects()
    } catch (error) { toast.error('Erreur: ' + error.message) }
    finally { setSaving(false) }
  }

  async function handleTransfer() {
    if (!current) return
    setSaving(true)
    try {
      const clientId = await findOrCreateClient(current)
      const noteText = `↗️ Transféré — ${transferReason}` + (transferNote ? '\n' + transferNote : '') + (contactName ? '\nContact : ' + contactName + (contactFunction ? ' (' + contactFunction + ')' : '') : '')
      await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: callerName, call_result: 'blocked',
        contact_name: contactName || null, contact_function: contactFunction || null,
        notes: noteText, duration_seconds: getElapsedSeconds(),
      })
      await supabase.from('prospection_massive').update({
        contacted: true, contacted_at: new Date().toISOString(), prospection_status: 'a_rappeler',
        prospection_notes: noteText, updated_at: new Date().toISOString(),
      }).eq('siren', current.siren)
      // Email simple à Hicham
      try {
        await fetch('/api/send-callback-reminder', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prospectName: current.name, prospectPhone: current.phone,
            contactName, contactFunction,
            callbackDate: null, callbackTime: null,
            callbackReason: '↗️ TRANSFERT — ' + transferReason + (transferNote ? '\n' + transferNote : ''),
            callerName, notes: 'Prospect transféré pour prise de décision.\n' + (current.city ? 'Ville : ' + current.city + '\n' : '') + (current.siret ? 'SIRET : ' + current.siret : ''),
          })
        })
      } catch (emailErr) { console.error('Erreur email transfert:', emailErr) }
      toast.success('↗️ Transféré à Hicham — suivant')
      loadDailyStats(); loadTodayCallbacks(); goNext(); await loadProspects()
    } catch (error) { toast.error('Erreur: ' + error.message) }
    finally { setSaving(false) }
  }

  // === FILTRES & TRI ===
  const rappelsCount = prospects.filter(p => p.siren && todayCallbackSirens.has(p.siren)).length

  const STATUS_FILTERS = [
    { id: 'a_appeler', label: '📞 À appeler', count: prospects.filter(p => !p.prospection_status || p.prospection_status === 'a_appeler').length },
    { id: 'rappels', label: '🔔 Rappels', count: rappelsCount },
    { id: 'a_rappeler', label: '🟡 À rappeler', count: prospects.filter(p => p.prospection_status === 'a_rappeler').length },
    { id: 'rdv_pris', label: '🔥 RDV', count: prospects.filter(p => p.prospection_status === 'rdv_pris').length },
    { id: 'pas_interesse', label: '❄️ Refus', count: prospects.filter(p => p.prospection_status === 'pas_interesse').length },
    { id: 'numero_errone', label: '❌ Erroné', count: prospects.filter(p => p.prospection_status === 'numero_errone').length },
    { id: 'tous', label: '📋 Tous', count: prospects.length },
  ]

  const filtered = useMemo(() => {
    const base = BASES[mapBase]
    let list = prospects.filter(p => {
      if (statusFilter === 'a_appeler' && p.prospection_status && p.prospection_status !== 'a_appeler') return false
      if (statusFilter === 'rappels' && !(p.siren && todayCallbackSirens.has(p.siren))) return false
      if (statusFilter === 'a_rappeler' && p.prospection_status !== 'a_rappeler') return false
      if (statusFilter === 'rdv_pris' && p.prospection_status !== 'rdv_pris') return false
      if (statusFilter === 'pas_interesse' && p.prospection_status !== 'pas_interesse') return false
      if (statusFilter === 'numero_errone' && p.prospection_status !== 'numero_errone') return false
      if (departementFilter && p.departement !== departementFilter) return false
      if (effectifFilter) {
        const codes = EFFECTIF_FILTER_CODES[effectifFilter]
        if (codes && !codes.includes(String(p.effectif))) return false
      }
      if (formeFilter) {
        if (getFormeGroup(p.forme_juridique) !== formeFilter) return false
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        return p.name?.toLowerCase().includes(term) || p.city?.toLowerCase().includes(term) || p.phone?.includes(term)
      }
      return true
    })
    // Calculer distance + filtrer par rayon
    list = list.map(p => {
      const dist = (p.latitude && p.longitude) ? distanceKm(base.lat, base.lng, p.latitude, p.longitude) : 9999
      return { ...p, distance: dist }
    })
    if (mapRadius > 0) list = list.filter(p => p.distance <= mapRadius)
    // Tri : rappels par date de callback → à rappeler → distance croissante
    list.sort((a, b) => {
      const aCb = a.siren && todayCallbackSirens.has(a.siren) ? 1 : 0
      const bCb = b.siren && todayCallbackSirens.has(b.siren) ? 1 : 0
      if (aCb !== bCb) return bCb - aCb
      // Si les deux sont des rappels, trier par date de callback (plus ancien d'abord)
      if (aCb && bCb) {
        const aDate = callbackDetails.get(a.siren)?.date || '9999'
        const bDate = callbackDetails.get(b.siren)?.date || '9999'
        if (aDate !== bDate) return aDate.localeCompare(bDate)
      }
      const order = { 'a_rappeler': 1, 'a_appeler': 2, '': 2, null: 2 }
      const aO = order[a.prospection_status] || 3
      const bO = order[b.prospection_status] || 3
      if (aO !== bO) return aO - bO
      return a.distance - b.distance
    })
    return list
  }, [prospects, statusFilter, departementFilter, effectifFilter, formeFilter, searchTerm, todayCallbackSirens, callbackDetails, mapBase, mapRadius])

  // En mode file, sélectionner le premier prospect du filtre actif
  useEffect(() => {
    if (viewMode === 'file' && filtered.length > 0) {
      if (!current || !filtered.some(p => p.id === current.id)) {
        selectProspect(filtered[0])
      }
    } else if (viewMode === 'file' && filtered.length === 0) {
      setCurrent(null)
    }
  }, [filtered, viewMode])

  const basePoint = BASES[mapBase]
  const mapProspects = useMemo(() => {
    return filtered.filter(p => p.latitude && p.longitude && p.distance < 9999)
      .sort((a, b) => a.distance - b.distance)
  }, [filtered])

  async function handleAddProspect() {
    if (!newProspect.name.trim()) return toast.error('Nom obligatoire')
    if (!newProspect.phone.trim()) return toast.error('Téléphone obligatoire')
    try {
      const dept = newProspect.postal_code ? newProspect.postal_code.substring(0, 2) : newProspect.departement || ''
      const siret = newProspect.siret?.trim() || ('MANUAL_' + Date.now())
      const siren = newProspect.siren?.trim() || (newProspect.siret?.trim() ? newProspect.siret.trim().substring(0, 9) : ('MANUAL_' + Date.now()))
      const { error } = await supabase.from('prospection_massive').insert({
        name: newProspect.name.trim().toUpperCase(),
        phone: newProspect.phone.trim().replace(/\s/g, ''),
        city: newProspect.city.trim() || null,
        postal_code: newProspect.postal_code.trim() || null,
        departement: dept,
        siret,
        siren,
        email: newProspect.email?.trim() || null,
        enrichment_status: newProspect.siret?.trim() ? 'done' : 'pending',
        quality_score: 50,
        prospection_notes: 'Ajout manuel Marine ' + new Date().toLocaleDateString('fr-FR') + (newProspect.notes ? ' - ' + newProspect.notes : '')
      })
      if (error) throw error
      toast.success('Prospect ajouté !')
      setShowAddModal(false)
      setNewProspect({ name: '', phone: '', city: '', postal_code: '', departement: '', siret: '', siren: '', email: '', notes: '' })
      loadProspects()
    } catch (err) {
      console.error('Erreur ajout:', err)
      toast.error('Erreur: ' + err.message)
    }
  }

  function exportCSV() {
    const headers = ['Société','ID','Type','Forme','NAF','VILLE','CP','Nom','Prénom','Mail','Téléphone','Fonction','Appel abouti','Appel non abouti','Mail','Suivi','RDV à prendre']
    const rows = filtered.map(p => {
      const status = p.prospection_status
      const suivi = status === 'rdv_pris' ? 'RDV pris' : status === 'a_rappeler' ? 'À rappeler' : status === 'pas_interesse' ? 'Pas intéressé' : status === 'numero_errone' ? 'Numéro erroné' : ''
      let tel = p.phone || ''
      if (tel.startsWith('0')) tel = '+33' + tel.slice(1).replace(/\s/g, '')
      return [p.name||'', p.siren||'', 'P', getFormeLabel(p.forme_juridique), p.naf||'', p.city||'', p.postal_code||'', '','', p.email||'', tel, '','','', '', suivi, status === 'rdv_pris' ? 'Oui' : '']
    })
    const csvContent = [headers, ...rows].map(row => row.map(cell => { const s = String(cell).replace(/"/g, '""'); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s }).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `phoning_export_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  async function handleSendReport() {
    setSendingReport(true)
    try {
      const res = await fetch('/api/send-phoning-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur envoi rapport')
      toast.success(`Rapport envoyé ! ${data.stats?.today || 0} appels aujourd'hui`)
    } catch (err) {
      console.error('Erreur rapport:', err)
      toast.error(err.message || 'Erreur envoi rapport')
    } finally {
      setSendingReport(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>

  // === RENDER ===
  return (
    <div className="space-y-3">
      {/* Header + Stats */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📞 Phoning</h1>
          <p className="text-gray-500 text-sm">{filtered.length} sur {prospects.length}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stats du jour */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="font-semibold text-gray-600">Aujourd'hui</span>
            <span className="bg-gray-800 text-white px-1.5 py-0.5 rounded font-bold">{dailyStats.total}</span>
            {dailyStats.chaud > 0 && <span className="text-green-600 font-medium">🔥{dailyStats.chaud}</span>}
            {dailyStats.tiede > 0 && <span className="text-orange-500 font-medium">🟡{dailyStats.tiede}</span>}
            {dailyStats.froid > 0 && <span className="text-blue-500 font-medium">❄️{dailyStats.froid}</span>}
            {dailyStats.no_answer > 0 && <span className="text-gray-400">📞{dailyStats.no_answer}</span>}
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {CALLERS.map(c => (
              <button key={c} onClick={() => setCallerName(c)} className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (callerName === c ? 'bg-white shadow text-gray-900' : 'text-gray-600')}>{c}</button>
            ))}
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('list')} className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600')}><List className="w-4 h-4 inline mr-1" />Liste</button>
            <button onClick={() => { setViewMode('file'); if (filtered.length > 0 && !current) selectProspect(filtered[0]) }} className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (viewMode === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600')}><SkipForward className="w-4 h-4 inline mr-1" />File</button>
            <button onClick={() => setViewMode('carte')} className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (viewMode === 'carte' ? 'bg-white shadow text-gray-900' : 'text-gray-600')}><MapIcon className="w-4 h-4 inline mr-1" />Carte</button>
          </div>
        </div>
      </div>

      {/* Filtres statut */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button key={s.id} onClick={() => setStatusFilter(s.id)}
            className={'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ' +
              (statusFilter === s.id ? (s.id === 'rappels' ? 'bg-amber-500 text-white border-amber-500' : 'bg-primary-600 text-white border-primary-600')
                : (s.id === 'rappels' && s.count > 0 ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 animate-pulse' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'))}>
            {s.label} <span className="ml-1 font-bold">{s.count}</span>
          </button>
        ))}
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm" />
        </div>
        <select value={mapBase} onChange={e => setMapBase(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          {Object.entries(BASES).map(([k, v]) => <option key={k} value={k}>📍 {v.name}</option>)}
        </select>
        <select value={mapRadius} onChange={e => setMapRadius(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value={0}>∞ km</option>
          <option value={30}>≤ 30 km</option>
          <option value={60}>≤ 60 km</option>
          <option value={100}>≤ 100 km</option>
          <option value={150}>≤ 150 km</option>
          <option value={200}>≤ 200 km</option>
        </select>
        <select value={departementFilter} onChange={(e) => setDepartementFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">Dép.</option>{departements.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={effectifFilter} onChange={(e) => setEffectifFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">Effectif</option><option value="1-5">1-5</option><option value="6-19">6-19</option><option value="20-49">20-49</option><option value="50-99">50-99</option><option value="100-249">100-249</option><option value="250+">250+</option>
        </select>
        <select value={formeFilter} onChange={(e) => setFormeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">Forme jur.</option><option value="SAS/SASU">SAS/SASU</option><option value="SARL/EURL">SARL/EURL</option><option value="SA/SCA">SA/SCA</option><option value="EI">EI</option><option value="Association">Association</option><option value="Public">Public</option><option value="Autre">Autre</option>
        </select>
        <button onClick={() => { loadProspects(); loadDailyStats(); loadTodayCallbacks() }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={exportCSV} className="px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium">📥 CSV</button>
        {isAdmin && <button onClick={handleSendReport} disabled={sendingReport} className="px-3 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50">{sendingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} Rapport</button>}
        <button onClick={() => setShowAddModal(true)} className="px-3 py-2 bg-primary-100 text-primary-700 hover:bg-primary-200 rounded-lg text-sm font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Ajouter</button>
      </div>

      {/* === CONTENU === */}
      {filtered.length === 0 && !current && viewMode !== 'carte' ? (
        <div className="text-center py-12 text-gray-500">Aucun prospect trouvé</div>

      ) : viewMode === 'list' ? (
        /* LISTE */
        <div ref={listRef} className="bg-white rounded-xl border border-gray-200 divide-y max-h-[70vh] overflow-y-auto">
          {filtered.map((p) => (
            <div key={p.id} onClick={() => { selectProspect(p); setViewMode('file') }}
              className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{p.name}</span>
                  {p.siren && todayCallbackSirens.has(p.siren) && (() => {
                    const cb = callbackDetails.get(p.siren)
                    return <span className="flex items-center gap-1 text-amber-600 text-xs">
                      <Bell className="w-3.5 h-3.5" />
                      {cb?.date ? new Date(cb.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                      {cb?.time ? ' ' + cb.time : ''}
                    </span>
                  })()}
                </div>
                <div className="text-sm text-gray-500 flex items-center gap-3 mt-0.5">
                  <span>{p.city}</span>
                  {p.distance < 9999 && <span className="text-gray-400">{p.distance.toFixed(0)} km</span>}
                  {getEffectifLabel(p.effectif) && <span>{getEffectifLabel(p.effectif)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3">
                {p.phone && <a href={'tel:' + p.phone.replace(/\s/g, '')} onClick={e => e.stopPropagation()} className="text-primary-600 text-sm">{p.phone}</a>}
                <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (
                  p.prospection_status === 'rdv_pris' ? 'bg-green-100 text-green-700' :
                  p.prospection_status === 'a_rappeler' ? 'bg-amber-100 text-amber-700' :
                  p.prospection_status === 'pas_interesse' ? 'bg-gray-100 text-gray-500' :
                  p.prospection_status === 'numero_errone' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'
                )}>{p.prospection_status === 'rdv_pris' ? '🔥 RDV' : p.prospection_status === 'a_rappeler' ? '🟡' : p.prospection_status === 'pas_interesse' ? '❄️' : p.prospection_status === 'numero_errone' ? '❌' : '📞'}</span>
              </div>
            </div>
          ))}
        </div>

      ) : viewMode === 'carte' ? (
        /* CARTE */
        <div className="grid grid-cols-3 gap-4" style={{ height: 'calc(100vh - 260px)' }}>
          <div className="col-span-2 bg-white rounded-xl border overflow-hidden relative">
            <div className="absolute top-3 left-3 z-[1000] bg-white rounded-lg shadow-lg p-2">
              <button onClick={() => setShowCircles(!showCircles)} className={'text-sm px-2 py-1 rounded ' + (showCircles ? 'bg-primary-100 text-primary-700' : 'bg-gray-100')}>Zones</button>
            </div>
            <MapContainer center={[basePoint.lat, basePoint.lng]} zoom={8} style={{ height: '100%', width: '100%' }}>
              <MapRecenter center={[basePoint.lat, basePoint.lng]} zoom={mapRadius > 0 ? (mapRadius <= 30 ? 10 : mapRadius <= 60 ? 9 : 8) : 7} />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {showCircles && <><Circle center={[basePoint.lat, basePoint.lng]} radius={30000} pathOptions={{ color: '#3B82F6', weight: 1, fillOpacity: 0.03, dashArray: '5,10' }} /><Circle center={[basePoint.lat, basePoint.lng]} radius={60000} pathOptions={{ color: '#6366F1', weight: 1, fillOpacity: 0.02, dashArray: '5,10' }} /><Circle center={[basePoint.lat, basePoint.lng]} radius={100000} pathOptions={{ color: '#8B5CF6', weight: 1, fillOpacity: 0.01, dashArray: '5,10' }} /></>}
              <CircleMarker center={[basePoint.lat, basePoint.lng]} radius={10} pathOptions={{ color: '#1E40AF', fillColor: '#3B82F6', fillOpacity: 1, weight: 3 }}><Popup>📍 {basePoint.name}</Popup></CircleMarker>
              {mapProspects.map(p => (
                <CircleMarker key={p.id} center={[p.latitude, p.longitude]}
                  radius={Math.max(4, Math.min(12, (EFFECTIF_NUM[String(p.effectif)] || 3) / 5))}
                  pathOptions={{ color: getMapColor(p), fillColor: getMapColor(p), fillOpacity: 0.85, weight: mapSelected === p.id ? 3 : 1, ...(mapSelected === p.id ? { color: '#000' } : {}) }}
                  eventHandlers={{ click: () => { setMapSelected(p.id); selectProspect(p) } }}>
                  <Popup><div className="text-sm"><div className="font-bold">{p.name}</div><div>{p.city} — {p.distance?.toFixed(0)}km</div>{p.phone && <a href={'tel:'+p.phone.replace(/\s/g,'')} className="text-blue-600">{p.phone}</a>}</div></Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          <div className="bg-white rounded-xl border p-4 overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-3">{mapProspects.length} prospects</h3>
            <div className="space-y-2">
              {mapProspects.slice(0, 50).map((p, i) => (
                <div key={p.id} onClick={() => { setMapSelected(p.id); selectProspect(p); setViewMode('file') }}
                  className={'p-2 rounded-lg cursor-pointer text-sm ' + (mapSelected === p.id ? 'bg-primary-50 border border-primary-300' : 'hover:bg-gray-50 border border-transparent')}>
                  <div className="font-medium text-gray-900">{i + 1}. {p.name}</div>
                  <div className="text-gray-500 text-xs">{p.city} — {p.distance?.toFixed(0)}km • {getEffectifLabel(p.effectif) || '?'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      ) : (
        /* === FILE : 2 COLONNES === */
        <div className="grid grid-cols-5 gap-4" style={{ height: 'calc(100vh - 260px)' }}>
          {/* GAUCHE : Info prospect */}
          <div className="col-span-2 bg-white rounded-xl border overflow-y-auto">
            {current && <div className="p-4 space-y-3">
              {/* Nom + ville */}
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{current.name}</h2>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{filtered.findIndex(p => p.id === current.id) + 1}/{filtered.length}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-600">{current.postal_code} {current.city}</span>
                  {current.distance < 9999 && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{current.distance.toFixed(0)} km</span>}
                  {current.siren && todayCallbackSirens.has(current.siren) && (() => {
                    const cb = callbackDetails.get(current.siren)
                    return <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      🔔 Rappel {cb?.date ? new Date(cb.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                      {cb?.time ? ' à ' + cb.time : ''}
                    </span>
                  })()}
                </div>
                {/* Dernier interlocuteur connu + compteur injoignables */}
                {callHistory.length > 0 && (() => {
                  const lastContact = callHistory.find(c => c.contact_name)
                  const noAnswerCount = callHistory.filter(c => c.call_result === 'no_answer').length
                  return (lastContact || noAnswerCount >= 2) ? (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {lastContact && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">👤 Demander {lastContact.contact_name}{lastContact.contact_function ? ' (' + lastContact.contact_function + ')' : ''}</span>}
                      {noAnswerCount >= 2 && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{noAnswerCount}× injoignable</span>}
                    </div>
                  ) : null
                })()}
              </div>

              {/* Téléphone — éditable */}
              {editingPhone ? (
                <div className="flex items-center gap-2">
                  <input type="tel" value={editPhoneValue} onChange={(e) => setEditPhoneValue(e.target.value)}
                    autoFocus onKeyDown={(e) => { if (e.key === 'Enter') savePhone(editPhoneValue); if (e.key === 'Escape') setEditingPhone(false) }}
                    className="flex-1 px-3 py-2 border border-primary-300 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-primary-500" placeholder="Nouveau numéro..." />
                  <button onClick={() => savePhone(editPhoneValue)} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">✓</button>
                  <button onClick={() => setEditingPhone(false)} className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">✕</button>
                </div>
              ) : current.phone ? (
                <div className="flex items-center gap-2">
                  <a href={'tel:' + current.phone.replace(/\s/g, '')}
                    className="flex-1 flex items-center gap-2 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg px-4 py-2.5 text-primary-700 font-semibold text-lg transition-colors">
                    <Phone className="w-5 h-5" />{current.phone}
                  </a>
                  <button onClick={() => { setEditPhoneValue(current.phone); setEditingPhone(true) }}
                    title="Modifier le numéro"
                    className="p-2.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => { setEditPhoneValue(''); setEditingPhone(true) }}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-500 text-sm transition-colors">
                  <Phone className="w-4 h-4" /> Ajouter un téléphone
                </button>
              )}

              {/* Historique compact */}
              {callHistory.length > 0 && (() => {
                const last = callHistory[0]
                const resultColors = { chaud: 'bg-green-100 text-green-700 border-green-200', tiede: 'bg-orange-100 text-orange-700 border-orange-200', froid: 'bg-blue-100 text-blue-700 border-blue-200', no_answer: 'bg-gray-100 text-gray-600 border-gray-200', blocked: 'bg-red-100 text-red-700 border-red-200', wrong_number: 'bg-purple-100 text-purple-700 border-purple-200' }
                const resultLabels = { chaud: '🔥 Intéressé', tiede: '🟡 Tiède', froid: '❄️ Refus', no_answer: '📞 Injoignable', blocked: '⚠️ Barrage', wrong_number: '❌ N° erroné' }
                return (
                  <div className={'rounded-lg border px-3 py-2 ' + (resultColors[last.call_result] || 'bg-gray-50 border-gray-200')}>
                    {/* Badge compact — dernier appel */}
                    <button type="button" onClick={() => setShowHistory(!showHistory)} className="w-full text-left">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">{resultLabels[last.call_result] || last.call_result}</span>
                        <span className="text-xs opacity-70">— {last.called_by} le {new Date(last.called_at).toLocaleDateString('fr-FR')}</span>
                        {last.contact_name && <span className="text-xs opacity-70">• 👤 {last.contact_name}</span>}
                        <span className="ml-auto text-xs opacity-50">{callHistory.length > 1 ? callHistory.length + ' appels' : '1 appel'} {showHistory ? '▲' : '▼'}</span>
                      </div>
                      {last.notes && <p className="text-xs mt-1 opacity-80 truncate">{last.notes}</p>}
                      {last.formations_mentioned && last.formations_mentioned.length > 0 && (
                        <p className="text-xs mt-0.5 opacity-70">🎓 {last.formations_mentioned.join(', ')}</p>
                      )}
                    </button>

                    {/* Détail tous les appels */}
                    {showHistory && (
                      <div className="mt-2 pt-2 border-t border-current/10 space-y-2">
                        {callHistory.map((call, i) => (
                          <div key={i} className="text-xs bg-white/60 rounded p-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{call.called_by}</span>
                              <span className="opacity-60">{new Date(call.called_at).toLocaleDateString('fr-FR')} {call.called_at ? new Date(call.called_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                              <span className={'px-1.5 py-0.5 rounded text-xs ' + (resultColors[call.call_result] || 'bg-gray-100')}>{resultLabels[call.call_result] || call.call_result}</span>
                            </div>
                            {call.contact_name && <div className="mt-0.5 opacity-80">👤 {call.contact_name}{call.contact_function ? ' — ' + call.contact_function : ''}{call.contact_email ? ' • ' + call.contact_email : ''}</div>}
                            {call.notes && <div className="mt-0.5 opacity-90">{call.notes}</div>}
                            {call.formations_mentioned && call.formations_mentioned.length > 0 && <div className="mt-0.5 opacity-70">🎓 {call.formations_mentioned.join(', ')}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Infos */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {current.naf && <div className="bg-gray-50 rounded px-2 py-1.5"><span className="text-gray-500">NAF</span> <span className="font-medium">{current.naf}</span></div>}
                {getEffectifLabel(current.effectif) && <div className="bg-gray-50 rounded px-2 py-1.5"><span className="text-gray-500">Effectif</span> <span className="font-medium">{getEffectifLabel(current.effectif)}</span></div>}
                {getFormeLabel(current.forme_juridique) && <div className="bg-gray-50 rounded px-2 py-1.5"><span className="text-gray-500">Forme</span> <span className="font-medium">{getFormeLabel(current.forme_juridique)}</span></div>}
                {current.email && <div className="bg-gray-50 rounded px-2 py-1.5 truncate"><Mail className="w-3 h-3 inline text-gray-400" /> <span className="font-medium text-xs">{current.email}</span></div>}
                {current.site_web && <div className="col-span-2 bg-gray-50 rounded px-2 py-1.5 truncate">🌐 <a href={current.site_web.startsWith('http') ? current.site_web : 'https://'+current.site_web} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline text-xs">{current.site_web}</a></div>}
                {current.opco_name && <div className="col-span-2 bg-indigo-50 rounded px-2 py-1.5 flex items-center gap-1.5"><Briefcase className="w-3 h-3 text-indigo-500" /><span className="text-indigo-700 font-medium text-xs">{current.opco_name}</span></div>}
              </div>

              {/* Détecter OPCO */}
              {current.siret && !current.siret.startsWith('MANUAL_') && !current.opco_name && (
                <button onClick={autoDetectOpco} disabled={detectingOpco}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-indigo-700 text-xs font-medium transition-colors disabled:opacity-50">
                  {detectingOpco ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Détecter OPCO & adresse
                </button>
              )}

              {/* Doublons toggle */}
              {duplicates.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
                  <button type="button" onClick={() => setShowDuplicates(!showDuplicates)} className="flex items-center gap-2 text-amber-700 font-medium text-sm w-full">
                    <AlertTriangle className="w-4 h-4" /><span>Similaires ({duplicates.length})</span><span className="ml-auto text-amber-500">{showDuplicates ? '▲' : '▼'}</span>
                  </button>
                  {showDuplicates && <div className="space-y-1 mt-2 pt-2 border-t border-amber-200">{duplicates.map((d, i) => {
                    const sl = d.prospection_status === 'rdv_pris' ? '✅' : d.prospection_status === 'a_rappeler' ? '🔄' : d.prospection_status === 'pas_interesse' ? '❌' : '⬜'
                    return <div key={i} className="text-xs text-amber-800 flex items-center gap-2 flex-wrap"><span className="font-medium">{d.name}</span><span className="text-amber-600">({d.city})</span><span className="bg-amber-100 px-1.5 py-0.5 rounded">{d.reason}</span><span>{sl}</span></div>
                  })}</div>}
                </div>
              )}

              {/* Résumé IA */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Résumé IA</span>
                </div>
                {aiSummaryLoading ? <div className="flex items-center gap-2 text-amber-600 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Analyse...</div>
                  : aiSummary ? <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{aiSummary}</p>
                  : <p className="text-sm text-amber-600 italic">Pas de résumé</p>}
              </div>

              {/* Nav */}
              <div className="flex gap-2 pt-2 border-t">
                <button onClick={() => { const idx = filtered.findIndex(p => p.id === current.id); if (idx > 0) selectProspect(filtered[idx-1]) }}
                  disabled={filtered.findIndex(p => p.id === current.id) === 0}
                  className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm disabled:opacity-30">← Précédent</button>
                <button onClick={handleSkip} className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">Passer →</button>
              </div>
            </div>}
          </div>

          {/* DROITE : Formulaire stepped */}
          <div className="col-span-3 bg-white rounded-xl border overflow-y-auto">
            {current && <div className="p-4 space-y-4">

              {/* Status reset pour prospects déjà marqués */}
              {current.prospection_status && !['a_appeler', null].includes(current.prospection_status) && (
                <button onClick={handleResetStatus} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 border border-gray-300">
                  <ArrowLeft className="w-4 h-4" /> ↩️ Remettre dans la file
                </button>
              )}

              {/* ═══ ÉTAPE 1 : Initial — 3 gros boutons ═══ */}
              {phoningStep === 'initial' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => setPhoningStep('responded')} disabled={saving}
                      className="flex flex-col items-center gap-2 px-4 py-5 bg-green-50 hover:bg-green-100 border-2 border-green-300 rounded-xl text-green-700 font-semibold transition-all hover:scale-[1.02]">
                      <Phone className="w-7 h-7" />
                      <span className="text-sm">Réponse</span>
                    </button>
                    <button onClick={() => setPhoningStep('no_response')} disabled={saving}
                      className="flex flex-col items-center gap-2 px-4 py-5 bg-gray-50 hover:bg-gray-100 border-2 border-gray-300 rounded-xl text-gray-600 font-semibold transition-all hover:scale-[1.02]">
                      <PhoneOff className="w-7 h-7" />
                      <span className="text-sm">Pas de réponse</span>
                    </button>
                    <button onClick={() => { handleQuickAction('wrong_number') }} disabled={saving}
                      className="flex flex-col items-center gap-2 px-4 py-5 bg-red-50 hover:bg-red-100 border-2 border-red-300 rounded-xl text-red-600 font-semibold transition-all hover:scale-[1.02]">
                      <XCircle className="w-7 h-7" />
                      <span className="text-sm">N° erroné</span>
                    </button>
                  </div>
                  <p className="text-center text-xs text-gray-400">Cliquez sur le résultat de l'appel</p>
                </div>
              )}

              {/* ═══ ÉTAPE : Pas de réponse — 2 choix ═══ */}
              {phoningStep === 'no_response' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => setPhoningStep('initial')} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
                    <h3 className="font-semibold text-gray-700 text-sm">📵 Pas de réponse</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleNoResponse(false)} disabled={saving}
                      className="flex flex-col items-center gap-2 px-4 py-5 bg-gray-50 hover:bg-gray-100 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold transition-all disabled:opacity-50">
                      <PhoneOff className="w-6 h-6" />
                      <span className="text-sm">Pas de réponse</span>
                      <span className="text-xs text-gray-400 font-normal">Sonnerie / occupé</span>
                    </button>
                    <button onClick={() => handleNoResponse(true)} disabled={saving}
                      className="flex flex-col items-center gap-2 px-4 py-5 bg-blue-50 hover:bg-blue-100 border-2 border-blue-300 rounded-xl text-blue-700 font-semibold transition-all disabled:opacity-50">
                      <MessageSquare className="w-6 h-6" />
                      <span className="text-sm">Message laissé</span>
                      <span className="text-xs text-blue-400 font-normal">Répondeur</span>
                    </button>
                  </div>
                  {saving && <div className="flex items-center justify-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Enregistrement...</div>}
                </div>
              )}

              {/* ═══ ÉTAPE : Réponse — Interlocuteur + 4 choix ═══ */}
              {phoningStep === 'responded' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPhoningStep('initial')} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
                    <h3 className="font-semibold text-gray-700 text-sm">📞 Quelqu'un a répondu</h3>
                  </div>

                  {/* Interlocuteur */}
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">👤 Interlocuteur</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nom du contact"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white" />
                      <select value={contactFunction} onChange={e => setContactFunction(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white">
                        <option value="Dirigeant">Dirigeant</option><option value="RH">RH</option><option value="QHSE">QHSE</option><option value="Resp formation">Resp formation</option><option value="Secrétariat">Secrétariat</option><option value="Autre">Autre</option>
                      </select>
                    </div>
                  </div>

                  {/* 4 résultats */}
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setCallResult('chaud'); setCreateRdv(true); setPhoningStep('interested') }}
                      className="flex flex-col items-center gap-1.5 px-3 py-4 bg-green-50 hover:bg-green-100 border-2 border-green-300 rounded-xl text-green-700 font-semibold transition-all hover:scale-[1.02]">
                      <span className="text-xl">🔥</span>
                      <span className="text-sm">Intéressé</span>
                    </button>
                    <button onClick={() => { setCallResult('tiede'); setNeedsCallback(true); setPhoningStep('callback') }}
                      className="flex flex-col items-center gap-1.5 px-3 py-4 bg-orange-50 hover:bg-orange-100 border-2 border-orange-300 rounded-xl text-orange-700 font-semibold transition-all hover:scale-[1.02]">
                      <span className="text-xl">🟡</span>
                      <span className="text-sm">À rappeler</span>
                    </button>
                    <button onClick={() => setPhoningStep('transfer')}
                      className="flex flex-col items-center gap-1.5 px-3 py-4 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-300 rounded-xl text-indigo-700 font-semibold transition-all hover:scale-[1.02]">
                      <span className="text-xl">↗️</span>
                      <span className="text-sm">Transférer</span>
                    </button>
                    <button onClick={() => setPhoningStep('not_interested')}
                      className="flex flex-col items-center gap-1.5 px-3 py-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-300 rounded-xl text-blue-700 font-semibold transition-all hover:scale-[1.02]">
                      <span className="text-xl">❄️</span>
                      <span className="text-sm">Pas intéressé</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ ÉTAPE : Intéressé — Formulaire complet ═══ */}
              {phoningStep === 'interested' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPhoningStep('responded')} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
                    <h3 className="font-semibold text-green-700 text-sm">🔥 Intéressé — {contactName || current.name}</h3>
                  </div>

                  {/* Contact details */}
                  <div className="grid grid-cols-2 gap-2">
                    <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Email direct"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    <input type="tel" value={contactMobile} onChange={e => setContactMobile(e.target.value)} placeholder="Mobile direct"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>

                  {/* Formations */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 text-sm">🎓 Formations</h4>
                    <div className="grid grid-cols-2 gap-1">{FORMATIONS.map(f => (
                      <label key={f} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                        <input type="checkbox" checked={formationsSelected.includes(f)} onChange={e => e.target.checked ? setFormationsSelected([...formationsSelected, f]) : setFormationsSelected(formationsSelected.filter(x => x !== f))} className="rounded" /><span>{f}</span>
                      </label>
                    ))}</div>
                  </div>

                  {/* Notes */}
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />

                  {/* RDV / Signal chaud */}
                  <div className="bg-green-50 rounded-lg p-3 space-y-2">
                    <span className="font-semibold text-gray-900 text-sm">{callerName === 'Marine' ? '🔥 Signaler prospect chaud' : '📅 Créer RDV'}</span>
                    {callerName === 'Marine' ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {['🔴 Urgent', '🌅 Matin', '🌇 Après-midi', '📅 Semaine pro.'].map(u => (
                            <button key={u} onClick={() => setRdvUrgency(rdvUrgency === u ? '' : u)}
                              className={'flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ' + (rdvUrgency === u ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}>
                              {u}
                            </button>
                          ))}
                        </div>
                        <input type="text" value={rdvDispoNote} onChange={e => setRdvDispoNote(e.target.value)}
                          placeholder="Dispo du prospect (ex: mardi matin, demander Mme Dupont)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <input type="date" value={rdvDate} onChange={e => setRdvDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border rounded-lg text-sm" />
                        <div className="flex gap-2">{['Hicham', 'Maxime'].map(name => (
                          <button key={name} onClick={() => setRdvAssignedTo(name)} className={'flex-1 px-3 py-2 rounded-lg border text-sm ' + (rdvAssignedTo === name ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-700 border-gray-300')}>{name}</button>
                        ))}</div>
                      </div>
                    )}
                  </div>

                  {/* Save */}
                  <button onClick={handleSave} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-semibold text-sm">
                    {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Enregistrement...</> : <><CheckCircle className="w-5 h-5" /> Enregistrer & Suivant</>}
                  </button>
                </div>
              )}

              {/* ═══ ÉTAPE : À rappeler — Notes + Rappel ═══ */}
              {phoningStep === 'callback' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPhoningStep('responded')} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
                    <h3 className="font-semibold text-orange-700 text-sm">🟡 À rappeler — {contactName || current.name}</h3>
                  </div>

                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (ce qui a été dit, ce qu'il faut préparer...)" rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />

                  {/* Rappel */}
                  <div className="bg-orange-50 rounded-lg p-3 space-y-2">
                    <h4 className="font-semibold text-gray-900 text-sm">🔔 Programmer rappel</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="date" value={callbackDate} onChange={e => setCallbackDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border rounded-lg text-sm bg-white" />
                      <input type="time" value={callbackTime} onChange={e => setCallbackTime(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white" />
                      <input type="text" value={callbackReason} onChange={e => setCallbackReason(e.target.value)} placeholder="Raison" className="w-full px-3 py-2 border rounded-lg text-sm bg-white" />
                    </div>
                  </div>

                  <button onClick={handleSave} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 font-semibold text-sm">
                    {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Enregistrement...</> : <><CheckCircle className="w-5 h-5" /> Enregistrer & Suivant</>}
                  </button>
                </div>
              )}

              {/* ═══ ÉTAPE : Transférer — Raison + email ═══ */}
              {phoningStep === 'transfer' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPhoningStep('responded')} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
                    <h3 className="font-semibold text-indigo-700 text-sm">↗️ Transférer — {current.name}</h3>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Raison</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {['Mauvaise entreprise', 'Renvoie vers le siège', 'Demande spécifique', 'Autre'].map(r => (
                        <button key={r} onClick={() => setTransferReason(r)}
                          className={'px-3 py-2 rounded-lg border text-sm font-medium transition-colors ' + (transferReason === r ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea value={transferNote} onChange={e => setTransferNote(e.target.value)} placeholder="Précisions (numéro siège, nom du contact, ce qu'il faut faire...)" rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />

                  <button onClick={handleTransfer} disabled={saving || !transferReason}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-semibold text-sm">
                    {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Envoi...</> : <><Send className="w-5 h-5" /> Envoyer à Hicham & Suivant</>}
                  </button>
                </div>
              )}

              {/* ═══ ÉTAPE : Pas intéressé — Quick tags ═══ */}
              {phoningStep === 'not_interested' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPhoningStep('responded')} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
                    <h3 className="font-semibold text-blue-700 text-sm">❄️ Pas intéressé — {contactName || current.name}</h3>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Raison</h4>
                    <div className="flex flex-col gap-2">
                      {[
                        { tag: 'Déjà un prestataire', icon: '🏢' },
                        { tag: 'Pas concerné / pas besoin', icon: '🚫' },
                        { tag: 'Pas de budget', icon: '💰' },
                        { tag: 'Ne veut pas de formation', icon: '✋' },
                        { tag: 'Fait en interne', icon: '🔧' },
                      ].map(({ tag, icon }) => (
                        <button key={tag} onClick={() => setNotInterestedTag(tag)}
                          className={'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ' + (notInterestedTag === tag ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}>
                          <span>{icon}</span><span>{tag}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes complémentaires (optionnel)" rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />

                  <button onClick={() => handleNotInterested(notInterestedTag)} disabled={saving || !notInterestedTag}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm">
                    {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Enregistrement...</> : <><Snowflake className="w-5 h-5" /> Archiver & Suivant</>}
                  </button>
                </div>
              )}

            </div>}
          </div>
        </div>
      )}

      {/* Modal Ajout Prospect */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">➕ Nouvelle entreprise</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise *</label>
                <input type="text" value={newProspect.name} onChange={e => setNewProspect({...newProspect, name: e.target.value})}
                  placeholder="ENTREPRISE ABC" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                  <input type="tel" value={newProspect.phone} onChange={e => setNewProspect({...newProspect, phone: e.target.value})}
                    placeholder="02 99 XX XX XX" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={newProspect.email} onChange={e => setNewProspect({...newProspect, email: e.target.value})}
                    placeholder="contact@..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                  <input type="text" value={newProspect.postal_code} onChange={e => setNewProspect({...newProspect, postal_code: e.target.value})}
                    placeholder="35000" maxLength={5} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <input type="text" value={newProspect.city} onChange={e => setNewProspect({...newProspect, city: e.target.value})}
                    placeholder="Rennes" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SIRET <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <input type="text" value={newProspect.siret} onChange={e => setNewProspect({...newProspect, siret: e.target.value})}
                    placeholder="12345678901234" maxLength={14} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SIREN <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <input type="text" value={newProspect.siren} onChange={e => setNewProspect({...newProspect, siren: e.target.value})}
                    placeholder="123456789" maxLength={9} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={newProspect.notes} onChange={e => setNewProspect({...newProspect, notes: e.target.value})}
                  placeholder="Redirigée par l'agence X..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Annuler</button>
              <button onClick={handleAddProspect} className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
