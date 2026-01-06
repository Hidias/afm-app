import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Plus, Edit2, Trash2, Save, Download, FileText, Eye, EyeOff,
  ZoomIn, ZoomOut, Move, Circle, Square, Diamond, FileOutput,
  Link2, Settings, ChevronLeft, ChevronRight, Copy, History,
  Image, File, Users, Clock, Wrench, Tag, X, Check, Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'

// Formes du logigramme
const SHAPE_TYPES = {
  start: { label: 'Début', icon: '○', color: '#22C55E', description: 'Point de départ du process' },
  end: { label: 'Fin', icon: '○', color: '#EF4444', description: 'Point de fin du process' },
  action: { label: 'Action', icon: '▭', color: '#3B82F6', description: 'Étape ou action à réaliser' },
  decision: { label: 'Décision', icon: '◇', color: '#F59E0B', description: 'Point de décision (Oui/Non)' },
  document: { label: 'Document', icon: '▱', color: '#8B5CF6', description: 'Document à produire ou utiliser' },
  subprocess: { label: 'Sous-process', icon: '▢', color: '#06B6D4', description: 'Lien vers un autre process' },
}

// Catégories par défaut
const DEFAULT_CATEGORIES = [
  { id: 'commercial', name: 'Commercial', color: '#3B82F6' },
  { id: 'preparation', name: 'Préparation', color: '#22C55E' },
  { id: 'formation', name: 'Formation', color: '#EAB308' },
  { id: 'post-formation', name: 'Post-formation', color: '#F97316' },
  { id: 'qualite', name: 'Qualité', color: '#EF4444' },
]

export default function ProcessEditor({ onBack }) {
  // États principaux
  const [processes, setProcesses] = useState([])
  const [selectedProcess, setSelectedProcess] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // États de l'éditeur
  const [steps, setSteps] = useState([])
  const [connections, setConnections] = useState([])
  const [selectedStep, setSelectedStep] = useState(null)
  const [selectedConnection, setSelectedConnection] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectFrom, setConnectFrom] = useState(null)
  
  // États du canvas
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  
  // États des données de référence
  const [categories, setCategories] = useState([])
  const [responsibles, setResponsibles] = useState([])
  const [documents, setDocuments] = useState([])
  const [allProcesses, setAllProcesses] = useState([])
  
  // États UI
  const [showNewProcessModal, setShowNewProcessModal] = useState(false)
  const [showStepPanel, setShowStepPanel] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [draggedShape, setDraggedShape] = useState(null)
  const [editingStep, setEditingStep] = useState(null)
  
  // Refs
  const canvasRef = useRef(null)
  const svgRef = useRef(null)
  
  // Vérifier si l'utilisateur est admin
  const [isAdmin, setIsAdmin] = useState(false)
  
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const adminEmails = ['music861@hotmail.fr', 'music86@hotmail.fr', 'contact@accessformation.fr']
        setIsAdmin(adminEmails.includes(user.email?.toLowerCase()))
      }
    }
    checkAdmin()
  }, [])
  
  // Charger les données initiales
  useEffect(() => {
    fetchData()
  }, [])
  
  const fetchData = async () => {
    setLoading(true)
    try {
      // Charger les process
      const { data: processesData } = await supabase
        .from('processes')
        .select('*')
        .order('code')
      setProcesses(processesData || [])
      setAllProcesses(processesData || [])
      
      // Charger les catégories
      const { data: categoriesData } = await supabase
        .from('process_categories')
        .select('*')
        .order('name')
      setCategories(categoriesData || DEFAULT_CATEGORIES)
      
      // Charger les responsables
      const { data: responsiblesData } = await supabase
        .from('process_responsibles')
        .select('*')
        .order('name')
      setResponsibles(responsiblesData || [])
      
      // Charger les documents pour les liens
      const { data: docsData } = await supabase
        .from('document_templates')
        .select('id, name, category')
        .order('name')
      setDocuments(docsData || [])
      
    } catch (err) {
      console.error('Erreur chargement:', err)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }
  
  // Charger un process spécifique
  const loadProcess = async (process) => {
    setSelectedProcess(process)
    
    // Charger les étapes
    const { data: stepsData } = await supabase
      .from('process_steps')
      .select('*')
      .eq('process_id', process.id)
    setSteps(stepsData || [])
    
    // Charger les connexions
    const { data: connectionsData } = await supabase
      .from('process_connections')
      .select('*')
      .eq('process_id', process.id)
    setConnections(connectionsData || [])
    
    setSelectedStep(null)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  
  // Créer un nouveau process
  const [newProcessForm, setNewProcessForm] = useState({ title: '', description: '', category_id: '' })
  
  const generateProcessCode = () => {
    const maxCode = processes.reduce((max, p) => {
      const num = parseInt(p.code?.replace('PR-', '') || '0')
      return num > max ? num : max
    }, 0)
    return `PR-${String(maxCode + 1).padStart(3, '0')}`
  }
  
  const handleCreateProcess = async () => {
    if (!newProcessForm.title.trim()) {
      toast.error('Le titre est requis')
      return
    }
    
    const code = generateProcessCode()
    const { data, error } = await supabase
      .from('processes')
      .insert({
        code,
        title: newProcessForm.title,
        description: newProcessForm.description,
        category_id: newProcessForm.category_id || null,
        version: 1,
        status: 'active',
      })
      .select()
      .single()
    
    if (error) {
      toast.error('Erreur lors de la création')
      console.error(error)
      return
    }
    
    toast.success(`Process ${code} créé`)
    setShowNewProcessModal(false)
    setNewProcessForm({ title: '', description: '', category_id: '' })
    await fetchData()
    loadProcess(data)
  }
  
  // Ajouter une étape
  const handleAddStep = async (type, x = 200, y = 200) => {
    if (!selectedProcess || !isAdmin) return
    
    const { data, error } = await supabase
      .from('process_steps')
      .insert({
        process_id: selectedProcess.id,
        type,
        title: SHAPE_TYPES[type].label,
        position_x: x,
        position_y: y,
      })
      .select()
      .single()
    
    if (error) {
      toast.error('Erreur lors de l\'ajout')
      console.error(error)
      return
    }
    
    setSteps([...steps, data])
    setSelectedStep(data)
    setEditingStep(data)
  }
  
  // Mettre à jour une étape
  const handleUpdateStep = async (stepId, updates) => {
    if (!isAdmin) return
    
    const { error } = await supabase
      .from('process_steps')
      .update(updates)
      .eq('id', stepId)
    
    if (error) {
      toast.error('Erreur lors de la mise à jour')
      return
    }
    
    setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s))
    if (selectedStep?.id === stepId) {
      setSelectedStep({ ...selectedStep, ...updates })
    }
  }
  
  // Supprimer une étape
  const handleDeleteStep = async (stepId) => {
    if (!isAdmin) return
    if (!confirm('Supprimer cette étape ?')) return
    
    const { error } = await supabase
      .from('process_steps')
      .delete()
      .eq('id', stepId)
    
    if (error) {
      toast.error('Erreur lors de la suppression')
      return
    }
    
    setSteps(steps.filter(s => s.id !== stepId))
    setConnections(connections.filter(c => c.from_step_id !== stepId && c.to_step_id !== stepId))
    if (selectedStep?.id === stepId) {
      setSelectedStep(null)
      setEditingStep(null)
    }
    toast.success('Étape supprimée')
  }
  
  // Ajouter une connexion
  const handleAddConnection = async (fromId, toId, label = '') => {
    if (!isAdmin) return
    
    // Vérifier si la connexion existe déjà
    if (connections.some(c => c.from_step_id === fromId && c.to_step_id === toId)) {
      toast.error('Cette connexion existe déjà')
      return
    }
    
    const { data, error } = await supabase
      .from('process_connections')
      .insert({
        process_id: selectedProcess.id,
        from_step_id: fromId,
        to_step_id: toId,
        label,
      })
      .select()
      .single()
    
    if (error) {
      toast.error('Erreur lors de la connexion')
      return
    }
    
    setConnections([...connections, data])
  }
  
  // Supprimer une connexion
  const handleDeleteConnection = async (connectionId) => {
    if (!isAdmin) return
    
    const { error } = await supabase
      .from('process_connections')
      .delete()
      .eq('id', connectionId)
    
    if (error) {
      toast.error('Erreur lors de la suppression')
      return
    }
    
    setConnections(connections.filter(c => c.id !== connectionId))
  }
  
  // Déplacer une étape (drag)
  const handleStepDrag = (stepId, newX, newY) => {
    setSteps(steps.map(s => 
      s.id === stepId ? { ...s, position_x: newX, position_y: newY } : s
    ))
  }
  
  const handleStepDragEnd = async (stepId, newX, newY) => {
    if (!isAdmin) return
    
    await supabase
      .from('process_steps')
      .update({ position_x: newX, position_y: newY })
      .eq('id', stepId)
  }
  
  // Sauvegarder une version
  const handleSaveVersion = async () => {
    if (!selectedProcess || !isAdmin) return
    
    setSaving(true)
    try {
      // Créer un snapshot
      const snapshot = {
        process: selectedProcess,
        steps,
        connections,
      }
      
      // Sauvegarder dans l'historique
      await supabase
        .from('process_versions')
        .insert({
          process_id: selectedProcess.id,
          version: selectedProcess.version,
          data: snapshot,
        })
      
      // Incrémenter la version
      const newVersion = selectedProcess.version + 1
      await supabase
        .from('processes')
        .update({ 
          version: newVersion,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedProcess.id)
      
      setSelectedProcess({ ...selectedProcess, version: newVersion })
      toast.success(`Version ${newVersion} enregistrée`)
      
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }
  
  // Export PNG
  const handleExportPNG = async () => {
    if (!svgRef.current) return
    
    toast.loading('Génération de l\'image...')
    
    try {
      // Créer un canvas
      const svg = svgRef.current
      const bbox = svg.getBBox()
      const canvas = document.createElement('canvas')
      const scale = 2 // Haute résolution
      canvas.width = (bbox.width + 100) * scale
      canvas.height = (bbox.height + 150) * scale
      const ctx = canvas.getContext('2d')
      
      // Fond blanc
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Titre et code
      ctx.fillStyle = '#1F2937'
      ctx.font = `bold ${24 * scale}px Arial`
      ctx.fillText(`${selectedProcess.code}-V${selectedProcess.version}`, 20 * scale, 30 * scale)
      ctx.font = `${18 * scale}px Arial`
      ctx.fillText(selectedProcess.title, 20 * scale, 55 * scale)
      
      // Date
      ctx.font = `${12 * scale}px Arial`
      ctx.fillStyle = '#6B7280'
      ctx.fillText(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 20 * scale, 75 * scale)
      
      // SVG vers image
      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 20 * scale, 90 * scale, bbox.width * scale, bbox.height * scale)
        URL.revokeObjectURL(url)
        
        // Télécharger
        const link = document.createElement('a')
        link.download = `${selectedProcess.code}-V${selectedProcess.version}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        
        toast.dismiss()
        toast.success('Image exportée')
      }
      img.src = url
      
    } catch (err) {
      console.error(err)
      toast.dismiss()
      toast.error('Erreur lors de l\'export')
    }
  }
  
  // Rendu d'une forme SVG
  const renderShape = (step) => {
    const { type, position_x: x, position_y: y, title } = step
    const isSelected = selectedStep?.id === step.id
    const shapeInfo = SHAPE_TYPES[type]
    const category = categories.find(c => c.id === step.category_id)
    const fillColor = category?.color || shapeInfo.color
    
    const width = 160
    const height = type === 'decision' ? 80 : 60
    
    let shape
    switch (type) {
      case 'start':
      case 'end':
        shape = (
          <ellipse
            cx={x + width/2}
            cy={y + height/2}
            rx={width/2}
            ry={height/2}
            fill={fillColor}
            stroke={isSelected ? '#000' : '#666'}
            strokeWidth={isSelected ? 3 : 1}
          />
        )
        break
      case 'decision':
        const points = `${x + width/2},${y} ${x + width},${y + height/2} ${x + width/2},${y + height} ${x},${y + height/2}`
        shape = (
          <polygon
            points={points}
            fill={fillColor}
            stroke={isSelected ? '#000' : '#666'}
            strokeWidth={isSelected ? 3 : 1}
          />
        )
        break
      case 'document':
        shape = (
          <path
            d={`M${x},${y + 10} L${x},${y + height - 10} Q${x + width/4},${y + height} ${x + width/2},${y + height - 10} Q${x + 3*width/4},${y + height - 20} ${x + width},${y + height - 10} L${x + width},${y + 10} Q${x + 3*width/4},${y} ${x + width/2},${y + 10} Q${x + width/4},${y + 20} ${x},${y + 10} Z`}
            fill={fillColor}
            stroke={isSelected ? '#000' : '#666'}
            strokeWidth={isSelected ? 3 : 1}
          />
        )
        break
      case 'subprocess':
        shape = (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={10}
            ry={10}
            fill={fillColor}
            stroke={isSelected ? '#000' : '#666'}
            strokeWidth={isSelected ? 3 : 1}
          />
        )
        break
      default: // action
        shape = (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={fillColor}
            stroke={isSelected ? '#000' : '#666'}
            strokeWidth={isSelected ? 3 : 1}
          />
        )
    }
    
    return (
      <g
        key={step.id}
        className="cursor-move"
        onMouseDown={(e) => {
          if (!isAdmin) return
          e.stopPropagation()
          setSelectedStep(step)
          const startX = e.clientX
          const startY = e.clientY
          const startPosX = step.position_x
          const startPosY = step.position_y
          
          const handleMouseMove = (e) => {
            const dx = (e.clientX - startX) / zoom
            const dy = (e.clientY - startY) / zoom
            handleStepDrag(step.id, startPosX + dx, startPosY + dy)
          }
          
          const handleMouseUp = (e) => {
            const dx = (e.clientX - startX) / zoom
            const dy = (e.clientY - startY) / zoom
            handleStepDragEnd(step.id, startPosX + dx, startPosY + dy)
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
          }
          
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mouseup', handleMouseUp)
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (isConnecting && connectFrom) {
            handleAddConnection(connectFrom, step.id)
            setIsConnecting(false)
            setConnectFrom(null)
          } else {
            setSelectedStep(step)
          }
        }}
        onDoubleClick={() => isAdmin && setEditingStep(step)}
      >
        {shape}
        <text
          x={x + width/2}
          y={y + height/2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="12"
          fontWeight="bold"
          style={{ pointerEvents: 'none' }}
        >
          {title?.length > 20 ? title.substring(0, 18) + '...' : title}
        </text>
      </g>
    )
  }
  
  // Rendu d'une connexion (flèche)
  const renderConnection = (conn) => {
    const fromStep = steps.find(s => s.id === conn.from_step_id)
    const toStep = steps.find(s => s.id === conn.to_step_id)
    if (!fromStep || !toStep) return null
    
    const fromX = fromStep.position_x + 80
    const fromY = fromStep.position_y + (fromStep.type === 'decision' ? 80 : 60)
    const toX = toStep.position_x + 80
    const toY = toStep.position_y
    
    // Calculer le chemin
    const midY = (fromY + toY) / 2
    const path = `M${fromX},${fromY} C${fromX},${midY} ${toX},${midY} ${toX},${toY}`
    
    return (
      <g key={conn.id}>
        <path
          d={path}
          fill="none"
          stroke={selectedConnection?.id === conn.id ? '#000' : '#666'}
          strokeWidth={selectedConnection?.id === conn.id ? 3 : 2}
          markerEnd="url(#arrowhead)"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedConnection(conn)
          }}
          className="cursor-pointer"
        />
        {conn.label && (
          <text
            x={(fromX + toX) / 2}
            y={midY - 5}
            textAnchor="middle"
            fontSize="11"
            fill="#374151"
            className="bg-white"
          >
            {conn.label}
          </text>
        )}
      </g>
    )
  }
  
  // Légende
  const renderLegend = () => (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
      <p className="font-bold mb-2">Légende</p>
      <div className="space-y-1">
        {Object.entries(SHAPE_TYPES).map(([key, { label, color }]) => (
          <div key={key} className="flex items-center gap-2">
            <div 
              className={`w-4 h-3 ${key === 'start' || key === 'end' ? 'rounded-full' : key === 'decision' ? 'rotate-45' : key === 'subprocess' ? 'rounded' : ''}`}
              style={{ backgroundColor: color }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }
  
  return (
    <div className="h-full flex">
      {/* Liste des process (sidebar gauche) */}
      <div className="w-64 bg-gray-50 border-r flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-bold text-gray-900 mb-3">Process</h3>
          {isAdmin && (
            <button
              onClick={() => setShowNewProcessModal(true)}
              className="w-full btn btn-primary text-sm"
            >
              <Plus className="w-4 h-4 mr-1" /> Nouveau
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {processes.map(p => (
            <button
              key={p.id}
              onClick={() => loadProcess(p)}
              className={`w-full text-left p-2 rounded-lg text-sm transition ${
                selectedProcess?.id === p.id 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'hover:bg-gray-100'
              }`}
            >
              <div className="font-medium">{p.code}</div>
              <div className="text-xs text-gray-500 truncate">{p.title}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {p.status === 'active' ? 'Actif' : 'Inactif'}
                </span>
                <span className="text-xs text-gray-400">V{p.version}</span>
              </div>
            </button>
          ))}
          
          {processes.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-4">
              Aucun process
            </p>
          )}
        </div>
      </div>
      
      {/* Zone principale */}
      <div className="flex-1 flex flex-col">
        {selectedProcess ? (
          <>
            {/* Barre d'outils */}
            <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="font-bold">{selectedProcess.code}-V{selectedProcess.version}</h2>
                  <p className="text-sm text-gray-500">{selectedProcess.title}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  selectedProcess.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {selectedProcess.status === 'active' ? 'Actif' : 'Inactif'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Zoom */}
                <div className="flex items-center gap-1 bg-gray-100 rounded px-2">
                  <button onClick={() => setZoom(Math.max(0.25, zoom - 0.25))} className="p-1 hover:bg-gray-200 rounded">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(Math.min(2, zoom + 0.25))} className="p-1 hover:bg-gray-200 rounded">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
                
                {isAdmin && (
                  <>
                    <button
                      onClick={handleSaveVersion}
                      disabled={saving}
                      className="btn btn-secondary text-sm"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span className="ml-1">Sauvegarder</span>
                    </button>
                    
                    <button
                      onClick={handleExportPNG}
                      className="btn btn-secondary text-sm"
                    >
                      <Image className="w-4 h-4" />
                      <span className="ml-1">Export PNG</span>
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex-1 flex">
              {/* Palette de formes */}
              {isAdmin && (
                <div className="w-48 bg-gray-50 border-r p-3">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Formes</p>
                  <div className="space-y-2">
                    {Object.entries(SHAPE_TYPES).map(([type, { label, color, icon }]) => (
                      <button
                        key={type}
                        onClick={() => handleAddStep(type, 200 + Math.random() * 200, 100 + Math.random() * 200)}
                        className="w-full flex items-center gap-2 p-2 bg-white rounded border hover:border-primary-500 transition text-sm"
                      >
                        <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs" style={{ backgroundColor: color }}>
                          {icon}
                        </div>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Actions</p>
                    <button
                      onClick={() => {
                        setIsConnecting(!isConnecting)
                        setConnectFrom(selectedStep?.id)
                      }}
                      disabled={!selectedStep}
                      className={`w-full flex items-center gap-2 p-2 rounded border text-sm ${
                        isConnecting ? 'bg-primary-100 border-primary-500' : 'bg-white hover:border-primary-500'
                      } disabled:opacity-50`}
                    >
                      <Link2 className="w-4 h-4" />
                      <span>{isConnecting ? 'Cliquez sur la cible' : 'Connecter'}</span>
                    </button>
                    
                    {selectedStep && (
                      <button
                        onClick={() => handleDeleteStep(selectedStep.id)}
                        className="w-full flex items-center gap-2 p-2 bg-white rounded border hover:border-red-500 text-red-600 text-sm mt-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Canvas SVG */}
              <div 
                ref={canvasRef}
                className="flex-1 overflow-hidden bg-gray-100 relative"
                onMouseDown={(e) => {
                  if (e.target === canvasRef.current || e.target.tagName === 'svg') {
                    setSelectedStep(null)
                    setSelectedConnection(null)
                    setIsPanning(true)
                    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
                  }
                }}
                onMouseMove={(e) => {
                  if (isPanning) {
                    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
                  }
                }}
                onMouseUp={() => setIsPanning(false)}
                onMouseLeave={() => setIsPanning(false)}
              >
                <svg
                  ref={svgRef}
                  width="100%"
                  height="100%"
                  style={{ 
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: '0 0',
                  }}
                >
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="10"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
                    </marker>
                  </defs>
                  
                  {/* Grille */}
                  <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ddd" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="2000" height="2000" fill="url(#grid)" />
                  
                  {/* Connexions */}
                  {connections.map(renderConnection)}
                  
                  {/* Étapes */}
                  {steps.map(renderShape)}
                </svg>
                
                {/* Légende */}
                {renderLegend()}
              </div>
              
              {/* Panneau de propriétés */}
              {editingStep && isAdmin && (
                <div className="w-72 bg-white border-l p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">Propriétés</h3>
                    <button onClick={() => setEditingStep(null)} className="p-1 hover:bg-gray-100 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="label">Titre</label>
                      <input
                        type="text"
                        value={editingStep.title || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, title: e.target.value }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { title: e.target.value })
                        }}
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label className="label">Description</label>
                      <textarea
                        value={editingStep.description || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, description: e.target.value }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { description: e.target.value })
                        }}
                        className="input"
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <label className="label">Responsable</label>
                      <select
                        value={editingStep.responsible_id || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, responsible_id: e.target.value || null }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { responsible_id: e.target.value || null })
                        }}
                        className="input"
                      >
                        <option value="">-- Sélectionner --</option>
                        {responsibles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="label">Document lié</label>
                      <select
                        value={editingStep.document_id || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, document_id: e.target.value || null }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { document_id: e.target.value || null })
                        }}
                        className="input"
                      >
                        <option value="">-- Aucun --</option>
                        {documents.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="label">Délai</label>
                      <input
                        type="text"
                        placeholder="Ex: J+1, 48h, Immédiat"
                        value={editingStep.delay || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, delay: e.target.value }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { delay: e.target.value })
                        }}
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label className="label">Outil</label>
                      <input
                        type="text"
                        placeholder="Ex: Campus, Sellsy, Téléphone"
                        value={editingStep.tool || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, tool: e.target.value }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { tool: e.target.value })
                        }}
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label className="label">Catégorie</label>
                      <select
                        value={editingStep.category_id || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, category_id: e.target.value || null }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { category_id: e.target.value || null })
                        }}
                        className="input"
                      >
                        <option value="">-- Aucune --</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    {editingStep.type === 'subprocess' && (
                      <div>
                        <label className="label">Process lié</label>
                        <select
                          value={editingStep.linked_process_id || ''}
                          onChange={(e) => {
                            const updated = { ...editingStep, linked_process_id: e.target.value || null }
                            setEditingStep(updated)
                            handleUpdateStep(editingStep.id, { linked_process_id: e.target.value || null })
                          }}
                          className="input"
                        >
                          <option value="">-- Sélectionner --</option>
                          {allProcesses.filter(p => p.id !== selectedProcess?.id).map(p => (
                            <option key={p.id} value={p.id}>{p.code} - {p.title}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Sélectionnez un process ou créez-en un nouveau</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal nouveau process */}
      {showNewProcessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Nouveau Process</h3>
            
            <div className="space-y-4">
              <div>
                <label className="label">Code (auto-généré)</label>
                <input
                  type="text"
                  value={generateProcessCode()}
                  disabled
                  className="input bg-gray-100"
                />
              </div>
              
              <div>
                <label className="label">Titre *</label>
                <input
                  type="text"
                  value={newProcessForm.title}
                  onChange={(e) => setNewProcessForm({ ...newProcessForm, title: e.target.value })}
                  className="input"
                  placeholder="Ex: Process formation standard"
                />
              </div>
              
              <div>
                <label className="label">Description</label>
                <textarea
                  value={newProcessForm.description}
                  onChange={(e) => setNewProcessForm({ ...newProcessForm, description: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Description du process..."
                />
              </div>
              
              <div>
                <label className="label">Catégorie</label>
                <select
                  value={newProcessForm.category_id}
                  onChange={(e) => setNewProcessForm({ ...newProcessForm, category_id: e.target.value })}
                  className="input"
                >
                  <option value="">-- Sélectionner --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewProcessModal(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateProcess}
                className="btn btn-primary"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
