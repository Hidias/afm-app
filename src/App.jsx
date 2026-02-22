import { useEffect, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './lib/store'

// ─── Chargement immédiat (pages critiques) ───────────────────
import Layout from './components/Layout'
import PublicLayout from './components/PublicLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// ─── Chargement différé (lazy loading) ───────────────────────
// Pages privées
const Clients = lazy(() => import('./pages/Clients'))
const ClientDetail = lazy(() => import('./pages/ClientDetail'))
const Courses = lazy(() => import('./pages/Courses'))
const Trainers = lazy(() => import('./pages/Trainers'))
const Trainees = lazy(() => import('./pages/Trainees'))
const Sessions = lazy(() => import('./pages/Sessions'))
const SessionDetail = lazy(() => import('./pages/SessionDetail'))
const Documents = lazy(() => import('./pages/Documents'))
const DocumentsVierges = lazy(() => import('./pages/DocumentsVierges'))
const Settings = lazy(() => import('./pages/Settings'))
const VersionHistory = lazy(() => import('./pages/VersionHistory'))
const NonConformites = lazy(() => import('./pages/NonConformites'))
const RegistrePSH = lazy(() => import('./pages/RegistrePSH'))
const Indicateurs = lazy(() => import('./pages/Indicateurs'))
const ProfilStagiaires = lazy(() => import('./pages/ProfilStagiaires'))
const TestsPositionnement = lazy(() => import('./pages/TestsPositionnement'))
const VeilleQualiopi = lazy(() => import('./pages/VeilleQualiopi'))
const Qualiopi = lazy(() => import('./pages/Qualiopi'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))
const Changelog = lazy(() => import('./pages/Changelog'))
const Quotes = lazy(() => import('./pages/Quotes'))
const Invoices = lazy(() => import('./pages/Invoices'))
const QualiteEditables = lazy(() => import('./pages/QualiteEditables'))
const Completude = lazy(() => import('./pages/Completude'))
const BPF = lazy(() => import('./pages/BPF'))
// Prospection
const ProspectionTabs = lazy(() => import('./pages/ProspectionTabs'))
const ProspectRDVDetail = lazy(() => import('./pages/ProspectRDVDetail'))
const ProspectionMassive = lazy(() => import('./pages/ProspectionMassive'))
const MultiEtablissements = lazy(() => import('./pages/MultiEtablissements'))
const AdminImport = lazy(() => import('./pages/AdminImport'))
// Email
const EmailSettings = lazy(() => import('./pages/EmailSettings'))
// DUERP
const DuerpProjects = lazy(() => import('./pages/DuerpProjects'))
const DuerpDetail = lazy(() => import('./pages/DuerpDetail'))
// Budget
const BudgetModule = lazy(() => import('./pages/BudgetModule'))
// Social Media
const SocialMedia = lazy(() => import('./pages/SocialMedia'))

// Pages publiques (lazy aussi — les stagiaires n'accèdent qu'à une seule)
const PublicAttendance = lazy(() => import('./pages/public/Attendance'))
const PublicQuestionnaire = lazy(() => import('./pages/public/Questionnaire'))
const PublicInfoSheet = lazy(() => import('./pages/public/InfoSheet'))
const PublicHotEvaluation = lazy(() => import('./pages/public/HotEvaluation'))
const TraineePortal = lazy(() => import('./pages/public/TraineePortal'))
const PublicReclamation = lazy(() => import('./pages/public/Reclamation'))

// ─── Spinner de chargement (affiché brièvement au lazy load) ─
function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  )
}

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
      
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Routes publiques */}
          <Route path="/login" element={<Login />} />
          
          {/* Formulaire de réclamation public */}
          <Route path="/reclamation" element={<PublicReclamation />} />
          
          {/* QR Code Unifié - Portail Stagiaire */}
          <Route path="/portail/:token" element={<TraineePortal />} />
          
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
            <Route path="devis" element={<Quotes />} />
            <Route path="factures" element={<Invoices />} />
            {/* ========== NOUVEAU : Routes Prospection ========== */}
            <Route path="prospection" element={<ProspectionTabs />} />
            <Route path="prospection/:id" element={<ProspectRDVDetail />} />
            {/* ========== NOUVEAU : Prospection Massive ========== */}
            <Route path="prospection-massive" element={<ProspectionMassive />} />
            <Route path="multi-etablissements" element={<MultiEtablissements />} />
            <Route path="admin/import" element={<AdminImport />} />
            {/* ========== NOUVEAU : Module DUERP ========== */}
            <Route path="duerp" element={<DuerpProjects />} />
            <Route path="duerp/:id" element={<DuerpDetail />} />
            {/* ========== NOUVEAU : Module Budget ========== */}
            <Route path="budget" element={<BudgetModule />} />
            {/* ========== NOUVEAU : Module Social Media ========== */}
            <Route path="social" element={<SocialMedia />} />
            {/* ================================================== */}
            <Route path="formations" element={<Courses />} />
            <Route path="formateurs" element={<Trainers />} />
            <Route path="stagiaires" element={<Trainees />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="sessions/:id" element={<SessionDetail />} />
            <Route path="documents" element={<Documents />} />
            <Route path="documents-vierges" element={<DocumentsVierges />} />
            <Route path="qualite" element={<QualiteEditables />} />
            <Route path="qualite/completude" element={<Completude />} />
            <Route path="tests-positionnement" element={<TestsPositionnement />} />
            <Route path="non-conformites" element={<NonConformites />} />
            <Route path="registre-psh" element={<RegistrePSH />} />
            <Route path="indicateurs" element={<Indicateurs />} />
            <Route path="profil-stagiaires" element={<ProfilStagiaires />} />
            <Route path="qualiopi" element={<Qualiopi />} />
            <Route path="bpf" element={<BPF />} />
            <Route path="veille-qualiopi" element={<VeilleQualiopi />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="parametres" element={<Settings />} />
            {/* ========== NOUVEAU : Configuration Email ========== */}
            <Route path="settings/email" element={<EmailSettings />} />
            {/* ================================================== */}
            <Route path="versions" element={<VersionHistory />} />
            <Route path="changelog" element={<Changelog />} />
          </Route>
          
          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
