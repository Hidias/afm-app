import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Phone, Clock, CheckCircle, XCircle, RefreshCw, SkipForward,
  User, Building2, MapPin, Calendar, Mail, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

const FORMATIONS = [
  'SST / MAC SST',
  'Gestes & Postures / TMS',
  'Incendie (EPI, extincteurs, évacuation)',
  'Habilitation électrique (B0 / H0V)',
  'Conduite R485 / R489'
]

const TEMPLATES_NOTES = [
  {
    label: '🔥 Intéressé - Veut devis',
    value: 'Intéressé. Demande devis pour [X] personnes. Formations : [liste]. Budget disponible.'
  },
  {
    label: '🟡 À rappeler',
    value: 'À rappeler le [date] à [heure]. Raison : [Dirigeant absent / En réunion / Demande rappel]'
  },
  {
    label: '❄️ Déjà prestataire',
    value: 'Travaille déjà avec [nom organisme]. À recontacter dans [3/6 mois] pour renouvellement.'
  },
  {
    label: '📞 Message laissé',
    value: 'Message laissé. Email de présentation envoyé. À relancer dans 2 jours si pas de retour.'
  },
  {
    label: '⚠️ Barrage secrétariat',
    value: 'Barrage secrétariat. Contact décideur : [Nom] [Email]. Mail envoyé.'
  }
]

export default function MarinePhoning() {
  const navigate = useNavigate()
  
  // File d'attente
  const [queue, setQueue] = useState([])
  const [currentProspect, setCurrentProspect] = useState(null)
  const [currentClient, setCurrentClient] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Chronomètre
  const [callStartTime, setCallStartTime] = useState(null)
  const [callDuration, setCallDuration] = useState(0)
  
  // Formulaire
  const [contactName, setContactName] = useState('')
  const [contactFunction, setContactFunction] = useState('Dirigeant')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  
  const [callResult, setCallResult] = useState('chaud')
  const [barrageType, setBarrageType] = useState('')
  const [formationsSelected, setFormationsSelected] = useState([])
  const [notes, setNotes] = useState('')
  
  const [createRdv, setCreateRdv] = useState(false)
  const [rdvAssignedTo, setRdvAssignedTo] = useState('Hicham')
  const [rdvDate, setRdvDate] = useState('')
  
  const [sendEmail, setSendEmail] = useState(false)
  const [emailType, setEmailType] = useState('suite_echange')
  
  const [needsCallback, setNeedsCallback] = useState(false)
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('14:00')
  const [callbackReason, setCallbackReason] = useState('')
  
  const [saving, setSaving] = useState(false)

  // Charger la file d'attente
  useEffect(() => {
    loadQueue()
  }, [])

  // Chronomètre
  useEffect(() => {
    if (!callStartTime) return
    
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000))
    }, 1000)
    
    return () => clearInterval(interval)
  }, [callStartTime])

  const loadQueue = async () => {
    try {
      const { data, error } = await supabase
        .from('marine_queue')
        .select(`
          *,
          clients (*)
        `)
        .eq('status', 'pending')
        .order('priority', { ascending: true })
        .order('added_at', { ascending: true })
      
      if (error) throw error
      
      setQueue(data || [])
      
      // Charger le premier prospect automatiquement
      if (data && data.length > 0 && !currentProspect) {
        loadProspect(data[0])
      }
      
    } catch (error) {
      console.error('Erreur chargement file:', error)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const loadProspect = async (queueItem) => {
    setCurrentProspect(queueItem)
    setCurrentClient(queueItem.clients)
    
    // Démarrer le chronomètre
    setCallStartTime(Date.now())
    setCallDuration(0)
    
    // Pré-remplir les infos du client si disponibles
    setContactName(queueItem.clients?.contact_name || '')
    setContactEmail(queueItem.clients?.contact_email || queueItem.clients?.email || '')
    setContactMobile(queueItem.clients?.mobile || queueItem.clients?.contact_phone || '')
    
    // Réinitialiser le formulaire
    setContactFunction('Dirigeant')
    setCallResult('chaud')
    setBarrageType('')
    setFormationsSelected([])
    setNotes('')
    setCreateRdv(false)
    setRdvAssignedTo('Hicham')
    setRdvDate('')
    setSendEmail(false)
    setEmailType('suite_echange')
    setNeedsCallback(false)
    setCallbackDate('')
    setCallbackTime('14:00')
    setCallbackReason('')
    
    // Marquer comme "in_progress"
    await supabase
      .from('marine_queue')
      .update({ status: 'in_progress' })
      .eq('id', queueItem.id)
  }

  const applyTemplate = (template) => {
    setNotes(template)
  }

  const handleSave = async () => {
    if (!currentProspect || !currentClient) {
      toast.error('Aucun prospect sélectionné')
      return
    }
    
    setSaving(true)
    
    try {
      // Arrêter le chronomètre
      const finalDuration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0
      
      // 1. Enregistrer l'appel dans prospect_calls
      const callData = {
        client_id: currentClient.id,
        called_by: 'Marine',
        duration_seconds: finalDuration,
        contact_name: contactName || null,
        contact_function: contactFunction || null,
        contact_email: contactEmail || null,
        contact_mobile: contactMobile || null,
        call_result: callResult,
        barrage_type: barrageType || null,
        formations_mentioned: formationsSelected.length > 0 ? formationsSelected : null,
        notes: notes || null,
        rdv_created: createRdv,
        email_sent: sendEmail,
        email_type: sendEmail ? emailType : null,
        needs_callback: needsCallback,
        callback_date: needsCallback ? callbackDate : null,
        callback_time: needsCallback ? callbackTime : null,
        callback_reason: needsCallback ? callbackReason : null,
      }
      
      const { data: insertedCall, error: callError } = await supabase
        .from('prospect_calls')
        .insert(callData)
        .select()
        .single()
      
      if (callError) throw callError
      
      // 2. Mettre à jour le client avec les nouvelles infos de contact
      const clientUpdates = {}
      if (contactName && !currentClient.contact_name) clientUpdates.contact_name = contactName
      if (contactEmail && !currentClient.email) clientUpdates.email = contactEmail
      if (contactMobile && !currentClient.mobile) clientUpdates.mobile = contactMobile
      if (contactFunction && !currentClient.contact_function) clientUpdates.contact_function = contactFunction
      
      if (Object.keys(clientUpdates).length > 0) {
        await supabase
          .from('clients')
          .update(clientUpdates)
          .eq('id', currentClient.id)
      }
      
      // 3. Créer RDV si demandé
      let rdvId = null
      if (createRdv && rdvDate) {
        const rdvData = {
          client_id: currentClient.id,
          rdv_date: rdvDate,
          rdv_type: 'decouverte',
          conducted_by: rdvAssignedTo,
          status: 'prevu',
          contact_name: contactName || null,
          contact_email: contactEmail || null,
          contact_phone: contactMobile || null,
          formations_interet: formationsSelected.length > 0 ? formationsSelected : null,
          notes: `Créé par Marine suite à appel téléphonique.\n\nNotes de Marine:\n${notes}`,
          temperature: 'chaud',
          source: 'phoning_marine',
        }
        
        const { data: insertedRdv, error: rdvError } = await supabase
          .from('prospect_rdv')
          .insert(rdvData)
          .select()
          .single()
        
        if (rdvError) throw rdvError
        
        rdvId = insertedRdv.id
        
        // Mettre à jour l'appel avec le RDV créé
        await supabase
          .from('prospect_calls')
          .update({ rdv_id })
          .eq('id', insertedCall.id)
      }
      
      // 4. Mettre à jour la queue
      if (needsCallback) {
        // Remettre dans la file avec rappel
        await supabase
          .from('marine_queue')
          .update({
            status: 'pending',
            priority: 1, // Urgent
            priority_reason: `À rappeler le ${format(new Date(callbackDate), 'd MMMM', { locale: fr })} - ${callbackReason}`,
            last_call_date: new Date().toISOString().split('T')[0],
            call_attempts: currentProspect.call_attempts + 1,
          })
          .eq('id', currentProspect.id)
      } else {
        // Marquer comme appelé
        await supabase
          .from('marine_queue')
          .update({
            status: 'called',
            called_at: new Date().toISOString(),
            last_call_date: new Date().toISOString().split('T')[0],
            call_attempts: currentProspect.call_attempts + 1,
          })
          .eq('id', currentProspect.id)
      }
      
      // 5. Toast de confirmation
      let message = '✅ Appel enregistré'
      if (createRdv) message += ' • RDV créé pour ' + rdvAssignedTo
      if (needsCallback) message += ' • Rappel programmé'
      toast.success(message)
      
      // 6. Passer au suivant
      await loadQueue()
      
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    if (!currentProspect) return
    
    // Remettre en pending et passer au suivant
    await supabase
      .from('marine_queue')
      .update({ status: 'pending' })
      .eq('id', currentProspect.id)
    
    await loadQueue()
    toast.info('Prospect passé')
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}min ${secs.toString().padStart(2, '0')}s`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (queue.length === 0 && !currentProspect) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Aucun prospect à appeler
        </h2>
        <p className="text-gray-600 mb-4">
          La file d'attente est vide
        </p>
        <button
          onClick={() => navigate('/prospection/recherche')}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          Rechercher des prospects
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header avec stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📞 Phoning Marine</h1>
          <p className="text-gray-600 mt-1">
            {queue.length} prospects en attente
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-primary-600">
            ⏱️ {formatDuration(callDuration)}
          </div>
          <p className="text-sm text-gray-500">Durée appel</p>
        </div>
      </div>

      {/* Fiche d'appel */}
      {currentClient && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          
          {/* Info entreprise */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {currentClient.name}
                </h2>
                <div className="text-sm text-gray-600 space-y-1 mt-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {currentClient.address && <span>{currentClient.address}, </span>}
                    {currentClient.postal_code} {currentClient.city}
                  </div>
                  {currentClient.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${currentClient.contact_phone}`} className="text-primary-600 hover:underline font-medium">
                        {currentClient.contact_phone}
                      </a>
                    </div>
                  )}
                  {currentClient.taille_entreprise && (
                    <div>👥 {currentClient.taille_entreprise}</div>
                  )}
                  {currentClient.siret && (
                    <div className="text-xs">SIRET: {currentClient.siret}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Interlocuteur contacté */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">👤 Interlocuteur contacté</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nom *</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Mme Dupont"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Fonction *</label>
                <select
                  value={contactFunction}
                  onChange={(e) => setContactFunction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="Dirigeant">Dirigeant</option>
                  <option value="RH">RH</option>
                  <option value="QHSE">QHSE</option>
                  <option value="Resp formation">Resp formation</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="m.dupont@entreprise.fr"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Mobile</label>
                <input
                  type="tel"
                  value={contactMobile}
                  onChange={(e) => setContactMobile(e.target.value)}
                  placeholder="06 XX XX XX XX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Résultat de l'appel */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">🎯 Résultat de l'appel *</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setCallResult('chaud')}
                className={`px-4 py-3 rounded-lg border text-center ${
                  callResult === 'chaud'
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                🔥 Chaud<br/>
                <span className="text-xs">Intéressé</span>
              </button>
              <button
                onClick={() => setCallResult('tiede')}
                className={`px-4 py-3 rounded-lg border text-center ${
                  callResult === 'tiede'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                🟡 Tiède<br/>
                <span className="text-xs">À rappeler</span>
              </button>
              <button
                onClick={() => setCallResult('froid')}
                className={`px-4 py-3 rounded-lg border text-center ${
                  callResult === 'froid'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ❄️ Froid<br/>
                <span className="text-xs">Pas intéressé</span>
              </button>
              <button
                onClick={() => setCallResult('no_answer')}
                className={`px-4 py-3 rounded-lg border text-center ${
                  callResult === 'no_answer'
                    ? 'bg-gray-500 text-white border-gray-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                📞 Pas de réponse<br/>
                <span className="text-xs">Répondeur</span>
              </button>
              <button
                onClick={() => setCallResult('blocked')}
                className={`px-4 py-3 rounded-lg border text-center ${
                  callResult === 'blocked'
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ⚠️ Barrage<br/>
                <span className="text-xs">Secrétariat</span>
              </button>
              <button
                onClick={() => setCallResult('wrong_number')}
                className={`px-4 py-3 rounded-lg border text-center ${
                  callResult === 'wrong_number'
                    ? 'bg-purple-500 text-white border-purple-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ❌ Numéro erroné<br/>
                <span className="text-xs">À corriger</span>
              </button>
            </div>
          </div>

          {/* Formations évoquées */}
          {(callResult === 'chaud' || callResult === 'tiede') && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">🎓 Formations évoquées</h3>
              <div className="space-y-2">
                {FORMATIONS.map((formation) => (
                  <label key={formation} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formationsSelected.includes(formation)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormationsSelected([...formationsSelected, formation])
                        } else {
                          setFormationsSelected(formationsSelected.filter(f => f !== formation))
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{formation}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes rapides (Templates) */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">📝 Notes rapides (templates 1-clic)</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {TEMPLATES_NOTES.map((template) => (
                <button
                  key={template.label}
                  onClick={() => applyTemplate(template.value)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-left"
                >
                  {template.label}
                </button>
              ))}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes de l'appel..."
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Créer RDV */}
          {callResult === 'chaud' && (
            <div className="bg-green-50 rounded-lg p-4">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={createRdv}
                  onChange={(e) => setCreateRdv(e.target.checked)}
                  className="rounded"
                />
                <span className="font-semibold text-gray-900">📅 Créer RDV pour Hicham/Maxime</span>
              </label>
              
              {createRdv && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Date souhaitée</label>
                    <input
                      type="date"
                      value={rdvDate}
                      onChange={(e) => setRdvDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Assigné à</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRdvAssignedTo('Hicham')}
                        className={`flex-1 px-3 py-2 rounded-lg border ${
                          rdvAssignedTo === 'Hicham'
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                      >
                        Hicham
                      </button>
                      <button
                        onClick={() => setRdvAssignedTo('Maxime')}
                        className={`flex-1 px-3 py-2 rounded-lg border ${
                          rdvAssignedTo === 'Maxime'
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                      >
                        Maxime
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rappel */}
          {(callResult === 'tiede' || callResult === 'no_answer') && (
            <div className="bg-orange-50 rounded-lg p-4">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={needsCallback}
                  onChange={(e) => setNeedsCallback(e.target.checked)}
                  className="rounded"
                />
                <span className="font-semibold text-gray-900">🔔 Programmer un rappel</span>
              </label>
              
              {needsCallback && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={callbackDate}
                      onChange={(e) => setCallbackDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Heure</label>
                    <input
                      type="time"
                      value={callbackTime}
                      onChange={(e) => setCallbackTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Raison</label>
                    <input
                      type="text"
                      value={callbackReason}
                      onChange={(e) => setCallbackReason(e.target.value)}
                      placeholder="Dirigeant absent"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  💾 Enregistrer
                </>
              )}
            </button>
            
            <button
              onClick={handleSkip}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
