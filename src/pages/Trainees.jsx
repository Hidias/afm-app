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
  const [showForm, setShowForm] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedTrainee, setSelectedTrainee] = useState(null)
  const [traineeDocuments, setTraineeDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', 
    social_security_number: '', client_id: '', notes: ''
  })
  
  useEffect(() => {
    fetchTrainees()
    fetchClients()
  }, [])
  
  const filtered = trainees.filter(t => {
    const clientName = clients.find(c => c.id === t.client_id)?.name || ''
    const searchFields = `${t.first_name} ${t.last_name} ${t.email} ${t.phone || ''} ${clientName}`.toLowerCase()
    const matchSearch = !search || searchFields.includes(search.toLowerCase())
    const matchClient = !filterClient || t.client_id === filterClient
    return matchSearch && matchClient
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
      })
      setSelectedTrainee(trainee)
    } else {
      setForm({ first_name: '', last_name: '', email: '', phone: '', social_security_number: '', client_id: '', notes: '' })
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
    if (!form.first_name || !form.last_name) return toast.error('Nom et prénom requis')
    if (selectedTrainee) {
      await updateTrainee(selectedTrainee.id, form)
      toast.success('Stagiaire modifié')
    } else {
      await createTrainee(form)
      toast.success('Stagiaire créé')
    }
    setShowForm(false)
  }
  
  const handleDelete = async () => {
    if (!confirmDelete) return
    await deleteTrainee(confirmDelete)
    toast.success('Stagiaire supprimé')
    setConfirmDelete(null)
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
        <button onClick={() => openForm()} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />Nouveau
        </button>
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
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-600 font-medium mb-1">N° Sécurité Sociale (Passeport Prévention)</p>
                  <p className="font-mono text-lg font-bold text-amber-800">{selectedTrainee.social_security_number || 'Non renseigné'}</p>
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
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                  <label className="label">Téléphone</label>
                  <input type="tel" className="input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
                </div>
                <div>
                  <label className="label">N° Sécurité Sociale</label>
                  <input type="text" className="input font-mono" placeholder="X XX XX XX XXX XXX XX" value={form.social_security_number} onChange={(e) => setForm({...form, social_security_number: e.target.value})} />
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
    </div>
  )
}
