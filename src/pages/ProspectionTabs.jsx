import { useState } from 'react'
import { Calendar, Search, Phone } from 'lucide-react'
import Prospection from './Prospection'
import ProspectSearch from './ProspectSearch'
import MarinePhoning from './MarinePhoning'

export default function ProspectionTabs() {
  const [activeTab, setActiveTab] = useState('rendez-vous')

  const tabs = [
    { id: 'rendez-vous', label: 'Rendez-vous', icon: Calendar, component: Prospection },
    { id: 'recherche', label: 'Recherche Prospects', icon: Search, component: ProspectSearch },
    { id: 'phoning', label: 'Phoning Marine', icon: Phone, component: MarinePhoning },
  ]

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || Prospection

  return (
    <div className="space-y-6">
      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm
                  transition-colors
                  ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Contenu de l'onglet actif */}
      <div>
        <ActiveComponent />
      </div>
    </div>
  )
}
