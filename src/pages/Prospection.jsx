import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Plus, Search, Calendar, MapPin, User, Phone, Mail, 
  Edit, Trash2, FileText, CheckCircle, Clock, XCircle,
  Building2, Users, Filter, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO, isBefore, isToday, isTomorrow, isThisWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

const RDV_TYPES = {
  decouverte: { label: 'Découverte', color: 'bg-blue-100 text-blue-800' },
  suivi: { label: 'Suivi', color: 'bg-purple-100 text-purple-800' },
  signature: { label: 'Signature', color: 'bg-green-100 text-green-800' },
  relance: { label: 'Relance', color: 'bg-orange-100 text-orange-800' },
  autre: { label: 'Autre', color: 'bg-gray-100 text-gray-800' }
}

const RDV_STATUS = {
  prevu: { label: 'Prévu', icon: Clock, color: 'text-blue-600' },
  realise: { label: 'Réalisé', icon: CheckCircle, color: 'text-green-600' },
  annule: { label: 'Annulé', icon: XCircle, color: 'text-red-600' },
  reporte: { label: 'Reporté', icon: Calendar, color: 'text-orange-600' }
}

export default function Prospection() {
  const navigate = useNavigate()
  const [rdvs, setRdvs] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterProprietaire, setFilterProprietaire] = useState('all')
  const [showNewRdvModal, setShowNewRdvModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Charger les RDV avec les infos clients
      const { data: rdvData, error: rdvError } = await supabase
        .from('prospect_rdv')
        .select(`
          *,
          clients (
            id,
            name,
            email,
            contact_phone,
            mobile,
            proprietaire
          )
        `)
        .order('rdv_date', { ascending: false })

      if (rdvError) throw rdvError

      // Charger tous les clients pour le formulaire
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name')

      if (clientsError) throw clientsError

      setRdvs(rdvData || [])
      setClients(clientsData || [])
    } catch (error) {
      console.error('Erreur chargement:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRdv = async (id) => {
    if (!confirm('Supprimer ce RDV ?')) return

    try {
      const { error } = await supabase
        .from('prospect_rdv')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('RDV supprimé')
      loadData()
    } catch (error) {
      console.error('Erreur suppression:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  // Filtrage
  const filteredRdvs = rdvs.filter(rdv => {
    const matchSearch = !searchTerm || 
      rdv.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rdv.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rdv.notes?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchStatus = filterStatus === 'all' || rdv.status === filterStatus
    const matchProprietaire = filterProprietaire === 'all' || rdv.conducted_by === filterProprietaire

    return matchSearch && matchStatus && matchProprietaire
  })

  // Grouper par urgence
  const rdvsUrgents = filteredRdvs.filter(r => {
    if (r.status !== 'prevu') return false
    // Urgent si : marqué manuel OU aujourd'hui/passé OU demain
    if (r.is_urgent) return true
    const date = parseISO(r.rdv_date)
    return isBefore(date, new Date()) || isToday(date) || isTomorrow(date)
  })

  const rdvsProchains = filteredRdvs.filter(r => {
    if (r.status !== 'prevu') return false
    // Exclure les urgents déjà affichés
    if (r.is_urgent) return false
    const date = parseISO(r.rdv_date)
    if (isBefore(date, new Date()) || isToday(date) || isTomorrow(date)) return false
    // Cette semaine (après demain)
    return isThisWeek(date, { weekStartsOn: 1 })
  })

  const rdvsRealises = filteredRdvs.filter(r => r.status === 'realise')

  const getDateLabel = (dateStr) => {
    const date = parseISO(dateStr)
    if (isToday(date)) return "Aujourd'hui"
    if (isTomorrow(date)) return 'Demain'
    return format(date, 'EEEE d MMMM yyyy', { locale: fr })
  }

  const RdvCard = ({ rdv }) => {
    const StatusIcon = RDV_STATUS[rdv.status]?.icon || Clock
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900">
                {rdv.clients?.name || 'Client inconnu'}
              </h3>
            </div>
            {rdv.contact_name && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-3 h-3" />
                <span>{rdv.contact_name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {rdv.is_urgent && (
              <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1">
                🔴 URGENT
              </span>
            )}
            {rdv.rdv_type && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${RDV_TYPES[rdv.rdv_type]?.color || 'bg-gray-100'}`}>
                {RDV_TYPES[rdv.rdv_type]?.label || rdv.rdv_type}
              </span>
            )}
            <StatusIcon className={`w-5 h-5 ${RDV_STATUS[rdv.status]?.color || 'text-gray-400'}`} />
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">{getDateLabel(rdv.rdv_date)}</span>
            {rdv.rdv_time && <span>à {rdv.rdv_time.slice(0, 5)}</span>}
          </div>

          {rdv.rdv_location && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>
                {rdv.rdv_location === 'leurs_locaux' ? 'Leurs locaux' :
                 rdv.rdv_location === 'nos_locaux' ? 'Nos locaux' :
                 rdv.rdv_location === 'visio' ? 'Visio' : 'Téléphone'}
              </span>
            </div>
          )}

          {rdv.conducted_by && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{rdv.conducted_by}</span>
            </div>
          )}
        </div>

        {rdv.notes && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {rdv.notes}
          </p>
        )}

        {rdv.next_action && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
            <p className="text-xs font-medium text-yellow-800 mb-1">Prochaine action</p>
            <p className="text-sm text-yellow-900">{rdv.next_action}</p>
            {rdv.next_action_date && (
              <p className="text-xs text-yellow-700 mt-1">
                {format(parseISO(rdv.next_action_date), 'd MMM yyyy', { locale: fr })}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t">
          <button
            onClick={() => navigate(`/prospection/${rdv.id}`)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-500 text-white rounded hover:bg-primary-600 text-sm"
          >
            <Edit className="w-4 h-4" />
            Éditer
          </button>
          <button
            onClick={() => handleDeleteRdv(rdv.id)}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospection</h1>
          <p className="text-gray-600 mt-1">Gestion des rendez-vous commerciaux</p>
        </div>
        <button
          onClick={() => navigate('/prospection/nouveau')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          <Plus className="w-5 h-5" />
          Nouveau RDV
        </button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">RDV prévus</p>
              <p className="text-2xl font-bold text-blue-600">
                {rdvs.filter(r => r.status === 'prevu').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Urgents</p>
              <p className="text-2xl font-bold text-red-600">
                {rdvsUrgents.length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-red-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cette semaine</p>
              <p className="text-2xl font-bold text-purple-600">
                {rdvsProchains.length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-purple-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Réalisés</p>
              <p className="text-2xl font-bold text-green-600">
                {rdvsRealises.length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">Tous les statuts</option>
            <option value="prevu">Prévus</option>
            <option value="realise">Réalisés</option>
            <option value="annule">Annulés</option>
            <option value="reporte">Reportés</option>
          </select>

          <select
            value={filterProprietaire}
            onChange={(e) => setFilterProprietaire(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">Tous les commerciaux</option>
            <option value="Hicham">Hicham</option>
            <option value="Maxime">Maxime</option>
          </select>
        </div>
      </div>

      {/* Listes de RDV */}
      {filteredRdvs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Aucun RDV trouvé</p>
          <button
            onClick={() => navigate('/prospection/nouveau')}
            className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
          >
            Créer le premier RDV
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* RDV urgents */}
          {rdvsUrgents.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-red-700 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                RDV urgents ({rdvsUrgents.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rdvsUrgents.map(rdv => <RdvCard key={rdv.id} rdv={rdv} />)}
              </div>
            </div>
          )}

          {/* RDV prochains */}
          {rdvsProchains.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-purple-700 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                À venir ({rdvsProchains.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rdvsProchains.map(rdv => <RdvCard key={rdv.id} rdv={rdv} />)}
              </div>
            </div>
          )}

          {/* RDV réalisés */}
          {rdvsRealises.length > 0 && filterStatus !== 'prevu' && (
            <div>
              <h2 className="text-lg font-semibold text-green-700 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Réalisés ({rdvsRealises.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rdvsRealises.slice(0, 6).map(rdv => <RdvCard key={rdv.id} rdv={rdv} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
