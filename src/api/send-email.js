import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  try {
    const { to, subject, html } = await request.json()

    const { data, error } = await resend.emails.send({
      from: 'Access Formation <noreply@accessformation.pro>', // Change avec ton domaine
      to: [to],
      subject: subject,
      html: html
    })

    if (error) {
      return Response.json({ error }, { status: 400 })
    }

    return Response.json({ success: true, data })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
