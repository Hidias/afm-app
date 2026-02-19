import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ════════════════════════════════════════════════════════════
//  BUDGET MODULE v2 — Access Campus
//  Transactions, saisie manuelle, catégories, compte courant
// ════════════════════════════════════════════════════════════

const TABS = [
  { key: 'transactions', label: '📋 Transactions' },
  { key: 'saisie', label: '➕ Saisie' },
  { key: 'dashboard', label: '📊 Dashboard' },
  { key: 'categories', label: '🏷️ Catégories' },
  { key: 'rules', label: '⚙️ Règles' },
  { key: 'import', label: '📥 Import' },
]

const MONTHS_LABELS = {
  '01/2025': 'Jan 25', '02/2025': 'Fév 25', '03/2025': 'Mar 25', '04/2025': 'Avr 25',
  '05/2025': 'Mai 25', '06/2025': 'Jun 25', '07/2025': 'Jul 25', '08/2025': 'Aoû 25',
  '09/2025': 'Sep 25', '10/2025': 'Oct 25', '11/2025': 'Nov 25', '12/2025': 'Déc 25',
  '01/2026': 'Jan 26', '02/2026': 'Fév 26', '03/2026': 'Mar 26',
}

const fmt = (n) => n ? Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '-'
const fmtShort = (n) => {
  if (!n) return '-'
  const abs = Math.abs(n)
  return abs >= 1000 ? (abs / 1000).toFixed(1) + 'k€' : Math.round(abs) + '€'
}

export default function BudgetModule() {
  const [tab, setTab] = useState('transactions')
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [rules, setRules] = useState([])
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
    try {
      const [txRes, catRes, ruleRes] = await Promise.all([
        supabase.from('budget_transactions').select('*').order('date', { ascending: false }),
        supabase.from('budget_categories').select('*').order('sort_order'),
        supabase.from('budget_rules').select('*, budget_categories(name, icon)').order('keyword'),
      ])
      if (txRes.data) setTransactions(txRes.data)
      if (catRes.data) setCategories(catRes.data)
      if (ruleRes.data) setRules(ruleRes.data)
    } catch (e) {
      toast.error('Erreur chargement')
    }
    setLoading(false)
  }

  const months = useMemo(() => {
    const m = new Set()
    transactions.forEach(tx => tx.month && m.add(tx.month))
    return [...m].sort()
  }, [transactions])

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (filterMonth !== 'all' && tx.month !== filterMonth) return false
      if (filterCat !== 'all' && tx.category_name !== filterCat) return false
      if (filterDir === 'debit' && !(tx.debit > 0)) return false
      if (filterDir === 'credit' && !(tx.credit > 0)) return false
      if (!showPerso && tx.is_personal) return false
      if (filterSearch) {
        const s = filterSearch.toLowerCase()
        if (!tx.description?.toLowerCase().includes(s) && !tx.category_name?.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [transactions, filterMonth, filterCat, filterDir, filterSearch, showPerso])

  const stats = useMemo(() => {
    const companyTx = transactions.filter(tx => !tx.is_personal)
    const totalDebit = companyTx.reduce((s, tx) => s + (tx.debit || 0), 0)
    const totalCredit = companyTx.reduce((s, tx) => s + (tx.credit || 0), 0)
    const byMonth = {}
    companyTx.forEach(tx => {
      if (!byMonth[tx.month]) byMonth[tx.month] = { debit: 0, credit: 0 }
      byMonth[tx.month].debit += tx.debit || 0
      byMonth[tx.month].credit += tx.credit || 0
    })
    const byCat = {}
    companyTx.forEach(tx => {
      const cat = tx.category_name || 'Non classé'
      if (!byCat[cat]) byCat[cat] = { debit: 0, credit: 0, count: 0 }
      byCat[cat].debit += tx.debit || 0
      byCat[cat].credit += tx.credit || 0
      byCat[cat].count++
    })
    const unclassified = companyTx.filter(tx => tx.category_name === 'Autre / Non classé').length
    const persoTx = transactions.filter(tx => tx.is_personal)
    const compteHicham = persoTx.filter(tx => tx.payer === 'hicham_perso').reduce((s, tx) => s + (tx.debit || 0) - (tx.credit || 0), 0)
    const compteMaxime = persoTx.filter(tx => tx.payer === 'maxime_perso').reduce((s, tx) => s + (tx.debit || 0) - (tx.credit || 0), 0)
    return { totalDebit, totalCredit, byMonth, byCat, unclassified, compteHicham, compteMaxime }
  }, [transactions])

  async function changeCategory(txId, categoryName) {
    const cat = categories.find(c => c.name === categoryName)
    if (!cat) return
    const { error } = await supabase.from('budget_transactions')
      .update({ category_id: cat.id, category_name: cat.name, updated_at: new Date().toISOString() })
      .eq('id', txId)
    if (error) { toast.error('Erreur'); return }
    setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, category_id: cat.id, category_name: cat.name } : tx))
    toast.success(`→ ${cat.icon} ${cat.name}`)
    setEditingTx(null)
  }

  async function togglePersonal(txId, associe) {
    const tx = transactions.find(t => t.id === txId)
    if (!tx) return
    const newPerso = !tx.is_personal
    const newPayer = newPerso ? associe : 'entreprise'
    const { error } = await supabase.from('budget_transactions')
      .update({ is_personal: newPerso, payer: newPayer, updated_at: new Date().toISOString() })
      .eq('id', txId)
    if (error) { toast.error('Erreur'); return }
    setTransactions(prev => prev.map(t => t.id === txId ? { ...t, is_personal: newPerso, payer: newPayer } : t))
    toast.success(newPerso ? `🏠 Perso ${associe === 'hicham_perso' ? 'Hicham' : 'Maxime'}` : '🏢 Entreprise')
  }

  async function deleteTx(txId) {
    if (!confirm('Supprimer cette opération ?')) return
    const { error } = await supabase.from('budget_transactions').delete().eq('id', txId)
    if (error) { toast.error('Erreur'); return }
    setTransactions(prev => prev.filter(t => t.id !== txId))
    toast.success('Supprimé')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-800">💰 Budget & Trésorerie</h1>
          <span className="text-xs text-gray-400">{transactions.length} opérations • {transactions.filter(t => t.is_manual).length} saisies manuelles</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <KPI label="Entrées entreprise" value={fmt(stats.totalCredit)} color="green" />
          <KPI label="Sorties entreprise" value={fmt(stats.totalDebit)} color="red" />
          <KPI label="Balance" value={fmt(stats.totalCredit - stats.totalDebit)}
            color={stats.totalCredit - stats.totalDebit >= 0 ? 'green' : 'red'} />
          <KPI label="Non classés" value={stats.unclassified}
            color={stats.unclassified > 0 ? 'amber' : 'green'} />
          <KPI label="Dette Hicham" value={stats.compteHicham > 0 ? fmt(stats.compteHicham) : '0 €'}
            color={stats.compteHicham > 0 ? 'purple' : 'gray'} sub="compte courant" />
          <KPI label="Dette Maxime" value={stats.compteMaxime > 0 ? fmt(stats.compteMaxime) : '0 €'}
            color={stats.compteMaxime > 0 ? 'purple' : 'gray'} sub="compte courant" />
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all whitespace-nowrap
              ${tab === t.key ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'transactions' && (
        <TransactionsTab {...{ filtered, categories, months, filterMonth, setFilterMonth,
          filterCat, setFilterCat, filterDir, setFilterDir, filterSearch, setFilterSearch,
          showPerso, setShowPerso, editingTx, setEditingTx, changeCategory, togglePersonal, deleteTx }} />
      )}
      {tab === 'saisie' && <SaisieTab categories={categories} rules={rules} loadAll={loadAll} />}
      {tab === 'dashboard' && <DashboardTab stats={stats} months={months} categories={categories} />}
      {tab === 'categories' && <CategoriesTab categories={categories} loadAll={loadAll} />}
      {tab === 'rules' && <RulesTab rules={rules} categories={categories} loadAll={loadAll} />}
      {tab === 'import' && <ImportTab loadAll={loadAll} categories={categories} rules={rules} />}
    </div>
  )
}

function KPI({ label, value, color = 'blue', sub }) {
  const c = {
    green: 'text-green-700 bg-green-50 border-green-200',
    red: 'text-red-700 bg-red-50 border-red-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    purple: 'text-purple-700 bg-purple-50 border-purple-200',
    gray: 'text-gray-500 bg-gray-50 border-gray-200',
  }
  return (
    <div className={`rounded-lg border p-2.5 ${c[color] || c.blue}`}>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="text-base font-bold mt-0.5">{value}</div>
      {sub && <div className="text-xs opacity-50">{sub}</div>}
    </div>
  )
}

function TransactionsTab({
  filtered, categories, months, filterMonth, setFilterMonth,
  filterCat, setFilterCat, filterDir, setFilterDir, filterSearch, setFilterSearch,
  showPerso, setShowPerso, editingTx, setEditingTx, changeCategory, togglePersonal, deleteTx
}) {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl shadow-sm border p-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="all">Tous les mois</option>
            {months.map(m => <option key={m} value={m}>{MONTHS_LABELS[m] || m}</option>)}
          </select>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="all">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
          </select>
          <select value={filterDir} onChange={e => setFilterDir(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="all">Tout</option>
            <option value="debit">Sorties</option>
            <option value="credit">Entrées</option>
          </select>
          <input type="text" value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
            placeholder="🔍 Rechercher..." className="border rounded-lg px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showPerso} onChange={e => setShowPerso(e.target.checked)} className="rounded" />
            Afficher perso
          </label>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span>{filtered.length} opérations</span>
          <span>Sorties: <b className="text-red-600">{fmt(filtered.reduce((s, t) => s + (t.debit || 0), 0))}</b></span>
          <span>Entrées: <b className="text-green-600">{fmt(filtered.reduce((s, t) => s + (t.credit || 0), 0))}</b></span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Date</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Description</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Catégorie</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Débit</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Crédit</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-gray-500">Perso</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} className={`border-t hover:bg-blue-50/30 ${tx.is_personal ? 'bg-purple-50/30' : ''} ${tx.is_manual ? 'border-l-2 border-l-blue-400' : ''}`}>
                  <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap text-xs">
                    {tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : '-'}
                    {tx.is_manual && <span className="ml-1 text-blue-500" title="Saisie manuelle">✏️</span>}
                  </td>
                  <td className="px-3 py-1.5 max-w-xs">
                    <div className="truncate text-gray-800 text-xs" title={tx.description}>{tx.description}</div>
                  </td>
                  <td className="px-3 py-1.5">
                    {editingTx === tx.id ? (
                      <select autoFocus onChange={e => { if (e.target.value) changeCategory(tx.id, e.target.value) }}
                        onBlur={() => setEditingTx(null)} className="border rounded px-1 py-0.5 text-xs w-full" defaultValue="">
                        <option value="">Choisir...</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
                      </select>
                    ) : (
                      <button onClick={() => setEditingTx(tx.id)}
                        className={`text-xs px-2 py-0.5 rounded-full hover:ring-2 hover:ring-blue-300
                          ${tx.category_name === 'Autre / Non classé' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {categories.find(c => c.name === tx.category_name)?.icon || '❓'} {tx.category_name || 'Non classé'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs text-red-600">{tx.debit > 0 ? fmt(tx.debit) : ''}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs text-green-600">{tx.credit > 0 ? fmt(tx.credit) : ''}</td>
                  <td className="px-2 py-1.5 text-center">
                    {tx.debit > 0 && (
                      <div className="flex gap-0.5 justify-center">
                        <button onClick={() => togglePersonal(tx.id, 'hicham_perso')} title="Perso Hicham"
                          className={`text-xs px-1.5 py-0.5 rounded ${tx.is_personal && tx.payer === 'hicham_perso' ? 'bg-purple-500 text-white' : 'bg-gray-100 hover:bg-purple-100'}`}>H</button>
                        <button onClick={() => togglePersonal(tx.id, 'maxime_perso')} title="Perso Maxime"
                          className={`text-xs px-1.5 py-0.5 rounded ${tx.is_personal && tx.payer === 'maxime_perso' ? 'bg-purple-500 text-white' : 'bg-gray-100 hover:bg-purple-100'}`}>M</button>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {tx.is_manual && <button onClick={() => deleteTx(tx.id)} className="text-red-300 hover:text-red-600 text-xs">✕</button>}
                  </td>
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

function SaisieTab({ categories, rules, loadAll }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '', amount: '', type: 'debit', category_id: '', payer: 'entreprise', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [recent, setRecent] = useState([])

  useEffect(() => {
    supabase.from('budget_transactions').select('*')
      .eq('is_manual', true).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (data) setRecent(data) })
  }, [])

  useEffect(() => {
    if (!form.description || form.category_id) return
    const desc = form.description.toUpperCase()
    for (const rule of rules) {
      if (desc.includes(rule.keyword?.toUpperCase())) {
        const cat = categories.find(c => c.id === rule.category_id)
        if (cat) { setForm(f => ({ ...f, category_id: cat.id })); break }
      }
    }
  }, [form.description])

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
      source_file: 'saisie_manuelle', is_manual: true, is_personal: isPerso, payer: form.payer, notes: form.notes || null,
    }
    const { data, error } = await supabase.from('budget_transactions').insert(row).select().single()
    if (error) { toast.error('Erreur: ' + error.message); setSaving(false); return }
    toast.success(`✅ ${form.type === 'debit' ? 'Dépense' : 'Entrée'}: ${fmt(amount)}`)
    setRecent(prev => [data, ...prev].slice(0, 10))
    setForm({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'debit', category_id: '', payer: 'entreprise', notes: '' })
    setSaving(false)
    loadAll()
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-4">➕ Nouvelle opération</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setForm(f => ({ ...f, type: 'debit' }))}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.type === 'debit' ? 'bg-red-500 text-white' : 'bg-gray-100'}`}>🔴 Dépense</button>
            <button onClick={() => setForm(f => ({ ...f, type: 'credit' }))}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${form.type === 'credit' ? 'bg-green-500 text-white' : 'bg-gray-100'}`}>🟢 Entrée</button>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Description / Fournisseur</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Facture YLEA matériel SST" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Montant (€)</label>
            <input type="text" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0,00" className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono text-lg" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Catégorie</label>
            <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Auto / Non classé</option>
              {categories.filter(c => form.type === 'debit' ? c.direction !== 'recette' : c.direction !== 'depense')
                .map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Payé par</label>
            <div className="flex gap-2 mt-1">
              {[
                { val: 'entreprise', label: '🏢 Entreprise' },
                { val: 'hicham_perso', label: '🏠 Hicham' },
                { val: 'maxime_perso', label: '🏠 Maxime' },
              ].map(p => (
                <button key={p.val} onClick={() => setForm(f => ({ ...f, payer: p.val }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all
                    ${form.payer === p.val ? (p.val === 'entreprise' ? 'bg-blue-500 text-white border-blue-600' : 'bg-purple-500 text-white border-purple-600') : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {form.payer !== 'entreprise' && (
              <p className="text-xs text-purple-600 mt-1">⚠️ Perso — hors budget entreprise, comptée en dette gérant</p>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Notes (optionnel)</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="N° facture, détail..." className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 mt-2">
            {saving ? '⏳ Enregistrement...' : '💾 Enregistrer'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">📝 Dernières saisies manuelles</h3>
        {recent.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Aucune saisie</div>
        ) : (
          <div className="space-y-2">
            {recent.map(tx => (
              <div key={tx.id} className={`flex items-center gap-3 p-2 rounded-lg border ${tx.is_personal ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{tx.description}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(tx.date).toLocaleDateString('fr-FR')} • {tx.category_name}
                    {tx.is_personal && <span className="ml-1 text-purple-600">• Perso</span>}
                  </div>
                </div>
                <div className={`font-mono text-sm font-bold ${tx.debit > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {tx.debit > 0 ? '-' : '+'}{fmt(tx.debit > 0 ? tx.debit : tx.credit)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DashboardTab({ stats, months, categories }) {
  const sortedMonths = months.slice().sort()
  const maxMonthly = Math.max(...sortedMonths.map(m => Math.max(stats.byMonth[m]?.debit || 0, stats.byMonth[m]?.credit || 0)), 1)
  const catsSorted = Object.entries(stats.byCat).filter(([_, v]) => v.debit > 0).sort((a, b) => b[1].debit - a[1].debit)
  const maxCatDebit = catsSorted.length > 0 ? catsSorted[0][1].debit : 1
  const revCats = Object.entries(stats.byCat)
    .filter(([name, v]) => v.credit > 0 && !['Prêts (réception)', 'Apports associés', 'Trésorerie interne'].includes(name))
    .sort((a, b) => b[1].credit - a[1].credit)

  return (
    <div className="space-y-4">
      {(stats.compteHicham > 0 || stats.compteMaxime > 0) && (
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
          <h3 className="font-bold text-purple-800 mb-2">🏠 Comptes courants associés</h3>
          <p className="text-xs text-purple-600 mb-3">Dépenses perso payées par l'entreprise — hors budget société</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <div className="text-sm text-gray-600">Hicham doit à l'entreprise</div>
              <div className="text-xl font-bold text-purple-700">{stats.compteHicham > 0 ? fmt(stats.compteHicham) : '0 €'}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <div className="text-sm text-gray-600">Maxime doit à l'entreprise</div>
              <div className="text-xl font-bold text-purple-700">{stats.compteMaxime > 0 ? fmt(stats.compteMaxime) : '0 €'}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">📊 Flux mensuels (hors perso)</h3>
        <div className="space-y-2">
          {sortedMonths.map(m => {
            const d = stats.byMonth[m] || { debit: 0, credit: 0 }
            return (
              <div key={m} className="flex items-center gap-2">
                <div className="w-16 text-xs text-gray-500 font-medium">{MONTHS_LABELS[m] || m}</div>
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <div className="bg-green-400 rounded-sm h-3" style={{ width: `${(d.credit / maxMonthly) * 100}%`, minWidth: d.credit > 0 ? '2px' : 0 }} />
                    <span className="text-xs text-green-700">{fmtShort(d.credit)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="bg-red-400 rounded-sm h-3" style={{ width: `${(d.debit / maxMonthly) * 100}%`, minWidth: d.debit > 0 ? '2px' : 0 }} />
                    <span className="text-xs text-red-600">{fmtShort(d.debit)}</span>
                  </div>
                </div>
                <div className={`w-20 text-right text-xs font-bold ${d.credit - d.debit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {d.credit - d.debit >= 0 ? '+' : ''}{fmtShort(d.credit - d.debit)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-bold text-gray-700 mb-3">🔴 Dépenses par catégorie</h3>
          <div className="space-y-1.5">
            {catsSorted.slice(0, 15).map(([name, val]) => {
              const cat = categories.find(c => c.name === name)
              return (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-sm w-5">{cat?.icon || '📁'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-700 truncate">{name}</span>
                      <span className="text-red-600 font-medium ml-2">{fmtShort(val.debit)}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-1.5 mt-0.5">
                      <div className="bg-red-400 rounded-full h-1.5" style={{ width: `${(val.debit / maxCatDebit) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-bold text-gray-700 mb-3">🟢 Revenus</h3>
          {revCats.length > 0 ? (
            <div className="space-y-1.5">
              {revCats.map(([name, val]) => {
                const cat = categories.find(c => c.name === name)
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-sm w-5">{cat?.icon || '📁'}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700 truncate">{name}</span>
                        <span className="text-green-600 font-medium ml-2">{fmtShort(val.credit)}</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-1.5 mt-0.5">
                        <div className="bg-green-400 rounded-full h-1.5" style={{ width: `${(val.credit / revCats[0][1].credit) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <div className="text-center py-8 text-gray-400">-</div>}
        </div>
      </div>
    </div>
  )
}

function CategoriesTab({ categories, loadAll }) {
  const [newCat, setNewCat] = useState({ name: '', direction: 'depense', type: 'variable', icon: '📁' })
  const [editingCat, setEditingCat] = useState(null)
  const [editForm, setEditForm] = useState({})
  const icons = ['📁','💰','🏦','🚗','⛽','🏥','💻','📱','🍽️','🚄','🎓','🤝','🏠','🛒','🖨️','📋','🧮','📞','🔧','📦','🏢','❓','⚡','🔄','↩️','🛡️']

  async function addCategory() {
    if (!newCat.name.trim()) { toast.error('Nom requis'); return }
    const maxSort = Math.max(...categories.map(c => c.sort_order || 0), 0)
    const { error } = await supabase.from('budget_categories').insert({ ...newCat, color: 'gray', sort_order: maxSort + 1 })
    if (error) { toast.error(error.code === '23505' ? 'Existe déjà' : 'Erreur'); return }
    toast.success(`✅ "${newCat.name}" créée`)
    setNewCat({ name: '', direction: 'depense', type: 'variable', icon: '📁' })
    loadAll()
  }

  async function updateCategory() {
    if (!editForm.name?.trim()) return
    const { error } = await supabase.from('budget_categories').update(editForm).eq('id', editingCat)
    if (error) { toast.error('Erreur'); return }
    toast.success('✅ Modifié')
    setEditingCat(null)
    loadAll()
  }

  async function deleteCategory(id, name) {
    const { count } = await supabase.from('budget_transactions').select('id', { count: 'exact', head: true }).eq('category_id', id)
    if (count > 0) { toast.error(`${count} transactions utilisent "${name}"`); return }
    if (!confirm(`Supprimer "${name}" ?`)) return
    await supabase.from('budget_categories').delete().eq('id', id)
    toast.success('Supprimé')
    loadAll()
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">➕ Nouvelle catégorie</h3>
        <div className="flex gap-2 flex-wrap">
          <select value={newCat.icon} onChange={e => setNewCat(n => ({ ...n, icon: e.target.value }))} className="border rounded-lg px-2 py-2 text-lg w-14">
            {icons.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <input type="text" value={newCat.name} onChange={e => setNewCat(n => ({ ...n, name: e.target.value }))}
            placeholder="Nom" className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-40" />
          <select value={newCat.direction} onChange={e => setNewCat(n => ({ ...n, direction: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
            <option value="depense">Dépense</option><option value="recette">Recette</option><option value="neutre">Neutre</option>
          </select>
          <select value={newCat.type} onChange={e => setNewCat(n => ({ ...n, type: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
            <option value="fixe">Fixe</option><option value="variable">Variable</option><option value="exceptionnel">Exceptionnel</option>
          </select>
          <button onClick={addCategory} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Créer</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-xs text-gray-500"></th>
              <th className="text-left px-3 py-2 text-xs text-gray-500">Nom</th>
              <th className="text-left px-3 py-2 text-xs text-gray-500">Direction</th>
              <th className="text-left px-3 py-2 text-xs text-gray-500">Type</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.id} className="border-t hover:bg-gray-50">
                {editingCat === cat.id ? (<>
                  <td className="px-3 py-1">
                    <select value={editForm.icon} onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))} className="border rounded px-1 py-0.5 text-lg w-12">
                      {icons.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1"><input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="border rounded px-2 py-1 text-sm w-full" /></td>
                  <td className="px-3 py-1">
                    <select value={editForm.direction} onChange={e => setEditForm(f => ({ ...f, direction: e.target.value }))} className="border rounded px-2 py-1 text-xs">
                      <option value="depense">Dépense</option><option value="recette">Recette</option><option value="neutre">Neutre</option>
                    </select>
                  </td>
                  <td className="px-3 py-1">
                    <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} className="border rounded px-2 py-1 text-xs">
                      <option value="fixe">Fixe</option><option value="variable">Variable</option><option value="exceptionnel">Exceptionnel</option>
                    </select>
                  </td>
                  <td className="px-3 py-1 text-right">
                    <button onClick={updateCategory} className="text-green-600 text-xs mr-2 font-medium">✓</button>
                    <button onClick={() => setEditingCat(null)} className="text-gray-400 text-xs">✕</button>
                  </td>
                </>) : (<>
                  <td className="px-3 py-1.5 text-lg">{cat.icon}</td>
                  <td className="px-3 py-1.5 font-medium text-gray-700">{cat.name}</td>
                  <td className="px-3 py-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cat.direction === 'recette' ? 'bg-green-100 text-green-700' : cat.direction === 'depense' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                      {cat.direction}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-500">{cat.type}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button onClick={() => { setEditingCat(cat.id); setEditForm({ name: cat.name, icon: cat.icon, direction: cat.direction, type: cat.type }) }}
                      className="text-blue-500 text-xs mr-2 hover:text-blue-700">Modifier</button>
                    <button onClick={() => deleteCategory(cat.id, cat.name)} className="text-red-400 text-xs hover:text-red-600">Suppr</button>
                  </td>
                </>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RulesTab({ rules, categories, loadAll }) {
  const [nw, setNw] = useState({ keyword: '', category_id: '', direction: 'both' })

  async function addRule() {
    if (!nw.keyword || !nw.category_id) { toast.error('Mot-clé et catégorie requis'); return }
    const { error } = await supabase.from('budget_rules').insert({ keyword: nw.keyword.toUpperCase(), category_id: nw.category_id, direction: nw.direction })
    if (error) { toast.error(error.code === '23505' ? 'Existe déjà' : 'Erreur'); return }
    toast.success(`✅ "${nw.keyword}" ajoutée`)
    setNw({ keyword: '', category_id: '', direction: 'both' })
    loadAll()
  }

  async function deleteRule(id) {
    await supabase.from('budget_rules').delete().eq('id', id)
    toast.success('Supprimé')
    loadAll()
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">➕ Nouvelle règle</h3>
        <div className="flex gap-2 flex-wrap">
          <input type="text" value={nw.keyword} onChange={e => setNw(r => ({ ...r, keyword: e.target.value.toUpperCase() }))}
            placeholder="Mot-clé (ex: SOCOTEC)" className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-40 font-mono" />
          <select value={nw.category_id} onChange={e => setNw(r => ({ ...r, category_id: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-48">
            <option value="">Catégorie...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select value={nw.direction} onChange={e => setNw(r => ({ ...r, direction: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
            <option value="both">Les deux</option><option value="debit">Débit</option><option value="credit">Crédit</option>
          </select>
          <button onClick={addRule} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Ajouter</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Mot-clé</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">→ Catégorie</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Dir.</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono text-xs">{r.keyword}</td>
                  <td className="px-3 py-1.5"><span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{r.budget_categories?.icon} {r.budget_categories?.name}</span></td>
                  <td className="px-3 py-1.5 text-xs">{r.direction === 'debit' ? '🔴' : r.direction === 'credit' ? '🟢' : '⚪'}</td>
                  <td className="px-2 py-1.5"><button onClick={() => deleteRule(r.id)} className="text-red-300 hover:text-red-600 text-xs">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rules.length === 0 && <div className="text-center py-8 text-gray-400">Aucune règle</div>}
        </div>
      </div>
    </div>
  )
}

function ImportTab({ loadAll, categories, rules }) {
  const [importing, setImporting] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState([])

  function parseCMBcsv(text) {
    const lines = text.trim().split('\n').filter(l => l.trim())
    const txs = []
    for (const line of lines) {
      const parts = line.split(';')
      if (parts.length < 4 || parts[0] === 'Date operation') continue
      const dateStr = parts[0].trim()
      const desc = parts[2]?.trim() || ''
      const debitStr = parts[3]?.trim().replace(/\s/g, '').replace(',', '.') || ''
      const creditStr = parts[4]?.trim().replace(/\s/g, '').replace(',', '.') || ''
      if (!dateStr || !desc) continue
      const dp = dateStr.split('/')
      if (dp.length !== 3) continue
      const yr = dp[2].length === 2 ? '20' + dp[2] : dp[2]
      const pgDate = `${yr}-${dp[1]}-${dp[0]}`
      const debit = debitStr ? Math.abs(parseFloat(debitStr)) : 0
      const credit = creditStr ? Math.abs(parseFloat(creditStr)) : 0
      if (isNaN(debit) && isNaN(credit)) continue
      let catName = 'Autre / Non classé'
      const descUp = desc.toUpperCase()
      for (const rule of rules) {
        if (rule.direction === 'debit' && !(debit > 0)) continue
        if (rule.direction === 'credit' && !(credit > 0)) continue
        if (descUp.includes(rule.keyword?.toUpperCase())) { catName = rule.budget_categories?.name || catName; break }
      }
      txs.push({ date: pgDate, description: desc, debit: debit || 0, credit: credit || 0, category_name: catName, month: `${dp[1]}/${yr}`, year: parseInt(yr) })
    }
    return txs
  }

  function handlePreview() {
    const txs = parseCMBcsv(csvText)
    setPreview(txs)
    toast(txs.length > 0 ? `${txs.length} transactions détectées` : 'Aucune transaction')
  }

  async function handleImport() {
    if (!preview.length) return
    setImporting(true)
    try {
      const rows = preview.map(tx => {
        const cat = categories.find(c => c.name === tx.category_name)
        return { ...tx, category_id: cat?.id || null, source_file: 'import_csv_cmb', payer: 'entreprise', is_manual: false, is_personal: false }
      })
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await supabase.from('budget_transactions').insert(rows.slice(i, i + 50))
        if (error) throw error
      }
      toast.success(`✅ ${rows.length} importées`)
      setCsvText(''); setPreview([])
      loadAll()
    } catch (e) { toast.error('Erreur: ' + (e.message || '')) }
    setImporting(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-2">📥 Import CSV Crédit Mutuel</h3>
        <p className="text-sm text-gray-500 mb-3">cmb.fr → Compte → Télécharger → Excel XP → Collez le CSV ici</p>
        <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
          placeholder="Date operation;Date valeur;Libelle;Debit;Credit" className="w-full h-40 border rounded-lg p-3 text-xs font-mono resize-y" />
        <div className="flex gap-2 mt-2">
          <button onClick={handlePreview} disabled={!csvText.trim()} className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">👁️ Prévisualiser</button>
          {preview.length > 0 && (
            <button onClick={handleImport} disabled={importing} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {importing ? '⏳...' : `✅ Importer ${preview.length}`}
            </button>
          )}
        </div>
      </div>
      {preview.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-2 bg-amber-50 border-b text-sm text-amber-700 font-medium">⚠️ {preview.length} transactions</div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr><th className="text-left px-2 py-1">Date</th><th className="text-left px-2 py-1">Description</th><th className="text-left px-2 py-1">Catégorie</th><th className="text-right px-2 py-1">Débit</th><th className="text-right px-2 py-1">Crédit</th></tr>
              </thead>
              <tbody>
                {preview.map((tx, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">{tx.date}</td>
                    <td className="px-2 py-1 truncate max-w-xs">{tx.description}</td>
                    <td className="px-2 py-1"><span className={`px-1.5 py-0.5 rounded text-xs ${tx.category_name === 'Autre / Non classé' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100'}`}>{tx.category_name}</span></td>
                    <td className="px-2 py-1 text-right text-red-600">{tx.debit > 0 ? tx.debit.toFixed(2) : ''}</td>
                    <td className="px-2 py-1 text-right text-green-600">{tx.credit > 0 ? tx.credit.toFixed(2) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
