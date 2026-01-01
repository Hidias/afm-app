import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { supabase, uploadFile } from '../lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Users, Plus, Trash2, Upload, FileText } from 'lucide-react'

export default function TrainerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { trainers, loadTrainers } = useStore()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    specialties: '',
    bio: ''
  })
  const [certificates, setCertificates] = useState([])
  const [newCert, setNewCert] = useState({
    name: '',
    issuer: '',
    obtained_at: '',
    expires_at: ''
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (isEdit) {
      loadTrainerData()
    }
  }, [id, isEdit])

  const loadTrainerData = async () => {
    const trainer = trainers.find(t => t.id === id)
    if (trainer) {
      setForm({
        first_name: trainer.first_name || '',
        last_name: trainer.last_name || '',
        email: trainer.email || '',
        phone: trainer.phone || '',
        specialties: trainer.specialties || '',
        bio: trainer.bio || ''
      })
    }
    
    // Charger les certificats
    const { data } = await supabase
      .from('trainer_certificates')
      .select('*')
      .eq('trainer_id', id)
      .order('obtained_at', { ascending: false })
    
    if (data) setCertificates(data)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleCertChange = (e) => {
    const { name, value } = e.target
    setNewCert(prev => ({ ...prev, [name]: value }))
  }

  const addCertificate = async () => {
    if (!newCert.name.trim()) {
      toast.error('Le nom du certificat est requis')
      return
    }

    if (!isEdit) {
      // En création, on stocke localement
      setCertificates(prev => [...prev, { ...newCert, id: Date.now(), temp: true }])
      setNewCert({ name: '', issuer: '', obtained_at: '', expires_at: '' })
      return
    }

    // En édition, on sauvegarde directement
    try {
      const { error } = await supabase
        .from('trainer_certificates')
        .insert([{ ...newCert, trainer_id: id }])
      
      if (error) throw error
      
      toast.success('Certificat ajouté')
      setNewCert({ name: '', issuer: '', obtained_at: '', expires_at: '' })
      loadTrainerData()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const removeCertificate = async (certId, isTemp) => {
    if (isTemp) {
      setCertificates(prev => prev.filter(c => c.id !== certId))
      return
    }

    if (!confirm('Supprimer ce certificat ?')) return

    try {
      const { error } = await supabase
        .from('trainer_certificates')
        .delete()
        .eq('id', certId)
      
      if (error) throw error
      
      toast.success('Certificat supprimé')
      loadTrainerData()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const uploadCertDocument = async (certId, file) => {
    setUploading(true)
    try {
      const path = `certificates/${id}/${Date.now()}_${file.name}`
      const url = await uploadFile('documents', path, file)
      
      const { error } = await supabase
        .from('trainer_certificates')
        .update({ document_url: url })
        .eq('id', certId)
      
      if (error) throw error
      
      toast.success('Document uploadé')
      loadTrainerData()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setUploading(false)
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
      let trainerId = id

      if (isEdit) {
        const { error } = await supabase
          .from('trainers')
          .update(form)
          .eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('trainers')
          .insert([form])
          .select()
          .single()
        if (error) throw error
        trainerId = data.id

        // Sauvegarder les certificats temporaires
        const tempCerts = certificates.filter(c => c.temp)
        if (tempCerts.length > 0) {
          const certsToInsert = tempCerts.map(c => ({
            trainer_id: trainerId,
            name: c.name,
            issuer: c.issuer,
            obtained_at: c.obtained_at || null,
            expires_at: c.expires_at || null
          }))
          await supabase.from('trainer_certificates').insert(certsToInsert)
        }
      }

      toast.success(isEdit ? 'Formateur mis à jour' : 'Formateur créé')
      await loadTrainers()
      navigate('/formateurs')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const isExpiringSoon = (date) => {
    if (!date) return false
    const expiry = new Date(date)
    const now = new Date()
    const threeMonths = 90 * 24 * 60 * 60 * 1000
    return expiry - now < threeMonths && expiry > now
  }

  const isExpired = (date) => {
    if (!date) return false
    return new Date(date) < new Date()
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/formateurs')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Retour aux formateurs
      </button>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <Users className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Modifier le formateur' : 'Nouveau formateur'}
            </h1>
            <p className="text-sm text-gray-500">Informations et certifications</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Informations personnelles</h3>
            
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Spécialités</label>
              <input
                type="text"
                name="specialties"
                value={form.specialties}
                onChange={handleChange}
                placeholder="SST, Habilitation électrique, Gestes et postures..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Biographie</label>
              <textarea
                name="bio"
                value={form.bio}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Certificats */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Certificats & Habilitations (Qualiopi Ind. 17, 21)</h3>
            
            <div className="grid grid-cols-4 gap-2">
              <input
                type="text"
                name="name"
                value={newCert.name}
                onChange={handleCertChange}
                placeholder="Nom du certificat"
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="text"
                name="issuer"
                value={newCert.issuer}
                onChange={handleCertChange}
                placeholder="Organisme"
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="date"
                name="obtained_at"
                value={newCert.obtained_at}
                onChange={handleCertChange}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  name="expires_at"
                  value={newCert.expires_at}
                  onChange={handleCertChange}
                  placeholder="Expiration"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                <button type="button" onClick={addCertificate} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {certificates.length > 0 && (
              <div className="space-y-2">
                {certificates.map((cert) => (
                  <div 
                    key={cert.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isExpired(cert.expires_at) ? 'bg-red-50 border-red-200' :
                      isExpiringSoon(cert.expires_at) ? 'bg-orange-50 border-orange-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium">{cert.name}</div>
                      <div className="text-sm text-gray-500">
                        {cert.issuer && <span>{cert.issuer} • </span>}
                        {cert.obtained_at && <span>Obtenu le {new Date(cert.obtained_at).toLocaleDateString('fr-FR')}</span>}
                        {cert.expires_at && (
                          <span className={isExpired(cert.expires_at) ? 'text-red-600 font-medium' : ''}>
                            {' '}• Expire le {new Date(cert.expires_at).toLocaleDateString('fr-FR')}
                            {isExpired(cert.expires_at) && ' (EXPIRÉ)'}
                            {isExpiringSoon(cert.expires_at) && !isExpired(cert.expires_at) && ' (Bientôt)'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {isEdit && !cert.temp && (
                      <>
                        {cert.document_url ? (
                          <a href={cert.document_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            Voir document
                          </a>
                        ) : (
                          <label className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs cursor-pointer hover:bg-gray-200">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => e.target.files[0] && uploadCertDocument(cert.id, e.target.files[0])}
                              disabled={uploading}
                            />
                            <Upload className="h-3 w-3 inline mr-1" />
                            {uploading ? 'Upload...' : 'Joindre'}
                          </label>
                        )}
                      </>
                    )}
                    
                    <button 
                      type="button" 
                      onClick={() => removeCertificate(cert.id, cert.temp)} 
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate('/formateurs')}
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
              {saving ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Créer le formateur')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
