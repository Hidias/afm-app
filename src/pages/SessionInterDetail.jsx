import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  ArrowLeft, Calendar, MapPin, Users, Euro, TrendingUp, 
  Plus, Edit, Trash2, Mail, FileText, AlertCircle, 
  CheckCircle, Clock, Building2, User, Phone, UserPlus,
  Key, Copy, Check, Sparkles
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import AddTraineesToGroup from '../components/AddTraineesToGroup'
import { generateAccessCodeForTrainee, generateAccessCodesForTrainees } from '../lib/accessCodeGenerator'

export default function SessionInterDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [groups, setGroups] = useState([])
  const [showAddGroupModal, setShowAddGroupModal] = useState(false)

  useEffect(() => {
    loadSessionData()
  }, [id])

  const loadSessionData = async () => {
    setLoading(true)
    try {
      // Charger la session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
          courses(id, title, code, duration_hours),
          trainers(id, first_name, last_name)
        `)
        .eq('id', id)
        .single()

      if (sessionError) throw sessionError
      setSession(sessionData)

      // Charger les groupes avec leurs stagiaires
      const { data: groupsData, error: groupsError } = await supabase
        .from('session_groups')
        .select(`
          *,
          clients(id, name, contact_email, contact_phone),
          session_trainees(
            id,
            trainee_id,
            trainee_status,
            access_code,
            info_completed_at,
            trainees(id, first_name, last_name, email, phone)
          )
        `)
        .eq('session_id', id)
        .order('created_at', { ascending: false })

      if (groupsError) throw groupsError
      setGroups(groupsData || [])

    } catch (error) {
      console.error('Erreur chargement session:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  // Calculer les stats
  const stats = {
    nb_groups: groups.length,
    nb_participants: groups.reduce((sum, g) => sum + (g.nb_personnes || 0), 0),
    nb_confirmed: groups.filter(g => g.status === 'confirmed').reduce((sum, g) => sum + (g.nb_personnes || 0), 0),
    ca_total: groups.reduce((sum, g) => sum + (g.price_total || 0), 0),
    ca_confirmed: groups.filter(g => g.payment_status === 'confirmed').reduce((sum, g) => sum + (g.price_total || 0), 0),
    nb_infos_completed: groups.reduce((sum, g) => {
      return sum + (g.session_trainees?.filter(st => st.info_completed_at).length || 0)
    }, 0)
  }

  const fillRate = session?.max_participants 
    ? Math.round((stats.nb_participants / session.max_participants) * 100)
    : 0

  const isMinReached = stats.nb_participants >= (session?.min_participants || 4)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Session introuvable</h3>
        <Link to="/sessions-inter" className="text-primary-600 hover:underline">
          Retour à la liste
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/sessions-inter')}
            className="p-2 hover:bg-gray-100 rounded-lg mt-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {session.courses?.title || 'Formation'}
            </h1>
            <p className="text-gray-500 mt-1">
              Référence : {session.reference}
            </p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(session.start_date), 'd MMM', { locale: fr })} - 
                {format(new Date(session.end_date), 'd MMM yyyy', { locale: fr })}
              </span>
              {session.location_city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {session.location_city}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/sessions-inter/${id}/edit`)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Modifier
          </button>
        </div>
      </div>

      {/* Alertes */}
      {!isMinReached && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-900">
                Seuil minimum non atteint
              </p>
              <p className="text-sm text-orange-700 mt-1">
                {stats.nb_participants} / {session.min_participants} participants minimum requis
              </p>
            </div>
          </div>
        </div>
      )}

      {fillRate >= 90 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">
                Session presque complète
              </p>
              <p className="text-sm text-red-700 mt-1">
                {stats.nb_participants} / {session.max_participants} places occupées ({fillRate}%)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.nb_groups}</p>
              <p className="text-sm text-gray-500">Groupes</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500 p-3 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.nb_participants}</p>
              <p className="text-sm text-gray-500">Participants</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${fillRate >= 90 ? 'bg-red-500' : fillRate >= 70 ? 'bg-orange-500' : 'bg-green-500'}`}>
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{fillRate}%</p>
              <p className="text-sm text-gray-500">Taux remplissage</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-3 rounded-lg">
              <Euro className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.ca_confirmed.toLocaleString('fr-FR')}€
              </p>
              <p className="text-sm text-gray-500">CA confirmé</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 p-3 rounded-lg">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.nb_infos_completed}</p>
              <p className="text-sm text-gray-500">Fiches complétées</p>
            </div>
          </div>
        </div>
      </div>

      {/* Groupes */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Groupes d'entreprises
          </h2>
          <button
            onClick={() => setShowAddGroupModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter un groupe
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun groupe inscrit
            </h3>
            <p className="text-gray-500 mb-4">
              Ajoutez votre premier groupe d'entreprise pour cette session
            </p>
            <button
              onClick={() => setShowAddGroupModal(true)}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter un groupe
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <GroupCard 
                key={group.id} 
                group={group} 
                session={session}
                onUpdate={loadSessionData}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Ajouter un groupe */}
      {showAddGroupModal && (
        <AddGroupModal
          sessionId={id}
          sessionPrice={session.public_price_per_person}
          onClose={() => setShowAddGroupModal(false)}
          onSuccess={() => {
            setShowAddGroupModal(false)
            loadSessionData()
          }}
        />
      )}
    </div>
  )
}

// Composant GroupCard
function GroupCard({ group, session, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [showAddTraineesModal, setShowAddTraineesModal] = useState(false)
  const [generatingCodes, setGeneratingCodes] = useState(false)
  const [generatingCodeId, setGeneratingCodeId] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)

  const getStatusBadge = (status) => {
    const config = {
      pending: { label: 'En attente', color: 'orange' },
      confirmed: { label: 'Confirmé', color: 'green' },
      cancelled: { label: 'Annulé', color: 'red' }
    }
    const { label, color } = config[status] || config.pending
    return <span className={`badge badge-${color}`}>{label}</span>
  }

  const getPaymentBadge = (status) => {
    const config = {
      pending: { label: 'Non payé', color: 'orange' },
      confirmed: { label: 'Payé', color: 'green' },
      cancelled: { label: 'Annulé', color: 'red' }
    }
    const { label, color } = config[status] || config.pending
    return <span className={`badge badge-${color}`}>{label}</span>
  }

  const nbTraineesInscrits = group.session_trainees?.length || 0
  const nbPlacesReservees = group.nb_personnes || 0
  const traineesWithoutCode = group.session_trainees?.filter(st => !st.access_code) || []
  const traineesWithCode = group.session_trainees?.filter(st => st.access_code) || []

  // Générer tous les codes manquants
  const handleGenerateAllCodes = async () => {
    if (traineesWithoutCode.length === 0) {
      toast.error('Tous les codes sont déjà générés')
      return
    }

    setGeneratingCodes(true)
    try {
      const traineeIds = traineesWithoutCode.map(st => st.id)
      const results = await generateAccessCodesForTrainees(traineeIds, session.id)

      if (results.errors.length > 0) {
        toast.error(`${results.errors.length} erreur(s) lors de la génération`)
      } else {
        toast.success(`${results.success.length} code(s) généré(s) avec succès !`)
      }

      onUpdate()
    } catch (error) {
      console.error('Erreur génération codes:', error)
      toast.error('Erreur lors de la génération des codes')
    } finally {
      setGeneratingCodes(false)
    }
  }

  // Générer un code individuel
  const handleGenerateCode = async (traineeId) => {
    setGeneratingCodeId(traineeId)
    try {
      const code = await generateAccessCodeForTrainee(traineeId, session.id)
      toast.success(`Code généré : ${code}`)
      onUpdate()
    } catch (error) {
      console.error('Erreur génération code:', error)
      toast.error('Erreur lors de la génération du code')
    } finally {
      setGeneratingCodeId(null)
    }
  }

  // Copier un code
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast.success('Code copié !')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <>
      <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-start justify-between gap-4">
          {/* Infos groupe */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {group.clients?.name || 'Entreprise'}
              </h3>
              {getStatusBadge(group.status)}
              {getPaymentBadge(group.payment_status)}
            </div>

            <div className="grid md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Participants</p>
                <p className="font-medium text-gray-900">
                  {group.nb_personnes || 0} personne{(group.nb_personnes || 0) > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {nbTraineesInscrits} inscrit{nbTraineesInscrits > 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Prix total</p>
                <p className="font-medium text-gray-900">
                  {group.price_total?.toLocaleString('fr-FR')}€
                </p>
              </div>
              <div>
                <p className="text-gray-500">Codes d'accès</p>
                <p className="font-medium text-gray-900">
                  {traineesWithCode.length}/{nbTraineesInscrits}
                </p>
                {traineesWithoutCode.length > 0 && (
                  <p className="text-xs text-orange-600">
                    {traineesWithoutCode.length} manquant{traineesWithoutCode.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
              {group.clients?.contact_email && (
                <div>
                  <p className="text-gray-500">Contact</p>
                  <p className="font-medium text-gray-900 truncate">
                    {group.clients.contact_email}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {nbTraineesInscrits < nbPlacesReservees && (
              <button
                onClick={() => setShowAddTraineesModal(true)}
                className="btn btn-primary btn-sm flex items-center gap-1"
              >
                <UserPlus className="w-4 h-4" />
                Ajouter
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="btn btn-secondary btn-sm"
            >
              {expanded ? 'Masquer' : 'Voir'} ({nbTraineesInscrits})
            </button>
          </div>
        </div>

        {/* Liste des stagiaires (si expanded) */}
        {expanded && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">
                Stagiaires inscrits ({nbTraineesInscrits}/{nbPlacesReservees})
              </h4>
              <div className="flex items-center gap-2">
                {traineesWithoutCode.length > 0 && (
                  <button
                    onClick={handleGenerateAllCodes}
                    disabled={generatingCodes}
                    className="btn btn-primary btn-sm flex items-center gap-1"
                  >
                    <Sparkles className="w-4 h-4" />
                    {generatingCodes ? 'Génération...' : `Générer ${traineesWithoutCode.length} code${traineesWithoutCode.length > 1 ? 's' : ''}`}
                  </button>
                )}
                {nbTraineesInscrits < nbPlacesReservees && (
                  <button
                    onClick={() => setShowAddTraineesModal(true)}
                    className="text-sm text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </button>
                )}
              </div>
            </div>
            {group.session_trainees?.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-3">Aucun stagiaire inscrit</p>
                <button
                  onClick={() => setShowAddTraineesModal(true)}
                  className="btn btn-primary btn-sm inline-flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter des stagiaires
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {group.session_trainees.map((st) => (
                  <div key={st.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <User className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">
                          {st.trainees?.first_name} {st.trainees?.last_name}
                        </p>
                        {st.trainees?.email && (
                          <p className="text-sm text-gray-500 truncate">{st.trainees.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {st.info_completed_at ? (
                        <span className="badge badge-green flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Fiche OK
                        </span>
                      ) : (
                        <span className="badge badge-orange flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          En attente
                        </span>
                      )}
                      {st.access_code ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-mono bg-gray-100 px-3 py-1 rounded">
                            {st.access_code}
                          </span>
                          <button
                            onClick={() => handleCopyCode(st.access_code)}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                            title="Copier le code"
                          >
                            {copiedCode === st.access_code ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleGenerateCode(st.id)}
                          disabled={generatingCodeId === st.id}
                          className="btn btn-sm flex items-center gap-1 bg-indigo-500 hover:bg-indigo-600 text-white"
                        >
                          <Key className="w-3 h-3" />
                          {generatingCodeId === st.id ? 'Génération...' : 'Générer code'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal ajout stagiaires */}
      {showAddTraineesModal && (
        <AddTraineesToGroup
          group={group}
          session={session}
          onClose={() => setShowAddTraineesModal(false)}
          onSuccess={() => {
            setShowAddTraineesModal(false)
            onUpdate()
          }}
        />
      )}
    </>
  )
}

// Composant Modal Ajouter un groupe
function AddGroupModal({ sessionId, sessionPrice, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState([])
  const [formData, setFormData] = useState({
    client_id: '',
    nb_personnes: 1,
    price_per_person: sessionPrice || 350,
    status: 'pending',
    payment_status: 'pending'
  })

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name, contact_email')
      .order('name')
    setClients(data || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const price_total = formData.nb_personnes * formData.price_per_person

      // Récupérer le nom du client pour générer le group_name
      const selectedClient = clients.find(c => c.id === formData.client_id)
      const group_name = selectedClient ? `Groupe ${selectedClient.name}` : 'Groupe'

      const { error } = await supabase
        .from('session_groups')
        .insert({
          session_id: sessionId,
          client_id: formData.client_id,
          group_name,
          nb_personnes: parseInt(formData.nb_personnes),
          price_per_person: parseFloat(formData.price_per_person),
          price_total,
          status: formData.status,
          payment_status: formData.payment_status
        })

      if (error) throw error

      toast.success('Groupe ajouté avec succès !')
      onSuccess()
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de l\'ajout du groupe')
    } finally {
      setLoading(false)
    }
  }

  const priceTotal = formData.nb_personnes * formData.price_per_person

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Ajouter un groupe d'entreprise
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Entreprise *
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              required
              className="input"
            >
              <option value="">Sélectionner une entreprise</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          {/* Nombre de personnes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de participants *
            </label>
            <input
              type="number"
              min="1"
              value={formData.nb_personnes}
              onChange={(e) => setFormData({ ...formData, nb_personnes: e.target.value })}
              required
              className="input"
            />
          </div>

          {/* Prix par personne */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prix par personne *
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.price_per_person}
                onChange={(e) => setFormData({ ...formData, price_per_person: e.target.value })}
                required
                className="input pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
            </div>
          </div>

          {/* Prix total calculé */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Prix total</span>
              <span className="text-2xl font-bold text-gray-900">
                {priceTotal.toLocaleString('fr-FR')}€
              </span>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Ajout...' : 'Ajouter le groupe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
