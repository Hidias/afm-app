import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// Helper pour upload de fichiers
export async function uploadFile(bucket, path, file) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true })
  
  if (error) throw error
  
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)
  
  return urlData.publicUrl
}

// Helper pour supprimer un fichier
export async function deleteFile(bucket, path) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path])
  
  if (error) throw error
}

// Helper pour convertir une image en base64
export async function imageToBase64(url) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error converting image to base64:', error)
    return null
  }
}
