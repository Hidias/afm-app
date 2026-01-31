// api/send-email-rdv.js
// Envoie un email de compte-rendu via SMTP IONOS

import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Fonction de déchiffrement AES-256
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, to, subject, body, attachments = [], rdvId } = req.body

    // 1. Récupérer la config SMTP de l'utilisateur
    const { data: emailConfig, error: configError } = await supabase
      .from('user_email_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (configError || !emailConfig) {
      return res.status(400).json({ error: 'Configuration email non trouvée. Configurez votre email dans Paramètres.' })
    }

    // 2. Déchiffrer le mot de passe
    const smtpPassword = decrypt(emailConfig.smtp_password_encrypted)

    // 3. Créer le transporteur SMTP
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtp_host,
      port: emailConfig.smtp_port,
      secure: emailConfig.smtp_secure, // false pour STARTTLS (587)
      auth: {
        user: emailConfig.email,
        pass: smtpPassword
      },
      tls: {
        rejectUnauthorized: false // Pour IONOS
      }
    })

    // 4. Préparer les pièces jointes
    const mailAttachments = attachments.map(att => ({
      filename: att.filename,
      content: att.content, // Base64 ou Buffer
      encoding: att.encoding || 'base64'
    }))

    // 5. Envoyer l'email
    const mailOptions = {
      from: `"${emailConfig.email.split('@')[0]}" <${emailConfig.email}>`,
      to: to,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
      attachments: mailAttachments
    }

    const info = await transporter.sendMail(mailOptions)

    // 6. Sauvegarder dans l'historique
    const { error: historyError } = await supabase
      .from('rdv_emails_sent')
      .insert([{
        rdv_id: rdvId,
        to_email: to,
        to_name: to.split('@')[0],
        subject: subject,
        body: body,
        resend_email_id: info.messageId,
        attachments: attachments.map(a => ({ name: a.filename, size: a.size })),
        status: 'sent',
        created_by: userId
      }])

    if (historyError) {
      console.error('Erreur sauvegarde historique:', historyError)
    }

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: 'Email envoyé avec succès'
    })

  } catch (error) {
    console.error('Erreur envoi email:', error)
    return res.status(500).json({
      error: 'Erreur lors de l\'envoi de l\'email',
      details: error.message
    })
  }
}
