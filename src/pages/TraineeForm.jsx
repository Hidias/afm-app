import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase, uploadFile } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, User, Upload, Trash2, FileText } from 'lucide-react'

export default function TraineeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { trainees, clients, loadTrainees } = useStore()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    birth_place: '',
    address: '',
    postal_code: '',
    city: '',
    social_security_number: '',
    client_id: '',
    job_title: ''
  })
  const [documents, setDocuments] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (isEdit) {
      loadTraineeData()
    }
  }, [id, isEdit])

  const loadTraineeData = async () => {
    const trainee = trainees.find(t => t.id === id)
    if (trainee) {
      setForm({
        first_name: trainee.first_name || '',
        last_name: trainee.last_name || '',
        email: trainee.email || '',
        phone: trainee.phone || '',
        birth_date: trainee.birth_date || '',
        birth_place: trainee.birth_place || '',
        address: trainee.address || '',
        postal_code: trainee.postal_code || '',
        city: trainee.city || '',
        social_security_number: trainee.social_security_number || '',
        client_id: trainee.client_id || '',
        job_title: trainee.job_title || ''
      })
    }
    
    // Charger les documents
    const { data } = await supabase
      .from('trainee_documents')
      .select('*')
      .eq('trainee_id', id)
      .order('created_at', { ascending: false })
    
    if (data) setDocuments(data)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const uploadDocument = async (category, file) => {
    if (!isEdit) {
      toast.error('Enregistrez d\'abord le stagiaire avant d\'ajouter des documents')
      return
    }

    setUploading(true)
    try {
      const path = `trainees/${id}/${Date.now()}_${file.name}`
      const url = await uploadFile('documents', path, file)
      
      const { error } = await supabase
        .from('trainee_documents')
        .insert([{
          trainee_id: id,
          category,
          name: file.name,
          url
        }])
      
      if (error) throw error
      
      toast.success('Document uploadé')
      loadTraineeData()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteDocument = async (docId) => {
    if (!confirm('Supprimer ce document ?')) return

    try {
      const { error } = await supabase
        .from('trainee_documents')
        .delete()
        .eq('id', docId)
      
      if (error) throw error
      
      toast.success('Document supprimé')
      loadTraineeData()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('Le nom et prénom sont requis')
      return
    }

    setSaving(true)
    try {
      const data = {
        ...form,
        client_id: form.client_id || null,
        birth_date: form.birth_date || null
      }

      if (isEdit) {
        const { error } = await supabase
          .from('trainees')
          .update(data)
          .eq('id', id)
        if (error) throw error
        toast.success('Stagiaire mis à jour')
      } else {
        const { error } = await supabase
          .from('trainees')
          .insert([data])
        if (error) throw error
        toast.success('Stagiaire créé')
      }
      
      await loadTrainees()
      navigate('/stagiaires')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const docCategories = [
    { id: 'CV', label: 'CV' },
    { id: 'Diplôme', label: 'Diplôme' },
    { id: 'Autre', label: 'Autre document' }
  ]

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/stagiaires')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Retour aux stagiaires
      </button>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <User className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Modifier le stagiaire' : 'Nouveau stagiaire'}
            </h1>
            <p className="text-sm text-gray-500">Informations personnelles et documents</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Identité</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
                <input
                  type="date"
                  name="birth_date"
                  value={form.birth_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de naissance</label>
                <input
                  type="text"
                  name="birth_place"
                  value={form.birth_place}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° Sécurité Sociale</label>
              <input
                type="text"
                name="social_security_number"
                value={form.social_security_number}
                onChange={handleChange}
                placeholder="1 23 45 67 890 123 45"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Coordonnées */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Coordonnées</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                <input
                  type="text"
                  name="postal_code"
                  value={form.postal_code}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Entreprise */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Entreprise</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise</label>
                <select
                  name="client_id"
                  value={form.client_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Aucune</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fonction</label>
                <input
                  type="text"
                  name="job_title"
                  value={form.job_title}
                  onChange={handleChange}
                  placeholder="Technicien, Manager..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Documents */}
          {isEdit && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Documents</h3>
              <p className="text-sm text-gray-500">CV, diplômes et autres documents (pas de pièce d'identité)</p>
              
              <div className="flex gap-2">
                {docCategories.map(cat => (
                  <label 
                    key={cat.id}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 inline-flex items-center gap-2"
                  >
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => e.target.files[0] && uploadDocument(cat.id, e.target.files[0])}
                      disabled={uploading}
                    />
                    <Upload className="h-4 w-4" />
                    {uploading ? 'Upload...' : `Ajouter ${cat.label}`}
                  </label>
                ))}
              </div>

              {documents.length > 0 && (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-sm text-gray-500">{doc.category}</div>
                      </div>
                      <a 
                        href={doc.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                      >
                        Voir
                      </a>
                      <button 
                        type="button"
                        onClick={() => deleteDocument(doc.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate('/stagiaires')}
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
              {saving ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Créer le stagiaire')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
