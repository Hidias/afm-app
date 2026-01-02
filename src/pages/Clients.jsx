import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { Plus, Search, Edit, Trash2, X, Save, Building2, Mail, Phone, MapPin, User } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Clients() {
  const { clients, fetchClients, createClient, updateClient, deleteClient } = useDataStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [form, setForm] = useState({
    name: '', siret: '', address: '', email: '', phone: '', contact_name: '', contact_function: '', notes: ''
  })
  
  useEffect(() => { fetchClients() }, [])
  
  const filtered = clients.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.siret?.includes(search) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  )
  
  const openForm = (client = null) => {
    if (client) {
      setForm({
        name: client.name || '',
        siret: client.siret || '',
        address: client.address || '',
        email: client.email || '',
        phone: client.phone || '',
        contact_name: client.contact_name || '',
        contact_function: client.contact_function || '',
        notes: client.notes || '',
      })
      setSelectedClient(client)
    } else {
      setForm({ name: '', siret: '', address: '', email: '', phone: '', contact_name: '', contact_function: '', notes: '' })
      setSelectedClient(null)
    }
    setShowForm(true)
  }
  
  const handleSave = async () => {
    if (!form.name) return toast.error('Nom requis')
    if (selectedClient) {
      await updateClient(selectedClient.id, form)
      toast.success('Client modifié')
    } else {
      await createClient(form)
      toast.success('Client créé')
    }
    setShowForm(false)
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce client ?')) return
    await deleteClient(id)
    toast.success('Client supprimé')
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500">{clients.length} client(s)</p>
        </div>
        <button onClick={() => openForm()} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />Nouveau
        </button>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Rechercher..." className="input pl-10 w-full max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Entreprise</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">SIRET</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Contact</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Téléphone</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(client => (
              <tr key={client.id} className="hover:bg-gray-50">
                <td className="py-3 px-4">
                  <Link to={`/clients/${client.id}`} className="font-medium text-primary-600 hover:underline flex items-center gap-2">
                    <Building2 className="w-4 h-4" />{client.name}
                  </Link>
                </td>
                <td className="py-3 px-4 text-gray-600">{client.siret || '-'}</td>
                <td className="py-3 px-4 text-gray-600">
                  {client.contact_name || '-'}
                  {client.contact_function && <span className="text-xs text-gray-400 ml-1">({client.contact_function})</span>}
                </td>
                <td className="py-3 px-4 text-gray-600">{client.email || '-'}</td>
                <td className="py-3 px-4 text-gray-600">{client.phone || '-'}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openForm(client)} className="p-2 hover:bg-gray-100 rounded"><Edit className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => handleDelete(client.id)} className="p-2 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-gray-500">Aucun client</td></tr>}
          </tbody>
        </table>
      </div>
      
      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">{selectedClient ? 'Modifier' : 'Nouveau'} client</h2>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="label">Raison sociale *</label>
                  <input type="text" className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
                </div>
                <div>
                  <label className="label">SIRET</label>
                  <input type="text" className="input" value={form.siret} onChange={(e) => setForm({...form, siret: e.target.value})} />
                </div>
                <div>
                  <label className="label">Adresse</label>
                  <textarea className="input" rows={2} value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Téléphone</label>
                    <input type="tel" className="input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nom du contact</label>
                    <input type="text" className="input" value={form.contact_name} onChange={(e) => setForm({...form, contact_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Fonction</label>
                    <input type="text" className="input" placeholder="Ex: Dirigeant, RH, Responsable..." value={form.contact_function} onChange={(e) => setForm({...form, contact_function: e.target.value})} />
                  </div>
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
    </div>
  )
}
