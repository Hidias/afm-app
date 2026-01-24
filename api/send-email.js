// API Route pour Vercel Serverless Functions
import { Resend } from 'resend'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { to, subject, html } = req.body

    // Validation
    if (!to || !subject || !html) {
      console.error('Paramètres manquants:', { to: !!to, subject: !!subject, html: !!html })
      return res.status(400).json({ 
        error: 'Paramètres manquants (to, subject, html)' 
      })
    }

    // Vérifier la clé API
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY non configurée')
      return res.status(500).json({ 
        error: 'Configuration serveur manquante (RESEND_API_KEY)' 
      })
    }

    console.log('Envoi email à:', to)

    // Initialiser Resend
    const resend = new Resend(process.env.RESEND_API_KEY)

    // Envoi de l'email
    const { data, error } = await resend.emails.send({
      from: 'Access Formation <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html
    })

    if (error) {
      console.error('Erreur Resend:', error)
      return res.status(400).json({ 
        error: `Resend error: ${error.message}` 
      })
    }

    console.log('Email envoyé avec succès:', data)
    return res.status(200).json({ 
      success: true, 
      data 
    })

  } catch (error) {
    console.error('Erreur serveur:', error)
    return res.status(500).json({ 
      error: `Server error: ${error.message}` 
    })
  }
}
