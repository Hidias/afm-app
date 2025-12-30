// Pages simples pour les autres sections
// Ces pages suivent le même modèle que Clients.jsx et Sessions.jsx

import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { Plus, Search, Edit, Trash2, X, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Courses() {
  const { courses, coursesLoading, fetchCourses, createCourse, updateCourse } = useDataStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    objectives: '',
    duration_hours: '',
    modality: 'presential',
    price_ht: ''
  })
  
  useEffect(() => { fetchCourses() }, [])
  
  const filteredItems = courses.filter(c =>
    c.code?.toLowerCase().includes(search.toLowerCase()) ||
    c.title?.toLowerCase().includes(search.toLowerCase())
  )
  
  const resetForm = () => {
    setFormData({ code: '', title: '', description: '', objectives: '', duration_hours: '', modality: 'presential', price_ht: '' })
    setEditingItem(null)
    setShowForm(false)
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...formData, duration_hours: parseFloat(formData.duration_hours) || 0 }
    if (formData.price_ht) payload.price_ht = parseFloat(formData.price_ht)
    
    if (editingItem) {
      const { error } = await updateCourse(editingItem.id, payload)
      if (error) toast.error('Erreur')
      else { toast.success('Modifié'); resetForm() }
    } else {
      const { error } = await createCourse(payload)
      if (error) toast.error('Erreur')
      else { toast.success('Créé'); resetForm() }
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formations</h1>
          <p className="text-gray-500 mt-1">{courses.length} formation(s)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle formation
        </button>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
      </div>
      
      <div className="card p-0 overflow-hidden">
        {coursesLoading ? (
          <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div></div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucune formation</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredItems.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.code} - {item.title}</p>
                      <p className="text-sm text-gray-500">{item.duration_hours}h • {item.modality === 'presential' ? 'Présentiel' : item.modality === 'remote' ? 'Distanciel' : 'Mixte'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingItem(item); setFormData(item); setShowForm(true) }} className="p-2 hover:bg-gray-100 rounded-lg">
                      <Edit className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg animate-fadeIn">
              <div className="flex items-center justify-between p-4 border-b"><h2 className="text-lg font-semibold">{editingItem ? 'Modifier' : 'Nouvelle formation'}</h2><button onClick={resetForm}><X className="w-5 h-5" /></button></div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Code *</label><input type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} className="input" required /></div>
                  <div><label className="label">Durée (heures) *</label><input type="number" step="0.5" value={formData.duration_hours} onChange={(e) => setFormData({...formData, duration_hours: e.target.value})} className="input" required /></div>
                </div>
                <div><label className="label">Intitulé *</label><input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="input" required /></div>
                <div><label className="label">Objectifs</label><textarea value={formData.objectives} onChange={(e) => setFormData({...formData, objectives: e.target.value})} className="input" rows={3} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Modalité</label><select value={formData.modality} onChange={(e) => setFormData({...formData, modality: e.target.value})} className="input"><option value="presential">Présentiel</option><option value="remote">Distanciel</option><option value="hybrid">Mixte</option></select></div>
                  <div><label className="label">Prix HT (€)</label><input type="number" value={formData.price_ht} onChange={(e) => setFormData({...formData, price_ht: e.target.value})} className="input" /></div>
                </div>
                <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={resetForm} className="btn btn-secondary">Annuler</button><button type="submit" className="btn btn-primary">{editingItem ? 'Enregistrer' : 'Créer'}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
