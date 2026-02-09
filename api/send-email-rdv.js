// api/send-email-rdv.js
// Envoie un email de compte-rendu via SMTP IONOS avec retry
// Les PJ sont récupérées depuis Supabase Storage (pas en JSON body → évite la limite 4.5MB Vercel)

import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let transporter = null
  const tempPaths = []

  try {
    const { userId, to, subject, body, attachmentRefs = [], rdvId } = req.body

    if (!userId || !to || !subject || !body) {
      return res.status(400).json({ error: 'Paramètres manquants' })
    }

    // 1. Récupérer la config SMTP
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
    transporter = nodemailer.createTransport({
      host: emailConfig.smtp_host,
      port: emailConfig.smtp_port,
      secure: emailConfig.smtp_secure,
      auth: { user: emailConfig.email, pass: smtpPassword },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      pool: false,
      maxConnections: 1,
      maxMessages: 1
    })

    // 4. Télécharger les PJ depuis Supabase Storage
    const mailAttachments = []
    for (const ref of attachmentRefs) {
      try {
        console.log('Téléchargement PJ:', ref.storagePath)
        const { data, error: dlError } = await supabase.storage
          .from('email-attachments')
          .download(ref.storagePath)

        if (dlError) {
          console.error('Erreur download PJ:', ref.storagePath, dlError.message)
          continue
        }

        const buffer = Buffer.from(await data.arrayBuffer())
        mailAttachments.push({
          filename: ref.filename,
          content: buffer
        })
        tempPaths.push(ref.storagePath)
        console.log('✅ PJ chargée:', ref.filename, buffer.length, 'bytes')
      } catch (err) {
        console.error('Erreur PJ:', ref.filename, err.message)
      }
    }

    // 5. Préparer le corps avec signature
    let htmlBody = body.replace(/\n/g, '<br>')

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

    htmlBody += signatures[emailConfig.email] || ''

    const mailOptions = {
      from: `"${emailConfig.email.split('@')[0]}" <${emailConfig.email}>`,
      to,
      bcc: 'contact@accessformation.pro',
      subject,
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
        subject,
        body,
        resend_email_id: info.messageId,
        attachments: attachmentRefs.map(a => ({ name: a.filename, size: a.size || 0 })),
        status: 'sent',
        created_by: userId
      }])

    if (historyError) {
      console.error('Erreur sauvegarde historique:', historyError)
    }

    // 8b. Traçabilité CRM : ajouter dans l'historique client
    if (rdvId) {
      try {
        const { data: rdvData } = await supabase.from('prospect_rdv').select('client_id, contact_name').eq('id', rdvId).single()
        if (rdvData?.client_id) {
          const now = new Date()
          const dateStr = now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
          const timeStr = now.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })
          const authorName = emailConfig.email.includes('hicham') ? 'Hicham' : emailConfig.email.includes('maxime') ? 'Maxime' : 'Access Formation'

          await supabase.from('client_interactions').insert({
            client_id: rdvData.client_id,
            type: 'email',
            title: 'Email post-RDV envoyé',
            content: `Email envoyé par ${authorName} le ${dateStr} à ${timeStr}\nDestinataire : ${to}\nObjet : ${subject}`,
            author: authorName,
          })
          console.log('📋 Traçabilité CRM ajoutée pour client:', rdvData.client_id)
        }
      } catch (traceErr) {
        console.error('Erreur traçabilité CRM (non bloquant):', traceErr.message)
      }
    }

    // 8. Nettoyer les fichiers temporaires du Storage
    if (tempPaths.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from('email-attachments')
        .remove(tempPaths)
      if (deleteError) {
        console.error('Erreur nettoyage Storage:', deleteError)
      } else {
        console.log('🧹 Fichiers temp nettoyés:', tempPaths.length)
      }
    }

    // 9. Fermer le transporteur
    if (transporter) transporter.close()

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: 'Email envoyé avec succès'
    })

  } catch (error) {
    console.error('Erreur envoi email:', error)

    // Nettoyage en cas d'erreur aussi
    if (tempPaths.length > 0) {
      try {
        await supabase.storage.from('email-attachments').remove(tempPaths)
      } catch (e) { /* ignore */ }
    }

    if (transporter) {
      try { transporter.close() } catch (e) { /* ignore */ }
    }

    return res.status(500).json({
      error: 'Erreur lors de l\'envoi de l\'email',
      details: error.message
    })
  }
}
