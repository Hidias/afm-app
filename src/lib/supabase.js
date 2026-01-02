import { createClient } from '@supabase/supabase-js'

// Ces valeurs seront remplacées par vos vraies clés Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://votre-projet.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'votre-clé-anon'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Liste des emails autorisés à se connecter
export const ALLOWED_EMAILS = [
  'hicham.saidi@accessformation.pro',
  'maxime.langlais@accessformation.pro',
  'contact@accessformation.pro',
]

// Vérifier si un email est autorisé
export const isEmailAllowed = (email) => {
  return ALLOWED_EMAILS.includes(email?.toLowerCase())
}
