import { useState } from 'react'
import { 
  FileText, Download, FolderOpen, ChevronDown, ChevronRight,
  Building2, ClipboardList, Table, CheckSquare, Users2, BarChart3, FileStack,
  Search, ExternalLink
} from 'lucide-react'

// Structure des documents du pack RNQ
const packStructure = [
  {
    id: 'gouvernance',
    name: 'Gouvernance',
    icon: Building2,
    color: 'bg-blue-500',
    description: 'Organisation et responsabilités',
    documents: [
      { name: 'Organigramme Access Formation', file: 'Organigramme_Access_Formation_2026-01-09.docx', type: 'docx' },
    ],
    subfolders: [
      {
        name: 'Lettres de désignation',
        documents: [
          { code: 'AF-DESQUAL', name: 'Désignation Responsable Qualité', file: '02_Lettres_Designation/AF-DESQUAL-V2.5.16.docx' },
          { code: 'AF-DESHAND', name: 'Désignation Référent Handicap', file: '02_Lettres_Designation/AF-DESHAND-V2.5.16.docx' },
          { code: 'AF-DESDEON', name: 'Désignation Référent Déontologie', file: '02_Lettres_Designation/AF-DESDEON-V2.5.16.docx' },
          { code: 'AF-DESRECL', name: 'Désignation Référent Réclamations', file: '02_Lettres_Designation/AF-DESRECL-V2.5.16.docx' },
          { code: 'AF-DESVEIL', name: 'Désignation Référent Veille', file: '02_Lettres_Designation/AF-DESVEIL-V2.5.16.docx' },
          { code: 'AF-DESAMEL', name: 'Désignation Référent Amélioration', file: '02_Lettres_Designation/AF-DESAMEL-V2.5.16.docx' },
          { code: 'AF-DESRGPD', name: 'Désignation Référent RGPD', file: '02_Lettres_Designation/AF-DESRGPD-V2.5.16.docx' },
        ]
      }
    ],
    path: '01_Gouvernance'
  },
  {
    id: 'procedures',
    name: 'Procédures',
    icon: ClipboardList,
    color: 'bg-green-500',
    description: 'Processus et modes opératoires',
    documents: [
      { code: 'AF-INFO', name: 'Procédure Information du public', file: 'AF-INFO-V2.5.16.docx' },
      { code: 'AF-BESOINPROC', name: 'Procédure Analyse des besoins', file: 'AF-BESOINPROC-V2.5.16.docx' },
      { code: 'AF-CONCEP', name: 'Procédure Conception des formations', file: 'AF-CONCEP-V2.5.16.docx' },
      { code: 'AF-DOC', name: 'Procédure Gestion documentaire', file: 'AF-DOC-V2.5.16.docx' },
      { code: 'AF-INTRA', name: 'Procédure Formation intra-entreprise', file: 'AF-INTRA-V2.5.16.docx' },
      { code: 'AF-REAL', name: 'Procédure Réalisation des formations', file: 'AF-REAL-V2.5.16.docx' },
      { code: 'AF-EVALPROC', name: 'Procédure Évaluation des acquis', file: 'AF-EVALPROC-V2.5.16.docx' },
      { code: 'AF-SAT', name: 'Procédure Satisfaction', file: 'AF-SAT-V2.5.16.docx' },
      { code: 'AF-RECLPROC', name: 'Procédure Réclamations', file: 'AF-RECLPROC-V2.5.16.docx' },
      { code: 'AF-NC', name: 'Procédure Non-conformités', file: 'AF-NC-V2.5.16.docx' },
      { code: 'AF-VEILLE', name: 'Procédure Veille réglementaire', file: 'AF-VEILLE-V2.5.16.docx' },
      { code: 'AF-RGPD', name: 'Procédure RGPD', file: 'AF-RGPD-V2.5.16.docx' },
      { code: 'AF-MAT', name: 'Procédure Gestion du matériel', file: 'AF-MAT-V2.5.16.docx' },
      { code: 'AF-INCID', name: 'Procédure Gestion des incidents', file: 'AF-INCID-V2.5.16.docx' },
      { code: 'AF-SSTRAIT', name: 'Procédure Sous-traitance', file: 'AF-SSTRAIT-V2.5.16.docx' },
    ],
    path: '02_Procedures'
  },
  {
    id: 'registres',
    name: 'Registres',
    icon: Table,
    color: 'bg-purple-500',
    description: 'Tableaux de suivi et registres',
    documents: [
      { code: 'AF-VERREG', name: 'Registre des versions', file: 'AF-VERREG-V2.5.16.xlsx' },
      { code: 'AF-VEILREG', name: 'Registre de veille', file: 'AF-VEILREG-V2.5.16.xlsx' },
      { code: 'AF-RECLREG', name: 'Registre des réclamations', file: 'AF-RECLREG-V2.5.16.xlsx' },
      { code: 'AF-NCREG', name: 'Registre des non-conformités', file: 'AF-NCREG-V2.5.16.xlsx' },
      { code: 'AF-HANDREG', name: 'Registre handicap', file: 'AF-HANDREG-V2.5.16.xlsx' },
      { code: 'AF-RGPDREG', name: 'Registre RGPD', file: 'AF-RGPDREG-V2.5.16.xlsx' },
      { code: 'AF-MATREG', name: 'Registre matériel', file: 'AF-MATREG-V2.5.16.xlsx' },
      { code: 'AF-INDIC', name: 'Tableau des indicateurs', file: 'AF-INDIC-V2.5.16.xlsx' },
      { code: 'AF-AUDINT', name: 'Registre audit interne', file: 'AF-AUDINT-V2.5.16.xlsx' },
      { code: 'AF-EVALPREST', name: 'Évaluation des prestataires', file: 'AF-EVALPREST-V2.5.16.xlsx' },
    ],
    path: '03_Registres_XLSX'
  },
  {
    id: 'checklists',
    name: 'Checklists & Formulaires',
    icon: CheckSquare,
    color: 'bg-orange-500',
    description: 'Listes de contrôle et formulaires',
    documents: [
      { code: 'AF-CKSITE', name: 'Checklist vérification site', file: 'AF-CKSITE-V2.5.16.docx' },
      { code: 'AF-INCIDF', name: 'Fiche incident', file: 'AF-INCIDF-V2.5.16.docx' },
    ],
    path: '04_Checklists_Forms'
  },
  {
    id: 'soustraitance',
    name: 'Sous-traitance',
    icon: Users2,
    color: 'bg-teal-500',
    description: 'Documents pour les partenaires',
    documents: [
      { code: 'AF-CTRAIT', name: 'Contrat sous-traitance', file: 'AF-CTRAIT-V2.5.16.docx' },
      { code: 'AF-CHARTETRAIT', name: 'Charte sous-traitant', file: 'AF-CHARTETRAIT-V2.5.16.docx' },
      { code: 'AF-NDA', name: 'Accord de confidentialité', file: 'AF-NDA-V2.5.16.docx' },
    ],
    path: '05_SousTraitance'
  },
  {
    id: 'pilotage',
    name: 'Pilotage',
    icon: BarChart3,
    color: 'bg-red-500',
    description: 'Revue de direction et audit',
    documents: [
      { code: 'AF-RDD', name: 'Trame Revue de direction', file: 'AF-RDD-V2.5.16.docx' },
      { code: 'AF-AUDINT-RAPPORT', name: 'Rapport audit interne', file: 'AF-AUDINT-RAPPORT-V2.5.16.docx' },
    ],
    path: '06_Pilotage'
  }
]

export default function DocumentsQualite() {
  const [expandedCategories, setExpandedCategories] = useState(['gouvernance', 'procedures'])
  const [search, setSearch] = useState('')
  
  const toggleCategory = (id) => {
    setExpandedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }
  
  const downloadFile = (category, fileName) => {
    const url = `/qualite/${category.path}/${fileName}`
    window.open(url, '_blank')
  }
  
  const getFileIcon = (fileName) => {
    if (fileName.endsWith('.pdf')) return '📄'
    if (fileName.endsWith('.docx')) return '📝'
    if (fileName.endsWith('.xlsx')) return '📊'
    return '📁'
  }
  
  // Filtrer les documents
  const filterDocs = (docs) => {
    if (!search) return docs
    const searchLower = search.toLowerCase()
    return docs.filter(d => 
      d.name.toLowerCase().includes(searchLower) ||
      (d.code && d.code.toLowerCase().includes(searchLower))
    )
  }
  
  // Compter tous les documents
  const totalDocs = packStructure.reduce((acc, cat) => {
    let count = cat.documents.length
    if (cat.subfolders) {
      count += cat.subfolders.reduce((a, sf) => a + sf.documents.length, 0)
    }
    return acc + count
  }, 0)
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents Qualité RNQ</h1>
          <p className="text-gray-500 mt-1">Pack documentaire - {totalDocs} documents</p>
        </div>
        
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un document..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
      </div>
      
      {/* Info card */}
      <div className="card bg-gradient-to-r from-primary-50 to-accent-50 border-primary-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <FileText className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Pack RNQ Access Formation</h3>
            <p className="text-sm text-gray-600 mt-1">
              Ensemble des documents nécessaires à la conformité au Référentiel National Qualité.
              Procédures, registres, trames et modèles pour l'audit.
            </p>
            <p className="text-xs text-gray-500 mt-2">Version 2.5.16 • Mise à jour : 09/01/2026</p>
          </div>
        </div>
      </div>
      
      {/* Categories */}
      <div className="space-y-4">
        {packStructure.map(category => {
          const isExpanded = expandedCategories.includes(category.id)
          const filteredDocs = filterDocs(category.documents)
          const hasResults = filteredDocs.length > 0 || 
            (category.subfolders && category.subfolders.some(sf => filterDocs(sf.documents).length > 0))
          
          if (search && !hasResults) return null
          
          return (
            <div key={category.id} className="card overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className={`p-2 ${category.color} rounded-lg`}>
                  <category.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-gray-900">{category.name}</h3>
                  <p className="text-sm text-gray-500">{category.description}</p>
                </div>
                <span className="text-sm text-gray-400 mr-2">
                  {category.documents.length + (category.subfolders?.reduce((a, sf) => a + sf.documents.length, 0) || 0)} docs
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              {/* Documents list */}
              {isExpanded && (
                <div className="border-t divide-y">
                  {/* Main documents */}
                  {filteredDocs.map((doc, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getFileIcon(doc.file)}</span>
                        <div>
                          {doc.code && (
                            <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded mr-2">
                              {doc.code}
                            </span>
                          )}
                          <span className="text-gray-900">{doc.name}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => downloadFile(category, doc.file)}
                        className="btn btn-sm btn-secondary flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Ouvrir
                      </button>
                    </div>
                  ))}
                  
                  {/* Subfolders */}
                  {category.subfolders?.map((subfolder, sfIdx) => {
                    const sfDocs = filterDocs(subfolder.documents)
                    if (search && sfDocs.length === 0) return null
                    
                    return (
                      <div key={sfIdx} className="bg-gray-50">
                        <div className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-gray-600">
                          <FolderOpen className="w-4 h-4" />
                          {subfolder.name}
                        </div>
                        <div className="divide-y border-t">
                          {sfDocs.map((doc, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center justify-between px-4 py-3 pl-10 hover:bg-gray-100 bg-white"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{getFileIcon(doc.file)}</span>
                                <div>
                                  {doc.code && (
                                    <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded mr-2">
                                      {doc.code}
                                    </span>
                                  )}
                                  <span className="text-gray-900">{doc.name}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => downloadFile(category, doc.file)}
                                className="btn btn-sm btn-secondary flex items-center gap-1"
                              >
                                <Download className="w-4 h-4" />
                                Ouvrir
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Footer info */}
      <div className="text-center text-sm text-gray-500 py-4">
        <p>Ces documents sont conformes au Référentiel National Qualité (RNQ)</p>
        <p className="mt-1">Pour toute modification, créez une nouvelle version sans supprimer l'original.</p>
      </div>
    </div>
  )
}
