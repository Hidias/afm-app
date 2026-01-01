import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Calendar,
  Info,
} from 'lucide-react'

export default function QualiopiReport() {
  const { sessions, qualiopiIndicators } = useStore()
  const [expandedCriteria, setExpandedCriteria] = useState({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
  })

  const toggleCriterion = (criterion) => {
    setExpandedCriteria(prev => ({ ...prev, [criterion]: !prev[criterion] }))
  }

  // Grouper les indicateurs par critère
  const criteriaNames = {
    1: 'Information du public sur les prestations',
    2: 'Identification précise des objectifs et adaptation',
    3: 'Adaptation des prestations et accompagnement',
    4: 'Adéquation des moyens pédagogiques',
    5: 'Qualification et développement des compétences',
    6: 'Inscription dans l\'environnement professionnel',
    7: 'Recueil et prise en compte des appréciations',
  }

  const indicatorsByCriterion = qualiopiIndicators.reduce((acc, ind) => {
    if (!acc[ind.criterion]) acc[ind.criterion] = []
    acc[ind.criterion].push(ind)
    return acc
  }, {})

  // Analyser la conformité pour chaque indicateur
  const getIndicatorStatus = (indicator) => {
    // Pour chaque indicateur, vérifier les sessions
    let validatedCount = 0
    let totalCount = 0
    let issues = []

    sessions.forEach(session => {
      const sessionIndicator = session.session_qualiopi_indicators?.find(
        si => si.indicator_number === indicator.number
      )
      
      // Vérifier si l'indicateur est applicable à cette session
      if (!indicator.is_applicable) {
        // Indicateur "si applicable" - vérifier les conditions
        return
      }

      totalCount++
      if (sessionIndicator?.is_validated) {
        validatedCount++
      } else {
        issues.push({
          sessionId: session.id,
          reference: session.reference,
          course: session.course?.title,
        })
      }
    })

    return {
      validated: validatedCount,
      total: totalCount,
      rate: totalCount > 0 ? Math.round((validatedCount / totalCount) * 100) : 100,
      issues,
    }
  }

  // Calculer le taux global
  const calculateGlobalRate = () => {
    let totalValidated = 0
    let totalChecks = 0

    qualiopiIndicators.forEach(ind => {
      if (ind.is_applicable) {
        const status = getIndicatorStatus(ind)
        totalValidated += status.validated
        totalChecks += status.total
      }
    })

    return totalChecks > 0 ? Math.round((totalValidated / totalChecks) * 100) : 100
  }

  const globalRate = calculateGlobalRate()

  const getColorClass = (rate) => {
    if (rate >= 85) return 'text-green-600 bg-green-50'
    if (rate >= 75) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conformité Qualiopi</h1>
        <p className="text-gray-500">Suivi des 32 indicateurs du référentiel national qualité</p>
      </div>

      {/* Score global */}
      <div className={`rounded-xl p-6 ${getColorClass(globalRate)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-medium">Conformité globale</p>
            <p className="text-sm opacity-75">Basé sur les sessions enregistrées</p>
          </div>
          <div className="text-4xl font-bold">{globalRate}%</div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Comment ça marche ?</p>
          <p className="mt-1">
            Chaque session doit valider les indicateurs Qualiopi applicables. 
            Rendez-vous dans l'onglet "Qualiopi" de chaque session pour cocher les indicateurs validés.
          </p>
        </div>
      </div>

      {/* Critères et indicateurs */}
      <div className="space-y-4">
        {Object.entries(indicatorsByCriterion).map(([criterion, indicators]) => {
          // Calculer le taux du critère
          let criterionValidated = 0
          let criterionTotal = 0
          indicators.forEach(ind => {
            if (ind.is_applicable) {
              const status = getIndicatorStatus(ind)
              criterionValidated += status.validated
              criterionTotal += status.total
            }
          })
          const criterionRate = criterionTotal > 0 ? Math.round((criterionValidated / criterionTotal) * 100) : 100

          return (
            <div key={criterion} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleCriterion(criterion)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 flex items-center justify-center bg-primary-100 text-primary-700 rounded-full font-bold text-sm">
                    {criterion}
                  </span>
                  <span className="font-medium text-left">{criteriaNames[criterion]}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getColorClass(criterionRate)}`}>
                    {criterionRate}%
                  </span>
                  {expandedCriteria[criterion] ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedCriteria[criterion] && (
                <div className="border-t divide-y">
                  {indicators.map((indicator) => {
                    const status = getIndicatorStatus(indicator)
                    
                    return (
                      <div key={indicator.number} className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-500">
                                Indicateur {indicator.number}
                              </span>
                              {!indicator.is_applicable && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                  Si applicable
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-gray-900 mt-1">{indicator.title}</p>
                            {indicator.description && (
                              <p className="text-sm text-gray-500 mt-1">{indicator.description}</p>
                            )}
                            {indicator.documents_required?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {indicator.documents_required.map((doc, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                                    {doc}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {status.rate === 100 ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-5 w-5" />
                                <span className="text-sm font-medium">OK</span>
                              </span>
                            ) : (
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getColorClass(status.rate)}`}>
                                {status.validated}/{status.total}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Sessions non validées */}
                        {status.issues.length > 0 && (
                          <div className="mt-3 pl-4 border-l-2 border-orange-200">
                            <p className="text-xs text-orange-600 font-medium mb-2">
                              Sessions à valider :
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {status.issues.slice(0, 5).map((issue) => (
                                <Link
                                  key={issue.sessionId}
                                  to={`/sessions/${issue.sessionId}`}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs hover:bg-orange-100"
                                >
                                  <Calendar className="h-3 w-3" />
                                  {issue.reference}
                                </Link>
                              ))}
                              {status.issues.length > 5 && (
                                <span className="text-xs text-gray-500">
                                  +{status.issues.length - 5} autres
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Légende */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-gray-900 mb-4">Légende des couleurs</h3>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-green-500"></span>
            <span className="text-sm text-gray-600">85-100% : Conforme</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-orange-500"></span>
            <span className="text-sm text-gray-600">75-84% : À surveiller</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-red-500"></span>
            <span className="text-sm text-gray-600">&lt;75% : Non conforme</span>
          </div>
        </div>
      </div>
    </div>
  )
}
