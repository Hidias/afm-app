import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Phone, TrendingUp, Clock, Users, Mail, Target, Calendar, BarChart3, ArrowUp, ArrowDown, Minus, Loader2, RefreshCw } from 'lucide-react'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'

const CALLERS = ['Marine', 'Hicham', 'Maxime']
const RESULT_LABELS = {
  chaud: { label: 'RDV / Chaud', color: 'bg-green-500', text: 'text-green-700' },
  tiede: { label: 'Tiède', color: 'bg-orange-400', text: 'text-orange-700' },
  froid: { label: 'Pas intéressé', color: 'bg-blue-400', text: 'text-blue-700' },
  no_answer: { label: 'Injoignable', color: 'bg-gray-400', text: 'text-gray-600' },
  wrong_number: { label: 'N° erroné', color: 'bg-red-400', text: 'text-red-700' },
  blocked: { label: 'Barrage', color: 'bg-purple-400', text: 'text-purple-700' },
}

export default function PhoneDashboard() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('week') // week, month, all
  const [calls, setCalls] = useState([])
  const [emails, setEmails] = useState([])
  const [prospects, setProspects] = useState({ total: 0, contacted: 0, rdv: 0, interested: 0, refused: 0, redirected: 0 })
  const [rdvs, setRdvs] = useState([])

  useEffect(() => { loadAll() }, [period])

  async function loadAll() {
    setLoading(true)
    try {
      const now = new Date()
      let dateFrom
      if (period === 'week') dateFrom = startOfWeek(now, { weekStartsOn: 1 })
      else if (period === 'month') dateFrom = startOfMonth(now)
      else dateFrom = subDays(now, 365)

      const fromISO = dateFrom.toISOString()

      // 1. Appels
      const { data: callsData } = await supabase
        .from('prospect_calls')
        .select('called_at, called_by, call_result, duration_seconds, notes, formations_mentioned')
        .gte('called_at', fromISO)
        .order('called_at', { ascending: false })
      setCalls(callsData || [])

      // 2. Emails
      const { data: emailsData } = await supabase
        .from('prospect_email_logs')
        .select('sent_at, template_type, prospect_siren, status')
        .gte('sent_at', fromISO)
        .eq('status', 'sent')
      setEmails(emailsData || [])

      // 3. RDVs
      const { data: rdvsData } = await supabase
        .from('prospect_rdv')
        .select('created_at, rdv_date, assigned_to, status')
        .gte('created_at', fromISO)
      setRdvs(rdvsData || [])

      // 4. Pipeline prospects (toujours global)
      const { data: pm } = await supabase.rpc('get_unique_prospects')
      if (pm) {
        setProspects({
          total: pm.length,
          contacted: pm.filter(p => p.contacted).length,
          rdv: pm.filter(p => p.prospection_status === 'rdv_pris').length,
          interested: pm.filter(p => p.prospection_status === 'a_rappeler').length,
          refused: pm.filter(p => p.prospection_status === 'pas_interesse').length,
          redirected: pm.filter(p => p.prospection_status === 'redirige' || p.gere_par_id).length,
        })
      }
    } catch (err) {
      console.error('Erreur dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  // ═══ KPIs ═══
  const kpis = useMemo(() => {
    const totalCalls = calls.length
    const hotCalls = calls.filter(c => c.call_result === 'chaud').length
    const tiedeCalls = calls.filter(c => c.call_result === 'tiede').length
    const avgDuration = totalCalls > 0
      ? Math.round(calls.reduce((s, c) => s + (c.duration_seconds || 0), 0) / totalCalls)
      : 0
    const conversionRate = totalCalls > 0 ? ((hotCalls / totalCalls) * 100).toFixed(1) : '0'
    const interestRate = totalCalls > 0 ? (((hotCalls + tiedeCalls) / totalCalls) * 100).toFixed(1) : '0'

    return { totalCalls, hotCalls, tiedeCalls, avgDuration, conversionRate, interestRate }
  }, [calls])

  // ═══ Stats par appelant ═══
  const callerStats = useMemo(() => {
    return CALLERS.map(name => {
      const c = calls.filter(x => x.called_by === name)
      const hot = c.filter(x => x.call_result === 'chaud').length
      const tiede = c.filter(x => x.call_result === 'tiede').length
      const avgDur = c.length > 0
        ? Math.round(c.reduce((s, x) => s + (x.duration_seconds || 0), 0) / c.length)
        : 0
      return { name, total: c.length, hot, tiede, avgDur, rate: c.length > 0 ? ((hot / c.length) * 100).toFixed(1) : '0' }
    }).filter(c => c.total > 0)
  }, [calls])

  // ═══ Stats par jour (7 derniers jours) ═══
  const dailyStats = useMemo(() => {
    const now = new Date()
    const days = period === 'week'
      ? eachDayOfInterval({ start: startOfWeek(now, { weekStartsOn: 1 }), end: now })
      : period === 'month'
        ? eachDayOfInterval({ start: startOfMonth(now), end: now })
        : eachDayOfInterval({ start: subDays(now, 13), end: now })

    return days.map(day => {
      const dayCalls = calls.filter(c => isSameDay(new Date(c.called_at), day))
      return {
        date: day,
        label: format(day, 'EEE d', { locale: fr }),
        total: dayCalls.length,
        hot: dayCalls.filter(c => c.call_result === 'chaud').length,
        tiede: dayCalls.filter(c => c.call_result === 'tiede').length,
        froid: dayCalls.filter(c => c.call_result === 'froid').length,
        noAnswer: dayCalls.filter(c => ['no_answer', 'blocked', 'wrong_number'].includes(c.call_result)).length,
      }
    })
  }, [calls, period])

  // ═══ Résultats par type ═══
  const resultBreakdown = useMemo(() => {
    const counts = {}
    calls.forEach(c => {
      const r = c.call_result || 'unknown'
      counts[r] = (counts[r] || 0) + 1
    })
    return Object.entries(RESULT_LABELS)
      .map(([key, config]) => ({ key, ...config, count: counts[key] || 0 }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [calls])

  // ═══ Formations les plus mentionnées ═══
  const topFormations = useMemo(() => {
    const counts = {}
    calls.forEach(c => {
      if (c.formations_mentioned) {
        c.formations_mentioned.forEach(f => {
          counts[f] = (counts[f] || 0) + 1
        })
      }
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
  }, [calls])

  // ═══ Meilleurs créneaux horaires ═══
  const hourlyStats = useMemo(() => {
    const hours = {}
    calls.forEach(c => {
      const h = new Date(c.called_at).getHours()
      if (!hours[h]) hours[h] = { total: 0, hot: 0 }
      hours[h].total++
      if (c.call_result === 'chaud' || c.call_result === 'tiede') hours[h].hot++
    })
    return Object.entries(hours)
      .map(([h, s]) => ({ hour: parseInt(h), ...s, rate: s.total > 0 ? ((s.hot / s.total) * 100).toFixed(0) : 0 }))
      .sort((a, b) => a.hour - b.hour)
      .filter(h => h.hour >= 8 && h.hour <= 18)
  }, [calls])

  // ═══ Email stats ═══
  const emailStats = useMemo(() => {
    const suiteEchange = emails.filter(e => e.template_type === 'suite_echange').length
    const nrp = emails.filter(e => e.template_type === 'nrp').length
    const relance = emails.filter(e => e.template_type === 'relance').length
    return { total: emails.length, suiteEchange, nrp, relance }
  }, [emails])

  const maxDaily = Math.max(...dailyStats.map(d => d.total), 1)
  const maxHourly = Math.max(...hourlyStats.map(h => h.total), 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-500">Chargement des statistiques...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + Période */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary-600" /> Dashboard Phoning
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{calls.length} appels · {emails.length} emails · {rdvs.length} RDV</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { id: 'week', label: 'Semaine' },
              { id: 'month', label: 'Mois' },
              { id: 'all', label: '12 mois' },
            ].map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' +
                  (period === p.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={loadAll} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ═══ KPIs principaux ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Phone} label="Appels" value={kpis.totalCalls} color="blue" />
        <KpiCard icon={Target} label="RDV décrochés" value={kpis.hotCalls} color="green" />
        <KpiCard icon={TrendingUp} label="Taux conversion" value={kpis.conversionRate + '%'} color="emerald" />
        <KpiCard icon={Clock} label="Durée moy." value={formatDuration(kpis.avgDuration)} color="purple" />
      </div>

      {/* ═══ Graphique par jour ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Appels par jour
        </h3>
        <div className="flex items-end gap-1 h-32">
          {dailyStats.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-gray-500 font-medium">{d.total || ''}</span>
              <div className="w-full flex flex-col-reverse gap-px" style={{ height: `${(d.total / maxDaily) * 100}%`, minHeight: d.total > 0 ? '4px' : '0' }}>
                {d.hot > 0 && <div className="bg-green-500 rounded-t-sm" style={{ height: `${(d.hot / d.total) * 100}%`, minHeight: '2px' }} />}
                {d.tiede > 0 && <div className="bg-orange-400" style={{ height: `${(d.tiede / d.total) * 100}%`, minHeight: '2px' }} />}
                {d.froid > 0 && <div className="bg-blue-400" style={{ height: `${(d.froid / d.total) * 100}%`, minHeight: '2px' }} />}
                {d.noAnswer > 0 && <div className="bg-gray-300 rounded-b-sm" style={{ height: `${(d.noAnswer / d.total) * 100}%`, minHeight: '2px' }} />}
              </div>
              <span className="text-[9px] text-gray-400">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 justify-center">
          <span className="text-[10px] text-gray-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> RDV</span>
          <span className="text-[10px] text-gray-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Tiède</span>
          <span className="text-[10px] text-gray-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Refus</span>
          <span className="text-[10px] text-gray-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Injoignable</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* ═══ Stats par appelant ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Par appelant
          </h3>
          <div className="space-y-3">
            {callerStats.map(c => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 w-16">{c.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all"
                    style={{ width: `${c.total > 0 ? (c.hot / Math.max(...callerStats.map(x => x.total))) * 100 : 0}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-orange-400 rounded-full transition-all"
                    style={{ width: `${c.total > 0 ? ((c.hot + c.tiede) / Math.max(...callerStats.map(x => x.total))) * 100 : 0}%`, zIndex: 0 }} />
                  <div className="absolute inset-y-0 left-0 bg-gray-300 rounded-full transition-all"
                    style={{ width: `${(c.total / Math.max(...callerStats.map(x => x.total))) * 100}%`, zIndex: -1 }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-gray-700">
                    {c.total} appels · {c.hot} RDV ({c.rate}%)
                  </span>
                </div>
              </div>
            ))}
            {callerStats.length === 0 && <p className="text-sm text-gray-400 italic">Aucun appel sur cette période</p>}
          </div>
        </div>

        {/* ═══ Répartition résultats ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" /> Résultats des appels
          </h3>
          <div className="space-y-2">
            {resultBreakdown.map(r => (
              <div key={r.key} className="flex items-center gap-2">
                <span className={`text-xs font-medium w-28 ${r.text}`}>{r.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div className={`h-full rounded-full ${r.color} transition-all`}
                    style={{ width: `${(r.count / kpis.totalCalls) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-12 text-right">{r.count} ({((r.count / kpis.totalCalls) * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* ═══ Meilleurs créneaux ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Meilleurs créneaux
          </h3>
          <div className="flex items-end gap-1 h-28">
            {hourlyStats.map((h, i) => {
              const hotPct = h.total > 0 ? (h.hot / h.total) : 0
              const isGood = hotPct > 0.15
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className={`text-[9px] font-bold ${isGood ? 'text-green-600' : 'text-gray-400'}`}>
                    {h.rate}%
                  </span>
                  <div className={`w-full rounded-t-sm transition-all ${isGood ? 'bg-green-400' : 'bg-gray-300'}`}
                    style={{ height: `${(h.total / maxHourly) * 100}%`, minHeight: h.total > 0 ? '4px' : '0' }} />
                  <span className="text-[9px] text-gray-400">{h.hour}h</span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">Pourcentage = taux d'intérêt (RDV + tiède) par créneau</p>
        </div>

        {/* ═══ Formations demandées ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Formations demandées
          </h3>
          <div className="space-y-1.5">
            {topFormations.map(([name, count], i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 flex-1 truncate">{name}</span>
                <div className="w-24 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full bg-primary-500 transition-all"
                    style={{ width: `${(count / (topFormations[0]?.[1] || 1)) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
              </div>
            ))}
            {topFormations.length === 0 && <p className="text-sm text-gray-400 italic">Aucune formation mentionnée</p>}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* ═══ Emails ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4" /> Emails envoyés
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-700">{emailStats.suiteEchange}</p>
              <p className="text-[10px] text-green-600">Suite échange</p>
            </div>
            <div className="text-center p-2 bg-orange-50 rounded-lg">
              <p className="text-lg font-bold text-orange-700">{emailStats.nrp}</p>
              <p className="text-[10px] text-orange-600">NRP</p>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold text-purple-700">{emailStats.relance}</p>
              <p className="text-[10px] text-purple-600">Relances</p>
            </div>
          </div>
        </div>

        {/* ═══ Pipeline global ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Pipeline prospects
          </h3>
          <div className="space-y-1.5">
            <PipelineRow label="Total prospects" count={prospects.total} max={prospects.total} color="bg-gray-400" />
            <PipelineRow label="Contactés" count={prospects.contacted} max={prospects.total} color="bg-blue-400" />
            <PipelineRow label="Intéressés (à rappeler)" count={prospects.interested} max={prospects.total} color="bg-orange-400" />
            <PipelineRow label="RDV pris" count={prospects.rdv} max={prospects.total} color="bg-green-500" />
            <PipelineRow label="Redirigés" count={prospects.redirected} max={prospects.total} color="bg-indigo-400" />
            <PipelineRow label="Pas intéressés" count={prospects.refused} max={prospects.total} color="bg-red-400" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══ Composants utilitaires ═══

function KpiCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.blue}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-60" />
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function PipelineRow({ label, count, max, color }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-36 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-3.5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%`, minWidth: count > 0 ? '4px' : '0' }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-16 text-right">{count.toLocaleString('fr-FR')}</span>
    </div>
  )
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m${s > 0 ? s + 's' : ''}` : `${s}s`
}
