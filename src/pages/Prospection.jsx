import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Plus, Search, Calendar, Edit, Trash2, CheckCircle, Clock, XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO, isBefore, isToday, isTomorrow } from 'date-fns'
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
  a_prendre: { label: 'À prendre', icon: Clock, color: 'text-red-600' },
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
  const rdvsAPrendre = filteredRdvs.filter(r => r.status === 'a_prendre')

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
    // Tous les RDVs futurs
    return true
  })

  const rdvsRealises = filteredRdvs.filter(r => r.status === 'realise')
  const rdvsAutres = filteredRdvs.filter(r => r.status === 'annule' || r.status === 'reporte')

  const getDateLabel = (dateStr) => {
    if (!dateStr) return null
    const date = parseISO(dateStr)
    if (isToday(date)) return "Aujourd'hui"
    if (isTomorrow(date)) return 'Demain'
    return format(date, 'EEE d MMM', { locale: fr })
  }

  const getLocationLabel = (loc) => {
    if (!loc) return ''
    const map = { leurs_locaux: '📍 Leurs locaux', nos_locaux: '🏢 Nos locaux', visio: '💻 Visio', telephone: '📞 Tél.' }
    return map[loc] || loc
  }

  // Composant ligne compacte
  const RdvRow = ({ rdv, highlight }) => {
    const StatusInfo = RDV_STATUS[rdv.status] || RDV_STATUS.prevu
    const StatusIcon = StatusInfo.icon || Clock
    
    return (
      <tr 
        className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${highlight ? 'bg-red-50 hover:bg-red-100' : ''}`}
        onClick={() => navigate(`/prospection/${rdv.id}`)}
      >
        {/* Statut + Urgence */}
        <td className="px-3 py-2.5 w-10">
          <div className="flex items-center gap-1.5">
            {rdv.is_urgent && <span className="text-red-500 text-xs" title="Urgent">🔴</span>}
            <StatusIcon className={`w-4 h-4 ${StatusInfo.color}`} title={StatusInfo.label} />
          </div>
        </td>
        {/* Entreprise + Contact */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm">{rdv.clients?.name || 'Client inconnu'}</span>
            {rdv.rdv_type && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${RDV_TYPES[rdv.rdv_type]?.color || 'bg-gray-100'}`}>
                {RDV_TYPES[rdv.rdv_type]?.label || rdv.rdv_type}
              </span>
            )}
          </div>
          {rdv.contact_name && (
            <p className="text-xs text-gray-500 mt-0.5">{rdv.contact_name}</p>
          )}
        </td>
        {/* Date + Heure */}
        <td className="px-3 py-2.5 text-sm hidden md:table-cell">
          {rdv.rdv_date ? (
            <div>
              <span className={`font-medium ${isToday(parseISO(rdv.rdv_date)) ? 'text-red-600' : isTomorrow(parseISO(rdv.rdv_date)) ? 'text-orange-600' : 'text-gray-700'}`}>
                {getDateLabel(rdv.rdv_date)}
              </span>
              {rdv.rdv_time && <span className="text-gray-400 ml-1.5">{rdv.rdv_time.slice(0, 5)}</span>}
            </div>
          ) : (
            <span className="text-red-500 text-xs italic">Date à définir</span>
          )}
        </td>
        {/* Lieu */}
        <td className="px-3 py-2.5 text-xs text-gray-500 hidden lg:table-cell">
          {getLocationLabel(rdv.rdv_location)}
        </td>
        {/* Commercial */}
        <td className="px-3 py-2.5 text-xs text-gray-500 hidden lg:table-cell">
          {rdv.conducted_by || '—'}
        </td>
        {/* Notes / Prochaine action */}
        <td className="px-3 py-2.5 hidden xl:table-cell max-w-[200px]">
          {rdv.next_action ? (
            <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded truncate" title={rdv.next_action}>
              ⚡ {rdv.next_action}
            </p>
          ) : rdv.notes ? (
            <p className="text-xs text-gray-400 truncate" title={rdv.notes}>{rdv.notes}</p>
          ) : null}
        </td>
        {/* Actions */}
        <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
          <div className="flex gap-1 justify-end">
            <button
              onClick={() => navigate(`/prospection/${rdv.id}`)}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
              title="Éditer"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDeleteRdv(rdv.id)}
              className="p-1.5 hover:bg-red-100 rounded text-red-400"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  // Composant tableau de section
  const RdvSection = ({ title, icon: Icon, rdvList, color, highlight }) => {
    if (rdvList.length === 0) return null
    return (
      <div className="mb-4">
        <h2 className={`text-sm font-semibold ${color} mb-2 flex items-center gap-2 px-1`}>
          <Icon className="w-4 h-4" />
          {title} ({rdvList.length})
        </h2>
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {rdvList.map(rdv => <RdvRow key={rdv.id} rdv={rdv} highlight={highlight} />)}
            </tbody>
          </table>
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
            <option value="a_prendre">À prendre</option>
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
            <option value="Marine">Marine</option>
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
        <div>
          {/* En-tête de colonnes global */}
          <div className="hidden md:grid grid-cols-[40px_1fr_140px_120px_80px_200px_70px] gap-0 px-4 py-2 text-[10px] text-gray-400 uppercase font-medium mb-1">
            <span></span>
            <span>Entreprise</span>
            <span>Date</span>
            <span className="hidden lg:block">Lieu</span>
            <span className="hidden lg:block">Par</span>
            <span className="hidden xl:block">Action</span>
            <span></span>
          </div>

          <RdvSection title="🔴 À prendre" icon={Clock} rdvList={rdvsAPrendre} color="text-red-700" highlight />
          <RdvSection title="⚠️ Urgents" icon={Calendar} rdvList={rdvsUrgents} color="text-orange-700" highlight />
          <RdvSection title="📅 À venir" icon={Clock} rdvList={rdvsProchains} color="text-blue-700" />
          {filterStatus !== 'prevu' && (
            <RdvSection title="✅ Réalisés" icon={CheckCircle} rdvList={rdvsRealises} color="text-green-700" />
          )}
          {rdvsAutres.length > 0 && (
            <RdvSection title="📁 Annulés / Reportés" icon={XCircle} rdvList={rdvsAutres} color="text-gray-500" />
          )}
        </div>
      )}
    </div>
  )
}
