import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { Plus, Search, Edit, X, Users, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Trainees() {
  const { 
    trainees, traineesLoading, fetchTrainees, createTrainee, updateTrainee, deleteTrainee,
    clients, fetchClients 
  } = useDataStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ 
    first_name: '', 
    last_name: '', 
    email: '', 
    phone: '',
    social_security_number: '',
    birth_date: '', 
    client_id: '' 
  })
  
  useEffect(() => { fetchTrainees(); fetchClients() }, [])
  
  const filteredItems = trainees.filter(t =>
    `${t.first_name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.clients?.name?.toLowerCase().includes(search.toLowerCase())
  )
  
  const resetForm = () => { 
    setFormData({ 
      first_name: '', 
      last_name: '', 
      email: '', 
      phone: '',
      social_security_number: '',
      birth_date: '', 
      client_id: '' 
    })
    setShowForm(false)
    setEditingId(null)
  }
  
  const handleEdit = (trainee) => {
    setFormData({
      first_name: trainee.first_name || '',
      last_name: trainee.last_name || '',
      email: trainee.email || '',
      phone: trainee.phone || '',
      social_security_number: trainee.social_security_number || '',
      birth_date: trainee.birth_date || '',
      client_id: trainee.client_id || '',
    })
    setEditingId(trainee.id)
    setShowForm(true)
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...formData }
    if (!payload.client_id) payload.client_id = null
    if (!payload.birth_date) payload.birth_date = null
    if (!payload.email) payload.email = null
    if (!payload.phone) payload.phone = null
    if (!payload.social_security_number) payload.social_security_number = null
    
    if (editingId) {
      const { error } = await updateTrainee(editingId, payload)
      if (error) toast.error('Erreur lors de la modification')
      else { toast.success('Stagiaire modifié'); resetForm() }
    } else {
      const { error } = await createTrainee(payload)
      if (error) toast.error('Erreur lors de la création')
      else { toast.success('Stagiaire créé'); resetForm() }
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce stagiaire ?')) return
    const { error } = await deleteTrainee(id)
    if (error) toast.error('Erreur')
    else toast.success('Stagiaire supprimé')
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stagiaires</h1>
          <p className="text-gray-500 mt-1">{trainees.length} stagiaire(s)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouveau stagiaire
        </button>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          placeholder="Rechercher par nom, email ou entreprise..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="input pl-10" 
        />
      </div>
      
      <div className="card p-0 overflow-hidden">
        {traineesLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun stagiaire</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredItems.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.first_name} {item.last_name}</p>
                      <p className="text-sm text-gray-500">
                        {item.email || 'Pas d\'email'}
                        {item.phone && ` • ${item.phone}`}
                        {item.clients?.name && ` • ${item.clients.name}`}
                      </p>
                      {item.social_security_number && (
                        <p className="text-xs text-gray-400">N° SS : {item.social_security_number}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                  {editingId ? 'Modifier le stagiaire' : 'Nouveau stagiaire'}
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
                    <label className="label">Email</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={(e) => setFormData({...formData, email: e.target.value})} 
                      className="input"
                      placeholder="Pour évaluations à froid" 
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
                  <label className="label">N° Sécurité Sociale</label>
                  <input 
                    type="text" 
                    value={formData.social_security_number} 
                    onChange={(e) => setFormData({...formData, social_security_number: e.target.value})} 
                    className="input"
                    placeholder="Pour le Passeport Prévention"
                    maxLength={15}
                  />
                  <p className="text-xs text-gray-500 mt-1">Optionnel - Passeport Prévention</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date de naissance</label>
                    <input 
                      type="date" 
                      value={formData.birth_date} 
                      onChange={(e) => setFormData({...formData, birth_date: e.target.value})} 
                      className="input" 
                    />
                  </div>
                  <div>
                    <label className="label">Entreprise</label>
                    <select 
                      value={formData.client_id} 
                      onChange={(e) => setFormData({...formData, client_id: e.target.value})} 
                      className="input"
                    >
                      <option value="">Aucune</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
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
