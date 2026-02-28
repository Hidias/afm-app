// ═══════════════════════════════════════════════════════════
// TEST — Envoi email test signature + dossier Envoyés
// GET /api/test-signature?to=hicham.saidi@accessformation.pro
// À SUPPRIMER APRÈS TEST
// ═══════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { saveToSentFolder } from './_lib/save-to-sent.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

function decrypt(encryptedText) {
  const [ivHex, encrypted] = encryptedText.split(':')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(ivHex, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export default async function handler(req, res) {
  try {
    const to = req.query.to || 'hicham.saidi@accessformation.pro'

    // Charger config SMTP hicham
    const { data: config } = await supabase
      .from('user_email_configs')
      .select('*')
      .eq('email', 'hicham.saidi@accessformation.pro')
      .eq('is_active', true)
      .single()

    if (!config) return res.status(500).json({ error: 'Config SMTP non trouvée' })

    const smtpPassword = decrypt(config.smtp_password_encrypted)

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: { user: config.email, pass: smtpPassword },
      tls: { rejectUnauthorized: false },
    })

    const signature = `
<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; margin-top: 16px; border-collapse: collapse; width: 440px;">
  <tr>
    <td bgcolor="#1a2e3d" style="background-color: #1a2e3d; padding: 14px 18px; border-radius: 8px 8px 0 0;">
      <p style="margin: 0; font-size: 15px; font-weight: bold; color: #ffffff;">Hicham SAIDI</p>
      <p style="margin: 2px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.7);">Dirigeant associé</p>
    </td>
  </tr>
  <tr>
    <td bgcolor="#f8f9fa" style="background-color: #f8f9fa; padding: 12px 18px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #1a2e3d;">ACCESS FORMATION</p>
      <p style="margin: 0 0 1px 0; font-size: 12px; color: #555;">📞 06 35 20 04 28 · ✉️ <a href="mailto:hicham.saidi@accessformation.pro" style="color: #2563eb; text-decoration: none;">hicham.saidi@accessformation.pro</a></p>
      <p style="margin: 0; font-size: 12px;">🌐 <a href="https://www.accessformation.pro" style="color: #2563eb; text-decoration: none;">www.accessformation.pro</a></p>
    </td>
  </tr>
  <tr>
    <td bgcolor="#c8993c" style="background-color: #c8993c; padding: 5px 18px; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; font-size: 10px; color: #1a2e3d; font-weight: bold; text-transform: uppercase; letter-spacing: 1.2px; text-align: center;">Organisme de formation certifié Qualiopi</p>
    </td>
  </tr>
</table>`

    const mailOptions = {
      from: '"Access Formation - Hicham SAIDI" <hicham.saidi@accessformation.pro>',
      to,
      subject: '🧪 Test signature Access Campus',
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
          <p>Bonjour,</p>
          <p>Ceci est un test de la nouvelle signature email et du dossier Envoyés.</p>
          <p>Bien cordialement,</p>
          ${signature}
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    transporter.close()

    // Copier dans Envoyés
    let sentResult = 'pending'
    try {
      await saveToSentFolder(config, smtpPassword, mailOptions)
      sentResult = 'ok'
    } catch (err) {
      sentResult = `error: ${err.message}`
    }

    return res.status(200).json({
      success: true,
      to,
      signature: 'C3 bandeau doré',
      sent_folder: sentResult,
    })
  } catch (err) {
    console.error('Test error:', err)
    return res.status(500).json({ error: err.message })
  }
}
