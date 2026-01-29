import { createClient } from '@supabase/supabase-js'

// Valeurs en dur pour debug
const supabaseUrl = 'https://ibvtdiiwlpocibjvlgxr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlidnRkaWl3bHBvY2lianZsZ3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3OTI0MzQsImV4cCI6MjA1MDM2ODQzNH0.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlidnRkaWl3bHBvY2lianZsZ3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3OTI0MzQsImV4cCI6MjA1MDM2ODQzNH0'

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
