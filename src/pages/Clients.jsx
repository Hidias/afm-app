import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Plus, Search, Edit, Trash2, X, Save, Building2, Mail, Phone, MapPin, User, Eye, Users } from 'lucide-react'
import toast from 'react-hot-toast'

// Formatage nom entreprise (majuscules)
const formatCompanyName = (value) => {
  if (!value) return ''
  return value.toUpperCase()
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

export default function Clients() {
  const { clients, fetchClients, createClient, updateClient, deleteClient } = useDataStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [contacts, setContacts] = useState([])
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
  
  const openPreview = async (client) => {
    setSelectedClient(client)
    // Charger les contacts
    const { data } = await supabase.from('client_contacts').select('*').eq('client_id', client.id).order('is_primary', { ascending: false })
    setContacts(data || [])
    setShowPreview(true)
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
  
  const handleDelete = async () => {
    if (!confirmDelete) return
    await deleteClient(confirmDelete)
    toast.success('Client supprimé')
    setConfirmDelete(null)
  }
  
  // Gestion des contacts
  const addContact = async (contactData) => {
    if (!selectedClient) return
    const { error } = await supabase.from('client_contacts').insert([{ ...contactData, client_id: selectedClient.id }])
    if (error) toast.error('Erreur')
    else {
      toast.success('Contact ajouté')
      const { data } = await supabase.from('client_contacts').select('*').eq('client_id', selectedClient.id).order('is_primary', { ascending: false })
      setContacts(data || [])
    }
  }
  
  const deleteContact = async (contactId) => {
    const { error } = await supabase.from('client_contacts').delete().eq('id', contactId)
    if (error) toast.error('Erreur')
    else {
      toast.success('Contact supprimé')
      setContacts(contacts.filter(c => c.id !== contactId))
    }
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
                  <button onClick={() => openPreview(client)} className="font-medium text-primary-600 hover:underline flex items-center gap-2">
                    <Building2 className="w-4 h-4" />{client.name}
                  </button>
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
                    <button onClick={() => openPreview(client)} className="p-2 hover:bg-gray-100 rounded" title="Aperçu"><Eye className="w-4 h-4 text-blue-500" /></button>
                    <button onClick={() => openForm(client)} className="p-2 hover:bg-gray-100 rounded" title="Modifier"><Edit className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => setConfirmDelete(client.id)} className="p-2 hover:bg-gray-100 rounded" title="Supprimer"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-gray-500">Aucun client</td></tr>}
          </tbody>
        </table>
      </div>
      
      {/* Modal Aperçu */}
      {showPreview && selectedClient && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPreview(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                <h2 className="text-lg font-semibold">Fiche client</h2>
                <button onClick={() => setShowPreview(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div className="text-center pb-4 border-b">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold">{selectedClient.name}</h3>
                  {selectedClient.siret && <p className="text-sm text-gray-500">SIRET: {selectedClient.siret}</p>}
                </div>
                
                {selectedClient.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Adresse</p>
                      <p className="whitespace-pre-line">{selectedClient.address}</p>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p>{selectedClient.email || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Téléphone</p>
                      <p>{selectedClient.phone || '-'}</p>
                    </div>
                  </div>
                </div>
                
                {/* Contact principal (ancien système) */}
                {selectedClient.contact_name && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-500 mb-1">Contact principal</p>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">{selectedClient.contact_name}</span>
                      {selectedClient.contact_function && <span className="text-sm text-gray-500">({selectedClient.contact_function})</span>}
                    </div>
                  </div>
                )}
                
                {/* Contacts multiples */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium flex items-center gap-2"><Users className="w-4 h-4" />Contacts ({contacts.length})</h4>
                    <ContactForm onAdd={addContact} />
                  </div>
                  {contacts.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Aucun contact supplémentaire</p>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map(contact => (
                        <div key={contact.id} className="flex items-center justify-between p-2 border rounded-lg">
                          <div>
                            <p className="font-medium">{contact.name} {contact.is_primary && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">Principal</span>}</p>
                            {contact.role && <p className="text-xs text-gray-500">{contact.role}</p>}
                            <div className="flex gap-3 text-xs text-gray-500">
                              {contact.email && <span>{contact.email}</span>}
                              {contact.phone && <span>{contact.phone}</span>}
                            </div>
                          </div>
                          <button onClick={() => deleteContact(contact.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {selectedClient.notes && (
                  <div>
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="text-sm whitespace-pre-line">{selectedClient.notes}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 p-4 border-t">
                <Link to={`/clients/${selectedClient.id}`} className="btn btn-secondary">Voir détails</Link>
                <button onClick={() => { setShowPreview(false); openForm(selectedClient) }} className="btn btn-primary"><Edit className="w-4 h-4 mr-2" />Modifier</button>
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
                <h2 className="text-lg font-semibold">{selectedClient ? 'Modifier' : 'Nouveau'} client</h2>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="label">Raison sociale *</label>
                  <input type="text" className="input uppercase" value={form.name} onChange={(e) => setForm({...form, name: formatCompanyName(e.target.value)})} />
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
                    <input type="text" className="input" placeholder="Ex: Dirigeant, RH..." value={form.contact_function} onChange={(e) => setForm({...form, contact_function: e.target.value})} />
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
      
      <ConfirmModal show={!!confirmDelete} message="Supprimer ce client ?" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
    </div>
  )
}

// Composant pour ajouter un contact
function ContactForm({ onAdd }) {
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', email: '', phone: '', is_primary: false })
  
  const handleSubmit = () => {
    if (!form.name) return toast.error('Nom requis')
    onAdd(form)
    setForm({ name: '', role: '', email: '', phone: '', is_primary: false })
    setShow(false)
  }
  
  if (!show) return <button onClick={() => setShow(true)} className="text-sm text-primary hover:underline">+ Ajouter</button>
  
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={() => setShow(false)} />
      <div className="relative bg-white rounded-lg shadow-lg p-4 w-80">
        <h4 className="font-medium mb-3">Nouveau contact</h4>
        <div className="space-y-2">
          <input type="text" placeholder="Nom *" className="input text-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <input type="text" placeholder="Fonction" className="input text-sm" value={form.role} onChange={e => setForm({...form, role: e.target.value})} />
          <input type="email" placeholder="Email" className="input text-sm" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <input type="tel" placeholder="Téléphone" className="input text-sm" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_primary} onChange={e => setForm({...form, is_primary: e.target.checked})} />Contact principal</label>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={() => setShow(false)} className="btn btn-secondary btn-sm">Annuler</button>
          <button onClick={handleSubmit} className="btn btn-primary btn-sm">Ajouter</button>
        </div>
      </div>
    </div>
  )
}
