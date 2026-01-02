import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { Save, Building2, Image, FileText, BookOpen, Upload, Trash2, Loader2, Check, History, Download, Database } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Settings() {
  const { 
    organization, fetchOrganization, updateOrganization,
    sessions, fetchSessions,
    courses, fetchCourses,
    clients, fetchClients,
    trainees, fetchTrainees,
    trainers, fetchTrainers,
    fetchAllEvaluations,
  } = useDataStore()
  
  const [activeTab, setActiveTab] = useState('organization')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  
  const [form, setForm] = useState({
    name: '',
    address: '',
    postal_code: '',
    city: '',
    phone: '',
    email: '',
    siret: '',
    nda: '',
    logo_base64: '',
    stamp_base64: '',
    reglement_interieur: '',
    reglement_version: 'V1.0',
    livret_accueil: '',
    livret_version: 'V1.0',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    await fetchOrganization()
    setLoading(false)
  }
  
  useEffect(() => {
    if (organization) {
      setForm({
        name: organization.name || 'Access Formation',
        address: organization.address || '',
        postal_code: organization.postal_code || '',
        city: organization.city || '',
        phone: organization.phone || '',
        email: organization.email || '',
        siret: organization.siret || '',
        nda: organization.nda || '',
        logo_base64: organization.logo_base64 || '',
        stamp_base64: organization.stamp_base64 || '',
        reglement_interieur: organization.reglement_interieur || '',
        reglement_version: organization.reglement_version || 'V1.0',
        livret_accueil: organization.livret_accueil || '',
        livret_version: organization.livret_version || 'V1.0',
      })
    }
  }, [organization])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await updateOrganization(form)
      if (error) throw error
      toast.success('Paramètres sauvegardés')
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'))
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
      toast.success('Logo chargé - Cliquez sur Sauvegarder')
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
      toast.success('Tampon chargé - Cliquez sur Sauvegarder')
    }
    reader.readAsDataURL(file)
  }

  const handleExportAll = async () => {
    setExporting(true)
    try {
      // Charger toutes les données
      await Promise.all([
        fetchSessions(),
        fetchCourses(),
        fetchClients(),
        fetchTrainees(),
        fetchTrainers(),
        fetchOrganization(),
      ])
      
      // Récupérer les évaluations
      const evaluations = await fetchAllEvaluations()
      
      // Construire l'objet d'export
      const exportData = {
        exportDate: new Date().toISOString(),
        version: 'V2.5.5',
        organization: organization,
        courses: courses,
        clients: clients,
        trainees: trainees,
        trainers: trainers,
        sessions: sessions,
        evaluations: evaluations,
      }
      
      // Créer le fichier JSON
      const json = JSON.stringify(exportData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      // Télécharger
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().split('T')[0]
      a.download = `afm-backup-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Export réussi !')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Erreur lors de l\'export')
    } finally {
      setExporting(false)
    }
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
          className="btn btn-primary"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
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
                <label className="label">Nom de l'organisme</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">SIRET</label>
                <input
                  type="text"
                  value={form.siret}
                  onChange={(e) => setForm({ ...form, siret: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">N° Déclaration d'activité (NDA)</label>
                <input
                  type="text"
                  value={form.nda}
                  onChange={(e) => setForm({ ...form, nda: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label">Adresse</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Code postal</label>
                <input
                  type="text"
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                  className="input"
                  maxLength={5}
                />
              </div>
              <div>
                <label className="label">Ville</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="input"
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
                  {form.logo_base64 ? (
                    <img src={form.logo_base64} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                  ) : (
                    <div className="text-center text-gray-400">
                      <Image className="w-10 h-10 mx-auto mb-2" />
                      <p className="text-xs">Aucun logo</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <label className="btn btn-primary cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Téléverser un logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500">PNG ou JPG, max 500 KB</p>
                  {form.logo_base64 && (
                    <button
                      onClick={() => setForm(prev => ({ ...prev, logo_base64: '' }))}
                      className="flex items-center gap-2 px-3 py-1.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm"
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
                  <label className="btn btn-secondary cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
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
                      className="flex items-center gap-2 px-3 py-1.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <strong>Important :</strong> Après avoir chargé un logo ou tampon, cliquez sur "Sauvegarder" en haut de page pour enregistrer les modifications.
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
                  className="input w-20 py-1 text-sm"
                />
              </div>
            </div>
            
            <textarea
              className="w-full h-96 px-4 py-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={form.reglement_interieur}
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
                  className="input w-20 py-1 text-sm"
                />
              </div>
            </div>
            
            <textarea
              className="w-full h-96 px-4 py-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={form.livret_accueil}
              onChange={(e) => setForm({ ...form, livret_accueil: e.target.value })}
              placeholder="Saisissez votre livret d'accueil...

BIENVENUE CHEZ ACCESS FORMATION

Nous sommes heureux de vous accueillir au sein de notre organisme de formation.

QUI SOMMES-NOUS ?
Access Formation est un organisme de formation professionnelle spécialisé dans...

..."
            />
          </div>
        )}
      </div>
      
      {/* Section Sauvegarde */}
      <div className="card bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-green-600" />
          Sauvegarde des données
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Exportez toutes vos données (formations, sessions, clients, stagiaires, formateurs, évaluations) en un clic. 
          Le fichier JSON peut être conservé sur votre disque comme sauvegarde.
        </p>
        <button
          onClick={handleExportAll}
          disabled={exporting}
          className="btn btn-primary flex items-center gap-2"
        >
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Export en cours...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Exporter toutes les données
            </>
          )}
        </button>
      </div>
      
      {/* Section À propos */}
      <div className="card bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          À propos
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-700 font-medium">AFM - Access Formation Manager</p>
            <p className="text-sm text-gray-500">Version 2.5.5</p>
          </div>
          <Link to="/versions" className="btn btn-outline btn-sm flex items-center gap-2">
            <History className="w-4 h-4" />
            Historique des versions
          </Link>
        </div>
      </div>
    </div>
  )
}
