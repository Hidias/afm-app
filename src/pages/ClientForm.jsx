import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Building2 } from 'lucide-react'

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clients, loadClients } = useStore()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    name: '',
    address: '',
    postal_code: '',
    city: '',
    siret: '',
    contact_name: '',
    contact_function: '',
    contact_email: '',
    contact_phone: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit) {
      const client = clients.find(c => c.id === id)
      if (client) {
        setForm({
          name: client.name || '',
          address: client.address || '',
          postal_code: client.postal_code || '',
          city: client.city || '',
          siret: client.siret || '',
          contact_name: client.contact_name || '',
          contact_function: client.contact_function || '',
          contact_email: client.contact_email || '',
          contact_phone: client.contact_phone || ''
        })
      }
    }
  }, [id, clients, isEdit])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Le nom du client est requis')
      return
    }

    setSaving(true)
    try {
      if (isEdit) {
        const { error } = await supabase
          .from('clients')
          .update(form)
          .eq('id', id)
        if (error) throw error
        toast.success('Client mis à jour')
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([form])
        if (error) throw error
        toast.success('Client créé')
      }
      await loadClients()
      navigate('/clients')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate('/clients')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Retour aux clients
      </button>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Modifier le client' : 'Nouveau client'}
            </h1>
            <p className="text-sm text-gray-500">Informations de l'entreprise cliente</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations société */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Informations société</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l'entreprise *
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse
              </label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code postal
                </label>
                <input
                  type="text"
                  name="postal_code"
                  value={form.postal_code}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ville
                </label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                N° SIRET
              </label>
              <input
                type="text"
                name="siret"
                value={form.siret}
                onChange={handleChange}
                placeholder="12345678901234"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Contact principal</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du contact
                </label>
                <input
                  type="text"
                  name="contact_name"
                  value={form.contact_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fonction
                </label>
                <input
                  type="text"
                  name="contact_function"
                  value={form.contact_function}
                  onChange={handleChange}
                  placeholder="DRH, Responsable formation..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="contact_email"
                  value={form.contact_email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  name="contact_phone"
                  value={form.contact_phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate('/clients')}
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
              {saving ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Créer le client')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
