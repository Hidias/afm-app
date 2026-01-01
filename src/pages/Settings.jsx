import { useState, useEffect } from 'react'
import { useStore } from '../lib/store'
import { supabase, uploadFile, imageToBase64 } from '../lib/supabase'
import toast from 'react-hot-toast'
import {
  Building2,
  Upload,
  Save,
  Image,
  FileText,
  BookOpen,
  Trash2,
} from 'lucide-react'

// Simple rich text editor component
function RichTextEditor({ value, onChange, placeholder }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 border-b p-2 flex gap-2">
        <button
          type="button"
          onClick={() => document.execCommand('bold')}
          className="p-1.5 rounded hover:bg-gray-200 font-bold"
          title="Gras"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => document.execCommand('italic')}
          className="p-1.5 rounded hover:bg-gray-200 italic"
          title="Italique"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => document.execCommand('underline')}
          className="p-1.5 rounded hover:bg-gray-200 underline"
          title="Souligné"
        >
          U
        </button>
        <div className="w-px bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => document.execCommand('insertUnorderedList')}
          className="p-1.5 rounded hover:bg-gray-200"
          title="Liste à puces"
        >
          • Liste
        </button>
        <button
          type="button"
          onClick={() => document.execCommand('insertOrderedList')}
          className="p-1.5 rounded hover:bg-gray-200"
          title="Liste numérotée"
        >
          1. Liste
        </button>
        <div className="w-px bg-gray-300 mx-1" />
        <select
          onChange={(e) => document.execCommand('formatBlock', false, e.target.value)}
          className="p-1 rounded border text-sm"
        >
          <option value="p">Paragraphe</option>
          <option value="h1">Titre 1</option>
          <option value="h2">Titre 2</option>
          <option value="h3">Titre 3</option>
        </select>
      </div>
      <div
        contentEditable
        className="p-4 min-h-[400px] focus:outline-none prose max-w-none"
        dangerouslySetInnerHTML={{ __html: value || '' }}
        onBlur={(e) => onChange(e.target.innerHTML)}
        placeholder={placeholder}
      />
    </div>
  )
}

export default function Settings() {
  const { organization, saveOrganization, loadOrganization } = useStore()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('general')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    postal_code: '',
    city: '',
    phone: '',
    email: '',
    website: '',
    siret: '',
    nda: '',
    primary_color: '#2563eb',
    reglement_interieur: '',
    reglement_version: 'V1.0',
    livret_accueil: '',
    livret_version: 'V1.0',
  })

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        address: organization.address || '',
        postal_code: organization.postal_code || '',
        city: organization.city || '',
        phone: organization.phone || '',
        email: organization.email || '',
        website: organization.website || '',
        siret: organization.siret || '',
        nda: organization.nda || '',
        primary_color: organization.primary_color || '#2563eb',
        reglement_interieur: organization.reglement_interieur || '',
        reglement_version: organization.reglement_version || 'V1.0',
        livret_accueil: organization.livret_accueil || '',
        livret_version: organization.livret_version || 'V1.0',
      })
      setLogoPreview(organization.logo_url)
    }
  }, [organization])

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Le logo ne doit pas dépasser 2 Mo')
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      let updates = { ...formData }

      // Upload du logo si changé
      if (logoFile) {
        const fileName = `logo_${Date.now()}.${logoFile.name.split('.').pop()}`
        const logoUrl = await uploadFile('logos', fileName, logoFile)
        updates.logo_url = logoUrl
        
        // Convertir en base64 pour les PDFs
        const base64 = await imageToBase64(logoUrl)
        updates.logo_base64 = base64
      } else if (logoPreview === null && organization?.logo_url) {
        // Logo supprimé
        updates.logo_url = null
        updates.logo_base64 = null
      }

      // Mettre à jour les dates de modification si RI ou Livret modifiés
      if (formData.reglement_interieur !== organization?.reglement_interieur) {
        updates.reglement_updated_at = new Date().toISOString()
      }
      if (formData.livret_accueil !== organization?.livret_accueil) {
        updates.livret_updated_at = new Date().toISOString()
      }

      const { error } = await saveOrganization(updates)
      if (error) throw error

      toast.success('Paramètres sauvegardés')
      await loadOrganization()
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'general', name: 'Général', icon: Building2 },
    { id: 'logo', name: 'Logo', icon: Image },
    { id: 'reglement', name: 'Règlement intérieur', icon: FileText },
    { id: 'livret', name: 'Livret d\'accueil', icon: BookOpen },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-500">Configuration de votre organisme de formation</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {loading ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de l'organisme
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  N° SIRET
                </label>
                <input
                  type="text"
                  value={formData.siret}
                  onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  maxLength={14}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  N° de déclaration d'activité (NDA)
                </label>
                <input
                  type="text"
                  value={formData.nda}
                  onChange={(e) => setFormData({ ...formData, nda: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site web
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code postal
                </label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  maxLength={5}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ville
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logo' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Logo de l'organisme
              </label>
              <p className="text-sm text-gray-500 mb-4">
                Ce logo sera affiché sur tous les documents générés (conventions, attestations, certificats, etc.)
              </p>
              
              <div className="flex items-start gap-6">
                {/* Aperçu */}
                <div className="w-48 h-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center text-gray-400">
                      <Image className="h-12 w-12 mx-auto mb-2" />
                      <p className="text-sm">Aucun logo</p>
                    </div>
                  )}
                </div>
                
                {/* Actions */}
                <div className="space-y-4">
                  <div>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
                      <Upload className="h-4 w-4" />
                      Choisir un fichier
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      PNG, JPG ou SVG. Max 2 Mo.
                    </p>
                  </div>
                  
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reglement' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Règlement intérieur</h3>
                <p className="text-sm text-gray-500">
                  Modifiez le contenu de votre règlement intérieur
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-sm text-gray-500 mr-2">Version</label>
                  <input
                    type="text"
                    value={formData.reglement_version}
                    onChange={(e) => setFormData({ ...formData, reglement_version: e.target.value })}
                    className="w-20 px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
            </div>
            
            <RichTextEditor
              value={formData.reglement_interieur}
              onChange={(val) => setFormData({ ...formData, reglement_interieur: val })}
              placeholder="Rédigez votre règlement intérieur..."
            />
            
            {organization?.reglement_updated_at && (
              <p className="text-xs text-gray-400">
                Dernière modification : {new Date(organization.reglement_updated_at).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        )}

        {activeTab === 'livret' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Livret d'accueil</h3>
                <p className="text-sm text-gray-500">
                  Modifiez le contenu de votre livret d'accueil stagiaire
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-sm text-gray-500 mr-2">Version</label>
                  <input
                    type="text"
                    value={formData.livret_version}
                    onChange={(e) => setFormData({ ...formData, livret_version: e.target.value })}
                    className="w-20 px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
            </div>
            
            <RichTextEditor
              value={formData.livret_accueil}
              onChange={(val) => setFormData({ ...formData, livret_accueil: val })}
              placeholder="Rédigez votre livret d'accueil..."
            />
            
            {organization?.livret_updated_at && (
              <p className="text-xs text-gray-400">
                Dernière modification : {new Date(organization.livret_updated_at).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
