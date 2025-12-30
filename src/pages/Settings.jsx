import { useAuthStore } from '../lib/store'
import { Settings as SettingsIcon, User, Shield, Database } from 'lucide-react'

export default function Settings() {
  const { user } = useAuthStore()
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold">Mon compte</h2>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Pour modifier vos informations de compte ou votre mot de passe, contactez l'administrateur.
          </p>
        </div>
        
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold">Sécurité</h2>
              <p className="text-sm text-gray-500">Accès sécurisé</p>
            </div>
          </div>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ Authentification par email</li>
            <li>✓ Connexion sécurisée HTTPS</li>
            <li>✓ Whitelist des utilisateurs autorisés</li>
          </ul>
        </div>
        
        <div className="card md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold">À propos</h2>
              <p className="text-sm text-gray-500">Access Formation Manager v1.0</p>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Application de gestion des formations développée par et pour Access Formation.
            Conforme aux exigences Qualiopi pour la gestion documentaire et l'émargement.
          </p>
        </div>
      </div>
    </div>
  )
}
