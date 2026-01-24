import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Save, Trash2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const statusOptions = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'planned', label: 'Planifiée' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminée' },
  { value: 'cancelled', label: 'Annulée' },
]

export default function SessionInterEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [courses, setCourses] = useState([])
  const [trainers, setTrainers] = useState([])
  const [formData, setFormData] = useState({
    course_id: '',
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '17:00',
    day_type: 'full',
    location_city: '',
    location_address: '',
    room: '',
    min_participants: 4,
    max_participants: 12,
    public_price_per_person: 0,
    trainer_id: '',
    status: 'planned',
    is_public: false,
  })

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      // Charger la session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single()

      if (sessionError) throw sessionError

      setFormData({
        course_id: sessionData.course_id || '',
        start_date: sessionData.start_date || '',
        end_date: sessionData.end_date || '',
        start_time: sessionData.start_time || '09:00',
        end_time: sessionData.end_time || '17:00',
        day_type: sessionData.day_type || 'full',
        location_city: sessionData.location_city || '',
        location_address: sessionData.location_address || '',
        room: sessionData.room || '',
        min_participants: sessionData.min_participants || 4,
        max_participants: sessionData.max_participants || 12,
        public_price_per_person: sessionData.public_price_per_person || 0,
        trainer_id: sessionData.trainer_id || '',
        status: sessionData.status || 'planned',
        is_public: sessionData.is_public || false,
      })

      // Charger les formations
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .order('title')

      setCourses(coursesData || [])

      // Charger les formateurs
      const { data: trainersData } = await supabase
        .from('trainers')
        .select('*')
        .order('last_name')

      setTrainers(trainersData || [])

    } catch (error) {
      console.error('Erreur chargement:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const { error } = await supabase
        .from('sessions')
        .update(formData)
        .eq('id', id)

      if (error) throw error

      toast.success('Session mise à jour !')
      navigate(`/sessions-inter/${id}`)

    } catch (error) {
      console.error('Erreur mise à jour:', error)
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    console.log('🗑️ handleDelete appelé')
    
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette session INTER ? Cette action est irréversible.')) {
      console.log('❌ Suppression annulée par l\'utilisateur')
      return
    }

    try {
      console.log('🔍 Vérification des groupes inscrits...')
      
      // Vérifier s'il y a des groupes inscrits
      const { count, error: countError } = await supabase
        .from('session_groups')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', id)

      console.log('📊 Nombre de groupes:', count)
      if (countError) console.error('❌ Erreur count:', countError)

      if (count > 0) {
        console.log('⚠️ Suppression bloquée : groupes présents')
        toast.error('Impossible de supprimer : des groupes sont inscrits à cette session')
        return
      }

      console.log('🗑️ Suppression de la session...')
      
      // Supprimer la session
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('❌ Erreur DELETE:', error)
        throw error
      }

      console.log('✅ Session supprimée avec succès')
      toast.success('Session supprimée')
      
      console.log('🔀 Redirection vers /sessions-inter')
      navigate('/sessions-inter')

    } catch (error) {
      console.error('💥 Erreur dans handleDelete:', error)
      toast.error('Erreur lors de la suppression: ' + error.message)
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/sessions-inter/${id}`)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Modifier la session INTER
          </h1>
          <p className="text-gray-500 mt-1">
            Modifiez les informations de la session
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Formation */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Formation</h2>
          <div>
            <label className="label">Formation *</label>
            <select
              value={formData.course_id}
              onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
              className="input"
              required
            >
              <option value="">Sélectionner...</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title} ({course.duration_hours || '?'}h)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates et horaires */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dates et horaires</h2>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Date de début *</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Date de fin *</label>
                <input
                  type="date"
                  value={formData.end_date}
                  min={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="label">Heure de début</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Heure de fin</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Type de journée</label>
                <select
                  value={formData.day_type}
                  onChange={(e) => setFormData({ ...formData, day_type: e.target.value })}
                  className="input"
                >
                  <option value="full">Journée complète</option>
                  <option value="half">Demi-journée</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Lieu */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Lieu</h2>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Ville</label>
                <input
                  type="text"
                  value={formData.location_city}
                  onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
                  className="input"
                  placeholder="Ex: Concarneau"
                />
              </div>
              <div>
                <label className="label">Salle</label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className="input"
                  placeholder="Ex: Salle A"
                />
              </div>
            </div>
            <div>
              <label className="label">Adresse complète</label>
              <input
                type="text"
                value={formData.location_address}
                onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                className="input"
                placeholder="Ex: 1 rue de la formation, 29900 Concarneau"
              />
            </div>
          </div>
        </div>

        {/* Participants et tarif */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Participants et tarif</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="label">Minimum participants</label>
              <input
                type="number"
                value={formData.min_participants}
                onChange={(e) => setFormData({ ...formData, min_participants: parseInt(e.target.value) || 0 })}
                className="input"
                min="1"
              />
            </div>
            <div>
              <label className="label">Maximum participants</label>
              <input
                type="number"
                value={formData.max_participants}
                onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 0 })}
                className="input"
                min="1"
              />
            </div>
            <div>
              <label className="label">Prix par personne (€)</label>
              <input
                type="number"
                value={formData.public_price_per_person}
                onChange={(e) => setFormData({ ...formData, public_price_per_person: parseFloat(e.target.value) || 0 })}
                className="input"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Formateur et statut */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Formateur et statut</h2>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Formateur</label>
                <select
                  value={formData.trainer_id}
                  onChange={(e) => setFormData({ ...formData, trainer_id: e.target.value })}
                  className="input"
                >
                  <option value="">Non assigné</option>
                  {trainers.map(trainer => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.first_name} {trainer.last_name}
                    </option>
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
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_public"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="is_public" className="text-sm text-gray-700">
                Session publique (visible pour inscription en ligne)
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="card">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="btn btn-danger flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer la session
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(`/sessions-inter/${id}`)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>

        {/* Avertissement suppression */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <div className="text-sm text-orange-800">
              <p className="font-medium mb-1">Suppression de session</p>
              <p>
                La suppression n'est possible que si aucun groupe n'est inscrit.
                Si des groupes sont inscrits, vous devez d'abord les retirer ou annuler la session.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
