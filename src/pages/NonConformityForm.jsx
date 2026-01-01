import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react'

export default function NonConformityForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    title: '',
    description: '',
    source: 'internal',
    severity: 'minor',
    status: 'open',
    root_cause: '',
    corrective_actions: '',
    preventive_actions: '',
    responsible: '',
    due_date: ''
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (isEdit) {
      loadNC()
    }
  }, [id, isEdit])

  const loadNC = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('non_conformities')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      toast.error('Non-conformité introuvable')
      navigate('/non-conformites')
      return
    }

    setForm({
      title: data.title || '',
      description: data.description || '',
      source: data.source || 'internal',
      severity: data.severity || 'minor',
      status: data.status || 'open',
      root_cause: data.root_cause || '',
      corrective_actions: data.corrective_actions || '',
      preventive_actions: data.preventive_actions || '',
      responsible: data.responsible || '',
      due_date: data.due_date || ''
    })
    setLoading(false)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.title.trim()) {
      toast.error('Le titre est requis')
      return
    }

    setSaving(true)
    try {
      const data = {
        ...form,
        due_date: form.due_date || null
      }

      if (isEdit) {
        const { error } = await supabase
          .from('non_conformities')
          .update(data)
          .eq('id', id)
        if (error) throw error
        toast.success('Non-conformité mise à jour')
      } else {
        const { error } = await supabase
          .from('non_conformities')
          .insert([data])
        if (error) throw error
        toast.success('Non-conformité créée')
      }
      
      navigate('/non-conformites')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'major': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/non-conformites')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Retour aux non-conformités
      </button>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Modifier la non-conformité' : 'Nouvelle non-conformité'}
            </h1>
            <p className="text-sm text-gray-500">Qualiopi - Indicateurs 31 & 32</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identification */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Identification</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Description courte du problème"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description détaillée</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="Décrivez le problème en détail..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select
                  name="source"
                  value={form.source}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="internal">Interne</option>
                  <option value="claim">Réclamation</option>
                  <option value="audit">Audit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sévérité</label>
                <select
                  name="severity"
                  value={form.severity}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${getSeverityColor(form.severity)}`}
                >
                  <option value="minor">Mineure</option>
                  <option value="major">Majeure</option>
                  <option value="critical">Critique</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="open">Ouverte</option>
                  <option value="in_progress">En cours</option>
                  <option value="closed">Clôturée</option>
                </select>
              </div>
            </div>
          </div>

          {/* Analyse */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Analyse</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cause racine</label>
              <textarea
                name="root_cause"
                value={form.root_cause}
                onChange={handleChange}
                rows={2}
                placeholder="Quelle est la cause fondamentale du problème ?"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Actions</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actions correctives</label>
              <textarea
                name="corrective_actions"
                value={form.corrective_actions}
                onChange={handleChange}
                rows={2}
                placeholder="Que faites-vous pour résoudre ce problème immédiat ?"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actions préventives</label>
              <textarea
                name="preventive_actions"
                value={form.preventive_actions}
                onChange={handleChange}
                rows={2}
                placeholder="Que faites-vous pour éviter que cela ne se reproduise ?"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Suivi */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Suivi</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                <input
                  type="text"
                  name="responsible"
                  value={form.responsible}
                  onChange={handleChange}
                  placeholder="Nom du responsable"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Échéance</label>
                <input
                  type="date"
                  name="due_date"
                  value={form.due_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate('/non-conformites')}
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
              {saving ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Créer la non-conformité')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
