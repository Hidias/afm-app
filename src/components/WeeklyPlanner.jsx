// ═══════════════════════════════════════════════════════════════
// WeeklyPlanner.jsx — Planning semaine intelligent v3
// Cockpit d'action : appels, relances, rotation intelligente
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Plus, X, Phone,
  Calendar, Clock, AlertTriangle, Ban, FileText,
  Loader2, Flame, Check, Send, UserPlus, MessageSquare,
  TrendingUp, Zap, Info
} from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, isToday, isSameDay, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

// ─── Constantes ──────────────────────────────────────────
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const SLOT_TYPES = {
  session:        { label: 'Formation', color: 'bg-blue-100 border-blue-400 text-blue-800', emoji: '🎓', border: '#3B82F6' },
  rdv:            { label: 'RDV',       color: 'bg-green-100 border-green-400 text-green-800', emoji: '🤝', border: '#22C55E' },
  callback:       { label: 'Rappel',    color: 'bg-amber-100 border-amber-400 text-amber-800', emoji: '📞', border: '#F59E0B' },
  relance:        { label: 'Relance',   color: 'bg-red-100 border-red-400 text-red-800', emoji: '💰', border: '#EF4444' },
  phoning:        { label: 'Phoning',   color: 'bg-purple-100 border-purple-400 text-purple-800', emoji: '📞', border: '#8B5CF6' },
  adm:            { label: 'ADM',       color: 'bg-gray-100 border-gray-300 text-gray-700', emoji: '📋', border: '#9CA3AF' },
  indispo:        { label: 'Indispo',   color: 'bg-red-50 border-red-300 text-red-600', emoji: '🔒', border: '#EF4444' },
  task:           { label: 'Tâche',     color: 'bg-teal-100 border-teal-400 text-teal-800', emoji: '✅', border: '#14B8A6' },
  phoning_manual: { label: 'Phoning',   color: 'bg-purple-100 border-purple-400 text-purple-800', emoji: '📞', border: '#8B5CF6' },
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

const WEEKDAY_TEMPLATE = [
  { start: '08:00', end: '09:30', type: 'adm',    label: 'ADM / Emails' },
  { start: '09:30', end: '11:30', type: 'phoning', label: 'Phoning' },
  { start: '11:30', end: '12:00', type: 'adm',     label: 'ADM' },
  { start: '14:00', end: '14:30', type: 'adm',     label: 'ADM' },
  { start: '14:30', end: '16:30', type: 'phoning',  label: 'Phoning' },
  { start: '16:30', end: '18:00', type: 'adm',     label: 'ADM / Prépa' },
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
const futureDate = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return format(d, 'yyyy-MM-dd') }

// Trouver le prochain jour ouvré (lun-ven) après une date
const nextWorkday = (dateStr) => {
  let d = new Date(dateStr)
  do { d.setDate(d.getDate() + 1) } while (d.getDay() === 0 || d.getDay() === 6)
  return format(d, 'yyyy-MM-dd')
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

  // ✅ NOUVEAU : Compteur appels + stats semaine
  const [todayCallCount, setTodayCallCount] = useState(0)
  const [weekCallStats, setWeekCallStats] = useState({ total: 0, chaud: 0, tiede: 0, rdv: 0 })

  // UI states
  const [showAddModal, setShowAddModal] = useState(false)
  const [addDate, setAddDate] = useState(null)
  const [addForm, setAddForm] = useState({ event_type: 'indispo', title: '', start_time: '09:00', end_time: '12:00', description: '' })
  const [addConflicts, setAddConflicts] = useState([]) // RDV/sessions en conflit avec l'indispo
  const [relanceSending, setRelanceSending] = useState(null)
  const [hoveredProspect, setHoveredProspect] = useState(null) // tooltip prospect

  // ✅ NOUVEAU : Mini formulaire appel
  const [callModal, setCallModal] = useState(null) // prospect object
  const [callForm, setCallForm] = useState({ result: 'tiede', contactName: '', notes: '', needsCallback: true, callbackDate: '', callbackTime: '10:00', createRdv: false, formations: [] })
  const [callSaving, setCallSaving] = useState(false)

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
      const [sessR, rdvR, cbR, devisR, evtR] = await Promise.all([
        supabase.from('sessions')
          .select('id, reference, start_date, end_date, start_time, end_time, location_city, status, trainer_id, courses(title), clients(name), trainers(first_name, last_name)')
          .gte('start_date', startStr).lte('start_date', endStr)
          .neq('status', 'cancelled'),
        supabase.from('prospect_rdv')
          .select('id, rdv_date, rdv_time, contact_name, conducted_by, status, temperature, notes, formations_interet, client_id, clients(name)')
          .gte('rdv_date', startStr).lte('rdv_date', endStr)
          .eq('conducted_by', 'Hicham')
          .in('status', ['a_prendre', 'prevu', 'planifie']),
        supabase.from('prospect_calls')
          .select('id, callback_date, callback_time, called_by, contact_name, call_result, notes, client_id, clients(name, siren)')
          .eq('needs_callback', true).eq('called_by', 'Hicham')
          .gte('callback_date', startStr).lte('callback_date', endStr)
          .order('callback_date').order('callback_time'),
        supabase.from('quotes')
          .select('id, reference, quote_date, total_ht, status, client_id, notes, relance_count, last_relance_date, clients(name, phone, contact_email)')
          .eq('status', 'sent').order('quote_date'),
        supabase.from('user_planning_events')
          .select('*').eq('user_id', user?.id)
          .gte('event_date', startStr).lte('event_date', endStr),
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

      // Callbacks dédupliqués avec RDV
      const rdvClientIds = new Set(rdvData.map(r => r.client_id).filter(Boolean))
      const rdvClientNames = new Set(rdvData.map(r => normalizeClientName(r.clients?.name)).filter(n => n))
      setCallbacks((cbR.data || []).filter(c => {
        if (c.client_id && rdvClientIds.has(c.client_id)) return false
        if (c.clients?.name && rdvClientNames.has(normalizeClientName(c.clients?.name))) return false
        return true
      }))

      // ✅ Devis à relancer : > 7 jours ET pas relancé depuis 7 jours
      const today = new Date()
      setDevisRelance((devisR.data || []).filter(q => {
        const daysSince = Math.floor((today - new Date(q.quote_date)) / 86400000)
        if (daysSince < 7) return false
        // Si déjà relancé, attendre 7 jours avant de le remontrer
        if (q.last_relance_date) {
          const daysSinceRelance = Math.floor((today - new Date(q.last_relance_date)) / 86400000)
          if (daysSinceRelance < 7) return false
        }
        return true
      }).map(q => ({
        ...q,
        daysSince: Math.floor((today - new Date(q.quote_date)) / 86400000),
      })))

      await loadSmartProspects()
      await loadCallStats()
    } catch (err) { console.error('WeeklyPlanner load error:', err) }
    finally { setLoading(false) }
  }, [weekStart, user?.id])

  useEffect(() => { if (user?.id) loadWeekData() }, [loadWeekData, user?.id])

  // ─── Compteur appels + stats semaine ────────────────────
  const loadCallStats = async () => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const weekStartStr = format(weekStart, 'yyyy-MM-dd')
      const weekEndStr = format(addDays(weekStart, 5), 'yyyy-MM-dd')

      // Appels aujourd'hui
      const { count: todayCount } = await supabase.from('prospect_calls')
        .select('id', { count: 'exact', head: true })
        .eq('called_by', 'Hicham')
        .gte('called_at', todayStr + 'T00:00:00')
        .lte('called_at', todayStr + 'T23:59:59')
      setTodayCallCount(todayCount || 0)

      // Stats semaine
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

  // ─── Prospects intelligents ─────────────────────────────
  const loadSmartProspects = async () => {
    try {
      const [{ data: rappels }, { data: nouveaux }] = await Promise.all([
        supabase.from('prospection_massive')
          .select('id, name, city, phone, effectif, departement, naf, quality_score, prospection_status, siren, siret, postal_code, email, site_web, dirigeant_nom')
          .eq('prospection_status', 'a_rappeler').eq('do_not_call', false)
          .not('phone', 'is', null)
          .order('quality_score', { ascending: false }).limit(30),
        supabase.from('prospection_massive')
          .select('id, name, city, phone, effectif, departement, naf, quality_score, prospection_status, siren, siret, postal_code, email, site_web, dirigeant_nom')
          .or('prospection_status.is.null,prospection_status.eq.a_appeler')
          .eq('do_not_call', false).not('phone', 'is', null)
          .in('departement', ['29', '22', '56', '35'])
          .order('quality_score', { ascending: false }).limit(30),
      ])

      const scored = [...(rappels || []), ...(nouveaux || [])].map(p => {
        let score = p.quality_score || 50
        if (p.prospection_status === 'a_rappeler') score += 30
        const eff = parseInt(p.effectif) || 5
        if (eff >= 40) score += 20; else if (eff >= 20) score += 10
        const naf2 = (p.naf || '').substring(0, 2)
        if (['41', '42', '43'].includes(naf2)) score += 15
        if (['10', '11', '25', '28'].includes(naf2)) score += 10
        if (p.departement === '29') score += 10; else if (p.departement === '22') score += 5
        return { ...p, _score: score }
      })

      const seen = new Set()
      const unique = scored.filter(p => {
        const key = p.name + p.city
        if (seen.has(key)) return false
        seen.add(key); return true
      })
      unique.sort((a, b) => b._score - a._score)
      setSuggestedProspects(unique.slice(0, 30))
    } catch (err) { console.error('Smart prospects error:', err) }
  }

  // ─── Construire événements par jour ─────────────────────
  const dayEvents = useMemo(() => {
    const result = {}
    weekDates.forEach((date) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const events = []

      sessions.filter(s => dateStr >= s.start_date && dateStr <= (s.end_date || s.start_date)).forEach(s => {
        events.push({ id: `ses-${s.id}`, type: 'session', title: s.courses?.title || 'Formation', subtitle: s.clients?.name || '',
          time: `${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}`, startTime: fmtTime(s.start_time) || '09:00', endTime: fmtTime(s.end_time) || '17:00',
          location: s.location_city || '', link: `/sessions/${s.id}`, priority: 0 })
      })

      rdvs.filter(r => r.rdv_date === dateStr).forEach(r => {
        events.push({ id: `rdv-${r.id}`, type: 'rdv', title: r.clients?.name || 'RDV', subtitle: r.contact_name ? `👤 ${r.contact_name}` : '',
          time: r.rdv_time ? fmtTime(r.rdv_time) : 'Heure à définir', startTime: r.rdv_time ? fmtTime(r.rdv_time) : '09:00',
          endTime: r.rdv_time ? addMinutesToTime(fmtTime(r.rdv_time), 60) : '10:00', temperature: r.temperature,
          formations: r.formations_interet, link: `/prospection`, priority: 1 })
      })

      callbacks.filter(c => c.callback_date === dateStr).forEach(c => {
        events.push({ id: `cb-${c.id}`, type: 'callback', title: c.clients?.name || 'Rappel', subtitle: c.contact_name ? `👤 ${c.contact_name}` : '',
          time: c.callback_time ? fmtTime(c.callback_time) : '', startTime: c.callback_time ? fmtTime(c.callback_time) : '10:00',
          endTime: c.callback_time ? addMinutesToTime(fmtTime(c.callback_time), 15) : '10:15', notes: c.notes,
          callId: c.id, priority: 2 })
      })

      planningEvents.filter(e => e.event_date === dateStr).forEach(e => {
        events.push({ id: `evt-${e.id}`, type: e.event_type, title: e.title, subtitle: e.description || '',
          time: `${fmtTime(e.start_time)} – ${fmtTime(e.end_time)}`, startTime: fmtTime(e.start_time), endTime: fmtTime(e.end_time),
          eventId: e.id, priority: e.event_type === 'indispo' ? 0 : 3 })
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
      const windows = [{ start: '09:30', end: '11:30' }, { start: '14:30', end: '16:30' }]
      windows.forEach(w => {
        if (!events.some(e => ['session', 'rdv', 'indispo'].includes(e.type) && overlap(w.start, w.end, e.startTime, e.endTime))) freePhoning++
      })
    })
    const caRelance = devisRelance.reduce((s, q) => s + (parseFloat(q.total_ht) || 0), 0)
    return { totalSessions, totalRdv, totalCallbacks, totalRelances: devisRelance.length, freePhoning, caRelance }
  }, [weekDates, dayEvents, devisRelance])

  // ═══════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════

  // ─── Détection conflits quand on ouvre la modal ajout ───
  useEffect(() => {
    if (!showAddModal || !addDate || addForm.event_type !== 'indispo') { setAddConflicts([]); return }
    const dateStr = format(addDate, 'yyyy-MM-dd')
    const events = dayEvents[dateStr] || []
    const startMin = timeToMin(addForm.start_time)
    const endMin = timeToMin(addForm.end_time)
    const conflicts = events.filter(e =>
      ['session', 'rdv', 'callback'].includes(e.type) &&
      overlap(addForm.start_time, addForm.end_time, e.startTime, e.endTime)
    )
    setAddConflicts(conflicts)
  }, [showAddModal, addDate, addForm.event_type, addForm.start_time, addForm.end_time, dayEvents])

  const handleAddEvent = async () => {
    if (!addForm.title.trim()) { toast.error('Titre requis'); return }
    if (timeToMin(addForm.start_time) >= timeToMin(addForm.end_time)) { toast.error('Heure de fin invalide'); return }

    // ✅ Si indispo : repousser les callbacks en conflit
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
          await supabase.from('prospect_calls').update({
            callback_date: nextDay,
          }).eq('id', cb.callId)
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

      let msg = 'Événement ajouté'
      if (rescheduledCount > 0) msg += ` · ${rescheduledCount} rappel${rescheduledCount > 1 ? 's' : ''} repoussé${rescheduledCount > 1 ? 's' : ''} au prochain jour ouvré`
      toast.success(msg)
      setShowAddModal(false)
      setAddConflicts([])
      setAddForm({ event_type: 'indispo', title: '', start_time: '09:00', end_time: '12:00', description: '' })
      loadWeekData()
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Supprimer ?')) return
    try { await supabase.from('user_planning_events').delete().eq('id', eventId); toast.success('Supprimé'); loadWeekData() }
    catch (err) { toast.error('Erreur: ' + err.message) }
  }

  const handleCallbackDone = async (callId) => {
    try {
      await supabase.from('prospect_calls').update({ needs_callback: false }).eq('id', callId)
      toast.success('Rappel marqué fait ✓')
      setCallbacks(prev => prev.filter(c => c.id !== callId))
    } catch (err) { toast.error('Erreur: ' + err.message) }
  }

  // ✅ RELANCE DEVIS avec suivi
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

      // Mettre à jour le devis en base
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
  // ✅ MINI FORMULAIRE APPEL — Le cœur du système
  // ═══════════════════════════════════════════════════════════

  const openCallModal = (prospect) => {
    setCallModal(prospect)
    setCallForm({
      result: 'tiede', contactName: prospect.dirigeant_nom || '', notes: '',
      needsCallback: true, callbackDate: futureDate(2), callbackTime: '10:00',
      createRdv: false, formations: [],
    })
  }

  const findOrCreateClient = async (prospect) => {
    const cleanSiren = prospect.siren && !prospect.siren.startsWith('MANUAL_') ? prospect.siren.slice(0, 9) : null
    const cleanSiret = prospect.siret && !prospect.siret.startsWith('MANUAL_') ? prospect.siret.slice(0, 14) : null
    if (cleanSiret) {
      const { data: existing } = await supabase.from('clients').select('id').eq('siret', cleanSiret).maybeSingle()
      if (existing) return existing.id
    }
    const { data: newClient, error } = await supabase.from('clients').insert({
      name: prospect.name, address: prospect.city ? (prospect.postal_code || '') + ' ' + prospect.city : null,
      postal_code: prospect.postal_code, city: prospect.city, siret: cleanSiret, siren: cleanSiren,
      contact_phone: prospect.phone, email: prospect.email || null, website: prospect.site_web || null,
      taille_entreprise: prospect.effectif || null, status: 'prospect', type: 'prospect',
    }).select('id').single()
    if (error) throw error
    return newClient.id
  }

  const handleSaveCall = async () => {
    if (!callModal) return
    setCallSaving(true)
    try {
      const prospect = callModal
      const clientId = await findOrCreateClient(prospect)

      // Nettoyer les anciens callbacks de ce client
      await supabase.from('prospect_calls').update({ needs_callback: false }).eq('client_id', clientId).eq('needs_callback', true)

      // Insérer l'appel
      const { data: insertedCall, error: callError } = await supabase.from('prospect_calls').insert({
        client_id: clientId, called_by: 'Hicham',
        contact_name: callForm.contactName || null,
        call_result: callForm.result,
        formations_mentioned: callForm.formations.length > 0 ? callForm.formations : null,
        notes: callForm.notes || null,
        needs_callback: callForm.needsCallback && ['tiede', 'no_answer', 'blocked'].includes(callForm.result),
        callback_date: callForm.needsCallback ? callForm.callbackDate : null,
        callback_time: callForm.needsCallback ? callForm.callbackTime : null,
      }).select().single()
      if (callError) throw callError

      // Mise à jour contact client si nom fourni
      if (callForm.contactName) {
        await supabase.from('clients').update({ contact_name: callForm.contactName }).eq('id', clientId)
      }

      // ✅ Créer RDV si chaud
      if (callForm.createRdv || callForm.result === 'chaud') {
        const { data: rdv } = await supabase.from('prospect_rdv').insert({
          client_id: clientId, rdv_type: 'decouverte', conducted_by: 'Hicham',
          status: 'a_prendre', contact_name: callForm.contactName || null,
          formations_interet: callForm.formations.length > 0 ? callForm.formations : null,
          notes: `Créé par Hicham suite à appel.\n\nNotes:\n${callForm.notes || ''}`,
          temperature: 'chaud', source: 'phoning_hicham',
        }).select().single()
        if (rdv) await supabase.from('prospect_calls').update({ rdv_id: rdv.id }).eq('id', insertedCall.id)
      }

      // ✅ Mettre à jour prospection_massive
      let newStatus = callForm.result === 'chaud' ? 'rdv_pris'
        : callForm.result === 'froid' ? 'pas_interesse'
        : callForm.result === 'wrong_number' ? 'numero_errone'
        : 'a_rappeler'

      await supabase.from('prospection_massive').update({
        contacted: true, contacted_at: new Date().toISOString(),
        prospection_status: newStatus,
        prospection_notes: callForm.notes || null,
        updated_at: new Date().toISOString(),
      }).eq('id', prospect.id)

      // ✅ ROTATION : Retirer le prospect de la liste locale
      setSuggestedProspects(prev => prev.filter(p => p.id !== prospect.id))
      // ✅ Incrémenter compteur appels
      setTodayCallCount(prev => prev + 1)
      setWeekCallStats(prev => ({
        ...prev, total: prev.total + 1,
        chaud: prev.chaud + (callForm.result === 'chaud' ? 1 : 0),
        tiede: prev.tiede + (callForm.result === 'tiede' ? 1 : 0),
        rdv: prev.rdv + (callForm.createRdv || callForm.result === 'chaud' ? 1 : 0),
      }))

      let msg = '✅ Appel enregistré'
      if (callForm.createRdv || callForm.result === 'chaud') msg += ' • RDV créé'
      if (callForm.needsCallback && ['tiede', 'no_answer', 'blocked'].includes(callForm.result)) msg += ' • Rappel programmé'
      toast.success(msg)
      setCallModal(null)

    } catch (err) {
      console.error('Save call error:', err)
      toast.error('Erreur: ' + err.message)
    } finally { setCallSaving(false) }
  }

  // ═══════════════════════════════════════════════════════════
  // SUB-COMPONENTS
  // ═══════════════════════════════════════════════════════════

  const EventCard = ({ event }) => {
    const config = SLOT_TYPES[event.type] || SLOT_TYPES.task
    const isLink = !!event.link
    const Wrapper = isLink ? Link : 'div'
    return (
      <div className="relative group">
        <Wrapper {...(isLink ? { to: event.link } : {})}
          className={`block px-2 py-1.5 rounded text-xs leading-tight transition-all hover:shadow-sm ${config.color} ${isLink ? 'cursor-pointer hover:brightness-95' : ''}`}
          style={{ borderLeft: `3px solid ${config.border}` }}>
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
        {event.callId && (
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCallbackDone(event.callId) }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-green-500 text-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center" title="Fait ✓">
            <Check className="w-2.5 h-2.5" />
          </button>
        )}
        {event.eventId && (
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteEvent(event.eventId) }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center" title="Supprimer">
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    )
  }

  // ✅ Prospect cliquable → ouvre le mini formulaire + tooltip au survol
  const ProspectSuggestion = ({ prospect, rank }) => (
    <div className="relative" onMouseEnter={() => setHoveredProspect(prospect.id)} onMouseLeave={() => setHoveredProspect(null)}>
      <button onClick={() => openCallModal(prospect)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded bg-purple-50 border border-purple-200 text-[10px] hover:bg-purple-100 hover:border-purple-300 transition-colors text-left">
        <span className="text-purple-400 font-bold w-3 text-center">{rank}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-purple-800 truncate">{prospect.name}</p>
          <p className="text-purple-500 truncate">{prospect.city} · {prospect.departement}</p>
        </div>
        {prospect.prospection_status === 'a_rappeler' && (
          <span className="text-[9px] bg-amber-200 text-amber-800 px-1 rounded flex-shrink-0">Rappel</span>
        )}
        <Phone className="w-3 h-3 text-purple-400 flex-shrink-0" />
      </button>
      {/* Tooltip enrichi */}
      {hoveredProspect === prospect.id && (
        <div className="absolute left-0 bottom-full mb-1 z-30 bg-gray-900 text-white text-[10px] rounded-lg px-3 py-2 shadow-lg whitespace-nowrap max-w-[250px]">
          <p className="font-semibold">{prospect.name}</p>
          <p className="opacity-70">{prospect.city} ({prospect.departement}) · {prospect.effectif || '?'} sal.</p>
          {prospect.naf && <p className="opacity-70">NAF: {prospect.naf}</p>}
          {prospect.phone && <p className="opacity-80">📞 {prospect.phone}</p>}
          {prospect.email && <p className="opacity-80">📧 {prospect.email}</p>}
          {prospect.dirigeant_nom && <p className="opacity-80">👤 {prospect.dirigeant_nom}</p>}
          <p className="opacity-60 mt-1">Score: {prospect._score} · Clic pour appeler</p>
          <div className="absolute left-4 top-full w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
        </div>
      )}
    </div>
  )

  // ─── DayColumn ──────────────────────────────────────────
  const DayColumn = ({ date, dayIdx }) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const events = dayEvents[dateStr] || []
    const isSat = dayIdx === 5
    const isCurrentDay = isToday(date)
    const template = isSat ? SATURDAY_TEMPLATE : WEEKDAY_TEMPLATE
    const isFormationDay = events.some(e => e.type === 'session' && (timeToMin(e.endTime) - timeToMin(e.startTime)) >= 300)
    const rdvCount = events.filter(e => e.type === 'rdv').length
    const cbCount = events.filter(e => e.type === 'callback').length
    // ✅ Jour vide = 0 session, 0 rdv, 0 callback, pas samedi
    const isEmptyDay = !isSat && !isFormationDay && rdvCount === 0 && cbCount === 0 && !events.some(e => e.type === 'indispo' && (timeToMin(e.endTime) - timeToMin(e.startTime)) >= 300)
    let prospectIdx = 0

    return (
      <div className={`flex flex-col rounded-xl border ${isCurrentDay ? 'border-primary-400 bg-primary-50/20 shadow-sm' : 'border-gray-200'} overflow-hidden`}>
        <div className={`px-2 py-1.5 text-center border-b ${isCurrentDay ? 'bg-primary-100 border-primary-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-xs font-bold ${isCurrentDay ? 'text-primary-700' : 'text-gray-700'}`}>{DAYS[dayIdx]}</p>
          <p className={`text-lg font-bold leading-tight ${isCurrentDay ? 'text-primary-800' : 'text-gray-900'}`}>{format(date, 'd')}</p>
          <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
            {isFormationDay && <span className="text-[8px] bg-blue-500 text-white px-1 rounded-full">🎓</span>}
            {rdvCount > 0 && <span className="text-[8px] bg-green-500 text-white px-1 rounded-full">🤝 {rdvCount}</span>}
            {cbCount > 0 && <span className="text-[8px] bg-amber-500 text-white px-1 rounded-full">📞 {cbCount}</span>}
            {isEmptyDay && <span className="text-[8px] bg-purple-500 text-white px-1 rounded-full">⚡ 4h phoning</span>}
          </div>
        </div>

        <div className="flex-1 p-1.5 space-y-1 min-h-[200px]">
          {template.map((tpl, tplIdx) => {
            const slotEvents = events.filter(e => overlap(tpl.start, tpl.end, e.startTime, e.endTime))
            const isPhoning = tpl.type === 'phoning'
            const isBlocked = slotEvents.some(e => ['session', 'rdv', 'indispo'].includes(e.type))
            const isFreePhoning = isPhoning && !isBlocked
            const showRelances = isFreePhoning && tplIdx === 1 && devisRelance.length > 0
            const slotProspects = isFreePhoning ? suggestedProspects.slice(prospectIdx, prospectIdx + 4) : []
            if (isFreePhoning) prospectIdx += 4

            return (
              <div key={tplIdx} className={`rounded-lg p-1.5 ${isBlocked && slotEvents.some(e => e.type === 'session') ? 'bg-blue-50/50' : isBlocked && slotEvents.some(e => e.type === 'rdv') ? 'bg-green-50/30' : isBlocked ? 'bg-red-50/30' : isPhoning ? 'bg-purple-50/30' : 'bg-gray-50/50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-medium text-gray-400">{tpl.start}–{tpl.end}</span>
                  {slotEvents.some(e => e.type === 'session') && <span className="text-[9px] bg-blue-200 text-blue-700 px-1 rounded-full">Formation</span>}
                  {!isBlocked && slotEvents.some(e => e.type === 'rdv') && <span className="text-[9px] bg-green-200 text-green-700 px-1 rounded-full">RDV</span>}
                  {isFreePhoning && <span className="text-[9px] bg-purple-200 text-purple-700 px-1 rounded-full">Phoning</span>}
                </div>
                {slotEvents.length > 0 && <div className="space-y-1">{slotEvents.map(e => <EventCard key={e.id} event={e} />)}</div>}
                {isFreePhoning && slotEvents.filter(e => e.type !== 'callback').length === 0 && (
                  <div className="space-y-1 mt-1">
                    {showRelances && (
                      <div className="px-2 py-1.5 rounded bg-red-50 border border-red-200 text-[10px]" style={{ borderLeft: '3px solid #EF4444' }}>
                        <div className="flex items-center gap-1 font-semibold text-red-700 mb-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{devisRelance.length} devis à relancer</span>
                        </div>
                        {devisRelance.slice(0, 3).map(q => (
                          <div key={q.id} className="flex items-center justify-between mt-1 gap-1">
                            <p className="text-red-600 truncate flex-1 text-[9px]">
                              {q.clients?.name} — {parseFloat(q.total_ht).toLocaleString('fr')}€ ({q.daysSince}j)
                              {(q.relance_count || 0) > 0 && <span className="ml-1 text-red-400">({q.relance_count}x)</span>}
                              {(q.relance_count || 0) >= 3 && <span className="ml-1">📞</span>}
                            </p>
                            <button onClick={() => handleRelanceDevis(q)} disabled={relanceSending === q.id || (q.relance_count || 0) >= 3}
                              className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                relanceSending === q.id ? 'bg-gray-200 text-gray-400' :
                                (q.relance_count || 0) >= 3 ? 'bg-orange-100 text-orange-600' :
                                q.clients?.contact_email ? 'bg-red-600 text-white hover:bg-red-700' :
                                'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`} title={
                                (q.relance_count || 0) >= 3 ? 'Appeler directement' :
                                q.clients?.contact_email || 'Pas d\'email'
                              }>
                              {relanceSending === q.id ? '⏳' : (q.relance_count || 0) >= 3 ? '📞 Appeler' : '✉️'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {slotProspects.map((p, i) => <ProspectSuggestion key={p.id} prospect={p} rank={prospectIdx - 4 + i + 1} />)}
                    {slotProspects.length === 0 && !showRelances && <p className="text-[10px] text-gray-300 italic text-center py-2">Créneau libre</p>}
                  </div>
                )}
                {!isPhoning && slotEvents.length === 0 && <p className="text-[10px] text-gray-300 italic text-center py-1">{tpl.label}</p>}
              </div>
            )
          })}
        </div>
        <button onClick={() => { setAddDate(date); setShowAddModal(true) }}
          className="w-full py-2 text-xs text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors border-t border-gray-100 flex items-center justify-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setWeekOffset(0)} className={`px-3 py-1 text-xs font-medium rounded-full ${weekOffset === 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Aujourd'hui</button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-gray-700">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {/* ✅ Compteur appels live */}
          {todayCallCount > 0 && (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-bold flex items-center gap-1">
              <Zap className="w-3 h-3" /> {todayCallCount} appel{todayCallCount > 1 ? 's' : ''} today
            </span>
          )}
          {/* ✅ Conversion semaine */}
          {weekCallStats.total > 0 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full flex items-center gap-1" title={`${weekCallStats.total} appels → ${weekCallStats.chaud} chauds → ${weekCallStats.rdv} RDV`}>
              <TrendingUp className="w-3 h-3" />
              {weekCallStats.total}→{weekCallStats.chaud}🔥→{weekCallStats.rdv} RDV
              {weekCallStats.total > 0 && <span className="text-green-600 font-bold ml-0.5">({Math.round(weekCallStats.chaud / weekCallStats.total * 100)}%)</span>}
            </span>
          )}
          {weekStats.totalSessions > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">🎓 {weekStats.totalSessions}</span>}
          {weekStats.totalRdv > 0 && <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full">🤝 {weekStats.totalRdv}</span>}
          {weekStats.totalCallbacks > 0 && <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full">📞 {weekStats.totalCallbacks}</span>}
          {weekStats.totalRelances > 0 && <span className="px-2 py-1 bg-red-50 text-red-700 rounded-full font-bold">💰 {weekStats.caRelance.toLocaleString('fr')}€</span>}
          {weekStats.freePhoning > 0 && <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full">📞 {weekStats.freePhoning} créneaux</span>}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {weekDates.map((date, idx) => <DayColumn key={format(date, 'yyyy-MM-dd')} date={date} dayIdx={idx} />)}
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 justify-center">
        {['session', 'rdv', 'callback', 'relance', 'phoning', 'adm', 'indispo'].map(k => <span key={k} className="flex items-center gap-1"><span>{SLOT_TYPES[k].emoji}</span> {SLOT_TYPES[k].label}</span>)}
      </div>

      {/* ═══ MODAL AJOUT ÉVÉNEMENT ═══ */}
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
                    className={`p-3 text-left rounded-lg border-2 ${addForm.event_type === o.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
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
              {/* ✅ Alertes conflits */}
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

      {/* ═══ MODAL APPEL RAPIDE ═══ */}
      {callModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !callSaving && setCallModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header prospect */}
            <div className="bg-purple-50 p-4 rounded-t-xl border-b border-purple-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{callModal.name}</h3>
                  <p className="text-sm text-gray-500">{callModal.city} · {callModal.departement} · {callModal.effectif || '?'} salariés</p>
                </div>
                <div className="flex items-center gap-2">
                  {callModal.phone && (
                    <a href={`tel:${callModal.phone.replace(/\s/g, '')}`} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {callModal.phone}
                    </a>
                  )}
                  <button onClick={() => setCallModal(null)} className="p-1 hover:bg-gray-200 rounded-lg"><X className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Résultat appel */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Résultat de l'appel</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CALL_RESULTS.map(r => (
                    <button key={r.id} onClick={() => {
                      setCallForm(f => ({
                        ...f, result: r.id,
                        needsCallback: ['tiede', 'no_answer', 'blocked'].includes(r.id),
                        createRdv: r.id === 'chaud',
                        callbackDate: r.id === 'no_answer' ? futureDate(2) : r.id === 'tiede' ? futureDate(7) : f.callbackDate,
                      }))
                    }}
                      className={`p-2 rounded-lg border-2 text-center transition-all ${callForm.result === r.id ? r.color + ' border-current font-bold' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className="text-sm">{r.label}</span>
                      <p className="text-[9px] opacity-60 mt-0.5">{r.sublabel}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Nom du contact</label>
                <input type="text" value={callForm.contactName} onChange={e => setCallForm(f => ({ ...f, contactName: e.target.value }))}
                  placeholder="Ex: Mme Dupont, Mr Le Goff..." className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 outline-none" />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                <textarea value={callForm.notes} onChange={e => setCallForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Contexte, demande, informations recueillies..."
                  rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 outline-none resize-none" />
              </div>

              {/* Formations */}
              {['chaud', 'tiede'].includes(callForm.result) && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Formations mentionnées</label>
                  <div className="grid grid-cols-2 gap-1">
                    {FORMATIONS.map(f => (
                      <label key={f} className="flex items-center gap-1.5 text-[11px] p-1 rounded hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={callForm.formations.includes(f)}
                          onChange={e => setCallForm(prev => ({ ...prev, formations: e.target.checked ? [...prev.formations, f] : prev.formations.filter(x => x !== f) }))}
                          className="rounded border-gray-300 text-purple-600 w-3.5 h-3.5" />
                        <span>{f}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Rappel */}
              {['tiede', 'no_answer', 'blocked'].includes(callForm.result) && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <label className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-2">
                    <Phone className="w-3.5 h-3.5" /> Programmer un rappel
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={callForm.callbackDate} onChange={e => setCallForm(f => ({ ...f, callbackDate: e.target.value }))}
                      className="border rounded-lg px-2 py-1.5 text-sm" />
                    <input type="time" value={callForm.callbackTime} onChange={e => setCallForm(f => ({ ...f, callbackTime: e.target.value }))}
                      className="border rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                </div>
              )}

              {/* RDV auto si chaud */}
              {callForm.result === 'chaud' && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-xs font-semibold text-green-700">
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Un RDV "à prendre" sera créé automatiquement</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <button onClick={() => setCallModal(null)} disabled={callSaving}
                  className="flex-1 py-2.5 text-sm border rounded-lg hover:bg-gray-50 font-medium text-gray-600">Annuler</button>
                <button onClick={handleSaveCall} disabled={callSaving}
                  className="flex-1 py-2.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {callSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
