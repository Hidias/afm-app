import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Building2, MapPin, Phone, Mail, Globe, Edit, Save, X, Plus, Trash2, User, Clock, MessageSquare, Calendar, FileText, GraduationCap, Star, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Send, StickyNote, Receipt, RefreshCw, Briefcase, FileSignature, Smartphone, Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import SpeechToTextButton from '../components/SpeechToTextButton'

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

const OPCO_LIST = [
  'AFDAS', 'AKTO', 'ATLAS', 'Constructys', "L'Opcommerce",
  'OCAPIAT', 'OPCO 2i', 'OPCO EP', 'OPCO Mobilités', 'OPCO Santé', 'Uniformation'
]

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [detectingOpco, setDetectingOpco] = useState(false)

  // Navigation entre clients (A→Z)
  const [allClientIds, setAllClientIds] = useState([])


  // Contacts
  const [contacts, setContacts] = useState([])
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [contactForm, setContactForm] = useState({ name: '', role: '', email: '', phone: '', is_primary: false, is_document_contact: false, is_billing: false })

  // Timeline
  const [interactions, setInteractions] = useState([])
  const [phoningCalls, setPhoningCalls] = useState([])
  const [emailLogs, setEmailLogs] = useState([])
  const [showInteractionForm, setShowInteractionForm] = useState(false)
  const [interactionForm, setInteractionForm] = useState({ type: 'call', title: '', content: '', author: 'Hicham' })

  // Email direct
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '', brief: '', sender: 'Hicham' })
  const [emailGenerating, setEmailGenerating] = useState(false)
  const [emailSending, setEmailSending] = useState(false)

  // Formations
  const [formations, setFormations] = useState([])

  // RDV
  const [rdvs, setRdvs] = useState([])

  // Sections dépliées
  const [sections, setSections] = useState({ contacts: true, timeline: true, formations: true })

  useEffect(() => { if (id) loadAll() }, [id])

  // Charger la liste de tous les clients (A→Z) pour navigation
  useEffect(() => {
    async function loadClientIds() {
      const { data } = await supabase.from('clients').select('id, name').order('name')
      if (data) setAllClientIds(data.map(c => c.id))
    }
    loadClientIds()
  }, [])

  // Calculer précédent/suivant
  const currentIndex = allClientIds.indexOf(id)
  const prevClientId = currentIndex > 0 ? allClientIds[currentIndex - 1] : null
  const nextClientId = currentIndex >= 0 && currentIndex < allClientIds.length - 1 ? allClientIds[currentIndex + 1] : null

  function navigateToClient(targetId) {
    if (!targetId) return
    navigate(`/clients/${targetId}`)
    setEditing(true)
  }

  // Raccourcis clavier Alt+← / Alt+→
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.altKey && e.key === 'ArrowLeft' && prevClientId) {
        e.preventDefault()
        navigateToClient(prevClientId)
      }
      if (e.altKey && e.key === 'ArrowRight' && nextClientId) {
        e.preventDefault()
        navigateToClient(nextClientId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [prevClientId, nextClientId])

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
    const { data: emails } = await supabase.from('prospect_email_logs').select('*').eq('client_id', id).order('sent_at', { ascending: false })
    setEmailLogs(emails || [])
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
  // CRUD CLIENT
  // ═══════════════════════════════════════════════════════════
  async function autoDetectOpco() {
    const siret = (editForm.siret || '').replace(/\s/g, '')
    if (!siret || siret.length < 9) return toast.error('SIRET requis (min 9 chiffres)')
    setDetectingOpco(true)
    try {
      const res = await fetch(`/api/detect-opco?siret=${siret}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur API')

      // Enrichir les champs depuis les données entreprise
      const updates = {}
      const ent = data.entreprise
      if (ent) {
        if (ent.address && !editForm.address) updates.address = ent.address
        if (ent.postal_code && !editForm.postal_code) updates.postal_code = ent.postal_code
        if (ent.city && !editForm.city) updates.city = ent.city.toUpperCase()
        // Si les champs sont vides OU identiques aux anciens (= pas modifiés manuellement), on écrase
        if (ent.address) updates.address = ent.address
        if (ent.postal_code) updates.postal_code = ent.postal_code
        if (ent.city) updates.city = ent.city.toUpperCase()
      }

      if (data.status === 'OK' && data.opco_name) {
        updates.opco_name = data.opco_name
        setEditForm(prev => ({ ...prev, ...updates }))
        toast.success(`OPCO : ${data.opco_name}${data.convention ? ' (' + data.convention + ')' : ''}`)
      } else if (data.status === 'IDCC_FOUND_NO_OPCO') {
        setEditForm(prev => ({ ...prev, ...updates }))
        toast.error(data.message || `IDCC ${data.idcc} trouvé mais OPCO non référencé`)
      } else {
        // Même sans OPCO, on enrichit l'adresse si dispo
        if (Object.keys(updates).length > 0) {
          setEditForm(prev => ({ ...prev, ...updates }))
          toast('Adresse enrichie depuis le SIRET', { icon: '📍' })
        } else {
          toast.error(data.message || 'Aucune convention collective trouvée')
        }
      }
    } catch (err) {
      toast.error('Erreur détection : ' + err.message)
    } finally {
      setDetectingOpco(false)
    }
  }

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
    // Recharger les données fraîches mais rester en mode édition
    const { data: fresh } = await supabase.from('clients').select('*').eq('id', id).single()
    if (fresh) {
      setClient(fresh)
      setEditForm(fresh)
    }
    // On reste en mode édition pour permettre la navigation
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

    // Si ce contact est marqué "facturation", retirer le flag des autres
    if (contactForm.is_billing) {
      const othersWithBilling = contacts.filter(c => c.is_billing && (!editingContact || c.id !== editingContact.id))
      for (const other of othersWithBilling) {
        await supabase.from('client_contacts').update({ is_billing: false }).eq('id', other.id)
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
    setContactForm({ name: c.name, role: c.role || '', email: c.email || '', phone: c.phone || '', is_primary: c.is_primary || false, is_document_contact: c.is_document_contact || false, is_billing: c.is_billing || false })
    setEditingContact(c)
    setShowContactForm(true)
  }

  function closeContactForm() {
    setShowContactForm(false)
    setEditingContact(null)
    setContactForm({ name: '', role: '', email: '', phone: '', is_primary: false, is_document_contact: false, is_billing: false })
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
  // EMAIL DIRECT CLIENT
  // ═══════════════════════════════════════════════════════════
  async function generateEmailIA() {
    if (!emailForm.brief?.trim()) return toast.error('Décrivez ce que vous voulez dire')
    setEmailGenerating(true)
    try {
      const timeline = getMergedTimeline()
      const res = await fetch('/api/generate-client-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: emailForm.brief,
          clientName: client?.name,
          clientSector: client?.secteur_activite,
          contactName: emailForm.to ? contacts.find(c => c.email === emailForm.to)?.name : null,
          senderName: emailForm.sender,
          recentInteractions: timeline.slice(0, 5).map(i => ({ date: i.date, type: i.type, title: i.title, content: i.content })),
          formations: formations.slice(0, 5).map(f => ({ type_formation: f.type_formation, status: f.status })),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      // Convertir HTML → texte lisible pour le textarea
      let bodyText = (data.body || '')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      setEmailForm(f => ({ ...f, subject: data.subject || f.subject, body: bodyText || f.body }))
      toast.success('Email généré !')
    } catch (err) {
      toast.error('Erreur IA : ' + err.message)
    }
    setEmailGenerating(false)
  }

  async function sendClientEmail() {
    if (!emailForm.to || !emailForm.subject || !emailForm.body) return toast.error('Destinataire, objet et corps requis')
    setEmailSending(true)
    try {
      // Convertir le texte brut en HTML si pas déjà du HTML
      let htmlBody = emailForm.body
      if (!htmlBody.includes('<p>') && !htmlBody.includes('<br')) {
        htmlBody = htmlBody.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
      }

      const res = await fetch('/api/send-prospect-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailForm.to,
          subject: emailForm.subject,
          body: htmlBody,
          caller: emailForm.sender,
          clientId: id,
          prospectName: client?.name,
          templateType: 'client_direct',
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      toast.success('📧 Email envoyé !')
      setShowEmailForm(false)
      setEmailForm({ to: '', subject: '', body: '', brief: '', sender: 'Hicham' })
      loadInteractions()
    } catch (err) {
      toast.error('Erreur envoi : ' + err.message)
    }
    setEmailSending(false)
  }

  function openEmailForm() {
    // Pré-remplir le destinataire avec le contact principal ou le premier contact avec email
    const primary = contacts.find(c => c.is_primary && c.email)
    const firstWithEmail = contacts.find(c => c.email)
    const defaultTo = primary?.email || firstWithEmail?.email || client?.contact_email || ''
    setEmailForm({ to: defaultTo, subject: '', body: '', brief: '', sender: 'Hicham' })
    setShowEmailForm(true)
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
    emailLogs.forEach(e => {
      const tplLabels = { suite_echange: 'Suite \u00e9change', nrp: 'NRP', relance: 'Relance' }
      items.push({
        id: 'email-' + e.id, type: 'email',
        title: '\u2709\ufe0f Email "' + (tplLabels[e.template_type] || e.template_type) + '" envoy\u00e9',
        content: [
          '\u00c0 : ' + e.to_email,
          'Objet : ' + (e.subject || ''),
          e.body_preview ? e.body_preview.substring(0, 150) + '...' : '',
        ].filter(Boolean).join('\n'),
        author: e.sent_by || 'Syst\u00e8me', date: e.sent_at, source: 'email', deletable: false,
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
  const billingContact = contacts.find(c => c.is_billing)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ══════ HEADER ══════ */}
      <div className="flex items-center justify-between">
        <Link to="/clients" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Retour aux clients
        </Link>
        <div className="flex items-center gap-2">
          {/* Navigation précédent/suivant */}
          <div className="flex items-center gap-1 mr-2">
            <button onClick={() => navigateToClient(prevClientId)} disabled={!prevClientId}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Client précédent (Alt+←)">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {allClientIds.length > 0 && (
              <span className="text-xs text-gray-400 tabular-nums min-w-[4rem] text-center">
                {currentIndex + 1} / {allClientIds.length}
              </span>
            )}
            <button onClick={() => navigateToClient(nextClientId)} disabled={!nextClientId}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Client suivant (Alt+→)">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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
              {billingContact && !editing && (
                <div className="text-right hidden md:block">
                  <p className="text-xs text-gray-400">💰 Facturation</p>
                  <p className="text-sm font-medium text-gray-700">{billingContact.name}{billingContact.email ? ' — ' + billingContact.email : ''}</p>
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
                <div className="flex gap-2">
                  <input value={editForm.siret || ''} onChange={e => setEditForm({ ...editForm, siret: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="SIRET" />
                  <button onClick={autoDetectOpco} disabled={detectingOpco || !(editForm.siret || '').replace(/\s/g, '')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Détecter OPCO et enrichir l'adresse">
                    {detectingOpco ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Détecter
                  </button>
                </div>
              </div>
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
              <div className="col-span-2"><label className="text-xs font-medium text-gray-500 mb-1 flex items-center justify-between">Notes <SpeechToTextButton onTranscript={(text) => setEditForm(f => ({ ...f, notes: f.notes ? f.notes + ' ' + text : text }))} /></label>
                <textarea value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div className="col-span-2"><label className="text-xs font-medium text-gray-500 mb-1 block">OPCO</label>
                <select value={editForm.opco_name || ''} onChange={e => setEditForm({ ...editForm, opco_name: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">— Aucun OPCO —</option>
                  {OPCO_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                  {editForm.opco_name && !OPCO_LIST.includes(editForm.opco_name) && (
                    <option value={editForm.opco_name}>{editForm.opco_name} (détecté)</option>
                  )}
                </select>
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
              {client.notes && (
                <div className="col-span-full mt-2 bg-gray-50 rounded-lg p-3 text-gray-600"><p className="whitespace-pre-wrap">{client.notes}</p></div>
              )}
              {client.opco_name && (
                <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-700">OPCO : <strong>{client.opco_name}</strong></span></div>
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
                        {c.is_billing && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded font-medium" title="Contact facturation">
                            💰 Facturation
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

                <button onClick={() => { setEditingContact(null); setContactForm({ name: '', role: '', email: '', phone: '', is_primary: false, is_document_contact: false, is_billing: false }); setShowContactForm(true) }}
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
                <div className="flex gap-2 mb-3">
                  <button onClick={() => { setShowInteractionForm(!showInteractionForm); setShowEmailForm(false) }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300 transition-colors">
                    <Plus className="w-4 h-4" /> Ajouter une interaction
                  </button>
                  <button onClick={() => { openEmailForm(); setShowInteractionForm(false) }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-green-600 hover:bg-green-50 rounded-lg border border-dashed border-green-300 transition-colors">
                    <Mail className="w-4 h-4" /> Envoyer un email
                  </button>
                </div>

                {/* ── Formulaire email direct ── */}
                {showEmailForm && (
                  <div className="bg-green-50/50 border border-green-200 rounded-lg p-4 mb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-green-800">📧 Envoyer un email</h3>
                      <button onClick={() => setShowEmailForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>

                    {/* Destinataire */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Destinataire</label>
                      {contacts.filter(c => c.email).length > 0 ? (
                        <select value={emailForm.to} onChange={e => setEmailForm(f => ({ ...f, to: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                          <option value="">— Choisir un contact —</option>
                          {contacts.filter(c => c.email).map(c => (
                            <option key={c.id} value={c.email}>{c.name} — {c.email} {c.is_primary ? '⭐' : ''}</option>
                          ))}
                          {client?.contact_email && !contacts.find(c => c.email === client.contact_email) && (
                            <option value={client.contact_email}>{client.contact_email} (fiche client)</option>
                          )}
                        </select>
                      ) : (
                        <input type="email" value={emailForm.to} onChange={e => setEmailForm(f => ({ ...f, to: e.target.value }))}
                          placeholder="email@exemple.com" className="w-full px-3 py-2 border rounded-lg text-sm" />
                      )}
                    </div>

                    {/* Expéditeur */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">Expéditeur</label>
                      <div className="flex gap-1.5">
                        {AUTHORS.map(name => (
                          <button key={name} onClick={() => setEmailForm(f => ({ ...f, sender: name }))}
                            className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                              (emailForm.sender === name ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300')}>
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Brief IA */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 flex items-center justify-between">
                        ✨ Décrivez votre email en quelques mots
                        <SpeechToTextButton onTranscript={(text) => setEmailForm(f => ({ ...f, brief: f.brief ? f.brief + ' ' + text : text }))} />
                      </label>
                      <div className="flex gap-2">
                        <textarea value={emailForm.brief} onChange={e => setEmailForm(f => ({ ...f, brief: e.target.value }))}
                          placeholder="Ex: Relancer pour le devis SST, proposer une date en mars..."
                          rows={2} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                        <button onClick={generateEmailIA} disabled={emailGenerating}
                          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-xs font-medium hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5">
                          {emailGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '✨'} Générer
                        </button>
                      </div>
                    </div>

                    {/* Objet */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Objet</label>
                      <input value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="Objet de l'email..." className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>

                    {/* Corps */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 flex items-center justify-between">
                        Corps du message
                        <SpeechToTextButton onTranscript={(text) => setEmailForm(f => ({ ...f, body: f.body ? f.body + ' ' + text : text }))} />
                      </label>
                      <textarea value={emailForm.body} onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))}
                        placeholder="Le contenu de votre email..."
                        rows={6} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      <p className="text-[10px] text-gray-400 mt-1">La signature Access Formation sera ajoutée automatiquement. BCC : contact@accessformation.pro</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button onClick={() => setShowEmailForm(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Annuler</button>
                      <button onClick={sendClientEmail} disabled={emailSending || !emailForm.to || !emailForm.subject || !emailForm.body}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 shadow-sm disabled:opacity-50">
                        {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Envoyer
                      </button>
                    </div>
                  </div>
                )}

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
                      <label className="text-xs font-medium text-gray-500 mb-1 flex items-center justify-between">Détails <SpeechToTextButton onTranscript={(text) => setInteractionForm(f => ({ ...f, content: f.content ? f.content + ' ' + text : text }))} /></label>
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
                                {item.source === 'email' && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">Campus</span>}
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
                <label className="flex items-center gap-2.5 text-sm cursor-pointer p-2 rounded-lg hover:bg-green-50 transition-colors">
                  <input type="checkbox" checked={contactForm.is_billing} onChange={e => setContactForm(f => ({ ...f, is_billing: e.target.checked }))} className="rounded border-gray-300 text-green-500 focus:ring-green-500" />
                  <span className="text-lg">💰</span>
                  <div>
                    <p className="font-medium text-gray-700">Contact facturation</p>
                    <p className="text-xs text-gray-400">Reçoit les factures et avoirs</p>
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
