/**
 * ============================================================================
 * API ENDPOINT - RAPPORT HEBDOMADAIRE PHONING
 * ============================================================================
 * 
 * Envoie un rapport hebdo des appels à hicham.saidi@accessformation.pro
 * Cron chaque lundi à 8h
 * 
 * GET /api/report-phoning-hebdo  (pour le cron)
 * POST /api/report-phoning-hebdo (pour test manuel)
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const REPORT_EMAIL = 'hicham.saidi@accessformation.pro'

function decrypt(encryptedText) {
  const algorithm = 'aes-256-cbc'
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  const [ivHex, encrypted] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0s'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}s`
  return `${mins}min ${secs.toString().padStart(2, '0')}s`
}

function formatDurationHours(seconds) {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${mins} min`
  return `${hours}h ${mins.toString().padStart(2, '0')}min`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ================================================================
    // 1. Calculer la période (semaine précédente : lundi à dimanche)
    // ================================================================
    const now = new Date()
    const lastMonday = new Date(now)
    lastMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7)
    lastMonday.setHours(0, 0, 0, 0)

    const lastSunday = new Date(lastMonday)
    lastSunday.setDate(lastMonday.getDate() + 6)
    lastSunday.setHours(23, 59, 59, 999)

    const dateDebut = lastMonday.toISOString()
    const dateFin = lastSunday.toISOString()

    const formatDateFr = (d) => new Date(d).toLocaleDateString('fr-FR', { 
      weekday: 'long', day: 'numeric', month: 'long' 
    })

    // ================================================================
    // 2. Récupérer tous les appels de la semaine
    // ================================================================
    const { data: calls, error: callsError } = await supabase
      .from('prospect_calls')
      .select('*, clients(name, city)')
      .gte('created_at', dateDebut)
      .lte('created_at', dateFin)
      .order('created_at', { ascending: true })

    if (callsError) throw callsError

    if (!calls || calls.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Aucun appel cette semaine, pas de rapport envoyé'
      })
    }

    // ================================================================
    // 3. Calculer les statistiques
    // ================================================================

    // -- Par appelant --
    const byCaller = {}
    for (const call of calls) {
      const caller = call.called_by || 'Inconnu'
      if (!byCaller[caller]) {
        byCaller[caller] = { calls: 0, totalDuration: 0, results: {} }
      }
      byCaller[caller].calls++
      byCaller[caller].totalDuration += call.duration_seconds || 0
      const result = call.call_result || 'autre'
      byCaller[caller].results[result] = (byCaller[caller].results[result] || 0) + 1
    }

    // -- Par jour --
    const byDay = {}
    for (const call of calls) {
      const day = new Date(call.created_at).toLocaleDateString('fr-FR', { 
        weekday: 'long', day: 'numeric', month: 'long' 
      })
      if (!byDay[day]) {
        byDay[day] = { calls: 0, totalDuration: 0 }
      }
      byDay[day].calls++
      byDay[day].totalDuration += call.duration_seconds || 0
    }

    // -- Par résultat --
    const byResult = {}
    const resultLabels = {
      chaud: '🔥 Chaud',
      tiede: '🟡 Tiède',
      froid: '❄️ Froid',
      no_answer: '📞 Pas de réponse',
      blocked: '⚠️ Barrage',
      wrong_number: '❌ Numéro erroné'
    }
    for (const call of calls) {
      const result = call.call_result || 'autre'
      byResult[result] = (byResult[result] || 0) + 1
    }

    // -- RDV créés --
    const rdvCreated = calls.filter(c => c.rdv_created).length

    // -- Totaux --
    const totalCalls = calls.length
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0

    // ================================================================
    // 4. Construire le HTML du rapport
    // ================================================================

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a5f, #2563eb); color: white; padding: 30px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; }
    .header p { margin: 0; opacity: 0.9; font-size: 14px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px; }
    .card h2 { margin: 0 0 16px 0; font-size: 18px; color: #1e3a5f; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-box { background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; color: #1e3a5f; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    tr:hover td { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .badge-chaud { background: #dcfce7; color: #166534; }
    .badge-tiede { background: #fef3c7; color: #92400e; }
    .badge-froid { background: #dbeafe; color: #1e40af; }
    .badge-no_answer { background: #f3f4f6; color: #374151; }
    .badge-blocked { background: #fee2e2; color: #991b1b; }
    .badge-wrong_number { background: #fae8ff; color: #7e22ce; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    .caller-section { background: #eff6ff; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; }
    .caller-name { font-weight: 600; color: #1e3a5f; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Rapport Phoning Hebdomadaire</h1>
    <p>Semaine du ${formatDateFr(dateDebut)} au ${formatDateFr(dateFin)}</p>
  </div>

  <div class="stats-grid">
    <div class="stat-box">
      <div class="stat-value">${totalCalls}</div>
      <div class="stat-label">Appels</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${formatDurationHours(totalDuration)}</div>
      <div class="stat-label">Temps total</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${formatDuration(avgDuration)}</div>
      <div class="stat-label">Durée moyenne</div>
    </div>
    <div class="stat-box">
      <div class="stat-value">${rdvCreated}</div>
      <div class="stat-label">RDV créés</div>
    </div>
  </div>

  <!-- Par appelant -->
  <div class="card">
    <h2>👥 Par appelant</h2>
    ${Object.entries(byCaller).map(([caller, data]) => `
      <div class="caller-section">
        <span class="caller-name">${caller}</span> — 
        ${data.calls} appels, ${formatDurationHours(data.totalDuration)} au total
        <div style="margin-top:4px;font-size:13px;color:#475569;">
          ${Object.entries(data.results).map(([r, count]) => 
            `${resultLabels[r] || r}: ${count}`
          ).join(' • ')}
        </div>
      </div>
    `).join('')}
  </div>

  <!-- Résultats -->
  <div class="card">
    <h2>🎯 Résultats des appels</h2>
    <table>
      <tr>
        ${Object.entries(byResult).map(([result, count]) => `
          <td style="text-align:center;">
            <div style="font-size:24px;font-weight:700;">${count}</div>
            <div class="badge badge-${result}">${resultLabels[result] || result}</div>
          </td>
        `).join('')}
      </tr>
    </table>
  </div>

  <!-- Par jour -->
  <div class="card">
    <h2>📅 Temps passé par jour</h2>
    <table>
      <thead>
        <tr><th>Jour</th><th>Appels</th><th>Temps total</th><th>Moyenne</th></tr>
      </thead>
      <tbody>
        ${Object.entries(byDay).map(([day, data]) => `
          <tr>
            <td>${day}</td>
            <td>${data.calls}</td>
            <td>${formatDurationHours(data.totalDuration)}</td>
            <td>${formatDuration(data.calls > 0 ? Math.round(data.totalDuration / data.calls) : 0)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- Détail des appels -->
  <div class="card">
    <h2>📋 Détail des appels</h2>
    <table>
      <thead>
        <tr><th>Date/Heure</th><th>Appelant</th><th>Entreprise</th><th>Durée</th><th>Résultat</th></tr>
      </thead>
      <tbody>
        ${calls.map(call => `
          <tr>
            <td>${new Date(call.created_at).toLocaleString('fr-FR', { 
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
            })}</td>
            <td>${call.called_by || '-'}</td>
            <td>
              ${call.clients?.name || 'N/A'}
              ${call.clients?.city ? `<br><span style="font-size:12px;color:#6b7280;">${call.clients.city}</span>` : ''}
            </td>
            <td>${formatDuration(call.duration_seconds || 0)}</td>
            <td><span class="badge badge-${call.call_result}">${resultLabels[call.call_result] || call.call_result}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Access Formation — Rapport généré automatiquement le ${new Date().toLocaleString('fr-FR')}
  </div>
</body>
</html>`

    // ================================================================
    // 5. Envoyer l'email
    // ================================================================

    // Récupérer la config SMTP de Hicham
    const { data: users } = await supabase.auth.admin.listUsers()
    const hichamUser = users?.users?.find(u => u.email === REPORT_EMAIL)

    if (!hichamUser) {
      return res.status(400).json({ error: 'Utilisateur Hicham non trouvé' })
    }

    const { data: emailConfig, error: configError } = await supabase
      .from('user_email_configs')
      .select('*')
      .eq('user_id', hichamUser.id)
      .eq('is_active', true)
      .single()

    if (configError || !emailConfig) {
      return res.status(400).json({ error: 'Config email non trouvée' })
    }

    const smtpPassword = decrypt(emailConfig.smtp_password_encrypted)

    const transporter = nodemailer.createTransport({
      host: emailConfig.smtp_host,
      port: emailConfig.smtp_port,
      secure: emailConfig.smtp_secure,
      auth: {
        user: emailConfig.email,
        pass: smtpPassword
      },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
    })

    await transporter.sendMail({
      from: `"Access Campus" <${emailConfig.email}>`,
      to: REPORT_EMAIL,
      subject: `📊 Rapport Phoning — Semaine du ${lastMonday.toLocaleDateString('fr-FR')} — ${totalCalls} appels, ${rdvCreated} RDV`,
      html: html,
    })

    return res.status(200).json({
      success: true,
      message: `Rapport envoyé à ${REPORT_EMAIL}`,
      stats: {
        period: `${formatDateFr(dateDebut)} - ${formatDateFr(dateFin)}`,
        totalCalls,
        totalDuration: formatDurationHours(totalDuration),
        rdvCreated,
        callers: Object.keys(byCaller),
      }
    })

  } catch (error) {
    console.error('Erreur rapport phoning:', error)
    return res.status(500).json({ error: error.message })
  }
}
