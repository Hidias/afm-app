// api/send-callback-reminder.js
// Envoie un email interne de notification phoning
// Utilisé pour : alertes prospect chaud, rappels programmés, transferts "passer la main"
// Destinataire par défaut : hicham.saidi@accessformation.pro

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

async function findSmtpConfig(senderEmail) {
  const { data: configs } = await supabase
    .from('user_email_configs')
    .select('*')
    .eq('is_active', true)

  if (!configs || configs.length === 0) return null
  let config = configs.find(c => c.email === senderEmail)
  if (config) return config
  config = configs.find(c => c.email === 'entreprise@accessformation.pro')
  if (config) return config
  config = configs.find(c => c.email === 'contact@accessformation.pro')
  if (config) return config
  return configs[0]
}

function buildNotificationHTML({ prospectName, prospectPhone, contactName, contactFunction, callbackDate, callbackTime, callbackReason, callerName, notes }) {
  const dateStr = callbackDate ? new Date(callbackDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : null
  const timeStr = callbackTime || null

  let title = '📞 Notification phoning'
  if (callbackReason?.includes('🔥')) title = '🔥 Prospect chaud'
  else if (callbackReason?.includes('PASSER LA MAIN') || callbackReason?.includes('👋')) title = '👋 Passer la main'
  else if (callbackReason?.includes('RDV')) title = '📅 Nouveau RDV'
  else if (callbackDate) title = '🔔 Rappel programmé'

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a3a4a 0%, #2d5a6b 100%); padding: 16px 24px; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0; color: #d4a84b; font-size: 18px;">${title}</h2>
        <p style="margin: 4px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">Par ${callerName || 'Équipe'} — ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <div style="background: #f8f9fa; padding: 20px 24px; border: 1px solid #e5e7eb; border-top: none;">
        <table cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px; line-height: 1.6;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; width: 120px;">Entreprise</td>
            <td style="padding: 6px 0; font-weight: bold; color: #111827;">${prospectName || '—'}</td>
          </tr>
          ${prospectPhone ? `<tr>
            <td style="padding: 6px 0; color: #6b7280;">Téléphone</td>
            <td style="padding: 6px 0;"><a href="tel:${prospectPhone.replace(/\s/g, '')}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${prospectPhone}</a></td>
          </tr>` : ''}
          ${contactName ? `<tr>
            <td style="padding: 6px 0; color: #6b7280;">Contact</td>
            <td style="padding: 6px 0; font-weight: 500;">${contactName}${contactFunction ? ' <span style="color: #6b7280; font-weight: normal;">(' + contactFunction + ')</span>' : ''}</td>
          </tr>` : ''}
          ${callbackReason ? `<tr>
            <td style="padding: 6px 0; color: #6b7280;">Motif</td>
            <td style="padding: 6px 0;">${callbackReason}</td>
          </tr>` : ''}
          ${dateStr ? `<tr>
            <td style="padding: 6px 0; color: #6b7280;">Rappel</td>
            <td style="padding: 6px 0; font-weight: bold; color: #d97706;">${dateStr}${timeStr ? ' à ' + timeStr : ''}</td>
          </tr>` : ''}
          ${notes ? `<tr>
            <td style="padding: 6px 0; color: #6b7280; vertical-align: top;">Notes</td>
            <td style="padding: 6px 0; white-space: pre-line;">${notes}</td>
          </tr>` : ''}
        </table>
      </div>
      <div style="background: #fff; padding: 12px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
        <a href="https://campus.accessformation.pro/prospection-massive" style="display: inline-block; padding: 8px 24px; background: #1a3a4a; color: #d4a84b; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: bold;">Ouvrir le phoning</a>
      </div>
    </div>
  `
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let transporter = null

  try {
    const {
      prospectName, prospectPhone, contactName, contactFunction,
      callbackDate, callbackTime, callbackReason,
      callerName, notes, to
    } = req.body

    if (!prospectName && !callbackReason) {
      return res.status(400).json({ error: 'prospectName ou callbackReason requis' })
    }

    // Destinataire : param 'to' ou Hicham par défaut
    const recipient = to || 'hicham.saidi@accessformation.pro'

    // Expéditeur : entreprise@ (compte générique)
    const senderEmail = 'entreprise@accessformation.pro'

    // Sujet
    let subject = '📞 '
    if (callbackReason?.includes('🔥') || callbackReason?.includes('INTÉRESSÉ')) {
      subject = '🔥 Prospect chaud — ' + prospectName
    } else if (callbackReason?.includes('PASSER LA MAIN') || callbackReason?.includes('👋')) {
      subject = '👋 Passer la main — ' + prospectName
    } else if (callbackReason?.includes('RDV')) {
      subject = '📅 RDV — ' + prospectName
    } else if (callbackDate) {
      subject = '🔔 Rappel — ' + prospectName
    } else {
      subject = '📞 Phoning — ' + prospectName
    }

    const html = buildNotificationHTML(req.body)

    const emailConfig = await findSmtpConfig(senderEmail)
    if (!emailConfig) {
      return res.status(400).json({ error: 'Aucune configuration email active' })
    }

    const smtpPassword = decrypt(emailConfig.smtp_password_encrypted)

    transporter = nodemailer.createTransport({
      host: emailConfig.smtp_host,
      port: emailConfig.smtp_port,
      secure: emailConfig.smtp_secure,
      pool: false,
      auth: { user: emailConfig.email, pass: smtpPassword },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    })

    await transporter.verify()

    const mailOptions = {
      from: `"Access Formation — Phoning" <${senderEmail}>`,
      sender: emailConfig.email,
      replyTo: `"Access Formation" <${senderEmail}>`,
      to: recipient,
      bcc: 'contact@accessformation.pro',
      subject: subject,
      html: html,
    }

    await transporter.sendMail(mailOptions)
    if (transporter) try { transporter.close() } catch (e) {}

    console.log(`✅ Notification phoning envoyée à ${recipient} — ${subject}`)
    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('Erreur envoi notification phoning:', error)
    if (transporter) try { transporter.close() } catch (e) {}
    return res.status(500).json({ error: error.message })
  }
}
