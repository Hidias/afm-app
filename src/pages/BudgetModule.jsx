import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ════════════════════════════════════════════════════════════
//  BUDGET MODULE v4 — Access Campus
//  + Catégorisation IA intelligente + Prévisionnel 50k€
// ════════════════════════════════════════════════════════════

const TABS = [
  { key: 'transactions', label: '📋 Transactions' },
  { key: 'saisie', label: '➕ Saisie' },
  { key: 'dashboard', label: '📊 Dashboard' },
  { key: 'categorisation', label: '🤖 Catégorisation' },
  { key: 'previsionnel', label: '📈 Prévisionnel' },
  { key: 'recommandations', label: '🎯 Recommandations' },
  { key: 'comptable', label: '📮 Comptable' },
  { key: 'categories', label: '🏷️ Catégories' },
  { key: 'rules', label: '⚙️ Règles' },
  { key: 'import', label: '📥 Import' },
]

const ML = {
  '01/2025':'Jan 25','02/2025':'Fév 25','03/2025':'Mar 25','04/2025':'Avr 25',
  '05/2025':'Mai 25','06/2025':'Jun 25','07/2025':'Jul 25','08/2025':'Aoû 25',
  '09/2025':'Sep 25','10/2025':'Oct 25','11/2025':'Nov 25','12/2025':'Déc 25',
  '01/2026':'Jan 26','02/2026':'Fév 26','03/2026':'Mar 26',
}


const fmt = (n) => n ? (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '-'
const fmtS = (n) => { if (!n) return '-'; const a = Math.abs(n); return a >= 1000 ? (a/1000).toFixed(1)+'k€' : Math.round(a)+'€' }

export default function BudgetModule() {
  const [tab, setTab] = useState('transactions')
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [rules, setRules] = useState([])
  const [receipts, setReceipts] = useState({})
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterCat, setFilterCat] = useState('all')
  const [filterDir, setFilterDir] = useState('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [showPerso, setShowPerso] = useState(true)
  const [editingTx, setEditingTx] = useState(null)

  // Données partagées pour Import + Saisie
  const [invoicesList, setInvoicesList] = useState([])
  const [clientsList, setClientsList] = useState([])

  // Modal invités repas (rétroactif)
  const [mealGuestTxId, setMealGuestTxId] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [txR, catR, ruleR, rcpR, invR, cliR] = await Promise.all([
      supabase.from('budget_transactions').select('*').order('date', { ascending: false }),
      supabase.from('budget_categories').select('*').order('sort_order'),
      supabase.from('budget_rules').select('*, budget_categories(name, icon)').order('keyword'),
      supabase.from('budget_receipts').select('*'),
      supabase.from('invoices').select('*, clients(name)').order('invoice_date', { ascending: false }),
      supabase.from('clients').select('id,name,siret,status,city,phone,contact_email').order('name'),
    ])
    if (txR.data) setTransactions(txR.data)
    if (catR.data) setCategories(catR.data)
    if (ruleR.data) setRules(ruleR.data)
    if (rcpR.data) {
      const map = {}
      rcpR.data.forEach(r => { if (!map[r.transaction_id]) map[r.transaction_id] = []; map[r.transaction_id].push(r) })
      setReceipts(map)
    }
    if (invR.data) setInvoicesList(invR.data)
    if (cliR.data) setClientsList(cliR.data)
    setLoading(false)
  }

  const months = useMemo(() => [...new Set(transactions.map(tx => tx.month).filter(Boolean))].sort(), [transactions])

  const filtered = useMemo(() => transactions.filter(tx => {
    if (filterMonth !== 'all' && tx.month !== filterMonth) return false
    if (filterCat !== 'all' && tx.category_name !== filterCat) return false
    if (filterDir === 'debit' && !(tx.debit > 0)) return false
    if (filterDir === 'credit' && !(tx.credit > 0)) return false
    if (!showPerso && tx.is_personal) return false
    if (filterSearch) { const s = filterSearch.toLowerCase(); if (!tx.description?.toLowerCase().includes(s) && !tx.category_name?.toLowerCase().includes(s)) return false }
    return true
  }), [transactions, filterMonth, filterCat, filterDir, filterSearch, showPerso])

  const stats = useMemo(() => {
    const co = transactions.filter(tx => !tx.is_personal)
    const byMonth = {}, byCat = {}
    co.forEach(tx => {
      if (!byMonth[tx.month]) byMonth[tx.month] = { debit: 0, credit: 0 }
      byMonth[tx.month].debit += tx.debit || 0; byMonth[tx.month].credit += tx.credit || 0
      const c = tx.category_name || 'Non classé'
      if (!byCat[c]) byCat[c] = { debit: 0, credit: 0, count: 0 }
      byCat[c].debit += tx.debit || 0; byCat[c].credit += tx.credit || 0; byCat[c].count++
    })
    const perso = transactions.filter(tx => tx.is_personal)
    return {
      totalDebit: co.reduce((s, t) => s + (t.debit || 0), 0),
      totalCredit: co.reduce((s, t) => s + (t.credit || 0), 0),
      byMonth, byCat,
      unclassified: co.filter(t => t.category_name === 'Autre / Non classé').length,
      compteHicham: perso.filter(t => t.payer === 'hicham_perso').reduce((s, t) => s + (t.debit || 0) - (t.credit || 0), 0),
      compteMaxime: perso.filter(t => t.payer === 'maxime_perso').reduce((s, t) => s + (t.debit || 0) - (t.credit || 0), 0),
      notSent: transactions.filter(t => !t.sent_to_comptable && (Object.keys(receipts).includes(t.id) || t.is_manual)).length,
      toInvoice: co.filter(t => t.credit > 0 && !t.linked_invoice_id && !t.is_personal).length,
    }
  }, [transactions, receipts])

  async function changeCategory(txId, name) {
    const cat = categories.find(c => c.name === name)
    if (!cat) return
    await supabase.from('budget_transactions').update({ category_id: cat.id, category_name: cat.name }).eq('id', txId)
    setTransactions(p => p.map(t => t.id === txId ? { ...t, category_id: cat.id, category_name: cat.name } : t))
    toast.success(`→ ${cat.icon} ${cat.name}`); setEditingTx(null)
  }

  async function deleteTx(txId) {
    if (!confirm('Supprimer ?')) return
    await supabase.from('budget_transactions').delete().eq('id', txId)
    setTransactions(p => p.filter(t => t.id !== txId))
    toast.success('Supprimée'); loadAll()
  }

  if (loading) return <div className="p-8 text-center text-gray-400">⏳ Chargement...</div>

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-gray-800">💰 Budget & Trésorerie</h2>
          <span className="text-xs text-gray-400">{transactions.length} opérations</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
          <KPI label="Entrées" value={fmt(stats.totalCredit)} color="green" />
          <KPI label="Sorties" value={fmt(stats.totalDebit)} color="red" />
          <KPI label="Balance" value={fmt(stats.totalCredit - stats.totalDebit)} color={stats.totalCredit > stats.totalDebit ? 'green' : 'red'} />
          <KPI label="Non classés" value={stats.unclassified} color="amber" />
          <KPI label="CCA Hicham" value={fmt(stats.compteHicham)} color="purple" sub="dette gérant" />
          <KPI label="CCA Maxime" value={fmt(stats.compteMaxime)} color="purple" sub="dette gérant" />
          <KPI label="À envoyer" value={stats.notSent} color="blue" sub="comptable" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto mb-4 pb-1">{TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition
              ${tab === t.key ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
            {t.key === 'comptable' && stats.notSent > 0 && <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5">{stats.notSent}</span>}
            {t.key === 'categorisation' && stats.unclassified > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5">{stats.unclassified}</span>}
          </button>
        ))}</div>

      {tab === 'transactions' && <TransactionsTab {...{ filtered, categories, months, filterMonth, setFilterMonth, filterCat, setFilterCat, filterDir, setFilterDir, filterSearch, setFilterSearch, showPerso, setShowPerso, editingTx, setEditingTx, changeCategory, deleteTx, receipts, onMealGuest: setMealGuestTxId }} />}
      {tab === 'saisie' && <SaisieTab categories={categories} rules={rules} loadAll={loadAll} clients={clientsList} />}
      {tab === 'dashboard' && <DashboardTab stats={stats} months={months} categories={categories} />}
      {tab === 'categorisation' && <CategorisationIATab transactions={transactions} categories={categories} rules={rules} loadAll={loadAll} />}
      {tab === 'previsionnel' && <PrevisionnelTab transactions={transactions} categories={categories} />}
      {tab === 'recommandations' && <RecommandationsTab transactions={transactions} categories={categories} />}
      {tab === 'comptable' && <ComptableTab transactions={transactions} receipts={receipts} loadAll={loadAll} />}
      {tab === 'categories' && <CategoriesTab categories={categories} loadAll={loadAll} />}
      {tab === 'rules' && <RulesTab rules={rules} categories={categories} loadAll={loadAll} />}
      {tab === 'import' && <ImportTab loadAll={loadAll} categories={categories} rules={rules} invoices={invoicesList} clients={clientsList} />}

      {/* Modal invités repas (rétroactif) */}
      {mealGuestTxId && (
        <MealGuestModal
          transactionId={mealGuestTxId}
          transaction={transactions.find(t => t.id === mealGuestTxId)}
          clients={clientsList}
          onClose={() => setMealGuestTxId(null)}
          onSaved={() => { setMealGuestTxId(null); loadAll() }}
        />
      )}
    </div>
  )
}

function KPI({ label, value, color = 'blue', sub }) {
  return <div className={`bg-${color}-50 rounded-lg p-2 border border-${color}-100`}><div className={`text-xs text-${color}-600 font-medium`}>{label}</div><div className={`text-lg font-bold text-${color}-700 truncate`}>{value}</div>{sub && <div className="text-xs text-gray-400">{sub}</div>}</div>
}
// ════════════════════════════════════════
// TRANSACTIONS — avec 🍽️ invités + badge rapprochement
// ════════════════════════════════════════
function TransactionsTab({ filtered, categories, months, filterMonth, setFilterMonth, filterCat, setFilterCat, filterDir, setFilterDir, filterSearch, setFilterSearch, showPerso, setShowPerso, editingTx, setEditingTx, changeCategory, deleteTx, receipts, onMealGuest }) {
  const [filterSpecial, setFilterSpecial] = useState('')

  const displayed = useMemo(() => {
    if (!filterSpecial) return filtered
    if (filterSpecial === 'resto_no_guest') return filtered.filter(tx => tx.category_name === 'Restauration pro' && tx.debit > 0)
    if (filterSpecial === 'credit_no_invoice') return filtered.filter(tx => tx.credit > 0 && !tx.linked_invoice_id && !tx.is_personal)
    return filtered
  }, [filtered, filterSpecial])

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl shadow-sm border p-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="all">Tous les mois</option>
            {months.map(m => <option key={m} value={m}>{ML[m]||m}</option>)}
          </select>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="all">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
          </select>
          <select value={filterDir} onChange={e => setFilterDir(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="all">Tout</option><option value="debit">Sorties</option><option value="credit">Entrées</option>
          </select>
          <input type="text" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="🔍 Rechercher..." className="border rounded-lg px-3 py-2 text-sm" />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showPerso} onChange={e => setShowPerso(e.target.checked)} className="rounded" /> Perso
            </label>
            <select value={filterSpecial} onChange={e => setFilterSpecial(e.target.value)} className="border rounded px-2 py-1 text-xs flex-1">
              <option value="">Filtres rapides</option>
              <option value="resto_no_guest">🍽️ Restos sans invités</option>
              <option value="credit_no_invoice">💳 Crédits non rapprochés</option>
            </select>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Date</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Description</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Catégorie</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">Débit</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">Crédit</th>
                <th className="text-center px-2 py-2 text-xs text-gray-500">PJ</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(tx => (
                <tr key={tx.id} className={`border-t hover:bg-blue-50/30 ${tx.is_personal ? 'bg-purple-50/30' : ''} ${tx.is_manual ? 'border-l-2 border-l-blue-400' : ''}`}>
                  <td className="px-3 py-1.5 text-gray-500 text-xs whitespace-nowrap">
                    {tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : '-'}
                    {tx.is_manual && <span className="ml-1 text-blue-500">✏️</span>}
                    {tx.is_personal && <span className="ml-1 text-purple-500">🏠</span>}
                    {tx.sent_to_comptable && <span className="ml-1 text-green-500" title="Envoyé au comptable">✓</span>}
                    {tx.linked_invoice_id && <span className="ml-1 text-blue-500" title="Rapproché avec facture">🔗</span>}
                  </td>
                  <td className="px-3 py-1.5 max-w-xs"><div className="truncate text-gray-800 text-xs" title={tx.description}>{tx.description}</div></td>
                  <td className="px-3 py-1.5">
                    {editingTx === tx.id ? (
                      <select autoFocus onChange={e => { if (e.target.value) changeCategory(tx.id, e.target.value) }} onBlur={() => setEditingTx(null)} className="border rounded px-1 py-0.5 text-xs w-full" defaultValue="">
                        <option value="">Choisir...</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
                      </select>
                    ) : (
                      <button onClick={() => setEditingTx(tx.id)} className={`text-xs px-2 py-0.5 rounded-full hover:ring-2 hover:ring-blue-300 ${tx.category_name === 'Autre / Non classé' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {categories.find(c => c.name === tx.category_name)?.icon || '❓'} {tx.category_name || 'Non classé'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs text-red-600">{tx.debit > 0 ? fmt(tx.debit) : ''}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs text-green-600">{tx.credit > 0 ? fmt(tx.credit) : ''}</td>
                  <td className="px-2 py-1.5 text-center text-xs">{receipts[tx.id]?.length > 0 && <span title={`${receipts[tx.id].length} fichier(s)`}>📎{receipts[tx.id].length}</span>}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-0.5">
                      {tx.category_name === 'Restauration pro' && tx.debit > 0 && (
                        <button onClick={() => onMealGuest && onMealGuest(tx.id)} className="text-amber-400 hover:text-amber-600 text-xs" title="Registre invités">🍽️</button>
                      )}
                      {tx.is_manual && <button onClick={() => deleteTx(tx.id)} className="text-red-300 hover:text-red-600 text-xs">✕</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayed.length === 0 && <div className="text-center py-12 text-gray-400">Aucune transaction</div>}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// SAISIE — avec registre invités repas
// ════════════════════════════════════════
function SaisieTab({ categories, rules, loadAll, clients }) {
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'debit', category_id: '', payer: 'entreprise', notes: '', note_comptable: '' })
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [recent, setRecent] = useState([])

  // Repas / Invités
  const [mealFor, setMealFor] = useState('hicham')
  const [guests, setGuests] = useState([])
  const [nbConvives, setNbConvives] = useState(2)
  const [showProspectModal, setShowProspectModal] = useState(false)
  const [prospectInitial, setProspectInitial] = useState({})

  const isRestaurant = useMemo(() => {
    const cat = categories.find(c => c.id === form.category_id)
    return cat?.name === 'Restauration pro'
  }, [form.category_id, categories])

  useEffect(() => {
    supabase.from('budget_transactions').select('*').eq('is_manual', true).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (data) setRecent(data) })
  }, [])

  // Auto-catégorisation par règles
  useEffect(() => {
    if (!form.description || form.category_id) return
    const d = form.description.toUpperCase()
    for (const r of rules) { if (d.includes(r.keyword?.toUpperCase())) { const c = categories.find(x => x.id === r.category_id); if (c) { setForm(f => ({ ...f, category_id: c.id })); break } } }
  }, [form.description])

  function handleFiles(e) {
    const newFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...newFiles])
    newFiles.forEach(f => {
      if (f.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = ev => setPreviews(prev => [...prev, { name: f.name, url: ev.target.result }])
        reader.readAsDataURL(f)
      } else {
        setPreviews(prev => [...prev, { name: f.name, url: null }])
      }
    })
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  // Analyse IA de la facture
  async function analyzeWithAI() {
    if (files.length === 0) { toast.error('Ajoutez une facture d\'abord'); return }
    setAnalyzing(true)
    try {
      const file = files[0]
      const base64 = await fileToBase64(file)
      const mediaType = file.type || 'image/jpeg'
      const catList = categories.map(c => `${c.icon} ${c.name} (${c.direction})`).join(', ')

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: [
            { type: mediaType.startsWith('image/') ? 'image' : 'document', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: `Analyse cette facture/ticket pour Access Formation SARL (formation professionnelle SST/CACES/sécurité).\n\nExtrais en JSON strict (pas de markdown) :\n{\n  "fournisseur": "nom du fournisseur",\n  "montant": 123.45,\n  "date": "2026-02-19",\n  "description": "description courte",\n  "categorie_suggestion": "nom de la catégorie la plus proche",\n  "type_depense": "entreprise" ou "perso_hicham" ou "perso_maxime",\n  "explication": "pourquoi cette classification",\n  "note_comptable": "explication courte pour la comptable"\n}\n\nCatégories disponibles : ${catList}\n\nRègles :\n- Si c'est un achat clairement professionnel (matériel formation, logiciel, assurance, carburant, restaurant business) → "entreprise"\n- Si c'est un achat personnel (courses alimentaires, vêtements perso, loisirs) → "perso_hicham" ou "perso_maxime" (par défaut "perso_hicham")\n- En cas de doute → "entreprise"` }
          ]}]
        })
      })
      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const json = JSON.parse(text.replace(/```json|```/g, '').trim())
      setAiResult(json)

      if (json.fournisseur) setForm(f => ({ ...f, description: json.description || json.fournisseur }))
      if (json.montant) setForm(f => ({ ...f, amount: json.montant.toString().replace('.', ',') }))
      if (json.date) setForm(f => ({ ...f, date: json.date }))
      if (json.note_comptable) setForm(f => ({ ...f, note_comptable: json.note_comptable }))
      if (json.type_depense === 'perso_hicham') setForm(f => ({ ...f, payer: 'hicham_perso' }))
      else if (json.type_depense === 'perso_maxime') setForm(f => ({ ...f, payer: 'maxime_perso' }))
      else setForm(f => ({ ...f, payer: 'entreprise' }))
      if (json.categorie_suggestion) {
        const match = categories.find(c => c.name.toLowerCase().includes(json.categorie_suggestion.toLowerCase()) || json.categorie_suggestion.toLowerCase().includes(c.name.toLowerCase()))
        if (match) setForm(f => ({ ...f, category_id: match.id }))
      }
      toast.success('🤖 Facture analysée')
    } catch (e) {
      console.error(e)
      toast.error('Erreur analyse IA')
    }
    setAnalyzing(false)
  }

  // Gestion invités
  function addGuest() { setGuests(prev => [...prev, { name: '', company: '', client_id: '' }]) }
  function updateGuest(idx, field, value) { setGuests(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g)) }
  function removeGuest(idx) { setGuests(prev => prev.filter((_, i) => i !== idx)) }

  async function handleSave() {
    if (!form.description || !form.amount || !form.date) { toast.error('Date, description et montant requis'); return }
    setSaving(true)
    const amount = parseFloat(form.amount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide'); setSaving(false); return }
    const cat = categories.find(c => c.id === form.category_id)
    const dp = form.date.split('-')
    const isPerso = form.payer !== 'entreprise'

    const row = {
      date: form.date, description: form.description,
      debit: form.type === 'debit' ? amount : 0, credit: form.type === 'credit' ? amount : 0,
      category_id: form.category_id || null, category_name: cat?.name || 'Autre / Non classé',
      month: `${dp[1]}/${dp[0]}`, year: parseInt(dp[0]),
      source_file: 'saisie_manuelle', is_manual: true, is_personal: isPerso, payer: form.payer,
      notes: form.notes || null, note_comptable: form.note_comptable || null,
    }

    const { data: txData, error } = await supabase.from('budget_transactions').insert(row).select().single()
    if (error) { toast.error('Erreur: ' + error.message); setSaving(false); return }

    // Upload des fichiers
    if (files.length > 0 && txData) {
      for (const file of files) {
        const path = `${txData.id}/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('budget-receipts').upload(path, file)
        if (upErr) { console.error('Upload error:', upErr); continue }
        await supabase.from('budget_receipts').insert({
          transaction_id: txData.id, file_name: file.name, file_path: path, file_type: file.type, file_size: file.size
        })
      }
      toast.success(`📎 ${files.length} fichier(s) uploadé(s)`)
    }

    // Sauvegarder les invités si c'est un repas
    if (isRestaurant && txData) {
      const guestRows = guests.filter(g => g.name.trim()).map(g => ({
        transaction_id: txData.id,
        meal_for: mealFor,
        guest_name: g.name.trim(),
        guest_company: g.company.trim() || null,
        guest_first_name: null,
        client_id: g.client_id || null,
        nb_convives: nbConvives,
        motif: form.notes || null,
      }))
      // Si pas d'invités nommés, juste sauvegarder le meal_for
      if (guestRows.length === 0) {
        await supabase.from('budget_meal_guests').insert({
          transaction_id: txData.id, meal_for: mealFor, nb_convives: nbConvives, motif: form.notes || null,
        })
      } else {
        await supabase.from('budget_meal_guests').insert(guestRows)
      }
    }

    toast.success(`✅ ${form.type === 'debit' ? 'Dépense' : 'Entrée'}: ${fmt(amount)}`)
    setRecent(prev => [txData, ...prev].slice(0, 10))
    setForm({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'debit', category_id: '', payer: 'entreprise', notes: '', note_comptable: '' })
    setFiles([]); setPreviews([]); setAiResult(null); setGuests([]); setNbConvives(2); setMealFor('hicham')
    setSaving(false)
    loadAll()
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
        <h3 className="font-bold text-gray-700">➕ Nouvelle opération</h3>

        {/* Upload zone */}
        <div>
          <label className="text-xs text-gray-500 font-medium">📎 Facture(s) / Justificatif(s)</label>
          <div className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer"
            onClick={() => document.getElementById('file-input').click()}>
            <input id="file-input" type="file" multiple accept="image/*,.pdf" onChange={handleFiles} className="hidden" />
            <p className="text-sm text-gray-500">📷 Cliquez ou glissez vos fichiers ici</p>
            <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG — plusieurs fichiers possibles</p>
          </div>
          {previews.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {previews.map((p, i) => (
                <div key={i} className="relative group">
                  {p.url ? <img src={p.url} alt={p.name} className="w-16 h-16 object-cover rounded border" /> : <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center text-xs">📄 PDF</div>}
                  <button onClick={() => removeFile(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs leading-none opacity-0 group-hover:opacity-100">✕</button>
                </div>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <button onClick={analyzeWithAI} disabled={analyzing}
              className="mt-2 w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {analyzing ? '🤖 Analyse en cours...' : '🤖 Analyser avec IA'}
            </button>
          )}
        </div>

        {/* Résultat IA */}
        {aiResult && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs space-y-1">
            <div className="font-bold text-purple-800">🤖 Résultat IA :</div>
            <div>Fournisseur : <b>{aiResult.fournisseur}</b></div>
            <div>Montant : <b>{aiResult.montant} €</b></div>
            <div>Catégorie : <b>{aiResult.categorie_suggestion}</b></div>
            <div>Type : <b className={aiResult.type_depense === 'entreprise' ? 'text-blue-600' : 'text-purple-600'}>{aiResult.type_depense}</b></div>
            <div className="text-gray-600 italic">{aiResult.explication}</div>
          </div>
        )}

        {/* Direction */}
        <div className="flex gap-2">
          <button onClick={() => setForm(f => ({ ...f, type: 'debit' }))} className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.type === 'debit' ? 'bg-red-500 text-white' : 'bg-gray-100'}`}>🔴 Dépense</button>
          <button onClick={() => setForm(f => ({ ...f, type: 'credit' }))} className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.type === 'credit' ? 'bg-green-500 text-white' : 'bg-gray-100'}`}>🟢 Entrée</button>
        </div>
        <div><label className="text-xs text-gray-500">Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
        <div><label className="text-xs text-gray-500">Description</label><input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Fournisseur / description" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
        <div><label className="text-xs text-gray-500">Montant (€)</label><input type="text" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono text-lg" /></div>
        <div><label className="text-xs text-gray-500">Catégorie</label>
          <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
            <option value="">Auto / Non classé</option>
            {categories.filter(c => form.type === 'debit' ? c.direction !== 'recette' : c.direction !== 'depense').map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Payé par</label>
          <div className="flex gap-2 mt-1">
            {[{ v:'entreprise', l:'🏢 Entreprise' },{ v:'hicham_perso', l:'🏠 Hicham' },{ v:'maxime_perso', l:'🏠 Maxime' }].map(p => (
              <button key={p.v} onClick={() => setForm(f => ({ ...f, payer: p.v }))}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${form.payer === p.v ? (p.v === 'entreprise' ? 'bg-blue-500 text-white border-blue-600' : 'bg-purple-500 text-white border-purple-600') : 'bg-white text-gray-600'}`}>{p.l}</button>
            ))}
          </div>
          {form.payer !== 'entreprise' && <p className="text-xs text-purple-600 mt-1">⚠️ Hors budget entreprise → dette gérant</p>}
        </div>

        {/* ══ SECTION REPAS / INVITÉS ══ */}
        {isRestaurant && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-800">🍽️ Registre repas professionnel</span>
            </div>

            {/* Repas pour qui */}
            <div>
              <label className="text-xs text-gray-600">Repas pour</label>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setMealFor('hicham')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${mealFor === 'hicham' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}>Hicham</button>
                <button onClick={() => setMealFor('maxime')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${mealFor === 'maxime' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}>Maxime</button>
              </div>
            </div>

            {/* Nombre de convives */}
            <div>
              <label className="text-xs text-gray-600">Nombre de convives</label>
              <input type="number" min="1" max="20" value={nbConvives} onChange={e => setNbConvives(parseInt(e.target.value) || 1)} className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1" />
            </div>

            {/* Invités */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Invités ({guests.length})</label>
                <button onClick={addGuest} className="text-xs text-blue-600 hover:text-blue-800">+ Ajouter un invité</button>
              </div>
              {guests.map((g, idx) => (
                <div key={idx} className="flex gap-1.5 mt-1.5 items-center">
                  <input
                    type="text" value={g.name} onChange={e => updateGuest(idx, 'name', e.target.value)}
                    placeholder="Nom Prénom" className="flex-1 border rounded px-2 py-1.5 text-xs"
                  />
                  <div className="relative flex-1">
                    <input
                      type="text" value={g.company} onChange={e => { updateGuest(idx, 'company', e.target.value); updateGuest(idx, 'client_id', '') }}
                      placeholder="Entreprise" className="w-full border rounded px-2 py-1.5 text-xs"
                      list={`guest-clients-${idx}`}
                    />
                    <datalist id={`guest-clients-${idx}`}>
                      {clients.filter(c => g.company && c.name.toUpperCase().includes(g.company.toUpperCase())).slice(0, 10).map(c => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  {g.company && !clients.find(c => c.name.toUpperCase() === g.company.toUpperCase()) && (
                    <button
                      onClick={() => { setProspectInitial({ name: g.company, contact_name: g.name }); setShowProspectModal(true) }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 whitespace-nowrap" title="Créer comme prospect"
                    >+🏢</button>
                  )}
                  <button onClick={() => removeGuest(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div><label className="text-xs text-gray-500">Note comptable</label><input type="text" value={form.note_comptable} onChange={e => setForm(f => ({ ...f, note_comptable: e.target.value }))} placeholder="Explication pour Cristina..." className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
        <div><label className="text-xs text-gray-500">Notes internes</label><input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="N° facture, détail..." className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>

        <button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '⏳...' : '💾 Enregistrer'}
        </button>
      </div>

      {/* Colonne droite */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">📝 Dernières saisies</h3>
        {recent.length === 0 ? <div className="text-center py-8 text-gray-400">Aucune saisie</div> : (
          <div className="space-y-2">{recent.map(tx => (
            <div key={tx.id} className={`flex items-center gap-3 p-2 rounded-lg border ${tx.is_personal ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'}`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{tx.description}</div>
                <div className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString('fr-FR')} • {tx.category_name}{tx.is_personal && <span className="ml-1 text-purple-600">• Perso</span>}</div>
              </div>
              <div className={`font-mono text-sm font-bold ${tx.debit > 0 ? 'text-red-600' : 'text-green-600'}`}>{tx.debit > 0 ? '-' : '+'}{fmt(tx.debit > 0 ? tx.debit : tx.credit)}</div>
            </div>
          ))}</div>
        )}
      </div>

      {/* Modal création prospect */}
      {showProspectModal && (
        <ProspectCreateModal
          initial={prospectInitial}
          onClose={() => setShowProspectModal(false)}
          onCreated={(newClient) => {
            setShowProspectModal(false)
            // Mettre à jour le guest avec le nouveau client
            const gIdx = guests.findIndex(g => g.company === prospectInitial.name || !g.company)
            if (gIdx >= 0) {
              updateGuest(gIdx, 'company', newClient.name)
              updateGuest(gIdx, 'client_id', newClient.id)
            }
            loadAll()
            toast.success(`🏢 Prospect "${newClient.name}" créé`)
          }}
        />
      )}
    </div>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ════════════════════════════════════════
// COMPTABLE TAB
// ════════════════════════════════════════
function ComptableTab({ transactions, receipts, loadAll }) {
  const [sending, setSending] = useState(false)
  const [notes, setNotes] = useState('')
  const [history, setHistory] = useState([])
  const [selected, setSelected] = useState(new Set())

  // Transactions pas encore envoyées qui ont des PJ ou sont manuelles
  const toSend = useMemo(() => transactions.filter(tx => !tx.sent_to_comptable && (tx.is_manual || receipts[tx.id]?.length > 0)), [transactions, receipts])

  useEffect(() => {
    // Init sélection avec toutes les non-envoyées
    setSelected(new Set(toSend.map(t => t.id)))
    // Charger historique
    supabase.from('budget_emails_sent').select('*').order('sent_at', { ascending: false }).limit(20)
      .then(({ data }) => { if (data) setHistory(data) })
  }, [toSend.length])

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleSend() {
    if (selected.size === 0) { toast.error('Sélectionnez des transactions'); return }
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const resp = await fetch('/api/send-budget-comptable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, transactionIds: [...selected], notes })
      })
      const result = await resp.json()
      if (result.success) {
        toast.success(`✅ ${result.message}`)
        setNotes('')
        loadAll()
      } else {
        toast.error('Erreur: ' + (result.error || 'Envoi échoué'))
      }
    } catch (e) {
      toast.error('Erreur envoi: ' + e.message)
    }
    setSending(false)
  }

  return (
    <div className="space-y-4">
      {/* À envoyer */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-700">📮 Envoi au comptable</h3>
          <div className="text-xs text-gray-400">→ cristina.gonzalez@cegefi-conseils.fr (cc: fournisseurs@accessformation.pro)</div>
        </div>

        {toSend.length === 0 ? (
          <div className="text-center py-8 text-gray-400">✅ Tout a été envoyé</div>
        ) : (
          <>
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left"><input type="checkbox" checked={selected.size === toSend.length} onChange={() => setSelected(selected.size === toSend.length ? new Set() : new Set(toSend.map(t => t.id)))} /></th>
                    <th className="px-2 py-1.5 text-left text-gray-500">Date</th>
                    <th className="px-2 py-1.5 text-left text-gray-500">Description</th>
                    <th className="px-2 py-1.5 text-left text-gray-500">Catégorie</th>
                    <th className="px-2 py-1.5 text-right text-gray-500">Montant</th>
                    <th className="px-2 py-1.5 text-center text-gray-500">Type</th>
                    <th className="px-2 py-1.5 text-center text-gray-500">PJ</th>
                  </tr>
                </thead>
                <tbody>
                  {toSend.map(tx => (
                    <tr key={tx.id} className={`border-t ${selected.has(tx.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-2 py-1"><input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleSelect(tx.id)} /></td>
                      <td className="px-2 py-1">{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-2 py-1 truncate max-w-40">{tx.description}</td>
                      <td className="px-2 py-1">{tx.category_name}</td>
                      <td className="px-2 py-1 text-right font-mono">{tx.debit > 0 ? <span className="text-red-600">-{fmt(tx.debit)}</span> : <span className="text-green-600">+{fmt(tx.credit)}</span>}</td>
                      <td className="px-2 py-1 text-center">{tx.is_personal ? <span className="text-purple-600">Perso</span> : <span className="text-blue-600">Ent.</span>}</td>
                      <td className="px-2 py-1 text-center">{receipts[tx.id]?.length > 0 ? `📎${receipts[tx.id].length}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-2">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes pour Cristina (optionnel)..." className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-y" />
              <button onClick={handleSend} disabled={sending || selected.size === 0}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                {sending ? '⏳ Envoi en cours...' : `📮 Envoyer ${selected.size} opération(s) à Cristina`}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Historique */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">📋 Historique des envois</h3>
        {history.length === 0 ? <div className="text-center py-6 text-gray-400">Aucun envoi</div> : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border text-sm">
                <span className="text-green-500">✅</span>
                <div className="flex-1">
                  <div className="font-medium">{new Date(h.sent_at).toLocaleDateString('fr-FR')} à {new Date(h.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="text-xs text-gray-500">{h.nb_transactions} opérations • {h.nb_receipts} PJ • par {h.sent_by}</div>
                  {h.notes && <div className="text-xs text-gray-400 italic mt-0.5">{h.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════
function DashboardTab({ stats, months, categories }) {
  const sm = months.slice().sort()
  const mx = Math.max(...sm.map(m => Math.max(stats.byMonth[m]?.debit||0, stats.byMonth[m]?.credit||0)), 1)
  const cs = Object.entries(stats.byCat).filter(([_,v])=>v.debit>0).sort((a,b)=>b[1].debit-a[1].debit)
  const mc = cs.length>0?cs[0][1].debit:1
  const rc = Object.entries(stats.byCat).filter(([n,v])=>v.credit>0&&!['Prêts (réception)','Apports associés','Trésorerie interne'].includes(n)).sort((a,b)=>b[1].credit-a[1].credit)

  return (
    <div className="space-y-4">
      {(stats.compteHicham>0||stats.compteMaxime>0) && (
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
          <h3 className="font-bold text-purple-800 mb-2">🏠 Comptes courants associés</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 border border-purple-100"><div className="text-sm text-gray-600">Hicham</div><div className="text-xl font-bold text-purple-700">{stats.compteHicham>0?fmt(stats.compteHicham):'0 €'}</div></div>
            <div className="bg-white rounded-lg p-3 border border-purple-100"><div className="text-sm text-gray-600">Maxime</div><div className="text-xl font-bold text-purple-700">{stats.compteMaxime>0?fmt(stats.compteMaxime):'0 €'}</div></div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">📊 Flux mensuels</h3>
        <div className="space-y-2">{sm.map(m => { const d=stats.byMonth[m]||{debit:0,credit:0}; return (
          <div key={m} className="flex items-center gap-2">
            <div className="w-16 text-xs text-gray-500 font-medium">{ML[m]||m}</div>
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="flex items-center gap-1"><div className="bg-green-400 rounded-sm h-3" style={{width:`${(d.credit/mx)*100}%`,minWidth:d.credit>0?'2px':0}}/><span className="text-xs text-green-700">{fmtS(d.credit)}</span></div>
              <div className="flex items-center gap-1"><div className="bg-red-400 rounded-sm h-3" style={{width:`${(d.debit/mx)*100}%`,minWidth:d.debit>0?'2px':0}}/><span className="text-xs text-red-600">{fmtS(d.debit)}</span></div>
            </div>
            <div className={`w-20 text-right text-xs font-bold ${d.credit-d.debit>=0?'text-green-700':'text-red-600'}`}>{d.credit-d.debit>=0?'+':''}{fmtS(d.credit-d.debit)}</div>
          </div>)})}</div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-bold text-gray-700 mb-3">🔴 Dépenses</h3>
          <div className="space-y-1.5">{cs.slice(0,15).map(([n,v])=>{const cat=categories.find(c=>c.name===n);return(
            <div key={n} className="flex items-center gap-2"><span className="text-sm w-5">{cat?.icon||'📁'}</span><div className="flex-1"><div className="flex justify-between text-xs"><span className="text-gray-700 truncate">{n}</span><span className="text-red-600 font-medium ml-2">{fmtS(v.debit)}</span></div><div className="bg-gray-100 rounded-full h-1.5 mt-0.5"><div className="bg-red-400 rounded-full h-1.5" style={{width:`${(v.debit/mc)*100}%`}}/></div></div></div>)})}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-bold text-gray-700 mb-3">🟢 Revenus</h3>
          {rc.length>0?(<div className="space-y-1.5">{rc.map(([n,v])=>{const cat=categories.find(c=>c.name===n);return(
            <div key={n} className="flex items-center gap-2"><span className="text-sm w-5">{cat?.icon||'📁'}</span><div className="flex-1"><div className="flex justify-between text-xs"><span className="text-gray-700 truncate">{n}</span><span className="text-green-600 font-medium ml-2">{fmtS(v.credit)}</span></div><div className="bg-gray-100 rounded-full h-1.5 mt-0.5"><div className="bg-green-400 rounded-full h-1.5" style={{width:`${(v.credit/rc[0][1].credit)*100}%`}}/></div></div></div>)})}</div>):<div className="text-center py-8 text-gray-400">-</div>}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// CATEGORIES
// ════════════════════════════════════════
function CategoriesTab({ categories, loadAll }) {
  const [nw, setNw] = useState({ name:'', direction:'depense', type:'variable', icon:'📁' })
  const [editId, setEditId] = useState(null)
  const [ef, setEf] = useState({})
  const icons = ['📁','💰','🏦','🚗','⛽','🏥','💻','📱','🍽️','🚄','🎓','🤝','🏠','🛒','🖨️','📋','🧮','📞','🔧','📦','🏢','❓','⚡','🔄','↩️','🛡️']
  async function add() { if(!nw.name.trim()){toast.error('Nom requis');return}; const ms=Math.max(...categories.map(c=>c.sort_order||0),0); const{error}=await supabase.from('budget_categories').insert({...nw,color:'gray',sort_order:ms+1}); if(error){toast.error(error.code==='23505'?'Existe déjà':'Erreur');return}; toast.success('✅ Créée'); setNw({name:'',direction:'depense',type:'variable',icon:'📁'}); loadAll() }
  async function upd() { if(!ef.name?.trim())return; await supabase.from('budget_categories').update(ef).eq('id',editId); toast.success('✅ Modifié'); setEditId(null); loadAll() }
  async function del(id,n) { const{count}=await supabase.from('budget_transactions').select('id',{count:'exact',head:true}).eq('category_id',id); if(count>0){toast.error(`${count} transactions utilisent "${n}"`);return}; if(!confirm(`Supprimer "${n}" ?`))return; await supabase.from('budget_categories').delete().eq('id',id); toast.success('Supprimé'); loadAll() }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">➕ Nouvelle catégorie</h3>
        <div className="flex gap-2 flex-wrap">
          <select value={nw.icon} onChange={e=>setNw(n=>({...n,icon:e.target.value}))} className="border rounded-lg px-2 py-2 text-lg w-14">{icons.map(i=><option key={i} value={i}>{i}</option>)}</select>
          <input type="text" value={nw.name} onChange={e=>setNw(n=>({...n,name:e.target.value}))} placeholder="Nom" className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-40"/>
          <select value={nw.direction} onChange={e=>setNw(n=>({...n,direction:e.target.value}))} className="border rounded-lg px-3 py-2 text-sm"><option value="depense">Dépense</option><option value="recette">Recette</option><option value="neutre">Neutre</option></select>
          <select value={nw.type} onChange={e=>setNw(n=>({...n,type:e.target.value}))} className="border rounded-lg px-3 py-2 text-sm"><option value="fixe">Fixe</option><option value="variable">Variable</option><option value="exceptionnel">Exceptionnel</option></select>
          <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Créer</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-3 py-2 text-xs text-gray-500"></th><th className="text-left px-3 py-2 text-xs text-gray-500">Nom</th><th className="text-left px-3 py-2 text-xs text-gray-500">Dir.</th><th className="text-left px-3 py-2 text-xs text-gray-500">Type</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>{categories.map(cat=><tr key={cat.id} className="border-t hover:bg-gray-50">
            {editId===cat.id?(<>
              <td className="px-3 py-1"><select value={ef.icon} onChange={e=>setEf(f=>({...f,icon:e.target.value}))} className="border rounded px-1 py-0.5 text-lg w-12">{icons.map(i=><option key={i} value={i}>{i}</option>)}</select></td>
              <td className="px-3 py-1"><input type="text" value={ef.name} onChange={e=>setEf(f=>({...f,name:e.target.value}))} className="border rounded px-2 py-1 text-sm w-full"/></td>
              <td className="px-3 py-1"><select value={ef.direction} onChange={e=>setEf(f=>({...f,direction:e.target.value}))} className="border rounded px-2 py-1 text-xs"><option value="depense">Dépense</option><option value="recette">Recette</option><option value="neutre">Neutre</option></select></td>
              <td className="px-3 py-1"><select value={ef.type} onChange={e=>setEf(f=>({...f,type:e.target.value}))} className="border rounded px-2 py-1 text-xs"><option value="fixe">Fixe</option><option value="variable">Variable</option><option value="exceptionnel">Exceptionnel</option></select></td>
              <td className="px-3 py-1 text-right"><button onClick={upd} className="text-green-600 text-xs mr-2">✓</button><button onClick={()=>setEditId(null)} className="text-gray-400 text-xs">✕</button></td>
            </>):(<>
              <td className="px-3 py-1.5 text-lg">{cat.icon}</td>
              <td className="px-3 py-1.5 font-medium text-gray-700">{cat.name}</td>
              <td className="px-3 py-1.5"><span className={`text-xs px-2 py-0.5 rounded-full ${cat.direction==='recette'?'bg-green-100 text-green-700':cat.direction==='depense'?'bg-red-100 text-red-700':'bg-gray-100'}`}>{cat.direction}</span></td>
              <td className="px-3 py-1.5 text-xs text-gray-500">{cat.type}</td>
              <td className="px-3 py-1.5 text-right"><button onClick={()=>{setEditId(cat.id);setEf({name:cat.name,icon:cat.icon,direction:cat.direction,type:cat.type})}} className="text-blue-500 text-xs mr-2">Modifier</button><button onClick={()=>del(cat.id,cat.name)} className="text-red-400 text-xs">Suppr</button></td>
            </>)}
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// RULES — avec édition inline, recherche, filtres
// ════════════════════════════════════════
function RulesTab({ rules, categories, loadAll }) {
  const [nw, setNw] = useState({ keyword:'', category_id:'', direction:'both' })
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterDir, setFilterDir] = useState('')
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!nw.keyword || !nw.category_id) { toast.error('Mot-clé et catégorie requis'); return }
    setSaving(true)
    const { error } = await supabase.from('budget_rules').insert({ keyword: nw.keyword.toUpperCase().trim(), category_id: nw.category_id, direction: nw.direction })
    setSaving(false)
    if (error) { toast.error(error.code === '23505' ? 'Ce mot-clé existe déjà' : 'Erreur: ' + error.message); return }
    toast.success('✅ Règle ajoutée')
    setNw({ keyword: '', category_id: '', direction: 'both' })
    loadAll()
  }

  async function del(id, keyword) {
    if (!confirm(`Supprimer la règle "${keyword}" ?`)) return
    await supabase.from('budget_rules').delete().eq('id', id)
    toast.success('Règle supprimée')
    loadAll()
  }

  function startEdit(r) {
    setEditId(r.id)
    setEditData({ keyword: r.keyword, category_id: r.category_id, direction: r.direction })
  }

  async function saveEdit() {
    if (!editData.keyword || !editData.category_id) { toast.error('Mot-clé et catégorie requis'); return }
    setSaving(true)
    const { error } = await supabase.from('budget_rules').update({
      keyword: editData.keyword.toUpperCase().trim(),
      category_id: editData.category_id,
      direction: editData.direction,
    }).eq('id', editId)
    setSaving(false)
    if (error) { toast.error(error.code === '23505' ? 'Ce mot-clé existe déjà' : 'Erreur: ' + error.message); return }
    toast.success('✅ Règle modifiée')
    setEditId(null)
    setEditData({})
    loadAll()
  }

  function cancelEdit() { setEditId(null); setEditData({}) }

  // Filtrage
  const filtered = useMemo(() => {
    let f = [...rules]
    if (search) {
      const s = search.toUpperCase()
      f = f.filter(r => r.keyword?.toUpperCase().includes(s) || r.budget_categories?.name?.toUpperCase().includes(s))
    }
    if (filterCat) f = f.filter(r => r.category_id === filterCat)
    if (filterDir) f = f.filter(r => r.direction === filterDir)
    return f
  }, [rules, search, filterCat, filterDir])

  // Stats par catégorie
  const catStats = useMemo(() => {
    const map = {}
    rules.forEach(r => {
      const name = r.budget_categories?.name || 'Sans catégorie'
      if (!map[name]) map[name] = 0
      map[name]++
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [rules])

  const dirLabel = { both: '⚪ Tous', debit: '🔴 Débit', credit: '🟢 Crédit' }

  return (
    <div className="space-y-4">
      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border p-3">
          <div className="text-xs text-gray-500">Total règles</div>
          <div className="text-2xl font-bold text-gray-800">{rules.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3">
          <div className="text-xs text-gray-500">Catégories utilisées</div>
          <div className="text-2xl font-bold text-blue-600">{catStats.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3">
          <div className="text-xs text-gray-500">Débit uniquement</div>
          <div className="text-2xl font-bold text-red-600">{rules.filter(r => r.direction === 'debit').length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3">
          <div className="text-xs text-gray-500">Crédit uniquement</div>
          <div className="text-2xl font-bold text-emerald-600">{rules.filter(r => r.direction === 'credit').length}</div>
        </div>
      </div>

      {/* Formulaire ajout */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">➕ Nouvelle règle</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={nw.keyword}
            onChange={e => setNw(r => ({ ...r, keyword: e.target.value.toUpperCase() }))}
            placeholder="Mot-clé (ex: RESTAURANT)"
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-40 font-mono"
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <select value={nw.category_id} onChange={e => setNw(r => ({ ...r, category_id: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-48">
            <option value="">Catégorie...</option>
            {categories.sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select value={nw.direction} onChange={e => setNw(r => ({ ...r, direction: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
            <option value="both">⚪ Les deux</option>
            <option value="debit">🔴 Débit</option>
            <option value="credit">🟢 Crédit</option>
          </select>
          <button onClick={add} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? '...' : 'Ajouter'}
          </button>
        </div>
      </div>

      {/* Recherche et filtres */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-48">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Rechercher mot-clé ou catégorie..."
              className="w-full border rounded-lg px-3 py-2 text-sm pr-8"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
            )}
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-w-48">
            <option value="">Toutes les catégories</option>
            {catStats.map(([name, count]) => {
              const cat = categories.find(c => c.name === name)
              return <option key={name} value={cat?.id || ''}>{cat?.icon || '📁'} {name} ({count})</option>
            })}
          </select>
          <select value={filterDir} onChange={e => setFilterDir(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Toutes directions</option>
            <option value="both">⚪ Les deux</option>
            <option value="debit">🔴 Débit</option>
            <option value="credit">🟢 Crédit</option>
          </select>
          {(search || filterCat || filterDir) && (
            <button onClick={() => { setSearch(''); setFilterCat(''); setFilterDir('') }} className="text-sm text-blue-600 hover:text-blue-800">
              Réinitialiser
            </button>
          )}
          <span className="text-xs text-gray-400">{filtered.length}/{rules.length} règles</span>
        </div>
      </div>

      {/* Tableau des règles */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2.5 text-xs text-gray-500 uppercase tracking-wider">Mot-clé</th>
                <th className="text-left px-3 py-2.5 text-xs text-gray-500 uppercase tracking-wider">→ Catégorie</th>
                <th className="text-left px-3 py-2.5 text-xs text-gray-500 uppercase tracking-wider w-24">Dir.</th>
                <th className="px-3 py-2.5 text-xs text-gray-500 uppercase tracking-wider w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className={`border-t hover:bg-gray-50 transition ${editId === r.id ? 'bg-blue-50' : ''}`}>
                  {editId === r.id ? (
                    <>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={editData.keyword}
                          onChange={e => setEditData(d => ({ ...d, keyword: e.target.value.toUpperCase() }))}
                          className="w-full border rounded px-2 py-1 text-xs font-mono bg-white"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={editData.category_id}
                          onChange={e => setEditData(d => ({ ...d, category_id: e.target.value }))}
                          className="w-full border rounded px-2 py-1 text-xs bg-white"
                        >
                          {categories.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={editData.direction}
                          onChange={e => setEditData(d => ({ ...d, direction: e.target.value }))}
                          className="w-full border rounded px-2 py-1 text-xs bg-white"
                        >
                          <option value="both">⚪ Tous</option>
                          <option value="debit">🔴 Débit</option>
                          <option value="credit">🟢 Crédit</option>
                        </select>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={saveEdit} disabled={saving} className="px-2 py-1 bg-emerald-500 text-white rounded text-xs hover:bg-emerald-600 disabled:opacity-50">
                            {saving ? '...' : '✓'}
                          </button>
                          <button onClick={cancelEdit} className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs hover:bg-gray-300">
                            ✕
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-1.5 font-mono text-xs">{r.keyword}</td>
                      <td className="px-3 py-1.5">
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                          {r.budget_categories?.icon} {r.budget_categories?.name}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {r.direction === 'debit' ? '🔴 Débit' : r.direction === 'credit' ? '🟢 Crédit' : '⚪ Tous'}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100" style={{ opacity: 1 }}>
                          <button onClick={() => startEdit(r)} className="px-2 py-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded text-xs transition" title="Modifier">
                            ✏️
                          </button>
                          <button onClick={() => del(r.id, r.keyword)} className="px-2 py-1 text-red-300 hover:text-red-600 hover:bg-red-50 rounded text-xs transition" title="Supprimer">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              {rules.length === 0 ? 'Aucune règle configurée' : 'Aucune règle ne correspond aux filtres'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// IMPORT — Texte brut CMB + Matching factures
// ════════════════════════════════════════════════════════════
function ImportTab({ loadAll, categories, rules, invoices, clients }) {
  const [imp, setImp] = useState(false)
  const [csv, setCsv] = useState('')
  const [pre, setPre] = useState([])

  // Nouveau : collage rapide texte brut
  const [rawText, setRawText] = useState('')
  const [rawDirection, setRawDirection] = useState('credit')
  const [rawParsed, setRawParsed] = useState(null)
  const [rawSaving, setRawSaving] = useState(false)

  // Matching factures
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchTx, setMatchTx] = useState(null)
  const [matchClient, setMatchClient] = useState(null)
  const [matchCandidates, setMatchCandidates] = useState([])
  const [matchSelected, setMatchSelected] = useState(new Set())
  const [matchAllocations, setMatchAllocations] = useState({})
  const [matchClientSearch, setMatchClientSearch] = useState('')
  const [matchStep, setMatchStep] = useState('auto') // auto | select_client | select_invoices

  // Factures non payées
  const unpaidInvoices = useMemo(() =>
    (invoices || []).filter(inv => inv.type !== 'credit_note' && ['sent', 'due', 'overdue', 'partial'].includes(inv.status) && parseFloat(inv.amount_due) > 0),
    [invoices]
  )

  // ── Parser CSV (existant) ──
  function parse(text) {
    const lines = text.trim().split('\n').filter(l=>l.trim()); const txs = []
    for(const line of lines){const p=line.split(';');if(p.length<4||p[0]==='Date operation')continue;const ds=p[0].trim();const desc=p[2]?.trim()||'';const db=p[3]?.trim().replace(/\s/g,'').replace(',','.')||'';const cr=p[4]?.trim().replace(/\s/g,'').replace(',','.')||'';if(!ds||!desc)continue;const dp=ds.split('/');if(dp.length!==3)continue;const yr=dp[2].length===2?'20'+dp[2]:dp[2];const d=db?Math.abs(parseFloat(db)):0;const c=cr?Math.abs(parseFloat(cr)):0;if(isNaN(d)&&isNaN(c))continue;let cn='Autre / Non classé';const du=desc.toUpperCase();for(const r of rules){if(r.direction==='debit'&&!(d>0))continue;if(r.direction==='credit'&&!(c>0))continue;if(du.includes(r.keyword?.toUpperCase())){cn=r.budget_categories?.name||cn;break}};txs.push({date:`${yr}-${dp[1]}-${dp[0]}`,description:desc,debit:d||0,credit:c||0,category_name:cn,month:`${dp[1]}/${yr}`,year:parseInt(yr)})}
    return txs
  }

  async function doImport() {
    if(!pre.length)return; setImp(true)
    try{const rows=pre.map(tx=>{const cat=categories.find(c=>c.name===tx.category_name);return{...tx,category_id:cat?.id||null,source_file:'import_csv_cmb',payer:'entreprise',is_manual:false,is_personal:false}});for(let i=0;i<rows.length;i+=50){const{error}=await supabase.from('budget_transactions').insert(rows.slice(i,i+50));if(error)throw error};toast.success(`✅ ${rows.length} importées`);setCsv('');setPre([]);loadAll()}catch(e){toast.error('Erreur: '+(e.message||''))}
    setImp(false)
  }

  // ══ Parser texte brut CMB ══
  // Format: "20/02\n20/02\nVIR SOFIS 684,42  VIR SOFIS FACT-20251120-00047..."
  function parseRawText(text) {
    if (!text.trim()) return null
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return null

    // Ligne 1 et 2 = dates (date opération / date valeur)
    let dateOp = '', dateVal = ''
    const today = new Date()
    const currentYear = today.getFullYear()

    for (let i = 0; i < Math.min(2, lines.length); i++) {
      const dm = lines[i].match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/)
      if (dm) {
        const day = dm[1].padStart(2, '0')
        const month = dm[2].padStart(2, '0')
        const year = dm[3] ? (dm[3].length === 2 ? '20' + dm[3] : dm[3]) : String(currentYear)
        const dateStr = `${year}-${month}-${day}`
        if (!dateOp) dateOp = dateStr
        else dateVal = dateStr
      }
    }

    if (!dateOp) return null

    // Reste = description + montant
    const descLines = lines.slice(dateOp && dateVal ? 2 : 1)
    let fullDesc = descLines.join(' ').replace(/\s+/g, ' ').trim()

    // Extraire le montant (cherche un nombre avec virgule ou point, en fin ou au milieu)
    let amount = 0
    // Pattern: nombre avec séparateur milliers (point) et décimales (virgule) ou simple
    const amountMatch = fullDesc.match(/(\d[\d\s.]*,\d{2})/)
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/\s/g, '').replace('.', '').replace(',', '.'))
    }

    // Auto-catégoriser
    let catName = 'Autre / Non classé'
    const descUp = fullDesc.toUpperCase()
    for (const r of rules) {
      if (r.direction === 'debit' && rawDirection === 'credit') continue
      if (r.direction === 'credit' && rawDirection === 'debit') continue
      if (descUp.includes(r.keyword?.toUpperCase())) {
        catName = r.budget_categories?.name || catName
        break
      }
    }

    // Extraire le nom du client (pour matching factures)
    let detectedClient = null
    if (rawDirection === 'credit') {
      // Chercher dans les clients connus
      for (const cli of (clients || [])) {
        const cliUp = cli.name.toUpperCase()
        // Chercher des mots du nom client dans la description
        const words = cliUp.split(/[\s\-_]+/).filter(w => w.length > 3)
        for (const w of words) {
          if (descUp.includes(w)) { detectedClient = cli; break }
        }
        if (detectedClient) break
      }
    }

    const dp = dateOp.split('-')
    return {
      date: dateOp,
      description: fullDesc,
      amount,
      direction: rawDirection,
      debit: rawDirection === 'debit' ? amount : 0,
      credit: rawDirection === 'credit' ? amount : 0,
      category_name: catName,
      month: `${dp[1]}/${dp[0]}`,
      year: parseInt(dp[0]),
      detectedClient,
    }
  }

  function handleParseRaw() {
    const result = parseRawText(rawText)
    if (!result) { toast.error('Format non reconnu. Collez date + libellé CMB'); return }
    setRawParsed(result)

    // Si c'est un crédit → lancer le matching
    if (result.direction === 'credit' && result.amount > 0) {
      startInvoiceMatching(result)
    }
    toast.success(`✅ Détecté: ${result.amount > 0 ? fmt(result.amount) : 'Montant non détecté'} — ${result.direction === 'credit' ? 'Entrée' : 'Sortie'}`)
  }

  // ══ Matching factures ══
  function startInvoiceMatching(txData) {
    setMatchTx(txData)
    setMatchSelected(new Set())
    setMatchAllocations({})

    let candidates = []
    let foundClient = txData.detectedClient

    if (foundClient) {
      // Factures de ce client
      candidates = unpaidInvoices.filter(inv => inv.client_id === foundClient.id)
    }

    if (candidates.length > 0) {
      setMatchClient(foundClient)
      setMatchCandidates(candidates)

      // Auto-sélectionner si montant exact
      const exactMatch = candidates.filter(inv => Math.abs(parseFloat(inv.amount_due) - txData.amount) < 0.01)
      if (exactMatch.length === 1) {
        const inv = exactMatch[0]
        setMatchSelected(new Set([inv.id]))
        setMatchAllocations({ [inv.id]: parseFloat(inv.amount_due) })
      } else {
        // Essayer une combinaison de factures
        autoMatchCombination(candidates, txData.amount)
      }
      setMatchStep('select_invoices')
    } else {
      // Client non trouvé → demander
      setMatchClient(null)
      setMatchCandidates([])
      setMatchStep('select_client')
    }
    setShowMatchModal(true)
  }

  function autoMatchCombination(candidates, targetAmount) {
    // Essayer de trouver une combinaison exacte (simple: 1, 2 ou 3 factures)
    const sorted = [...candidates].sort((a, b) => parseFloat(b.amount_due) - parseFloat(a.amount_due))

    // 1 facture exacte
    for (const inv of sorted) {
      if (Math.abs(parseFloat(inv.amount_due) - targetAmount) < 0.01) {
        setMatchSelected(new Set([inv.id]))
        setMatchAllocations({ [inv.id]: parseFloat(inv.amount_due) })
        return
      }
    }

    // 2 factures
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const sum = parseFloat(sorted[i].amount_due) + parseFloat(sorted[j].amount_due)
        if (Math.abs(sum - targetAmount) < 0.01) {
          const sel = new Set([sorted[i].id, sorted[j].id])
          const alloc = { [sorted[i].id]: parseFloat(sorted[i].amount_due), [sorted[j].id]: parseFloat(sorted[j].amount_due) }
          setMatchSelected(sel)
          setMatchAllocations(alloc)
          return
        }
      }
    }

    // 3 factures
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        for (let k = j + 1; k < sorted.length; k++) {
          const sum = parseFloat(sorted[i].amount_due) + parseFloat(sorted[j].amount_due) + parseFloat(sorted[k].amount_due)
          if (Math.abs(sum - targetAmount) < 0.01) {
            const sel = new Set([sorted[i].id, sorted[j].id, sorted[k].id])
            const alloc = { [sorted[i].id]: parseFloat(sorted[i].amount_due), [sorted[j].id]: parseFloat(sorted[j].amount_due), [sorted[k].id]: parseFloat(sorted[k].amount_due) }
            setMatchSelected(sel)
            setMatchAllocations(alloc)
            return
          }
        }
      }
    }
  }

  function handleSelectClient(clientId) {
    const cli = (clients || []).find(c => c.id === clientId)
    if (!cli) return
    setMatchClient(cli)
    const candidates = unpaidInvoices.filter(inv => inv.client_id === clientId)
    setMatchCandidates(candidates)
    if (matchTx) autoMatchCombination(candidates, matchTx.amount)
    setMatchStep('select_invoices')
  }

  function toggleInvoice(invId) {
    const next = new Set(matchSelected)
    if (next.has(invId)) {
      next.delete(invId)
      const alloc = { ...matchAllocations }
      delete alloc[invId]
      setMatchAllocations(alloc)
    } else {
      next.add(invId)
      const inv = matchCandidates.find(i => i.id === invId)
      if (inv) {
        setMatchAllocations(prev => ({ ...prev, [invId]: parseFloat(inv.amount_due) }))
      }
    }
    setMatchSelected(next)
  }

  const matchTotal = useMemo(() =>
    Object.values(matchAllocations).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [matchAllocations]
  )

  const matchDiff = matchTx ? Math.abs(matchTotal - matchTx.amount) : 0
  const matchExact = matchDiff < 0.01

  // ══ Sauvegarder le rapprochement ══
  async function saveReconciliation() {
    if (!rawParsed || matchSelected.size === 0) return
    setRawSaving(true)

    try {
      const cat = categories.find(c => c.name === rawParsed.category_name)
      const dp = rawParsed.date.split('-')

      // 1. Créer la transaction
      const txRow = {
        date: rawParsed.date,
        description: rawParsed.description,
        debit: rawParsed.debit,
        credit: rawParsed.credit,
        category_id: cat?.id || null,
        category_name: rawParsed.category_name,
        month: `${dp[1]}/${dp[0]}`,
        year: parseInt(dp[0]),
        source_file: 'import_rapide_cmb',
        is_manual: false,
        is_personal: false,
        payer: 'entreprise',
        reconciled_at: new Date().toISOString(),
        linked_invoice_id: matchSelected.size === 1 ? [...matchSelected][0] : null,
      }

      const { data: txData, error: txErr } = await supabase.from('budget_transactions').insert(txRow).select().single()
      if (txErr) throw txErr

      // 2. Créer les liens dans budget_transaction_invoices
      const links = [...matchSelected].map(invId => ({
        transaction_id: txData.id,
        invoice_id: invId,
        amount_applied: matchAllocations[invId] || 0,
        reconciled_by: 'Hicham',
      }))
      const { error: linkErr } = await supabase.from('budget_transaction_invoices').insert(links)
      if (linkErr) throw linkErr

      // 3. Mettre à jour chaque facture (amount_paid, status)
      for (const invId of matchSelected) {
        const inv = unpaidInvoices.find(i => i.id === invId)
        if (!inv) continue
        const applied = matchAllocations[invId] || 0
        const newPaid = (parseFloat(inv.amount_paid) || 0) + applied
        const newDue = parseFloat(inv.total_ttc) - newPaid
        const newStatus = newDue <= 0.01 ? 'paid' : 'partial'

        await supabase.from('invoices').update({
          amount_paid: newPaid,
          amount_due: Math.max(0, newDue),
          status: newStatus,
          updated_at: new Date().toISOString(),
        }).eq('id', invId)

        // Enregistrer le paiement dans invoice_payments
        await supabase.from('invoice_payments').insert({
          invoice_id: invId,
          amount: applied,
          payment_date: rawParsed.date,
          payment_method: 'virement bancaire',
          payment_reference: rawParsed.description.substring(0, 100),
          notes: `Rapprochement bancaire du ${new Date().toLocaleDateString('fr-FR')}`,
          created_by: 'Hicham Saidi',
        })
      }

      toast.success(`✅ Transaction importée + ${matchSelected.size} facture(s) marquée(s) payée(s)`)
      setShowMatchModal(false)
      setRawText('')
      setRawParsed(null)
      setMatchTx(null)
      loadAll()
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
    setRawSaving(false)
  }

  // ══ Sauvegarder sans matching (débit ou crédit sans facture) ══
  async function saveWithoutMatch() {
    if (!rawParsed) return
    setRawSaving(true)
    try {
      const cat = categories.find(c => c.name === rawParsed.category_name)
      const dp = rawParsed.date.split('-')
      const txRow = {
        date: rawParsed.date,
        description: rawParsed.description,
        debit: rawParsed.debit,
        credit: rawParsed.credit,
        category_id: cat?.id || null,
        category_name: rawParsed.category_name,
        month: `${dp[1]}/${dp[0]}`,
        year: parseInt(dp[0]),
        source_file: 'import_rapide_cmb',
        is_manual: false,
        is_personal: false,
        payer: 'entreprise',
      }
      const { error } = await supabase.from('budget_transactions').insert(txRow)
      if (error) throw error
      toast.success(`✅ Transaction importée`)
      setRawText(''); setRawParsed(null)
      loadAll()
    } catch (err) { toast.error('Erreur: ' + err.message) }
    setRawSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* ══ IMPORT RAPIDE — Texte brut CMB ══ */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-2">⚡ Import rapide — Copier/coller CMB</h3>
        <p className="text-xs text-gray-500 mb-3">Collez le texte brut copié depuis votre relevé CMB (date + libellé). Ex: "20/02\n20/02\nVIR SOFIS 684,42..."</p>

        <div className="flex gap-2 mb-2">
          <button onClick={() => setRawDirection('credit')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${rawDirection === 'credit' ? 'bg-green-500 text-white' : 'bg-gray-100'}`}>🟢 Entrée (encaissement)</button>
          <button onClick={() => setRawDirection('debit')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${rawDirection === 'debit' ? 'bg-red-500 text-white' : 'bg-gray-100'}`}>🔴 Sortie (paiement)</button>
        </div>

        <textarea value={rawText} onChange={e => setRawText(e.target.value)}
          placeholder={"20/02\n20/02\nVIR SOFIS 684,42  VIR SOFIS FACT-20251120-00047..."}
          className="w-full h-28 border rounded-lg p-3 text-xs font-mono resize-y" />

        <div className="flex gap-2 mt-2">
          <button onClick={handleParseRaw} disabled={!rawText.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex-1">
            🔍 Analyser
          </button>
          {rawParsed && rawDirection === 'debit' && (
            <button onClick={saveWithoutMatch} disabled={rawSaving} className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {rawSaving ? '⏳...' : '💾 Importer (sortie)'}
            </button>
          )}
          {rawParsed && rawDirection === 'credit' && !showMatchModal && (
            <button onClick={() => startInvoiceMatching(rawParsed)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">
              🔗 Rapprocher factures
            </button>
          )}
          {rawParsed && rawDirection === 'credit' && (
            <button onClick={saveWithoutMatch} disabled={rawSaving} className="bg-gray-400 text-white px-3 py-2 rounded-lg text-xs disabled:opacity-50" title="Importer sans lier à une facture">
              Sans facture
            </button>
          )}
        </div>

        {/* Résultat du parsing */}
        {rawParsed && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-medium text-blue-800">📋 Résultat :</span>
              {rawParsed.detectedClient && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Client détecté : {rawParsed.detectedClient.name}</span>
              )}
            </div>
            <div className="text-xs">Date : <b>{rawParsed.date}</b></div>
            <div className="text-xs">Description : <b className="break-all">{rawParsed.description}</b></div>
            <div className="text-xs">Montant : <b className={rawDirection === 'credit' ? 'text-green-700' : 'text-red-700'}>{fmt(rawParsed.amount)}</b></div>
            <div className="text-xs">Catégorie : <b>{rawParsed.category_name}</b></div>
          </div>
        )}
      </div>

      {/* ══ MODAL MATCHING FACTURES ══ */}
      {showMatchModal && matchTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-green-50 rounded-t-xl">
              <div>
                <h3 className="font-bold text-green-800">🔗 Rapprochement bancaire</h3>
                <p className="text-xs text-green-600 mt-0.5">Montant reçu : <b>{fmt(matchTx.amount)}</b></p>
              </div>
              <button onClick={() => setShowMatchModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* Étape : sélection client */}
              {matchStep === 'select_client' && (
                <div>
                  <p className="text-sm text-gray-700 mb-2">Client non identifié automatiquement. Sélectionnez le client :</p>
                  <input type="text" value={matchClientSearch} onChange={e => setMatchClientSearch(e.target.value)}
                    placeholder="🔍 Rechercher un client..." className="w-full border rounded-lg px-3 py-2 text-sm mb-2" autoFocus />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {(clients || [])
                      .filter(c => {
                        if (!matchClientSearch) return unpaidInvoices.some(inv => inv.client_id === c.id)
                        return c.name.toUpperCase().includes(matchClientSearch.toUpperCase())
                      })
                      .slice(0, 20)
                      .map(c => {
                        const invCount = unpaidInvoices.filter(inv => inv.client_id === c.id).length
                        return (
                          <button key={c.id} onClick={() => handleSelectClient(c.id)}
                            className="w-full text-left p-2 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-sm">
                            <span className="font-medium">{c.name}</span>
                            {invCount > 0 && <span className="ml-2 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{invCount} facture(s) en attente</span>}
                            {invCount === 0 && <span className="ml-2 text-xs text-gray-400">Aucune facture en attente</span>}
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Étape : sélection factures */}
              {matchStep === 'select_invoices' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Factures de </span>
                      <span className="text-sm font-bold text-blue-700">{matchClient?.name}</span>
                    </div>
                    <button onClick={() => setMatchStep('select_client')} className="text-xs text-blue-600 hover:underline">Changer de client</button>
                  </div>

                  {matchCandidates.length === 0 ? (
                    <div className="text-center py-6 text-gray-400">
                      <p className="text-sm">Aucune facture en attente pour ce client</p>
                      <button onClick={() => { setShowMatchModal(false); saveWithoutMatch() }} className="mt-2 text-blue-600 text-sm hover:underline">Importer sans rapprochement</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {matchCandidates.map(inv => {
                        const isSelected = matchSelected.has(inv.id)
                        const due = parseFloat(inv.amount_due)
                        return (
                          <div key={inv.id}
                            onClick={() => toggleInvoice(inv.id)}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-green-50 border-green-400 ring-1 ring-green-300' : 'hover:bg-gray-50'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                                  {isSelected && <span className="text-xs">✓</span>}
                                </div>
                                <div>
                                  <span className="font-medium text-sm">{inv.reference}</span>
                                  <span className="text-xs text-gray-500 ml-2">{inv.object ? inv.object.substring(0, 40) : ''}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-sm">{fmt(due)}</div>
                                <div className="text-xs text-gray-400">TTC: {fmt(inv.total_ttc)}</div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('fr-FR') : ''} — 
                              <span className={inv.status === 'overdue' ? 'text-red-600 font-medium' : ''}>{inv.status === 'overdue' ? 'En retard' : inv.status === 'partial' ? 'Paiement partiel' : 'À régler'}</span>
                            </div>

                            {/* Allocation manuelle si sélectionnée */}
                            {isSelected && matchSelected.size > 1 && (
                              <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <label className="text-xs text-gray-500">Montant imputé :</label>
                                <input
                                  type="number" step="0.01"
                                  value={matchAllocations[inv.id] || ''}
                                  onChange={e => setMatchAllocations(prev => ({ ...prev, [inv.id]: parseFloat(e.target.value) || 0 }))}
                                  className="w-28 border rounded px-2 py-1 text-xs text-right"
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Barre de total */}
                  {matchSelected.size > 0 && (
                    <div className={`mt-3 p-3 rounded-lg border-2 ${matchExact ? 'bg-green-50 border-green-400' : 'bg-amber-50 border-amber-400'}`}>
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium">Total sélectionné :</span>
                        <span className="font-bold text-lg">{fmt(matchTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-1">
                        <span>Montant du virement :</span>
                        <span className="font-bold">{fmt(matchTx.amount)}</span>
                      </div>
                      {!matchExact && (
                        <div className="mt-2 flex items-center gap-2 text-amber-700">
                          <span className="text-lg">⚠️</span>
                          <span className="text-xs font-medium">Écart de {fmt(matchDiff)} — {matchTotal > matchTx.amount ? 'Factures > Virement' : 'Virement > Factures'}</span>
                        </div>
                      )}
                      {matchExact && (
                        <div className="mt-1 text-green-700 text-xs font-medium">✅ Montants correspondants</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowMatchModal(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                Annuler
              </button>
              <div className="flex-1" />
              {matchSelected.size > 0 && (
                <button onClick={saveReconciliation} disabled={rawSaving}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${matchExact ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                  {rawSaving ? '⏳...' : `✅ Rapprocher ${matchSelected.size} facture(s)${!matchExact ? ' (écart)' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ IMPORT CSV classique (existant) ══ */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-2">📥 Import CSV Crédit Mutuel</h3>
        <textarea value={csv} onChange={e=>setCsv(e.target.value)} placeholder="Date operation;Date valeur;Libelle;Debit;Credit" className="w-full h-40 border rounded-lg p-3 text-xs font-mono resize-y"/>
        <div className="flex gap-2 mt-2">
          <button onClick={()=>{const t=parse(csv);setPre(t);toast(t.length>0?`${t.length} détectées`:'Aucune')}} disabled={!csv.trim()} className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">👁️ Prévisualiser</button>
          {pre.length>0&&<button onClick={doImport} disabled={imp} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">{imp?'⏳...':` ✅ Importer ${pre.length}`}</button>}
        </div>
      </div>
      {pre.length>0&&(
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-2 bg-amber-50 border-b text-sm text-amber-700 font-medium">⚠️ {pre.length} transactions</div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs"><thead className="bg-gray-50 sticky top-0"><tr><th className="text-left px-2 py-1">Date</th><th className="text-left px-2 py-1">Description</th><th className="text-left px-2 py-1">Cat.</th><th className="text-right px-2 py-1">Débit</th><th className="text-right px-2 py-1">Crédit</th></tr></thead>
              <tbody>{pre.map((tx,i)=><tr key={i} className="border-t"><td className="px-2 py-1">{tx.date}</td><td className="px-2 py-1 truncate max-w-xs">{tx.description}</td><td className="px-2 py-1"><span className={`px-1.5 py-0.5 rounded text-xs ${tx.category_name==='Autre / Non classé'?'bg-amber-100 text-amber-700':'bg-gray-100'}`}>{tx.category_name}</span></td><td className="px-2 py-1 text-right text-red-600">{tx.debit>0?tx.debit.toFixed(2):''}</td><td className="px-2 py-1 text-right text-green-600">{tx.credit>0?tx.credit.toFixed(2):''}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
// ════════════════════════════════════════════════════════════
// CATÉGORISATION IA
// ════════════════════════════════════════════════════════════
function CategorisationIATab({ transactions, categories, rules, loadAll }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [applied, setApplied] = useState(new Set())
  const [ignored, setIgnored] = useState(new Set())

  // Transactions non classées ou potentiellement mal classées
  const candidates = useMemo(() => {
    return transactions.filter(tx => !tx.is_personal).sort((a, b) => (b.debit || 0) - (a.debit || 0))
  }, [transactions])

  async function analyzeAll() {
    setAnalyzing(true)
    setSuggestions([])
    setApplied(new Set())
    setIgnored(new Set())

    // Préparer les données pour l'IA - par lots de 40
    const catList = categories.map(c => c.name).join(', ')
    const rulesList = rules.map(r => `${r.keyword} → ${r.budget_categories?.name || '?'}`).join(', ')
    const allSuggestions = []
    const batchSize = 50
    const batches = []

    for (let i = 0; i < candidates.length; i += batchSize) {
      batches.push(candidates.slice(i, i + batchSize))
    }

    setProgress({ done: 0, total: batches.length })

    for (let b = 0; b < batches.length; b++) {
      // Throttle : 2s entre chaque appel pour éviter 429
      if (b > 0) await new Promise(r => setTimeout(r, 2000))
      const batch = batches[b]
      const txList = batch.map((tx, i) => `${i}|${tx.id}|${tx.description}|${tx.debit > 0 ? 'DEBIT ' + tx.debit : 'CREDIT ' + tx.credit}|${tx.category_name}`).join('\n')

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{ role: 'user', content: `Tu es un expert-comptable. Analyse ces transactions bancaires d'Access Formation SARL (formation professionnelle SST/CACES/sécurité en Bretagne).

Pour chaque transaction, vérifie si la catégorie actuelle est correcte. Réponds UNIQUEMENT avec un JSON array des transactions MAL CLASSÉES (pas celles qui sont correctes).

Catégories disponibles : ${catList}

Règles existantes : ${rulesList}

Contexte métier important :
- "VIR INST SAIDI Hicham" avec ~960€ = loyer siège (pas salaire)
- "VIR INST SAIDI Hicham" avec ~500-2500€ = salaire dirigeant
- "VIR INST LANGLAIS Maxime" = salaire dirigeant
- DKV = carte carburant entreprise
- DIAC = leasing véhicule
- CEGEFI = cabinet comptable
- CEGEMA = mutuelle/prévoyance
- ECH PRET = remboursement prêt BPI
- TRESOVIV = mouvement interne entre comptes
- Restaurants = souvent déplacements professionnels
- GOCARDLESS = probablement paiement Qualiopi
- Tout VIR de client (OPCO, AFPI, SOCOTEC, EIFFAGE, etc.) = CA Formations ou CA Sous-traitance

Format JSON strict (pas de markdown, pas d'icônes dans les noms de catégorie) :
[{"id":"uuid","description":"...","current":"catégorie actuelle","suggested":"catégorie suggérée","confidence":0.95,"reason":"explication courte","keyword":"MOT_CLE pour future règle"}]

Si toutes les transactions sont bien classées, réponds : []

Transactions :
${txList}` }]
          })
        })

        const data = await response.json()
        const text = data.content?.[0]?.text || '[]'
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        if (Array.isArray(parsed)) {
          allSuggestions.push(...parsed)
        }
      } catch (e) {
        console.error('Erreur batch', b, e)
      }
      setProgress({ done: b + 1, total: batches.length })
    }

    setSuggestions(allSuggestions)
    setAnalyzing(false)
  }

  async function applySuggestion(s) {
    // Matching flexible : exact d'abord, puis includes, puis strip icônes/espaces
    const suggested = (s.suggested || '').trim()
    const cat = categories.find(c => c.name === suggested)
      || categories.find(c => suggested.includes(c.name))
      || categories.find(c => c.name.includes(suggested))
      || categories.find(c => suggested.replace(/^[\p{Emoji}\p{Emoji_Presentation}\s]+/u, '').trim() === c.name)
    if (!cat) { toast.error('Catégorie non trouvée: ' + suggested); return }

    // Update transaction
    await supabase.from('budget_transactions').update({ category_id: cat.id, category_name: cat.name }).eq('id', s.id)

    // Auto-create rule if keyword provided
    if (s.keyword && s.keyword.length > 2) {
      const existingRule = rules.find(r => r.keyword?.toUpperCase() === s.keyword.toUpperCase())
      if (!existingRule) {
        await supabase.from('budget_rules').insert({
          keyword: s.keyword.toUpperCase(),
          category_id: cat.id,
          direction: s.current_was_debit ? 'debit' : 'both'
        }).then(() => {})
      }
    }

    setApplied(prev => new Set([...prev, s.id]))
    toast.success(`✅ ${s.description?.substring(0, 30)} → ${cat.icon} ${cat.name}`)
  }

  async function applyAll() {
    const pending = suggestions.filter(s => !applied.has(s.id) && !ignored.has(s.id))
    for (const s of pending) {
      await applySuggestion(s)
    }
    loadAll()
    toast.success(`✅ ${pending.length} corrections appliquées`)
  }

  const pending = suggestions.filter(s => !applied.has(s.id) && !ignored.has(s.id))
  const highConf = pending.filter(s => s.confidence >= 0.8)

  return (
    <div className="space-y-4">
      {/* Header + Launch */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-gray-700">🤖 Catégorisation intelligente</h3>
            <p className="text-xs text-gray-500 mt-1">L'IA analyse {candidates.length} transactions et propose des corrections de catégorie</p>
          </div>
          <button onClick={analyzeAll} disabled={analyzing}
            className="bg-purple-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
            {analyzing ? `⏳ Analyse... ${progress.done}/${progress.total}` : '🤖 Lancer l\'analyse'}
          </button>
        </div>

        {analyzing && (
          <div className="mt-3">
            <div className="bg-gray-200 rounded-full h-2">
              <div className="bg-purple-500 rounded-full h-2 transition-all" style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Lot {progress.done}/{progress.total} — {candidates.length} transactions analysées</p>
          </div>
        )}
      </div>

      {/* Résultats */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-gray-700">📋 {suggestions.length} correction(s) suggérée(s)</h3>
              <p className="text-xs text-gray-500">{applied.size} appliquées • {ignored.size} ignorées • {pending.length} en attente</p>
            </div>
            {highConf.length > 0 && (
              <button onClick={applyAll} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                ✅ Tout valider ({pending.length})
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500">Description</th>
                  <th className="text-left px-3 py-2 text-gray-500">Montant</th>
                  <th className="text-left px-3 py-2 text-gray-500">Actuelle</th>
                  <th className="text-left px-3 py-2 text-gray-500">→ Suggestion IA</th>
                  <th className="text-center px-2 py-2 text-gray-500">Confiance</th>
                  <th className="text-left px-3 py-2 text-gray-500">Raison</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s, i) => {
                  const done = applied.has(s.id)
                  const skip = ignored.has(s.id)
                  const tx = transactions.find(t => t.id === s.id)
                  return (
                    <tr key={i} className={`border-t ${done ? 'bg-green-50 opacity-60' : skip ? 'bg-gray-50 opacity-40' : 'hover:bg-blue-50/30'}`}>
                      <td className="px-3 py-1.5 max-w-48"><div className="truncate" title={s.description}>{s.description}</div></td>
                      <td className="px-3 py-1.5 font-mono whitespace-nowrap">{tx?.debit > 0 ? <span className="text-red-600">{fmt(tx.debit)}</span> : <span className="text-green-600">{fmt(tx?.credit)}</span>}</td>
                      <td className="px-3 py-1.5"><span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs">{s.current}</span></td>
                      <td className="px-3 py-1.5"><span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-medium">{s.suggested}</span></td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${s.confidence >= 0.9 ? 'bg-green-200 text-green-800' : s.confidence >= 0.7 ? 'bg-amber-200 text-amber-800' : 'bg-red-200 text-red-800'}`}>
                          {Math.round(s.confidence * 100)}%
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-600 max-w-48"><div className="truncate" title={s.reason}>{s.reason}</div></td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {!done && !skip && (
                          <>
                            <button onClick={() => applySuggestion(s)} className="text-green-600 hover:text-green-800 text-sm mr-1" title="Valider">✅</button>
                            <button onClick={() => setIgnored(prev => new Set([...prev, s.id]))} className="text-gray-400 hover:text-gray-600 text-sm" title="Ignorer">❌</button>
                          </>
                        )}
                        {done && <span className="text-green-500">✓</span>}
                        {skip && <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {applied.size > 0 && (
            <div className="mt-3 flex justify-end">
              <button onClick={loadAll} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                🔄 Rafraîchir les données
              </button>
            </div>
          )}
        </div>
      )}

      {suggestions.length === 0 && !analyzing && (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-400">
          <div className="text-4xl mb-3">🤖</div>
          <p>Cliquez "Lancer l'analyse" pour que l'IA vérifie toutes vos catégorisations</p>
          <p className="text-xs mt-2">L'IA détecte les erreurs de classement et propose des corrections avec auto-création de règles</p>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// PRÉVISIONNEL & OBJECTIF 50K€
// ════════════════════════════════════════════════════════════
function PrevisionnelTab({ transactions, categories }) {
  const [config, setConfig] = useState({
    solde_actuel: 3267,
    objectif: 50000,
    salaires: 5000,
    urssaf: 980,
    ca_boost: 0,  // % boost CA post-Qualiopi
    scenario: 'realiste'
  })

  // ── Calcul des charges fixes moyennes depuis les données réelles ──
  const analysis = useMemo(() => {
    const co = transactions.filter(tx => !tx.is_personal)

    // Map catégorie name → type/direction
    const catMap = {}
    categories.forEach(c => { catMap[c.name] = { type: c.type, direction: c.direction } })

    // Grouper par mois
    const byMonth = {}
    co.forEach(tx => {
      if (!byMonth[tx.month]) byMonth[tx.month] = { debit: 0, credit: 0, cats: {} }
      byMonth[tx.month].debit += tx.debit || 0
      byMonth[tx.month].credit += tx.credit || 0
      const c = tx.category_name || 'Non classé'
      if (!byMonth[tx.month].cats[c]) byMonth[tx.month].cats[c] = { debit: 0, credit: 0 }
      byMonth[tx.month].cats[c].debit += tx.debit || 0
      byMonth[tx.month].cats[c].credit += tx.credit || 0
    })

    const months = Object.keys(byMonth).sort()
    const nbMonths = months.length || 1

    // Calculer depuis type/direction des catégories
    let totalFixed = 0, totalVariable = 0, totalRevenue = 0
    const fixedBreakdown = {}

    months.forEach(m => {
      const mc = byMonth[m].cats
      Object.entries(mc).forEach(([cat, vals]) => {
        const info = catMap[cat] || { type: 'variable', direction: 'depense' }

        // Exclure exceptionnel et neutre
        if (info.type === 'exceptionnel' || info.direction === 'neutre') return

        if (info.direction === 'recette' && vals.credit > 0) {
          totalRevenue += vals.credit
        } else if (info.type === 'fixe' && vals.debit > 0) {
          totalFixed += vals.debit
          if (!fixedBreakdown[cat]) fixedBreakdown[cat] = 0
          fixedBreakdown[cat] += vals.debit
        } else if (info.type === 'variable' && vals.debit > 0) {
          totalVariable += vals.debit
        }
      })
    })

    const avgMonthlyFixed = totalFixed / nbMonths
    const avgMonthlyVariable = totalVariable / nbMonths
    const avgMonthlyRevenue = totalRevenue / nbMonths
    const avgMonthlyNet = avgMonthlyRevenue - (totalFixed + totalVariable) / nbMonths

    // Saisonnalité : ratio par rapport à la moyenne
    const seasonality = {}
    const revenueByMonth = {}
    months.forEach(m => {
      let rev = 0
      Object.entries(byMonth[m].cats).forEach(([cat, vals]) => {
        const info = catMap[cat] || {}
        if (info.direction === 'recette' && info.type !== 'exceptionnel' && vals.credit > 0) {
          rev += vals.credit
        }
      })
      revenueByMonth[m] = rev
      const mm = m.split('/')[0]
      if (!seasonality[mm]) seasonality[mm] = { total: 0, count: 0 }
      seasonality[mm].total += rev
      seasonality[mm].count++
    })
    Object.keys(seasonality).forEach(mm => {
      seasonality[mm].avg = seasonality[mm].total / seasonality[mm].count
      seasonality[mm].ratio = avgMonthlyRevenue > 0 ? seasonality[mm].avg / avgMonthlyRevenue : 1
    })

    // Détail charges fixes pour affichage (top catégories)
    const fixedDetail = Object.entries(fixedBreakdown)
      .map(([name, total]) => ({ name, icon: categories.find(c => c.name === name)?.icon || '📦', monthly: total / nbMonths }))
      .sort((a, b) => b.monthly - a.monthly)

    return {
      months, byMonth, nbMonths,
      avgMonthlyFixed, avgMonthlyVariable, avgMonthlyRevenue, avgMonthlyNet,
      fixedBreakdown, fixedDetail, seasonality, revenueByMonth,
      totalFixed, totalVariable, totalRevenue
    }
  }, [transactions, categories])

  // ── Projections mois par mois jusqu'à décembre 2026 ──
  const projections = useMemo(() => {
    const futureMonths = []
    const now = new Date()
    const currentMonth = now.getMonth() + 1  // 1-12
    const currentYear = now.getFullYear()

    for (let m = currentMonth; m <= 12; m++) {
      futureMonths.push({ month: m, year: 2026, label: `${String(m).padStart(2, '0')}/2026` })
    }

    // Mois faibles (août=8, décembre=12, janvier=1)
    const weakMonths = [1, 8, 12]

    // Charges fixes = moyenne historique HORS salaires et URSSAF (éditables séparément)
    const salaryNames = ['Salaire Hicham', 'Salaire Maxime']
    const urssafNames = ['Charges sociales (URSSAF)']
    const excludeFromFixed = [...salaryNames, ...urssafNames]

    const computedFixed = analysis.fixedDetail
      .filter(d => !excludeFromFixed.includes(d.name))
      .reduce((sum, d) => sum + d.monthly, 0)

    const salaires = config.salaires
    const urssaf = config.urssaf
    const totalFixedMonth = computedFixed + salaires + urssaf

    // Scénarios de CA
    const scenarios = {
      pessimiste: { label: '😟 Pessimiste', multiplier: 0.7, desc: 'CA -30% vs moyenne' },
      realiste: { label: '📊 Réaliste', multiplier: 1.0, desc: 'CA = moyenne historique' },
      optimiste: { label: '🚀 Optimiste', multiplier: 1.4, desc: 'CA +40% (effet Qualiopi + prospection)' },
    }

    const results = {}
    for (const [key, sc] of Object.entries(scenarios)) {
      let solde = config.solde_actuel
      const monthlyData = []

      for (const fm of futureMonths) {
        const isWeak = weakMonths.includes(fm.month)
        const seasonFactor = isWeak ? 0.5 : 1.1
        const caEstim = analysis.avgMonthlyRevenue * sc.multiplier * seasonFactor * (1 + config.ca_boost / 100)

        // Budget variable = ce qu'on peut dépenser en plus des charges fixes
        const budgetVariable = Math.max(0, caEstim - totalFixedMonth)
        // Variable réaliste = ~60% du budget variable plafonné à la moyenne historique
        const depVariable = Math.min(budgetVariable * 0.6, analysis.avgMonthlyVariable)

        const totalDepenses = totalFixedMonth + depVariable
        const net = caEstim - totalDepenses
        solde += net

        monthlyData.push({
          ...fm,
          ca: caEstim,
          fixedCharges: totalFixedMonth,
          variable: depVariable,
          totalDepenses,
          net,
          solde,
          budgetVariableMax: budgetVariable,
          isWeak,
          onTrack: solde >= config.objectif * (fm.month / 12)
        })
      }

      results[key] = { ...sc, data: monthlyData, finalSolde: solde }
    }

    return { results, totalFixedMonth, computedFixed, scenarios }
  }, [analysis, config])

  const sc = projections.results[config.scenario]
  const finalOk = sc?.finalSolde >= config.objectif
  const gap = config.objectif - config.solde_actuel
  const monthsLeft = sc?.data?.length || 10
  const requiredMonthly = gap / monthsLeft

  const ML2 = { 1:'Jan',2:'Fév',3:'Mar',4:'Avr',5:'Mai',6:'Jun',7:'Jul',8:'Aoû',9:'Sep',10:'Oct',11:'Nov',12:'Déc' }

  return (
    <div className="space-y-4">
      {/* KPIs objectif */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">🎯 Objectif : {fmt(config.objectif)} fin 2026</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${finalOk ? 'bg-green-400/30 text-green-100' : 'bg-red-400/30 text-red-100'}`}>
            {finalOk ? '✅ Atteignable' : '⚠️ Difficile'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white/10 rounded-lg p-2"><div className="text-xs opacity-70">Solde actuel</div><div className="font-bold">{fmt(config.solde_actuel)}</div></div>
          <div className="bg-white/10 rounded-lg p-2"><div className="text-xs opacity-70">Gap à combler</div><div className="font-bold">{fmt(gap)}</div></div>
          <div className="bg-white/10 rounded-lg p-2"><div className="text-xs opacity-70">Net requis/mois</div><div className="font-bold">{fmt(requiredMonthly)}</div></div>
          <div className="bg-white/10 rounded-lg p-2"><div className="text-xs opacity-70">Projection fin</div><div className="font-bold">{fmt(sc?.finalSolde || 0)}</div></div>
          <div className="bg-white/10 rounded-lg p-2"><div className="text-xs opacity-70">Charges fixes/mois</div><div className="font-bold">{fmt(projections.totalFixedMonth)}</div></div>
        </div>
        {/* Jauge progression */}
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span>{fmt(config.solde_actuel)}</span>
            <span>{fmt(config.objectif)}</span>
          </div>
          <div className="bg-white/20 rounded-full h-3">
            <div className={`rounded-full h-3 transition-all ${finalOk ? 'bg-green-400' : 'bg-amber-400'}`}
              style={{ width: `${Math.min(100, Math.max(2, (config.solde_actuel / config.objectif) * 100))}%` }} />
          </div>
        </div>
      </div>

      {/* Paramètres ajustables */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">⚙️ Paramètres</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-500">Solde actuel (€)</label>
            <input type="number" value={config.solde_actuel} onChange={e => setConfig(c => ({ ...c, solde_actuel: +e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Objectif (€)</label>
            <input type="number" value={config.objectif} onChange={e => setConfig(c => ({ ...c, objectif: +e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Salaires/mois (€)</label>
            <input type="number" value={config.salaires} onChange={e => setConfig(c => ({ ...c, salaires: +e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
          </div>
          <div>
            <label className="text-xs text-gray-500">URSSAF/mois (€)</label>
            <input type="number" value={config.urssaf} onChange={e => setConfig(c => ({ ...c, urssaf: +e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Boost CA Qualiopi (%)</label>
            <input type="number" value={config.ca_boost} onChange={e => setConfig(c => ({ ...c, ca_boost: +e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" placeholder="0" />
          </div>
        </div>
      </div>

      {/* Sélection scénario */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(projections.scenarios).map(([key, sc2]) => {
          const r = projections.results[key]
          const active = config.scenario === key
          const ok = r.finalSolde >= config.objectif
          return (
            <button key={key} onClick={() => setConfig(c => ({ ...c, scenario: key }))}
              className={`rounded-xl border-2 p-3 text-left transition-all ${active ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="font-bold text-sm">{sc2.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{sc2.desc}</div>
              <div className={`font-bold text-lg mt-2 ${ok ? 'text-green-600' : 'text-red-600'}`}>{fmt(r.finalSolde)}</div>
              <div className={`text-xs mt-0.5 ${ok ? 'text-green-600' : 'text-red-600'}`}>{ok ? '✅ Objectif atteint' : `❌ Manque ${fmt(config.objectif - r.finalSolde)}`}</div>
            </button>
          )
        })}
      </div>

      {/* Tableau mensuel */}
      {sc && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-700">📅 Projection mensuelle — {sc.label}</h3>
            <span className="text-xs text-gray-500">CA moyen historique : {fmt(analysis.avgMonthlyRevenue)}/mois</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500">Mois</th>
                  <th className="text-right px-3 py-2 text-gray-500">CA estimé</th>
                  <th className="text-right px-3 py-2 text-gray-500">Charges fixes</th>
                  <th className="text-right px-3 py-2 text-gray-500">Variable</th>
                  <th className="text-right px-3 py-2 text-gray-500">Net</th>
                  <th className="text-right px-3 py-2 text-gray-500">Solde cumulé</th>
                  <th className="text-center px-3 py-2 text-gray-500">Budget variable max</th>
                  <th className="text-center px-2 py-2 text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody>
                {sc.data.map((m, i) => (
                  <tr key={i} className={`border-t ${m.isWeak ? 'bg-amber-50/50' : ''} ${m.solde < 0 ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-1.5 font-medium">{ML2[m.month]} {m.year} {m.isWeak && <span className="text-amber-500 text-xs">🐌</span>}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-green-600">{fmt(m.ca)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-red-500">{fmt(m.fixedCharges)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-orange-500">{fmt(m.variable)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-bold ${m.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{m.net >= 0 ? '+' : ''}{fmt(m.net)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-bold ${m.solde >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(m.solde)}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-mono">{fmt(m.budgetVariableMax)}</span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {m.solde >= config.objectif ? '🎯' : m.solde >= 0 ? '✅' : '🔴'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`border-t-2 font-bold ${sc.finalSolde >= config.objectif ? 'bg-green-50' : 'bg-red-50'}`}>
                  <td className="px-3 py-2">Fin décembre 2026</td>
                  <td colSpan={4}></td>
                  <td className={`px-3 py-2 text-right font-mono text-lg ${sc.finalSolde >= config.objectif ? 'text-green-700' : 'text-red-700'}`}>{fmt(sc.finalSolde)}</td>
                  <td colSpan={2} className="px-3 py-2 text-center">
                    {sc.finalSolde >= config.objectif
                      ? <span className="text-green-700">🎯 Objectif atteint !</span>
                      : <span className="text-red-700">❌ Manque {fmt(config.objectif - sc.finalSolde)}</span>
                    }
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Détail charges fixes */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">📊 Détail charges fixes mensuelles (calculé sur {analysis.nbMonths} mois)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <span>💰</span>
            <div className="flex-1 text-xs text-gray-700">Salaires (paramètre)</div>
            <div className="font-mono text-sm font-bold text-red-600">{fmt(config.salaires)}</div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <span>🏛️</span>
            <div className="flex-1 text-xs text-gray-700">URSSAF (paramètre)</div>
            <div className="font-mono text-sm font-bold text-red-600">{fmt(config.urssaf)}</div>
          </div>
          {analysis.fixedDetail
            .filter(d => !['Salaire Hicham', 'Salaire Maxime', 'Charges sociales (URSSAF)'].includes(d.name))
            .map((c, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <span>{c.icon}</span>
              <div className="flex-1 text-xs text-gray-700">{c.name}</div>
              <div className="font-mono text-sm font-bold text-red-600">{fmt(c.monthly)}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 flex justify-between items-center">
          <span className="font-bold text-red-800">Total charges fixes mensuelles</span>
          <span className="font-mono text-xl font-bold text-red-700">{fmt(projections.totalFixedMonth)}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">💡 Pour atteindre {fmt(config.objectif)}, votre CA mensuel doit couvrir {fmt(projections.totalFixedMonth)} de charges fixes + dégager {fmt(requiredMonthly)} de bénéfice net</p>
        <p className="text-xs text-gray-500">→ <b>CA minimum requis : {fmt(projections.totalFixedMonth + requiredMonthly)}/mois</b></p>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  RECOMMANDATIONS TAB — Analyse, prévisionnel & optimisation
// ════════════════════════════════════════════════════════════
function RecommandationsTab({ transactions, categories }) {

  const [simCA, setSimCA] = useState(20)
  const [simCharges, setSimCharges] = useState(10)
  const [objectif, setObjectif] = useState(50000)
  const [soldeActuel, setSoldeActuel] = useState(3267)

  // ── Pipeline / Prévisionnel ──
  const [pipeline, setPipeline] = useState([])
  const [loadingPipe, setLoadingPipe] = useState(true)
  const [newPipe, setNewPipe] = useState({ client: '', amount_ttc: '', expected_month: '', type: 'previsionnel', trainer: 'Hicham', description: '' })
  const [showPipeForm, setShowPipeForm] = useState(false)

  // Charger le pipeline
  useEffect(() => {
    loadPipeline()
  }, [])

  async function loadPipeline() {
    setLoadingPipe(true)
    const { data, error } = await supabase
      .from('budget_pipeline')
      .select('*')
      .not('status', 'eq', 'annule')
      .order('expected_month', { ascending: true })
    if (!error && data) setPipeline(data)
    setLoadingPipe(false)
  }

  async function addPipeEntry() {
    if (!newPipe.client || !newPipe.amount_ttc || !newPipe.expected_month) {
      toast.error('Client, montant et mois requis')
      return
    }
    const ht = parseFloat(newPipe.amount_ttc) / 1.2
    const { error } = await supabase.from('budget_pipeline').insert({
      client: newPipe.client.toUpperCase(),
      description: newPipe.description,
      amount_ht: Math.round(ht * 100) / 100,
      amount_ttc: parseFloat(newPipe.amount_ttc),
      expected_month: newPipe.expected_month,
      type: newPipe.type,
      status: 'prevu',
      trainer: newPipe.trainer,
    })
    if (error) { toast.error('Erreur: ' + error.message); return }
    toast.success('✅ Ajouté au prévisionnel')
    setNewPipe({ client: '', amount_ttc: '', expected_month: '', type: 'previsionnel', trainer: 'Hicham', description: '' })
    setShowPipeForm(false)
    loadPipeline()
  }

  async function updatePipeStatus(id, newStatus) {
    await supabase.from('budget_pipeline').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    toast.success('Statut mis à jour')
    loadPipeline()
  }

  async function deletePipe(id) {
    if (!confirm('Supprimer cette entrée ?')) return
    await supabase.from('budget_pipeline').delete().eq('id', id)
    toast.success('Supprimé')
    loadPipeline()
  }

  // ── Données calculées ──
  const data = useMemo(() => {
    const co = transactions.filter(tx => !tx.is_personal)
    const catMap = {}
    categories.forEach(c => { catMap[c.name] = { type: c.type, direction: c.direction, icon: c.icon } })

    const byMonth = {}
    co.forEach(tx => {
      const m = tx.month
      if (!m) return
      if (!byMonth[m]) byMonth[m] = { debit: 0, credit: 0, caFormation: 0, caSousTrait: 0, cats: {} }
      byMonth[m].debit += tx.debit || 0
      byMonth[m].credit += tx.credit || 0
      if (tx.category_name === 'CA Formations') byMonth[m].caFormation += tx.credit || 0
      if (tx.category_name === 'CA Sous-traitance') byMonth[m].caSousTrait += tx.credit || 0
      const c = tx.category_name || 'Non classé'
      if (!byMonth[m].cats[c]) byMonth[m].cats[c] = { debit: 0, credit: 0 }
      byMonth[m].cats[c].debit += tx.debit || 0
      byMonth[m].cats[c].credit += tx.credit || 0
    })

    const months = Object.keys(byMonth).sort()
    const nbMonths = months.length || 1

    let totalCA = 0
    const caByMonth = {}
    months.forEach(m => {
      let ca = 0
      Object.entries(byMonth[m].cats).forEach(([cat, vals]) => {
        const info = catMap[cat] || {}
        if (info.direction === 'recette' && info.type !== 'exceptionnel') {
          ca += vals.credit
        }
      })
      caByMonth[m] = ca
      totalCA += ca
    })

    const activeMonths = months.filter(m => caByMonth[m] > 100)
    const nbActive = activeMonths.length || 1
    const avgCA = totalCA / nbActive

    const last4 = activeMonths.slice(-4)
    const avgCALast4 = last4.reduce((s, m) => s + caByMonth[m], 0) / (last4.length || 1)

    const chargesByCat = {}
    let totalFixed = 0, totalVariable = 0
    months.forEach(m => {
      Object.entries(byMonth[m].cats).forEach(([cat, vals]) => {
        const info = catMap[cat] || { type: 'variable', direction: 'depense' }
        if (info.direction !== 'depense' || info.type === 'exceptionnel') return
        if (!chargesByCat[cat]) chargesByCat[cat] = { total: 0, count: 0, type: info.type, icon: info.icon || '📦' }
        chargesByCat[cat].total += vals.debit
        chargesByCat[cat].count++
        if (info.type === 'fixe') totalFixed += vals.debit
        else totalVariable += vals.debit
      })
    })

    const avgFixed = totalFixed / nbMonths
    const avgVariable = totalVariable / nbMonths
    const avgTotal = avgFixed + avgVariable
    const netMensuel = avgCA - avgTotal

    const caByClient = {}
    co.forEach(tx => {
      if (tx.credit > 0) {
        const info = catMap[tx.category_name] || {}
        if (info.direction === 'recette' && info.type !== 'exceptionnel') {
          const desc = tx.description || 'Inconnu'
          let client = desc.replace(/^VIR (INST |SEPA )?/i, '').replace(/^\d+\s*/, '').substring(0, 40).trim()
          if (client.toUpperCase().includes('PILOCAP')) client = 'PIL O CAP AQUITAINE'
          else if (client.toUpperCase().includes('AFPI') || client.toUpperCase().includes('UIMM')) client = 'AFPI / UIMM'
          else if (client.toUpperCase().includes('EIFFAGE')) client = 'EIFFAGE'
          else if (client.toUpperCase().includes('SOFIS')) client = 'SOFIS'
          else if (client.toUpperCase().includes('KFORMATION') || client.toUpperCase().includes('K FORMATION')) client = 'KFORMATION'
          else if (client.toUpperCase().includes('OPCO')) client = 'OPCO2i'
          else if (client.toUpperCase().includes('SOCOTEC')) client = 'SOCOTEC'
          else if (client.toUpperCase().includes('CAPIC')) client = 'CAPIC'
          else if (client.toUpperCase().includes('ARMONIS')) client = 'ARMONIS'
          else if (client.toUpperCase().includes('SMV')) client = 'SMV FORMATION'
          else if (client.toUpperCase().includes('TRIANGLE')) client = 'TRIANGLE 210'
          else if (client.toUpperCase().includes('VOLEFI')) client = 'VOLEFI'
          else if (client.toUpperCase().includes('FORMASECO')) client = 'FORMASECO'
          else if (client.toUpperCase().includes('FORMALYON')) client = 'FORMALYON'
          else if (client.toUpperCase().includes('ISRPP')) client = 'ISRPP'
          else if (client.toUpperCase().includes('COURTAGE')) return
          else if (client.toUpperCase().includes('TRESOVIV')) return
          else if (client.toUpperCase().includes('SIE QUIMPERLE')) return
          else if (client.toUpperCase().includes('AXA FRANCE')) return
          else if (client.toUpperCase().includes('SWISSLIFE')) return
          else if (client.toUpperCase().includes('GOOGLE')) return
          else if (client.toUpperCase().includes('BOUYGUES')) return
          if (!caByClient[client]) caByClient[client] = { total: 0, count: 0 }
          caByClient[client].total += tx.credit
          caByClient[client].count++
        }
      }
    })

    const clients = Object.entries(caByClient)
      .map(([name, v]) => {
        const sousTraitKw = ['PILOCAP', 'PIL O CAP', 'ISRPP', 'SOFIS', 'FORMALYON', 'KFORMATION', 'SMV', 'SOCOTEC', 'FORMASECO']
        const isSousTrait = sousTraitKw.some(k => name.toUpperCase().includes(k))
        return { name, total: v.total, count: v.count, pct: totalCA > 0 ? (v.total / totalCA * 100) : 0, isSousTrait }
      })
      .sort((a, b) => b.total - a.total)

    const topClientPct = clients[0]?.pct || 0
    const caSousTraitance = clients.filter(c => c.isSousTrait).reduce((s, c) => s + c.total, 0)
    const caDirect = totalCA - caSousTraitance

    // Optimisations
    const chargesList = Object.entries(chargesByCat)
      .map(([n, v]) => ({ name: n, avg: v.total / nbMonths, total: v.total, type: v.type, icon: v.icon }))
      .sort((a, b) => b.avg - a.avg)

    const targets = {
      'Matériel bureau/formation': { target: 200, reason: 'Investissements démarrage terminés, régime de croisière' },
      'Restauration pro': { target: 150, reason: 'Plafond 25€/repas, max 6 repas/mois' },
      'Télécoms': { target: 60, reason: 'Vérifier forfait Orange, comparer alternatives pro' },
      'Logiciels & SaaS': { target: 200, reason: 'Audit abonnements : supprimer inutilisés, downgrader' },
      'Frais bancaires': { target: 20, reason: 'Négocier CMB ou migrer Qonto/Shine' },
    }
    const optimisations = chargesList
      .filter(c => targets[c.name] && c.avg > targets[c.name].target)
      .map(c => ({ ...c, target: targets[c.name].target, saving: c.avg - targets[c.name].target, reason: targets[c.name].reason }))
    const totalSavings = optimisations.reduce((s, o) => s + o.saving, 0)

    // Score de santé
    const runwayMonths = avgTotal > 0 ? soldeActuel / avgTotal : 12
    const scoreTreso = Math.min(25, runwayMonths * 6)
    const trendPct = avgCA > 0 ? ((avgCALast4 - avgCA) / avgCA * 100) : 0
    const scoreTrend = Math.min(25, Math.max(0, 12.5 + trendPct * 0.5))
    const scoreRatio = avgTotal > 0 ? Math.min(25, (avgCA / avgTotal) * 25) : 0
    const scoreDiversif = Math.min(25, 25 - topClientPct * 0.5)
    const score = Math.round(scoreTreso + scoreTrend + scoreRatio + scoreDiversif)

    let scoreLabel, scoreColor, scoreBg
    if (score >= 75) { scoreLabel = 'Solide'; scoreColor = 'text-emerald-700'; scoreBg = 'bg-emerald-500' }
    else if (score >= 55) { scoreLabel = 'Correct — axes d\'amélioration'; scoreColor = 'text-amber-700'; scoreBg = 'bg-amber-500' }
    else if (score >= 35) { scoreLabel = 'Attention — actions requises'; scoreColor = 'text-orange-700'; scoreBg = 'bg-orange-500' }
    else { scoreLabel = 'Critique — agir vite'; scoreColor = 'text-red-700'; scoreBg = 'bg-red-500' }

    const caEvolution = months.map(m => ({
      month: m,
      formation: byMonth[m].caFormation,
      sousTrait: byMonth[m].caSousTrait,
      total: caByMonth[m]
    }))

    return {
      months, nbMonths, nbActive, activeMonths,
      avgCA, avgCALast4, totalCA, caByMonth, caEvolution,
      chargesByCat, chargesList, avgFixed, avgVariable, avgTotal, netMensuel,
      totalFixed, totalVariable,
      clients, topClientPct, caSousTraitance, caDirect,
      optimisations, totalSavings,
      score, scoreLabel, scoreColor, scoreBg,
      runwayMonths, trendPct,
    }
  }, [transactions, categories, soldeActuel])

  // ── Prévisionnel mois en cours ──
  const currentMonth = useMemo(() => {
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
    const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`

    // CA réalisé ce mois (from transactions)
    const caRealise = data.caByMonth[monthKey] || 0

    // CA prévu (from pipeline entries for this month, not yet encaissé)
    const pipeThisMonth = pipeline.filter(p => p.expected_month === monthKey && p.status !== 'encaisse' && p.status !== 'annule')
    const caPrevu = pipeThisMonth.reduce((s, p) => s + (p.amount_ttc || 0), 0)

    // CA projeté = réalisé + prévu
    const caProjecte = caRealise + caPrevu

    // Objectif mensuel pour atteindre 50k fin 2026
    const remainingMonths = Math.max(1, 12 - now.getMonth())
    const netNeeded = (objectif - soldeActuel) / remainingMonths
    const caCibleMois = netNeeded + data.avgTotal // besoin net + charges moyennes
    const progressPct = caCibleMois > 0 ? Math.min(100, (caProjecte / caCibleMois) * 100) : 0

    // Charges réalisées ce mois
    const chargesRealise = data.months.includes(monthKey)
      ? Object.values(data.chargesByCat).reduce((s, c) => s, 0)
      : 0

    return {
      monthKey, monthLabel, caRealise, caPrevu, caProjecte, pipeThisMonth,
      caCibleMois, progressPct, remainingMonths, netNeeded,
    }
  }, [data, pipeline, objectif, soldeActuel])

  // ── Alertes trésorerie ──
  const alerts = useMemo(() => {
    const list = []
    // Alerte runway
    if (data.runwayMonths < 1.5) {
      list.push({ level: 'critical', icon: '🚨', title: 'Trésorerie critique', text: `Runway : ${data.runwayMonths.toFixed(1)} mois. Risque de cessation de paiement.`, color: 'bg-red-50 border-red-300 text-red-800' })
    } else if (data.runwayMonths < 3) {
      list.push({ level: 'warning', icon: '⚠️', title: 'Trésorerie tendue', text: `Runway : ${data.runwayMonths.toFixed(1)} mois de charges. Objectif : > 3 mois.`, color: 'bg-amber-50 border-amber-300 text-amber-800' })
    }
    // Alerte tendance baissière
    if (data.trendPct < -15) {
      list.push({ level: 'warning', icon: '📉', title: 'CA en baisse', text: `Tendance -${Math.abs(data.trendPct).toFixed(0)}% sur les 4 derniers mois vs moyenne.`, color: 'bg-orange-50 border-orange-300 text-orange-800' })
    }
    // Alerte concentration
    if (data.topClientPct > 30) {
      list.push({ level: 'warning', icon: '🎯', title: 'Dépendance client', text: `${data.clients[0]?.name} = ${data.topClientPct.toFixed(0)}% du CA. Cible : < 25%.`, color: 'bg-purple-50 border-purple-300 text-purple-800' })
    }
    // Alerte factures prévues non encaissées
    const overdueCount = pipeline.filter(p => p.status === 'prevu' && p.expected_month < currentMonth.monthKey).length
    if (overdueCount > 0) {
      list.push({ level: 'warning', icon: '📋', title: `${overdueCount} facture(s) prévue(s) en retard`, text: 'Des entrées du pipeline sont passées sans encaissement.', color: 'bg-blue-50 border-blue-300 text-blue-800' })
    }
    return list
  }, [data, pipeline, currentMonth])

  // ── Simulateur ──
  const sim = useMemo(() => {
    const caBoost = data.avgCA * (1 + simCA / 100)
    const chargesReduced = data.avgTotal * (1 - simCharges / 100)
    const netSim = caBoost - chargesReduced
    const remainingMonths = currentMonth.remainingMonths
    const projFin = soldeActuel + netSim * remainingMonths
    const atteint = projFin >= objectif
    return { caBoost, chargesReduced, netSim, remainingMonths, projFin, atteint }
  }, [data, simCA, simCharges, objectif, soldeActuel, currentMonth])

  // ── Trajectoire mois par mois ──
  const trajectory = useMemo(() => {
    const months = []
    const now = new Date()
    let cumul = soldeActuel
    for (let i = now.getMonth(); i < 12; i++) {
      const mKey = `2026-${String(i + 1).padStart(2, '0')}`
      const monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
      const pipeMois = pipeline.filter(p => p.expected_month === mKey && p.status !== 'annule')
      const caPipe = pipeMois.reduce((s, p) => s + (p.amount_ttc || 0), 0)
      const caEstime = Math.max(caPipe, sim.caBoost) // prend le max entre pipeline et estimation
      cumul += caEstime - sim.chargesReduced
      months.push({ month: mKey, label: monthNames[i], cumul, caPipe, caEstime })
    }
    return months
  }, [sim, pipeline, soldeActuel])

  const barMax = Math.max(...data.clients.map(c => c.total), 1)

  // ── Mois disponibles pour le formulaire pipeline ──
  const availableMonths = useMemo(() => {
    const now = new Date()
    const result = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
      result.push({ key, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` })
    }
    return result
  }, [])

  // ── Pipeline regroupé par mois (pour section pipeline) ──
  const pipelineByMonth = useMemo(() => {
    const grouped = {}
    pipeline.filter(p => p.status !== 'annule').forEach(p => {
      if (!grouped[p.expected_month]) grouped[p.expected_month] = []
      grouped[p.expected_month].push(p)
    })
    return grouped
  }, [pipeline])

  const statusStyles = {
    prevu: { label: '📋 Prévu', bg: 'bg-blue-100 text-blue-700' },
    facture: { label: '📄 Facturé', bg: 'bg-amber-100 text-amber-700' },
    encaisse: { label: '✅ Encaissé', bg: 'bg-emerald-100 text-emerald-700' },
    annule: { label: '❌ Annulé', bg: 'bg-red-100 text-red-700' },
  }

  return (
    <div className="space-y-4">

      {/* ═══════ ALERTES TRÉSORERIE ═══════ */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${a.color}`}>
              <span className="text-xl">{a.icon}</span>
              <div>
                <span className="font-semibold">{a.title}</span>
                <span className="ml-2 text-sm opacity-80">{a.text}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ SECTION 0 : PRÉVISIONNEL MOIS EN COURS ═══════ */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl p-5 text-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">📅 {currentMonth.monthLabel} — Prévisionnel</h3>
          <button
            onClick={() => setShowPipeForm(!showPipeForm)}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
          >
            {showPipeForm ? '✕ Fermer' : '+ Ajouter'}
          </button>
        </div>

        {/* KPIs du mois */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs text-blue-200">CA réalisé</div>
            <div className="text-lg font-bold text-blue-100">{fmt(currentMonth.caRealise)}</div>
            <div className="text-xs text-blue-300">encaissé</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs text-amber-200">CA prévu</div>
            <div className="text-lg font-bold text-amber-100">{fmt(currentMonth.caPrevu)}</div>
            <div className="text-xs text-amber-300">{currentMonth.pipeThisMonth.length} entrée(s)</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 border border-white/20">
            <div className="text-xs text-emerald-200">CA projeté</div>
            <div className="text-xl font-bold text-emerald-100">{fmt(currentMonth.caProjecte)}</div>
            <div className="text-xs text-emerald-300">réalisé + prévu</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs text-gray-300">Objectif mensuel</div>
            <div className="text-lg font-bold">{fmt(currentMonth.caCibleMois)}</div>
            <div className="text-xs text-gray-400">pour atteindre {fmt(objectif)}</div>
          </div>
        </div>

        {/* Barre de progression vers objectif mensuel */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-blue-200 mb-1">
            <span>Progression vers objectif mensuel</span>
            <span>{currentMonth.progressPct.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${currentMonth.progressPct >= 100 ? 'bg-emerald-400' : currentMonth.progressPct >= 60 ? 'bg-blue-400' : 'bg-amber-400'}`}
              style={{ width: `${Math.min(100, currentMonth.progressPct)}%` }}
            />
          </div>
        </div>

        {/* Liste des entrées pipeline du mois */}
        {currentMonth.pipeThisMonth.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {currentMonth.pipeThisMonth.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <select
                    value={p.status}
                    onChange={e => updatePipeStatus(p.id, e.target.value)}
                    className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-xs"
                  >
                    <option value="prevu">📋 Prévu</option>
                    <option value="facture">📄 Facturé</option>
                    <option value="encaisse">✅ Encaissé</option>
                    <option value="annule">❌ Annulé</option>
                  </select>
                  <span className="font-medium">{p.client}</span>
                  {p.trainer && <span className="text-xs text-blue-300">({p.trainer})</span>}
                  {p.description && <span className="text-xs text-gray-400">— {p.description}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{fmt(p.amount_ttc)}</span>
                  <button onClick={() => deletePipe(p.id)} className="text-red-300 hover:text-red-100 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Formulaire ajout rapide */}
        {showPipeForm && (
          <div className="mt-3 bg-white/10 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input
                value={newPipe.client}
                onChange={e => setNewPipe({ ...newPipe, client: e.target.value })}
                placeholder="Client"
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm placeholder-gray-400"
              />
              <input
                type="number"
                value={newPipe.amount_ttc}
                onChange={e => setNewPipe({ ...newPipe, amount_ttc: e.target.value })}
                placeholder="Montant TTC"
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm placeholder-gray-400"
              />
              <select
                value={newPipe.expected_month}
                onChange={e => setNewPipe({ ...newPipe, expected_month: e.target.value })}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Mois</option>
                {availableMonths.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <select
                value={newPipe.trainer}
                onChange={e => setNewPipe({ ...newPipe, trainer: e.target.value })}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
              >
                <option value="Hicham">Hicham</option>
                <option value="Maxime">Maxime</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                value={newPipe.description}
                onChange={e => setNewPipe({ ...newPipe, description: e.target.value })}
                placeholder="Description (optionnel)"
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm placeholder-gray-400"
              />
              <select
                value={newPipe.type}
                onChange={e => setNewPipe({ ...newPipe, type: e.target.value })}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
              >
                <option value="previsionnel">Prévisionnel</option>
                <option value="devis_signe">Devis signé</option>
                <option value="facture_emise">Facture émise</option>
              </select>
              <button onClick={addPipeEntry} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium transition">
                Ajouter
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ SECTION 1 : SCORE DE SANTÉ ═══════ */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-5 text-white">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold">🎯 Score de santé financière</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${data.scoreBg} text-white`}>{data.scoreLabel}</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28 flex-shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={data.score >= 70 ? '#34d399' : data.score >= 45 ? '#fbbf24' : '#ef4444'} strokeWidth="10" strokeDasharray={`${data.score * 3.27} 327`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{data.score}</span>
              <span className="text-xs text-gray-400">/100</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1">
            <div className="bg-white/10 rounded-lg p-2.5">
              <div className="text-xs text-gray-400">CA moyen/mois</div>
              <div className="text-sm font-bold text-emerald-300">{fmt(data.avgCA)}</div>
              <div className="text-xs text-gray-500">{data.nbActive} mois actifs</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5">
              <div className="text-xs text-gray-400">Tendance (4 derniers)</div>
              <div className="text-sm font-bold text-amber-300">{fmt(data.avgCALast4)}</div>
              <div className="text-xs">{data.trendPct >= 0 ? '📈' : '📉'} {data.trendPct.toFixed(0)}% vs moyenne</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5">
              <div className="text-xs text-gray-400">Charges/mois</div>
              <div className="text-sm font-bold text-red-300">{fmt(data.avgTotal)}</div>
              <div className="text-xs text-gray-500">{fmt(data.avgFixed)} fixes + {fmt(data.avgVariable)} var.</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5">
              <div className="text-xs text-gray-400">Net mensuel</div>
              <div className={`text-sm font-bold ${data.netMensuel >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmt(data.netMensuel)}</div>
              <div className="text-xs">{data.netMensuel >= 0 ? '✅ Rentable' : '❌ Déficitaire'}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5">
              <div className="text-xs text-gray-400">Runway</div>
              <div className={`text-sm font-bold ${data.runwayMonths >= 3 ? 'text-emerald-300' : data.runwayMonths >= 1.5 ? 'text-amber-300' : 'text-red-300'}`}>{data.runwayMonths.toFixed(1)} mois</div>
              <div className="text-xs text-gray-500">de charges couvertes</div>
            </div>
          </div>
        </div>

        {/* Barre objectif 50k */}
        <div className="mt-3 flex justify-between text-xs text-gray-400">
          <span>Solde actuel : {fmt(soldeActuel)}</span>
          <span>Objectif : {fmt(objectif)}</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2.5 mt-1">
          <div className="h-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.min(100, soldeActuel / objectif * 100)}%` }} />
        </div>
        <div className="text-right text-xs text-gray-500 mt-1">Gap : {fmt(objectif - soldeActuel)}</div>
      </div>

      {/* ═══════ SECTION 2 : TRAJECTOIRE 50K ═══════ */}
      <div className="bg-white border rounded-xl p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-800">📈 Trajectoire fin 2026</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${sim.atteint ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            Projection : {fmt(sim.projFin)} {sim.atteint ? '✅' : '❌'}
          </span>
        </div>
        <div className="space-y-1.5">
          {trajectory.map((m, i) => {
            const pct = Math.min(100, Math.max(0, (m.cumul / objectif) * 100))
            const isCurrentMonth = m.month === currentMonth.monthKey
            return (
              <div key={m.month} className={`flex items-center gap-2 text-sm ${isCurrentMonth ? 'font-bold' : ''}`}>
                <span className="w-10 text-gray-500">{m.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                  <div
                    className={`h-4 rounded-full transition-all ${m.cumul >= objectif ? 'bg-emerald-400' : m.cumul >= 0 ? 'bg-blue-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                  {isCurrentMonth && <div className="absolute inset-y-0 left-0 w-full flex items-center justify-center text-[10px] text-gray-600 font-medium">← vous êtes ici</div>}
                </div>
                <span className={`w-24 text-right tabular-nums text-xs ${m.cumul >= 0 ? 'text-gray-600' : 'text-red-600'}`}>{fmt(m.cumul)}</span>
                {m.caPipe > 0 && <span className="text-[10px] text-blue-500">+{fmt(m.caPipe)} pipe</span>}
              </div>
            )
          })}
          <div className="flex items-center gap-2 text-sm border-t pt-1 mt-1">
            <span className="w-10 text-gray-400">🎯</span>
            <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
              <div className="h-4 rounded-full bg-emerald-200" style={{ width: '100%' }} />
            </div>
            <span className="w-24 text-right text-xs font-bold text-emerald-600">{fmt(objectif)}</span>
          </div>
        </div>
      </div>

      {/* ═══════ SECTION 3 : OPTIMISATION DES CHARGES ═══════ */}
      <div className="bg-white border rounded-xl p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-800">📉 Optimisation des charges</h3>
          <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-sm font-medium">Économie potentielle : {fmt(data.totalSavings)}/mois</span>
        </div>
        <div className="space-y-3">
          {data.optimisations.map((o, i) => (
            <div key={i} className="border rounded-lg p-3">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <span className="text-lg mr-2">{o.icon}</span>
                  <span className="font-semibold text-gray-800">{o.name}</span>
                  <div className="text-xs text-gray-500 ml-7">{o.reason}</div>
                </div>
                <div className="text-right">
                  <div className="text-red-600 font-bold">-{fmt(o.saving)}/mois</div>
                  <div className="text-xs text-gray-500">-{((o.saving / o.avg) * 100).toFixed(0)}%</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-600 w-16">{fmt(o.avg)}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 relative">
                  <div className="h-3 rounded-full bg-emerald-400" style={{ width: `${(o.target / o.avg) * 100}%` }} />
                  <div className="h-3 rounded-full bg-red-200 absolute top-0 right-0" style={{ width: `${((o.avg - o.target) / o.avg) * 100}%` }} />
                </div>
                <span className="text-xs text-emerald-600 w-16 text-right">{fmt(o.target)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5 px-16">
                <span>Actuel</span>
                <span>→ Cible</span>
              </div>
            </div>
          ))}
        </div>
        {data.totalSavings > 0 && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center">
            <div>
              <span className="font-semibold text-emerald-800">💰 Impact total des optimisations</span>
              <div className="text-sm text-emerald-600">{fmt(data.totalSavings)}/mois = {fmt(data.totalSavings * 12)}/an</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Net après optimisation</div>
              <div className="text-lg font-bold text-emerald-700">{fmt(data.netMensuel + data.totalSavings)}/mois</div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ SECTION 4 : CONCENTRATION CLIENT ═══════ */}
      <div className="bg-white border rounded-xl p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-800">🏢 Répartition clients</h3>
          <div className="flex gap-2">
            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium">
              Direct : {data.totalCA > 0 ? ((data.caDirect / data.totalCA) * 100).toFixed(0) : 0}%
            </span>
            <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full text-xs font-medium">
              Sous-traitance : {data.totalCA > 0 ? ((data.caSousTraitance / data.totalCA) * 100).toFixed(0) : 0}%
            </span>
          </div>
        </div>

        {data.topClientPct > 25 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <span className="font-semibold text-amber-800">Risque de concentration</span>
                <p className="text-sm text-amber-700">{data.clients[0]?.name} représente {data.topClientPct.toFixed(0)}% du CA. Si ce client est perdu, c'est {fmt(data.clients[0]?.total / data.nbActive)} €/mois en moins. Objectif : aucun client au-dessus de 25%.</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {data.clients.slice(0, 15).map((c, i) => {
            const w = (c.total / barMax) * 100
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-40 text-right text-gray-600 truncate">{c.name}</span>
                <div className="flex-1 bg-gray-100 rounded h-5 relative">
                  <div
                    className={`h-5 rounded ${c.pct > 25 ? 'bg-purple-500' : c.isSousTrait ? 'bg-purple-300' : 'bg-blue-400'}`}
                    style={{ width: `${w}%` }}
                  >
                    {c.total > 2000 && <span className="absolute left-2 text-xs text-white font-medium leading-5">{fmt(c.total)}</span>}
                  </div>
                </div>
                <span className="w-10 text-right text-xs text-gray-500">{c.pct.toFixed(0)}%</span>
                <span className="text-xs">{c.isSousTrait ? '🤝' : '🏢'}</span>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs text-blue-600">🏢 CA Direct (marge pleine)</div>
            <div className="text-lg font-bold text-blue-800">{fmt(data.caDirect)}</div>
            <div className="text-xs text-blue-500">{data.totalCA > 0 ? ((data.caDirect / data.totalCA) * 100).toFixed(0) : 0}% — Objectif : 70%</div>
            <div className="w-full bg-blue-100 rounded-full h-2 mt-1">
              <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(100, (data.caDirect / data.totalCA) * 100 / 70 * 100)}%` }} />
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="text-xs text-purple-600">🤝 CA Sous-traitance (marge réduite)</div>
            <div className="text-lg font-bold text-purple-800">{fmt(data.caSousTraitance)}</div>
            <div className="text-xs text-purple-500">{data.totalCA > 0 ? ((data.caSousTraitance / data.totalCA) * 100).toFixed(0) : 0}% — Objectif : {'<'}30%</div>
            <div className="w-full bg-purple-100 rounded-full h-2 mt-1">
              <div className="h-2 rounded-full bg-purple-500" style={{ width: `${Math.min(100, (data.caSousTraitance / data.totalCA) * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ SECTION 5 : ÉVOLUTION CA ═══════ */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-800 mb-3">📊 Évolution CA mensuel</h3>
        <div className="space-y-1.5">
          {data.caEvolution.map((m, i) => {
            const maxCA = Math.max(...data.caEvolution.map(e => e.total), 1)
            const wForm = (m.formation / maxCA) * 100
            const wSous = (m.sousTrait / maxCA) * 100
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-16 text-gray-500 text-xs">{m.month}</span>
                <div className="flex-1 bg-gray-50 rounded h-5 flex">
                  {m.formation > 0 && <div className="h-5 rounded-l bg-blue-500" style={{ width: `${wForm}%` }} />}
                  {m.sousTrait > 0 && <div className={`h-5 ${m.formation > 0 ? '' : 'rounded-l'} rounded-r bg-purple-400`} style={{ width: `${wSous}%` }} />}
                </div>
                <span className="w-24 text-right tabular-nums text-xs font-medium text-gray-600">{m.total > 0 ? fmt(m.total) : '–'}</span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-2 justify-center text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> CA Formations</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-400" /> Sous-traitance</span>
        </div>
      </div>

      {/* ═══════ SECTION 6 : SIMULATEUR ═══════ */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-800 mb-3">🎮 Simulateur objectif {fmt(objectif)}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">🚀 Boost CA (effet Qualiopi + prospection)</span>
              <span className="text-emerald-700 font-bold">+{simCA}%</span>
            </div>
            <input type="range" min="0" max="80" value={simCA} onChange={e => setSimCA(+e.target.value)} className="w-full accent-emerald-500" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0% (statu quo)</span>
              <span>+20% (Qualiopi modéré)</span>
              <span>+80%</span>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">📉 Réduction charges</span>
              <span className="text-red-600 font-bold">-{simCharges}%</span>
            </div>
            <input type="range" min="0" max="30" value={simCharges} onChange={e => setSimCharges(+e.target.value)} className="w-full accent-blue-500" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0%</span>
              <span>-10% (optimisations)</span>
              <span>-30%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="border rounded-lg p-2.5">
            <div className="text-xs text-gray-500">Solde actuel (€)</div>
            <input type="number" value={soldeActuel} onChange={e => setSoldeActuel(+e.target.value)} className="w-full text-lg font-bold border-none p-0 focus:ring-0" />
          </div>
          <div className="border rounded-lg p-2.5">
            <div className="text-xs text-gray-500">Objectif fin 2026 (€)</div>
            <input type="number" value={objectif} onChange={e => setObjectif(+e.target.value)} className="w-full text-lg font-bold border-none p-0 focus:ring-0" />
          </div>
          <div className="border rounded-lg p-2.5">
            <div className="text-xs text-gray-500">Mois restants 2026</div>
            <div className="text-2xl font-bold text-blue-700">{sim.remainingMonths}</div>
          </div>
        </div>

        <div className={`rounded-xl p-4 text-white ${sim.atteint ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-red-600 to-rose-600'}`}>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <div className="text-xs opacity-80">CA simulé/mois</div>
              <div className="text-lg font-bold">{fmt(sim.caBoost)}</div>
              <div className="text-xs opacity-60">vs {fmt(data.avgCA)} actuel</div>
            </div>
            <div>
              <div className="text-xs opacity-80">Charges simulées/mois</div>
              <div className="text-lg font-bold">{fmt(sim.chargesReduced)}</div>
              <div className="text-xs opacity-60">vs {fmt(data.avgTotal)} actuel</div>
            </div>
            <div>
              <div className="text-xs opacity-80">Net simulé/mois</div>
              <div className="text-lg font-bold">{fmt(sim.netSim)}</div>
            </div>
            <div>
              <div className="text-xs opacity-80">Projection fin 2026</div>
              <div className="text-xl font-bold">{fmt(sim.projFin)}</div>
            </div>
          </div>
          {sim.atteint ? (
            <div className="text-center text-sm">✅ Objectif {fmt(objectif)} atteint ! Surplus : {fmt(sim.projFin - objectif)}</div>
          ) : (
            <div className="flex justify-between text-sm">
              <span>🎯 Manque {fmt(objectif - sim.projFin)}</span>
              <span>Besoin : {fmt((objectif - soldeActuel) / sim.remainingMonths)} net/mois</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ SECTION 7 : PIPELINE COMPLET ═══════ */}
      <div className="bg-white border rounded-xl p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-800">📋 Pipeline & Devis validés</h3>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-500">
              Total : {fmt(pipeline.filter(p => p.status !== 'encaisse' && p.status !== 'annule').reduce((s, p) => s + (p.amount_ttc || 0), 0))}
            </span>
            <button
              onClick={() => setShowPipeForm(!showPipeForm)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
            >
              + Ajouter
            </button>
          </div>
        </div>

        {Object.keys(pipelineByMonth).length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <p className="text-lg mb-1">📭 Aucune entrée dans le pipeline</p>
            <p className="text-sm">Ajoutez vos devis validés et factures prévues pour améliorer la visibilité</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(pipelineByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, entries]) => {
              const monthTotal = entries.reduce((s, p) => s + (p.amount_ttc || 0), 0)
              const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
              const [y, m] = month.split('-')
              const label = `${monthNames[parseInt(m) - 1]} ${y}`
              const isCurrentMonth = month === currentMonth.monthKey

              return (
                <div key={month} className={`border rounded-lg overflow-hidden ${isCurrentMonth ? 'border-blue-300 bg-blue-50/30' : ''}`}>
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50">
                    <span className="font-medium text-gray-700">{label} {isCurrentMonth && <span className="text-xs text-blue-600 ml-1">← en cours</span>}</span>
                    <span className="font-bold text-gray-800">{fmt(monthTotal)}</span>
                  </div>
                  <div className="divide-y">
                    {entries.map(p => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <select
                            value={p.status}
                            onChange={e => updatePipeStatus(p.id, e.target.value)}
                            className={`text-xs rounded px-1.5 py-0.5 border-0 font-medium ${statusStyles[p.status]?.bg || 'bg-gray-100'}`}
                          >
                            <option value="prevu">📋 Prévu</option>
                            <option value="facture">📄 Facturé</option>
                            <option value="encaisse">✅ Encaissé</option>
                            <option value="annule">❌ Annulé</option>
                          </select>
                          <span className="font-medium text-gray-700">{p.client}</span>
                          {p.trainer && <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{p.trainer}</span>}
                          {p.description && <span className="text-xs text-gray-400">— {p.description}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">{fmt(p.amount_ttc)}</span>
                          <button onClick={() => deletePipe(p.id)} className="text-gray-300 hover:text-red-500 transition">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══════ SECTION 8 : TABLEAU DÉTAILLÉ CHARGES ═══════ */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-800 mb-3">📋 Détail complet des charges par catégorie</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b text-xs uppercase tracking-wider">
              <th className="pb-2">Catégorie</th>
              <th className="pb-2 text-center">Type</th>
              <th className="pb-2 text-right">Total</th>
              <th className="pb-2 text-right">Moy./mois</th>
              <th className="pb-2 text-right">% charges</th>
              <th className="pb-2 text-right">Nb tx</th>
            </tr>
          </thead>
          <tbody>
            {(data.chargesList || []).map((c, i) => {
              const pct = data.avgTotal > 0 ? (c.avg / data.avgTotal * 100) : 0
              return (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2">
                    <span className="mr-1.5">{c.icon}</span>
                    {c.name}
                  </td>
                  <td className="text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${c.type === 'fixe' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{c.type}</span>
                  </td>
                  <td className="text-right tabular-nums">{fmt(c.total)}</td>
                  <td className="text-right tabular-nums font-medium">{fmt(c.avg)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-12 bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.min(100, pct * 2)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="text-right text-gray-500">{c.count || '–'}</td>
                </tr>
              )
            })}
            <tr className="font-bold border-t-2">
              <td className="py-2">TOTAL</td>
              <td></td>
              <td className="text-right tabular-nums">{fmt(data.totalFixed + data.totalVariable)}</td>
              <td className="text-right tabular-nums">{fmt(data.avgTotal)}</td>
              <td className="text-right">100%</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ═══════ SECTION 9 : PLAN D'ACTION ═══════ */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-800 mb-4">🗓️ Plan d'action recommandé</h3>
        <div className="space-y-3">
          {[
            { period: 'CETTE SEMAINE', color: 'bg-red-500', title: 'Relancer les factures en retard/échéance', sub: 'Prioriser OPCO2i (en retard), ISRPP, SOFIS, EIFFAGE', impact: 'Récupérer ~8 000€ de trésorerie' },
            { period: 'CE MOIS', color: 'bg-amber-500', title: 'Audit abonnements SaaS', sub: 'Lister tous les prélèvements récurrents, supprimer les inutilisés', impact: 'Économie ~86€/mois' },
            { period: 'MARS', color: 'bg-yellow-500', title: 'Négocier frais bancaires', sub: 'Comparer Qonto/Shine vs offre actuelle, demander un geste', impact: 'Économie ~50€/mois' },
            { period: 'MARS-AVRIL', color: 'bg-emerald-500', title: 'Prospection directe Qualiopi', sub: 'Marine cible les entreprises directes (pas les OF). Argument : financement OPCO grâce à Qualiopi', impact: `Augmenter la part CA direct de ${data.totalCA > 0 ? ((data.caDirect / data.totalCA) * 100).toFixed(0) : 0}% → 70%` },
            { period: 'AVRIL-MAI', color: 'bg-blue-500', title: 'Développer 2-3 nouveaux clients directs', sub: `Réduire la dépendance Pilocap (${data.topClientPct.toFixed(0)}% → <20%)`, impact: 'Sécuriser le CA + meilleure marge' },
            { period: 'EN CONTINU', color: 'bg-purple-500', title: 'Plafond restauration 25€/repas', sub: 'Privilégier les formules midi, emporter un lunch si possible', impact: 'Économie ~213€/mois' },
          ].map((a, i) => (
            <div key={i} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition">
              <div className={`w-3 h-3 rounded-full ${a.color} mt-1.5 flex-shrink-0`} />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{a.period}</div>
                <div className="font-semibold text-gray-800">{a.title}</div>
                <div className="text-sm text-gray-500">{a.sub}</div>
              </div>
              <span className="text-sm font-medium text-emerald-600 whitespace-nowrap">{a.impact}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
// ════════════════════════════════════════════════════════════
// MODAL INVITÉS REPAS (rétroactif depuis Transactions ou Saisie)
// ════════════════════════════════════════════════════════════
function MealGuestModal({ transactionId, transaction, clients, onClose, onSaved }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mealFor, setMealFor] = useState('hicham')
  const [nbConvives, setNbConvives] = useState(2)
  const [motif, setMotif] = useState('')
  const [guests, setGuests] = useState([])
  const [existing, setExisting] = useState([])
  const [showProspect, setShowProspect] = useState(false)
  const [prospectInit, setProspectInit] = useState({})

  useEffect(() => {
    loadExisting()
  }, [transactionId])

  async function loadExisting() {
    setLoading(true)
    const { data } = await supabase.from('budget_meal_guests').select('*').eq('transaction_id', transactionId)
    if (data && data.length > 0) {
      setExisting(data)
      setMealFor(data[0].meal_for || 'hicham')
      setNbConvives(data[0].nb_convives || 2)
      setMotif(data[0].motif || '')
      setGuests(data.filter(g => g.guest_name).map(g => ({
        id: g.id,
        name: g.guest_name || '',
        company: g.guest_company || '',
        client_id: g.client_id || '',
      })))
    }
    setLoading(false)
  }

  function addGuest() { setGuests(prev => [...prev, { name: '', company: '', client_id: '' }]) }
  function updateGuest(idx, field, value) { setGuests(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g)) }
  function removeGuest(idx) { setGuests(prev => prev.filter((_, i) => i !== idx)) }

  async function handleSave() {
    setSaving(true)
    try {
      // Supprimer les anciens
      await supabase.from('budget_meal_guests').delete().eq('transaction_id', transactionId)

      // Insérer les nouveaux
      const guestRows = guests.filter(g => g.name.trim()).map(g => ({
        transaction_id: transactionId,
        meal_for: mealFor,
        guest_name: g.name.trim(),
        guest_company: g.company.trim() || null,
        guest_first_name: null,
        client_id: g.client_id || null,
        nb_convives: nbConvives,
        motif: motif || null,
      }))

      if (guestRows.length === 0) {
        // Sauvegarder au moins le meal_for + nb_convives
        await supabase.from('budget_meal_guests').insert({
          transaction_id: transactionId,
          meal_for: mealFor,
          nb_convives: nbConvives,
          motif: motif || null,
        })
      } else {
        await supabase.from('budget_meal_guests').insert(guestRows)
      }

      toast.success('🍽️ Registre invités mis à jour')
      onSaved()
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b bg-amber-50 rounded-t-xl">
          <div>
            <h3 className="font-bold text-amber-800">🍽️ Registre repas professionnel</h3>
            {transaction && (
              <p className="text-xs text-amber-600 mt-0.5">
                {new Date(transaction.date).toLocaleDateString('fr-FR')} — {transaction.description?.substring(0, 50)} — <b>{fmt(transaction.debit)}</b>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">⏳ Chargement...</div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Repas pour qui */}
            <div>
              <label className="text-xs text-gray-600 font-medium">Repas pour</label>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setMealFor('hicham')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mealFor === 'hicham' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}>Hicham</button>
                <button onClick={() => setMealFor('maxime')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${mealFor === 'maxime' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}>Maxime</button>
              </div>
            </div>

            {/* Nb convives */}
            <div>
              <label className="text-xs text-gray-600 font-medium">Nombre de convives</label>
              <input type="number" min="1" max="20" value={nbConvives} onChange={e => setNbConvives(parseInt(e.target.value) || 1)} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>

            {/* Motif */}
            <div>
              <label className="text-xs text-gray-600 font-medium">Motif du repas</label>
              <input type="text" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Réunion commerciale, prospection, partenariat..." className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>

            {/* Invités */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600 font-medium">Invités ({guests.length})</label>
                <button onClick={addGuest} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Ajouter un invité</button>
              </div>
              <div className="space-y-2 mt-2">
                {guests.map((g, idx) => (
                  <div key={idx} className="flex gap-1.5 items-center">
                    <input type="text" value={g.name} onChange={e => updateGuest(idx, 'name', e.target.value)}
                      placeholder="Nom Prénom" className="flex-1 border rounded px-2 py-1.5 text-sm" />
                    <div className="relative flex-1">
                      <input type="text" value={g.company}
                        onChange={e => { updateGuest(idx, 'company', e.target.value); updateGuest(idx, 'client_id', '') }}
                        placeholder="Entreprise" className="w-full border rounded px-2 py-1.5 text-sm"
                        list={`modal-guest-cli-${idx}`} />
                      <datalist id={`modal-guest-cli-${idx}`}>
                        {(clients || []).filter(c => g.company && c.name.toUpperCase().includes(g.company.toUpperCase())).slice(0, 10).map(c => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </div>
                    {g.company && !(clients || []).find(c => c.name.toUpperCase() === g.company.toUpperCase()) && (
                      <button onClick={() => { setProspectInit({ name: g.company, contact_name: g.name }); setShowProspect(true) }}
                        className="text-xs text-emerald-600 hover:text-emerald-800 whitespace-nowrap" title="Créer comme prospect">+🏢</button>
                    )}
                    <button onClick={() => removeGuest(idx)} className="text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
                {guests.length === 0 && (
                  <p className="text-xs text-gray-400 italic py-2">Aucun invité ajouté — vous pouvez en ajouter maintenant ou plus tard</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 p-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100">Annuler</button>
          <div className="flex-1" />
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
            {saving ? '⏳...' : '💾 Enregistrer'}
          </button>
        </div>

        {/* Sous-modal prospect */}
        {showProspect && (
          <ProspectCreateModal
            initial={prospectInit}
            onClose={() => setShowProspect(false)}
            onCreated={(newClient) => {
              setShowProspect(false)
              const gIdx = guests.findIndex(g => g.company === prospectInit.name || !g.company)
              if (gIdx >= 0) {
                updateGuest(gIdx, 'company', newClient.name)
                updateGuest(gIdx, 'client_id', newClient.id)
              }
              toast.success(`🏢 Prospect "${newClient.name}" créé`)
            }}
          />
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// MODAL CRÉATION PROSPECT (depuis invités ou autre)
// ════════════════════════════════════════════════════════════
function ProspectCreateModal({ initial, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    siret: '',
    address: '',
    postal_code: '',
    city: '',
    phone: '',
    contact_email: '',
    contact_name: initial?.contact_name || '',
    notes: '',
    status: 'prospect',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('clients').insert({
        name: form.name.trim().toUpperCase(),
        siret: form.siret || null,
        address: form.address || null,
        postal_code: form.postal_code || null,
        city: form.city || null,
        phone: form.phone || null,
        contact_email: form.contact_email || null,
        contact_name: form.contact_name || null,
        notes: form.notes || null,
        status: 'prospect',
      }).select().single()

      if (error) throw error
      onCreated(data)
    } catch (err) {
      toast.error('Erreur: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b bg-emerald-50 rounded-t-xl">
          <h3 className="font-bold text-emerald-800">🏢 Créer un prospect</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-600 font-medium">Nom de l'entreprise *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">SIRET</label>
              <input type="text" value={form.siret} onChange={e => setForm(f => ({ ...f, siret: e.target.value }))}
                placeholder="XXX XXX XXX XXXXX" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Téléphone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">Adresse</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Code postal</label>
              <input type="text" value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Ville</label>
              <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Nom du contact</label>
              <input type="text" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Email</label>
              <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Contexte, origine du contact..." className="w-full border rounded-lg px-3 py-2 text-sm mt-1" rows={2} />
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100">Annuler</button>
          <div className="flex-1" />
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
            {saving ? '⏳...' : '🏢 Créer le prospect'}
          </button>
        </div>
      </div>
    </div>
  )
}
