import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, FileText, Download, Trash2, ChevronDown, ChevronRight, Search } from 'lucide-react'
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

export default function CourseDocumentsList() {
  const [courses, setCourses] = useState([])
  const [documents, setDocuments] = useState({})
  const [expandedCourses, setExpandedCourses] = useState({})
  const [uploading, setUploading] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Charger toutes les formations
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, reference')
        .order('title')

      if (coursesError) throw coursesError

      // Charger tous les documents
      const { data: docsData, error: docsError } = await supabase
        .from('course_documents')
        .select('*')

      if (docsError) throw docsError

      // Organiser docs par course_id et type
      const docsMap = {}
      docsData?.forEach(doc => {
        if (!docsMap[doc.course_id]) {
          docsMap[doc.course_id] = {}
        }
        docsMap[doc.course_id][doc.type] = doc
      })

      setCourses(coursesData || [])
      setDocuments(docsMap)
    } catch (error) {
      console.error('Erreur chargement:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const toggleCourse = (courseId) => {
    setExpandedCourses(prev => ({
      ...prev,
      [courseId]: !prev[courseId]
    }))
  }

  const handleUpload = async (courseId, type, file) => {
    if (!file) return

    // Restriction PDF uniquement pour document stagiaire
    if (type === 'document_stagiaire' && file.type !== 'application/pdf') {
      toast.error('Le document stagiaire doit être un PDF')
      return
    }

    // Pour support formateur et programme : accepter PDF, PPT, Word, Excel
    if (type !== 'document_stagiaire') {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.ms-powerpoint', // PPT
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
        'application/msword', // DOC
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'application/vnd.ms-excel', // XLS
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      ]
      
      if (!allowedTypes.includes(file.type)) {
        toast.error('Format non accepté. Utilisez PDF, PowerPoint, Word ou Excel')
        return
      }
    }

    const maxSize = 200 * 1024 * 1024 // 200 MB (était 50 MB)
    if (file.size > maxSize) {
      toast.error('Fichier trop volumineux (max 200 Mo)')
      return
    }

    const uploadKey = `${courseId}-${type}`
    setUploading(prev => ({ ...prev, [uploadKey]: true }))

    try {
      // Upload Storage
      const fileName = `${courseId}/${type}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('course-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('course-documents')
        .getPublicUrl(fileName)

      // Si existe, supprimer l'ancien
      const existingDoc = documents[courseId]?.[type]
      if (existingDoc) {
        await deleteDocument(courseId, type, false)
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
      loadData()
    } catch (error) {
      console.error('Erreur upload:', error)
      toast.error('Erreur lors de l\'upload')
    } finally {
      setUploading(prev => ({ ...prev, [uploadKey]: false }))
    }
  }

  const deleteDocument = async (courseId, type, showToast = true) => {
    const doc = documents[courseId]?.[type]
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
      loadData()
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

  const filteredCourses = courses.filter(course => 
    course.title?.toLowerCase().includes(search.toLowerCase()) ||
    course.reference?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Chargement des formations...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Documents de formations</h3>
        <p className="text-sm text-gray-600">
          Gérez les ressources pédagogiques pour toutes vos formations (Qualiopi - Indicateur 19)
        </p>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher une formation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">
            {Object.keys(documents).length}
          </div>
          <div className="text-sm text-blue-800">
            Formations avec documents
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {Object.values(documents).reduce((acc, docs) => 
              acc + Object.keys(docs).length, 0
            )}
          </div>
          <div className="text-sm text-green-800">
            Documents uploadés
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-600">
            {filteredCourses.length}
          </div>
          <div className="text-sm text-gray-800">
            Formations totales
          </div>
        </div>
      </div>

      {/* Liste des formations */}
      <div className="space-y-3">
        {filteredCourses.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune formation trouvée</p>
          </div>
        ) : (
          filteredCourses.map(course => {
            const isExpanded = expandedCourses[course.id]
            const courseDocs = documents[course.id] || {}
            const docsCount = Object.keys(courseDocs).length

            return (
              <div key={course.id} className="border rounded-lg bg-white shadow-sm">
                {/* En-tête formation */}
                <button
                  onClick={() => toggleCourse(course.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{course.title}</h4>
                      {course.reference && (
                        <p className="text-sm text-gray-500">Réf: {course.reference}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {docsCount > 0 ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          {docsCount} document{docsCount > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-sm">
                          Aucun document
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Détails documents (si expanded) */}
                {isExpanded && (
                  <div className="p-4 pt-0 space-y-4 border-t">
                    {Object.entries(DOCUMENT_TYPES).map(([type, config]) => {
                      const doc = courseDocs[type]
                      const uploadKey = `${course.id}-${type}`
                      const isUploading = uploading[uploadKey]

                      return (
                        <div key={type} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{config.icon}</span>
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900 text-sm">{config.label}</h5>
                              <p className="text-xs text-gray-500">{config.description}</p>
                            </div>
                          </div>

                          {doc ? (
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center gap-2 flex-1">
                                <FileText className="w-5 h-5 text-red-600" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                                  <p className="text-xs text-gray-500">
                                    {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => downloadDocument(doc)}
                                  className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
                                >
                                  <Download className="w-3 h-3" />
                                  Télécharger
                                </button>
                                <button
                                  onClick={() => deleteDocument(course.id, type)}
                                  className="px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Supprimer
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  accept={type === 'document_stagiaire' ? 'application/pdf' : '.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx'}
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleUpload(course.id, type, file)
                                  }}
                                  disabled={isUploading}
                                />
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
                                  {isUploading ? (
                                    <>
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                                      Upload...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-3 h-3" />
                                      {type === 'document_stagiaire' ? 'Choisir un PDF' : 'Choisir un fichier'}
                                    </>
                                  )}
                                </span>
                              </label>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Note Qualiopi */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="text-blue-600">ℹ️</div>
          <div className="flex-1">
            <h5 className="font-semibold text-blue-900 mb-1">
              Conformité Qualiopi - Indicateur 19
            </h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Les documents sont tracés pour l'audit</li>
              <li>• Le "Document stagiaire" sera accessible via QR code (activation dans la session)</li>
              <li>• Les téléchargements sont enregistrés automatiquement</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
