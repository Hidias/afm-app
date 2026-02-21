import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'

/**
 * Bouton micro pour dictée vocale (Speech-to-Text)
 * Utilise l'API Web Speech native du navigateur (gratuit, pas d'API externe)
 * 
 * Usage :
 *   <SpeechToTextButton onTranscript={(text) => setNotes(prev => prev ? prev + ' ' + text : text)} />
 * 
 * Props :
 *   onTranscript(text)  — appelé quand du texte est reconnu (résultat final)
 *   lang                — langue (défaut: 'fr-FR')
 *   compact             — bouton petit (défaut: false)
 *   className           — classes additionnelles
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
  const timeoutRef = useRef(null)

  useEffect(() => {
    // Vérifier la compatibilité du navigateur
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

      // Reset le timeout d'inactivité à chaque résultat
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        stopListening()
      }, 8000) // Arrêt auto après 8s de silence
    }

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        setIsSupported(false)
      }
      setIsListening(false)
      setInterim('')
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterim('')
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch (e) {}
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [lang, onTranscript])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    try {
      recognitionRef.current.start()
      setIsListening(true)
      // Timeout de sécurité : arrêt après 60s max
      timeoutRef.current = setTimeout(() => stopListening(), 60000)
    } catch (e) {
      console.warn('Could not start speech recognition:', e)
    }
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    try {
      recognitionRef.current.stop()
    } catch (e) {}
    setIsListening(false)
    setInterim('')
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const toggle = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // Navigateur non compatible
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
            <MicOff className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
            {!compact && 'Stop'}
          </>
        ) : (
          <>
            <Mic className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
            {!compact && 'Micro'}
          </>
        )}
      </button>
      {/* Texte en cours de reconnaissance (interim) */}
      {isListening && interim && (
        <div className="mt-1 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-700 max-w-[200px] truncate">
          {interim}...
        </div>
      )}
    </div>
  )
}
