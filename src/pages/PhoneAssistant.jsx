import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../lib/store'
import {
  Phone, PhoneOff, Mic, MicOff, Square, Brain, Save, Clock, User, Building2,
  Search, ChevronRight, MessageSquare, Calendar, ThermometerSun, Tag,
  AlertCircle, CheckCircle, RefreshCw, History, Trash2, Volume2, Info,
  Settings, Smartphone, Monitor, ChevronDown, ChevronUp, X, Play, Pause
} from 'lucide-react'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// Assistant Phoning — Transcription & Analyse IA des appels
// Web Speech API + BlackHole (périphérique agrégé Mac)
// ═══════════════════════════════════════════════════════════════

const OUTCOMES = [
  { value: 'no_answer', label: 'Pas de réponse', icon: '📵', color: 'bg-gray-100 text-gray-700', active: 'bg-gray-600 text-white' },
  { value: 'callback', label: 'Rappeler', icon: '🔄', color: 'bg-blue-50 text-blue-700', active: 'bg-blue-600 text-white' },
  { value: 'interested', label: 'Intéressé', icon: '👍', color: 'bg-green-50 text-green-700', active: 'bg-green-600 text-white' },
  { value: 'not_interested', label: 'Pas intéressé', icon: '👎', color: 'bg-red-50 text-red-700', active: 'bg-red-600 text-white' },
  { value: 'appointment', label: 'RDV pris', icon: '📅', color: 'bg-purple-50 text-purple-700', active: 'bg-purple-600 text-white' },
  { value: 'quote_sent', label: 'Devis envoyé', icon: '📧', color: 'bg-teal-50 text-teal-700', active: 'bg-teal-600 text-white' },
  { value: 'other', label: 'Autre', icon: '📝', color: 'bg-amber-50 text-amber-700', active: 'bg-amber-600 text-white' },
]

const TEMP_COLORS = {
  froid: { bg: 'bg-blue-100', text: 'text-blue-800', label: '🥶 Froid' },
  tiede: { bg: 'bg-amber-100', text: 'text-amber-800', label: '😐 Tiède' },
  chaud: { bg: 'bg-red-100', text: 'text-red-800', label: '🔥 Chaud' },
}

const formatDuration = (s) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

export default function PhoneAssistant() {
  const { clients, fetchClients } = useStore()

  // ─── États ────────────────────────────────────────────────
  const [selectedClient, setSelectedClient] = useState(null)
  const [search, setSearch] = useState('')
  const [showClientList, setShowClientList] = useState(false)
  const [callMode, setCallMode] = useState('mac') // 'mac' | 'iphone'

  // Audio devices
  const [audioDevices, setAudioDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState('')
  const [showAudioSetup, setShowAudioSetup] = useState(false)

  // Enregistrement
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [duration, setDuration] = useState(0)
  const [startedAt, setStartedAt] = useState(null)

  // Analyse IA
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

  // Sauvegarde
  const [outcome, setOutcome] = useState('no_answer')
  const [nextAction, setNextAction] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Historique
  const [callHistory, setCallHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(null)

  // Compatibilité
  const [speechSupported, setSpeechSupported] = useState(true)

  // Refs
  const recognitionRef = useRef(null)
  const timerRef = useRef(null)
  const transcriptEndRef = useRef(null)
  const mediaStreamRef = useRef(null)

  // ─── Init ─────────────────────────────────────────────────
  useEffect(() => {
    fetchClients()
    fetchHistory()
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      setSpeechSupported(false)
    }
    loadAudioDevices()
  }, [])

  // Timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isRecording, isPaused])

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript, interimText])

  // ─── Audio Devices ────────────────────────────────────────
  const loadAudioDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      setAudioDevices(audioInputs)
      const phoning = audioInputs.find(d =>
        d.label.toLowerCase().includes('phoning') ||
        d.label.toLowerCase().includes('agrégé') ||
        d.label.toLowerCase().includes('aggregate')
      )
      if (phoning) {
        setSelectedDevice(phoning.deviceId)
      } else if (audioInputs.length > 0) {
        setSelectedDevice(audioInputs[0].deviceId)
      }
    } catch (err) {
      console.error('Erreur accès micro:', err)
    }
  }

  const activateSelectedMic = async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop())
      }
      const constraints = selectedDevice
        ? { audio: { deviceId: { exact: selectedDevice } } }
        : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      mediaStreamRef.current = stream
      return true
    } catch (err) {
      console.error('Erreur activation micro:', err)
      toast.error('Impossible d\'accéder au micro sélectionné')
      return false
    }
  }

  // ─── Historique ───────────────────────────────────────────
  const fetchHistory = async () => {
    const { data } = await supabase
      .from('call_logs')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
      .limit(50)
    setCallHistory(data || [])
  }

  // ─── Speech Recognition ───────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!speechSupported) {
      toast.error('Navigateur non supporté. Utilisez Chrome.')
      return
    }
    if (!selectedClient) {
      toast.error('Sélectionnez un prospect d\'abord')
      return
    }

    const micOk = await activateSelectedMic()
    if (!micOk) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += t + ' '
        } else {
          interim += t
        }
      }
      if (final) setTranscript(prev => prev + final)
      setInterimText(interim)
    }

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error)
      if (event.error === 'not-allowed') {
        toast.error('Accès micro refusé. Cliquez 🔒 dans la barre d\'adresse → Autoriser le micro.')
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setTimeout(() => {
          if (recognitionRef.current && !isPaused) {
            try { recognitionRef.current.start() } catch {}
          }
        }, 500)
      }
    }

    recognition.onend = () => {
      if (recognitionRef.current && !isPaused) {
        try { recognitionRef.current.start() } catch {}
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setIsPaused(false)
    setDuration(0)
    setStartedAt(new Date())
    setAiAnalysis(null)
    const deviceLabel = audioDevices.find(d => d.deviceId === selectedDevice)?.label || 'micro par défaut'
    toast.success('Transcription démarrée — ' + deviceLabel)
  }, [speechSupported, selectedClient, selectedDevice, isPaused])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    setIsRecording(false)
    setIsPaused(false)
    setInterimText('')
    toast.success('Terminé — ' + formatDuration(duration))
  }, [duration])

  const pauseRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
    }
    setIsPaused(true)
  }, [])

  const resumeRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t + ' '
        else interim += t
      }
      if (final) setTranscript(prev => prev + final)
      setInterimText(interim)
    }

    recognition.onend = () => {
      if (recognitionRef.current && !isPaused) {
        try { recognitionRef.current.start() } catch {}
      }
    }

    recognitionRef.current = recognition
    try { recognition.start(); setIsPaused(false) } catch {}
  }, [isPaused])

  // ─── Analyse IA ───────────────────────────────────────────
  const analyzeTranscript = async (textOverride) => {
    const text = textOverride || transcript
    if (!text || text.trim().length < 20) {
      toast.error('Texte trop court pour analyse (min. 20 caractères)')
      return
    }
    setAnalyzing(true)
    try {
      const response = await fetch('/api/analyze-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text.trim(),
          client_name: selectedClient?.name || '',
          contact_name: selectedClient?.contact_name || '',
          context: selectedClient?.notes || ''
        })
      })
      const data = await response.json()
      if (data.success && data.analysis) {
        setAiAnalysis(data.analysis)
        if (data.analysis.next_action) setNextAction(data.analysis.next_action)
        if (data.analysis.temperature === 'chaud') setOutcome('interested')
        else if (data.analysis.temperature === 'froid') setOutcome('not_interested')
        else setOutcome('callback')
        if (data.analysis.relance_date_suggestion) {
          const match = data.analysis.relance_date_suggestion.match(/(\d+)\s*(jour|semaine|mois)/i)
          if (match) {
            const d = new Date()
            const n = parseInt(match[1])
            if (match[2].startsWith('semaine')) d.setDate(d.getDate() + n * 7)
            else if (match[2].startsWith('mois')) d.setMonth(d.getMonth() + n)
            else d.setDate(d.getDate() + n)
            setNextActionDate(d.toISOString().split('T')[0])
          }
        }
        toast.success('Analyse terminée')
      } else {
        toast.error(data.error || 'Erreur d\'analyse')
      }
    } catch (err) {
      console.error('Erreur analyse:', err)
      toast.error('Erreur lors de l\'analyse IA')
    } finally {
      setAnalyzing(false)
    }
  }

  // ─── Sauvegarde ───────────────────────────────────────────
  const saveCallLog = async () => {
    if (!selectedClient) return toast.error('Pas de prospect sélectionné')
    setSaving(true)
    try {
      const callData = {
        client_id: selectedClient.id,
        contact_name: selectedClient.contact_name || '',
        phone_number: selectedClient.contact_phone || selectedClient.phone || '',
        started_at: startedAt?.toISOString() || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
        transcript: transcript.trim() || null,
        ai_summary: aiAnalysis || null,
        outcome,
        next_action: nextAction || null,
        next_action_date: nextActionDate || null,
        status: 'completed',
        notes: notes || null,
        created_by: 'Marine',
      }

      const { error } = await supabase.from('call_logs').insert(callData)
      if (error) throw error

      const existingNotes = selectedClient.notes || ''
      const outcomeLabel = OUTCOMES.find(o => o.value === outcome)?.label || outcome
      const callNote = '[' + new Date().toLocaleDateString('fr-FR') + ' — ' + outcomeLabel + '] ' + (aiAnalysis?.resume || nextAction || notes || '')
      const updatedNotes = callNote + (existingNotes ? '\n' + existingNotes : '')

      const updates = { notes: updatedNotes, updated_at: new Date().toISOString() }
      if (outcome === 'interested' || outcome === 'appointment' || outcome === 'quote_sent') {
        if (selectedClient.status === 'prospect') updates.status = 'en_discussion'
      }
      await supabase.from('clients').update(updates).eq('id', selectedClient.id)

      toast.success('Appel sauvegardé ✓')
      await fetchHistory()
      await fetchClients()
      resetCall()
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      toast.error('Erreur : ' + (err.message || 'sauvegarde impossible'))
    } finally {
      setSaving(false)
    }
  }

  const resetCall = () => {
    setTranscript('')
    setInterimText('')
    setDuration(0)
    setStartedAt(null)
    setAiAnalysis(null)
    setOutcome('no_answer')
    setNextAction('')
    setNextActionDate('')
    setNotes('')
    setIsRecording(false)
    setIsPaused(false)
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }

  const deleteCall = async (id) => {
    if (!confirm('Supprimer cet appel ?')) return
    await supabase.from('call_logs').delete().eq('id', id)
    toast.success('Appel supprimé')
    fetchHistory()
  }

  // ─── Filtrage prospects ───────────────────────────────────
  const filteredClients = clients
    .filter(c => c.status !== 'archive')
    .filter(c => {
      if (!search) return true
      const s = search.toLowerCase()
      return (c.name || '').toLowerCase().includes(s) ||
             (c.contact_name || '').toLowerCase().includes(s) ||
             (c.city || '').toLowerCase().includes(s) ||
             (c.phone || '').toLowerCase().includes(s)
    })
    .slice(0, 30)

  // Stats rapides
  const todayCalls = callHistory.filter(c => {
    const d = new Date(c.created_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })
  const todayInterested = todayCalls.filter(c => ['interested', 'appointment', 'quote_sent'].includes(c.outcome)).length

  // ─── RENDU ────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Phone className="w-6 h-6 text-green-600" />
            Assistant Phoning
          </h1>
          <p className="text-sm text-gray-500">Transcription & analyse IA des appels</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-3 text-sm bg-white border rounded-lg px-3 py-2">
            <span className="text-gray-500">Aujourd'hui :</span>
            <span className="font-semibold">{todayCalls.length} appels</span>
            {todayInterested > 0 && <span className="text-green-600 font-semibold">🔥 {todayInterested} chauds</span>}
          </div>
          <button onClick={() => setShowHistory(!showHistory)}
            className={'btn btn-secondary text-sm flex items-center gap-2 ' + (showHistory ? 'bg-gray-200' : '')}>
            <History className="w-4 h-4" /> Historique
          </button>
        </div>
      </div>

      {/* Barre de mode */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setCallMode('mac')}
          className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
            (callMode === 'mac' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50')}>
          <Monitor className="w-4 h-4" /> Appel Mac (transcription)
        </button>
        <button onClick={() => setCallMode('iphone')}
          className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
            (callMode === 'iphone' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50')}>
          <Smartphone className="w-4 h-4" /> Appel iPhone (mode rapide)
        </button>
        {callMode === 'mac' && (
          <button onClick={() => setShowAudioSetup(!showAudioSetup)}
            className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <Settings className="w-3.5 h-3.5" /> Config audio
          </button>
        )}
      </div>

      {/* Config audio */}
      {showAudioSetup && callMode === 'mac' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm text-blue-900 flex items-center gap-2">
              <Mic className="w-4 h-4" /> Périphérique d'entrée audio
            </h3>
            <button onClick={loadAudioDevices} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Rafraîchir
            </button>
          </div>
          <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm bg-white">
            {audioDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Micro ' + d.deviceId.slice(0, 8) + '...'}
                {(d.label.toLowerCase().includes('phoning') || d.label.toLowerCase().includes('agrégé') || d.label.toLowerCase().includes('aggregate'))
                  ? ' ✅ (recommandé)' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-blue-700 mt-2">
            <Info className="w-3 h-3 inline mr-1" />
            Sélectionnez <strong>"Phoning Micro"</strong> (périphérique agrégé) pour capter les deux côtés de la conversation.
          </p>
        </div>
      )}

      {!speechSupported && callMode === 'mac' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="text-sm text-red-800">La reconnaissance vocale nécessite <strong>Google Chrome</strong>.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ═══ COLONNE GAUCHE ═══ */}
        <div className="lg:col-span-1 space-y-4">

          {/* Sélecteur prospect */}
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> Prospect
            </h3>
            <div className="relative">
              <div className="flex items-center border rounded-lg px-3 py-2 bg-white">
                <Search className="w-4 h-4 text-gray-400 mr-2" />
                <input type="text" value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowClientList(true) }}
                  onFocus={() => setShowClientList(true)}
                  placeholder="Rechercher un prospect..."
                  className="w-full text-sm outline-none" />
                {selectedClient && (
                  <button onClick={() => { setSelectedClient(null); setSearch('') }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {showClientList && search && filteredClients.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredClients.map(c => (
                    <button key={c.id} onClick={() => { setSelectedClient(c); setSearch(c.name); setShowClientList(false) }}
                      className={'w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0 text-sm ' + (selectedClient?.id === c.id ? 'bg-blue-50' : '')}>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500 flex gap-2">
                        {c.contact_name && <span>{c.contact_name}</span>}
                        {c.city && <span>• {c.city}</span>}
                        <span className="ml-auto">
                          {c.status === 'prospect' ? '🎯' : c.status === 'en_discussion' ? '💬' : c.status === 'actif' ? '✅' : '📁'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedClient && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-sm">{selectedClient.name}</p>
                {selectedClient.contact_name && (
                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    <User className="w-3 h-3" /> {selectedClient.contact_name}
                    {selectedClient.contact_function && <span className="text-gray-400">— {selectedClient.contact_function}</span>}
                  </p>
                )}
                {(selectedClient.contact_phone || selectedClient.phone) && (
                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <a href={'tel:' + (selectedClient.contact_phone || selectedClient.phone)} className="text-blue-600 hover:underline font-medium">
                      {selectedClient.contact_phone || selectedClient.phone}
                    </a>
                  </p>
                )}
                {selectedClient.city && (
                  <p className="text-xs text-gray-400">{selectedClient.address || ''} {selectedClient.city}</p>
                )}
                {selectedClient.notes && (
                  <details className="mt-2 border-t pt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">Notes existantes</summary>
                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{selectedClient.notes}</p>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Contrôles — MODE MAC */}
          {callMode === 'mac' && (
            <div className="card p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-red-500" /> Enregistrement vocal
              </h3>

              {(isRecording || duration > 0) && (
                <div className={'text-center py-3 rounded-lg ' + (isRecording && !isPaused ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200')}>
                  <div className={'text-3xl font-mono font-bold ' + (isRecording && !isPaused ? 'text-red-600' : 'text-gray-600')}>
                    {formatDuration(duration)}
                  </div>
                  {isRecording && !isPaused && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-xs text-red-600 font-medium">Transcription en cours...</span>
                    </div>
                  )}
                  {isPaused && <span className="text-xs text-amber-600 font-medium">⏸ En pause</span>}
                </div>
              )}

              <div className="flex gap-2">
                {!isRecording ? (
                  <button onClick={startRecording} disabled={!speechSupported || !selectedClient}
                    className="btn btn-primary flex-1 flex items-center justify-center gap-2 py-3 disabled:opacity-50">
                    <Mic className="w-5 h-5" /> Démarrer l'appel
                  </button>
                ) : (
                  <>
                    {!isPaused ? (
                      <button onClick={pauseRecording} className="btn btn-secondary flex-1 flex items-center justify-center gap-2">
                        <Pause className="w-4 h-4" /> Pause
                      </button>
                    ) : (
                      <button onClick={resumeRecording} className="btn btn-secondary flex-1 flex items-center justify-center gap-2">
                        <Play className="w-4 h-4" /> Reprendre
                      </button>
                    )}
                    <button onClick={stopRecording} className="btn flex-1 flex items-center justify-center gap-2 bg-red-600 text-white hover:bg-red-700">
                      <Square className="w-4 h-4" /> Terminer
                    </button>
                  </>
                )}
              </div>

              {!isRecording && !transcript && (
                <p className="text-xs text-gray-400 text-center">Sélectionnez un prospect puis démarrez l'appel</p>
              )}
            </div>
          )}

          {/* MODE IPHONE */}
          {callMode === 'iphone' && (
            <div className="card p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-600" /> Mode rapide (iPhone)
              </h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  Pas de transcription depuis l'iPhone (bloqué en France sur iOS).
                  Notez le résultat et les points clés manuellement.
                </p>
              </div>
            </div>
          )}

          {/* Résultat */}
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm">Résultat de l'appel</h3>
            <div className="flex gap-1.5 flex-wrap">
              {OUTCOMES.map(o => (
                <button key={o.value} onClick={() => setOutcome(o.value)}
                  className={'px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ' + (outcome === o.value ? o.active : o.color)}>
                  {o.icon} {o.label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-gray-500">Prochaine action</label>
              <input type="text" className="input text-sm w-full mt-1" value={nextAction}
                onChange={(e) => setNextAction(e.target.value)} placeholder="Ex: Envoyer devis SST 12 personnes" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Date de relance</label>
              <input type="date" className="input text-sm w-full mt-1" value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Notes</label>
              <textarea className="input text-sm w-full mt-1" rows={callMode === 'iphone' ? 4 : 2}
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={callMode === 'iphone' ? 'Résumez l\'appel : besoins, objections, points clés...' : 'Notes complémentaires...'} />
            </div>

            {callMode === 'iphone' && notes.trim().length > 30 && (
              <button onClick={() => analyzeTranscript(notes)} disabled={analyzing}
                className="btn btn-secondary w-full text-sm flex items-center justify-center gap-2">
                {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                Analyser mes notes avec l'IA
              </button>
            )}

            <button onClick={saveCallLog} disabled={saving || !selectedClient}
              className="btn btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder l'appel
            </button>
          </div>
        </div>

        {/* ═══ COLONNE DROITE ═══ */}
        <div className="lg:col-span-2 space-y-4">

          {/* Transcription — mode Mac */}
          {callMode === 'mac' && (
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" /> Transcription
                </h3>
                <div className="flex items-center gap-2">
                  {transcript && <span className="text-xs text-gray-400">{transcript.split(/\s+/).filter(Boolean).length} mots</span>}
                  {transcript && !isRecording && (
                    <button onClick={() => analyzeTranscript()} disabled={analyzing}
                      className="btn btn-primary text-sm flex items-center gap-2">
                      {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                      Analyser avec l'IA
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto text-sm leading-relaxed">
                {!transcript && !interimText && !isRecording && (
                  <p className="text-gray-400 italic">La transcription apparaîtra ici en temps réel...</p>
                )}
                {!transcript && !interimText && isRecording && (
                  <p className="text-gray-400 italic flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    En écoute — parlez pour démarrer la transcription...
                  </p>
                )}
                {transcript && <p className="text-gray-800 whitespace-pre-wrap">{transcript}</p>}
                {interimText && <span className="text-blue-400 italic">{interimText}</span>}
                <div ref={transcriptEndRef} />
              </div>
              {!isRecording && transcript && (
                <div>
                  <label className="text-xs text-gray-500">Corriger la transcription</label>
                  <textarea className="input text-sm w-full mt-1 font-mono" rows={4}
                    value={transcript} onChange={(e) => setTranscript(e.target.value)} />
                </div>
              )}
            </div>
          )}

          {/* Analyse IA */}
          {(aiAnalysis || analyzing) && (
            <div className="card p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-600" /> Analyse IA
                {analyzing && <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />}
              </h3>
              {aiAnalysis && (
                <div className="space-y-3">
                  {aiAnalysis.resume && (
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-sm font-medium text-purple-900">{aiAnalysis.resume}</p>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {aiAnalysis.temperature && TEMP_COLORS[aiAnalysis.temperature] && (
                      <span className={'px-3 py-1 rounded-full text-xs font-medium ' + TEMP_COLORS[aiAnalysis.temperature].bg + ' ' + TEMP_COLORS[aiAnalysis.temperature].text}>
                        {TEMP_COLORS[aiAnalysis.temperature].label}
                      </span>
                    )}
                    {aiAnalysis.statut_suggere && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Statut : {aiAnalysis.statut_suggere}</span>
                    )}
                    {aiAnalysis.nb_stagiaires_estime && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">~{aiAnalysis.nb_stagiaires_estime} stagiaires</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {aiAnalysis.besoin && (
                      <div className="bg-green-50 rounded p-3">
                        <p className="text-xs font-medium text-green-700 mb-1">🎯 Besoin identifié</p>
                        <p className="text-sm text-green-900">{aiAnalysis.besoin}</p>
                      </div>
                    )}
                    {aiAnalysis.objections && (
                      <div className="bg-red-50 rounded p-3">
                        <p className="text-xs font-medium text-red-700 mb-1">⚠️ Objections</p>
                        <p className="text-sm text-red-900">{aiAnalysis.objections}</p>
                      </div>
                    )}
                    {aiAnalysis.next_action && (
                      <div className="bg-blue-50 rounded p-3">
                        <p className="text-xs font-medium text-blue-700 mb-1">📋 Action suivante</p>
                        <p className="text-sm text-blue-900">{aiAnalysis.next_action}</p>
                      </div>
                    )}
                    {aiAnalysis.relance_date_suggestion && (
                      <div className="bg-amber-50 rounded p-3">
                        <p className="text-xs font-medium text-amber-700 mb-1">📅 Relance</p>
                        <p className="text-sm text-amber-900">{aiAnalysis.relance_date_suggestion}</p>
                      </div>
                    )}
                  </div>
                  {(aiAnalysis.formations_identifiees?.length > 0 || aiAnalysis.opco_mentionne) && (
                    <div className="flex gap-2 flex-wrap">
                      {aiAnalysis.formations_identifiees?.map((f, i) => (
                        <span key={i} className="px-2 py-1 rounded bg-indigo-100 text-indigo-800 text-xs font-medium">🎓 {f}</span>
                      ))}
                      {aiAnalysis.opco_mentionne && (
                        <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-medium">💼 {aiAnalysis.opco_mentionne}</span>
                      )}
                    </div>
                  )}
                  {aiAnalysis.tags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {aiAnalysis.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Historique */}
          {showHistory && (
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2"><History className="w-4 h-4 text-gray-600" /> Historique des appels</h3>
                <span className="text-xs text-gray-400">{callHistory.length} appels</span>
              </div>
              {callHistory.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-6">Aucun appel enregistré</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {callHistory.map(call => {
                    const outcomeInfo = OUTCOMES.find(o => o.value === call.outcome) || OUTCOMES[0]
                    const expanded = historyExpanded === call.id
                    return (
                      <div key={call.id} className="border rounded-lg hover:shadow-sm transition-shadow">
                        <button onClick={() => setHistoryExpanded(expanded ? null : call.id)} className="w-full text-left p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span>{outcomeInfo.icon}</span>
                              <span className="font-medium text-sm">{call.clients?.name || 'Inconnu'}</span>
                              {call.ai_summary?.temperature && TEMP_COLORS[call.ai_summary.temperature] && (
                                <span className={'px-1.5 py-0.5 rounded text-xs ' + TEMP_COLORS[call.ai_summary.temperature].bg + ' ' + TEMP_COLORS[call.ai_summary.temperature].text}>
                                  {TEMP_COLORS[call.ai_summary.temperature].label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">
                                {new Date(call.created_at).toLocaleDateString('fr-FR')} {new Date(call.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {call.duration_seconds > 0 && <span className="text-xs text-gray-400">({formatDuration(call.duration_seconds)})</span>}
                              {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>
                          </div>
                          {!expanded && call.ai_summary?.resume && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{call.ai_summary.resume}</p>
                          )}
                        </button>
                        {expanded && (
                          <div className="px-3 pb-3 space-y-2 border-t pt-2">
                            {call.ai_summary?.resume && <p className="text-sm text-gray-700">{call.ai_summary.resume}</p>}
                            {call.ai_summary?.besoin && <p className="text-xs"><span className="font-medium text-green-700">Besoin :</span> {call.ai_summary.besoin}</p>}
                            {call.ai_summary?.objections && <p className="text-xs"><span className="font-medium text-red-700">Objections :</span> {call.ai_summary.objections}</p>}
                            {call.next_action && <p className="text-xs text-blue-600">→ {call.next_action}</p>}
                            {call.next_action_date && <p className="text-xs text-amber-600">📅 Relance : {new Date(call.next_action_date).toLocaleDateString('fr-FR')}</p>}
                            {call.notes && <p className="text-xs text-gray-500 italic">{call.notes}</p>}
                            {call.transcript && (
                              <details className="text-xs">
                                <summary className="text-gray-400 cursor-pointer">Transcription complète</summary>
                                <p className="mt-1 text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded max-h-40 overflow-y-auto">{call.transcript}</p>
                              </details>
                            )}
                            <div className="flex justify-end">
                              <button onClick={() => deleteCall(call.id)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                                <Trash2 className="w-3 h-3" /> Supprimer
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Messages d'accueil */}
          {callMode === 'iphone' && !aiAnalysis && !showHistory && (
            <div className="card p-8 text-center">
              <Smartphone className="w-12 h-12 text-blue-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-700 mb-1">Mode rapide — Appel iPhone</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Passez votre appel, puis saisissez le résultat et vos notes ici.
                Si vos notes font plus de 30 caractères, l'IA peut les analyser.
              </p>
            </div>
          )}

          {callMode === 'mac' && !transcript && !isRecording && !aiAnalysis && !showHistory && (
            <div className="card p-8 text-center">
              <Monitor className="w-12 h-12 text-blue-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-700 mb-1">Mode transcription — Appel Mac</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Sélectionnez un prospect, vérifiez le micro dans "Config audio", puis démarrez.
                La transcription apparaît en temps réel et l'IA analyse à la fin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
