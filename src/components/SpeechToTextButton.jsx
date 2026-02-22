import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Square } from 'lucide-react'

/**
 * Bouton micro pour dictée vocale (Speech-to-Text)
 * v3 : ne s'arrête JAMAIS tant que l'utilisateur n'a pas cliqué Stop
 *      Chrome coupe la reconnaissance après quelques secondes de silence,
 *      on relance automatiquement en boucle.
 */
export default function SpeechToTextButton({ 
  onTranscript, 
  lang = 'fr-FR', 
  compact = false,
  className = '' 
}) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [interim, setInterim] = useState('')
  const wantListeningRef = useRef(false)
  const recognitionRef = useRef(null)
  const restartTimerRef = useRef(null)
  const onTranscriptRef = useRef(onTranscript)

  // Garder la ref à jour sans recréer l'instance
  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])

  // Créer une instance de reconnaissance
  const createRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setIsSupported(false); return null }

    const r = new SR()
    r.lang = lang
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1

    r.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript
        } else {
          interimText += event.results[i][0].transcript
        }
      }
      if (finalText) {
        onTranscriptRef.current(finalText.trim())
        setInterim('')
      } else {
        setInterim(interimText)
      }
    }

    r.onerror = (event) => {
      console.warn('Speech error:', event.error)
      // Seule erreur fatale = permission refusée
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setIsSupported(false)
        wantListeningRef.current = false
        setIsListening(false)
        setInterim('')
        return
      }
      // Toutes les autres erreurs (no-speech, network, aborted) → on laisse onend relancer
    }

    r.onend = () => {
      // Chrome a coupé la reconnaissance (silence, timeout interne, etc.)
      // Si l'utilisateur veut encore écouter → RELANCER
      if (wantListeningRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(() => {
          if (!wantListeningRef.current) return
          try {
            // Créer une nouvelle instance (plus fiable que réutiliser l'ancienne)
            const newR = createRecognition()
            if (newR) {
              recognitionRef.current = newR
              newR.start()
            }
          } catch (e) {
            console.warn('Restart failed:', e)
            // Retry encore une fois après 500ms
            restartTimerRef.current = setTimeout(() => {
              if (!wantListeningRef.current) return
              try {
                const retry = createRecognition()
                if (retry) { recognitionRef.current = retry; retry.start() }
              } catch (e2) {
                wantListeningRef.current = false
                setIsListening(false)
                setInterim('')
              }
            }, 500)
          }
        }, 200)
      } else {
        setIsListening(false)
        setInterim('')
      }
    }

    return r
  }, [lang])

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      wantListeningRef.current = false
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
      try { recognitionRef.current?.stop() } catch (e) {}
    }
  }, [])

  const startListening = useCallback(() => {
    const r = createRecognition()
    if (!r) return
    recognitionRef.current = r
    wantListeningRef.current = true
    try {
      r.start()
      setIsListening(true)
      setInterim('')
    } catch (e) {
      console.warn('Start failed:', e)
      wantListeningRef.current = false
    }
  }, [createRecognition])

  const stopListening = useCallback(() => {
    wantListeningRef.current = false
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
    try { recognitionRef.current?.stop() } catch (e) {}
    setIsListening(false)
    setInterim('')
  }, [])

  const toggle = () => isListening ? stopListening() : startListening()

  if (!isSupported) return null

  return (
    <div className={`inline-flex flex-col items-end ${className}`}>
      <button
        type="button"
        onClick={toggle}
        title={isListening ? 'Arrêter la dictée' : 'Dicter (micro)'}
        className={`
          inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200
          ${compact ? 'w-8 h-8' : 'px-3 py-1.5 text-xs'}
          ${isListening 
            ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse hover:bg-red-600' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
          }
        `}
      >
        {isListening ? (
          <>
            <Square className={compact ? 'w-3.5 h-3.5' : 'w-3 h-3'} fill="currentColor" />
            {!compact && 'Stop'}
          </>
        ) : (
          <>
            <Mic className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
            {!compact && 'Micro'}
          </>
        )}
      </button>
      {isListening && (
        <div className={`mt-1 px-2 py-1 rounded text-xs max-w-[220px] ${interim ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-red-50 text-red-400'}`}>
          {interim ? `${interim}...` : '🎙️ Parlez...'}
        </div>
      )}
    </div>
  )
}
