// api/sync-google-calendar.js
// Cron de synchronisation Access Campus → Google Calendar
// Pousse sessions, RDV commerciaux et rappels dans les agendas des formateurs
// 
// Cron: toutes les 15 min (vercel.json)
// Manual: GET /api/sync-google-calendar?force=true

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── Config formateurs → calendriers ─────────────────────
const CALENDAR_MAP = {
  hicham: {
    calendarId: process.env.GCAL_HICHAM || 'hicham.saidi@accessformation.pro',
    trainerMatch: 'hicham',
    conductedBy: 'Hicham',
  },
  maxime: {
    calendarId: process.env.GCAL_MAXIME || 'maxime.langlais@accessformation.pro',
    trainerMatch: 'maxime',
    conductedBy: 'Maxime',
  },
}

// ─── Google Auth (Service Account JWT) ────────────────────
async function getAccessToken() {
  const keyData = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  
  // Créer le JWT manuellement avec crypto Node.js
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: keyData.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const signingInput = `${encode(header)}.${encode(claim)}`

  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(keyData.private_key, 'base64url')

  const jwt = `${signingInput}.${signature}`

  // Échanger le JWT contre un access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Google Auth failed: ${err}`)
  }

  const { access_token } = await tokenRes.json()
  return access_token
}

// ─── Google Calendar API helpers ──────────────────────────
async function gcalRequest(accessToken, calendarId, method, path, body = null) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}${path}`
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }
  if (body) options.body = JSON.stringify(body)

  const res = await fetch(url, options)

  if (res.status === 404 && method === 'DELETE') return null // Already deleted
  if (res.status === 404 && method === 'PATCH') return null // Event gone
  if (res.status === 409) return 'conflict' // Already exists

  if (!res.ok) {
    const err = await res.text()
    console.error(`GCal ${method} ${path} failed:`, err)
    return null
  }

  if (res.status === 204) return true
  return await res.json()
}

// Récupérer tous les événements Campus existants dans le calendrier
async function getExistingCampusEvents(accessToken, calendarId) {
  const events = []
  let pageToken = null

  // Chercher les événements 2 mois passés → 4 mois futur
  const twoMonthsAgo = new Date()
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
  const fourMonthsAhead = new Date()
  fourMonthsAhead.setMonth(fourMonthsAhead.getMonth() + 4)

  do {
    let path = `/events?maxResults=250&singleEvents=true&privateExtendedProperty=campusManaged%3Dtrue`
    path += `&timeMin=${twoMonthsAgo.toISOString()}`
    path += `&timeMax=${fourMonthsAhead.toISOString()}`
    if (pageToken) path += `&pageToken=${pageToken}`

    const result = await gcalRequest(accessToken, calendarId, 'GET', path)
    if (result && result.items) {
      events.push(...result.items)
      pageToken = result.nextPageToken || null
    } else {
      break
    }
  } while (pageToken)

  return events
}

// ─── Helpers ──────────────────────────────────────────────
function getDateRange(startDate, endDate) {
  const dates = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const current = new Date(start)
  while (current <= end) {
    const dow = current.getDay()
    if (dow !== 0 && dow !== 6) {
      dates.push(current.toISOString().split('T')[0])
    }
    current.setDate(current.getDate() + 1)
  }
  if (dates.length === 0) {
    const c = new Date(start)
    while (c <= end) {
      dates.push(c.toISOString().split('T')[0])
      c.setDate(c.getDate() + 1)
    }
  }
  return dates
}

function timeToGcal(date, time) {
  const t = time || '09:00:00'
  const timePart = t.length === 5 ? t + ':00' : t
  return `${date}T${timePart}`
}

function addMinutes(time, mins) {
  const [h, m] = (time || '10:00').split(':').map(Number)
  const total = h * 60 + (m || 0) + mins
  const newH = String(Math.floor(total / 60)).padStart(2, '0')
  const newM = String(total % 60).padStart(2, '0')
  return `${newH}:${newM}:00`
}

// Couleurs Google Calendar (colorId)
const COLORS = {
  session: '9',    // Blueberry (bleu foncé)
  rdv: '2',        // Sage (vert)
  callback: '5',   // Banana (jaune)
}

// ─── Construire les événements attendus ───────────────────
async function buildExpectedEvents(trainerConfig) {
  const events = []

  // ═══ SESSIONS ═══
  const twoMonthsAgo = new Date()
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
  const pastDate = twoMonthsAgo.toISOString().split('T')[0]

  // Trouver le trainer_id
  const { data: trainerData } = await supabase
    .from('trainers')
    .select('id, first_name, last_name')
    .ilike('first_name', `%${trainerConfig.trainerMatch}%`)
    .single()

  if (trainerData) {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, reference, start_date, end_date, start_time, end_time, location_city, location_name, location_address, status, course_id, client_id, notes')
      .eq('trainer_id', trainerData.id)
      .neq('status', 'cancelled')
      .gte('end_date', pastDate)
      .order('start_date')

    // Charger cours et clients
    const courseIds = [...new Set((sessions || []).map(s => s.course_id).filter(Boolean))]
    const clientIds = [...new Set((sessions || []).map(s => s.client_id).filter(Boolean))]

    const [coursesRes, clientsRes] = await Promise.all([
      courseIds.length > 0 ? supabase.from('courses').select('id, title').in('id', courseIds) : { data: [] },
      clientIds.length > 0 ? supabase.from('clients').select('id, name').in('id', clientIds) : { data: [] },
    ])
    const coursesMap = new Map((coursesRes.data || []).map(c => [c.id, c]))
    const clientsMap = new Map((clientsRes.data || []).map(c => [c.id, c]))

    for (const session of (sessions || [])) {
      const course = coursesMap.get(session.course_id)
      const client = clientsMap.get(session.client_id)
      const courseName = course?.title || 'Formation'
      const clientName = client?.name || ''

      const days = getDateRange(session.start_date, session.end_date || session.start_date)
      const totalDays = days.length

      days.forEach((dayDate, dayIdx) => {
        const dayLabel = totalDays > 1 ? ` (J${dayIdx + 1}/${totalDays})` : ''
        const campusId = totalDays > 1
          ? `session-${session.id}-day${dayIdx + 1}`
          : `session-${session.id}`

        const locationParts = [session.location_name, session.location_address, session.location_city].filter(Boolean)

        events.push({
          campusId,
          campusType: 'session',
          summary: `🎓 ${courseName} - ${clientName}${dayLabel}`,
          description: [
            `Formation : ${courseName}`,
            clientName ? `Client : ${clientName}` : null,
            session.reference ? `Réf : ${session.reference}` : null,
            `Formateur : ${trainerData.first_name} ${trainerData.last_name}`,
            session.notes ? `\nNotes : ${session.notes}` : null,
          ].filter(Boolean).join('\n'),
          location: locationParts.join(', '),
          startDateTime: timeToGcal(dayDate, session.start_time || '09:00'),
          endDateTime: timeToGcal(dayDate, session.end_time || '17:00'),
          colorId: COLORS.session,
          status: session.status === 'completed' ? 'confirmed' : 'tentative',
        })
      })
    }
  }

  // ═══ RDV COMMERCIAUX ═══
  const { data: rdvs } = await supabase
    .from('prospect_rdv')
    .select('id, rdv_date, rdv_time, contact_name, contact_phone, conducted_by, status, notes, formations_interet, rdv_type, rdv_address, rdv_location, client_id')
    .eq('conducted_by', trainerConfig.conductedBy)
    .gte('rdv_date', pastDate)
    .in('status', ['a_prendre', 'prevu', 'planifie', 'realise'])
    .order('rdv_date')

  // Charger noms clients pour les RDV
  const rdvClientIds = [...new Set((rdvs || []).map(r => r.client_id).filter(Boolean))]
  let rdvClientsMap = new Map()
  if (rdvClientIds.length > 0) {
    const { data: rdvClients } = await supabase.from('clients').select('id, name').in('id', rdvClientIds)
    rdvClientsMap = new Map((rdvClients || []).map(c => [c.id, c]))
  }

  for (const rdv of (rdvs || [])) {
    const client = rdvClientsMap.get(rdv.client_id)
    const clientName = client?.name || 'Prospect'
    const rdvTime = rdv.rdv_time || '10:00'
    const isPhone = rdv.rdv_type === 'telephone' || rdv.rdv_type === 'visio'
    const durationMin = isPhone ? 30 : 60

    let location = ''
    if (rdv.rdv_address) {
      location = rdv.rdv_address
    } else if (rdv.rdv_location === 'client') {
      location = `Chez ${clientName}`
    } else if (rdv.rdv_location === 'bureau') {
      location = 'Access Formation, 24 rue Kerbleiz, 29900 Concarneau'
    }

    events.push({
      campusId: `rdv-${rdv.id}`,
      campusType: 'rdv',
      summary: `🤝 ${clientName}${rdv.contact_name ? ' — ' + rdv.contact_name : ''}`,
      description: [
        `RDV commercial : ${clientName}`,
        rdv.contact_name ? `Contact : ${rdv.contact_name}` : null,
        rdv.contact_phone ? `Tél : ${rdv.contact_phone}` : null,
        rdv.rdv_type ? `Type : ${rdv.rdv_type}` : null,
        rdv.formations_interet?.length > 0 ? `Formations : ${rdv.formations_interet.join(', ')}` : null,
        rdv.notes ? `\nNotes : ${rdv.notes}` : null,
      ].filter(Boolean).join('\n'),
      location,
      startDateTime: timeToGcal(rdv.rdv_date, rdvTime),
      endDateTime: timeToGcal(rdv.rdv_date, addMinutes(rdvTime, durationMin)),
      colorId: COLORS.rdv,
      status: 'confirmed',
    })
  }

  // ═══ RAPPELS (callbacks) — uniquement pour Hicham ═══
  if (trainerConfig.conductedBy === 'Hicham') {
    const { data: callbacks } = await supabase
      .from('prospect_calls')
      .select('id, callback_date, callback_time, contact_name, notes, client_id')
      .eq('needs_callback', true)
      .gte('callback_date', pastDate)

    const cbClientIds = [...new Set((callbacks || []).map(c => c.client_id).filter(Boolean))]
    let cbClientsMap = new Map()
    if (cbClientIds.length > 0) {
      const { data: cbClients } = await supabase.from('clients').select('id, name').in('id', cbClientIds)
      cbClientsMap = new Map((cbClients || []).map(c => [c.id, c]))
    }

    for (const cb of (callbacks || [])) {
      if (!cb.callback_date) continue
      const client = cbClientsMap.get(cb.client_id)
      const clientName = client?.name || 'Rappel'
      const cbTime = cb.callback_time || '10:00'

      events.push({
        campusId: `callback-${cb.id}`,
        campusType: 'callback',
        summary: `📞 Rappeler ${clientName}${cb.contact_name ? ' — ' + cb.contact_name : ''}`,
        description: cb.notes ? `Notes : ${cb.notes}` : '',
        location: '',
        startDateTime: timeToGcal(cb.callback_date, cbTime),
        endDateTime: timeToGcal(cb.callback_date, addMinutes(cbTime, 30)),
        colorId: COLORS.callback,
        status: 'confirmed',
      })
    }
  }

  return events
}

// ─── Construire le body Google Calendar ───────────────────
function buildGcalEvent(event) {
  return {
    summary: event.summary,
    description: event.description || '',
    location: event.location || '',
    start: {
      dateTime: event.startDateTime,
      timeZone: 'Europe/Paris',
    },
    end: {
      dateTime: event.endDateTime,
      timeZone: 'Europe/Paris',
    },
    colorId: event.colorId,
    status: event.status || 'confirmed',
    extendedProperties: {
      private: {
        campusManaged: 'true',
        campusId: event.campusId,
        campusType: event.campusType,
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
      ],
    },
  }
}

// ─── Sync principal ───────────────────────────────────────
async function syncCalendar(accessToken, calendarId, trainerConfig, trainerLabel) {
  const stats = { created: 0, updated: 0, deleted: 0, unchanged: 0, errors: 0 }

  try {
    // 1. Récupérer les événements Campus existants dans Google
    const existingEvents = await getExistingCampusEvents(accessToken, calendarId)
    const existingMap = new Map()
    for (const evt of existingEvents) {
      const campusId = evt.extendedProperties?.private?.campusId
      if (campusId) existingMap.set(campusId, evt)
    }

    // 2. Construire les événements attendus depuis Supabase
    const expectedEvents = await buildExpectedEvents(trainerConfig)
    const expectedIds = new Set(expectedEvents.map(e => e.campusId))

    // 3. Créer ou mettre à jour
    for (const event of expectedEvents) {
      const existing = existingMap.get(event.campusId)
      const gcalBody = buildGcalEvent(event)

      if (existing) {
        // Vérifier si mise à jour nécessaire
        const needsUpdate =
          existing.summary !== event.summary ||
          existing.description !== (event.description || '') ||
          existing.location !== (event.location || '') ||
          existing.start?.dateTime?.substring(0, 16) !== event.startDateTime.substring(0, 16) ||
          existing.colorId !== event.colorId ||
          existing.status !== (event.status || 'confirmed')

        if (needsUpdate) {
          const result = await gcalRequest(accessToken, calendarId, 'PATCH', `/events/${existing.id}`, gcalBody)
          if (result) stats.updated++
          else stats.errors++
        } else {
          stats.unchanged++
        }
      } else {
        // Créer
        const result = await gcalRequest(accessToken, calendarId, 'POST', '/events', gcalBody)
        if (result && result !== 'conflict') stats.created++
        else if (result === 'conflict') stats.unchanged++
        else stats.errors++
      }
    }

    // 4. Supprimer les événements Campus qui n'existent plus
    for (const [campusId, gcalEvent] of existingMap) {
      if (!expectedIds.has(campusId)) {
        await gcalRequest(accessToken, calendarId, 'DELETE', `/events/${gcalEvent.id}`)
        stats.deleted++
      }
    }
  } catch (err) {
    console.error(`Sync error for ${trainerLabel}:`, err)
    stats.errors++
  }

  console.log(`[GCal Sync] ${trainerLabel}: +${stats.created} ~${stats.updated} -${stats.deleted} =${stats.unchanged} !${stats.errors}`)
  return stats
}

// ═══ HANDLER ══════════════════════════════════════════════
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY non configurée' })
  }

  try {
    const accessToken = await getAccessToken()
    const results = {}

    for (const [key, config] of Object.entries(CALENDAR_MAP)) {
      results[key] = await syncCalendar(accessToken, config.calendarId, config, key)
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error) {
    console.error('GCal sync global error:', error)
    return res.status(500).json({ error: error.message })
  }
}
