import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts'

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
      supabase.from('clients').select('*').order('name'),
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
      {tab === 'previsionnel' && <PrevisionnelTab transactions={transactions} categories={categories} invoices={invoicesList} clients={clientsList} />}
      {tab === 'comptable' && <ComptableTab transactions={transactions} receipts={receipts} loadAll={loadAll} />}
      {tab === 'categories' && <CategoriesTab categories={categories} loadAll={loadAll} />}
      {tab === 'rules' && <RulesTab rules={rules} categories={categories} loadAll={loadAll} />}
      {tab === 'import' && <ImportTab loadAll={loadAll} categories={categories} rules={rules} invoices={invoicesList} clients={clientsList} transactions={transactions} />}

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

  // Catégories à exclure des totaux (transferts internes)
  const EXCLUDE = ['Trésorerie interne', 'Prêts (réception)', 'Apports associés']

  // Dépenses : catégories direction "depense" ou "both" avec des débits, hors exclues
  const cs = Object.entries(stats.byCat)
    .filter(([n, v]) => {
      if (EXCLUDE.includes(n)) return false
      const cat = categories.find(c => c.name === n)
      return v.debit > 0 && cat?.direction !== 'recette'
    })
    .sort((a, b) => b[1].debit - a[1].debit)
  const mc = cs.length > 0 ? cs[0][1].debit : 1

  // Revenus : catégories direction "recette" avec des crédits
  const rc = Object.entries(stats.byCat)
    .filter(([n, v]) => {
      if (EXCLUDE.includes(n)) return false
      const cat = categories.find(c => c.name === n)
      return v.credit > 0 && cat?.direction === 'recette'
    })
    .sort((a, b) => b[1].credit - a[1].credit)

  // Remboursements : catégories non-recette avec des crédits (URSSAF, assurances etc.)
  const remb = Object.entries(stats.byCat)
    .filter(([n, v]) => {
      if (EXCLUDE.includes(n)) return false
      const cat = categories.find(c => c.name === n)
      return v.credit > 0 && cat?.direction !== 'recette'
    })
    .sort((a, b) => b[1].credit - a[1].credit)
  const totalRemb = remb.reduce((s, [, v]) => s + v.credit, 0)

  // Transferts internes (info)
  const transferts = Object.entries(stats.byCat).filter(([n]) => EXCLUDE.includes(n))
  const totalTransferts = transferts.reduce((s, [, v]) => s + v.debit, 0)

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
          {totalTransferts > 0 && (
            <div className="mt-3 pt-3 border-t text-xs text-gray-400 flex justify-between">
              <span>🔄 Hors transferts internes</span><span>{fmtS(totalTransferts)} exclus</span>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-bold text-gray-700 mb-3">🟢 Revenus (CA)</h3>
          {rc.length>0?(<div className="space-y-1.5">{rc.map(([n,v])=>{const cat=categories.find(c=>c.name===n);return(
            <div key={n} className="flex items-center gap-2"><span className="text-sm w-5">{cat?.icon||'📁'}</span><div className="flex-1"><div className="flex justify-between text-xs"><span className="text-gray-700 truncate">{n}</span><span className="text-green-600 font-medium ml-2">{fmtS(v.credit)}</span></div><div className="bg-gray-100 rounded-full h-1.5 mt-0.5"><div className="bg-green-400 rounded-full h-1.5" style={{width:`${(v.credit/rc[0][1].credit)*100}%`}}/></div></div></div>)})}</div>):<div className="text-center py-8 text-gray-400">-</div>}

          {/* Remboursements séparés */}
          {remb.length > 0 && totalRemb > 10 && (
            <div className="mt-4 pt-3 border-t">
              <h4 className="text-xs font-medium text-gray-500 mb-2">↩️ Remboursements & rétrocessions</h4>
              <div className="space-y-1">{remb.filter(([,v]) => v.credit > 10).map(([n,v])=>{const cat=categories.find(c=>c.name===n);return(
                <div key={n} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{cat?.icon||'📁'} {n}</span>
                  <span className="text-blue-600 font-medium">{fmtS(v.credit)}</span>
                </div>)})}</div>
              <div className="flex justify-between text-xs font-medium mt-1 pt-1 border-t border-dashed text-blue-700">
                <span>Total remboursements</span><span>{fmtS(totalRemb)}</span>
              </div>
            </div>
          )}
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
function ImportTab({ loadAll, categories, rules, invoices, clients, transactions }) {
  const [imp, setImp] = useState(false)
  const [csv, setCsv] = useState('')
  const [pre, setPre] = useState([])
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [csvDragOver, setCsvDragOver] = useState(false)
  const [searchOpenRow, setSearchOpenRow] = useState(null) // Index de la ligne avec panneau recherche ouvert
  const [searchQuery, setSearchQuery] = useState('')

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
  const [matchStep, setMatchStep] = useState('auto') // auto | select_client | select_invoices

  // Factures non payées
  const unpaidInvoices = useMemo(() =>
    (invoices || []).filter(inv => inv.type !== 'credit_note' && ['sent', 'due', 'overdue', 'partial'].includes(inv.status) && parseFloat(inv.amount_due) > 0),
    [invoices]
  )

  // ── Parser CSV amélioré + déduplication ──
  function parse(text) {
    const lines = text.trim().split('\n').filter(l => l.trim())
    const txs = []
    for (const line of lines) {
      const p = line.split(';')
      if (p.length < 4) continue
      if (p[0]?.trim() === 'Date operation' || p[0]?.trim() === 'Date opération') continue
      const ds = p[0].trim(); const desc = p[2]?.trim() || ''
      const db = p[3]?.trim().replace(/\s/g, '').replace(',', '.') || ''
      const cr = p[4]?.trim().replace(/\s/g, '').replace(',', '.') || ''
      if (!ds || !desc) continue
      const dp = ds.split('/')
      if (dp.length !== 3) continue
      const yr = dp[2].length === 2 ? '20' + dp[2] : dp[2]
      const d = db ? Math.abs(parseFloat(db)) : 0
      const c = cr ? Math.abs(parseFloat(cr)) : 0
      if (isNaN(d) && isNaN(c)) continue
      let cn = 'Autre / Non classé'
      const du = desc.toUpperCase()
      for (const r of rules) {
        if (r.direction === 'debit' && !(d > 0)) continue
        if (r.direction === 'credit' && !(c > 0)) continue
        if (du.includes(r.keyword?.toUpperCase())) { cn = r.budget_categories?.name || cn; break }
      }
      txs.push({ date: `${yr}-${dp[1]}-${dp[0]}`, description: desc, debit: d || 0, credit: c || 0, category_name: cn, month: `${dp[1]}/${yr}`, year: parseInt(yr) })
    }
    return txs
  }

  // Détection de doublons : compare date + description normalisée + montant
  function checkDuplicates(parsedTxs) {
    // Normalise : accents, apostrophes multiples, espaces
    const normDesc = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .replace(/[''`´"]+/g, '').replace(/\s+/g, ' ').replace(/[^A-Z0-9 ]/g, '').trim()

    return parsedTxs.map(tx => {
      const txDesc = normDesc(tx.description)
      const txAmount = tx.debit > 0 ? tx.debit : tx.credit

      const isDuplicate = (transactions || []).some(ex => {
        // Check 1 : même date + description normalisée + montant
        const descMatch = ex.date === tx.date && normDesc(ex.description) === txDesc &&
          Math.abs((ex.debit || 0) - tx.debit) < 0.01 && Math.abs((ex.credit || 0) - tx.credit) < 0.01
        if (descMatch) return true

        // Check 2 : même date + même montant + description contient les 15 premiers chars
        const exAmount = (ex.debit || 0) > 0 ? (ex.debit || 0) : (ex.credit || 0)
        if (ex.date === tx.date && Math.abs(exAmount - txAmount) < 0.01 && txAmount > 0) {
          const short = txDesc.substring(0, 15)
          if (short.length >= 10 && normDesc(ex.description).includes(short)) return true
        }

        return false
      })
      return { ...tx, isDuplicate }
    })
  }

  function handleCsvFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      setCsv(text)
      processCSV(text)
    }
    reader.readAsText(file, 'utf-8')
  }

  function handleCsvDrop(e) { e.preventDefault(); setCsvDragOver(false); if (e.dataTransfer.files[0]) handleCsvFile(e.dataTransfer.files[0]) }
  function handleCsvPaste() {
    if (!csv.trim()) return
    processCSV(csv)
  }

  function toggleRow(idx) { setSelectedRows(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n }) }
  function selectAllNew() { const s = new Set(); pre.forEach((tx, i) => { if (!tx.isDuplicate) s.add(i) }); setSelectedRows(s) }
  function selectNone() { setSelectedRows(new Set()) }

  function changePreCategory(idx, catName) {
    setPre(prev => prev.map((tx, i) => i === idx ? { ...tx, category_name: catName } : tx))
  }

  // Détacher le match facture d'une ligne
  function detachMatch(idx) {
    setPre(prev => prev.map((tx, i) => i === idx ? { ...tx, matchedInvoices: [], matchConfidence: 'none', matchType: '' } : tx))
  }

  // Attacher manuellement des factures à une ligne crédit
  function attachInvoices(idx, invIds) {
    const invs = invIds.map(id => unpaidInvoices.find(inv => inv.id === id)).filter(Boolean).map(inv => {
      const cli = (clients || []).find(c => c.id === inv.client_id)
      return { id: inv.id, reference: inv.reference, client_name: cli?.name || '?', total_ttc: parseFloat(inv.total_ttc), amount_due: parseFloat(inv.amount_due) }
    })
    setPre(prev => prev.map((tx, i) => i === idx ? { ...tx, matchedInvoices: invs, matchConfidence: 'manual', matchType: 'Manuel' } : tx))
  }

  // ══ Auto-matching factures pour les lignes crédit ══
  function autoMatchInvoices(parsedTxs) {
    const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

    return parsedTxs.map(tx => {
      if (tx.credit <= 0 || tx.isDuplicate) return { ...tx, matchedInvoices: [], matchConfidence: 'none', matchType: '' }

      const descUp = norm(tx.description)
      const amount = tx.credit
      let matchedInvoices = []
      let matchConfidence = 'none'
      let matchType = ''

      // Stratégie 1 : référence facture dans le libellé (FACT-YYYYMMDD-XXXXX)
      const refMatch = tx.description.match(/FACT[-_]?\d{6,8}[-_]?\d{3,5}/i)
      if (refMatch) {
        const ref = refMatch[0].toUpperCase().replace(/[_]/g, '-')
        const inv = unpaidInvoices.find(u => u.reference?.toUpperCase().includes(ref.replace(/-/g, '').slice(-5)) || u.reference?.toUpperCase() === ref)
        if (inv) {
          const cli = (clients || []).find(c => c.id === inv.client_id)
          matchedInvoices = [{ id: inv.id, reference: inv.reference, client_name: cli?.name || '?', total_ttc: parseFloat(inv.total_ttc), amount_due: parseFloat(inv.amount_due) }]
          matchConfidence = Math.abs(parseFloat(inv.amount_due) - amount) < 0.01 ? 'high' : 'medium'
          matchType = 'Référence'
        }
      }

      // Stratégie 2 : montant exact unique
      if (matchedInvoices.length === 0) {
        const amountMatches = unpaidInvoices.filter(u => Math.abs(parseFloat(u.amount_due) - amount) < 0.01)
        if (amountMatches.length === 1) {
          const inv = amountMatches[0]
          const cli = (clients || []).find(c => c.id === inv.client_id)
          matchedInvoices = [{ id: inv.id, reference: inv.reference, client_name: cli?.name || '?', total_ttc: parseFloat(inv.total_ttc), amount_due: parseFloat(inv.amount_due) }]
          matchConfidence = 'high'
          matchType = 'Montant exact'
        } else if (amountMatches.length > 1) {
          // Plusieurs factures au même montant → chercher nom client dans description
          const bestMatch = amountMatches.find(u => {
            const cli = (clients || []).find(c => c.id === u.client_id)
            if (!cli) return false
            const cliWords = norm(cli.name).split(/\s+/).filter(w => w.length > 3)
            return cliWords.some(w => descUp.includes(w))
          })
          if (bestMatch) {
            const cli = (clients || []).find(c => c.id === bestMatch.client_id)
            matchedInvoices = [{ id: bestMatch.id, reference: bestMatch.reference, client_name: cli?.name || '?', total_ttc: parseFloat(bestMatch.total_ttc), amount_due: parseFloat(bestMatch.amount_due) }]
            matchConfidence = 'high'
            matchType = 'Montant + client'
          } else {
            // Ambiguïté
            matchedInvoices = amountMatches.slice(0, 3).map(inv => {
              const cli = (clients || []).find(c => c.id === inv.client_id)
              return { id: inv.id, reference: inv.reference, client_name: cli?.name || '?', total_ttc: parseFloat(inv.total_ttc), amount_due: parseFloat(inv.amount_due) }
            })
            matchConfidence = 'ambiguous'
            matchType = `${amountMatches.length} factures au même montant`
          }
        }
      }

      // Stratégie 3 : nom client dans le libellé → ses factures impayées
      if (matchedInvoices.length === 0) {
        for (const cli of (clients || [])) {
          const cliWords = norm(cli.name).split(/\s+/).filter(w => w.length > 3)
          const descWords = descUp.split(/\s+/).filter(w => w.length > 3)
          const clientMatch = cliWords.some(w => descUp.includes(w)) || descWords.some(w => norm(cli.name).includes(w))
          if (clientMatch) {
            const cliInvoices = unpaidInvoices.filter(u => u.client_id === cli.id)
            if (cliInvoices.length > 0) {
              // Chercher combinaison qui atteint le montant exact
              const exactSingle = cliInvoices.find(u => Math.abs(parseFloat(u.amount_due) - amount) < 0.01)
              if (exactSingle) {
                matchedInvoices = [{ id: exactSingle.id, reference: exactSingle.reference, client_name: cli.name, total_ttc: parseFloat(exactSingle.total_ttc), amount_due: parseFloat(exactSingle.amount_due) }]
                matchConfidence = 'high'
                matchType = 'Client + montant'
              } else {
                // Toutes les factures du client comme candidats
                matchedInvoices = cliInvoices.slice(0, 5).map(inv => ({
                  id: inv.id, reference: inv.reference, client_name: cli.name, total_ttc: parseFloat(inv.total_ttc), amount_due: parseFloat(inv.amount_due)
                }))
                matchConfidence = 'medium'
                matchType = `Client détecté (${cli.name})`
              }
              break
            }
          }
        }
      }

      return { ...tx, matchedInvoices, matchConfidence, matchType }
    })
  }

  // Sélection d'une facture parmi les candidats ambigus
  function pickInvoice(rowIdx, invoiceId) {
    setPre(prev => prev.map((tx, i) => {
      if (i !== rowIdx) return tx
      const picked = tx.matchedInvoices.find(m => m.id === invoiceId)
      if (!picked) return tx
      return { ...tx, matchedInvoices: [picked], matchConfidence: 'high', matchType: 'Sélection manuelle' }
    }))
    setSearchOpenRow(null)
  }

  // Ouvrir/fermer le panneau de recherche inline
  function toggleSearchPanel(idx) {
    if (searchOpenRow === idx) { setSearchOpenRow(null); setSearchQuery('') }
    else { setSearchOpenRow(idx); setSearchQuery('') }
  }

  // Scoring intelligent des factures pour une ligne crédit
  function scoreInvoicesForRow(tx, query) {
    const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
    const descUp = norm(tx.description)
    const descWords = descUp.split(/\s+/).filter(w => w.length > 3)
    const amount = tx.credit
    const qUp = norm(query)

    return unpaidInvoices.map(inv => {
      const cli = (clients || []).find(c => c.id === inv.client_id)
      const cliName = cli?.name || ''
      const cliNorm = norm(cliName)
      const cliWords = cliNorm.split(/\s+/).filter(w => w.length > 3)
      const due = parseFloat(inv.amount_due)
      const ref = inv.reference || ''
      let score = 0
      const reasons = []

      // Montant exact
      if (Math.abs(due - amount) < 0.01) { score += 100; reasons.push('Montant exact') }
      // Montant proche (< 10%)
      else if (amount > 0 && Math.abs(due - amount) / amount < 0.10) { score += 50; reasons.push('Montant ~' + Math.round(Math.abs(due - amount) / amount * 100) + '%') }
      // Montant proche (< 30%)
      else if (amount > 0 && Math.abs(due - amount) / amount < 0.30) { score += 20; reasons.push('Montant ~' + Math.round(Math.abs(due - amount) / amount * 100) + '%') }

      // Mots du libellé bancaire dans le nom client
      for (const w of descWords) { if (cliNorm.includes(w)) { score += 80; reasons.push('Libellé → client'); break } }
      // Mots du nom client dans le libellé bancaire
      for (const w of cliWords) { if (descUp.includes(w)) { score += 80; reasons.push('Client → libellé'); break } }

      // Référence facture dans le libellé
      if (ref && descUp.includes(norm(ref).slice(-5))) { score += 90; reasons.push('Ref facture') }

      // Même mois
      if (inv.invoice_date && tx.date) {
        const invMonth = inv.invoice_date.substring(0, 7)
        const txMonth = tx.date.substring(0, 7)
        if (invMonth === txMonth) { score += 10; reasons.push('Même mois') }
      }

      // Filtre par query de recherche
      if (qUp) {
        const matchQuery = norm(ref).includes(qUp) || cliNorm.includes(qUp) || norm(inv.object).includes(qUp)
        if (!matchQuery) return null // Exclure si pas dans la recherche
        score += 50
      }

      return {
        id: inv.id, reference: ref, client_name: cliName, client_id: inv.client_id,
        total_ttc: parseFloat(inv.total_ttc), amount_due: due,
        invoice_date: inv.invoice_date, object: inv.object,
        score, reasons: [...new Set(reasons)]
      }
    }).filter(Boolean).sort((a, b) => b.score - a.score)
  }

  // Multi-sélection de factures pour un row
  function toggleInvoiceForRow(rowIdx, inv) {
    setPre(prev => prev.map((tx, i) => {
      if (i !== rowIdx) return tx
      const current = tx.matchedInvoices || []
      const exists = current.find(m => m.id === inv.id)
      let updated
      if (exists) {
        updated = current.filter(m => m.id !== inv.id)
      } else {
        updated = [...current, { id: inv.id, reference: inv.reference, client_name: inv.client_name, total_ttc: inv.total_ttc, amount_due: inv.amount_due }]
      }
      const totalMatched = updated.reduce((s, m) => s + m.amount_due, 0)
      const confidence = updated.length > 0 ? (Math.abs(totalMatched - tx.credit) < 0.01 ? 'high' : 'medium') : 'none'
      return { ...tx, matchedInvoices: updated, matchConfidence: confidence, matchType: updated.length > 0 ? 'Sélection manuelle' : '' }
    }))
  }

  // ══ Process complet : parse → dedup → match ══
  function processCSV(text) {
    const parsed = autoMatchInvoices(checkDuplicates(parse(text)))
    setPre(parsed)
    const newSet = new Set()
    parsed.forEach((tx, i) => { if (!tx.isDuplicate) newSet.add(i) })
    setSelectedRows(newSet)
    const newCount = parsed.filter(t => !t.isDuplicate).length
    const dupCount = parsed.filter(t => t.isDuplicate).length
    const matchedCount = parsed.filter(t => t.matchConfidence === 'high').length
    if (parsed.length > 0) toast.success(`📊 ${parsed.length} lignes — ${newCount} nouvelles, ${matchedCount} rapprochements`)
    else toast.error('Aucune transaction détectée')
    return parsed
  }

  async function doImport() {
    const toImport = pre.filter((_, i) => selectedRows.has(i))
    if (!toImport.length) { toast.error('Aucune ligne sélectionnée'); return }
    setImp(true)
    let imported = 0, reconciled = 0, errors = []
    try {
      for (const tx of toImport) {
        const cat = categories.find(c => c.name === tx.category_name)
        const hasMatch = tx.credit > 0 && tx.matchConfidence === 'high' && tx.matchedInvoices?.length > 0

        // 1. Créer la transaction budget
        const txRow = {
          date: tx.date, description: tx.description, debit: tx.debit, credit: tx.credit,
          category_id: cat?.id || null, category_name: tx.category_name,
          month: tx.month, year: tx.year, source_file: 'import_csv_cmb',
          payer: 'entreprise', is_manual: false, is_personal: false,
          linked_invoice_id: hasMatch ? tx.matchedInvoices[0].id : null,
          reconciled_at: hasMatch ? new Date().toISOString() : null,
        }
        const { data: insertedTx, error: txErr } = await supabase.from('budget_transactions').insert(txRow).select('id').single()
        if (txErr) { errors.push(`TX ${tx.description}: ${txErr.message}`); continue }
        imported++

        // 2. Si match haute confiance → rapprocher les factures
        if (hasMatch) {
          let remaining = tx.credit
          for (const inv of tx.matchedInvoices) {
            if (remaining <= 0) break
            const payAmount = Math.min(remaining, inv.amount_due)
            remaining -= payAmount

            // Créer le paiement
            const { error: payErr } = await supabase.from('invoice_payments').insert({
              invoice_id: inv.id,
              amount: payAmount,
              payment_date: tx.date,
              payment_method: 'virement bancaire',
              payment_reference: tx.description.substring(0, 100),
              notes: `Import CSV — ${tx.description.substring(0, 80)}`,
              created_by: 'Import CSV CMB',
            })
            if (payErr) { errors.push(`Paiement ${inv.reference}: ${payErr.message}`); continue }

            // Mettre à jour la facture
            const newPaid = (parseFloat(inv.total_ttc) - inv.amount_due) + payAmount
            const newDue = inv.amount_due - payAmount
            const newStatus = newDue <= 0.01 ? 'paid' : 'partial'
            await supabase.from('invoices').update({
              amount_paid: newPaid,
              amount_due: Math.max(0, newDue),
              status: newStatus,
              updated_at: new Date().toISOString(),
            }).eq('id', inv.id)

            reconciled++
          }
        }
      }

      const msg = [`✅ ${imported} transactions importées`]
      if (reconciled > 0) msg.push(`🔗 ${reconciled} facture(s) rapprochée(s)`)
      if (errors.length > 0) msg.push(`⚠️ ${errors.length} erreur(s)`)
      toast.success(msg.join(' — '))
      if (errors.length > 0) console.warn('Import errors:', errors)
      setCsv(''); setPre([]); setSelectedRows(new Set()); loadAll()
    } catch (e) { toast.error('Erreur: ' + (e.message || '')) }
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
      // Stratégie 1 : mots du nom client dans le libellé bancaire
      for (const cli of (clients || [])) {
        const cliUp = cli.name.toUpperCase()
        const words = cliUp.split(/[\s\-_]+/).filter(w => w.length > 3)
        for (const w of words) {
          if (descUp.includes(w)) { detectedClient = cli; break }
        }
        if (detectedClient) break
      }

      // Stratégie 2 : mots du libellé bancaire dans le nom client (ex: OPCO → OPERATEUR DE COMPETENCES)
      if (!detectedClient) {
        const descWords = descUp.replace(/VIR|CHQ|PRLV|REM|\d+[,\.]\d+/g, '').split(/[\s\-_]+/).filter(w => w.length > 3)
        for (const cli of (clients || [])) {
          const cliUp = cli.name.toUpperCase()
          for (const w of descWords) {
            if (cliUp.includes(w)) { detectedClient = cli; break }
          }
          if (detectedClient) break
        }
      }

      // Stratégie 3 : chercher dans les références factures (client_reference, reference)
      if (!detectedClient) {
        const invs = (invoices || [])
        for (const inv of invs) {
          const ref = (inv.reference || '').toUpperCase()
          const cliRef = (inv.client_reference || '').toUpperCase()
          const obj = (inv.object || '').toUpperCase()
          if ((ref && descUp.includes(ref)) || (cliRef && cliRef.length > 2 && descUp.includes(cliRef))) {
            detectedClient = (clients || []).find(c => c.id === inv.client_id)
            break
          }
        }
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
                <ClientSearchForMatch
                  clients={clients || []}
                  invoices={invoices || []}
                  unpaidInvoices={unpaidInvoices}
                  bankDescription={matchTx?.description || ''}
                  onSelect={handleSelectClient}
                />
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

      {/* ══ IMPORT CSV Crédit Mutuel — Drag & Drop ══ */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">📥 Import CSV Crédit Mutuel</h3>

        {/* Zone drag & drop */}
        <div
          onDragOver={e => { e.preventDefault(); setCsvDragOver(true) }}
          onDragLeave={() => setCsvDragOver(false)}
          onDrop={handleCsvDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
            ${csvDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'}`}
          onClick={() => document.getElementById('csv-file-input')?.click()}
        >
          <input id="csv-file-input" type="file" accept=".csv,.txt,.CSV" className="hidden"
            onChange={e => { if (e.target.files[0]) handleCsvFile(e.target.files[0]); e.target.value = '' }} />
          <div className="text-3xl mb-2">📂</div>
          <p className="text-sm font-medium text-gray-700">Glisser-déposer votre fichier CSV ici</p>
          <p className="text-xs text-gray-400 mt-1">ou cliquer pour sélectionner — format CMB (Date operation;Date valeur;Libelle;Debit;Credit)</p>
        </div>

        {/* Ou coller manuellement */}
        <details className="mt-3">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Ou coller les données CSV manuellement...</summary>
          <textarea value={csv} onChange={e => setCsv(e.target.value)}
            placeholder="Date operation;Date valeur;Libelle;Debit;Credit&#10;20/02/2026;20/02/2026;VIR OPCO 2I;;834,00"
            className="w-full h-32 border rounded-lg p-3 text-xs font-mono resize-y mt-2" />
          <button onClick={handleCsvPaste} disabled={!csv.trim()}
            className="mt-2 bg-gray-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-700">
            👁️ Analyser
          </button>
        </details>
      </div>

      {/* Résultats de l'analyse */}
      {pre.length > 0 && (() => {
        const newCount = pre.filter(t => !t.isDuplicate).length
        const dupCount = pre.filter(t => t.isDuplicate).length
        const matchedCount = pre.filter(t => t.matchConfidence === 'high').length
        const ambiguousCount = pre.filter(t => t.matchConfidence === 'ambiguous' || t.matchConfidence === 'medium').length
        const selectedCount = selectedRows.size
        return (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {/* Header avec stats */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-green-50 border-b flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-700">📊 {pre.length} transactions</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{newCount} nouvelles</span>
                {dupCount > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{dupCount} doublons</span>}
                {matchedCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🔗 {matchedCount} rapprochées</span>}
                {ambiguousCount > 0 && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">❓ {ambiguousCount} à vérifier</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={selectAllNew} className="text-xs text-blue-600 hover:underline">Sélectionner nouvelles</button>
                <button onClick={selectNone} className="text-xs text-gray-400 hover:underline">Tout désélectionner</button>
              </div>
            </div>

            {/* Table */}
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8">✓</th>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-left">Catégorie</th>
                    <th className="px-2 py-1.5 text-right">Débit</th>
                    <th className="px-2 py-1.5 text-right">Crédit</th>
                    <th className="px-2 py-1.5 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {pre.map((tx, i) => (
                    <React.Fragment key={i}>
                      <tr onClick={() => toggleRow(i)}
                        className={`border-t cursor-pointer transition-colors
                          ${tx.isDuplicate ? 'bg-amber-50/50 opacity-60' : selectedRows.has(i) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-2 py-1">
                          <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleRow(i)}
                            className="rounded text-blue-600" />
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">{tx.date}</td>
                        <td className="px-2 py-1 truncate max-w-xs" title={tx.description}>{tx.description}</td>
                        <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
                          <select value={tx.category_name} onChange={e => changePreCategory(i, e.target.value)}
                            className={`text-xs rounded px-1 py-0.5 border-0 cursor-pointer ${tx.category_name === 'Autre / Non classé' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                            {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1 text-right text-red-600 font-mono">{tx.debit > 0 ? tx.debit.toFixed(2) : ''}</td>
                        <td className="px-2 py-1 text-right text-green-600 font-mono">{tx.credit > 0 ? tx.credit.toFixed(2) : ''}</td>
                        <td className="px-2 py-1 text-center" onClick={e => e.stopPropagation()}>
                          {tx.isDuplicate
                            ? <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">doublon</span>
                            : tx.matchConfidence === 'high'
                              ? <button onClick={() => toggleSearchPanel(i)} className="text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-300">🔗 rapprochée</button>
                              : tx.matchConfidence === 'medium' || tx.matchConfidence === 'ambiguous'
                                ? <button onClick={() => toggleSearchPanel(i)} className="text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded hover:bg-purple-300">❓ à vérifier</button>
                                : tx.credit > 0
                                  ? <button onClick={() => toggleSearchPanel(i)} className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-300 cursor-pointer">🔍 matcher</button>
                                  : <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded">nouvelle</span>
                          }
                        </td>
                      </tr>

                      {/* Ligne de détail match pour les crédits — résumé compact */}
                      {tx.credit > 0 && !tx.isDuplicate && tx.matchedInvoices?.length > 0 && searchOpenRow !== i && (
                        <tr className="bg-blue-50/30">
                          <td></td>
                          <td colSpan="6" className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500">
                                {tx.matchConfidence === 'high' ? '🟢' : '🟠'} {tx.matchType} →
                              </span>
                              {tx.matchedInvoices.map(inv => (
                                <span key={inv.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                                  {inv.reference} — {inv.client_name} — {fmt(inv.amount_due)}
                                </span>
                              ))}
                              {(() => {
                                const totalM = tx.matchedInvoices.reduce((s, m) => s + m.amount_due, 0)
                                return Math.abs(totalM - tx.credit) < 0.01
                                  ? <span className="text-xs text-green-600">✅ exact</span>
                                  : <span className="text-xs text-amber-600">⚠️ écart {fmt(Math.abs(totalM - tx.credit))}</span>
                              })()}
                              <button onClick={() => detachMatch(i)} className="text-xs text-red-400 hover:text-red-600" title="Détacher">✕</button>
                              <button onClick={() => toggleSearchPanel(i)} className="text-xs text-blue-500 hover:text-blue-700">✏️</button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Panneau de recherche inline pour matcher une facture */}
                      {tx.credit > 0 && !tx.isDuplicate && searchOpenRow === i && (() => {
                        const scored = scoreInvoicesForRow(tx, searchQuery)
                        const selectedInvIds = new Set((tx.matchedInvoices || []).map(m => m.id))
                        const totalSelected = (tx.matchedInvoices || []).reduce((s, m) => s + m.amount_due, 0)
                        const diff = tx.credit - totalSelected
                        return (
                          <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                            <td></td>
                            <td colSpan="6" className="p-3" onClick={e => e.stopPropagation()}>
                              <div className="space-y-2">
                                {/* Header du panneau */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">🔍 Rapprocher {fmt(tx.credit)}</span>
                                    {totalSelected > 0 && (
                                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                        Math.abs(diff) < 0.01 ? 'bg-green-100 text-green-700' :
                                        diff > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {Math.abs(diff) < 0.01 ? '✅ Correspondance exacte' :
                                         diff > 0 ? `⚠️ Reste ${fmt(diff)} non couvert` :
                                         `🔴 Dépasse de ${fmt(Math.abs(diff))}`}
                                      </span>
                                    )}
                                  </div>
                                  <button onClick={() => { setSearchOpenRow(null); setSearchQuery('') }}
                                    className="text-gray-400 hover:text-gray-600 text-sm">✕ Fermer</button>
                                </div>

                                {/* Recherche */}
                                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                  placeholder="🔍 Filtrer par client, référence, objet..."
                                  className="w-full border rounded-lg px-3 py-1.5 text-xs focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />

                                {/* Liste des factures scorées */}
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                  {scored.length === 0 ? (
                                    <div className="text-center py-3 text-xs text-gray-400">Aucune facture impayée trouvée</div>
                                  ) : scored.slice(0, 15).map(inv => {
                                    const isSelected = selectedInvIds.has(inv.id)
                                    return (
                                      <div key={inv.id} onClick={() => toggleInvoiceForRow(i, inv)}
                                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-xs
                                          ${isSelected ? 'bg-blue-100 border-blue-400' : inv.score >= 80 ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                        <input type="checkbox" checked={isSelected} readOnly className="rounded text-blue-600 pointer-events-none" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-800">{inv.reference}</span>
                                            <span className="text-gray-500">—</span>
                                            <span className="text-gray-700 truncate">{inv.client_name}</span>
                                          </div>
                                          {inv.object && <div className="text-gray-400 truncate">{inv.object}</div>}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <div className={`font-bold ${Math.abs(inv.amount_due - tx.credit) < 0.01 ? 'text-green-700' : 'text-gray-700'}`}>
                                            {fmt(inv.amount_due)}
                                          </div>
                                          <div className="text-gray-400">{inv.invoice_date}</div>
                                        </div>
                                        {inv.score >= 50 && (
                                          <div className="flex-shrink-0">
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${inv.score >= 100 ? 'bg-green-200 text-green-800' : inv.score >= 50 ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                                              {inv.reasons[0]}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>

                                {/* Barre de total si sélection */}
                                {(tx.matchedInvoices || []).length > 0 && (
                                  <div className={`flex items-center justify-between p-2 rounded-lg border-2 text-xs font-medium ${
                                    Math.abs(diff) < 0.01 ? 'bg-green-50 border-green-400 text-green-700' :
                                    diff > 0 ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-red-50 border-red-400 text-red-700'
                                  }`}>
                                    <span>{(tx.matchedInvoices || []).length} facture(s) = {fmt(totalSelected)}</span>
                                    <span>Virement : {fmt(tx.credit)}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })()}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer import */}
            <div className="px-4 py-3 bg-gray-50 border-t">
              {/* Récap rapprochement */}
              {matchedCount > 0 && (
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 space-y-1">
                  <div className="font-medium">🔗 Rapprochement automatique :</div>
                  {pre.filter(t => selectedRows.has(pre.indexOf(t)) && t.matchConfidence === 'high' && t.matchedInvoices?.length > 0).map((tx, j) => (
                    <div key={j} className="flex justify-between">
                      <span>{tx.matchedInvoices[0]?.reference} — {tx.matchedInvoices[0]?.client_name}</span>
                      <span className="font-medium">{fmt(tx.credit)} {Math.abs((tx.matchedInvoices[0]?.amount_due || 0) - tx.credit) < 0.01 ? '→ Payée ✅' : '→ Partiel'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{selectedCount} ligne(s) sélectionnée(s)</span>
                <div className="flex gap-2">
                  <button onClick={() => { setPre([]); setCsv(''); setSelectedRows(new Set()) }}
                    className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100">Annuler</button>
                  <button onClick={doImport} disabled={imp || selectedCount === 0}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700">
                    {imp ? '⏳ Import en cours...' : `✅ Importer ${selectedCount} transaction(s)${matchedCount > 0 ? ` + ${matchedCount} rapprochement(s)` : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
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

function PrevisionnelTab({ transactions, categories, invoices, clients }) {
  // ══ CHART COLORS ══
  const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1']
  const ML = { '01':'Jan','02':'Fév','03':'Mar','04':'Avr','05':'Mai','06':'Jun','07':'Jul','08':'Aoû','09':'Sep','10':'Oct','11':'Nov','12':'Déc' }

  const now = new Date()
  const currentMonthKey = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // ══ STATE ══
  const [config, setConfig] = useState({ objectif: 10000, marge_securite: 2000, solde_override: '' })
  const [chargesFixes, setChargesFixes] = useState({})
  const [configLoaded, setConfigLoaded] = useState(false)
  const [actions, setActions] = useState([])
  const [actionsLoaded, setActionsLoaded] = useState(false)
  const [pipeline, setPipeline] = useState([])
  const [pipeLoaded, setPipeLoaded] = useState(false)
  const [sessions, setSessions] = useState([])
  const [courses, setCourses] = useState([])
  const [showPipeForm, setShowPipeForm] = useState(false)
  const [newPipe, setNewPipe] = useState({ client: '', amount_ttc: '', expected_month: '', type: 'previsionnel', trainer: 'Hicham', description: '' })
  const [showActionForm, setShowActionForm] = useState(false)
  const [newAction, setNewAction] = useState({ title: '', detail: '', category: 'general', impact_monthly: '', due_date: '' })
  const [actionFilter, setActionFilter] = useState('active') // all, active, done
  const [chartPeriod, setChartPeriod] = useState('6') // 6 or 12 months

  // ══ LOAD SETTINGS ══
  useEffect(() => {
    loadSettings()
    loadActions()
    loadPipeline()
    loadSessionsAndCourses()
  }, [])

  async function loadSettings() {
    const { data } = await supabase.from('budget_settings').select('*')
    if (data) {
      const map = {}
      data.forEach(r => { map[r.key] = r.value })
      setConfig({
        objectif: parseFloat(map.objectif || '10000'),
        marge_securite: parseFloat(map.marge_securite || '2000'),
        solde_override: map.solde_override || '',
      })
      // Charges fixes réelles validées
      setChargesFixes({
        'Salaire Maxime': { icon: '👤', montant: parseFloat(map.charge_salaire_maxime || '0') },
        'Salaire Hicham': { icon: '👤', montant: parseFloat(map.charge_salaire_hicham || '0') },
        'Loyer siège': { icon: '🏢', montant: parseFloat(map.charge_loyer || '0') },
        'URSSAF': { icon: '📋', montant: parseFloat(map.charge_urssaf || '0') },
        'Prêts': { icon: '🏦', montant: parseFloat(map.charge_prets || '0') },
        'Comptable': { icon: '🧮', montant: parseFloat(map.charge_comptable || '0') },
        'Crédit auto': { icon: '🚗', montant: parseFloat(map.charge_credit_auto || '0') },
        'Télécoms': { icon: '📱', montant: parseFloat(map.charge_telecoms || '0') },
        'Assurances véhicule': { icon: '🚗', montant: parseFloat(map.charge_assurance_vehicule || '0') },
        'Assurances santé': { icon: '🏥', montant: parseFloat(map.charge_assurance_sante || '0') },
        'Logiciels & SaaS': { icon: '💻', montant: parseFloat(map.charge_logiciels || '0') },
        'Frais bancaires': { icon: '🏦', montant: parseFloat(map.charge_frais_bancaires || '0') },
      })
    }
    setConfigLoaded(true)
  }

  async function saveConfig(key, value) {
    await supabase.from('budget_settings').upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  function updateConfig(key, value) {
    setConfig(c => ({ ...c, [key]: value }))
    saveConfig(key, value)
  }

  // ══ LOAD ACTIONS ══
  async function loadActions() {
    const { data } = await supabase.from('budget_actions').select('*').order('created_at', { ascending: false })
    if (data) setActions(data)
    setActionsLoaded(true)
  }

  async function addAction() {
    if (!newAction.title) { toast.error('Titre requis'); return }
    const { error } = await supabase.from('budget_actions').insert({
      title: newAction.title, detail: newAction.detail, type: 'manual',
      category: newAction.category,
      impact_monthly: newAction.impact_monthly ? parseFloat(newAction.impact_monthly) : null,
      due_date: newAction.due_date || null,
      status: 'todo', created_by: 'Hicham'
    })
    if (error) { toast.error(error.message); return }
    toast.success('Action ajoutée')
    setNewAction({ title: '', detail: '', category: 'general', impact_monthly: '', due_date: '' })
    setShowActionForm(false)
    loadActions()
  }

  async function updateActionStatus(id, status) {
    await supabase.from('budget_actions').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setActions(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  async function updateActionNote(id, note) {
    await supabase.from('budget_actions').update({ note, updated_at: new Date().toISOString() }).eq('id', id)
    setActions(prev => prev.map(a => a.id === id ? { ...a, note } : a))
  }

  async function deleteAction(id) {
    if (!confirm('Supprimer cette action ?')) return
    await supabase.from('budget_actions').delete().eq('id', id)
    setActions(prev => prev.filter(a => a.id !== id))
    toast.success('Supprimée')
  }

  // ══ LOAD PIPELINE ══
  async function loadPipeline() {
    // Charger les entrées manuelles
    const { data: manualData } = await supabase.from('budget_pipeline').select('*').not('status', 'eq', 'annule').order('expected_month')
    
    // Charger les devis (envoyés, acceptés = pipeline auto)
    const { data: quotesData } = await supabase.from('quotes')
      .select('id, reference, client_id, quote_date, validity_date, status, total_ht, total_ttc, session_id, object, created_by, clients(name)')
      .in('status', ['accepted'])
      .order('quote_date', { ascending: false })
    
    // Charger les sessions liées pour avoir les dates
    const sessionIds = (quotesData || []).filter(q => q.session_id).map(q => q.session_id)
    let sessionsMap = {}
    if (sessionIds.length > 0) {
      const { data: sesData } = await supabase.from('sessions').select('id, start_date, trainer_id').in('id', sessionIds)
      if (sesData) sesData.forEach(s => { sessionsMap[s.id] = s })
    }

    // Transformer les devis en entrées pipeline
    const quotePipeline = (quotesData || []).map(q => {
      const session = q.session_id ? sessionsMap[q.session_id] : null
      const expectedDate = session?.start_date || q.validity_date || q.quote_date
      const expectedMonth = expectedDate ? expectedDate.substring(0, 7) : null
      return {
        id: `quote_${q.id}`,
        quote_id: q.id,
        client: q.clients?.name || '?',
        description: q.object || q.reference,
        amount_ht: q.total_ht || 0,
        amount_ttc: q.total_ttc || 0,
        expected_month: expectedMonth,
        type: 'devis',
        status: q.status === 'accepted' ? 'confirme' : 'prevu',
        trainer: q.created_by || '',
        source: 'auto',
        quote_ref: q.reference,
        quote_status: q.status,
      }
    })

    // Fusionner : devis auto + manuels
    const manual = (manualData || []).map(p => ({ ...p, source: 'manual' }))
    setPipeline([...quotePipeline, ...manual])
    setPipeLoaded(true)
  }

  async function loadSessionsAndCourses() {
    const [sesR, couR] = await Promise.all([
      supabase.from('sessions').select('id, reference, start_date, end_date, status, custom_price_ht, total_price, session_type, is_intra, client_id, course_id').not('status', 'eq', 'cancelled').order('start_date'),
      supabase.from('courses').select('id, title, code, duration_days, price_ht'),
    ])
    if (sesR.data) setSessions(sesR.data)
    if (couR.data) setCourses(couR.data)
  }

  async function addPipeEntry() {
    if (!newPipe.client || !newPipe.amount_ttc || !newPipe.expected_month) { toast.error('Client, montant et mois requis'); return }
    const ht = parseFloat(newPipe.amount_ttc) / 1.2
    const { error } = await supabase.from('budget_pipeline').insert({
      client: newPipe.client.toUpperCase(), description: newPipe.description,
      amount_ht: Math.round(ht * 100) / 100, amount_ttc: parseFloat(newPipe.amount_ttc),
      expected_month: newPipe.expected_month, type: newPipe.type, status: 'prevu', trainer: newPipe.trainer,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Ajouté au pipeline')
    setNewPipe({ client: '', amount_ttc: '', expected_month: '', type: 'previsionnel', trainer: 'Hicham', description: '' })
    setShowPipeForm(false)
    loadPipeline()
  }

  async function updatePipeStatus(id, status) {
    await supabase.from('budget_pipeline').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    loadPipeline()
  }

  async function deletePipe(id) {
    if (!confirm('Supprimer ?')) return
    await supabase.from('budget_pipeline').delete().eq('id', id)
    loadPipeline()
  }

  // ══ HELPERS ══
  function normalizeDesc(s) { return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 20) }
  function monthLabel(m) { const parts = m.split('/'); return `${ML[parts[0]] || parts[0]} ${(parts[1] || '').slice(-2)}` }

  // ══ Factures impayées ══
  const unpaidInvoices = useMemo(() =>
    (invoices || []).filter(inv => inv.type !== 'credit_note' && ['sent', 'due', 'overdue', 'partial'].includes(inv.status) && parseFloat(inv.amount_due) > 0),
    [invoices]
  )

  // ══ ANALYSE PRINCIPALE ══
  const analysis = useMemo(() => {
    try {
      const co = transactions.filter(tx => !tx.is_personal)
      const catMap = {}
      categories.forEach(c => { catMap[c.name] = { type: c.type, direction: c.direction, icon: c.icon } })

      // Solde auto = somme des crédits - débits (toutes transactions)
      const totalCredits = transactions.reduce((s, tx) => s + (tx.credit || 0), 0)
      const totalDebits = transactions.reduce((s, tx) => s + (tx.debit || 0), 0)
      const soldeAuto = Math.round((totalCredits - totalDebits) * 100) / 100
      const solde = config.solde_override !== '' ? parseFloat(config.solde_override) : soldeAuto

      // Grouper par mois
      const byMonth = {}
      co.forEach(tx => {
        if (!tx.month) return
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

      // ── Mois en cours ──
      const curTxs = co.filter(tx => tx.month === currentMonthKey)
      const curEntrees = curTxs.filter(tx => (tx.credit || 0) > 0 && catMap[tx.category_name]?.direction === 'recette')
      const curSorties = curTxs.filter(tx => (tx.debit || 0) > 0)
      const totalEntreesRealisees = curEntrees.reduce((s, tx) => s + tx.credit, 0)
      const totalSortiesRealisees = curSorties.reduce((s, tx) => s + tx.debit, 0)

      // Entrées à venir : factures impayées échéance ce mois ou avant
      const entreesAVenir = unpaidInvoices.filter(inv => {
        const due = inv.due_date || inv.invoice_date
        return due && due.substring(0, 7) <= currentYearMonth
      })
      const totalEntreesAVenir = entreesAVenir.reduce((s, inv) => s + parseFloat(inv.amount_due), 0)

      // Pipeline du mois en cours
      const pipeThisMonth = pipeline.filter(p => p.expected_month === currentYearMonth && p.status !== 'annule')
      const totalPipeMois = pipeThisMonth.reduce((s, p) => s + (p.amount_ht || 0), 0)

      // Sorties à venir : charges fixes validées - ce qui est déjà débité
      const catToChargeKey = {
        'Salaire Maxime': 'Salaire Maxime', 'Salaire Hicham': 'Salaire Hicham',
        'Loyer siège': 'Loyer siège', 'Charges sociales (URSSAF)': 'URSSAF',
        'Prêts (remboursement)': 'Prêts', 'Comptable': 'Comptable',
        'Véhicules (crédit auto)': 'Crédit auto', 'Télécoms': 'Télécoms',
        'Assurances véhicule': 'Assurances véhicule', 'Assurances santé/prévoyance': 'Assurances santé',
        'Logiciels & SaaS': 'Logiciels & SaaS', 'Frais bancaires': 'Frais bancaires',
      }
      // Total charges fixes attendues ce mois
      const totalChargesFixesMois = Object.values(chargesFixes).reduce((s, v) => s + (v.montant || 0), 0)
      // Ce qui est déjà débité dans les catégories de charges fixes
      const dejaDebiteChargesFixes = curSorties
        .filter(tx => catToChargeKey[tx.category_name])
        .reduce((s, tx) => s + tx.debit, 0)
      const totalSortiesAVenir = Math.max(0, totalChargesFixesMois - dejaDebiteChargesFixes)
      // Détail pour affichage
      const sortiesAVenir = Object.entries(chargesFixes)
        .filter(([, v]) => v.montant > 0)
        .map(([name, v]) => {
          const cats = Object.entries(catToChargeKey).filter(([, k]) => k === name).map(([c]) => c)
          const deja = curSorties.filter(tx => cats.includes(tx.category_name)).reduce((s, tx) => s + tx.debit, 0)
          const reste = v.montant - deja
          return { description: name, montant: reste, icon: v.icon, deja, attendu: v.montant }
        })
        .filter(r => r.montant > 50)

      const totalEntreesMois = totalEntreesRealisees + totalEntreesAVenir + totalPipeMois
      const totalSortiesMois = totalSortiesRealisees + totalSortiesAVenir
      const netMois = totalEntreesMois - totalSortiesMois
      const soldeProjeteFin = solde + netMois
      const budgetLibre = soldeProjeteFin - config.marge_securite

      // ── CA par catégorie et mois ──
      let totalCAFormations = 0, totalCASousTrait = 0
      const caByMonth = {}
      months.forEach(m => {
        let caF = 0, caS = 0
        Object.entries(byMonth[m].cats).forEach(([cat, vals]) => {
          if (cat === 'CA Formations') caF += vals.credit
          if (cat === 'CA Sous-traitance') caS += vals.credit
        })
        caByMonth[m] = { formations: caF, soustraitance: caS, total: caF + caS }
        totalCAFormations += caF
        totalCASousTrait += caS
      })

      const activeMonths = months.filter(m => (caByMonth[m]?.total || 0) > 100)
      const nbActive = activeMonths.length || 1

      // ── Tendances 3 derniers mois ──
      const last3 = activeMonths.slice(-3)
      const prev3 = activeMonths.slice(-6, -3)
      const caLast3 = last3.reduce((s, m) => s + (caByMonth[m]?.total || 0), 0) / (last3.length || 1)
      const caPrev3 = prev3.reduce((s, m) => s + (caByMonth[m]?.total || 0), 0) / (prev3.length || 1)
      const caTrend = caPrev3 > 0 ? ((caLast3 - caPrev3) / caPrev3) * 100 : 0

      const depLast3 = last3.reduce((s, m) => s + (byMonth[m]?.debit || 0), 0) / (last3.length || 1)
      const depPrev3 = prev3.reduce((s, m) => s + (byMonth[m]?.debit || 0), 0) / (prev3.length || 1)
      const depTrend = depPrev3 > 0 ? ((depLast3 - depPrev3) / depPrev3) * 100 : 0
      const margeLast3 = caLast3 - depLast3

      // ── Charges fixes : utiliser les montants validés de budget_settings ──
      const fixedDetail = Object.entries(chargesFixes)
        .filter(([, v]) => v.montant > 0)
        .map(([name, v]) => ({ name, icon: v.icon, monthly: v.montant }))
        .sort((a, b) => b.monthly - a.monthly)
      const avgFixed = fixedDetail.reduce((s, d) => s + d.monthly, 0)

      // ── Dépenses par catégorie (pour camembert + optimisation) ──
      const depByCat = {}
      months.forEach(m => {
        Object.entries(byMonth[m].cats).forEach(([cat, vals]) => {
          if (vals.debit > 0) {
            if (!depByCat[cat]) depByCat[cat] = { total: 0, months: [], icon: catMap[cat]?.icon || '📦' }
            depByCat[cat].total += vals.debit
            depByCat[cat].months.push({ m, amount: vals.debit })
          }
        })
      })
      Object.values(depByCat).forEach(d => {
        d.monthly = d.total / nbMonths
        d.last3 = d.months.filter(x => last3.includes(x.m)).reduce((s, x) => s + x.amount, 0) / (last3.length || 1)
      })

      // ── Budget par catégorie pour le mois en cours (variable uniquement) ──
      const fixedCatNames = new Set([
        'Salaire Maxime', 'Salaire Hicham', 'Loyer siège', 'Charges sociales (URSSAF)',
        'Prêts (remboursement)', 'Comptable', 'Véhicules (crédit auto)', 'Télécoms',
        'Assurances véhicule', 'Assurances santé/prévoyance', 'Logiciels & SaaS',
        'Frais bancaires', 'Impôts / TVA',
      ])
      const excludedCats = new Set([
        'Véhicules (achat)', 'Trésorerie interne', 'Apports associés',
      ])
      const budgetByCat = Object.entries(depByCat)
        .filter(([name, d]) => d.monthly >= 50 && !fixedCatNames.has(name) && !excludedCats.has(name))
        .map(([name, d]) => {
          const spent = curSorties.filter(tx => tx.category_name === name).reduce((s, tx) => s + tx.debit, 0)
          return { name, icon: d.icon, budget: Math.round(d.monthly), spent: Math.round(spent), remaining: Math.round(d.monthly - spent) }
        })
        .sort((a, b) => b.budget - a.budget)

      // ── Données graphiques ══
      // Barres entrées/sorties par mois
      const nbChartMonths = parseInt(chartPeriod) || 6
      const chartMonths = months.slice(-nbChartMonths)
      const barData = chartMonths.map(m => ({
        name: monthLabel(m),
        month: m,
        entrees: Math.round(byMonth[m].credit),
        sorties: Math.round(byMonth[m].debit),
        net: Math.round(byMonth[m].credit - byMonth[m].debit),
        isCurrent: m === currentMonthKey,
      }))

      // Camembert sorties (exclure one-shots et transferts internes)
      const pieExclude = new Set(['Véhicules (achat)', 'Trésorerie interne', 'Apports associés'])
      const pieData = Object.entries(depByCat)
        .filter(([name]) => !pieExclude.has(name))
        .map(([name, d]) => ({ name, value: Math.round(d.total), icon: d.icon }))
        .sort((a, b) => b.value - a.value)
      // Regrouper les petits (<3%)
      const totalDep = pieData.reduce((s, p) => s + p.value, 0)
      const pieMain = []
      let autresVal = 0
      pieData.forEach(p => {
        if (p.value / totalDep >= 0.03) pieMain.push(p)
        else autresVal += p.value
      })
      if (autresVal > 0) pieMain.push({ name: 'Autres', value: autresVal, icon: '📦' })

      // Donut CA
      const caDonut = [
        { name: 'Formations directes', value: Math.round(totalCAFormations) },
        { name: 'Sous-traitance', value: Math.round(totalCASousTrait) },
      ]

      // Sparklines (6 derniers mois)
      const sparkCA = activeMonths.slice(-6).map(m => ({ m, v: caByMonth[m]?.total || 0 }))
      const sparkDep = months.slice(-6).map(m => ({ m, v: byMonth[m]?.debit || 0 }))
      const sparkNet = months.slice(-6).map(m => ({ m, v: (byMonth[m]?.credit || 0) - (byMonth[m]?.debit || 0) }))

      // ── Projection trimestre ──
      const trimProjection = []
      let soldeCumul = solde
      const depFixesValidees = Object.values(chargesFixes).reduce((s, v) => s + (v.montant || 0), 0)
      for (let i = 0; i < 3; i++) {
        const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const mLabel = `${ML[String(futureDate.getMonth() + 1).padStart(2, '0')]} ${futureDate.getFullYear()}`
        const mYM = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`

        // Pipeline prévu pour ce mois
        const pipeMois = pipeline.filter(p => p.expected_month === mYM && p.status !== 'annule')
        const caPipe = pipeMois.reduce((s, p) => s + (p.amount_ht || 0), 0)

        // Sessions planifiées ce mois (si pas déjà dans pipeline)
        const sesMois = (sessionsByMonth[mYM] || []).reduce((s, ses) => s + ses.prix, 0)

        const caProj = i === 0 ? totalEntreesMois : Math.max(caLast3, caPipe + sesMois)
        const depProj = i === 0 ? totalSortiesMois : depFixesValidees
        const net = caProj - depProj
        soldeCumul += (i === 0 ? netMois : net)

        trimProjection.push({ label: mLabel, ca: caProj, dep: depProj, net: i === 0 ? netMois : net, solde: soldeCumul, isCurrent: i === 0, caPipe, sesMois })
      }
      const moisTendu = trimProjection.reduce((min, m) => m.solde < min.solde ? m : min, trimProjection[0])

      // ── Sessions & Formations à venir ──
      const courseMap = {}
      courses.forEach(c => { courseMap[c.id] = c })

      const today = new Date().toISOString().substring(0, 10)
      const futureSessions = sessions.filter(s => s.start_date >= today && s.status !== 'cancelled' && s.status !== 'draft')

      // Grouper par mois
      const sessionsByMonth = {}
      futureSessions.forEach(s => {
        const ym = s.start_date.substring(0, 7)
        if (!sessionsByMonth[ym]) sessionsByMonth[ym] = []
        const course = courseMap[s.course_id] || {}
        const prix = s.custom_price_ht || s.total_price || course.price_ht || 0
        const cli = (clients || []).find(c => c.id === s.client_id)
        sessionsByMonth[ym].push({ ...s, prix, courseName: course.title || '?', courseCode: course.code || '?', clientName: cli?.name || '?' })
      })

      const sessionsTotal = futureSessions.reduce((s, ses) => {
        const course = courseMap[ses.course_id] || {}
        return s + (ses.custom_price_ht || ses.total_price || course.price_ht || 0)
      }, 0)

      // Classement formations par rentabilité
      const formationsRank = courses.map(c => {
        const sesDone = sessions.filter(s => s.course_id === c.id && s.status !== 'cancelled' && s.status !== 'draft' && s.start_date < today)
        const nbDone = sesDone.length
        const caDone = sesDone.reduce((sum, s) => sum + (s.custom_price_ht || s.total_price || 0), 0)
        const prixMoyenRealise = nbDone > 0 ? caDone / nbDone : 0
        const prixCatalogue = c.price_ht || 0
        const margeDirecte = prixCatalogue // Marge ~100% sur formations directes
        return {
          ...c,
          nbDone, caDone, prixMoyenRealise, prixCatalogue, margeDirecte,
          sesFutures: futureSessions.filter(s => s.course_id === c.id).length
        }
      }).sort((a, b) => b.prixCatalogue - a.prixCatalogue)

      // ── Cash flow détaillé ──
      const cashFlowItems = []
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const endStr = endOfMonth.toISOString().substring(0, 10)

      // Charges fixes validées — vérifier lesquelles sont déjà débitées ce mois
      const chargesFixesMap = {
        'Salaire Maxime': { date: endStr, cats: ['Salaire Maxime'] },
        'Salaire Hicham': { date: endStr, cats: ['Salaire Hicham'] },
        'Loyer siège': { date: `${currentYearMonth}-05`, cats: ['Loyer siège'] },
        'URSSAF': { date: `${currentYearMonth}-20`, cats: ['Charges sociales (URSSAF)'] },
        'Prêts': { date: `${currentYearMonth}-09`, cats: ['Prêts (remboursement)'] },
        'Comptable': { date: `${currentYearMonth}-25`, cats: ['Comptable'] },
        'Crédit auto': { date: `${currentYearMonth}-30`, cats: ['Véhicules (crédit auto)'] },
        'Télécoms': { date: `${currentYearMonth}-26`, cats: ['Télécoms'] },
        'Assurances véhicule': { date: `${currentYearMonth}-05`, cats: ['Assurances véhicule'] },
        'Assurances santé': { date: `${currentYearMonth}-05`, cats: ['Assurances santé/prévoyance'] },
        'Logiciels & SaaS': { date: `${currentYearMonth}-15`, cats: ['Logiciels & SaaS'] },
        'Frais bancaires': { date: `${currentYearMonth}-10`, cats: ['Frais bancaires'] },
      }

      Object.entries(chargesFixes).forEach(([name, { montant, icon }]) => {
        if (!montant || montant <= 0) return
        const mapping = chargesFixesMap[name]
        if (!mapping) return
        // Vérifier si déjà débité ce mois (par catégorie)
        const dejaDebite = curSorties
          .filter(tx => mapping.cats.includes(tx.category_name))
          .reduce((s, tx) => s + tx.debit, 0)
        const reste = montant - dejaDebite
        if (reste > 50) { // seuil pour éviter les centimes
          cashFlowItems.push({ date: mapping.date >= today ? mapping.date : endStr, label: `${icon} ${name}`, montant: -reste, type: 'sortie' })
        }
      })

      // GOUYA si ce mois (fév-mai 2026) et pas encore débité
      const gouya = curSorties.filter(tx => tx.description?.includes('GOUYA'))
      if (gouya.length === 0 && now.getFullYear() === 2026 && now.getMonth() >= 1 && now.getMonth() <= 4) {
        cashFlowItems.push({ date: `${currentYearMonth}-25`, label: '🧮 GOUYA Frais juridiques', montant: -673.56, type: 'sortie' })
      }

      // Factures attendues (entrées)
      entreesAVenir.forEach(inv => {
        const cli = (clients || []).find(c => c.id === inv.client_id)
        const isOverdue = inv.due_date && inv.due_date < today
        cashFlowItems.push({ date: inv.due_date || inv.invoice_date, label: `${inv.reference} — ${cli?.name || '?'}`, montant: parseFloat(inv.amount_due), type: isOverdue ? 'retard' : 'entree' })
      })

      cashFlowItems.sort((a, b) => a.date.localeCompare(b.date))

      // Solde glissant
      let soldeGlissant = solde
      cashFlowItems.forEach(item => {
        soldeGlissant += item.montant
        item.soldeApres = soldeGlissant
      })

      // ── Recommandations auto ──
      const recos = generateRecommendations({
        unpaidInvoices, clients, depByCat, totalCAFormations, totalCASousTrait,
        budgetLibre, config, last3, caLast3, depLast3, catMap, moisTendu, solde,
        nbActive, pipeline, formationsRank, futureSessions, sessionsTotal,
        chargesFixes, totalEntreesMois, totalSortiesMois, cashFlowItems
      })

      // ── Bilan mois précédent ──
      const prevMonth = months.length >= 2 ? months[months.length - 2] : null
      let bilanPrev = null
      if (prevMonth && prevMonth !== currentMonthKey) {
        const pm = byMonth[prevMonth]
        bilanPrev = {
          month: monthLabel(prevMonth),
          entrees: pm.credit,
          sorties: pm.debit,
          net: pm.credit - pm.debit,
          ca: caByMonth[prevMonth]?.total || 0,
        }
      }

      return {
        solde, soldeAuto, byMonth, months, nbMonths,
        totalEntreesRealisees, totalSortiesRealisees, totalEntreesAVenir, totalSortiesAVenir,
        totalPipeMois, totalEntreesMois, totalSortiesMois,
        entreesAVenir, sortiesAVenir,
        netMois, soldeProjeteFin, budgetLibre,
        caByMonth, totalCAFormations, totalCASousTrait,
        caLast3, caPrev3, caTrend, depLast3, depPrev3, depTrend, margeLast3,
        fixedDetail, avgFixed, depByCat, budgetByCat,
        barData, pieMain, caDonut, sparkCA, sparkDep, sparkNet,
        trimProjection, moisTendu, recos, bilanPrev, last3, nbActive,
        sessionsByMonth, sessionsTotal, formationsRank, cashFlowItems
      }
    } catch (err) {
      console.error('PrevisionnelTab analysis error:', err)
      return {
        solde: 0, soldeAuto: 0, byMonth: {}, months: [], nbMonths: 0,
        totalEntreesRealisees: 0, totalSortiesRealisees: 0, totalEntreesAVenir: 0, totalSortiesAVenir: 0,
        totalPipeMois: 0, totalEntreesMois: 0, totalSortiesMois: 0,
        entreesAVenir: [], sortiesAVenir: [],
        netMois: 0, soldeProjeteFin: 0, budgetLibre: 0,
        caByMonth: {}, totalCAFormations: 0, totalCASousTrait: 0,
        caLast3: 0, caPrev3: 0, caTrend: 0, depLast3: 0, depPrev3: 0, depTrend: 0, margeLast3: 0,
        fixedDetail: [], avgFixed: 0, depByCat: {}, budgetByCat: [],
        barData: [], pieMain: [], caDonut: [], sparkCA: [], sparkDep: [], sparkNet: [],
        trimProjection: [], moisTendu: null, recos: [], bilanPrev: null, last3: [], nbActive: 0,
        sessionsByMonth: {}, sessionsTotal: 0, formationsRank: [], cashFlowItems: []
      }
    }
  }, [transactions, categories, unpaidInvoices, config, currentMonthKey, pipeline, chartPeriod, chargesFixes, sessions, courses, clients])

  function detectRecurringCharges(txs, months, curMonth) {
    const descMap = {}
    txs.forEach(tx => {
      if ((tx.debit || 0) <= 0) return
      const key = normalizeDesc(tx.description)
      if (!descMap[key]) descMap[key] = { description: tx.description, months: new Set(), amounts: [], catName: tx.category_name }
      descMap[key].months.add(tx.month)
      descMap[key].amounts.push(tx.debit)
    })
    return Object.values(descMap)
      .filter(d => d.months.size >= 3)
      .map(d => ({ description: d.description, montant: d.amounts.reduce((s, a) => s + a, 0) / d.amounts.length, catName: d.catName, frequence: d.months.size }))
      .sort((a, b) => b.montant - a.montant)
  }

  function generateRecommendations({ unpaidInvoices, clients, depByCat, totalCAFormations, totalCASousTrait, budgetLibre, config, last3, caLast3, depLast3, catMap, moisTendu, solde, nbActive, pipeline, formationsRank, futureSessions, sessionsTotal, chargesFixes, totalEntreesMois, totalSortiesMois, cashFlowItems }) {
    const recos = []
    const today = new Date().toISOString().substring(0, 10)
    const totalChargesFixes = Object.values(chargesFixes || {}).reduce((s, v) => s + (v.montant || 0), 0)

    // ══ URGENCE TRÉSORERIE ══
    if (totalChargesFixes > 0 && solde < totalChargesFixes) {
      recos.push({ type: 'alert', icon: '🚨', priority: 110,
        title: `Trésorerie critique : ${fmt(solde)}`,
        detail: `Charges fixes = ${fmt(totalChargesFixes)}/mois. Le solde ne couvre pas 1 mois complet. Priorité : encaisser les factures.` })
    }

    // Solde projeté négatif
    const lastCF = (cashFlowItems || []).length > 0 ? cashFlowItems[cashFlowItems.length - 1] : null
    if (lastCF && lastCF.soldeApres < 0) {
      recos.push({ type: 'alert', icon: '🔴', priority: 105,
        title: `Risque de solde négatif fin de mois : ${fmt(lastCF.soldeApres)}`,
        detail: `Sans encaissement supplémentaire, le compte passe dans le rouge. Relancer les impayés EN URGENCE.` })
    }

    // ══ FACTURES EN RETARD ══
    const overdue = unpaidInvoices.filter(inv => inv.status === 'overdue' || (inv.due_date && inv.due_date < today))
    if (overdue.length > 0) {
      const totalO = overdue.reduce((s, inv) => s + parseFloat(inv.amount_due), 0)
      const details = overdue.map(inv => {
        const cli = (clients || []).find(c => c.id === inv.client_id)
        const jours = Math.floor((new Date() - new Date(inv.due_date)) / 86400000)
        return `${cli?.name || '?'} ${fmt(parseFloat(inv.amount_due))} (+${jours}j)`
      }).join(' · ')
      recos.push({ type: 'alert', icon: '🔴', priority: 100, title: `${overdue.length} facture(s) en retard — ${fmt(totalO)}`, detail: details })
    }

    // Factures dues ce mois
    const curYM = new Date().toISOString().substring(0, 7)
    const dueThisMonth = unpaidInvoices.filter(inv => !overdue.includes(inv) && inv.due_date && inv.due_date.substring(0, 7) <= curYM)
    if (dueThisMonth.length > 0) {
      const totalD = dueThisMonth.reduce((s, inv) => s + parseFloat(inv.amount_due), 0)
      recos.push({ type: 'info', icon: '📬', priority: 70, title: `${dueThisMonth.length} facture(s) échéance ce mois — ${fmt(totalD)}`, detail: 'Suivre les virements de près' })
    }

    // ══ FORMATIONS À POUSSER ══
    if (formationsRank && formationsRank.length > 0) {
      const top = formationsRank.filter(f => f.prixCatalogue >= 690).slice(0, 3)
      if (top.length > 0) {
        const detail = top.map(f => `${f.code} = ${fmt(f.prixCatalogue)}`).join(' · ')
        const nbFutur = (futureSessions || []).length
        recos.push({ type: 'levier', icon: '🎓', priority: 85,
          title: 'Formations directes les plus rentables',
          detail: `${detail}. Actuellement ${nbFutur} session(s) planifiée(s) = ${fmt(sessionsTotal || 0)} HT. 1 SST-FI directe (1 175€) = quasi 100% de marge.` })
      }
    }

    // Sessions insuffisantes
    if ((futureSessions || []).length < 5) {
      recos.push({ type: 'levier', icon: '📅', priority: 82,
        title: `Seulement ${(futureSessions || []).length} session(s) planifiée(s)`,
        detail: `CA sessions prévu : ${fmt(sessionsTotal || 0)} HT. Planning trop vide → remplir via prospection directe (Marine).` })
    }

    // ══ RATIO SOUS-TRAITANCE ══
    const totalCA = totalCAFormations + totalCASousTrait
    if (totalCA > 0 && totalCASousTrait / totalCA > 0.5) {
      const ratio = ((totalCASousTrait / totalCA) * 100).toFixed(0)
      recos.push({ type: 'levier', icon: '📊', priority: 78,
        title: `Sous-traitance = ${ratio}% du CA`,
        detail: `Marge réduite. 1 SST directe (1 175€) rapporte autant net que 2-3 sessions sous-traitées. Marine doit cibler entreprises, pas OF.` })
    }

    // ══ CHARGES VARIABLES EN HAUSSE (ignorer les fixes et one-shots) ══
    const ignoreCats = new Set([
      'Salaire Maxime', 'Salaire Hicham', 'Loyer siège', 'Charges sociales (URSSAF)',
      'Prêts (remboursement)', 'Comptable', 'Véhicules (crédit auto)', 'Télécoms',
      'Assurances véhicule', 'Assurances santé/prévoyance', 'Logiciels & SaaS',
      'Frais bancaires', 'Impôts / TVA', 'Véhicules (achat)', 'Trésorerie interne',
      'Apports associés',
    ])
    Object.entries(depByCat).forEach(([cat, data]) => {
      if (data.monthly < 80 || !last3.length) return
      if (ignoreCats.has(cat)) return
      const info = catMap[cat] || {}
      if (info.direction === 'recette' || info.direction === 'neutre') return
      if (data.last3 > data.monthly * 1.3 && data.last3 > 150) {
        recos.push({ type: 'optimisation', icon: '💸', priority: 65,
          title: `${data.icon} ${cat} en hausse`,
          detail: `${fmt(data.last3)}/mois récent vs ${fmt(data.monthly)} moyenne (+${((data.last3 / data.monthly - 1) * 100).toFixed(0)}%)` })
      }
    })

    // Budget libre
    if (budgetLibre < 0) {
      recos.push({ type: 'alert', icon: '⚠️', priority: 90,
        title: `Budget libre négatif : ${fmt(budgetLibre)}`,
        detail: `Il manque ${fmt(Math.abs(budgetLibre))} pour rester au-dessus de la marge de sécurité (${fmt(config.marge_securite)}).` })
    }

    // Mois tendu
    if (moisTendu && moisTendu.solde < config.marge_securite && !moisTendu.isCurrent) {
      recos.push({ type: 'alert', icon: '📅', priority: 80,
        title: `${moisTendu.label} sera serré — solde ${fmt(moisTendu.solde)}`,
        detail: 'Anticiper les encaissements et limiter les dépenses.' })
    }

    // Objectif
    if (config.objectif > 0 && caLast3 > 0) {
      const gap = config.objectif - solde
      const netMens = caLast3 - depLast3
      if (gap > 0 && netMens > 0) {
        const mois = Math.ceil(gap / netMens)
        recos.push({ type: 'info', icon: '🎯', priority: 45,
          title: `Objectif ${fmt(config.objectif)} en ~${mois} mois`,
          detail: `Au rythme actuel (net ${fmt(netMens)}/mois)` })
      }
    }

    return recos.sort((a, b) => b.priority - a.priority)
  }

  // ── Chart helpers ──
  const trendArrow = (pct) => pct > 5 ? '↗️' : pct < -5 ? '↘️' : '→'
  const trendColor = (pct, inverse = false) => {
    const good = inverse ? pct < -5 : pct > 5
    return good ? 'text-green-600' : (inverse ? pct > 5 : pct < -5) ? 'text-red-600' : 'text-gray-600'
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null
    return (
      <div className="bg-white p-2 rounded shadow border text-xs">
        <div className="font-bold">{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</div>
        ))}
      </div>
    )
  }

  const MiniSparkline = ({ data, color }) => (
    <ResponsiveContainer width={80} height={24}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )

  const statusIcons = { todo: '🔘', in_progress: '🟡', done: '✅', partial: '🟠', not_applicable: '❌' }
  const statusLabels = { todo: 'À faire', in_progress: 'En cours', done: 'Fait', partial: 'Partiel', not_applicable: 'N/A' }
  const statusCycle = ['todo', 'in_progress', 'partial', 'done', 'not_applicable']

  const filteredActions = actions.filter(a => {
    if (actionFilter === 'active') return !['done', 'not_applicable'].includes(a.status)
    if (actionFilter === 'done') return ['done', 'not_applicable'].includes(a.status)
    return true
  })
  const doneCount = actions.filter(a => a.status === 'done').length

  // ══ RENDU ══
  return (
    <div className="space-y-4">

      {/* ══ BLOC 1 — Situation actuelle ══ */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">🏦 Situation — {ML[currentMonthKey.split('/')[0]]} {now.getFullYear()}</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
            analysis.budgetLibre > 1000 ? 'bg-green-400/30 text-green-100' :
            analysis.budgetLibre > 0 ? 'bg-amber-400/30 text-amber-100' :
            'bg-red-400/30 text-red-100'
          }`}>
            {analysis.budgetLibre > 1000 ? '✅ Confortable' : analysis.budgetLibre > 0 ? '⚠️ Attention' : '🔴 Critique'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs opacity-70">Solde {config.solde_override !== '' ? '(manuel)' : '(calculé)'}</div>
            <div className="font-bold text-xl">{fmt(analysis.solde)}</div>
            {config.solde_override !== '' && <div className="text-xs opacity-50">Auto : {fmt(analysis.soldeAuto)}</div>}
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs opacity-70">Solde projeté fin de mois</div>
            <div className={`font-bold text-xl ${analysis.soldeProjeteFin >= config.marge_securite ? '' : 'text-red-300'}`}>{fmt(analysis.soldeProjeteFin)}</div>
          </div>
          <div className={`rounded-lg p-3 ${analysis.budgetLibre > 1000 ? 'bg-green-500/30' : analysis.budgetLibre > 0 ? 'bg-amber-500/30' : 'bg-red-500/30'}`}>
            <div className="text-xs opacity-70">💰 Budget libre</div>
            <div className="font-bold text-xl">{fmt(analysis.budgetLibre)}</div>
            <div className="text-xs opacity-60">Dépensable sans risque</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-xs opacity-70">🎯 Objectif</div>
            <div className="font-bold text-xl">{fmt(config.objectif)}</div>
          </div>
        </div>
        {config.objectif > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1 opacity-70">
              <span>{fmt(analysis.solde)}</span>
              <span>Gap : {fmt(Math.max(0, config.objectif - analysis.solde))}</span>
              <span>{fmt(config.objectif)}</span>
            </div>
            <div className="bg-white/20 rounded-full h-2.5">
              <div className="rounded-full h-2.5 bg-green-400 transition-all"
                style={{ width: `${Math.min(100, Math.max(2, (analysis.solde / config.objectif) * 100))}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Paramètres */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <details>
          <summary className="font-bold text-gray-700 cursor-pointer hover:text-blue-600">⚙️ Paramètres</summary>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div>
              <label className="text-xs text-gray-500">Solde réel (€) <span className="text-gray-300">vide = auto</span></label>
              <input type="number" value={config.solde_override} placeholder={`Auto: ${analysis.soldeAuto}`}
                onChange={e => updateConfig('solde_override', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Objectif fin d'année (€)</label>
              <input type="number" value={config.objectif} onChange={e => updateConfig('objectif', +e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Marge de sécurité (€)</label>
              <input type="number" value={config.marge_securite} onChange={e => updateConfig('marge_securite', +e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
            </div>
          </div>
        </details>
      </div>

      {/* ══ BLOC 2 — Mois en cours ══ */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-bold text-gray-700">📅 {ML[currentMonthKey.split('/')[0]]} {now.getFullYear()} — Réalisé vs À venir</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-4 gap-4 text-center text-sm">
            <div></div>
            <div className="font-medium text-gray-500">✅ Réalisé</div>
            <div className="font-medium text-gray-500">⏳ À venir</div>
            <div className="font-medium text-gray-700">Total mois</div>

            <div className="text-left font-medium text-green-700">🟢 Entrées</div>
            <div className="font-mono text-green-600">{fmt(analysis.totalEntreesRealisees)}</div>
            <div className="font-mono text-green-500">{fmt(analysis.totalEntreesAVenir + analysis.totalPipeMois)}</div>
            <div className="font-mono font-bold text-green-700">{fmt(analysis.totalEntreesMois)}</div>

            <div className="text-left font-medium text-red-700">🔴 Sorties</div>
            <div className="font-mono text-red-600">{fmt(analysis.totalSortiesRealisees)}</div>
            <div className="font-mono text-red-500">{fmt(analysis.totalSortiesAVenir)}</div>
            <div className="font-mono font-bold text-red-700">{fmt(analysis.totalSortiesMois)}</div>

            <div className="text-left font-bold text-gray-700 border-t pt-2">Net</div>
            <div className={`font-mono font-bold border-t pt-2 ${(analysis.totalEntreesRealisees - analysis.totalSortiesRealisees) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {fmt(analysis.totalEntreesRealisees - analysis.totalSortiesRealisees)}
            </div>
            <div className="font-mono border-t pt-2 text-gray-500">
              {fmt((analysis.totalEntreesAVenir + analysis.totalPipeMois) - analysis.totalSortiesAVenir)}
            </div>
            <div className={`font-mono font-bold text-lg border-t pt-2 ${analysis.netMois >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {analysis.netMois >= 0 ? '+' : ''}{fmt(analysis.netMois)}
            </div>
          </div>

          {/* Détails dépliables */}
          {analysis.entreesAVenir.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">📬 {analysis.entreesAVenir.length} facture(s) en attente</summary>
              <div className="mt-2 space-y-1">
                {analysis.entreesAVenir.map(inv => {
                  const cli = (clients || []).find(c => c.id === inv.client_id)
                  const isOD = inv.due_date && inv.due_date < new Date().toISOString().substring(0, 10)
                  return (
                    <div key={inv.id} className={`flex justify-between text-xs px-2 py-1 rounded ${isOD ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      <span>{inv.reference} — {cli?.name || '?'} {isOD && <b>⚠️ RETARD</b>}</span>
                      <span className="font-mono font-bold">{fmt(parseFloat(inv.amount_due))}</span>
                    </div>
                  )
                })}
              </div>
            </details>
          )}

          {analysis.sortiesAVenir.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">📋 {analysis.sortiesAVenir.length} charge(s) fixe(s) restante(s) ce mois</summary>
              <div className="mt-2 space-y-1">
                {analysis.sortiesAVenir.map((r, i) => (
                  <div key={i} className="flex justify-between text-xs px-2 py-1 rounded bg-red-50 text-red-700">
                    <span>{r.icon} {r.description} <span className="text-gray-400">(débité {fmt(r.deja)} / {fmt(r.attendu)})</span></span>
                    <span className="font-mono font-medium">reste ~{fmt(r.montant)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Budget par catégorie */}
          {analysis.budgetByCat.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">📊 Budget par catégorie ce mois</summary>
              <div className="mt-2 space-y-1.5">
                {analysis.budgetByCat.slice(0, 8).map((b, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex justify-between mb-0.5">
                      <span>{b.icon} {b.name}</span>
                      <span className={`font-mono ${b.remaining < 0 ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                        {fmt(b.spent)} / ~{fmt(b.budget)} {b.remaining < 0 && '⚠️'}
                      </span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-1.5">
                      <div className={`rounded-full h-1.5 ${b.remaining < 0 ? 'bg-red-500' : b.spent / b.budget > 0.8 ? 'bg-amber-400' : 'bg-green-400'}`}
                        style={{ width: `${Math.min(100, (b.spent / b.budget) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Bilan mois précédent */}
      {analysis.bilanPrev && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-700">📋 Bilan {analysis.bilanPrev.month}</h4>
            <span className={`text-sm font-bold ${analysis.bilanPrev.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Net : {analysis.bilanPrev.net >= 0 ? '+' : ''}{fmt(analysis.bilanPrev.net)}
            </span>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span>CA : {fmt(analysis.bilanPrev.ca)}</span>
            <span>Entrées : {fmt(analysis.bilanPrev.entrees)}</span>
            <span>Sorties : {fmt(analysis.bilanPrev.sorties)}</span>
          </div>
        </div>
      )}

      {/* ══ CASH FLOW — Mouvements prévus ══ */}
      {analysis.cashFlowItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="font-bold text-gray-700">💧 Cash flow — mouvements prévus</h3>
          </div>
          <div className="p-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400 px-2 mb-1">
                <span>Solde actuel</span>
                <span className="font-mono font-bold text-gray-700">{fmt(analysis.solde)}</span>
              </div>
              {analysis.cashFlowItems.map((item, i) => (
                <div key={i} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                  item.type === 'retard' ? 'bg-red-50 border-l-2 border-red-400' :
                  item.type === 'entree' ? 'bg-green-50 border-l-2 border-green-400' :
                  'bg-gray-50 border-l-2 border-gray-300'
                }`}>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-gray-400 w-16">{item.date.substring(5)}</span>
                    <span className={item.type === 'retard' ? 'text-red-700 font-medium' : ''}>{item.label}</span>
                    {item.type === 'retard' && <span className="text-red-500 text-xs">⚠️ retard</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-medium ${item.montant >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.montant >= 0 ? '+' : ''}{fmt(item.montant)}
                    </span>
                    <span className={`font-mono text-xs w-20 text-right ${item.soldeApres < 0 ? 'text-red-700 font-bold' : item.soldeApres < 2000 ? 'text-amber-600' : 'text-gray-500'}`}>
                      → {fmt(item.soldeApres)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {analysis.cashFlowItems.some(i => i.soldeApres < 0) && (
              <div className="mt-3 p-2 bg-red-100 rounded-lg text-xs text-red-800 font-medium text-center">
                ⚠️ Le solde passe dans le rouge — les encaissements doivent arriver AVANT les prélèvements
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ BLOC 3 — Tendances & Graphiques ══ */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-700">📈 Tendances</h3>
          <div className="flex gap-1">
            {['6', '12'].map(p => (
              <button key={p} onClick={() => setChartPeriod(p)}
                className={`text-xs px-2 py-1 rounded ${chartPeriod === p ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-400 hover:bg-gray-100'}`}>
                {p} mois
              </button>
            ))}
          </div>
        </div>

        {/* KPIs avec sparklines */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">CA moyen</div>
                <div className="font-bold text-lg text-green-700">{fmt(analysis.caLast3)}</div>
                <div className={`text-xs font-medium ${trendColor(analysis.caTrend)}`}>
                  {trendArrow(analysis.caTrend)} {analysis.caTrend > 0 ? '+' : ''}{analysis.caTrend.toFixed(0)}%
                </div>
              </div>
              <MiniSparkline data={analysis.sparkCA} color="#16a34a" />
            </div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Dépenses</div>
                <div className="font-bold text-lg text-red-700">{fmt(analysis.depLast3)}</div>
                <div className={`text-xs font-medium ${trendColor(analysis.depTrend, true)}`}>
                  {trendArrow(analysis.depTrend)} {analysis.depTrend > 0 ? '+' : ''}{analysis.depTrend.toFixed(0)}%
                </div>
              </div>
              <MiniSparkline data={analysis.sparkDep} color="#dc2626" />
            </div>
          </div>
          <div className={`p-3 rounded-lg ${analysis.margeLast3 >= 0 ? 'bg-blue-50' : 'bg-amber-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Marge nette</div>
                <div className={`font-bold text-lg ${analysis.margeLast3 >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(analysis.margeLast3)}</div>
                <div className="text-xs text-gray-400">/mois</div>
              </div>
              <MiniSparkline data={analysis.sparkNet} color={analysis.margeLast3 >= 0 ? '#2563eb' : '#dc2626'} />
            </div>
          </div>
        </div>

        {/* Graphique barres */}
        {analysis.barData.length > 0 && (
          <div className="mb-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analysis.barData} barCategoryGap="20%">
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="entrees" name="Entrées" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="sorties" name="Sorties" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Donut charts côte à côte */}
        <div className="grid grid-cols-2 gap-4">
          {/* Camembert dépenses */}
          {analysis.pieMain.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1 text-center">Répartition sorties</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={analysis.pieMain} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {analysis.pieMain.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Donut CA */}
          {(analysis.caDonut[0]?.value > 0 || analysis.caDonut[1]?.value > 0) && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1 text-center">Répartition CA</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={analysis.caDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    <Cell fill="#22c55e" />
                    <Cell fill="#3b82f6" />
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center text-xs mt-1">
                <span className="text-green-600 font-medium">Direct {analysis.totalCAFormations + analysis.totalCASousTrait > 0 ? ((analysis.totalCAFormations / (analysis.totalCAFormations + analysis.totalCASousTrait)) * 100).toFixed(0) : 0}%</span>
                {' '}/{' '}
                <span className="text-blue-600 font-medium">Sous-traitance {analysis.totalCAFormations + analysis.totalCASousTrait > 0 ? ((analysis.totalCASousTrait / (analysis.totalCAFormations + analysis.totalCASousTrait)) * 100).toFixed(0) : 0}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Projection trimestre */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-bold text-gray-700 mb-2">🗓️ Projection trimestre</h4>
          <div className="grid grid-cols-3 gap-2">
            {analysis.trimProjection.map((m, i) => (
              <div key={i} className={`p-3 rounded-lg border ${m.isCurrent ? 'border-blue-400 bg-blue-50' : 'border-gray-200'} ${m === analysis.moisTendu && m.solde < config.marge_securite ? 'ring-2 ring-red-300' : ''}`}>
                <div className="text-xs font-medium text-gray-500">{m.label} {m.isCurrent && <span className="text-blue-600">← en cours</span>}</div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-green-600">CA: {fmt(m.ca)}</span>
                  <span className="text-xs text-red-600">Dép: {fmt(m.dep)}</span>
                </div>
                {m.caPipe > 0 && <div className="text-xs text-purple-500">dont pipeline: {fmt(m.caPipe)}</div>}
                <div className={`font-bold text-sm mt-1 ${m.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  Net: {m.net >= 0 ? '+' : ''}{fmt(m.net)}
                </div>
                <div className={`text-xs mt-0.5 ${m.solde >= config.marge_securite ? 'text-blue-600' : 'text-red-600'}`}>
                  Solde: {fmt(m.solde)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ BLOC 4 — Pipeline ══ */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-700">📋 Pipeline — CA prévu</h3>
            <span className="text-xs text-gray-400">
              {pipeline.filter(p => p.source === 'auto').length} devis · {pipeline.filter(p => p.source === 'manual').length} manuels
            </span>
          </div>
          <button onClick={() => setShowPipeForm(f => !f)} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200">
            {showPipeForm ? '✕ Fermer' : '+ Manuel'}
          </button>
        </div>

        {showPipeForm && (
          <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <input type="text" placeholder="Client" value={newPipe.client} onChange={e => setNewPipe(p => ({ ...p, client: e.target.value }))}
                className="border rounded px-2 py-1.5 text-xs" />
              <input type="number" placeholder="Montant TTC" value={newPipe.amount_ttc} onChange={e => setNewPipe(p => ({ ...p, amount_ttc: e.target.value }))}
                className="border rounded px-2 py-1.5 text-xs" />
              <input type="month" value={newPipe.expected_month} onChange={e => setNewPipe(p => ({ ...p, expected_month: e.target.value }))}
                className="border rounded px-2 py-1.5 text-xs" />
              <select value={newPipe.trainer} onChange={e => setNewPipe(p => ({ ...p, trainer: e.target.value }))}
                className="border rounded px-2 py-1.5 text-xs">
                <option>Hicham</option><option>Maxime</option>
              </select>
              <button onClick={addPipeEntry} className="bg-blue-600 text-white rounded px-3 py-1.5 text-xs hover:bg-blue-700">Ajouter</button>
            </div>
            <input type="text" placeholder="Description (optionnel)" value={newPipe.description} onChange={e => setNewPipe(p => ({ ...p, description: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs w-full mt-2" />
          </div>
        )}

        {pipeline.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-xs">Les devis envoyés/acceptés apparaîtront ici automatiquement</div>
        ) : (
          <div className="space-y-1">
            {pipeline.sort((a, b) => (a.expected_month || '').localeCompare(b.expected_month || '')).map(p => (
              <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                p.source === 'auto' ? 'bg-blue-50/50' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-2 flex-1">
                  <span className={`w-2 h-2 rounded-full ${
                    p.status === 'facture' ? 'bg-green-500' : 
                    p.status === 'confirme' ? 'bg-blue-500' : 
                    'bg-amber-500'
                  }`} />
                  {p.source === 'auto' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      p.quote_status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {p.quote_status === 'accepted' ? '✅' : '📤'} {p.quote_ref}
                    </span>
                  )}
                  {p.source === 'manual' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">✋ manuel</span>
                  )}
                  <span className="font-medium">{p.client}</span>
                  {p.description && <span className="text-gray-400 truncate max-w-48">— {p.description}</span>}
                  <span className="text-gray-400">{p.expected_month || '?'}</span>
                  {p.trainer && <span className="text-gray-400">{p.trainer}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{fmt(p.amount_ht)} HT</span>
                  {p.source === 'manual' ? (
                    <>
                      <select value={p.status} onChange={e => updatePipeStatus(p.id, e.target.value)}
                        className="border rounded px-1 py-0.5 text-xs bg-white">
                        <option value="prevu">Prévu</option>
                        <option value="confirme">Confirmé</option>
                        <option value="facture">Facturé</option>
                        <option value="annule">Annulé</option>
                      </select>
                      <button onClick={() => deletePipe(p.id)} className="text-red-400 hover:text-red-600">✕</button>
                    </>
                  ) : (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      p.quote_status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>{p.quote_status === 'accepted' ? 'Accepté' : 'Envoyé'}</span>
                  )}
                </div>
              </div>
            ))}
            <div className="text-right text-xs text-gray-500 pt-1">
              Total pipeline : <b>{fmt(pipeline.reduce((s, p) => s + (p.amount_ht || 0), 0))} HT</b>
              {pipeline.filter(p => p.source === 'auto').length > 0 && (
                <span className="ml-2">
                  (dont <span className="text-green-600">{fmt(pipeline.filter(p => p.source === 'auto').reduce((s, p) => s + (p.amount_ht || 0), 0))}</span> devis acceptés)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ BLOC 5 — Recommandations auto ══ */}
      {analysis.recos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-bold text-gray-700 mb-3">🧠 Recommandations</h3>
          <div className="space-y-2">
            {analysis.recos.map((reco, i) => (
              <div key={i} className={`p-3 rounded-lg border-l-4 ${
                reco.type === 'alert' ? 'bg-red-50 border-red-500' :
                reco.type === 'optimisation' ? 'bg-amber-50 border-amber-500' :
                reco.type === 'levier' ? 'bg-blue-50 border-blue-500' :
                'bg-green-50 border-green-500'
              }`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{reco.icon}</span>
                  <div>
                    <div className="font-medium text-sm text-gray-800">{reco.title}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{reco.detail}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ BLOC 5b — Formations à pousser ══ */}
      {analysis.formationsRank.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-bold text-gray-700 mb-3">🎓 Formations — Classement rentabilité</h3>
          <div className="space-y-2">
            {analysis.formationsRank.map((f, i) => {
              const ratio = f.prixCatalogue > 0 && f.prixMoyenRealise > 0 ? ((f.prixMoyenRealise / f.prixCatalogue) * 100).toFixed(0) : null
              const isTop = f.prixCatalogue >= 690
              return (
                <div key={f.id || i} className={`p-3 rounded-lg border ${isTop ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${isTop ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{f.code}</span>
                      <span className="text-sm font-medium text-gray-800">{f.title}</span>
                    </div>
                    <span className="font-mono font-bold text-green-700">{fmt(f.prixCatalogue)} HT</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span>{f.nbDone} session(s) réalisée(s)</span>
                    {f.nbDone > 0 && <span>Prix moyen réalisé : {fmt(f.prixMoyenRealise)} {ratio && ratio < 80 ? <span className="text-amber-600">(⚠️ {ratio}% du tarif)</span> : ''}</span>}
                    {f.sesFutures > 0 && <span className="text-blue-600">{f.sesFutures} à venir</span>}
                    {isTop && f.sesFutures === 0 && f.nbDone < 3 && <span className="text-red-500 font-medium">→ À développer !</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-800">
            💡 <b>Stratégie :</b> Prioriser SST-FI (1 175€), R489/R485 (785€) et B0H0V (775€) en vente directe. 
            Les formations à 345-350€ (extincteurs, IGPS) sont idéales en pack combiné pour augmenter le panier moyen.
          </div>
        </div>
      )}

      {/* ══ BLOC 5c — Sessions planifiées ══ */}
      {Object.keys(analysis.sessionsByMonth).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-700">📆 Sessions planifiées</h3>
            <span className="text-sm font-mono font-bold text-green-700">{fmt(analysis.sessionsTotal)} HT</span>
          </div>
          {Object.entries(analysis.sessionsByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([ym, sesList]) => {
            const [y, m] = ym.split('-')
            const total = sesList.reduce((s, ses) => s + ses.prix, 0)
            return (
              <div key={ym} className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-gray-600">{ML[m]} {y}</span>
                  <span className="text-xs font-mono text-gray-500">{sesList.length} session(s) — {fmt(total)} HT</span>
                </div>
                <div className="space-y-1">
                  {sesList.map(ses => (
                    <div key={ses.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">{ses.start_date.substring(5)}</span>
                        <span className="font-medium">{ses.courseCode}</span>
                        <span className="text-gray-500">— {ses.clientName}</span>
                      </div>
                      <span className="font-mono font-medium text-green-600">{fmt(ses.prix)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ BLOC 6 — Plan d'action ══ */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-700">📝 Plan d'action</h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{doneCount}/{actions.length} fait{doneCount > 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[{ k: 'active', l: 'En cours' }, { k: 'done', l: 'Faits' }, { k: 'all', l: 'Tous' }].map(f => (
                <button key={f.k} onClick={() => setActionFilter(f.k)}
                  className={`text-xs px-2 py-1 rounded ${actionFilter === f.k ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}>{f.l}</button>
              ))}
            </div>
            <button onClick={() => setShowActionForm(f => !f)}
              className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200">
              {showActionForm ? '✕' : '+ Ajouter'}
            </button>
          </div>
        </div>

        {showActionForm && (
          <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input type="text" placeholder="Titre de l'action" value={newAction.title} onChange={e => setNewAction(a => ({ ...a, title: e.target.value }))}
                className="border rounded px-2 py-1.5 text-xs col-span-2" />
              <select value={newAction.category} onChange={e => setNewAction(a => ({ ...a, category: e.target.value }))}
                className="border rounded px-2 py-1.5 text-xs">
                <option value="general">Général</option>
                <option value="tresorerie">Trésorerie</option>
                <option value="charges">Charges</option>
                <option value="ca">CA / Ventes</option>
              </select>
              <input type="number" placeholder="Impact €/mois" value={newAction.impact_monthly} onChange={e => setNewAction(a => ({ ...a, impact_monthly: e.target.value }))}
                className="border rounded px-2 py-1.5 text-xs" />
            </div>
            <div className="flex gap-2 mt-2">
              <input type="text" placeholder="Détail (optionnel)" value={newAction.detail} onChange={e => setNewAction(a => ({ ...a, detail: e.target.value }))}
                className="border rounded px-2 py-1.5 text-xs flex-1" />
              <input type="date" value={newAction.due_date} onChange={e => setNewAction(a => ({ ...a, due_date: e.target.value }))}
                className="border rounded px-2 py-1.5 text-xs" />
              <button onClick={addAction} className="bg-blue-600 text-white rounded px-4 py-1.5 text-xs hover:bg-blue-700">Ajouter</button>
            </div>
          </div>
        )}

        {filteredActions.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-xs">
            {actionFilter === 'done' ? 'Aucune action terminée' : 'Aucune action en cours — ajoutez-en !'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredActions.map(action => (
              <div key={action.id} className={`p-3 rounded-lg border transition-all ${
                action.status === 'done' ? 'bg-green-50/50 border-green-200 opacity-60' :
                action.status === 'in_progress' ? 'bg-blue-50 border-blue-200' :
                action.status === 'not_applicable' ? 'bg-gray-50 border-gray-200 opacity-40' :
                'bg-white border-gray-200'
              }`}>
                <div className="flex items-start gap-2">
                  <button onClick={() => {
                    const idx = statusCycle.indexOf(action.status)
                    const next = statusCycle[(idx + 1) % statusCycle.length]
                    updateActionStatus(action.id, next)
                  }} className="text-lg mt-0.5 hover:scale-110 transition-transform" title="Cliquer pour changer le statut">
                    {statusIcons[action.status]}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${action.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{action.title}</span>
                      <span className="text-xs text-gray-300">{statusLabels[action.status]}</span>
                      {action.impact_monthly > 0 && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{fmt(action.impact_monthly)}/mois</span>}
                      {action.due_date && <span className="text-xs text-gray-400">{action.due_date}</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        action.category === 'tresorerie' ? 'bg-purple-100 text-purple-600' :
                        action.category === 'charges' ? 'bg-red-100 text-red-600' :
                        action.category === 'ca' ? 'bg-green-100 text-green-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>{action.category}</span>
                    </div>
                    {action.detail && <div className="text-xs text-gray-500 mt-0.5">{action.detail}</div>}
                    {/* Mini note éditable */}
                    <input type="text" placeholder="Ajouter un commentaire..." value={action.note || ''}
                      onChange={e => updateActionNote(action.id, e.target.value)}
                      className="text-xs border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-300 w-full mt-1 px-0 py-0.5 bg-transparent focus:outline-none focus:ring-0" />
                  </div>
                  <button onClick={() => deleteAction(action.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Résumé impact */}
        {actions.filter(a => a.status === 'done' && a.impact_monthly > 0).length > 0 && (
          <div className="mt-3 p-2 bg-green-50 rounded-lg border border-green-200 text-xs text-green-700 flex justify-between">
            <span>💰 Impact des actions réalisées</span>
            <span className="font-bold">{fmt(actions.filter(a => a.status === 'done' && a.impact_monthly > 0).reduce((s, a) => s + a.impact_monthly, 0))}/mois</span>
          </div>
        )}
      </div>

      {/* ══ Détail charges fixes ══ */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <details>
          <summary className="font-bold text-gray-700 cursor-pointer hover:text-blue-600">
            📋 Charges fixes validées — {fmt(analysis.avgFixed)}/mois
          </summary>
          <p className="text-xs text-gray-400 mt-2 mb-3">Montants réels validés. Cliquer sur un montant pour modifier.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {analysis.fixedDetail.map((c, i) => {
              const settingsKey = Object.entries(chargesFixes).find(([name]) => name === c.name)?.[0]
              const dbKey = settingsKey ? 'charge_' + {
                'Salaire Maxime': 'salaire_maxime', 'Salaire Hicham': 'salaire_hicham',
                'Loyer siège': 'loyer', 'URSSAF': 'urssaf', 'Prêts': 'prets',
                'Comptable': 'comptable', 'Crédit auto': 'credit_auto', 'Télécoms': 'telecoms',
                'Assurances véhicule': 'assurance_vehicule', 'Assurances santé': 'assurance_sante',
                'Logiciels & SaaS': 'logiciels', 'Frais bancaires': 'frais_bancaires',
              }[c.name] : null
              return (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <span>{c.icon}</span>
                  <div className="flex-1 text-xs text-gray-700">{c.name}</div>
                  <input type="number" value={c.monthly} 
                    onChange={e => {
                      const val = +e.target.value
                      setChargesFixes(prev => ({ ...prev, [c.name]: { ...prev[c.name], montant: val } }))
                      if (dbKey) saveConfig(dbKey, val)
                    }}
                    className="w-20 text-right font-mono text-sm font-bold text-red-600 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none px-1 py-0.5" />
                </div>
              )
            })}
          </div>
          <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 flex justify-between items-center">
            <span className="font-bold text-red-800">Total charges fixes mensuelles</span>
            <span className="font-mono text-xl font-bold text-red-700">{fmt(analysis.avgFixed)}</span>
          </div>
        </details>
      </div>
    </div>
  )
}

// CLIENT SEARCH — Recherche intelligente pour rapprochement
// ════════════════════════════════════════════════════════════
function ClientSearchForMatch({ clients: clientsProp, invoices: invoicesProp, unpaidInvoices, bankDescription, onSelect }) {
  const [search, setSearch] = useState('')
  const [localClients, setLocalClients] = useState([])
  const [localInvoices, setLocalInvoices] = useState([])
  const [loaded, setLoaded] = useState(false)

  // Fallback : charger les données directement si les props sont vides
  useEffect(() => {
    async function loadDirect() {
      if (clientsProp?.length > 0 && invoicesProp?.length > 0) {
        setLocalClients(clientsProp)
        setLocalInvoices(invoicesProp)
        setLoaded(true)
        return
      }
      console.log('[ClientSearch] Props vides, chargement direct...', { clientsProp: clientsProp?.length, invoicesProp: invoicesProp?.length })
      const [cR, iR] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('invoices').select('*').order('invoice_date', { ascending: false }),
      ])
      if (cR.data) setLocalClients(cR.data)
      if (iR.data) setLocalInvoices(iR.data)
      setLoaded(true)
      console.log('[ClientSearch] Chargé:', cR.data?.length, 'clients,', iR.data?.length, 'factures')
    }
    loadDirect()
  }, [clientsProp, invoicesProp])

  const clients = localClients.length > 0 ? localClients : (clientsProp || [])
  const invoices = localInvoices.length > 0 ? localInvoices : (invoicesProp || [])

  const localUnpaid = useMemo(() =>
    invoices.filter(inv => inv.type !== 'credit_note' && ['sent', 'due', 'overdue', 'partial'].includes(inv.status) && parseFloat(inv.amount_due) > 0),
    [invoices]
  )

  // Normalise accents + majuscules : "opé" → "OPE", "OPÉRATEUR" → "OPERATEUR"
  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

  // Extraire des mots-clés utiles du libellé bancaire
  const bankWords = useMemo(() => {
    const desc = norm(bankDescription)
    return desc
      .replace(/VIR\b|CHQ\b|PRLV\b|REM\b|SEPA|INST|BRET|FACT[-\d]*|\d{5,}|[,.]?\d+[,.]\d+|\b\d+\b/g, ' ')
      .split(/[\s\-_\/]+/)
      .filter(w => w.length >= 3)
      .filter((w, i, arr) => arr.indexOf(w) === i)
  }, [bankDescription])

  // Scoring de pertinence pour chaque client
  const scoredClients = useMemo(() => {
    const s = norm(search)
    const searchWords = s ? s.split(/\s+/).filter(w => w.length >= 2) : []

    return clients.map(c => {
      const name = norm(c.name)
      const nameWords = name.split(/[\s\-_]+/)
      let score = 0

      // Score basé sur la recherche utilisateur
      if (s) {
        if (name.includes(s)) score += 100
        if (name.startsWith(s)) score += 50
        for (const sw of searchWords) {
          if (name.includes(sw)) score += 30
          if (sw.length >= 3 && nameWords.some(nw => nw.startsWith(sw))) score += 20
        }
      }

      // Score basé sur les mots du libellé bancaire
      for (const bw of bankWords) {
        if (name.includes(bw)) score += 20
        if (nameWords.some(nw => nw === bw)) score += 10
      }

      // Bonus si factures
      const unpaidCount = localUnpaid.filter(inv => inv.client_id === c.id).length
      const allInvCount = invoices.filter(inv => inv.client_id === c.id).length
      if (unpaidCount > 0) score += 15
      if (allInvCount > 0) score += 5

      return { ...c, score, unpaidCount, allInvCount }
    })
    .filter(c => {
      if (!s) return c.allInvCount > 0 || c.score > 0
      return c.score > 0
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
  }, [clients, search, bankWords, invoices, localUnpaid])

  return (
    <div>
      <p className="text-sm text-gray-700 mb-2">Sélectionnez le client : <span className="text-xs text-gray-400">({clients.length} clients chargés)</span></p>

      {!loaded && <div className="text-center py-4 text-gray-400 text-sm">⏳ Chargement des clients...</div>}

      {bankWords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="text-xs text-gray-400">Mots détectés :</span>
          {bankWords.slice(0, 8).map((w, i) => (
            <button key={i} onClick={() => setSearch(w)}
              className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-100 cursor-pointer">{w}</button>
          ))}
        </div>
      )}

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher un client (nom, mot-clé)..."
        className="w-full border-2 border-blue-300 rounded-lg px-3 py-2 text-sm mb-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" autoFocus />

      <div className="max-h-64 overflow-y-auto space-y-1">
        {scoredClients.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <p className="text-sm">{search ? `Aucun client trouvé pour "${search}"` : 'Aucun client trouvé'}</p>
            <p className="text-xs mt-1">Tapez un nom ou un mot du libellé bancaire</p>
          </div>
        ) : (
          scoredClients.map(c => (
            <button key={c.id} onClick={() => onSelect(c.id)}
              className={`w-full text-left p-2.5 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-sm
                ${c.score >= 20 ? 'border-blue-200 bg-blue-50/50' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                <div className="flex gap-1">
                  {c.score >= 20 && !search && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">🎯 suggestion</span>}
                  {c.unpaidCount > 0 && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{c.unpaidCount} en attente</span>}
                  {c.unpaidCount === 0 && c.allInvCount > 0 && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{c.allInvCount} fact.</span>}
                </div>
              </div>
              {c.city && <span className="text-xs text-gray-400">{c.city}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

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
