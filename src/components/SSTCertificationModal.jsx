import { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Download, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// Données des compétences selon le référentiel INRS
const COMPETENCES_FI = [
  {
    code: 'C1',
    titre: "Délimiter son champ d'intervention en matière de secours",
    indicateur: "Explique les limites de son intervention"
  },
  {
    code: 'C2',
    titre: "Identifier les dangers persistants et repérer les personnes qui pourraient y être exposées + Supprimer ou isoler le danger persistant, ou soustraire la victime au danger persistant sans s'exposer soi-même",
    indicateurs: [
      "Repère le(s) danger(s) persistant(s) dans la situation d'accident simulée",
      "Repère la(les) personne(s) qui est(sont) exposée(s) au(x) danger(s) persistant(s) identifié(s)",
      "Assure ou fait assurer la suppression / Isole ou fait isoler le danger / Soustrait ou fait soustraire la victime au danger"
    ]
  },
  {
    code: 'C3',
    titre: "Rechercher, suivant un ordre déterminé, la présence d'un (ou plusieurs) des signes indiquant que la vie de la victime est immédiatement menacée",
    indicateurs: [
      "Recherche les signes indiquant que la vie de la victime est menacée",
      "Effectue l'examen dans l'ordre déterminé"
    ]
  },
  {
    code: 'C4',
    titre: "Garantir une alerte favorisant l'arrivée de secours adaptés au plus près de la victime",
    indicateurs: [
      "Transmet le message d'alerte permettant le déclenchement des secours adaptés",
      "Favorise l'arrivée des secours au plus près de la victime"
    ]
  },
  {
    code: 'C5',
    titre: "Choisir à l'issue de l'examen l'action ou les actions à effectuer + Réaliser l'action ou les actions choisie(s) + Surveiller jusqu'à la prise en charge",
    indicateurs: [
      "Choisit l'action appropriée au résultat à atteindre",
      "Utilise la (ou les) technique(s) préconisée(s)",
      "Surveille la victime et agit en conséquence jusqu'à la prise en charge de celle-ci par les secours"
    ]
  },
  {
    code: 'C6',
    titre: "Situer son rôle de SST dans l'organisation de la prévention de l'entreprise",
    indicateur: "Indique comment il peut contribuer concrètement à la prévention dans son entreprise"
  },
  {
    code: 'C7',
    titre: "Caractériser des risques professionnels dans une situation de travail",
    indicateur: "À partir d'une situation dangereuse, détermine des risques et les autres dommages potentiels"
  },
  {
    code: 'C8',
    titre: "Participer à la maîtrise des risques professionnels par des actions de prévention",
    indicateurs: [
      "Supprime ou à défaut réduit les risques",
      "Propose, si possible, des pistes d'amélioration"
    ]
  }
]

const COMPETENCES_MAC = [
  {
    code: 'C2',
    titre: "Supprimer ou isoler le danger persistant, ou soustraire la victime au danger persistant sans s'exposer soi-même",
    indicateurs: [
      "Assure ou fait assurer la suppression",
      "Isole ou fait isoler le danger",
      "Soustrait ou fait soustraire la victime au danger"
    ]
  },
  {
    code: 'C3',
    titre: "Rechercher, suivant un ordre déterminé, la présence d'un (ou plusieurs) des signes indiquant que la vie de la victime est immédiatement menacée",
    indicateur: "Recherche les signes indiquant que la vie de la victime est menacée"
  },
  {
    code: 'C4',
    titre: "Garantir une alerte favorisant l'arrivée de secours adaptés au plus près de la victime",
    indicateurs: [
      "Transmet le message d'alerte permettant le déclenchement des secours adaptés",
      "Favorise l'arrivée des secours au plus près de la victime"
    ]
  },
  {
    code: 'C5',
    titre: "Choisir à l'issue de l'examen l'action ou les actions à effectuer + Surveiller jusqu'à la prise en charge",
    indicateurs: [
      "Choisit l'action appropriée au résultat à atteindre",
      "Surveille la victime et agit en conséquence jusqu'à la prise en charge de celle-ci par les secours"
    ]
  },
  {
    code: 'C6',
    titre: "Situer son rôle de SST dans l'organisation de la prévention de l'entreprise",
    indicateur: "Indique comment il peut contribuer concrètement à la prévention dans son entreprise"
  },
  {
    code: 'C7',
    titre: "Caractériser des risques professionnels dans une situation de travail",
    indicateur: "À partir de la situation d'accident de travail précédemment simulée, explicite le mécanisme d'apparition du dommage rencontré"
  },
  {
    code: 'C8',
    titre: "Participer à la maîtrise des risques professionnels par des actions de prévention",
    indicateur: "À partir de la situation d'accident précédemment simulée, propose des actions visant à supprimer ou à défaut réduire les risques"
  }
]

export default function SSTCertificationModal({ 
  show, 
  onClose, 
  session, 
  trainee, 
  trainer,
  onSave 
}) {
  const [formationType, setFormationType] = useState('FI') // FI ou MAC
  const [competences, setCompetences] = useState({})
  const [loading, setLoading] = useState(false)
  const [existingCertification, setExistingCertification] = useState(null)

  useEffect(() => {
    if (show && session && trainee) {
      detectFormationType()
      loadExistingCertification()
    }
  }, [show, session, trainee])

  // Détecter automatiquement le type de formation (FI ou MAC)
  const detectFormationType = () => {
    const courseTitle = session?.courses?.title?.toLowerCase() || ''
    if (courseTitle.includes('mac') || courseTitle.includes('recyclage') || courseTitle.includes('maintien')) {
      setFormationType('MAC')
    } else {
      setFormationType('FI')
    }
  }

  // Charger une certification existante
  const loadExistingCertification = async () => {
    try {
      const { data, error } = await supabase
        .from('sst_certifications')
        .select('*')
        .eq('session_id', session.id)
        .eq('trainee_id', trainee.id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setExistingCertification(data)
        setFormationType(data.formation_type)
        setCompetences({
          c1_acquis: data.c1_acquis,
          c2_acquis: data.c2_acquis,
          c3_acquis: data.c3_acquis,
          c4_acquis: data.c4_acquis,
          c5_acquis: data.c5_acquis,
          c6_acquis: data.c6_acquis,
          c7_acquis: data.c7_acquis,
          c8_acquis: data.c8_acquis,
        })
      }
    } catch (error) {
      console.error('Erreur chargement certification:', error)
    }
  }

  // Calculer si le candidat est certifié
  const isCertifie = () => {
    const competencesList = formationType === 'FI' 
      ? ['c1_acquis', 'c2_acquis', 'c3_acquis', 'c4_acquis', 'c5_acquis', 'c6_acquis', 'c7_acquis', 'c8_acquis']
      : ['c2_acquis', 'c3_acquis', 'c4_acquis', 'c5_acquis', 'c6_acquis', 'c7_acquis', 'c8_acquis']
    
    const acquises = competencesList.filter(c => competences[c] === true).length
    const requises = competencesList.length
    
    return acquises >= requises
  }

  const toggleCompetence = (key) => {
    setCompetences(prev => ({
      ...prev,
      [key]: prev[key] === true ? false : prev[key] === false ? null : true
    }))
  }

  const handleSave = async () => {
    if (!trainer) {
      toast.error('Aucun formateur assigné à cette session')
      return
    }

    setLoading(true)
    try {
      const certificationData = {
        session_id: session.id,
        trainee_id: trainee.id,
        formation_type: formationType,
        // Préserver null pour "Non évalué", true pour "Acquis", false pour "Non acquis"
        c1_acquis: formationType === 'FI' ? (competences.c1_acquis === undefined ? null : competences.c1_acquis) : null,
        c2_acquis: competences.c2_acquis === undefined ? null : competences.c2_acquis,
        c3_acquis: competences.c3_acquis === undefined ? null : competences.c3_acquis,
        c4_acquis: competences.c4_acquis === undefined ? null : competences.c4_acquis,
        c5_acquis: competences.c5_acquis === undefined ? null : competences.c5_acquis,
        c6_acquis: competences.c6_acquis === undefined ? null : competences.c6_acquis,
        c7_acquis: competences.c7_acquis === undefined ? null : competences.c7_acquis,
        c8_acquis: competences.c8_acquis === undefined ? null : competences.c8_acquis,
        date_certification: session.end_date,
        formateur_id: trainer.id,
        formateur_nom: trainer.last_name,
        formateur_prenom: trainer.first_name,
        formateur_signature_url: trainer.signature_url || null,
      }

      const { data, error } = await supabase
        .from('sst_certifications')
        .upsert(certificationData, { 
          onConflict: 'session_id,trainee_id',
          returning: true 
        })
        .select()
        .single()

      if (error) throw error

      toast.success(`Certification ${data.candidat_certifie ? '✓ VALIDÉE' : '✗ NON VALIDÉE'}`)
      
      if (onSave) onSave(data)
      onClose()
    } catch (error) {
      console.error('Erreur sauvegarde certification:', error)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  const competencesData = formationType === 'FI' ? COMPETENCES_FI : COMPETENCES_MAC
  const certifie = isCertifie()
  const nbAcquises = Object.values(competences).filter(v => v === true).length
  const nbRequises = formationType === 'FI' ? 8 : 7

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Grille de certification SST - {formationType === 'FI' ? 'Formation Initiale' : 'MAC'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {trainee.first_name} {trainee.last_name} • Session du {format(new Date(session.start_date), 'dd/MM/yyyy', { locale: fr })} au {format(new Date(session.end_date), 'dd/MM/yyyy', { locale: fr })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Type de formation */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de formation
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setFormationType('FI')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                formationType === 'FI'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Formation Initiale (8 compétences)
            </button>
            <button
              onClick={() => setFormationType('MAC')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                formationType === 'MAC'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              MAC (7 compétences)
            </button>
          </div>
        </div>

        {/* Grille des compétences */}
        <div className="px-6 py-4">
          <div className="space-y-4">
            {competencesData.map((comp) => {
              const key = `${comp.code.toLowerCase()}_acquis`
              const value = competences[key]
              
              return (
                <div key={comp.code} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold">
                        {comp.code}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-2">{comp.titre}</h4>
                      {comp.indicateur && (
                        <p className="text-sm text-gray-600 mb-3">• {comp.indicateur}</p>
                      )}
                      {comp.indicateurs && (
                        <ul className="text-sm text-gray-600 mb-3 space-y-1">
                          {comp.indicateurs.map((ind, idx) => (
                            <li key={idx}>• {ind}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => toggleCompetence(key)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          value === true
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : value === false
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {value === true ? '✓ Acquis' : value === false ? '✗ Non acquis' : 'Non évalué'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Résultat */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className={`p-4 rounded-lg ${certifie ? 'bg-green-100 border-2 border-green-600' : 'bg-red-100 border-2 border-red-600'}`}>
            <div className="flex items-center gap-3">
              {certifie ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-600" />
              )}
              <div>
                <p className="font-bold text-lg">
                  {certifie ? '✓ CANDIDAT CERTIFIÉ' : '✗ CANDIDAT NON CERTIFIÉ'}
                </p>
                <p className="text-sm">
                  {nbAcquises}/{nbRequises} compétences acquises
                  {certifie ? ' (validation automatique)' : ` (minimum ${nbRequises} requis)`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Enregistrement...' : 'Enregistrer la certification'}
          </button>
        </div>
      </div>
    </div>
  )
}
