// api/user-email-config.js
// CRUD pour la configuration email de l'utilisateur

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Fonction de chiffrement AES-256
function encrypt(text) {
  const algorithm = 'aes-256-cbc'
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

// Fonction de déchiffrement
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
  const { method } = req

  try {
    // GET : Récupérer la config de l'utilisateur
    if (method === 'GET') {
      const { userId } = req.query

      const { data, error } = await supabase
        .from('user_email_configs')
        .select('id, user_id, email, smtp_host, smtp_port, smtp_secure, is_active, last_tested_at')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({ data })
    }

    // POST : Créer ou mettre à jour la config
    if (method === 'POST') {
      const { userId, email, password, testConnection } = req.body

      // Si testConnection = true, on teste juste la connexion
      if (testConnection) {
        const transporter = nodemailer.createTransport({
          host: 'smtp.exchange.ionos.eu',
          port: 587,
          secure: false,
          auth: { user: email, pass: password },
          tls: { rejectUnauthorized: false }
        })

        try {
          await transporter.verify()
          return res.status(200).json({ success: true, message: 'Connexion SMTP réussie !' })
        } catch (error) {
          return res.status(400).json({ success: false, error: 'Échec de connexion SMTP. Vérifiez vos identifiants.' })
        }
      }

      // Sinon, on sauvegarde
      const encryptedPassword = encrypt(password)

      // Vérifier si config existe déjà
      const { data: existing } = await supabase
        .from('user_email_configs')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (existing) {
        // Update
        const { error } = await supabase
          .from('user_email_configs')
          .update({
            email,
            smtp_password_encrypted: encryptedPassword,
            is_active: true,
            last_tested_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (error) throw error
      } else {
        // Insert
        const { error } = await supabase
          .from('user_email_configs')
          .insert([{
            user_id: userId,
            email,
            smtp_password_encrypted: encryptedPassword,
            smtp_host: 'smtp.exchange.ionos.eu',
            smtp_port: 587,
            smtp_secure: false,
            is_active: true,
            last_tested_at: new Date().toISOString()
          }])

        if (error) throw error
      }

      return res.status(200).json({ success: true, message: 'Configuration sauvegardée !' })
    }

    // DELETE : Supprimer la config
    if (method === 'DELETE') {
      const { userId } = req.query

      const { error } = await supabase
        .from('user_email_configs')
        .delete()
        .eq('user_id', userId)

      if (error) throw error

      return res.status(200).json({ success: true, message: 'Configuration supprimée' })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('Erreur API user-email-config:', error)
    return res.status(500).json({ error: error.message })
  }
}
