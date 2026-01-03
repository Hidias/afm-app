import { useEffect, useState, useRef } from 'react'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Plus, Search, Edit, Trash2, X, Save, Clock, Users, Euro, Copy, Upload, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'

// Parser CSV Sellsy pour les formations
const parseSellsyFormationsCSV = (csvText) => {
  const lines = csvText.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  
  // Ignorer la première ligne si c'est le nom du fichier
  const startLine = lines[0].includes('ID Produit') ? 0 : 1
  const headers = lines[startLine].split(';').map(h => h.replace(/"/g, '').trim())
  
  // Trouver les index des colonnes
  const getIdx = (patterns) => headers.findIndex(h => patterns.some(p => h.toLowerCase().includes(p.toLowerCase())))
  const idx = {
    reference: getIdx(['référence', 'reference']),
    name: getIdx(['nom commercial', 'nom']),
    description: getIdx(['description']),
    priceHT: getIdx(['prix référence ht', 'prix ht', 'tarif ht']),
    tags: getIdx(['smart-tags', 'tags', 'catégorie']),
  }
  
  const formations = []
  for (let i = startLine + 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.replace(/"/g, '').trim())
    if (values.length < 5) continue
    
    const name = values[idx.name] || ''
    const description = values[idx.description] || ''
    const reference = values[idx.reference] || ''
    
    // Extraire la durée depuis la description (ex: "7 heures", "14 heures", "3,5 heures")
    let duration = 7 // défaut
    const durationMatch = description.match(/(\d+(?:,\d+)?)\s*heures?/i)
    if (durationMatch) {
      duration = parseFloat(durationMatch[1].replace(',', '.'))
    }
    
    // Parser le prix (ex: "785,00" -> 785)
    let price = 0
    const priceStr = values[idx.priceHT] || ''
    if (priceStr) {
      price = parseFloat(priceStr.replace(/\s/g, '').replace(',', '.')) || 0
    }
    
    // Tags/catégorie
    const tags = values[idx.tags] || ''
    
    if (name) {
      formations.push({
        reference,
        title: name,
        description,
        duration_hours: duration,
        price_ht: price,
        category: tags,
      })
    }
  }
  
  return formations
}

export default function Courses() {
  const { 
    courses, fetchCourses, createCourse, updateCourse, deleteCourse, duplicateCourse,
    themes, fetchThemes
  } = useDataStore()
  
  const [search, setSearch] = useState('')
  const [themeFilter, setThemeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    title: '', description: '', duration: '', objectives: '', content: '',
    prerequisites: '', target_audience: '', methods: '', price_per_day: '', price_ht: '', material: '', theme_id: ''
  })
  
  useEffect(() => { 
    fetchCourses() 
    fetchThemes()
  }, [])
  
  const filtered = courses.filter(c => {
    const searchFields = `${c.title || ''} ${c.description || ''} ${c.reference || ''} ${c.objectives || ''}`.toLowerCase()
    const matchSearch = !search || searchFields.includes(search.toLowerCase())
    const matchTheme = !themeFilter || c.theme_id === themeFilter
    return matchSearch && matchTheme
  })
  
  const getTheme = (themeId) => themes.find(t => t.id === themeId)
  
  // Import Sellsy
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result
        const parsed = parseSellsyFormationsCSV(text)
        if (parsed.length === 0) {
          toast.error('Aucune formation trouvée dans le fichier')
          return
        }
        setImportPreview(parsed)
      } catch (error) {
        console.error('Parse error:', error)
        toast.error('Erreur lors de la lecture du fichier')
      }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }
  
  const executeImport = async () => {
    if (!importPreview || importPreview.length === 0) return
    setImporting(true)
    
    let created = 0
    let skipped = 0
    
    for (const formation of importPreview) {
      // Vérifier si la formation existe déjà (par titre)
      const existing = courses.find(c => 
        c.title?.toLowerCase() === formation.title?.toLowerCase()
      )
      
      if (existing) {
        skipped++
        continue
      }
      
      // Créer la formation
      const { error } = await createCourse({
        title: formation.title,
        description: formation.description,
        duration_hours: formation.duration_hours,
        price_ht: formation.price_ht,
        objectives: '',
        program: '',
        prerequisites: '',
        target_audience: '',
        methods: 'Apports théoriques et pratiques, mises en situation, études de cas',
        material: '',
      })
      
      if (!error) created++
    }
    
    await fetchCourses()
    setImporting(false)
    setImportPreview(null)
    toast.success(`Import terminé : ${created} formation(s) créée(s), ${skipped} ignorée(s) (déjà existantes)`)
  }
  
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
        <div className="flex gap-2">
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".csv" 
            onChange={handleFileSelect}
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="btn btn-secondary flex items-center gap-2"
            title="Importer depuis Sellsy"
          >
            <Upload className="w-4 h-4" />Import Sellsy
          </button>
          <button onClick={() => openForm()} className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle formation
          </button>
        </div>
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
      
      {/* Modal Import Sellsy Preview */}
      {importPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => !importing && setImportPreview(null)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b bg-green-50">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-6 h-6 text-green-600" />
                  <div>
                    <h2 className="text-lg font-semibold">Import formations Sellsy</h2>
                    <p className="text-sm text-gray-600">{importPreview.length} formation(s) détectée(s)</p>
                  </div>
                </div>
                {!importing && <button onClick={() => setImportPreview(null)}><X className="w-5 h-5" /></button>}
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Formation</th>
                      <th className="text-center py-2 px-3 font-medium">Durée</th>
                      <th className="text-right py-2 px-3 font-medium">Prix HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importPreview.map((formation, idx) => {
                      const exists = courses.find(c => c.title?.toLowerCase() === formation.title?.toLowerCase())
                      return (
                        <tr key={idx} className={exists ? 'bg-yellow-50' : ''}>
                          <td className="py-2 px-3">
                            <div className="font-medium">{formation.title}</div>
                            <div className="text-xs text-gray-500 truncate max-w-md">{formation.description}</div>
                            {exists && <span className="text-xs text-yellow-600">⚠️ Existe déjà</span>}
                          </td>
                          <td className="py-2 px-3 text-center text-gray-600">{formation.duration_hours}h</td>
                          <td className="py-2 px-3 text-right text-gray-900 font-medium">{formation.price_ht?.toLocaleString('fr-FR')} €</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                <p className="text-sm text-gray-600">
                  Les formations existantes seront ignorées. Toutes les formations importées sont modifiables.
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setImportPreview(null)} 
                    className="btn btn-secondary"
                    disabled={importing}
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={executeImport} 
                    className="btn btn-primary flex items-center gap-2"
                    disabled={importing}
                  >
                    {importing ? (
                      <>
                        <span className="animate-spin">⏳</span> Import en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" /> Importer
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
