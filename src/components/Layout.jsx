import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import {
  LayoutDashboard,
  Building2,
  GraduationCap,
  Users,
  UserCheck,
  Calendar,
  FileText,
  FileStack,
  ClipboardList,
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown
} from 'lucide-react'

const navigation = [
  { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Building2 },
  { name: 'Formations', href: '/formations', icon: GraduationCap },
  { name: 'Formateurs', href: '/formateurs', icon: UserCheck },
  { name: 'Stagiaires', href: '/stagiaires', icon: Users },
  { name: 'Sessions', href: '/sessions', icon: Calendar },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Documents vierges', href: '/documents-vierges', icon: FileStack },
  { name: 'Questionnaires', href: '/questionnaires', icon: ClipboardList },
  { name: 'Non-conformités', href: '/non-conformites', icon: AlertTriangle },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  
  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:transform-none lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">Access Formation</span>
          </div>
          <button 
            className="lg:hidden p-1 rounded hover:bg-gray-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive 
                  ? 'bg-primary-50 text-primary-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
              `}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        
        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <NavLink
            to="/parametres"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${isActive 
                ? 'bg-primary-50 text-primary-700' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
            `}
          >
            <Settings className="w-5 h-5" />
            Paramètres
          </NavLink>
          <p className="text-xs text-gray-400 mt-3 text-center">Version 2.3</p>
        </div>
      </aside>
      
      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <button 
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex-1" />
          
          {/* User menu */}
          <div className="relative">
            <button 
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-700">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="hidden sm:block text-sm text-gray-700">
                {user?.email}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
            
            {userMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">Connecté</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
        
        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
