import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Building2, Users, FileCheck, ChevronRight, ChevronLeft, Search, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useStore from '../lib/store'
import toast from 'react-hot-toast'

const FUNDING_TYPES = [
  { value: 'none', label: 'Aucun (pas de mention)' },
  { value: 'opco', label: 'OPCO' },
  { value: 'cpf', label: 'CPF' },
  { value: 'faf', label: 'FAF' },
  { value: 'region', label: 'Région' },
  { value: 'france_travail', label: 'France Travail' },
  { value: 'ptp', label: 'PTP' },
  { value: 'fne', label: 'FNE' },
  { value: 'direct', label: 'Financement direct' },
  { value: 'other', label: 'Autre' },
]

const EMPTY_GROUP = () => ({
  id: crypto.randomUUID(),
  company_name: '',
  siret: '',
  address: '',
  postal_code: '',
  city: '',
  matched_client: null, // Client existant trouvé par SIRET
  trainees: [EMPTY_TRAINEE()],
})

const EMPTY_TRAINEE = () => ({
  id: crypto.randomUUID(),
  last_name: '',
  first_name: '',
  birth_date: '',
  birth_place: '',
  social_security_number: '',
  gender: 'male',
  matched_trainee: null, // Stagiaire existant trouvé
})

export default function MultiSiretWizard({ onClose, onCreated }) {
  const { courses, trainers, clients, trainees: allTrainees, fetchSessions, fetchClients, fetchTrainees } = useStore()
  
  const [step, setStep] = useState(1)
  const [creating, setCreating] = useState(false)
  const [creationLog, setCreationLog] = useState([])
  
  // Step 1: Common session info
  const [common, setCommon] = useState({
    course_id: '',
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '17:00',
    location: '',
    trainer_id: '',
    is_intra: false,
    funding_type: 'none',
    funding_details: '',
    signatory_name: '',
    signatory_role: '',
    contact_name: '',
    contact_role: '',
    contact_email: '',
    contact_phone: '',
  })
  
  // Step 2: Groups (one per SIRET)
  const [groups, setGroups] = useState([EMPTY_GROUP()])
  
  // Auto-set end_date when start_date changes (1 jour par défaut)
  useEffect(() => {
    if (common.start_date && !common.end_date) {
      setCommon(c => ({ ...c, end_date: c.start_date }))
    }
  }, [common.start_date])
  
  // ──────────────────────────────────────────────
  // SIRET auto-match
  // ──────────────────────────────────────────────
  const handleSiretChange = (groupIdx, siret) => {
    const updated = [...groups]
    updated[groupIdx].siret = siret
    
    // Chercher client existant par SIRET (nettoyé)
    const cleanSiret = siret.replace(/\s/g, '')
    if (cleanSiret.length >= 9) {
      const found = clients.find(c => c.siret && c.siret.replace(/\s/g, '') === cleanSiret)
      if (found) {
        updated[groupIdx].matched_client = found
        updated[groupIdx].company_name = found.name || ''
        updated[groupIdx].address = found.address || ''
        updated[groupIdx].postal_code = found.postal_code || ''
        updated[groupIdx].city = found.city || ''
      } else {
        updated[groupIdx].matched_client = null
      }
    } else {
      updated[groupIdx].matched_client = null
    }
    
    setGroups(updated)
  }
  
  // Trainee auto-match by last_name
  const handleTraineeNameChange = (groupIdx, traineeIdx, field, value) => {
    const updated = [...groups]
    updated[groupIdx].trainees[traineeIdx][field] = value
    
    // Auto-match quand on a nom + prénom
    const t = updated[groupIdx].trainees[traineeIdx]
    if (t.last_name.length >= 2 && t.first_name.length >= 2) {
      const found = allTrainees.find(at => 
        at.last_name?.toLowerCase() === t.last_name.toLowerCase() &&
        at.first_name?.toLowerCase() === t.first_name.toLowerCase()
      )
      if (found) {
        updated[groupIdx].trainees[traineeIdx].matched_trainee = found
        // Auto-fill empty fields
        if (!t.birth_date && found.birth_date) updated[groupIdx].trainees[traineeIdx].birth_date = found.birth_date?.split('T')[0] || ''
        if (!t.social_security_number && found.social_security_number) updated[groupIdx].trainees[traineeIdx].social_security_number = found.social_security_number
        if (!t.gender && found.gender) updated[groupIdx].trainees[traineeIdx].gender = found.gender
      } else {
        updated[groupIdx].trainees[traineeIdx].matched_trainee = null
      }
    }
    
    setGroups(updated)
  }
  
  // ──────────────────────────────────────────────
  // Group management
  // ──────────────────────────────────────────────
  const addGroup = () => setGroups([...groups, EMPTY_GROUP()])
  
  const removeGroup = (idx) => {
    if (groups.length <= 1) return
    setGroups(groups.filter((_, i) => i !== idx))
  }
  
  const addTrainee = (groupIdx) => {
    const updated = [...groups]
    updated[groupIdx].trainees.push(EMPTY_TRAINEE())
    setGroups(updated)
  }
  
  const removeTrainee = (groupIdx, traineeIdx) => {
    const updated = [...groups]
    if (updated[groupIdx].trainees.length <= 1) return
    updated[groupIdx].trainees = updated[groupIdx].trainees.filter((_, i) => i !== traineeIdx)
    setGroups(updated)
  }
  
  // ──────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────
  const validateStep1 = () => {
    if (!common.course_id) return 'Sélectionnez une formation'
    if (!common.start_date) return 'Date de début requise'
    if (!common.end_date) return 'Date de fin requise'
    if (!common.funding_type) return 'Type de financement requis'
    return null
  }
  
  const validateStep2 = () => {
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]
      if (!g.company_name) return `Groupe ${i + 1}: Raison sociale requise`
      if (!g.siret) return `Groupe ${i + 1}: SIRET requis`
      for (let j = 0; j < g.trainees.length; j++) {
        if (!g.trainees[j].last_name || !g.trainees[j].first_name) {
          return `Groupe ${i + 1}, Stagiaire ${j + 1}: Nom et prénom requis`
        }
      }
    }
    return null
  }
  
  const handleNext = () => {
    if (step === 1) {
      const err = validateStep1()
      if (err) return toast.error(err)
      setStep(2)
    } else if (step === 2) {
      const err = validateStep2()
      if (err) return toast.error(err)
      setStep(3)
    }
  }
  
  // ──────────────────────────────────────────────
  // CREATION
  // ──────────────────────────────────────────────
  const handleCreate = async () => {
    setCreating(true)
    setCreationLog([])
    const log = (msg, ok = true) => setCreationLog(prev => [...prev, { msg, ok }])
    
    try {
      const selectedCourse = courses.find(c => c.id === common.course_id)
      
      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi]
        const groupLabel = `${group.company_name} (${group.siret})`
        
        // 1. Client: trouver ou créer
        let clientId = group.matched_client?.id
        if (!clientId) {
          const { data: newClient, error: clientErr } = await supabase
            .from('clients')
            .insert([{
              name: group.company_name,
              siret: group.siret,
              address: group.address || null,
              postal_code: group.postal_code || null,
              city: group.city || null,
              contact_name: common.contact_name || null,
              contact_function: common.contact_role || null,
              contact_email: common.contact_email || null,
              contact_phone: common.contact_phone || null,
              status: 'active',
            }])
            .select()
            .single()
          
          if (clientErr) {
            log(`❌ Erreur création client ${groupLabel}: ${clientErr.message}`, false)
            continue
          }
          clientId = newClient.id
          log(`✅ Client créé: ${groupLabel}`)
        } else {
          log(`🔗 Client existant: ${groupLabel}`)
        }
        
        // 2. Contact: ajouter si renseigné et pas déjà présent
        let contactId = null
        if (common.contact_name) {
          // Vérifier si ce contact existe déjà pour ce client
          const { data: existingContacts } = await supabase
            .from('client_contacts')
            .select('*')
            .eq('client_id', clientId)
            .ilike('name', common.contact_name)
          
          if (existingContacts && existingContacts.length > 0) {
            contactId = existingContacts[0].id
            log(`🔗 Contact existant: ${common.contact_name}`)
          } else {
            const { data: newContact, error: contactErr } = await supabase
              .from('client_contacts')
              .insert([{
                client_id: clientId,
                name: common.contact_name,
                role: common.contact_role || null,
                email: common.contact_email || null,
                phone: common.contact_phone || null,
                is_primary: true,
              }])
              .select()
              .single()
            
            if (!contactErr && newContact) {
              contactId = newContact.id
              log(`✅ Contact ajouté: ${common.contact_name} → ${group.company_name}`)
            }
          }
        }
        
        // 3. Stagiaires: trouver ou créer
        const traineeIds = []
        for (const t of group.trainees) {
          if (t.matched_trainee?.id) {
            traineeIds.push(t.matched_trainee.id)
            // Mettre à jour le client_id si différent
            if (t.matched_trainee.client_id !== clientId) {
              await supabase.from('trainees').update({ client_id: clientId }).eq('id', t.matched_trainee.id)
            }
            log(`🔗 Stagiaire existant: ${t.first_name} ${t.last_name}`)
          } else {
            const traineeData = {
              first_name: t.first_name,
              last_name: t.last_name,
              birth_date: t.birth_date || null,
              birth_place: t.birth_place || null,
              social_security_number: t.social_security_number || null,
              gender: t.gender || 'male',
              client_id: clientId,
            }
            const { data: newTrainee, error: traineeErr } = await supabase
              .from('trainees')
              .insert([traineeData])
              .select()
              .single()
            
            if (traineeErr) {
              log(`❌ Erreur stagiaire ${t.first_name} ${t.last_name}: ${traineeErr.message}`, false)
              continue
            }
            traineeIds.push(newTrainee.id)
            log(`✅ Stagiaire créé: ${t.first_name} ${t.last_name}`)
          }
        }
        
        // 4. Session: créer
        const reference = `SES-${Date.now().toString(36).toUpperCase()}-${gi + 1}`
        const generateHexToken = (bytes = 32) => {
          const arr = new Uint8Array(bytes)
          crypto.getRandomValues(arr)
          return [...arr].map(b => b.toString(16).padStart(2, '0')).join('')
        }
        
        const sessionData = {
          course_id: common.course_id,
          client_id: clientId,
          contact_id: contactId,
          trainer_id: common.trainer_id || null,
          start_date: common.start_date,
          end_date: common.end_date,
          start_time: common.start_time,
          end_time: common.end_time,
          location_name: common.location || null,
          is_intra: common.is_intra,
          status: 'planned',
          signatory_name: common.signatory_name || null,
          signatory_role: common.signatory_role || null,
          funding_type: common.funding_type || 'none',
          funding_details: common.funding_details || null,
          reference,
          attendance_token: generateHexToken(32),
        }
        
        const { data: newSession, error: sessionErr } = await supabase
          .from('sessions')
          .insert([sessionData])
          .select()
          .single()
        
        if (sessionErr) {
          log(`❌ Erreur session ${groupLabel}: ${sessionErr.message}`, false)
          continue
        }
        
        // 5. Inscrire les stagiaires
        if (traineeIds.length > 0) {
          const { error: stErr } = await supabase
            .from('session_trainees')
            .insert(traineeIds.map(tid => ({
              session_id: newSession.id,
              trainee_id: tid,
              registration_date: new Date().toISOString(),
            })))
          
          if (stErr) {
            log(`⚠️ Erreur inscription stagiaires ${groupLabel}: ${stErr.message}`, false)
          }
        }
        
        log(`✅ Session créée: ${selectedCourse?.title} — ${group.company_name} (${traineeIds.length} stagiaires)`)
      }
      
      log(`🎉 Terminé ! ${groups.length} sessions créées`)
      
      // Rafraîchir les données
      await Promise.all([fetchSessions(), fetchClients(), fetchTrainees()])
      
    } catch (err) {
      log(`❌ Erreur inattendue: ${err.message}`, false)
    }
    
    setCreating(false)
  }
  
  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  const selectedCourse = courses.find(c => c.id === common.course_id)
  const totalTrainees = groups.reduce((sum, g) => sum + g.trainees.length, 0)
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-full flex items-start justify-center p-4 pt-8">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                Session multi-SIRET
              </h2>
              <p className="text-sm text-gray-500">Créer plusieurs sessions pour des entreprises d'un même groupe</p>
            </div>
            <button onClick={onClose}><X className="w-5 h-5" /></button>
          </div>
          
          {/* Step indicators */}
          <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b">
            {[
              { n: 1, label: 'Formation', icon: FileCheck },
              { n: 2, label: 'Entreprises & Stagiaires', icon: Building2 },
              { n: 3, label: 'Récapitulatif', icon: CheckCircle },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-4 h-4 text-gray-300" />}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  step === s.n ? 'bg-purple-100 text-purple-700' : 
                  step > s.n ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  <s.icon className="w-4 h-4" />
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-6">
            
            {/* ═══════════════════ STEP 1: Formation ═══════════════════ */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="label">Formation *</label>
                    <select className="input" value={common.course_id} onChange={e => setCommon({...common, course_id: e.target.value})}>
                      <option value="">Sélectionner...</option>
                      {courses.filter(c => c.is_active !== false).map(c => (
                        <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.title}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="label">Date début *</label>
                    <input type="date" className="input" value={common.start_date} onChange={e => setCommon({...common, start_date: e.target.value, end_date: common.end_date || e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Date fin *</label>
                    <input type="date" className="input" value={common.end_date} onChange={e => setCommon({...common, end_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Heure début</label>
                    <input type="time" className="input" value={common.start_time} onChange={e => setCommon({...common, start_time: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Heure fin</label>
                    <input type="time" className="input" value={common.end_time} onChange={e => setCommon({...common, end_time: e.target.value})} />
                  </div>
                  
                  <div>
                    <label className="label">Lieu</label>
                    <input type="text" className="input" value={common.location} onChange={e => setCommon({...common, location: e.target.value})} placeholder="Ex: Intersport Concarneau" />
                  </div>
                  <div>
                    <label className="label">Formateur</label>
                    <select className="input" value={common.trainer_id} onChange={e => setCommon({...common, trainer_id: e.target.value})}>
                      <option value="">-- Non assigné --</option>
                      {trainers.map(t => (
                        <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="label">Financement *</label>
                    <select className="input" value={common.funding_type} onChange={e => setCommon({...common, funding_type: e.target.value})}>
                      {FUNDING_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Précisions financement</label>
                    <input type="text" className="input" value={common.funding_details} onChange={e => setCommon({...common, funding_details: e.target.value})} placeholder="Ex: OPCO Atlas..." />
                  </div>
                </div>
                
                {/* Signataire commun */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <p className="font-medium text-amber-800 text-sm">✍️ Signataire des conventions (commun à toutes les entreprises)</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Nom du signataire</label>
                      <input type="text" className="input" value={common.signatory_name} onChange={e => setCommon({...common, signatory_name: e.target.value})} placeholder="Ex: Frédéric LE REGENT" />
                    </div>
                    <div>
                      <label className="label text-xs">Fonction</label>
                      <input type="text" className="input" value={common.signatory_role} onChange={e => setCommon({...common, signatory_role: e.target.value})} placeholder="Ex: Dirigeant" />
                    </div>
                  </div>
                </div>
                
                {/* Contact commun */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <p className="font-medium text-blue-800 text-sm">📧 Contact opérationnel (convocations — ajouté à chaque entreprise)</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Nom du contact</label>
                      <input type="text" className="input" value={common.contact_name} onChange={e => setCommon({...common, contact_name: e.target.value})} placeholder="Ex: Aénor POUCH LEDUC" />
                    </div>
                    <div>
                      <label className="label text-xs">Fonction</label>
                      <input type="text" className="input" value={common.contact_role} onChange={e => setCommon({...common, contact_role: e.target.value})} placeholder="Ex: Responsable RH" />
                    </div>
                    <div>
                      <label className="label text-xs">Email</label>
                      <input type="email" className="input" value={common.contact_email} onChange={e => setCommon({...common, contact_email: e.target.value})} placeholder="email@example.com" />
                    </div>
                    <div>
                      <label className="label text-xs">Téléphone</label>
                      <input type="tel" className="input" value={common.contact_phone} onChange={e => setCommon({...common, contact_phone: e.target.value})} placeholder="06 00 00 00 00" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* ═══════════════════ STEP 2: Entreprises & Stagiaires ═══════════════════ */}
            {step === 2 && (
              <div className="space-y-6">
                {groups.map((group, gi) => (
                  <div key={group.id} className="border-2 border-gray-200 rounded-xl overflow-hidden">
                    {/* Group header */}
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-purple-600" />
                        <span className="font-semibold text-gray-700">Entreprise {gi + 1}</span>
                        {group.matched_client && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Client existant
                          </span>
                        )}
                      </div>
                      {groups.length > 1 && (
                        <button onClick={() => removeGroup(gi)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="p-4 space-y-4">
                      {/* Company info */}
                      <div className="grid md:grid-cols-3 gap-3">
                        <div>
                          <label className="label text-xs">SIRET *</label>
                          <input
                            type="text"
                            className={`input ${group.matched_client ? 'border-green-400 bg-green-50' : ''}`}
                            value={group.siret}
                            onChange={e => handleSiretChange(gi, e.target.value)}
                            placeholder="323 970 764 000 29"
                          />
                        </div>
                        <div>
                          <label className="label text-xs">Raison sociale *</label>
                          <input
                            type="text"
                            className={`input ${group.matched_client ? 'bg-green-50' : ''}`}
                            value={group.company_name}
                            onChange={e => { const u = [...groups]; u[gi].company_name = e.target.value; setGroups(u) }}
                            placeholder="SAS KERA SPORT"
                          />
                        </div>
                        <div>
                          <label className="label text-xs">Ville</label>
                          <input
                            type="text"
                            className={`input ${group.matched_client ? 'bg-green-50' : ''}`}
                            value={group.city}
                            onChange={e => { const u = [...groups]; u[gi].city = e.target.value; setGroups(u) }}
                            placeholder="CONCARNEAU"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="label text-xs">Adresse</label>
                          <input
                            type="text"
                            className={`input ${group.matched_client ? 'bg-green-50' : ''}`}
                            value={group.address}
                            onChange={e => { const u = [...groups]; u[gi].address = e.target.value; setGroups(u) }}
                            placeholder="ZA KERAMPERU, 3 RUE RENE MADEC"
                          />
                        </div>
                        <div>
                          <label className="label text-xs">Code postal</label>
                          <input
                            type="text"
                            className={`input ${group.matched_client ? 'bg-green-50' : ''}`}
                            value={group.postal_code}
                            onChange={e => { const u = [...groups]; u[gi].postal_code = e.target.value; setGroups(u) }}
                            placeholder="29900"
                          />
                        </div>
                      </div>
                      
                      {/* Trainees */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="label text-xs flex items-center gap-1">
                            <Users className="w-4 h-4" /> Stagiaires ({group.trainees.length})
                          </label>
                          <button onClick={() => addTrainee(gi)} className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Ajouter
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          {group.trainees.map((t, ti) => (
                            <div key={t.id} className={`flex items-start gap-2 p-2 rounded-lg ${t.matched_trainee ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 flex-1">
                                <input
                                  type="text"
                                  className="input text-sm py-1"
                                  value={t.last_name}
                                  onChange={e => handleTraineeNameChange(gi, ti, 'last_name', e.target.value)}
                                  placeholder="NOM *"
                                />
                                <input
                                  type="text"
                                  className="input text-sm py-1"
                                  value={t.first_name}
                                  onChange={e => handleTraineeNameChange(gi, ti, 'first_name', e.target.value)}
                                  placeholder="Prénom *"
                                />
                                <input
                                  type="date"
                                  className="input text-sm py-1"
                                  value={t.birth_date}
                                  onChange={e => { const u = [...groups]; u[gi].trainees[ti].birth_date = e.target.value; setGroups(u) }}
                                  title="Date de naissance"
                                />
                                <input
                                  type="text"
                                  className="input text-sm py-1"
                                  value={t.birth_place}
                                  onChange={e => { const u = [...groups]; u[gi].trainees[ti].birth_place = e.target.value; setGroups(u) }}
                                  placeholder="Lieu naissance"
                                />
                                <input
                                  type="text"
                                  className="input text-sm py-1"
                                  value={t.social_security_number}
                                  onChange={e => { const u = [...groups]; u[gi].trainees[ti].social_security_number = e.target.value; setGroups(u) }}
                                  placeholder="N° SS"
                                />
                              </div>
                              {t.matched_trainee && <CheckCircle className="w-4 h-4 text-green-600 mt-2 shrink-0" title="Stagiaire existant" />}
                              {group.trainees.length > 1 && (
                                <button onClick={() => removeTrainee(gi, ti)} className="text-red-400 hover:text-red-600 mt-2 shrink-0">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <button onClick={addGroup} className="w-full py-3 border-2 border-dashed border-purple-300 rounded-xl text-purple-600 hover:bg-purple-50 flex items-center justify-center gap-2 transition-colors">
                  <Plus className="w-5 h-5" /> Ajouter une entreprise
                </button>
              </div>
            )}
            
            {/* ═══════════════════ STEP 3: Récapitulatif ═══════════════════ */}
            {step === 3 && !creating && creationLog.length === 0 && (
              <div className="space-y-4">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">Formation</h3>
                  <p className="text-sm">{selectedCourse?.title || '—'}</p>
                  <p className="text-sm text-gray-600">{common.start_date} → {common.end_date} | {common.start_time} - {common.end_time}</p>
                  {common.location && <p className="text-sm text-gray-600">📍 {common.location}</p>}
                  {common.signatory_name && <p className="text-sm text-gray-600">✍️ Signataire: {common.signatory_name}{common.signatory_role ? ` (${common.signatory_role})` : ''}</p>}
                  {common.contact_name && <p className="text-sm text-gray-600">📧 Contact: {common.contact_name}</p>}
                </div>
                
                <h3 className="font-semibold">Ce qui va être créé :</h3>
                
                {groups.map((group, gi) => (
                  <div key={group.id} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <span className="font-medium">{group.company_name}</span>
                      <span className="text-xs text-gray-500">SIRET: {group.siret}</span>
                      {group.matched_client ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Client existant</span>
                      ) : (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Nouveau client</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">→ 1 convention + 1 session + {group.trainees.length} convocation{group.trainees.length > 1 ? 's' : ''}</p>
                    <div className="flex flex-wrap gap-1">
                      {group.trainees.map(t => (
                        <span key={t.id} className={`text-xs px-2 py-1 rounded-full ${t.matched_trainee ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {t.first_name} {t.last_name}
                          {t.matched_trainee ? ' ✓' : ' (nouveau)'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800 font-medium">
                    Résumé : {groups.length} session{groups.length > 1 ? 's' : ''} • {groups.length} convention{groups.length > 1 ? 's' : ''} • {totalTrainees} stagiaire{totalTrainees > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}
            
            {/* Creation log */}
            {(creating || creationLog.length > 0) && step === 3 && (
              <div className="space-y-2">
                {creating && (
                  <div className="flex items-center gap-2 text-purple-700 mb-4">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-medium">Création en cours...</span>
                  </div>
                )}
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm max-h-80 overflow-y-auto">
                  {creationLog.map((entry, i) => (
                    <div key={i} className={entry.ok ? '' : 'text-red-400'}>
                      {entry.msg}
                    </div>
                  ))}
                </div>
                {!creating && creationLog.length > 0 && (
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="btn btn-primary">Fermer</button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Footer navigation */}
          {!(creating || creationLog.length > 0) && (
            <div className="flex justify-between items-center p-4 border-t sticky bottom-0 bg-white">
              <div>
                {step > 1 && (
                  <button onClick={() => setStep(step - 1)} className="btn btn-secondary flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4" /> Retour
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="btn btn-secondary">Annuler</button>
                {step < 3 ? (
                  <button onClick={handleNext} className="btn btn-primary flex items-center gap-1">
                    Suivant <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={handleCreate} className="btn bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Créer {groups.length} sessions
                  </button>
                )}
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  )
}
