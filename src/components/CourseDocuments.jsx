import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, FileText, Download, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

const DOCUMENT_TYPES = {
  support_formateur: {
    label: 'Support pédagogique formateur',
    icon: '📊',
    description: 'PowerPoint, PDF utilisé par le formateur (usage interne)',
  },
  document_stagiaire: {
    label: 'Document stagiaire (livret de formation)',
    icon: '📄',
    description: 'PDF mis à disposition des stagiaires via QR code',
  },
  programme: {
    label: 'Programme de formation',
    icon: '📋',
    description: 'Détail du déroulé pédagogique (usage interne)',
  }
}

export default function CourseDocuments({ courseId, courseName }) {
  const [documents, setDocuments] = useState({})
  const [uploading, setUploading] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (courseId) {
      loadDocuments()
    }
  }, [courseId])

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('course_documents')
        .select('*')
        .eq('course_id', courseId)

      if (error) throw error

      const docsMap = {}
      data?.forEach(doc => {
        docsMap[doc.type] = doc
      })
      setDocuments(docsMap)
    } catch (error) {
      console.error('Erreur chargement documents:', error)
      toast.error('Erreur lors du chargement des documents')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (type, file) => {
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés')
      return
    }

    const maxSize = 50 * 1024 * 1024 // 50 MB
    if (file.size > maxSize) {
      toast.error('Le fichier est trop volumineux (max 50 Mo)')
      return
    }

    setUploading(prev => ({ ...prev, [type]: true }))

    try {
      // Upload dans Supabase Storage
      const fileName = `${courseId}/${type}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('course-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('course-documents')
        .getPublicUrl(fileName)

      // Si document existe déjà, le supprimer
      if (documents[type]) {
        await deleteDocument(type, false)
      }

      // Sauvegarder en BDD
      const { data: userData } = await supabase.auth.getUser()
      const documentData = {
        course_id: courseId,
        type: type,
        title: file.name,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        created_by: userData?.user?.id
      }

      const { error } = await supabase
        .from('course_documents')
        .insert([documentData])

      if (error) throw error

      toast.success(`${DOCUMENT_TYPES[type].label} ajouté`)
      loadDocuments()
    } catch (error) {
      console.error('Erreur upload:', error)
      toast.error('Erreur lors de l\'upload du document')
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }))
    }
  }

  const deleteDocument = async (type, showToast = true) => {
    const doc = documents[type]
    if (!doc) return

    if (showToast && !confirm('Supprimer ce document ?')) {
      return
    }

    try {
      // Supprimer du Storage
      const fileName = doc.file_url.split('/course-documents/')[1]
      if (fileName) {
        await supabase.storage
          .from('course-documents')
          .remove([fileName])
      }

      // Supprimer de la BDD
      const { error } = await supabase
        .from('course_documents')
        .delete()
        .eq('id', doc.id)

      if (error) throw error

      if (showToast) {
        toast.success('Document supprimé')
      }
      loadDocuments()
    } catch (error) {
      console.error('Erreur suppression:', error)
      if (showToast) {
        toast.error('Erreur lors de la suppression')
      }
    }
  }

  const downloadDocument = (doc) => {
    window.open(doc.file_url, '_blank')
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB'
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(0)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Chargement des documents...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Documents de formation</h3>
        <p className="text-sm text-gray-600">
          Gérez les ressources pédagogiques pour cette formation (Qualiopi - Indicateur 19)
        </p>
      </div>

      {Object.entries(DOCUMENT_TYPES).map(([type, config]) => {
        const doc = documents[type]
        const isUploading = uploading[type]

        return (
          <div key={type} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{config.icon}</span>
                  <h4 className="font-semibold text-gray-900">{config.label}</h4>
                </div>
                <p className="text-sm text-gray-600">{config.description}</p>
              </div>
            </div>

            {doc ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="w-8 h-8 text-red-600" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{doc.file_name}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadDocument(doc)}
                      className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger
                    </button>
                    <button
                      onClick={() => deleteDocument(type)}
                      className="px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-4">
                  Aucun document uploadé
                </p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(type, file)
                    }}
                    disabled={isUploading}
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Upload en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Choisir un PDF
                      </>
                    )}
                  </span>
                </label>
              </div>
            )}
          </div>
        )
      })}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="text-blue-600">ℹ️</div>
          <div className="flex-1">
            <h5 className="font-semibold text-blue-900 mb-1">
              Conformité Qualiopi - Indicateur 19
            </h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Les documents sont tracés pour l'audit</li>
              <li>• Le "Document stagiaire" est accessible via QR code (à activer dans la session)</li>
              <li>• Les téléchargements sont enregistrés automatiquement</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
