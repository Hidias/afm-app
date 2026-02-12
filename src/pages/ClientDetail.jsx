import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Building2, MapPin, Phone, Mail, Globe, Edit, Save, X, Plus, Trash2, User, Clock, MessageSquare, Calendar, FileText, GraduationCap, Star, ChevronDown, ChevronUp, Send, StickyNote, Receipt, RefreshCw, Briefcase, FileSignature, Smartphone, Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════
const STATUS_OPTIONS = [
  { value: 'prospect', label: '🎯 Prospect', color: 'bg-orange-100 text-orange-700' },
  { value: 'en_discussion', label: '💬 En discussion', color: 'bg-blue-100 text-blue-700' },
  { value: 'actif', label: '✅ Actif', color: 'bg-green-100 text-green-700' },
  { value: 'a_completer', label: '📝 À compléter', color: 'bg-purple-100 text-purple-700' },
  { value: 'inactif', label: '⏸️ Inactif', color: 'bg-gray-100 text-gray-500' },
]

const OPCO_LIST = [
  'AFDAS', 'AKTO', 'ATLAS', 'Constructys', 'L\'Opcommerce',
  'OCAPIAT', 'OPCO 2i', 'OPCO EP', 'OPCO Mobilités', 'OPCO Santé', 'Uniformation',
]

const INTERACTION_TYPES = [
  { value: 'call', label: '📞 Appel', icon: Phone, color: 'bg-green-100 text-green-600' },
  { value: 'email', label: '📧 Email', icon: Mail, color: 'bg-blue-100 text-blue-600' },
  { value: 'sms', label: '💬 SMS', icon: Smartphone, color: 'bg-cyan-100 text-cyan-600' },
  { value: 'meeting', label: '🤝 Réunion', icon: Calendar, color: 'bg-purple-100 text-purple-600' },
  { value: 'note', label: '📝 Note interne', icon: StickyNote, color: 'bg-yellow-100 text-yellow-600' },
  { value: 'devis', label: '📄 Devis', icon: FileText, color: 'bg-indigo-100 text-indigo-600' },
  { value: 'facture', label: '🧾 Facture', icon: Receipt, color: 'bg-teal-100 text-teal-600' },
  { value: 'relance', label: '🔄 Relance', icon: RefreshCw, color: 'bg-orange-100 text-orange-600' },
]

const AUTHORS = ['Hicham', 'Maxime']

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function ClientDetail() {
  const { id } = useParams()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [detectingOpco, setDetectingOpco] = useState(false)

  // Contacts
  const [contacts, setContacts] = useState([])
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [contactForm, setContactForm] = useState({ name: '', role: '', email: '', phone: '', is_primary: false, is_document_contact: false })

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
  const [sections, setSections] = useState({ contacts: true, timeline: true, formations: true })

  useEffect(() => { if (id) loadAll() }, [id])

  // ═══════════════════════════════════════════════════════════
  // CHARGEMENT DONNÉES
  // ═══════════════════════════════════════════════════════════
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
    const { data } = await supabase.from('client_contacts').select('*').eq('client_id', id)
      .order('is_primary', { ascending: false }).order('is_document_contact', { ascending: false }).order('name')
    setContacts(data || [])
  }

  async function loadInteractions() {
    const { data: manual } = await supabase.from('client_interactions').select('*').eq('client_id', id).order('interaction_date', { ascending: false })
    setInteractions(manual || [])
    const { data: calls } = await supabase.from('prospect_calls').select('*').eq('client_id', id).order('called_at', { ascending: false })
    setPhoningCalls(calls || [])
  }

  async function loadFormations() {
    const { data, error } = await supabase.from('sessions').select(`
      id, reference, start_date, end_date, status, notes,
      courses(id, title, code, duration_hours),
      session_trainees(id, trainee_id, result, trainees(first_name, last_name))
    `).eq('client_id', id).order('start_date', { ascending: false })
    if (error) console.error('loadFormations error:', error)
    setFormations(data || [])
  }

  async function loadRdvs() {
    const { data } = await supabase.from('prospect_rdv').select('*').eq('client_id', id).order('rdv_date', { ascending: false })
    setRdvs(data || [])
  }

  // ═══════════════════════════════════════════════════════════
  // OPCO AUTO-DETECTION
  // ═══════════════════════════════════════════════════════════
  async function autoDetectOpco() {
    const siret = (editForm.siret || '').replace(/\s/g, '')
    if (!siret || siret.length < 9) return toast.error('SIRET invalide (min 9 chiffres)')
    setDetectingOpco(true)
    try {
      const resp = await fetch(`https://www.cfadock.fr/api/opcos?siret=${siret}`)
      if (!resp.ok) throw new Error(`Erreur API (${resp.status})`)
      const data = await resp.json()
      // L'API retourne un tableau d'objets avec { idcc, opco_name, ... }
      if (data && data.length > 0 && data[0].opco_name) {
        const opcoName = data[0].opco_name
        setEditForm(prev => ({ ...prev, opco_name: opcoName }))
        toast.success(`OPCO détecté : ${opcoName}`)
      } else {
        toast.error('OPCO non trouvé pour ce SIRET')
      }
    } catch (err) {
      console.error('Erreur détection OPCO:', err)
      toast.error('Impossible de détecter l\'OPCO : ' + err.message)
    }
    setDetectingOpco(false)
  }

  // ═══════════════════════════════════════════════════════════
  // CRUD CLIENT
  // ═══════════════════════════════════════════════════════════
  async function saveClient() {
    const { error } = await supabase.from('clients').update({
      name: editForm.name, siret: editForm.siret, address: editForm.address,
      postal_code: editForm.postal_code, city: editForm.city,
      contact_email: editForm.contact_email, contact_phone: editForm.contact_phone,
      contact_name: editForm.contact_name, contact_function: editForm.contact_function,
      website: editForm.website, notes: editForm.notes, status: editForm.status,
      opco_name: editForm.opco_name || null,
    }).eq('id', id)
    if (error) return toast.error('Erreur sauvegarde')
    toast.success('Client mis à jour')
    setEditing(false)
    loadClient()
  }

  // ═══════════════════════════════════════════════════════════
  // CRUD CONTACTS
  // ═══════════════════════════════════════════════════════════
  async function saveContact() {
    if (!contactForm.name) return toast.error('Nom requis')

    // Si ce contact est marqué "documents", retirer le flag des autres
    if (contactForm.is_document_contact) {
      const othersWithFlag = contacts.filter(c => c.is_document_contact && (!editingContact || c.id !== editingContact.id))
      for (const other of othersWithFlag) {
        await supabase.from('client_contacts').update({ is_document_contact: false }).eq('id', other.id)
      }
    }

    if (editingContact) {
      const { error } = await supabase.from('client_contacts').update(contactForm).eq('id', editingContact.id)
      if (error) return toast.error('Erreur: ' + error.message)
      toast.success('Contact modifié')
    } else {
      const { error } = await supabase.from('client_contacts').insert({ ...contactForm, client_id: id })
      if (error) return toast.error('Erreur: ' + error.message)
      toast.success('Contact ajouté')
    }
    closeContactForm()
    loadContacts()
  }

  async function deleteContact(contactId) {
    if (!confirm('Supprimer ce contact ?')) return
    await supabase.from('client_contacts').delete().eq('id', contactId)
    toast.success('Contact supprimé')
    loadContacts()
  }

  function openEditContact(c) {
    setContactForm({ name: c.name, role: c.role || '', email: c.email || '', phone: c.phone || '', is_primary: c.is_primary || false, is_document_contact: c.is_document_contact || false })
    setEditingContact(c)
    setShowContactForm(true)
  }

  function closeContactForm() {
    setShowContactForm(false)
    setEditingContact(null)
    setContactForm({ name: '', role: '', email: '', phone: '', is_primary: false, is_document_contact: false })
  }

  // ═══════════════════════════════════════════════════════════
  // CRUD INTERACTIONS
  // ═══════════════════════════════════════════════════════════
  async function saveInteraction() {
    if (!interactionForm.content && !interactionForm.title) return toast.error('Contenu requis')
    const { error } = await supabase.from('client_interactions').insert({
      client_id: id, type: interactionForm.type,
      title: interactionForm.title || INTERACTION_TYPES.find(t => t.value === interactionForm.type)?.label || '',
      content: interactionForm.content, author: interactionForm.author,
    })
    if (error) return toast.error('Erreur: ' + error.message)
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

  // ═══════════════════════════════════════════════════════════
  // TIMELINE FUSIONNÉE
  // ═══════════════════════════════════════════════════════════
  function getMergedTimeline() {
    const items = []
    interactions.forEach(i => items.push({
      id: i.id, type: i.type, title: i.title, content: i.content,
      author: i.author, date: i.interaction_date, source: 'manual', deletable: true,
    }))
    phoningCalls.forEach(c => {
      const resultLabels = { chaud: '🔥 Intéressé', tiede: '🟡 Tiède', froid: '❄️ Pas intéressé', no_answer: '📞 Injoignable', blocked: '⚠️ Barrage', wrong_number: '❌ N° erroné' }
      items.push({
        id: c.id, type: 'call',
        title: (resultLabels[c.call_result] || c.call_result || 'Appel') + ' (phoning)',
        content: [
          c.contact_name ? '👤 ' + c.contact_name + (c.contact_function ? ' — ' + c.contact_function : '') : '',
          c.formations_mentioned?.length ? '🎓 ' + c.formations_mentioned.join(', ') : '',
          c.notes || ''
        ].filter(Boolean).join('\n'),
        author: c.called_by, date: c.called_at, source: 'phoning', deletable: false,
      })
    })
    return items.sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  const statusInfo = STATUS_OPTIONS.find(s => s.value === client?.status) || STATUS_OPTIONS[0]

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  if (!client) return <div className="p-6"><Link to="/clients" className="text-primary-600 hover:underline flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Retour</Link><p className="mt-4 text-gray-500">Client introuvable</p></div>

  const timeline = getMergedTimeline()
  const upcomingSessions = formations.filter(f => f.status === 'planned' || f.status === 'in_progress' || f.status === 'draft')
  const pastSessions = formations.filter(f => f.status === 'completed' || f.status === 'cancelled')
  const docContact = contacts.find(c => c.is_document_contact)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ══════ HEADER ══════ */}
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
              <button onClick={() => { setEditing(false); setEditForm(client) }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
              <button onClick={saveClient} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                <Save className="w-4 h-4" /> Enregistrer
              </button>
            </>
          )}
        </div>
      </div>

      {/* ══════ FICHE CLIENT ══════ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                {editing ? (
                  <input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value.toUpperCase() })}
                    className="text-xl font-bold bg-white border rounded px-2 py-1 w-80" />
                ) : (
                  <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
                )}
                {client.siret && <p className="text-sm text-gray-500 font-mono mt-0.5">SIRET {client.siret}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {docContact && !editing && (
                <div className="text-right hidden md:block">
                  <p className="text-xs text-gray-400">Contact documents</p>
                  <p className="text-sm font-medium text-gray-700">{docContact.name}{docContact.role ? ' — ' + docContact.role : ''}</p>
                </div>
              )}
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
        </div>

        <div className="p-6">
          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">SIRET</label>
                <input value={editForm.siret || ''} onChange={e => setEditForm({ ...editForm, siret: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="SIRET" /></div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Site web</label>
                <input value={editForm.website || ''} onChange={e => setEditForm({ ...editForm, website: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="www.example.fr" /></div>
              <div className="col-span-2"><label className="text-xs font-medium text-gray-500 mb-1 block">Adresse</label>
                <input value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Code postal</label>
                <input value={editForm.postal_code || ''} onChange={e => setEditForm({ ...editForm, postal_code: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Ville</label>
                <input value={editForm.city || ''} onChange={e => setEditForm({ ...editForm, city: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Téléphone</label>
                <input value={editForm.contact_phone || ''} onChange={e => setEditForm({ ...editForm, contact_phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                <input type="email" value={editForm.contact_email || ''} onChange={e => setEditForm({ ...editForm, contact_email: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="col-span-2"><label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
                <textarea value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-1 block">OPCO</label>
                <div className="flex gap-2">
                  <select value={editForm.opco_name || ''} onChange={e => setEditForm({ ...editForm, opco_name: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm">
                    <option value="">— Aucun OPCO —</option>
                    {OPCO_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <button onClick={autoDetectOpco} disabled={detectingOpco || !(editForm.siret || '').replace(/\s/g, '')}
                    title="Détecter l'OPCO depuis le SIRET"
                    className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-40 flex items-center gap-1.5 transition-colors">
                    {detectingOpco ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    Détecter
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-sm">
              {client.address && (
                <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <span className="text-gray-700">{client.address}{(client.postal_code || client.city) ? ', ' + [client.postal_code, client.city].filter(Boolean).join(' ') : ''}</span></div>
              )}
              {client.contact_phone && (
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={'tel:' + client.contact_phone} className="text-primary-600 hover:underline">{client.contact_phone}</a></div>
              )}
              {client.contact_email && (
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={'mailto:' + client.contact_email} className="text-primary-600 hover:underline truncate">{client.contact_email}</a></div>
              )}
              {client.website && (
                <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={client.website.startsWith('http') ? client.website : 'https://' + client.website} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline truncate">{client.website}</a></div>
              )}
              {client.opco_name && (
                <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-700"><span className="font-medium">OPCO</span> {client.opco_name}</span></div>
              )}
              {client.notes && (
                <div className="col-span-full mt-2 bg-gray-50 rounded-lg p-3 text-gray-600"><p className="whitespace-pre-wrap">{client.notes}</p></div>
              )}
            </div>
          )}
        </div>

        <div className="border-t bg-gray-50/50 px-6 py-3 grid grid-cols-4 gap-4 text-center text-sm">
          <div><span className="text-2xl font-bold text-primary-600">{contacts.length}</span><p className="text-gray-500">Contacts</p></div>
          <div><span className="text-2xl font-bold text-blue-600">{timeline.length}</span><p className="text-gray-500">Échanges</p></div>
          <div><span className="text-2xl font-bold text-green-600">{formations.length}</span><p className="text-gray-500">Formations</p></div>
          <div><span className="text-2xl font-bold text-orange-600">{rdvs.length}</span><p className="text-gray-500">RDV</p></div>
        </div>
      </div>

      {/* ══════ 2 COLONNES ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ──── GAUCHE : Contacts + RDV ──── */}
        <div className="lg:col-span-1 space-y-6">

          <div className="bg-white rounded-xl border border-gray-200">
            <button onClick={() => setSections(s => ({ ...s, contacts: !s.contacts }))}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 rounded-t-xl">
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
                  <div key={c.id} className="group relative flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-gray-900">{c.name}</p>
                        {c.is_primary && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded font-medium" title="Contact principal">
                            <Star className="w-3 h-3 fill-amber-500" /> Principal
                          </span>
                        )}
                        {c.is_document_contact && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded font-medium" title="Apparaît sur les documents">
                            <FileSignature className="w-3 h-3" /> Documents
                          </span>
                        )}
                      </div>
                      {c.role && <p className="text-xs text-primary-600 font-medium mt-0.5">{c.role}</p>}
                      <div className="flex flex-col gap-0.5 mt-1">
                        {c.email && <a href={'mailto:' + c.email} className="text-xs text-gray-500 hover:text-primary-600 truncate">📧 {c.email}</a>}
                        {c.phone && <a href={'tel:' + c.phone} className="text-xs text-gray-500 hover:text-primary-600">📞 {c.phone}</a>}
                      </div>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      <button onClick={() => openEditContact(c)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded hover:bg-white" title="Modifier"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteContact(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-white" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}

                {contacts.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Aucun contact enregistré</p>}

                <button onClick={() => { setEditingContact(null); setContactForm({ name: '', role: '', email: '', phone: '', is_primary: false, is_document_contact: false }); setShowContactForm(true) }}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg border border-dashed border-primary-300 transition-colors">
                  <Plus className="w-4 h-4" /> Ajouter un contact
                </button>
              </div>
            )}
          </div>

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

        {/* ──── DROITE : Timeline + Formations ──── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Timeline CRM */}
          <div className="bg-white rounded-xl border border-gray-200">
            <button onClick={() => setSections(s => ({ ...s, timeline: !s.timeline }))}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-gray-900">Historique des échanges</h2>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{timeline.length}</span>
              </div>
              {sections.timeline ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {sections.timeline && (
              <div className="px-5 pb-4">
                <button onClick={() => setShowInteractionForm(!showInteractionForm)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 mb-3 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300 transition-colors">
                  <Plus className="w-4 h-4" /> Ajouter une interaction
                </button>

                {showInteractionForm && (
                  <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">Type</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {INTERACTION_TYPES.map(t => (
                          <button key={t.value} onClick={() => setInteractionForm(f => ({ ...f, type: t.value }))}
                            className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                              (interactionForm.type === t.value ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300')}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Titre (optionnel)</label>
                      <input value={interactionForm.title} onChange={e => setInteractionForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Ex: Relance devis SST, Appel RH, ..." className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Détails</label>
                      <textarea value={interactionForm.content} onChange={e => setInteractionForm(f => ({ ...f, content: e.target.value }))}
                        placeholder="Résumé de l'échange, décisions prises, prochaines étapes..." rows={4} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div className="flex items-end justify-between pt-1">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Saisi par</label>
                        <div className="flex gap-1.5">
                          {AUTHORS.map(name => (
                            <button key={name} onClick={() => setInteractionForm(f => ({ ...f, author: name }))}
                              className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                                (interactionForm.author === name ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300')}>
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowInteractionForm(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Annuler</button>
                        <button onClick={saveInteraction} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 shadow-sm">
                          <Send className="w-3.5 h-3.5" /> Enregistrer
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {timeline.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Aucun échange enregistré</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[13px] top-3 bottom-3 w-px bg-gray-200" />
                    <div className="space-y-0.5">
                      {timeline.map(item => {
                        const typeInfo = INTERACTION_TYPES.find(t => t.value === item.type) || INTERACTION_TYPES[0]
                        const IconComp = typeInfo.icon
                        return (
                          <div key={item.id + '-' + item.source} className="group relative flex gap-3 py-2.5 pl-0.5">
                            <div className={'relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-2 ring-white ' + typeInfo.color}>
                              <IconComp className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-gray-900">{item.title}</span>
                                {item.source === 'phoning' && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">Prospection</span>}
                                <span className="text-xs text-gray-400 ml-auto shrink-0">
                                  {item.author && <span className="font-medium text-gray-500">{item.author}</span>}
                                  {item.author && ' · '}
                                  {format(new Date(item.date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                </span>
                              </div>
                              {item.content && <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line leading-relaxed">{item.content}</p>}
                            </div>
                            {item.deletable && (
                              <button onClick={() => deleteInteraction(item.id)} className="p-1 text-gray-300 hover:text-red-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-green-600" />
                <h2 className="font-semibold text-gray-900">Formations</h2>
                <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">{formations.length}</span>
              </div>
              {sections.formations ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {sections.formations && (
              <div className="px-5 pb-4 space-y-4">
                {upcomingSessions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">📅 À venir / En cours</h3>
                    <div className="space-y-2">
                      {upcomingSessions.map(s => (
                        <Link key={s.id} to={'/sessions/' + s.id} className="block p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{s.courses?.title || s.reference}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {format(new Date(s.start_date), 'dd MMM', { locale: fr })} — {format(new Date(s.end_date), 'dd MMM yyyy', { locale: fr })}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (s.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : s.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700')}>
                                {s.status === 'in_progress' ? '🔄 En cours' : s.status === 'draft' ? '📝 Brouillon' : '📅 Planifiée'}
                              </span>
                              {s.session_trainees?.length > 0 && <p className="text-xs text-gray-400 mt-1">{s.session_trainees.length} stagiaire{s.session_trainees.length > 1 ? 's' : ''}</p>}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {pastSessions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">📋 Historique</h3>
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

      {/* ══════ MODAL CONTACT ══════ */}
      {showContactForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={closeContactForm} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">{editingContact ? 'Modifier le contact' : 'Nouveau contact'}</h3>
              <button onClick={closeContactForm} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nom complet *</label>
                <input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Mme Dupont, M. Martin..." autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Fonction / Rôle</label>
                <input value={contactForm.role} onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="RH, Dirigeant, QSE, Comptable, Resp. formation..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                  <input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="email@..." />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Téléphone</label>
                  <input type="tel" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="06 ..." />
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <label className="flex items-center gap-2.5 text-sm cursor-pointer p-2 rounded-lg hover:bg-amber-50 transition-colors">
                  <input type="checkbox" checked={contactForm.is_primary} onChange={e => setContactForm(f => ({ ...f, is_primary: e.target.checked }))} className="rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                  <Star className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="font-medium text-gray-700">Contact principal</p>
                    <p className="text-xs text-gray-400">Interlocuteur par défaut pour ce client</p>
                  </div>
                </label>
                <label className="flex items-center gap-2.5 text-sm cursor-pointer p-2 rounded-lg hover:bg-indigo-50 transition-colors">
                  <input type="checkbox" checked={contactForm.is_document_contact} onChange={e => setContactForm(f => ({ ...f, is_document_contact: e.target.checked }))} className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-500" />
                  <FileSignature className="w-4 h-4 text-indigo-500" />
                  <div>
                    <p className="font-medium text-gray-700">Contact documents</p>
                    <p className="text-xs text-gray-400">Apparaît sur conventions, convocations, attestations</p>
                  </div>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={closeContactForm} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Annuler</button>
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
