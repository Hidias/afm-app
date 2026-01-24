import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import SessionsInter from './pages/SessionsInter'
import SessionInterNouvelle from './pages/SessionInterNouvelle'
import SessionInterDetail from './pages/SessionInterDetail'
import SessionDetail from './pages/SessionDetail'
import Documents from './pages/Documents'
import DocumentsVierges from './pages/DocumentsVierges'
import Questionnaires from './pages/Questionnaires'
import Settings from './pages/Settings'
import VersionHistory from './pages/VersionHistory'
import NonConformites from './pages/NonConformites'
import Indicateurs from './pages/Indicateurs'
import ProfilStagiaires from './pages/ProfilStagiaires'
import TestsPositionnement from './pages/TestsPositionnement'
import VeilleQualiopi from './pages/VeilleQualiopi'
import Qualiopi from './pages/Qualiopi'
import AuditLogs from './pages/AuditLogs'
import Changelog from './pages/Changelog'
import QualiteEditables from './pages/QualiteEditables'
import Completude from './pages/Completude'
import Login from './pages/Login'

// Pages publiques (émargement, questionnaires)
import PublicAttendance from './pages/public/Attendance'
import PublicQuestionnaire from './pages/public/Questionnaire'
import PublicInfoSheet from './pages/public/InfoSheet'
import PublicHotEvaluation from './pages/public/HotEvaluation'
import TraineePortal from './pages/public/TraineePortal'
import TraineePortalInter from './pages/TraineePortalInter'
import PublicReclamation from './pages/public/Reclamation'

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
    <HashRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0F2D35',
            color: '#fff',
            borderLeft: '4px solid #E9B44C',
          },
          success: {
            iconTheme: {
              primary: '#E9B44C',
              secondary: '#0F2D35',
            },
          },
          error: {
            style: {
              background: '#0F2D35',
              borderLeft: '4px solid #ef4444',
            },
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
        
        {/* Formulaire de réclamation public */}
        <Route path="/reclamation" element={<PublicReclamation />} />
        
        {/* QR Code Unifié - Portail Stagiaire INTRA */}
        <Route path="/portail/:token" element={<TraineePortal />} />
        
        {/* Portail Stagiaire INTER-ENTREPRISE */}
        <Route path="/portail-inter/:code" element={<TraineePortalInter />} />
        
        {/* Anciennes routes (rétrocompatibilité) */}
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
        <Route path="/fiche-renseignement/:token" element={
          <PublicInfoSheet />
        } />
        <Route path="/evaluation-chaud/:token" element={
          <PublicHotEvaluation />
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
          <Route path="sessions-inter" element={<SessionsInter />} />
          <Route path="sessions-inter/nouvelle" element={<SessionInterNouvelle />} />
          <Route path="sessions-inter/:id" element={<SessionInterDetail />} />
          <Route path="documents" element={<Documents />} />
          <Route path="documents-vierges" element={<DocumentsVierges />} />
          <Route path="qualite" element={<QualiteEditables />} />
          <Route path="qualite/completude" element={<Completude />} />
          <Route path="tests-positionnement" element={<TestsPositionnement />} />
          <Route path="questionnaires" element={<Questionnaires />} />
          <Route path="non-conformites" element={<NonConformites />} />
          <Route path="indicateurs" element={<Indicateurs />} />
          <Route path="profil-stagiaires" element={<ProfilStagiaires />} />
          <Route path="qualiopi" element={<Qualiopi />} />
          <Route path="veille-qualiopi" element={<VeilleQualiopi />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="parametres" element={<Settings />} />
          <Route path="versions" element={<VersionHistory />} />
          <Route path="changelog" element={<Changelog />} />
        </Route>
        
        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
