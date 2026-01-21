import { useState } from 'react'
import { Upload, X, Check, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function TrainerSignatureUpload({ trainer, onUpdate }) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(trainer?.signature_url || null)

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image (PNG, JPG)')
      return
    }

    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image est trop volumineuse (max 2 MB)')
      return
    }

    setUploading(true)

    try {
      // Supprimer l'ancienne signature si elle existe
      if (trainer.signature_url) {
        const oldPath = trainer.signature_url.split('/').pop()
        await supabase.storage
          .from('trainer-signatures')
          .remove([`${trainer.id}/${oldPath}`])
      }

      // Upload la nouvelle signature
      const fileExt = file.name.split('.').pop()
      const fileName = `signature_${Date.now()}.${fileExt}`
      const filePath = `${trainer.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('trainer-signatures')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Récupérer l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('trainer-signatures')
        .getPublicUrl(filePath)

      // Mettre à jour la base de données
      const { error: updateError } = await supabase
        .from('trainers')
        .update({ signature_url: publicUrl })
        .eq('id', trainer.id)

      if (updateError) throw updateError

      setPreviewUrl(publicUrl)
      toast.success('Signature enregistrée avec succès')
      
      if (onUpdate) onUpdate({ ...trainer, signature_url: publicUrl })
    } catch (error) {
      console.error('Erreur upload signature:', error)
      toast.error('Erreur lors de l\'enregistrement de la signature')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!trainer.signature_url) return

    if (!confirm('Êtes-vous sûr de vouloir supprimer cette signature ?')) return

    setUploading(true)

    try {
      // Supprimer du storage
      const oldPath = trainer.signature_url.split('/').pop()
      await supabase.storage
        .from('trainer-signatures')
        .remove([`${trainer.id}/${oldPath}`])

      // Mettre à jour la BDD
      const { error } = await supabase
        .from('trainers')
        .update({ signature_url: null })
        .eq('id', trainer.id)

      if (error) throw error

      setPreviewUrl(null)
      toast.success('Signature supprimée')
      
      if (onUpdate) onUpdate({ ...trainer, signature_url: null })
    } catch (error) {
      console.error('Erreur suppression signature:', error)
      toast.error('Erreur lors de la suppression')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Signature du formateur
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Cette signature sera utilisée sur les certificats de formation SST. Format PNG ou JPG recommandé.
        </p>
      </div>

      {/* Preview de la signature */}
      {previewUrl && (
        <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Signature actuelle</span>
            <button
              onClick={handleDelete}
              disabled={uploading}
              className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          </div>
          <div className="flex items-center justify-center bg-gray-50 rounded p-4">
            <img 
              src={previewUrl} 
              alt="Signature" 
              className="max-h-24 object-contain"
            />
          </div>
        </div>
      )}

      {/* Upload */}
      <div>
        <label 
          htmlFor="signature-upload"
          className={`
            flex flex-col items-center justify-center w-full h-32 
            border-2 border-dashed rounded-lg cursor-pointer
            transition-colors
            ${uploading 
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
              : 'border-gray-300 hover:border-blue-500 bg-gray-50 hover:bg-blue-50'
            }
          `}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                <p className="text-sm text-gray-600">Envoi en cours...</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-blue-600">Cliquez pour uploader</span> ou glissez-déposez
                </p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG (max. 2MB)</p>
              </>
            )}
          </div>
          <input 
            id="signature-upload"
            type="file" 
            className="hidden" 
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Conseils */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>💡 Conseils :</strong> Pour un meilleur rendu, utilisez une signature sur fond blanc transparent (PNG) 
          ou fond blanc uni. Dimensions recommandées : 400x150 pixels.
        </p>
      </div>
    </div>
  )
}
