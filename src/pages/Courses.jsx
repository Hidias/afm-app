import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Search, Edit, Trash2, BookOpen } from 'lucide-react'

export default function Courses() {
  const { courses, loadCourses } = useStore()
  const [search, setSearch] = useState('')

  const filtered = courses.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette formation ?')) return
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Formation supprimée')
      loadCourses()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formations</h1>
          <p className="text-gray-500">{courses.length} formation(s)</p>
        </div>
        <Link to="/formations/new" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="h-4 w-4" />
          Nouvelle formation
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((course) => (
          <div key={course.id} className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{course.title}</h3>
                  <p className="text-sm text-gray-500">{course.code || 'Sans code'}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-500">{course.duration_days}j ({course.duration_hours}h)</span>
              <span className="font-medium text-gray-900">{course.price_ht ? `${course.price_ht}€ HT` : '-'}</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Link to={`/formations/${course.id}`} className="flex-1 text-center py-2 text-primary-600 hover:bg-primary-50 rounded-lg text-sm font-medium">
                Modifier
              </Link>
              <button onClick={() => handleDelete(course.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div className="text-center py-12 text-gray-500 bg-white rounded-xl">Aucune formation trouvée</div>}
    </div>
  )
}
