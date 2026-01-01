import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Save, User, Building2, Lock, LogOut, History, ExternalLink, Upload, FileText, Image, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Organisation data
  const [org, setOrg] = useState({
    name: '',
    address: '',
    postal_code: '',
    city: '',
    phone: '',
    email: '',
    siret: '',
    nda: '',
    logo_url: '',
    logo_base64: '',
    stamp_url: '',
    stamp_base64: '',
    reglement_interieur: '',
    livret_accueil: ''
  })
  
  useEffect(() => {
    loadOrganization()
  }, [])
  
  const loadOrganization = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      if (data) setOrg(data)
    } catch (error) {
      console.error('Error loading organization:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleSaveOrg = async () => {
    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('organization_settings')
        .select('id')
        .single()
      
      if (existing) {
        const { error } = await supabase
          .from('organization_settings')
          .update({
            name: org.name,
            address: org.address,
            postal_code: org.postal_code,
            city: org.city,
            phone: org.phone,
            email: org.email,
            siret: org.siret,
            nda: org.nda,
            logo_url: org.logo_url,
            logo_base64: org.logo_base64,
            stamp_url: org.stamp_url,
            stamp_base64: org.stamp_base64,
            reglement_interieur: org.reglement_interieur,
            livret_accueil: org.livret_accueil,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('organization_settings')
          .insert([org])
        
        if (error) throw error
      }
      
      toast.success('Paramètres sauvegardés')
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }
  
  const handleImageUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Vérifier la taille (max 500KB)
    if (file.size > 500 * 1024) {
      toast.error('Image trop grande (max 500KB)')
      return
    }
    
    // Convertir en base64
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result
      if (type === 'logo') {
        setOrg(prev => ({ ...prev, logo_base64: base64 }))
      } else {
        setOrg(prev => ({ ...prev, stamp_base64: base64 }))
      }
      toast.success(`${type === 'logo' ? 'Logo' : 'Tampon'} chargé`)
    }
    reader.readAsDataURL(file)
  }
  
  const handleLogout = async () => {
    if (!confirm('Voulez-vous vous déconnecter ?')) return
    await logout()
    toast.success('Déconnexion réussie')
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500">Configuration de votre compte et de l'application</p>
      </div>
      
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Menu latéral */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left ${activeTab === 'profile' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}>
              <User className="w-5 h-5" />
              <span>Profil</span>
            </button>
            <button onClick={() => setActiveTab('organization')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left ${activeTab === 'organization' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}>
              <Building2 className="w-5 h-5" />
              <span>Organisation</span>
            </button>
            <button onClick={() => setActiveTab('images')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left ${activeTab === 'images' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}>
              <Image className="w-5 h-5" />
              <span>Logo & Tampon</span>
            </button>
            <button onClick={() => setActiveTab('documents')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left ${activeTab === 'documents' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}>
              <FileText className="w-5 h-5" />
              <span>RI & Livret</span>
            </button>
            <button onClick={() => setActiveTab('security')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left ${activeTab === 'security' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}>
              <Lock className="w-5 h-5" />
              <span>Sécurité</span>
            </button>
            
            <div className="pt-4 mt-4 border-t">
              <Link to="/changelog" className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-gray-50">
                <History className="w-5 h-5" />
                <span>Historique des versions</span>
                <ExternalLink className="w-4 h-4 ml-auto text-gray-400" />
              </Link>
            </div>
            
            <div className="pt-4 mt-4 border-t">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-red-600 hover:bg-red-50">
                <LogOut className="w-5 h-5" />
                <span>Déconnexion</span>
              </button>
            </div>
          </nav>
        </div>
        
        {/* Contenu */}
        <div className="lg:col-span-3">
          {/* PROFIL */}
          {activeTab === 'profile' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Informations du profil</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={user?.email || ''} disabled />
                  <p className="text-xs text-gray-500 mt-1">L'email ne peut pas être modifié</p>
                </div>
                <div>
                  <label className="label">Rôle</label>
                  <input type="text" className="input" value="Administrateur" disabled />
                </div>
              </div>
            </div>
          )}
          
          {/* ORGANISATION */}
          {activeTab === 'organization' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Informations de l'organisation</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Nom de l'organisme</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={org.name}
                    onChange={(e) => setOrg(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="label">Adresse</label>
                    <input 
                      type="text" 
                      className="input" 
                      value={org.address}
                      onChange={(e) => setOrg(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Code postal</label>
                    <input 
                      type="text" 
                      className="input" 
                      value={org.postal_code}
                      onChange={(e) => setOrg(prev => ({ ...prev, postal_code: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Ville</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={org.city}
                    onChange={(e) => setOrg(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Téléphone</label>
                    <input 
                      type="tel" 
                      className="input" 
                      value={org.phone}
                      onChange={(e) => setOrg(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input 
                      type="email" 
                      className="input" 
                      value={org.email}
                      onChange={(e) => setOrg(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">SIRET</label>
                    <input 
                      type="text" 
                      className="input" 
                      value={org.siret}
                      onChange={(e) => setOrg(prev => ({ ...prev, siret: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">N° Déclaration d'activité (NDA)</label>
                    <input 
                      type="text" 
                      className="input" 
                      value={org.nda}
                      onChange={(e) => setOrg(prev => ({ ...prev, nda: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    onClick={handleSaveOrg}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* LOGO & TAMPON */}
          {activeTab === 'images' && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Logo de l'organisme</h2>
                <p className="text-sm text-gray-500 mb-4">Ce logo apparaîtra sur tous les documents PDF générés.</p>
                
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    {org.logo_base64 ? (
                      <img src={org.logo_base64} alt="Logo" className="w-32 h-32 object-contain border rounded-lg" />
                    ) : (
                      <div className="w-32 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                        <Image className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Téléverser un logo
                      <input 
                        type="file" 
                        accept="image/png,image/jpeg"
                        onChange={(e) => handleImageUpload(e, 'logo')}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-2">PNG ou JPG, max 500 KB</p>
                    {org.logo_base64 && (
                      <button 
                        onClick={() => setOrg(prev => ({ ...prev, logo_base64: '' }))}
                        className="text-red-600 text-sm mt-2 hover:underline"
                      >
                        Supprimer le logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Tampon et signature</h2>
                <p className="text-sm text-gray-500 mb-4">Ce tampon apparaîtra sur les conventions, attestations et certificats.</p>
                
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    {org.stamp_base64 ? (
                      <img src={org.stamp_base64} alt="Tampon" className="w-40 h-24 object-contain border rounded-lg" />
                    ) : (
                      <div className="w-40 h-24 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                        <FileText className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Téléverser tampon/signature
                      <input 
                        type="file" 
                        accept="image/png,image/jpeg"
                        onChange={(e) => handleImageUpload(e, 'stamp')}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-2">PNG ou JPG, max 500 KB</p>
                    {org.stamp_base64 && (
                      <button 
                        onClick={() => setOrg(prev => ({ ...prev, stamp_base64: '' }))}
                        className="text-red-600 text-sm mt-2 hover:underline"
                      >
                        Supprimer le tampon
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button 
                  onClick={handleSaveOrg}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer les images
                </button>
              </div>
            </div>
          )}
          
          {/* RI & LIVRET */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Règlement Intérieur</h2>
                <p className="text-sm text-gray-500 mb-4">Ce texte sera utilisé pour générer le document "Règlement Intérieur" dans Documents Vierges.</p>
                <textarea
                  className="input min-h-[300px] font-mono text-sm"
                  value={org.reglement_interieur || ''}
                  onChange={(e) => setOrg(prev => ({ ...prev, reglement_interieur: e.target.value }))}
                  placeholder="Saisissez votre règlement intérieur..."
                />
              </div>
              
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Livret d'Accueil</h2>
                <p className="text-sm text-gray-500 mb-4">Ce texte sera utilisé pour générer le document "Livret d'Accueil" dans Documents Vierges.</p>
                <textarea
                  className="input min-h-[300px] font-mono text-sm"
                  value={org.livret_accueil || ''}
                  onChange={(e) => setOrg(prev => ({ ...prev, livret_accueil: e.target.value }))}
                  placeholder="Saisissez votre livret d'accueil..."
                />
              </div>
              
              <div className="flex justify-end">
                <button 
                  onClick={handleSaveOrg}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer les documents
                </button>
              </div>
            </div>
          )}
          
          {/* SECURITE */}
          {activeTab === 'security' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Sécurité</h2>
              <div className="space-y-4">
                <p className="text-gray-600">Pour changer votre mot de passe, utilisez la fonction "Mot de passe oublié" sur la page de connexion.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
