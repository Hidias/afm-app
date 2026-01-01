import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, BookOpen, Plus, Trash2, GripVertical } from 'lucide-react'

export default function CourseForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { courses, trainers, loadCourses } = useStore()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    title: '',
    code: '',
    objectives: [],
    duration_days: 1,
    duration_hours: 7,
    price_ht: '',
    prerequisites: '',
    target_audience: '',
    pedagogical_methods: '',
    materials: '',
    default_trainer_id: '',
    positioning_questions: []
  })
  const [newObjective, setNewObjective] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit) {
      const course = courses.find(c => c.id === id)
      if (course) {
        setForm({
          title: course.title || '',
          code: course.code || '',
          objectives: course.objectives || [],
          duration_days: course.duration_days || 1,
          duration_hours: course.duration_hours || 7,
          price_ht: course.price_ht || '',
          prerequisites: course.prerequisites || '',
          target_audience: course.target_audience || '',
          pedagogical_methods: course.pedagogical_methods || '',
          materials: course.materials || '',
          default_trainer_id: course.default_trainer_id || '',
          positioning_questions: course.positioning_questions || []
        })
      }
    }
  }, [id, courses, isEdit])

  const handleChange = (e) => {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
    }))
  }

  const addObjective = () => {
    if (newObjective.trim()) {
      setForm(prev => ({
        ...prev,
        objectives: [...prev.objectives, newObjective.trim()]
      }))
      setNewObjective('')
    }
  }

  const removeObjective = (index) => {
    setForm(prev => ({
      ...prev,
      objectives: prev.objectives.filter((_, i) => i !== index)
    }))
  }

  const addQuestion = () => {
    if (newQuestion.trim()) {
      setForm(prev => ({
        ...prev,
        positioning_questions: [...prev.positioning_questions, { text: newQuestion.trim(), type: 'scale' }]
      }))
      setNewQuestion('')
    }
  }

  const removeQuestion = (index) => {
    setForm(prev => ({
      ...prev,
      positioning_questions: prev.positioning_questions.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Le titre de la formation est requis')
      return
    }

    setSaving(true)
    try {
      const data = {
        ...form,
        price_ht: form.price_ht === '' ? null : Number(form.price_ht),
        default_trainer_id: form.default_trainer_id || null
      }

      if (isEdit) {
        const { error } = await supabase
          .from('courses')
          .update(data)
          .eq('id', id)
        if (error) throw error
        toast.success('Formation mise à jour')
      } else {
        const { error } = await supabase
          .from('courses')
          .insert([data])
        if (error) throw error
        toast.success('Formation créée')
      }
      await loadCourses()
      navigate('/formations')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/formations')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Retour aux formations
      </button>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Modifier la formation' : 'Nouvelle formation'}
            </h1>
            <p className="text-sm text-gray-500">Définissez le contenu et les paramètres</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations générales */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Informations générales</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre de la formation *
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  placeholder="SST-01"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durée (jours)
                </label>
                <input
                  type="number"
                  name="duration_days"
                  value={form.duration_days}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durée (heures)
                </label>
                <input
                  type="number"
                  name="duration_hours"
                  value={form.duration_hours}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix HT (€)
                </label>
                <input
                  type="number"
                  name="price_ht"
                  value={form.price_ht}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Formateur par défaut
              </label>
              <select
                name="default_trainer_id"
                value={form.default_trainer_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Aucun</option>
                {trainers.map(t => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Objectifs */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Objectifs pédagogiques</h3>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                placeholder="Ajouter un objectif..."
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
              />
              <button type="button" onClick={addObjective} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {form.objectives.length > 0 && (
              <ul className="space-y-2">
                {form.objectives.map((obj, index) => (
                  <li key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <span className="flex-1">{obj}</span>
                    <button type="button" onClick={() => removeObjective(index)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Contenu pédagogique */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Contenu pédagogique</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prérequis
              </label>
              <textarea
                name="prerequisites"
                value={form.prerequisites}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Public cible
              </label>
              <textarea
                name="target_audience"
                value={form.target_audience}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Méthodes pédagogiques
              </label>
              <textarea
                name="pedagogical_methods"
                value={form.pedagogical_methods}
                onChange={handleChange}
                rows={2}
                placeholder="Apports théoriques, exercices pratiques, mises en situation..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Matériel à apporter
              </label>
              <textarea
                name="materials"
                value={form.materials}
                onChange={handleChange}
                rows={2}
                placeholder="Tenue de travail, chaussures de sécurité..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Test de positionnement */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Test de positionnement (Qualiopi)</h3>
            <p className="text-sm text-gray-500">Questions posées aux stagiaires avant la formation</p>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Ajouter une question..."
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addQuestion())}
              />
              <button type="button" onClick={addQuestion} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {form.positioning_questions.length > 0 && (
              <ul className="space-y-2">
                {form.positioning_questions.map((q, index) => (
                  <li key={index} className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
                    <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                      {index + 1}
                    </span>
                    <span className="flex-1">{q.text}</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Échelle 1-5</span>
                    <button type="button" onClick={() => removeQuestion(index)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate('/formations')}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Créer la formation')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
