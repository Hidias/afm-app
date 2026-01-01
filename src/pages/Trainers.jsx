import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Search, Edit, Trash2, Users } from 'lucide-react'

export default function Trainers() {
  const { trainers, loadTrainers } = useStore()
  const [search, setSearch] = useState('')

  const filtered = trainers.filter(t => 
    `${t.first_name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce formateur ?')) return
    const { error } = await supabase.from('trainers').delete().eq('id', id)
    if (error) toast.error('Erreur lors de la suppression')
    else { toast.success('Formateur supprimé'); loadTrainers() }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formateurs</h1>
          <p className="text-gray-500">{trainers.length} formateur(s)</p>
        </div>
        <Link to="/formateurs/new" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="h-4 w-4" />
          Nouveau formateur
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Nom</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Email</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Téléphone</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Certificats</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((trainer) => (
              <tr key={trainer.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Users className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="font-medium">{trainer.first_name} {trainer.last_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{trainer.email || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{trainer.phone || '-'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    {trainer.trainer_certificates?.length || 0} certificat(s)
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link to={`/formateurs/${trainer.id}`} className="p-2 text-gray-500 hover:bg-gray-100 rounded"><Edit className="h-4 w-4" /></Link>
                    <button onClick={() => handleDelete(trainer.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-gray-500">Aucun formateur trouvé</div>}
      </div>
    </div>
  )
}
