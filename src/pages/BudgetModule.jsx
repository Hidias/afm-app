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

const fmt = (n) => n ? Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '-'
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

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [txR, catR, ruleR, rcpR] = await Promise.all([
      supabase.from('budget_transactions').select('*').order('date', { ascending: false }),
      supabase.from('budget_categories').select('*').order('sort_order'),
      supabase.from('budget_rules').select('*, budget_categories(name, icon)').order('keyword'),
      supabase.from('budget_receipts').select('*'),
    ])
    if (txR.data) setTransactions(txR.data)
    if (catR.data) setCategories(catR.data)
    if (ruleR.data) setRules(ruleR.data)
    if (rcpR.data) {
      const map = {}
      rcpR.data.forEach(r => { if (!map[r.transaction_id]) map[r.transaction_id] = []; map[r.transaction_id].push(r) })
      setReceipts(map)
    }
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
    setTransactions(p => p.filter(t => t.id !== txId)); toast.success('Supprimé')
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-800">💰 Budget & Trésorerie</h1>
          <span className="text-xs text-gray-400">{transactions.length} opérations</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <KPI label="Entrées" value={fmt(stats.totalCredit)} color="green" />
          <KPI label="Sorties" value={fmt(stats.totalDebit)} color="red" />
          <KPI label="Balance" value={fmt(stats.totalCredit - stats.totalDebit)} color={stats.totalCredit - stats.totalDebit >= 0 ? 'green' : 'red'} />
          <KPI label="Non classés" value={stats.unclassified} color={stats.unclassified > 0 ? 'amber' : 'green'} />
          <KPI label="CCA Hicham" value={stats.compteHicham > 0 ? fmt(stats.compteHicham) : '0 €'} color={stats.compteHicham > 0 ? 'purple' : 'gray'} sub="dette gérant" />
          <KPI label="CCA Maxime" value={stats.compteMaxime > 0 ? fmt(stats.compteMaxime) : '0 €'} color={stats.compteMaxime > 0 ? 'purple' : 'gray'} sub="dette gérant" />
          <KPI label="À envoyer" value={stats.notSent} color={stats.notSent > 0 ? 'blue' : 'gray'} sub="comptable" />
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap
              ${tab === t.key ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
            {t.key === 'comptable' && stats.notSent > 0 && <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5">{stats.notSent}</span>}
            {t.key === 'categorisation' && stats.unclassified > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5">{stats.unclassified}</span>}
          </button>
        ))}
      </div>

      {tab === 'transactions' && <TransactionsTab {...{ filtered, categories, months, filterMonth, setFilterMonth, filterCat, setFilterCat, filterDir, setFilterDir, filterSearch, setFilterSearch, showPerso, setShowPerso, editingTx, setEditingTx, changeCategory, deleteTx, receipts }} />}
      {tab === 'saisie' && <SaisieTab categories={categories} rules={rules} loadAll={loadAll} />}
      {tab === 'dashboard' && <DashboardTab stats={stats} months={months} categories={categories} />}
      {tab === 'categorisation' && <CategorisationIATab transactions={transactions} categories={categories} rules={rules} loadAll={loadAll} />}
      {tab === 'previsionnel' && <PrevisionnelTab transactions={transactions} categories={categories} />}
      {tab === 'comptable' && <ComptableTab transactions={transactions} receipts={receipts} loadAll={loadAll} />}
      {tab === 'categories' && <CategoriesTab categories={categories} loadAll={loadAll} />}
      {tab === 'rules' && <RulesTab rules={rules} categories={categories} loadAll={loadAll} />}
      {tab === 'import' && <ImportTab loadAll={loadAll} categories={categories} rules={rules} />}
    </div>
  )
}

function KPI({ label, value, color = 'blue', sub }) {
  const c = { green:'text-green-700 bg-green-50 border-green-200', red:'text-red-700 bg-red-50 border-red-200', blue:'text-blue-700 bg-blue-50 border-blue-200', amber:'text-amber-700 bg-amber-50 border-amber-200', purple:'text-purple-700 bg-purple-50 border-purple-200', gray:'text-gray-500 bg-gray-50 border-gray-200' }
  return (<div className={`rounded-lg border p-2 ${c[color]||c.blue}`}><div className="text-xs font-medium opacity-70">{label}</div><div className="text-base font-bold mt-0.5">{value}</div>{sub && <div className="text-xs opacity-50">{sub}</div>}</div>)
}

// ════════════════════════════════════════
// TRANSACTIONS
// ════════════════════════════════════════
function TransactionsTab({ filtered, categories, months, filterMonth, setFilterMonth, filterCat, setFilterCat, filterDir, setFilterDir, filterSearch, setFilterSearch, showPerso, setShowPerso, editingTx, setEditingTx, changeCategory, deleteTx, receipts }) {
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
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showPerso} onChange={e => setShowPerso(e.target.checked)} className="rounded" /> Afficher perso
          </label>
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
              {filtered.map(tx => (
                <tr key={tx.id} className={`border-t hover:bg-blue-50/30 ${tx.is_personal ? 'bg-purple-50/30' : ''} ${tx.is_manual ? 'border-l-2 border-l-blue-400' : ''}`}>
                  <td className="px-3 py-1.5 text-gray-500 text-xs whitespace-nowrap">
                    {tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : '-'}
                    {tx.is_manual && <span className="ml-1 text-blue-500">✏️</span>}
                    {tx.is_personal && <span className="ml-1 text-purple-500">🏠</span>}
                    {tx.sent_to_comptable && <span className="ml-1 text-green-500" title="Envoyé au comptable">✓</span>}
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
                  <td className="px-2 py-1.5">{tx.is_manual && <button onClick={() => deleteTx(tx.id)} className="text-red-300 hover:text-red-600 text-xs">✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-gray-400">Aucune transaction</div>}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// SAISIE MANUELLE + UPLOAD + IA
// ════════════════════════════════════════
function SaisieTab({ categories, rules, loadAll }) {
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'debit', category_id: '', payer: 'entreprise', notes: '', note_comptable: '' })
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [recent, setRecent] = useState([])

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
            { type: 'text', text: `Analyse cette facture/ticket pour Access Formation SARL (formation professionnelle SST/CACES/sécurité).

Extrais en JSON strict (pas de markdown) :
{
  "fournisseur": "nom du fournisseur",
  "montant": 123.45,
  "date": "2026-02-19",
  "description": "description courte",
  "categorie_suggestion": "nom de la catégorie la plus proche",
  "type_depense": "entreprise" ou "perso_hicham" ou "perso_maxime",
  "explication": "pourquoi cette classification",
  "note_comptable": "explication courte pour la comptable"
}

Catégories disponibles : ${catList}

Règles :
- Si c'est un achat clairement professionnel (matériel formation, logiciel, assurance, carburant, restaurant business) → "entreprise"
- Si c'est un achat personnel (courses alimentaires, vêtements perso, loisirs) → "perso_hicham" ou "perso_maxime" (par défaut "perso_hicham")
- En cas de doute → "entreprise"` }
          ]}]
        })
      })
      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const json = JSON.parse(text.replace(/```json|```/g, '').trim())
      setAiResult(json)

      // Pré-remplir le formulaire
      if (json.fournisseur) setForm(f => ({ ...f, description: json.description || json.fournisseur }))
      if (json.montant) setForm(f => ({ ...f, amount: json.montant.toString().replace('.', ',') }))
      if (json.date) setForm(f => ({ ...f, date: json.date }))
      if (json.note_comptable) setForm(f => ({ ...f, note_comptable: json.note_comptable }))
      if (json.type_depense === 'perso_hicham') setForm(f => ({ ...f, payer: 'hicham_perso' }))
      else if (json.type_depense === 'perso_maxime') setForm(f => ({ ...f, payer: 'maxime_perso' }))
      else setForm(f => ({ ...f, payer: 'entreprise' }))
      // Match category
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
        const ext = file.name.split('.').pop()
        const path = `${txData.id}/${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage.from('budget-receipts').upload(path, file)
        if (upErr) { console.error('Upload error:', upErr); continue }
        await supabase.from('budget_receipts').insert({
          transaction_id: txData.id, file_name: file.name, file_path: path, file_type: file.type, file_size: file.size
        })
      }
      toast.success(`📎 ${files.length} fichier(s) uploadé(s)`)
    }

    toast.success(`✅ ${form.type === 'debit' ? 'Dépense' : 'Entrée'}: ${fmt(amount)}`)
    setRecent(prev => [txData, ...prev].slice(0, 10))
    setForm({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'debit', category_id: '', payer: 'entreprise', notes: '', note_comptable: '' })
    setFiles([]); setPreviews([]); setAiResult(null)
    setSaving(false)
    loadAll()
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
        <h3 className="font-bold text-gray-700">➕ Nouvelle opération</h3>

        {/* Upload zone EN PREMIER */}
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
                  <div className="text-xs text-gray-400 truncate w-16">{p.name}</div>
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
            <div>Note comptable : <i>{aiResult.note_comptable}</i></div>
          </div>
        )}

        {/* Formulaire */}
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
        <div><label className="text-xs text-gray-500">Note comptable</label><input type="text" value={form.note_comptable} onChange={e => setForm(f => ({ ...f, note_comptable: e.target.value }))} placeholder="Explication pour Cristina..." className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>
        <div><label className="text-xs text-gray-500">Notes internes</label><input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="N° facture, détail..." className="w-full border rounded-lg px-3 py-2 text-sm mt-1" /></div>

        <button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '⏳...' : '💾 Enregistrer'}
        </button>
      </div>

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
// RULES
// ════════════════════════════════════════
function RulesTab({ rules, categories, loadAll }) {
  const [nw, setNw] = useState({ keyword:'', category_id:'', direction:'both' })
  async function add() { if(!nw.keyword||!nw.category_id){toast.error('Requis');return}; const{error}=await supabase.from('budget_rules').insert({keyword:nw.keyword.toUpperCase(),category_id:nw.category_id,direction:nw.direction}); if(error){toast.error(error.code==='23505'?'Existe':'Erreur');return}; toast.success('✅ Ajoutée'); setNw({keyword:'',category_id:'',direction:'both'}); loadAll() }
  async function del(id) { await supabase.from('budget_rules').delete().eq('id',id); toast.success('Supprimé'); loadAll() }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">➕ Nouvelle règle</h3>
        <div className="flex gap-2 flex-wrap">
          <input type="text" value={nw.keyword} onChange={e=>setNw(r=>({...r,keyword:e.target.value.toUpperCase()}))} placeholder="Mot-clé" className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-40 font-mono"/>
          <select value={nw.category_id} onChange={e=>setNw(r=>({...r,category_id:e.target.value}))} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-48"><option value="">Catégorie...</option>{categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>
          <select value={nw.direction} onChange={e=>setNw(r=>({...r,direction:e.target.value}))} className="border rounded-lg px-3 py-2 text-sm"><option value="both">Les deux</option><option value="debit">Débit</option><option value="credit">Crédit</option></select>
          <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Ajouter</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm"><thead className="bg-gray-50 sticky top-0"><tr><th className="text-left px-3 py-2 text-xs text-gray-500">Mot-clé</th><th className="text-left px-3 py-2 text-xs text-gray-500">→ Catégorie</th><th className="text-left px-3 py-2 text-xs text-gray-500">Dir.</th><th className="px-2 py-2"></th></tr></thead>
            <tbody>{rules.map(r=><tr key={r.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-1.5 font-mono text-xs">{r.keyword}</td>
              <td className="px-3 py-1.5"><span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{r.budget_categories?.icon} {r.budget_categories?.name}</span></td>
              <td className="px-3 py-1.5 text-xs">{r.direction==='debit'?'🔴':r.direction==='credit'?'🟢':'⚪'}</td>
              <td className="px-2 py-1.5"><button onClick={()=>del(r.id)} className="text-red-300 hover:text-red-600 text-xs">✕</button></td>
            </tr>)}</tbody>
          </table>
          {rules.length===0&&<div className="text-center py-8 text-gray-400">Aucune règle</div>}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// IMPORT
// ════════════════════════════════════════
function ImportTab({ loadAll, categories, rules }) {
  const [imp, setImp] = useState(false)
  const [csv, setCsv] = useState('')
  const [pre, setPre] = useState([])

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

  return (
    <div className="space-y-4">
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
    const catList = categories.map(c => `${c.icon} ${c.name}`).join(', ')
    const rulesList = rules.map(r => `${r.keyword} → ${r.budget_categories?.name || '?'}`).join(', ')
    const allSuggestions = []
    const batchSize = 40
    const batches = []

    for (let i = 0; i < candidates.length; i += batchSize) {
      batches.push(candidates.slice(i, i + batchSize))
    }

    setProgress({ done: 0, total: batches.length })

    for (let b = 0; b < batches.length; b++) {
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

Format JSON strict (pas de markdown) :
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
    const cat = categories.find(c => c.name === s.suggested)
    if (!cat) { toast.error('Catégorie non trouvée: ' + s.suggested); return }

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

  // ── Calcul des charges fixes moyennes ──
  const analysis = useMemo(() => {
    const co = transactions.filter(tx => !tx.is_personal)

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

    // Charges fixes mensuelles (catégories "fixe")
    const fixedCats = ['Prêts (remboursement)', 'Véhicules (leasing)', 'Assurances (véhicules)', 'Assurances (santé/prévoyance)',
      'Comptabilité', 'Logiciels & SaaS', 'Télécommunications', 'Frais bancaires', 'Loyer & Charges']
    
    let totalFixed = 0, totalVariable = 0, totalRevenue = 0
    const fixedBreakdown = {}

    months.forEach(m => {
      const mc = byMonth[m].cats
      Object.entries(mc).forEach(([cat, vals]) => {
        if (fixedCats.some(fc => cat.includes(fc.split(' ')[0])) || cat === 'Loyer & Charges') {
          totalFixed += vals.debit
          if (!fixedBreakdown[cat]) fixedBreakdown[cat] = 0
          fixedBreakdown[cat] += vals.debit
        } else if (vals.debit > 0) {
          totalVariable += vals.debit
        }
        if (vals.credit > 0) totalRevenue += vals.credit
      })
    })

    // Exclure trésorerie interne et mouvements non-CA des revenus
    const internalCats = ['Trésorerie interne', 'Apports associés', 'Prêts (réception)']
    let realRevenue = 0
    months.forEach(m => {
      Object.entries(byMonth[m].cats).forEach(([cat, vals]) => {
        if (!internalCats.some(ic => cat.includes(ic.split(' ')[0])) && vals.credit > 0) {
          realRevenue += vals.credit
        }
      })
    })

    const avgMonthlyFixed = totalFixed / nbMonths
    const avgMonthlyVariable = totalVariable / nbMonths
    const avgMonthlyRevenue = realRevenue / nbMonths
    const avgMonthlyNet = avgMonthlyRevenue - (totalFixed + totalVariable) / nbMonths

    // Saisonnalité : ratio par rapport à la moyenne
    const seasonality = {}
    const revenueByMonth = {}
    months.forEach(m => {
      let rev = 0
      Object.entries(byMonth[m].cats).forEach(([cat, vals]) => {
        if (!internalCats.some(ic => cat.includes(ic.split(' ')[0])) && vals.credit > 0) {
          rev += vals.credit
        }
      })
      revenueByMonth[m] = rev
      const mm = m.split('/')[0] // "05" from "05/2025"
      if (!seasonality[mm]) seasonality[mm] = { total: 0, count: 0 }
      seasonality[mm].total += rev
      seasonality[mm].count++
    })
    Object.keys(seasonality).forEach(mm => {
      seasonality[mm].avg = seasonality[mm].total / seasonality[mm].count
      seasonality[mm].ratio = avgMonthlyRevenue > 0 ? seasonality[mm].avg / avgMonthlyRevenue : 1
    })

    return {
      months, byMonth, nbMonths,
      avgMonthlyFixed, avgMonthlyVariable, avgMonthlyRevenue, avgMonthlyNet,
      fixedBreakdown, seasonality, revenueByMonth,
      totalFixed, totalVariable, realRevenue
    }
  }, [transactions])

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

    // Charges fixes mensuelles estimées
    const monthlyPrets = 1802  // ECH PRET total mensuel
    const monthlyLeasing = 256  // DIAC
    const monthlyDKV = 350  // carburant moyen
    const monthlyAssurances = 320  // AXA + SwissLife + CEGEMA
    const monthlyCompta = 410  // CEGEFI
    const monthlyLogiciels = 300  // Claude, Supabase, Microsoft, Apple, Vercel, etc.
    const monthlyTelecom = 255  // Orange
    const monthlyBanque = 50  // Eurocompte + commissions
    const monthlyDivers = 200  // Suravenir, divers

    const fixedCharges = monthlyPrets + monthlyLeasing + monthlyDKV + monthlyAssurances + monthlyCompta + monthlyLogiciels + monthlyTelecom + monthlyBanque + monthlyDivers
    const salaires = config.salaires
    const urssaf = config.urssaf
    const totalFixedMonth = fixedCharges + salaires + urssaf

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
        // Variable réaliste = ~30% du budget variable (restaurants, déplacements, fournitures)
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

    return { results, totalFixedMonth, fixedCharges, scenarios }
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
        <h3 className="font-bold text-gray-700 mb-3">📊 Détail charges fixes mensuelles estimées</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { label: 'Salaires (2 dirigeants)', amount: config.salaires, icon: '💰' },
            { label: 'URSSAF', amount: config.urssaf, icon: '🏛️' },
            { label: 'Prêts BPI', amount: 1802, icon: '🏦' },
            { label: 'Comptabilité (CEGEFI)', amount: 410, icon: '📋' },
            { label: 'Carburant DKV', amount: 350, icon: '⛽' },
            { label: 'Assurances', amount: 320, icon: '🛡️' },
            { label: 'Logiciels & SaaS', amount: 300, icon: '💻' },
            { label: 'Leasing DIAC', amount: 256, icon: '🚗' },
            { label: 'Télécom Orange', amount: 255, icon: '📱' },
            { label: 'Divers (banque, etc.)', amount: 250, icon: '📦' },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <span>{c.icon}</span>
              <div className="flex-1 text-xs text-gray-700">{c.label}</div>
              <div className="font-mono text-sm font-bold text-red-600">{fmt(c.amount)}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 flex justify-between items-center">
          <span className="font-bold text-red-800">Total charges fixes mensuelles</span>
          <span className="font-mono text-xl font-bold text-red-700">{fmt(projections.totalFixedMonth)}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">💡 Pour atteindre 50k€, votre CA mensuel doit couvrir {fmt(projections.totalFixedMonth)} de charges fixes + dégager {fmt(requiredMonthly)} de bénéfice net</p>
        <p className="text-xs text-gray-500">→ <b>CA minimum requis : {fmt(projections.totalFixedMonth + requiredMonthly)}/mois</b></p>
      </div>
    </div>
  )
}
