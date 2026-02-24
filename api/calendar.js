// api/calendar.js
// Endpoint iCal pour synchronisation Google Agenda
// 
// Usage :
//   GET /api/calendar?trainer=UUID        → sessions d'un formateur
//   GET /api/calendar?trainer=all         → toutes les sessions (pour contact@)
//
// Google Agenda → Autres agendas → À partir de l'URL → coller le lien
// Ne modifie RIEN dans l'agenda existant (calendrier séparé en lecture seule)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function escapeIcal(str) {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function formatIcalDateTime(date, time) {
  if (!date) return ''
  const d = date.replace(/-/g, '')
  const t = time ? time.replace(/:/g, '').substring(0, 6) : '090000'
  // S'assurer qu'on a bien 6 caractères (HHMMSS)
  const tPadded = t.length === 4 ? t + '00' : t
  return d + 'T' + tPadded
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { trainer } = req.query

  if (!trainer) {
    return res.status(400).json({
      error: 'Paramètre trainer requis',
      usage: [
        '/api/calendar?trainer=UUID   → sessions d\'un formateur',
        '/api/calendar?trainer=all    → toutes les sessions'
      ]
    })
  }

  try {
    const isAll = trainer === 'all'
    let calName = 'Access Formation - Planning'
    let trainerName = 'Tous'

    // ─── Charger le formateur (si spécifique) ─────────────────
    if (!isAll) {
      const { data: trainerData, error: trainerError } = await supabase
        .from('trainers')
        .select('id, first_name, last_name, email')
        .eq('id', trainer)
        .single()

      if (trainerError || !trainerData) {
        return res.status(404).json({ error: 'Formateur non trouvé' })
      }

      trainerName = `${trainerData.first_name} ${trainerData.last_name}`
      calName = `Access Formation - ${trainerName}`
    }

    // ─── Charger les sessions (6 mois passés + futur) ─────────
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const pastDate = sixMonthsAgo.toISOString().split('T')[0]

    let query = supabase
      .from('sessions')
      .select('*')
      .neq('status', 'cancelled')
      .gte('end_date', pastDate)
      .order('start_date', { ascending: true })

    // Filtrer par formateur si pas "all"
    if (!isAll) {
      query = query.eq('trainer_id', trainer)
    }

    const { data: sessions, error: sessionsError } = await query

    if (sessionsError) {
      console.error('Calendar - sessions query error:', sessionsError)
      return res.status(500).json({ error: 'Erreur chargement sessions' })
    }

    // ─── Charger cours et clients associés ────────────────────
    const courseIds = [...new Set((sessions || []).map(s => s.course_id).filter(Boolean))]
    const clientIds = [...new Set((sessions || []).map(s => s.client_id).filter(Boolean))]
    const trainerIds = isAll
      ? [...new Set((sessions || []).map(s => s.trainer_id).filter(Boolean))]
      : []

    const promises = [
      courseIds.length > 0
        ? supabase.from('courses').select('id, title').in('id', courseIds)
        : Promise.resolve({ data: [] }),
      clientIds.length > 0
        ? supabase.from('clients').select('id, name').in('id', clientIds)
        : Promise.resolve({ data: [] }),
    ]

    // En mode "all", charger aussi les noms des formateurs
    if (trainerIds.length > 0) {
      promises.push(
        supabase.from('trainers').select('id, first_name, last_name').in('id', trainerIds)
      )
    }

    const results = await Promise.all(promises)
    const coursesMap = new Map((results[0].data || []).map(c => [c.id, c]))
    const clientsMap = new Map((results[1].data || []).map(c => [c.id, c]))
    const trainersMap = trainerIds.length > 0
      ? new Map((results[2].data || []).map(t => [t.id, t]))
      : new Map()

    // ─── Générer le calendrier iCal ───────────────────────────
    const ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Access Formation//Access Campus//FR',
      `X-WR-CALNAME:${escapeIcal(calName)}`,
      'X-WR-TIMEZONE:Europe/Paris',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      // Fuseau horaire Europe/Paris
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Paris',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0200',
      'TZNAME:CEST',
      'DTSTART:19700329T020000',
      'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'TZNAME:CET',
      'DTSTART:19701025T030000',
      'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
      'END:STANDARD',
      'END:VTIMEZONE',
    ]

    for (const session of (sessions || [])) {
      const course = coursesMap.get(session.course_id)
      const client = clientsMap.get(session.client_id)
      const sessionTrainer = trainersMap.get(session.trainer_id)

      const courseName = session.session_type === 'subcontract'
        ? (session.subcontract_course_title || 'Sous-traitance')
        : (course?.title || 'Formation')
      const clientName = client?.name || ''

      // En mode "all", ajouter le nom du formateur dans le titre
      let summary = clientName ? `${courseName} - ${clientName}` : courseName
      if (isAll && sessionTrainer) {
        summary = `[${sessionTrainer.first_name}] ${summary}`
      }

      // Location
      const locationParts = [
        session.location_name,
        session.location_address,
        session.location_postal_code,
        session.location_city
      ].filter(Boolean)
      const location = locationParts.join(', ')

      // Description
      const descParts = [
        `Formation : ${courseName}`,
        clientName ? `Client : ${clientName}` : null,
        sessionTrainer ? `Formateur : ${sessionTrainer.first_name} ${sessionTrainer.last_name}` : null,
        session.reference ? `Réf : ${session.reference}` : null,
        location ? `Lieu : ${location}` : null,
        session.notes ? `Notes : ${session.notes}` : null,
      ].filter(Boolean)

      const uid = `session-${session.id}@access-formation.fr`
      const dtstart = formatIcalDateTime(session.start_date, session.start_time || '09:00:00')
      const dtend = formatIcalDateTime(session.end_date, session.end_time || '17:00:00')
      const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

      const event = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART;TZID=Europe/Paris:${dtstart}`,
        `DTEND;TZID=Europe/Paris:${dtend}`,
        `SUMMARY:${escapeIcal(summary)}`,
        location ? `LOCATION:${escapeIcal(location)}` : null,
        `DESCRIPTION:${escapeIcal(descParts.join('\\n'))}`,
        `STATUS:${session.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE'}`,
        // Rappel J-1
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        `DESCRIPTION:Demain : ${escapeIcal(summary)}`,
        'END:VALARM',
        // Rappel H-1
        'BEGIN:VALARM',
        'TRIGGER:-PT1H',
        'ACTION:DISPLAY',
        `DESCRIPTION:Dans 1h : ${escapeIcal(summary)}`,
        'END:VALARM',
        'END:VEVENT'
      ]

      ical.push(...event.filter(Boolean))
    }

    ical.push('END:VCALENDAR')

    const icalContent = ical.join('\r\n')

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', `inline; filename="access_formation_${trainerName.replace(/\s+/g, '_')}.ics"`)
    // Cache 15 min — Google Agenda rafraîchit ~toutes les 12h
    res.setHeader('Cache-Control', 'public, max-age=900, s-maxage=900')

    return res.status(200).send(icalContent)

  } catch (error) {
    console.error('Calendar endpoint error:', error)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
}
