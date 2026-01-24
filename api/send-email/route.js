import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  try {
    const { to, subject, html } = await request.json()

    // Validation
    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants (to, subject, html)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Envoi de l'email via Resend
    const { data, error } = await resend.emails.send({
      from: 'Access Formation <noreply@accessformation.pro>', // À changer avec ton domaine vérifié
      to: [to],
      subject: subject,
      html: html
    })

    if (error) {
      console.error('Erreur Resend:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur serveur:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
