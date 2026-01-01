import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { Plus, Search, Edit, Trash2, X, Save, Clock, Users, Euro, HelpCircle, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Courses() {
  const { 
    courses, fetchCourses, createCourse, updateCourse, deleteCourse,
    fetchCourseQuestions, createCourseQuestion, updateCourseQuestion, deleteCourseQuestion
  } = useDataStore()
  
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [questions, setQuestions] = useState([])
  const [form, setForm] = useState({
    title: '', description: '', duration: '', objectives: '', content: '',
    prerequisites: '', target_audience: '', methods: '', price_per_day: '', price_ht: '', material: ''
  })
  const [questionForm, setQuestionForm] = useState({
    question_text: '', question_type: 'qcm', option_a: '', option_b: '', option_c: ''
  })
  const [editingQuestion, setEditingQuestion] = useState(null)
  
  useEffect(() => { fetchCourses() }, [])
  
  const filtered = courses.filter(c => 
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  )
  
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
      })
      setSelectedCourse(course)
    } else {
      setForm({
        title: '', description: '', duration: '', objectives: '', content: '',
        prerequisites: '', target_audience: '', methods: '', price_per_day: '', price_ht: '', material: ''
      })
      setSelectedCourse(null)
    }
    setShowForm(true)
  }
  
  const handleSave = async () => {
    if (!form.title) return toast.error('Titre requis')
    if (!form.duration) return toast.error('Durée requise')
    
    // Code auto-généré
    const code = selectedCourse?.code || `F${Date.now().toString(36).toUpperCase()}`
    
    // UNIQUEMENT les colonnes de base qui existent à coup sûr
    const data = {
      code,
      title: form.title,
      description: form.description || null,
      objectives: form.objectives || null,
      prerequisites: form.prerequisites || null,
      target_audience: form.target_audience || null,
      duration_hours: form.duration ? parseFloat(form.duration) : 7,
      price_ht: form.price_ht ? parseFloat(form.price_ht) : null,
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
  
  // Gestion des questions
  const openQuestions = async (course) => {
    setSelectedCourse(course)
    const { data } = await fetchCourseQuestions(course.id)
    setQuestions(data || [])
    setShowQuestions(true)
    setQuestionForm({ question_text: '', question_type: 'qcm', option_a: '', option_b: '', option_c: '' })
    setEditingQuestion(null)
  }
  
  const handleSaveQuestion = async () => {
    if (!questionForm.question_text) return toast.error('Question requise')
    if (questionForm.question_type === 'qcm' && !questionForm.option_a) return toast.error('Au moins une réponse requise')
    
    if (editingQuestion) {
      await updateCourseQuestion(editingQuestion.id, questionForm)
      setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? { ...q, ...questionForm } : q))
      toast.success('Question modifiée')
    } else {
      const { data } = await createCourseQuestion(selectedCourse.id, { ...questionForm, position: questions.length })
      if (data) setQuestions(prev => [...prev, data])
      toast.success('Question ajoutée')
    }
    setQuestionForm({ question_text: '', question_type: 'qcm', option_a: '', option_b: '', option_c: '' })
    setEditingQuestion(null)
  }
  
  const handleEditQuestion = (q) => {
    setEditingQuestion(q)
    setQuestionForm({
      question_text: q.question_text,
      question_type: q.question_type,
      option_a: q.option_a || '',
      option_b: q.option_b || '',
      option_c: q.option_c || '',
    })
  }
  
  const handleDeleteQuestion = async (id) => {
    if (!confirm('Supprimer cette question ?')) return
    await deleteCourseQuestion(id)
    setQuestions(prev => prev.filter(q => q.id !== id))
    toast.success('Question supprimée')
  }
  
  const moveQuestion = async (index, direction) => {
    const newQuestions = [...questions]
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= newQuestions.length) return
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]]
    setQuestions(newQuestions)
    // Mettre à jour les positions
    for (let i = 0; i < newQuestions.length; i++) {
      await updateCourseQuestion(newQuestions[i].id, { position: i })
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formations</h1>
          <p className="text-gray-500">{courses.length} formation(s)</p>
        </div>
        <button onClick={() => openForm()} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />Nouvelle
        </button>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Rechercher..." className="input pl-10 w-full max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(course => (
          <div key={course.id} className="card hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-gray-900">{course.title}</h3>
              <div className="flex gap-1">
                <button onClick={() => openQuestions(course)} className="p-1.5 hover:bg-gray-100 rounded" title="Questions positionnement">
                  <HelpCircle className="w-4 h-4 text-blue-500" />
                </button>
                <button onClick={() => openForm(course)} className="p-1.5 hover:bg-gray-100 rounded" title="Modifier">
                  <Edit className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={() => handleDelete(course.id)} className="p-1.5 hover:bg-gray-100 rounded" title="Supprimer">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{course.description || 'Aucune description'}</p>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{course.duration || '?'}h</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" />{course.target_audience || 'Tout public'}</span>
              {course.price_ht && <span className="flex items-center gap-1"><Euro className="w-4 h-4" />{course.price_ht}€ HT</span>}
            </div>
            {course.material && (
              <p className="text-xs text-gray-400 mt-2">Matériel : {course.material}</p>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">Aucune formation</p>}
      </div>
      
      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                <h2 className="text-lg font-semibold">{selectedCourse ? 'Modifier' : 'Nouvelle'} formation</h2>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="label">Titre *</label>
                  <input type="text" className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Durée (heures)</label>
                    <input type="number" className="input" value={form.duration} onChange={(e) => setForm({...form, duration: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Prix / jour (€)</label>
                    <input type="number" className="input" value={form.price_per_day} onChange={(e) => setForm({...form, price_per_day: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Prix total HT (€)</label>
                    <input type="number" className="input" value={form.price_ht} onChange={(e) => setForm({...form, price_ht: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="label">Objectifs</label>
                  <textarea className="input" rows={2} value={form.objectives} onChange={(e) => setForm({...form, objectives: e.target.value})} />
                </div>
                <div>
                  <label className="label">Contenu</label>
                  <textarea className="input" rows={3} value={form.content} onChange={(e) => setForm({...form, content: e.target.value})} />
                </div>
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
                <div>
                  <label className="label">Méthodes pédagogiques</label>
                  <textarea className="input" rows={2} value={form.methods} onChange={(e) => setForm({...form, methods: e.target.value})} />
                </div>
                <div>
                  <label className="label">Matériel à prévoir (tenue, équipements...)</label>
                  <input type="text" className="input" placeholder="Ex: Tenue de sport, chaussures de sécurité..." value={form.material} onChange={(e) => setForm({...form, material: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
                <button onClick={() => setShowForm(false)} className="btn btn-secondary">Annuler</button>
                <button onClick={handleSave} className="btn btn-primary"><Save className="w-4 h-4 mr-2" />Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Questions de positionnement */}
      {showQuestions && selectedCourse && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowQuestions(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h2 className="text-lg font-semibold">Questions de positionnement</h2>
                  <p className="text-sm text-gray-500">{selectedCourse.title}</p>
                </div>
                <button onClick={() => setShowQuestions(false)}><X className="w-5 h-5" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Liste des questions */}
                {questions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucune question. Ajoutez-en ci-dessous.</p>
                ) : (
                  <div className="space-y-2">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-start gap-2">
                          <div className="flex flex-col gap-1">
                            <button onClick={() => moveQuestion(idx, -1)} disabled={idx === 0} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30">
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => moveQuestion(idx, 1)} disabled={idx === questions.length - 1} className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30">
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                {q.question_type === 'qcm' ? 'QCM' : 'Question ouverte'}
                              </span>
                              <span className="text-xs text-gray-400">#{idx + 1}</span>
                            </div>
                            <p className="font-medium">{q.question_text}</p>
                            {q.question_type === 'qcm' && (
                              <div className="mt-2 text-sm text-gray-600 space-y-1">
                                {q.option_a && <p>○ {q.option_a}</p>}
                                {q.option_b && <p>○ {q.option_b}</p>}
                                {q.option_c && <p>○ {q.option_c}</p>}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => handleEditQuestion(q)} className="p-1.5 hover:bg-gray-200 rounded">
                              <Edit className="w-4 h-4 text-gray-500" />
                            </button>
                            <button onClick={() => handleDeleteQuestion(q.id)} className="p-1.5 hover:bg-gray-200 rounded">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Formulaire ajout/modification */}
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">{editingQuestion ? 'Modifier la question' : 'Ajouter une question'}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="label">Question *</label>
                      <textarea className="input" rows={2} value={questionForm.question_text} onChange={(e) => setQuestionForm({...questionForm, question_text: e.target.value})} placeholder="Saisissez votre question..." />
                    </div>
                    <div>
                      <label className="label">Type</label>
                      <select className="input" value={questionForm.question_type} onChange={(e) => setQuestionForm({...questionForm, question_type: e.target.value})}>
                        <option value="qcm">QCM (3 réponses)</option>
                        <option value="open">Question ouverte</option>
                      </select>
                    </div>
                    {questionForm.question_type === 'qcm' && (
                      <div className="space-y-2">
                        <div>
                          <label className="label">Réponse A *</label>
                          <input type="text" className="input" value={questionForm.option_a} onChange={(e) => setQuestionForm({...questionForm, option_a: e.target.value})} />
                        </div>
                        <div>
                          <label className="label">Réponse B</label>
                          <input type="text" className="input" value={questionForm.option_b} onChange={(e) => setQuestionForm({...questionForm, option_b: e.target.value})} />
                        </div>
                        <div>
                          <label className="label">Réponse C</label>
                          <input type="text" className="input" value={questionForm.option_c} onChange={(e) => setQuestionForm({...questionForm, option_c: e.target.value})} />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {editingQuestion && (
                        <button onClick={() => { setEditingQuestion(null); setQuestionForm({ question_text: '', question_type: 'qcm', option_a: '', option_b: '', option_c: '' }) }} className="btn btn-secondary">
                          Annuler
                        </button>
                      )}
                      <button onClick={handleSaveQuestion} className="btn btn-primary">
                        <Save className="w-4 h-4 mr-2" />{editingQuestion ? 'Modifier' : 'Ajouter'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
