import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Square } from 'lucide-react'

/**
 * Bouton micro pour dictée vocale (Speech-to-Text)
 * Utilise l'API Web Speech native du navigateur (gratuit, pas d'API externe)
 * 
 * v2 : arrêt MANUEL uniquement (plus d'auto-coupure)
 *      - Clic 1 = démarrer l'écoute (micro rouge pulsant)
 *      - Clic 2 = stopper (⏹ Stop)
 *      - Si le navigateur coupe tout seul → relance auto
 * 
 * Usage :
 *   <SpeechToTextButton onTranscript={(text) => setNotes(prev => prev ? prev + ' ' + text : text)} />
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
  const recognitionRef = useRef(null)
  const wantListeningRef = useRef(false)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += transcript
        } else {
          interimText += transcript
        }
      }

      if (finalText) {
        onTranscript(finalText.trim())
        setInterim('')
      } else {
        setInterim(interimText)
      }
    }

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        setIsSupported(false)
        wantListeningRef.current = false
        setIsListening(false)
        setInterim('')
      }
      // no-speech et network : onend gère le restart
    }

    // Le navigateur coupe parfois la reconnaissance tout seul
    // Si l'utilisateur n'a pas cliqué Stop → relancer automatiquement
    recognition.onend = () => {
      if (wantListeningRef.current) {
        try {
          setTimeout(() => {
            if (wantListeningRef.current) recognition.start()
          }, 100)
        } catch (e) {
          wantListeningRef.current = false
          setIsListening(false)
          setInterim('')
        }
      } else {
        setIsListening(false)
        setInterim('')
      }
    }

    recognitionRef.current = recognition

    return () => {
      wantListeningRef.current = false
      try { recognitionRef.current?.stop() } catch (e) {}
    }
  }, [lang, onTranscript])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    try {
      wantListeningRef.current = true
      recognitionRef.current.start()
      setIsListening(true)
    } catch (e) {
      console.warn('Could not start speech recognition:', e)
      wantListeningRef.current = false
    }
  }, [])

  const stopListening = useCallback(() => {
    wantListeningRef.current = false
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
