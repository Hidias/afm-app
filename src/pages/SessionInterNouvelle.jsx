import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Save, Calendar, MapPin, Users, Euro, Info, GraduationCap, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SessionInterNouvelle() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState([])
  const [trainers, setTrainers] = useState([])
  
  // Form data
  const [formData, setFormData] = useState({
    course_id: '',
    start_date: '',
    end_date: '',
    location_address: '',
    location_city: 'Concarneau',
    location_postal_code: '29900',
    location_type: 'external',
    trainer_id: '',
    min_participants: 4,
    max_participants: 10,
    public_price_per_person: 350,
    is_public: true,
    session_type: 'inter'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    // Charger les formations
    const { data: coursesData } = await supabase
      .from('courses')
      .select('id, title, code')
      .order('title')
    setCourses(coursesData || [])

    // Charger les formateurs
    const { data: trainersData } = await supabase
      .from('trainers')
      .select('id, first_name, last_name')
      .order('first_name')
    setTrainers(trainersData || [])
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.course_id) {
      toast.error('Veuillez sélectionner une formation')
      return
    }
    if (!formData.start_date || !formData.end_date) {
      toast.error('Veuillez renseigner les dates')
      return
    }
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      toast.error('La date de fin doit être après la date de début')
      return
    }
    if (!formData.location_city) {
      toast.error('Veuillez renseigner la ville')
      return
    }
    if (formData.min_participants < 1) {
      toast.error('Le minimum de participants doit être au moins 1')
      return
    }
    if (formData.max_participants < formData.min_participants) {
      toast.error('Le maximum doit être supérieur ou égal au minimum')
      return
    }
    if (formData.public_price_per_person <= 0) {
      toast.error('Le prix par personne doit être supérieur à 0')
      return
    }

    setLoading(true)
    try {
      // Générer une référence unique
      const courseCode = courses.find(c => c.id === formData.course_id)?.code || 'FORM'
      const dateStr = new Date(formData.start_date).toISOString().split('T')[0]
      const reference = `${courseCode}-INTER-${dateStr}`

      // Créer la session
      const { data: session, error } = await supabase
        .from('sessions')
        .insert({
          ...formData,
          reference,
          status: 'planned'
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Session inter-entreprise créée avec succès !')
      navigate(`/sessions-inter/${session.id}`)
    } catch (error) {
      console.error('Erreur création session:', error)
      toast.error('Erreur lors de la création de la session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/sessions-inter')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle Session Inter-Entreprise</h1>
          <p className="text-gray-500 mt-1">
            Créez une session ouverte à plusieurs entreprises
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="max-w-3xl">
        <div className="card space-y-6">
          {/* Formation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <GraduationCap className="w-4 h-4 inline mr-2" />
              Formation *
            </label>
            <select
              name="course_id"
              value={formData.course_id}
              onChange={handleChange}
              required
              className="input"
            >
              <option value="">Sélectionner une formation</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title} ({course.code})
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Date de début *
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                required
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Date de fin *
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                required
                className="input"
              />
            </div>
          </div>

          {/* Lieu */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Lieu de la formation
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse
              </label>
              <input
                type="text"
                name="location_address"
                value={formData.location_address}
                onChange={handleChange}
                placeholder="10 Rue de la Formation"
                className="input"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ville *
                </label>
                <input
                  type="text"
                  name="location_city"
                  value={formData.location_city}
                  onChange={handleChange}
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code postal
                </label>
                <input
                  type="text"
                  name="location_postal_code"
                  value={formData.location_postal_code}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Nombre de participants
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum *
                </label>
                <input
                  type="number"
                  name="min_participants"
                  value={formData.min_participants}
                  onChange={handleChange}
                  min="1"
                  required
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nombre minimum pour maintenir la session
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum *
                </label>
                <input
                  type="number"
                  name="max_participants"
                  value={formData.max_participants}
                  onChange={handleChange}
                  min="1"
                  required
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nombre maximum de places disponibles
                </p>
              </div>
            </div>
          </div>

          {/* Prix */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Euro className="w-4 h-4 inline mr-2" />
              Prix public par personne *
            </label>
            <div className="relative">
              <input
                type="number"
                name="public_price_per_person"
                value={formData.public_price_per_person}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
                className="input pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                €
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Prix affiché sur le catalogue public (si applicable)
            </p>
          </div>

          {/* Formateur (optionnel) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <UserCheck className="w-4 h-4 inline mr-2" />
              Formateur (optionnel)
            </label>
            <select
              name="trainer_id"
              value={formData.trainer_id}
              onChange={handleChange}
              className="input"
            >
              <option value="">À définir plus tard</option>
              {trainers.map(trainer => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.first_name} {trainer.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Visibilité */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_public"
                checked={formData.is_public}
                onChange={handleChange}
                className="mt-1"
              />
              <div>
                <p className="font-medium text-gray-900">
                  Session publique (catalogue)
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  La session sera visible dans votre catalogue public et pourra être réservée
                  directement par les entreprises
                </p>
              </div>
            </label>
          </div>

          {/* Info box */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>Session inter-entreprise :</strong> Plusieurs entreprises peuvent
                  s'inscrire à la même session.
                </p>
                <p>
                  Après création, vous pourrez ajouter des groupes d'entreprises et leurs
                  stagiaires depuis la page de détails.
                </p>
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate('/sessions-inter')}
              className="btn btn-secondary"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Création...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Créer la session
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
