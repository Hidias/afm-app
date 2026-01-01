import { useEffect } from 'react'
import { FileText, Download, BookOpen, ClipboardList, Shield, Zap, Truck, Users } from 'lucide-react'
import { downloadDocument, setOrganization } from '../lib/pdfGenerator'
import { useDataStore } from '../lib/store'
import toast from 'react-hot-toast'

export default function DocumentsVierges() {
  const { organization, fetchOrganization } = useDataStore()
  
  useEffect(() => {
    fetchOrganization()
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
  
  const categories = [
    {
      title: 'Documents administratifs',
      icon: FileText,
      color: 'bg-blue-500',
      docs: [
        { id: 'reglement', label: 'Règlement intérieur', qualiopi: '9' },
        { id: 'livret', label: 'Livret d\'accueil', qualiopi: '1' },
        { id: 'analyseBesoin', label: 'Analyse du besoin', qualiopi: '4' },
      ]
    },
    {
      title: 'Documents formation',
      icon: BookOpen,
      color: 'bg-green-500',
      docs: [
        { id: 'emargement', label: 'Feuille d\'émargement (10 lignes)', qualiopi: '11' },
        { id: 'evaluation', label: 'Évaluation à chaud', qualiopi: '30' },
        { id: 'evaluationFroid', label: 'Évaluation à froid', qualiopi: '30' },
        { id: 'evaluationFormateur', label: 'Évaluation formateur', qualiopi: '17' },
      ]
    },
    {
      title: 'Tests SST',
      icon: Shield,
      color: 'bg-red-500',
      docs: [
        { id: 'positionnementSST', label: 'Test de positionnement SST', qualiopi: '8' },
      ]
    },
    {
      title: 'Tests Incendie',
      icon: ClipboardList,
      color: 'bg-orange-500',
      docs: [
        { id: 'positionnementIncendie', label: 'Test Incendie / Évacuation', qualiopi: '8' },
      ]
    },
    {
      title: 'Tests Gestes & Postures',
      icon: Users,
      color: 'bg-purple-500',
      docs: [
        { id: 'positionnementGP', label: 'Test Gestes et Postures', qualiopi: '8' },
      ]
    },
    {
      title: 'Tests Électrique',
      icon: Zap,
      color: 'bg-yellow-500',
      docs: [
        { id: 'positionnementElec', label: 'Test Habilitation Électrique', qualiopi: '8' },
      ]
    },
    {
      title: 'Tests CACES',
      icon: Truck,
      color: 'bg-indigo-500',
      docs: [
        { id: 'positionnementR485', label: 'Test CACES R485 (gerbeur)', qualiopi: '8' },
        { id: 'positionnementR489', label: 'Test CACES R489 (chariot)', qualiopi: '8' },
      ]
    },
  ]
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents vierges</h1>
        <p className="text-gray-500 mt-1">Téléchargez des documents prêts à remplir pour vos formations</p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <div key={cat.title} className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className={`${cat.color} p-2 rounded-lg`}>
                <cat.icon className="w-5 h-5 text-white" />
              </div>
              <h2 className="font-semibold text-gray-900">{cat.title}</h2>
            </div>
            <div className="space-y-2">
              {cat.docs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleDownload(doc.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-700">{doc.label}</span>
                    <span className="ml-2 text-xs text-gray-400">Ind. {doc.qualiopi}</span>
                  </div>
                  <Download className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center text-xs text-gray-400 p-4 bg-gray-50 rounded-lg">
        <p className="font-medium">Application de gestion Access Formation</p>
        <p>© {new Date().getFullYear()} Access Formation - Tous droits réservés - Usage exclusif</p>
        <p>Données protégées conformément au RGPD</p>
      </div>
    </div>
  )
}
