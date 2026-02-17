// api/send-prospect-email.js
// Envoie un email de prospection au prospect (suite echange / NRP / relance)
// Signature HTML selon l'expediteur (Hicham / Maxime / Marine)
// Log dans prospect_email_logs + BCC sender + contact@

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

// Signatures HTML par expediteur
// senderEmail = adresse FROM réelle pour l'envoi SMTP
const SIGNATURES = {
  Hicham: {
    name: 'Hicham',
    title: 'Dirigeant associé',
    phone: '06.35.20.04.28',
    email: 'hicham.saidi@accessformation.pro',
    senderEmail: 'hicham.saidi@accessformation.pro',
  },
  Maxime: {
    name: 'Maxime',
    title: 'Dirigeant associé',
    phone: '07.83.51.17.95',
    email: 'maxime.langlais@accessformation.pro',
    senderEmail: 'maxime.langlais@accessformation.pro',
  },
  Marine: {
    name: 'Marine',
    title: '',
    phone: '02 46 56 57 54',
    email: 'entreprise@accessformation.pro',
    senderEmail: 'entreprise@accessformation.pro',
  },
}

function buildSignatureHTML(caller) {
  const sig = SIGNATURES[caller] || SIGNATURES.Marine
  return `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; margin-top: 20px; border-collapse: collapse;">
      <tr>
        <td style="padding-right: 15px; border-right: 3px solid #d4a84b; vertical-align: top;">
          <div style="background: linear-gradient(135deg, #1a3a4a 0%, #2d5a6b 100%); padding: 16px 20px; border-radius: 8px; min-width: 160px;">
            <p style="margin: 0; font-family: 'Georgia', serif; font-size: 16px; color: #d4a84b; font-style: italic; letter-spacing: 1px;">${sig.name}</p>
            ${sig.title ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.8);">${sig.title}</p>` : ''}
          </div>
        </td>
        <td style="padding-left: 15px; vertical-align: top;">
          <p style="margin: 0 0 3px 0; font-weight: bold; font-size: 13px; color: #1a3a4a;">ACCESS FORMATION</p>
          <p style="margin: 0 0 2px 0; font-size: 12px; color: #555;">&#9742; ${sig.phone}</p>
          <p style="margin: 0 0 2px 0; font-size: 12px; color: #555;">&#9993; <a href="mailto:${sig.email}" style="color: #2563eb; text-decoration: none;">${sig.email}</a></p>
          <p style="margin: 0; font-size: 12px; color: #555;">&#127760; <a href="https://www.accessformation.pro" style="color: #2563eb; text-decoration: none;">www.accessformation.pro</a></p>
        </td>
      </tr>
    </table>
  `
}

function wrapEmailHTML(body, caller) {
  const signature = buildSignatureHTML(caller)
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; max-width: 650px;">
      ${body}
      ${signature}
    </div>
  `
}

// Trouver la config SMTP pour un email donné, avec fallback intelligent
async function findSmtpConfig(senderEmail) {
  const { data: configs } = await supabase
    .from('user_email_configs')
    .select('*')
    .eq('is_active', true)

  if (!configs || configs.length === 0) return null

  // 1. Config exacte pour le senderEmail
  let config = configs.find(c => c.email === senderEmail)
  if (config) return config

  // 2. Fallback : entreprise@ (compte générique)
  config = configs.find(c => c.email === 'entreprise@accessformation.pro')
  if (config) return config

  // 3. Fallback : contact@
  config = configs.find(c => c.email === 'contact@accessformation.pro')
  if (config) return config

  // 4. Dernier recours : n'importe quelle config active
  return configs[0]
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let transporter = null

  try {
    const {
      to, subject, body, caller,
      prospectSiren, clientId, prospectName, templateType,
      attachments
    } = req.body

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Parametres manquants: to, subject, body requis' })
    }

    const callerInfo = SIGNATURES[caller] || SIGNATURES.Marine
    const senderEmail = callerInfo.senderEmail
    const html = wrapEmailHTML(body, caller)

    // Chercher la config SMTP correspondant au sender
    const emailConfig = await findSmtpConfig(senderEmail)

    if (!emailConfig) {
      return res.status(400).json({ error: 'Aucune configuration email active trouvee' })
    }

    const smtpPassword = decrypt(emailConfig.smtp_password_encrypted)

    transporter = nodemailer.createTransport({
      host: emailConfig.smtp_host,
      port: emailConfig.smtp_port,
      secure: emailConfig.smtp_secure,
      auth: { user: emailConfig.email, pass: smtpPassword },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
    })

    await transporter.verify()

    // BCC : toujours l'adresse d'envoi + contact@ (dédupliqué)
    const bccSet = new Set([senderEmail, 'contact@accessformation.pro'])
    // Ne pas se mettre en BCC si on envoie déjà à cette adresse
    bccSet.delete(to)

    const mailOptions = {
      from: `"Access Formation - ${callerInfo.name}" <${senderEmail}>`,
      sender: emailConfig.email,
      replyTo: `"Access Formation" <${senderEmail}>`,
      to: to,
      bcc: [...bccSet].join(', '),
      subject: subject,
      html: html,
      attachments: [],
    }

    // Ajouter les pièces jointes si présentes
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.base64 && att.filename) {
          mailOptions.attachments.push({
            filename: att.filename,
            content: Buffer.from(att.base64, 'base64'),
            contentType: att.contentType || 'application/pdf',
          })
        }
      }
    }

    await transporter.sendMail(mailOptions)
    if (transporter) transporter.close()

    // Log dans prospect_email_logs
    try {
      await supabase.from('prospect_email_logs').insert({
        prospect_siren: prospectSiren || null,
        client_id: clientId || null,
        prospect_name: prospectName || null,
        to_email: to,
        from_email: senderEmail,
        subject: subject,
        template_type: templateType || 'custom',
        body_preview: body.replace(/<[^>]*>/g, '').substring(0, 500),
        sent_by: caller || 'Marine',
        status: 'sent',
      })
    } catch (logErr) {
      console.error('Erreur log email (non bloquant):', logErr)
    }

    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('Erreur envoi email prospect:', error)
    if (transporter) try { transporter.close() } catch (e) {}

    // Log erreur
    try {
      await supabase.from('prospect_email_logs').insert({
        prospect_siren: req.body?.prospectSiren || null,
        prospect_name: req.body?.prospectName || null,
        to_email: req.body?.to || '',
        from_email: '',
        subject: req.body?.subject || '',
        template_type: req.body?.templateType || 'custom',
        sent_by: req.body?.caller || 'Marine',
        status: 'error',
        error_message: error.message,
      })
    } catch (logErr) {}

    return res.status(500).json({ error: error.message })
  }
}
