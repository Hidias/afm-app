import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Building2,
  Users,
  Calendar,
  GraduationCap,
} from 'lucide-react'

export default function CompletenessReport() {
  const { sessions, clients, trainees, trainers, courses } = useStore()
  const [expandedSections, setExpandedSections] = useState({
    sessions: true,
    clients: true,
    trainees: true,
    trainers: false,
    courses: false,
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Analyser les champs manquants
  const getMissingFields = () => {
    const issues = {
      sessions: [],
      clients: [],
      trainees: [],
      trainers: [],
      courses: [],
    }

    // Vérifier sessions
    sessions.forEach(s => {
      const missing = []
      if (!s.course_id) missing.push('Formation')
      if (!s.client_id) missing.push('Client')
      if (!s.trainer_id) missing.push('Formateur')
      if (!s.start_date) missing.push('Date de début')
      if (!s.end_date) missing.push('Date de fin')
      if (!s.is_intra && !s.location_name) missing.push('Lieu')
      if (!s.is_intra && !s.location_address) missing.push('Adresse')
      if (!s.is_intra && !s.location_city) missing.push('Ville')
      if (!s.session_trainees?.length) missing.push('Stagiaires')
      
      if (missing.length > 0) {
        issues.sessions.push({
          id: s.id,
          reference: s.reference,
          title: s.course?.title || 'Session sans formation',
          missing,
        })
      }
    })

    // Vérifier clients
    clients.forEach(c => {
      const missing = []
      if (!c.address) missing.push('Adresse')
      if (!c.postal_code) missing.push('Code postal')
      if (!c.city) missing.push('Ville')
      if (!c.siret) missing.push('SIRET')
      if (!c.contact_name) missing.push('Contact')
      if (!c.contact_email) missing.push('Email contact')
      
      if (missing.length > 0) {
        issues.clients.push({
          id: c.id,
          name: c.name,
          missing,
        })
      }
    })

    // Vérifier stagiaires
    trainees.forEach(t => {
      const missing = []
      if (!t.email) missing.push('Email')
      if (!t.phone) missing.push('Téléphone')
      if (!t.birth_date) missing.push('Date de naissance')
      if (!t.address) missing.push('Adresse')
      if (!t.social_security_number) missing.push('N° Sécu')
      
      if (missing.length > 0) {
        issues.trainees.push({
          id: t.id,
          name: `${t.first_name} ${t.last_name}`,
          missing,
        })
      }
    })

    // Vérifier formateurs
    trainers.forEach(tr => {
      const missing = []
      if (!tr.email) missing.push('Email')
      if (!tr.phone) missing.push('Téléphone')
      if (!tr.trainer_certificates?.length) missing.push('Certificats')
      
      if (missing.length > 0) {
        issues.trainers.push({
          id: tr.id,
          name: `${tr.first_name} ${tr.last_name}`,
          missing,
        })
      }
    })

    // Vérifier formations
    courses.forEach(co => {
      const missing = []
      if (!co.description) missing.push('Description')
      if (!co.objectives?.length) missing.push('Objectifs')
      if (!co.prerequisites) missing.push('Prérequis')
      if (!co.target_audience) missing.push('Public cible')
      
      if (missing.length > 0) {
        issues.courses.push({
          id: co.id,
          title: co.title,
          missing,
        })
      }
    })

    return issues
  }

  const issues = getMissingFields()

  const sections = [
    {
      id: 'sessions',
      title: 'Sessions',
      icon: Calendar,
      items: issues.sessions,
      total: sessions.length,
      link: '/sessions',
    },
    {
      id: 'clients',
      title: 'Clients',
      icon: Building2,
      items: issues.clients,
      total: clients.length,
      link: '/clients',
    },
    {
      id: 'trainees',
      title: 'Stagiaires',
      icon: GraduationCap,
      items: issues.trainees,
      total: trainees.length,
      link: '/stagiaires',
    },
    {
      id: 'trainers',
      title: 'Formateurs',
      icon: Users,
      items: issues.trainers,
      total: trainers.length,
      link: '/formateurs',
    },
    {
      id: 'courses',
      title: 'Formations',
      icon: Users,
      items: issues.courses,
      total: courses.length,
      link: '/formations',
    },
  ]

  // Calculer le score global
  const totalItems = sections.reduce((acc, s) => acc + s.total, 0)
  const itemsWithIssues = sections.reduce((acc, s) => acc + s.items.length, 0)
  const completeItems = totalItems - itemsWithIssues
  const completionRate = totalItems > 0 ? Math.round((completeItems / totalItems) * 100) : 100

  const getColorClass = (rate) => {
    if (rate >= 85) return 'text-green-600 bg-green-50'
    if (rate >= 75) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rapport de complétude</h1>
        <p className="text-gray-500">Détail des champs manquants dans vos dossiers</p>
      </div>

      {/* Score global */}
      <div className={`rounded-xl p-6 ${getColorClass(completionRate)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-medium">Complétude globale</p>
            <p className="text-sm opacity-75">{completeItems} éléments complets sur {totalItems}</p>
          </div>
          <div className="text-4xl font-bold">{completionRate}%</div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => {
          const sectionRate = section.total > 0 
            ? Math.round(((section.total - section.items.length) / section.total) * 100) 
            : 100

          return (
            <div key={section.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <section.icon className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">{section.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getColorClass(sectionRate)}`}>
                    {sectionRate}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {section.items.length > 0 ? (
                    <span className="text-sm text-orange-600">
                      {section.items.length} à compléter
                    </span>
                  ) : (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Complet
                    </span>
                  )}
                  {expandedSections[section.id] ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedSections[section.id] && section.items.length > 0 && (
                <div className="border-t">
                  {section.items.map((item, idx) => (
                    <Link
                      key={item.id}
                      to={`${section.link}/${item.id}`}
                      className={`flex items-center justify-between p-4 hover:bg-gray-50 ${
                        idx !== section.items.length - 1 ? 'border-b' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <span className="font-medium text-gray-900">
                          {item.reference || item.name || item.title}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end max-w-md">
                        {item.missing.map((field, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {expandedSections[section.id] && section.items.length === 0 && (
                <div className="border-t p-4 text-center text-gray-500">
                  Tous les {section.title.toLowerCase()} sont complets
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
