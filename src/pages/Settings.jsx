import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { Save, User, Building2, Lock, LogOut, History, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState('profile')
  
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
          
          {activeTab === 'organization' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Informations de l'organisation</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Nom de l'organisme</label>
                  <input type="text" className="input" defaultValue="Access Formation" />
                </div>
                <div>
                  <label className="label">SIRET</label>
                  <input type="text" className="input" defaultValue="943 563 866 00012" />
                </div>
                <div>
                  <label className="label">Numéro de déclaration d'activité</label>
                  <input type="text" className="input" defaultValue="53 29 10261 29" />
                </div>
                <div>
                  <label className="label">Adresse</label>
                  <textarea className="input" rows={2} defaultValue="24 rue Kerbleiz, 29900 Concarneau" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Téléphone</label>
                    <input type="tel" className="input" defaultValue="02 46 56 57 54" />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" defaultValue="contact@accessformation.pro" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 bg-yellow-50 p-3 rounded-lg">
                  ⚠️ Ces informations sont affichées sur les documents générés. La modification nécessite une mise à jour du code source.
                </p>
              </div>
            </div>
          )}
          
          {activeTab === 'security' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Sécurité</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Mot de passe actuel</label>
                  <input type="password" className="input" placeholder="••••••••" />
                </div>
                <div>
                  <label className="label">Nouveau mot de passe</label>
                  <input type="password" className="input" placeholder="••••••••" />
                </div>
                <div>
                  <label className="label">Confirmer le mot de passe</label>
                  <input type="password" className="input" placeholder="••••••••" />
                </div>
                <button className="btn btn-primary">
                  <Save className="w-4 h-4 mr-2" />Modifier le mot de passe
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
