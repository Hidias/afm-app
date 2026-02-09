import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Building2, MapPin, Phone, Mail, Globe, Edit, Save, X, Plus, Trash2, User, Clock, MessageSquare, Calendar, FileText, GraduationCap, Star, ChevronDown, ChevronUp, Send, StickyNote, Receipt, RefreshCw, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUS_OPTIONS = [
  { value: 'prospect', label: '🎯 Prospect', color: 'bg-orange-100 text-orange-700' },
  { value: 'en_discussion', label: '💬 En discussion', color: 'bg-blue-100 text-blue-700' },
  { value: 'actif', label: '✅ Actif', color: 'bg-green-100 text-green-700' },
  { value: 'a_completer', label: '📝 À compléter', color: 'bg-purple-100 text-purple-700' },
  { value: 'inactif', label: '⏸️ Inactif', color: 'bg-gray-100 text-gray-500' },
]

const INTERACTION_TYPES = [
  { value: 'call', label: '📞 Appel', icon: Phone },
  { value: 'email', label: '📧 Email', icon: Mail },
  { value: 'meeting', label: '🤝 Réunion', icon: Calendar },
  { value: 'note', label: '📝 Note', icon: StickyNote },
  { value: 'devis', label: '📄 Devis', icon: FileText },
  { value: 'facture', label: '🧾 Facture', icon: Receipt },
  { value: 'relance', label: '🔄 Relance', icon: RefreshCw },
]

const CONTACT_ROLES = ['Dirigeant', 'RH', 'QHSE', 'Resp. formation', 'Comptable', 'Secrétariat', 'Technique', 'Autre']

export default function ClientDetail() {
  const { id } = useParams()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})

  // Contacts
  const [contacts, setContacts] = useState([])
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [contactForm, setContactForm] = useState({ name: '', role: '', email: '', phone: '', is_primary: false })

  // Timeline
  const [interactions, setInteractions] = useState([])
  const [phoningCalls, setPhoningCalls] = useState([])
  const [showInteractionForm, setShowInteractionForm] = useState(false)
  const [interactionForm, setInteractionForm] = useState({ type: 'call', title: '', content: '', author: 'Hicham' })

  // Formations
  const [formations, setFormations] = useState([])

  // RDV
  const [rdvs, setRdvs] = useState([])

  // Sections dépliées
  const [sections, setSections] = useState({ contacts: true, timeline: true, formations: true, documents: false })

  useEffect(() => { if (id) loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadClient(), loadContacts(), loadInteractions(), loadFormations(), loadRdvs()])
    setLoading(false)
  }

  async function loadClient() {
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
    if (error) { toast.error('Client introuvable'); return }
    setClient(data)
    setEditForm(data)
  }

  async function loadContacts() {
    const { data } = await supabase.from('client_contacts').select('*').eq('client_id', id).order('is_primary', { ascending: false }).order('name')
    setContacts(data || [])
  }

  async function loadInteractions() {
    // Interactions manuelles
    const { data: manual } = await supabase.from('client_interactions').select('*').eq('client_id', id).order('interaction_date', { ascending: false })
    setInteractions(manual || [])

    // Appels phoning (prospect_calls)
    const { data: calls } = await supabase.from('prospect_calls').select('*').eq('client_id', id).order('called_at', { ascending: false })
    setPhoningCalls(calls || [])
  }

  async function loadFormations() {
    const { data } = await supabase.from('sessions').select(`
      id, reference, start_date, end_date, status, location, notes,
      courses(id, title, code, duration_hours),
      session_trainees(id, status, trainee_id, trainees(first_name, last_name))
    `).eq('client_id', id).order('start_date', { ascending: false })
    setFormations(data || [])
  }

  async function loadRdvs() {
    const { data } = await supabase.from('prospect_rdv').select('*').eq('client_id', id).order('rdv_date', { ascending: false })
    setRdvs(data || [])
  }

  // === CRUD Client ===
  async function saveClient() {
    const { error } = await supabase.from('clients').update({
      name: editForm.name, siret: editForm.siret, address: editForm.address,
      postal_code: editForm.postal_code, city: editForm.city,
      contact_email: editForm.contact_email, contact_phone: editForm.contact_phone,
      contact_name: editForm.contact_name, contact_function: editForm.contact_function,
      website: editForm.website, notes: editForm.notes, status: editForm.status,
    }).eq('id', id)
    if (error) return toast.error('Erreur sauvegarde')
    toast.success('Client mis à jour')
    setEditing(false)
    loadClient()
  }

  // === CRUD Contacts ===
  async function saveContact() {
    if (!contactForm.name) return toast.error('Nom requis')
    if (editingContact) {
      await supabase.from('client_contacts').update(contactForm).eq('id', editingContact.id)
      toast.success('Contact modifié')
    } else {
      await supabase.from('client_contacts').insert({ ...contactForm, client_id: id })
      toast.success('Contact ajouté')
    }
    setShowContactForm(false)
    setEditingContact(null)
    setContactForm({ name: '', role: '', email: '', phone: '', is_primary: false })
    loadContacts()
  }

  async function deleteContact(contactId) {
    if (!confirm('Supprimer ce contact ?')) return
    await supabase.from('client_contacts').delete().eq('id', contactId)
    toast.success('Contact supprimé')
    loadContacts()
  }

  function openEditContact(c) {
    setContactForm({ name: c.name, role: c.role || '', email: c.email || '', phone: c.phone || '', is_primary: c.is_primary || false })
    setEditingContact(c)
    setShowContactForm(true)
  }

  // === CRUD Interactions ===
  async function saveInteraction() {
    if (!interactionForm.content && !interactionForm.title) return toast.error('Contenu requis')
    await supabase.from('client_interactions').insert({
      client_id: id, type: interactionForm.type,
      title: interactionForm.title || INTERACTION_TYPES.find(t => t.value === interactionForm.type)?.label || '',
      content: interactionForm.content, author: interactionForm.author,
    })
    toast.success('Interaction ajoutée')
    setShowInteractionForm(false)
    setInteractionForm({ type: 'call', title: '', content: '', author: 'Hicham' })
    loadInteractions()
  }

  async function deleteInteraction(intId) {
    if (!confirm('Supprimer cette interaction ?')) return
    await supabase.from('client_interactions').delete().eq('id', intId)
    toast.success('Supprimé')
    loadInteractions()
  }

  // === Timeline fusionnée ===
  function getMergedTimeline() {
    const items = []
    interactions.forEach(i => items.push({
      id: i.id, type: i.type, title: i.title, content: i.content,
      author: i.author, date: i.interaction_date, source: 'manual', deletable: true,
    }))
    phoningCalls.forEach(c => {
      const resultLabels = { chaud: '🔥 Intéressé', tiede: '🟡 Tiède', froid: '❄️ Pas intéressé', no_answer: '📞 Injoignable', blocked: '⚠️ Barrage', wrong_number: '❌ N° erroné' }
      items.push({
        id: c.id, type: 'call', title: resultLabels[c.call_result] || c.call_result,
        content: [c.contact_name ? '👤 ' + c.contact_name + (c.contact_function ? ' — ' + c.contact_function : '') : '',
          c.formations_mentioned?.length ? '🎓 ' + c.formations_mentioned.join(', ') : '',
          c.notes || ''].filter(Boolean).join('\n'),
        author: c.called_by, date: c.called_at, source: 'phoning', deletable: false,
      })
    })
    return items.sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  const statusInfo = STATUS_OPTIONS.find(s => s.value === client?.status) || STATUS_OPTIONS[0]

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
  if (!client) return <div className="p-6"><Link to="/clients" className="text-primary-600 hover:underline flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Retour</Link><p className="mt-4 text-gray-500">Client introuvable</p></div>

  const timeline = getMergedTimeline()
  const upcomingSessions = formations.filter(f => f.status === 'planned' || f.status === 'in_progress')
  const pastSessions = formations.filter(f => f.status === 'completed' || f.status === 'cancelled')

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/clients" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Retour aux clients
        </Link>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
              <Edit className="w-4 h-4" /> Modifier
            </button>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setEditForm(client) }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Annuler</button>
              <button onClick={saveClient} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                <Save className="w-4 h-4" /> Enregistrer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Client Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                {editing ? (
                  <input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value.toUpperCase() })}
                    className="text-xl font-bold bg-white border rounded px-2 py-1" />
                ) : (
                  <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
                )}
                {client.siret && <p className="text-sm text-gray-500 font-mono">SIRET {client.siret}</p>}
              </div>
            </div>
            {editing ? (
              <select value={editForm.status || 'prospect'} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                className="px-3 py-1.5 border rounded-lg text-sm">
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            ) : (
              <span className={'px-3 py-1.5 rounded-full text-sm font-medium ' + statusInfo.color}>{statusInfo.label}</span>
            )}
          </div>
        </div>

        <div className="p-6">
          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">SIRET</label>
                <input value={editForm.siret || ''} onChange={e => setEditForm({ ...editForm, siret: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="SIRET" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Site web</label>
                <input value={editForm.website || ''} onChange={e => setEditForm({ ...editForm, website: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="www.example.fr" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Adresse</label>
                <input value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Code postal</label>
                <input value={editForm.postal_code || ''} onChange={e => setEditForm({ ...editForm, postal_code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Ville</label>
                <input value={editForm.city || ''} onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Téléphone</label>
                <input value={editForm.contact_phone || ''} onChange={e => setEditForm({ ...editForm, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                <input value={editForm.contact_email || ''} onChange={e => setEditForm({ ...editForm, contact_email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
                <textarea value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {client.address && <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span className="text-gray-700">{client.address}{client.postal_code || client.city ? ', ' + (client.postal_code || '') + ' ' + (client.city || '') : ''}</span></div>}
              {client.contact_phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400 shrink-0" /><a href={'tel:' + client.contact_phone} className="text-primary-600 hover:underline">{client.contact_phone}</a></div>}
              {client.contact_email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400 shrink-0" /><a href={'mailto:' + client.contact_email} className="text-primary-600 hover:underline text-xs">{client.contact_email}</a></div>}
              {client.website && <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-gray-400 shrink-0" /><a href={client.website.startsWith('http') ? client.website : 'https://' + client.website} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline text-xs">{client.website}</a></div>}
              {client.notes && <div className="col-span-full mt-2 bg-gray-50 rounded-lg p-3 text-gray-600"><p className="whitespace-pre-wrap">{client.notes}</p></div>}
            </div>
          )}
        </div>

        {/* Stats rapides */}
        <div className="border-t bg-gray-50 px-6 py-3 grid grid-cols-4 gap-4 text-center text-sm">
          <div><span className="text-2xl font-bold text-primary-600">{contacts.length}</span><p className="text-gray-500">Contacts</p></div>
          <div><span className="text-2xl font-bold text-blue-600">{timeline.length}</span><p className="text-gray-500">Interactions</p></div>
          <div><span className="text-2xl font-bold text-green-600">{formations.length}</span><p className="text-gray-500">Formations</p></div>
          <div><span className="text-2xl font-bold text-orange-600">{rdvs.length}</span><p className="text-gray-500">RDV</p></div>
        </div>
      </div>

      {/* 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche — Contacts */}
        <div className="lg:col-span-1 space-y-6">
          {/* Section Contacts */}
          <div className="bg-white rounded-xl border border-gray-200">
            <button onClick={() => setSections(s => ({ ...s, contacts: !s.contacts }))}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary-600" />
                <h2 className="font-semibold text-gray-900">Contacts</h2>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{contacts.length}</span>
              </div>
              {sections.contacts ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {sections.contacts && (
              <div className="px-5 pb-4 space-y-2">
                {contacts.map(c => (
                  <div key={c.id} className="group flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{c.name}</p>
                        {c.is_primary && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                      </div>
                      {c.role && <p className="text-xs text-primary-600 font-medium">{c.role}</p>}
                      {c.email && <a href={'mailto:' + c.email} className="text-xs text-gray-500 hover:text-primary-600 block truncate">{c.email}</a>}
                      {c.phone && <a href={'tel:' + c.phone} className="text-xs text-gray-500 hover:text-primary-600">{c.phone}</a>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => openEditContact(c)} className="p-1 text-gray-400 hover:text-primary-600"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteContact(c.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}

                {contacts.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Aucun contact</p>}

                <button onClick={() => { setEditingContact(null); setContactForm({ name: '', role: '', email: '', phone: '', is_primary: false }); setShowContactForm(true) }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Ajouter un contact
                </button>
              </div>
            )}
          </div>

          {/* RDV commerciaux */}
          {rdvs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 px-5 py-3.5">
                <Briefcase className="w-5 h-5 text-orange-600" />
                <h2 className="font-semibold text-gray-900">RDV commerciaux</h2>
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{rdvs.length}</span>
              </div>
              <div className="px-5 pb-4 space-y-2">
                {rdvs.map(r => (
                  <div key={r.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{r.rdv_date ? format(new Date(r.rdv_date), 'dd MMM yyyy', { locale: fr }) : 'Date à fixer'}</span>
                      <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (r.status === 'realise' ? 'bg-green-100 text-green-700' : r.status === 'annule' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}>
                        {r.status === 'realise' ? '✅ Réalisé' : r.status === 'annule' ? '❌ Annulé' : '📅 À prendre'}
                      </span>
                    </div>
                    {r.conducted_by && <p className="text-gray-500 text-xs mt-1">Par {r.conducted_by}</p>}
                    {r.notes && <p className="text-gray-600 text-xs mt-1 line-clamp-2">{r.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite — Timeline + Formations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline CRM */}
          <div className="bg-white rounded-xl border border-gray-200">
            <button onClick={() => setSections(s => ({ ...s, timeline: !s.timeline }))}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-gray-900">Historique des échanges</h2>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{timeline.length}</span>
              </div>
              {sections.timeline ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {sections.timeline && (
              <div className="px-5 pb-4">
                {/* Bouton ajouter */}
                <button onClick={() => setShowInteractionForm(!showInteractionForm)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 mb-3 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors">
                  <Plus className="w-4 h-4" /> Ajouter une interaction
                </button>

                {/* Formulaire inline */}
                {showInteractionForm && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-4 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {INTERACTION_TYPES.map(t => (
                        <button key={t.value} onClick={() => setInteractionForm(f => ({ ...f, type: t.value }))}
                          className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ' +
                            (interactionForm.type === t.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <input value={interactionForm.title} onChange={e => setInteractionForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Titre (optionnel)" className="w-full px-3 py-2 border rounded-lg text-sm" />
                    <textarea value={interactionForm.content} onChange={e => setInteractionForm(f => ({ ...f, content: e.target.value }))}
                      placeholder="Détails de l'échange..." rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {['Hicham', 'Marine', 'Maxime'].map(name => (
                          <button key={name} onClick={() => setInteractionForm(f => ({ ...f, author: name }))}
                            className={'px-3 py-1.5 rounded-lg text-xs font-medium border ' + (interactionForm.author === name ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-300')}>
                            {name}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowInteractionForm(false)} className="px-3 py-1.5 text-sm text-gray-600">Annuler</button>
                        <button onClick={saveInteraction} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                          <Send className="w-3.5 h-3.5" /> Enregistrer
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                {timeline.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Aucun échange enregistré</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                    <div className="space-y-1">
                      {timeline.map(item => {
                        const typeInfo = INTERACTION_TYPES.find(t => t.value === item.type) || { label: item.type, icon: MessageSquare }
                        const IconComp = typeInfo.icon
                        const colors = {
                          call: 'bg-green-100 text-green-600', email: 'bg-blue-100 text-blue-600',
                          meeting: 'bg-purple-100 text-purple-600', note: 'bg-yellow-100 text-yellow-600',
                          devis: 'bg-indigo-100 text-indigo-600', facture: 'bg-teal-100 text-teal-600',
                          relance: 'bg-orange-100 text-orange-600',
                        }
                        return (
                          <div key={item.id + item.source} className="relative flex gap-3 py-2.5 pl-1">
                            <div className={'relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ' + (colors[item.type] || 'bg-gray-100 text-gray-600')}>
                              <IconComp className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-gray-900">{item.title}</span>
                                {item.source === 'phoning' && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Phoning</span>}
                                <span className="text-xs text-gray-400 ml-auto shrink-0">
                                  {item.author && item.author + ' • '}{format(new Date(item.date), 'dd MMM yyyy HH:mm', { locale: fr })}
                                </span>
                              </div>
                              {item.content && <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line">{item.content}</p>}
                            </div>
                            {item.deletable && (
                              <button onClick={() => deleteInteraction(item.id)} className="p-1 text-gray-300 hover:text-red-500 shrink-0 opacity-0 hover:opacity-100 transition-opacity">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formations */}
          <div className="bg-white rounded-xl border border-gray-200">
            <button onClick={() => setSections(s => ({ ...s, formations: !s.formations }))}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-green-600" />
                <h2 className="font-semibold text-gray-900">Formations</h2>
                <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">{formations.length}</span>
              </div>
              {sections.formations ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {sections.formations && (
              <div className="px-5 pb-4 space-y-4">
                {/* À venir / En cours */}
                {upcomingSessions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">À venir</h3>
                    <div className="space-y-2">
                      {upcomingSessions.map(s => (
                        <Link key={s.id} to={'/sessions/' + s.id} className="block p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{s.courses?.title || s.reference}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {format(new Date(s.start_date), 'dd MMM', { locale: fr })} — {format(new Date(s.end_date), 'dd MMM yyyy', { locale: fr })}
                                {s.location ? ' • ' + s.location : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (s.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700')}>
                                {s.status === 'in_progress' ? '🔄 En cours' : '📅 Planifiée'}
                              </span>
                              {s.session_trainees?.length > 0 && <p className="text-xs text-gray-400 mt-1">{s.session_trainees.length} stagiaire{s.session_trainees.length > 1 ? 's' : ''}</p>}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Passées */}
                {pastSessions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historique</h3>
                    <div className="space-y-2">
                      {pastSessions.map(s => (
                        <Link key={s.id} to={'/sessions/' + s.id} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{s.courses?.title || s.reference}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {format(new Date(s.start_date), 'dd MMM', { locale: fr })} — {format(new Date(s.end_date), 'dd MMM yyyy', { locale: fr })}
                              </p>
                              {s.session_trainees?.length > 0 && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {s.session_trainees.map(st => st.trainees ? st.trainees.first_name + ' ' + st.trainees.last_name : '').filter(Boolean).join(', ')}
                                </p>
                              )}
                            </div>
                            <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                              {s.status === 'completed' ? '✅ Terminée' : '❌ Annulée'}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {formations.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucune formation</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Contact */}
      {showContactForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setShowContactForm(false); setEditingContact(null) }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingContact ? 'Modifier le contact' : 'Nouveau contact'}</h3>
              <button onClick={() => { setShowContactForm(false); setEditingContact(null) }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nom *</label>
                <input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Nom du contact" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Fonction</label>
                <select value={contactForm.role} onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">— Sélectionner —</option>
                  {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                  <input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Téléphone</label>
                  <input type="tel" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={contactForm.is_primary} onChange={e => setContactForm(f => ({ ...f, is_primary: e.target.checked }))} className="rounded" />
                <Star className="w-4 h-4 text-amber-500" /> Contact principal
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowContactForm(false); setEditingContact(null) }} className="px-4 py-2 border rounded-lg text-sm">Annuler</button>
              <button onClick={saveContact} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                <Save className="w-4 h-4" /> {editingContact ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
