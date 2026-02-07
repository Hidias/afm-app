import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { 
  Phone, CheckCircle, RefreshCw, SkipForward,
  Building2, MapPin, Mail, List, Search, Sparkles, Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'

const FORMATIONS = [
  'SST / MAC SST',
  'Gestes & Postures / TMS',
  'Incendie (EPI, extincteurs, évacuation)',
  'Habilitation électrique (B0 / H0V)',
  'Conduite R485 / R489'
]

const TEMPLATES_NOTES = [
  { label: '🔥 Intéressé - Veut devis', value: 'Intéressé. Demande devis pour [X] personnes. Formations : [liste]. Budget disponible.' },
  { label: '🟡 À rappeler', value: 'À rappeler le [date] à [heure]. Raison : [Dirigeant absent / En réunion / Demande rappel]' },
  { label: '❄️ Déjà prestataire', value: 'Travaille déjà avec [nom organisme]. À recontacter dans [3/6 mois] pour renouvellement.' },
  { label: '📞 Message laissé', value: 'Message laissé. Email de présentation envoyé. À relancer dans 2 jours si pas de retour.' },
  { label: '⚠️ Barrage secrétariat', value: 'Barrage secrétariat. Contact décideur : [Nom] [Email]. Mail envoyé.' },
  { label: '📧 Envoyer mail', value: 'Envoyer un mail de présentation à [email]. Rappeler dans 48h.' },
  { label: '🏢 Voir siège', value: 'Contacter le siège au [numéro]. Demander [nom/service].' },
]

const CALL_RESULTS = [
  { id: 'chaud', label: '🔥 Intéressé', sublabel: 'Veut un RDV', color: 'green' },
  { id: 'tiede', label: '🟡 Tiède', sublabel: 'À rappeler', color: 'orange' },
  { id: 'froid', label: '❄️ Pas intéressé', sublabel: 'Archiver', color: 'blue' },
  { id: 'no_answer', label: '📞 Pas de réponse', sublabel: 'Répondeur', color: 'gray' },
  { id: 'blocked', label: '⚠️ Barrage', sublabel: 'Secrétariat', color: 'red' },
  { id: 'wrong_number', label: '❌ Numéro erroné', sublabel: 'À corriger', color: 'purple' },
]

const COLOR_MAP = {
  green: { active: 'bg-green-500 text-white border-green-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
  orange: { active: 'bg-orange-500 text-white border-orange-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
  blue: { active: 'bg-blue-500 text-white border-blue-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
  gray: { active: 'bg-gray-500 text-white border-gray-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
  red: { active: 'bg-red-500 text-white border-red-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
  purple: { active: 'bg-purple-500 text-white border-purple-500', inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
}

export default function MarinePhoning() {
  // Mapping tranche effectifs INSEE
  const EFFECTIF_LABELS = {
    '00': '0 sal.', '01': '1-2 sal.', '02': '3-5 sal.', '03': '6-9 sal.',
    '11': '10-19 sal.', '12': '20-49 sal.', '21': '50-99 sal.', '22': '100-199 sal.',
    '31': '200-249 sal.', '32': '250-499 sal.', '41': '500-999 sal.', '42': '1000-1999 sal.',
    '51': '2000-4999 sal.', '52': '5000-9999 sal.', '53': '10000+ sal.',
  }
  const getEffectifLabel = (code) => code ? (EFFECTIF_LABELS[String(code)] || code + ' sal.') : null
  const { user } = useAuthStore()
  const ADMIN_EMAIL = 'hicham.saidi@accessformation.pro'
  const isAdmin = user?.email === ADMIN_EMAIL
  const callerName = user?.email?.split('@')[0]?.split('.')?.map(n => n.charAt(0).toUpperCase() + n.slice(1))?.join(' ') || 'Inconnu'

  const [prospects, setProspects] = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [departementFilter, setDepartementFilter] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [searchTerm, setSearchTerm] = useState('')
  const [totalCount, setTotalCount] = useState(0)

  const [callStartTime, setCallStartTime] = useState(null)

  const [contactName, setContactName] = useState('')
  const [contactFunction, setContactFunction] = useState('Dirigeant')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [callResult, setCallResult] = useState('chaud')
  const [formationsSelected, setFormationsSelected] = useState([])
  const [notes, setNotes] = useState('')
  const [createRdv, setCreateRdv] = useState(false)
  const [rdvAssignedTo, setRdvAssignedTo] = useState('Hicham')
  const [rdvDate, setRdvDate] = useState('')
  const [needsCallback, setNeedsCallback] = useState(false)
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('14:00')
  const [callbackReason, setCallbackReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)

  const departements = [...new Set(prospects.map(p => p.departement))].filter(Boolean).sort()

  useEffect(() => { loadProspects() }, [])

  async function loadProspects() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('prospection_massive')
        .select('id, siret, siren, name, city, postal_code, phone, email, site_web, departement, effectif, naf, quality_score, prospection_status, prospection_notes, contacted, contacted_at, ai_summary')
        .not('phone', 'is', null)
        .or('prospection_status.is.null,prospection_status.eq.a_rappeler')
        .order('quality_score', { ascending: false })
        .limit(10000)

      if (error) throw error

      const seen = new Set()
      const unique = (data || []).filter(p => {
        if (!p.siren || seen.has(p.siren)) return false
        seen.add(p.siren)
        return true
      })

      setProspects(unique)
      setTotalCount(unique.length)

      if (viewMode === 'file' && unique.length > 0 && !current) {
        selectProspect(unique[0])
      }
    } catch (err) {
      console.error('Erreur chargement:', err)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  function selectProspect(prospect) {
    setCurrent(prospect)
    setCallStartTime(Date.now())
    setContactName('')
    setContactFunction('Dirigeant')
    setContactEmail(prospect.email || '')
    setContactMobile('')
    setCallResult('chaud')
    setFormationsSelected([])
    setNotes('')
    setCreateRdv(false)
    setRdvAssignedTo('Hicham')
    setRdvDate('')
    setNeedsCallback(false)
    setCallbackDate('')
    setCallbackTime('14:00')
    setCallbackReason('')
    // Charger le résumé IA
    loadAiSummary(prospect)
  }

  async function loadAiSummary(prospect) {
    // Si déjà en cache dans la base
    if (prospect.ai_summary) {
      setAiSummary(prospect.ai_summary)
      return
    }
    
    setAiSummary('')
    setAiSummaryLoading(true)
    try {
      const res = await fetch('/api/generate-prospect-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prospect.name,
          city: prospect.city,
          naf: prospect.naf,
          effectif: prospect.effectif,
          site_web: prospect.site_web,
          siret: prospect.siret,
        })
      })
      const data = await res.json()
      if (data.success && data.summary) {
        setAiSummary(data.summary)
        // Sauvegarder en cache dans la base
        await supabase
          .from('prospection_massive')
          .update({ ai_summary: data.summary })
          .eq('id', prospect.id)
        // Mettre à jour le prospect local
        prospect.ai_summary = data.summary
      }
    } catch (err) {
      console.error('Erreur résumé IA:', err)
    } finally {
      setAiSummaryLoading(false)
    }
  }

  async function findOrCreateClient(prospect) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('siren', prospect.siren)
      .maybeSingle()

    if (existing) return existing.id

    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        name: prospect.name,
        address: prospect.city ? prospect.postal_code + ' ' + prospect.city : null,
        postal_code: prospect.postal_code,
        city: prospect.city,
        siret: prospect.siret,
        siren: prospect.siren,
        contact_phone: prospect.phone,
        email: prospect.email || null,
        website: prospect.site_web || null,
        taille_entreprise: prospect.effectif || null,
        status: 'prospect',
        type: 'prospect',
      })
      .select('id')
      .single()

    if (error) throw error
    return newClient.id
  }

  async function handleSave() {
    if (!current) return
    setSaving(true)

    try {
      const finalDuration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0
      const clientId = await findOrCreateClient(current)

      const { data: insertedCall, error: callError } = await supabase
        .from('prospect_calls')
        .insert({
          client_id: clientId,
          called_by: callerName,
          duration_seconds: finalDuration,
          contact_name: contactName || null,
          contact_function: contactFunction || null,
          contact_email: contactEmail || null,
          contact_mobile: contactMobile || null,
          call_result: callResult,
          formations_mentioned: formationsSelected.length > 0 ? formationsSelected : null,
          notes: notes || null,
          rdv_created: createRdv,
          needs_callback: needsCallback,
          callback_date: needsCallback ? callbackDate : null,
          callback_time: needsCallback ? callbackTime : null,
          callback_reason: needsCallback ? callbackReason : null,
        })
        .select()
        .single()

      if (callError) throw callError

      // Mettre à jour client
      const clientUpdates = {}
      if (contactName) clientUpdates.contact_name = contactName
      if (contactEmail) clientUpdates.contact_email = contactEmail
      if (contactMobile) clientUpdates.mobile = contactMobile
      if (contactFunction) clientUpdates.contact_function = contactFunction
      if (Object.keys(clientUpdates).length > 0) {
        await supabase.from('clients').update(clientUpdates).eq('id', clientId)
      }

      // Créer RDV
      if (createRdv && rdvDate) {
        const { data: insertedRdv, error: rdvError } = await supabase
          .from('prospect_rdv')
          .insert({
            client_id: clientId,
            rdv_date: rdvDate,
            rdv_type: 'decouverte',
            conducted_by: rdvAssignedTo,
            status: 'prevu',
            contact_name: contactName || null,
            contact_email: contactEmail || null,
            contact_phone: contactMobile || null,
            formations_interet: formationsSelected.length > 0 ? formationsSelected : null,
            notes: 'Créé par ' + callerName + ' suite à appel téléphonique.\n\nNotes:\n' + notes,
            temperature: 'chaud',
            source: 'phoning_' + callerName.toLowerCase().replace(' ', '_'),
          })
          .select()
          .single()

        if (rdvError) throw rdvError
        await supabase.from('prospect_calls').update({ rdv_id: insertedRdv.id }).eq('id', insertedCall.id)
      }

      // Mettre à jour prospection_massive
      let newStatus = null
      if (callResult === 'chaud') newStatus = 'rdv_pris'
      else if (callResult === 'froid') newStatus = 'pas_interesse'
      else if (callResult === 'tiede' || callResult === 'no_answer' || callResult === 'blocked') newStatus = 'a_rappeler'
      else if (callResult === 'wrong_number') newStatus = 'numero_errone'

      await supabase
        .from('prospection_massive')
        .update({
          contacted: true,
          contacted_at: new Date().toISOString(),
          prospection_status: newStatus,
          prospection_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('siren', current.siren)

      let message = '✅ Appel enregistré'
      if (createRdv) message += ' • RDV créé pour ' + rdvAssignedTo
      if (needsCallback) message += ' • Rappel programmé'
      toast.success(message)

      goNext()
      await loadProspects()

    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      toast.error('Erreur: ' + (error.message || 'Échec sauvegarde'))
    } finally {
      setSaving(false)
    }
  }

  function goNext() {
    if (!current || viewMode === 'list') {
      setCurrent(null)
      setCallStartTime(null)
      return
    }
    const idx = prospects.findIndex(p => p.id === current.id)
    if (idx < prospects.length - 1) {
      selectProspect(prospects[idx + 1])
    } else {
      setCurrent(null)
      setCallStartTime(null)
      loadProspects()
    }
  }

  function handleSkip() {
    if (!current) return
    toast.info('Prospect passé')
    goNext()
  }

  const filtered = prospects.filter(p => {
    if (departementFilter && p.departement !== departementFilter) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return p.name?.toLowerCase().includes(term) || p.city?.toLowerCase().includes(term) || p.phone?.includes(term)
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📞 Phoning</h1>
          <p className="text-gray-600 mt-1">{totalCount} prospects à appeler • {callerName}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('list')}
              className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600')}>
              <List className="w-4 h-4 inline mr-1" /> Liste
            </button>
            <button onClick={() => { setViewMode('file'); if (filtered.length > 0 && !current) selectProspect(filtered[0]) }}
              className={'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (viewMode === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600')}>
              <SkipForward className="w-4 h-4 inline mr-1" /> File
            </button>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom, ville, téléphone..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
        </div>
        <select value={departementFilter} onChange={(e) => setDepartementFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
          <option value="">Tous les dép.</option>
          {departements.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button onClick={loadProspects} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {filtered.length === 0 && !current ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucun prospect à appeler</h2>
          <p className="text-gray-600">Enrichissez des prospects dans l'onglet Enrichissement</p>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Liste (gauche) */}
          {(viewMode === 'list' || (viewMode === 'file' && !current)) && (
            <div className={(current ? 'w-1/3' : 'w-full') + ' space-y-2 max-h-[70vh] overflow-y-auto'}>
              {filtered.map((p) => (
                <button key={p.id} onClick={() => selectProspect(p)}
                  className={'w-full text-left p-3 rounded-lg border transition-colors ' +
                    (current?.id === p.id ? 'bg-primary-50 border-primary-300 ring-2 ring-primary-200' : 'bg-white border-gray-200 hover:bg-gray-50')}>
                  <div className="flex justify-between items-start">
                    <div className="font-semibold text-gray-900 text-sm">{p.name}</div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{p.quality_score}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">📍 {p.city} ({p.departement}) {p.effectif && '• 👥 ' + getEffectifLabel(p.effectif)}</div>
                  <div className="text-sm text-primary-600 font-medium mt-1">📞 {p.phone}</div>
                  {p.prospection_status === 'a_rappeler' && (
                    <span className="inline-block mt-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">🔔 À rappeler</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Fiche d'appel (droite) */}
          {current && (
            <div className={(viewMode === 'list' ? 'w-2/3' : 'w-full') + ' bg-white rounded-lg border border-gray-200 p-6 space-y-5 max-h-[70vh] overflow-y-auto'}>
              
              {/* Info entreprise */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5" />{current.name}
                    </h2>
                    <div className="text-sm text-gray-600 space-y-1 mt-2">
                      <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />{current.postal_code} {current.city} ({current.departement})</div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <a href={'tel:' + current.phone?.replace(/\s/g, '')} className="text-primary-600 hover:underline font-bold text-lg">{current.phone}</a>
                      </div>
                      {current.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4" /><a href={'mailto:' + current.email} className="text-primary-600 hover:underline">{current.email}</a></div>}
                      {current.effectif && <div>👥 {getEffectifLabel(current.effectif)}</div>}
                      {current.siret && <div className="text-xs">SIRET: {current.siret}</div>}
                    </div>
                  </div>
                  {viewMode === 'file' && <span className="text-sm text-gray-500">{prospects.findIndex(p => p.id === current.id) + 1} / {filtered.length}</span>}
                </div>
              </div>

              {/* Résumé IA */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Résumé IA</span>
                  {current.site_web && (
                    <a href={(current.site_web.startsWith('http') ? '' : 'https://') + current.site_web} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-amber-600 hover:underline ml-auto">🌐 {current.site_web}</a>
                  )}
                </div>
                {aiSummaryLoading ? (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyse en cours...
                  </div>
                ) : aiSummary ? (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{aiSummary}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Aucun résumé disponible</p>
                )}
              </div>

              {/* Interlocuteur */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">👤 Interlocuteur contacté</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Nom</label>
                    <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                      placeholder="Mme Dupont" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Fonction</label>
                    <select value={contactFunction} onChange={(e) => setContactFunction(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                      <option value="Dirigeant">Dirigeant</option>
                      <option value="RH">RH</option>
                      <option value="QHSE">QHSE</option>
                      <option value="Resp formation">Resp formation</option>
                      <option value="Secrétariat">Secrétariat</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Email</label>
                    <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="m.dupont@entreprise.fr" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Mobile direct</label>
                    <input type="tel" value={contactMobile} onChange={(e) => setContactMobile(e.target.value)}
                      placeholder="06 XX XX XX XX" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                </div>
              </div>

              {/* Résultat */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">🎯 Résultat de l'appel</h3>
                <div className="grid grid-cols-3 gap-2">
                  {CALL_RESULTS.map(r => (
                    <button key={r.id} onClick={() => setCallResult(r.id)}
                      className={'px-3 py-2.5 rounded-lg border text-center transition-colors ' +
                        (callResult === r.id ? COLOR_MAP[r.color].active : COLOR_MAP[r.color].inactive)}>
                      {r.label}<br/><span className="text-xs">{r.sublabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Formations */}
              {(callResult === 'chaud' || callResult === 'tiede') && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">🎓 Formations évoquées</h3>
                  <div className="space-y-2">
                    {FORMATIONS.map((f) => (
                      <label key={f} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formationsSelected.includes(f)}
                          onChange={(e) => e.target.checked ? setFormationsSelected([...formationsSelected, f]) : setFormationsSelected(formationsSelected.filter(x => x !== f))}
                          className="rounded" />
                        <span className="text-sm">{f}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">📝 Notes & observations</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {TEMPLATES_NOTES.map((t) => (
                    <button key={t.label} onClick={() => setNotes(t.value)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-left">{t.label}</button>
                  ))}
                </div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes, observations, consignes (contacter tel numéro, voir avec le siège, envoyer un mail, etc.)..."
                  rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>

              {/* RDV */}
              {callResult === 'chaud' && (
                <div className="bg-green-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input type="checkbox" checked={createRdv} onChange={(e) => setCreateRdv(e.target.checked)} className="rounded" />
                    <span className="font-semibold text-gray-900">📅 Créer RDV pour Hicham/Maxime</span>
                  </label>
                  {createRdv && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Date souhaitée</label>
                        <input type="date" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Assigné à</label>
                        <div className="flex gap-2">
                          {['Hicham', 'Maxime'].map(name => (
                            <button key={name} onClick={() => setRdvAssignedTo(name)}
                              className={'flex-1 px-3 py-2 rounded-lg border ' + (rdvAssignedTo === name ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-700 border-gray-300')}>
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rappel */}
              {(callResult === 'tiede' || callResult === 'no_answer' || callResult === 'blocked') && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input type="checkbox" checked={needsCallback} onChange={(e) => setNeedsCallback(e.target.checked)} className="rounded" />
                    <span className="font-semibold text-gray-900">🔔 Programmer un rappel</span>
                  </label>
                  {needsCallback && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Date</label>
                        <input type="date" value={callbackDate} onChange={(e) => setCallbackDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Heure</label>
                        <input type="time" value={callbackTime} onChange={(e) => setCallbackTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Raison</label>
                        <input type="text" value={callbackReason} onChange={(e) => setCallbackReason(e.target.value)}
                          placeholder="Dirigeant absent" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t sticky bottom-0 bg-white">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                  {saving ? (<><RefreshCw className="w-5 h-5 animate-spin" /> Enregistrement...</>) : (<><CheckCircle className="w-5 h-5" /> 💾 Enregistrer & Suivant</>)}
                </button>
                <button onClick={handleSkip}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
                  <SkipForward className="w-5 h-5" /> Passer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
