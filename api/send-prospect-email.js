// api/send-prospect-email.js
// Envoie un email de prospection au prospect (suite echange / NRP / relance)
// Signature HTML selon l'expediteur (Hicham / Maxime / Marine)
// Log dans prospect_email_logs + BCC sender + contact@

import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { saveToSentFolder } from './_lib/save-to-sent.js'

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
    name: 'Hicham SAIDI',
    title: 'Dirigeant associé',
    phone: '06 35 20 04 28',
    email: 'hicham.saidi@accessformation.pro',
    senderEmail: 'hicham.saidi@accessformation.pro',
  },
  Maxime: {
    name: 'Maxime LANGLAIS',
    title: 'Dirigeant associé',
    phone: '07 83 51 17 95',
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
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; margin-top: 16px; border-collapse: collapse; width: 440px;">
      <tr>
        <td bgcolor="#1a2e3d" style="background-color: #1a2e3d; padding: 14px 18px; border-radius: 8px 8px 0 0;">
          <p style="margin: 0; font-size: 15px; font-weight: bold; color: #ffffff;">${sig.name}</p>
          ${sig.title ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.7);">${sig.title}</p>` : ''}
        </td>
      </tr>
      <tr>
        <td bgcolor="#f8f9fa" style="background-color: #f8f9fa; padding: 12px 18px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
          <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #1a2e3d;">ACCESS FORMATION</p>
          <p style="margin: 0 0 1px 0; font-size: 12px; color: #555;">📞 ${sig.phone} · ✉️ <a href="mailto:${sig.email}" style="color: #2563eb; text-decoration: none;">${sig.email}</a></p>
          <p style="margin: 0; font-size: 12px;">🌐 <a href="https://www.accessformation.pro" style="color: #2563eb; text-decoration: none;">www.accessformation.pro</a></p>
        </td>
      </tr>
      <tr>
        <td bgcolor="#c8993c" style="background-color: #c8993c; padding: 5px 18px; border-radius: 0 0 8px 8px;">
          <p style="margin: 0; font-size: 10px; color: #1a2e3d; font-weight: bold; text-transform: uppercase; letter-spacing: 1.2px; text-align: center;">Organisme de formation certifié Qualiopi</p>
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
      <p style="margin-top: 16px;">Bien cordialement,</p>
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
      pool: false,
      auth: { user: emailConfig.email, pass: smtpPassword },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    })

    // Retry logic — 3 tentatives avec délai croissant
    async function sendWithRetry(mailOpts, retries = 3) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await transporter.verify()
          await transporter.sendMail(mailOpts)
          return
        } catch (err) {
          if (attempt < retries && (err.message.includes('421') || err.message.includes('concurrent') || err.message.includes('greeting'))) {
            console.log(`Tentative ${attempt}/${retries} échouée, retry dans ${attempt * 3}s...`)
            if (transporter) try { transporter.close() } catch (e) {}
            await new Promise(r => setTimeout(r, attempt * 3000))
            transporter = nodemailer.createTransport({
              host: emailConfig.smtp_host, port: emailConfig.smtp_port, secure: emailConfig.smtp_secure,
              pool: false, auth: { user: emailConfig.email, pass: smtpPassword },
              tls: { rejectUnauthorized: false }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
            })
          } else {
            throw err
          }
        }
      }
    }

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

    await sendWithRetry(mailOptions)
    if (transporter) try { transporter.close() } catch (e) {}

    // Copier dans le dossier Envoyés (non-bloquant)
    saveToSentFolder(emailConfig, smtpPassword, mailOptions).catch(err => {
      console.warn('Save to Sent failed (non-blocking):', err.message)
    })

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
