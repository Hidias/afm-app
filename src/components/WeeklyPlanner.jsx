// ═══════════════════════════════════════════════════════════════
// WeeklyPlanner.jsx — Planning semaine v5
// + Ajout RDV commerciaux depuis le calendrier
// + Drag & drop RDV / Rappels / Tâches entre jours
// + Encart prospects à compléter
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Plus, X, Phone, Send,
  Calendar, Clock, AlertTriangle,
  Loader2, Flame, Check, UserPlus,
  TrendingUp, Zap, Info, ExternalLink, Search, Building2,
  GripVertical, User
} from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useRelanceIA } from '../lib/useRelanceIA'

// ─── Constantes ──────────────────────────────────────────
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const SLOT_TYPES = {
  session:   { label: 'Formation', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', emoji: '🎓' },
  rdv:       { label: 'RDV',       color: 'bg-green-100 text-green-800', dot: 'bg-green-500', emoji: '🤝' },
  callback:  { label: 'Rappel',    color: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', emoji: '📞' },
  relance:   { label: 'Relance',   color: 'bg-red-100 text-red-800', dot: 'bg-red-500', emoji: '💰' },
  indispo:   { label: 'Indispo',   color: 'bg-red-50 text-red-600', dot: 'bg-red-400', emoji: '🔒' },
  task:      { label: 'Tâche',     color: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500', emoji: '✅' },
  adm:       { label: 'ADM',       color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', emoji: '📋' },
  phoning_manual: { label: 'Phoning', color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500', emoji: '📞' },
}

const CALL_RESULTS = [
  { id: 'chaud',        label: '🔥 Intéressé',     sublabel: 'Veut un RDV',  color: 'bg-green-100 border-green-400 text-green-700' },
  { id: 'tiede',        label: '🟡 Tiède',         sublabel: 'À rappeler',   color: 'bg-amber-100 border-amber-400 text-amber-700' },
  { id: 'froid',        label: '❄️ Pas intéressé', sublabel: 'Archiver',     color: 'bg-blue-100 border-blue-400 text-blue-700' },
  { id: 'no_answer',    label: '📞 Pas de réponse', sublabel: 'Répondeur',  color: 'bg-gray-100 border-gray-300 text-gray-600' },
  { id: 'blocked',      label: '⚠️ Barrage',       sublabel: 'Secrétariat',  color: 'bg-red-100 border-red-300 text-red-600' },
  { id: 'wrong_number', label: '❌ Faux numéro',   sublabel: 'Supprimer',    color: 'bg-purple-100 border-purple-300 text-purple-600' },
]

const FORMATIONS = [
  'SST / MAC SST', 'Initiation gestes de premiers secours (4h+)',
  'Gestes & Postures / TMS', 'Incendie (EPI, extincteurs, évacuation)',
  'Habilitation électrique B0/H0V', 'Conduite chariot élévateur R489',
  'Conduite gerbeur R485', 'DUERP (Document Unique)', 'Formation sur mesure',
]

const RDV_TYPES = [
  { value: 'decouverte', label: '🤝 Découverte' },
  { value: 'telephone', label: '📞 Téléphone' },
  { value: 'visio', label: '💻 Visio' },
  { value: 'sur_place', label: '📍 Sur place' },
  { value: 'relance', label: '🔄 Relance' },
]

// ─── Helpers ─────────────────────────────────────────────
const fmtTime = (t) => t ? t.slice(0, 5) : ''
const normalizeClientName = (name) => (name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase()
const futureDate = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return format(d, 'yyyy-MM-dd') }
const nextWorkday = (dateStr) => {
  let d = new Date(dateStr)
  do { d.setDate(d.getDate() + 1) } while (d.getDay() === 0 || d.getDay() === 6)
  return format(d, 'yyyy-MM-dd')
}
const timeToMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
const overlap = (aStart, aEnd, bStart, bEnd) => {
  const a0 = timeToMin(aStart), a1 = timeToMin(aEnd), b0 = timeToMin(bStart), b1 = timeToMin(bEnd)
  return a0 < b1 && b0 < a1
}
const addMinutesToTime = (t, mins) => {
  const total = timeToMin(t) + mins
  const clamped = Math.min(total, 1080)
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function WeeklyPlanner() {
  const { user } = useAuthStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  // Data
  const [sessions, setSessions] = useState([])
  const [rdvs, setRdvs] = useState([])
  const [callbacks, setCallbacks] = useState([])
  const [devisRelance, setDevisRelance] = useState([])
  const [planningEvents, setPlanningEvents] = useState([])
  const [incompleteProspects, setIncompleteProspects] = useState([])

  // Stats
  const [todayCallCount, setTodayCallCount] = useState(0)
  const [weekCallStats, setWeekCallStats] = useState({ total: 0, chaud: 0, tiede: 0, rdv: 0 })

  // UI — Modal ajout événement
  const [showAddModal, setShowAddModal] = useState(false)
  const [addDate, setAddDate] = useState(null)
  const [addForm, setAddForm] = useState({ event_type: 'indispo', title: '', start_time: '09:00', end_time: '12:00', description: '' })
  const [relanceSending, setRelanceSending] = useState(null)
  const { relanceQuote, generating: relanceGenerating, previewData, confirmSend, cancelPreview } = useRelanceIA()
  const [relanceEdit, setRelanceEdit] = useState({ subject: '', body: '' })
  const [relanceConfirmed, setRelanceConfirmed] = useState(false)
  const [addConflicts, setAddConflicts] = useState([])
  const [expandedDay, setExpandedDay] = useState(null)

  // UI — Modal ajout RDV
  const [showRdvModal, setShowRdvModal] = useState(false)
  const [rdvDate, setRdvDate] = useState(null)
  const [rdvMode, setRdvMode] = useState('existing') // 'existing' | 'new'
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientContacts, setClientContacts] = useState([])
  const [rdvForm, setRdvForm] = useState({
    rdv_time: '14:00', rdv_type: 'decouverte', contact_id: null,
    contact_name: '', notes: '', formations_interet: [],
    new_company: '', new_contact_name: '', new_phone: '', new_email: '',
  })
  const [rdvSaving, setRdvSaving] = useState(false)
  const searchTimeoutRef = useRef(null)
  const gridRef = useRef(null)

  // UI — Édition RDV (réutilise rdvForm + rdvModal en mode edit)
  const [editRdvId, setEditRdvId] = useState(null) // null = création, uuid = édition

  // UI — Édition callback
  const [showEditCallbackModal, setShowEditCallbackModal] = useState(false)
  const [editCallbackId, setEditCallbackId] = useState(null)
  const [editCallbackForm, setEditCallbackForm] = useState({ callback_date: '', callback_time: '', notes: '' })

  // UI — Édition planning event (réutilise addModal + addForm, editEventId != null = mode edit)
  const [editEventId, setEditEventId] = useState(null)

  // UI — Drag & Drop (desktop) + Tap-to-move (touch/iPad)
  const [dragItem, setDragItem] = useState(null)
  const [dragOverDay, setDragOverDay] = useState(null)
  const [tapSelected, setTapSelected] = useState(null) // {event} sélectionné par tap pour déplacement tactile

  // ─── Calcul des dates ───────────────────────────────────
  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 })
    return weekOffset === 0 ? base : addWeeks(base, weekOffset)
  }, [weekOffset])

  const weekDates = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 5)
    return `${format(weekStart, 'd', { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`
  }, [weekStart])

  // ─── Chargement des données ─────────────────────────────
  const loadWeekData = useCallback(async () => {
    setLoading(true)
    const startStr = format(weekStart, 'yyyy-MM-dd')
    const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    try {
      const [sessR, rdvR, cbR, devisR, evtR, prospectsR] = await Promise.all([
        supabase.from('sessions')
          .select('id, reference, start_date, end_date, start_time, end_time, location_city, status, trainer_id, courses(title), clients(name), trainers(first_name, last_name)')
          .gte('start_date', startStr).lte('start_date', endStr)
          .neq('status', 'cancelled'),
        supabase.from('prospect_rdv')
          .select('id, rdv_date, rdv_time, contact_name, conducted_by, status, temperature, notes, formations_interet, rdv_type, client_id, clients(name)')
          .gte('rdv_date', startStr).lte('rdv_date', endStr)
          .eq('conducted_by', 'Hicham')
          .in('status', ['a_prendre', 'prevu', 'planifie']),
        supabase.from('prospect_calls')
          .select('id, callback_date, callback_time, called_by, contact_name, call_result, notes, client_id, clients(name, siren)')
          .eq('needs_callback', true).eq('called_by', 'Hicham')
          .gte('callback_date', startStr).lte('callback_date', endStr)
          .order('callback_date').order('callback_time'),
        supabase.from('quotes')
          .select('id, reference, quote_date, total_ht, status, client_id, notes, relance_count, last_relance_date, clients(name, contact_phone, contact_email)')
          .eq('status', 'sent').order('quote_date'),
        supabase.from('user_planning_events')
          .select('*').eq('user_id', user?.id)
          .gte('event_date', startStr).lte('event_date', endStr),
        // Prospects à compléter (status = 'a_completer', quel que soit le type)
        supabase.from('clients')
          .select('id, name, city, contact_phone, contact_email, siret, created_at')
          .eq('status', 'a_completer')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      // Sessions Hicham uniquement
      const hichamSessions = (sessR.data || []).filter(s => {
        const name = s.trainers ? `${s.trainers.first_name || ''} ${s.trainers.last_name || ''}`.toLowerCase().trim() : ''
        return name.includes('hicham') || name === '' || !s.trainers
      })
      setSessions(hichamSessions)

      const rdvData = rdvR.data || []
      setRdvs(rdvData)
      setPlanningEvents(evtR.data || [])
      setIncompleteProspects(prospectsR.data || [])

      // Callbacks dédupliqués avec RDV
      const rdvClientIds = new Set(rdvData.map(r => r.client_id).filter(Boolean))
      const rdvClientNames = new Set(rdvData.map(r => normalizeClientName(r.clients?.name)).filter(n => n))
      setCallbacks((cbR.data || []).filter(c => {
        if (c.client_id && rdvClientIds.has(c.client_id)) return false
        if (c.clients?.name && rdvClientNames.has(normalizeClientName(c.clients?.name))) return false
        return true
      }))

      // Devis à relancer : > 7 jours ET pas relancé depuis 7 jours
      const today = new Date()
      setDevisRelance((devisR.data || []).filter(q => {
        const daysSince = Math.floor((today - new Date(q.quote_date)) / 86400000)
        if (daysSince < 7) return false
        if (q.last_relance_date) {
          const daysSinceRelance = Math.floor((today - new Date(q.last_relance_date)) / 86400000)
          if (daysSinceRelance < 7) return false
        }
        return true
      }).map(q => ({
        ...q,
        daysSince: Math.floor((today - new Date(q.quote_date)) / 86400000),
      })))

      await loadCallStats()
    } catch (err) { console.error('WeeklyPlanner load error:', err) }
    finally { setLoading(false) }
  }, [weekStart, user?.id])

  useEffect(() => { if (user?.id) loadWeekData() }, [loadWeekData, user?.id])

  // ─── Stats appels ─────────────────────────────────────
  const loadCallStats = async () => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const weekStartStr = format(weekStart, 'yyyy-MM-dd')
      const weekEndStr = format(addDays(weekStart, 5), 'yyyy-MM-dd')

      const { count: todayCount } = await supabase.from('prospect_calls')
        .select('id', { count: 'exact', head: true })
        .eq('called_by', 'Hicham')
        .gte('called_at', todayStr + 'T00:00:00')
        .lte('called_at', todayStr + 'T23:59:59')
      setTodayCallCount(todayCount || 0)

      const { data: weekCalls } = await supabase.from('prospect_calls')
        .select('call_result, rdv_created')
        .eq('called_by', 'Hicham')
        .gte('called_at', weekStartStr + 'T00:00:00')
        .lte('called_at', weekEndStr + 'T23:59:59')

      if (weekCalls) {
        setWeekCallStats({
          total: weekCalls.length,
          chaud: weekCalls.filter(c => c.call_result === 'chaud').length,
          tiede: weekCalls.filter(c => c.call_result === 'tiede').length,
          rdv: weekCalls.filter(c => c.rdv_created).length,
        })
      }
    } catch (err) { console.error('Call stats error:', err) }
  }

  // ─── Construire événements par jour ─────────────────────
  const dayEvents = useMemo(() => {
    const result = {}
    weekDates.forEach((date) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const events = []

      sessions.filter(s => dateStr >= s.start_date && dateStr <= (s.end_date || s.start_date)).forEach(s => {
        events.push({
          id: `ses-${s.id}`, type: 'session',
          title: s.courses?.title || 'Formation',
          subtitle: s.clients?.name || '',
          time: `${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}`,
          startTime: s.start_time, endTime: s.end_time,
          location: s.location_city || '',
          link: `/sessions/${s.id}`,
          draggable: false,
        })
      })

      rdvs.filter(r => r.rdv_date === dateStr).forEach(r => {
        events.push({
          id: `rdv-${r.id}`, type: 'rdv', dbId: r.id,
          title: r.clients?.name || 'RDV',
          subtitle: r.contact_name ? `👤 ${r.contact_name}` : '',
          time: r.rdv_time ? fmtTime(r.rdv_time) : 'Heure à définir',
          startTime: r.rdv_time || null, endTime: r.rdv_time ? addMinutesToTime(r.rdv_time, 60) : null,
          temperature: r.temperature,
          formations: r.formations_interet,
          link: `/prospection`,
          draggable: true,
          dragType: 'rdv',
          dragDate: r.rdv_date,
        })
      })

      callbacks.filter(c => c.callback_date === dateStr).forEach(c => {
        events.push({
          id: `cb-${c.id}`, type: 'callback', dbId: c.id,
          title: c.clients?.name || 'Rappel',
          subtitle: c.contact_name ? `👤 ${c.contact_name}` : '',
          time: c.callback_time ? fmtTime(c.callback_time) : '',
          startTime: c.callback_time || null, endTime: c.callback_time ? addMinutesToTime(c.callback_time, 15) : null,
          notes: c.notes,
          callId: c.id,
          draggable: true,
          dragType: 'callback',
          dragDate: c.callback_date,
        })
      })

      planningEvents.filter(e => e.event_date === dateStr).forEach(e => {
        const isDraggable = ['task', 'adm', 'phoning_manual'].includes(e.event_type)
        events.push({
          id: `evt-${e.id}`, type: e.event_type, dbId: e.id,
          title: e.title,
          subtitle: e.description || '',
          time: `${fmtTime(e.start_time)} – ${fmtTime(e.end_time)}`,
          startTime: e.start_time, endTime: e.end_time,
          eventId: e.id,
          draggable: isDraggable,
          dragType: 'event',
          dragDate: e.event_date,
        })
      })

      events.sort((a, b) => {
        const priority = { session: 0, rdv: 1, callback: 2, indispo: 0 }
        return (priority[a.type] ?? 3) - (priority[b.type] ?? 3)
      })
      result[dateStr] = events
    })
    return result
  }, [weekDates, sessions, rdvs, callbacks, planningEvents])

  // ─── Stats semaine ──────────────────────────────────────
  const weekStats = useMemo(() => {
    let totalSessions = 0, totalRdv = 0, totalCallbacks = 0
    weekDates.forEach((date) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const events = dayEvents[dateStr] || []
      totalSessions += events.filter(e => e.type === 'session').length
      totalRdv += events.filter(e => e.type === 'rdv').length
      totalCallbacks += events.filter(e => e.type === 'callback').length
    })
    const caRelance = devisRelance.reduce((s, q) => s + (parseFloat(q.total_ht) || 0), 0)
    return { totalSessions, totalRdv, totalCallbacks, totalRelances: devisRelance.length, caRelance }
  }, [weekDates, dayEvents, devisRelance])

  // ─── Plage horaire dynamique (après dayEvents) ───────────
  const { gridStartH, gridEndH } = useMemo(() => {
    let minH = 6, maxH = 19
    Object.values(dayEvents).flat().forEach(evt => {
      if (evt.startTime) {
        const h = Math.floor(timeToMin(evt.startTime) / 60)
        if (h < minH) minH = Math.max(0, h - 1)
      }
      if (evt.endTime) {
        const h = Math.ceil(timeToMin(evt.endTime) / 60)
        if (h > maxH) maxH = Math.min(25, h + 1)
      }
    })
    return { gridStartH: minH, gridEndH: maxH }
  }, [dayEvents])

  // ─── Assignation colonnes pour chevauchements ────────────
  function assignEventColumns(events) {
    const timed = events.filter(e => e.startTime)
    if (!timed.length) return {}
    const sorted = [...timed].sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime))
    const result = {}
    const colEnds = []
    for (const evt of sorted) {
      const startMin = timeToMin(evt.startTime)
      const endMin = timeToMin(evt.endTime || addMinutesToTime(evt.startTime, 30))
      let colIdx = colEnds.findIndex(end => end <= startMin)
      if (colIdx === -1) { colIdx = colEnds.length; colEnds.push(endMin) }
      else { colEnds[colIdx] = endMin }
      result[evt.id] = { colIdx, numCols: 1 }
    }
    const numCols = Math.max(1, colEnds.length)
    Object.values(result).forEach(r => { r.numCols = numCols })
    return result
  }

  // ─── Scroll auto vers heure courante ────────────────────
  useEffect(() => {
    if (!gridRef.current || weekOffset !== 0 || loading) return
    const HOUR_PX = 60
    const now = new Date()
    const scrollTo = (now.getHours() + now.getMinutes() / 60 - gridStartH) * HOUR_PX - 120
    gridRef.current.scrollTop = Math.max(0, scrollTo)
  }, [gridStartH, weekOffset, loading])

  // ─── Détection conflits quand on ouvre la modal ajout ───
  useEffect(() => {
    if (!showAddModal || !addDate || addForm.event_type !== 'indispo') { setAddConflicts([]); return }
    const dateStr = format(addDate, 'yyyy-MM-dd')
    const events = dayEvents[dateStr] || []
    const conflicts = events.filter(e =>
      ['session', 'rdv', 'callback'].includes(e.type) &&
      overlap(addForm.start_time, addForm.end_time, e.startTime, e.endTime)
    )
    setAddConflicts(conflicts)
  }, [showAddModal, addDate, addForm.event_type, addForm.start_time, addForm.end_time, dayEvents])

  // ═══════════════════════════════════════════════════════════
  // RECHERCHE CLIENTS (autocomplete RDV)
  // ═══════════════════════════════════════════════════════════
  const searchClients = useCallback(async (query) => {
    if (!query || query.length < 2) { setClientResults([]); return }
    try {
      const { data } = await supabase.from('clients')
        .select('id, name, city, contact_name, contact_phone, contact_email, siret, type')
        .or(`name.ilike.%${query}%,city.ilike.%${query}%,siret.ilike.%${query}%`)
        .order('name')
        .limit(8)
      setClientResults(data || [])
    } catch (err) { console.error('Search clients error:', err) }
  }, [])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => searchClients(clientSearch), 300)
    return () => clearTimeout(searchTimeoutRef.current)
  }, [clientSearch, searchClients])

  const handleSelectClient = async (client) => {
    setSelectedClient(client)
    setClientSearch(client.name)
    setClientResults([])
    try {
      const { data } = await supabase.from('client_contacts')
        .select('id, name, first_name, last_name, email, phone, mobile, fonction, is_primary')
        .eq('client_id', client.id)
        .order('is_primary', { ascending: false })
      setClientContacts(data || [])
      if (data?.length > 0) {
        const primary = data.find(c => c.is_primary) || data[0]
        setRdvForm(f => ({
          ...f,
          contact_id: primary.id,
          contact_name: primary.name || `${primary.first_name || ''} ${primary.last_name || ''}`.trim(),
        }))
      }
    } catch (err) { console.error('Load contacts error:', err) }
  }

  // ═══════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════

  // ── Ajout événement (Indispo/ADM/Tâche/Phoning) ──
  const handleAddEvent = async () => {
    if (editEventId) return handleUpdateEvent()
    if (!addForm.title.trim()) { toast.error('Titre requis'); return }
    if (timeToMin(addForm.start_time) >= timeToMin(addForm.end_time)) { toast.error('Heure de fin invalide'); return }
    const dateStr = format(addDate, 'yyyy-MM-dd')
    let rescheduledCount = 0

    if (addForm.event_type === 'indispo') {
      const conflictCallbacks = (dayEvents[dateStr] || []).filter(e =>
        e.type === 'callback' && e.callId &&
        overlap(addForm.start_time, addForm.end_time, e.startTime, e.endTime)
      )
      if (conflictCallbacks.length > 0) {
        const nextDay = nextWorkday(dateStr)
        for (const cb of conflictCallbacks) {
          await supabase.from('prospect_calls').update({ callback_date: nextDay }).eq('id', cb.callId)
          rescheduledCount++
        }
      }
    }

    try {
      await supabase.from('user_planning_events').insert({
        user_id: user.id, event_type: addForm.event_type, event_date: dateStr,
        start_time: addForm.start_time, end_time: addForm.end_time, title: addForm.title.trim(),
        description: addForm.description.trim() || null,
      })
      let msg = 'Événement ajouté ✓'
      if (rescheduledCount > 0) msg += ` · ${rescheduledCount} rappel${rescheduledCount > 1 ? 's' : ''} repoussé${rescheduledCount > 1 ? 's' : ''}`
      toast.success(msg)
      setShowAddModal(false)
      setAddConflicts([])
      setAddForm({ event_type: 'indispo', title: '', start_time: '09:00', end_time: '12:00', description: '' })
      setEditEventId(null)
      loadWeekData()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  // ── Ajout RDV commercial ──
  const handleCreateRdv = async () => {
    const dateStr = format(rdvDate, 'yyyy-MM-dd')
    setRdvSaving(true)
    try {
      let clientId = selectedClient?.id

      // Mode nouveau prospect
      if (rdvMode === 'new') {
        if (!rdvForm.new_company.trim()) { toast.error('Nom entreprise requis'); setRdvSaving(false); return }
        const { data: newClient, error: clientErr } = await supabase.from('clients').insert({
          name: rdvForm.new_company.trim(),
          contact_name: rdvForm.new_contact_name.trim() || null,
          contact_phone: rdvForm.new_phone.trim() || null,
          contact_email: rdvForm.new_email.trim() || null,
          type: 'prospect',
          status: 'a_completer',
          proprietaire: 'Hicham',
        }).select().single()
        if (clientErr) throw clientErr
        clientId = newClient.id

        // Créer contact si nom fourni
        if (rdvForm.new_contact_name.trim()) {
          await supabase.from('client_contacts').insert({
            client_id: clientId,
            name: rdvForm.new_contact_name.trim(),
            phone: rdvForm.new_phone.trim() || null,
            email: rdvForm.new_email.trim() || null,
            is_primary: true,
          })
        }
      } else {
        if (!clientId) { toast.error('Sélectionnez un client'); setRdvSaving(false); return }
      }

      // Créer le RDV
      const { error: rdvErr } = await supabase.from('prospect_rdv').insert({
        client_id: clientId,
        rdv_date: dateStr,
        rdv_time: rdvForm.rdv_time || null,
        rdv_type: rdvForm.rdv_type,
        conducted_by: 'Hicham',
        status: 'prevu',
        contact_id: rdvMode === 'existing' && rdvForm.contact_id ? rdvForm.contact_id : null,
        contact_name: rdvMode === 'new' ? rdvForm.new_contact_name.trim() || null : rdvForm.contact_name || null,
        contact_email: rdvMode === 'new' ? rdvForm.new_email.trim() || null : null,
        contact_phone: rdvMode === 'new' ? rdvForm.new_phone.trim() || null : null,
        formations_interet: rdvForm.formations_interet.length > 0 ? rdvForm.formations_interet : null,
        notes: rdvForm.notes.trim() || null,
        temperature: 'tiede',
        source: 'planner_hicham',
      })
      if (rdvErr) throw rdvErr

      // Trace CRM — interaction dans le timeline client
      await supabase.from('client_interactions').insert({
        client_id: clientId,
        type: 'meeting',
        title: `RDV ${rdvForm.rdv_type} planifié le ${format(rdvDate, 'd MMMM', { locale: fr })}`,
        content: [
          rdvForm.contact_name && `Contact : ${rdvMode === 'new' ? rdvForm.new_contact_name : rdvForm.contact_name}`,
          rdvForm.formations_interet.length > 0 && `Formations : ${rdvForm.formations_interet.join(', ')}`,
          rdvForm.notes && `Notes : ${rdvForm.notes}`,
        ].filter(Boolean).join('\n'),
        author: 'Hicham',
        interaction_date: new Date().toISOString(),
        metadata: { source: 'planner', rdv_type: rdvForm.rdv_type },
      }).then(({ error }) => { if (error) console.warn('Interaction log error:', error) })

      // Notification
      const clientName = rdvMode === 'new' ? rdvForm.new_company.trim() : selectedClient?.name || 'Client'
      await supabase.from('notifications').insert({
        title: `🤝 RDV planifié — ${clientName}`,
        message: `${format(rdvDate, 'd MMMM', { locale: fr })} à ${rdvForm.rdv_time || '?'} · ${RDV_TYPES.find(t => t.value === rdvForm.rdv_type)?.label || rdvForm.rdv_type}${rdvForm.formations_interet.length > 0 ? ' · ' + rdvForm.formations_interet.join(', ') : ''}`,
        type: 'rdv_planner',
        link: '/prospection',
      }).then(({ error }) => { if (error) console.warn('Notification error:', error) })

      toast.success(`RDV ajouté${rdvMode === 'new' ? ' + prospect créé' : ''} ✓`)
      closeRdvModal()
      loadWeekData()
    } catch (err) { toast.error('Erreur: ' + err.message) }
    finally { setRdvSaving(false) }
  }

  const closeRdvModal = () => {
    setShowRdvModal(false)
    setRdvDate(null)
    setRdvMode('existing')
    setClientSearch('')
    setClientResults([])
    setSelectedClient(null)
    setClientContacts([])
    setEditRdvId(null)
    setRdvForm({
      rdv_time: '14:00', rdv_type: 'decouverte', contact_id: null,
      contact_name: '', notes: '', formations_interet: [],
      new_company: '', new_contact_name: '', new_phone: '', new_email: '',
    })
  }

  // ── Suppression événement ──
  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Supprimer ?')) return
    try {
      await supabase.from('user_planning_events').delete().eq('id', eventId)
      toast.success('Supprimé')
      loadWeekData()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  // ── Ouvrir édition planning event ──
  const handleOpenEditEvent = (evt) => {
    const evtDate = planningEvents.find(e => e.id === evt.eventId)
    if (!evtDate) return
    setEditEventId(evt.eventId)
    setAddDate(new Date(evtDate.event_date + 'T12:00:00'))
    setAddForm({
      event_type: evtDate.event_type,
      title: evtDate.title,
      start_time: evtDate.start_time || '09:00',
      end_time: evtDate.end_time || '18:00',
      description: evtDate.description || '',
    })
    setShowAddModal(true)
  }

  // ── Sauvegarder édition planning event ──
  const handleUpdateEvent = async () => {
    if (!addForm.title.trim()) { toast.error('Titre requis'); return }
    if (timeToMin(addForm.start_time) >= timeToMin(addForm.end_time)) { toast.error('Heure de fin invalide'); return }
    try {
      await supabase.from('user_planning_events').update({
        event_type: addForm.event_type,
        title: addForm.title.trim(),
        start_time: addForm.start_time,
        end_time: addForm.end_time,
        description: addForm.description.trim() || null,
      }).eq('id', editEventId)
      toast.success('Modifié ✓')
      setShowAddModal(false)
      setEditEventId(null)
      setAddConflicts([])
      setAddForm({ event_type: 'indispo', title: '', start_time: '09:00', end_time: '12:00', description: '' })
      loadWeekData()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  // ── Ouvrir édition RDV ──
  const handleOpenEditRdv = async (rdvId) => {
    try {
      const { data: rdv } = await supabase.from('prospect_rdv')
        .select('*, clients(id, name, city, contact_phone, contact_email, siret, type)')
        .eq('id', rdvId).single()
      if (!rdv) return
      setEditRdvId(rdvId)
      setRdvDate(new Date(rdv.rdv_date + 'T12:00:00'))
      setRdvMode('existing')
      setRdvForm({
        rdv_time: rdv.rdv_time ? rdv.rdv_time.slice(0, 5) : '14:00',
        rdv_type: rdv.rdv_type || 'decouverte',
        contact_id: rdv.contact_id || null,
        contact_name: rdv.contact_name || '',
        notes: rdv.notes || '',
        formations_interet: rdv.formations_interet || [],
        new_company: '', new_contact_name: '', new_phone: '', new_email: '',
      })
      if (rdv.clients) {
        setSelectedClient(rdv.clients)
        setClientSearch(rdv.clients.name)
        const { data: contacts } = await supabase.from('client_contacts')
          .select('id, name, first_name, last_name, email, phone, mobile, fonction, is_primary')
          .eq('client_id', rdv.clients.id).order('is_primary', { ascending: false })
        setClientContacts(contacts || [])
      }
      setShowRdvModal(true)
    } catch (err) { toast.error('Erreur chargement RDV: ' + err.message) }
  }

  // ── Sauvegarder édition RDV ──
  const handleUpdateRdv = async () => {
    setRdvSaving(true)
    try {
      await supabase.from('prospect_rdv').update({
        rdv_time: rdvForm.rdv_time || null,
        rdv_type: rdvForm.rdv_type,
        contact_id: rdvForm.contact_id || null,
        contact_name: rdvForm.contact_name || null,
        formations_interet: rdvForm.formations_interet.length > 0 ? rdvForm.formations_interet : null,
        notes: rdvForm.notes.trim() || null,
      }).eq('id', editRdvId)
      toast.success('RDV modifié ✓')
      setEditRdvId(null)
      closeRdvModal()
      loadWeekData()
    } catch (err) { toast.error('Erreur: ' + err.message) }
    finally { setRdvSaving(false) }
  }

  // ── Ouvrir édition callback ──
  const handleOpenEditCallback = (evt) => {
    const cb = callbacks.find(c => c.id === evt.callId)
    if (!cb) return
    setEditCallbackId(evt.callId)
    setEditCallbackForm({
      callback_date: cb.callback_date || '',
      callback_time: cb.callback_time ? cb.callback_time.slice(0, 5) : '',
      notes: cb.notes || '',
    })
    setShowEditCallbackModal(true)
  }

  // ── Sauvegarder édition callback ──
  const handleUpdateCallback = async () => {
    try {
      await supabase.from('prospect_calls').update({
        callback_date: editCallbackForm.callback_date,
        callback_time: editCallbackForm.callback_time || null,
        notes: editCallbackForm.notes.trim() || null,
      }).eq('id', editCallbackId)
      toast.success('Rappel modifié ✓')
      setShowEditCallbackModal(false)
      setEditCallbackId(null)
      loadWeekData()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  // ── Suppression RDV ──
  const handleDeleteRdv = async (rdvId) => {
    if (!confirm('Annuler ce RDV ?')) return
    try {
      await supabase.from('prospect_rdv').update({ status: 'annule' }).eq('id', rdvId)
      toast.success('RDV annulé ✓')
      loadWeekData()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  // ── Callback fait ──
  const handleCallbackDone = async (callId) => {
    try {
      await supabase.from('prospect_calls').update({ needs_callback: false }).eq('id', callId)
      toast.success('Rappel marqué fait ✓')
      setCallbacks(prev => prev.filter(c => c.id !== callId))
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }


  // Synchro édition relance quand IA génère
  useEffect(() => {
    if (previewData) {
      setRelanceEdit({ subject: previewData.subject || '', body: previewData.body || '' })
      setRelanceConfirmed(false)
    }
  }, [previewData])

  // ── Relance devis — ouvre la modale IA ──
  const handleRelanceDevis = (quote) => {
    relanceQuote(quote, { senderName: 'Hicham Saidi' })
  }

  // Synchro édition quand IA génère le brouillon
  // (useEffect dans le composant)

  // ═══════════════════════════════════════════════════════════
  // DRAG & DROP (HTML5 natif — même pattern que Dashboard)
  // ═══════════════════════════════════════════════════════════
  const handleDragStart = (e, event) => {
    if (!event.draggable) { e.preventDefault(); return }
    setDragItem(event)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', event.id)
    // Rendre la carte fantôme semi-transparente
    requestAnimationFrame(() => { if (e.target) e.target.style.opacity = '0.4' })
  }

  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = '1'
    setDragItem(null)
    setDragOverDay(null)
  }

  const handleDragOverDay = (e, dateStr) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverDay !== dateStr) setDragOverDay(dateStr)
  }

  const handleDragLeaveDay = (e) => {
    // Vérifier qu'on quitte bien la colonne (pas un enfant)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX, y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverDay(null)
    }
  }

  const handleDropOnDay = async (e, targetDateStr) => {
    e.preventDefault()
    setDragOverDay(null)
    if (!dragItem || dragItem.dragDate === targetDateStr) { setDragItem(null); return }

    const { dragType, dbId } = dragItem
    try {
      if (dragType === 'rdv') {
        await supabase.from('prospect_rdv').update({ rdv_date: targetDateStr }).eq('id', dbId)
      } else if (dragType === 'callback') {
        await supabase.from('prospect_calls').update({ callback_date: targetDateStr }).eq('id', dbId)
      } else if (dragType === 'event') {
        await supabase.from('user_planning_events').update({ event_date: targetDateStr }).eq('id', dbId)
      }
      toast.success(`Déplacé au ${format(new Date(targetDateStr + 'T12:00:00'), 'EEEE d', { locale: fr })} ✓`)
      loadWeekData()
    } catch (err) { toast.error('Erreur déplacement: ' + err.message) }
    setDragItem(null)
  }

  // ═══════════════════════════════════════════════════════════
  // TAP-TO-MOVE (fallback tactile iPad/mobile)
  // Tap sur carte draggable → sélection, tap sur header jour → déplacement
  // ═══════════════════════════════════════════════════════════
  const handleTapSelect = (event) => {
    if (!event.draggable) return
    if (tapSelected?.id === event.id) {
      // Deuxième tap = désélection
      setTapSelected(null)
    } else {
      setTapSelected(event)
      toast(`📌 ${event.title} sélectionné — tapez sur un jour pour déplacer`, { icon: '👆', duration: 2500 })
    }
  }

  const handleTapMoveToDay = async (targetDateStr) => {
    if (!tapSelected || tapSelected.dragDate === targetDateStr) { setTapSelected(null); return }
    const { dragType, dbId } = tapSelected
    try {
      if (dragType === 'rdv') {
        await supabase.from('prospect_rdv').update({ rdv_date: targetDateStr }).eq('id', dbId)
      } else if (dragType === 'callback') {
        await supabase.from('prospect_calls').update({ callback_date: targetDateStr }).eq('id', dbId)
      } else if (dragType === 'event') {
        await supabase.from('user_planning_events').update({ event_date: targetDateStr }).eq('id', dbId)
      }
      toast.success(`Déplacé au ${format(new Date(targetDateStr + 'T12:00:00'), 'EEEE d', { locale: fr })} ✓`)
      setTapSelected(null)
      loadWeekData()
    } catch (err) { toast.error('Erreur déplacement: ' + err.message) }
  }

  // ═══════════════════════════════════════════════════════════
  // SUB-COMPONENTS
  // ═══════════════════════════════════════════════════════════

  const EventItem = ({ event }) => {
    const config = SLOT_TYPES[event.type] || SLOT_TYPES.task
    const isLink = !!event.link
    const canDrag = event.draggable
    const isTapSelected = tapSelected?.id === event.id

    return (
      <div
        className={`flex items-start gap-1.5 px-2.5 py-2 rounded-lg ${config.color} group relative transition-all ${
          canDrag ? 'cursor-grab active:cursor-grabbing hover:shadow-sm' : ''
        } ${dragItem?.id === event.id ? 'opacity-30 scale-95' : ''} ${
          isTapSelected ? 'ring-2 ring-primary-500 shadow-md scale-[1.02]' : ''
        }`}
        draggable={canDrag}
        onDragStart={(e) => handleDragStart(e, event)}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          // Tap-to-move uniquement si pas de lien cliqué et pas d'action bouton
          if (canDrag && !e.defaultPrevented) handleTapSelect(event)
        }}
      >
        {canDrag && (
          <GripVertical className="w-3 h-3 mt-1 text-current opacity-0 group-hover:opacity-30 flex-shrink-0 -ml-1 transition-opacity" />
        )}
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${config.dot}`} />
        <div className="flex-1 min-w-0">
          {isLink ? (
            <Link to={event.link} className="hover:underline" onClick={e => e.stopPropagation()}>
              <span className="font-semibold text-xs">{event.title}</span>
            </Link>
          ) : (
            <span className="font-semibold text-xs">{event.title}</span>
          )}
          {event.temperature === 'chaud' && <Flame className="inline w-3 h-3 text-red-500 ml-1" />}
          {event.subtitle && <p className="text-[10px] opacity-70 truncate">{event.subtitle}</p>}
          <div className="flex items-center gap-2 mt-0.5">
            {event.time && <span className="text-[10px] opacity-60 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{event.time}</span>}
            {event.location && <span className="text-[10px] opacity-60">📍 {event.location}</span>}
          </div>
        </div>
        {/* Actions rapides */}
        {event.type === 'rdv' && event.dbId && (
          <button onClick={(e) => { e.stopPropagation(); handleDeleteRdv(event.dbId) }}
            className="p-1 rounded-full hover:bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity" title="Annuler RDV">
            <X className="w-3.5 h-3.5 text-red-500" />
          </button>
        )}
        {event.callId && (
          <button onClick={(e) => { e.stopPropagation(); handleCallbackDone(event.callId) }}
            className="p-1 rounded-full hover:bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity" title="Fait ✓">
            <Check className="w-3.5 h-3.5 text-green-600" />
          </button>
        )}
        {event.eventId && (
          <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.eventId) }}
            className="p-1 rounded-full hover:bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity" title="Supprimer">
            <X className="w-3.5 h-3.5 text-red-500" />
          </button>
        )}
      </div>
    )
  }

  // ─── DayCard ────────────────────────────────────────────
  const DayCard = ({ date, dayIdx }) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const events = dayEvents[dateStr] || []
    const isCurrentDay = isToday(date)
    const hasSession = events.some(e => e.type === 'session')
    const rdvCount = events.filter(e => e.type === 'rdv').length
    const cbCount = events.filter(e => e.type === 'callback').length
    const isEmpty = events.length === 0
    const isDropTarget = dragOverDay === dateStr && dragItem?.dragDate !== dateStr
    const isTapTarget = tapSelected && tapSelected.dragDate !== dateStr

    return (
      <div
        className={`flex flex-col rounded-xl border overflow-hidden transition-all duration-150 ${
          isDropTarget ? 'border-primary-500 ring-2 ring-primary-300 bg-primary-50/30 scale-[1.02] shadow-md' :
          isTapTarget ? 'border-dashed border-primary-400' :
          isCurrentDay ? 'border-primary-400 ring-1 ring-primary-200' : 'border-gray-200 hover:shadow-sm'
        }`}
        onDragOver={(e) => handleDragOverDay(e, dateStr)}
        onDragLeave={handleDragLeaveDay}
        onDrop={(e) => handleDropOnDay(e, dateStr)}
      >
        {/* Header jour — zone de drop tactile */}
        <div
          className={`px-2.5 py-2 text-center border-b transition-colors ${
            isDropTarget ? 'bg-primary-100 border-primary-300' :
            isTapTarget ? 'bg-primary-50 border-primary-200 cursor-pointer hover:bg-primary-100' :
            isCurrentDay ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-100'
          }`}
          onClick={() => { if (isTapTarget) handleTapMoveToDay(dateStr) }}
        >
          <p className={`text-[10px] font-bold uppercase tracking-wide ${isCurrentDay ? 'text-primary-600' : 'text-gray-500'}`}>
            {DAYS[dayIdx]}
          </p>
          <p className={`text-lg font-bold leading-tight ${isCurrentDay ? 'text-primary-800' : 'text-gray-900'}`}>
            {format(date, 'd')}
          </p>
          {/* Indicateur tap-to-move */}
          {isTapTarget && (
            <p className="text-[9px] text-primary-500 font-semibold mt-0.5 animate-pulse">↓ Déplacer ici</p>
          )}
          {/* Badges */}
          {!isTapTarget && (
            <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
              {hasSession && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-medium">🎓 Formation</span>}
              {rdvCount > 0 && <span className="text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-medium">🤝 {rdvCount}</span>}
              {cbCount > 0 && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-medium">📞 {cbCount}</span>}
              {isEmpty && dayIdx < 5 && <span className="text-[8px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">Libre</span>}
            </div>
          )}
        </div>

        {/* Events list */}
        <div className={`flex-1 p-1.5 space-y-1 min-h-[120px] transition-colors ${isDropTarget ? 'bg-primary-50/20' : ''}`}>
          {events.length === 0 ? (
            <p className={`text-[10px] italic text-center pt-6 ${isDropTarget ? 'text-primary-400 font-medium' : 'text-gray-300'}`}>
              {isDropTarget ? '↓ Déposer ici' : 'Rien de prévu'}
            </p>
          ) : (
            events.map(e => <EventItem key={e.id} event={e} />)
          )}
        </div>

        {/* Boutons ajouter — split + Ajouter | RDV */}
        <div className="flex border-t border-gray-100">
          <button onClick={() => { setAddDate(date); setShowAddModal(true) }}
            className="flex-1 py-1.5 text-[10px] text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center gap-1">
            <Plus className="w-3 h-3" /> Ajouter
          </button>
          <div className="w-px bg-gray-100" />
          <button onClick={() => { setRdvDate(date); setShowRdvModal(true) }}
            className="flex-1 py-1.5 text-[10px] text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-1">
            <UserPlus className="w-3 h-3" /> RDV
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // TIME GRID (desktop uniquement)
  // ═══════════════════════════════════════════════════════════
  const TimeGrid = () => {
    const HOUR_PX = 60
    const hours = []
    for (let h = gridStartH; h < gridEndH; h++) hours.push(h)
    const totalPx = (gridEndH - gridStartH) * HOUR_PX

    const now = new Date()
    const nowPx = (now.getHours() * 60 + now.getMinutes() - gridStartH * 60) * (HOUR_PX / 60)
    const isCurrentWeek = weekOffset === 0

    return (
      <div className="hidden md:block border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        {/* Header fixe : noms de jours */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <div className="w-12 flex-shrink-0 border-r border-gray-200" />
          {weekDates.map((date, dayIdx) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const events = dayEvents[dateStr] || []
            const isCurrentDay = isToday(date)
            const allDayEvents = events.filter(e => !e.startTime)
            const isDropTarget = dragOverDay === dateStr && dragItem?.dragDate !== dateStr
            const isTapTarget = tapSelected && tapSelected.dragDate !== dateStr

            return (
              <div key={dateStr}
                className={`flex-1 border-r border-gray-200 last:border-r-0 ${isCurrentDay ? 'bg-primary-50/60' : ''} ${isDropTarget ? 'bg-primary-50 ring-1 ring-inset ring-primary-400' : ''}`}
                onDragOver={e => handleDragOverDay(e, dateStr)}
                onDragLeave={handleDragLeaveDay}
                onDrop={e => handleDropOnDay(e, dateStr)}
              >
                {/* Nom + numéro */}
                <div className={`px-2 pt-2 pb-1 text-center cursor-pointer hover:bg-gray-100/60 transition-colors ${isTapTarget ? 'bg-primary-50 cursor-pointer' : ''}`}
                  onClick={() => { if (isTapTarget) handleTapMoveToDay(dateStr) }}>
                  <p className={`text-[10px] font-bold uppercase tracking-wide ${isCurrentDay ? 'text-primary-600' : 'text-gray-400'}`}>{DAYS[dayIdx]}</p>
                  <p className={`text-base font-bold ${isCurrentDay ? 'text-primary-700' : 'text-gray-800'}`}>{format(date, 'd')}</p>
                  {isTapTarget && <p className="text-[9px] text-primary-500 font-semibold animate-pulse">↓ Déplacer ici</p>}
                </div>
                {/* Events sans heure (bandeau allday) */}
                {allDayEvents.length > 0 && (
                  <div className="px-1 pb-1 space-y-0.5">
                    {allDayEvents.map(evt => {
                      const config = SLOT_TYPES[evt.type] || SLOT_TYPES.task
                      return (
                        <div key={evt.id}
                          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold truncate cursor-pointer hover:brightness-95 transition-all ${config.color}`}
                          title={`${evt.title}${evt.time && evt.time !== 'Heure à définir' ? '' : ' — heure à définir'}`}
                          onClick={() => {
                            if (evt.type === 'rdv' && evt.dbId) handleOpenEditRdv(evt.dbId)
                            else if (evt.type === 'callback' && evt.callId) handleOpenEditCallback(evt)
                            else if (evt.eventId) handleOpenEditEvent(evt)
                          }}>
                          {evt.title}{evt.time === 'Heure à définir' ? ' · ?' : ''}
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* Boutons rapides */}
                <div className="flex border-t border-gray-100">
                  <button onClick={() => { setAddDate(date); setShowAddModal(true) }}
                    className="flex-1 py-1 text-[9px] text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center gap-0.5">
                    <Plus className="w-2.5 h-2.5" /> Ajouter
                  </button>
                  <div className="w-px bg-gray-100" />
                  <button onClick={() => { setRdvDate(date); setShowRdvModal(true) }}
                    className="flex-1 py-1 text-[9px] text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-0.5">
                    <UserPlus className="w-2.5 h-2.5" /> RDV
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Corps scrollable */}
        <div ref={gridRef} className="overflow-y-auto" style={{ maxHeight: 600 }}>
          <div className="flex" style={{ height: totalPx }}>
            {/* Axe horaire */}
            <div className="w-12 flex-shrink-0 relative border-r border-gray-200 bg-gray-50/50">
              {hours.map(h => (
                <div key={h} className="absolute w-full flex items-start justify-end pr-2"
                  style={{ top: (h - gridStartH) * HOUR_PX - 7 }}>
                  <span className="text-[10px] text-gray-400 leading-none">{String(h).padStart(2, '0')}h</span>
                </div>
              ))}
            </div>

            {/* Colonnes jours */}
            {weekDates.map((date, dayIdx) => {
              const dateStr = format(date, 'yyyy-MM-dd')
              const events = dayEvents[dateStr] || []
              const isCurrentDay = isToday(date)
              const timedEvents = events.filter(e => e.startTime)
              const colAssign = assignEventColumns(events)

              return (
                <div key={dateStr}
                  className={`flex-1 relative border-r border-gray-200 last:border-r-0 ${isCurrentDay ? 'bg-primary-50/20' : ''}`}
                  style={{ height: totalPx }}
                  onClick={e => {
                    if (e.target !== e.currentTarget) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const y = e.clientY - rect.top + (gridRef.current?.scrollTop || 0)
                    const clickedMin = Math.round(y / (HOUR_PX / 60) / 15) * 15 + gridStartH * 60
                    const clampedStart = Math.min(Math.max(clickedMin, gridStartH * 60), gridEndH * 60 - 60)
                    const clampedEnd = clampedStart + 60
                    const fmtMin = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
                    setAddDate(date)
                    setAddForm(f => ({ ...f, start_time: fmtMin(clampedStart), end_time: fmtMin(clampedEnd) }))
                    setShowAddModal(true)
                  }}
                >
                  {/* Lignes horaires */}
                  {hours.map(h => (
                    <div key={h} className="absolute w-full border-t border-gray-100 pointer-events-none"
                      style={{ top: (h - gridStartH) * HOUR_PX }} />
                  ))}
                  {/* Demi-heures */}
                  {hours.map(h => (
                    <div key={`${h}h`} className="absolute w-full border-t border-gray-50 pointer-events-none"
                      style={{ top: (h - gridStartH) * HOUR_PX + HOUR_PX / 2 }} />
                  ))}

                  {/* Ligne "maintenant" */}
                  {isCurrentDay && isCurrentWeek && nowPx >= 0 && nowPx <= totalPx && (
                    <div className="absolute w-full z-20 pointer-events-none flex items-center" style={{ top: nowPx }}>
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 -ml-1" />
                      <div className="flex-1 h-px bg-red-400" />
                    </div>
                  )}

                  {/* Événements avec heure */}
                  {timedEvents.map(evt => {
                    const config = SLOT_TYPES[evt.type] || SLOT_TYPES.task
                    const startMin = timeToMin(evt.startTime)
                    const endMin = timeToMin(evt.endTime || addMinutesToTime(evt.startTime, 30))
                    const top = (startMin - gridStartH * 60) * (HOUR_PX / 60)
                    const height = Math.max(24, (endMin - startMin) * (HOUR_PX / 60))
                    const assign = colAssign[evt.id] || { colIdx: 0, numCols: 1 }
                    const widthPct = 100 / assign.numCols
                    const leftPct = (assign.colIdx / assign.numCols) * 100
                    const isLink = !!evt.link

                    return (
                      <div key={evt.id}
                        className={`absolute rounded overflow-hidden border border-white/70 shadow-sm group z-10 hover:z-30 hover:shadow-md transition-shadow ${config.color} ${evt.draggable ? 'cursor-grab' : 'cursor-pointer'} ${dragItem?.id === evt.id ? 'opacity-30' : ''}`}
                        style={{ top, height, left: `${leftPct + 1}%`, width: `${widthPct - 2}%` }}
                        draggable={evt.draggable}
                        onDragStart={evt.draggable ? e => handleDragStart(e, evt) : undefined}
                        onDragEnd={evt.draggable ? handleDragEnd : undefined}
                        onClick={e => {
                          e.stopPropagation()
                          if (evt.type === 'rdv' && evt.dbId) { handleOpenEditRdv(evt.dbId); return }
                          if (evt.type === 'callback' && evt.callId) { handleOpenEditCallback(evt); return }
                          if (evt.eventId) { handleOpenEditEvent(evt); return }
                          if (evt.link) return
                          if (evt.draggable) handleTapSelect(evt)
                        }}
                      >
                        <div className="px-1 pt-0.5 h-full flex flex-col">
                          <div className="font-semibold leading-tight truncate" style={{ fontSize: 10 }}>
                            {isLink
                              ? <Link to={evt.link} onClick={e => e.stopPropagation()} className="hover:underline">{evt.title}</Link>
                              : evt.title}
                            {evt.temperature === 'chaud' && <Flame className="inline w-2.5 h-2.5 text-red-500 ml-0.5" />}
                          </div>
                          {height > 32 && evt.subtitle && (
                            <div className="truncate opacity-70" style={{ fontSize: 9 }}>{evt.subtitle}</div>
                          )}
                          {height > 44 && (
                            <div className="opacity-60 mt-auto" style={{ fontSize: 9 }}>
                              {fmtTime(evt.startTime)}{evt.endTime ? ` – ${fmtTime(evt.endTime)}` : ''}
                            </div>
                          )}
                        </div>
                        {/* Actions rapides */}
                        {evt.type === 'rdv' && evt.dbId && (
                          <button onClick={e => { e.stopPropagation(); handleDeleteRdv(evt.dbId) }}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-white/60 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <X className="w-2.5 h-2.5 text-red-500" />
                          </button>
                        )}
                        {evt.callId && (
                          <button onClick={e => { e.stopPropagation(); handleCallbackDone(evt.callId) }}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-white/60 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <Check className="w-2.5 h-2.5 text-green-600" />
                          </button>
                        )}
                        {evt.eventId && (
                          <button onClick={e => { e.stopPropagation(); handleDeleteEvent(evt.eventId) }}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-white/60 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <X className="w-2.5 h-2.5 text-red-500" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
      <span className="ml-2 text-sm text-gray-500">Chargement...</span>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setWeekOffset(0)} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${weekOffset === 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Aujourd'hui
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-gray-700 ml-1">{weekLabel}</span>
        </div>

        {/* Stats compactes */}
        <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
          {todayCallCount > 0 && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-bold flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" /> {todayCallCount} appel{todayCallCount > 1 ? 's' : ''}
            </span>
          )}
          {weekCallStats.total > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />
              {weekCallStats.total}→{weekCallStats.chaud}🔥→{weekCallStats.rdv} RDV
              <span className="text-green-600 font-bold">({Math.round(weekCallStats.chaud / weekCallStats.total * 100)}%)</span>
            </span>
          )}
          {weekStats.totalSessions > 0 && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">🎓 {weekStats.totalSessions}</span>}
          {weekStats.totalRdv > 0 && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full">🤝 {weekStats.totalRdv}</span>}
          {weekStats.totalCallbacks > 0 && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">📞 {weekStats.totalCallbacks}</span>}
          {weekStats.totalRelances > 0 && <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full font-bold">💰 {weekStats.caRelance.toLocaleString('fr')}€</span>}
          <Link to="/prospection" className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors flex items-center gap-1 font-medium">
            <Phone className="w-2.5 h-2.5" /> Phoning <ExternalLink className="w-2 h-2" />
          </Link>
        </div>
      </div>

      {/* ═══ Encart prospects à compléter ═══ */}
      {incompleteProspects.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-bold text-orange-700">
              {incompleteProspects.length} prospect{incompleteProspects.length > 1 ? 's' : ''} à compléter
            </span>
          </div>
          <div className="space-y-1">
            {incompleteProspects.slice(0, 5).map(p => {
              const missing = []
              if (!p.siret) missing.push('SIRET')
              if (!p.contact_email) missing.push('Email')
              if (!p.contact_phone) missing.push('Tél')
              return (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <Link to={`/clients/${p.id}`} className="text-[11px] text-orange-600 hover:underline truncate flex-1">
                    {p.name}{p.city ? ` (${p.city})` : ''}
                    {missing.length > 0 && <span className="ml-1.5 text-orange-400">— manque : {missing.join(', ')}</span>}
                  </Link>
                  <Link to={`/clients/${p.id}`}
                    className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                    Compléter
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alerte devis à relancer */}
      {devisRelance.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-bold text-red-700">{devisRelance.length} devis à relancer — {devisRelance.reduce((s, q) => s + (parseFloat(q.total_ht) || 0), 0).toLocaleString('fr')}€ HT</span>
          </div>
          <div className="space-y-1">
            {devisRelance.slice(0, 5).map(q => (
              <div key={q.id} className="flex items-center justify-between gap-2">
                <Link to={`/devis?id=${q.id}`} className="text-[11px] text-red-600 hover:underline truncate flex-1">
                  {q.clients?.name} — {q.reference} — {parseFloat(q.total_ht).toLocaleString('fr')}€ ({q.daysSince}j)
                  {(q.relance_count || 0) > 0 && <span className="ml-1 text-red-400">({q.relance_count}× relancé)</span>}
                </Link>
                <button onClick={() => handleRelanceDevis(q)} disabled={relanceSending === q.id || (q.relance_count || 0) >= 3}
                  className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    relanceSending === q.id ? 'bg-gray-200 text-gray-400' :
                    (q.relance_count || 0) >= 3 ? 'bg-orange-100 text-orange-600' :
                    q.clients?.contact_email ? 'bg-red-600 text-white hover:bg-red-700' :
                    'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}>
                  {relanceSending === q.id ? '⏳' : (q.relance_count || 0) >= 3 ? '📞 Appeler' : '✉️ Relancer'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bannière tap-to-move actif */}
      {tapSelected && (
        <div className="bg-primary-50 border border-primary-300 rounded-lg px-3 py-2 flex items-center justify-between animate-pulse">
          <span className="text-xs font-semibold text-primary-700">
            📌 <strong>{tapSelected.title}</strong> sélectionné — tapez sur un jour pour déplacer
          </span>
          <button onClick={() => setTapSelected(null)}
            className="px-2 py-1 text-[10px] bg-primary-600 text-white rounded-full hover:bg-primary-700 font-medium">
            ✕ Annuler
          </button>
        </div>
      )}

      {/* Grille semaine — desktop: time grid, mobile: cartes */}
      <TimeGrid />
      <div className="grid grid-cols-3 gap-2 md:hidden sm:grid-cols-6">
        {weekDates.map((date, idx) => <DayCard key={format(date, 'yyyy-MM-dd')} date={date} dayIdx={idx} />)}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-400 justify-center">
        {['session', 'rdv', 'callback', 'indispo', 'task'].map(k => (
          <span key={k} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${SLOT_TYPES[k].dot}`} />
            {SLOT_TYPES[k].label}
          </span>
        ))}
        <span className="flex items-center gap-1 text-gray-300">
          <GripVertical className="w-2.5 h-2.5" /> Glisser ou taper pour déplacer
        </span>
      </div>

      {/* ═══ MODAL AJOUT ÉVÉNEMENT (Indispo/ADM/Tâche/Phoning) ═══ */}
      {showAddModal && addDate && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{format(addDate, 'EEEE d MMMM', { locale: fr })}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'indispo', emoji: '🔒', label: 'Indispo', desc: 'Médecin, congé...' },
                  { value: 'adm', emoji: '📋', label: 'ADM', desc: 'Tâche admin' },
                  { value: 'task', emoji: '✅', label: 'Tâche', desc: 'Préparer devis...' },
                  { value: 'phoning_manual', emoji: '📞', label: 'Phoning', desc: 'Bloc phoning' },
                ].map(o => (
                  <button key={o.value} onClick={() => setAddForm(f => ({ ...f, event_type: o.value }))}
                    className={`p-3 text-left rounded-lg border-2 transition-colors ${addForm.event_type === o.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="text-lg">{o.emoji}</span>
                    <p className={`text-xs font-semibold mt-1 ${addForm.event_type === o.value ? 'text-primary-700' : 'text-gray-700'}`}>{o.label}</p>
                    <p className="text-[10px] text-gray-400">{o.desc}</p>
                  </button>
                ))}
              </div>
              <input type="text" value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Titre..." className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none" autoFocus />
              <div className="grid grid-cols-2 gap-3">
                <input type="time" value={addForm.start_time} onChange={e => setAddForm(f => ({ ...f, start_time: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none" />
                <input type="time" value={addForm.end_time} onChange={e => setAddForm(f => ({ ...f, end_time: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[{ l: 'Matin', s: '08:00', e: '12:00' }, { l: 'Après-midi', s: '14:00', e: '18:00' }, { l: 'Journée', s: '08:00', e: '18:00' }].map(q =>
                  <button key={q.l} onClick={() => setAddForm(f => ({ ...f, start_time: q.s, end_time: q.e }))} className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded-full">{q.l}</button>
                )}
              </div>
              {/* Alertes conflits */}
              {addForm.event_type === 'indispo' && addConflicts.length > 0 && (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-800 flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Attention — conflits détectés
                  </p>
                  {addConflicts.filter(e => ['session', 'rdv'].includes(e.type)).map(e => (
                    <p key={e.id} className="text-[11px] text-red-700 font-medium">
                      ⚠️ {e.type === 'session' ? 'Formation' : 'RDV'} : {e.title} ({e.time})
                    </p>
                  ))}
                  {addConflicts.filter(e => e.type === 'callback').length > 0 && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      📞 {addConflicts.filter(e => e.type === 'callback').length} rappel(s) seront repoussés au prochain jour ouvré
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowAddModal(false); setEditEventId(null); setAddConflicts([]) }} className="flex-1 py-2.5 text-sm border rounded-lg hover:bg-gray-50 font-medium text-gray-600">Annuler</button>
                <button onClick={handleAddEvent} className="flex-1 py-2.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium shadow-sm">
                  {editEventId ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL AJOUT RDV COMMERCIAL ═══ */}
      {showRdvModal && rdvDate && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={closeRdvModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-green-600" />
                  {editRdvId ? 'Modifier le RDV' : 'Nouveau RDV commercial'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{format(rdvDate, 'EEEE d MMMM yyyy', { locale: fr })}</p>
              </div>
              <button onClick={closeRdvModal} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4">
              {/* Toggle client connu / nouveau */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button onClick={() => { setRdvMode('existing'); setSelectedClient(null); setClientSearch('') }}
                  className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${rdvMode === 'existing' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  <Building2 className="w-3.5 h-3.5 inline mr-1" /> Client connu
                </button>
                <button onClick={() => { setRdvMode('new'); setSelectedClient(null); setClientSearch('') }}
                  className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${rdvMode === 'new' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  <UserPlus className="w-3.5 h-3.5 inline mr-1" /> Nouveau prospect
                </button>
              </div>

              {/* Mode client connu */}
              {rdvMode === 'existing' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input type="text" value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setSelectedClient(null) }}
                      placeholder="Rechercher (nom, ville, SIRET)..."
                      className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-green-300 outline-none"
                      autoFocus />
                    {clientResults.length > 0 && !selectedClient && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {clientResults.map(c => (
                          <button key={c.id} onClick={() => handleSelectClient(c)}
                            className="w-full text-left px-3 py-2 hover:bg-green-50 border-b border-gray-50 last:border-0 transition-colors">
                            <span className="text-sm font-medium text-gray-900">{c.name}</span>
                            <span className="text-[10px] text-gray-500 ml-2">
                              {c.city && `📍 ${c.city}`}
                              {c.siret && ` · ${c.siret}`}
                            </span>
                            {c.type === 'prospect' && (
                              <span className="ml-2 text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">Prospect</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedClient && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-green-800">{selectedClient.name}</p>
                        <p className="text-[10px] text-green-600">
                          {selectedClient.city && `📍 ${selectedClient.city}`}
                          {selectedClient.contact_phone && ` · 📞 ${selectedClient.contact_phone}`}
                        </p>
                      </div>
                      <button onClick={() => { setSelectedClient(null); setClientSearch(''); setClientContacts([]) }}
                        className="p-1 hover:bg-green-100 rounded">
                        <X className="w-3.5 h-3.5 text-green-600" />
                      </button>
                    </div>
                  )}
                  {selectedClient && clientContacts.length > 0 && (
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Contact</label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {clientContacts.map(c => {
                          const cName = c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim()
                          return (
                            <button key={c.id} onClick={() => setRdvForm(f => ({ ...f, contact_id: c.id, contact_name: cName }))}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                                rdvForm.contact_id === c.id ? 'border-green-500 bg-green-50 text-green-700 font-semibold' : 'border-gray-200 hover:border-gray-300'
                              }`}>
                              <User className="w-3 h-3 inline mr-1" />
                              {cName}
                              {c.fonction && <span className="text-gray-400 ml-1">({c.fonction})</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode nouveau prospect */}
              {rdvMode === 'new' && (
                <div className="space-y-3 bg-orange-50/50 border border-orange-100 rounded-lg p-3">
                  <p className="text-[10px] text-orange-600 font-medium flex items-center gap-1">
                    <Info className="w-3 h-3" /> Complétez la fiche plus tard — seul le nom est requis
                  </p>
                  <input type="text" value={rdvForm.new_company}
                    onChange={e => setRdvForm(f => ({ ...f, new_company: e.target.value }))}
                    placeholder="Nom de l'entreprise *"
                    className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none bg-white"
                    autoFocus />
                  <input type="text" value={rdvForm.new_contact_name}
                    onChange={e => setRdvForm(f => ({ ...f, new_contact_name: e.target.value }))}
                    placeholder="Nom du contact"
                    className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none bg-white" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="tel" value={rdvForm.new_phone}
                      onChange={e => setRdvForm(f => ({ ...f, new_phone: e.target.value }))}
                      placeholder="📞 Téléphone"
                      className="border border-orange-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none bg-white" />
                    <input type="email" value={rdvForm.new_email}
                      onChange={e => setRdvForm(f => ({ ...f, new_email: e.target.value }))}
                      placeholder="✉️ Email"
                      className="border border-orange-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none bg-white" />
                  </div>
                </div>
              )}

              {/* Heure + Type RDV */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Heure</label>
                  <input type="time" value={rdvForm.rdv_time}
                    onChange={e => setRdvForm(f => ({ ...f, rdv_time: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-300 outline-none mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Type</label>
                  <select value={rdvForm.rdv_type}
                    onChange={e => setRdvForm(f => ({ ...f, rdv_type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-300 outline-none mt-1 bg-white">
                    {RDV_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Formations d'intérêt */}
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Formations d'intérêt</label>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {FORMATIONS.map(f => (
                    <button key={f} onClick={() => {
                      setRdvForm(prev => ({
                        ...prev,
                        formations_interet: prev.formations_interet.includes(f)
                          ? prev.formations_interet.filter(x => x !== f)
                          : [...prev.formations_interet, f]
                      }))
                    }}
                      className={`px-2 py-1 text-[10px] rounded-full border transition-colors ${
                        rdvForm.formations_interet.includes(f) ? 'bg-green-100 border-green-400 text-green-700 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <textarea value={rdvForm.notes}
                onChange={e => setRdvForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes..."
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-300 outline-none resize-none" />

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={closeRdvModal} className="flex-1 py-2.5 text-sm border rounded-lg hover:bg-gray-50 font-medium text-gray-600">
                  Annuler
                </button>
                <button onClick={editRdvId ? handleUpdateRdv : handleCreateRdv} disabled={rdvSaving}
                  className={`flex-1 py-2.5 text-sm rounded-lg font-medium shadow-sm transition-colors ${
                    editRdvId ? 'bg-blue-600 text-white hover:bg-blue-700' :
                    rdvMode === 'new' ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-green-600 text-white hover:bg-green-700'
                  } ${rdvSaving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {rdvSaving ? (
                    <><Loader2 className="w-4 h-4 inline animate-spin mr-1" /> Enregistrement...</>
                  ) : editRdvId ? (
                    <><Check className="w-4 h-4 inline mr-1" /> Enregistrer</>
                  ) : rdvMode === 'new' ? (
                    <><UserPlus className="w-4 h-4 inline mr-1" /> Créer prospect + RDV</>
                  ) : (
                    <><Calendar className="w-4 h-4 inline mr-1" /> Ajouter RDV</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL ÉDITION CALLBACK ═══ */}
      {showEditCallbackModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={() => { setShowEditCallbackModal(false); setEditCallbackId(null) }}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-500" /> Modifier le rappel
              </h3>
              <button onClick={() => { setShowEditCallbackModal(false); setEditCallbackId(null) }}
                className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date</label>
                <input type="date" value={editCallbackForm.callback_date}
                  onChange={e => setEditCallbackForm(f => ({ ...f, callback_date: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 outline-none mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Heure</label>
                <input type="time" value={editCallbackForm.callback_time}
                  onChange={e => setEditCallbackForm(f => ({ ...f, callback_time: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 outline-none mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Notes</label>
                <textarea value={editCallbackForm.notes}
                  onChange={e => setEditCallbackForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Notes..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 outline-none resize-none mt-1" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowEditCallbackModal(false); setEditCallbackId(null) }}
                  className="flex-1 py-2.5 text-sm border rounded-lg hover:bg-gray-50 font-medium text-gray-600">Annuler</button>
                <button onClick={handleUpdateCallback}
                  className="flex-1 py-2.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium shadow-sm">
                  <Check className="w-4 h-4 inline mr-1" /> Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Modale relance IA */}
    {previewData && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {previewData.relanceNum === 1 ? '1ère' : previewData.relanceNum === 2 ? '2ème' : '3ème'} relance — {previewData.quote?.clients?.name || previewData.quote?.reference}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {previewData.isFallback ? '⚠️ Généré sans IA (fallback)' : `✨ Généré par IA · ton ${previewData.tone || 'courtois'}`}
              </p>
            </div>
            <button onClick={cancelPreview} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destinataire</label>
              <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">{previewData.clientEmail}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Objet</label>
              <input type="text" value={relanceEdit.subject}
                onChange={e => setRelanceEdit(prev => ({ ...prev, subject: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Corps du message</label>
              <textarea value={relanceEdit.body}
                onChange={e => setRelanceEdit(prev => ({ ...prev, body: e.target.value }))}
                rows={12}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-sans focus:ring-2 focus:ring-primary-300 focus:border-primary-400" />
            </div>
            <p className="text-xs text-gray-400">La signature sera ajoutée automatiquement. BCC : contact@accessformation.pro</p>
          </div>

          <div className="p-6 border-t border-gray-100 space-y-3">
            {!relanceConfirmed ? (
              <div className="flex items-center justify-between gap-3">
                <button onClick={cancelPreview} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Annuler
                </button>
                <button onClick={() => setRelanceConfirmed(true)}
                  className="px-6 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 flex items-center gap-2">
                  <Send size={15} /> Préparer l'envoi…
                </button>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-3">
                <p className="text-sm font-semibold text-red-700">⚠️ Confirmer l'envoi vers <span className="underline">{previewData.clientEmail}</span> ?</p>
                <p className="text-xs text-red-600">L'email sera envoyé immédiatement et ne pourra pas être annulé.</p>
                <div className="flex items-center justify-between gap-3">
                  <button onClick={() => setRelanceConfirmed(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
                    ← Modifier
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirmSend(relanceEdit.subject, relanceEdit.body)
                      if (ok) { setRelanceConfirmed(false); setDevisRelance(prev => prev.filter(q => q.id !== previewData.quote?.id)) }
                    }}
                    className="px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 flex items-center gap-2">
                    <Send size={15} /> OUI — Envoyer maintenant
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  )
}
