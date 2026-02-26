import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Save, Building2, Image, FileText, BookOpen, Upload, Trash2, Loader2, Check, History, Download, Database, Users, LogOut, ExternalLink, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import AuditLogs from './AuditLogs'

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
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  
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
      // Nettoyer le SIRET et NDA (supprimer les espaces pour éviter erreur varchar)
      const cleanedForm = {
        ...form,
        siret: form.siret?.replace(/\s/g, '') || '',
        nda: form.nda?.replace(/\s/g, '') || '',
      }
      const { error } = await updateOrganization(cleanedForm)
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
      toast.loading('Chargement des données...', { id: 'export' })
      
      // Liste complète des tables à exporter (ordre : parents d'abord)
      const tableNames = [
        // Paramètres organisme
        'organization_settings', 'org_settings', 'document_templates', 'app_versions',
        // Formations & catalogue
        'courses', 'course_documents', 'course_document_downloads', 'course_equipment', 'course_questions',
        'equipment_catalog',
        // Clients
        'clients', 'client_contacts', 'client_interactions',
        // Stagiaires
        'trainees', 'trainee_info_sheets', 'trainee_documents',
        // Formateurs
        'trainers', 'trainer_certificates', 'trainer_qualifications', 'trainer_interviews', 'trainer_trainings',
        // Sessions
        'sessions', 'session_trainees', 'session_equipment', 'session_costs', 'session_checklists',
        'session_needs_analysis', 'session_qualiopi', 'session_documents', 'session_document_access',
        'session_fundings',
        // Présences & évaluations
        'attendances', 'attendance_halfdays',
        'trainee_objectives', 'trainee_evaluations', 'trainer_evaluations', 'evaluations', 'evaluations_cold',
        'sst_certifications',
        // Devis & factures
        'quotes', 'quote_items',
        'invoices', 'invoice_items', 'invoice_payments',
        // Qualité & conformité
        'non_conformites', 'reclamations',
        'quality_documents', 'quality_alerts', 'qualiopi_documents',
        'veille_qualiopi', 'veille_sources', 'audits_internes',
        // Processus
        'processes', 'process_steps', 'process_connections', 'process_responsibles', 'process_versions',
        // Thèmes & tests
        'themes', 'theme_questions', 'training_themes',
        'positioning_tests', 'positioning_answers', 'positioning_questions_ref',
        // PSH
        'psh_requests',
        // Prospection
        'prospect_rdv', 'prospect_calls', 'prospect_needs_analysis', 'prospect_email_logs',
        'prospection_massive', 'prospection_groupes_siren',
        // DUERP
        'duerp_projects', 'duerp_units', 'duerp_risks', 'duerp_actions',
        'duerp_risk_categories', 'duerp_risk_templates', 'duerp_sector_templates',
        'duerp_equipements', 'duerp_habilitations', 'duerp_formations_reglementaires',
        'duerp_verifications',
        // Documents & signatures
        'documents', 'document_signatures', 'uploaded_documents',
        // Divers
        'notifications', 'audit_logs', 'user_email_configs',
        'dashboard_widget_configs', 'bpf_declarations', 'call_logs',
      ]
      
      // Charger toutes les tables en parallèle
      const results = await Promise.all(
        tableNames.map(table => 
          supabase.from(table).select('*').then(({ data, error }) => ({
            table,
            data: data || [],
            error
          }))
        )
      )
      
      // Construire l'objet d'export
      const exportData = {
        _metadata: {
          exportDate: new Date().toISOString(),
          version: 'V2.8.0',
          description: 'Export complet Access Campus - Toutes les données',
          tables: {},
        },
      }
      
      let totalRecords = 0
      const failedTables = []
      
      results.forEach(({ table, data, error }) => {
        if (error) {
          // Table n'existe peut-être pas encore, on skip silencieusement
          failedTables.push(table)
        } else {
          exportData[table] = data
          exportData._metadata.tables[table] = data.length
          totalRecords += data.length
        }
      })
      
      exportData._metadata.totalRecords = totalRecords
      exportData._metadata.exportedTables = Object.keys(exportData._metadata.tables).length
      if (failedTables.length > 0) {
        exportData._metadata.skippedTables = failedTables
      }
      
      // Créer le fichier JSON
      const json = JSON.stringify(exportData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().split('T')[0]
      const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-')
      a.download = `access-campus-backup-${date}_${time}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      const sizeMB = (json.length / 1024 / 1024).toFixed(1)
      toast.success(`Export réussi ! ${totalRecords} enregistrements dans ${exportData._metadata.exportedTables} tables (${sizeMB} MB)`, { id: 'export', duration: 5000 })
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Erreur lors de l\'export: ' + (error.message || 'Erreur inconnue'), { id: 'export' })
    } finally {
      setExporting(false)
    }
  }

  // ======== IMPORT / RESTAURATION ========
  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)
        
        if (!data._metadata || !data._metadata.exportDate) {
          toast.error('Fichier invalide : ce n\'est pas une sauvegarde Access Campus')
          return
        }
        
        // Compter les enregistrements par table
        const tables = {}
        let total = 0
        Object.entries(data).forEach(([key, value]) => {
          if (key !== '_metadata' && Array.isArray(value) && value.length > 0) {
            tables[key] = value.length
            total += value.length
          }
        })
        
        setImportPreview({
          data,
          fileName: file.name,
          exportDate: data._metadata.exportDate,
          version: data._metadata.version || 'Inconnue',
          tables,
          totalRecords: total,
          tableCount: Object.keys(tables).length,
        })
      } catch (err) {
        toast.error('Fichier JSON invalide')
      }
    }
    reader.readAsText(file)
    // Reset input pour pouvoir re-sélectionner le même fichier
    e.target.value = ''
  }

  const handleImportConfirm = async () => {
    if (!importPreview?.data) return
    
    setImporting(true)
    const data = importPreview.data
    
    // Ordre d'insertion : parents d'abord, enfants ensuite (clés étrangères)
    const insertionOrder = [
      'organization_settings',
      'equipment_catalog',
      'courses', 'course_documents', 'course_equipment', 'course_questions',
      'clients', 'client_contacts', 'client_interactions',
      'trainees', 'trainee_info_sheets', 'trainee_documents',
      'trainers', 'trainer_certificates', 'trainer_qualifications', 'trainer_interviews', 'trainer_trainings',
      'themes', 'theme_questions', 'training_themes',
      'sessions', 'session_trainees', 'session_equipment', 'session_costs', 'session_checklists',
      'session_needs_analysis', 'session_qualiopi', 'session_documents', 'session_document_access',
      'attendances', 'attendance_halfdays',
      'trainee_objectives', 'trainee_evaluations', 'trainer_evaluations', 'evaluations_cold',
      'sst_certifications',
      'quotes', 'quote_items',
      'non_conformites', 'reclamations',
      'quality_documents', 'quality_alerts', 'qualiopi_documents',
      'veille_qualiopi', 'veille_sources',
      'processes', 'process_steps', 'process_connections', 'process_responsibles', 'process_versions',
      'positioning_tests', 'positioning_answers',
      'psh_requests',
      'prospect_rdv', 'prospect_calls', 'prospect_needs_analysis',
      'notifications', 'audit_logs',
      'user_email_configs',
    ]
    
    let imported = 0
    let errors = 0
    const errorDetails = []
    
    toast.loading('Import en cours...', { id: 'import' })
    
    for (const table of insertionOrder) {
      const rows = data[table]
      if (!Array.isArray(rows) || rows.length === 0) continue
      
      try {
        // Upsert par lots de 500 pour éviter les timeouts
        const batchSize = 500
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize)
          const { error } = await supabase
            .from(table)
            .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
          
          if (error) throw error
        }
        imported += rows.length
        toast.loading(`Import en cours... ${imported} enregistrements`, { id: 'import' })
      } catch (err) {
        console.error(`Import error on ${table}:`, err)
        errors++
        errorDetails.push(`${table}: ${err.message}`)
      }
    }
    
    setImporting(false)
    setImportPreview(null)
    
    if (errors === 0) {
      toast.success(`Import terminé ! ${imported} enregistrements restaurés`, { id: 'import', duration: 5000 })
    } else {
      toast.success(`Import partiel : ${imported} enregistrements OK, ${errors} tables en erreur`, { id: 'import', duration: 8000 })
      console.warn('Import errors:', errorDetails)
    }
    
    // Rafraîchir les données
    fetchOrganization()
    fetchCourses()
    fetchClients()
    fetchTrainees()
    fetchTrainers()
    fetchSessions()
  }

  const tabs = [
    { id: 'organization', name: 'Organisation', icon: Building2 },
    { id: 'logo', name: 'Logo & Tampon', icon: Image },
    { id: 'reglement', name: 'Règlement intérieur', icon: FileText },
    { id: 'livret', name: 'Livret d\'accueil', icon: BookOpen },
    { id: 'users', name: 'Utilisateurs', icon: Users },
    { id: 'audit', name: 'Audit RGPD', icon: Shield },
  ]
  
  const [userEmail, setUserEmail] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)

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
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
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
        
        {/* UTILISATEURS */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <h3 className="font-semibold text-lg">Gestion des utilisateurs</h3>
            
            {/* Déconnecter un utilisateur */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-3 flex items-center gap-2">
                <LogOut className="w-5 h-5" />
                Déconnecter un utilisateur à distance
              </h4>
              <p className="text-sm text-amber-700 mb-4">
                Saisissez l'email de l'utilisateur pour mettre fin à sa session active.
              </p>
              
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={async () => {
                    if (!userEmail) {
                      toast.error('Veuillez saisir un email')
                      return
                    }
                    if (!confirm(`Déconnecter ${userEmail} ?`)) return
                    
                    setDisconnecting(true)
                    try {
                      // Appeler la fonction RPC pour déconnecter l'utilisateur
                      const { error } = await supabase.rpc('admin_logout_user', { user_email: userEmail })
                      
                      if (error) {
                        // Si la fonction n'existe pas, proposer l'alternative
                        if (error.code === '42883') {
                          toast.error('Fonction non installée. Utilisez le Dashboard Supabase.')
                        } else {
                          throw error
                        }
                      } else {
                        toast.success(`${userEmail} a été déconnecté`)
                        setUserEmail('')
                      }
                    } catch (err) {
                      console.error('Erreur déconnexion:', err)
                      toast.error('Erreur - Utilisez le Dashboard Supabase')
                    } finally {
                      setDisconnecting(false)
                    }
                  }}
                  disabled={disconnecting || !userEmail}
                  className="btn btn-primary"
                >
                  {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  Déconnecter
                </button>
              </div>
            </div>
            
            {/* Lien Dashboard Supabase */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">Gestion avancée</h4>
              <p className="text-sm text-blue-700 mb-3">
                Pour voir tous les utilisateurs connectés, les bannir ou supprimer leurs comptes, utilisez le Dashboard Supabase.
              </p>
              <a
                href="https://supabase.com/dashboard/project/_/auth/users"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary inline-flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Ouvrir Supabase Dashboard
              </a>
            </div>
            
            {/* Instructions SQL */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2">Installation de la fonction de déconnexion</h4>
              <p className="text-sm text-gray-600 mb-3">
                Pour activer la déconnexion depuis l'app, exécutez ce SQL dans Supabase :
              </p>
              <pre className="bg-gray-800 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`-- Fonction pour déconnecter un utilisateur par email
CREATE OR REPLACE FUNCTION admin_logout_user(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Trouver l'utilisateur
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non trouvé';
  END IF;
  
  -- Supprimer ses sessions
  DELETE FROM auth.sessions 
  WHERE user_id = target_user_id;
END;
$$;`}
              </pre>
            </div>
          </div>
        )}
        
        {/* AUDIT RGPD */}
        {activeTab === 'audit' && (
          <div className="-m-6">
            <AuditLogs />
          </div>
        )}
      </div>
      
      {/* Section Sauvegarde */}
      <div className="card bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-green-600" />
          Sauvegarde et restauration
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Export */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-600" />
              Exporter (sauvegarde)
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Télécharge un fichier JSON contenant toutes les données : clients, sessions, stagiaires, évaluations, devis, qualité, etc.
            </p>
            <p className="text-xs text-blue-600 mb-3">💡 Conservez ce fichier sur votre disque ou Google Drive.</p>
            <button
              onClick={handleExportAll}
              disabled={exporting}
              className="btn btn-primary flex items-center gap-2 w-full justify-center"
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
          
          {/* Import */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4 text-orange-600" />
              Importer (restauration)
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Restaurez vos données depuis un fichier de sauvegarde JSON précédemment exporté.
            </p>
            <p className="text-xs text-orange-600 mb-3">⚠️ Les données existantes avec le même ID seront écrasées.</p>
            <label className="btn btn-secondary flex items-center gap-2 w-full justify-center cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
                disabled={importing}
              />
              <Upload className="w-4 h-4" />
              Charger un fichier de sauvegarde
            </label>
          </div>
        </div>
      </div>
      
      {/* Modal de confirmation d'import */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-orange-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-600" />
                Confirmer la restauration
              </h3>
              <button onClick={() => setImportPreview(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <p><strong>Fichier :</strong> {importPreview.fileName}</p>
                <p><strong>Date d'export :</strong> {new Date(importPreview.exportDate).toLocaleString('fr-FR')}</p>
                <p><strong>Version :</strong> {importPreview.version}</p>
                <p><strong>Total :</strong> {importPreview.totalRecords.toLocaleString()} enregistrements dans {importPreview.tableCount} tables</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Détail par table :</p>
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(importPreview.tables)
                        .sort((a, b) => b[1] - a[1])
                        .map(([table, count]) => (
                          <tr key={table} className="border-b last:border-0">
                            <td className="px-3 py-1.5 font-mono text-xs text-gray-600">{table}</td>
                            <td className="px-3 py-1.5 text-right font-medium">{count}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
                <strong>⚠️ Attention :</strong> Les enregistrements existants avec le même ID seront mis à jour avec les données du fichier. Les nouveaux seront ajoutés. Aucune donnée ne sera supprimée.
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex gap-3 justify-end">
              <button 
                onClick={() => setImportPreview(null)} 
                className="btn btn-secondary"
                disabled={importing}
              >
                Annuler
              </button>
              <button 
                onClick={handleImportConfirm} 
                disabled={importing}
                className="btn bg-orange-500 text-white hover:bg-orange-600 flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Restaurer les données
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Section À propos */}
      <div className="card bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          À propos
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-600 font-bold">Access Campus</p>
            <p className="text-sm text-gray-500">Version 2.7.0</p>
          </div>
          <Link to="/changelog" className="btn btn-outline btn-sm flex items-center gap-2">
            <History className="w-4 h-4" />
            Historique des versions
          </Link>
        </div>
      </div>
    </div>
  )
}
