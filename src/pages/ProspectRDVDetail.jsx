import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Save, ArrowLeft, Calendar, Clock, MapPin, User, Phone, Mail,
  Building2, FileText, Trash2, Plus, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import ProspectNeedsAnalysis from '../components/ProspectNeedsAnalysis'

export default function ProspectRDVDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'nouveau'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState([])
  const [contacts, setContacts] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [showNeedsAnalysis, setShowNeedsAnalysis] = useState(false)
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [newClientData, setNewClientData] = useState({
    name: '',
    siret: '',
    address: '',
    postal_code: '',
    city: '',
    contact_phone: '',
    email: ''
  })

  const [formData, setFormData] = useState({
    client_id: '',
    rdv_date: new Date().toISOString().split('T')[0], // AUTO : date du jour
    rdv_time: '09:00',
    rdv_type: 'decouverte', // AUTO : découverte
    rdv_location: 'leurs_locaux',
    rdv_address: '',
    contact_id: null,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    conducted_by: '', // Sera auto-rempli avec user connecté
    status: 'prevu',
    notes: '',
    next_action: '',
    next_action_date: '', // Sera auto = rdv_date + 2 jours si vide
    // Nouveaux champs commerciaux (tous optionnels)
    temperature: null, // 'chaud', 'tiede', 'froid'
    source: null,
    budget_estime: '',
    formations_interet: [], // ['sst', 'incendie', 'r489', 'r485', 'duerp', 'habilitation']
    concurrence: '',
    timeline: null // 'urgent', 'court_terme', 'long_terme'
  })

  useEffect(() => {
    loadClients()
    if (!isNew) {
      loadRdv()
    } else {
      // Auto-remplir "mené par" avec l'user connecté
      const autoFillUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        const email = user?.email
        let conductedBy = ''
        if (email === 'hicham.saidi@accessformation.pro') conductedBy = 'Hicham'
        else if (email === 'maxime.langlais@accessformation.pro') conductedBy = 'Maxime'
        setFormData(prev => ({ ...prev, conducted_by: conductedBy }))
      }
      autoFillUser()
    }
  }, [id])

  useEffect(() => {
    if (formData.client_id) {
      loadClientContacts(formData.client_id)
      loadClientData(formData.client_id)
    }
  }, [formData.client_id])

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name')
    setClients(data || [])
  }

  const loadClientData = async (clientId) => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()
    setSelectedClient(data)
  }

  const loadClientContacts = async (clientId) => {
    const { data } = await supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
    setContacts(data || [])
  }

  const loadRdv = async () => {
    try {
      const { data, error } = await supabase
        .from('prospect_rdv')
        .select(`
          *,
          clients (*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      setFormData({
        client_id: data.client_id,
        rdv_date: data.rdv_date,
        rdv_time: data.rdv_time || '09:00',
        rdv_type: data.rdv_type || 'decouverte',
        rdv_location: data.rdv_location || 'leurs_locaux',
        rdv_address: data.rdv_address || '',
        contact_id: data.contact_id,
        contact_name: data.contact_name || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        conducted_by: data.conducted_by || '',
        status: data.status || 'prevu',
        notes: data.notes || '',
        next_action: data.next_action || '',
        next_action_date: data.next_action_date || '',
        // Nouveaux champs commerciaux
        temperature: data.temperature || null,
        source: data.source || null,
        budget_estime: data.budget_estime || '',
        formations_interet: data.formations_interet || [],
        concurrence: data.concurrence || '',
        timeline: data.timeline || null
      })
      setSelectedClient(data.clients)
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.client_id || !formData.rdv_date) {
      toast.error('Client et date obligatoires')
      return
    }

    // Vérifier qu'il y a au moins un email OU un téléphone
    if (!formData.contact_email && !formData.contact_phone) {
      toast.error('Email ou téléphone obligatoire')
      return
    }

    setSaving(true)
    try {
      // Préparer les données : transformer "" en null pour les dates
      const dataToSave = {
        ...formData,
        rdv_time: formData.rdv_time || null,
        next_action_date: formData.next_action_date || null,
        rdv_address: formData.rdv_address || null,
        contact_id: formData.contact_id || null,
        contact_name: formData.contact_name || null,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
        notes: formData.notes || null,
        next_action: formData.next_action || null,
        // Champs commerciaux
        temperature: formData.temperature || null,
        source: formData.source || null,
        budget_estime: formData.budget_estime || null,
        concurrence: formData.concurrence || null,
        timeline: formData.timeline || null
      }

      // Auto : next_action_date = rdv_date + 2 jours si vide
      if (!dataToSave.next_action_date && dataToSave.rdv_date) {
        const rdvDate = new Date(dataToSave.rdv_date)
        rdvDate.setDate(rdvDate.getDate() + 2)
        dataToSave.next_action_date = rdvDate.toISOString().split('T')[0]
      }

      if (isNew) {
        const { data, error } = await supabase
          .from('prospect_rdv')
          .insert([dataToSave])
          .select()
          .single()

        if (error) throw error
        toast.success('RDV créé')
        navigate(`/prospection/${data.id}`)
      } else {
        const { error } = await supabase
          .from('prospect_rdv')
          .update(dataToSave)
          .eq('id', id)

        if (error) throw error
        toast.success('RDV mis à jour')
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer ce RDV ?')) return

    try {
      const { error } = await supabase
        .from('prospect_rdv')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('RDV supprimé')
      navigate('/prospection')
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleCreateClient = async () => {
    if (!newClientData.name) {
      toast.error('Le nom du client est obligatoire')
      return
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          name: newClientData.name.toUpperCase(),
          siret: newClientData.siret,
          address: newClientData.address,
          postal_code: newClientData.postal_code,
          city: newClientData.city,
          contact_phone: newClientData.contact_phone,
          email: newClientData.email
        }])
        .select()
        .single()

      if (error) throw error

      toast.success('Client créé')
      setClients([...clients, data])
      setFormData({ ...formData, client_id: data.id })
      setShowNewClientModal(false)
      setNewClientData({
        name: '',
        siret: '',
        address: '',
        postal_code: '',
        city: '',
        contact_phone: '',
        email: ''
      })
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la création du client')
    }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/prospection')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? 'Nouveau RDV' : 'Éditer RDV'}
            </h1>
            {selectedClient && (
              <p className="text-gray-600 mt-1">{selectedClient.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informations RDV */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Informations du RDV
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client *
                </label>
                <div className="space-y-2">
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Sélectionner un client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewClientModal(true)}
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Créer un nouveau client
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.rdv_date}
                  onChange={(e) => setFormData({ ...formData, rdv_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Heure
                </label>
                <input
                  type="time"
                  value={formData.rdv_time}
                  onChange={(e) => setFormData({ ...formData, rdv_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de RDV
                </label>
                <select
                  value={formData.rdv_type}
                  onChange={(e) => setFormData({ ...formData, rdv_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="decouverte">Découverte</option>
                  <option value="suivi">Suivi</option>
                  <option value="signature">Signature</option>
                  <option value="relance">Relance</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lieu
                </label>
                <select
                  value={formData.rdv_location}
                  onChange={(e) => setFormData({ ...formData, rdv_location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="leurs_locaux">Leurs locaux</option>
                  <option value="nos_locaux">Nos locaux</option>
                  <option value="visio">Visio</option>
                  <option value="telephone">Téléphone</option>
                </select>
              </div>

              {formData.rdv_location === 'leurs_locaux' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse
                  </label>
                  <input
                    type="text"
                    value={formData.rdv_address}
                    onChange={(e) => setFormData({ ...formData, rdv_address: e.target.value })}
                    placeholder={selectedClient?.address || "Adresse du RDV"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mené par
                </label>
                <select
                  value={formData.conducted_by}
                  onChange={(e) => setFormData({ ...formData, conducted_by: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sélectionner</option>
                  <option value="Hicham">Hicham</option>
                  <option value="Maxime">Maxime</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="prevu">Prévu</option>
                  <option value="realise">Réalisé</option>
                  <option value="annule">Annulé</option>
                  <option value="reporte">Reporté</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" />
              Contact rencontré
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact existant
                  </label>
                  <select
                    value={formData.contact_id || ''}
                    onChange={(e) => {
                      const contact = contacts.find(c => c.id === e.target.value)
                      if (contact) {
                        setFormData({
                          ...formData,
                          contact_id: contact.id,
                          contact_name: contact.name || '',
                          contact_email: contact.email || '',
                          contact_phone: contact.phone || contact.mobile || ''
                        })
                      } else {
                        setFormData({
                          ...formData,
                          contact_id: null,
                          contact_name: '',
                          contact_email: '',
                          contact_phone: ''
                        })
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">-- Ou saisir manuellement --</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.is_primary && '(Principal)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              Notes et actions
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes du RDV
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Notes prises pendant le RDV..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prochaine action
                </label>
                <input
                  type="text"
                  value={formData.next_action}
                  onChange={(e) => setFormData({ ...formData, next_action: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: Envoyer devis SST"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date prochaine action
                </label>
                <input
                  type="date"
                  value={formData.next_action_date}
                  onChange={(e) => setFormData({ ...formData, next_action_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Infos commerciales (optionnelles, repliable) */}
          <details className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <summary className="cursor-pointer font-semibold text-gray-700 flex items-center gap-2 select-none">
              <span className="text-lg">💼</span>
              Infos commerciales (optionnel)
            </summary>
            
            <div className="mt-4 space-y-4">
              {/* Température */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                  <span>🌡️</span>
                  Température du prospect
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, temperature: 'chaud' })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      formData.temperature === 'chaud' 
                        ? 'bg-red-100 border-red-500 text-red-700' 
                        : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    🔥 Chaud
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, temperature: 'tiede' })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      formData.temperature === 'tiede' 
                        ? 'bg-orange-100 border-orange-500 text-orange-700' 
                        : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    🟠 Tiède
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, temperature: 'froid' })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      formData.temperature === 'froid' 
                        ? 'bg-blue-100 border-blue-500 text-blue-700' 
                        : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    🔵 Froid
                  </button>
                </div>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                  <span>📍</span>
                  Source du contact
                </label>
                <select
                  value={formData.source || ''}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="">-- Non renseigné --</option>
                  <option value="bouche_a_oreille">Bouche-à-oreille</option>
                  <option value="site_web">Site web</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="salon">Salon / Événement</option>
                  <option value="appel_froid">Appel froid</option>
                  <option value="prescripteur">Prescripteur</option>
                </select>
              </div>

              {/* Timeline */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                  <span>📅</span>
                  Urgence / Timeline
                </label>
                <select
                  value={formData.timeline || ''}
                  onChange={(e) => setFormData({ ...formData, timeline: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="">-- Non renseigné --</option>
                  <option value="urgent">Urgent (ce mois)</option>
                  <option value="court_terme">Court terme (ce trimestre)</option>
                  <option value="long_terme">Long terme (cette année)</option>
                </select>
              </div>

              {/* Formations d'intérêt */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                  <span>📚</span>
                  Formations d'intérêt
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'sst', label: 'SST' },
                    { value: 'incendie', label: 'Incendie' },
                    { value: 'r489', label: 'R489 (Chariots)' },
                    { value: 'r485', label: 'R485 (Gerbeurs)' },
                    { value: 'habilitation_elec', label: 'Habilitation Élec B0H0V' },
                    { value: 'duerp', label: 'DUERP' },
                    { value: 'gestes_postures', label: 'Gestes & Postures' }
                  ].map(formation => (
                    <label key={formation.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.formations_interet.includes(formation.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              formations_interet: [...formData.formations_interet, formation.value]
                            })
                          } else {
                            setFormData({
                              ...formData,
                              formations_interet: formData.formations_interet.filter(f => f !== formation.value)
                            })
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-gray-700">{formation.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Budget estimé */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                  <span>💶</span>
                  Budget estimé
                </label>
                <input
                  type="text"
                  value={formData.budget_estime}
                  onChange={(e) => setFormData({ ...formData, budget_estime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="Ex: 2000-3000€"
                />
              </div>

              {/* Concurrence */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                  <span>🏢</span>
                  Concurrence
                </label>
                <input
                  type="text"
                  value={formData.concurrence}
                  onChange={(e) => setFormData({ ...formData, concurrence: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="Ex: Travaille déjà avec XYZ"
                />
              </div>
            </div>
          </details>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-4">
          {!isNew && formData.client_id && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <h3 className="font-semibold text-primary-900 mb-3">Analyse des besoins</h3>
              <button
                onClick={() => setShowNeedsAnalysis(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <FileText className="w-4 h-4" />
                Remplir l'analyse
              </button>
            </div>
          )}

          {selectedClient && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Informations client</h3>
              <div className="space-y-2 text-sm">
                {selectedClient.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-gray-600">
                      {selectedClient.address}<br />
                      {selectedClient.postal_code} {selectedClient.city}
                    </span>
                  </div>
                )}
                {selectedClient.contact_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{selectedClient.contact_phone}</span>
                  </div>
                )}
                {selectedClient.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{selectedClient.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Création client */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">Créer un nouveau client</h2>
              <button
                onClick={() => setShowNewClientModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de l'entreprise *
                  </label>
                  <input
                    type="text"
                    value={newClientData.name}
                    onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="ENTREPRISE ABC"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SIRET
                    </label>
                    <input
                      type="text"
                      value={newClientData.siret}
                      onChange={(e) => setNewClientData({ ...newClientData, siret: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="12345678901234"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={newClientData.contact_phone}
                      onChange={(e) => setNewClientData({ ...newClientData, contact_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="02 46 56 57 54"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="contact@entreprise.fr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse
                  </label>
                  <input
                    type="text"
                    value={newClientData.address}
                    onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="12 rue Example"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code postal
                    </label>
                    <input
                      type="text"
                      value={newClientData.postal_code}
                      onChange={(e) => setNewClientData({ ...newClientData, postal_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="29900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ville
                    </label>
                    <input
                      type="text"
                      value={newClientData.city}
                      onChange={(e) => setNewClientData({ ...newClientData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="Concarneau"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewClientModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateClient}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  Créer le client
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Analyse des besoins */}
      {showNeedsAnalysis && formData.client_id && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">Analyse des besoins</h2>
              <button
                onClick={() => setShowNeedsAnalysis(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <ProspectNeedsAnalysis 
                clientId={formData.client_id}
                rdvId={id !== 'nouveau' ? id : null}
                onClose={() => setShowNeedsAnalysis(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
