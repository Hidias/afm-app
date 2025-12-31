import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { downloadDocument } from '../lib/pdfGenerator'
import { 
  Settings as SettingsIcon, Save, FileText, Download, 
  BookOpen, Shield, RefreshCw, Check
} from 'lucide-react'
import toast from 'react-hot-toast'

const documentTypes = [
  { 
    code: 'reglement_interieur', 
    title: 'Règlement Intérieur',
    icon: Shield,
    description: 'Document obligatoire pour tout organisme de formation'
  },
  { 
    code: 'livret_accueil', 
    title: "Livret d'Accueil",
    icon: BookOpen,
    description: 'Document remis aux stagiaires avant la formation'
  },
]

export default function Settings() {
  const { 
    documentTemplates, fetchDocumentTemplates, 
    getDocumentTemplate, updateDocumentTemplate,
    orgSettings, fetchOrgSettings, updateOrgSettings
  } = useDataStore()
  
  const [activeTab, setActiveTab] = useState('documents')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  
  useEffect(() => {
    fetchDocumentTemplates()
    fetchOrgSettings()
  }, [])
  
  const handleSelectDoc = async (docType) => {
    setSelectedDoc(docType)
    
    // Chercher dans les templates chargés
    const template = documentTemplates.find(t => t.code === docType.code)
    if (template) {
      setEditContent(template.content || '')
      setEditTitle(template.title || docType.title)
    } else {
      // Charger depuis la base
      const { data } = await getDocumentTemplate(docType.code)
      if (data) {
        setEditContent(data.content || '')
        setEditTitle(data.title || docType.title)
      } else {
        setEditContent('')
        setEditTitle(docType.title)
      }
    }
  }
  
  const handleSave = async () => {
    if (!selectedDoc) return
    
    setSaving(true)
    
    const { error } = await updateDocumentTemplate(selectedDoc.code, {
      title: editTitle,
      content: editContent,
      version: 'V2.0'
    })
    
    setSaving(false)
    
    if (error) {
      toast.error('Erreur lors de la sauvegarde')
    } else {
      toast.success('Document sauvegardé')
    }
  }
  
  const handleGeneratePDF = () => {
    if (!selectedDoc || !editContent) return
    
    setGenerating(true)
    
    try {
      if (selectedDoc.code === 'reglement_interieur') {
        downloadDocument('reglement', null, { content: editContent })
      } else if (selectedDoc.code === 'livret_accueil') {
        downloadDocument('livret', null, { content: editContent })
      }
      toast.success('PDF généré')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          Paramètres
        </h1>
        <p className="text-gray-500 mt-1">Gérez vos documents types et paramètres</p>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Documents types
          </button>
          <button
            onClick={() => setActiveTab('organisme')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'organisme'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Organisme
          </button>
        </nav>
      </div>
      
      {/* Tab Documents */}
      {activeTab === 'documents' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Liste des documents */}
          <div className="lg:col-span-1">
            <div className="card">
              <h3 className="font-semibold mb-4">Documents types</h3>
              <div className="space-y-2">
                {documentTypes.map(docType => (
                  <button
                    key={docType.code}
                    onClick={() => handleSelectDoc(docType)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedDoc?.code === docType.code
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <docType.icon className={`w-5 h-5 ${
                        selectedDoc?.code === docType.code ? 'text-primary-600' : 'text-gray-400'
                      }`} />
                      <div>
                        <p className="font-medium text-sm">{docType.title}</p>
                        <p className="text-xs text-gray-500">{docType.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Éditeur */}
          <div className="lg:col-span-2">
            {selectedDoc ? (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                    placeholder="Titre du document"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleGeneratePDF}
                      disabled={generating || !editContent}
                      className="btn btn-secondary flex items-center gap-2"
                    >
                      {generating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Aperçu PDF
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      {saving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Enregistrer
                    </button>
                  </div>
                </div>
                
                <p className="text-sm text-gray-500 mb-4">
                  Utilisez les balises HTML pour la mise en forme : 
                  <code className="bg-gray-100 px-1 rounded">&lt;h2&gt;</code> pour les titres, 
                  <code className="bg-gray-100 px-1 rounded">&lt;p&gt;</code> pour les paragraphes, 
                  <code className="bg-gray-100 px-1 rounded">&lt;ul&gt;&lt;li&gt;</code> pour les listes
                </p>
                
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-[500px] p-4 border border-gray-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Contenu HTML du document..."
                />
                
                <p className="text-xs text-gray-400 mt-2">
                  Code version : AF-{selectedDoc.code === 'reglement_interieur' ? 'RI' : 'LIVRET'}-V2.0
                </p>
              </div>
            ) : (
              <div className="card text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Sélectionnez un document à modifier</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Tab Organisme */}
      {activeTab === 'organisme' && (
        <div className="card max-w-2xl">
          <h3 className="font-semibold mb-4">Informations de l'organisme</h3>
          <p className="text-sm text-gray-500 mb-6">
            Ces informations sont utilisées dans tous les documents générés.
            Pour les modifier, contactez le développeur.
          </p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nom</label>
                <input type="text" value="SARL Access Formation" disabled className="input bg-gray-50" />
              </div>
              <div>
                <label className="label">Dirigeant</label>
                <input type="text" value="Hicham SAIDI" disabled className="input bg-gray-50" />
              </div>
            </div>
            
            <div>
              <label className="label">Adresse</label>
              <input type="text" value="24 rue Kerbleiz, 29900 Concarneau" disabled className="input bg-gray-50" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Téléphone</label>
                <input type="text" value="02 46 56 57 54" disabled className="input bg-gray-50" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="text" value="contact@accessformation.pro" disabled className="input bg-gray-50" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">SIRET</label>
                <input type="text" value="943 563 866 00012" disabled className="input bg-gray-50" />
              </div>
              <div>
                <label className="label">N° Déclaration d'activité</label>
                <input type="text" value="53 29 10261 29" disabled className="input bg-gray-50" />
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                <Check className="w-4 h-4 inline text-green-500 mr-1" />
                Version de l'application : <strong>V2.0</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
