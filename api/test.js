// API de test pour vérifier que les Serverless Functions fonctionnent
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  return res.status(200).json({
    status: 'OK',
    message: 'API fonctionne correctement !',
    method: req.method,
    hasResendKey: !!process.env.RESEND_API_KEY,
    timestamp: new Date().toISOString(),
    body: req.body
  })
}
