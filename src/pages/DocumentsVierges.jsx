import { useEffect, useState } from 'react'
import { FileText, Download, BookOpen, ClipboardList, Loader2 } from 'lucide-react'
import { downloadDocument, setOrganization } from '../lib/pdfGenerator'
import { useDataStore } from '../lib/store'
import toast from 'react-hot-toast'

// Couleurs des thèmes selon leur nom
const getThemeColor = (themeName) => {
  if (!themeName) return '#6b7280' // Gris par défaut
  const name = themeName.toLowerCase()
  
  if (name.includes('secourisme') || name.includes('sst') || name.includes('psc')) {
    return '#22c55e' // Vert
  }
  if (name.includes('incendie') || name.includes('epi') || name.includes('évacuation')) {
    return '#ef4444' // Rouge
  }
  if (name.includes('électri') || name.includes('habilitation') || name.includes('hab')) {
    return '#eab308' // Jaune
  }
  if (name.includes('r489') || name.includes('r485') || name.includes('caces') || name.includes('chariot') || name.includes('nacelle')) {
    return '#1f2937' // Noir
  }
  if (name.includes('ergonomie') || name.includes('gestes') || name.includes('postures') || name.includes('prap')) {
    return '#3b82f6' // Bleu
  }
  
  return '#6b7280' // Gris par défaut
}

export default function DocumentsVierges() {
  const { organization, fetchOrganization, themes, fetchThemes, fetchThemeQuestions } = useDataStore()
  const [loadingTheme, setLoadingTheme] = useState(null)
  
  useEffect(() => {
    fetchOrganization()
    fetchThemes()
  }, [])
  
  useEffect(() => {
    if (organization) {
      setOrganization(organization)
    }
  }, [organization])
  
  const handleDownload = (docType) => {
    try {
      downloadDocument(docType, null, { isBlank: true })
      toast.success('Document téléchargé')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du téléchargement')
    }
  }
  
  const handleDownloadThemeTest = async (theme) => {
    setLoadingTheme(theme.id)
    try {
      const { data: questions } = await fetchThemeQuestions(theme.id)
      if (!questions || questions.length === 0) {
        toast.error(`Aucune question pour le thème ${theme.name}. Créez-en dans "Tests positionnement".`)
        setLoadingTheme(null)
        return
      }
      downloadDocument('positionnement', null, { isBlank: true, questions, themeName: theme.name })
      toast.success('Test téléchargé')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du téléchargement')
    }
    setLoadingTheme(null)
  }
  
  const adminDocs = [
    { id: 'reglement', label: 'Règlement intérieur', qualiopi: '9' },
    { id: 'livret', label: 'Livret d\'accueil', qualiopi: '1' },
    { id: 'analyseBesoin', label: 'Analyse du besoin', qualiopi: '4' },
  ]
  
  const formationDocs = [
    { id: 'emargement', label: 'Feuille d\'émargement (10 lignes)', qualiopi: '11' },
    { id: 'evaluation', label: 'Évaluation à chaud', qualiopi: '30' },
    { id: 'evaluationFroid', label: 'Évaluation à froid', qualiopi: '30' },
    { id: 'evaluationFormateur', label: 'Évaluation formateur', qualiopi: '17' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents vierges</h1>
        <p className="text-gray-500">Téléchargez les documents vierges pour vos formations</p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Documents administratifs */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold">Documents administratifs</h2>
          </div>
          <div className="space-y-2">
            {adminDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => handleDownload(doc.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{doc.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Q{doc.qualiopi}</span>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
        
        {/* Documents formation */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-500">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold">Documents formation</h2>
          </div>
          <div className="space-y-2">
            {formationDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => handleDownload(doc.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{doc.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Q{doc.qualiopi}</span>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
        
        {/* Tests de positionnement par thème */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold">Tests de positionnement</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Ces tests utilisent les questions que vous avez créées dans "Tests positionnement"
          </p>
          <div className="space-y-2">
            {themes.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">Chargement des thèmes...</p>
            ) : (
              themes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => handleDownloadThemeTest(theme)}
                  disabled={loadingTheme === theme.id}
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: getThemeColor(theme.name) }}
                    />
                    <span className="text-sm">Test {theme.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Q8</span>
                  </div>
                  {loadingTheme === theme.id ? (
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Indicateurs Qualiopi</h3>
        <p className="text-sm text-blue-700">
          Les badges (Q4, Q8, Q11, etc.) indiquent l'indicateur Qualiopi auquel correspond chaque document.
          Ces documents vous aident à préparer votre certification ou audit.
        </p>
      </div>
    </div>
  )
}
