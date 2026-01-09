import { useEffect, useState, useRef } from 'react'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Plus, Search, Edit, Trash2, X, Save, Building2, Mail, Phone, MapPin, User, Eye, Users, Upload, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'

// Formatage nom entreprise (majuscules)
const formatCompanyName = (value) => {
  if (!value) return ''
  return value.toUpperCase()
}

// Parser CSV Sellsy (séparateur ;, encodage ISO-8859-1)
const parseSellsyCSV = (csvText) => {
  const lines = csvText.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  
  // Parser l'en-tête
  const headers = lines[0].split(';').map(h => h.replace(/"/g, '').trim())
  
  // Trouver les index des colonnes importantes
  const getIdx = (name) => headers.findIndex(h => h.includes(name))
  const idx = {
    id: getIdx('ID SOCIETE SELLSY'),
    name: getIdx('NOM SOCIETE'),
    siret: getIdx('SIRET SOCIETE'),
    emailSociete: getIdx('EMAIL SOCIETE'),
    telSociete: getIdx('TELEPHONE SOCIETE'),
    adresse1: getIdx('ADRESSE PARTIE 1'),
    ville: getIdx('VILLE'),
    cp: getIdx('CODE POSTAL'),
    nomContact: getIdx('NOM CONTACT'),
    prenomContact: getIdx('PRENOM CONTACT'),
    emailContact: getIdx('EMAIL CONTACT'),
    telContact: getIdx('TELEPHONE CONTACT'),
    mobileContact: getIdx('MOBILE CONTACT'),
    fonctionContact: getIdx('FONCTION CONTACT'),
    contactPrincipal: getIdx('CONTACT PRINCIPAL'),
  }
  
  // Parser les lignes de données
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.replace(/"/g, '').trim())
    if (values.length < 5) continue
    
    rows.push({
      sellsy_id: values[idx.id] || '',
      name: values[idx.name] || '',
      siret: values[idx.siret]?.replace(/\s/g, '') || '',
      email_societe: values[idx.emailSociete] || '',
      tel_societe: values[idx.telSociete] || '',
      adresse: values[idx.adresse1] || '',
      ville: values[idx.ville] || '',
      cp: values[idx.cp] || '',
      contact_nom: values[idx.nomContact] || '',
      contact_prenom: values[idx.prenomContact] || '',
      contact_email: values[idx.emailContact] || '',
      contact_tel: values[idx.telContact] || values[idx.mobileContact] || '',
      contact_fonction: values[idx.fonctionContact] || '',
      contact_principal: values[idx.contactPrincipal] === 'Y',
    })
  }
  
  // Grouper par société (ID Sellsy)
  const societes = new Map()
  for (const row of rows) {
    if (!row.sellsy_id || !row.name) continue
    
    if (!societes.has(row.sellsy_id)) {
      societes.set(row.sellsy_id, {
        name: row.name.toUpperCase(),
        siret: row.siret,
        contact_email: row.email_societe,
        contact_phone: row.tel_societe,
        address: row.adresse,
        city: row.ville,
        postal_code: row.cp,
        contacts: []
      })
    }
    
    // Ajouter le contact si nom présent
    if (row.contact_nom) {
      societes.get(row.sellsy_id).contacts.push({
        name: `${row.contact_nom} ${row.contact_prenom}`.trim(),
        email: row.contact_email,
        phone: row.contact_tel,
        role: row.contact_fonction,
        is_primary: row.contact_principal
      })
    }
  }
  
  return Array.from(societes.values())
}

// Modal de confirmation
const ConfirmModal = ({ show, onConfirm, onCancel, message }) => {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-accent-100 rounded-full flex items-center justify-center">
            <span className="text-accent-600 font-bold text-lg">C</span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Campus vous demande</p>
            <p className="text-gray-900 font-medium">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn btn-secondary">Annuler</button>
          <button onClick={onConfirm} className="btn bg-red-600 text-white hover:bg-red-700">Confirmer</button>
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
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    name: '', siret: '', address: '', email: '', phone: '', contact_name: '', contact_function: '', notes: ''
  })
  
  useEffect(() => { fetchClients() }, [])
  
  const filtered = clients.filter(c => {
    const searchFields = `${c.name || ''} ${c.siret || ''} ${c.contact_name || ''} ${c.address || ''} ${c.email || ''} ${c.contact_email || ''}`.toLowerCase()
    return !search || searchFields.includes(search.toLowerCase())
  })
  
  const openForm = (client = null) => {
    if (client) {
      setForm({
        name: client.name || '',
        siret: client.siret || '',
        address: client.address || '',
        email: client.contact_email || client.email || '',
        phone: client.contact_phone || client.phone || '',
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
  
  const editContact = async (contactId, contactData) => {
    const { error } = await supabase.from('client_contacts').update(contactData).eq('id', contactId)
    if (error) toast.error('Erreur lors de la modification')
    else {
      toast.success('Contact modifié')
      const { data } = await supabase.from('client_contacts').select('*').eq('client_id', selectedClient.id).order('is_primary', { ascending: false })
      setContacts(data || [])
    }
  }
  
  // Import Sellsy CSV
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result
        const parsed = parseSellsyCSV(text)
        if (parsed.length === 0) {
          toast.error('Aucun client trouvé dans le fichier')
          return
        }
        setImportPreview(parsed)
      } catch (error) {
        console.error('Parse error:', error)
        toast.error('Erreur lors de la lecture du fichier')
      }
    }
    reader.readAsText(file, 'ISO-8859-1') // Encodage Sellsy
    e.target.value = '' // Reset pour permettre re-sélection
  }
  
  const executeImport = async () => {
    if (!importPreview || importPreview.length === 0) return
    setImporting(true)
    
    let created = 0
    let skipped = 0
    let contactsCreated = 0
    
    for (const societe of importPreview) {
      // Vérifier si le client existe déjà (par SIRET ou nom)
      const existingBySiret = societe.siret && clients.find(c => c.siret === societe.siret)
      const existingByName = clients.find(c => c.name?.toUpperCase() === societe.name?.toUpperCase())
      
      if (existingBySiret || existingByName) {
        skipped++
        continue
      }
      
      // Créer le client
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert([{
          name: societe.name,
          siret: societe.siret,
          contact_email: societe.contact_email,
          contact_phone: societe.contact_phone,
          address: societe.address,
          city: societe.city,
          postal_code: societe.postal_code,
        }])
        .select()
        .single()
      
      if (error) {
        console.error('Client creation error:', error)
        continue
      }
      
      created++
      
      // Créer les contacts
      if (newClient && societe.contacts.length > 0) {
        for (const contact of societe.contacts) {
          if (!contact.name) continue
          
          const { error: contactError } = await supabase
            .from('client_contacts')
            .insert([{
              client_id: newClient.id,
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              role: contact.role,
              is_primary: contact.is_primary,
            }])
          
          if (!contactError) contactsCreated++
        }
      }
    }
    
    await fetchClients()
    setImporting(false)
    setImportPreview(null)
    toast.success(`Import terminé : ${created} clients créés, ${contactsCreated} contacts, ${skipped} ignorés (déjà existants)`)
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500">{clients.length} client(s)</p>
        </div>
        <div className="flex gap-2">
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".csv" 
            onChange={handleFileSelect}
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="btn btn-secondary flex items-center gap-2"
            title="Importer depuis Sellsy"
          >
            <Upload className="w-4 h-4" />Import Sellsy
          </button>
          <button onClick={() => openForm()} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />Nouveau
          </button>
        </div>
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
                <td className="py-3 px-4 text-gray-600">{client.contact_email || '-'}</td>
                <td className="py-3 px-4 text-gray-600">{client.contact_phone || '-'}</td>
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
                {/* En-tête */}
                <div className="text-center pb-4 border-b">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold">{selectedClient.name}</h3>
                  {selectedClient.siret && <p className="text-sm text-gray-500">SIRET: {selectedClient.siret}</p>}
                </div>
                
                {/* Adresse */}
                {selectedClient.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Adresse</p>
                      <p className="whitespace-pre-line">{selectedClient.address}</p>
                    </div>
                  </div>
                )}
                
                {/* Contact générique (entreprise) */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Contact entreprise (générique)
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>{selectedClient.contact_email || <em className="text-gray-400">Non renseigné</em>}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-blue-600" />
                      <span>{selectedClient.contact_phone || <em className="text-gray-400">Non renseigné</em>}</span>
                    </div>
                  </div>
                </div>
                
                {/* Contact principal (personne) */}
                {selectedClient.contact_name && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <User className="w-4 h-4" /> Contact principal
                    </h4>
                    <p className="font-medium">{selectedClient.contact_name}</p>
                    {selectedClient.contact_function && (
                      <p className="text-sm text-gray-500">{selectedClient.contact_function}</p>
                    )}
                  </div>
                )}
                
                {/* Contacts spécifiques */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" /> Contacts spécifiques ({contacts.length})
                    </h4>
                    <ContactForm onAdd={addContact} />
                  </div>
                  {contacts.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-2">
                      Aucun contact spécifique.<br/>
                      <span className="text-xs">Ajoutez des contacts pour les choisir lors de la création de sessions.</span>
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {contacts.map(contact => (
                        <div key={contact.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">
                              {contact.name}
                              {contact.is_primary && <span className="text-xs bg-green-100 text-green-700 px-1 ml-1 rounded">Principal</span>}
                            </p>
                            {contact.role && <p className="text-xs text-gray-500">{contact.role}</p>}
                            <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-1">
                              {contact.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{contact.email}</span>}
                              {contact.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{contact.phone}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <ContactForm onEdit={editContact} contact={contact} buttonLabel="✏️" />
                            <button onClick={() => deleteContact(contact.id)} className="p-1 text-red-400 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Notes */}
                {selectedClient.notes && (
                  <div>
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="text-sm whitespace-pre-line">{selectedClient.notes}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 p-4 border-t">
                <button onClick={() => { setShowPreview(false); openForm(selectedClient) }} className="btn btn-primary">
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
                
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-700 mb-3">Contact entreprise (générique)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Email entreprise</label>
                      <input type="email" className="input" placeholder="contact@entreprise.fr" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">Téléphone entreprise</label>
                      <input type="tel" className="input" placeholder="02 XX XX XX XX" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
                    </div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-700 mb-3">Contact principal (personne)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Nom du contact</label>
                      <input type="text" className="input" placeholder="Jean DUPONT" value={form.contact_name} onChange={(e) => setForm({...form, contact_name: e.target.value})} />
                    </div>
                    <div>
                      <label className="label">Fonction</label>
                      <input type="text" className="input" placeholder="Ex: Dirigeant, RH..." value={form.contact_function} onChange={(e) => setForm({...form, contact_function: e.target.value})} />
                    </div>
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
      
      {/* Modal Import Sellsy Preview */}
      {importPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => !importing && setImportPreview(null)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b bg-blue-50">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                  <div>
                    <h2 className="text-lg font-semibold">Import Sellsy</h2>
                    <p className="text-sm text-gray-600">{importPreview.length} société(s) détectée(s)</p>
                  </div>
                </div>
                {!importing && <button onClick={() => setImportPreview(null)}><X className="w-5 h-5" /></button>}
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Société</th>
                      <th className="text-left py-2 px-3 font-medium">SIRET</th>
                      <th className="text-left py-2 px-3 font-medium">Email</th>
                      <th className="text-center py-2 px-3 font-medium">Contacts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importPreview.slice(0, 50).map((societe, idx) => {
                      const exists = (societe.siret && clients.find(c => c.siret === societe.siret)) ||
                                     clients.find(c => c.name?.toUpperCase() === societe.name?.toUpperCase())
                      return (
                        <tr key={idx} className={exists ? 'bg-yellow-50' : ''}>
                          <td className="py-2 px-3">
                            <div className="font-medium">{societe.name}</div>
                            {societe.city && <div className="text-xs text-gray-500">{societe.cp} {societe.city}</div>}
                            {exists && <span className="text-xs text-yellow-600">⚠️ Existe déjà</span>}
                          </td>
                          <td className="py-2 px-3 text-gray-600 font-mono text-xs">{societe.siret || '-'}</td>
                          <td className="py-2 px-3 text-gray-600 text-xs">{societe.contact_email || '-'}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {societe.contacts.length}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {importPreview.length > 50 && (
                  <p className="text-center text-gray-500 text-sm mt-2">... et {importPreview.length - 50} autres</p>
                )}
              </div>
              
              <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                <p className="text-sm text-gray-600">
                  Les sociétés existantes (même SIRET ou nom) seront ignorées
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setImportPreview(null)} 
                    className="btn btn-secondary"
                    disabled={importing}
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={executeImport} 
                    className="btn btn-primary flex items-center gap-2"
                    disabled={importing}
                  >
                    {importing ? (
                      <>
                        <span className="animate-spin">⏳</span> Import en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" /> Importer
                      </>
                    )}
                  </button>
                </div>
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
function ContactForm({ onAdd, onEdit, contact = null, buttonLabel = '+ Ajouter' }) {
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', email: '', phone: '', is_primary: false })
  
  const openForm = () => {
    if (contact) {
      setForm({
        name: contact.name || '',
        role: contact.role || '',
        email: contact.email || '',
        phone: contact.phone || '',
        is_primary: contact.is_primary || false
      })
    } else {
      setForm({ name: '', role: '', email: '', phone: '', is_primary: false })
    }
    setShow(true)
  }
  
  const handleSubmit = () => {
    if (!form.name) return toast.error('Nom requis')
    if (contact && onEdit) {
      onEdit(contact.id, form)
    } else {
      onAdd(form)
    }
    setForm({ name: '', role: '', email: '', phone: '', is_primary: false })
    setShow(false)
  }
  
  if (!show) return <button onClick={openForm} className="text-sm text-primary hover:underline">{buttonLabel}</button>
  
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={() => setShow(false)} />
      <div className="relative bg-white rounded-lg shadow-lg p-4 w-80">
        <h4 className="font-medium mb-3">{contact ? 'Modifier' : 'Nouveau'} contact</h4>
        <div className="space-y-2">
          <input type="text" placeholder="Nom *" className="input text-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <input type="text" placeholder="Fonction" className="input text-sm" value={form.role} onChange={e => setForm({...form, role: e.target.value})} />
          <input type="email" placeholder="Email" className="input text-sm" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <input type="tel" placeholder="Téléphone" className="input text-sm" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_primary} onChange={e => setForm({...form, is_primary: e.target.checked})} />Contact principal</label>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={() => setShow(false)} className="btn btn-secondary btn-sm">Annuler</button>
          <button onClick={handleSubmit} className="btn btn-primary btn-sm">{contact ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  )
}
