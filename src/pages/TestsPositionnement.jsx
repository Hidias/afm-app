import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { Plus, Save, Edit, Trash2, X, ChevronDown, ChevronUp, GripVertical, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TestsPositionnement() {
  const { 
    themes, fetchThemes,
    themeQuestions, fetchThemeQuestions, 
    createThemeQuestion, updateThemeQuestion, deleteThemeQuestion 
  } = useDataStore()
  
  const [selectedTheme, setSelectedTheme] = useState(null)
  const [questions, setQuestions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [form, setForm] = useState({
    question_text: '',
    question_type: 'qcm',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: ''
  })

  useEffect(() => {
    fetchThemes()
  }, [])

  useEffect(() => {
    if (selectedTheme) {
      loadQuestions(selectedTheme.id)
    }
  }, [selectedTheme])

  const loadQuestions = async (themeId) => {
    const { data } = await fetchThemeQuestions(themeId)
    setQuestions(data || [])
  }

  const resetForm = () => {
    setForm({
      question_text: '',
      question_type: 'qcm',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: ''
    })
    setEditingQuestion(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!form.question_text) return toast.error('Question requise')
    if (form.question_type === 'qcm' && !form.option_a) return toast.error('Au moins une réponse requise')

    const questionData = {
      question_text: form.question_text,
      question_type: form.question_type,
      option_a: form.option_a || null,
      option_b: form.option_b || null,
      option_c: form.option_c || null,
      option_d: form.option_d || null,
      correct_answer: form.correct_answer || null,
      position: editingQuestion ? editingQuestion.position : questions.length
    }

    if (editingQuestion) {
      const { error } = await updateThemeQuestion(editingQuestion.id, questionData)
      if (error) return toast.error('Erreur lors de la modification')
      setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? { ...q, ...questionData } : q))
      toast.success('Question modifiée')
    } else {
      const { data, error } = await createThemeQuestion(selectedTheme.id, questionData)
      if (error) return toast.error('Erreur lors de la création')
      if (data) setQuestions(prev => [...prev, data])
      toast.success('Question ajoutée')
    }
    resetForm()
  }

  const handleEdit = (q) => {
    setEditingQuestion(q)
    setForm({
      question_text: q.question_text,
      question_type: q.question_type || 'qcm',
      option_a: q.option_a || '',
      option_b: q.option_b || '',
      option_c: q.option_c || '',
      option_d: q.option_d || '',
      correct_answer: q.correct_answer || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette question ?')) return
    const { error } = await deleteThemeQuestion(id)
    if (error) return toast.error('Erreur lors de la suppression')
    setQuestions(prev => prev.filter(q => q.id !== id))
    toast.success('Question supprimée')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tests de positionnement</h1>
        <p className="text-gray-500">Gérez les questions par thème de formation</p>
      </div>

      {/* Sélection du thème */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setSelectedTheme(theme)}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedTheme?.id === theme.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div 
              className="w-10 h-10 rounded-lg mb-2 mx-auto"
              style={{ backgroundColor: theme.color }}
            />
            <p className="font-medium text-sm text-center">{theme.name}</p>
            <p className="text-xs text-gray-500 text-center">{theme.code}</p>
          </button>
        ))}
      </div>

      {/* Questions du thème sélectionné */}
      {selectedTheme && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">
                Questions - {selectedTheme.name}
              </h2>
              <p className="text-sm text-gray-500">{questions.length} question(s)</p>
            </div>
            <button
              onClick={() => { resetForm(); setShowForm(true) }}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une question
            </button>
          </div>

          {/* Liste des questions */}
          {questions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune question pour ce thème</p>
              <p className="text-sm">Cliquez sur "Ajouter une question" pour commencer</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, index) => (
                <div key={q.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-2 text-gray-400">
                      <GripVertical className="w-4 h-4" />
                      <span className="text-sm font-medium">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{q.question_text}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          q.question_type === 'qcm' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {q.question_type === 'qcm' ? 'QCM' : 'Question ouverte'}
                        </span>
                        {q.question_type === 'qcm' && (
                          <>
                            {q.option_a && <span className="text-xs bg-gray-100 px-2 py-1 rounded">A: {q.option_a}</span>}
                            {q.option_b && <span className="text-xs bg-gray-100 px-2 py-1 rounded">B: {q.option_b}</span>}
                            {q.option_c && <span className="text-xs bg-gray-100 px-2 py-1 rounded">C: {q.option_c}</span>}
                            {q.option_d && <span className="text-xs bg-gray-100 px-2 py-1 rounded">D: {q.option_d}</span>}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(q)} className="p-2 hover:bg-gray-200 rounded">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button onClick={() => handleDelete(q.id)} className="p-2 hover:bg-red-100 rounded">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingQuestion ? 'Modifier la question' : 'Nouvelle question'}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Type de question</label>
                <select
                  className="input"
                  value={form.question_type}
                  onChange={(e) => setForm({ ...form, question_type: e.target.value })}
                >
                  <option value="qcm">QCM (choix multiples)</option>
                  <option value="open">Question ouverte</option>
                </select>
              </div>

              <div>
                <label className="label">Question *</label>
                <textarea
                  className="input"
                  rows={3}
                  value={form.question_text}
                  onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                  placeholder="Saisissez votre question..."
                />
              </div>

              {form.question_type === 'qcm' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Réponse A *</label>
                      <input
                        type="text"
                        className="input"
                        value={form.option_a}
                        onChange={(e) => setForm({ ...form, option_a: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Réponse B</label>
                      <input
                        type="text"
                        className="input"
                        value={form.option_b}
                        onChange={(e) => setForm({ ...form, option_b: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Réponse C</label>
                      <input
                        type="text"
                        className="input"
                        value={form.option_c}
                        onChange={(e) => setForm({ ...form, option_c: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Réponse D</label>
                      <input
                        type="text"
                        className="input"
                        value={form.option_d}
                        onChange={(e) => setForm({ ...form, option_d: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Bonne réponse</label>
                    <select
                      className="input"
                      value={form.correct_answer}
                      onChange={(e) => setForm({ ...form, correct_answer: e.target.value })}
                    >
                      <option value="">Non définie</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button onClick={resetForm} className="btn btn-secondary">
                Annuler
              </button>
              <button onClick={handleSave} className="btn btn-primary">
                <Save className="w-4 h-4 mr-2" />
                {editingQuestion ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
