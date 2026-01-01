import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Calendar, Plus, X } from 'lucide-react'

export default function SessionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sessions, courses, clients, trainers, trainees, loadSessions } = useStore()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    course_id: '',
    client_id: '',
    trainer_id: '',
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '17:00',
    location: '',
    is_intra: false,
    use_custom_price: false,
    custom_price_ht: '',
    status: 'planned',
    notes: ''
  })
  const [selectedTrainees, setSelectedTrainees] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit) {
      loadSessionData()
    }
  }, [id, isEdit])

  const loadSessionData = async () => {
    const session = sessions.find(s => s.id === id)
    if (session) {
      setForm({
        course_id: session.course_id || '',
        client_id: session.client_id || '',
        trainer_id: session.trainer_id || '',
        start_date: session.start_date || '',
        end_date: session.end_date || '',
        start_time: session.start_time || '09:00',
        end_time: session.end_time || '17:00',
        location: session.location || '',
        is_intra: session.is_intra || false,
        use_custom_price: session.use_custom_price || false,
        custom_price_ht: session.custom_price_ht || '',
        status: session.status || 'planned',
        notes: session.notes || ''
      })
    }
    
    // Charger les stagiaires inscrits
    const { data } = await supabase
      .from('session_trainees')
      .select('trainee_id')
      .eq('session_id', id)
    
    if (data) {
      setSelectedTrainees(data.map(st => st.trainee_id))
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  // Quand on sélectionne une formation, préremplir le formateur par défaut
  useEffect(() => {
    if (form.course_id && !isEdit) {
      const course = courses.find(c => c.id === form.course_id)
      if (course?.default_trainer_id) {
        setForm(prev => ({ ...prev, trainer_id: course.default_trainer_id }))
      }
    }
  }, [form.course_id, courses, isEdit])

  const toggleTrainee = (traineeId) => {
    setSelectedTrainees(prev => 
      prev.includes(traineeId) 
        ? prev.filter(id => id !== traineeId)
        : [...prev, traineeId]
    )
  }

  const selectedCourse = courses.find(c => c.id === form.course_id)
  const selectedClient = clients.find(c => c.id === form.client_id)
  
  // Filtrer les stagiaires par client si sélectionné
  const availableTrainees = form.client_id 
    ? trainees.filter(t => t.client_id === form.client_id)
    : trainees

  const getDisplayPrice = () => {
    if (form.use_custom_price && form.custom_price_ht) {
      return `${form.custom_price_ht}€ HT (personnalisé)`
    }
    if (selectedCourse?.price_ht) {
      return `${selectedCourse.price_ht}€ HT (formation)`
    }
    return 'Non défini'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.course_id || !form.client_id || !form.start_date) {
      toast.error('Veuillez remplir les champs obligatoires')
      return
    }

    setSaving(true)
    try {
      const sessionData = {
        course_id: form.course_id,
        client_id: form.client_id,
        trainer_id: form.trainer_id || null,
        start_date: form.start_date,
        end_date: form.end_date || form.start_date,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.is_intra ? null : form.location,
        is_intra: form.is_intra,
        use_custom_price: form.use_custom_price,
        custom_price_ht: form.use_custom_price && form.custom_price_ht ? Number(form.custom_price_ht) : null,
        status: form.status,
        notes: form.notes
      }

      let sessionId = id

      if (isEdit) {
        const { error } = await supabase
          .from('sessions')
          .update(sessionData)
          .eq('id', id)
        if (error) throw error

        // Mettre à jour les stagiaires
        await supabase.from('session_trainees').delete().eq('session_id', id)
        if (selectedTrainees.length > 0) {
          await supabase.from('session_trainees').insert(
            selectedTrainees.map(traineeId => ({ session_id: id, trainee_id: traineeId }))
          )
        }
        
        toast.success('Session mise à jour')
      } else {
        const { data, error } = await supabase
          .from('sessions')
          .insert([sessionData])
          .select()
          .single()
        if (error) throw error
        sessionId = data.id

        // Ajouter les stagiaires
        if (selectedTrainees.length > 0) {
          await supabase.from('session_trainees').insert(
            selectedTrainees.map(traineeId => ({ session_id: sessionId, trainee_id: traineeId }))
          )
        }
        
        toast.success('Session créée')
      }

      await loadSessions()
      navigate(`/sessions/${sessionId}`)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/sessions')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Retour aux sessions
      </button>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <Calendar className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Modifier la session' : 'Nouvelle session'}
            </h1>
            <p className="text-sm text-gray-500">Planifiez une session de formation</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Formation et Client */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Formation et Client</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formation *</label>
                <select
                  name="course_id"
                  value={form.course_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                <select
                  name="client_id"
                  value={form.client_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Formateur</label>
              <select
                name="trainer_id"
                value={form.trainer_id}
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

          {/* Dates et Horaires */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Dates et Horaires</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début *</label>
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                <input
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={handleChange}
                  min={form.start_date}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure de début</label>
                <input
                  type="time"
                  name="start_time"
                  value={form.start_time}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure de fin</label>
                <input
                  type="time"
                  name="end_time"
                  value={form.end_time}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Lieu */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Lieu</h3>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                name="is_intra"
                id="is_intra"
                checked={form.is_intra}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="is_intra" className="flex-1">
                <span className="font-medium">Formation Intra-entreprise</span>
                <p className="text-sm text-gray-500">La formation se déroule dans les locaux du client</p>
              </label>
            </div>

            {form.is_intra && selectedClient && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm font-medium text-blue-900">Lieu : locaux du client</p>
                <p className="text-sm text-blue-700">
                  {selectedClient.address}, {selectedClient.postal_code} {selectedClient.city}
                </p>
              </div>
            )}

            {!form.is_intra && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse du lieu</label>
                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="Salle de formation, adresse..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
          </div>

          {/* Prix */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Tarification</h3>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                name="use_custom_price"
                id="use_custom_price"
                checked={form.use_custom_price}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="use_custom_price" className="flex-1">
                <span className="font-medium">Utiliser un prix personnalisé</span>
                <p className="text-sm text-gray-500">Remplace le prix par défaut de la formation</p>
              </label>
            </div>

            {form.use_custom_price && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix personnalisé HT (€)</label>
                <input
                  type="number"
                  name="custom_price_ht"
                  value={form.custom_price_ht}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-sm font-medium text-green-900">Prix affiché sur les documents : {getDisplayPrice()}</p>
            </div>
          </div>

          {/* Stagiaires */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">
              Stagiaires ({selectedTrainees.length} sélectionné{selectedTrainees.length > 1 ? 's' : ''})
            </h3>
            
            {availableTrainees.length === 0 ? (
              <p className="text-sm text-gray-500">
                {form.client_id 
                  ? 'Aucun stagiaire associé à ce client. Créez d\'abord des stagiaires.'
                  : 'Sélectionnez d\'abord un client pour voir les stagiaires disponibles.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {availableTrainees.map(trainee => (
                  <label
                    key={trainee.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTrainees.includes(trainee.id)
                        ? 'bg-primary-50 border-primary-200'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTrainees.includes(trainee.id)}
                      onChange={() => toggleTrainee(trainee.id)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <div>
                      <p className="font-medium">{trainee.first_name} {trainee.last_name}</p>
                      {trainee.job_title && (
                        <p className="text-xs text-gray-500">{trainee.job_title}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Statut et Notes */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Statut</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut de la session</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="planned">Planifiée</option>
                <option value="in_progress">En cours</option>
                <option value="completed">Terminée</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes internes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate('/sessions')}
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
              {saving ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Créer la session')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
