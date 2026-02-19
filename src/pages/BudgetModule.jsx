import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ════════════════════════════════════════════════════════════
//  BUDGET MODULE — Access Campus
//  Gestion financière, catégorisation, dashboard, règles
// ════════════════════════════════════════════════════════════

const TABS = [
  { key: 'transactions', label: '📋 Transactions', desc: 'Toutes les opérations' },
  { key: 'dashboard', label: '📊 Dashboard', desc: 'Vue d\'ensemble' },
  { key: 'rules', label: '⚙️ Règles', desc: 'Auto-catégorisation' },
  { key: 'import', label: '📥 Import', desc: 'Importer relevé' },
]

const MONTHS_LABELS = {
  '04/2025': 'Avr 25', '05/2025': 'Mai 25', '06/2025': 'Jun 25',
  '07/2025': 'Jul 25', '08/2025': 'Aoû 25', '09/2025': 'Sep 25',
  '10/2025': 'Oct 25', '11/2025': 'Nov 25', '12/2025': 'Déc 25',
  '01/2026': 'Jan 26', '02/2026': 'Fév 26',
}

export default function BudgetModule() {
  const [tab, setTab] = useState('transactions')
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterCat, setFilterCat] = useState('all')
  const [filterDir, setFilterDir] = useState('all')
  const [filterSearch, setFilterSearch] = useState('')

  // Edit state
  const [editingTx, setEditingTx] = useState(null)
  const [newRule, setNewRule] = useState({ keyword: '', category_id: '', direction: 'both' })

  // ═══ DATA LOADING ═══
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
      console.error(e)
      toast.error('Erreur chargement données budget')
    }
    setLoading(false)
  }

  // ═══ FILTERED TRANSACTIONS ═══
  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (filterMonth !== 'all' && tx.month !== filterMonth) return false
      if (filterCat !== 'all' && tx.category_name !== filterCat) return false
      if (filterDir === 'debit' && tx.debit <= 0) return false
      if (filterDir === 'credit' && tx.credit <= 0) return false
      if (filterSearch) {
        const s = filterSearch.toLowerCase()
        if (!tx.description?.toLowerCase().includes(s) && !tx.category_name?.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [transactions, filterMonth, filterCat, filterDir, filterSearch])

  // ═══ STATS ═══
  const stats = useMemo(() => {
    const totalDebit = filtered.reduce((s, tx) => s + (tx.debit || 0), 0)
    const totalCredit = filtered.reduce((s, tx) => s + (tx.credit || 0), 0)

    // Monthly breakdown
    const byMonth = {}
    transactions.forEach(tx => {
      if (!byMonth[tx.month]) byMonth[tx.month] = { debit: 0, credit: 0, count: 0 }
      byMonth[tx.month].debit += tx.debit || 0
      byMonth[tx.month].credit += tx.credit || 0
      byMonth[tx.month].count++
    })

    // By category
    const byCat = {}
    transactions.forEach(tx => {
      const cat = tx.category_name || 'Non classé'
      if (!byCat[cat]) byCat[cat] = { debit: 0, credit: 0, count: 0 }
      byCat[cat].debit += tx.debit || 0
      byCat[cat].credit += tx.credit || 0
      byCat[cat].count++
    })

    // Unclassified
    const unclassified = transactions.filter(tx => tx.category_name === 'Autre / Non classé').length

    return { totalDebit, totalCredit, byMonth, byCat, unclassified }
  }, [transactions, filtered])

  // ═══ Available months ═══
  const months = useMemo(() => {
    const m = new Set()
    transactions.forEach(tx => tx.month && m.add(tx.month))
    return [...m].sort()
  }, [transactions])

  // ═══ CATEGORY CHANGE ═══
  async function changeCategory(txId, categoryName, createRule = false) {
    const cat = categories.find(c => c.name === categoryName)
    if (!cat) return

    const { error } = await supabase.from('budget_transactions')
      .update({ category_id: cat.id, category_name: cat.name, updated_at: new Date().toISOString() })
      .eq('id', txId)

    if (error) {
      toast.error('Erreur mise à jour')
      return
    }

    setTransactions(prev => prev.map(tx =>
      tx.id === txId ? { ...tx, category_id: cat.id, category_name: cat.name } : tx
    ))

    if (createRule) {
      const tx = transactions.find(t => t.id === txId)
      if (tx) {
        // Extract keyword from description (first meaningful word)
        const words = tx.description.replace(/CARTE \d{2}\/\d{2}\s*/i, '').split(/\s+/)
        const keyword = words.find(w => w.length > 3 && !/^\d+/.test(w)) || words[0]
        if (keyword) {
          await addRule(keyword.toUpperCase(), cat.id, tx.debit > 0 ? 'debit' : 'credit')
        }
      }
    }

    toast.success(`✅ → ${cat.icon} ${cat.name}`)
    setEditingTx(null)
  }

  // ═══ APPLY RULE TO ALL MATCHING ═══
  async function applyRuleToAll(keyword, categoryName) {
    const matching = transactions.filter(tx =>
      tx.description.toUpperCase().includes(keyword.toUpperCase()) &&
      tx.category_name !== categoryName
    )
    if (matching.length === 0) {
      toast('Aucune transaction à mettre à jour')
      return
    }

    const cat = categories.find(c => c.name === categoryName)
    if (!cat) return

    const ids = matching.map(tx => tx.id)
    const { error } = await supabase.from('budget_transactions')
      .update({ category_id: cat.id, category_name: cat.name, updated_at: new Date().toISOString() })
      .in('id', ids)

    if (error) {
      toast.error('Erreur application en masse')
      return
    }

    setTransactions(prev => prev.map(tx =>
      ids.includes(tx.id) ? { ...tx, category_id: cat.id, category_name: cat.name } : tx
    ))
    toast.success(`✅ ${matching.length} transactions → ${cat.icon} ${cat.name}`)
  }

  // ═══ ADD RULE ═══
  async function addRule(keyword, categoryId, direction = 'both') {
    const { data, error } = await supabase.from('budget_rules')
      .insert({ keyword: keyword.toUpperCase(), category_id: categoryId, direction })
      .select('*, budget_categories(name, icon)')
      .single()

    if (error) {
      if (error.code === '23505') toast('Règle déjà existante')
      else toast.error('Erreur création règle')
      return
    }

    setRules(prev => [...prev, data])
    toast.success(`✅ Règle: "${keyword}" ajoutée`)
  }

  // ═══ DELETE RULE ═══
  async function deleteRule(ruleId) {
    const { error } = await supabase.from('budget_rules').delete().eq('id', ruleId)
    if (error) { toast.error('Erreur suppression'); return }
    setRules(prev => prev.filter(r => r.id !== ruleId))
    toast.success('Règle supprimée')
  }

  // ═══ FORMAT HELPERS ═══
  const fmt = (n) => n ? n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '-'
  const fmtShort = (n) => n ? (n >= 1000 ? (n / 1000).toFixed(1) + 'k€' : Math.round(n) + '€') : '-'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-500">Chargement budget...</span>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">

      {/* ═══ HEADER KPIs ═══ */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-800">💰 Budget & Trésorerie</h1>
          <span className="text-sm text-gray-400">{transactions.length} opérations</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI label="Entrées (période)" value={fmt(stats.totalCredit)} color="green" />
          <KPI label="Sorties (période)" value={fmt(stats.totalDebit)} color="red" />
          <KPI label="Solde période" value={fmt(stats.totalCredit - stats.totalDebit)}
            color={stats.totalCredit - stats.totalDebit >= 0 ? 'green' : 'red'} />
          <KPI label="Non classés" value={stats.unclassified}
            color={stats.unclassified > 0 ? 'amber' : 'green'}
            sub={stats.unclassified > 0 ? 'à corriger' : 'tout classé ✓'} />
          <KPI label="Mois couverts" value={months.length} sub={`${months[0] || ''} → ${months[months.length-1] || ''}`} />
        </div>
      </div>

      {/* ═══ TAB BAR ═══ */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
              ${tab === t.key ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      {tab === 'transactions' && (
        <TransactionsTab
          filtered={filtered} categories={categories} months={months}
          filterMonth={filterMonth} setFilterMonth={setFilterMonth}
          filterCat={filterCat} setFilterCat={setFilterCat}
          filterDir={filterDir} setFilterDir={setFilterDir}
          filterSearch={filterSearch} setFilterSearch={setFilterSearch}
          editingTx={editingTx} setEditingTx={setEditingTx}
          changeCategory={changeCategory}
          applyRuleToAll={applyRuleToAll}
          fmt={fmt}
        />
      )}

      {tab === 'dashboard' && (
        <DashboardTab stats={stats} months={months} categories={categories} fmt={fmt} fmtShort={fmtShort} />
      )}

      {tab === 'rules' && (
        <RulesTab
          rules={rules} categories={categories}
          newRule={newRule} setNewRule={setNewRule}
          addRule={addRule} deleteRule={deleteRule}
        />
      )}

      {tab === 'import' && (
        <ImportTab loadAll={loadAll} categories={categories} rules={rules} />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  KPI CARD
// ════════════════════════════════════════════════════════════
function KPI({ label, value, color = 'blue', sub }) {
  const colors = {
    green: 'text-green-700 bg-green-50 border-green-200',
    red: 'text-red-700 bg-red-50 border-red-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
  }
  return (
    <div className={`rounded-lg border p-3 ${colors[color] || colors.blue}`}>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  TRANSACTIONS TAB
// ════════════════════════════════════════════════════════════
function TransactionsTab({
  filtered, categories, months,
  filterMonth, setFilterMonth, filterCat, setFilterCat,
  filterDir, setFilterDir, filterSearch, setFilterSearch,
  editingTx, setEditingTx, changeCategory, applyRuleToAll, fmt
}) {
  const catNames = useMemo(() =>
    [...new Set(filtered.map(tx => tx.category_name))].sort(),
    [filtered]
  )

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="all">Tous les mois</option>
            {months.map(m => <option key={m} value={m}>{MONTHS_LABELS[m] || m}</option>)}
          </select>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="all">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
          </select>
          <select value={filterDir} onChange={e => setFilterDir(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="all">Entrées + Sorties</option>
            <option value="debit">Sorties uniquement</option>
            <option value="credit">Entrées uniquement</option>
          </select>
          <input type="text" value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
            placeholder="🔍 Rechercher..."
            className="border rounded-lg px-3 py-2 text-sm col-span-2 md:col-span-2" />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span>{filtered.length} opérations</span>
          <span>Sorties: <b className="text-red-600">{fmt(filtered.reduce((s, tx) => s + (tx.debit || 0), 0))}</b></span>
          <span>Entrées: <b className="text-green-600">{fmt(filtered.reduce((s, tx) => s + (tx.credit || 0), 0))}</b></span>
        </div>
      </div>

      {/* Transaction list */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Catégorie</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Débit</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Crédit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} className="border-t hover:bg-blue-50/30 transition-colors">
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                    {tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-3 py-2 max-w-xs">
                    <div className="truncate text-gray-800" title={tx.description}>{tx.description}</div>
                    {tx.notes && <div className="text-xs text-gray-400 truncate">{tx.notes}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {editingTx === tx.id ? (
                      <div className="space-y-1">
                        <select
                          autoFocus
                          onChange={e => {
                            if (e.target.value) changeCategory(tx.id, e.target.value, false)
                          }}
                          onBlur={() => setEditingTx(null)}
                          className="border rounded px-2 py-1 text-xs w-full"
                          defaultValue="">
                          <option value="">Choisir...</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                        <button
                          onMouseDown={e => {
                            e.preventDefault()
                            const select = e.target.parentElement.querySelector('select')
                            if (select?.value) changeCategory(tx.id, select.value, true)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800">
                          + Créer règle auto
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingTx(tx.id)}
                        className={`text-xs px-2 py-1 rounded-full transition-all hover:ring-2 hover:ring-blue-300
                          ${tx.category_name === 'Autre / Non classé'
                            ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                            : 'bg-gray-100 text-gray-700'}`}>
                        {categories.find(c => c.name === tx.category_name)?.icon || '❓'} {tx.category_name || 'Non classé'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-red-600 whitespace-nowrap">
                    {tx.debit > 0 ? fmt(tx.debit) : ''}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-green-600 whitespace-nowrap">
                    {tx.credit > 0 ? fmt(tx.credit) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">Aucune transaction trouvée</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  DASHBOARD TAB
// ════════════════════════════════════════════════════════════
function DashboardTab({ stats, months, categories, fmt, fmtShort }) {
  const sortedMonths = months.slice().sort()

  // Max value for bar scaling
  const maxMonthly = Math.max(
    ...sortedMonths.map(m => Math.max(stats.byMonth[m]?.debit || 0, stats.byMonth[m]?.credit || 0)),
    1
  )

  // Categories sorted by debit
  const catsSorted = Object.entries(stats.byCat)
    .filter(([_, v]) => v.debit > 0)
    .sort((a, b) => b[1].debit - a[1].debit)

  const maxCatDebit = catsSorted.length > 0 ? catsSorted[0][1].debit : 1

  // Revenue categories
  const revCats = Object.entries(stats.byCat)
    .filter(([name, v]) => v.credit > 0 && !['Prêts (réception)', 'Apports associés', 'Trésorerie interne'].includes(name))
    .sort((a, b) => b[1].credit - a[1].credit)

  return (
    <div className="space-y-4">
      {/* ═══ MONTHLY CHART ═══ */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">📊 Flux mensuels</h3>
        <div className="space-y-2">
          {sortedMonths.map(m => {
            const d = stats.byMonth[m] || { debit: 0, credit: 0 }
            return (
              <div key={m} className="flex items-center gap-2">
                <div className="w-16 text-xs text-gray-500 font-medium">{MONTHS_LABELS[m] || m}</div>
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <div className="bg-green-400 rounded-sm h-3"
                      style={{ width: `${(d.credit / maxMonthly) * 100}%`, minWidth: d.credit > 0 ? '2px' : 0 }} />
                    <span className="text-xs text-green-700">{fmtShort(d.credit)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="bg-red-400 rounded-sm h-3"
                      style={{ width: `${(d.debit / maxMonthly) * 100}%`, minWidth: d.debit > 0 ? '2px' : 0 }} />
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
        {/* ═══ TOP DÉPENSES PAR CATÉGORIE ═══ */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-bold text-gray-700 mb-3">🔴 Dépenses par catégorie</h3>
          <div className="space-y-1.5">
            {catsSorted.slice(0, 15).map(([name, val]) => {
              const cat = categories.find(c => c.name === name)
              return (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-sm w-6">{cat?.icon || '📁'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-700 truncate">{name}</span>
                      <span className="text-red-600 font-medium ml-2">{fmtShort(val.debit)}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2 mt-0.5">
                      <div className="bg-red-400 rounded-full h-2"
                        style={{ width: `${(val.debit / maxCatDebit) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══ REVENUS ═══ */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-bold text-gray-700 mb-3">🟢 Sources de revenus</h3>
          {revCats.length > 0 ? (
            <div className="space-y-1.5">
              {revCats.map(([name, val]) => {
                const cat = categories.find(c => c.name === name)
                const maxRev = revCats[0][1].credit
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-sm w-6">{cat?.icon || '📁'}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700 truncate">{name}</span>
                        <span className="text-green-600 font-medium ml-2">{fmtShort(val.credit)}</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 mt-0.5">
                        <div className="bg-green-400 rounded-full h-2"
                          style={{ width: `${(val.credit / maxRev) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">Aucune source identifiée</div>
          )}
        </div>
      </div>

      {/* ═══ CHARGES FIXES vs VARIABLES ═══ */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">📋 Charges fixes vs variables (moy/mois)</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Fixes</h4>
            {categories.filter(c => c.type === 'fixe' && c.direction === 'depense').map(cat => {
              const val = stats.byCat[cat.name]?.debit || 0
              const monthly = val / (months.length || 1)
              if (monthly < 1) return null
              return (
                <div key={cat.id} className="flex justify-between py-1 border-b border-gray-50 text-sm">
                  <span>{cat.icon} {cat.name}</span>
                  <span className="text-red-600 font-medium">{fmtShort(monthly)}/mois</span>
                </div>
              )
            })}
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Variables</h4>
            {categories.filter(c => c.type === 'variable' && c.direction === 'depense').map(cat => {
              const val = stats.byCat[cat.name]?.debit || 0
              const monthly = val / (months.length || 1)
              if (monthly < 1) return null
              return (
                <div key={cat.id} className="flex justify-between py-1 border-b border-gray-50 text-sm">
                  <span>{cat.icon} {cat.name}</span>
                  <span className="text-orange-600 font-medium">{fmtShort(monthly)}/mois</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  RULES TAB
// ════════════════════════════════════════════════════════════
function RulesTab({ rules, categories, newRule, setNewRule, addRule, deleteRule }) {
  return (
    <div className="space-y-4">
      {/* Add rule */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-3">➕ Nouvelle règle</h3>
        <div className="flex gap-2 flex-wrap">
          <input type="text" value={newRule.keyword}
            onChange={e => setNewRule({ ...newRule, keyword: e.target.value.toUpperCase() })}
            placeholder="Mot-clé (ex: SOCOTEC)"
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-40" />
          <select value={newRule.category_id}
            onChange={e => setNewRule({ ...newRule, category_id: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-48">
            <option value="">Catégorie...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select value={newRule.direction}
            onChange={e => setNewRule({ ...newRule, direction: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="both">Débit + Crédit</option>
            <option value="debit">Débit uniquement</option>
            <option value="credit">Crédit uniquement</option>
          </select>
          <button
            onClick={() => {
              if (!newRule.keyword || !newRule.category_id) {
                toast.error('Mot-clé et catégorie requis')
                return
              }
              addRule(newRule.keyword, newRule.category_id, newRule.direction)
              setNewRule({ keyword: '', category_id: '', direction: 'both' })
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Ajouter
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Quand un libellé contient le mot-clé, la catégorie est automatiquement appliquée.
        </p>
      </div>

      {/* Rules list */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Mot-clé</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">→ Catégorie</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Direction</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs bg-gray-50">{r.keyword}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                      {r.budget_categories?.icon} {r.budget_categories?.name || '?'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {r.direction === 'debit' ? '🔴 Débit' : r.direction === 'credit' ? '🟢 Crédit' : '⚪ Les deux'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => deleteRule(r.id)}
                      className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rules.length === 0 && (
            <div className="text-center py-8 text-gray-400">Aucune règle définie</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  IMPORT TAB
// ════════════════════════════════════════════════════════════
function ImportTab({ loadAll, categories, rules }) {
  const [importing, setImporting] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState([])

  // Parse CSV from CMB export
  function parseCMBcsv(text) {
    const lines = text.trim().split('\n').filter(l => l.trim())
    const txs = []

    for (const line of lines) {
      // CMB CSV format: Date operation;Date valeur;Libelle;Debit;Credit
      const parts = line.split(';')
      if (parts.length < 4) continue
      if (parts[0] === 'Date operation') continue // header

      const dateStr = parts[0].trim()
      const desc = parts[2]?.trim() || ''
      const debitStr = parts[3]?.trim().replace(/\s/g, '').replace(',', '.') || ''
      const creditStr = parts[4]?.trim().replace(/\s/g, '').replace(',', '.') || ''

      if (!dateStr || !desc) continue

      // Parse date DD/MM/YYYY
      const dp = dateStr.split('/')
      if (dp.length !== 3) continue
      const pgDate = `${dp[2].length === 2 ? '20' + dp[2] : dp[2]}-${dp[1]}-${dp[0]}`

      const debit = debitStr ? Math.abs(parseFloat(debitStr)) : 0
      const credit = creditStr ? Math.abs(parseFloat(creditStr)) : 0

      if (isNaN(debit) && isNaN(credit)) continue

      // Auto-categorize
      let catName = 'Autre / Non classé'
      const descUpper = desc.toUpperCase()
      for (const rule of rules) {
        if (rule.direction === 'debit' && debit <= 0) continue
        if (rule.direction === 'credit' && credit <= 0) continue
        if (descUpper.includes(rule.keyword.toUpperCase())) {
          catName = rule.budget_categories?.name || catName
          break
        }
      }

      const month = `${dp[1]}/${dp[2].length === 2 ? '20' + dp[2] : dp[2]}`
      const year = parseInt(dp[2].length === 2 ? '20' + dp[2] : dp[2])

      txs.push({ date: pgDate, description: desc, debit: debit || 0, credit: credit || 0, category_name: catName, month, year })
    }
    return txs
  }

  function handlePreview() {
    const txs = parseCMBcsv(csvText)
    setPreview(txs)
    if (txs.length === 0) toast.error('Aucune transaction détectée')
    else toast.success(`${txs.length} transactions détectées`)
  }

  async function handleImport() {
    if (preview.length === 0) return
    setImporting(true)

    try {
      // Map category names to IDs
      const rows = preview.map(tx => {
        const cat = categories.find(c => c.name === tx.category_name)
        return {
          date: tx.date,
          description: tx.description,
          debit: tx.debit,
          credit: tx.credit,
          category_id: cat?.id || null,
          category_name: tx.category_name,
          month: tx.month,
          year: tx.year,
          source_file: 'import_csv_cmb',
          payer: 'entreprise',
        }
      })

      // Insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50)
        const { error } = await supabase.from('budget_transactions').insert(batch)
        if (error) throw error
      }

      toast.success(`✅ ${rows.length} transactions importées`)
      setCsvText('')
      setPreview([])
      await loadAll()
    } catch (e) {
      console.error(e)
      toast.error('Erreur import: ' + (e.message || 'inconnu'))
    }
    setImporting(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-bold text-gray-700 mb-2">📥 Import CSV Crédit Mutuel</h3>
        <p className="text-sm text-gray-500 mb-3">
          Depuis cmb.fr → Compte → Télécharger → Format Excel XP → Copiez-collez le contenu CSV ici.
          <br />Ou collez directement le contenu du fichier .csv téléchargé.
        </p>
        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          placeholder="Date operation;Date valeur;Libelle;Debit;Credit&#10;18/02/2026;18/02/2026;CARTE 17/02 CHEZ MAM'BREIZH;147,35&#10;..."
          className="w-full h-40 border rounded-lg p-3 text-xs font-mono resize-y"
        />
        <div className="flex gap-2 mt-2">
          <button onClick={handlePreview} disabled={!csvText.trim()}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
            👁️ Prévisualiser
          </button>
          {preview.length > 0 && (
            <button onClick={handleImport} disabled={importing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {importing ? '⏳ Import...' : `✅ Importer ${preview.length} transactions`}
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-2 bg-amber-50 border-b text-sm text-amber-700 font-medium">
            ⚠️ Prévisualisation — {preview.length} transactions à importer
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1">Date</th>
                  <th className="text-left px-2 py-1">Description</th>
                  <th className="text-left px-2 py-1">Catégorie</th>
                  <th className="text-right px-2 py-1">Débit</th>
                  <th className="text-right px-2 py-1">Crédit</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((tx, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">{tx.date}</td>
                    <td className="px-2 py-1 truncate max-w-xs">{tx.description}</td>
                    <td className="px-2 py-1">
                      <span className={`px-1.5 py-0.5 rounded text-xs
                        ${tx.category_name === 'Autre / Non classé' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100'}`}>
                        {tx.category_name}
                      </span>
                    </td>
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
