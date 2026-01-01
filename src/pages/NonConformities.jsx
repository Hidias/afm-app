import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Search, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'

const statusColors = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-green-100 text-green-700',
}

const statusLabels = {
  open: 'Ouverte',
  in_progress: 'En cours',
  closed: 'Clôturée',
}

const severityColors = {
  minor: 'bg-blue-100 text-blue-700',
  major: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const severityLabels = {
  minor: 'Mineure',
  major: 'Majeure',
  critical: 'Critique',
}

const sourceLabels = {
  complaint: 'Réclamation',
  audit: 'Audit',
  internal: 'Interne',
}

export default function NonConformities() {
  const { nonConformities, loadNonConformities } = useStore()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')

  const filtered = nonConformities.filter(nc => {
    const matchSearch = nc.reference?.toLowerCase().includes(search.toLowerCase()) ||
      nc.title?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || nc.status === filterStatus
    const matchSeverity = !filterSeverity || nc.severity === filterSeverity
    return matchSearch && matchStatus && matchSeverity
  })

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette non-conformité ?')) return
    const { error } = await supabase.from('non_conformities').delete().eq('id', id)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Non-conformité supprimée')
      loadNonConformities()
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <XCircle className="h-5 w-5 text-red-500" />
      case 'in_progress': return <Clock className="h-5 w-5 text-yellow-500" />
      case 'closed': return <CheckCircle className="h-5 w-5 text-green-500" />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Non-conformités</h1>
          <p className="text-gray-500">{nonConformities.length} non-conformité(s)</p>
        </div>
        <Link
          to="/non-conformites/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Nouvelle NC
        </Link>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {nonConformities.filter(nc => nc.status === 'open').length}
            </p>
            <p className="text-sm text-gray-500">Ouvertes</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {nonConformities.filter(nc => nc.status === 'in_progress').length}
            </p>
            <p className="text-sm text-gray-500">En cours</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {nonConformities.filter(nc => nc.status === 'closed').length}
            </p>
            <p className="text-sm text-gray-500">Clôturées</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">Tous les statuts</option>
          <option value="open">Ouverte</option>
          <option value="in_progress">En cours</option>
          <option value="closed">Clôturée</option>
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">Toutes sévérités</option>
          <option value="minor">Mineure</option>
          <option value="major">Majeure</option>
          <option value="critical">Critique</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Référence</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Titre</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Source</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Sévérité</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Échéance</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Statut</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((nc) => (
              <tr key={nc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-mono text-sm">{nc.reference}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">{nc.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {sourceLabels[nc.source] || nc.source}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColors[nc.severity]}`}>
                    {severityLabels[nc.severity]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {formatDate(nc.due_date)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(nc.status)}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[nc.status]}`}>
                      {statusLabels[nc.status]}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      to={`/non-conformites/${nc.id}`}
                      className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded"
                    >
                      Modifier
                    </Link>
                    <button
                      onClick={() => handleDelete(nc.id)}
                      className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucune non-conformité trouvée
          </div>
        )}
      </div>
    </div>
  )
}
