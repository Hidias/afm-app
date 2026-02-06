import { useEffect, useState, useRef } from 'react'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Plus, Search, Edit, Trash2, X, Save, Building2, Mail, Phone, MapPin, User, Eye, Users, Upload, FileSpreadsheet, FileText } from 'lucide-react'
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

// Parser texte libre (Pappers, Infogreffe, etc.)
const parseProspectText = (text) => {
  const prospects = []
  
  // Pattern pour détecter les entreprises
  // Supporte : Pappers, Infogreffe, Societe.com, etc.
  const lines = text.split('\n').map(l => l.trim()).filter(l => l)
  
  let currentProspect = null
  let lastKey = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Détecter un nouveau prospect (nom en majuscules au début ou après un ensemble de données)
    // Un nom d'entreprise est généralement en majuscules et ne contient pas de ":" ni de chiffres au début
    const isLikelyCompanyName = 
      /^[A-ZÀ-ÿ][A-ZÀ-ÿ\s&'\-]{2,}$/.test(line) && 
      !line.includes(':') &&
      !line.match(/^\d/) &&
      line.length > 3 &&
      line.length < 100
    
    if (isLikelyCompanyName && 
        (currentProspect === null || 
         (currentProspect.ville && currentProspect.activity))) {
      // Sauvegarder le prospect précédent
      if (currentProspect && currentProspect.name && currentProspect.ville) {
        prospects.push(currentProspect)
      }
      
      // Nouveau prospect
      currentProspect = {
        name: line.toUpperCase(),
        legal_form: '',
        activity: '',
        naf_code: '',
        ville: '',
        postal_code: '',
        effectif: '',
        capital: ''
      }
      lastKey = 'name'
      continue
    }
    
    if (!currentProspect) continue
    
    // Forme juridique
    if (line.match(/Forme Juridique/i)) {
      lastKey = 'legal_form'
      continue
    }
    
    // Activité
    if (line.match(/Activité/i)) {
      lastKey = 'activity'
      continue
    }
    
    // Code NAF
    const nafMatch = line.match(/Code NAF\s*:?\s*(\d{2}\.\d{2}[A-Z]?)/i)
    if (nafMatch) {
      currentProspect.naf_code = nafMatch[1]
      continue
    }
    
    // Lieu / Ville
    if (line.match(/Lieu/i)) {
      lastKey = 'ville'
      continue
    }
    
    // Code postal
    const cpMatch = line.match(/Code postal\s*:?\s*(\d{5})/i)
    if (cpMatch) {
      currentProspect.postal_code = cpMatch[1]
      continue
    }
    
    // Effectif
    const effectifMatch = line.match(/Effectif\s*:?\s*(.*salariés?|.*\d+\s*et\s*\d+)/i)
    if (effectifMatch) {
      currentProspect.effectif = effectifMatch[1]
      continue
    }
    
    // Capital
    const capitalMatch = line.match(/Capital\s*:?\s*([\d\s,\.]+\s*€)/i)
    if (capitalMatch) {
      currentProspect.capital = capitalMatch[1].trim()
      continue
    }
    
    // Remplir le champ actuel
    if (lastKey && line.length > 2 && line.length < 200) {
      if (lastKey === 'legal_form' && !currentProspect.legal_form && 
          line.match(/(EURL|SARL|SAS|SA|SCI|SASU|Auto-entrepreneur|Micro)/i)) {
        currentProspect.legal_form = line
        lastKey = null
      } else if (lastKey === 'activity' && !currentProspect.activity && 
                 !line.match(/Code NAF|Lieu|Effectif/i)) {
        currentProspect.activity = line
        lastKey = null
      } else if (lastKey === 'ville' && !currentProspect.ville && 
                 !line.match(/Code postal|Effectif/i)) {
        currentProspect.ville = line
        lastKey = null
      }
    }
  }
  
  // Ajouter le dernier prospect
  if (currentProspect && currentProspect.name && currentProspect.ville) {
    prospects.push(currentProspect)
  }
  
  // Nettoyer et formater
  return prospects.map(p => ({
    name: p.name.toUpperCase(),
    address: `${p.ville}${p.postal_code ? ' ' + p.postal_code : ''}`,
    city: p.ville,
    postal_code: p.postal_code,
    notes: [
      p.legal_form && `Forme juridique: ${p.legal_form}`,
      p.activity && `Activité: ${p.activity}`,
      p.naf_code && `Code NAF: ${p.naf_code}`,
      p.effectif && `Effectif: ${p.effectif}`,
      p.capital && `Capital: ${p.capital}`
    ].filter(Boolean).join('\n'),
    contact_email: '',
    contact_phone: '',
    contacts: []
  }))
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
  const [filterStatus, setFilterStatus] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [contacts, setContacts] = useState([])
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [showTextImport, setShowTextImport] = useState(false)
  const [textImportValue, setTextImportValue] = useState('')
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    name: '', siret: '', address: '', email: '', phone: '', contact_name: '', contact_function: '', notes: '', status: 'prospect'
  })
  
  useEffect(() => { fetchClients() }, [])
  
  const filtered = clients.filter(c => {
    const searchFields = `${c.name || ''} ${c.siret || ''} ${c.contact_name || ''} ${c.address || ''} ${c.email || ''} ${c.contact_email || ''}`.toLowerCase()
    const matchSearch = !search || searchFields.includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    return matchSearch && matchStatus
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
        status: client.status || 'prospect',
      })
      setSelectedClient(client)
    } else {
      setForm({ name: '', siret: '', address: '', email: '', phone: '', contact_name: '', contact_function: '', notes: '', status: 'prospect' })
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
      await updateClient(selectedClient.id, { 
        ...form, 
        name: formatCompanyName(form.name),
        contact_email: form.email,
        contact_phone: form.phone
      })
      toast.success('Client mis à jour')
    } else {
      await createClient({ 
        ...form, 
        name: formatCompanyName(form.name),
        contact_email: form.email,
        contact_phone: form.phone
      })
      toast.success('Client créé')
    }
    setShowForm(false)
  }
  
  const handleDeleteClick = (client) => setConfirmDelete(client)
  
  const handleDelete = async () => {
    if (confirmDelete) {
      await deleteClient(confirmDelete.id)
      toast.success('Client supprimé')
      setConfirmDelete(null)
    }
  }
  
  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setImporting(true)
    
    try {
      const text = await file.text()
      const societes = parseSellsyCSV(text)
      
      if (societes.length === 0) {
        toast.error('Aucune société détectée dans le CSV')
        return
      }
      
      setImportPreview(societes)
    } catch (err) {
      console.error('Erreur parsing CSV:', err)
      toast.error('Erreur lors de la lecture du fichier')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }
  
  const handleTextImportAnalyze = () => {
    if (!textImportValue.trim()) {
      return toast.error('Veuillez coller du texte')
    }
    
    try {
      const prospects = parseProspectText(textImportValue)
      
      if (prospects.length === 0) {
        toast.error('Aucune entreprise détectée dans le texte')
        return
      }
      
      setImportPreview(prospects)
      setShowTextImport(false)
      setTextImportValue('')
    } catch (err) {
      console.error('Erreur parsing texte:', err)
      toast.error('Erreur lors de l\'analyse du texte')
    }
  }
  
  const executeImport = async () => {
    if (!importPreview || importing) return
    
    setImporting(true)
    let created = 0
    let skipped = 0
    
    try {
      for (const societe of importPreview) {
        // Vérifier si existe déjà (SIRET ou nom exact)
        const exists = (societe.siret && clients.find(c => c.siret === societe.siret)) ||
                       clients.find(c => c.name?.toUpperCase() === societe.name?.toUpperCase())
        
        if (exists) {
          skipped++
          continue
        }
        
        // Créer le client avec statut "À compléter"
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: societe.name,
            siret: societe.siret || null,
            address: societe.address || null,
            contact_email: societe.contact_email || null,
            contact_phone: societe.contact_phone || null,
            notes: societe.notes || null,
            status: 'a_completer', // Statut "À compléter" pour prospects importés
            city: societe.city || null,
            postal_code: societe.postal_code || null
          })
          .select()
          .single()
        
        if (clientError) {
          console.error('Erreur création client:', clientError)
          continue
        }
        
        // Créer les contacts associés si présents
        if (societe.contacts && societe.contacts.length > 0 && newClient) {
          const contactsToInsert = societe.contacts.map(c => ({
            client_id: newClient.id,
            name: c.name,
            email: c.email || null,
            phone: c.phone || null,
            role: c.role || null,
            is_primary: c.is_primary || false
          }))
          
          const { error: contactsError } = await supabase
            .from('client_contacts')
            .insert(contactsToInsert)
          
          if (contactsError) {
            console.error('Erreur création contacts:', contactsError)
          }
        }
        
        created++
      }
      
      // Recharger les clients
      await fetchClients()
      
      toast.success(`✅ ${created} prospect(s) importé(s)${skipped > 0 ? ` • ${skipped} ignoré(s) (doublons)` : ''}`)
      setImportPreview(null)
    } catch (err) {
      console.error('Erreur import:', err)
      toast.error('Erreur lors de l\'import')
    } finally {
      setImporting(false)
    }
  }
  
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 text-sm mt-1">{filtered.length} client{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowTextImport(true)} 
            className="btn btn-secondary flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Import prospects
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="btn btn-secondary flex items-center gap-2"
            disabled={importing}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import CSV
          </button>
          <input 
            ref={fileInputRef} 
            type="file" 
            accept=".csv,.txt" 
            className="hidden" 
            onChange={handleFileSelect}
          />
          <button onClick={() => openForm()} className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />Nouveau client
          </button>
        </div>
      </div>
      
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              className="input pl-10" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-full sm:w-48" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Tous les statuts</option>
            <option value="prospect">Prospect</option>
            <option value="en_discussion">En discussion</option>
            <option value="actif">Actif</option>
            <option value="a_completer">À compléter</option>
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(client => (
          <div key={client.id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{client.name}</h3>
                {client.address && (
                  <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{client.address}</span>
                  </div>
                )}
                {client.contact_email && (
                  <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{client.contact_email}</span>
                  </div>
                )}
                {client.contact_phone && (
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{client.contact_phone}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openPreview(client)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-50 rounded transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => openForm(client)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-50 rounded transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDeleteClick(client)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-3 border-t">
              {client.status === 'actif' && <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ Actif</span>}
              {client.status === 'en_discussion' && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">💬 En discussion</span>}
              {client.status === 'prospect' && <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">🎯 Prospect</span>}
              {client.status === 'a_completer' && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">📝 À compléter</span>}
            </div>
          </div>
        ))}
        
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucun client trouvé</p>
          </div>
        )}
      </div>
      
      {/* Modal Preview */}
      {showPreview && selectedClient && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPreview(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">{selectedClient.name}</h2>
                <button onClick={() => setShowPreview(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                {selectedClient.siret && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">SIRET</label>
                    <p className="text-gray-900 font-mono">{selectedClient.siret}</p>
                  </div>
                )}
                {selectedClient.address && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Adresse</label>
                    <p className="text-gray-900">{selectedClient.address}</p>
                  </div>
                )}
                {(selectedClient.contact_email || selectedClient.contact_phone) && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Contact</label>
                    {selectedClient.contact_email && <p className="text-gray-900">{selectedClient.contact_email}</p>}
                    {selectedClient.contact_phone && <p className="text-gray-900">{selectedClient.contact_phone}</p>}
                  </div>
                )}
                {selectedClient.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Notes</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedClient.notes}</p>
                  </div>
                )}
                
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-700">Contacts ({contacts.length})</h4>
                    <ContactForm onAdd={async (contactData) => {
                      const { error } = await supabase.from('client_contacts').insert({ ...contactData, client_id: selectedClient.id })
                      if (error) return toast.error('Erreur')
                      const { data } = await supabase.from('client_contacts').select('*').eq('client_id', selectedClient.id).order('is_primary', { ascending: false })
                      setContacts(data || [])
                      toast.success('Contact ajouté')
                    }} />
                  </div>
                  {contacts.length === 0 ? (
                    <p className="text-gray-500 text-sm">Aucun contact</p>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{c.name}</p>
                              {c.is_primary && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Principal</span>}
                            </div>
                            {c.role && <p className="text-sm text-gray-600">{c.role}</p>}
                            {c.email && <p className="text-sm text-gray-600">{c.email}</p>}
                            {c.phone && <p className="text-sm text-gray-600">{c.phone}</p>}
                          </div>
                          <div className="flex gap-1">
                            <ContactForm 
                              contact={c}
                              buttonLabel={<Edit className="w-4 h-4" />}
                              onEdit={async (id, contactData) => {
                                const { error } = await supabase.from('client_contacts').update(contactData).eq('id', id)
                                if (error) return toast.error('Erreur')
                                const { data } = await supabase.from('client_contacts').select('*').eq('client_id', selectedClient.id).order('is_primary', { ascending: false })
                                setContacts(data || [])
                                toast.success('Contact modifié')
                              }}
                            />
                            <button
                              onClick={async () => {
                                if (!confirm('Supprimer ce contact ?')) return
                                const { error } = await supabase.from('client_contacts').delete().eq('id', c.id)
                                if (error) return toast.error('Erreur')
                                const { data } = await supabase.from('client_contacts').select('*').eq('client_id', selectedClient.id).order('is_primary', { ascending: false })
                                setContacts(data || [])
                                toast.success('Contact supprimé')
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">{selectedClient ? 'Modifier' : 'Nouveau'} client</h2>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="label">Nom de l'entreprise *</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({...form, name: formatCompanyName(e.target.value)})} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">SIRET</label>
                    <input className="input" value={form.siret} onChange={(e) => setForm({...form, siret: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Téléphone</label>
                    <input type="tel" className="input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Adresse</label>
                    <input className="input" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Contact principal</label>
                    <input className="input" placeholder="Nom du contact" value={form.contact_name} onChange={(e) => setForm({...form, contact_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Fonction</label>
                    <input className="input" placeholder="Ex: Directeur" value={form.contact_function} onChange={(e) => setForm({...form, contact_function: e.target.value})} />
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-700 mb-3">Statut</h4>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: 'prospect', label: '🎯 Prospect', active: 'bg-orange-500 text-white', inactive: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
                      { value: 'en_discussion', label: '💬 En discussion', active: 'bg-blue-500 text-white', inactive: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                      { value: 'actif', label: '✓ Actif', active: 'bg-green-500 text-white', inactive: 'bg-green-50 text-green-700 hover:bg-green-100' },
                      { value: 'a_completer', label: '📝 À compléter', active: 'bg-purple-500 text-white', inactive: 'bg-purple-50 text-purple-700 hover:bg-purple-100' }
                    ].map(s => (
                      <button key={s.value} type="button" onClick={() => setForm({...form, status: s.value})}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${form.status === s.value ? s.active : s.inactive}`}>
                        {s.label}
                      </button>
                    ))}
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
      
      {/* Modal Import Texte */}
      {showTextImport && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowTextImport(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b bg-purple-50">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-purple-600" />
                  <div>
                    <h2 className="text-lg font-semibold">Import prospects en masse</h2>
                    <p className="text-sm text-gray-600">Pappers, Infogreffe, Societe.com...</p>
                  </div>
                </div>
                <button onClick={() => setShowTextImport(false)}><X className="w-5 h-5" /></button>
              </div>
              
              <div className="p-4">
                <label className="label mb-2">Collez ici les données d'entreprises</label>
                <textarea 
                  className="input w-full font-mono text-sm"
                  rows={20}
                  value={textImportValue}
                  onChange={(e) => setTextImportValue(e.target.value)}
                  placeholder="GARDEN CONCEPTS&#10;Forme Juridique&#10;EURL&#10;Activité&#10;Services d'aménagement paysager&#10;Code NAF : 81.30Z&#10;Lieu&#10;PLOUDALMEZEAU&#10;Code postal : 29830&#10;Effectif : Entre 10 et 19 salariés&#10;..."
                />
              </div>
              
              <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                <p className="text-sm text-gray-600">
                  Les prospects seront créés avec le statut "À compléter"
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowTextImport(false)} 
                    className="btn btn-secondary"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={handleTextImportAnalyze} 
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" /> Analyser
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Import Preview (Sellsy ou Texte) */}
      {importPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => !importing && setImportPreview(null)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b bg-blue-50">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                  <div>
                    <h2 className="text-lg font-semibold">Prévisualisation import</h2>
                    <p className="text-sm text-gray-600">{importPreview.length} prospect(s) détecté(s)</p>
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
                            {societe.city && <div className="text-xs text-gray-500">{societe.postal_code} {societe.city}</div>}
                            {exists && <span className="text-xs text-yellow-600">⚠️ Existe déjà</span>}
                          </td>
                          <td className="py-2 px-3 text-gray-600 font-mono text-xs">{societe.siret || '-'}</td>
                          <td className="py-2 px-3 text-gray-600 text-xs">{societe.contact_email || '-'}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {societe.contacts?.length || 0}
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
                  Les prospects existants (même SIRET ou nom) seront ignorés
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
