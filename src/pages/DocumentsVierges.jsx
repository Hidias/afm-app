import { useState } from 'react'
import { FileText, Download, ClipboardCheck, Users, Award, Zap, Truck, Flame, Activity } from 'lucide-react'
import { downloadDocument } from '../lib/pdfGenerator'
import toast from 'react-hot-toast'

const DOCUMENT_CATEGORIES = [
  {
    name: 'Documents administratifs',
    icon: FileText,
    documents: [
      { id: 'reglement', name: 'Règlement Intérieur', description: 'Règles de fonctionnement' },
      { id: 'livret', name: 'Livret d\'Accueil', description: 'Informations pratiques' },
    ]
  },
  {
    name: 'Documents de formation',
    icon: ClipboardCheck,
    documents: [
      { id: 'emargement', name: 'Feuille d\'émargement', description: '10 lignes vierges' },
      { id: 'evaluation', name: 'Évaluation de satisfaction', description: 'À chaud' },
      { id: 'evaluationFroid', name: 'Évaluation à froid', description: 'J+30 ou J+90' },
      { id: 'analyseBesoin', name: 'Analyse du besoin', description: 'Indicateur 4 Qualiopi' },
    ]
  },
  {
    name: 'Tests SST',
    icon: Activity,
    documents: [
      { id: 'positionnementSST', name: 'Test SST', description: 'Secourisme' },
    ]
  },
  {
    name: 'Tests Incendie',
    icon: Flame,
    documents: [
      { id: 'positionnementIncendie', name: 'Test Incendie', description: 'Extincteurs / Évacuation' },
    ]
  },
  {
    name: 'Tests Gestes & Postures',
    icon: Users,
    documents: [
      { id: 'positionnementGP', name: 'Test G&P', description: 'Prévention TMS' },
    ]
  },
  {
    name: 'Tests Électrique',
    icon: Zap,
    documents: [
      { id: 'positionnementElec', name: 'Test Habilitation', description: 'B0H0V, BS, BE' },
    ]
  },
  {
    name: 'Tests CACES',
    icon: Truck,
    documents: [
      { id: 'positionnementR485', name: 'Test R485', description: 'Gerbeurs' },
      { id: 'positionnementR489', name: 'Test R489', description: 'Chariots' },
    ]
  },
]

export default function DocumentsVierges() {
  const [downloading, setDownloading] = useState(null)

  const handleDownload = async (docId, docName) => {
    setDownloading(docId)
    try {
      const fakeSession = {
        reference: 'VIERGE',
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        location: '________________________',
        courses: { title: '________________________', duration_hours: '___', objectives: '' },
        clients: { name: '________________________' }
      }
      const fakeTrainee = { first_name: '____________', last_name: '____________' }
      const fakeTrainer = { first_name: '____________', last_name: '____________' }
      const fakeTrainees = Array(10).fill(null).map(() => ({ first_name: '', last_name: '' }))
      
      downloadDocument(docId, fakeSession, {
        trainee: fakeTrainee,
        trainer: fakeTrainer,
        trainees: fakeTrainees,
        client: fakeSession.clients,
        content: '',
      })
      toast.success(`${docName} téléchargé`)
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors du téléchargement')
    }
    setDownloading(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents vierges</h1>
        <p className="text-gray-500 mt-1">Téléchargez des documents vierges pour vos formations</p>
      </div>

      <div className="grid gap-6">
        {DOCUMENT_CATEGORIES.map((category) => (
          <div key={category.name} className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <category.icon className="w-5 h-5 text-primary-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{category.name}</h2>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {category.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-sm text-gray-500 truncate">{doc.description}</p>
                  </div>
                  <button onClick={() => handleDownload(doc.id, doc.name)} disabled={downloading === doc.id} className="ml-4 p-2 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors disabled:opacity-50">
                    {downloading === doc.id ? (<div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />) : (<Download className="w-5 h-5" />)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-gray-400 mt-8 p-4 bg-gray-50 rounded-lg">
        <p className="font-medium">Application de gestion Access Formation</p>
        <p>© {new Date().getFullYear()} Access Formation - Tous droits réservés</p>
        <p>Usage exclusif - Données protégées conformément au RGPD</p>
      </div>
    </div>
  )
}
