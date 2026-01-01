import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Search, Edit, Trash2, User, Building2 } from 'lucide-react'

export default function Trainees() {
  const { trainees, clients, loadTrainees } = useStore()
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('')

  const filtered = trainees.filter(t => {
    const matchSearch = `${t.first_name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase())
    const matchClient = !filterClient || t.client_id === filterClient
    return matchSearch && matchClient
  })

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId)
    return client ? client.name : '-'
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce stagiaire ?')) return
    const { error } = await supabase.from('trainees').delete().eq('id', id)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Stagiaire supprimé')
      loadTrainees()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stagiaires</h1>
          <p className="text-gray-500">{trainees.length} stagiaire(s)</p>
        </div>
        <Link
          to="/stagiaires/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Nouveau stagiaire
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">Tous les clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Téléphone</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Client</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Fonction</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((trainee) => (
              <tr key={trainee.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="font-medium">{trainee.first_name} {trainee.last_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{trainee.email || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{trainee.phone || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{getClientName(trainee.client_id)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{trainee.job_title || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      to={`/stagiaires/${trainee.id}`}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(trainee.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucun stagiaire trouvé
          </div>
        )}
      </div>
    </div>
  )
}
