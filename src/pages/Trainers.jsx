import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { Plus, Search, Edit, Trash2, X, UserCheck, Save, Award, FileText, Upload, Calendar, AlertTriangle, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, differenceInDays, isPast, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'

const CERTIFICATE_TYPES = [
  'SST - Formateur',
  'SST - MAC Formateur',
  'Habilitation Électrique',
  'CACES R485',
  'CACES R489',
  'Incendie / Évacuation',
  'Gestes et Postures',
  'Travail en hauteur',
  'Autre'
]

export default function Trainers() {
  const { 
    trainers, trainersLoading, fetchTrainers, createTrainer, updateTrainer, deleteTrainer,
    fetchTrainerCertificates, createTrainerCertificate, deleteTrainerCertificate
  } = useDataStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ 
    first_name: '', 
    last_name: '', 
    email: '', 
    phone: '', 
    specialties: '', 
    qualifications: '',
    certification_number: '',
    is_internal: true 
  })
  
  // Gestion certificats
  const [showCertificates, setShowCertificates] = useState(false)
  const [selectedTrainer, setSelectedTrainer] = useState(null)
  const [certificates, setCertificates] = useState([])
  const [certificatesLoading, setCertificatesLoading] = useState(false)
  const [showCertForm, setShowCertForm] = useState(false)
  const [certFormData, setCertFormData] = useState({
    name: '',
    certificate_type: '',
    expiry_date: '',
    no_expiry: false,
    file: null
  })
  const [uploading, setUploading] = useState(false)
  
  useEffect(() => { fetchTrainers() }, [])
  
  const filteredItems = trainers.filter(t =>
    `${t.first_name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.specialties?.toLowerCase().includes(search.toLowerCase())
  )
  
  const resetForm = () => { 
    setFormData({ 
      first_name: '', 
      last_name: '', 
      email: '', 
      phone: '', 
      specialties: '', 
      qualifications: '',
      certification_number: '',
      is_internal: true 
    })
    setShowForm(false)
    setEditingId(null)
  }
  
  const handleEdit = (trainer) => {
    setFormData({
      first_name: trainer.first_name || '',
      last_name: trainer.last_name || '',
      email: trainer.email || '',
      phone: trainer.phone || '',
      specialties: trainer.specialties || '',
      qualifications: trainer.qualifications || '',
      certification_number: trainer.certification_number || '',
      is_internal: trainer.is_internal ?? true,
    })
    setEditingId(trainer.id)
    setShowForm(true)
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...formData }
    if (!payload.phone) payload.phone = null
    if (!payload.specialties) payload.specialties = null
    if (!payload.qualifications) payload.qualifications = null
    if (!payload.certification_number) payload.certification_number = null
    
    if (editingId) {
      const { error } = await updateTrainer(editingId, payload)
      if (error) toast.error('Erreur lors de la modification')
      else { toast.success('Formateur modifié'); resetForm() }
    } else {
      const { error } = await createTrainer(payload)
      if (error) toast.error('Erreur lors de la création')
      else { toast.success('Formateur créé'); resetForm() }
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce formateur ?')) return
    const { error } = await deleteTrainer(id)
    if (error) toast.error('Erreur')
    else toast.success('Formateur supprimé')
  }
  
  // ========== CERTIFICATS ==========
  const openCertificates = async (trainer) => {
    setSelectedTrainer(trainer)
    setShowCertificates(true)
    setCertificatesLoading(true)
    const { data } = await fetchTrainerCertificates(trainer.id)
    setCertificates(data || [])
    setCertificatesLoading(false)
  }
  
  const closeCertificates = () => {
    setShowCertificates(false)
    setSelectedTrainer(null)
    setCertificates([])
    setShowCertForm(false)
    resetCertForm()
  }
  
  const resetCertForm = () => {
    setCertFormData({
      name: '',
      certificate_type: '',
      expiry_date: '',
      no_expiry: false,
      file: null
    })
    setShowCertForm(false)
  }
  
  const handleCertSubmit = async (e) => {
    e.preventDefault()
    if (!selectedTrainer) return
    
    setUploading(true)
    let filePath = null
    let fileName = null
    
    // Upload fichier si présent
    if (certFormData.file) {
      const file = certFormData.file
      fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      filePath = `trainers/${selectedTrainer.id}/${fileName}`
      
      console.log('=== UPLOAD DEBUG ===')
      console.log('File:', file.name, file.size, file.type)
      console.log('Path:', filePath)
      
      try {
        // Test simple: upload direct
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, { 
            cacheControl: '3600', 
            upsert: false 
          })
        
        console.log('Upload result:', { uploadData, uploadError })
        
        if (uploadError) {
          console.error('Upload error details:', JSON.stringify(uploadError, null, 2))
          
          // Messages d'erreur spécifiques
          if (uploadError.message?.includes('Bucket not found') || uploadError.statusCode === '404') {
            toast.error('Bucket "documents" introuvable. Exécutez STORAGE-SETUP.sql dans Supabase')
          } else if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('policy')) {
            toast.error('Erreur de permission. Vérifiez les policies du bucket "documents"')
          } else if (uploadError.message?.includes('duplicate') || uploadError.statusCode === '409') {
            toast.error('Fichier déjà existant')
          } else {
            toast.error(`Erreur upload: ${uploadError.message || uploadError.error || 'Erreur inconnue'}`)
          }
          setUploading(false)
          return
        }
      } catch (err) {
        console.error('Storage exception:', err)
        toast.error('Exception storage: ' + (err.message || 'Erreur inconnue'))
        setUploading(false)
        return
      }
    }
    
    // Créer l'entrée en base
    console.log('Creating certificate entry:', {
      trainer_id: selectedTrainer.id,
      name: certFormData.name,
      file_path: filePath
    })
    
    const { data: certData, error } = await createTrainerCertificate({
      trainer_id: selectedTrainer.id,
      name: certFormData.name,
      certificate_type: certFormData.certificate_type || null,
      expiry_date: certFormData.no_expiry ? null : (certFormData.expiry_date || null),
      no_expiry: certFormData.no_expiry,
      file_path: filePath,
      file_name: fileName
    })
    
    console.log('Certificate creation result:', { certData, error })
    
    setUploading(false)
    
    if (error) {
      console.error('Certificate DB error:', error)
      toast.error('Erreur DB: ' + (error.message || 'Impossible d\'ajouter le certificat'))
    } else {
      toast.success('Certificat ajouté')
      resetCertForm()
      const { data } = await fetchTrainerCertificates(selectedTrainer.id)
      setCertificates(data || [])
    }
  }
  
  const handleDeleteCertificate = async (cert) => {
    if (!confirm('Supprimer ce certificat ?')) return
    
    if (cert.file_path) {
      await supabase.storage.from('documents').remove([cert.file_path])
    }
    
    const { error } = await deleteTrainerCertificate(cert.id)
    if (error) {
      toast.error('Erreur')
    } else {
      toast.success('Certificat supprimé')
      setCertificates(certificates.filter(c => c.id !== cert.id))
    }
  }
  
  const viewCertificateFile = async (cert) => {
    if (!cert.file_path) {
      toast.error('Aucun fichier attaché')
      return
    }
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(cert.file_path, 3600)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }
  
  const getCertificateStatus = (cert) => {
    if (cert.no_expiry || !cert.expiry_date) return { status: 'valid', color: 'bg-green-100 text-green-800' }
    
    const expiryDate = parseISO(cert.expiry_date)
    const daysLeft = differenceInDays(expiryDate, new Date())
    
    if (isPast(expiryDate)) {
      return { status: 'expired', color: 'bg-red-100 text-red-800', label: 'Expiré' }
    } else if (daysLeft <= 60) {
      return { status: 'warning', color: 'bg-orange-100 text-orange-800', label: `Expire dans ${daysLeft}j` }
    }
    return { status: 'valid', color: 'bg-green-100 text-green-800' }
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formateurs</h1>
          <p className="text-gray-500 mt-1">{trainers.length} formateur(s)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouveau formateur
        </button>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          placeholder="Rechercher par nom, email ou spécialité..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="input pl-10" 
        />
      </div>
      
      <div className="card p-0 overflow-hidden">
        {trainersLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun formateur</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredItems.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.first_name} {item.last_name}</p>
                      <p className="text-sm text-gray-500">
                        {item.email}
                        {item.phone && ` • ${item.phone}`}
                      </p>
                      {item.specialties && (
                        <p className="text-xs text-gray-400 mt-1">
                          <Award className="w-3 h-3 inline mr-1" />
                          {item.specialties}
                        </p>
                      )}
                      {item.certification_number && (
                        <p className="text-xs text-blue-500">N° agrément : {item.certification_number}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${item.is_internal ? 'badge-blue' : 'badge-gray'}`}>
                      {item.is_internal ? 'Interne' : 'Externe'}
                    </span>
                    <button 
                      onClick={() => openCertificates(item)}
                      className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Certificats"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleEdit(item)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Modal Formulaire Formateur */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg animate-fadeIn">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">
                  {editingId ? 'Modifier le formateur' : 'Nouveau formateur'}
                </h2>
                <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Prénom *</label>
                    <input type="text" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="input" required />
                  </div>
                  <div>
                    <label className="label">Nom *</label>
                    <input type="text" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="input" required />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Email *</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="input" required />
                  </div>
                  <div>
                    <label className="label">Téléphone</label>
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="input" placeholder="06 XX XX XX XX" />
                  </div>
                </div>
                
                <div>
                  <label className="label">Spécialités</label>
                  <textarea value={formData.specialties} onChange={(e) => setFormData({...formData, specialties: e.target.value})} className="input" rows={2} placeholder="Ex: Habilitations électriques, SST..." />
                </div>
                
                <div>
                  <label className="label">Qualifications</label>
                  <textarea value={formData.qualifications} onChange={(e) => setFormData({...formData, qualifications: e.target.value})} className="input" rows={2} placeholder="Ex: Formateur SST certifié INRS..." />
                </div>
                
                <div>
                  <label className="label">N° Agrément</label>
                  <input type="text" value={formData.certification_number} onChange={(e) => setFormData({...formData, certification_number: e.target.value})} className="input" placeholder="Ex: HAB-2024-001234" />
                </div>
                
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.is_internal} onChange={(e) => setFormData({...formData, is_internal: e.target.checked})} className="w-4 h-4 rounded" />
                    <span className="text-sm">Formateur interne</span>
                  </label>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button type="button" onClick={resetForm} className="btn btn-secondary">Annuler</button>
                  <button type="submit" className="btn btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {editingId ? 'Modifier' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Certificats */}
      {showCertificates && selectedTrainer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={closeCertificates} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl animate-fadeIn max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                  <h2 className="text-lg font-semibold">Certificats de {selectedTrainer.first_name} {selectedTrainer.last_name}</h2>
                  <p className="text-sm text-gray-500">Gérez les certifications et habilitations</p>
                </div>
                <button onClick={closeCertificates} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {!showCertForm && (
                  <button onClick={() => setShowCertForm(true)} className="w-full mb-4 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-500 transition-colors flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" /> Ajouter un certificat
                  </button>
                )}
                
                {showCertForm && (
                  <form onSubmit={handleCertSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Nom du certificat *</label>
                        <input type="text" value={certFormData.name} onChange={(e) => setCertFormData({...certFormData, name: e.target.value})} className="input" placeholder="Ex: Certificat SST Formateur" required />
                      </div>
                      <div>
                        <label className="label">Type</label>
                        <select value={certFormData.certificate_type} onChange={(e) => setCertFormData({...certFormData, certificate_type: e.target.value})} className="input">
                          <option value="">-- Sélectionner --</option>
                          {CERTIFICATE_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Date d'expiration</label>
                        <input type="date" value={certFormData.expiry_date} onChange={(e) => setCertFormData({...certFormData, expiry_date: e.target.value})} className="input" disabled={certFormData.no_expiry} />
                      </div>
                      <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={certFormData.no_expiry} onChange={(e) => setCertFormData({...certFormData, no_expiry: e.target.checked, expiry_date: ''})} className="w-4 h-4 rounded" />
                          <span className="text-sm">Sans expiration</span>
                        </label>
                      </div>
                    </div>
                    
                    <div>
                      <label className="label">Fichier (PDF, image)</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setCertFormData({...certFormData, file: e.target.files[0]})} className="input" />
                    </div>
                    
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={resetCertForm} className="btn btn-secondary">Annuler</button>
                      <button type="submit" disabled={uploading} className="btn btn-primary flex items-center gap-2">
                        {uploading ? (<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />) : (<Upload className="w-4 h-4" />)}
                        Ajouter
                      </button>
                    </div>
                  </form>
                )}
                
                {certificatesLoading ? (
                  <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div></div>
                ) : certificates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Aucun certificat enregistré</div>
                ) : (
                  <div className="space-y-3">
                    {certificates.map(cert => {
                      const statusInfo = getCertificateStatus(cert)
                      return (
                        <div key={cert.id} className={`p-4 rounded-lg border ${statusInfo.status === 'expired' ? 'border-red-300 bg-red-50' : statusInfo.status === 'warning' ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{cert.name}</p>
                                {statusInfo.label && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color} flex items-center gap-1`}>
                                    <AlertTriangle className="w-3 h-3" />{statusInfo.label}
                                  </span>
                                )}
                              </div>
                              {cert.certificate_type && <p className="text-sm text-gray-500">{cert.certificate_type}</p>}
                              <p className="text-xs text-gray-400 mt-1">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                {cert.no_expiry ? 'Sans expiration' : cert.expiry_date ? `Expire le ${format(parseISO(cert.expiry_date), 'dd/MM/yyyy')}` : 'Date non définie'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {cert.file_path && (
                                <button onClick={() => viewCertificateFile(cert)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Voir le fichier">
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => handleDeleteCertificate(cert)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
