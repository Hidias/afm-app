// ═══════════════════════════════════════════════════════════════
// WeeklyPlanner.jsx — Planning semaine intelligent v2
// Widget Dashboard exclusif hicham.saidi@accessformation.pro
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Plus, X, GraduationCap, Phone,
  Calendar, Clock, AlertTriangle, Ban, FileText, Building2,
  TrendingUp, Loader2, ExternalLink, Star, Flame, Trash2,
  Check, MoreVertical
} from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

// ─── Constantes ──────────────────────────────────────────
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const SLOT_TYPES = {
  session:   { label: 'Formation', color: 'bg-blue-100 border-blue-400 text-blue-800', emoji: '🎓', border: '#3B82F6' },
  rdv:       { label: 'RDV',       color: 'bg-green-100 border-green-400 text-green-800', emoji: '🤝', border: '#22C55E' },
  callback:  { label: 'Rappel',    color: 'bg-amber-100 border-amber-400 text-amber-800', emoji: '📞', border: '#F59E0B' },
  relance:   { label: 'Relance',   color: 'bg-red-100 border-red-400 text-red-800', emoji: '💰', border: '#EF4444' },
  phoning:   { label: 'Phoning',   color: 'bg-purple-100 border-purple-400 text-purple-800', emoji: '📞', border: '#8B5CF6' },
  adm:       { label: 'ADM',       color: 'bg-gray-100 border-gray-300 text-gray-700', emoji: '📋', border: '#9CA3AF' },
  indispo:   { label: 'Indispo',   color: 'bg-red-50 border-red-300 text-red-600', emoji: '🔒', border: '#EF4444' },
  task:      { label: 'Tâche',     color: 'bg-teal-100 border-teal-400 text-teal-800', emoji: '✅', border: '#14B8A6' },
  phoning_manual: { label: 'Phoning', color: 'bg-purple-100 border-purple-400 text-purple-800', emoji: '📞', border: '#8B5CF6' },
}

// Créneaux type Lun-Ven
const WEEKDAY_TEMPLATE = [
  { start: '08:00', end: '09:30', type: 'adm',     label: 'ADM / Emails' },
  { start: '09:30', end: '11:30', type: 'phoning',  label: 'Phoning' },
  { start: '11:30', end: '12:00', type: 'adm',      label: 'ADM' },
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
const addMinutesToTime = (t, mins) => { const total = timeToMin(t) + mins; return total >= 1080 ? '18:00' : minToTime(total) }
const fmtTime = (t) => t ? t.slice(0, 5) : ''
const overlap = (aStart, aEnd, bStart, bEnd) => {
  const a0 = timeToMin(aStart), a1 = timeToMin(aEnd), b0 = timeToMin(bStart), b1 = timeToMin(bEnd)
  return a0 < b1 && b0 < a1
}
const normalizeClientName = (name) => (name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase()

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function WeeklyPlanner() {
  const { user } = useAuthStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const [sessions, setSessions] = useState([])
  const [rdvs, setRdvs] = useState([])
  const [callbacks, setCallbacks] = useState([])
  const [devisRelance, setDevisRelance] = useState([])
  const [planningEvents, setPlanningEvents] = useState([])
  const [suggestedProspects, setSuggestedProspects] = useState([])

  const [showAddModal, setShowAddModal] = useState(false)
  const [addDate, setAddDate] = useState(null)
  const [addForm, setAddForm] = useState({ event_type: 'indispo', title: '', start_time: '09:00', end_time: '12:00', description: '' })
  const [relanceSending, setRelanceSending] = useState(null) // quote id en cours d'envoi

  // ─── Calcul des dates ───────────────────────────────────
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
        // Sessions — on filtre Hicham côté client
        supabase.from('sessions')
          .select('id, reference, start_date, end_date, start_time, end_time, location_city, status, course_id, client_id, trainer_id, courses(title), clients(name), trainers(first_name, last_name)')
          .gte('start_date', startStr).lte('start_date', endStr)
          .neq('status', 'cancelled'),

        // ✅ RDV — Hicham uniquement
        supabase.from('prospect_rdv')
          .select('id, rdv_date, rdv_time, contact_name, conducted_by, status, temperature, notes, formations_interet, client_id, clients(name)')
          .gte('rdv_date', startStr).lte('rdv_date', endStr)
          .eq('conducted_by', 'Hicham')
          .in('status', ['a_prendre', 'prevu', 'planifie']),

        // ✅ Callbacks — Hicham uniquement
        supabase.from('prospect_calls')
          .select('id, callback_date, callback_time, called_by, contact_name, call_result, notes, client_id, clients(name, siren)')
          .eq('needs_callback', true)
          .eq('called_by', 'Hicham')
          .gte('callback_date', startStr).lte('callback_date', endStr)
          .order('callback_date').order('callback_time'),

        // Devis envoyés (relances) — avec email client pour relance directe
        supabase.from('quotes')
          .select('id, reference, quote_date, total_ht, status, client_id, clients(name, phone, contact_email)')
          .eq('status', 'sent')
          .order('quote_date'),

        // Événements planning personnels
        supabase.from('user_planning_events')
          .select('*')
          .eq('user_id', user?.id)
          .gte('event_date', startStr).lte('event_date', endStr),
      ])

      // ✅ SESSIONS : Hicham uniquement
      const allSessions = sessR.data || []
      const hichamSessions = allSessions.filter(s => {
        const name = s.trainers ? `${s.trainers.first_name || ''} ${s.trainers.last_name || ''}`.toLowerCase().trim() : ''
        return name.includes('hicham') || name === '' || !s.trainers
      })
      setSessions(hichamSessions)

      const rdvData = rdvR.data || []
      setRdvs(rdvData)
      setPlanningEvents(evtR.data || [])

      // ✅ CALLBACKS : Dédupliquer avec les RDV (même client = pas de doublon)
      const rdvClientIds = new Set(rdvData.map(r => r.client_id).filter(Boolean))
      const rdvClientNames = new Set(rdvData.map(r => normalizeClientName(r.clients?.name)).filter(n => n))

      const dedupCallbacks = (cbR.data || []).filter(c => {
        if (c.client_id && rdvClientIds.has(c.client_id)) return false
        if (c.clients?.name && rdvClientNames.has(normalizeClientName(c.clients?.name))) return false
        return true
      })
      setCallbacks(dedupCallbacks)

      // Devis à relancer (> 7 jours)
      const today = new Date()
      const relances = (devisR.data || []).filter(q => {
        const daysSince = Math.floor((today - new Date(q.quote_date)) / 86400000)
        return daysSince >= 7
      }).map(q => ({
        ...q,
        daysSince: Math.floor((today - new Date(q.quote_date)) / 86400000)
      }))
      setDevisRelance(relances)

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
      const { data: rappels } = await supabase.from('prospection_massive')
        .select('id, name, city, phone, effectif, departement, naf, quality_score, prospection_status')
        .eq('prospection_status', 'a_rappeler')
        .eq('do_not_call', false)
        .not('phone', 'is', null)
        .order('quality_score', { ascending: false })
        .limit(30)

      const { data: nouveaux } = await supabase.from('prospection_massive')
        .select('id, name, city, phone, effectif, departement, naf, quality_score, prospection_status')
        .or('prospection_status.is.null,prospection_status.eq.a_appeler')
        .eq('do_not_call', false)
        .not('phone', 'is', null)
        .in('departement', ['29', '22', '56', '35'])
        .order('quality_score', { ascending: false })
        .limit(30)

      const scored = [...(rappels || []), ...(nouveaux || [])].map(p => {
        let score = p.quality_score || 50
        if (p.prospection_status === 'a_rappeler') score += 30
        const eff = parseInt(p.effectif) || 5
        if (eff >= 40) score += 20
        else if (eff >= 20) score += 10
        const naf2 = (p.naf || '').substring(0, 2)
        if (['41', '42', '43'].includes(naf2)) score += 15
        if (['10', '11', '25', '28'].includes(naf2)) score += 10
        if (p.departement === '29') score += 10
        else if (p.departement === '22') score += 5
        return { ...p, _score: score }
      })

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
      const events = []

      // 1. Sessions Hicham (filtré au chargement)
      sessions.filter(s => {
        const start = s.start_date, end = s.end_date || s.start_date
        return dateStr >= start && dateStr <= end
      }).forEach(s => {
        events.push({
          id: `ses-${s.id}`, type: 'session',
          title: s.courses?.title || 'Formation',
          subtitle: s.clients?.name || '',
          time: `${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}`,
          startTime: fmtTime(s.start_time) || '09:00',
          endTime: fmtTime(s.end_time) || '17:00',
          location: s.location_city || '',
          link: `/sessions/${s.id}`,
          priority: 0,
        })
      })

      // 2. RDV Hicham
      rdvs.filter(r => r.rdv_date === dateStr).forEach(r => {
        events.push({
          id: `rdv-${r.id}`, type: 'rdv',
          title: r.clients?.name || 'RDV',
          subtitle: r.contact_name ? `👤 ${r.contact_name}` : '',
          time: r.rdv_time ? fmtTime(r.rdv_time) : 'Heure à définir',
          startTime: r.rdv_time ? fmtTime(r.rdv_time) : '09:00',
          endTime: r.rdv_time ? addMinutesToTime(fmtTime(r.rdv_time), 60) : '10:00',
          temperature: r.temperature,
          formations: r.formations_interet,
          link: `/prospection`,
          priority: 1,
        })
      })

      // 3. Callbacks Hicham (dédupliqués)
      callbacks.filter(c => c.callback_date === dateStr).forEach(c => {
        events.push({
          id: `cb-${c.id}`, type: 'callback',
          title: c.clients?.name || 'Rappel',
          subtitle: c.contact_name ? `👤 ${c.contact_name}` : '',
          time: c.callback_time ? fmtTime(c.callback_time) : '',
          startTime: c.callback_time ? fmtTime(c.callback_time) : '10:00',
          endTime: c.callback_time ? addMinutesToTime(fmtTime(c.callback_time), 15) : '10:15',
          notes: c.notes,
          callId: c.id, // pour le bouton "fait"
          priority: 2,
        })
      })

      // 4. Planning events manuels (indispos, tâches)
      planningEvents.filter(e => e.event_date === dateStr).forEach(e => {
        events.push({
          id: `evt-${e.id}`, type: e.event_type,
          title: e.title,
          subtitle: e.description || '',
          time: `${fmtTime(e.start_time)} – ${fmtTime(e.end_time)}`,
          startTime: fmtTime(e.start_time),
          endTime: fmtTime(e.end_time),
          eventId: e.id,
          priority: e.event_type === 'indispo' ? 0 : 3,
        })
      })

      events.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime))
      result[dateStr] = events
    })

    return result
  }, [weekDates, sessions, rdvs, callbacks, planningEvents])

  // ─── Stats semaine ──────────────────────────────────────
  const weekStats = useMemo(() => {
    let totalSessions = 0, totalRdv = 0, totalCallbacks = 0, freePhoning = 0

    weekDates.forEach((date, dayIdx) => {
      if (dayIdx === 5) return
      const dateStr = format(date, 'yyyy-MM-dd')
      const events = dayEvents[dateStr] || []
      totalSessions += events.filter(e => e.type === 'session').length
      totalRdv += events.filter(e => e.type === 'rdv').length
      totalCallbacks += events.filter(e => e.type === 'callback').length

      // Compter créneaux phoning libres
      const phoningWindows = [{ start: '09:30', end: '11:30' }, { start: '14:30', end: '16:30' }]
      phoningWindows.forEach(w => {
        const blocked = events.some(e =>
          ['session', 'rdv', 'indispo'].includes(e.type) &&
          overlap(w.start, w.end, e.startTime, e.endTime)
        )
        if (!blocked) freePhoning++
      })
    })

    const caRelance = devisRelance.reduce((s, q) => s + (parseFloat(q.total_ht) || 0), 0)
    return { totalSessions, totalRdv, totalCallbacks, totalRelances: devisRelance.length, freePhoning, caRelance }
  }, [weekDates, dayEvents, devisRelance])

  // ─── Actions ───────────────────────────────────────────
  const handleAddEvent = async () => {
    if (!addForm.title.trim()) { toast.error('Titre requis'); return }
    if (timeToMin(addForm.start_time) >= timeToMin(addForm.end_time)) { toast.error('L\'heure de fin doit être après le début'); return }
    try {
      const { error } = await supabase.from('user_planning_events').insert({
        user_id: user.id,
        event_type: addForm.event_type,
        event_date: format(addDate, 'yyyy-MM-dd'),
        start_time: addForm.start_time,
        end_time: addForm.end_time,
        title: addForm.title.trim(),
        description: addForm.description.trim() || null,
        color: addForm.event_type === 'indispo' ? '#EF4444' : addForm.event_type === 'adm' ? '#6B7280' : '#8B5CF6',
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

  // ✅ Feature 1 : Marquer un callback comme "fait"
  const handleCallbackDone = async (callId) => {
    try {
      const { error } = await supabase.from('prospect_calls')
        .update({ needs_callback: false })
        .eq('id', callId)
      if (error) throw error
      toast.success('Rappel marqué comme fait')
      setCallbacks(prev => prev.filter(c => c.id !== callId))
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  // ✅ Feature 3 : Relance devis par email
  const handleRelanceDevis = async (quote) => {
    const clientEmail = quote.clients?.contact_email
    if (!clientEmail) {
      toast.error('Pas d\'email pour ce client — ajouter dans la fiche client')
      return
    }
    if (!confirm(`Envoyer une relance à ${quote.clients?.name} (${clientEmail}) pour le devis ${quote.reference} ?`)) return

    setRelanceSending(quote.id)
    try {
      const montant = parseFloat(quote.total_ht).toLocaleString('fr-FR', { minimumFractionDigits: 2 })
      const body = `
        <p>Bonjour,</p>
        <p>Je me permets de revenir vers vous concernant notre devis <strong>${quote.reference}</strong> 
        d'un montant de <strong>${montant} € HT</strong>, envoyé le ${new Date(quote.quote_date).toLocaleDateString('fr-FR')}.</p>
        <p>Je souhaitais savoir si vous aviez eu l'occasion d'en prendre connaissance et si vous aviez des questions 
        ou des ajustements à apporter.</p>
        <p>Je reste à votre entière disposition pour en discuter par téléphone ou pour planifier un rendez-vous.</p>
      `

      const res = await fetch('/api/send-prospect-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: clientEmail,
          subject: `Relance devis ${quote.reference} — Access Formation`,
          body,
          caller: 'Hicham',
          clientId: quote.client_id,
          prospectName: quote.clients?.name,
          templateType: 'relance_devis',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur serveur')
      }

      toast.success(`Relance envoyée à ${clientEmail}`)
      // Retirer le devis de la liste visuelle (il reste en BDD avec status 'sent')
      setDevisRelance(prev => prev.filter(q => q.id !== quote.id))
    } catch (err) {
      toast.error('Erreur envoi: ' + err.message)
    } finally {
      setRelanceSending(null)
    }
  }

  // ─── Rendu d'un événement ──────────────────────────────
  const EventCard = ({ event }) => {
    const config = SLOT_TYPES[event.type] || SLOT_TYPES.task
    const isLink = !!event.link
    const isDeletable = !!event.eventId
    const isCallback = !!event.callId
    const Wrapper = isLink ? Link : 'div'

    return (
      <div className="relative group">
        <Wrapper
          {...(isLink ? { to: event.link } : {})}
          className={`block px-2 py-1.5 rounded text-xs leading-tight transition-all hover:shadow-sm ${config.color} ${isLink ? 'cursor-pointer hover:brightness-95' : ''}`}
          style={{ borderLeft: `3px solid ${config.border}` }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[10px]">{config.emoji}</span>
              <span className="font-semibold truncate text-[11px]">{event.title}</span>
              {event.temperature === 'chaud' && <Flame className="w-3 h-3 text-red-500 flex-shrink-0" />}
            </div>
            {event.subtitle && <p className="text-[10px] opacity-75 truncate mt-0.5">{event.subtitle}</p>}
            {event.time && <p className="text-[10px] opacity-60 mt-0.5">{event.time}</p>}
            {event.location && <p className="text-[10px] opacity-60">📍 {event.location}</p>}
            {event.formations && event.formations.length > 0 && (
              <p className="text-[9px] opacity-50 truncate mt-0.5">{event.formations.slice(0, 2).join(', ')}</p>
            )}
          </div>
        </Wrapper>
        {/* ✅ Bouton "Fait" pour callbacks */}
        {isCallback && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCallbackDone(event.callId) }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-green-500 text-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center"
            title="Marquer comme fait"
          >
            <Check className="w-2.5 h-2.5" />
          </button>
        )}
        {/* Bouton supprimer pour events manuels */}
        {isDeletable && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteEvent(event.eventId) }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center"
            title="Supprimer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    )
  }

  // ─── Prospect suggéré ──────────────────────────────────
  const ProspectSuggestion = ({ prospect, rank }) => (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-50 border border-purple-200 text-[10px]">
      <span className="text-purple-400 font-bold w-3 text-center">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-purple-800 truncate">{prospect.name}</p>
        <p className="text-purple-500 truncate">{prospect.city} · {prospect.departement}</p>
      </div>
      {prospect.prospection_status === 'a_rappeler' && (
        <span className="text-[9px] bg-amber-200 text-amber-800 px-1 rounded flex-shrink-0">Rappel</span>
      )}
      {prospect.phone && (
        <a href={`tel:${prospect.phone.replace(/\s/g, '')}`}
          className="p-1 bg-purple-200 hover:bg-purple-300 rounded text-purple-700 flex-shrink-0"
          onClick={e => e.stopPropagation()}>
          <Phone className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  )

  // ─── Colonne jour ──────────────────────────────────────
  const DayColumn = ({ date, dayIdx }) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const events = dayEvents[dateStr] || []
    const isSat = dayIdx === 5
    const isCurrentDay = isToday(date)
    const template = isSat ? SATURDAY_TEMPLATE : WEEKDAY_TEMPLATE

    const isFormationDay = events.some(e => {
      if (e.type !== 'session') return false
      return (timeToMin(e.endTime) - timeToMin(e.startTime)) >= 300
    })

    const rdvCount = events.filter(e => e.type === 'rdv').length
    const cbCount = events.filter(e => e.type === 'callback').length

    let prospectIdx = 0

    const renderSlots = () => {
      return template.map((tpl, tplIdx) => {
        const slotEvents = events.filter(e =>
          overlap(tpl.start, tpl.end, e.startTime, e.endTime)
        )

        const isPhoning = tpl.type === 'phoning'
        const hasSession = slotEvents.some(e => e.type === 'session')
        const hasIndispo = slotEvents.some(e => e.type === 'indispo')
        const hasRdv = slotEvents.some(e => e.type === 'rdv')
        // ✅ Pas de phoning si session, indispo OU RDV dans le créneau
        const isBlocked = hasSession || hasIndispo || hasRdv
        const isFreePhoning = isPhoning && !isBlocked

        const showRelances = isFreePhoning && tplIdx === 1 && devisRelance.length > 0

        const slotProspects = isFreePhoning ? suggestedProspects.slice(prospectIdx, prospectIdx + 4) : []
        if (isFreePhoning) prospectIdx += 4

        return (
          <div key={tplIdx} className={`rounded-lg p-1.5 ${
            hasSession ? 'bg-blue-50/50' :
            hasIndispo ? 'bg-red-50/30' :
            hasRdv ? 'bg-green-50/30' :
            isPhoning ? 'bg-purple-50/30' :
            'bg-gray-50/50'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-medium text-gray-400">{tpl.start}–{tpl.end}</span>
              {hasSession && <span className="text-[9px] bg-blue-200 text-blue-700 px-1 rounded-full">Formation</span>}
              {hasRdv && !hasSession && <span className="text-[9px] bg-green-200 text-green-700 px-1 rounded-full">RDV</span>}
              {isFreePhoning && !hasRdv && <span className="text-[9px] bg-purple-200 text-purple-700 px-1 rounded-full">Phoning</span>}
            </div>

            {/* Événements réels */}
            {slotEvents.length > 0 && (
              <div className="space-y-1">
                {slotEvents.map(e => <EventCard key={e.id} event={e} />)}
              </div>
            )}

            {/* ✅ Suggestions phoning SEULEMENT si créneau LIBRE (pas de session, rdv, indispo) */}
            {isFreePhoning && slotEvents.filter(e => !['callback'].includes(e.type)).length === 0 && (
              <div className="space-y-1 mt-1">
                {showRelances && (
                  <div className="px-2 py-1.5 rounded bg-red-50 border border-red-200 text-[10px]" style={{ borderLeft: '3px solid #EF4444' }}>
                    <div className="flex items-center gap-1 font-semibold text-red-700">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{devisRelance.length} devis à relancer</span>
                    </div>
                    {devisRelance.slice(0, 3).map(q => (
                      <div key={q.id} className="flex items-center justify-between mt-1 gap-1">
                        <p className="text-red-600 truncate flex-1">
                          💰 {q.clients?.name} — {parseFloat(q.total_ht).toLocaleString('fr')}€ ({q.daysSince}j)
                        </p>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRelanceDevis(q) }}
                          disabled={relanceSending === q.id}
                          className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                            relanceSending === q.id
                              ? 'bg-gray-200 text-gray-400'
                              : q.clients?.contact_email
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                          title={q.clients?.contact_email ? `Relancer ${q.clients.contact_email}` : 'Pas d\'email client'}
                        >
                          {relanceSending === q.id ? '⏳' : '✉️'} Relancer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {slotProspects.map((p, i) => (
                  <ProspectSuggestion key={p.id} prospect={p} rank={prospectIdx - 4 + i + 1} />
                ))}
                {slotProspects.length === 0 && !showRelances && (
                  <p className="text-[10px] text-gray-300 italic text-center py-2">Créneau libre</p>
                )}
              </div>
            )}

            {/* Créneau ADM vide */}
            {!isPhoning && slotEvents.length === 0 && (
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
        {/* Header */}
        <div className={`px-2 py-1.5 text-center border-b ${
          isCurrentDay ? 'bg-primary-100 border-primary-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <p className={`text-xs font-bold ${isCurrentDay ? 'text-primary-700' : 'text-gray-700'}`}>{DAYS[dayIdx]}</p>
          <p className={`text-lg font-bold leading-tight ${isCurrentDay ? 'text-primary-800' : 'text-gray-900'}`}>{format(date, 'd')}</p>
          <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
            {isFormationDay && <span className="text-[8px] bg-blue-500 text-white px-1 rounded-full">🎓</span>}
            {rdvCount > 0 && <span className="text-[8px] bg-green-500 text-white px-1 rounded-full">🤝 {rdvCount}</span>}
            {cbCount > 0 && <span className="text-[8px] bg-amber-500 text-white px-1 rounded-full">📞 {cbCount}</span>}
          </div>
        </div>

        {/* Créneaux */}
        <div className="flex-1 p-1.5 space-y-1 min-h-[200px]">
          {renderSlots()}
        </div>

        {/* ✅ Bouton ajouter */}
        <button
          onClick={() => { setAddDate(date); setShowAddModal(true) }}
          className="w-full py-2 text-xs text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors border-t border-gray-100 flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setWeekOffset(0)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              weekOffset === 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            Aujourd'hui
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700">{weekLabel}</span>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          {weekStats.totalSessions > 0 && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">🎓 {weekStats.totalSessions}</span>
          )}
          {weekStats.totalRdv > 0 && (
            <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full">🤝 {weekStats.totalRdv}</span>
          )}
          {weekStats.totalCallbacks > 0 && (
            <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full">📞 {weekStats.totalCallbacks}</span>
          )}
          {weekStats.totalRelances > 0 && (
            <span className="px-2 py-1 bg-red-50 text-red-700 rounded-full font-bold">💰 {weekStats.caRelance.toLocaleString('fr')}€</span>
          )}
          {weekStats.freePhoning > 0 && (
            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full">📞 {weekStats.freePhoning} créneaux</span>
          )}
        </div>
      </div>

      {/* Grille semaine */}
      <div className="grid grid-cols-6 gap-2">
        {weekDates.map((date, idx) => (
          <DayColumn key={format(date, 'yyyy-MM-dd')} date={date} dayIdx={idx} />
        ))}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 justify-center">
        {['session', 'rdv', 'callback', 'relance', 'phoning', 'adm', 'indispo'].map(key => (
          <span key={key} className="flex items-center gap-1">
            <span>{SLOT_TYPES[key].emoji}</span> {SLOT_TYPES[key].label}
          </span>
        ))}
      </div>

      {/* ═══ Modal ajout ═══ */}
      {showAddModal && addDate && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">
                {format(addDate, 'EEEE d MMMM', { locale: fr })}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'indispo', emoji: '🔒', label: 'Indisponibilité', desc: 'Médecin, perso, congé...' },
                    { value: 'adm', emoji: '📋', label: 'ADM / Compta', desc: 'Tâche administrative' },
                    { value: 'task', emoji: '✅', label: 'Tâche', desc: 'Préparer devis, docs...' },
                    { value: 'phoning_manual', emoji: '📞', label: 'Phoning', desc: 'Bloc phoning manuel' },
                  ].map(opt => (
                    <button key={opt.value}
                      onClick={() => setAddForm(f => ({ ...f, event_type: opt.value }))}
                      className={`p-3 text-left rounded-lg border-2 transition-all ${
                        addForm.event_type === opt.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className="text-lg">{opt.emoji}</span>
                      <p className={`text-xs font-semibold mt-1 ${addForm.event_type === opt.value ? 'text-primary-700' : 'text-gray-700'}`}>{opt.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Titre</label>
                <input type="text" value={addForm.title}
                  onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={
                    addForm.event_type === 'indispo' ? 'Ex: Médecin, Congé...' :
                    addForm.event_type === 'adm' ? 'Ex: Compta, Facturation...' :
                    addForm.event_type === 'task' ? 'Ex: Préparer devis IJINUS' :
                    'Ex: Phoning BTP 29'
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none"
                  autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Début</label>
                  <input type="time" value={addForm.start_time}
                    onChange={e => setAddForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Fin</label>
                  <input type="time" value={addForm.end_time}
                    onChange={e => setAddForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none" />
                </div>
              </div>

              {/* Raccourcis durée */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Matin', s: '08:00', e: '12:00' },
                  { label: 'Après-midi', s: '14:00', e: '18:00' },
                  { label: 'Journée', s: '08:00', e: '18:00' },
                  { label: '1h', s: addForm.start_time, e: addMinutesToTime(addForm.start_time, 60) },
                  { label: '2h', s: addForm.start_time, e: addMinutesToTime(addForm.start_time, 120) },
                ].map(q => (
                  <button key={q.label}
                    onClick={() => setAddForm(f => ({ ...f, start_time: q.s, end_time: q.e }))}
                    className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors">
                    {q.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notes (optionnel)</label>
                <input type="text" value={addForm.description}
                  onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Détails..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none" />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-600">
                  Annuler
                </button>
                <button onClick={handleAddEvent}
                  className="flex-1 py-2.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium shadow-sm">
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
