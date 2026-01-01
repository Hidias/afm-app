import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function SignaturePage() {
  const { sessionId } = useParams()
  const canvasRef = useRef(null)
  
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [trainees, setTrainees] = useState([])
  const [selectedTrainee, setSelectedTrainee] = useState('')
  const [period, setPeriod] = useState('morning')
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)

  useEffect(() => {
    loadSessionData()
  }, [sessionId])

  const loadSessionData = async () => {
    try {
      // Charger la session avec les infos de la formation
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
          course:courses(title),
          client:clients(name)
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError) throw sessionError
      
      setSession(sessionData)

      // Charger les stagiaires de cette session
      const { data: traineeData, error: traineeError } = await supabase
        .from('session_trainees')
        .select(`
          trainee:trainees(id, first_name, last_name)
        `)
        .eq('session_id', sessionId)

      if (traineeError) throw traineeError

      setTrainees(traineeData.map(st => st.trainee))
      setLoading(false)
    } catch (err) {
      setError('Session introuvable ou expirée')
      setLoading(false)
    }
  }

  const startDrawing = (e) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }, [loading])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedTrainee) {
      toast.error('Veuillez sélectionner votre nom')
      return
    }

    // Vérifier si la signature est vide
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = imageData.data
    let isEmpty = true
    
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 255 || pixels[i + 1] < 255 || pixels[i + 2] < 255) {
        isEmpty = false
        break
      }
    }
    
    if (isEmpty) {
      toast.error('Veuillez signer dans le cadre')
      return
    }

    setSigning(true)
    
    try {
      // Convertir la signature en image
      const signatureUrl = canvas.toDataURL('image/png')
      
      // Date du jour
      const today = new Date().toISOString().split('T')[0]
      
      // Enregistrer l'émargement
      const attendanceData = {
        session_id: sessionId,
        trainee_id: selectedTrainee,
        date: today,
        signature_url: signatureUrl,
        signature_ip: 'web',
        signature_timestamp: new Date().toISOString()
      }
      
      if (period === 'morning') {
        attendanceData.morning_present = true
      } else {
        attendanceData.afternoon_present = true
      }

      // Vérifier si une entrée existe déjà
      const { data: existing } = await supabase
        .from('daily_attendances')
        .select('id, morning_present, afternoon_present')
        .eq('session_id', sessionId)
        .eq('trainee_id', selectedTrainee)
        .eq('date', today)
        .single()

      if (existing) {
        // Mettre à jour l'existant
        const updateData = {
          signature_url: signatureUrl,
          signature_timestamp: new Date().toISOString()
        }
        if (period === 'morning') {
          updateData.morning_present = true
        } else {
          updateData.afternoon_present = true
        }
        
        const { error } = await supabase
          .from('daily_attendances')
          .update(updateData)
          .eq('id', existing.id)
        
        if (error) throw error
      } else {
        // Créer une nouvelle entrée
        const { error } = await supabase
          .from('daily_attendances')
          .insert([attendanceData])
        
        if (error) throw error
      }
      
      setSigned(true)
      toast.success('Émargement enregistré !')
    } catch (err) {
      toast.error(err.message || 'Erreur lors de l\'enregistrement')
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Erreur</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <Toaster position="top-center" />
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Émargement enregistré</h1>
          <p className="text-gray-600 mb-4">
            Merci ! Votre présence a été enregistrée pour {period === 'morning' ? 'ce matin' : 'cet après-midi'}.
          </p>
          <button
            onClick={() => {
              setSigned(false)
              setSelectedTrainee('')
              clearSignature()
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Nouvel émargement
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <Toaster position="top-center" />
      
      <div className="max-w-md mx-auto">
        {/* En-tête */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            {session?.course?.title}
          </h1>
          <p className="text-gray-600">{session?.client?.name}</p>
          <p className="text-sm text-gray-500 mt-2">
            {new Date(session?.start_date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Émargement</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sélection stagiaire */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Votre nom
              </label>
              <select
                value={selectedTrainee}
                onChange={(e) => setSelectedTrainee(e.target.value)}
                className="w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 text-lg"
                required
              >
                <option value="">Sélectionnez votre nom...</option>
                {trainees.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Période */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Période
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPeriod('morning')}
                  className={`p-3 rounded-lg border-2 font-medium transition-colors ${
                    period === 'morning'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Matin
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('afternoon')}
                  className={`p-3 rounded-lg border-2 font-medium transition-colors ${
                    period === 'afternoon'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Après-midi
                </button>
              </div>
            </div>

            {/* Zone de signature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Signature
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Effacer
                </button>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={350}
                  height={150}
                  className="w-full touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                Signez avec votre doigt ou la souris
              </p>
            </div>

            {/* Bouton de validation */}
            <button
              type="submit"
              disabled={signing}
              className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {signing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Valider mon émargement'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-4">
          Access Formation Manager
        </p>
      </div>
    </div>
  )
}
