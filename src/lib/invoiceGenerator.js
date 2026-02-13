import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateInvoicePDF, calcInvoiceTotals } from '../lib/invoiceGenerator'
import { format, addDays, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  Plus, Search, FileText, Download, Send, Pencil, Trash2, X, ChevronLeft,
  CreditCard, AlertTriangle, CheckCircle, Clock, Ban, Copy, Receipt
} from 'lucide-react'

const money = (v) => parseFloat(v||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})
const calcItemTotal = (it) => (parseFloat(it.quantity)||0)*(parseFloat(it.unit_price_ht)||0)
const fmtDateShort = (d) => { if(!d) return ''; try{return format(new Date(d),'dd/MM/yyyy')}catch{return ''} }

const STATUS_MAP = {
  draft:{label:'Brouillon',color:'gray',icon:FileText}, sent:{label:'Envoyée',color:'blue',icon:Send},
  due:{label:'À régler',color:'yellow',icon:Clock}, overdue:{label:'Retard',color:'red',icon:AlertTriangle},
  partial:{label:'Partiel',color:'orange',icon:CreditCard}, paid:{label:'Payée',color:'green',icon:CheckCircle},
  cancelled:{label:'Annulée',color:'gray',icon:Ban},
}
const PAYMENT_METHODS = ['virement bancaire','chèque','prélèvement','carte bancaire','espèces']
const PAYMENT_TERMS = ['À réception de facture','à 30 jours','à 45 jours','à 60 jours']
const TVA_RATES = [0,2.1,5.5,8.5,10,20]
const CREATORS = ['Hicham Saidi','Maxime Langlais']
const emptyItem = () => ({code:'',description_title:'',description_detail:'',quantity:1,unit:'unité',unit_price_ht:0,tva_rate:20,course_id:null})

export default function Invoices() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState('list')
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [contacts, setContacts] = useState([])
  const [quotes, setQuotes] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [current, setCurrent] = useState(null)
  const [items, setItems] = useState([emptyItem()])
  const [payments, setPayments] = useState([])
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState({amount:'',payment_date:format(new Date(),'yyyy-MM-dd'),payment_method:'virement bancaire',payment_reference:'',notes:''})
  const [showQuoteSelector, setShowQuoteSelector] = useState(false)
  const [quoteSearch, setQuoteSearch] = useState('')

  // ─── Load ───
  const loadAll = useCallback(async () => {
    setLoading(true)
    const [invR,cliR,courseR,quoteR] = await Promise.all([
      supabase.from('invoices').select('*, clients(name,siret,address,postal_code,city), client_contacts(name,email,civilite,first_name,last_name)').order('invoice_date',{ascending:false}),
      supabase.from('clients').select('id,name,siret,address,postal_code,city,contact_name,contact_email,status').order('name'),
      supabase.from('courses').select('id,title,code,price_ht,duration_hours,description').order('title'),
      supabase.from('quotes').select('id,reference,client_id,contact_id,object,client_reference,discount_percent,discount_label,tva_applicable,tva_rate,payment_method,payment_terms,session_id,status,total_ht,total_ttc').order('quote_date',{ascending:false}),
    ])
    // Auto-overdue
    const now = new Date()
    const toUp = (invR.data||[]).filter(i => (i.status==='sent'||i.status==='due') && i.due_date && new Date(i.due_date)<now)
    if (toUp.length>0) {
      await Promise.all(toUp.map(i => supabase.from('invoices').update({status:'overdue',updated_at:new Date().toISOString()}).eq('id',i.id)))
      const {data:refreshed} = await supabase.from('invoices').select('*, clients(name,siret,address,postal_code,city), client_contacts(name,email,civilite,first_name,last_name)').order('invoice_date',{ascending:false})
      setInvoices(refreshed||[])
    } else { setInvoices(invR.data||[]) }
    setClients(cliR.data||[]); setCourses(courseR.data||[]); setQuotes(quoteR.data||[])
    setLoading(false)
    return { quotes: quoteR.data||[], clients: cliR.data||[] }
  },[])

  useEffect(() => {
    loadAll().then(({quotes: qs}) => {
      const fq = searchParams.get('from_quote')
      if (fq && qs.length>0) {
        const q = qs.find(x=>x.id===fq)
        if(q) { handleFromQuote(q); setSearchParams({}) }
      }
    })
  },[]) // eslint-disable-line

  const loadContacts = async (cid) => { if(!cid){setContacts([]);return}; const{data}=await supabase.from('client_contacts').select('*').eq('client_id',cid).order('is_primary',{ascending:false}); setContacts(data||[]) }
  const loadItems = async (iid) => { const{data}=await supabase.from('invoice_items').select('*').eq('invoice_id',iid).order('position'); setItems(data&&data.length>0?data:[emptyItem()]) }
  const loadPayments = async (iid) => { const{data}=await supabase.from('invoice_payments').select('*').eq('invoice_id',iid).order('payment_date',{ascending:false}); setPayments(data||[]) }

  // ─── Generate reference ───
  const generateReference = async (type='invoice') => {
    const pfx = type==='credit_note'?'AVR':'FACT', ds = format(new Date(),'yyyyMMdd')
    const {data} = await supabase.from('invoices').select('reference').like('reference',pfx+'-%').order('reference',{ascending:false}).limit(1)
    let seq = 1; if(data&&data.length>0){const m=data[0].reference.match(/-(\d+)$/); if(m)seq=parseInt(m[1])+1}
    return pfx+'-'+ds+'-'+String(seq).padStart(5,'0')
  }

  // ─── New invoice ───
  const handleNew = async (type='invoice') => {
    const ref = await generateReference(type), dd = format(addDays(new Date(),30),'yyyy-MM-dd')
    setCurrent({reference:ref,type,client_id:'',contact_id:'',quote_id:'',session_id:'',sellsy_reference:'',client_reference:'',
      invoice_date:format(new Date(),'yyyy-MM-dd'),service_start_date:'',service_end_date:'',due_date:dd,
      object:'',payment_method:'virement bancaire',payment_terms:'à 30 jours',discount_percent:0,discount_label:'',
      tva_applicable:true,notes:'',created_by:'Hicham Saidi',status:'draft',parent_reference:'',parent_invoice_id:null,amount_paid:0})
    setItems([emptyItem()]); setPayments([]); setContacts([]); setMode('create')
  }

  // ─── From quote ───
  const handleFromQuote = async (quote) => {
    const ref = await generateReference('invoice'), dd = format(addDays(new Date(),30),'yyyy-MM-dd')
    const {data:qItems} = await supabase.from('quote_items').select('*').eq('quote_id',quote.id).order('position')
    let sStart='',sEnd='',sRef=''
    if(quote.session_id){const{data:s}=await supabase.from('sessions').select('start_date,end_date,reference').eq('id',quote.session_id).single(); if(s){sStart=s.start_date||'';sEnd=s.end_date||'';sRef=s.reference||''}}
    const {data:ccs} = await supabase.from('client_contacts').select('*').eq('client_id',quote.client_id)
    const bc = ccs?.find(c=>c.is_billing)||ccs?.find(c=>c.is_primary)
    setContacts(ccs||[])
    setCurrent({reference:ref,type:'invoice',client_id:quote.client_id,contact_id:bc?.id||quote.contact_id||'',
      quote_id:quote.id,session_id:quote.session_id||'',sellsy_reference:'',client_reference:quote.client_reference||'',
      invoice_date:format(new Date(),'yyyy-MM-dd'),service_start_date:sStart,service_end_date:sEnd,due_date:dd,
      object:quote.object||'',payment_method:quote.payment_method||'virement bancaire',payment_terms:quote.payment_terms||'à 30 jours',
      discount_percent:quote.discount_percent||0,discount_label:quote.discount_label||'',tva_applicable:quote.tva_applicable!==false,
      notes:'',created_by:'Hicham Saidi',status:'draft',parent_reference:quote.reference,parent_invoice_id:null,amount_paid:0,session_reference:sRef})
    setItems((qItems||[]).map((it,i)=>({...it,id:undefined,quote_id:undefined,invoice_id:undefined,position:i})))
    setPayments([]); setShowQuoteSelector(false); setMode('create')
  }

  // ─── Credit note ───
  const handleCreateCreditNote = async (inv) => {
    const ref = await generateReference('credit_note')
    const {data:invItems} = await supabase.from('invoice_items').select('*').eq('invoice_id',inv.id).order('position')
    await loadContacts(inv.client_id)
    setCurrent({reference:ref,type:'credit_note',client_id:inv.client_id,contact_id:inv.contact_id||'',quote_id:inv.quote_id||'',
      session_id:inv.session_id||'',sellsy_reference:'',client_reference:inv.client_reference||'',
      invoice_date:format(new Date(),'yyyy-MM-dd'),service_start_date:inv.service_start_date||'',service_end_date:inv.service_end_date||'',due_date:'',
      object:'Avoir sur facture '+inv.reference,payment_method:inv.payment_method,payment_terms:inv.payment_terms,
      discount_percent:inv.discount_percent||0,discount_label:inv.discount_label||'',tva_applicable:inv.tva_applicable!==false,
      notes:'',created_by:'Hicham Saidi',status:'draft',parent_reference:inv.reference,parent_invoice_id:inv.id,amount_paid:0})
    setItems((invItems||[]).map((it,i)=>({...it,id:undefined,invoice_id:undefined,position:i})))
    setPayments([]); setMode('create')
  }

  // ─── Edit / View ───
  const handleEdit = async (inv) => { setCurrent({...inv,parent_reference:inv.parent_invoice_id?(invoices.find(i=>i.id===inv.parent_invoice_id)?.reference||''):''}); await loadContacts(inv.client_id); await loadItems(inv.id); await loadPayments(inv.id); setMode('edit') }
  const handleView = async (inv) => { setCurrent({...inv,parent_reference:inv.parent_invoice_id?(invoices.find(i=>i.id===inv.parent_invoice_id)?.reference||''):''}); await loadContacts(inv.client_id); await loadItems(inv.id); await loadPayments(inv.id); setMode('view') }

  // ─── Save ───
  const handleSave = async () => {
    if(!current.client_id){toast.error('Sélectionnez un client');return}
    if(!items.some(it=>it.description_title)){toast.error('Ajoutez au moins une ligne');return}
    setSaving(true)
    const totals = calcInvoiceTotals(items, current.discount_percent, current.tva_applicable)
    const ap = parseFloat(current.amount_paid)||0
    const invData = {
      reference:current.reference, type:current.type||'invoice', client_id:current.client_id,
      contact_id:current.contact_id||null, quote_id:current.quote_id||null, session_id:current.session_id||null,
      parent_invoice_id:current.parent_invoice_id||null, sellsy_reference:current.sellsy_reference||null,
      client_reference:current.client_reference||'', invoice_date:current.invoice_date,
      service_start_date:current.service_start_date||null, service_end_date:current.service_end_date||null,
      due_date:current.due_date||null, object:current.object||'', payment_method:current.payment_method,
      payment_terms:current.payment_terms, discount_percent:parseFloat(current.discount_percent)||0,
      discount_label:current.discount_label||'', tva_applicable:current.tva_applicable,
      total_ht:totals.subtotalHt, total_discount:totals.discountAmt, total_net_ht:totals.netHt,
      total_tva:totals.totalTva, total_ttc:totals.totalTtc, amount_paid:ap, amount_due:totals.totalTtc-ap,
      status:current.status, notes:current.notes||'', created_by:current.created_by, updated_at:new Date().toISOString(),
    }
    try {
      let iid
      if(mode==='create'){const{data,error}=await supabase.from('invoices').insert(invData).select().single(); if(error)throw error; iid=data.id}
      else{const{error}=await supabase.from('invoices').update(invData).eq('id',current.id); if(error)throw error; iid=current.id; await supabase.from('invoice_items').delete().eq('invoice_id',iid)}
      const toIns = items.filter(it=>it.description_title).map((it,i)=>({
        invoice_id:iid, position:i, code:it.code||'', description_title:it.description_title,
        description_detail:it.description_detail||'', quantity:parseFloat(it.quantity)||1, unit:it.unit||'unité',
        unit_price_ht:parseFloat(it.unit_price_ht)||0, tva_rate:parseFloat(it.tva_rate)||20,
        total_ht:calcItemTotal(it), course_id:it.course_id||null,
      }))
      if(toIns.length>0){const{error:ie}=await supabase.from('invoice_items').insert(toIns);if(ie)throw ie}
      // Update quote status if from quote
      if(current.quote_id && mode==='create'){await supabase.from('quotes').update({status:'invoiced'}).eq('id',current.quote_id)}
      toast.success(mode==='create'?(current.type==='credit_note'?'Avoir créé':'Facture créée'):'Mise à jour')
      setMode('list'); loadAll()
    }catch(err){toast.error('Erreur: '+err.message)}
    setSaving(false)
  }

  // ─── Delete ───
  const handleDelete = async (id) => { if(!confirm('Supprimer ?'))return; await supabase.from('invoice_items').delete().eq('invoice_id',id); await supabase.from('invoice_payments').delete().eq('invoice_id',id); await supabase.from('invoices').delete().eq('id',id); toast.success('Supprimée'); loadAll() }

  // ─── Status ───
  const handleStatus = async (id,s) => { await supabase.from('invoices').update({status:s,updated_at:new Date().toISOString()}).eq('id',id); toast.success('Statut mis à jour'); loadAll() }

  // ─── Payment ───
  const handleAddPayment = async () => {
    const amt = parseFloat(paymentForm.amount); if(!amt||amt<=0){toast.error('Montant invalide');return}
    const{error}=await supabase.from('invoice_payments').insert({invoice_id:current.id,amount:amt,payment_date:paymentForm.payment_date,payment_method:paymentForm.payment_method,payment_reference:paymentForm.payment_reference||null,notes:paymentForm.notes||null,created_by:current.created_by})
    if(error){toast.error('Erreur: '+error.message);return}
    const np=(parseFloat(current.amount_paid)||0)+amt, nd=(parseFloat(current.total_ttc)||0)-np, ns=nd<=0.01?'paid':'partial'
    await supabase.from('invoices').update({amount_paid:np,amount_due:Math.max(0,nd),status:ns,updated_at:new Date().toISOString()}).eq('id',current.id)
    if(current.type==='credit_note'&&current.parent_invoice_id) await supabase.from('invoices').update({status:'paid',updated_at:new Date().toISOString()}).eq('id',current.parent_invoice_id)
    toast.success('Paiement enregistré'); setCurrent({...current,amount_paid:np,amount_due:Math.max(0,nd),status:ns})
    await loadPayments(current.id); setShowPaymentForm(false)
    setPaymentForm({amount:'',payment_date:format(new Date(),'yyyy-MM-dd'),payment_method:'virement bancaire',payment_reference:'',notes:''}); loadAll()
  }

  // ─── PDF ───
  const handlePDF = async (inv, itemsList) => {
    const client = clients.find(c=>c.id===inv.client_id)
    let contact=null; if(inv.contact_id){const{data}=await supabase.from('client_contacts').select('*').eq('id',inv.contact_id).single();contact=data}
    let pRef=inv.parent_reference||''; if(!pRef&&inv.parent_invoice_id){pRef=invoices.find(i=>i.id===inv.parent_invoice_id)?.reference||''}
    if(!pRef&&inv.quote_id){pRef=quotes.find(q=>q.id===inv.quote_id)?.reference||''}
    let sRef=''; if(inv.session_id){const{data:s}=await supabase.from('sessions').select('reference').eq('id',inv.session_id).single();sRef=s?.reference||''}
    await generateInvoicePDF({...inv,parent_reference:pRef,session_reference:sRef}, itemsList||items, client, contact)
  }

  // ─── Items ───
  const updateItem = (i,f,v) => { const n=[...items]; n[i]={...n[i],[f]:v}; setItems(n) }
  const addItem = () => setItems([...items,emptyItem()])
  const removeItem = (i) => setItems(items.filter((_,x)=>x!==i))
  const addFromCourse = (c) => setItems([...items.filter(it=>it.description_title),{code:c.code||'',description_title:c.title,description_detail:c.description||'',quantity:1,unit:'unité',unit_price_ht:c.price_ht||0,tva_rate:20,course_id:c.id}])

  // ─── Filtered ───
  const filtered = useMemo(()=>invoices.filter(inv=>{
    const s=search.toLowerCase()
    return (!s||inv.reference?.toLowerCase().includes(s)||inv.clients?.name?.toLowerCase().includes(s)||inv.object?.toLowerCase().includes(s)||inv.client_reference?.toLowerCase().includes(s))
      &&(!statusFilter||inv.status===statusFilter)&&(!typeFilter||inv.type===typeFilter)
  }),[invoices,search,statusFilter,typeFilter])

  // ─── Stats ───
  const stats = useMemo(()=>{
    const inv=invoices.filter(i=>i.type==='invoice'), cr=invoices.filter(i=>i.type==='credit_note')
    return {
      paid:inv.filter(i=>i.status==='paid').reduce((s,i)=>s+(parseFloat(i.total_ttc)||0),0),
      pending:inv.filter(i=>['sent','due','partial'].includes(i.status)).reduce((s,i)=>s+(parseFloat(i.amount_due)||0),0),
      overdue:inv.filter(i=>i.status==='overdue').reduce((s,i)=>s+(parseFloat(i.amount_due)||0),0),
      credits:cr.reduce((s,i)=>s+(parseFloat(i.total_ttc)||0),0),
      invCount:inv.length, crCount:cr.length,
    }
  },[invoices])

  const currentTotals = useMemo(()=>current?calcInvoiceTotals(items,current.discount_percent,current.tva_applicable):null,[items,current?.discount_percent,current?.tva_applicable])
  const handleClientChange = async (cid) => { setCurrent(p=>({...p,client_id:cid,contact_id:''})); await loadContacts(cid) }

  // ═══════════════════════════════════════
  // LIST
  // ═══════════════════════════════════════
  if(mode==='list') return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Facturation</h1>
        <div className="flex gap-2">
          <button onClick={()=>setShowQuoteSelector(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm"><Receipt size={16}/>Depuis un devis</button>
          <button onClick={()=>handleNew('invoice')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"><Plus size={16}/>Facture libre</button>
          <button onClick={()=>handleNew('credit_note')} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 text-sm"><Plus size={16}/>Avoir</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4 border-green-200"><p className="text-xs text-gray-500">CA Payé</p><p className="text-xl font-bold text-green-600 mt-1">{money(stats.paid)}</p><p className="text-xs text-gray-400 mt-1">{stats.invCount} factures</p></div>
        <div className="bg-white border rounded-xl p-4 border-blue-200"><p className="text-xs text-gray-500">En attente</p><p className="text-xl font-bold text-blue-600 mt-1">{money(stats.pending)}</p></div>
        <div className="bg-white border rounded-xl p-4 border-red-200"><p className="text-xs text-gray-500">En retard</p><p className="text-xl font-bold text-red-600 mt-1">{money(stats.overdue)}</p></div>
        <div className="bg-white border rounded-xl p-4 border-orange-200"><p className="text-xs text-gray-500">Avoirs</p><p className="text-xl font-bold text-orange-600 mt-1">{money(stats.credits)}</p><p className="text-xs text-gray-400 mt-1">{stats.crCount} avoirs</p></div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-2.5 text-gray-400" size={16}/><input type="text" placeholder="Rechercher..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"/></div>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Tous types</option><option value="invoice">Factures</option><option value="credit_note">Avoirs</option></select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Tous statuts</option>{Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
      </div>

      {/* Table */}
      {loading?<p className="text-center py-8 text-gray-400">Chargement...</p>:filtered.length===0?<p className="text-center py-8 text-gray-500">{search||statusFilter||typeFilter?'Aucun résultat':'Aucune facture'}</p>:(
        <div className="bg-white rounded-xl border overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase">
            <th className="px-4 py-3 text-left">Référence</th><th className="px-4 py-3 text-left">Client</th><th className="px-4 py-3 text-left">Objet</th>
            <th className="px-4 py-3 text-right">HT</th><th className="px-4 py-3 text-right">TTC</th><th className="px-4 py-3 text-right">Dû</th>
            <th className="px-4 py-3 text-center">Statut</th><th className="px-4 py-3 text-center">Échéance</th><th className="px-4 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody>{filtered.map(inv=>{
            const st=STATUS_MAP[inv.status]||STATUS_MAP.draft, isCr=inv.type==='credit_note'
            const odDays = inv.status==='overdue'&&inv.due_date?differenceInDays(new Date(),new Date(inv.due_date)):0
            return(<tr key={inv.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={()=>handleView(inv)}>
              <td className="px-4 py-3 font-medium"><span className={isCr?'text-orange-600':'text-gray-900'}>{inv.reference}</span>{isCr&&<span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Avoir</span>}</td>
              <td className="px-4 py-3 text-gray-600">{inv.clients?.name||'—'}</td>
              <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{inv.object||'—'}</td>
              <td className="px-4 py-3 text-right">{money(inv.total_net_ht)}</td>
              <td className="px-4 py-3 text-right font-medium">{money(inv.total_ttc)}</td>
              <td className="px-4 py-3 text-right font-medium">{parseFloat(inv.amount_due)>0?<span className="text-red-600">{money(inv.amount_due)}</span>:'—'}</td>
              <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${st.color}-100 text-${st.color}-700`}>{st.label}</span>{odDays>0&&<span className="text-xs text-red-500 block">+{odDays}j</span>}</td>
              <td className="px-4 py-3 text-center text-xs text-gray-500">{inv.due_date?fmtDateShort(inv.due_date):'—'}</td>
              <td className="px-4 py-3 text-right" onClick={e=>e.stopPropagation()}>
                <div className="flex gap-1 justify-end">
                  <button onClick={()=>handleEdit(inv)} className="p-1.5 hover:bg-gray-100 rounded" title="Modifier"><Pencil size={14}/></button>
                  <button onClick={async()=>{const{data:ii}=await supabase.from('invoice_items').select('*').eq('invoice_id',inv.id).order('position');handlePDF(inv,ii)}} className="p-1.5 hover:bg-gray-100 rounded" title="PDF"><Download size={14}/></button>
                  {inv.status==='draft'&&<button onClick={()=>handleDelete(inv.id)} className="p-1.5 hover:bg-red-100 rounded text-red-500" title="Supprimer"><Trash2 size={14}/></button>}
                </div>
              </td>
            </tr>)
          })}</tbody>
        </table></div>
      )}

      {/* Quote selector modal */}
      {showQuoteSelector&&(<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b"><h3 className="font-semibold text-lg">Créer une facture depuis un devis</h3><button onClick={()=>setShowQuoteSelector(false)}><X size={20}/></button></div>
        <div className="p-4"><div className="relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={16}/><input type="text" placeholder="Rechercher un devis..." value={quoteSearch} onChange={e=>setQuoteSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" autoFocus/></div></div>
        <div className="overflow-y-auto flex-1 px-4 pb-4">
          {quotes.filter(q=>{if(!quoteSearch)return q.status==='accepted'||q.status==='sent';const s=quoteSearch.toLowerCase();return q.reference?.toLowerCase().includes(s)||q.object?.toLowerCase().includes(s)||clients.find(c=>c.id===q.client_id)?.name?.toLowerCase().includes(s)}).map(q=>{
            const cli=clients.find(c=>c.id===q.client_id)
            return(<button key={q.id} onClick={()=>handleFromQuote(q)} className="w-full text-left p-3 border rounded-lg mb-2 hover:bg-blue-50 hover:border-blue-300 transition-colors">
              <div className="flex justify-between items-start"><div><span className="font-medium text-sm">{q.reference}</span><span className="text-gray-500 text-sm ml-2">{cli?.name}</span></div><span className="font-semibold text-sm">{money(q.total_ttc)}</span></div>
              {q.object&&<p className="text-xs text-gray-400 mt-1 truncate">{q.object}</p>}
            </button>)
          })}
        </div>
      </div></div>)}
    </div>
  )

  // ═══════════════════════════════════════
  // FORM (create / edit / view)
  // ═══════════════════════════════════════
  const ro = mode==='view'
  const isCr = current?.type==='credit_note'
  const client = clients.find(c=>c.id===current?.client_id)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={()=>{setMode('list');loadAll()}} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20}/></button>
        <h1 className="text-xl font-bold flex-1">{mode==='create'?(isCr?'Nouvel avoir':'Nouvelle facture'):mode==='view'?current?.reference:'Modifier '+current?.reference}</h1>
        <div className="flex gap-2">
          {mode==='view'&&<>
            <button onClick={()=>handlePDF(current,items)} className="px-3 py-2 bg-gray-100 rounded-lg text-sm flex items-center gap-1"><Download size={14}/>PDF</button>
            {current.type==='invoice'&&!['cancelled','paid'].includes(current.status)&&<button onClick={()=>handleCreateCreditNote(current)} className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm flex items-center gap-1"><Copy size={14}/>Avoir</button>}
            <button onClick={()=>setMode('edit')} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1"><Pencil size={14}/>Modifier</button>
          </>}
          {(mode==='create'||mode==='edit')&&<button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{saving?'Enregistrement...':'Enregistrer'}</button>}
        </div>
      </div>

      <div className="space-y-6">
        {/* Info principale */}
        <div className="bg-white rounded-xl border p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className="text-xs text-gray-500 block mb-1">Référence</label><input type="text" value={current?.reference||''} onChange={e=>setCurrent({...current,reference:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" readOnly={ro}/></div>
            <div><label className="text-xs text-gray-500 block mb-1">Date</label><input type="date" value={current?.invoice_date||''} onChange={e=>setCurrent({...current,invoice_date:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" readOnly={ro}/></div>
            <div><label className="text-xs text-gray-500 block mb-1">Statut</label>
              {ro?<span className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-${(STATUS_MAP[current?.status]||STATUS_MAP.draft).color}-100 text-${(STATUS_MAP[current?.status]||STATUS_MAP.draft).color}-700`}>{(STATUS_MAP[current?.status]||STATUS_MAP.draft).label}</span>
              :<select value={current?.status||'draft'} onChange={e=>setCurrent({...current,status:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">{Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>}
            </div>
            <div><label className="text-xs text-gray-500 block mb-1">Créé par</label><select value={current?.created_by||''} onChange={e=>setCurrent({...current,created_by:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={ro}>{CREATORS.map(n=><option key={n} value={n}>{n}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Client</label>
              {ro?<p className="text-sm font-medium">{client?.name||'—'}</p>
              :<select value={current?.client_id||''} onChange={e=>handleClientChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">— Sélectionner —</option>{clients.filter(c=>c.status!=='inactif').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
            </div>
            <div><label className="text-xs text-gray-500 block mb-1">Contact facturation</label>
              {ro?<p className="text-sm">{contacts.find(c=>c.id===current?.contact_id)?.name||'—'}</p>
              :<select value={current?.contact_id||''} onChange={e=>setCurrent({...current,contact_id:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">— Aucun —</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}{c.is_billing?' 💰':c.is_primary?' ⭐':''}</option>)}</select>}
            </div>
            <div><label className="text-xs text-gray-500 block mb-1">Réf. client</label><input type="text" value={current?.client_reference||''} onChange={e=>setCurrent({...current,client_reference:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" readOnly={ro} placeholder="Ex: DUC, OPCO2i"/></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div><label className="text-xs text-gray-500 block mb-1">Réf. Sellsy</label><input type="text" value={current?.sellsy_reference||''} onChange={e=>setCurrent({...current,sellsy_reference:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" readOnly={ro} placeholder="FACT-..."/></div>
            <div><label className="text-xs text-gray-500 block mb-1">Document parent</label><input type="text" value={current?.parent_reference||''} readOnly className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" placeholder="Devis ou facture"/></div>
            <div><label className="text-xs text-gray-500 block mb-1">Début prestation</label><input type="date" value={current?.service_start_date||''} onChange={e=>setCurrent({...current,service_start_date:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" readOnly={ro}/></div>
            <div><label className="text-xs text-gray-500 block mb-1">Fin prestation</label><input type="date" value={current?.service_end_date||''} onChange={e=>setCurrent({...current,service_end_date:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" readOnly={ro}/></div>
          </div>
          <div className="mt-4"><label className="text-xs text-gray-500 block mb-1">Objet</label><input type="text" value={current?.object||''} onChange={e=>setCurrent({...current,object:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" readOnly={ro} placeholder="Formation SST du..."/></div>
        </div>

        {/* Lignes */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-sm mb-3">Lignes</h3>
          <div className="space-y-3">{items.map((item,idx)=>(
            <div key={idx} className="grid grid-cols-12 gap-2 items-start border-b pb-3">
              <div className="col-span-2"><input type="text" value={item.code} onChange={e=>updateItem(idx,'code',e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Code" readOnly={ro}/></div>
              <div className="col-span-4">
                <input type="text" value={item.description_title} onChange={e=>updateItem(idx,'description_title',e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Description" readOnly={ro}/>
                <input type="text" value={item.description_detail||''} onChange={e=>updateItem(idx,'description_detail',e.target.value)} className="w-full border rounded px-2 py-1 text-xs mt-1 text-gray-500" placeholder="Détail" readOnly={ro}/>
              </div>
              <div className="col-span-1"><input type="number" value={item.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm text-center" readOnly={ro} step="0.01"/></div>
              <div className="col-span-2"><input type="number" value={item.unit_price_ht} onChange={e=>updateItem(idx,'unit_price_ht',e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm text-right" readOnly={ro} step="0.01"/></div>
              <div className="col-span-1"><select value={item.tva_rate} onChange={e=>updateItem(idx,'tva_rate',e.target.value)} className="w-full border rounded px-1 py-1.5 text-xs" disabled={ro}>{TVA_RATES.map(r=><option key={r} value={r}>{r}%</option>)}</select></div>
              <div className="col-span-1 text-right pt-2 text-sm font-medium">{money(calcItemTotal(item))}</div>
              {!ro&&<div className="col-span-1 text-center pt-1"><button onClick={()=>removeItem(idx)} className="p-1 text-red-400 hover:text-red-600"><X size={16}/></button></div>}
            </div>
          ))}</div>
          {!ro&&<div className="flex gap-2 mt-3">
            <button onClick={addItem} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">+ Ligne</button>
            <div className="relative group"><button className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">+ Depuis formation</button>
              <div className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 w-64 max-h-48 overflow-y-auto hidden group-hover:block">
                {courses.map(c=><button key={c.id} onClick={()=>addFromCourse(c)} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs border-b"><span className="font-medium">{c.code}</span> — {c.title} ({money(c.price_ht)})</button>)}
              </div>
            </div>
          </div>}
        </div>

        {/* Conditions & Totaux */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-sm mb-3">Conditions</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">Moyen de règlement</label><select value={current?.payment_method||''} onChange={e=>setCurrent({...current,payment_method:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" disabled={ro}>{PAYMENT_METHODS.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Délai de règlement</label><select value={current?.payment_terms||''} onChange={e=>{
                const t=e.target.value; let d=30; if(t.includes('réception'))d=0; else if(t.includes('45'))d=45; else if(t.includes('60'))d=60
                setCurrent({...current,payment_terms:t,due_date:format(addDays(new Date(current.invoice_date||new Date()),d),'yyyy-MM-dd')})
              }} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" disabled={ro}>{PAYMENT_TERMS.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Date d'échéance</label><input type="date" value={current?.due_date||''} onChange={e=>setCurrent({...current,due_date:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" readOnly={ro}/></div>
              <div><label className="text-xs text-gray-500">Remise globale (%)</label><input type="number" value={current?.discount_percent||0} onChange={e=>setCurrent({...current,discount_percent:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" readOnly={ro} step="0.01" min="0" max="100"/></div>
              <div><label className="text-xs text-gray-500">Notes</label><textarea value={current?.notes||''} onChange={e=>setCurrent({...current,notes:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={2} readOnly={ro}/></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-sm mb-3">Totaux</h3>
            {currentTotals&&<div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Total HT</span><span>{money(currentTotals.subtotalHt)}</span></div>
              {currentTotals.discountAmt>0&&<><div className="flex justify-between text-orange-600"><span>Remise ({current.discount_percent}%)</span><span>-{money(currentTotals.discountAmt)}</span></div><div className="flex justify-between"><span>Net après remise</span><span>{money(currentTotals.netHt)}</span></div></>}
              <div className="flex justify-between font-semibold border-t pt-2"><span>Net HT</span><span>{money(currentTotals.netHt)}</span></div>
              {Object.entries(currentTotals.tvaByRate).map(([r,d])=><div key={r} className="flex justify-between text-gray-500"><span>TVA {r}%</span><span>{money(d.tva)}</span></div>)}
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>TTC</span><span>{money(currentTotals.totalTtc)}</span></div>
              {parseFloat(current?.amount_paid)>0&&<><div className="flex justify-between text-green-600"><span>Déjà payé</span><span>{money(current.amount_paid)}</span></div><div className="flex justify-between font-bold text-red-600 border-t pt-2"><span>Reste dû</span><span>{money(currentTotals.totalTtc-(parseFloat(current.amount_paid)||0))}</span></div></>}
            </div>}
          </div>
        </div>

        {/* Paiements */}
        {current?.id&&<div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Paiements</h3>
            {!['paid','cancelled'].includes(current.status)&&current.type!=='credit_note'&&<button onClick={()=>{setPaymentForm({...paymentForm,amount:current.amount_due||''});setShowPaymentForm(true)}} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs flex items-center gap-1"><CreditCard size={14}/>Enregistrer un paiement</button>}
          </div>
          {payments.length===0?<p className="text-sm text-gray-400">Aucun paiement enregistré</p>:(
            <div className="space-y-2">{payments.map(p=><div key={p.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
              <div><span className="font-medium text-green-700">{money(p.amount)}</span><span className="text-gray-500 ml-3">{fmtDateShort(p.payment_date)}</span><span className="text-gray-400 ml-3">{p.payment_method}</span></div>
              {p.payment_reference&&<span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{p.payment_reference}</span>}
            </div>)}</div>
          )}
          {showPaymentForm&&<div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Nouveau paiement</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="text-xs text-gray-500">Montant</label><input type="number" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" step="0.01" autoFocus/></div>
              <div><label className="text-xs text-gray-500">Date</label><input type="date" value={paymentForm.payment_date} onChange={e=>setPaymentForm({...paymentForm,payment_date:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm mt-1"/></div>
              <div><label className="text-xs text-gray-500">Moyen</label><select value={paymentForm.payment_method} onChange={e=>setPaymentForm({...paymentForm,payment_method:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">{PAYMENT_METHODS.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
              <div><label className="text-xs text-gray-500">Référence</label><input type="text" value={paymentForm.payment_reference} onChange={e=>setPaymentForm({...paymentForm,payment_reference:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="N° virement..."/></div>
            </div>
            <div className="flex gap-2 mt-3 justify-end"><button onClick={()=>setShowPaymentForm(false)} className="px-3 py-1.5 border rounded-lg text-sm">Annuler</button><button onClick={handleAddPayment} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm">Valider</button></div>
          </div>}
        </div>}

        {/* Quick status (view) */}
        {mode==='view'&&current?.type==='invoice'&&<div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-sm mb-3">Changer le statut</h3>
          <div className="flex flex-wrap gap-2">{Object.entries(STATUS_MAP).filter(([k])=>k!==current.status).map(([k,v])=>(
            <button key={k} onClick={()=>{handleStatus(current.id,k);setCurrent({...current,status:k})}} className={`px-3 py-1.5 rounded-lg text-xs font-medium bg-${v.color}-100 text-${v.color}-700 hover:bg-${v.color}-200`}>{v.label}</button>
          ))}</div>
        </div>}
      </div>
    </div>
  )
}
