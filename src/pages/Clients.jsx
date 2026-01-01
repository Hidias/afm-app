// ============================================
// FICHIER: src/pages/Clients.jsx
// ============================================
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Search, Edit, Trash2, Building2 } from 'lucide-react'

export default function Clients() {
  const { clients, loadClients } = useStore()
  const [search, setSearch] = useState('')

  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce client ?')) return
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Client supprimé')
      loadClients()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500">{clients.length} client(s)</p>
        </div>
        <Link to="/clients/new" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="h-4 w-4" />
          Nouveau client
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Contact</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Ville</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">SIRET</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary-600" />
                    </div>
                    <span className="font-medium">{client.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{client.contact_name || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{client.city || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{client.siret || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link to={`/clients/${client.id}`} className="p-2 text-gray-500 hover:bg-gray-100 rounded">
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button onClick={() => handleDelete(client.id)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">Aucun client trouvé</div>
        )}
      </div>
    </div>
  )
}
