// api/send-quote-email.js
// Envoyer un devis par email via SMTP (utilise user_email_configs existant)

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Déchiffrement AES-256
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

// Sleep pour retry
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Envoi avec retry
async function sendEmailWithRetry(transporter, mailOptions, maxRetries = 3) {
  let lastError = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Tentative d'envoi ${attempt}/${maxRetries}`)
      await transporter.verify()
      const info = await transporter.sendMail(mailOptions)
      console.log('Email envoyé avec succès:', info.messageId)
      return info
    } catch (error) {
      lastError = error
      console.error(`Tentative ${attempt} échouée:`, error.message)
      try { transporter.close() } catch (e) { /* ignore */ }
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000
        console.log(`Attente de ${waitTime}ms avant nouvelle tentative...`)
        await sleep(waitTime)
      }
    }
  }
  throw lastError
}

// Signatures HTML par utilisateur
const SIGNATURES = {
  'hicham.saidi@accessformation.pro': `
<br><br>
À très bientôt.<br>
Bien cordialement,<br>
<br>
<strong>Hicham</strong><br>
Access Formation<br>
06 35 20 04 28<br>
<a href="mailto:hicham.saidi@accessformation.pro">hicham.saidi@accessformation.pro</a>
  `,
  'maxime.langlais@accessformation.pro': `
<br><br>
À très bientôt.<br>
Bien cordialement,<br>
<br>
<strong>Maxime</strong><br>
Access Formation<br>
07 83 51 17 95<br>
<a href="mailto:maxime.langlais@accessformation.pro">maxime.langlais@accessformation.pro</a>
  `
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let transporter = null

  try {
    const { userId, to, subject, body, pdfBase64, pdfFilename, quoteId } = req.body

    if (!userId || !to || !subject || !body) {
      return res.status(400).json({ error: 'Paramètres manquants: userId, to, subject, body' })
    }

    // 1. Récupérer la config SMTP de l'utilisateur
    const { data: emailConfig, error: configError } = await supabase
      .from('user_email_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (configError || !emailConfig) {
      return res.status(400).json({
        error: 'Configuration email non trouvée. Configurez votre email dans Paramètres.'
      })
    }

    // 2. Déchiffrer le mot de passe
    const smtpPassword = decrypt(emailConfig.smtp_password_encrypted)

    // 3. Créer le transporteur SMTP
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

    // 4. Préparer le corps HTML avec signature
    let htmlBody = body.replace(/\n/g, '<br>')
    const signature = SIGNATURES[emailConfig.email] || ''
    htmlBody += signature

    // 5. Construire les options du mail
    const senderName = emailConfig.email.includes('maxime') ? 'Maxime Langlais' : 'Hicham Saidi'
    const mailOptions = {
      from: `"${senderName} - Access Formation" <${emailConfig.email}>`,
      to: to,
      bcc: 'contact@accessformation.pro',
      subject: subject,
      text: body,
      html: htmlBody,
      attachments: []
    }

    // 6. Pièce jointe PDF
    if (pdfBase64 && pdfFilename) {
      mailOptions.attachments.push({
        filename: pdfFilename,
        content: pdfBase64,
        encoding: 'base64',
        contentType: 'application/pdf'
      })
    }

    // 7. Envoyer avec retry
    const info = await sendEmailWithRetry(transporter, mailOptions, 3)

    // 8. Mettre à jour le statut du devis → "envoye"
    if (quoteId) {
      const { error: updateError } = await supabase
        .from('quotes')
        .update({ status: 'envoye', updated_at: new Date().toISOString() })
        .eq('id', quoteId)

      if (updateError) {
        console.error('Erreur mise à jour statut devis:', updateError)
      }
    }

    // 9. Fermer le transporteur
    try { transporter.close() } catch (e) { /* ignore */ }

    return res.status(200).json({
      success: true,
      message: 'Devis envoyé par email avec succès',
      messageId: info.messageId,
      to: to
    })

  } catch (error) {
    console.error('send-quote-email error:', error)
    if (transporter) {
      try { transporter.close() } catch (e) { /* ignore */ }
    }
    return res.status(500).json({
      error: 'Erreur lors de l\'envoi de l\'email',
      details: error.message
    })
  }
}
