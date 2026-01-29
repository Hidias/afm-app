import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Save, ArrowLeft, Calendar, Clock, MapPin, User, Phone, Mail,
  Building2, FileText, Trash2
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

  const [formData, setFormData] = useState({
    client_id: '',
    rdv_date: new Date().toISOString().split('T')[0],
    rdv_time: '09:00',
    rdv_type: 'decouverte',
    rdv_location: 'leurs_locaux',
    rdv_address: '',
    contact_id: null,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    conducted_by: '',
    status: 'prevu',
    notes: '',
    next_action: '',
    next_action_date: ''
  })

  useEffect(() => {
    loadClients()
    if (!isNew) {
      loadRdv()
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
        next_action_date: data.next_action_date || ''
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

    setSaving(true)
    try {
      if (isNew) {
        const { data, error } = await supabase
          .from('prospect_rdv')
          .insert([formData])
          .select()
          .single()

        if (error) throw error
        toast.success('RDV créé')
        navigate(`/prospection/${data.id}`)
      } else {
        const { error } = await supabase
          .from('prospect_rdv')
          .update(formData)
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
