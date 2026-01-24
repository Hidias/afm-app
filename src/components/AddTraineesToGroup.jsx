import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, X, User, Building2, Mail, Phone, Plus, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AddTraineesToGroup({ group, session, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('existing') // 'existing' ou 'new'
  const [loading, setLoading] = useState(false)
  const [trainees, setTrainees] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTrainees, setSelectedTrainees] = useState([])
  
  // État pour nouveau stagiaire
  const [newTrainee, setNewTrainee] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    client_id: group.client_id // Pré-rempli avec le client du groupe
  })

  useEffect(() => {
    if (activeTab === 'existing') {
      loadTrainees()
    }
  }, [activeTab])

  const loadTrainees = async () => {
    setLoading(true)
    try {
      // Charger tous les stagiaires
      const { data, error } = await supabase
        .from('trainees')
        .select(`
          *,
          clients(id, name)
        `)
        .order('last_name')

      if (error) throw error

      // Filtrer ceux déjà inscrits à cette session
      const { data: existingTrainees } = await supabase
        .from('session_trainees')
        .select('trainee_id')
        .eq('session_id', session.id)

      const existingIds = existingTrainees?.map(st => st.trainee_id) || []
      const availableTrainees = data?.filter(t => !existingIds.includes(t.id)) || []

      setTrainees(availableTrainees)
    } catch (error) {
      console.error('Erreur chargement stagiaires:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  // Filtrer les stagiaires
  const filteredTrainees = trainees.filter(trainee => {
    const search = searchTerm.toLowerCase()
    return (
      trainee.first_name?.toLowerCase().includes(search) ||
      trainee.last_name?.toLowerCase().includes(search) ||
      trainee.email?.toLowerCase().includes(search) ||
      trainee.clients?.name?.toLowerCase().includes(search)
    )
  })

  // Grouper par entreprise pour faciliter la navigation
  const traineesByClient = filteredTrainees.reduce((acc, trainee) => {
    const clientName = trainee.clients?.name || 'Sans entreprise'
    if (!acc[clientName]) acc[clientName] = []
    acc[clientName].push(trainee)
    return acc
  }, {})

  const toggleTrainee = (traineeId) => {
    setSelectedTrainees(prev =>
      prev.includes(traineeId)
        ? prev.filter(id => id !== traineeId)
        : [...prev, traineeId]
    )
  }

  const handleAddExisting = async () => {
    if (selectedTrainees.length === 0) {
      toast.error('Sélectionnez au moins un stagiaire')
      return
    }

    setLoading(true)
    try {
      // Créer les entrées dans session_trainees
      const entries = selectedTrainees.map(trainee_id => ({
        session_id: session.id,
        trainee_id,
        group_id: group.id,
        trainee_status: 'confirmed',
        registration_date: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('session_trainees')
        .insert(entries)

      if (error) throw error

      toast.success(`${selectedTrainees.length} stagiaire(s) ajouté(s) avec succès !`)
      onSuccess()
    } catch (error) {
      console.error('Erreur ajout stagiaires:', error)
      toast.error('Erreur lors de l\'ajout')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Créer le stagiaire
      const { data: trainee, error: traineeError } = await supabase
        .from('trainees')
        .insert({
          first_name: newTrainee.first_name,
          last_name: newTrainee.last_name,
          email: newTrainee.email || null,
          phone: newTrainee.phone || null,
          client_id: newTrainee.client_id
        })
        .select()
        .single()

      if (traineeError) throw traineeError

      // L'ajouter à la session
      const { error: sessionError } = await supabase
        .from('session_trainees')
        .insert({
          session_id: session.id,
          trainee_id: trainee.id,
          group_id: group.id,
          trainee_status: 'confirmed',
          registration_date: new Date().toISOString()
        })

      if (sessionError) throw sessionError

      toast.success('Stagiaire créé et ajouté avec succès !')
      onSuccess()
    } catch (error) {
      console.error('Erreur création stagiaire:', error)
      toast.error('Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Ajouter des stagiaires
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Groupe : {group.clients?.name || 'Entreprise'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Onglets */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('existing')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                activeTab === 'existing'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Stagiaires existants
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 px-6 py-3 font-medium transition-colors ${
                activeTab === 'new'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Nouveau stagiaire
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'existing' ? (
            <div className="space-y-4">
              {/* Recherche */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un stagiaire..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 w-full"
                />
              </div>

              {/* Info sélection */}
              {selectedTrainees.length > 0 && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-primary-900">
                    {selectedTrainees.length} stagiaire(s) sélectionné(s)
                  </p>
                </div>
              )}

              {/* Liste par entreprise */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : Object.keys(traineesByClient).length === 0 ? (
                <div className="text-center py-12">
                  <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Aucun stagiaire disponible</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(traineesByClient).map(([clientName, clientTrainees]) => (
                    <div key={clientName}>
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {clientName} ({clientTrainees.length})
                      </h3>
                      <div className="space-y-2">
                        {clientTrainees.map((trainee) => (
                          <label
                            key={trainee.id}
                            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedTrainees.includes(trainee.id)
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedTrainees.includes(trainee.id)}
                              onChange={() => toggleTrainee(trainee.id)}
                              className="w-4 h-4"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">
                                {trainee.first_name} {trainee.last_name}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                {trainee.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {trainee.email}
                                  </span>
                                )}
                                {trainee.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {trainee.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                            {selectedTrainees.includes(trainee.id) && (
                              <CheckCircle className="w-5 h-5 text-primary-600" />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateNew} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={newTrainee.first_name}
                    onChange={(e) => setNewTrainee({ ...newTrainee, first_name: e.target.value })}
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={newTrainee.last_name}
                    onChange={(e) => setNewTrainee({ ...newTrainee, last_name: e.target.value })}
                    required
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newTrainee.email}
                  onChange={(e) => setNewTrainee({ ...newTrainee, email: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={newTrainee.phone}
                  onChange={(e) => setNewTrainee({ ...newTrainee, phone: e.target.value })}
                  className="input"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Entreprise :</strong> {group.clients?.name || 'Non définie'}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Le stagiaire sera automatiquement lié à cette entreprise
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            Annuler
          </button>
          {activeTab === 'existing' ? (
            <button
              onClick={handleAddExisting}
              className="btn btn-primary"
              disabled={loading || selectedTrainees.length === 0}
            >
              {loading ? 'Ajout...' : `Ajouter ${selectedTrainees.length > 0 ? `(${selectedTrainees.length})` : ''}`}
            </button>
          ) : (
            <button
              onClick={handleCreateNew}
              className="btn btn-primary flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                'Création...'
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Créer et ajouter
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
