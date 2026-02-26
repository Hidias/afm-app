// ═══════════════════════════════════════════════════════════════
// WeeklyPlanner.jsx — Planning semaine intelligent
// Widget Dashboard exclusif hicham.saidi@accessformation.pro
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Plus, X, GraduationCap, Phone,
  Calendar, Clock, AlertTriangle, Ban, FileText, Building2,
  TrendingUp, Loader2, ExternalLink, Star, Flame
} from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday, isSameDay, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

// ─── Constantes ──────────────────────────────────────────
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const SLOT_TYPES = {
  session:   { label: 'Formation', color: 'bg-blue-100 border-blue-400 text-blue-800', icon: GraduationCap, emoji: '🎓' },
  rdv:       { label: 'RDV',       color: 'bg-green-100 border-green-400 text-green-800', icon: Calendar, emoji: '🤝' },
  callback:  { label: 'Rappel',    color: 'bg-amber-100 border-amber-400 text-amber-800', icon: Phone, emoji: '📞' },
  relance:   { label: 'Relance',   color: 'bg-red-100 border-red-400 text-red-800', icon: AlertTriangle, emoji: '💰' },
  phoning:   { label: 'Phoning',   color: 'bg-purple-100 border-purple-400 text-purple-800', icon: Phone, emoji: '📞' },
  adm:       { label: 'ADM',       color: 'bg-gray-100 border-gray-300 text-gray-700', icon: FileText, emoji: '📋' },
  indispo:   { label: 'Indispo',   color: 'bg-red-50 border-red-300 text-red-600', icon: Ban, emoji: '🔒' },
  task:      { label: 'Tâche',     color: 'bg-teal-100 border-teal-400 text-teal-800', icon: Clock, emoji: '✅' },
}

// Créneaux type de la journée Lun-Ven
const WEEKDAY_TEMPLATE = [
  { start: '08:00', end: '09:30', type: 'adm',     label: 'ADM / Emails' },
  { start: '09:30', end: '11:30', type: 'phoning',  label: 'Phoning' },
  { start: '11:30', end: '12:00', type: 'adm',      label: 'ADM' },
  // 12h-14h = pause (pas affiché)
  { start: '14:00', end: '14:30', type: 'adm',      label: 'ADM' },
  { start: '14:30', end: '16:30', type: 'phoning',  label: 'Phoning' },
  { start: '16:30', end: '18:00', type: 'adm',      label: 'ADM / Prépa' },
]
const SATURDAY_TEMPLATE = [
  { start: '09:00', end: '12:00', type: 'adm', label: 'ADM / Compta' },
]

// ─── Helpers ─────────────────────────────────────────────
const timeToMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
const minToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const addMinutes = (t, mins) => { const total = timeToMin(t) + mins; return total >= 1080 ? '18:00' : minToTime(total) }
const fmtTime = (t) => t ? t.slice(0, 5) : ''
const overlap = (aStart, aEnd, bStart, bEnd) => {
  const a0 = timeToMin(aStart), a1 = timeToMin(aEnd), b0 = timeToMin(bStart), b1 = timeToMin(bEnd)
  return a0 < b1 && b0 < a1
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
  const [suggestedProspects, setSuggestedProspects] = useState([])

  // UI states
  const [showAddModal, setShowAddModal] = useState(false)
  const [addDate, setAddDate] = useState(null)
  const [addForm, setAddForm] = useState({ event_type: 'indispo', title: '', start_time: '09:00', end_time: '12:00', description: '' })
  const [expandedDay, setExpandedDay] = useState(null) // Pour mobile

  // ─── Calcul des dates de la semaine ─────────────────────
  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 })
    return weekOffset === 0 ? base : addWeeks(base, weekOffset)
  }, [weekOffset])

  const weekDates = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => addDays(weekStart, i))
  , [weekStart])

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
      const [sessR, rdvR, cbR, devisR, evtR] = await Promise.all([
        // Sessions de la semaine (Hicham = ddf1ec18...)
        supabase.from('sessions')
          .select('id, reference, start_date, end_date, start_time, end_time, location_city, status, course_id, client_id, trainer_id, courses(title), clients(name), trainers(first_name, last_name)')
          .gte('start_date', startStr).lte('start_date', endStr)
          .neq('status', 'cancelled'),

        // RDV prospects
        supabase.from('prospect_rdv')
          .select('id, rdv_date, rdv_time, contact_name, conducted_by, status, temperature, notes, formations_interet, clients(name)')
          .gte('rdv_date', startStr).lte('rdv_date', endStr)
          .in('status', ['a_prendre', 'prevu', 'planifie']),

        // Callbacks programmés
        supabase.from('prospect_calls')
          .select('id, callback_date, callback_time, called_by, contact_name, call_result, notes, clients(name, siren)')
          .eq('needs_callback', true)
          .gte('callback_date', startStr).lte('callback_date', endStr)
          .order('callback_date').order('callback_time'),

        // Devis envoyés > 5 jours (relances)
        supabase.from('quotes')
          .select('id, reference, quote_date, total_ht, status, clients(name, phone)')
          .eq('status', 'sent')
          .order('quote_date'),

        // Événements planning personnels
        supabase.from('user_planning_events')
          .select('*')
          .eq('user_id', user?.id)
          .gte('event_date', startStr).lte('event_date', endStr),
      ])

      setSessions(sessR.data || [])
      setRdvs(rdvR.data || [])
      setCallbacks(cbR.data || [])
      setPlanningEvents(evtR.data || [])

      // Calculer les devis à relancer (envoyés > 7 jours)
      const today = new Date()
      const relances = (devisR.data || []).filter(q => {
        const daysSince = Math.floor((today - new Date(q.quote_date)) / 86400000)
        return daysSince >= 7
      }).map(q => ({
        ...q,
        daysSince: Math.floor((today - new Date(q.quote_date)) / 86400000)
      }))
      setDevisRelance(relances)

      // Charger les prospects suggérés pour le phoning auto
      await loadSmartProspects()

    } catch (err) {
      console.error('WeeklyPlanner load error:', err)
    } finally {
      setLoading(false)
    }
  }, [weekStart, user?.id])

  useEffect(() => { if (user?.id) loadWeekData() }, [loadWeekData, user?.id])

  // ─── Algorithme de prospects intelligents ───────────────
  const loadSmartProspects = async () => {
    try {
      // 1. Prospects à rappeler (triés par score × effectif)
      const { data: rappels } = await supabase.from('prospection_massive')
        .select('id, name, city, phone, effectif, departement, naf, quality_score, prospection_status, prospection_notes, contacted_at')
        .eq('prospection_status', 'a_rappeler')
        .eq('do_not_call', false)
        .not('phone', 'is', null)
        .order('quality_score', { ascending: false })
        .limit(30)

      // 2. Prospects jamais contactés, gros effectif, secteurs porteurs
      const { data: nouveaux } = await supabase.from('prospection_massive')
        .select('id, name, city, phone, effectif, departement, naf, quality_score, prospection_status')
        .or('prospection_status.is.null,prospection_status.eq.a_appeler')
        .eq('do_not_call', false)
        .not('phone', 'is', null)
        .in('departement', ['29', '22', '56', '35'])
        .order('quality_score', { ascending: false })
        .limit(30)

      // Scorer et trier
      const scored = [...(rappels || []), ...(nouveaux || [])].map(p => {
        let score = p.quality_score || 50
        // Bonus rappel (déjà un contact)
        if (p.prospection_status === 'a_rappeler') score += 30
        // Bonus effectif (gros = plus de formations)
        const eff = parseInt(p.effectif) || 5
        if (eff >= 40) score += 20
        else if (eff >= 20) score += 10
        // Bonus secteur porteur (BTP, industrie, agro)
        const naf2 = (p.naf || '').substring(0, 2)
        if (['41', '42', '43'].includes(naf2)) score += 15 // BTP
        if (['10', '11', '25', '28'].includes(naf2)) score += 10 // Industrie/Agro
        // Bonus proximité (29 = local)
        if (p.departement === '29') score += 10
        else if (p.departement === '22') score += 5
        return { ...p, _score: score }
      })

      // Dédupliquer par nom
      const seen = new Set()
      const unique = scored.filter(p => {
        const key = p.name + p.city
        if (seen.has(key)) return false
        seen.add(key); return true
      })

      unique.sort((a, b) => b._score - a._score)
      setSuggestedProspects(unique.slice(0, 20))
    } catch (err) {
      console.error('Smart prospects error:', err)
    }
  }

  // ─── Construire les événements par jour ─────────────────
  const dayEvents = useMemo(() => {
    const result = {}

    weekDates.forEach((date, dayIdx) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const isSat = dayIdx === 5
      const events = []

      // 1. Sessions de formation
      sessions.filter(s => {
        // Multi-jour : vérifier si cette date est dans la plage
        const start = s.start_date, end = s.end_date || s.start_date
        return dateStr >= start && dateStr <= end
      }).forEach(s => {
        events.push({
          id: `ses-${s.id}`,
          type: 'session',
          title: s.courses?.title || 'Formation',
          subtitle: s.clients?.name || '',
          time: `${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}`,
          startTime: fmtTime(s.start_time) || '09:00',
          endTime: fmtTime(s.end_time) || '17:00',
          trainer: s.trainers ? `${s.trainers.first_name} ${s.trainers.last_name}` : '',
          location: s.location_city || '',
          link: `/sessions/${s.id}`,
          priority: 0, // Max priority
        })
      })

      // 2. RDV prospects
      rdvs.filter(r => r.rdv_date === dateStr).forEach(r => {
        events.push({
          id: `rdv-${r.id}`,
          type: 'rdv',
          title: r.clients?.name || 'RDV',
          subtitle: r.contact_name ? `👤 ${r.contact_name}` : '',
          time: r.rdv_time ? fmtTime(r.rdv_time) : 'Heure à définir',
          startTime: r.rdv_time ? fmtTime(r.rdv_time) : '09:00',
          endTime: r.rdv_time ? addMinutes(fmtTime(r.rdv_time), 60) : '10:00',
          temperature: r.temperature,
          link: `/prospection/${r.id}`,
          priority: 1,
        })
      })

      // 3. Callbacks (rappels programmés)
      callbacks.filter(c => c.callback_date === dateStr).forEach(c => {
        events.push({
          id: `cb-${c.id}`,
          type: 'callback',
          title: c.clients?.name || 'Rappel',
          subtitle: c.contact_name ? `👤 ${c.contact_name}` : '',
          time: c.callback_time ? fmtTime(c.callback_time) : '',
          startTime: c.callback_time ? fmtTime(c.callback_time) : '10:00',
          endTime: c.callback_time ? addMinutes(fmtTime(c.callback_time), 15) : '10:15',
          calledBy: c.called_by,
          notes: c.notes,
          priority: 2,
        })
      })

      // 4. Planning events (indispos, tâches)
      planningEvents.filter(e => e.event_date === dateStr).forEach(e => {
        events.push({
          id: `evt-${e.id}`,
          type: e.event_type,
          title: e.title,
          subtitle: e.description || '',
          time: `${fmtTime(e.start_time)} – ${fmtTime(e.end_time)}`,
          startTime: fmtTime(e.start_time),
          endTime: fmtTime(e.end_time),
          eventId: e.id, // pour suppression
          priority: e.event_type === 'indispo' ? 0 : 3,
        })
      })

      // 5. Relances devis (affichées le lundi + jeudi = jours forts)
      if (dayIdx === 0 || dayIdx === 3) { // Lun ou Jeu
        devisRelance.forEach((q, i) => {
          if (i >= 3) return // Max 3 relances par créneau
          events.push({
            id: `rel-${q.id}-${dayIdx}`,
            type: 'relance',
            title: `${q.clients?.name || 'Client'} — ${q.reference}`,
            subtitle: `💰 ${parseFloat(q.total_ht).toLocaleString('fr')}€ HT — ${q.daysSince}j`,
            time: '',
            startTime: '09:30',
            endTime: '09:45',
            link: '/devis',
            priority: 1,
          })
        })
      }

      // Trier par heure
      events.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime))

      result[dateStr] = events
    })

    return result
  }, [weekDates, sessions, rdvs, callbacks, devisRelance, planningEvents])

  // ─── Identifier les créneaux phoning libres ─────────────
  const phoningSlots = useMemo(() => {
    const result = {}

    weekDates.forEach((date, dayIdx) => {
      if (dayIdx === 5) return // Pas de phoning le samedi
      const dateStr = format(date, 'yyyy-MM-dd')
      const events = dayEvents[dateStr] || []
      const slots = []

      // Créneaux phoning : 9h30-11h30, 14h30-16h30
      const phoningWindows = [
        { start: '09:30', end: '11:30' },
        { start: '14:30', end: '16:30' },
      ]

      phoningWindows.forEach(window => {
        // Vérifier si le créneau est libre (pas de session, rdv, indispo qui le couvre)
        const blockers = events.filter(e =>
          ['session', 'rdv', 'indispo'].includes(e.type) &&
          overlap(window.start, window.end, e.startTime, e.endTime)
        )

        if (blockers.length === 0) {
          // Créneau libre → compter les callbacks dans ce créneau
          const cbsInSlot = events.filter(e =>
            e.type === 'callback' &&
            overlap(window.start, window.end, e.startTime, e.endTime)
          )
          slots.push({
            ...window,
            callbacks: cbsInSlot.length,
            free: true,
          })
        } else {
          slots.push({ ...window, free: false, blocker: blockers[0]?.title })
        }
      })

      result[dateStr] = slots
    })
    return result
  }, [weekDates, dayEvents])

  // ─── Stats de la semaine ────────────────────────────────
  const weekStats = useMemo(() => {
    let totalSessions = 0, totalRdv = 0, totalCallbacks = 0, totalRelances = devisRelance.length
    let freePhoning = 0

    weekDates.forEach((date, dayIdx) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const events = dayEvents[dateStr] || []
      totalSessions += events.filter(e => e.type === 'session').length
      totalRdv += events.filter(e => e.type === 'rdv').length
      totalCallbacks += events.filter(e => e.type === 'callback').length

      const slots = phoningSlots[dateStr] || []
      freePhoning += slots.filter(s => s.free).length
    })

    const caRelance = devisRelance.reduce((s, q) => s + (parseFloat(q.total_ht) || 0), 0)

    return { totalSessions, totalRdv, totalCallbacks, totalRelances, freePhoning, caRelance }
  }, [weekDates, dayEvents, phoningSlots, devisRelance])

  // ─── Ajouter un événement ──────────────────────────────
  const handleAddEvent = async () => {
    if (!addForm.title.trim()) { toast.error('Titre requis'); return }
    try {
      const { error } = await supabase.from('user_planning_events').insert({
        user_id: user.id,
        event_type: addForm.event_type,
        event_date: format(addDate, 'yyyy-MM-dd'),
        start_time: addForm.start_time,
        end_time: addForm.end_time,
        title: addForm.title.trim(),
        description: addForm.description.trim() || null,
        color: addForm.event_type === 'indispo' ? '#EF4444' : '#6B7280',
      })
      if (error) throw error
      toast.success('Événement ajouté')
      setShowAddModal(false)
      setAddForm({ event_type: 'indispo', title: '', start_time: '09:00', end_time: '12:00', description: '' })
      loadWeekData()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Supprimer cet événement ?')) return
    try {
      await supabase.from('user_planning_events').delete().eq('id', eventId)
      toast.success('Supprimé')
      loadWeekData()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  // ─── Rendu d'un événement ──────────────────────────────
  const EventCard = ({ event }) => {
    const config = SLOT_TYPES[event.type] || SLOT_TYPES.task
    const isLink = !!event.link
    const Wrapper = isLink ? Link : 'div'

    return (
      <Wrapper
        {...(isLink ? { to: event.link } : {})}
        className={`block px-2 py-1.5 rounded border-l-3 text-xs leading-tight transition-all hover:shadow-sm ${config.color} ${isLink ? 'cursor-pointer hover:brightness-95' : ''}`}
        style={{ borderLeftWidth: '3px' }}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span>{config.emoji}</span>
              <span className="font-semibold truncate">{event.title}</span>
              {event.temperature === 'chaud' && <Flame className="w-3 h-3 text-red-500 flex-shrink-0" />}
            </div>
            {event.subtitle && <p className="text-[10px] opacity-75 truncate mt-0.5">{event.subtitle}</p>}
            {event.time && <p className="text-[10px] opacity-60 mt-0.5">{event.time}</p>}
            {event.trainer && event.trainer !== 'Hicham Saidi' && (
              <p className="text-[10px] opacity-60">🧑‍🏫 {event.trainer}</p>
            )}
            {event.location && <p className="text-[10px] opacity-60">📍 {event.location}</p>}
          </div>
          {event.eventId && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteEvent(event.eventId) }}
              className="p-0.5 hover:bg-red-200 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </Wrapper>
    )
  }

  // ─── Rendu prospect suggéré ─────────────────────────────
  const ProspectSuggestion = ({ prospect, rank }) => (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-50 border border-purple-200 text-[10px]">
      <span className="text-purple-400 font-bold">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-purple-800 truncate">{prospect.name}</p>
        <p className="text-purple-500">{prospect.city} · {prospect.phone}</p>
      </div>
      {prospect.prospection_status === 'a_rappeler' && <span className="text-[9px] bg-amber-200 text-amber-800 px-1 rounded">Rappel</span>}
      <a href={`tel:${prospect.phone?.replace(/\s/g, '')}`}
        className="p-1 bg-purple-200 hover:bg-purple-300 rounded text-purple-700" onClick={e => e.stopPropagation()}>
        <Phone className="w-3 h-3" />
      </a>
    </div>
  )

  // ─── Rendu colonne jour ─────────────────────────────────
  const DayColumn = ({ date, dayIdx }) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const events = dayEvents[dateStr] || []
    const slots = phoningSlots[dateStr] || []
    const isSat = dayIdx === 5
    const isCurrentDay = isToday(date)
    const template = isSat ? SATURDAY_TEMPLATE : WEEKDAY_TEMPLATE

    // Sessions Hicham ce jour
    const hichamSessions = events.filter(e => e.type === 'session' && (e.trainer === 'Hicham Saidi' || e.trainer === ''))
    const isFormationDay = hichamSessions.some(s => {
      const dur = timeToMin(s.endTime) - timeToMin(s.startTime)
      return dur >= 300 // > 5h = journée complète
    })

    // Grouper par créneau
    const renderSlots = () => {
      return template.map((tpl, tplIdx) => {
        // Événements dans ce créneau
        const slotEvents = events.filter(e =>
          overlap(tpl.start, tpl.end, e.startTime, e.endTime)
        )

        const isPhoning = tpl.type === 'phoning'
        const hasSession = slotEvents.some(e => e.type === 'session')
        const hasIndispo = slotEvents.some(e => e.type === 'indispo')
        const isFree = isPhoning && !hasSession && !hasIndispo

        // Prospects suggérés pour ce créneau
        const slotProspects = isFree ? suggestedProspects.slice(
          tplIdx === 1 ? 0 : 5, // matin: 0-4, après-midi: 5-9
          tplIdx === 1 ? 5 : 10
        ) : []

        return (
          <div key={tplIdx} className={`rounded-lg p-1.5 ${
            hasSession ? 'bg-blue-50/50' :
            hasIndispo ? 'bg-red-50/30' :
            isPhoning ? 'bg-purple-50/30' :
            'bg-gray-50/50'
          }`}>
            {/* En-tête créneau */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-medium text-gray-400">{tpl.start}–{tpl.end}</span>
              {isPhoning && isFree && (
                <span className="text-[9px] bg-purple-200 text-purple-700 px-1 rounded-full">Phoning</span>
              )}
              {hasSession && <span className="text-[9px] bg-blue-200 text-blue-700 px-1 rounded-full">Formation</span>}
            </div>

            {/* Événements */}
            {slotEvents.length > 0 ? (
              <div className="space-y-1 group">
                {slotEvents.map(e => <EventCard key={e.id} event={e} />)}
              </div>
            ) : isPhoning ? (
              // Créneau phoning libre → suggestions
              <div className="space-y-1">
                {/* Relances devis en priorité */}
                {devisRelance.length > 0 && tplIdx === 1 && (dayIdx === 0 || dayIdx === 3) && (
                  <div className="px-2 py-1.5 rounded bg-red-50 border border-red-200 border-l-3 text-[10px]" style={{ borderLeftWidth: '3px', borderLeftColor: '#EF4444' }}>
                    <div className="flex items-center gap-1 font-semibold text-red-700">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{devisRelance.length} devis à relancer</span>
                    </div>
                    {devisRelance.slice(0, 2).map(q => (
                      <p key={q.id} className="text-red-600 truncate mt-0.5">
                        💰 {q.clients?.name} — {parseFloat(q.total_ht).toLocaleString('fr')}€ ({q.daysSince}j)
                      </p>
                    ))}
                  </div>
                )}
                {/* Prospects à appeler */}
                {slotProspects.map((p, i) => (
                  <ProspectSuggestion key={p.id} prospect={p} rank={i + 1} />
                ))}
                {slotProspects.length === 0 && devisRelance.length === 0 && (
                  <p className="text-[10px] text-gray-300 italic text-center py-2">Créneau libre</p>
                )}
              </div>
            ) : (
              // Créneau ADM vide
              <p className="text-[10px] text-gray-300 italic text-center py-1">{tpl.label}</p>
            )}
          </div>
        )
      })
    }

    return (
      <div className={`flex flex-col rounded-xl border ${
        isCurrentDay ? 'border-primary-400 bg-primary-50/20 shadow-sm' : 'border-gray-200'
      } overflow-hidden`}>
        {/* Header du jour */}
        <div className={`px-2 py-1.5 text-center border-b ${
          isCurrentDay ? 'bg-primary-100 border-primary-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <p className={`text-xs font-bold ${isCurrentDay ? 'text-primary-700' : 'text-gray-700'}`}>
            {DAYS[dayIdx]}
          </p>
          <p className={`text-lg font-bold ${isCurrentDay ? 'text-primary-800' : 'text-gray-900'}`}>
            {format(date, 'd')}
          </p>
          {isFormationDay && (
            <span className="inline-block text-[9px] bg-blue-500 text-white px-1.5 rounded-full mt-0.5">🎓 Formation</span>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 p-1.5 space-y-1 min-h-[200px]">
          {renderSlots()}
        </div>

        {/* Bouton ajouter */}
        <button
          onClick={() => { setAddDate(date); setShowAddModal(true) }}
          className="w-full py-1.5 text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
        >
          <Plus className="w-3 h-3 inline" /> Ajouter
        </button>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // RENDU PRINCIPAL
  // ═══════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
        <span className="ml-2 text-sm text-gray-500">Chargement du planning...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ─── Header : navigation + stats ────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setWeekOffset(0)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              weekOffset === 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            Aujourd'hui
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700">{weekLabel}</span>
        </div>

        {/* Stats rapides */}
        <div className="flex items-center gap-3 text-xs">
          {weekStats.totalSessions > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
              🎓 {weekStats.totalSessions} formation{weekStats.totalSessions > 1 ? 's' : ''}
            </span>
          )}
          {weekStats.totalRdv > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full">
              🤝 {weekStats.totalRdv} RDV
            </span>
          )}
          {weekStats.totalCallbacks > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-full">
              📞 {weekStats.totalCallbacks} rappel{weekStats.totalCallbacks > 1 ? 's' : ''}
            </span>
          )}
          {weekStats.totalRelances > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-full font-bold">
              💰 {weekStats.caRelance.toLocaleString('fr')}€ à relancer
            </span>
          )}
          {weekStats.freePhoning > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-full">
              📞 {weekStats.freePhoning} créneau{weekStats.freePhoning > 1 ? 'x' : ''} phoning
            </span>
          )}
        </div>
      </div>

      {/* ─── Grille semaine ─────────────────────────────── */}
      <div className="grid grid-cols-6 gap-2">
        {weekDates.map((date, idx) => (
          <DayColumn key={format(date, 'yyyy-MM-dd')} date={date} dayIdx={idx} />
        ))}
      </div>

      {/* ─── Légende ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 justify-center">
        {Object.entries(SLOT_TYPES).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${cfg.color.split(' ')[0]}`} />
            {cfg.label}
          </span>
        ))}
      </div>

      {/* ─── Modal ajout événement ──────────────────────── */}
      {showAddModal && addDate && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">
                Ajouter — {format(addDate, 'EEEE d MMMM', { locale: fr })}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                <div className="flex gap-2">
                  {[
                    { value: 'indispo', label: '🔒 Indispo' },
                    { value: 'adm', label: '📋 ADM' },
                    { value: 'task', label: '✅ Tâche' },
                    { value: 'phoning_manual', label: '📞 Phoning' },
                  ].map(opt => (
                    <button key={opt.value}
                      onClick={() => setAddForm(f => ({ ...f, event_type: opt.value }))}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                        addForm.event_type === opt.value
                          ? 'bg-primary-100 border-primary-500 text-primary-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Titre</label>
                <input type="text" value={addForm.title}
                  onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={addForm.event_type === 'indispo' ? 'Ex: Médecin, Perso...' : 'Ex: Préparer devis IJINUS'}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Début</label>
                  <input type="time" value={addForm.start_time}
                    onChange={e => setAddForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Fin</label>
                  <input type="time" value={addForm.end_time}
                    onChange={e => setAddForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notes (optionnel)</label>
                <input type="text" value={addForm.description}
                  onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 text-sm border rounded-lg hover:bg-gray-50">
                  Annuler
                </button>
                <button onClick={handleAddEvent}
                  className="flex-1 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
