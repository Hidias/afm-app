import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { generateQuotePDF } from '../lib/quoteGenerator'
import {
  Plus, Search, FileText, ArrowLeft, Trash2, Save, Send, Copy,
  ChevronDown, ChevronUp, Eye, MoreHorizontal, Check, X, Edit2,
  Download, RefreshCw, Building2, GripVertical, Pen, Mail, Loader2
} from 'lucide-react'

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', class: 'bg-gray-100 text-gray-700', icon: '📝' },
  sent: { label: 'Envoyé', class: 'bg-blue-100 text-blue-700', icon: '📤' },
  accepted: { label: 'Accepté', class: 'bg-green-100 text-green-700', icon: '✅' },
  refused: { label: 'Refusé', class: 'bg-red-100 text-red-700', icon: '❌' },
  expired: { label: 'Expiré', class: 'bg-orange-100 text-orange-700', icon: '⏰' },
  invoiced: { label: 'Facturé', class: 'bg-purple-100 text-purple-700', icon: '🧾' }
}

const PAYMENT_METHODS = [
  'virement bancaire',
  'chèque, virement bancaire',
  'virement bancaire, prélèvement',
  'chèque'
]

const PAYMENT_TERMS = [
  'À réception de facture',
  'À la commande',
  'à 30 jours',
  'à 30 jours fin de mois',
  'à 45 jours',
  'à 45 jours fin de mois',
  'à 60 jours',
  'à 60 jours fin de mois'
]

const CONTACTS_LABEL = { 'Hicham Saidi': 'Hicham Saidi', 'Maxime Langlais': 'Maxime Langlais' }

// ============================================================
// SIGNATURE PAD COMPONENT
// ============================================================
function SignaturePad({ value, onChange, onClear }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(!!value)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height)
      img.src = value
    }
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const startDraw = useCallback((e) => {
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(getPos(e).x, getPos(e).y)
    setIsDrawing(true)
    setHasDrawn(true)
  }, [getPos])

  const draw = useCallback((e) => {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineTo(getPos(e).x, getPos(e).y)
    ctx.stroke()
  }, [isDrawing, getPos])

  const endDraw = useCallback(() => {
    if (!isDrawing) return
    setIsDrawing(false)
    onChange(canvasRef.current.toDataURL('image/png'))
  }, [isDrawing, onChange])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width * 2, rect.height * 2)
    setHasDrawn(false)
    onClear()
  }, [onClear])

  return (
    <div>
      <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white relative">
        <canvas ref={canvasRef} className="w-full cursor-crosshair"
          style={{ height: '120px', touchAction: 'none' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
        {!hasDrawn && !value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 text-sm flex items-center gap-2"><Pen size={16} /> Signez ici</p>
          </div>
        )}
      </div>
      {(hasDrawn || value) && (
        <button onClick={clearCanvas} className="mt-1 text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
          <X size={12} /> Effacer la signature
        </button>
      )}
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function Quotes() {
  const [quotes, setQuotes] = useState([])
  const [clients, setClients] = useState([])
  const [contacts, setContacts] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [mode, setMode] = useState('list')
  const [currentQuote, setCurrentQuote] = useState(null)
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // === Send Wizard State ===
  const [sendWizard, setSendWizard] = useState(null) // { quote, client, contact, items, pdfBlobUrl, pdfBase64 }
  const [sendStep, setSendStep] = useState(1) // 1=aperçu PDF, 2=texte email, 3=recap+envoi
  const [sendEmail, setSendEmail] = useState({ to: '', subject: '', body: '', customInstructions: '' })
  const [sendLoading, setSendLoading] = useState(false)
  const [sendSending, setSendSending] = useState(false)

  const emptyQuote = {
    client_id: '', contact_id: '', session_id: '',
    quote_date: format(new Date(), 'yyyy-MM-dd'), validity_date: '', object: '',
    client_reference: '', status: 'draft', payment_method: 'virement bancaire',
    payment_terms: 'à 30 jours', payment_deadline: '', discount_percent: 0,
    discount_label: '', tva_rate: 20, tva_applicable: true, notes: '',
    created_by: 'Hicham Saidi', signature_base64: null
  }

  const emptyItem = {
    code: '', description_title: '', description_detail: '',
    quantity: 1, unit: 'unité', unit_price_ht: 0, tva_rate: 20, course_id: ''
  }

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [quotesRes, clientsRes, coursesRes] = await Promise.all([
      supabase.from('quotes').select('*, clients(name, siret, address, postal_code, city, contact_phone, contact_email)').order('quote_date', { ascending: false }),
      supabase.from('clients').select('id, name, siret, address, postal_code, city, contact_phone, contact_email, status').order('name'),
      supabase.from('courses').select('id, title, code, price_ht, duration_hours, duration_days, description').order('title')
    ])
    setQuotes(quotesRes.data || [])
    setClients(clientsRes.data || [])
    setCourses(coursesRes.data || [])
    setLoading(false)
  }

  async function loadQuoteItems(quoteId) {
    const { data } = await supabase.from('quote_items').select('*').eq('quote_id', quoteId).order('position')
    return data || []
  }

  async function loadClientContacts(clientId) {
    if (!clientId) { setContacts([]); return }
    const { data } = await supabase.from('client_contacts').select('*').eq('client_id', clientId)
      .order('is_primary', { ascending: false }).order('name')
    setContacts(data || [])
  }

  async function generateReference() {
    const today = format(new Date(), 'yyyyMMdd')
    const { data } = await supabase.from('quotes').select('reference')
      .like('reference', `DEV-${today}%`).order('reference', { ascending: false }).limit(1)
    let nextNum = 1
    if (data && data.length > 0) {
      const parts = data[0].reference.split('-')
      nextNum = parseInt(parts[2] || '0') + 1
    }
    return `DEV-${today}-${String(nextNum).padStart(5, '0')}`
  }

  function calcItemTotal(item) {
    return parseFloat(item.quantity || 0) * parseFloat(item.unit_price_ht || 0)
  }

  function calcTotals(itemsList, discountPercent, tvaRate, tvaApplicable) {
    const subtotalHt = itemsList.reduce((sum, item) => sum + calcItemTotal(item), 0)
    const discountAmount = subtotalHt * (parseFloat(discountPercent || 0) / 100)
    const totalHt = subtotalHt - discountAmount
    const totalTva = tvaApplicable ? totalHt * (parseFloat(tvaRate || 20) / 100) : 0
    return { subtotalHt, discountAmount, totalHt, totalTva, totalTtc: totalHt + totalTva }
  }

  function calcValidityDate(quoteDate) {
    const d = new Date(quoteDate); d.setDate(d.getDate() + 30)
    return format(d, 'yyyy-MM-dd')
  }

  async function openCreate() {
    const ref = await generateReference()
    const qDate = format(new Date(), 'yyyy-MM-dd')
    const vDate = calcValidityDate(qDate)
    setCurrentQuote({ ...emptyQuote, reference: ref, quote_date: qDate, validity_date: vDate, payment_deadline: vDate })
    setItems([])
    setContacts([])
    setMode('create')
  }

  async function openEdit(quote) {
    const loadedItems = await loadQuoteItems(quote.id)
    await loadClientContacts(quote.client_id)
    setCurrentQuote({
      ...quote, quote_date: quote.quote_date || '', validity_date: quote.validity_date || '',
      payment_deadline: quote.payment_deadline || '', discount_percent: quote.discount_percent || 0,
      discount_label: quote.discount_label || '', tva_rate: quote.tva_rate || 20,
      tva_applicable: quote.tva_applicable !== false, signature_base64: quote.signature_base64 || null,
    })
    setItems(loadedItems)
    setMode('edit')
  }

  async function duplicateQuote(quote) {
    const ref = await generateReference()
    const qDate = format(new Date(), 'yyyy-MM-dd')
    const vDate = calcValidityDate(qDate)
    const loadedItems = await loadQuoteItems(quote.id)
    await loadClientContacts(quote.client_id)
    setCurrentQuote({
      ...quote, id: undefined, reference: ref, quote_date: qDate, validity_date: vDate,
      payment_deadline: vDate, status: 'draft', created_at: undefined, updated_at: undefined,
      clients: undefined, signature_base64: null,
    })
    setItems(loadedItems.map((it, i) => ({ ...it, id: undefined, quote_id: undefined, position: i })))
    setMode('create')
  }

  async function saveQuote() {
    if (!currentQuote.client_id) return toast.error('Sélectionnez un client')
    if (items.length === 0 || !items[0].description_title) return toast.error('Ajoutez au moins une ligne')
    setSaving(true)
    const totals = calcTotals(items, currentQuote.discount_percent, currentQuote.tva_rate, currentQuote.tva_applicable)
    const quoteData = {
      reference: currentQuote.reference, client_id: currentQuote.client_id,
      contact_id: currentQuote.contact_id || null, session_id: currentQuote.session_id || null,
      quote_date: currentQuote.quote_date, validity_date: currentQuote.validity_date || null,
      object: currentQuote.object || '', client_reference: currentQuote.client_reference || '',
      status: currentQuote.status, payment_method: currentQuote.payment_method,
      payment_terms: currentQuote.payment_terms, payment_deadline: currentQuote.payment_deadline || null,
      discount_percent: parseFloat(currentQuote.discount_percent) || 0,
      discount_label: currentQuote.discount_label || '',
      tva_rate: parseFloat(currentQuote.tva_rate) || 20, tva_applicable: currentQuote.tva_applicable,
      total_ht: totals.totalHt, total_tva: totals.totalTva, total_ttc: totals.totalTtc,
      notes: currentQuote.notes || '', created_by: currentQuote.created_by,
      signature_base64: currentQuote.signature_base64 || null,
      updated_at: new Date().toISOString()
    }
    try {
      let quoteId
      if (mode === 'create') {
        const { data, error } = await supabase.from('quotes').insert(quoteData).select().single()
        if (error) throw error
        quoteId = data.id
      } else {
        const { error } = await supabase.from('quotes').update(quoteData).eq('id', currentQuote.id)
        if (error) throw error
        quoteId = currentQuote.id
        await supabase.from('quote_items').delete().eq('quote_id', quoteId)
      }
      const itemsToInsert = items.filter(it => it.description_title).map((it, i) => ({
        quote_id: quoteId, position: i, code: it.code || '',
        description_title: it.description_title, description_detail: it.description_detail || '',
        quantity: parseFloat(it.quantity) || 1, unit: it.unit || 'unité',
        unit_price_ht: parseFloat(it.unit_price_ht) || 0, tva_rate: parseFloat(it.tva_rate) || 20,
        total_ht: calcItemTotal(it), course_id: it.course_id || null
      }))
      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('quote_items').insert(itemsToInsert)
        if (itemsError) throw itemsError
      }
      toast.success(mode === 'create' ? 'Devis créé' : 'Devis mis à jour')
      setMode('list')
      loadAll()
    } catch (err) { toast.error('Erreur: ' + err.message) }
    setSaving(false)
  }

  async function deleteQuote(id) {
    if (!confirm('Supprimer ce devis ?')) return
    await supabase.from('quote_items').delete().eq('quote_id', id)
    await supabase.from('quotes').delete().eq('id', id)
    toast.success('Devis supprimé')
    loadAll()
  }

  async function updateStatus(id, newStatus) {
    await supabase.from('quotes').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    toast.success(`Statut → ${STATUS_CONFIG[newStatus].label}`)
    loadAll()
  }

  // === PDF from list ===
  async function downloadPDF(quote) {
    setGeneratingPdf(true)
    try {
      const loadedItems = await loadQuoteItems(quote.id)
      const clientData = quote.clients || clients.find(c => c.id === quote.client_id) || {}
      let contactData = null
      if (quote.contact_id) {
        const { data } = await supabase.from('client_contacts').select('*').eq('id', quote.contact_id).single()
        contactData = data
      }
      await generateQuotePDF(quote, loadedItems, clientData, contactData)
      toast.success('PDF généré !')
    } catch (err) { console.error(err); toast.error('Erreur PDF: ' + err.message) }
    setGeneratingPdf(false)
  }

  // === PDF from form ===
  async function downloadCurrentPDF() {
    setGeneratingPdf(true)
    try {
      const clientData = clients.find(c => c.id === currentQuote.client_id) || {}
      const contactData = currentQuote.contact_id ? contacts.find(c => c.id === currentQuote.contact_id) || null : null
      const itemsForPdf = items.filter(it => it.description_title).map(it => ({ ...it, total_ht: calcItemTotal(it) }))
      await generateQuotePDF(currentQuote, itemsForPdf, clientData, contactData)
      toast.success('PDF généré !')
    } catch (err) { console.error(err); toast.error('Erreur PDF: ' + err.message) }
    setGeneratingPdf(false)
  }

  // ============================================================
  // SEND WIZARD
  // ============================================================
  async function openSendWizard(quote) {
    setSendLoading(true)
    try {
      // Load quote items
      const loadedItems = await loadQuoteItems(quote.id)
      // Client data
      const clientData = quote.clients || clients.find(c => c.id === quote.client_id) || {}
      // Contact data
      let contactData = null
      if (quote.contact_id) {
        const { data } = await supabase.from('client_contacts').select('*').eq('id', quote.contact_id).single()
        contactData = data
      }
      // All contacts for this client (for recipient selection)
      let clientContacts = []
      if (quote.client_id) {
        const { data } = await supabase.from('client_contacts').select('*').eq('client_id', quote.client_id)
          .order('is_primary', { ascending: false }).order('name')
        clientContacts = data || []
      }

      // Generate PDF without downloading
      const doc = await generateQuotePDF(quote, loadedItems, clientData, contactData, { skipSave: true })
      const pdfBase64 = doc.output('base64')
      const pdfBlob = doc.output('blob')
      const pdfBlobUrl = URL.createObjectURL(pdfBlob)

      console.log('=== DEBUG PDF GEN ===')
      console.log('doc type:', typeof doc)
      console.log('pdfBase64 length:', pdfBase64?.length || 0)
      console.log('pdfBlob size:', pdfBlob?.size || 0)

      // Find default recipient email
      let defaultTo = ''
      if (contactData?.email) {
        defaultTo = contactData.email
      } else if (clientData?.contact_email) {
        defaultTo = clientData.contact_email
      }

      setSendWizard({
        quote, client: clientData, contact: contactData, items: loadedItems,
        pdfBlobUrl, pdfBase64, clientContacts
      })
      setSendEmail({ to: defaultTo, subject: '', body: '', customInstructions: '' })
      setSendStep(1)
    } catch (err) {
      console.error('Erreur ouverture envoi:', err)
      toast.error('Erreur: ' + err.message)
    }
    setSendLoading(false)
  }

  function closeSendWizard() {
    if (sendWizard?.pdfBlobUrl) URL.revokeObjectURL(sendWizard.pdfBlobUrl)
    setSendWizard(null)
    setSendStep(1)
    setSendEmail({ to: '', subject: '', body: '', customInstructions: '' })
  }

  async function generateEmailText() {
    if (!sendWizard) return
    setSendLoading(true)
    try {
      const { quote, client, contact, items } = sendWizard
      const resp = await fetch('/api/generate-quote-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote, client, contact, items,
          senderName: quote.created_by || 'Hicham Saidi',
          customInstructions: sendEmail.customInstructions || ''
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Erreur génération')
      setSendEmail(prev => ({ ...prev, subject: data.subject || '', body: data.body || '' }))
      toast.success('Texte généré !')
    } catch (err) {
      console.error('Erreur génération email:', err)
      toast.error('Erreur: ' + err.message)
      // Fallback text
      const { quote, client } = sendWizard
      setSendEmail(prev => ({
        ...prev,
        subject: `Devis ${quote.reference} - Access Formation`,
        body: `Bonjour,\n\nSuite à notre échange, veuillez trouver ci-joint notre devis ${quote.reference} relatif à votre projet de formation.\n\nNous restons à votre disposition pour tout complément d'information.\n\nBien cordialement`
      }))
    }
    setSendLoading(false)
  }

  async function handleSendQuoteEmail() {
    if (!sendWizard || !sendEmail.to || !sendEmail.subject || !sendEmail.body) {
      return toast.error('Veuillez remplir tous les champs')
    }
    setSendSending(true)
    try {
      // Get userId from supabase auth
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser?.id) {
        throw new Error('Session expirée. Reconnectez-vous.')
      }
      const { quote, pdfBase64 } = sendWizard
      console.log('=== DEBUG ENVOI DEVIS ===')
      console.log('pdfBase64 exists:', !!pdfBase64)
      console.log('pdfBase64 length:', pdfBase64?.length || 0)
      console.log('pdfBase64 first 50 chars:', pdfBase64?.substring(0, 50))
      const resp = await fetch('/api/send-quote-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authUser.id,
          to: sendEmail.to,
          subject: sendEmail.subject,
          body: sendEmail.body,
          pdfBase64: pdfBase64,
          pdfFilename: `${quote.reference}.pdf`,
          quoteId: quote.id
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Erreur envoi')
      toast.success('Devis envoyé par email !')
      closeSendWizard()
      loadAll() // Refresh pour voir le nouveau statut
    } catch (err) {
      console.error('Erreur envoi email:', err)
      toast.error('Erreur: ' + err.message)
    }
    setSendSending(false)
  }

  function updateItem(index, field, value) {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }
  function addItem() { setItems([...items, { ...emptyItem, position: items.length }]) }
  function removeItem(index) {
    if (items.length <= 1) return toast.error('Au moins une ligne requise')
    setItems(items.filter((_, i) => i !== index))
  }
  function addFromCourse(course) {
    setItems([...items, {
      ...emptyItem, code: course.code || '', description_title: course.title,
      description_detail: course.description || '', unit_price_ht: course.price_ht || 0,
      course_id: course.id, position: items.length
    }])
  }
  function handleClientChange(clientId) {
    setCurrentQuote(prev => ({ ...prev, client_id: clientId, contact_id: '' }))
    loadClientContacts(clientId)
  }
  function handleDateChange(date) {
    const vDate = calcValidityDate(date)
    setCurrentQuote(prev => ({ ...prev, quote_date: date, validity_date: vDate, payment_deadline: vDate }))
  }

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const matchSearch = !search ||
        q.reference?.toLowerCase().includes(search.toLowerCase()) ||
        q.clients?.name?.toLowerCase().includes(search.toLowerCase()) ||
        q.object?.toLowerCase().includes(search.toLowerCase())
      return matchSearch && (!statusFilter || q.status === statusFilter)
    })
  }, [quotes, search, statusFilter])

  function money(val) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val || 0)
  }

  // ==================== RENDER ====================
  return (
    <>
      {mode === 'list' ? renderList() : renderForm()}
      {sendWizard && renderSendWizard()}
    </>
  )

  function renderList() {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Devis</h1>
            <p className="text-sm text-gray-500 mt-1">{filteredQuotes.length} devis</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium">
            <Plus size={18} /> Nouveau devis
          </button>
        </div>
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Rechercher par référence, client, objet..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Brouillons', status: 'draft', color: 'gray' },
            { label: 'Envoyés', status: 'sent', color: 'blue' },
            { label: 'Acceptés', status: 'accepted', color: 'green' },
            { label: 'CA potentiel', status: null, color: 'indigo' }
          ].map((s, i) => {
            const count = s.status ? quotes.filter(q => q.status === s.status).length : null
            const ca = !s.status ? quotes.filter(q => q.status === 'sent' || q.status === 'accepted')
              .reduce((sum, q) => sum + (q.total_ttc || 0), 0) : null
            return (
              <div key={i} className={`bg-white p-4 rounded-xl border border-${s.color}-100`}>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-xl font-bold text-${s.color}-600`}>
                  {s.status !== null ? count : money(ca)}
                </p>
              </div>
            )
          })}
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">{search || statusFilter ? 'Aucun résultat' : 'Aucun devis — Créez-en un !'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredQuotes.map(q => (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-mono text-gray-500">{q.reference}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CONFIG[q.status]?.class || 'bg-gray-100'}`}>
                        {STATUS_CONFIG[q.status]?.icon} {STATUS_CONFIG[q.status]?.label || q.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{q.clients?.name || 'Client inconnu'}</h3>
                    {q.object && <p className="text-sm text-gray-500 truncate mt-0.5">{q.object}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>📅 {q.quote_date ? format(new Date(q.quote_date), 'dd MMM yyyy', { locale: fr }) : '-'}</span>
                      {q.validity_date && <span>⏳ Valide jusqu'au {format(new Date(q.validity_date), 'dd/MM/yyyy')}</span>}
                      <span>👤 {q.created_by}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-lg font-bold text-gray-900">{money(q.total_ttc)}</p>
                    <p className="text-xs text-gray-400">{money(q.total_ht)} HT</p>
                    <div className="flex items-center gap-1 mt-2 justify-end">
                      <button onClick={() => downloadPDF(q)} title="Télécharger PDF" disabled={generatingPdf}
                        className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-gray-50 rounded transition-colors disabled:opacity-50">
                        <Download size={16} />
                      </button>
                      <button onClick={() => openEdit(q)} title="Modifier"
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-50 rounded transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => duplicateQuote(q)} title="Dupliquer"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors">
                        <Copy size={16} />
                      </button>
                      {(q.status === 'draft' || q.status === 'sent') && (
                        <button onClick={() => openSendWizard(q)} title={q.status === 'sent' ? 'Renvoyer par email' : 'Envoyer par email'}
                          disabled={sendLoading}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-gray-50 rounded transition-colors disabled:opacity-50">
                          {sendLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                      )}
                      <button onClick={() => deleteQuote(q.id)} title="Supprimer"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-50 rounded transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderForm() {
    const totals = calcTotals(items, currentQuote.discount_percent, currentQuote.tva_rate, currentQuote.tva_applicable)
    const selectedClient = clients.find(c => c.id === currentQuote.client_id)
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMode('list')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {mode === 'create' ? 'Nouveau devis' : `Devis ${currentQuote.reference}`}
              </h1>
              <p className="text-sm text-gray-500">
                {mode === 'create' ? currentQuote.reference : `Créé le ${currentQuote.created_at ? format(new Date(currentQuote.created_at), 'dd/MM/yyyy', { locale: fr }) : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'edit' && (
              <>
                <select value={currentQuote.status}
                  onChange={(e) => setCurrentQuote(prev => ({ ...prev, status: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
                <button onClick={downloadCurrentPDF} disabled={generatingPdf}
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors text-sm disabled:opacity-50">
                  <Download size={15} /> {generatingPdf ? 'Génération...' : 'PDF'}
                </button>
              </>
            )}
            <button onClick={() => setMode('list')}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Annuler</button>
            <button onClick={saveQuote} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50">
              <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Client + Contact */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Building2 size={18} /> Client</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                  <select value={currentQuote.client_id} onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500">
                    <option value="">— Sélectionner —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                  <select value={currentQuote.contact_id || ''}
                    onChange={(e) => setCurrentQuote(prev => ({ ...prev, contact_id: e.target.value || null }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500">
                    <option value="">— Aucun —</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.civilite ? c.civilite + ' ' : ''}{c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim()} {c.role ? `(${c.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {selectedClient && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                  {selectedClient.address && <p>{selectedClient.address}</p>}
                  {(selectedClient.postal_code || selectedClient.city) && <p>{selectedClient.postal_code} {selectedClient.city}</p>}
                  {selectedClient.siret && <p className="text-xs text-gray-400 mt-1">SIRET : {selectedClient.siret}</p>}
                </div>
              )}
            </div>

            {/* Objet + Réf */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Objet du devis</label>
                  <input type="text" value={currentQuote.object}
                    onChange={(e) => setCurrentQuote(prev => ({ ...prev, object: e.target.value }))}
                    placeholder="Ex : Formation SST en intra"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Réf. client</label>
                  <input type="text" value={currentQuote.client_reference}
                    onChange={(e) => setCurrentQuote(prev => ({ ...prev, client_reference: e.target.value }))}
                    placeholder="Optionnel"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Access Formation</label>
                  <select value={currentQuote.created_by}
                    onChange={(e) => setCurrentQuote(prev => ({ ...prev, created_by: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500">
                    {Object.entries(CONTACTS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Lignes du devis</h2>
                <div className="flex gap-2">
                  <div className="relative group">
                    <button className="text-sm px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1">
                      <Plus size={14} /> Depuis formation
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 hidden group-hover:block max-h-64 overflow-y-auto">
                      {courses.map(c => (
                        <button key={c.id} onClick={() => addFromCourse(c)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                          <p className="text-sm font-medium text-gray-800">{c.title}</p>
                          <p className="text-xs text-gray-400">{c.code} · {c.price_ht ? money(c.price_ht) : 'Prix à définir'}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={addItem}
                    className="text-sm px-3 py-1.5 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors flex items-center gap-1">
                    <Plus size={14} /> Ligne libre
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Code</label>
                        <input type="text" value={item.code} onChange={(e) => updateItem(idx, 'code', e.target.value)}
                          placeholder="B0H0FIA" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" />
                      </div>
                      <div className="col-span-10">
                        <label className="block text-xs text-gray-500 mb-1">Titre *</label>
                        <input type="text" value={item.description_title} onChange={(e) => updateItem(idx, 'description_title', e.target.value)}
                          placeholder="Formation initiale B0H0 en Intra 7 heures :"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-medium" />
                      </div>
                      <div className="col-span-12">
                        <label className="block text-xs text-gray-500 mb-1">Description</label>
                        <textarea value={item.description_detail} onChange={(e) => updateItem(idx, 'description_detail', e.target.value)}
                          rows={2} placeholder="Formation initiale à la préparation à l'habilitation électrique en Intra (7 heures)"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm resize-none" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Qté</label>
                        <input type="number" step="0.01" min="0" value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Unité</label>
                        <input type="text" value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-500 mb-1">PU HT (€)</label>
                        <input type="number" step="0.01" min="0" value={item.unit_price_ht}
                          onChange={(e) => updateItem(idx, 'unit_price_ht', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">TVA %</label>
                        <input type="number" step="0.01" value={item.tva_rate}
                          onChange={(e) => updateItem(idx, 'tva_rate', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right" />
                      </div>
                      <div className="col-span-3 flex items-end justify-between">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Total HT</label>
                          <p className="text-sm font-semibold text-gray-900 py-1.5">{money(calcItemTotal(item))}</p>
                        </div>
                        <button onClick={() => removeItem(idx)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors mb-1"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Totals */}
              <div className="mt-6 flex justify-end">
                <div className="w-80 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Montant total HT</span>
                    <span className="font-medium">{money(totals.subtotalHt)}</span>
                  </div>
                  {parseFloat(currentQuote.discount_percent) > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-orange-600">
                        <span>Réduction HT ({currentQuote.discount_percent}%){currentQuote.discount_label ? ` — ${currentQuote.discount_label}` : ''}</span>
                        <span>-{money(totals.discountAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-1">
                        <span className="text-gray-500">Total net après réduction</span>
                        <span className="font-medium">{money(totals.totalHt)}</span>
                      </div>
                    </>
                  )}
                  <div className="border-t pt-2">
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total net HT</span><span>{money(totals.totalHt)}</span>
                    </div>
                  </div>
                  {currentQuote.tva_applicable ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">TVA {currentQuote.tva_rate}%</span>
                      <span>{money(totals.totalTva)}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">TVA non applicable (art. 261 CGI)</div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2 text-primary-700">
                    <span>Montant total TTC</span><span>{money(totals.totalTtc)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea value={currentQuote.notes}
                onChange={(e) => setCurrentQuote(prev => ({ ...prev, notes: e.target.value }))}
                rows={3} placeholder="Notes visibles sur le devis (ex: 5% remise BNI)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary-500" />
            </div>

            {/* Signature pad */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><Pen size={16} /> Signature client</h2>
              <p className="text-xs text-gray-400 mb-3">
                Signature précédée de la mention "Lu et approuvé, bon pour accord". Laissez vide pour imprimer avec zone de signature.
              </p>
              <SignaturePad
                value={currentQuote.signature_base64}
                onChange={(data) => setCurrentQuote(prev => ({ ...prev, signature_base64: data }))}
                onClear={() => setCurrentQuote(prev => ({ ...prev, signature_base64: null }))}
              />
            </div>
          </div>

          {/* RIGHT: Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">📅 Dates</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date du devis</label>
                  <input type="date" value={currentQuote.quote_date} onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date de validité</label>
                  <input type="date" value={currentQuote.validity_date}
                    onChange={(e) => setCurrentQuote(prev => ({ ...prev, validity_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">💰 Conditions</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Moyen de règlement</label>
                  <select value={currentQuote.payment_method}
                    onChange={(e) => setCurrentQuote(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Délai de règlement</label>
                  <select value={currentQuote.payment_terms}
                    onChange={(e) => setCurrentQuote(prev => ({ ...prev, payment_terms: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date limite de règlement</label>
                  <input type="date" value={currentQuote.payment_deadline}
                    onChange={(e) => setCurrentQuote(prev => ({ ...prev, payment_deadline: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">📊 TVA & Remise</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={currentQuote.tva_applicable}
                    onChange={(e) => setCurrentQuote(prev => ({ ...prev, tva_applicable: e.target.checked }))}
                    className="rounded" id="tva-check" />
                  <label htmlFor="tva-check" className="text-sm text-gray-700">TVA applicable</label>
                </div>
                {currentQuote.tva_applicable && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Taux TVA (%)</label>
                    <input type="number" step="0.01" value={currentQuote.tva_rate}
                      onChange={(e) => setCurrentQuote(prev => ({ ...prev, tva_rate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Remise globale (%)</label>
                  <input type="number" step="0.01" min="0" max="100" value={currentQuote.discount_percent}
                    onChange={(e) => setCurrentQuote(prev => ({ ...prev, discount_percent: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                {parseFloat(currentQuote.discount_percent) > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Libellé remise</label>
                    <input type="text" value={currentQuote.discount_label}
                      onChange={(e) => setCurrentQuote(prev => ({ ...prev, discount_label: e.target.value }))}
                      placeholder="Ex: 5% remise BNI"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                )}
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border border-primary-100 p-5">
              <h2 className="font-semibold text-primary-800 mb-3">Récapitulatif</h2>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Lignes</span><span className="font-medium">{items.filter(i => i.description_title).length}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Total HT</span><span className="font-medium">{money(totals.totalHt)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">TVA</span><span className="font-medium">{money(totals.totalTva)}</span></div>
                <div className="flex justify-between font-bold text-primary-700 text-base border-t pt-2 mt-2">
                  <span>Total TTC</span><span>{money(totals.totalTtc)}</span>
                </div>
              </div>
            </div>
            <button onClick={downloadCurrentPDF} disabled={generatingPdf || !currentQuote.client_id}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 font-medium">
              <Download size={18} /> {generatingPdf ? 'Génération...' : 'Télécharger le PDF'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // SEND WIZARD MODAL
  // ============================================================
  function renderSendWizard() {
    const { quote, client, contact, pdfBlobUrl, clientContacts } = sendWizard
    const steps = [
      { num: 1, label: 'Aperçu PDF' },
      { num: 2, label: 'Texte email' },
      { num: 3, label: 'Envoyer' }
    ]

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col mx-4">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                <Mail className="inline w-5 h-5 mr-2 text-primary-600" />
                Envoyer le devis {quote.reference}
              </h2>
              <p className="text-sm text-gray-500">{client?.name}</p>
            </div>
            <button onClick={closeSendWizard} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-50 border-b">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  sendStep === s.num ? 'bg-primary-600 text-white' : 
                  sendStep > s.num ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {sendStep > s.num ? <Check size={16} /> : s.num}
                </div>
                <span className={`text-sm ${sendStep === s.num ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                  {s.label}
                </span>
                {i < steps.length - 1 && <div className="w-8 h-px bg-gray-300 mx-1" />}
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* STEP 1: Aperçu PDF */}
            {sendStep === 1 && (
              <div>
                <p className="text-sm text-gray-600 mb-3">Vérifiez le devis avant envoi :</p>
                <iframe
                  src={pdfBlobUrl}
                  className="w-full rounded-lg border border-gray-200"
                  style={{ height: '55vh' }}
                  title="Aperçu du devis"
                />
              </div>
            )}

            {/* STEP 2: Texte email IA */}
            {sendStep === 2 && (
              <div className="space-y-4">
                {/* Destinataire */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destinataire</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={sendEmail.to}
                      onChange={(e) => setSendEmail(prev => ({ ...prev, to: e.target.value }))}
                      placeholder="email@entreprise.fr"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    {clientContacts && clientContacts.length > 0 && (
                      <select
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) setSendEmail(prev => ({ ...prev, to: e.target.value }))
                        }}
                      >
                        <option value="">Contacts...</option>
                        {clientContacts.filter(c => c.email).map(c => (
                          <option key={c.id} value={c.email}>
                            {c.first_name || ''} {c.last_name || c.name || ''} — {c.email}
                          </option>
                        ))}
                        {client?.contact_email && (
                          <option value={client.contact_email}>Contact principal — {client.contact_email}</option>
                        )}
                      </select>
                    )}
                  </div>
                </div>

                {/* Objet */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Objet</label>
                  <input
                    type="text"
                    value={sendEmail.subject}
                    onChange={(e) => setSendEmail(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>

                {/* Corps */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Corps du message</label>
                  <textarea
                    value={sendEmail.body}
                    onChange={(e) => setSendEmail(prev => ({ ...prev, body: e.target.value }))}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-sans"
                  />
                </div>

                {/* Régénérer avec instructions */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    Instructions pour régénérer (optionnel)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sendEmail.customInstructions}
                      onChange={(e) => setSendEmail(prev => ({ ...prev, customInstructions: e.target.value }))}
                      placeholder="Ex: ton plus formel, mentionner une date limite..."
                      className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white"
                    />
                    <button
                      onClick={generateEmailText}
                      disabled={sendLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {sendLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      {sendEmail.body ? 'Régénérer' : 'Générer'}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-400">
                  La signature sera ajoutée automatiquement selon votre compte email.
                  BCC : contact@accessformation.pro
                </p>
              </div>
            )}

            {/* STEP 3: Récap & envoi */}
            {sendStep === 3 && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
                  <h3 className="font-semibold text-green-900">Récapitulatif</h3>
                  <div className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                    <span className="text-gray-500">De :</span>
                    <span className="font-medium">{quote.created_by} (Access Formation)</span>
                    <span className="text-gray-500">À :</span>
                    <span className="font-medium">{sendEmail.to}</span>
                    <span className="text-gray-500">BCC :</span>
                    <span className="text-gray-400">contact@accessformation.pro</span>
                    <span className="text-gray-500">Objet :</span>
                    <span className="font-medium">{sendEmail.subject}</span>
                    <span className="text-gray-500">Pièce jointe :</span>
                    <span className="flex items-center gap-1 text-orange-600">
                      <FileText size={14} /> {quote.reference}.pdf
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-5">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Aperçu du message :</h4>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap bg-white rounded-lg border p-4">
                    {sendEmail.body}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 italic">+ signature automatique</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
            <button
              onClick={() => sendStep > 1 ? setSendStep(sendStep - 1) : closeSendWizard()}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {sendStep === 1 ? 'Annuler' : '← Retour'}
            </button>
            <div className="flex gap-2">
              {sendStep === 1 && (
                <button
                  onClick={() => { setSendStep(2); if (!sendEmail.body) generateEmailText() }}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  PDF OK, continuer <ChevronDown size={14} className="-rotate-90" />
                </button>
              )}
              {sendStep === 2 && (
                <button
                  onClick={() => {
                    if (!sendEmail.to) return toast.error('Indiquez un destinataire')
                    if (!sendEmail.subject) return toast.error('Indiquez un objet')
                    if (!sendEmail.body) return toast.error('Générez ou rédigez le texte')
                    setSendStep(3)
                  }}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  Continuer <ChevronDown size={14} className="-rotate-90" />
                </button>
              )}
              {sendStep === 3 && (
                <button
                  onClick={handleSendQuoteEmail}
                  disabled={sendSending}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {sendSending ? (
                    <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</>
                  ) : (
                    <><Send size={16} /> Envoyer le devis</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}
