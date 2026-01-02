import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { Plus, Search, Edit, Trash2, X, UserCheck, Save, Award, FileText, Upload, Calendar, AlertTriangle, Eye, Settings } from 'lucide-react'
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

// Fonction de formatage des noms
const formatName = (value, type) => {
  if (!value) return ''
  const upperAccents = { 'é': 'E', 'è': 'E', 'ê': 'E', 'ë': 'E', 'à': 'A', 'â': 'A', 'ä': 'A', 'ù': 'U', 'û': 'U', 'ü': 'U', 'ô': 'O', 'ö': 'O', 'î': 'I', 'ï': 'I', 'ç': 'C', 'ñ': 'N' }
  
  if (type === 'last') {
    return value.split('').map(c => upperAccents[c.toLowerCase()] || c.toUpperCase()).join('')
  } else {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  }
}

// Modal de confirmation
const ConfirmModal = ({ show, onConfirm, onCancel, message }) => {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
        <p className="text-gray-700 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn btn-secondary">Annuler</button>
          <button onClick={onConfirm} className="btn bg-red-600 text-white hover:bg-red-700">Supprimer</button>
        </div>
      </div>
    </div>
  )
}

export default function Trainers() {
  const { 
    trainers, trainersLoading, fetchTrainers, createTrainer, updateTrainer, deleteTrainer,
    fetchTrainerCertificates, createTrainerCertificate, deleteTrainerCertificate
  } = useDataStore()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterQualification, setFilterQualification] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmDeleteCert, setConfirmDeleteCert] = useState(null)
  const [formData, setFormData] = useState({ 
    first_name: '', 
    last_name: '', 
    email: '', 
    phone: '', 
    specialties: '', 
    qualifications: [],
    certification_number: '',
    is_internal: true 
  })
  const [newQualification, setNewQualification] = useState('')
  
  // Gestion qualifications globales
  const [showQualificationsManager, setShowQualificationsManager] = useState(false)
  const [allQualifications, setAllQualifications] = useState([])
  
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
  
  useEffect(() => { 
    fetchTrainers() 
    loadAllQualifications()
  }, [])
  
  const loadAllQualifications = async () => {
    const { data } = await supabase.from('trainer_qualifications').select('name').order('name')
    const unique = [...new Set((data || []).map(q => q.name))]
    setAllQualifications(unique)
  }
  
  const getAllUsedQualifications = () => {
    const quals = new Set()
    trainers.forEach(t => {
      if (t.qualifications_list) {
        t.qualifications_list.forEach(q => quals.add(q))
      }
    })
    return [...quals].sort()
  }
  
  const filteredItems = trainers.filter(t => {
    const matchSearch = `${t.first_name} ${t.last_name} ${t.email} ${t.specialties || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || (filterType === 'internal' ? t.is_internal : !t.is_internal)
    const matchQual = !filterQualification || (t.qualifications_list && t.qualifications_list.includes(filterQualification))
    return matchSearch && matchType && matchQual
  })
  
  const resetForm = () => { 
    setFormData({ 
      first_name: '', last_name: '', email: '', phone: '', 
      specialties: '', qualifications: [], certification_number: '', is_internal: true 
    })
    setNewQualification('')
    setShowForm(false)
    setEditingId(null)
  }
  
  const handleNameChange = (field, value) => {
    const formatted = formatName(value, field === 'last_name' ? 'last' : 'first')
    setFormData({...formData, [field]: formatted})
  }
  
  const handleEdit = (trainer) => {
    setFormData({
      first_name: trainer.first_name || '',
      last_name: trainer.last_name || '',
      email: trainer.email || '',
      phone: trainer.phone || '',
      specialties: trainer.specialties || '',
      qualifications: trainer.qualifications_list || [],
      certification_number: trainer.certification_number || '',
      is_internal: trainer.is_internal ?? true,
    })
    setEditingId(trainer.id)
    setShowForm(true)
  }
  
  const openPreview = (trainer) => {
    setSelectedTrainer(trainer)
    setShowPreview(true)
  }
  
  const addQualification = () => {
    if (!newQualification.trim()) return
    if (formData.qualifications.includes(newQualification.trim())) {
      toast.error('Qualification déjà ajoutée')
      return
    }
    setFormData({...formData, qualifications: [...formData.qualifications, newQualification.trim()]})
    setNewQualification('')
  }
  
  const removeQualification = (qual) => {
    setFormData({...formData, qualifications: formData.qualifications.filter(q => q !== qual)})
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { 
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone || null,
      specialties: formData.specialties || null,
      certification_number: formData.certification_number || null,
      is_internal: formData.is_internal,
      qualifications_list: formData.qualifications
    }
    
    if (editingId) {
      const { error } = await updateTrainer(editingId, payload)
      if (error) toast.error('Erreur lors de la modification')
      else { toast.success('Formateur modifié'); resetForm(); loadAllQualifications() }
    } else {
      const { error } = await createTrainer(payload)
      if (error) toast.error('Erreur lors de la création')
      else { toast.success('Formateur créé'); resetForm(); loadAllQualifications() }
    }
  }
  
  const handleDelete = async () => {
    if (!confirmDelete) return
    const { error } = await deleteTrainer(confirmDelete)
    if (error) toast.error('Erreur')
    else toast.success('Formateur supprimé')
    setConfirmDelete(null)
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
    setCertFormData({ name: '', certificate_type: '', expiry_date: '', no_expiry: false, file: null })
    setShowCertForm(false)
  }
  
  const handleCertSubmit = async (e) => {
    e.preventDefault()
    if (!selectedTrainer) return
    
    setUploading(true)
    let filePath = null, fileName = null
    
    if (certFormData.file) {
      const file = certFormData.file
      fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      filePath = `trainers/${selectedTrainer.id}/${fileName}`
      
      try {
        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file, { cacheControl: '3600', upsert: false })
        if (uploadError) { toast.error(`Erreur upload: ${uploadError.message}`); setUploading(false); return }
      } catch (err) { toast.error('Exception storage'); setUploading(false); return }
    }
    
    const { error } = await createTrainerCertificate({
      trainer_id: selectedTrainer.id,
      name: certFormData.name,
      certificate_type: certFormData.certificate_type || null,
      expiry_date: certFormData.no_expiry ? null : (certFormData.expiry_date || null),
      no_expiry: certFormData.no_expiry,
      file_path: filePath,
      file_name: fileName
    })
    
    setUploading(false)
    if (error) toast.error('Erreur: ' + (error.message || 'Impossible d\'ajouter'))
    else {
      toast.success('Certificat ajouté')
      resetCertForm()
      const { data } = await fetchTrainerCertificates(selectedTrainer.id)
      setCertificates(data || [])
    }
  }
  
  const handleDeleteCertificate = async () => {
    if (!confirmDeleteCert) return
    if (confirmDeleteCert.file_path) await supabase.storage.from('documents').remove([confirmDeleteCert.file_path])
    const { error } = await deleteTrainerCertificate(confirmDeleteCert.id)
    if (error) toast.error('Erreur')
    else { toast.success('Certificat supprimé'); setCertificates(certificates.filter(c => c.id !== confirmDeleteCert.id)) }
    setConfirmDeleteCert(null)
  }
  
  const viewCertificateFile = async (cert) => {
    if (!cert.file_path) { toast.error('Aucun fichier'); return }
    const { data } = await supabase.storage.from('documents').createSignedUrl(cert.file_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }
  
  const getCertificateStatus = (cert) => {
    if (cert.no_expiry || !cert.expiry_date) return { status: 'valid', color: 'bg-green-100 text-green-800' }
    const expiryDate = parseISO(cert.expiry_date)
    const daysLeft = differenceInDays(expiryDate, new Date())
    if (isPast(expiryDate)) return { status: 'expired', color: 'bg-red-100 text-red-800', label: 'Expiré' }
    if (daysLeft <= 60) return { status: 'warning', color: 'bg-orange-100 text-orange-800', label: `${daysLeft}j` }
    return { status: 'valid', color: 'bg-green-100 text-green-800' }
  }
  
  const usedQualifications = getAllUsedQualifications()
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formateurs</h1>
          <p className="text-gray-500 mt-1">{trainers.length} formateur(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowQualificationsManager(true)} className="btn btn-secondary flex items-center gap-2">
            <Settings className="w-4 h-4" /> Qualifications
          </button>
          <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau
          </button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10 w-full" />
        </div>
        <select className="input w-36" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">Tous types</option>
          <option value="internal">Interne</option>
          <option value="external">Externe</option>
        </select>
        <select className="input w-48" value={filterQualification} onChange={(e) => setFilterQualification(e.target.value)}>
          <option value="">Toutes qualif.</option>
          {usedQualifications.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
      </div>
      
      <div className="card p-0 overflow-hidden">
        {trainersLoading ? (
          <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div></div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun formateur</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredItems.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => openPreview(item)} className="font-medium text-gray-900 hover:text-primary hover:underline">
                          {item.first_name} {item.last_name?.toUpperCase()}
                        </button>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.is_internal ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                          {item.is_internal ? 'Interne' : 'Externe'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{item.email}{item.phone && ` • ${item.phone}`}</p>
                      {item.qualifications_list && item.qualifications_list.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.qualifications_list.map((qual, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{qual}</span>
                          ))}
                        </div>
                      )}
                      {item.certification_number && <p className="text-xs text-blue-500 mt-1">N° {item.certification_number}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openPreview(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Aperçu"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openCertificates(item)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Certificats"><FileText className="w-4 h-4" /></button>
                    <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Modifier"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => setConfirmDelete(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Modal Aperçu */}
      {showPreview && selectedTrainer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPreview(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Fiche formateur</h2>
                <button onClick={() => setShowPreview(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div className="text-center pb-3 border-b">
                  <h3 className="text-xl font-bold">{selectedTrainer.first_name} {selectedTrainer.last_name?.toUpperCase()}</h3>
                  <span className={`inline-block mt-2 text-sm px-3 py-1 rounded-full font-medium ${selectedTrainer.is_internal ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    {selectedTrainer.is_internal ? 'Interne' : 'Externe'}
                  </span>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium break-all">{selectedTrainer.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Téléphone</p>
                    <p className="font-medium">{selectedTrainer.phone || '-'}</p>
                  </div>
                </div>
                {selectedTrainer.certification_number && (
                  <div className="text-sm"><p className="text-gray-500">N° Agrément</p><p className="font-medium text-blue-600">{selectedTrainer.certification_number}</p></div>
                )}
                {selectedTrainer.specialties && (
                  <div className="text-sm"><p className="text-gray-500">Spécialités</p><p className="font-medium">{selectedTrainer.specialties}</p></div>
                )}
                {selectedTrainer.qualifications_list && selectedTrainer.qualifications_list.length > 0 && (
                  <div>
                    <p className="text-gray-500 text-sm mb-2">Qualifications</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedTrainer.qualifications_list.map((qual, idx) => (
                        <span key={idx} className="text-sm px-2 py-1 rounded-full bg-blue-100 text-blue-700">{qual}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 p-4 border-t">
                <button onClick={() => { setShowPreview(false); handleEdit(selectedTrainer) }} className="btn btn-primary"><Edit className="w-4 h-4 mr-2" />Modifier</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Formulaire */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                <h2 className="text-lg font-semibold">{editingId ? 'Modifier' : 'Nouveau'} formateur</h2>
                <button onClick={resetForm}><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Prénom *</label><input type="text" value={formData.first_name} onChange={(e) => handleNameChange('first_name', e.target.value)} className="input" required /></div>
                  <div><label className="label">NOM *</label><input type="text" value={formData.last_name} onChange={(e) => handleNameChange('last_name', e.target.value)} className="input uppercase" required /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Email *</label><input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="input" required /></div>
                  <div><label className="label">Téléphone</label><input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="input" /></div>
                </div>
                <div><label className="label">Spécialités</label><textarea value={formData.specialties} onChange={(e) => setFormData({...formData, specialties: e.target.value})} className="input" rows={2} /></div>
                
                <div>
                  <label className="label">Qualifications</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {formData.qualifications.map((qual, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                        {qual}<button type="button" onClick={() => removeQualification(qual)} className="hover:text-red-600"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newQualification} onChange={(e) => setNewQualification(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addQualification())} className="input flex-1" placeholder="Ajouter..." list="qual-list" />
                    <datalist id="qual-list">{allQualifications.filter(q => !formData.qualifications.includes(q)).map(q => <option key={q} value={q} />)}</datalist>
                    <button type="button" onClick={addQualification} className="btn btn-secondary"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
                
                <div><label className="label">N° Agrément</label><input type="text" value={formData.certification_number} onChange={(e) => setFormData({...formData, certification_number: e.target.value})} className="input" /></div>
                <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.is_internal} onChange={(e) => setFormData({...formData, is_internal: e.target.checked})} className="w-4 h-4 rounded" /><span className="text-sm">Formateur interne</span></label></div>
                
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={resetForm} className="btn btn-secondary">Annuler</button>
                  <button type="submit" className="btn btn-primary"><Save className="w-4 h-4 mr-2" />{editingId ? 'Modifier' : 'Créer'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Qualifications */}
      {showQualificationsManager && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowQualificationsManager(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Qualifications</h2>
                <button onClick={() => setShowQualificationsManager(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-500 mb-4">Qualifications utilisées par les formateurs</p>
                {usedQualifications.length === 0 ? <p className="text-center text-gray-500 py-8">Aucune</p> : (
                  <div className="flex flex-wrap gap-2">{usedQualifications.map(q => <span key={q} className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">{q}</span>)}</div>
                )}
              </div>
              <div className="flex justify-end p-4 border-t"><button onClick={() => setShowQualificationsManager(false)} className="btn btn-primary">Fermer</button></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Certificats */}
      {showCertificates && selectedTrainer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={closeCertificates} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div><h2 className="text-lg font-semibold">Certificats - {selectedTrainer.first_name} {selectedTrainer.last_name?.toUpperCase()}</h2></div>
                <button onClick={closeCertificates}><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {!showCertForm && (
                  <button onClick={() => setShowCertForm(true)} className="w-full mb-4 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-500 flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" /> Ajouter
                  </button>
                )}
                {showCertForm && (
                  <form onSubmit={handleCertSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="label">Nom *</label><input type="text" value={certFormData.name} onChange={(e) => setCertFormData({...certFormData, name: e.target.value})} className="input" required /></div>
                      <div><label className="label">Type</label><select value={certFormData.certificate_type} onChange={(e) => setCertFormData({...certFormData, certificate_type: e.target.value})} className="input"><option value="">--</option>{CERTIFICATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="label">Expiration</label><input type="date" value={certFormData.expiry_date} onChange={(e) => setCertFormData({...certFormData, expiry_date: e.target.value})} className="input" disabled={certFormData.no_expiry} /></div>
                      <div className="flex items-end pb-2"><label className="flex items-center gap-2"><input type="checkbox" checked={certFormData.no_expiry} onChange={(e) => setCertFormData({...certFormData, no_expiry: e.target.checked, expiry_date: ''})} className="w-4 h-4 rounded" /><span className="text-sm">Sans exp.</span></label></div>
                    </div>
                    <div><label className="label">Fichier</label><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setCertFormData({...certFormData, file: e.target.files[0]})} className="input" /></div>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={resetCertForm} className="btn btn-secondary">Annuler</button>
                      <button type="submit" disabled={uploading} className="btn btn-primary">{uploading ? '...' : 'Ajouter'}</button>
                    </div>
                  </form>
                )}
                {certificatesLoading ? <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div></div> : certificates.length === 0 ? <div className="text-center py-8 text-gray-500">Aucun certificat</div> : (
                  <div className="space-y-3">
                    {certificates.map(cert => {
                      const st = getCertificateStatus(cert)
                      return (
                        <div key={cert.id} className={`p-4 rounded-lg border ${st.status === 'expired' ? 'border-red-300 bg-red-50' : st.status === 'warning' ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{cert.name}</p>
                                {st.label && <span className={`text-xs px-2 py-0.5 rounded-full ${st.color} flex items-center gap-1`}><AlertTriangle className="w-3 h-3" />{st.label}</span>}
                              </div>
                              {cert.certificate_type && <p className="text-sm text-gray-500">{cert.certificate_type}</p>}
                              <p className="text-xs text-gray-400 mt-1"><Calendar className="w-3 h-3 inline mr-1" />{cert.no_expiry ? 'Sans expiration' : cert.expiry_date ? format(parseISO(cert.expiry_date), 'dd/MM/yyyy') : '-'}</p>
                            </div>
                            <div className="flex gap-2">
                              {cert.file_path && <button onClick={() => viewCertificateFile(cert)} className="p-2 text-gray-400 hover:text-primary-600 rounded-lg"><Eye className="w-4 h-4" /></button>}
                              <button onClick={() => setConfirmDeleteCert(cert)} className="p-2 text-red-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
      
      <ConfirmModal show={!!confirmDelete} message="Supprimer ce formateur ?" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      <ConfirmModal show={!!confirmDeleteCert} message="Supprimer ce certificat ?" onConfirm={handleDeleteCertificate} onCancel={() => setConfirmDeleteCert(null)} />
    </div>
  )
}
