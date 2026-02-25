import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { 
  Phone, CheckCircle, RefreshCw, SkipForward,
  Building2, MapPin, Mail, List, Search, Sparkles, Loader2, Map as MapIcon, Navigation, AlertTriangle,
  Clock, PhoneOff, XCircle, Snowflake, Bell, Plus, Edit2, Briefcase, Send, ArrowLeft, MessageSquare, BarChart3, ChevronRight, X, Paperclip, Trash2, Smartphone, Check
} from 'lucide-react'
import toast from 'react-hot-toast'
import SpeechToTextButton from '../components/SpeechToTextButton'
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
  const [searchResults, setSearchResults] = useState(null) // null = pas de recherche serveur
  const [isServerSearching, setIsServerSearching] = useState(false)
  const searchTimerRef = useRef(null)
  const [totalCount, setTotalCount] = useState(0)
  const [doNotCallList, setDoNotCallList] = useState([])
  const [doNotCallCount, setDoNotCallCount] = useState(0)
  const [contactName, setContactName] = useState('')
  const [contactFunction, setContactFunction] = useState('Dirigeant')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [editingMobile, setEditingMobile] = useState(false)
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
  const [siblingSelections, setSiblingSelections] = useState(new Set()) // IDs cochés pour "géré par"
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
  const [callbackDetails, setCallbackDetails] = useState(new Map()) // siren → {date, time, reason, contact_name, called_by}
  const [rappelCallerMap, setRappelCallerMap] = useState(new Map()) // siren → last called_by
  const [showAddModal, setShowAddModal] = useState(false)
  const [newProspect, setNewProspect] = useState({ name: '', phone: '', city: '', postal_code: '', departement: '', siret: '', siren: '', email: '', notes: '' })
  const [detectingOpco, setDetectingOpco] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)
  // Stepped phoning flow
  const [phoningStep, setPhoningStep] = useState('initial') // initial | no_response | responded | interested | callback | transfer | not_interested | wrong_number
  const [transferReason, setTransferReason] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [notInterestedTag, setNotInterestedTag] = useState('')
  const [notInterestedCustom, setNotInterestedCustom] = useState('')
  const [wrongNumberNew, setWrongNumberNew] = useState('')
  const [showTodayCalls, setShowTodayCalls] = useState(false)
  const [todayCalls, setTodayCalls] = useState([])
  // NRP callback sub-step
  const [nrpMessageLaisse, setNrpMessageLaisse] = useState(false)
  const [nrpCallbackDate, setNrpCallbackDate] = useState('')
  const [nrpCallbackTime, setNrpCallbackTime] = useState('09:00')
  // Edit/delete calls
  const [editingCallId, setEditingCallId] = useState(null)
  const [editingCallNotes, setEditingCallNotes] = useState('')
  const [editingCallResult, setEditingCallResult] = useState('')
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false)
  const [showDoNotCallModal, setShowDoNotCallModal] = useState(false)
  const [doNotCallReason, setDoNotCallReason] = useState('')
  const [doNotCallCustom, setDoNotCallCustom] = useState('')
  // Filters for "À rappeler" tab
  const [rappelFilterBy, setRappelFilterBy] = useState('')
  const [rappelFilterDate, setRappelFilterDate] = useState('all')

  // Email prospect modal
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailTemplate, setEmailTemplate] = useState('suite_echange')
  const [emailSending, setEmailSending] = useState(false)
  const [emailAdaptLoading, setEmailAdaptLoading] = useState(false)
  const emailProspectRef = useRef(null) // Prospect capturé à l'ouverture du modal email
  // PJ fixes : toujours envoyées avec chaque email
  const FIXED_ATTACHMENTS = [
    { filename: 'Pres_Access_Formation.pdf', path: 'Pres_Access_Formation.pdf', label: 'Présentation' },
    { filename: 'AFProgrammes.pdf', path: 'AFProgrammes.pdf', label: 'Programmes' },
  ]
  const [pendingGoNext, setPendingGoNext] = useState(false)
  const [emailSentMap, setEmailSentMap] = useState({}) // siren -> { date, template }
  const [relanceSuggestions, setRelanceSuggestions] = useState({ total: 0, urgent: 0, normal: 0 })
  const [templateVersion, setTemplateVersion] = useState(0)

  const listRef = useRef(null)
  const departements = [...new Set(prospects.map(p => p.departement))].filter(Boolean).sort()

  useEffect(() => { loadProspects(); loadDailyStats(); loadTodayCallbacks(); loadDoNotCallCount() }, [])

  // Scroll en haut quand on change de filtre
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [statusFilter, departementFilter, effectifFilter, formeFilter, searchTerm])

  // Recherche serveur débounced — affiche TOUS les établissements
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSearchResults(null)
      setIsServerSearching(false)
      return
    }
    setIsServerSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('get_unique_prospects', { p_search: searchTerm.trim() })
        if (!error && data) {
          setSearchResults(data)
        }
      } catch (e) { console.error('Recherche serveur:', e) }
      setIsServerSearching(false)
    }, 400)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchTerm])

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

  async function loadDoNotCallCount() {
    try {
      const { count } = await supabase.from('prospection_massive').select('id', { count: 'exact', head: true }).eq('do_not_call', true)
      setDoNotCallCount(count || 0)
    } catch (err) { console.error('Erreur count DNC:', err) }
  }

  async function loadDoNotCallList() {
    try {
      const { data } = await supabase.from('prospection_massive')
        .select('*')
        .eq('do_not_call', true)
        .order('do_not_call_at', { ascending: false })
        .limit(200)
      setDoNotCallList(data || [])
    } catch (err) { console.error('Erreur liste DNC:', err) }
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
        .select('client_id, callback_date, callback_time, callback_reason, contact_name, called_by, clients!inner(siren)')
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
            details.set(siren, { date: d.callback_date, time: d.callback_time, reason: d.callback_reason, contact_name: d.contact_name, called_by: d.called_by })
          }
        })
        setTodayCallbackSirens(sirens)
        setCallbackDetails(details)
      }
      // Load last caller per siren for "À rappeler" filter
      const { data: lastCalls } = await supabase.from('prospect_calls')
        .select('called_by, clients!inner(siren)')
        .order('called_at', { ascending: false })
        .limit(300)
      if (lastCalls) {
        const callerMap = new Map()
        lastCalls.forEach(d => {
          const siren = d.clients?.siren
          if (siren && !callerMap.has(siren)) callerMap.set(siren, d.called_by)
        })
        setRappelCallerMap(callerMap)
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
    setContactEmail(prospect.email || prospect.contact_email || '')
    setContactMobile(prospect.contact_mobile || '')
    setEditingMobile(false)
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
    setNotInterestedCustom('')
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
    setSiblingSelections(new Set())
    try {
      const found = []
      const myId = prospect.id
      if (prospect.siren) {
        const { data } = await supabase.from('prospection_massive').select('id, name, city, departement, phone, siret, prospection_status, contacted, contacted_at, prospection_notes, gere_par_id, gere_par_city').eq('siren', prospect.siren).neq('id', myId).limit(20)
        if (data) data.forEach(d => found.push({ ...d, reason: 'Même SIREN (groupe)' }))
      }
      if (prospect.phone) {
        const { data } = await supabase.from('prospection_massive').select('id, name, city, departement, phone, prospection_status, contacted, contacted_at, prospection_notes').eq('phone', prospect.phone).neq('id', myId).limit(10)
        if (data) data.forEach(d => { if (!found.some(f => f.id === d.id)) found.push({ ...d, reason: 'Même téléphone' }) })
      }
      if (prospect.email) {
        const generic = ['contact@','info@','accueil@','reception@','secretariat@','administration@']
        if (!generic.some(g => prospect.email.toLowerCase().startsWith(g))) {
          const { data } = await supabase.from('prospection_massive').select('id, name, city, departement, phone, prospection_status, contacted, contacted_at, prospection_notes').eq('email', prospect.email).neq('id', myId).limit(10)
          if (data) data.forEach(d => { if (!found.some(f => f.id === d.id)) found.push({ ...d, reason: 'Même email' }) })
        }
      }
      if (prospect.site_web) {
        const domain = prospect.site_web.replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].toLowerCase()
        if (domain && domain.includes('.')) {
          const { data } = await supabase.from('prospection_massive').select('id, name, city, departement, phone, prospection_status, contacted, contacted_at, prospection_notes').ilike('site_web', '%' + domain + '%').neq('id', myId).limit(10)
          if (data) data.forEach(d => { if (!found.some(f => f.id === d.id)) found.push({ ...d, reason: 'Même site web' }) })
        }
      }
      setDuplicates(found)
    } catch (err) { console.error('Erreur doublons:', err) }
  }

  // ═══════════════════════════════════════════════════════════
  // GESTION MULTI-ÉTABLISSEMENTS — "Géré par"
  // ═══════════════════════════════════════════════════════════
  async function markSiblingsAsGerePar(siblingIds, masterProspect) {
    if (!siblingIds.length || !masterProspect) return
    try {
      await supabase.from('prospection_massive').update({
        gere_par_id: masterProspect.id,
        gere_par_city: masterProspect.city,
        gere_par_at: new Date().toISOString(),
        prospection_status: masterProspect.prospection_status || 'a_appeler',
        prospection_notes: `Géré par ${masterProspect.city} — ${masterProspect.prospection_notes || ''}`.trim(),
        contacted: true,
        contacted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).in('id', siblingIds)
      toast.success(`${siblingIds.length} agence(s) marquée(s) comme gérées par ${masterProspect.city}`)
      setSiblingSelections(new Set())
      loadDuplicates(masterProspect)
      await loadProspects()
    } catch (err) {
      console.error('Erreur gere_par:', err)
      toast.error('Erreur: ' + err.message)
    }
  }

  async function unmarkGerePar(siblingId) {
    try {
      await supabase.from('prospection_massive').update({
        gere_par_id: null, gere_par_city: null, gere_par_at: null,
        prospection_status: 'a_appeler', contacted: false, contacted_at: null,
        prospection_notes: null, updated_at: new Date().toISOString(),
      }).eq('id', siblingId)
      toast.success('Agence remise dans la file')
      if (current) loadDuplicates(current)
      await loadProspects()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  // ═══ DÉSIGNER UNE AUTRE AGENCE COMME CENTRALISATRICE ═══
  // Ex: tu es sur Derval → tu cliques "C'est eux" sur Redon
  // → Derval + tous les autres = "géré par Redon"
  // → Redon = prioritaire dans la file si pas encore contacté
  // SÉCURITÉ: updates par IDs explicites uniquement
  async function designateCentralOffice(centralSibling) {
    if (!current || !centralSibling) return
    try {
      // 1. Récupérer TOUS les frères du même SIREN
      const { data: allSiblings } = await supabase
        .from('prospection_massive')
        .select('id, city')
        .eq('siren', current.siren)
      if (!allSiblings || allSiblings.length === 0) return

      // 2. Tous sauf le central → "géré par"
      const idsToMark = allSiblings.filter(s => s.id !== centralSibling.id).map(s => s.id)
      const now = new Date().toISOString()

      if (idsToMark.length > 0) {
        await supabase.from('prospection_massive').update({
          gere_par_id: centralSibling.id,
          gere_par_city: centralSibling.city,
          gere_par_at: now,
          contacted: true,
          contacted_at: now,
          prospection_status: 'redirige',
          prospection_notes: `Redirigé vers ${centralSibling.city}`,
          updated_at: now,
        }).in('id', idsToMark)
      }

      // 3. L'agence centrale : si pas encore contactée, la remonter
      if (!centralSibling.contacted) {
        await supabase.from('prospection_massive').update({
          prospection_status: 'a_appeler',
          prospection_notes: `Agence centrale (redirigé depuis ${current.city})`,
          updated_at: now,
        }).eq('id', centralSibling.id)
      }

      toast.success(`✅ ${idsToMark.length} agence(s) redirigées vers ${centralSibling.city}`)
      setSiblingSelections(new Set())
      await loadProspects()
      goNext()
    } catch (err) {
      console.error('Erreur centralisation:', err)
      toast.error('Erreur: ' + err.message)
    }
  }

  function toggleSiblingSelection(id) {
    setSiblingSelections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllSiblings() {
    const allIds = duplicates.filter(d => !d.gere_par_id && d.reason?.includes('SIREN')).map(d => d.id)
    setSiblingSelections(new Set(allIds))
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

  async function saveMobileDirect() {
    if (!current || !contactMobile.trim()) return
    try {
      // Sauvegarder dans le dernier call_log si existant
      if (callHistory.length > 0) {
        await supabase.from('call_logs').update({ contact_mobile: contactMobile.trim() }).eq('id', callHistory[0].id)
      }
      // Sauvegarder aussi sur la fiche prospect
      await supabase.from('prospection_massive').update({ contact_mobile: contactMobile.trim() }).eq('id', current.id)
      toast.success('📱 Mobile direct sauvegardé')
    } catch (err) {
      console.error('Erreur sauvegarde mobile:', err)
      // Non bloquant — le champ contact_mobile n'existe peut-être pas encore sur prospection_massive
    }
  }

  async function findOrCreateClient(prospect) {
    const cleanSiren = prospect.siren && !prospect.siren.startsWith('MANUAL_') ? prospect.siren.slice(0, 9) : null
    const cleanSiret = prospect.siret && !prospect.siret.startsWith('MANUAL_') ? prospect.siret.slice(0, 14) : null
    // 1. Chercher par SIRET (unique par établissement)
    if (cleanSiret) {
      const { data: existing } = await supabase.from('clients').select('id').eq('siret', cleanSiret).maybeSingle()
      if (existing) return existing.id
    }
    // 2. Pas de match SIRET → créer un nouveau client (même si le SIREN existe pour un autre établissement)
    const { data: newClient, error } = await supabase.from('clients').insert({
      name: prospect.name, address: prospect.city ? prospect.postal_code + ' ' + prospect.city : null,
      postal_code: prospect.postal_code, city: prospect.city, siret: cleanSiret, siren: cleanSiren,
      contact_phone: prospect.phone, email: prospect.email || null, website: prospect.site_web || null,
      taille_entreprise: prospect.effectif || null, status: 'prospect', type: 'prospect',
    }).select('id').single()
    if (error) throw error
    return newClient.id
  }

  async function clearOldCallbacks(clientId) {
    try {
      await supabase.from('prospect_calls').update({ needs_callback: false }).eq('client_id', clientId).eq('needs_callback', true)
    } catch (err) { console.error('Erreur nettoyage rappels:', err) }
  }

  async function handleSave() {
    if (!current) return
    setSaving(true)
    try {
      const clientId = await findOrCreateClient(current)
      await clearOldCallbacks(clientId)
      const { data: insertedCall, error: callError } = await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: callerName,
        contact_name: contactName || null, contact_function: contactFunction || null,
        contact_email: contactEmail || null, contact_mobile: contactMobile || null,
        call_result: callResult,
        formations_mentioned: formationsSelected.length > 0 ? formationsSelected : null,
        notes: notes || null, rdv_created: createRdv, needs_callback: needsCallback,
        callback_date: needsCallback && callbackDate ? callbackDate : null, callback_time: needsCallback && callbackTime ? callbackTime : null,
        callback_reason: needsCallback && callbackReason ? callbackReason : null, duration_seconds: getElapsedSeconds(),
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
      }).eq('id', current.id)

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
      // Email notif à Hicham si c'est Marine + appel intéressé
      if (callerName === 'Marine' && (createRdv || callResult === 'chaud')) {
        try {
          const emoji = callResult === 'chaud' ? '🔥' : '🟡'
          await fetch('/api/send-callback-reminder', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prospectName: current.name, prospectPhone: current.phone,
              contactName, contactFunction,
              callbackDate: null, callbackTime: null,
              callbackReason: emoji + ' ' + (callResult === 'chaud' ? 'INTÉRESSÉ' : 'TIÈDE') + ' — ' + (formationsSelected.length > 0 ? formationsSelected.join(', ') : 'Formations non précisées'),
              callerName: 'Marine',
              to: 'hicham.saidi@accessformation.pro',
              notes: (contactName ? 'Contact : ' + contactName + (contactFunction ? ' (' + contactFunction + ')' : '') + '\n' : '') + (current.city ? 'Ville : ' + current.city + ' (' + (current.distance < 9999 ? current.distance.toFixed(0) + ' km' : '?') + ')\n' : '') + (notes || ''),
            })
          })
        } catch (e) { console.error('Erreur notif Marine:', e) }
      }
      loadDailyStats()
      loadTodayCallbacks()
      // Si email dispo, ouvrir modale email au lieu de passer au suivant
      const prospectEmail = contactEmail || current.email
      if (prospectEmail || contactName) {
        const tpl = callResult === 'chaud' || callResult === 'tiede' ? 'suite_echange' : 'nrp'
        openEmailModal(current, tpl, true)
      } else {
        goNext()
      }
      await loadProspects()
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur: ' + (error.message || 'Echec sauvegarde'))
    } finally { setSaving(false) }
  }

  async function handleResetStatus() {
    if (!current) return
    setSaving(true)
    try {
      await supabase.from('prospection_massive').update({
        prospection_status: 'a_appeler', contacted: false, contacted_at: null, updated_at: new Date().toISOString()
      }).eq('id', current.id)
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
      await clearOldCallbacks(clientId)
      await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: callerName, call_result: result,
        notes: result === 'no_answer' ? 'Pas de réponse' : result === 'wrong_number' ? 'Numéro erroné' : 'Pas intéressé',
        duration_seconds: getElapsedSeconds(),
      })
      const newStatus = result === 'froid' ? 'pas_interesse' : result === 'wrong_number' ? 'numero_errone' : 'a_rappeler'
      await supabase.from('prospection_massive').update({
        contacted: true, contacted_at: new Date().toISOString(), prospection_status: newStatus, updated_at: new Date().toISOString()
      }).eq('id', current.id)
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

  async function loadTodayCallsList() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase.from('prospect_calls')
        .select('id, call_result, called_by, called_at, contact_name, contact_function, notes, formations_mentioned, needs_callback, callback_date, callback_time, clients!inner(id, name, siren)')
        .gte('called_at', today + 'T00:00:00').lte('called_at', today + 'T23:59:59')
        .order('called_at', { ascending: false })
      if (data) setTodayCalls(data)
    } catch (err) { console.error('Erreur chargement appels du jour:', err) }
  }

  async function handleWrongNumber() {
    if (!current) return
    setSaving(true)
    try {
      const clientId = await findOrCreateClient(current)
      await clearOldCallbacks(clientId)
      const hasNew = wrongNumberNew.trim().length >= 6
      const noteText = hasNew ? 'Numéro erroné. Nouveau numéro : ' + wrongNumberNew.trim() : 'Numéro erroné'
      await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: callerName, call_result: 'wrong_number',
        notes: noteText, duration_seconds: getElapsedSeconds(),
      })
      if (hasNew) {
        await supabase.from('prospection_massive').update({
          phone: wrongNumberNew.trim(), contacted: false, contacted_at: null,
          prospection_status: 'a_appeler', prospection_notes: noteText, updated_at: new Date().toISOString(),
        }).eq('siren', current.siren)
        await supabase.from('clients').update({ contact_phone: wrongNumberNew.trim() }).eq('id', clientId)
        toast.success('✅ Nouveau numéro enregistré — remis dans la file')
      } else {
        await supabase.from('prospection_massive').update({
          contacted: true, contacted_at: new Date().toISOString(),
          prospection_status: 'numero_errone', updated_at: new Date().toISOString(),
        }).eq('siren', current.siren)
        toast.success('❌ N° erroné — suivant')
      }
      loadDailyStats(); loadTodayCallbacks(); goNext(); await loadProspects()
    } catch (error) {
      toast.error('Erreur: ' + error.message)
    } finally { setSaving(false) }
  }
  const EMAIL_TEMPLATES = {
    suite_echange: {
      subject: (name) => 'Suite à notre échange – formations santé & sécurité',
      body: (name, contact) => `<p>Bonjour${contact ? ' ' + contact : ''},</p>
<p>Merci encore d'avoir pris le temps d'échanger avec moi aujourd'hui 😊</p>
<p>Comme évoqué au téléphone, Access Formation accompagne les entreprises de Bretagne et Pays de la Loire sur les sujets de santé et sécurité au travail, avec une approche très terrain et sur mesure.</p>
<p>Nous intervenons notamment sur :</p>
<ul>
<li>le secourisme (SST, MAC SST)</li>
<li>la prévention incendie (EPI, extincteurs, évacuation)</li>
<li>les gestes et postures / TMS</li>
<li>les habilitations électriques (B0 / H0V)</li>
<li>la conduite de chariots et gerbeurs (R485 / R489)</li>
</ul>
<p>Notre particularité : des formations intra-entreprise, directement sur site, animées par l'un de nos deux formateurs, avec des contenus concrets, participatifs, et pensés pour être utiles au quotidien (pas de format descendant ou ennuyeux).</p>
<p>Nous sommes également certifiés <strong>Qualiopi</strong>, ce qui permet, selon les cas, un financement via les OPCO.</p>
<p>Si vous le souhaitez, nous proposons un <strong>diagnostic gratuit de 20 minutes</strong>, afin de cadrer vos besoins, vos contraintes et voir ensemble si cela a du sens d'aller plus loin.</p>
<p>Nous restons bien entendu à votre disposition pour échanger, et vous souhaitons une très bonne journée !</p>`,
    },
    nrp: {
      subject: (name) => 'Vos formations sécurité sont-elles à jour ?',
      body: (name, contact) => `<p>Bonjour${contact ? ' ' + contact : ''},</p>
<p>Je me permets de vous contacter par mail, car j'ai tenté de vous joindre ce jour, sans succès.</p>
<p>Je souhaitais échanger avec vous pour vous présenter <strong>Access Formation</strong>, organisme de formation spécialisé en santé et sécurité au travail, intervenant en Bretagne et Pays de la Loire.</p>
<p>Nous intervenons notamment sur :</p>
<ul>
<li>le secourisme (SST, MAC SST)</li>
<li>la prévention incendie (EPI, extincteurs, évacuation)</li>
<li>les gestes et postures / TMS</li>
<li>les habilitations électriques (B0 / H0V)</li>
<li>la conduite de chariots et gerbeurs (R485 / R489)</li>
</ul>
<p>Notre particularité : des formations intra-entreprise, directement sur site, animées par l'un de nos deux formateurs, avec des contenus concrets, participatifs, et pensés pour être utiles au quotidien (pas de format descendant ou ennuyeux).</p>
<p>Nous sommes également certifiés <strong>Qualiopi</strong>, ce qui permet, selon les cas, un financement via les OPCO.</p>
<p>Si vous le souhaitez, nous proposons un <strong>diagnostic gratuit de 20 minutes</strong>, afin de cadrer vos besoins, vos contraintes et voir ensemble si cela a du sens d'aller plus loin.</p>
<p>Nous restons bien entendu à votre disposition pour échanger, et vous souhaitons une très bonne journée !</p>`,
    },
    relance: {
      subject: (name) => 'Relance – formations santé & sécurité',
      body: (name, contact) => `<p>Bonjour${contact ? ' ' + contact : ''},</p>
<p>Je me permets de revenir vers vous suite à mon précédent message.</p>
<p>Nous accompagnons les entreprises de Bretagne et Pays de la Loire en formations santé et sécurité : SST, incendie, gestes et postures, habilitations électriques, CACES.</p>
<p>Nos formations sont <strong>100% intra-entreprise</strong>, directement chez vous, avec des contenus concrets et participatifs. Nous sommes certifiés <strong>Qualiopi</strong> (financement OPCO possible).</p>
<p>Seriez-vous disponible pour un échange rapide de 10 minutes cette semaine ?</p>
<p>Belle journée !</p>`,
    },
  }

  function openEmailModal(prospect, template, goNextAfter = true) {
    const tpl = template || 'suite_echange'
    const email = contactEmail || prospect?.email || ''
    const name = contactName || ''
    const t = EMAIL_TEMPLATES[tpl]
    emailProspectRef.current = prospect // ← Capturer le prospect AVANT tout changement
    setEmailTo(email)
    setEmailSubject(t.subject(prospect?.name))
    setEmailBody(t.body(prospect?.name, name))
    setEmailTemplate(tpl)
    setPendingGoNext(goNextAfter)
    setShowEmailModal(true)
  }

  async function checkEmailDuplicate(siren) {
    if (!siren) return null
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const { data } = await supabase.from('prospect_email_logs')
      .select('sent_at, template_type')
      .eq('prospect_siren', siren)
      .gte('sent_at', thirtyDaysAgo)
      .order('sent_at', { ascending: false })
      .limit(1)
    return data && data.length > 0 ? data[0] : null
  }

  async function handleSendEmail() {
    if (!emailTo) { toast.error('Adresse email requise'); return }
    const ep = emailProspectRef.current || current // Utiliser le prospect capturé
    // Anti-doublon
    const dup = await checkEmailDuplicate(ep?.siren)
    if (dup) {
      const days = Math.floor((Date.now() - new Date(dup.sent_at).getTime()) / 86400000)
      if (!confirm('Un email (' + dup.template_type + ') a deja ete envoye il y a ' + days + ' jours. Envoyer quand meme ?')) return
    }
    setEmailSending(true)
    try {
      // Sauvegarder l'email sur le prospect si nouveau
      if (emailTo && ep?.id && emailTo !== ep.email) {
        await supabase.from('prospection_massive').update({ email: emailTo, updated_at: new Date().toISOString() }).eq('id', ep.id)
      }

      // ═══ Préparer les 2 PJ fixes ═══
      const allAttachments = []
      for (const pj of FIXED_ATTACHMENTS) {
        try {
          const { data: fileData, error } = await supabase.storage.from('email-attachments').download(pj.path)
          if (error || !fileData) { console.warn('PJ introuvable:', pj.path, error); continue }
          const arrayBuf = await fileData.arrayBuffer()
          const base64 = btoa(new Uint8Array(arrayBuf).reduce((s, b) => s + String.fromCharCode(b), ''))
          allAttachments.push({ filename: pj.filename, base64, contentType: 'application/pdf' })
        } catch (e) { console.warn('Erreur téléchargement PJ:', pj.path, e) }
      }

      // ═══ Résoudre le client_id depuis le SIREN ═══
      let resolvedClientId = null
      if (ep?.siren && !ep.siren.startsWith('MANUAL_')) {
        const { data: cl } = await supabase.from('clients').select('id').eq('siren', ep.siren.slice(0, 9)).maybeSingle()
        if (cl) resolvedClientId = cl.id
      }

      const res = await fetch('/api/send-prospect-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo, subject: emailSubject, body: emailBody, caller: callerName,
          prospectSiren: ep?.siren, clientId: resolvedClientId, prospectName: ep?.name, templateType: emailTemplate,
          attachments: allAttachments.length > 0 ? allAttachments : undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur envoi')
      const nbPJ = allAttachments.length
      toast.success(`✉️ Email envoyé à ${emailTo}${nbPJ ? ` (${nbPJ} PJ)` : ''}`)
      setEmailSentMap(prev => ({ ...prev, [ep?.siren]: { date: new Date(), template: emailTemplate } }))
      setShowEmailModal(false)
      emailProspectRef.current = null // Nettoyer la ref
      if (pendingGoNext) { goNext(); loadProspects() }
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    } finally { setEmailSending(false) }
  }

  function handleSkipEmail() {
    setShowEmailModal(false)
    emailProspectRef.current = null // Nettoyer la ref
    if (pendingGoNext) { goNext(); loadProspects() }
  }

  function handleSendAndNext() { handleSendEmail() }

  async function handleAdaptWithAI() {
    setEmailAdaptLoading(true)
    const ep = emailProspectRef.current || current // Utiliser le prospect capturé
    try {
      const res = await fetch('/api/adapt-prospect-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectName: ep?.name,
          sector: ep?.naf_label || '',
          formations: formationsSelected.length > 0 ? formationsSelected.join(', ') : '',
          contactName: contactName || '',
          contactFunction: contactFunction || '',
          notes: notes || '',
          currentBody: emailBody,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur IA')
      if (data.adapted) { setEmailBody(data.adapted); setTemplateVersion(v => v + 1); toast.success('✨ Mail adapté') }
      else toast.error('Pas de réponse IA')
    } catch (err) { toast.error('Erreur IA: ' + err.message) }
    finally { setEmailAdaptLoading(false) }
  }

  // ═══ Load email sent map on mount ═══
  useEffect(() => {
    async function loadEmailSentMap() {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
      const { data } = await supabase.from('prospect_email_logs')
        .select('prospect_siren, sent_at, template_type')
        .gte('sent_at', thirtyDaysAgo)
        .eq('status', 'sent')
      if (data) {
        const map = {}
        let urgent = 0, normal = 0
        data.forEach(d => {
          if (d.prospect_siren) {
            map[d.prospect_siren] = { date: new Date(d.sent_at), template: d.template_type }
            const days = Math.floor((Date.now() - new Date(d.sent_at).getTime()) / 86400000)
            if (d.template_type !== 'relance') {
              if (days >= 15) urgent++
              else if (days >= 7) normal++
            }
          }
        })
        setEmailSentMap(map)
        setRelanceSuggestions({ total: urgent + normal, urgent, normal })
      }
    }
    loadEmailSentMap()
  }, [])

  function goNext() {
    if (!current || viewMode === 'list') { setCurrent(null); return }
    const prevName = current.name
    const list = viewMode === 'carte' ? mapProspects : filtered
    const idx = list.findIndex(p => p.id === current.id)
    if (idx < list.length - 1) {
      selectProspect(list[idx + 1])
      toast(`✅ ${prevName} → ${list[idx + 1].name}`, { duration: 2000 })
    }
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
  async function handleNoResponse(messageLaisse, cbDate, cbTime) {
    if (!current) return
    setSaving(true)
    try {
      const clientId = await findOrCreateClient(current)
      await clearOldCallbacks(clientId)
      const now = new Date()
      const noteText = `${callerName} — ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — ${messageLaisse ? 'Message laissé' : 'Pas de réponse'}` + (cbDate ? ` — Rappel ${new Date(cbDate).toLocaleDateString('fr-FR')}${cbTime ? ' à ' + cbTime : ''}` : '')
      await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: callerName, call_result: 'no_answer',
        notes: noteText, duration_seconds: getElapsedSeconds(),
        needs_callback: !!cbDate, callback_date: cbDate || null, callback_time: cbTime || null,
      })
      await supabase.from('prospection_massive').update({
        contacted: true, contacted_at: now.toISOString(), prospection_status: 'a_rappeler',
        prospection_notes: noteText, updated_at: now.toISOString(),
      }).eq('id', current.id)
      toast.success(messageLaisse ? '📨 Message laisse' : '📵 Pas de reponse')
      loadDailyStats(); loadTodayCallbacks()
      // Proposer email NRP si email dispo
      const pe = current.email
      if (pe) { openEmailModal(current, 'nrp', true) }
      else { goNext() }
      await loadProspects()
    } catch (error) { toast.error('Erreur: ' + error.message) }
    finally { setSaving(false) }
  }

  async function handleNotInterested(tag) {
    if (!current) return
    setSaving(true)
    try {
      const clientId = await findOrCreateClient(current)
      await clearOldCallbacks(clientId)
      const noteText = `❄️ ${tag}` + (notes ? '\n' + notes : '')
      await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: callerName, call_result: 'froid',
        contact_name: contactName || null, contact_function: contactFunction || null,
        notes: noteText, duration_seconds: getElapsedSeconds(),
      })
      await supabase.from('prospection_massive').update({
        contacted: true, contacted_at: new Date().toISOString(), prospection_status: 'pas_interesse',
        prospection_notes: noteText, updated_at: new Date().toISOString(),
      }).eq('id', current.id)
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
      await clearOldCallbacks(clientId)
      const noteText = `👋 Passer la main — ${transferReason}` + (transferNote ? '\n' + transferNote : '') + (contactName ? '\nContact : ' + contactName + (contactFunction ? ' (' + contactFunction + ')' : '') : '')
      await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: callerName, call_result: 'blocked',
        contact_name: contactName || null, contact_function: contactFunction || null,
        notes: noteText, duration_seconds: getElapsedSeconds(),
      })
      await supabase.from('prospection_massive').update({
        contacted: true, contacted_at: new Date().toISOString(), prospection_status: 'a_rappeler',
        prospection_notes: noteText, updated_at: new Date().toISOString(),
      }).eq('id', current.id)
      // Email simple à Hicham
      try {
        await fetch('/api/send-callback-reminder', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prospectName: current.name, prospectPhone: current.phone,
            contactName, contactFunction,
            callbackDate: null, callbackTime: null,
            callbackReason: '👋 PASSER LA MAIN — ' + transferReason + (transferNote ? '\n' + transferNote : ''),
            callerName, to: 'hicham.saidi@accessformation.pro',
              notes: 'Prospect à rappeler par Hicham/Maxime.\n' + (current.city ? 'Ville : ' + current.city + ' (' + (current.distance < 9999 ? current.distance.toFixed(0) + ' km' : '?') + ')\n' : '') + (current.siret ? 'SIRET : ' + current.siret : ''),
          })
        })
      } catch (emailErr) { console.error('Erreur email transfert:', emailErr) }
      toast.success('👋 Transmis à Hicham/Maxime — suivant')
      loadDailyStats(); loadTodayCallbacks(); goNext(); await loadProspects()
    } catch (error) { toast.error('Erreur: ' + error.message) }
    finally { setSaving(false) }
  }

  // === EDIT / DELETE CALL ===
  async function handleEditCall(callId) {
    if (!editingCallNotes && !editingCallResult) return
    try {
      const updates = {}
      if (editingCallNotes !== undefined) updates.notes = editingCallNotes
      if (editingCallResult) updates.call_result = editingCallResult
      await supabase.from('prospect_calls').update(updates).eq('id', callId)
      toast.success('Appel modifié')
      setEditingCallId(null)
      if (current) loadCallHistory(current)
      setShowStatusChangeDialog(true)
    } catch (error) { toast.error('Erreur: ' + error.message) }
  }

  async function handleDeleteCall(callId) {
    if (!window.confirm('Supprimer cet appel ?')) return
    try {
      await supabase.from('prospect_calls').delete().eq('id', callId)
      toast.success('Appel supprimé')
      setEditingCallId(null)
      if (current) loadCallHistory(current)
      setShowStatusChangeDialog(true)
    } catch (error) { toast.error('Erreur: ' + error.message) }
  }

  async function handleUpdateProspectStatus(newStatus) {
    if (!current) return
    try {
      await supabase.from('prospection_massive').update({
        prospection_status: newStatus, updated_at: new Date().toISOString(),
      }).eq('id', current.id)
      setProspects(prev => prev.map(p => p.id === current.id ? { ...p, prospection_status: newStatus } : p))
      current.prospection_status = newStatus
      toast.success('Statut mis à jour')
      loadTodayCallbacks()
    } catch (error) { toast.error('Erreur: ' + error.message) }
  }

  async function handleDoNotCall() {
    if (!current) return
    const reason = doNotCallReason === 'autre' ? doNotCallCustom.trim() : doNotCallReason
    if (!reason) { toast.error('Motif obligatoire'); return }
    try {
      await supabase.from('prospection_massive').update({
        do_not_call: true,
        do_not_call_reason: reason,
        do_not_call_by: callerName,
        do_not_call_at: new Date().toISOString(),
        prospection_status: 'ne_pas_rappeler',
        updated_at: new Date().toISOString(),
      }).eq('id', current.id)
      setProspects(prev => prev.filter(p => p.id !== current.id))
      setShowDoNotCallModal(false)
      setDoNotCallReason('')
      setDoNotCallCustom('')
      toast.success('🚫 Marqué "ne pas rappeler"')
      goNext()
    } catch (error) { toast.error('Erreur: ' + error.message) }
  }

  // === FILTRES & TRI ===
  const rappelsCount = prospects.filter(p => p.siren && todayCallbackSirens.has(p.siren)).length

  const STATUS_FILTERS = [
    { id: 'a_appeler', label: '📞 À appeler', count: prospects.filter(p => (!p.prospection_status || p.prospection_status === 'a_appeler') && !p.gere_par_id).length },
    { id: 'rappels', label: '🔔 Rappels', count: rappelsCount },
    { id: 'a_rappeler', label: '🟡 À rappeler', count: prospects.filter(p => p.prospection_status === 'a_rappeler').length },
    { id: 'rdv_pris', label: '🔥 RDV', count: prospects.filter(p => p.prospection_status === 'rdv_pris').length },
    { id: 'redirige', label: '🏢 Redirigé', count: prospects.filter(p => p.prospection_status === 'redirige' || p.gere_par_id).length },
    { id: 'pas_interesse', label: '❄️ Refus', count: prospects.filter(p => p.prospection_status === 'pas_interesse').length },
    { id: 'numero_errone', label: '❌ Erroné', count: prospects.filter(p => p.prospection_status === 'numero_errone').length },
    { id: 'ne_pas_rappeler', label: '🚫 Ne pas rappeler', count: doNotCallCount },
    { id: 'tous', label: '📋 Tous', count: prospects.length },
  ]

  const filtered = useMemo(() => {
    const base = BASES[mapBase]

    // Onglet "Ne pas rappeler" → liste séparée (pas dans le RPC)
    if (statusFilter === 'ne_pas_rappeler') {
      return doNotCallList.map(p => ({
        ...p,
        distance: (p.latitude && p.longitude) ? distanceKm(base.lat, base.lng, p.latitude, p.longitude) : 9999
      }))
    }

    // Si recherche serveur active → utiliser les résultats serveur (tous établissements)
    if (searchResults !== null && searchTerm && searchTerm.trim().length >= 2) {
      let list = searchResults.map(p => {
        const dist = (p.latitude && p.longitude) ? distanceKm(base.lat, base.lng, p.latitude, p.longitude) : 9999
        return { ...p, distance: dist }
      })
      if (mapRadius > 0) list = list.filter(p => p.distance <= mapRadius)
      return list
    }

    // Sinon → filtrage client classique (liste dédupliquée)
    let list = prospects.filter(p => {
      if (statusFilter === 'a_appeler' && p.prospection_status && p.prospection_status !== 'a_appeler') return false
      if (statusFilter === 'a_appeler' && p.gere_par_id) return false
      if (statusFilter === 'rappels' && !(p.siren && todayCallbackSirens.has(p.siren))) return false
      if (statusFilter === 'a_rappeler' && p.prospection_status !== 'a_rappeler') return false
      // Sub-filters for "À rappeler" tab
      if (statusFilter === 'a_rappeler' && rappelFilterBy) {
        const lastCaller = rappelCallerMap.get(p.siren) || callbackDetails.get(p.siren)?.called_by
        if (lastCaller !== rappelFilterBy) return false
      }
      if (statusFilter === 'a_rappeler' && rappelFilterDate !== 'all') {
        const cbDetail = callbackDetails.get(p.siren)
        const cbDate = cbDetail?.date
        if (rappelFilterDate === 'today') {
          const today = new Date().toISOString().split('T')[0]
          if (cbDate !== today) return false
        } else if (rappelFilterDate === 'week') {
          const now = new Date(); const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() + 1); startOfWeek.setHours(0,0,0,0)
          const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6)
          if (!cbDate || cbDate < startOfWeek.toISOString().split('T')[0] || cbDate > endOfWeek.toISOString().split('T')[0]) return false
        }
      }
      if (statusFilter === 'rdv_pris' && p.prospection_status !== 'rdv_pris') return false
      if (statusFilter === 'redirige' && p.prospection_status !== 'redirige' && !p.gere_par_id) return false
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
      // Si les deux sont des rappels, trier par date de callback puis heure (plus ancien d'abord)
      if (aCb && bCb) {
        const aDate = callbackDetails.get(a.siren)?.date || '9999'
        const bDate = callbackDetails.get(b.siren)?.date || '9999'
        if (aDate !== bDate) return aDate.localeCompare(bDate)
        const aTime = callbackDetails.get(a.siren)?.time || '99:99'
        const bTime = callbackDetails.get(b.siren)?.time || '99:99'
        if (aTime !== bTime) return aTime.localeCompare(bTime)
      }
      // Dans l'onglet "À rappeler", trier par date+heure de callback aussi
      if (statusFilter === 'a_rappeler') {
        const aD = callbackDetails.get(a.siren)?.date || '9999'
        const bD = callbackDetails.get(b.siren)?.date || '9999'
        if (aD !== bD) return aD.localeCompare(bD)
        const aT = callbackDetails.get(a.siren)?.time || '99:99'
        const bT = callbackDetails.get(b.siren)?.time || '99:99'
        if (aT !== bT) return aT.localeCompare(bT)
      }
      const order = { 'a_rappeler': 1, 'a_appeler': 2, '': 2, null: 2 }
      const aO = order[a.prospection_status] || 3
      const bO = order[b.prospection_status] || 3
      if (aO !== bO) return aO - bO
      return a.distance - b.distance
    })
    return list
  }, [prospects, statusFilter, departementFilter, effectifFilter, formeFilter, searchTerm, searchResults, todayCallbackSirens, callbackDetails, rappelCallerMap, rappelFilterBy, rappelFilterDate, mapBase, mapRadius, doNotCallList])

  // En mode file, sélectionner le premier prospect du filtre actif
  // MAIS PAS si le modal email est ouvert (le prospect a été capturé dans emailProspectRef)
  useEffect(() => {
    if (showEmailModal) return // Ne pas changer de prospect pendant l'envoi d'email
    if (viewMode === 'file' && filtered.length > 0) {
      if (!current || !filtered.some(p => p.id === current.id)) {
        selectProspect(filtered[0])
      }
    } else if (viewMode === 'file' && filtered.length === 0) {
      setCurrent(null)
    }
  }, [filtered, viewMode, showEmailModal])

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
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
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
          <p className="text-gray-500 text-sm">{searchResults ? `${filtered.length} établissement(s) trouvé(s)` : `${filtered.length} sur ${prospects.length}`}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stats du jour */}
          <div onClick={() => { loadTodayCallsList(); setShowTodayCalls(true) }} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer hover:bg-gray-100 transition-colors">
            <span className="font-semibold text-gray-600">Aujourd'hui</span>
            <span className="bg-gray-800 text-white px-1.5 py-0.5 rounded font-bold">{dailyStats.total}</span>
            {dailyStats.chaud > 0 && <span className="text-green-600 font-medium">🔥{dailyStats.chaud}</span>}
            {dailyStats.tiede > 0 && <span className="text-orange-500 font-medium">🟡{dailyStats.tiede}</span>}
            {dailyStats.froid > 0 && <span className="text-blue-500 font-medium">❄️{dailyStats.froid}</span>}
            {dailyStats.no_answer > 0 && <span className="text-gray-400">📞{dailyStats.no_answer}</span>}
            {relanceSuggestions.total > 0 && (
              <span className="flex items-center gap-1">
                {relanceSuggestions.urgent > 0 && <span className="text-red-500 font-medium">🔴{relanceSuggestions.urgent}</span>}
                {relanceSuggestions.normal > 0 && <span className="text-orange-500 font-medium">✉️{relanceSuggestions.normal}</span>}
                <span className="text-gray-400 text-[10px]">relances</span>
              </span>
            )}
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
          <button key={s.id} onClick={() => { setStatusFilter(s.id); if (s.id === 'ne_pas_rappeler') loadDoNotCallList() }}
            className={'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ' +
              (statusFilter === s.id ? (s.id === 'rappels' ? 'bg-amber-500 text-white border-amber-500' : 'bg-primary-600 text-white border-primary-600')
                : (s.id === 'rappels' && s.count > 0 ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 animate-pulse' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'))}>
            {s.label} <span className="ml-1 font-bold">{s.count}</span>
          </button>
        ))}
      </div>

      {/* Sous-filtres pour "À rappeler" */}
      {statusFilter === 'a_rappeler' && (
        <div className="flex gap-2 flex-wrap items-center bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
          <span className="text-xs font-medium text-amber-700">Filtrer :</span>
          <select value={rappelFilterBy} onChange={e => setRappelFilterBy(e.target.value)}
            className="px-2 py-1 border border-amber-300 rounded text-xs bg-white">
            <option value="">👤 Tous</option>
            <option value="Hicham">Hicham</option>
            <option value="Marine">Marine</option>
            <option value="Maxime">Maxime</option>
          </select>
          <div className="flex gap-1">
            {[
              { value: 'all', label: "📋 Tout" },
              { value: 'today', label: "📅 Aujourd'hui" },
              { value: 'week', label: '📆 Cette semaine' },
            ].map(f => (
              <button key={f.value} onClick={() => setRappelFilterDate(f.value)}
                className={'px-2 py-1 rounded text-xs font-medium border transition-colors ' + (rappelFilterDate === f.value ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-100')}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barre de recherche + filtres */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher nom, ville, SIRET..." className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm" />
          {isServerSearching && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 animate-spin" />}
          {searchResults && !isServerSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-purple-600 font-medium">tous étab.</span>}
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
        <button onClick={() => { loadProspects(); loadDailyStats(); loadTodayCallbacks(); loadDoNotCallCount() }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
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
                  {searchResults && p.siren && (() => {
                    const siblings = filtered.filter(s => s.siren === p.siren && s.id !== p.id)
                    if (siblings.length === 0) return null
                    const contacted = siblings.filter(s => s.contacted)
                    return <span className={`text-[10px] px-1.5 py-0.5 rounded ${contacted.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-purple-50 text-purple-600'}`}>
                      {siblings.length} autre(s) agence(s){contacted.length > 0 ? ` · ${contacted.length} contactée(s)` : ''}
                    </span>
                  })()}
                  {p.gere_par_city && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Géré par {p.gere_par_city}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3">
                {p.phone && <a href={'tel:' + p.phone.replace(/\s/g, '')} onClick={e => e.stopPropagation()} className="text-primary-600 text-sm">{p.phone}</a>}
                {emailSentMap[p.siren] && (() => {
                  const days = Math.floor((Date.now() - new Date(emailSentMap[p.siren].date).getTime()) / 86400000)
                  const isRelance = days >= 7 && emailSentMap[p.siren].template !== 'relance'
                  return <span title={days + 'j depuis email'} className={'text-xs ' + (isRelance ? 'text-orange-500' : 'text-green-500')}>{isRelance ? '✉️' : '✅✉'}</span>
                })()}
                <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (
                  p.prospection_status === 'rdv_pris' ? 'bg-green-100 text-green-700' :
                  p.prospection_status === 'a_rappeler' ? 'bg-amber-100 text-amber-700' :
                  p.prospection_status === 'pas_interesse' ? 'bg-gray-100 text-gray-500' :
                  p.prospection_status === 'numero_errone' ? 'bg-red-100 text-red-700' :
                  p.do_not_call ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'
                )}>{p.prospection_status === 'rdv_pris' ? '🔥 RDV' : p.prospection_status === 'a_rappeler' ? '🟡' : p.prospection_status === 'pas_interesse' ? '❄️' : p.prospection_status === 'numero_errone' ? '❌' : p.do_not_call ? '🚫' : '📞'}</span>
                {p.do_not_call && p.do_not_call_reason && statusFilter === 'ne_pas_rappeler' && (
                  <span className="text-[10px] text-red-500 truncate max-w-[150px]">{p.do_not_call_reason} — {p.do_not_call_by}</span>
                )}
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


              {/* ═══ ALERTE SITE GÉRÉ PAR UN AUTRE ═══ */}
              {current?.gere_par_city && (
                <div className="bg-indigo-50 border-2 border-indigo-400 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-indigo-800">
                    🏢 Ce site est géré par l'agence de {current.gere_par_city} — inutile d'appeler
                  </p>
                  <button onClick={() => unmarkGerePar(current.id)} className="text-[10px] text-indigo-600 hover:text-indigo-800 underline mt-1">
                    Remettre dans la file d'appel
                  </button>
                </div>
              )}

              {/* ═══ ALERTE GROUPE SIREN CONTACTÉ ═══ */}
              {(() => {
                const sirenOnly = duplicates.filter(d => d.reason?.includes('SIREN'))
                const hot = sirenOnly.filter(d => d.contacted && ['rdv_pris','a_rappeler'].includes(d.prospection_status) && !d.gere_par_id)
                if (hot.length === 0) return null
                const statusIcons = { rdv_pris: '✅ RDV pris', a_rappeler: '🔄 À rappeler' }
                return (
                  <div className="bg-green-50 border-2 border-green-400 rounded-lg px-3 py-2 animate-pulse">
                    <p className="text-xs font-bold text-green-800 mb-1">🔔 Établissement(s) du même groupe déjà contacté(s) :</p>
                    {hot.map((d, i) => (
                      <p key={i} className="text-xs text-green-700">
                        <span className="font-semibold">{d.name}</span> ({d.city}) — {statusIcons[d.prospection_status] || d.prospection_status}
                        {d.contacted_at && <span className="text-green-600"> le {new Date(d.contacted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
                        {d.prospection_notes && <span className="text-green-600 italic"> — {d.prospection_notes.substring(0, 80)}</span>}
                      </p>
                    ))}
                  </div>
                )
              })()}
              {(() => {
                const sirenOnly = duplicates.filter(d => d.reason?.includes('SIREN'))
                const cold = sirenOnly.filter(d => d.contacted && d.prospection_status === 'pas_interesse')
                const hot = sirenOnly.filter(d => d.contacted && ['rdv_pris','a_rappeler'].includes(d.prospection_status))
                if (cold.length === 0 || hot.length > 0) return null
                return (
                  <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-700">
                      ❄️ <span className="font-semibold">{cold[0].name}</span> ({cold[0].city}) — Pas intéressé
                      {cold[0].contacted_at && <span> le {new Date(cold[0].contacted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
                      {cold.length > 1 && <span> (+{cold.length - 1} autre{cold.length > 2 ? 's' : ''})</span>}
                    </p>
                  </div>
                )
              })()}

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

              {/* Mobile direct — toujours visible */}
              <div className="flex items-center gap-2 mt-1">
                <Smartphone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {editingMobile ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input type="tel" value={contactMobile} onChange={e => setContactMobile(e.target.value)}
                      autoFocus onKeyDown={e => { if (e.key === 'Enter') { saveMobileDirect(); setEditingMobile(false) }; if (e.key === 'Escape') setEditingMobile(false) }}
                      placeholder="06 00 00 00 00" className="flex-1 px-2 py-1 border rounded text-sm" />
                    <button onClick={() => { saveMobileDirect(); setEditingMobile(false) }} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingMobile(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : contactMobile ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <a href={'tel:' + contactMobile.replace(/\s/g, '')} className="text-sm text-primary-600 font-medium hover:underline">{contactMobile}</a>
                    <span className="text-xs text-gray-400">mobile</span>
                    <button onClick={() => setEditingMobile(true)} className="p-0.5 text-gray-300 hover:text-primary-600"><Edit2 className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <button onClick={() => setEditingMobile(true)} className="text-xs text-gray-400 hover:text-primary-600 transition-colors">
                    + Ajouter mobile direct
                  </button>
                )}
              </div>

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
                          <div key={call.id || i} className="text-xs bg-white/60 rounded p-2">
                            {editingCallId === call.id ? (
                              <div className="space-y-2">
                                <select value={editingCallResult} onChange={e => setEditingCallResult(e.target.value)}
                                  className="w-full px-2 py-1.5 border rounded text-xs">
                                  <option value="chaud">🔥 Intéressé</option><option value="tiede">🟡 Tiède</option><option value="froid">❄️ Refus</option>
                                  <option value="no_answer">📞 Injoignable</option><option value="blocked">⚠️ Barrage</option><option value="wrong_number">❌ N° erroné</option>
                                </select>
                                <textarea value={editingCallNotes} onChange={e => setEditingCallNotes(e.target.value)} rows="2"
                                  className="w-full px-2 py-1.5 border rounded text-xs" />
                                <div className="flex gap-1">
                                  <button onClick={() => handleEditCall(call.id)} className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs font-medium">✓ Sauvegarder</button>
                                  <button onClick={() => setEditingCallId(null)} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">Annuler</button>
                                  <button onClick={() => handleDeleteCall(call.id)} className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{call.called_by}</span>
                                  <span className="opacity-60">{new Date(call.called_at).toLocaleDateString('fr-FR')} {call.called_at ? new Date(call.called_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                  <span className={'px-1.5 py-0.5 rounded text-xs ' + (resultColors[call.call_result] || 'bg-gray-100')}>{resultLabels[call.call_result] || call.call_result}</span>
                                  <button onClick={() => { setEditingCallId(call.id); setEditingCallNotes(call.notes || ''); setEditingCallResult(call.call_result || '') }}
                                    className="ml-auto p-0.5 text-gray-400 hover:text-blue-600 rounded" title="Modifier"><Edit2 className="w-3 h-3" /></button>
                                </div>
                                {call.contact_name && <div className="mt-0.5 opacity-80">👤 {call.contact_name}{call.contact_function ? ' — ' + call.contact_function : ''}{call.contact_email ? ' • ' + call.contact_email : ''}</div>}
                                {call.notes && <div className="mt-0.5 opacity-90">{call.notes}</div>}
                                {call.formations_mentioned && call.formations_mentioned.length > 0 && <div className="mt-0.5 opacity-70">🎓 {call.formations_mentioned.join(', ')}</div>}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dialog changement de statut après edit/delete */}
                    {showStatusChangeDialog && (
                      <div className="mt-2 pt-2 border-t border-current/10">
                        <p className="text-xs font-medium text-gray-700 mb-2">📋 Mettre à jour le statut du prospect ?</p>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { value: 'a_appeler', label: '📞 À appeler' },
                            { value: 'a_rappeler', label: '🟡 À rappeler' },
                            { value: 'rdv_pris', label: '🔥 RDV pris' },
                            { value: 'redirige', label: '🏢 Redirigé' },
                            { value: 'pas_interesse', label: '❄️ Refus' },
                            { value: 'numero_errone', label: '❌ N° erroné' },
                          ].map(s => (
                            <button key={s.value} onClick={() => { handleUpdateProspectStatus(s.value); setShowStatusChangeDialog(false) }}
                              className={'px-2 py-1 rounded text-xs font-medium border transition-colors ' + (current?.prospection_status === s.value ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}>
                              {s.label}
                            </button>
                          ))}
                          <button onClick={() => setShowStatusChangeDialog(false)} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600">Garder tel quel</button>
                          {(callerName === 'Hicham' || callerName === 'Maxime') && (
                            <button onClick={() => { setShowStatusChangeDialog(false); setShowDoNotCallModal(true) }}
                              className="px-2 py-1 rounded text-xs font-medium border border-red-300 bg-red-50 text-red-700 hover:bg-red-100">
                              🚫 Ne pas rappeler
                            </button>
                          )}
                        </div>
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

              {/* Email — éditable + bouton envoyer */}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                    onBlur={async (e) => {
                      const val = e.target.value.trim()
                      if (val && val !== current.email && current.id) {
                        await supabase.from('prospection_massive').update({ email: val, updated_at: new Date().toISOString() }).eq('id', current.id)
                        current.email = val
                        setProspects(prev => prev.map(p => p.id === current.id ? { ...p, email: val } : p))
                      }
                    }}
                    placeholder="email@entreprise.fr"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <button onClick={() => openEmailModal(current, contactEmail ? 'suite_echange' : 'nrp', false)}
                  disabled={!contactEmail}
                  title="Envoyer un email"
                  className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <Send className="w-4 h-4" />
                </button>
              </div>
              {current.siren && emailSentMap[current.siren] && (() => {
                const em = emailSentMap[current.siren]
                const days = Math.floor((Date.now() - new Date(em.date).getTime()) / 86400000)
                const tplLabels = { suite_echange: 'Suite échange', nrp: 'NRP', relance: 'Relance' }
                return (
                  <div className="flex items-center gap-2 text-xs px-2">
                    <span className={days >= 7 && em.template !== 'relance' ? 'text-orange-500' : 'text-green-600'}>
                      {days >= 7 && em.template !== 'relance' ? '✉️' : '✅'} Email "{tplLabels[em.template] || em.template}" envoyé il y a {days === 0 ? "aujourd'hui" : days === 1 ? 'hier' : days + 'j'}
                    </span>
                    {days >= 7 && em.template !== 'relance' && (
                      <button onClick={() => openEmailModal(current, 'relance', false)} className="text-orange-600 hover:text-orange-800 font-medium underline">Relancer</button>
                    )}
                  </div>
                )
              })()}

              {/* Détecter OPCO */}
              {current.siret && !current.siret.startsWith('MANUAL_') && !current.opco_name && (
                <button onClick={autoDetectOpco} disabled={detectingOpco}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-indigo-700 text-xs font-medium transition-colors disabled:opacity-50">
                  {detectingOpco ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Détecter OPCO & adresse
                </button>
              )}

              {/* Doublons toggle + Gestion multi-établissements */}
              {duplicates.length > 0 && (() => {
                const sirenSiblings = duplicates.filter(d => d.reason?.includes('SIREN'))
                const otherDups = duplicates.filter(d => !d.reason?.includes('SIREN'))
                const manageable = sirenSiblings.filter(d => !d.gere_par_id)
                const managed = sirenSiblings.filter(d => d.gere_par_id)
                return (
                <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
                  <button type="button" onClick={() => setShowDuplicates(!showDuplicates)} className="flex items-center gap-2 text-amber-700 font-medium text-sm w-full">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Établissements du groupe ({sirenSiblings.length}){otherDups.length > 0 ? ` + ${otherDups.length} similaire(s)` : ''}</span>
                    <span className="ml-auto text-amber-500">{showDuplicates ? '▲' : '▼'}</span>
                  </button>
                  {showDuplicates && (
                    <div className="mt-2 pt-2 border-t border-amber-200 space-y-2">
                      {/* Agences du même SIREN */}
                      {sirenSiblings.length > 0 && (
                        <div>
                          {manageable.length > 1 && (
                            <div className="flex items-center gap-2 mb-2">
                              <button onClick={selectAllSiblings} className="text-[10px] text-purple-600 hover:text-purple-800 underline">
                                Tout sélectionner
                              </button>
                              {siblingSelections.size > 0 && (
                                <button onClick={() => markSiblingsAsGerePar([...siblingSelections], current)}
                                  className="text-[10px] px-2 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                                  ✓ Marquer {siblingSelections.size} agence(s) comme gérées par {current?.city}
                                </button>
                              )}
                            </div>
                          )}
                          <div className="space-y-1">
                            {sirenSiblings.map((d, i) => {
                              const sl = { rdv_pris: { icon: '✅ RDV', cls: 'bg-green-100 text-green-700' }, a_rappeler: { icon: '🔄 Rappeler', cls: 'bg-orange-100 text-orange-700' }, pas_interesse: { icon: '❌ Refus', cls: 'bg-red-100 text-red-700' }, numero_errone: { icon: '❌ Erroné', cls: 'bg-purple-100 text-purple-700' } }
                              const st = sl[d.prospection_status] || { icon: d.contacted ? '📞' : '⬜', cls: 'bg-gray-100 text-gray-600' }
                              const isManaged = !!d.gere_par_id
                              return (
                                <div key={i} className={`text-xs flex items-center gap-1.5 py-1 px-1.5 rounded ${isManaged ? 'bg-indigo-50' : 'hover:bg-amber-100'}`}>
                                  {!isManaged && manageable.length > 1 && (
                                    <input type="checkbox" checked={siblingSelections.has(d.id)}
                                      onChange={() => toggleSiblingSelection(d.id)}
                                      className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer" />
                                  )}
                                  <span className="font-semibold text-gray-900 truncate max-w-[180px]">{d.name}</span>
                                  <span className="text-gray-500">({d.city})</span>
                                  {d.siret && <span className="text-[10px] text-gray-400 font-mono">{d.siret.slice(-5)}</span>}
                                  <span className={'px-1 py-0.5 rounded text-[10px] font-medium ' + st.cls}>{st.icon}</span>
                                  {isManaged ? (
                                    <span className="flex items-center gap-1">
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Géré par {d.gere_par_city}</span>
                                      <button onClick={() => unmarkGerePar(d.id)} className="text-[10px] text-red-400 hover:text-red-600" title="Remettre dans la file">✕</button>
                                    </span>
                                  ) : (
                                    <>
                                      {d.contacted_at && <span className="text-amber-500">{new Date(d.contacted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
                                      {d.prospection_notes && <span className="text-amber-500 italic truncate max-w-[100px]">{d.prospection_notes}</span>}
                                      <button onClick={() => { if (window.confirm(`Désigner ${d.city || d.name} comme agence centrale ?\n\nToutes les autres agences seront marquées "géré par ${d.city || d.name}".`)) designateCentralOffice(d) }}
                                        className="ml-auto text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 whitespace-nowrap flex-shrink-0"
                                        title={`Désigner ${d.city || d.name} comme agence qui centralise`}>
                                        🏢 C'est eux
                                      </button>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {/* Autres similaires (même tel, email, site) */}
                      {otherDups.length > 0 && (
                        <div className="pt-1 border-t border-amber-200">
                          <p className="text-[10px] text-amber-600 font-medium mb-1">Autres similaires :</p>
                          {otherDups.map((d, i) => (
                            <div key={`o${i}`} className="text-xs text-amber-800 flex items-center gap-1.5 py-0.5">
                              <span className="font-semibold">{d.name}</span>
                              <span className="text-amber-600">({d.city})</span>
                              <span className="text-[10px] text-gray-400">{d.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )})()}


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

              {/* Bandeau fiche active — toujours visible */}
              <div className="bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 flex items-center gap-2 sticky top-0 z-10">
                <Phone className="w-4 h-4 text-primary-600" />
                <span className="font-bold text-primary-900 text-sm truncate">{current.name}</span>
                {current.city && <span className="text-xs text-primary-600">— {current.city}</span>}
                <span className="ml-auto text-xs text-primary-400">{filtered.findIndex(p => p.id === current.id) + 1}/{filtered.length}</span>
              </div>

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
                    <button onClick={() => { setWrongNumberNew(''); setPhoningStep('wrong_number') }} disabled={saving}
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
                    <button onClick={() => { setNrpMessageLaisse(false); const d = new Date(); d.setDate(d.getDate() + 1); setNrpCallbackDate(d.toISOString().split('T')[0]); setNrpCallbackTime('09:00'); setPhoningStep('nrp_callback') }} disabled={saving}
                      className="flex flex-col items-center gap-2 px-4 py-5 bg-gray-50 hover:bg-gray-100 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold transition-all disabled:opacity-50">
                      <PhoneOff className="w-6 h-6" />
                      <span className="text-sm">Pas de réponse</span>
                      <span className="text-xs text-gray-400 font-normal">Sonnerie / occupé</span>
                    </button>
                    <button onClick={() => { setNrpMessageLaisse(true); const d = new Date(); d.setDate(d.getDate() + 2); setNrpCallbackDate(d.toISOString().split('T')[0]); setNrpCallbackTime('14:00'); setPhoningStep('nrp_callback') }} disabled={saving}
                      className="flex flex-col items-center gap-2 px-4 py-5 bg-blue-50 hover:bg-blue-100 border-2 border-blue-300 rounded-xl text-blue-700 font-semibold transition-all disabled:opacity-50">
                      <MessageSquare className="w-6 h-6" />
                      <span className="text-sm">Message laissé</span>
                      <span className="text-xs text-blue-400 font-normal">Répondeur</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ ÉTAPE : NRP — Programmer rappel ═══ */}
              {phoningStep === 'nrp_callback' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPhoningStep('no_response')} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
                    <h3 className="font-semibold text-gray-700 text-sm">{nrpMessageLaisse ? '📨 Message laissé' : '📵 Pas de réponse'} — Rappel</h3>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-3 space-y-3">
                    <h4 className="font-semibold text-gray-900 text-sm">🔔 Quand rappeler ?</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '☀️ Demain 9h', days: 1, time: '09:00' },
                        { label: '📅 Dans 2j 14h', days: 2, time: '14:00' },
                        { label: '📆 Lundi 9h', days: 0, time: '09:00', getDate: () => { const d = new Date(); d.setDate(d.getDate() + (8 - d.getDay()) % 7 || 7); return d.toISOString().split('T')[0] } },
                      ].map(opt => {
                        const val = opt.getDate ? opt.getDate() : (() => { const d = new Date(); d.setDate(d.getDate() + opt.days); return d.toISOString().split('T')[0] })()
                        const isSelected = nrpCallbackDate === val && nrpCallbackTime === opt.time
                        return (
                          <button key={opt.label} type="button" onClick={() => { setNrpCallbackDate(val); setNrpCallbackTime(opt.time) }}
                            className={'px-2 py-2.5 rounded-lg border text-xs font-medium transition-colors ' + (isSelected ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={nrpCallbackDate} onChange={e => setNrpCallbackDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border rounded-lg text-sm bg-white" />
                      <input type="time" value={nrpCallbackTime} onChange={e => setNrpCallbackTime(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white" />
                    </div>
                  </div>

                  <button onClick={() => handleNoResponse(nrpMessageLaisse, nrpCallbackDate, nrpCallbackTime)} disabled={saving || !nrpCallbackDate}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 font-semibold text-sm">
                    {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Enregistrement...</> : <><Bell className="w-5 h-5" /> Programmer rappel & Suivant</>}
                  </button>
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

                  {/* Notes de l'appel */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Notes de l'appel</span>
                      <SpeechToTextButton onTranscript={(text) => setNotes(n => n ? n + ' ' + text : text)} compact />
                    </div>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes de l'échange (optionnel)..." rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
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
                      <span className="text-xl">👋</span>
                      <span className="text-sm">Passer la main</span>
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
                  <div>
                    <div className="flex items-center justify-end mb-1">
                      <SpeechToTextButton onTranscript={(text) => setNotes(n => n ? n + ' ' + text : text)} compact />
                    </div>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>

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

                  <div>
                    <div className="flex items-center justify-end mb-1">
                      <SpeechToTextButton onTranscript={(text) => setNotes(n => n ? n + ' ' + text : text)} compact />
                    </div>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (ce qui a été dit, ce qu'il faut préparer...)" rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                  </div>

                  {/* Rappel */}
                  <div className="bg-orange-50 rounded-lg p-3 space-y-2">
                    <h4 className="font-semibold text-gray-900 text-sm">🔔 Programmer rappel</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Demain', days: 1 },
                        { label: 'Dans 3j', days: 3 },
                        { label: 'Sem. pro', days: 7 },
                        { label: 'Précis...', days: 0 },
                      ].map(opt => {
                        const d = new Date(); d.setDate(d.getDate() + opt.days)
                        const val = opt.days > 0 ? d.toISOString().split('T')[0] : ''
                        const isSelected = opt.days > 0 ? callbackDate === val : (callbackDate && ![1,3,7].some(n => { const dd = new Date(); dd.setDate(dd.getDate() + n); return callbackDate === dd.toISOString().split('T')[0] }))
                        return (
                          <button key={opt.label} type="button" onClick={() => { if (opt.days > 0) setCallbackDate(val); else document.getElementById('cb-date-precise')?.showPicker?.() }}
                            className={'px-2 py-2 rounded-lg border text-xs font-medium transition-colors ' + (isSelected ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input id="cb-date-precise" type="date" value={callbackDate} onChange={e => setCallbackDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border rounded-lg text-sm bg-white" />
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

              {/* ═══ ÉTAPE : Passer la main — Raison + email ═══ */}
              {phoningStep === 'transfer' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPhoningStep('responded')} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
                    <h3 className="font-semibold text-indigo-700 text-sm">👋 Passer la main — {current.name}</h3>
                    {current.distance < 9999 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{current.latitude && distanceKm(current.latitude, current.longitude, BASES.concarneau.lat, BASES.concarneau.lng) < distanceKm(current.latitude, current.longitude, BASES.derval.lat, BASES.derval.lng) ? '📍 Zone Hicham' : '📍 Zone Maxime'} — {current.distance.toFixed(0)} km</span>}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pourquoi ?</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {['🏢 Renvoie vers le siège', '👨‍🏫 Veut parler au formateur', '🤷 Secteur géo ou formation inconnue', '❓ Question spécifique', '📝 Autre'].map(r => (
                        <button key={r} onClick={() => setTransferReason(r)}
                          className={'px-3 py-2 rounded-lg border text-sm font-medium transition-colors ' + (transferReason === r ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-end mb-1">
                      <SpeechToTextButton onTranscript={(text) => setTransferNote(n => n ? n + ' ' + text : text)} compact />
                    </div>
                    <textarea value={transferNote} onChange={e => setTransferNote(e.target.value)} placeholder="Précisions (ce qu'il a dit, numéro siège, nom du contact...)" rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  {transferReason && !transferNote.trim() && <p className="text-xs text-red-500">⚠️ Précise dans le champ ci-dessus</p>}

                  <button onClick={handleTransfer} disabled={saving || !transferReason || !transferNote.trim()}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-semibold text-sm">
                    {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Envoi...</> : <><Send className="w-5 h-5" /> Passer la main & Suivant</>}
                  </button>
                </div>
              )}


              {/* ═══ ÉTAPE : Numéro erroné ═══ */}
              {phoningStep === 'wrong_number' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPhoningStep('initial')} className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
                    <h3 className="font-semibold text-red-700 text-sm">❌ Numéro erroné — {current.name}</h3>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700 mb-2">Nouveau numéro trouvé ?</p>
                    <input type="tel" value={wrongNumberNew} onChange={e => setWrongNumberNew(e.target.value)}
                      placeholder="Ex: 02 98 12 34 56"
                      className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent" />
                    {wrongNumberNew.trim().length > 0 && wrongNumberNew.trim().length < 6 && (
                      <p className="text-xs text-red-500 mt-1">Numéro trop court</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleWrongNumber} disabled={saving || (wrongNumberNew.trim().length > 0 && wrongNumberNew.trim().length < 6)}
                      className={'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 ' + (wrongNumberNew.trim().length >= 6 ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700')}>
                      {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</> : wrongNumberNew.trim().length >= 6 ? <><Phone className="w-4 h-4" /> Enregistrer & remettre dans la file</> : <><XCircle className="w-4 h-4" /> Marquer erroné & suivant</>}
                    </button>
                    <button onClick={() => setPhoningStep('initial')}
                      className="w-full px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-200">
                      Annuler
                    </button>
                  </div>
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
                        { tag: 'Autre', icon: '📝' },
                      ].map(({ tag, icon }) => (
                        <button key={tag} onClick={() => { setNotInterestedTag(tag); if (tag !== 'Autre') setNotInterestedCustom('') }}
                          className={'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ' + (notInterestedTag === tag ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}>
                          <span>{icon}</span><span>{tag}</span>
                        </button>
                      ))}
                      {notInterestedTag === 'Autre' && (
                        <input type="text" value={notInterestedCustom} onChange={e => setNotInterestedCustom(e.target.value)} placeholder="Précisez le motif (obligatoire)..."
                          autoFocus className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-orange-50" />
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-end mb-1">
                      <SpeechToTextButton onTranscript={(text) => setNotes(n => n ? n + ' ' + text : text)} compact />
                    </div>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes complémentaires (optionnel)" rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>

                  <button onClick={() => handleNotInterested(notInterestedTag === 'Autre' ? notInterestedCustom : notInterestedTag)} disabled={saving || !notInterestedTag || (notInterestedTag === 'Autre' && !notInterestedCustom.trim())}
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
      {/* ═══ EMAIL MODAL ═══ */}
      {/* ═══ MODALE APPELS DU JOUR ═══ */}
      {showTodayCalls && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTodayCalls(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Appels du jour — {todayCalls.length} appels</h3>
              <button onClick={() => setShowTodayCalls(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto max-h-[65vh] divide-y">
              {todayCalls.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Aucun appel aujourd'hui</p>
              ) : todayCalls.map(call => {
                const rc = { chaud: 'bg-green-100 text-green-700', tiede: 'bg-orange-100 text-orange-700', froid: 'bg-blue-100 text-blue-700', no_answer: 'bg-gray-100 text-gray-600', blocked: 'bg-red-100 text-red-700', wrong_number: 'bg-purple-100 text-purple-700' }
                const rl = { chaud: '🔥 Intéressé', tiede: '🟡 Tiède', froid: '❄️ Refus', no_answer: '📞 Injoignable', blocked: '⚠️ Barrage', wrong_number: '❌ N° erroné' }
                return (
                  <div key={call.id} onClick={() => {
                    const prospect = prospects.find(p => p.siren === call.clients?.siren)
                    if (prospect) { selectProspect(prospect); setViewMode('file'); setShowTodayCalls(false) }
                    else toast.error('Prospect non trouvé dans la liste filtrée')
                  }} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">{call.clients?.name || '?'}</span>
                        <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (rc[call.call_result] || 'bg-gray-100')}>{rl[call.call_result] || call.call_result}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span>{call.called_by}</span>
                        <span>{new Date(call.called_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        {call.contact_name && <span>👤 {call.contact_name}</span>}
                        {call.formations_mentioned && call.formations_mentioned.length > 0 && <span>🎓 {call.formations_mentioned.join(', ')}</span>}
                      </div>
                      {call.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{call.notes}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-lg">Email prospect</h3>
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{callerName}</span>
              </div>
              <button onClick={handleSkipEmail} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {/* Template selector */}
              <div className="flex gap-2">
                {[
                  { id: 'suite_echange', label: '😊 Suite echange' },
                  { id: 'nrp', label: '📨 NRP' },
                  { id: 'relance', label: '🔄 Relance' },
                ].map(t => (
                  <button key={t.id} onClick={() => {
                    setEmailTemplate(t.id)
                    const tpl = EMAIL_TEMPLATES[t.id]
                    setEmailSubject(tpl.subject(current?.name))
                    setEmailBody(tpl.body(current?.name, contactName))
                    setTemplateVersion(v => v + 1)
                  }} className={'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ' +
                    (emailTemplate === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50')}>
                    {t.label}
                  </button>
                ))}
              </div>
              {/* To */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Destinataire</label>
                <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)}
                  placeholder="email@entreprise.fr"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              {/* Subject */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Objet</label>
                <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              {/* Body with IA button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500">Message</label>
                  <button onClick={handleAdaptWithAI} disabled={emailAdaptLoading}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50">
                    {emailAdaptLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Adapter avec IA
                  </button>
                </div>
                <div key={'email-body-' + templateVersion} contentEditable suppressContentEditableWarning
                  onBlur={e => setEmailBody(e.currentTarget.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: emailBody }}
                  className="w-full border rounded-lg px-3 py-2 text-sm min-h-[200px] max-h-[350px] overflow-y-auto focus:ring-2 focus:ring-blue-500 focus:outline-none prose prose-sm"
                />
              </div>
              {/* ═══ PIÈCES JOINTES (fixes) ═══ */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <Paperclip className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-blue-700 font-medium">2 pièces jointes</span>
                <span className="text-[10px] text-blue-500">Présentation + Programmes</span>
              </div>
              {/* Signature preview */}
              <div className="bg-gray-50 rounded-lg p-3 border">
                <p className="text-xs text-gray-400 mb-1">Signature ({callerName})</p>
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-[#1a3a4a] to-[#2d5a6b] px-3 py-2 rounded-lg">
                    <span className="text-[#d4a84b] font-serif italic text-sm">{callerName}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    <p className="font-semibold text-gray-700">ACCESS FORMATION</p>
                    <p>{callerName === 'Hicham' ? '06.35.20.04.28' : callerName === 'Maxime' ? '07.83.51.17.95' : '02 46 56 57 54'}</p>
                    <p>www.accessformation.pro</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center justify-between p-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={handleSkipEmail} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                Passer sans email
              </button>
              <div className="flex gap-2">
                <button onClick={handleSendEmail} disabled={emailSending || !emailTo}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {emailSending ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODALE NE PAS RAPPELER ═══ */}
      {showDoNotCallModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">🚫 Ne pas rappeler</h3>
              <p className="text-sm text-gray-500 mb-4">{current?.name} — {current?.city}</p>

              <label className="block text-sm font-medium text-gray-700 mb-2">Motif (obligatoire)</label>
              <select value={doNotCallReason} onChange={e => setDoNotCallReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm">
                <option value="">— Choisir un motif —</option>
                <option value="Demande explicite du prospect">Demande explicite du prospect</option>
                <option value="Entreprise fermée / en liquidation">Entreprise fermée / en liquidation</option>
                <option value="Hors cible (secteur/taille/zone)">Hors cible (secteur/taille/zone)</option>
                <option value="Doublon confirmé">Doublon confirmé</option>
                <option value="Interlocuteur agressif / hostile">Interlocuteur agressif / hostile</option>
                <option value="autre">Autre (préciser)</option>
              </select>

              {doNotCallReason === 'autre' && (
                <input type="text" value={doNotCallCustom} onChange={e => setDoNotCallCustom(e.target.value)}
                  placeholder="Précisez le motif..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm" autoFocus />
              )}

              <div className="flex gap-3 mt-4">
                <button onClick={() => { setShowDoNotCallModal(false); setDoNotCallReason(''); setDoNotCallCustom('') }}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700">
                  Annuler
                </button>
                <button onClick={handleDoNotCall}
                  disabled={!doNotCallReason || (doNotCallReason === 'autre' && !doNotCallCustom.trim())}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                  🚫 Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
