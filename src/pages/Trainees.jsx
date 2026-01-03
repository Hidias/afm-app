import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { Plus, Search, Edit, Trash2, X, Save, FileText, Upload, Eye, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

// Fonction de formatage des noms
const formatName = (value, type) => {
  if (!value) return ''
  // Remplacer les caractères accentués pour les majuscules
  const upperAccents = { 'é': 'E', 'è': 'E', 'ê': 'E', 'ë': 'E', 'à': 'A', 'â': 'A', 'ä': 'A', 'ù': 'U', 'û': 'U', 'ü': 'U', 'ô': 'O', 'ö': 'O', 'î': 'I', 'ï': 'I', 'ç': 'C', 'ñ': 'N' }
  
  if (type === 'last') {
    // NOM en majuscules
    return value.split('').map(c => upperAccents[c.toLowerCase()] || c.toUpperCase()).join('')
  } else {
    // Prénom avec première lettre majuscule
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

export default function Trainees() {
  const { 
    trainees, fetchTrainees, createTrainee, updateTrainee, deleteTrainee,
    clients, fetchClients,
    fetchTraineeDocuments, uploadTraineeDocument, deleteTraineeDocument, getSessionDocumentUrl
  } = useDataStore()
  
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [sortBy, setSortBy] = useState('name') // name, client
  const [showForm, setShowForm] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedTrainee, setSelectedTrainee] = useState(null)
  const [traineeDocuments, setTraineeDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [bulkClientId, setBulkClientId] = useState('')
  const [bulkTrainees, setBulkTrainees] = useState([
    { first_name: '', last_name: '', email: '', phone: '' }
  ])
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', 
    social_security_number: '', client_id: '', notes: '',
    birth_date: '', refused_ssn: false
  })
  
  useEffect(() => {
    fetchTrainees()
    fetchClients()
  }, [])
  
  const filtered = trainees
    .filter(t => {
      const clientName = clients.find(c => c.id === t.client_id)?.name || ''
      const searchFields = `${t.first_name} ${t.last_name} ${t.email} ${t.phone || ''} ${clientName}`.toLowerCase()
      const matchSearch = !search || searchFields.includes(search.toLowerCase())
      const matchClient = !filterClient || t.client_id === filterClient
      return matchSearch && matchClient
    })
    .sort((a, b) => {
      if (sortBy === 'client') {
        const clientA = clients.find(c => c.id === a.client_id)?.name || 'zzz'
        const clientB = clients.find(c => c.id === b.client_id)?.name || 'zzz'
        if (clientA !== clientB) return clientA.localeCompare(clientB)
        // Sous-tri par nom
        return (a.last_name || '').localeCompare(b.last_name || '')
      }
      // Tri par nom (défaut)
      return (a.last_name || '').localeCompare(b.last_name || '')
    })
  
  const openForm = (trainee = null) => {
    if (trainee) {
      setForm({
        first_name: trainee.first_name || '',
        last_name: trainee.last_name || '',
        email: trainee.email || '',
        phone: trainee.phone || '',
        social_security_number: trainee.social_security_number || '',
        client_id: trainee.client_id || '',
        notes: trainee.notes || '',
        birth_date: trainee.birth_date || '',
        refused_ssn: trainee.refused_ssn || false,
      })
      setSelectedTrainee(trainee)
    } else {
      setForm({ first_name: '', last_name: '', email: '', phone: '', social_security_number: '', client_id: '', notes: '', birth_date: '', refused_ssn: false })
      setSelectedTrainee(null)
    }
    setShowForm(true)
  }
  
  const openPreview = (trainee) => {
    setSelectedTrainee(trainee)
    setShowPreview(true)
  }
  
  const handleNameChange = (field, value) => {
    const formatted = formatName(value, field === 'last_name' ? 'last' : 'first')
    setForm({...form, [field]: formatted})
  }
  
  const handleSave = async () => {
    if (!form.first_name || !form.last_name) return toast.error('Campus a besoin du nom et prénom')
    
    // Préparer les données en convertissant les chaînes vides en null
    const dataToSave = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      social_security_number: form.social_security_number || null,
      client_id: form.client_id || null,
      notes: form.notes || null,
      birth_date: form.birth_date || null,
      refused_ssn: form.refused_ssn || false,
    }
    
    if (selectedTrainee) {
      const { error } = await updateTrainee(selectedTrainee.id, dataToSave)
      if (error) {
        console.error('Erreur modification:', error)
        toast.error('Erreur lors de la modification')
        return
      }
      toast.success('✓ Campus a enregistré les modifications')
    } else {
      const { error } = await createTrainee(dataToSave)
      if (error) {
        console.error('Erreur création:', error)
        toast.error('Erreur lors de la création')
        return
      }
      toast.success('✓ Campus a créé le stagiaire')
    }
    
    // Rafraîchir la liste pour récupérer les données à jour
    await fetchTrainees()
    setShowForm(false)
    setSelectedTrainee(null)
  }
  
  const handleDelete = async () => {
    if (!confirmDelete) return
    await deleteTrainee(confirmDelete)
    toast.success('Stagiaire supprimé')
    setConfirmDelete(null)
  }
  
  // Fonctions pour ajout multiple
  const closeBulkModal = () => {
    setBulkTrainees([{ first_name: '', last_name: '', email: '', phone: '' }])
    setBulkClientId('')
    setShowBulkAdd(false)
  }
  
  const addBulkRow = () => {
    setBulkTrainees([...bulkTrainees, { first_name: '', last_name: '', email: '', phone: '' }])
  }
  
  const removeBulkRow = (index) => {
    if (bulkTrainees.length > 1) {
      setBulkTrainees(bulkTrainees.filter((_, i) => i !== index))
    }
  }
  
  const updateBulkRow = (index, field, value) => {
    const updated = [...bulkTrainees]
    if (field === 'first_name') {
      updated[index][field] = formatName(value, 'first')
    } else if (field === 'last_name') {
      updated[index][field] = formatName(value, 'last')
    } else {
      updated[index][field] = value
    }
    setBulkTrainees(updated)
  }
  
  const handleBulkSave = async () => {
    const validTrainees = bulkTrainees.filter(t => t.first_name && t.last_name)
    if (validTrainees.length === 0) {
      toast.error('Au moins un stagiaire avec nom et prénom requis')
      return
    }
    
    let created = 0
    let errors = 0
    
    for (let i = 0; i < validTrainees.length; i++) {
      const trainee = validTrainees[i]
      const { error } = await createTrainee({
        first_name: trainee.first_name,
        last_name: trainee.last_name,
        email: trainee.email || null,
        phone: trainee.phone || null,
        client_id: bulkClientId || null,
      })
      if (error) {
        console.error('Erreur création stagiaire:', error)
        errors++
      } else {
        created++
      }
    }
    
    if (errors > 0) {
      toast.error(`${errors} erreur(s) lors de la création`)
    }
    if (created > 0) {
      toast.success(`${created} stagiaire(s) créé(s)`)
    }
    
    // Rafraîchir la liste et fermer
    await fetchTrainees()
    closeBulkModal()
  }
  
  const openDocs = async (trainee) => {
    setSelectedTrainee(trainee)
    const { data } = await fetchTraineeDocuments(trainee.id)
    setTraineeDocuments(data || [])
    setShowDocs(true)
  }
  
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedTrainee) return
    setUploading(true)
    const { error } = await uploadTraineeDocument(selectedTrainee.id, file, 'document')
    if (error) toast.error('Erreur upload')
    else {
      toast.success('Document uploadé')
      const { data } = await fetchTraineeDocuments(selectedTrainee.id)
      setTraineeDocuments(data || [])
    }
    setUploading(false)
    e.target.value = ''
  }
  
  const handleDeleteDoc = async (doc) => {
    await deleteTraineeDocument(doc.id, doc.file_path)
    setTraineeDocuments(prev => prev.filter(d => d.id !== doc.id))
    toast.success('Document supprimé')
  }
  
  const viewDoc = async (doc) => {
    const url = await getSessionDocumentUrl(doc.file_path)
    if (url) window.open(url, '_blank')
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stagiaires</h1>
          <p className="text-gray-500">{trainees.length} stagiaire(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulkAdd(true)} className="btn btn-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" />Ajouter plusieurs
          </button>
          <button onClick={() => openForm()} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />Nouveau
          </button>
        </div>
      </div>
      
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Rechercher..." className="input pl-10 w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-48" value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
          <option value="">Toutes entreprises</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-40" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="name">Tri par nom</option>
          <option value="client">Tri par entreprise</option>
        </select>
      </div>
      
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Prénom NOM</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Téléphone</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Entreprise</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="py-3 px-4">
                  <button onClick={() => openPreview(t)} className="font-medium text-primary hover:underline">
                    {t.first_name} {t.last_name?.toUpperCase()}
                  </button>
                </td>
                <td className="py-3 px-4 text-gray-600">{t.email || '-'}</td>
                <td className="py-3 px-4 text-gray-600">{t.phone || '-'}</td>
                <td className="py-3 px-4 text-gray-600">{t.clients?.name || '-'}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openPreview(t)} className="p-2 hover:bg-gray-100 rounded" title="Aperçu"><Eye className="w-4 h-4 text-blue-500" /></button>
                    <button onClick={() => openDocs(t)} className="p-2 hover:bg-gray-100 rounded" title="Documents"><FileText className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => openForm(t)} className="p-2 hover:bg-gray-100 rounded" title="Modifier"><Edit className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => setConfirmDelete(t.id)} className="p-2 hover:bg-gray-100 rounded" title="Supprimer"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-500">Aucun stagiaire</td></tr>}
          </tbody>
        </table>
      </div>
      
      {/* Modal Aperçu */}
      {showPreview && selectedTrainee && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPreview(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Fiche stagiaire</h2>
                <button onClick={() => setShowPreview(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-center pb-3 border-b">
                  <h3 className="text-xl font-bold">{selectedTrainee.first_name} {selectedTrainee.last_name?.toUpperCase()}</h3>
                  {selectedTrainee.clients?.name && (
                    <p className="text-gray-500 flex items-center justify-center gap-1 mt-1">
                      <Building2 className="w-4 h-4" />{selectedTrainee.clients.name}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium">{selectedTrainee.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Téléphone</p>
                    <p className="font-medium">{selectedTrainee.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Date de naissance</p>
                    <p className="font-medium">
                      {selectedTrainee.birth_date 
                        ? format(new Date(selectedTrainee.birth_date), 'dd/MM/yyyy')
                        : '-'}
                    </p>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-600 font-medium mb-1">N° Sécurité Sociale (Passeport Prévention)</p>
                  {selectedTrainee.refused_ssn ? (
                    <p className="text-sm text-red-600 font-medium">A refusé de communiquer son numéro</p>
                  ) : (
                    <p className="font-mono text-lg font-bold text-amber-800">{selectedTrainee.social_security_number || 'Non renseigné'}</p>
                  )}
                </div>
                {selectedTrainee.notes && (
                  <div>
                    <p className="text-gray-500 text-sm">Notes</p>
                    <p className="text-sm">{selectedTrainee.notes}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 p-4 border-t">
                <button onClick={() => { setShowPreview(false); openForm(selectedTrainee) }} className="btn btn-primary">
                  <Edit className="w-4 h-4 mr-2" />Modifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">{selectedTrainee ? 'Modifier' : 'Nouveau'} stagiaire</h2>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Prénom *</label>
                    <input type="text" className="input" value={form.first_name} onChange={(e) => handleNameChange('first_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">NOM *</label>
                    <input type="text" className="input uppercase" value={form.last_name} onChange={(e) => handleNameChange('last_name', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date de naissance</label>
                    <input type="date" className="input" value={form.birth_date} onChange={(e) => setForm({...form, birth_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Téléphone</label>
                    <input type="tel" className="input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                  <label className="label">N° Sécurité Sociale</label>
                  <input 
                    type="text" 
                    className="input font-mono" 
                    placeholder="X XX XX XX XXX XXX XX" 
                    value={form.social_security_number} 
                    onChange={(e) => setForm({...form, social_security_number: e.target.value})}
                    disabled={form.refused_ssn}
                  />
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <input 
                      type="checkbox" 
                      checked={form.refused_ssn} 
                      onChange={(e) => setForm({...form, refused_ssn: e.target.checked, social_security_number: e.target.checked ? '' : form.social_security_number})}
                    />
                    A refusé de communiquer son numéro
                  </label>
                </div>
                <div>
                  <label className="label">Entreprise</label>
                  <select className="input" value={form.client_id} onChange={(e) => setForm({...form, client_id: e.target.value})}>
                    <option value="">Sélectionner...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t">
                <button onClick={() => setShowForm(false)} className="btn btn-secondary">Annuler</button>
                <button onClick={handleSave} className="btn btn-primary"><Save className="w-4 h-4 mr-2" />Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Documents */}
      {showDocs && selectedTrainee && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDocs(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Documents - {selectedTrainee.first_name} {selectedTrainee.last_name}</h2>
                <button onClick={() => setShowDocs(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 border-b">
                <label className="btn btn-primary w-full flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />{uploading ? 'Upload...' : 'Ajouter un document'}
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {traineeDocuments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucun document</p>
                ) : (
                  <div className="space-y-2">
                    {traineeDocuments.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-gray-500">{format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => viewDoc(doc)} className="p-2 hover:bg-gray-100 rounded"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteDoc(doc)} className="p-2 hover:bg-gray-100 rounded text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Confirmation suppression */}
      <ConfirmModal 
        show={!!confirmDelete}
        message="Êtes-vous sûr de vouloir supprimer ce stagiaire ?"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
      
      {/* Modal Ajout Multiple */}
      {showBulkAdd && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={closeBulkModal} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Ajouter plusieurs stagiaires</h2>
                <button onClick={closeBulkModal}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <div className="mb-4">
                  <label className="label">Entreprise (pour tous)</label>
                  <select 
                    className="input w-64" 
                    value={bulkClientId}
                    onChange={(e) => setBulkClientId(e.target.value)}
                  >
                    <option value="">Sélectionner...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-600 px-1">
                    <div className="col-span-3">Prénom *</div>
                    <div className="col-span-3">NOM *</div>
                    <div className="col-span-3">Email</div>
                    <div className="col-span-2">Téléphone</div>
                    <div className="col-span-1"></div>
                  </div>
                  
                  {bulkTrainees.map((trainee, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <input 
                        type="text" 
                        className="input col-span-3" 
                        placeholder="Prénom"
                        value={trainee.first_name}
                        onChange={(e) => updateBulkRow(index, 'first_name', e.target.value)}
                      />
                      <input 
                        type="text" 
                        className="input col-span-3 uppercase" 
                        placeholder="NOM"
                        value={trainee.last_name}
                        onChange={(e) => updateBulkRow(index, 'last_name', e.target.value)}
                      />
                      <input 
                        type="email" 
                        className="input col-span-3" 
                        placeholder="email@exemple.com"
                        value={trainee.email}
                        onChange={(e) => updateBulkRow(index, 'email', e.target.value)}
                      />
                      <input 
                        type="tel" 
                        className="input col-span-2" 
                        placeholder="06 XX XX XX XX"
                        value={trainee.phone}
                        onChange={(e) => updateBulkRow(index, 'phone', e.target.value)}
                      />
                      <button 
                        onClick={() => removeBulkRow(index)} 
                        className="col-span-1 p-2 text-red-500 hover:text-red-700 disabled:opacity-30"
                        disabled={bulkTrainees.length === 1}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                
                <button onClick={addBulkRow} className="mt-4 text-primary-600 hover:text-primary-700 flex items-center gap-1 text-sm">
                  <Plus className="w-4 h-4" /> Ajouter une ligne
                </button>
              </div>
              <div className="flex justify-between items-center gap-2 p-4 border-t">
                <p className="text-sm text-gray-500">
                  {bulkTrainees.filter(t => t.first_name && t.last_name).length} stagiaire(s) à créer
                </p>
                <div className="flex gap-2">
                  <button onClick={closeBulkModal} className="btn btn-secondary">Annuler</button>
                  <button onClick={handleBulkSave} className="btn btn-primary">
                    <Save className="w-4 h-4 mr-2" />Créer tous
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
