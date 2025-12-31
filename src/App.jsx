import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './lib/store'

// Layouts
import Layout from './components/Layout'
import PublicLayout from './components/PublicLayout'

// Pages privées
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Courses from './pages/Courses'
import Trainers from './pages/Trainers'
import Trainees from './pages/Trainees'
import Sessions from './pages/Sessions'
import SessionDetail from './pages/SessionDetail'
import Documents from './pages/Documents'
import DocumentsVierges from './pages/DocumentsVierges'
import Questionnaires from './pages/Questionnaires'
import Settings from './pages/Settings'
import NonConformites from './pages/NonConformites'
import Login from './pages/Login'

// Pages publiques (émargement, questionnaires)
import PublicAttendance from './pages/public/Attendance'
import PublicQuestionnaire from './pages/public/Questionnaire'

// Composant de protection des routes
function PrivateRoute({ children }) {
  const { user, loading } = useAuthStore()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

export default function App() {
  const initialize = useAuthStore(state => state.initialize)
  
  useEffect(() => {
    initialize()
  }, [initialize])
  
  return (
    <BrowserRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <Routes>
        {/* Routes publiques */}
        <Route path="/login" element={<Login />} />
        <Route path="/emargement/:token" element={
          <PublicLayout>
            <PublicAttendance />
          </PublicLayout>
        } />
        <Route path="/questionnaire/:token" element={
          <PublicLayout>
            <PublicQuestionnaire />
          </PublicLayout>
        } />
        
        {/* Routes privées */}
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="formations" element={<Courses />} />
          <Route path="formateurs" element={<Trainers />} />
          <Route path="stagiaires" element={<Trainees />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="sessions/:id" element={<SessionDetail />} />
          <Route path="documents" element={<Documents />} />
          <Route path="documents-vierges" element={<DocumentsVierges />} />
          <Route path="questionnaires" element={<Questionnaires />} />
          <Route path="non-conformites" element={<NonConformites />} />
          <Route path="parametres" element={<Settings />} />
        </Route>
        
        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
