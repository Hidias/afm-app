import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SignatureCanvas from 'react-signature-canvas'
import { 
  Calendar, 
  MapPin, 
  Users, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Trash2,
  Send
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function PublicAttendance() {
  const { token } = useParams()
  const [session, setSession] = useState(null)
  const [trainees, setTrainees] = useState([])
  const [attendances, setAttendances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTrainee, setSelectedTrainee] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState('full')
  const [signing, setSigning] = useState(false)
  const sigCanvas = useRef(null)
  
  useEffect(() => {
    loadSession()
  }, [token])
  
  const loadSession = async () => {
    try {
      // Charger la session par token
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
          courses(title, duration_hours),
          clients(name),
          session_trainees(trainee_id, trainees(id, first_name, last_name, email))
        `)
        .eq('attendance_token', token)
        .single()
      
      if (sessionError) throw sessionError
      if (!sessionData) throw new Error('Session non trouvée')
      
      setSession(sessionData)
      setTrainees(sessionData.session_trainees?.map(st => st.trainees) || [])
      
      // Charger les émargements existants
      const { data: attendanceData } = await supabase
        .from('attendances')
        .select('*')
        .eq('session_id', sessionData.id)
        .eq('date', format(new Date(), 'yyyy-MM-dd'))
      
      setAttendances(attendanceData || [])
    } catch (err) {
      console.error(err)
      setError('Session non trouvée ou lien invalide')
    } finally {
      setLoading(false)
    }
  }
  
  const hasSignedToday = (traineeId, period = null) => {
    return attendances.some(a => 
      a.trainee_id === traineeId && 
      (period ? a.period === period : true)
    )
  }
  
  const clearSignature = () => {
    sigCanvas.current?.clear()
  }
  
  const submitSignature = async () => {
    if (!selectedTrainee || sigCanvas.current?.isEmpty()) {
      toast.error('Veuillez sélectionner un stagiaire et signer')
      return
    }
    
    setSigning(true)
    
    try {
      const signatureData = sigCanvas.current.toDataURL('image/png')
      
      // Calculer un hash simple de la signature
      const signatureHash = btoa(signatureData.substring(0, 100))
      
      // Créer l'émargement
      const { data, error } = await supabase
        .from('attendances')
        .insert([{
          session_id: session.id,
          trainee_id: selectedTrainee,
          date: format(new Date(), 'yyyy-MM-dd'),
          period: selectedPeriod,
          signature_data: signatureData,
          signature_hash: signatureHash,
          signed_at: new Date().toISOString(),
          ip_address: null, // Serait récupéré côté serveur
          user_agent: navigator.userAgent
        }])
        .select()
        .single()
      
      if (error) throw error
      
      toast.success('Émargement enregistré !')
      setAttendances([...attendances, data])
      setSelectedTrainee(null)
      clearSignature()
    } catch (err) {
      console.error(err)
      if (err.code === '23505') {
        toast.error('Vous avez déjà émargé pour cette période')
      } else {
        toast.error('Erreur lors de l\'enregistrement')
      }
    } finally {
      setSigning(false)
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Erreur</h2>
        <p className="text-gray-500">{error}</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Info session */}
      <div className="card">
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {session.courses?.title}
        </h1>
        <p className="text-gray-600 mb-4">{session.clients?.name}</p>
        
        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {format(new Date(session.start_date), 'd MMMM yyyy', { locale: fr })}
          </span>
          {session.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {session.location}
            </span>
          )}
        </div>
      </div>
      
      {/* Date du jour */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-center">
        <p className="text-primary-700 font-medium">
          Émargement du {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        </p>
      </div>
      
      {/* Liste des stagiaires */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Stagiaires</h2>
        
        <div className="space-y-3">
          {trainees.map(trainee => {
            const signedAM = hasSignedToday(trainee.id, 'am')
            const signedPM = hasSignedToday(trainee.id, 'pm')
            const signedFull = hasSignedToday(trainee.id, 'full')
            const fullySign = signedFull || (signedAM && signedPM)
            
            return (
              <div 
                key={trainee.id}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  selectedTrainee === trainee.id
                    ? 'border-primary-500 bg-primary-50'
                    : fullySign
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                }`}
                onClick={() => !fullySign && setSelectedTrainee(trainee.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {trainee.first_name} {trainee.last_name}
                    </p>
                    {trainee.email && (
                      <p className="text-sm text-gray-500">{trainee.email}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {signedFull ? (
                      <span className="badge badge-green flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Journée
                      </span>
                    ) : (
                      <>
                        {signedAM && (
                          <span className="badge badge-green">Matin ✓</span>
                        )}
                        {signedPM && (
                          <span className="badge badge-green">Après-midi ✓</span>
                        )}
                        {!signedAM && !signedPM && (
                          <span className="badge badge-gray">Non émargé</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Zone de signature */}
      {selectedTrainee && (
        <div className="card animate-fadeIn">
          <h2 className="font-semibold text-gray-900 mb-4">
            Signature de {trainees.find(t => t.id === selectedTrainee)?.first_name}
          </h2>
          
          {/* Choix de la période */}
          <div className="mb-4">
            <label className="label">Période</label>
            <div className="flex gap-3">
              {[
                { id: 'am', label: 'Matin' },
                { id: 'pm', label: 'Après-midi' },
                { id: 'full', label: 'Journée entière' },
              ].map(period => {
                const alreadySigned = hasSignedToday(selectedTrainee, period.id)
                return (
                  <button
                    key={period.id}
                    onClick={() => !alreadySigned && setSelectedPeriod(period.id)}
                    disabled={alreadySigned}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                      selectedPeriod === period.id
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : alreadySigned
                        ? 'border-green-200 bg-green-50 text-green-700 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {period.label}
                    {alreadySigned && ' ✓'}
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Canvas signature */}
          <div className="mb-4">
            <label className="label">Signez dans le cadre ci-dessous</label>
            <SignatureCanvas
              ref={sigCanvas}
              penColor="black"
              canvasProps={{
                className: 'signature-canvas w-full h-48 rounded-lg'
              }}
            />
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={clearSignature}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Effacer
            </button>
            <button
              onClick={() => setSelectedTrainee(null)}
              className="btn btn-secondary"
            >
              Annuler
            </button>
            <button
              onClick={submitSignature}
              disabled={signing}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {signing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Valider l'émargement
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Message si pas de stagiaire sélectionné */}
      {!selectedTrainee && trainees.length > 0 && (
        <div className="text-center py-4 text-gray-500">
          Cliquez sur votre nom pour émarger
        </div>
      )}
    </div>
  )
}
