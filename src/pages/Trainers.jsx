import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { Plus, Search, Edit, Trash2, X, UserCheck, Save, Award } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Trainers() {
  const { 
    trainers, trainersLoading, fetchTrainers, createTrainer, updateTrainer, deleteTrainer 
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
                  <div className="flex items-center gap-3">
                    <span className={`badge ${item.is_internal ? 'badge-blue' : 'badge-gray'}`}>
                      {item.is_internal ? 'Interne' : 'Externe'}
                    </span>
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
      
      {/* Modal Formulaire */}
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
                    <input 
                      type="text" 
                      value={formData.first_name} 
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})} 
                      className="input" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="label">Nom *</label>
                    <input 
                      type="text" 
                      value={formData.last_name} 
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})} 
                      className="input" 
                      required 
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Email *</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={(e) => setFormData({...formData, email: e.target.value})} 
                      className="input" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="label">Téléphone</label>
                    <input 
                      type="tel" 
                      value={formData.phone} 
                      onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                      className="input"
                      placeholder="06 XX XX XX XX" 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="label">Spécialités / Domaines de compétence</label>
                  <textarea 
                    value={formData.specialties} 
                    onChange={(e) => setFormData({...formData, specialties: e.target.value})} 
                    className="input" 
                    rows={2}
                    placeholder="Ex: Habilitations électriques, SST, Travail en hauteur..."
                  />
                </div>
                
                <div>
                  <label className="label">Qualifications / Diplômes</label>
                  <textarea 
                    value={formData.qualifications} 
                    onChange={(e) => setFormData({...formData, qualifications: e.target.value})} 
                    className="input" 
                    rows={2}
                    placeholder="Ex: Ingénieur électricien, Formateur SST certifié INRS..."
                  />
                </div>
                
                <div>
                  <label className="label">N° Agrément / Habilitation</label>
                  <input 
                    type="text" 
                    value={formData.certification_number} 
                    onChange={(e) => setFormData({...formData, certification_number: e.target.value})} 
                    className="input"
                    placeholder="Ex: HAB-2024-001234" 
                  />
                </div>
                
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.is_internal} 
                      onChange={(e) => setFormData({...formData, is_internal: e.target.checked})} 
                      className="w-4 h-4 rounded" 
                    />
                    <span className="text-sm">Formateur interne</span>
                  </label>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button type="button" onClick={resetForm} className="btn btn-secondary">
                    Annuler
                  </button>
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
    </div>
  )
}
