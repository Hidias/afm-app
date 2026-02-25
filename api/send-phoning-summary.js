/**
 * ============================================================================
 * RÉSUMÉS PHONING — Demi-journée + Pas de réponse
 * ============================================================================
 * 
 * Endpoints légers pour suivi en quasi-temps réel
 * 
 * Cron 1 : Lun-Ven 12h Paris → résumé matin (chaud, tiède, froid, redirigé)
 * Cron 2 : Mar+Jeu 7h Paris  → résumé "pas de réponse" (derniers jours)
 * 
 * GET /api/send-phoning-summary?period=morning     (cron 12h)
 * GET /api/send-phoning-summary?period=noreply      (cron Mar/Jeu 7h)
 * POST /api/send-phoning-summary?period=morning     (test manuel)
 * ============================================================================
 */

import { getSupabaseAdmin, decrypt } from './_lib/mailer.js'
import nodemailer from 'nodemailer'

const RECIPIENT = 'hicham.saidi@accessformation.pro'

const RESULT_LABELS = {
  chaud: '🔥 Intéressé', tiede: '🟡 Tiède', froid: '❄️ Refus',
  no_answer: '📵 Pas de réponse', blocked: '⚠️ Barrage',
  wrong_number: '❌ N° erroné',
}

const RESULT_SECTIONS = {
  chaud: { emoji: '🔥', title: 'INTÉRESSÉS', color: '#059669' },
  tiede: { emoji: '🟡', title: 'TIÈDES', color: '#d97706' },
  froid: { emoji: '❄️', title: 'REFUS', color: '#3b82f6' },
  blocked: { emoji: '⚠️', title: 'BARRAGE', color: '#dc2626' },
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function parisNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
}

function parisToday7h() {
  const d = parisNow()
  d.setHours(7, 0, 0, 0)
  return d
}

function parisToday12h() {
  const d = parisNow()
  d.setHours(12, 0, 0, 0)
  return d
}

function fmtHeure(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })
}

// ═══════════════════════════════════════════════════════════════
// BUILD HTML — Résumé demi-journée
// ═══════════════════════════════════════════════════════════════

function buildHalfDayHTML(calls, periodLabel) {
  const now = parisNow()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Grouper par résultat (seuls les résultats avec contact)
  const grouped = {}
  const contactResults = ['chaud', 'tiede', 'froid', 'blocked']
  contactResults.forEach(r => { grouped[r] = calls.filter(c => c.call_result === r) })

  // Redirigés = prospection_status changed to 'redirige' (tracked via notes)
  const redirected = calls.filter(c => c.notes && c.notes.includes('Redirigé'))

  let sections = ''
  for (const [result, config] of Object.entries(RESULT_SECTIONS)) {
    const list = grouped[result] || []
    if (list.length === 0) continue
    let rows = ''
    list.forEach(c => {
      const contact = [c.contact_name, c.contact_function].filter(Boolean).join(' — ')
      const formations = (c.formations_mentioned || []).join(', ')
      rows += `<tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:6px 10px;font-size:12px;white-space:nowrap;color:#6b7280">${fmtHeure(c.called_at)}</td>
        <td style="padding:6px 10px;font-size:13px;font-weight:600">${c._name || '-'}</td>
        <td style="padding:6px 10px;font-size:12px;color:#6b7280">${c._city || ''}</td>
        <td style="padding:6px 10px;font-size:12px">${c.called_by || ''}</td>
        <td style="padding:6px 10px;font-size:12px;color:#6b7280">${contact}${formations ? '<br>🎓 ' + formations : ''}${c.notes ? '<br><i>' + c.notes.substring(0, 100) + '</i>' : ''}</td>
      </tr>`
    })
    sections += `<div style="margin:16px 0">
      <h3 style="margin:0 0 6px;font-size:14px;color:${config.color}">${config.emoji} ${config.title} (${list.length})</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
        <tbody>${rows}</tbody>
      </table>
    </div>`
  }

  if (redirected.length > 0) {
    let rows = ''
    redirected.forEach(c => {
      rows += `<tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:6px 10px;font-size:12px">${fmtHeure(c.called_at)}</td>
        <td style="padding:6px 10px;font-size:13px;font-weight:600">${c._name || '-'}</td>
        <td style="padding:6px 10px;font-size:12px;color:#6b7280">${c._city || ''}</td>
        <td style="padding:6px 10px;font-size:12px">${c.called_by || ''}</td>
        <td style="padding:6px 10px;font-size:12px;color:#6b7280;font-style:italic">${(c.notes || '').substring(0, 100)}</td>
      </tr>`
    })
    sections += `<div style="margin:16px 0">
      <h3 style="margin:0 0 6px;font-size:14px;color:#7c3aed">🏢 REDIRIGÉS (${redirected.length})</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb"><tbody>${rows}</tbody></table>
    </div>`
  }

  const totalContact = contactResults.reduce((sum, r) => sum + (grouped[r]?.length || 0), 0) + redirected.length
  if (totalContact === 0) return null // Aucun appel avec contact → pas d'email

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;max-width:700px;margin:0 auto;padding:16px">
  <div style="background:#1e40af;color:white;padding:16px 20px;border-radius:10px 10px 0 0">
    <h1 style="margin:0;font-size:18px">📞 Résumé phoning — ${periodLabel}</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px">${dateStr} · ${totalContact} appel(s) avec contact</p>
  </div>
  <div style="padding:10px 20px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
    ${sections || '<p style="color:#9ca3af;text-align:center;padding:20px">Aucun appel avec contact</p>'}
  </div>
  <p style="text-align:center;font-size:10px;color:#9ca3af;margin:12px 0 0">Access Campus · Résumé automatique</p>
</body></html>`
}

// ═══════════════════════════════════════════════════════════════
// BUILD HTML — Pas de réponse
// ═══════════════════════════════════════════════════════════════

function buildNoReplyHTML(calls) {
  const now = parisNow()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  if (calls.length === 0) return null

  let rows = ''
  calls.forEach(c => {
    rows += `<tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:5px 10px;font-size:12px;color:#6b7280">${fmtDate(c.called_at)} ${fmtHeure(c.called_at)}</td>
      <td style="padding:5px 10px;font-size:13px;font-weight:500">${c._name || '-'}</td>
      <td style="padding:5px 10px;font-size:12px;color:#6b7280">${c._city || ''} (${c._dept || ''})</td>
      <td style="padding:5px 10px;font-size:12px">${c._phone || ''}</td>
      <td style="padding:5px 10px;font-size:12px;color:#6b7280">${c.called_by || ''}</td>
      <td style="padding:5px 10px;font-size:12px;text-align:center">${c._callCount || 1}</td>
    </tr>`
  })

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;max-width:700px;margin:0 auto;padding:16px">
  <div style="background:#6b7280;color:white;padding:16px 20px;border-radius:10px 10px 0 0">
    <h1 style="margin:0;font-size:18px">📵 Prospects injoignables — Récap</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px">${dateStr} · ${calls.length} prospect(s) sans réponse récente</p>
  </div>
  <div style="padding:10px 20px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:5px 10px;text-align:left;font-size:11px">Date/Heure</th>
        <th style="padding:5px 10px;text-align:left;font-size:11px">Prospect</th>
        <th style="padding:5px 10px;text-align:left;font-size:11px">Ville</th>
        <th style="padding:5px 10px;text-align:left;font-size:11px">Tél</th>
        <th style="padding:5px 10px;text-align:left;font-size:11px">Par</th>
        <th style="padding:5px 10px;text-align:center;font-size:11px">Tentatives</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p style="text-align:center;font-size:10px;color:#9ca3af;margin:12px 0 0">Access Campus · Récap automatique mardi/jeudi</p>
</body></html>`
}

// ═══════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // Auth pour cron
  if (req.method === 'GET') {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Non autorisé' })
    }
  }

  const period = req.query?.period || 'morning'
  const supabase = getSupabaseAdmin()

  try {
    if (period === 'noreply') {
      // ─── Récap "pas de réponse" — 3 derniers jours ───
      const since = new Date()
      since.setDate(since.getDate() - 3)

      const { data: rawCalls } = await supabase
        .from('prospect_calls')
        .select('*, clients(name, city, siren, contact_phone, postal_code)')
        .eq('call_result', 'no_answer')
        .gte('called_at', since.toISOString())
        .order('called_at', { ascending: false })

      // Enrichir avec prospection_massive
      const sirens = [...new Set((rawCalls || []).map(c => c.clients?.siren).filter(Boolean))]
      const pmMap = {}
      if (sirens.length > 0) {
        const { data: pm } = await supabase
          .from('prospection_massive')
          .select('siren, name, city, departement, phone')
          .in('siren', sirens.slice(0, 500))
        if (pm) pm.forEach(p => { if (!pmMap[p.siren]) pmMap[p.siren] = p })
      }

      // Dédoubler par SIREN (garder le plus récent) et compter les tentatives
      const sirenCounts = {}
      const sirenLatest = {}
      ;(rawCalls || []).forEach(c => {
        const siren = c.clients?.siren
        if (!siren) return
        sirenCounts[siren] = (sirenCounts[siren] || 0) + 1
        if (!sirenLatest[siren] || new Date(c.called_at) > new Date(sirenLatest[siren].called_at)) {
          sirenLatest[siren] = c
        }
      })

      const enriched = Object.entries(sirenLatest).map(([siren, c]) => {
        const cl = c.clients || {}
        const pm = pmMap[siren]
        return {
          ...c,
          _name: cl.name || pm?.name || '-',
          _city: cl.city || pm?.city || '',
          _dept: pm?.departement || '',
          _phone: cl.contact_phone || pm?.phone || '',
          _callCount: sirenCounts[siren] || 1,
        }
      })

      const html = buildNoReplyHTML(enriched)
      if (!html) return res.status(200).json({ message: 'Aucun injoignable, email non envoyé' })

      await sendEmail(supabase, {
        subject: `📵 ${enriched.length} prospect(s) injoignables — Récap`,
        html,
      })

      return res.status(200).json({ success: true, count: enriched.length })

    } else {
      // ─── Résumé demi-journée ───
      const now = new Date()
      let fromTime, periodLabel

      if (period === 'afternoon') {
        // Appels de 12h à maintenant (Paris)
        fromTime = new Date(now)
        fromTime.setUTCHours(11, 0, 0, 0) // ~12h Paris
        periodLabel = 'Après-midi'
      } else {
        // morning: appels de 7h à maintenant (Paris)
        fromTime = new Date(now)
        fromTime.setUTCHours(6, 0, 0, 0) // ~7h Paris
        periodLabel = 'Matin'
      }

      const { data: rawCalls } = await supabase
        .from('prospect_calls')
        .select('*, clients(name, city, siren, postal_code)')
        .gte('called_at', fromTime.toISOString())
        .order('called_at', { ascending: true })

      // Enrichir
      const sirens = [...new Set((rawCalls || []).map(c => c.clients?.siren).filter(Boolean))]
      const pmMap = {}
      if (sirens.length > 0) {
        for (let i = 0; i < sirens.length; i += 200) {
          const batch = sirens.slice(i, i + 200)
          const { data: pm } = await supabase
            .from('prospection_massive')
            .select('siren, name, city, departement')
            .in('siren', batch)
          if (pm) pm.forEach(p => { if (!pmMap[p.siren]) pmMap[p.siren] = p })
        }
      }

      const enriched = (rawCalls || []).map(c => {
        const cl = c.clients || {}
        const pm = cl.siren ? pmMap[cl.siren] : null
        return {
          ...c,
          _name: cl.name || pm?.name || '-',
          _city: cl.city || pm?.city || '',
        }
      })

      const html = buildHalfDayHTML(enriched, periodLabel)
      if (!html) return res.status(200).json({ message: 'Aucun appel avec contact, email non envoyé' })

      const counts = {
        chaud: enriched.filter(c => c.call_result === 'chaud').length,
        tiede: enriched.filter(c => c.call_result === 'tiede').length,
        froid: enriched.filter(c => c.call_result === 'froid').length,
      }
      const subject = `📞 Résumé ${periodLabel.toLowerCase()} — ${counts.chaud}🔥 · ${counts.tiede}🟡 · ${counts.froid}❄️`

      await sendEmail(supabase, { subject, html })

      return res.status(200).json({ success: true, period: periodLabel, total: enriched.length })
    }
  } catch (error) {
    console.error('Erreur résumé phoning:', error)
    return res.status(500).json({ error: error.message })
  }
}

// ═══════════════════════════════════════════════════════════════
// SEND EMAIL
// ═══════════════════════════════════════════════════════════════

async function sendEmail(supabase, { subject, html }) {
  const { data: emailConfig } = await supabase
    .from('user_email_configs')
    .select('*')
    .eq('email', RECIPIENT)
    .eq('is_active', true)
    .maybeSingle()

  if (!emailConfig) {
    const { data: fallback } = await supabase.from('user_email_configs').select('*').eq('is_active', true).limit(1).single()
    if (!fallback) throw new Error('Config email introuvable')
    return sendWithConfig(fallback, subject, html)
  }
  return sendWithConfig(emailConfig, subject, html)
}

async function sendWithConfig(config, subject, html) {
  const smtpPassword = decrypt(config.smtp_password_encrypted)
  const transporter = nodemailer.createTransport({
    host: config.smtp_host, port: config.smtp_port, secure: config.smtp_secure,
    auth: { user: config.email, pass: smtpPassword },
    tls: { rejectUnauthorized: false }, connectionTimeout: 10000, socketTimeout: 30000,
  })

  await transporter.sendMail({
    from: `"Access Campus" <${config.email}>`,
    to: RECIPIENT,
    subject,
    html,
  })
  transporter.close()
}
