// api/send-email-rdv.js
// Envoie un email de compte-rendu via SMTP IONOS avec retry

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

// Fonction pour attendre (pour les retry)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Fonction d'envoi avec retry
async function sendEmailWithRetry(transporter, mailOptions, maxRetries = 3) {
  let lastError = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Tentative d'envoi ${attempt}/${maxRetries}`)
      
      // Vérifier la connexion
      await transporter.verify()
      
      // Envoyer l'email
      const info = await transporter.sendMail(mailOptions)
      
      console.log('Email envoyé avec succès:', info.messageId)
      return info
      
    } catch (error) {
      lastError = error
      console.error(`Tentative ${attempt} échouée:`, error.message)
      
      // Fermer la connexion en cas d'erreur
      try {
        transporter.close()
      } catch (e) {
        // Ignore
      }
      
      // Si c'est pas la dernière tentative, attendre avant de retry
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000 // 2s, 4s, 6s
        console.log(`Attente de ${waitTime}ms avant nouvelle tentative...`)
        await sleep(waitTime)
      }
    }
  }
  
  // Toutes les tentatives ont échoué
  throw lastError
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let transporter = null

  try {
    const { userId, to, subject, body, attachments = [], rdvId } = req.body

    if (!userId || !to || !subject || !body) {
      return res.status(400).json({ error: 'Paramètres manquants' })
    }

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

    // 3. Créer le transporteur SMTP avec timeouts plus longs
    transporter = nodemailer.createTransport({
      host: emailConfig.smtp_host,
      port: emailConfig.smtp_port,
      secure: emailConfig.smtp_secure, // false pour STARTTLS (587)
      auth: {
        user: emailConfig.email,
        pass: smtpPassword
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000, // 10 secondes
      greetingTimeout: 10000, // 10 secondes
      socketTimeout: 30000, // 30 secondes
      pool: false, // Pas de pool pour éviter les connexions concurrentes
      maxConnections: 1,
      maxMessages: 1
    })

    // 4. Préparer les pièces jointes
    const mailAttachments = attachments.map(att => ({
      filename: att.filename,
      content: att.content,
      encoding: att.encoding || 'base64'
    }))

    // 5. Préparer le corps avec signature texte
    let htmlBody = body.replace(/\n/g, '<br>')
    
    // Ajouter la signature texte selon l'utilisateur
    const signatures = {
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
    
    // Ajouter la signature appropriée
    const signature = signatures[emailConfig.email] || ''
    htmlBody += signature
    
    const mailOptions = {
      from: `"${emailConfig.email.split('@')[0]}" <${emailConfig.email}>`,
      to: to,
      subject: subject,
      text: body,
      html: htmlBody,
      attachments: mailAttachments
    }

    // 6. Envoyer avec retry
    const info = await sendEmailWithRetry(transporter, mailOptions, 3)

    // 7. Sauvegarder dans l'historique
    const { error: historyError } = await supabase
      .from('rdv_emails_sent')
      .insert([{
        rdv_id: rdvId,
        to_email: to,
        to_name: to.split('@')[0],
        subject: subject,
        body: body,
        resend_email_id: info.messageId,
        attachments: attachments.map(a => ({ name: a.filename, size: a.size || 0 })),
        status: 'sent',
        created_by: userId
      }])

    if (historyError) {
      console.error('Erreur sauvegarde historique:', historyError)
    }

    // 8. Fermer la connexion proprement
    if (transporter) {
      transporter.close()
    }

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: 'Email envoyé avec succès'
    })

  } catch (error) {
    console.error('Erreur envoi email:', error)
    
    // Fermer la connexion en cas d'erreur
    if (transporter) {
      try {
        transporter.close()
      } catch (e) {
        // Ignore
      }
    }
    
    return res.status(500).json({
      error: 'Erreur lors de l\'envoi de l\'email',
      details: error.message
    })
  }
}
