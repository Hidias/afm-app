import { useEffect, useState } from 'react'
import { useDataStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { 
  AlertTriangle, Plus, Search, X, CheckCircle, Clock, AlertCircle,
  ChevronRight, Edit, Trash2, Save, FileText, Calendar
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

const sourceLabels = {
  evaluation: { label: 'Évaluation stagiaire', icon: FileText },
  audit: { label: 'Audit', icon: Search },
  reclamation: { label: 'Réclamation', icon: AlertCircle },
  interne: { label: 'Constat interne', icon: AlertTriangle },
  autre: { label: 'Autre', icon: FileText },
}

const severityLabels = {
  minor: { label: 'Mineure', class: 'badge-yellow' },
  major: { label: 'Majeure', class: 'badge-orange' },
  critical: { label: 'Critique', class: 'badge-red' },
}

const statusLabels = {
  open: { label: 'Ouverte', class: 'badge-red' },
  in_progress: { label: 'En cours', class: 'badge-yellow' },
  resolved: { label: 'Résolue', class: 'badge-blue' },
  closed: { label: 'Clôturée', class: 'badge-green' },
}

export default function NonConformites() {
  const { sessions, fetchSessions } = useDataStore()
  
  const [nonConformites, setNonConformites] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingNC, setEditingNC] = useState(null)
  const [formData, setFormData] = useState({
    source: 'evaluation',
    session_id: '',
    title: '',
    description: '',
    critere_qualiopi: '',
    severity: 'minor',
    status: 'open',
    cause_analysis: '',
    corrective_action: '',
    action_responsible: '',
    action_deadline: '',
    preventive_action: '',
  })
  
  useEffect(() => {
    fetchSessions()
    loadNonConformites()
  }, [])
  
  const loadNonConformites = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('non_conformites')
      .select('*, sessions(reference, courses(title))')
      .order('created_at', { ascending: false })
    
    if (!error) {
      setNonConformites(data || [])
    }
    setLoading(false)
  }
  
  const filteredNC = nonConformites.filter(nc => {
    const matchSearch = 
      nc.title?.toLowerCase().includes(search.toLowerCase()) ||
      nc.description?.toLowerCase().includes(search.toLowerCase()) ||
      nc.critere_qualiopi?.toLowerCase().includes(search.toLowerCase())
    
    const matchStatus = !statusFilter || nc.status === statusFilter
    
    return matchSearch && matchStatus
  })
  
  const resetForm = () => {
    setFormData({
      source: 'evaluation',
      session_id: '',
      title: '',
      description: '',
      critere_qualiopi: '',
      severity: 'minor',
      status: 'open',
      cause_analysis: '',
      corrective_action: '',
      action_responsible: '',
      action_deadline: '',
      preventive_action: '',
    })
    setEditingNC(null)
    setShowForm(false)
  }
  
  const handleEdit = (nc) => {
    setFormData({
      source: nc.source || 'evaluation',
      session_id: nc.session_id || '',
      title: nc.title || '',
      description: nc.description || '',
      critere_qualiopi: nc.critere_qualiopi || '',
      severity: nc.severity || 'minor',
      status: nc.status || 'open',
      cause_analysis: nc.cause_analysis || '',
      corrective_action: nc.corrective_action || '',
      action_responsible: nc.action_responsible || '',
      action_deadline: nc.action_deadline || '',
      preventive_action: nc.preventive_action || '',
    })
    setEditingNC(nc)
    setShowForm(true)
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title || !formData.description) {
      toast.error('Titre et description obligatoires')
      return
    }
    
    const dataToSave = {
      ...formData,
      session_id: formData.session_id || null,
      action_deadline: formData.action_deadline || null,
    }
    
    if (editingNC) {
      // Mise à jour
      const { error } = await supabase
        .from('non_conformites')
        .update(dataToSave)
        .eq('id', editingNC.id)
      
      if (error) {
        toast.error('Erreur lors de la mise à jour')
        console.error(error)
      } else {
        toast.success('Non-conformité mise à jour')
        resetForm()
        loadNonConformites()
      }
    } else {
      // Création
      const { error } = await supabase
        .from('non_conformites')
        .insert([dataToSave])
      
      if (error) {
        toast.error('Erreur lors de la création')
        console.error(error)
      } else {
        toast.success('Non-conformité créée')
        resetForm()
        loadNonConformites()
      }
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette non-conformité ?')) return
    
    const { error } = await supabase
      .from('non_conformites')
      .delete()
      .eq('id', id)
    
    if (error) {
      toast.error('Erreur lors de la suppression')
    } else {
      toast.success('Non-conformité supprimée')
      loadNonConformites()
    }
  }
  
  const handleStatusChange = async (id, newStatus) => {
    const updates = { status: newStatus }
    if (newStatus === 'closed') {
      updates.closed_at = new Date().toISOString()
    }
    if (newStatus === 'resolved') {
      updates.action_completed_at = new Date().toISOString()
    }
    
    const { error } = await supabase
      .from('non_conformites')
      .update(updates)
      .eq('id', id)
    
    if (!error) {
      toast.success('Statut mis à jour')
      loadNonConformites()
    }
  }
  
  // Stats
  const stats = {
    open: nonConformites.filter(nc => nc.status === 'open').length,
    in_progress: nonConformites.filter(nc => nc.status === 'in_progress').length,
    resolved: nonConformites.filter(nc => nc.status === 'resolved').length,
    closed: nonConformites.filter(nc => nc.status === 'closed').length,
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Non-conformités & Actions correctives</h1>
          <p className="text-gray-500 mt-1">Gestion Qualiopi - Amélioration continue</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle NC
        </button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{stats.open}</p>
              <p className="text-sm text-red-600">Ouvertes</p>
            </div>
          </div>
        </div>
        
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-700">{stats.in_progress}</p>
              <p className="text-sm text-yellow-600">En cours</p>
            </div>
          </div>
        </div>
        
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{stats.resolved}</p>
              <p className="text-sm text-blue-600">Résolues</p>
            </div>
          </div>
        </div>
        
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{stats.closed}</p>
              <p className="text-sm text-green-600">Clôturées</p>
            </div>
          </div>
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-full sm:w-48"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(statusLabels).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      
      {/* Liste */}
      <div className="space-y-4">
        {loading ? (
          <div className="card p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : filteredNC.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            {search || statusFilter ? 'Aucun résultat' : 'Aucune non-conformité enregistrée'}
          </div>
        ) : (
          filteredNC.map((nc) => (
            <div key={nc.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`badge ${severityLabels[nc.severity]?.class || 'badge-gray'}`}>
                      {severityLabels[nc.severity]?.label || nc.severity}
                    </span>
                    <span className={`badge ${statusLabels[nc.status]?.class || 'badge-gray'}`}>
                      {statusLabels[nc.status]?.label || nc.status}
                    </span>
                    {nc.critere_qualiopi && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {nc.critere_qualiopi}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-gray-900">{nc.title}</h3>
                  <p className="text-gray-600 text-sm mt-1 line-clamp-2">{nc.description}</p>
                  
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      {sourceLabels[nc.source]?.label || nc.source}
                    </span>
                    {nc.sessions?.reference && (
                      <span>Session : {nc.sessions.reference}</span>
                    )}
                    {nc.action_deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Échéance : {format(new Date(nc.action_deadline), 'dd/MM/yyyy')}
                      </span>
                    )}
                    <span>
                      Créée le {format(new Date(nc.created_at), 'd MMM yyyy', { locale: fr })}
                    </span>
                  </div>
                  
                  {nc.corrective_action && (
                    <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                      <span className="font-medium text-blue-700">Action corrective :</span>
                      <span className="text-blue-600 ml-2">{nc.corrective_action}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleEdit(nc)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    title="Modifier"
                  >
                    <Edit className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(nc.id)}
                    className="p-2 hover:bg-red-50 rounded-lg"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
              
              {/* Actions rapides de changement de statut */}
              {nc.status !== 'closed' && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                  {nc.status === 'open' && (
                    <button
                      onClick={() => handleStatusChange(nc.id, 'in_progress')}
                      className="btn btn-sm btn-secondary"
                    >
                      Prendre en charge
                    </button>
                  )}
                  {nc.status === 'in_progress' && (
                    <button
                      onClick={() => handleStatusChange(nc.id, 'resolved')}
                      className="btn btn-sm btn-secondary"
                    >
                      Marquer résolue
                    </button>
                  )}
                  {nc.status === 'resolved' && (
                    <button
                      onClick={() => handleStatusChange(nc.id, 'closed')}
                      className="btn btn-sm btn-primary"
                    >
                      Clôturer (efficacité vérifiée)
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
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
                  {editingNC ? 'Modifier la non-conformité' : 'Nouvelle non-conformité'}
                </h2>
                <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Source *</label>
                    <select
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      className="input"
                    >
                      {Object.entries(sourceLabels).map(([value, { label }]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="label">Session liée</label>
                    <select
                      value={formData.session_id}
                      onChange={(e) => setFormData({ ...formData, session_id: e.target.value })}
                      className="input"
                    >
                      <option value="">Aucune</option>
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.reference} - {s.courses?.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="label">Titre *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input"
                    placeholder="Ex: Support de formation incomplet"
                    required
                  />
                </div>
                
                <div>
                  <label className="label">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows={3}
                    placeholder="Décrivez la non-conformité constatée..."
                    required
                  />
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Critère Qualiopi</label>
                    <input
                      type="text"
                      value={formData.critere_qualiopi}
                      onChange={(e) => setFormData({ ...formData, critere_qualiopi: e.target.value })}
                      className="input"
                      placeholder="Ex: Indicateur 19"
                    />
                  </div>
                  
                  <div>
                    <label className="label">Gravité</label>
                    <select
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                      className="input"
                    >
                      {Object.entries(severityLabels).map(([value, { label }]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="label">Statut</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="input"
                    >
                      {Object.entries(statusLabels).map(([value, { label }]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="label">Analyse des causes</label>
                  <textarea
                    value={formData.cause_analysis}
                    onChange={(e) => setFormData({ ...formData, cause_analysis: e.target.value })}
                    className="input"
                    rows={2}
                    placeholder="Pourquoi cette NC s'est-elle produite ?"
                  />
                </div>
                
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-medium text-gray-900 mb-3">Action corrective</h3>
                  
                  <div>
                    <label className="label">Description de l'action</label>
                    <textarea
                      value={formData.corrective_action}
                      onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
                      className="input"
                      rows={2}
                      placeholder="Quelle action mettre en place pour corriger ?"
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="label">Responsable</label>
                      <input
                        type="text"
                        value={formData.action_responsible}
                        onChange={(e) => setFormData({ ...formData, action_responsible: e.target.value })}
                        className="input"
                        placeholder="Qui est responsable ?"
                      />
                    </div>
                    
                    <div>
                      <label className="label">Échéance</label>
                      <input
                        type="date"
                        value={formData.action_deadline}
                        onChange={(e) => setFormData({ ...formData, action_deadline: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="label">Action préventive</label>
                  <textarea
                    value={formData.preventive_action}
                    onChange={(e) => setFormData({ ...formData, preventive_action: e.target.value })}
                    className="input"
                    rows={2}
                    placeholder="Que faire pour éviter que ça se reproduise ?"
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={resetForm} className="btn btn-secondary">
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {editingNC ? 'Mettre à jour' : 'Créer'}
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
