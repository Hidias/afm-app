// api/send-callback-reminder.js
// Envoie un email de rappel phoning avec fichier .ics OU une alerte prospect chaud

import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

function generateICS({ prospectName, prospectPhone, contactName, callbackDate, callbackTime, callbackReason, callerName, notes }) {
  const [year, month, day] = callbackDate.split('-')
  const [hour, minute] = callbackTime.split(':')
  const dtStart = `${year}${month}${day}T${hour}${minute}00`
  
  const endMinute = parseInt(minute) + 15
  const endHour = parseInt(hour) + Math.floor(endMinute / 60)
  const dtEnd = `${year}${month}${day}T${String(endHour).padStart(2, '0')}${String(endMinute % 60).padStart(2, '0')}00`
  
  const uid = `rappel-${Date.now()}@accessformation.pro`
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const description = [
    `Rappel phoning : ${prospectName}`,
    contactName ? `Contact : ${contactName}` : '',
    `Tel : ${prospectPhone}`,
    callbackReason ? `Raison : ${callbackReason}` : '',
    notes ? `Notes : ${notes}` : '',
    `Appel initial par : ${callerName}`,
  ].filter(Boolean).join('\\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Access Formation//Phoning//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/Paris:${dtStart}`,
    `DTEND;TZID=Europe/Paris:${dtEnd}`,
    `SUMMARY:📞 Rappel ${prospectName}`,
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Rappel : appeler ${prospectName}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')
}

function buildCallbackEmail({ prospectName, prospectPhone, contactName, contactFunction, callbackDate, callbackTime, callbackReason, callerName, notes }) {
  const dateFormatted = new Date(callbackDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const subject = `📞 Rappel : appeler ${prospectName} le ${dateFormatted} à ${callbackTime}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #e67e22;">📞 Rappel phoning programmé</h2>
      <table style="border-collapse: collapse; width: 100%; margin: 15px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 140px;">Entreprise</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${prospectName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Téléphone</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="tel:${prospectPhone}">${prospectPhone}</a></td></tr>
        ${contactName ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Contact</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contactName}${contactFunction ? ' — ' + contactFunction : ''}</td></tr>` : ''}
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Date rappel</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${dateFormatted} à ${callbackTime}</td></tr>
        ${callbackReason ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Raison</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${callbackReason}</td></tr>` : ''}
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Appelé par</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${callerName}</td></tr>
      </table>
      ${notes ? `<p style="background: #f9f9f9; padding: 12px; border-radius: 6px; color: #555;"><strong>Notes :</strong> ${notes}</p>` : ''}
      <p style="color: #888; font-size: 12px;">📎 Fichier .ics joint — ouvrez-le pour ajouter le rappel à votre agenda.</p>
    </div>
  `

  const icsContent = generateICS({ prospectName, prospectPhone, contactName, callbackDate, callbackTime, callbackReason, callerName, notes })

  const attachments = [{
    filename: `rappel-${prospectName.replace(/[^a-zA-Z0-9]/g, '_')}.ics`,
    content: icsContent,
    contentType: 'text/calendar; method=REQUEST'
  }]

  return { subject, html, attachments }
}

function buildHotProspectEmail({ prospectName, prospectPhone, contactName, contactFunction, callbackReason, callerName, notes }) {
  const now = new Date().toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

  const subject = `🔥 PROSPECT CHAUD — ${prospectName}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <div style="background: linear-gradient(135deg, #ff6b35, #f7c948); padding: 20px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0;">🔥 Prospect chaud à rappeler !</h2>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">${callerName} a identifié un prospect intéressé</p>
      </div>
      <div style="border: 1px solid #eee; border-top: none; border-radius: 0 0 12px 12px; padding: 20px;">
        <table style="border-collapse: collapse; width: 100%; margin: 0 0 15px 0;">
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 140px;">🏢 Entreprise</td><td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 16px; font-weight: bold;">${prospectName}</td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">📞 Téléphone</td><td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="tel:${prospectPhone}" style="color: #2563eb; font-size: 16px; font-weight: bold; text-decoration: none;">${prospectPhone}</a></td></tr>
          ${contactName ? `<tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">👤 Contact</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${contactName}${contactFunction ? ' — ' + contactFunction : ''}</td></tr>` : ''}
          ${callbackReason ? `<tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">📋 Disponibilités</td><td style="padding: 10px; border-bottom: 1px solid #eee; color: #c2410c; font-weight: 500;">${callbackReason}</td></tr>` : ''}
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">📅 Signalé le</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${now}</td></tr>
          <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">📞 Appelé par</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${callerName}</td></tr>
        </table>
        ${notes ? `<div style="background: #fef3c7; padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 15px;"><strong>📝 Notes :</strong><br/>${notes.replace(/\n/g, '<br/>')}</div>` : ''}
        <div style="background: #fee2e2; padding: 12px; border-radius: 8px; text-align: center;">
          <strong style="color: #dc2626;">⏰ Rappeler rapidement ce prospect !</strong>
        </div>
      </div>
    </div>
  `

  return { subject, html, attachments: [] }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let transporter = null

  try {
    const { prospectName, prospectPhone, contactName, contactFunction, callbackDate, callbackTime, callbackReason, callerName, notes } = req.body

    if (!prospectName) {
      return res.status(400).json({ error: 'Paramètres manquants: prospectName requis' })
    }

    // Déterminer le type d'email : rappel classique (avec date+heure) ou prospect chaud
    const isCallback = callbackDate && callbackTime
    const emailData = isCallback
      ? buildCallbackEmail({ prospectName, prospectPhone, contactName, contactFunction, callbackDate, callbackTime, callbackReason, callerName, notes })
      : buildHotProspectEmail({ prospectName, prospectPhone, contactName, contactFunction, callbackReason, callerName, notes })

    // Récupérer la config SMTP
    const { data: emailConfig, error: configError } = await supabase
      .from('user_email_configs')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (configError || !emailConfig) {
      return res.status(400).json({ error: 'Configuration email non trouvée' })
    }

    const smtpPassword = decrypt(emailConfig.smtp_password_encrypted)

    transporter = nodemailer.createTransport({
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

    await transporter.verify()

    await transporter.sendMail({
      from: `"Access Formation" <${emailConfig.email}>`,
      to: 'contact@accessformation.pro',
      subject: emailData.subject,
      html: emailData.html,
      attachments: emailData.attachments,
    })

    if (transporter) transporter.close()

    return res.status(200).json({ success: true, type: isCallback ? 'callback' : 'hot_prospect' })

  } catch (error) {
    console.error('Erreur envoi email:', error)
    if (transporter) try { transporter.close() } catch (e) {}
    return res.status(500).json({ error: error.message })
  }
}
