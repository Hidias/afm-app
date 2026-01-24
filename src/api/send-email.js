import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  // Vérifier que c'est une requête POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { to, subject, html } = req.body

    // Validation
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        error: 'Paramètres manquants (to, subject, html)' 
      })
    }

    // Vérifier que la clé API est configurée
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY non configurée')
      return res.status(500).json({ 
        error: 'Configuration serveur manquante' 
      })
    }

    // Envoi de l'email via Resend
    const { data, error } = await resend.emails.send({
      from: 'Access Formation <onboarding@resend.dev>', // Email de test Resend
      // Quand tu auras vérifié ton domaine, change par :
      // from: 'Access Formation <noreply@accessformation.pro>',
      to: [to],
      subject: subject,
      html: html
    })

    if (error) {
      console.error('Erreur Resend:', error)
      return res.status(400).json({ 
        error: error.message 
      })
    }

    return res.status(200).json({ 
      success: true, 
      data 
    })

  } catch (error) {
    console.error('Erreur serveur:', error)
    return res.status(500).json({ 
      error: error.message 
    })
  }
}
