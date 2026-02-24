import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Calendar, CalendarDays, CalendarRange,
  MapPin, Users, Clock, Copy, Check, Filter
} from 'lucide-react'
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths,
  startOfYear, endOfYear, addYears, subYears,
  eachDayOfInterval, eachMonthOfInterval,
  isToday, isWeekend,
  differenceInDays, parseISO, differenceInCalendarMonths
} from 'date-fns'
import { fr } from 'date-fns/locale'

// Couleurs fixes par formateur — bleu pour Hicham, vert pour Maxime
const TRAINER_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800', accent: '#3b82f6', light: '#dbeafe' },
  { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800', accent: '#10b981', light: '#d1fae5' },
  { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', accent: '#f59e0b', light: '#fef3c7' },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', accent: '#8b5cf6', light: '#ede9fe' },
  { bg: 'bg-rose-100', border: 'border-rose-400', text: 'text-rose-800', accent: '#f43f5e', light: '#ffe4e6' },
  { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-800', accent: '#06b6d4', light: '#cffafe' },
]

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', dot: 'bg-gray-400' },
  planned: { label: 'Planifiée', dot: 'bg-blue-500' },
  in_progress: { label: 'En cours', dot: 'bg-yellow-500' },
  completed: { label: 'Terminée', dot: 'bg-green-500' },
  cancelled: { label: 'Annulée', dot: 'bg-red-500' },
}

export default function SessionPlanning({ sessions, trainers }) {
  const [view, setView] = useState('month') // week | month | year
  const [currentDate, setCurrentDate] = useState(new Date())
  const [hoveredSession, setHoveredSession] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [copiedUrl, setCopiedUrl] = useState(null)
  const [statusFilter, setStatusFilter] = useState(['planned', 'in_progress', 'completed'])
  const containerRef = useRef(null)
  const gridRef = useRef(null)

  // ─── Formateurs internes (Hicham + Maxime) ─────────────────────────
  const activeTrainers = useMemo(() => {
    return trainers
      .filter(t => t.is_internal !== false)
      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
  }, [trainers])

  // Map formateur → couleur (stable)
  const trainerColorMap = useMemo(() => {
    const map = new Map()
    activeTrainers.forEach((t, i) => {
      map.set(t.id, TRAINER_COLORS[i % TRAINER_COLORS.length])
    })
    return map
  }, [activeTrainers])

  // ─── Navigation ────────────────────────────────────────────────────
  const navigate = (direction) => {
    const d = direction === 'next' ? 1 : -1
    if (view === 'week') setCurrentDate(prev => d > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1))
    if (view === 'month') setCurrentDate(prev => d > 0 ? addMonths(prev, 1) : subMonths(prev, 1))
    if (view === 'year') setCurrentDate(prev => d > 0 ? addYears(prev, 1) : subYears(prev, 1))
  }

  const goToday = () => setCurrentDate(new Date())

  // ─── Période visible ──────────────────────────────────────────────
  const { periodStart, periodEnd, periodLabel } = useMemo(() => {
    let start, end, label
    if (view === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 })
      end = endOfWeek(currentDate, { weekStartsOn: 1 })
      const startStr = format(start, 'd', { locale: fr })
      const endStr = format(end, 'd MMMM yyyy', { locale: fr })
      label = `${startStr} – ${endStr}`
    } else if (view === 'month') {
      start = startOfMonth(currentDate)
      end = endOfMonth(currentDate)
      label = format(currentDate, 'MMMM yyyy', { locale: fr })
    } else {
      start = startOfYear(currentDate)
      end = endOfYear(currentDate)
      label = format(currentDate, 'yyyy')
    }
    return { periodStart: start, periodEnd: end, periodLabel: label }
  }, [view, currentDate])

  // ─── Colonnes (jours ou mois) ─────────────────────────────────────
  const columns = useMemo(() => {
    if (view === 'year') {
      return eachMonthOfInterval({ start: periodStart, end: periodEnd })
    }
    return eachDayOfInterval({ start: periodStart, end: periodEnd })
  }, [view, periodStart, periodEnd])

  // ─── Sessions filtrées ────────────────────────────────────────────
  const sessionsInPeriod = useMemo(() => {
    return sessions.filter(s => {
      if (!statusFilter.includes(s.status)) return false
      if (!s.start_date || !s.end_date) return false
      const sStart = parseISO(s.start_date)
      const sEnd = parseISO(s.end_date)
      return sStart <= periodEnd && sEnd >= periodStart
    })
  }, [sessions, periodStart, periodEnd, statusFilter])

  // ─── Sessions par formateur ───────────────────────────────────────
  const sessionsByTrainer = useMemo(() => {
    const map = new Map()
    activeTrainers.forEach(t => map.set(t.id, []))
    map.set('unassigned', [])

    sessionsInPeriod.forEach(s => {
      const tid = s.trainer_id
      if (tid && map.has(tid)) {
        map.get(tid).push(s)
      } else {
        map.get('unassigned').push(s)
      }
    })

    return map
  }, [sessionsInPeriod, activeTrainers])

  // ─── Position d'un bloc session sur la grille ─────────────────────
  const getSessionPosition = (session) => {
    const sStart = parseISO(session.start_date)
    const sEnd = parseISO(session.end_date)
    const visibleStart = sStart < periodStart ? periodStart : sStart
    const visibleEnd = sEnd > periodEnd ? periodEnd : sEnd

    if (view === 'year') {
      const startCol = differenceInCalendarMonths(visibleStart, periodStart)
      const endCol = differenceInCalendarMonths(visibleEnd, periodStart)
      return { startCol, span: endCol - startCol + 1 }
    }

    const startCol = differenceInDays(visibleStart, periodStart)
    const span = differenceInDays(visibleEnd, visibleStart) + 1
    return { startCol, span }
  }

  // ─── Niveaux (empilage si chevauchement) ──────────────────────────
  const computeLevels = (trainerSessions) => {
    const sorted = [...trainerSessions].sort((a, b) =>
      parseISO(a.start_date) - parseISO(b.start_date) ||
      (a.start_time || '09:00').localeCompare(b.start_time || '09:00')
    )
    const levels = []

    sorted.forEach(session => {
      const pos = getSessionPosition(session)
      let level = 0
      while (levels[level]?.some(ex => {
        const ePos = getSessionPosition(ex)
        return pos.startCol < ePos.startCol + ePos.span && pos.startCol + pos.span > ePos.startCol
      })) {
        level++
      }
      if (!levels[level]) levels[level] = []
      levels[level].push(session)
    })

    return levels
  }

  // ─── Tooltip ──────────────────────────────────────────────────────
  const handleMouseEnter = (e, session) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const gridRect = gridRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
    setTooltipPos({
      x: rect.left - gridRect.left + rect.width / 2,
      y: rect.top - gridRect.top - 8
    })
    setHoveredSession(session)
  }

  // ─── Copier URL iCal ──────────────────────────────────────────────
  const copyCalendarUrl = (trainerId) => {
    const baseUrl = window.location.origin
    const url = `${baseUrl}/api/calendar?trainer=${trainerId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(trainerId)
      setTimeout(() => setCopiedUrl(null), 2500)
    })
  }

  const copyAllCalendarUrl = () => {
    const baseUrl = window.location.origin
    const url = `${baseUrl}/api/calendar?trainer=all`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl('all')
      setTimeout(() => setCopiedUrl(null), 2500)
    })
  }

  // ─── Toggle statut ────────────────────────────────────────────────
  const toggleStatus = (status) => {
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  // ─── Position "aujourd'hui" en % ──────────────────────────────────
  const todayPosition = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (today < periodStart || today > periodEnd) return null

    if (view === 'year') {
      const monthIdx = differenceInCalendarMonths(today, periodStart)
      const daysInMonth = endOfMonth(today).getDate()
      const dayOfMonth = today.getDate()
      return ((monthIdx + dayOfMonth / daysInMonth) / columns.length) * 100
    }

    const dayIdx = differenceInDays(today, periodStart)
    return ((dayIdx + 0.5) / columns.length) * 100
  }, [periodStart, periodEnd, columns, view])

  // ─── Hauteur des lignes ───────────────────────────────────────────
  const blockHeight = view === 'year' ? 26 : 34
  const blockGap = 2

  const getRowHeight = (trainerId) => {
    const trainerSessions = sessionsByTrainer.get(trainerId) || []
    if (!trainerSessions.length) return blockHeight + 12
    const levels = computeLevels(trainerSessions)
    return Math.max(blockHeight + 12, levels.length * (blockHeight + blockGap) + 10)
  }

  // ─── Rendu des blocs ──────────────────────────────────────────────
  const renderBlocks = (trainerSessions, trainerId) => {
    if (!trainerSessions.length) return null
    const colors = trainerColorMap.get(trainerId) || TRAINER_COLORS[0]
    const levels = computeLevels(trainerSessions)
    const totalCols = columns.length

    return levels.map((levelSessions, li) => (
      <div key={li} className="relative" style={{ height: `${blockHeight}px`, marginTop: li > 0 ? `${blockGap}px` : '0' }}>
        {levelSessions.map(session => {
          const pos = getSessionPosition(session)
          const leftPct = (pos.startCol / totalCols) * 100
          const widthPct = (pos.span / totalCols) * 100
          const courseName = session.session_type === 'subcontract'
            ? (session.subcontract_course_title || 'Sous-traitance')
            : (session.courses?.title || 'Formation')
          const clientName = session.clients?.name || ''
          const status = STATUS_CONFIG[session.status] || STATUS_CONFIG.planned
          const timeStr = session.start_time ? session.start_time.substring(0, 5) : ''

          return (
            <Link
              key={session.id}
              to={`/sessions/${session.id}`}
              className={`absolute top-0 rounded-md border-l-[3px] ${colors.border} cursor-pointer
                transition-all duration-150 hover:shadow-lg hover:scale-[1.02] hover:z-30 z-10
                flex items-center gap-1 px-1.5 overflow-hidden`}
              style={{
                left: `${leftPct}%`,
                width: `calc(${widthPct}% - 2px)`,
                height: `${blockHeight}px`,
                backgroundColor: colors.light,
              }}
              onMouseEnter={(e) => handleMouseEnter(e, session)}
              onMouseLeave={() => setHoveredSession(null)}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot} flex-shrink-0`} />
              {view !== 'year' && timeStr && (
                <span className="text-[10px] text-gray-400 flex-shrink-0 font-mono">{timeStr}</span>
              )}
              <span className={`text-xs font-medium ${colors.text} truncate`}>
                {view === 'year'
                  ? courseName.length > 12 ? courseName.substring(0, 12) + '…' : courseName
                  : `${courseName}${clientName ? ` · ${clientName}` : ''}`
                }
              </span>
            </Link>
          )
        })}
      </div>
    ))
  }

  return (
    <div className="card overflow-hidden" ref={containerRef}>
      {/* ─── Header ───────────────────────────────────────────── */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate('prev')} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button onClick={goToday} className="px-3 py-1 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
              Aujourd'hui
            </button>
            <button onClick={() => navigate('next')} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 capitalize ml-2">{periodLabel}</h2>
          </div>

          {/* Toggle vue */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {[
              { key: 'week', label: 'Semaine', icon: Calendar },
              { key: 'month', label: 'Mois', icon: CalendarDays },
              { key: 'year', label: 'Année', icon: CalendarRange },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all
                  ${view === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Légende formateurs + filtre statut */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-gray-100">
          {/* Formateurs */}
          <div className="flex flex-wrap items-center gap-2">
            {activeTrainers.map(trainer => {
              const colors = trainerColorMap.get(trainer.id)
              return (
                <div key={trainer.id} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: colors?.light, borderColor: colors?.accent }} />
                  <span className="text-sm text-gray-700 font-medium">{trainer.first_name} {trainer.last_name}</span>
                  <button
                    onClick={() => copyCalendarUrl(trainer.id)}
                    className="p-0.5 rounded hover:bg-gray-100 transition-colors group"
                    title={`Copier lien iCal pour ${trainer.first_name}`}
                  >
                    {copiedUrl === trainer.id
                      ? <Check className="w-3.5 h-3.5 text-green-600" />
                      : <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                    }
                  </button>
                </div>
              )
            })}
            {/* Lien "all" pour contact@ */}
            <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-gray-200">
              <span className="text-sm text-gray-500">Tous</span>
              <button
                onClick={copyAllCalendarUrl}
                className="p-0.5 rounded hover:bg-gray-100 transition-colors group"
                title="Copier lien iCal global (toutes les sessions) pour contact@"
              >
                {copiedUrl === 'all'
                  ? <Check className="w-3.5 h-3.5 text-green-600" />
                  : <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                }
              </button>
            </div>
          </div>

          {/* Filtre statut */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'cancelled').map(([key, { label, dot }]) => (
              <button
                key={key}
                onClick={() => toggleStatus(key)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all border
                  ${statusFilter.includes(key)
                    ? 'bg-white border-gray-300 text-gray-700 shadow-sm'
                    : 'bg-gray-50 border-transparent text-gray-400'
                  }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Aide Google Agenda */}
        <div className="mt-2 text-[10px] text-gray-400">
          📋 Copier un lien → Google Agenda → <strong>Autres agendas</strong> → <strong>À partir de l'URL</strong> → Coller
        </div>
      </div>

      {/* ─── Grille Gantt ─────────────────────────────────────── */}
      <div className="overflow-x-auto" ref={gridRef}>
        <div style={{ minWidth: view === 'week' ? '100%' : view === 'month' ? '900px' : '800px' }}>

          {/* En-tête colonnes */}
          <div className="flex border-b border-gray-200 sticky top-0 bg-white z-30">
            <div className="w-44 flex-shrink-0 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 bg-gray-50">
              Formateur
            </div>
            <div className="flex-1 flex relative">
              {columns.map((col, i) => {
                const weekend = view !== 'year' && isWeekend(col)
                const today = view !== 'year' && isToday(col)
                return (
                  <div
                    key={i}
                    className={`flex-1 text-center py-2 text-xs border-r border-gray-100 last:border-r-0
                      ${weekend ? 'bg-gray-50' : ''} ${today ? 'bg-blue-50' : ''}`}
                  >
                    {view === 'year' ? (
                      <span className="font-medium text-gray-700">{format(col, 'MMM', { locale: fr })}</span>
                    ) : (
                      <>
                        <div className={`font-medium ${today ? 'text-blue-600' : weekend ? 'text-gray-400' : 'text-gray-600'}`}>
                          {format(col, 'EEE', { locale: fr })}
                        </div>
                        <div className={`text-sm font-semibold mt-0.5
                          ${today
                            ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto'
                            : weekend ? 'text-gray-400' : 'text-gray-800'
                          }`}
                        >
                          {format(col, 'd')}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lignes formateurs */}
          <div className="relative">
            {/* Ligne verticale "aujourd'hui" */}
            {todayPosition !== null && (
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: `calc(176px + (100% - 176px) * ${todayPosition / 100})` }}
              >
                <div className="w-0.5 h-full bg-red-400 opacity-60" />
              </div>
            )}

            {activeTrainers.map((trainer, idx) => {
              const trainerSessions = sessionsByTrainer.get(trainer.id) || []
              const rowH = getRowHeight(trainer.id)
              const colors = trainerColorMap.get(trainer.id)

              return (
                <div
                  key={trainer.id}
                  className={`flex border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                  style={{ minHeight: `${rowH}px` }}
                >
                  {/* Nom */}
                  <div className="w-44 flex-shrink-0 px-3 py-2 border-r border-gray-200 flex items-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: colors?.accent }} />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{trainer.first_name}</div>
                      <div className="text-xs text-gray-500">{trainer.last_name}</div>
                      {trainerSessions.length > 0 && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {trainerSessions.length} session{trainerSessions.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Zone grille */}
                  <div className="flex-1 relative py-1">
                    {/* Fond grille */}
                    <div className="absolute inset-0 flex">
                      {columns.map((col, i) => {
                        const weekend = view !== 'year' && isWeekend(col)
                        const today = view !== 'year' && isToday(col)
                        return (
                          <div
                            key={i}
                            className={`flex-1 border-r border-gray-100 last:border-r-0
                              ${weekend ? 'bg-gray-50/50' : ''} ${today ? 'bg-blue-50/30' : ''}`}
                          />
                        )
                      })}
                    </div>
                    {/* Blocs */}
                    <div className="relative z-10 px-0.5">
                      {renderBlocks(trainerSessions, trainer.id)}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Non assigné */}
            {(sessionsByTrainer.get('unassigned') || []).length > 0 && (
              <div className="flex border-b border-gray-100 bg-red-50/20">
                <div className="w-44 flex-shrink-0 px-3 py-2 border-r border-gray-200">
                  <div className="text-sm font-medium text-red-600">Non assigné</div>
                  <div className="text-[10px] text-red-400">
                    {sessionsByTrainer.get('unassigned').length} session(s)
                  </div>
                </div>
                <div className="flex-1 relative py-1">
                  <div className="absolute inset-0 flex">
                    {columns.map((_, i) => (
                      <div key={i} className="flex-1 border-r border-gray-100 last:border-r-0" />
                    ))}
                  </div>
                  <div className="relative z-10 px-0.5">
                    {renderBlocks(sessionsByTrainer.get('unassigned'), 'unassigned')}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vide */}
          {sessionsInPeriod.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Aucune session sur cette période</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Tooltip ──────────────────────────────────────────── */}
      {hoveredSession && (
        <div
          className="absolute z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-72 pointer-events-none"
          style={{
            left: `${Math.max(16, Math.min(tooltipPos.x, (gridRef.current?.offsetWidth || 500) - 290))}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-semibold text-gray-900 text-sm leading-tight">
              {hoveredSession.session_type === 'subcontract'
                ? (hoveredSession.subcontract_course_title || 'Sous-traitance')
                : (hoveredSession.courses?.title || 'Formation')
              }
            </h4>
            <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1 ${STATUS_CONFIG[hoveredSession.status]?.dot || 'bg-gray-400'}`} />
          </div>

          {hoveredSession.clients?.name && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
              <Users className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{hoveredSession.clients.name}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>
              {format(parseISO(hoveredSession.start_date), 'd MMM', { locale: fr })}
              {hoveredSession.start_date !== hoveredSession.end_date && (
                <> → {format(parseISO(hoveredSession.end_date), 'd MMM yyyy', { locale: fr })}</>
              )}
              {hoveredSession.start_time && (
                <span className="text-gray-400 ml-1">
                  {hoveredSession.start_time.substring(0, 5)} – {(hoveredSession.end_time || '17:00').substring(0, 5)}
                </span>
              )}
            </span>
          </div>

          {(hoveredSession.location_name || hoveredSession.location_city) && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{hoveredSession.location_name || hoveredSession.location_city}</span>
            </div>
          )}

          {hoveredSession.session_trainees?.length > 0 && (
            <div className="text-[10px] text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100">
              {hoveredSession.session_trainees.length} stagiaire{hoveredSession.session_trainees.length > 1 ? 's' : ''} inscrit{hoveredSession.session_trainees.length > 1 ? 's' : ''}
            </div>
          )}

          <div className="text-[10px] text-gray-400 mt-1">
            {STATUS_CONFIG[hoveredSession.status]?.label} · {hoveredSession.reference}
          </div>
        </div>
      )}

      {/* ─── Stats rapides ────────────────────────────────────── */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span>
          <strong className="text-gray-700">{sessionsInPeriod.length}</strong> session{sessionsInPeriod.length > 1 ? 's' : ''} sur la période
        </span>
        {activeTrainers.map(t => {
          const count = (sessionsByTrainer.get(t.id) || []).length
          if (!count) return null
          const colors = trainerColorMap.get(t.id)
          return (
            <span key={t.id} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors?.accent }} />
              {t.first_name} : <strong className="text-gray-700">{count}</strong>
            </span>
          )
        })}
        {(sessionsByTrainer.get('unassigned') || []).length > 0 && (
          <span className="text-red-500">
            ⚠ {sessionsByTrainer.get('unassigned').length} non assignée(s)
          </span>
        )}
      </div>
    </div>
  )
}
