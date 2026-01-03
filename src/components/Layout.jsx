import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { 
  LayoutDashboard, Users, GraduationCap, Calendar, Building2, 
  Settings, LogOut, Menu, X, FileText, AlertTriangle, UserCheck, FileStack, ClipboardList, BarChart3
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/clients', icon: Building2, label: 'Clients' },
  { to: '/formations', icon: GraduationCap, label: 'Formations' },
  { to: '/stagiaires', icon: Users, label: 'Stagiaires' },
  { to: '/formateurs', icon: UserCheck, label: 'Formateurs' },
  { to: '/sessions', icon: Calendar, label: 'Sessions' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/documents-vierges', icon: FileStack, label: 'Docs vierges' },
  { to: '/tests-positionnement', icon: ClipboardList, label: 'Tests positionnement' },
  { to: '/non-conformites', icon: AlertTriangle, label: 'Non-conformités' },
  { to: '/indicateurs', icon: BarChart3, label: 'Indicateurs' },
  { to: '/parametres', icon: Settings, label: 'Paramètres' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg">
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-semibold text-primary-600">AFM</span>
        <div className="w-10" />
      </div>
      
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-white shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="font-bold text-xl text-primary-600">AFM</span>
              <button onClick={() => setSidebarOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <nav className="p-4 space-y-1">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
      
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 bg-white border-r">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-primary-600">AFM</h1>
            <p className="text-xs text-gray-400">Access Formation Manager</p>
            <p className="text-xs text-primary-500 mt-1">V2.5.10</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-medium">{user?.email?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                <p className="text-xs text-gray-500">Administrateur</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />Déconnexion
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">AFM V2.5.10</p>
          </div>
        </div>
      </aside>
      
      {/* Main content */}
      <main className="lg:pl-64">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
