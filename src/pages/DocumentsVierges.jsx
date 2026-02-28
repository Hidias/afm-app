import { useEffect, useState } from 'react'
import { FileText, Download, BookOpen, ClipboardList, Loader2, Shield, CheckSquare, Info, Package, AlertTriangle } from 'lucide-react'
import { downloadDocument, setOrganization } from '../lib/pdfGenerator'
import { downloadCompetencyGrid, GRID_INFO } from '../lib/pdfCompetencyGrids'
import { downloadPasseportPrevention } from '../lib/pdfPasseportPrevention'
import { downloadKitSecours, KIT_CONFIG } from '../lib/pdfKitSecours'
import { useDataStore } from '../lib/store'
import toast from 'react-hot-toast'

// Couleurs des thèmes selon leur nom
const getThemeColor = (themeName) => {
  if (!themeName) return '#6b7280'
  const name = themeName.toLowerCase()
  if (name.includes('secourisme') || name.includes('sst') || name.includes('psc')) return '#22c55e'
  if (name.includes('incendie') || name.includes('epi') || name.includes('évacuation')) return '#ef4444'
  if (name.includes('électri') || name.includes('habilitation') || name.includes('hab')) return '#eab308'
  if (name.includes('r489') || name.includes('r485') || name.includes('conduite') || name.includes('chariot') || name.includes('nacelle')) return '#1f2937'
  if (name.includes('ergonomie') || name.includes('gestes') || name.includes('postures') || name.includes('prap')) return '#3b82f6'
  return '#6b7280'
}

const FORMATION_COLORS = {
  incendie: '#ef4444',
  gestes_postures: '#3b82f6',
  r489: '#1f2937',
  r485: '#6b7280',
}

// Mapping des kits vers les thèmes de positionnement
const KIT_THEME_MAP = {
  sst_fi: ['secourisme', 'sst'],
  sst_mac: ['secourisme', 'sst'],
  incendie: ['incendie', 'epi'],
  gestes_postures: ['gestes', 'postures', 'ergonomie', 'prap'],
  r489: ['r489', 'chariot', 'conduite'],
  r485: ['r485', 'gerbeur'],
  habilitation_electrique: ['électri', 'habilitation'],
}

export default function DocumentsVierges() {
  const { organization, fetchOrganization, themes, fetchThemes, fetchThemeQuestions } = useDataStore()
  const [loadingTheme, setLoadingTheme] = useState(null)
  const [loadingGrid, setLoadingGrid] = useState(null)
  const [loadingKit, setLoadingKit] = useState(null)
  const [kitProgress, setKitProgress] = useState(null)

  useEffect(() => {
    fetchOrganization()
    fetchThemes()
  }, [])

  useEffect(() => {
    if (organization) setOrganization(organization)
  }, [organization])

  const handleDownload = (docType) => {
    try {
      downloadDocument(docType, null, { isBlank: true })
      toast.success('Document téléchargé')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du téléchargement')
    }
  }

  const handleDownloadThemeTest = async (theme) => {
    setLoadingTheme(theme.id)
    try {
      const { data: questions } = await fetchThemeQuestions(theme.id)
      if (!questions || questions.length === 0) {
        toast.error(`Aucune question pour le thème ${theme.name}. Créez-en dans "Tests positionnement".`)
        setLoadingTheme(null)
        return
      }
      downloadDocument('positionnement', null, { isBlank: true, questions, themeName: theme.name })
      toast.success('Test téléchargé')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du téléchargement')
    }
    setLoadingTheme(null)
  }

  const handleDownloadGrid = (gridKey) => {
    setLoadingGrid(gridKey)
    try {
      downloadCompetencyGrid(gridKey)
      toast.success('Grille téléchargée')
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du téléchargement')
    }
    setLoadingGrid(null)
  }

  const handleDownloadPasseport = (version) => {
    try {
      downloadPasseportPrevention(version)
      toast.success(`Notice Passeport Prévention (${version}) téléchargée`)
    } catch (error) {
      console.error(error)
      toast.error('Erreur lors du téléchargement')
    }
  }

  // ─── Kit Secours ───────────────────────────────────────
  const handleDownloadKit = async (kitKey) => {
    setLoadingKit(kitKey)
    setKitProgress(null)
    try {
      // Trouver les questions de positionnement correspondantes
      let questions = null
      const themeKeywords = KIT_THEME_MAP[kitKey] || []
      if (themeKeywords.length > 0 && themes.length > 0) {
        const matchedTheme = themes.find(t => {
          const name = t.name.toLowerCase()
          return themeKeywords.some(kw => name.includes(kw))
        })
        if (matchedTheme) {
          try {
            const { data: q } = await fetchThemeQuestions(matchedTheme.id)
            if (q && q.length > 0) questions = q
          } catch { /* pas grave si pas de questions */ }
        }
      }

      await downloadKitSecours(kitKey, {
        questions,
        onProgress: (step, total, label) => {
          setKitProgress({ step, total, label })
        },
      })
      toast.success(`Kit Secours ${KIT_CONFIG[kitKey].shortLabel} téléchargé ✓`)
    } catch (error) {
      console.error('Erreur Kit Secours:', error)
      toast.error(`Erreur : ${error.message || 'Échec de la génération'}`)
    }
    setLoadingKit(null)
    setKitProgress(null)
  }

  const adminDocs = [
    { id: 'reglement', label: 'Règlement intérieur', qualiopi: '9' },
    { id: 'livret', label: 'Livret d\'accueil', qualiopi: '1' },
    { id: 'analyseBesoin', label: 'Analyse du besoin', qualiopi: '4' },
  ]

  const formationDocs = [
    { id: 'emargement', label: 'Feuille d\'émargement (10 lignes)', qualiopi: '11' },
    { id: 'ficheRenseignements', label: 'Fiche de renseignements stagiaire', qualiopi: '4' },
    { id: 'evaluation', label: 'Évaluation à chaud', qualiopi: '30' },
    { id: 'evaluationFroid', label: 'Évaluation à froid', qualiopi: '30' },
    { id: 'evaluationFormateur', label: 'Évaluation formateur', qualiopi: '17' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents vierges</h1>
        <p className="text-gray-500">Téléchargez les documents vierges et kits terrain pour vos formations</p>
      </div>

      {/* ═══ Kit Secours Formation ═══ */}
      <div className="card border-2 border-red-200 bg-red-50/30">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-red-500">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-red-900">Kit Secours Formation</h2>
            <p className="text-xs text-red-700">
              ZIP complet prêt à imprimer : page de garde + intercalaires + 10 exemplaires de chaque document + grilles + tests
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 rounded-lg border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[10px] font-medium text-amber-700">Mode dégradé</span>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mb-3 ml-12">
          Imprimez 2-3 lots par formation. Recto-verso compatible. Chaque document est paginé et séparé par des intercalaires couleur.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {Object.entries(KIT_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => handleDownloadKit(key)}
              disabled={loadingKit !== null}
              className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-all disabled:opacity-50 text-left hover:shadow-sm group"
            >
              <div className="text-2xl flex-shrink-0">{config.emoji}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{config.shortLabel}</p>
                <p className="text-[10px] text-gray-400">
                  {config.documents.length} docs{config.competencyGrid ? ' + grille' : ''}{config.documents.some(d => d.type === 'sst_template') ? ' + INRS' : ''}
                </p>
                {loadingKit === key && kitProgress && (
                  <div className="mt-1">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-red-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${(kitProgress.step / kitProgress.total) * 100}%` }} />
                    </div>
                    <p className="text-[9px] text-gray-400 mt-0.5">{kitProgress.label}</p>
                  </div>
                )}
              </div>
              {loadingKit === key ? (
                <Loader2 className="w-4 h-4 text-red-500 animate-spin flex-shrink-0" />
              ) : (
                <Download className="w-4 h-4 text-gray-400 group-hover:text-red-500 flex-shrink-0 transition-colors" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* ═══ Documents administratifs ═══ */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold">Documents administratifs</h2>
          </div>
          <div className="space-y-2">
            {adminDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => handleDownload(doc.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{doc.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Q{doc.qualiopi}</span>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Documents formation ═══ */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-500">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold">Documents formation</h2>
          </div>
          <div className="space-y-2">
            {formationDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => handleDownload(doc.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{doc.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Q{doc.qualiopi}</span>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Tests de positionnement ═══ */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold">Tests de positionnement</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Ces tests utilisent les questions que vous avez créées dans "Tests positionnement"
          </p>
          <div className="space-y-2">
            {themes.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">Chargement des thèmes...</p>
            ) : (
              themes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => handleDownloadThemeTest(theme)}
                  disabled={loadingTheme === theme.id}
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getThemeColor(theme.name) }} />
                    <span className="text-sm">Test {theme.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Q8</span>
                  </div>
                  {loadingTheme === theme.id ? (
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ═══ Grilles de compétences ═══ */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-500">
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold">Grilles de compétences</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Grilles d'évaluation pratique (Acquis / Non Acquis) par formation
          </p>
          <div className="space-y-2">
            {Object.entries(GRID_INFO).map(([key, info]) => (
              <button
                key={key}
                onClick={() => handleDownloadGrid(key)}
                disabled={loadingGrid === key}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: FORMATION_COLORS[key] || '#6b7280' }} />
                  <span className="text-sm">{info.title}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Q22</span>
                </div>
                {loadingGrid === key ? (
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-gray-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Passeport Prévention ═══ */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-teal-500">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-semibold">Passeport Prévention</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Notices d'information sur le Passeport de Prévention (loi Santé au Travail 2021)
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleDownloadPasseport('stagiaire')}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span>
                <div>
                  <span className="text-sm font-medium">Version stagiaire</span>
                  <p className="text-[10px] text-gray-400">À remettre aux stagiaires en fin de formation</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={() => handleDownloadPasseport('entreprise')}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">🏢</span>
                <div>
                  <span className="text-sm font-medium">Version entreprise</span>
                  <p className="text-[10px] text-gray-400">À joindre aux conventions ou documents client</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Qualiopi */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-blue-800 mb-1">Indicateurs Qualiopi</h3>
            <p className="text-sm text-blue-700">
              Les badges (Q4, Q8, Q11, Q22, Q30) indiquent l'indicateur Qualiopi auquel correspond chaque document.
              Les kits secours regroupent tous les documents nécessaires par formation (×10 exemplaires).
              Les grilles de compétences répondent à l'indicateur Q22 (évaluation des acquis).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
