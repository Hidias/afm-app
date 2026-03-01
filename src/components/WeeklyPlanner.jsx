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
  ChevronLeft, ChevronRight, Plus, X, Phone,
  Calendar, Clock, AlertTriangle, Ban, FileText,
  Loader2, Flame, Check, Send, UserPlus, MessageSquare,
  TrendingUp, Zap, Info, ExternalLink, Search, Building2,
  GripVertical, MapPin, User
} from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, isToday, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

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

  // UI — Drag & Drop
  const [dragItem, setDragItem] = useState(null)
  const [dragOverDay, setDragOverDay] = useState(null)

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

  // ── Callback fait ──
  const handleCallbackDone = async (callId) => {
    try {
      await supabase.from('prospect_calls').update({ needs_callback: false }).eq('id', callId)
      toast.success('Rappel marqué fait ✓')
      setCallbacks(prev => prev.filter(c => c.id !== callId))
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  // ── Relance devis ──
  const handleRelanceDevis = async (quote) => {
    const clientEmail = quote.clients?.contact_email
    if (!clientEmail) { toast.error('Pas d\'email — ajouter dans la fiche client'); return }
    const relanceNum = (quote.relance_count || 0) + 1
    if (relanceNum >= 4) {
      toast.error('3 relances déjà envoyées — appeler le client directement')
      return
    }
    if (!confirm(`${relanceNum === 1 ? '1ère' : relanceNum === 2 ? '2ème' : '3ème'} relance à ${quote.clients?.name} (${clientEmail}) — ${quote.reference} ?`)) return
    setRelanceSending(quote.id)
    try {
      const montant = parseFloat(quote.total_ht).toLocaleString('fr-FR', { minimumFractionDigits: 2 })
      const body = relanceNum === 1
        ? `<p>Bonjour,</p><p>Je me permets de revenir vers vous concernant notre devis <strong>${quote.reference}</strong> d'un montant de <strong>${montant} € HT</strong>, envoyé le ${new Date(quote.quote_date).toLocaleDateString('fr-FR')}.</p><p>Avez-vous eu l'occasion d'en prendre connaissance ? Je reste à votre disposition pour en discuter.</p>`
        : relanceNum === 2
        ? `<p>Bonjour,</p><p>Je reviens vers vous au sujet du devis <strong>${quote.reference}</strong> (${montant} € HT). N'ayant pas eu de retour, je souhaitais savoir si cette proposition vous convenait ou si des ajustements seraient nécessaires.</p><p>Je peux vous rappeler si vous préférez en discuter de vive voix.</p>`
        : `<p>Bonjour,</p><p>Dernière relance concernant notre proposition <strong>${quote.reference}</strong> (${montant} € HT). Si ce projet n'est plus d'actualité, n'hésitez pas à me le signaler.</p><p>Dans le cas contraire, je reste disponible pour finaliser les modalités.</p>`

      const res = await fetch('/api/send-prospect-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: clientEmail,
          subject: `${relanceNum > 1 ? 'Relance — ' : ''}Devis ${quote.reference} — Access Formation`,
          body, caller: 'Hicham', clientId: quote.client_id,
          prospectName: quote.clients?.name, templateType: 'relance_devis',
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur serveur')

      const noteDate = new Date().toLocaleDateString('fr-FR')
      await supabase.from('quotes').update({
        relance_count: relanceNum,
        last_relance_date: format(new Date(), 'yyyy-MM-dd'),
        notes: (quote.notes ? quote.notes + '\n' : '') + `📧 ${relanceNum === 1 ? '1ère' : relanceNum === 2 ? '2ème' : '3ème'} relance envoyée le ${noteDate} à ${clientEmail}`,
        updated_at: new Date().toISOString(),
      }).eq('id', quote.id)

      toast.success(`${relanceNum === 1 ? '1ère' : relanceNum === 2 ? '2ème' : '3ème'} relance envoyée ✓`)
      setDevisRelance(prev => prev.filter(q => q.id !== quote.id))
    } catch (err) { toast.error('Erreur: ' + err.message) }
    finally { setRelanceSending(null) }
  }

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
  // SUB-COMPONENTS
  // ═══════════════════════════════════════════════════════════

  const EventItem = ({ event }) => {
    const config = SLOT_TYPES[event.type] || SLOT_TYPES.task
    const isLink = !!event.link
    const canDrag = event.draggable

    return (
      <div
        className={`flex items-start gap-1.5 px-2.5 py-2 rounded-lg ${config.color} group relative transition-all ${
          canDrag ? 'cursor-grab active:cursor-grabbing hover:shadow-sm' : ''
        } ${dragItem?.id === event.id ? 'opacity-30 scale-95' : ''}`}
        draggable={canDrag}
        onDragStart={(e) => handleDragStart(e, event)}
        onDragEnd={handleDragEnd}
      >
        {canDrag && (
          <GripVertical className="w-3 h-3 mt-1 text-current opacity-0 group-hover:opacity-30 flex-shrink-0 -ml-1 transition-opacity" />
        )}
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${config.dot}`} />
        <div className="flex-1 min-w-0">
          {isLink ? (
            <Link to={event.link} className="hover:underline">
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
        {event.callId && (
          <button onClick={() => handleCallbackDone(event.callId)}
            className="p-1 rounded-full hover:bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity" title="Fait ✓">
            <Check className="w-3.5 h-3.5 text-green-600" />
          </button>
        )}
        {event.eventId && (
          <button onClick={() => handleDeleteEvent(event.eventId)}
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

    return (
      <div
        className={`flex flex-col rounded-xl border overflow-hidden transition-all duration-150 ${
          isDropTarget ? 'border-primary-500 ring-2 ring-primary-300 bg-primary-50/30 scale-[1.02] shadow-md' :
          isCurrentDay ? 'border-primary-400 ring-1 ring-primary-200' : 'border-gray-200 hover:shadow-sm'
        }`}
        onDragOver={(e) => handleDragOverDay(e, dateStr)}
        onDragLeave={handleDragLeaveDay}
        onDrop={(e) => handleDropOnDay(e, dateStr)}
      >
        {/* Header jour */}
        <div className={`px-2.5 py-2 text-center border-b transition-colors ${
          isDropTarget ? 'bg-primary-100 border-primary-300' :
          isCurrentDay ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-100'
        }`}>
          <p className={`text-[10px] font-bold uppercase tracking-wide ${isCurrentDay ? 'text-primary-600' : 'text-gray-500'}`}>
            {DAYS[dayIdx]}
          </p>
          <p className={`text-lg font-bold leading-tight ${isCurrentDay ? 'text-primary-800' : 'text-gray-900'}`}>
            {format(date, 'd')}
          </p>
          {/* Badges */}
          <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
            {hasSession && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-medium">🎓 Formation</span>}
            {rdvCount > 0 && <span className="text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-medium">🤝 {rdvCount}</span>}
            {cbCount > 0 && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-medium">📞 {cbCount}</span>}
            {isEmpty && dayIdx < 5 && <span className="text-[8px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">Libre</span>}
          </div>
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
  // RENDU
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
          <Link to="/marine-phoning" className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors flex items-center gap-1 font-medium">
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

      {/* Grille semaine */}
      <div className="grid grid-cols-6 gap-2">
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
          <GripVertical className="w-2.5 h-2.5" /> Glisser-déposer
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
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 text-sm border rounded-lg hover:bg-gray-50 font-medium text-gray-600">Annuler</button>
                <button onClick={handleAddEvent} className="flex-1 py-2.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium shadow-sm">Ajouter</button>
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
                  Nouveau RDV commercial
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
                <button onClick={handleCreateRdv} disabled={rdvSaving}
                  className={`flex-1 py-2.5 text-sm rounded-lg font-medium shadow-sm transition-colors ${
                    rdvMode === 'new'
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } ${rdvSaving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {rdvSaving ? (
                    <><Loader2 className="w-4 h-4 inline animate-spin mr-1" /> Enregistrement...</>
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
    </div>
  )
}
