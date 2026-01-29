import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore, useDataStore } from '../lib/store'
import { 
  LayoutDashboard, Users, GraduationCap, Calendar, Building2, 
  Settings, LogOut, Menu, X, FileText, AlertTriangle, UserCheck, BarChart3, Award,
  Bell, Check, ExternalLink, FolderCheck, CheckCircle, Briefcase
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/clients', icon: Building2, label: 'Clients' },
  { to: '/prospection', icon: Briefcase, label: 'Prospection' },
  { to: '/formations', icon: GraduationCap, label: 'Formations' },
  { to: '/stagiaires', icon: Users, label: 'Stagiaires' },
  { to: '/formateurs', icon: UserCheck, label: 'Formateurs' },
  { to: '/sessions', icon: Calendar, label: 'Sessions' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/qualite', icon: FolderCheck, label: 'Qualité' },
  { to: '/non-conformites', icon: AlertTriangle, label: 'Non-conformités' },
  { to: '/indicateurs', icon: BarChart3, label: 'Indicateurs' },
  { to: '/profil-stagiaires', icon: Users, label: 'Profil Stagiaires' },
  { to: '/qualiopi', icon: Award, label: 'Qualiopi' },
  { to: '/parametres', icon: Settings, label: 'Paramètres' },
]
export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Horloge temps réel
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  
  // Charger les notifications
  useEffect(() => {
    loadNotifications()
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])
  
  const loadNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }
  
  const unreadCount = notifications.filter(n => !n.read_at).length
  
  const markAsRead = async (id) => {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    loadNotifications()
  }
  
  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return
    
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
    loadNotifications()
  }
  
  const getNotificationIcon = (notif) => {
    // Pour les notifications de complétude, utiliser l'emoji basé sur la priorité
    if (notif.type === 'completude') {
      const priority = notif.metadata?.priority
      if (priority === 'bloquant') return '🔴'
      if (priority === 'important') return '🟠'
      if (priority === 'mineur') return '🟡'
      return '🔴' // Défaut
    }
    
    // Autres types de notifications
    switch(notif.type) {
      case 'reclamation': return '📩'
      case 'veille': return '👁️'
      case 'materiel': return '🔧'
      case 'audit': return '📋'
      case 'revue_direction': return '📊'
      case 'j90': return '📅'
      default: return '🔔'
    }
  }
  
  // Mapping email -> prénom pour le greeting
  const getUserName = (email) => {
    const mapping = {
      'hicham.saidi@accessformation.pro': 'Hicham',
      'maxime.langlais@accessformation.pro': 'Maxime',
      'contact@accessformation.pro': 'Access'
    }
    return mapping[email] || null
  }
  const userName = getUserName(user?.email)
  const greeting = userName && userName !== 'Access' ? `Bonjour ${userName}` : null
  
  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden bg-primary-500 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-primary-600 rounded-lg text-white">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/assets/logo-campus.png" alt="Campus" className="h-8" />
          <span className="font-bold text-white">Campus</span>
        </div>
        <div className="w-10" />
      </div>
      
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-primary-500 shadow-xl">
            <div className="p-4 border-b border-primary-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/assets/logo-campus.png" alt="Campus" className="h-10" />
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-white"><X className="w-6 h-6" /></button>
            </div>
            <nav className="p-4 space-y-1">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-accent-500 text-primary-900 font-medium' : 'text-white/80 hover:bg-primary-400 hover:text-white'}`}
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
        <div className="flex flex-col flex-1 bg-primary-500">
          <div className="p-5 border-b border-primary-400">
            <div className="flex items-center gap-3">
              <img src="/assets/logo-campus.png" alt="Access Campus" className="h-12" />
            </div>
            <div className="mt-2">
              <p className="text-accent-400 font-bold text-lg">Access Campus</p>
              <p className="text-xs text-white/60">V2.8.0</p>
            </div>
          </div>
          
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive ? 'bg-accent-500 text-primary-900 font-semibold shadow-md' : 'text-white/80 hover:bg-primary-400 hover:text-white'}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          
          <div className="p-4 border-t border-primary-400">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-accent-500 rounded-full flex items-center justify-center">
                <span className="text-primary-900 font-bold">{user?.email?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                <p className="text-xs text-white/60">Administrateur</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-red-500/20 hover:text-red-300 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />Déconnexion
            </button>
            <p className="text-center text-xs text-white/40 mt-3">Access Campus V2.8.0</p>
          </div>
        </div>
      </aside>
      
      {/* Main content */}
      <main className="lg:pl-64">
        {/* Top header bar with notifications and clock */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end gap-4">
          {/* Notification bell */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-gray-100 rounded-full relative"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            {/* Dropdown notifications */}
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
                  <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">Notifications</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Tout marquer comme lu
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-gray-500 text-sm">Aucune notification</p>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id}
                          className={`p-3 border-b hover:bg-gray-50 cursor-pointer ${!notif.read_at ? 'bg-blue-50' : ''}`}
                          onClick={() => {
                            markAsRead(notif.id)
                            if (notif.link) navigate(notif.link)
                            setShowNotifications(false)
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg">{getNotificationIcon(notif)}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${!notif.read_at ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                {notif.title}
                              </p>
                              {notif.message && (
                                <p className="text-xs text-gray-500 truncate">{notif.message}</p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {format(new Date(notif.created_at), 'd MMM à HH:mm', { locale: fr })}
                              </p>
                            </div>
                            {!notif.read_at && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Clock and greeting */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-lg font-mono tabular-nums text-gray-700">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {greeting && (
              <span className="text-sm font-medium text-primary-600 border-l border-gray-300 pl-3">
                {greeting}
              </span>
            )}
          </div>
        </div>
        
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
