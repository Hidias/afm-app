// api/send-phoning-report.js
// Rapport quotidien de phoning — 18h automatique via Vercel Cron
// Destinataire UNIQUE : hicham.saidi@accessformation.pro
//
// Contient :
// - Détail complet de chaque appel (infos entreprise + contact + notes)
// - Analyses croisées : effectif, NAF, département, OPCO, SIREN uniques
// - Cumuls semaine + mois
// - CSV en pièce jointe pour analyse Excel
//
// GET  /api/send-phoning-report  (cron, sécurisé par CRON_SECRET)

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RECIPIENT = 'hicham.saidi@accessformation.pro'

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

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function fmt(seconds) {
  if (!seconds || seconds <= 0) return '-'
  if (seconds < 60) return seconds + 's'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m + 'min' + (s > 0 ? s + 's' : '')
}

function fmtTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const EFFECTIF_LABELS = {
  '00': '0 sal.', '01': '1-2', '02': '3-5', '03': '6-9',
  '11': '10-19', '12': '20-49', '21': '50-99', '22': '100-199',
  '31': '200-249', '32': '250-499', '41': '500-999', '42': '1000+',
  '51': '2000+', '52': '5000+', '53': '10000+',
}

const EFFECTIF_GROUPS = {
  'TPE (0-9)': ['00', '01', '02', '03'],
  'PME (10-49)': ['11', '12'],
  'ETI (50-249)': ['21', '22', '31'],
  'GE (250+)': ['32', '41', '42', '51', '52', '53'],
}

function getEffectifGroup(code) {
  if (!code) return 'Non renseigné'
  const s = String(code)
  for (const [group, codes] of Object.entries(EFFECTIF_GROUPS)) {
    if (codes.includes(s)) return group
  }
  return 'Autre'
}

function getEffectifLabel(code) {
  return code ? (EFFECTIF_LABELS[String(code)] || String(code)) : '-'
}

const RESULT_LABELS = {
  chaud: '🔥 Intéressé', tiede: '🟡 Tiède', froid: '❄️ Refus',
  no_answer: '📵 Pas de réponse', blocked: '⚠️ Barrage/Transfert',
  wrong_number: '❌ N° erroné', inconnu: '? Inconnu'
}

// ═══════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════

function computeStats(calls) {
  const total = calls.length
  if (total === 0) return { total: 0, totalDuration: 0, avgDuration: 0, byResult: {}, byCaller: {}, uniqueSirens: 0 }

  const totalDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
  const withDur = calls.filter(c => c.duration_seconds > 0)
  const avgDuration = withDur.length > 0 ? Math.round(totalDuration / withDur.length) : 0
  const uniqueSirens = new Set(calls.map(c => c._siren).filter(Boolean)).size

  const byResult = {}
  calls.forEach(c => { const r = c.call_result || 'inconnu'; byResult[r] = (byResult[r] || 0) + 1 })

  const byCaller = {}
  calls.forEach(c => {
    const caller = c.called_by || 'inconnu'
    if (!byCaller[caller]) byCaller[caller] = { total: 0, duration: 0, results: {} }
    byCaller[caller].total++
    byCaller[caller].duration += (c.duration_seconds || 0)
    const r = c.call_result || 'inconnu'
    byCaller[caller].results[r] = (byCaller[caller].results[r] || 0) + 1
  })

  return { total, totalDuration, avgDuration, byResult, byCaller, uniqueSirens }
}

// ═══════════════════════════════════════════════════════════════
// ANALYSES CROISÉES
// ═══════════════════════════════════════════════════════════════

function analyzeBy(calls, keyFn) {
  const groups = {}
  calls.forEach(c => {
    const key = keyFn(c) || 'Non renseigné'
    if (!groups[key]) groups[key] = { total: 0, chaud: 0, tiede: 0, froid: 0, no_answer: 0, duration: 0 }
    groups[key].total++
    groups[key].duration += (c.duration_seconds || 0)
    if (c.call_result === 'chaud') groups[key].chaud++
    if (c.call_result === 'tiede') groups[key].tiede++
    if (c.call_result === 'froid') groups[key].froid++
    if (c.call_result === 'no_answer') groups[key].no_answer++
  })
  return Object.entries(groups)
    .map(([key, data]) => ({
      label: key, ...data,
      conversionRate: data.total > 0 ? Math.round((data.chaud + data.tiede) / data.total * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

function analysisTableHTML(title, emoji, rows, totalCalls) {
  if (rows.length === 0) return ''
  let body = ''
  rows.slice(0, 15).forEach((r, i) => {
    const bg = i % 2 === 0 ? '#f9fafb' : '#fff'
    const barW = totalCalls > 0 ? Math.round(r.total / totalCalls * 100) : 0
    body += `<tr style="background:${bg}">
      <td style="padding:5px 10px;font-size:12px;font-weight:500">${r.label}</td>
      <td style="padding:5px 10px;font-size:12px;text-align:center">${r.total}</td>
      <td style="padding:5px 10px;font-size:12px;text-align:center;color:#059669;font-weight:600">${r.chaud}</td>
      <td style="padding:5px 10px;font-size:12px;text-align:center;color:#d97706">${r.tiede}</td>
      <td style="padding:5px 10px;font-size:12px;text-align:center;color:#3b82f6">${r.froid}</td>
      <td style="padding:5px 10px;font-size:12px;text-align:center;color:#6b7280">${r.no_answer}</td>
      <td style="padding:5px 10px;font-size:12px;text-align:center;font-weight:600;color:${r.conversionRate >= 30 ? '#059669' : r.conversionRate >= 15 ? '#d97706' : '#6b7280'}">${r.conversionRate}%</td>
      <td style="padding:5px 10px;font-size:12px"><div style="background:#e5e7eb;border-radius:4px;height:12px;width:100px"><div style="background:#3b82f6;border-radius:4px;height:12px;width:${barW}px"></div></div></td>
    </tr>`
  })
  return `<div style="padding:10px 30px">
    <h2 style="font-size:15px;margin:0 0 8px;color:#1e40af">${emoji} ${title}</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:5px 10px;text-align:left;font-size:11px">${title}</th>
        <th style="padding:5px 10px;text-align:center;font-size:11px">Total</th>
        <th style="padding:5px 10px;text-align:center;font-size:11px">🔥</th>
        <th style="padding:5px 10px;text-align:center;font-size:11px">🟡</th>
        <th style="padding:5px 10px;text-align:center;font-size:11px">❄️</th>
        <th style="padding:5px 10px;text-align:center;font-size:11px">📵</th>
        <th style="padding:5px 10px;text-align:center;font-size:11px">Conv.%</th>
        <th style="padding:5px 10px;text-align:left;font-size:11px">Volume</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`
}

// ═══════════════════════════════════════════════════════════════
// CSV
// ═══════════════════════════════════════════════════════════════

function generateCSV(calls) {
  const headers = [
    'Date', 'Heure', 'Appelant', 'Résultat', 'Durée (s)', 'Durée',
    'Prospect', 'SIREN', 'SIRET', 'Ville', 'CP', 'Département',
    'NAF', 'Effectif code', 'Effectif', 'Groupe effectif', 'Forme juridique', 'OPCO',
    'Contact nom', 'Contact fonction', 'Contact email', 'Contact mobile',
    'Formations', 'Notes', 'RDV créé', 'Rappel programmé',
  ]
  const esc = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v).replace(/"/g, '""')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
  }
  const rows = [...calls].sort((a, b) => new Date(a.called_at) - new Date(b.called_at)).map(c => [
    c.called_at ? new Date(c.called_at).toLocaleDateString('fr-FR') : '',
    fmtTime(c.called_at),
    c.called_by || '',
    c.call_result || '',
    c.duration_seconds || '',
    fmt(c.duration_seconds),
    c._prospectName || '',
    c._siren || '',
    c._siret || '',
    c._city || '',
    c._postalCode || '',
    c._departement || '',
    c._naf || '',
    c._effectif || '',
    c._effectifLabel || '',
    getEffectifGroup(c._effectif),
    c._formeJuridique || '',
    c._opco || '',
    c.contact_name || '',
    c.contact_function || '',
    c.contact_email || '',
    c.contact_mobile || '',
    (c.formations_mentioned || []).join('; '),
    (c.notes || '').replace(/\n/g, ' '),
    c.rdv_created ? 'Oui' : 'Non',
    c.needs_callback ? 'Oui' : 'Non',
  ])
  return '\uFEFF' + headers.join(',') + '\n' + rows.map(r => r.map(esc).join(',')).join('\n')
}

// ═══════════════════════════════════════════════════════════════
// HTML
// ═══════════════════════════════════════════════════════════════

function buildHTML(todayCalls, weekCalls, monthCalls, todayStats, weekStats, monthStats) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Détail appels
  let detailRows = ''
  const sorted = [...todayCalls].sort((a, b) => new Date(a.called_at) - new Date(b.called_at))
  sorted.forEach((c, i) => {
    const bg = i % 2 === 0 ? '#f9fafb' : '#fff'
    const rl = RESULT_LABELS[c.call_result] || c.call_result
    const contact = [c.contact_name, c.contact_function].filter(Boolean).join(' — ')
    const formations = (c.formations_mentioned || []).join(', ')
    const notes = (c.notes || '').replace(/\n/g, '<br>')
    detailRows += `<tr style="background:${bg}">
      <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;white-space:nowrap">${fmtTime(c.called_at)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;font-weight:600">${c._prospectName || '-'}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${c._city || ''} ${c._departement ? '(' + c._departement + ')' : ''}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${c._naf || '-'}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${c._effectifLabel || '-'}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${c._opco || '-'}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${c.called_by || '-'}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${rl}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;text-align:center">${fmt(c.duration_seconds)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${contact}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:10px;color:#6b7280;max-width:250px">${formations ? '🎓 ' + formations + '<br>' : ''}${notes}</td>
    </tr>`
  })

  // Caller stats helper
  function callerHTML(stats) {
    let h = ''
    for (const [name, d] of Object.entries(stats.byCaller)) {
      const avg = d.total > 0 ? Math.round(d.duration / d.total) : 0
      const det = Object.entries(d.results).map(([r, n]) => `${RESULT_LABELS[r] || r}: ${n}`).join(' · ')
      h += `<tr><td style="padding:4px 10px;font-size:13px;font-weight:600">${name}</td><td style="padding:4px 10px;text-align:center;font-size:13px">${d.total}</td><td style="padding:4px 10px;text-align:center;font-size:13px">${fmt(d.duration)}</td><td style="padding:4px 10px;text-align:center;font-size:13px">${fmt(avg)}</td><td style="padding:4px 10px;font-size:12px;color:#6b7280">${det}</td></tr>`
    }
    return h
  }

  function resultBadges(stats) {
    return Object.entries(stats.byResult).sort((a, b) => b[1] - a[1]).map(([r, n]) =>
      `<span style="display:inline-block;margin:2px 6px 2px 0;padding:3px 10px;background:#f3f4f6;border-radius:12px;font-size:12px">${RESULT_LABELS[r] || r} <b>${n}</b></span>`
    ).join('')
  }

  // Top 5 longues
  const topLong = [...todayCalls].filter(c => c.duration_seconds > 0).sort((a, b) => b.duration_seconds - a.duration_seconds).slice(0, 5)
  const topHTML = topLong.map(c =>
    `<tr><td style="padding:3px 10px;font-size:12px">${c._prospectName || '-'}</td><td style="padding:3px 10px;font-size:12px">${c._city || ''}</td><td style="padding:3px 10px;font-size:12px">${c._effectifLabel || '-'}</td><td style="padding:3px 10px;font-size:12px;text-align:center">${fmt(c.duration_seconds)}</td><td style="padding:3px 10px;font-size:12px">${RESULT_LABELS[c.call_result] || c.call_result}</td><td style="padding:3px 10px;font-size:12px">${c.called_by}</td></tr>`
  ).join('')
  const quickCount = todayCalls.filter(c => c.duration_seconds > 0 && c.duration_seconds < 10).length

  // Analyses croisées — mois
  const aEffectif = analyzeBy(monthCalls, c => getEffectifGroup(c._effectif))
  const aNAF = analyzeBy(monthCalls, c => c._naf || null)
  const aDept = analyzeBy(monthCalls, c => c._departement || null)
  const aOPCO = analyzeBy(monthCalls, c => c._opco || null)

  // Callers table helper
  const callerTable = (stats) => `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
    <thead><tr style="background:#e5e7eb"><th style="padding:4px 10px;text-align:left;font-size:11px">Appelant</th><th style="padding:4px 10px;text-align:center;font-size:11px">Appels</th><th style="padding:4px 10px;text-align:center;font-size:11px">Temps</th><th style="padding:4px 10px;text-align:center;font-size:11px">Moy</th><th style="padding:4px 10px;text-align:left;font-size:11px">Détail</th></tr></thead>
    <tbody>${callerHTML(stats)}</tbody></table>`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;max-width:1000px;margin:0 auto;padding:20px">

<div style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;padding:24px 30px;border-radius:12px 12px 0 0">
  <h1 style="margin:0;font-size:22px">📊 Rapport Phoning — ${dateStr}</h1>
  <p style="margin:8px 0 0;opacity:0.85;font-size:14px">Access Formation · Confidentiel · CSV joint pour Excel</p>
</div>

<div style="background:#f0f9ff;padding:20px 30px;border:1px solid #dbeafe">
  <table style="width:100%"><tr>
    <td style="text-align:center;padding:8px"><div style="font-size:28px;font-weight:800;color:#1e40af">${todayStats.total}</div><div style="font-size:11px;color:#6b7280">APPELS</div></td>
    <td style="text-align:center;padding:8px"><div style="font-size:28px;font-weight:800;color:#059669">${fmt(todayStats.totalDuration)}</div><div style="font-size:11px;color:#6b7280">TEMPS TOTAL</div></td>
    <td style="text-align:center;padding:8px"><div style="font-size:28px;font-weight:800;color:#7c3aed">${fmt(todayStats.avgDuration)}</div><div style="font-size:11px;color:#6b7280">MOY / FICHE</div></td>
    <td style="text-align:center;padding:8px"><div style="font-size:28px;font-weight:800;color:#dc2626">${todayStats.byResult?.chaud || 0}</div><div style="font-size:11px;color:#6b7280">🔥 CHAUDS</div></td>
    <td style="text-align:center;padding:8px"><div style="font-size:28px;font-weight:800;color:#0891b2">${todayStats.uniqueSirens}</div><div style="font-size:11px;color:#6b7280">ENTREPRISES</div></td>
  </tr></table>
</div>

<div style="padding:16px 30px">${resultBadges(todayStats)}</div>

<div style="padding:10px 30px">
  <h2 style="font-size:15px;margin:0 0 8px;color:#1e40af">👥 Par appelant — Aujourd'hui</h2>
  ${callerTable(todayStats)}
</div>

${topLong.length > 0 ? `<div style="padding:10px 30px">
  <h2 style="font-size:15px;margin:0 0 8px;color:#1e40af">🕐 Top 5 fiches les plus longues</h2>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
    <thead><tr style="background:#f3f4f6"><th style="padding:4px 10px;text-align:left;font-size:11px">Prospect</th><th style="padding:4px 10px;text-align:left;font-size:11px">Ville</th><th style="padding:4px 10px;text-align:left;font-size:11px">Effectif</th><th style="padding:4px 10px;text-align:center;font-size:11px">Durée</th><th style="padding:4px 10px;text-align:left;font-size:11px">Résultat</th><th style="padding:4px 10px;text-align:left;font-size:11px">Par</th></tr></thead>
    <tbody>${topHTML}</tbody></table>
  ${quickCount > 0 ? `<p style="font-size:12px;color:#9ca3af;margin:6px 0 0">⚡ ${quickCount} appel(s) < 10s</p>` : ''}
</div>` : ''}

<div style="padding:10px 30px">
  <h2 style="font-size:15px;margin:0 0 8px;color:#1e40af">📋 Détail complet — ${todayStats.total} appels</h2>
  <div style="overflow-x:auto">
  <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;min-width:950px">
    <thead><tr style="background:#1e40af;color:white">
      <th style="padding:5px 8px;text-align:left;font-size:10px">Heure</th><th style="padding:5px 8px;text-align:left;font-size:10px">Prospect</th><th style="padding:5px 8px;text-align:left;font-size:10px">Ville</th><th style="padding:5px 8px;text-align:left;font-size:10px">NAF</th><th style="padding:5px 8px;text-align:left;font-size:10px">Effectif</th><th style="padding:5px 8px;text-align:left;font-size:10px">OPCO</th><th style="padding:5px 8px;text-align:left;font-size:10px">Par</th><th style="padding:5px 8px;text-align:left;font-size:10px">Résultat</th><th style="padding:5px 8px;text-align:center;font-size:10px">Durée</th><th style="padding:5px 8px;text-align:left;font-size:10px">Contact</th><th style="padding:5px 8px;text-align:left;font-size:10px">Notes</th>
    </tr></thead>
    <tbody>${detailRows || '<tr><td colspan="11" style="padding:20px;text-align:center;color:#9ca3af">Aucun appel</td></tr>'}</tbody>
  </table></div>
</div>

<div style="padding:20px 30px;background:#fefce8;border-top:3px solid #eab308">
  <h2 style="font-size:17px;margin:0 0 4px;color:#854d0e">📈 Analyses croisées — Ce mois (${monthStats.total} appels · ${monthStats.uniqueSirens} entreprises uniques)</h2>
  <p style="font-size:12px;color:#a16207;margin:0 0 12px">Taux conversion = (🔥 Intéressé + 🟡 Tiède) / Total appels</p>
</div>

${analysisTableHTML('Par effectif', '👥', aEffectif, monthStats.total)}
${analysisTableHTML('Par code NAF', '🏭', aNAF, monthStats.total)}
${analysisTableHTML('Par département', '📍', aDept, monthStats.total)}
${analysisTableHTML('Par OPCO', '💼', aOPCO, monthStats.total)}

<div style="padding:20px 30px;background:#f9fafb;border-top:2px solid #e5e7eb">
  <h2 style="font-size:16px;margin:0 0 12px;color:#374151">📊 Cumuls</h2>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#e5e7eb">
      <th style="padding:6px 10px;text-align:left;font-size:12px">Période</th><th style="padding:6px 10px;text-align:center;font-size:12px">Appels</th><th style="padding:6px 10px;text-align:center;font-size:12px">Entreprises</th><th style="padding:6px 10px;text-align:center;font-size:12px">Temps</th><th style="padding:6px 10px;text-align:center;font-size:12px">Moy</th><th style="padding:6px 10px;text-align:center;font-size:12px">🔥</th><th style="padding:6px 10px;text-align:center;font-size:12px">🟡</th><th style="padding:6px 10px;text-align:center;font-size:12px">❄️</th><th style="padding:6px 10px;text-align:center;font-size:12px">📵</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:6px 10px;font-weight:600;font-size:13px">📅 Semaine</td><td style="text-align:center">${weekStats.total}</td><td style="text-align:center">${weekStats.uniqueSirens}</td><td style="text-align:center">${fmt(weekStats.totalDuration)}</td><td style="text-align:center">${fmt(weekStats.avgDuration)}</td><td style="text-align:center;color:#059669;font-weight:600">${weekStats.byResult?.chaud || 0}</td><td style="text-align:center">${weekStats.byResult?.tiede || 0}</td><td style="text-align:center">${weekStats.byResult?.froid || 0}</td><td style="text-align:center">${weekStats.byResult?.no_answer || 0}</td></tr>
      <tr style="background:#f3f4f6"><td style="padding:6px 10px;font-weight:600;font-size:13px">📆 Mois</td><td style="text-align:center">${monthStats.total}</td><td style="text-align:center">${monthStats.uniqueSirens}</td><td style="text-align:center">${fmt(monthStats.totalDuration)}</td><td style="text-align:center">${fmt(monthStats.avgDuration)}</td><td style="text-align:center;color:#059669;font-weight:600">${monthStats.byResult?.chaud || 0}</td><td style="text-align:center">${monthStats.byResult?.tiede || 0}</td><td style="text-align:center">${monthStats.byResult?.froid || 0}</td><td style="text-align:center">${monthStats.byResult?.no_answer || 0}</td></tr>
    </tbody>
  </table>
  <h3 style="font-size:14px;margin:16px 0 6px;color:#374151">Semaine — par appelant</h3>
  ${callerTable(weekStats)}
  <h3 style="font-size:14px;margin:16px 0 6px;color:#374151">Mois — par appelant</h3>
  ${callerTable(monthStats)}
</div>

<div style="padding:16px 30px;border-top:1px solid #e5e7eb;text-align:center">
  <p style="font-size:11px;color:#9ca3af;margin:0">Access Campus · ${now.toLocaleString('fr-FR')} · CSV en PJ</p>
</div></body></html>`
}

// ═══════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Non autorisé' })
    }
  }

  try {
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); weekStart.setHours(0, 0, 0, 0)
    if (weekStart > now) weekStart.setDate(weekStart.getDate() - 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 1. Appels du mois avec client
    const { data: rawCalls, error: callErr } = await supabase
      .from('prospect_calls')
      .select('*, clients(name, city, phone, siren, postal_code, siret, taille_entreprise)')
      .gte('called_at', monthStart.toISOString())
      .order('called_at', { ascending: false })
    if (callErr) throw callErr

    // 2. Données entreprise depuis prospection_massive
    const sirens = [...new Set((rawCalls || []).map(c => c.clients?.siren).filter(Boolean))]
    const prospectMap = {}
    for (let i = 0; i < sirens.length; i += 200) {
      const batch = sirens.slice(i, i + 200)
      const { data: pm } = await supabase
        .from('prospection_massive')
        .select('siren, naf, effectif, forme_juridique, departement, city, postal_code, siret, opco_name, name')
        .in('siren', batch)
      if (pm) pm.forEach(p => { if (!prospectMap[p.siren]) prospectMap[p.siren] = p })
    }

    // 3. Enrichir
    const enriched = (rawCalls || []).map(c => {
      const cl = c.clients || {}
      const pm = cl.siren ? prospectMap[cl.siren] : null
      return {
        ...c,
        _prospectName: cl.name || pm?.name || '-',
        _siren: cl.siren || '',
        _siret: cl.siret || pm?.siret || '',
        _city: cl.city || pm?.city || '',
        _postalCode: cl.postal_code || pm?.postal_code || '',
        _departement: pm?.departement || (cl.postal_code ? cl.postal_code.substring(0, 2) : ''),
        _naf: pm?.naf || '',
        _effectif: pm?.effectif || cl.taille_entreprise || '',
        _effectifLabel: getEffectifLabel(pm?.effectif || cl.taille_entreprise),
        _formeJuridique: pm?.forme_juridique || '',
        _opco: pm?.opco_name || '',
      }
    })

    const todayCalls = enriched.filter(c => new Date(c.called_at) >= todayStart)
    const weekCalls = enriched.filter(c => new Date(c.called_at) >= weekStart)
    const todayStats = computeStats(todayCalls)
    const weekStats = computeStats(weekCalls)
    const monthStats = computeStats(enriched)

    if (todayCalls.length === 0 && req.method === 'GET') {
      return res.status(200).json({ message: 'Aucun appel, rapport non envoyé' })
    }

    // 4. HTML + CSV
    const html = buildHTML(todayCalls, weekCalls, enriched, todayStats, weekStats, monthStats)
    const csv = generateCSV(enriched)

    // 5. SMTP
    const { data: userData } = await supabase.from('profiles').select('id').eq('email', RECIPIENT).maybeSingle()
    let emailConfig = null
    if (userData) {
      const { data: cfg } = await supabase.from('user_email_configs').select('*').eq('user_id', userData.id).eq('is_active', true).maybeSingle()
      emailConfig = cfg
    }
    if (!emailConfig) {
      const { data: cfg } = await supabase.from('user_email_configs').select('*').eq('is_active', true).limit(1).single()
      emailConfig = cfg
    }
    if (!emailConfig) return res.status(500).json({ error: 'Config email introuvable' })

    const smtpPassword = decrypt(emailConfig.smtp_password_encrypted)
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtp_host, port: emailConfig.smtp_port, secure: emailConfig.smtp_secure,
      auth: { user: emailConfig.email, pass: smtpPassword },
      tls: { rejectUnauthorized: false }, connectionTimeout: 10000, socketTimeout: 30000,
    })

    await transporter.sendMail({
      from: `"Access Campus" <${emailConfig.email}>`,
      to: RECIPIENT,
      subject: `📊 Phoning ${now.toLocaleDateString('fr-FR')} — ${todayStats.total} appels · ${todayStats.byResult?.chaud || 0}🔥 · ${todayStats.uniqueSirens} entrep. · ${fmt(todayStats.totalDuration)}`,
      html,
      attachments: [{
        filename: `phoning_${now.toISOString().split('T')[0]}.csv`,
        content: Buffer.from(csv, 'utf-8'),
        contentType: 'text/csv',
      }],
    })
    transporter.close()

    return res.status(200).json({ success: true, message: `Rapport envoyé à ${RECIPIENT}`, stats: { today: todayStats.total, week: weekStats.total, month: monthStats.total } })
  } catch (error) {
    console.error('Erreur rapport phoning:', error)
    return res.status(500).json({ error: error.message })
  }
}
