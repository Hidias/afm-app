import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Save, Building2, Image, FileText, BookOpen, Upload, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Settings() {
  const [activeTab, setActiveTab] = useState('organization')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)
  
  const [form, setForm] = useState({
    name: 'Access Formation',
    address: '24 rue Kerbleiz',
    postal_code: '29900',
    city: 'Concarneau',
    phone: '06 30 14 54 57',
    email: 'contact@accessformation.pro',
    siret: '92443619100015',
    nda: '53290981029',
    logo_base64: '',
    stamp_base64: '',
    reglement_interieur: '',
    reglement_version: 'V1.0',
    livret_accueil: '',
    livret_version: 'V1.0',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .single()
      
      if (data) {
        setForm(prev => ({
          ...prev,
          ...data
        }))
        if (data.logo_base64) {
          setLogoPreview(data.logo_base64)
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Vérifier si un enregistrement existe
      const { data: existing } = await supabase
        .from('organization_settings')
        .select('id')
        .single()

      let result
      if (existing) {
        result = await supabase
          .from('organization_settings')
          .update({
            ...form,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
      } else {
        result = await supabase
          .from('organization_settings')
          .insert([form])
      }

      if (result.error) throw result.error
      toast.success('Paramètres sauvegardés')
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 500 * 1024) {
      toast.error('Image trop grande (max 500 KB)')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result
      setForm(prev => ({ ...prev, logo_base64: base64 }))
      setLogoPreview(base64)
      toast.success('Logo chargé')
    }
    reader.readAsDataURL(file)
  }

  const handleStampUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 500 * 1024) {
      toast.error('Image trop grande (max 500 KB)')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result
      setForm(prev => ({ ...prev, stamp_base64: base64 }))
      toast.success('Tampon/signature chargé')
    }
    reader.readAsDataURL(file)
  }

  const tabs = [
    { id: 'organization', name: 'Organisation', icon: Building2 },
    { id: 'logo', name: 'Logo & Tampon', icon: Image },
    { id: 'reglement', name: 'Règlement intérieur', icon: FileText },
    { id: 'livret', name: 'Livret d\'accueil', icon: BookOpen },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-500">Configuration de votre organisme de formation</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
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
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        
        {/* ORGANISATION */}
        {activeTab === 'organization' && (
          <div className="space-y-6">
            <h3 className="font-semibold text-lg">Informations de l'organisme</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'organisme</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SIRET</label>
                <input
                  type="text"
                  value={form.siret}
                  onChange={(e) => setForm({ ...form, siret: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° Déclaration d'activité (NDA)</label>
                <input
                  type="text"
                  value={form.nda}
                  onChange={(e) => setForm({ ...form, nda: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                <input
                  type="text"
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  maxLength={5}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* LOGO & TAMPON */}
        {activeTab === 'logo' && (
          <div className="space-y-8">
            {/* Logo */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Logo de l'organisme</h3>
              <p className="text-sm text-gray-500 mb-4">Ce logo apparaîtra sur tous les documents PDF générés.</p>
              
              <div className="flex items-start gap-6">
                <div className="w-40 h-40 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                  ) : (
                    <div className="text-center text-gray-400">
                      <Image className="w-10 h-10 mx-auto mb-2" />
                      <p className="text-xs">Aucun logo</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Téléverser un logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500">PNG ou JPG, max 500 KB</p>
                  {logoPreview && (
                    <button
                      onClick={() => {
                        setLogoPreview(null)
                        setForm(prev => ({ ...prev, logo_base64: '' }))
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tampon */}
            <div className="border-t pt-8">
              <h3 className="font-semibold text-lg mb-2">Tampon et signature</h3>
              <p className="text-sm text-gray-500 mb-4">Ce tampon apparaîtra sur les conventions, attestations et certificats.</p>
              
              <div className="flex items-start gap-6">
                <div className="w-48 h-28 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50">
                  {form.stamp_base64 ? (
                    <img src={form.stamp_base64} alt="Tampon" className="max-w-full max-h-full object-contain p-2" />
                  ) : (
                    <div className="text-center text-gray-400">
                      <FileText className="w-10 h-10 mx-auto mb-2" />
                      <p className="text-xs">Aucun tampon</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Téléverser tampon/signature
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleStampUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500">PNG ou JPG, max 500 KB</p>
                  {form.stamp_base64 && (
                    <button
                      onClick={() => setForm(prev => ({ ...prev, stamp_base64: '' }))}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REGLEMENT INTERIEUR */}
        {activeTab === 'reglement' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Règlement intérieur</h3>
                <p className="text-sm text-gray-500">Ce texte sera utilisé pour générer le PDF "Règlement Intérieur"</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">Version</label>
                <input
                  type="text"
                  value={form.reglement_version}
                  onChange={(e) => setForm({ ...form, reglement_version: e.target.value })}
                  className="w-20 px-2 py-1 border rounded text-sm"
                />
              </div>
            </div>
            
            <textarea
              className="w-full h-96 px-4 py-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500"
              value={form.reglement_interieur || ''}
              onChange={(e) => setForm({ ...form, reglement_interieur: e.target.value })}
              placeholder="Saisissez votre règlement intérieur...

ARTICLE 1 - OBJET ET CHAMP D'APPLICATION
Le présent règlement s'applique à toutes les personnes participant à une action de formation organisée par Access Formation.

ARTICLE 2 - DISCIPLINE
Les stagiaires doivent se conformer aux horaires fixés et communiqués par l'organisme de formation.

..."
            />
          </div>
        )}

        {/* LIVRET D'ACCUEIL */}
        {activeTab === 'livret' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Livret d'accueil</h3>
                <p className="text-sm text-gray-500">Ce texte sera utilisé pour générer le PDF "Livret d'Accueil"</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">Version</label>
                <input
                  type="text"
                  value={form.livret_version}
                  onChange={(e) => setForm({ ...form, livret_version: e.target.value })}
                  className="w-20 px-2 py-1 border rounded text-sm"
                />
              </div>
            </div>
            
            <textarea
              className="w-full h-96 px-4 py-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500"
              value={form.livret_accueil || ''}
              onChange={(e) => setForm({ ...form, livret_accueil: e.target.value })}
              placeholder="Saisissez votre livret d'accueil...

BIENVENUE CHEZ ACCESS FORMATION

Nous sommes heureux de vous accueillir au sein de notre organisme de formation.

QUI SOMMES-NOUS ?
Access Formation est un organisme de formation professionnelle spécialisé dans...

NOTRE ÉQUIPE
Notre équipe de formateurs expérimentés est à votre disposition...

..."
            />
          </div>
        )}
      </div>
    </div>
  )
}
