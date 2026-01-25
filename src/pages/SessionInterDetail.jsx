import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  ArrowLeft, Calendar, MapPin, Users, Euro, TrendingUp, 
  Plus, Edit, Trash2, Mail, FileText, AlertCircle, 
  CheckCircle, Clock, Building2, User, Phone, UserPlus,
  Key, Copy, Check, Sparkles, Download
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import AddTraineesToGroup from '../components/AddTraineesToGroup'
import SendEmailsModal from '../components/SendEmailsModal'
import { generateAccessCodeForTrainee, generateAccessCodesForTrainees } from '../lib/accessCodeGenerator'
import { downloadConventionInter, downloadEmargementInter, downloadDocument } from '../lib/pdfGenerator'

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
          clients(id, name, contact_email, contact_phone, address, siret, contact_name, contact_function),
          session_trainees(
            id,
            trainee_id,
            trainee_status,
            access_code,
            info_completed_at,
            trainees(id, first_name, last_name, email, phone, social_security_number)
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
      <div className="text-center py-8">
        <p className="text-gray-500">Session non trouvée</p>
        <Link to="/sessions" className="text-primary-600 hover:underline mt-2">
          Retour aux sessions
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sessions')} className="btn btn-secondary">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {session.courses?.title}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {session.reference} • Session INTER-ENTREPRISES
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/sessions-inter/${id}/edit`} className="btn btn-secondary">
            <Edit className="w-4 h-4" />
            Modifier
          </Link>
          <button
            onClick={() => setShowAddGroupModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            Ajouter un groupe
          </button>
        </div>
      </div>

      {/* Infos session */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="grid md:grid-cols-4 gap-6">
          <div>
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Dates</span>
            </div>
            <p className="font-medium text-gray-900">
              {format(new Date(session.start_date), 'd MMM', { locale: fr })} - {format(new Date(session.end_date), 'd MMM yyyy', { locale: fr })}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">Lieu</span>
            </div>
            <p className="font-medium text-gray-900">
              {session.location_city || 'Non défini'}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-sm">Effectif</span>
            </div>
            <p className="font-medium text-gray-900">
              {session.min_participants} - {session.max_participants} participants
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Euro className="w-4 h-4" />
              <span className="text-sm">Prix public</span>
            </div>
            <p className="font-medium text-gray-900">
              {session.public_price_per_person}€ / pers.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 mb-1">Groupes</p>
          <p className="text-2xl font-bold text-gray-900">{stats.nb_groups}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 mb-1">Participants</p>
          <p className="text-2xl font-bold text-gray-900">{stats.nb_participants}</p>
          <div className="flex items-center gap-1 mt-1">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${isMinReached ? 'bg-green-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(fillRate, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{fillRate}%</span>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 mb-1">Confirmés</p>
          <p className="text-2xl font-bold text-green-600">{stats.nb_confirmed}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 mb-1">CA Total</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats.ca_total.toLocaleString('fr-FR')}€
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 mb-1">Fiches complétées</p>
          <p className="text-2xl font-bold text-blue-600">
            {stats.nb_infos_completed}/{stats.nb_participants}
          </p>
        </div>
      </div>

      {/* Alert minimum */}
      {!isMinReached && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-900">Effectif minimum non atteint</p>
              <p className="text-sm text-orange-700 mt-1">
                Il manque encore {(session.min_participants || 4) - stats.nb_participants} participant(s) pour atteindre le minimum.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Groupes */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Groupes inscrits ({groups.length})
        </h2>
        {groups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Aucun groupe inscrit</p>
            <button
              onClick={() => setShowAddGroupModal(true)}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter un groupe
            </button>
          </div>
        ) : (
          groups.map((group) => (
            <GroupCard 
              key={group.id} 
              group={group} 
              session={session}
              onUpdate={loadSessionData}
            />
          ))
        )}
      </div>

      {/* Modal ajout groupe */}
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
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
  const [showSendEmailsModal, setShowSendEmailsModal] = useState(false)
  const [copiedCode, setCopiedCode] = useState(null)
  const [generatingCodeId, setGeneratingCodeId] = useState(null)
  const [generatingCodes, setGeneratingCodes] = useState(false)

  const nbPlacesReservees = group.nb_personnes || 0
  const nbTraineesInscrits = group.session_trainees?.length || 0
  const traineesWithCode = group.session_trainees?.filter(st => st.access_code) || []
  const traineesWithoutCode = group.session_trainees?.filter(st => !st.access_code) || []
  const traineesWithCodeSendable = traineesWithCode.filter(st => st.trainees?.email)

  const getStatusBadge = (status) => {
    const badges = {
      pending: <span className="badge badge-orange">En attente</span>,
      confirmed: <span className="badge badge-green">Confirmé</span>,
      cancelled: <span className="badge badge-red">Annulé</span>
    }
    return badges[status] || null
  }

  const getPaymentBadge = (status) => {
    const badges = {
      pending: <span className="badge badge-gray">Paiement en attente</span>,
      confirmed: <span className="badge badge-blue">Payé</span>,
      partial: <span className="badge badge-yellow">Acompte</span>
    }
    return badges[status] || null
  }

  const handleGenerateCode = async (sessionTraineeId) => {
    setGeneratingCodeId(sessionTraineeId)
    try {
      await generateAccessCodeForTrainee(sessionTraineeId)
      toast.success('Code généré !')
      onUpdate()
    } catch (error) {
      console.error('Erreur génération code:', error)
      toast.error('Erreur lors de la génération')
    } finally {
      setGeneratingCodeId(null)
    }
  }

  const handleGenerateAllCodes = async () => {
    setGeneratingCodes(true)
    try {
      const ids = traineesWithoutCode.map(st => st.id)
      await generateAccessCodesForTrainees(ids)
      toast.success(`${ids.length} code(s) généré(s) !`)
      onUpdate()
    } catch (error) {
      console.error('Erreur génération codes:', error)
      toast.error('Erreur lors de la génération')
    } finally {
      setGeneratingCodes(false)
    }
  }

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast.success('Code copié !')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleDeleteGroup = async () => {
    if (!confirm(`Supprimer le groupe ${group.clients?.name || 'ce groupe'} ?\n\nCela supprimera aussi tous les stagiaires inscrits dans ce groupe.`)) {
      return
    }

    try {
      // Supprimer d'abord les stagiaires du groupe
      const { error: traineesError } = await supabase
        .from('session_trainees')
        .delete()
        .eq('group_id', group.id)

      if (traineesError) throw traineesError

      // Puis supprimer le groupe
      const { error: groupError } = await supabase
        .from('session_groups')
        .delete()
        .eq('id', group.id)

      if (groupError) throw groupError

      toast.success('Groupe supprimé !')
      onUpdate()
    } catch (error) {
      console.error('Erreur suppression groupe:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleDeleteTrainee = async (sessionTraineeId) => {
    if (!confirm('Supprimer ce stagiaire du groupe ?')) return

    try {
      const { error } = await supabase
        .from('session_trainees')
        .delete()
        .eq('id', sessionTraineeId)

      if (error) throw error
      toast.success('Stagiaire retiré du groupe')
      onUpdate()
    } catch (error) {
      console.error('Erreur suppression stagiaire:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  // === NOUVELLES FONCTIONS PDF ===
  const handleDownloadConvention = () => {
    try {
      const trainees = group.session_trainees?.map(st => st.trainees).filter(Boolean) || []
      downloadConventionInter(session, group, trainees, session.trainers, [])
      toast.success('Convention téléchargée !')
    } catch (error) {
      console.error('Erreur téléchargement convention:', error)
      toast.error('Erreur lors du téléchargement')
    }
  }

  const handleDownloadEmargementVierge = () => {
    try {
      const trainees = group.session_trainees?.map(st => st.trainees).filter(Boolean) || []
      downloadEmargementInter(session, group, trainees, session.trainers, { isBlank: true })
      toast.success('Émargement vierge téléchargé !')
    } catch (error) {
      console.error('Erreur téléchargement émargement:', error)
      toast.error('Erreur lors du téléchargement')
    }
  }

  const handleDownloadEmargementSigne = async () => {
    try {
      // Récupérer les présences
      const traineeIds = group.session_trainees?.map(st => st.trainees?.id).filter(Boolean) || []
      
      const { data: attendanceData, error } = await supabase
        .from('attendance_halfdays')
        .select('*')
        .eq('session_id', session.id)
        .in('trainee_id', traineeIds)
      
      if (error) throw error
      
      const trainees = group.session_trainees?.map(st => st.trainees).filter(Boolean) || []
      downloadEmargementInter(session, group, trainees, session.trainers, { 
        isBlank: false, 
        attendanceData: attendanceData || [] 
      })
      toast.success('Émargement signé téléchargé !')
    } catch (error) {
      console.error('Erreur téléchargement émargement signé:', error)
      toast.error('Erreur lors du téléchargement')
    }
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
              onClick={() => setShowEditGroupModal(true)}
              className="btn btn-secondary btn-sm flex items-center gap-1"
              title="Modifier le groupe"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteGroup()}
              className="btn btn-sm flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white"
              title="Supprimer le groupe"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="btn btn-secondary btn-sm"
            >
              {expanded ? 'Masquer' : 'Voir'} ({nbTraineesInscrits})
            </button>
          </div>
        </div>

        {/* === SECTION DOCUMENTS PDF === */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Documents du groupe
          </h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadConvention}
              className="btn btn-sm btn-secondary flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Convention
            </button>
            <button
              onClick={handleDownloadEmargementVierge}
              className="btn btn-sm btn-secondary flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Émargement vierge
            </button>
            <button
              onClick={handleDownloadEmargementSigne}
              className="btn btn-sm btn-secondary flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Émargement signé
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
                {traineesWithCodeSendable.length > 0 && (
                  <button
                    onClick={() => setShowSendEmailsModal(true)}
                    className="btn btn-sm flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Mail className="w-4 h-4" />
                    Envoyer emails ({traineesWithCodeSendable.length})
                  </button>
                )}
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
                      <button
                        onClick={() => handleDeleteTrainee(st.id)}
                        className="p-1.5 hover:bg-red-100 rounded transition-colors"
                        title="Retirer du groupe"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
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

      {/* Modal envoi emails */}
      {showSendEmailsModal && (
        <SendEmailsModal
          group={group}
          session={session}
          trainees={group.session_trainees || []}
          onClose={() => setShowSendEmailsModal(false)}
          onSuccess={() => {
            setShowSendEmailsModal(false)
            onUpdate()
          }}
        />
      )}

      {/* Modal édition groupe */}
      {showEditGroupModal && (
        <EditGroupModal
          group={group}
          sessionPrice={session.public_price_per_person}
          onClose={() => setShowEditGroupModal(false)}
          onSuccess={() => {
            setShowEditGroupModal(false)
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

      const { error } = await supabase
        .from('session_groups')
        .insert({
          session_id: sessionId,
          client_id: formData.client_id || null,
          nb_personnes: formData.nb_personnes,
          price_total,
          status: formData.status,
          payment_status: formData.payment_status
        })

      if (error) throw error
      toast.success('Groupe ajouté !')
      onSuccess()
    } catch (error) {
      console.error('Erreur ajout groupe:', error)
      toast.error('Erreur lors de l\'ajout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Ajouter un groupe</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entreprise (optionnel)
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="input"
            >
              <option value="">-- Nouvelle entreprise --</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de participants *
            </label>
            <input
              type="number"
              min="1"
              value={formData.nb_personnes}
              onChange={(e) => setFormData({ ...formData, nb_personnes: parseInt(e.target.value) })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix par personne *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.price_per_person}
              onChange={(e) => setFormData({ ...formData, price_per_person: parseFloat(e.target.value) })}
              className="input"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Prix total : {(formData.nb_personnes * formData.price_per_person).toFixed(2)}€
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input"
              >
                <option value="pending">En attente</option>
                <option value="confirmed">Confirmé</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Paiement
              </label>
              <select
                value={formData.payment_status}
                onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                className="input"
              >
                <option value="pending">En attente</option>
                <option value="confirmed">Payé</option>
                <option value="partial">Acompte</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Composant Modal Modifier un groupe
function EditGroupModal({ group, sessionPrice, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nb_personnes: group.nb_personnes || 1,
    price_per_person: group.price_per_person || sessionPrice || 350,
    status: group.status || 'pending',
    payment_status: group.payment_status || 'pending'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const price_total = formData.nb_personnes * formData.price_per_person

      const { error } = await supabase
        .from('session_groups')
        .update({
          nb_personnes: formData.nb_personnes,
          price_per_person: formData.price_per_person,
          price_total,
          status: formData.status,
          payment_status: formData.payment_status
        })
        .eq('id', group.id)

      if (error) throw error
      toast.success('Groupe modifié !')
      onSuccess()
    } catch (error) {
      console.error('Erreur modification groupe:', error)
      toast.error('Erreur lors de la modification')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Modifier le groupe - {group.clients?.name || 'Entreprise'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de participants *
            </label>
            <input
              type="number"
              min="1"
              value={formData.nb_personnes}
              onChange={(e) => setFormData({ ...formData, nb_personnes: parseInt(e.target.value) })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix par personne *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.price_per_person}
              onChange={(e) => setFormData({ ...formData, price_per_person: parseFloat(e.target.value) })}
              className="input"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Prix total : {(formData.nb_personnes * formData.price_per_person).toFixed(2)}€
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input"
              >
                <option value="pending">En attente</option>
                <option value="confirmed">Confirmé</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Paiement
              </label>
              <select
                value={formData.payment_status}
                onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                className="input"
              >
                <option value="pending">En attente</option>
                <option value="confirmed">Payé</option>
                <option value="partial">Acompte</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Modification...' : 'Modifier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
