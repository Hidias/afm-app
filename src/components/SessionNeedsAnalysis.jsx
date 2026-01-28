import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FileCheck, Printer, Download, Save, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { downloadNeedsAnalysisPDF } from '../lib/needsAnalysisPDF'

const CONTEXT_REASONS = [
  { value: 'reglementation', label: 'Réglementation / Obligations légales' },
  { value: 'accident', label: 'Suite à un accident / incident' },
  { value: 'renouvellement', label: 'Renouvellement de certificats' },
  { value: 'nouveaux_embauches', label: 'Nouveaux embauchés' },
  { value: 'evolution_risques', label: 'Évolution des risques' },
  { value: 'autre', label: 'Autre (préciser)' }
]

const PROFILES = [
  { value: 'administratif', label: 'Administratif' },
  { value: 'production', label: 'Production' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'encadrement', label: 'Encadrement' }
]

export default function SessionNeedsAnalysis({ session, organization }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    context_reasons: [],
    context_other: '',
    context_stakes: '',
    objectives_description: '',
    objectives_measurable: '',
    participants_count: '',
    participants_profiles: [],
    prerequisites_validated: null,
    level: '',
    particularities_psh: '',
    particularities_non_french: false,
    particularities_other: '',
    location_type: '',
    location_client_address: '',
    preferred_schedule: '',
    preferred_dates: '',
    company_equipment: null,
    company_equipment_details: '',
    ppe_provided: null,
    other_constraints: ''
  })

  useEffect(() => {
    if (session) {
      loadAnalysis()
    }
  }, [session])

  const loadAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from('session_needs_analysis')
        .select('*')
        .eq('session_id', session.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setAnalysis(data)
        setFormData({
          context_reasons: data.context_reasons || [],
          context_other: data.context_other || '',
          context_stakes: data.context_stakes || '',
          objectives_description: data.objectives_description || '',
          objectives_measurable: data.objectives_measurable || '',
          participants_count: data.participants_count || '',
          participants_profiles: data.participants_profiles || [],
          prerequisites_validated: data.prerequisites_validated,
          level: data.level || '',
          particularities_psh: data.particularities_psh || '',
          particularities_non_french: data.particularities_non_french || false,
          particularities_other: data.particularities_other || '',
          location_type: data.location_type || '',
          location_client_address: data.location_client_address || '',
          preferred_schedule: data.preferred_schedule || '',
          preferred_dates: data.preferred_dates || '',
          company_equipment: data.company_equipment,
          company_equipment_details: data.company_equipment_details || '',
          ppe_provided: data.ppe_provided,
          other_constraints: data.other_constraints || ''
        })
      }
    } catch (error) {
      console.error('Erreur chargement analyse:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      
      const dataToSave = {
        ...formData,
        session_id: session.id,
        filled_by: userData?.user?.id,
        filled_at: new Date().toISOString()
      }

      if (analysis) {
        const { error } = await supabase
          .from('session_needs_analysis')
          .update(dataToSave)
          .eq('id', analysis.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('session_needs_analysis')
          .insert([dataToSave])

        if (error) throw error
      }

      toast.success('Analyse du besoin enregistrée')
      await loadAnalysis()
      setShowForm(false)
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleCheckbox = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }))
  }

  const handlePrintBlank = () => {
    downloadNeedsAnalysisPDF(session, null, true, organization)
  }

  const handlePrintFilled = () => {
    if (!analysis) {
      toast.error('Veuillez d\'abord remplir l\'analyse')
      return
    }
    downloadNeedsAnalysisPDF(session, analysis, false, organization)
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Chargement...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header avec boutons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">Analyse du besoin</h3>
          {analysis ? (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Complétée
            </span>
          ) : (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              À remplir
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrintBlank}
            className="btn btn-sm btn-secondary flex items-center gap-1"
          >
            <Printer className="w-4 h-4" />
            Imprimer vierge
          </button>
          
          {analysis && (
            <button
              onClick={handlePrintFilled}
              className="btn btn-sm btn-secondary flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Télécharger PDF
            </button>
          )}

          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-sm btn-primary flex items-center gap-1"
          >
            <FileCheck className="w-4 h-4" />
            {showForm ? 'Masquer' : analysis ? 'Modifier' : 'Remplir'}
          </button>
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="border rounded-lg p-6 space-y-6 bg-white">
          {/* Section 1 : Contexte et enjeux */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg border-b pb-2">1. Contexte et enjeux</h4>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Pourquoi cette formation maintenant ?
              </label>
              <div className="space-y-2">
                {CONTEXT_REASONS.map(reason => (
                  <label key={reason.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.context_reasons.includes(reason.value)}
                      onChange={() => handleCheckbox('context_reasons', reason.value)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">{reason.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {formData.context_reasons.includes('autre') && (
              <div>
                <label className="block text-sm font-medium mb-1">Précisez :</label>
                <input
                  type="text"
                  value={formData.context_other}
                  onChange={(e) => setFormData({ ...formData, context_other: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Autre raison..."
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                Enjeux spécifiques
                <span className="text-xs text-gray-500 ml-2">(Quels sont les enjeux pour l'entreprise ?)</span>
              </label>
              <textarea
                value={formData.context_stakes}
                onChange={(e) => setFormData({ ...formData, context_stakes: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ex: Réduire les accidents du travail, Mise en conformité réglementaire..."
              />
            </div>
          </div>

          {/* Section 2 : Objectifs attendus */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg border-b pb-2">2. Objectifs attendus</h4>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Que souhaitez-vous que les stagiaires sachent faire à l'issue ?
              </label>
              <textarea
                value={formData.objectives_description}
                onChange={(e) => setFormData({ ...formData, objectives_description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ex: Être capable de porter secours à une victime, Savoir utiliser un extincteur..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Résultats mesurables attendus
                <span className="text-xs text-gray-500 ml-2">(Comment mesurerez-vous l'efficacité ?)</span>
              </label>
              <textarea
                value={formData.objectives_measurable}
                onChange={(e) => setFormData({ ...formData, objectives_measurable: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ex: 100% des participants certifiés, Réduction de 50% des incidents..."
              />
            </div>
          </div>

          {/* Section 3 : Public concerné */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg border-b pb-2">3. Public concerné</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre de participants</label>
                <input
                  type="number"
                  value={formData.participants_count}
                  onChange={(e) => setFormData({ ...formData, participants_count: parseInt(e.target.value) || '' })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: 12"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Niveau</label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Sélectionner</option>
                  <option value="debutant">Débutant</option>
                  <option value="intermediaire">Intermédiaire</option>
                  <option value="avance">Avancé</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Profils des participants</label>
              <div className="grid grid-cols-2 gap-2">
                {PROFILES.map(profile => (
                  <label key={profile.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.participants_profiles.includes(profile.value)}
                      onChange={() => handleCheckbox('participants_profiles', profile.value)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">{profile.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Prérequis déjà validés ?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.prerequisites_validated === true}
                    onChange={() => setFormData({ ...formData, prerequisites_validated: true })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Oui</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.prerequisites_validated === false}
                    onChange={() => setFormData({ ...formData, prerequisites_validated: false })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Non</span>
                </label>
              </div>
            </div>

            <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-medium">Particularités</label>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">PSH (Personnes en Situation de Handicap)</label>
                <input
                  type="text"
                  value={formData.particularities_psh}
                  onChange={(e) => setFormData({ ...formData, particularities_psh: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Précisez les adaptations nécessaires..."
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.particularities_non_french}
                  onChange={(e) => setFormData({ ...formData, particularities_non_french: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Public non francophone</span>
              </label>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Autres particularités</label>
                <input
                  type="text"
                  value={formData.particularities_other}
                  onChange={(e) => setFormData({ ...formData, particularities_other: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Autres particularités..."
                />
              </div>
            </div>
          </div>

          {/* Section 4 : Contraintes et moyens */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg border-b pb-2">4. Contraintes et moyens</h4>
            
            <div>
              <label className="block text-sm font-medium mb-2">Lieu de formation</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.location_type === 'access_formation'}
                    onChange={() => setFormData({ ...formData, location_type: 'access_formation' })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Dans nos locaux (Access Formation)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.location_type === 'client'}
                    onChange={() => setFormData({ ...formData, location_type: 'client' })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Chez le client</span>
                </label>
              </div>

              {formData.location_type === 'client' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={formData.location_client_address}
                    onChange={(e) => setFormData({ ...formData, location_client_address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Adresse complète..."
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Horaires souhaités</label>
                <input
                  type="text"
                  value={formData.preferred_schedule}
                  onChange={(e) => setFormData({ ...formData, preferred_schedule: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: 9h-17h"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Dates préférentielles</label>
                <input
                  type="text"
                  value={formData.preferred_dates}
                  onChange={(e) => setFormData({ ...formData, preferred_dates: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: Semaine du 15/02"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Matériel spécifique entreprise</label>
              <div className="flex gap-4 mb-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.company_equipment === true}
                    onChange={() => setFormData({ ...formData, company_equipment: true })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Oui</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.company_equipment === false}
                    onChange={() => setFormData({ ...formData, company_equipment: false })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Non</span>
                </label>
              </div>

              {formData.company_equipment && (
                <input
                  type="text"
                  value={formData.company_equipment_details}
                  onChange={(e) => setFormData({ ...formData, company_equipment_details: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Précisez le matériel..."
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Équipements de protection fournis</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.ppe_provided === true}
                    onChange={() => setFormData({ ...formData, ppe_provided: true })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Oui</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.ppe_provided === false}
                    onChange={() => setFormData({ ...formData, ppe_provided: false })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Non</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Autres contraintes</label>
              <textarea
                value={formData.other_constraints}
                onChange={(e) => setFormData({ ...formData, other_constraints: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ex: Contraintes d'accès, besoins spécifiques..."
              />
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setShowForm(false)}
              className="btn btn-secondary"
              disabled={saving}
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Résumé compact si rempli et formulaire masqué */}
      {!showForm && analysis && (
        <div className="border rounded-lg p-4 bg-gray-50 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">Participants :</span> {analysis.participants_count || 'N/A'}
            </div>
            <div>
              <span className="font-medium">Lieu :</span> {
                analysis.location_type === 'client' ? 'Chez le client' : 'Access Formation'
              }
            </div>
          </div>
          {analysis.filled_at && (
            <div className="mt-2 text-xs text-gray-500">
              Remplie le {new Date(analysis.filled_at).toLocaleDateString('fr-FR')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
