import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore, useDataStore } from '../lib/store'
import { 
  LayoutDashboard, Users, GraduationCap, Calendar, Building2, 
  Settings, LogOut, Menu, X, FileText, AlertTriangle, UserCheck, BarChart3, Award,
  Bell, Check, ExternalLink, FolderCheck, CheckCircle, Briefcase, Receipt,
  Phone, Search, Globe, Layers, FolderInput, ChevronDown, Eye, Shield, Target,
  ClipboardCheck, FileQuestion
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ═══════════════════════════════════════════════════════════
// NAVIGATION PAR SECTIONS
// ═══════════════════════════════════════════════════════════
const navSections = [
  {
    id: 'formation',
    label: 'Formation',
    emoji: '🎓',
    activeClass: 'bg-accent-500 text-primary-900 font-semibold shadow-md',
    headerActiveClass: 'text-accent-400',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
      { to: '/sessions', icon: Calendar, label: 'Sessions' },
      { to: '/formations', icon: GraduationCap, label: 'Formations' },
      { to: '/stagiaires', icon: Users, label: 'Stagiaires' },
      { to: '/formateurs', icon: UserCheck, label: 'Formateurs' },
      { to: '/documents', icon: FileText, label: 'Documents' },
      { to: '/documents-vierges', icon: FileQuestion, label: 'Documents vierges' },
      { to: '/tests-positionnement', icon: ClipboardCheck, label: 'Tests positionnement' },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    emoji: '📞',
    activeClass: 'bg-blue-500 text-white font-semibold shadow-md',
    headerActiveClass: 'text-blue-400',
    items: [
      { to: '/clients', icon: Building2, label: 'Clients' },
      { to: '/devis', icon: Receipt, label: 'Devis' },
      { to: '/prospection', icon: Phone, label: 'Phoning' },
      { to: '/prospection-massive', icon: Globe, label: 'Base prospects' },
      { to: '/multi-etablissements', icon: Layers, label: 'Multi-établissements' },
      { to: '/admin/import', icon: FolderInput, label: 'Import' },
    ],
  },
  {
    id: 'qualite',
    label: 'Qualité',
    emoji: '✅',
    activeClass: 'bg-emerald-500 text-white font-semibold shadow-md',
    headerActiveClass: 'text-emerald-400',
    items: [
      { to: '/qualite', icon: FolderCheck, label: 'Processus qualité' },
      { to: '/qualite/completude', icon: CheckCircle, label: 'Complétude' },
      { to: '/indicateurs', icon: BarChart3, label: 'Indicateurs' },
      { to: '/non-conformites', icon: AlertTriangle, label: 'Non-conformités' },
      { to: '/qualiopi', icon: Award, label: 'Qualiopi' },
      { to: '/veille-qualiopi', icon: Eye, label: 'Veille' },
      { to: '/registre-psh', icon: Shield, label: 'Registre PSH' },
      { to: '/profil-stagiaires', icon: Target, label: 'Profil stagiaires' },
      { to: '/audit-logs', icon: Search, label: 'Audit logs' },
    ],
  },
]

// Toutes les routes pour détection de section active
const allRoutes = navSections.flatMap(s => s.items.map(i => ({ ...i, sectionId: s.id })))

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Déterminer la section active selon la route courante
  const activeSectionId = useMemo(() => {
    const path = location.pathname
    const match = allRoutes.find(r => {
      if (r.to === '/') return path === '/'
      return path === r.to || path.startsWith(r.to + '/')
    })
    return match?.sectionId || 'formation'
  }, [location.pathname])
  
  // Sections ouvertes — la section active est toujours ouverte
  const [openSections, setOpenSections] = useState({ formation: true, commerce: false, qualite: false })
  
  // Auto-ouvrir la section active quand la route change
  useEffect(() => {
    setOpenSections(prev => ({ ...prev, [activeSectionId]: true }))
  }, [activeSectionId])
  
  const toggleSection = (sectionId) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }
  
  // Horloge temps réel
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  
  // Charger les notifications
  useEffect(() => {
    loadNotifications()
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
    if (notif.type === 'completude') {
      const priority = notif.metadata?.priority
      if (priority === 'bloquant') return '🔴'
      if (priority === 'important') return '🟠'
      if (priority === 'mineur') return '🟡'
      return '🔴'
    }
    
    switch(notif.type) {
      case 'reclamation': return '📩'
      case 'veille': return '👁️'
      case 'materiel': return '🔧'
      case 'audit': return '📋'
      case 'revue_direction': return '📊'
      case 'j90': return '📅'
      case 'rdv_phoning': return '🔥'
      case 'rappel_phoning': return '📞'
      default: return '🔔'
    }
  }
  
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
  
  // ═══════════════════════════════════════════════════════════
  // Composant Nav réutilisé desktop + mobile
  // ═══════════════════════════════════════════════════════════
  const SidebarNav = ({ onItemClick }) => (
    <>
      {navSections.map(section => {
        const isOpen = openSections[section.id]
        const isActiveSection = activeSectionId === section.id
        
        return (
          <div key={section.id} className="mb-1">
            {/* En-tête de section */}
            <button
              onClick={() => toggleSection(section.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                isActiveSection ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">{section.emoji}</span>
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  isActiveSection ? section.headerActiveClass : 'text-white/50'
                }`}>
                  {section.label}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-white/30 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`} />
            </button>
            
            {/* Items de la section */}
            <div
              className="overflow-hidden transition-all duration-200 ease-in-out"
              style={{ maxHeight: isOpen ? `${section.items.length * 42}px` : '0px' }}
            >
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onItemClick}
                  className={({ isActive }) => `flex items-center gap-3 pl-6 pr-3 py-2 rounded-lg transition-all text-sm ${
                    isActive 
                      ? section.activeClass
                      : 'text-white/70 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
      
      {/* Paramètres (hors sections) */}
      <div className="mt-2 pt-2 border-t border-white/10">
        <NavLink
          to="/parametres"
          onClick={onItemClick}
          className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
            isActive 
              ? 'bg-white/15 text-white font-semibold' 
              : 'text-white/50 hover:bg-white/5 hover:text-white/70'
          }`}
        >
          <Settings className="w-[18px] h-[18px]" />
          <span>Paramètres</span>
        </NavLink>
      </div>
    </>
  )
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden bg-primary-500 px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
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
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-primary-500 shadow-xl overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="p-4 border-b border-primary-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/assets/logo-campus.png" alt="Campus" className="h-10" />
                <div>
                  <p className="text-accent-400 font-bold">Access Campus</p>
                  <p className="text-xs text-white/50">V3.0.0</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-white"><X className="w-6 h-6" /></button>
            </div>
            <nav className="p-3">
              <SidebarNav onItemClick={() => setSidebarOpen(false)} />
            </nav>
          </div>
        </div>
      )}
      
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 bg-primary-500 h-full">
          <div className="p-5 border-b border-primary-400">
            <div className="flex items-center gap-3">
              <img src="/assets/logo-campus.png" alt="Access Campus" className="h-12" />
            </div>
            <div className="mt-2">
              <p className="text-accent-400 font-bold text-lg">Access Campus</p>
              <p className="text-xs text-white/60">V3.0.0</p>
            </div>
          </div>
          
          <nav className="flex-1 p-3 overflow-y-auto min-h-0">
            <SidebarNav onItemClick={() => {}} />
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
          </div>
        </div>
      </aside>
      
      {/* Main content */}
      <main className="lg:pl-64">
        {/* Top header bar with notifications and clock */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-end gap-3 sm:gap-4">
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
                <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
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
        
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
