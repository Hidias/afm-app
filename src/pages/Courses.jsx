import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { Plus, Search, Edit, Trash2, X, Save, Clock, Users, Euro, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Courses() {
  const { 
    courses, fetchCourses, createCourse, updateCourse, deleteCourse, duplicateCourse,
    themes, fetchThemes
  } = useDataStore()
  
  const [search, setSearch] = useState('')
  const [themeFilter, setThemeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [form, setForm] = useState({
    title: '', description: '', duration: '', objectives: '', content: '',
    prerequisites: '', target_audience: '', methods: '', price_per_day: '', price_ht: '', material: '', theme_id: ''
  })
  
  useEffect(() => { 
    fetchCourses() 
    fetchThemes()
  }, [])
  
  const filtered = courses.filter(c => {
    const matchSearch = c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase())
    const matchTheme = !themeFilter || c.theme_id === themeFilter
    return matchSearch && matchTheme
  })
  
  const getTheme = (themeId) => themes.find(t => t.id === themeId)
  
  const openForm = (course = null) => {
    if (course) {
      setForm({
        title: course.title || '',
        description: course.description || '',
        duration: course.duration_hours || course.duration || '',
        objectives: course.objectives || '',
        content: course.program || course.content || '',
        prerequisites: course.prerequisites || '',
        target_audience: course.target_audience || '',
        methods: course.methods || '',
        price_per_day: course.price_per_day || '',
        price_ht: course.price_ht || '',
        material: course.material || '',
        theme_id: course.theme_id || '',
      })
      setSelectedCourse(course)
    } else {
      setForm({
        title: '', description: '', duration: '', objectives: '', content: '',
        prerequisites: '', target_audience: '', methods: '', price_per_day: '', price_ht: '', material: '', theme_id: ''
      })
      setSelectedCourse(null)
    }
    setShowForm(true)
  }
  
  const handleSave = async () => {
    if (!form.title) return toast.error('Titre requis')
    if (!form.duration) return toast.error('Durée requise')
    
    const data = {
      title: form.title,
      description: form.description || null,
      objectives: form.objectives || null,
      prerequisites: form.prerequisites || null,
      target_audience: form.target_audience || null,
      duration_hours: form.duration ? parseFloat(form.duration) : 7,
      price_ht: form.price_ht ? parseFloat(form.price_ht) : null,
      theme_id: form.theme_id || null,
    }
    
    // Code auto pour nouvelle formation
    if (!selectedCourse) {
      data.code = `F${Date.now().toString(36).toUpperCase()}`
    }
    
    try {
      if (selectedCourse) {
        const { error } = await updateCourse(selectedCourse.id, data)
        if (error) throw error
        toast.success('Formation modifiée')
      } else {
        const { error } = await createCourse(data)
        if (error) throw error
        toast.success('Formation créée')
      }
      setShowForm(false)
      fetchCourses()
    } catch (error) {
      console.error('Erreur:', error)
      toast.error(error.message || 'Erreur lors de la sauvegarde')
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette formation ?')) return
    await deleteCourse(id)
    toast.success('Formation supprimée')
  }
  
  const handleDuplicate = async (id) => {
    const { error } = await duplicateCourse(id)
    if (error) {
      toast.error('Erreur lors de la duplication')
    } else {
      toast.success('Formation dupliquée')
      fetchCourses()
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formations</h1>
          <p className="text-gray-500 mt-1">{courses.length} formation(s)</p>
        </div>
        <button onClick={() => openForm()} className="btn btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle formation
        </button>
      </div>
      
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={themeFilter}
          onChange={(e) => setThemeFilter(e.target.value)}
          className="input w-full sm:w-48"
        >
          <option value="">Tous les thèmes</option>
          {themes.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      
      {/* Liste */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full card p-8 text-center text-gray-500">
            {search || themeFilter ? 'Aucun résultat' : 'Aucune formation - Créez-en une !'}
          </div>
        ) : (
          filtered.map(course => {
            const theme = getTheme(course.theme_id)
            return (
              <div key={course.id} className="card hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    {theme && (
                      <span 
                        className="inline-block px-2 py-0.5 rounded text-xs text-white mb-2"
                        style={{ backgroundColor: theme.color }}
                      >
                        {theme.name}
                      </span>
                    )}
                    <h3 className="font-semibold text-gray-900">{course.title}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDuplicate(course.id)} className="p-1.5 hover:bg-gray-100 rounded" title="Dupliquer">
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => openForm(course)} className="p-1.5 hover:bg-gray-100 rounded" title="Modifier">
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => handleDelete(course.id)} className="p-1.5 hover:bg-red-50 rounded" title="Supprimer">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
                
                {course.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{course.description}</p>
                )}
                
                <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {course.duration_hours || course.duration || '?'}h
                  </span>
                  {course.price_ht && (
                    <span className="flex items-center gap-1">
                      <Euro className="w-4 h-4" />
                      {course.price_ht}€
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      
      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">
                {selectedCourse ? 'Modifier la formation' : 'Nouvelle formation'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Thème */}
              <div>
                <label className="label">Thème de formation *</label>
                <select
                  className="input"
                  value={form.theme_id}
                  onChange={(e) => setForm({...form, theme_id: e.target.value})}
                >
                  <option value="">Sélectionner un thème...</option>
                  {themes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Titre */}
              <div>
                <label className="label">Intitulé *</label>
                <input type="text" className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} />
              </div>
              
              {/* Description */}
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
              </div>
              
              {/* Durée et Prix */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Durée (heures) *</label>
                  <input type="number" className="input" value={form.duration} onChange={(e) => setForm({...form, duration: e.target.value})} />
                </div>
                <div>
                  <label className="label">Prix/jour (€)</label>
                  <input type="number" className="input" value={form.price_per_day} onChange={(e) => setForm({...form, price_per_day: e.target.value})} />
                </div>
                <div>
                  <label className="label">Prix total HT (€)</label>
                  <input type="number" className="input" value={form.price_ht} onChange={(e) => setForm({...form, price_ht: e.target.value})} />
                </div>
              </div>
              
              {/* Objectifs */}
              <div>
                <label className="label">Objectifs (un par ligne)</label>
                <textarea className="input" rows={3} value={form.objectives} onChange={(e) => setForm({...form, objectives: e.target.value})} placeholder="Objectif 1&#10;Objectif 2&#10;Objectif 3" />
              </div>
              
              {/* Contenu */}
              <div>
                <label className="label">Programme / Contenu</label>
                <textarea className="input" rows={4} value={form.content} onChange={(e) => setForm({...form, content: e.target.value})} />
              </div>
              
              {/* Public et Prérequis */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Public cible</label>
                  <input type="text" className="input" value={form.target_audience} onChange={(e) => setForm({...form, target_audience: e.target.value})} />
                </div>
                <div>
                  <label className="label">Prérequis</label>
                  <input type="text" className="input" value={form.prerequisites} onChange={(e) => setForm({...form, prerequisites: e.target.value})} />
                </div>
              </div>
              
              {/* Matériel */}
              <div>
                <label className="label">Matériel requis</label>
                <input type="text" className="input" placeholder="Ex: Tenue de sport, chaussures de sécurité..." value={form.material} onChange={(e) => setForm({...form, material: e.target.value})} />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t">
              <button onClick={() => setShowForm(false)} className="btn btn-secondary">Annuler</button>
              <button onClick={handleSave} className="btn btn-primary">
                <Save className="w-4 h-4 mr-2" />{selectedCourse ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
