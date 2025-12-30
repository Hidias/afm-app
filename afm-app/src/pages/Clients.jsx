import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { 
  Building2, 
  Plus, 
  Search, 
  MoreVertical,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Clients() {
  const location = useLocation()
  const { clients, clientsLoading, fetchClients, createClient, updateClient, deleteClient } = useDataStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(location.state?.openNew || false)
  const [editingClient, setEditingClient] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    siret: '',
    address: '',
    postal_code: '',
    city: '',
    phone: '',
    email: '',
    notes: ''
  })
  
  useEffect(() => {
    fetchClients()
  }, [fetchClients])
  
  useEffect(() => {
    if (location.state?.openNew) {
      setShowForm(true)
      // Clear the state
      window.history.replaceState({}, document.title)
    }
  }, [location])
  
  const filteredClients = clients.filter(client =>
    client.name?.toLowerCase().includes(search.toLowerCase()) ||
    client.city?.toLowerCase().includes(search.toLowerCase()) ||
    client.siret?.includes(search)
  )
  
  const resetForm = () => {
    setFormData({
      name: '',
      siret: '',
      address: '',
      postal_code: '',
      city: '',
      phone: '',
      email: '',
      notes: ''
    })
    setEditingClient(null)
    setShowForm(false)
  }
  
  const handleEdit = (client) => {
    setEditingClient(client)
    setFormData({
      name: client.name || '',
      siret: client.siret || '',
      address: client.address || '',
      postal_code: client.postal_code || '',
      city: client.city || '',
      phone: client.phone || '',
      email: client.email || '',
      notes: client.notes || ''
    })
    setShowForm(true)
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (editingClient) {
      const { error } = await updateClient(editingClient.id, formData)
      if (error) {
        toast.error('Erreur lors de la modification')
      } else {
        toast.success('Client modifié')
        resetForm()
      }
    } else {
      const { error } = await createClient(formData)
      if (error) {
        toast.error('Erreur lors de la création')
      } else {
        toast.success('Client créé')
        resetForm()
      }
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce client ?')) return
    
    const { error } = await deleteClient(id)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Client supprimé')
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">{clients.length} client(s)</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouveau client
        </button>
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>
      
      {/* Liste */}
      <div className="card p-0 overflow-hidden">
        {clientsLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {search ? 'Aucun résultat' : 'Aucun client'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredClients.map((client) => (
              <div key={client.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <Link to={`/clients/${client.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{client.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          {client.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {client.city}
                            </span>
                          )}
                          {client.siret && (
                            <span>SIRET: {client.siret}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                  
                  <div className="flex items-center gap-2">
                    {client.email && (
                      <a href={`mailto:${client.email}`} className="p-2 hover:bg-gray-100 rounded-lg">
                        <Mail className="w-4 h-4 text-gray-400" />
                      </a>
                    )}
                    {client.phone && (
                      <a href={`tel:${client.phone}`} className="p-2 hover:bg-gray-100 rounded-lg">
                        <Phone className="w-4 h-4 text-gray-400" />
                      </a>
                    )}
                    <button 
                      onClick={() => handleEdit(client)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit className="w-4 h-4 text-gray-400" />
                    </button>
                    <button 
                      onClick={() => handleDelete(client.id)}
                      className="p-2 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg animate-fadeIn">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">
                  {editingClient ? 'Modifier le client' : 'Nouveau client'}
                </h2>
                <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div>
                  <label className="label">Raison sociale *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                
                <div>
                  <label className="label">SIRET</label>
                  <input
                    type="text"
                    value={formData.siret}
                    onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                    className="input"
                    maxLength={14}
                  />
                </div>
                
                <div>
                  <label className="label">Adresse</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="input"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Code postal</label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Ville</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input"
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={resetForm} className="btn btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingClient ? 'Enregistrer' : 'Créer'}
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
