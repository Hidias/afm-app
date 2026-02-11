export default async function handler(req, res) {
  const id = process.env.FT_CLIENT_ID || 'MISSING'
  const secret = process.env.FT_CLIENT_SECRET || 'MISSING'
  
  res.status(200).json({
    ft_id_start: id.substring(0, 15),
    ft_id_length: id.length,
    ft_secret_start: secret.substring(0, 10),
    ft_secret_length: secret.length,
    ft_secret_end: secret.substring(secret.length - 5),
  })
}
