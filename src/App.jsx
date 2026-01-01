import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { supabase } from './lib/supabase'
import { useStore } from './lib/store'

// Layout
import Layout from './components/Layout'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientForm from './pages/ClientForm'
import Courses from './pages/Courses'
import CourseForm from './pages/CourseForm'
import Trainers from './pages/Trainers'
import TrainerForm from './pages/TrainerForm'
import Trainees from './pages/Trainees'
import TraineeForm from './pages/TraineeForm'
import Sessions from './pages/Sessions'
import SessionForm from './pages/SessionForm'
import SessionDetail from './pages/SessionDetail'
import NonConformities from './pages/NonConformities'
import NonConformityForm from './pages/NonConformityForm'
import Settings from './pages/Settings'
import DocumentsVierges from './pages/DocumentsVierges'
import CompletenessReport from './pages/CompletenessReport'
import QualiopiReport from './pages/QualiopiReport'

// Pages publiques
import SignaturePage from './pages/SignaturePage'

function App() {
  const { user, setUser, loading, setLoading, loadAllData } = useStore()
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    // Vérifier la session au chargement
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setInitializing(false)
      if (session?.user) {
        loadAllData()
      }
      setLoading(false)
    })

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadAllData()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {/* Routes publiques */}
        <Route path="/signature/:sessionId" element={<SignaturePage />} />
        
        {/* Routes authentifiées */}
        {user ? (
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/new" element={<ClientForm />} />
            <Route path="clients/:id" element={<ClientForm />} />
            <Route path="formations" element={<Courses />} />
            <Route path="formations/new" element={<CourseForm />} />
            <Route path="formations/:id" element={<CourseForm />} />
            <Route path="formateurs" element={<Trainers />} />
            <Route path="formateurs/new" element={<TrainerForm />} />
            <Route path="formateurs/:id" element={<TrainerForm />} />
            <Route path="stagiaires" element={<Trainees />} />
            <Route path="stagiaires/new" element={<TraineeForm />} />
            <Route path="stagiaires/:id" element={<TraineeForm />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="sessions/new" element={<SessionForm />} />
            <Route path="sessions/:id" element={<SessionDetail />} />
            <Route path="sessions/:id/edit" element={<SessionForm />} />
            <Route path="non-conformites" element={<NonConformities />} />
            <Route path="non-conformites/new" element={<NonConformityForm />} />
            <Route path="non-conformites/:id" element={<NonConformityForm />} />
            <Route path="parametres" element={<Settings />} />
            <Route path="documents-vierges" element={<DocumentsVierges />} />
            <Route path="completude" element={<CompletenessReport />} />
            <Route path="qualiopi" element={<QualiopiReport />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </>
  )
}

export default App
