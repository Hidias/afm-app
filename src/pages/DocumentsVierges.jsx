import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import toast from 'react-hot-toast'
import { FileText, Download, Loader2, Book, Shield } from 'lucide-react'
import { generateBlankDocument } from '../lib/pdfGenerator'

export default function DocumentsVierges() {
  const { organization } = useStore()
  const [generating, setGenerating] = useState(null)

  const documents = [
    {
      id: 'reglement_interieur',
      title: 'Règlement Intérieur',
      description: 'Document obligatoire Qualiopi définissant les règles de fonctionnement',
      icon: Shield,
      color: 'blue',
      content: organization?.reglement_interieur,
      version: organization?.ri_version || 'V1.0',
      lastModified: organization?.ri_updated_at
    },
    {
      id: 'livret_accueil',
      title: "Livret d'Accueil",
      description: 'Document remis aux stagiaires pour présenter l\'organisme',
      icon: Book,
      color: 'green',
      content: organization?.livret_accueil,
      version: organization?.la_version || 'V1.0',
      lastModified: organization?.la_updated_at
    }
  ]

  const handleGenerate = async (docType) => {
    const doc = documents.find(d => d.id === docType)
    if (!doc?.content) {
      toast.error('Le contenu du document n\'est pas défini. Rendez-vous dans Paramètres pour le configurer.')
      return
    }

    setGenerating(docType)
    try {
      await generateBlankDocument(docType, {
        content: doc.content,
        version: doc.version,
        logoBase64: organization?.logo_base64
      })
      toast.success('Document généré avec succès')
    } catch (error) {
      toast.error('Erreur lors de la génération')
      console.error(error)
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents Vierges</h1>
        <p className="text-gray-500">Générez les documents institutionnels de votre organisme</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {documents.map((doc) => {
          const Icon = doc.icon
          const hasContent = Boolean(doc.content)
          
          return (
            <div 
              key={doc.id}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 bg-${doc.color}-100 rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-6 w-6 text-${doc.color}-600`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{doc.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{doc.description}</p>
                  
                  {hasContent ? (
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                        {doc.version}
                      </span>
                      {doc.lastModified && (
                        <span className="text-gray-500">
                          Modifié le {new Date(doc.lastModified).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 px-3 py-2 bg-yellow-50 border border-yellow-100 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        ⚠️ Contenu non défini. 
                        <Link to="/parametres" className="underline ml-1">Configurer dans Paramètres</Link>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Format : PDF
                </div>
                <button
                  onClick={() => handleGenerate(doc.id)}
                  disabled={!hasContent || generating === doc.id}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    hasContent
                      ? 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {generating === doc.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Télécharger PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Autres documents */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Autres documents</h2>
        <p className="text-gray-500 mb-4">
          Les documents liés aux sessions (convention, programme, convocation, attestation, etc.) 
          sont générés depuis la page de détail de chaque session.
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { code: 'AF-CONV', name: 'Convention' },
            { code: 'AF-PROG', name: 'Programme' },
            { code: 'AF-CONVOC', name: 'Convocation' },
            { code: 'AF-EMARG', name: 'Émargement' },
            { code: 'AF-ATTP', name: 'Attestation' },
            { code: 'AF-CERT', name: 'Certificat' },
            { code: 'AF-EVAL', name: 'Éval. à chaud' },
            { code: 'AF-EVALF', name: 'Éval. à froid' }
          ].map(doc => (
            <div key={doc.code} className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">{doc.code}</div>
              <div className="text-sm font-medium text-gray-900">{doc.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Qualiopi */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Conformité Qualiopi</h3>
            <p className="text-sm text-blue-700 mt-1">
              Le Règlement Intérieur et le Livret d'Accueil sont des documents obligatoires 
              dans le cadre de la certification Qualiopi. Assurez-vous qu'ils sont à jour 
              et disponibles pour chaque session de formation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
