// api/send-email-stagiaire.js
// Envoie un email individuel à un stagiaire avec ses documents en PJ

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function sendEmailWithRetry(transporter, mailOptions, maxRetries = 3) {
  let lastError = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Tentative d'envoi ${attempt}/${maxRetries} à ${mailOptions.to}`)
      await transporter.verify()
      const info = await transporter.sendMail(mailOptions)
      console.log('Email envoyé avec succès:', info.messageId)
      return info
    } catch (error) {
      lastError = error
      console.error(`Tentative ${attempt} échouée:`, error.message)
      try { transporter.close() } catch (e) {}
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000
        console.log(`Attente de ${waitTime}ms avant nouvelle tentative...`)
        await sleep(waitTime)
      }
    }
  }
  throw lastError
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let transporter = null

  try {
    const { userId, to, subject, body, attachments = [], sessionId, traineeId } = req.body

    if (!userId || !to || !subject || !body) {
      return res.status(400).json({ error: 'Paramètres manquants' })
    }

    // 1. Config SMTP
    const { data: emailConfig, error: configError } = await supabase
      .from('user_email_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (configError || !emailConfig) {
      return res.status(400).json({ error: 'Configuration email non trouvée.' })
    }

    // 2. Déchiffrer mot de passe
    const smtpPassword = decrypt(emailConfig.smtp_password_encrypted)

    // 3. Transporteur
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
      pool: false,
      maxConnections: 1,
      maxMessages: 1
    })

    // 4. PJ
    const mailAttachments = attachments.map(att => ({
      filename: att.filename,
      content: att.content,
      encoding: att.encoding || 'base64'
    }))

    // 5. Signature
    let htmlBody = body.replace(/\n/g, '<br>')
    const signatures = {
      'hicham.saidi@accessformation.pro': `<br><br>À très bientôt.<br>Bien cordialement,<br><br><strong>Hicham</strong><br>Access Formation<br>06 35 20 04 28<br><a href="mailto:hicham.saidi@accessformation.pro">hicham.saidi@accessformation.pro</a>`,
      'maxime.langlais@accessformation.pro': `<br><br>À très bientôt.<br>Bien cordialement,<br><br><strong>Maxime</strong><br>Access Formation<br>07 83 51 17 95<br><a href="mailto:maxime.langlais@accessformation.pro">maxime.langlais@accessformation.pro</a>`
    }
    htmlBody += (signatures[emailConfig.email] || '')

    // 6. BCC contact@accessformation.pro
    const mailOptions = {
      from: `"${emailConfig.email.split('@')[0]}" <${emailConfig.email}>`,
      to: to,
      bcc: 'contact@accessformation.pro',
      subject: subject,
      text: body,
      html: htmlBody,
      attachments: mailAttachments
    }

    // 7. Envoyer
    const info = await sendEmailWithRetry(transporter, mailOptions, 3)

    // 8. Log dans session_emails_sent
    await supabase
      .from('session_emails_sent')
      .insert([{
        session_id: sessionId,
        to_email: to,
        to_name: traineeId,
        subject: subject,
        body: body,
        resend_email_id: info.messageId,
        attachments: attachments.map(a => ({ name: a.filename, size: a.size || 0 })),
        status: 'sent',
        created_by: userId,
        email_type: 'stagiaire'
      }])

    if (transporter) transporter.close()

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: 'Email envoyé avec succès'
    })

  } catch (error) {
    console.error('Erreur envoi email stagiaire:', error)
    if (transporter) { try { transporter.close() } catch (e) {} }
    return res.status(500).json({
      error: 'Erreur lors de l\'envoi de l\'email',
      details: error.message
    })
  }
}
