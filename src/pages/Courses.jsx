import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { Plus, Search, Edit, Trash2, X, GraduationCap, ChevronDown, ChevronUp, FileText, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

const defaultPedagogicalMethods = "La formation est dispensée selon une pédagogie active et participative : alternance d'apports théoriques, d'exercices pratiques et de mises en situation. Les supports de formation sont remis aux participants."

const defaultEvaluationMethods = "Évaluation formative pendant la formation (mises en situation, QCM, exercices pratiques). Évaluation sommative en fin de formation."

const defaultDeliveredDocuments = "Une attestation de fin de formation, un certificat de réalisation."

export default function Courses() {
  const { courses, coursesLoading, fetchCourses, createCourse, updateCourse, deleteCourse } = useDataStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    objectives: '',
    duration_hours: '',
    modality: 'presential',
    price_ht: '',
    price_ttc: '',
    target_audience: 'Tout public',
    prerequisites: 'Aucun',
    program: '',
    pedagogical_methods: defaultPedagogicalMethods,
    evaluation_methods: defaultEvaluationMethods,
    delivered_documents: defaultDeliveredDocuments,
  })
  
  useEffect(() => { fetchCourses() }, [])
  
  const filteredItems = courses.filter(c =>
    c.code?.toLowerCase().includes(search.toLowerCase()) ||
    c.title?.toLowerCase().includes(search.toLowerCase())
  )
  
  const resetForm = () => {
    setFormData({
      code: '',
      title: '',
      description: '',
      objectives: '',
      duration_hours: '',
      modality: 'presential',
      price_ht: '',
      price_ttc: '',
      target_audience: 'Tout public',
      prerequisites: 'Aucun',
      program: '',
      pedagogical_methods: defaultPedagogicalMethods,
      evaluation_methods: defaultEvaluationMethods,
      delivered_documents: defaultDeliveredDocuments,
    })
    setEditingItem(null)
    setShowForm(false)
    setShowAdvanced(false)
  }
  
  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      code: item.code || '',
      title: item.title || '',
      description: item.description || '',
      objectives: item.objectives || '',
      duration_hours: item.duration_hours || '',
      modality: item.modality || 'presential',
      price_ht: item.price_ht || '',
      price_ttc: item.price_ttc || '',
      target_audience: item.target_audience || 'Tout public',
      prerequisites: item.prerequisites || 'Aucun',
      program: item.program || '',
      pedagogical_methods: item.pedagogical_methods || defaultPedagogicalMethods,
      evaluation_methods: item.evaluation_methods || defaultEvaluationMethods,
      delivered_documents: item.delivered_documents || defaultDeliveredDocuments,
    })
    setShowForm(true)
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.code || !formData.title) {
      toast.error('Code et intitulé obligatoires')
      return
    }
    
    const payload = {
      ...formData,
      duration_hours: parseFloat(formData.duration_hours) || 0,
      price_ht: formData.price_ht ? parseFloat(formData.price_ht) : null,
      price_ttc: formData.price_ttc ? parseFloat(formData.price_ttc) : null,
    }
    
    if (editingItem) {
      const { error } = await updateCourse(editingItem.id, payload)
      if (error) {
        toast.error('Erreur lors de la modification')
        console.error(error)
      } else {
        toast.success('Formation modifiée')
        resetForm()
      }
    } else {
      const { error } = await createCourse(payload)
      if (error) {
        toast.error('Erreur lors de la création')
        console.error(error)
      } else {
        toast.success('Formation créée')
        resetForm()
      }
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette formation ?')) return
    const { error } = await deleteCourse(id)
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Formation supprimée')
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
        <input
          type="text"
          placeholder="Rechercher par code ou intitulé..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>
      
      <div className="card p-0 overflow-hidden">
        {coursesLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {search ? 'Aucune formation trouvée' : 'Aucune formation enregistrée'}
          </div>
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
                      <p className="text-sm text-gray-500">
                        {item.duration_hours}h • 
                        {item.modality === 'presential' ? ' Présentiel' : item.modality === 'remote' ? ' Distanciel' : ' Mixte'}
                        {item.price_ht && ` • ${item.price_ht} € HT`}
                      </p>
                      {item.objectives && (
                        <p className="text-sm text-gray-400 mt-1 line-clamp-1">{item.objectives}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 hover:bg-red-50 rounded-lg"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white flex items-center justify-between p-4 border-b border-gray-200 z-10">
                <h2 className="text-lg font-semibold">
                  {editingItem ? 'Modifier la formation' : 'Nouvelle formation'}
                </h2>
                <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Informations principales */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900 border-b pb-2">Informations générales</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Code *</label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                        className="input"
                        placeholder="Ex: SST-01"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Durée (heures) *</label>
                      <input
                        type="number"
                        step="0.5"
                        value={formData.duration_hours}
                        onChange={(e) => setFormData({...formData, duration_hours: e.target.value})}
                        className="input"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="label">Intitulé *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="input"
                      placeholder="Ex: Sauveteur Secouriste du Travail"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="label">Objectifs professionnels</label>
                    <textarea
                      value={formData.objectives}
                      onChange={(e) => setFormData({...formData, objectives: e.target.value})}
                      className="input"
                      rows={3}
                      placeholder="Objectifs de la formation..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label">Modalité</label>
                      <select
                        value={formData.modality}
                        onChange={(e) => setFormData({...formData, modality: e.target.value})}
                        className="input"
                      >
                        <option value="presential">Présentiel</option>
                        <option value="remote">Distanciel</option>
                        <option value="hybrid">Mixte</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Prix HT (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_ht}
                        onChange={(e) => setFormData({...formData, price_ht: e.target.value})}
                        className="input"
                        placeholder="Ex: 350"
                      />
                    </div>
                    <div>
                      <label className="label">Prix TTC (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_ttc}
                        onChange={(e) => setFormData({...formData, price_ttc: e.target.value})}
                        className="input"
                        placeholder="Ex: 420"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Public concerné</label>
                      <input
                        type="text"
                        value={formData.target_audience}
                        onChange={(e) => setFormData({...formData, target_audience: e.target.value})}
                        className="input"
                        placeholder="Ex: Tout public"
                      />
                    </div>
                    <div>
                      <label className="label">Prérequis</label>
                      <input
                        type="text"
                        value={formData.prerequisites}
                        onChange={(e) => setFormData({...formData, prerequisites: e.target.value})}
                        className="input"
                        placeholder="Ex: Aucun"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Section avancée */}
                <div className="border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Paramètres avancés (convention, programme...)
                  </button>
                  
                  {showAdvanced && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="label">Contenu / Programme détaillé</label>
                        <textarea
                          value={formData.program}
                          onChange={(e) => setFormData({...formData, program: e.target.value})}
                          className="input"
                          rows={4}
                          placeholder="Détaillez le programme de la formation..."
                        />
                      </div>
                      
                      <div>
                        <label className="label">Moyens et modalités pédagogiques</label>
                        <textarea
                          value={formData.pedagogical_methods}
                          onChange={(e) => setFormData({...formData, pedagogical_methods: e.target.value})}
                          className="input"
                          rows={3}
                        />
                        <p className="text-xs text-gray-400 mt-1">Ce texte apparaîtra dans les conventions de formation</p>
                      </div>
                      
                      <div>
                        <label className="label">Modalités de suivi et d'évaluation</label>
                        <textarea
                          value={formData.evaluation_methods}
                          onChange={(e) => setFormData({...formData, evaluation_methods: e.target.value})}
                          className="input"
                          rows={2}
                        />
                      </div>
                      
                      <div>
                        <label className="label">Documents délivrés</label>
                        <textarea
                          value={formData.delivered_documents}
                          onChange={(e) => setFormData({...formData, delivered_documents: e.target.value})}
                          className="input"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={resetForm} className="btn btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingItem ? 'Enregistrer' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
