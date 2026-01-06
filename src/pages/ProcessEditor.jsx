import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Plus, Edit2, Trash2, Save, Download, FileText, Eye, EyeOff,
  ZoomIn, ZoomOut, Move, Circle, Square, Diamond, FileOutput,
  Link2, Settings, ChevronLeft, ChevronRight, Copy, History,
  Image, File, Users, Clock, Wrench, Tag, X, Check, Loader2,
  Printer, FileDown
} from 'lucide-react'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const SHAPE_TYPES = {
  start: { label: 'Début', color: '#22C55E', description: 'Point de départ du process' },
  end: { label: 'Fin', color: '#EF4444', description: 'Point de fin du process' },
  action: { label: 'Action', color: '#3B82F6', description: 'Étape ou action à réaliser' },
  decision: { label: 'Décision', color: '#F59E0B', description: 'Point de décision (Oui/Non)' },
  document: { label: 'Document', color: '#8B5CF6', description: 'Document à produire ou utiliser' },
  subprocess: { label: 'Sous-process', color: '#06B6D4', description: 'Lien vers un autre process' },
}

const SHAPE_WIDTH = 180
const SHAPE_HEIGHT = 70
const DECISION_HEIGHT = 90

// ═══════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export default function ProcessEditor() {
  // États principaux
  const [processes, setProcesses] = useState([])
  const [selectedProcess, setSelectedProcess] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // États de l'éditeur
  const [steps, setSteps] = useState([])
  const [connections, setConnections] = useState([])
  const [selectedStep, setSelectedStep] = useState(null)
  const [editingStep, setEditingStep] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectFrom, setConnectFrom] = useState(null)
  
  // États du canvas
  const [zoom, setZoom] = useState(0.8)
  const [pan, setPan] = useState({ x: 50, y: 20 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  
  // États des données de référence
  const [categories, setCategories] = useState([])
  const [responsibles, setResponsibles] = useState([])
  const [allProcesses, setAllProcesses] = useState([])
  
  // États UI
  const [showNewProcessModal, setShowNewProcessModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [newProcessForm, setNewProcessForm] = useState({ title: '', description: '', category_id: '' })
  
  // Drag state
  const [dragging, setDragging] = useState(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  // Refs
  const canvasRef = useRef(null)
  const svgRef = useRef(null)

  // ═══════════════════════════════════════════════════════════════════
  // CHARGEMENT DES DONNÉES
  // ═══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    fetchData()
  }, [])
  
  const fetchData = async () => {
    setLoading(true)
    try {
      // Charger les process
      const { data: processesData, error: processError } = await supabase
        .from('processes')
        .select('*')
        .order('code')
      
      if (processError) {
        console.error('Erreur processes:', processError)
        toast.error('Erreur chargement des process')
      } else {
        setProcesses(processesData || [])
        setAllProcesses(processesData || [])
      }
      
      // Charger les catégories
      const { data: categoriesData } = await supabase
        .from('process_categories')
        .select('*')
        .order('name')
      setCategories(categoriesData || [])
      
      // Charger les responsables
      const { data: responsiblesData } = await supabase
        .from('process_responsibles')
        .select('*')
        .order('name')
      setResponsibles(responsiblesData || [])
      
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
    setSelectedStep(null)
    setEditingStep(null)
    
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
    
    // Reset view
    setZoom(0.7)
    setPan({ x: 50, y: 20 })
  }

  // ═══════════════════════════════════════════════════════════════════
  // GESTION DES PROCESS
  // ═══════════════════════════════════════════════════════════════════
  
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

  // ═══════════════════════════════════════════════════════════════════
  // GESTION DES ÉTAPES
  // ═══════════════════════════════════════════════════════════════════
  
  const handleAddStep = async (type) => {
    if (!selectedProcess) {
      toast.error('Sélectionnez d\'abord un process')
      return
    }
    
    // Position au centre visible
    const newX = 300 + Math.random() * 100
    const newY = 100 + steps.length * 100
    
    const { data, error } = await supabase
      .from('process_steps')
      .insert({
        process_id: selectedProcess.id,
        type,
        title: SHAPE_TYPES[type].label,
        description: '',
        position_x: newX,
        position_y: newY,
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
    toast.success('Étape ajoutée')
  }
  
  const handleUpdateStep = async (stepId, updates) => {
    const { error } = await supabase
      .from('process_steps')
      .update(updates)
      .eq('id', stepId)
    
    if (error) {
      toast.error('Erreur lors de la mise à jour')
      return
    }
    
    setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s))
    if (editingStep?.id === stepId) {
      setEditingStep({ ...editingStep, ...updates })
    }
  }
  
  const handleDeleteStep = async (stepId) => {
    if (!confirm('Supprimer cette étape ?')) return
    
    // Supprimer les connexions liées
    await supabase
      .from('process_connections')
      .delete()
      .or(`from_step_id.eq.${stepId},to_step_id.eq.${stepId}`)
    
    // Supprimer l'étape
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
    setSelectedStep(null)
    setEditingStep(null)
    toast.success('Étape supprimée')
  }

  // ═══════════════════════════════════════════════════════════════════
  // GESTION DES CONNEXIONS
  // ═══════════════════════════════════════════════════════════════════
  
  const startConnection = () => {
    if (!selectedStep) {
      toast.error('Sélectionnez d\'abord une étape')
      return
    }
    setIsConnecting(true)
    setConnectFrom(selectedStep.id)
    toast('Cliquez sur l\'étape de destination', { icon: '🔗' })
  }
  
  const handleAddConnection = async (fromId, toId) => {
    if (fromId === toId) {
      toast.error('Connexion impossible vers soi-même')
      setIsConnecting(false)
      setConnectFrom(null)
      return
    }
    
    // Vérifier si la connexion existe
    if (connections.some(c => c.from_step_id === fromId && c.to_step_id === toId)) {
      toast.error('Cette connexion existe déjà')
      setIsConnecting(false)
      setConnectFrom(null)
      return
    }
    
    // Demander le label pour les décisions
    const fromStep = steps.find(s => s.id === fromId)
    let label = ''
    if (fromStep?.type === 'decision') {
      label = prompt('Label de la connexion (Oui/Non) :') || ''
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
      console.error(error)
    } else {
      setConnections([...connections, data])
      toast.success('Connexion créée')
    }
    
    setIsConnecting(false)
    setConnectFrom(null)
  }
  
  const handleDeleteConnection = async (connId) => {
    const { error } = await supabase
      .from('process_connections')
      .delete()
      .eq('id', connId)
    
    if (!error) {
      setConnections(connections.filter(c => c.id !== connId))
      toast.success('Connexion supprimée')
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DRAG & DROP
  // ═══════════════════════════════════════════════════════════════════
  
  const handleMouseDown = (e, step) => {
    e.stopPropagation()
    
    if (isConnecting && connectFrom) {
      handleAddConnection(connectFrom, step.id)
      return
    }
    
    setSelectedStep(step)
    setDragging(step.id)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      stepX: step.position_x,
      stepY: step.position_y
    })
  }
  
  const handleMouseMove = useCallback((e) => {
    if (dragging) {
      const dx = (e.clientX - dragStart.x) / zoom
      const dy = (e.clientY - dragStart.y) / zoom
      
      setSteps(prev => prev.map(s => 
        s.id === dragging 
          ? { ...s, position_x: dragStart.stepX + dx, position_y: dragStart.stepY + dy }
          : s
      ))
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }, [dragging, dragStart, zoom, isPanning, panStart])
  
  const handleMouseUp = useCallback(async () => {
    if (dragging) {
      const step = steps.find(s => s.id === dragging)
      if (step) {
        await supabase
          .from('process_steps')
          .update({ position_x: step.position_x, position_y: step.position_y })
          .eq('id', dragging)
      }
      setDragging(null)
    }
    setIsPanning(false)
  }, [dragging, steps])
  
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // ═══════════════════════════════════════════════════════════════════
  // SAUVEGARDE VERSION
  // ═══════════════════════════════════════════════════════════════════
  
  const handleSaveVersion = async () => {
    if (!selectedProcess) return
    
    setSaving(true)
    try {
      // Créer un snapshot
      const snapshot = { process: selectedProcess, steps, connections }
      
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
        .update({ version: newVersion, updated_at: new Date().toISOString() })
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

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT PNG
  // ═══════════════════════════════════════════════════════════════════
  
  const handleExportPNG = async () => {
    if (!selectedProcess || steps.length === 0) {
      toast.error('Aucun process à exporter')
      return
    }
    
    toast.loading('Génération de l\'image...')
    
    try {
      // Calculer les dimensions
      const minX = Math.min(...steps.map(s => s.position_x)) - 50
      const minY = Math.min(...steps.map(s => s.position_y)) - 50
      const maxX = Math.max(...steps.map(s => s.position_x + SHAPE_WIDTH)) + 50
      const maxY = Math.max(...steps.map(s => s.position_y + (s.type === 'decision' ? DECISION_HEIGHT : SHAPE_HEIGHT))) + 50
      
      const width = maxX - minX + 300 // Espace pour la légende
      const height = maxY - minY + 150 // Espace pour le header
      
      // Créer le canvas
      const canvas = document.createElement('canvas')
      const scale = 2
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')
      
      // Fond blanc
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      
      // Header
      ctx.fillStyle = '#1F2937'
      ctx.font = 'bold 24px Arial'
      ctx.fillText(`${selectedProcess.code}-V${selectedProcess.version}`, 20, 35)
      ctx.font = '16px Arial'
      ctx.fillText(selectedProcess.title, 20, 60)
      ctx.font = '12px Arial'
      ctx.fillStyle = '#6B7280'
      ctx.fillText(`Généré le ${new Date().toLocaleDateString('fr-FR')} | Access Formation`, 20, 80)
      
      const offsetX = -minX + 20
      const offsetY = -minY + 100
      
      // Dessiner les connexions
      ctx.strokeStyle = '#6B7280'
      ctx.lineWidth = 2
      connections.forEach(conn => {
        const from = steps.find(s => s.id === conn.from_step_id)
        const to = steps.find(s => s.id === conn.to_step_id)
        if (!from || !to) return
        
        const fromX = from.position_x + offsetX + SHAPE_WIDTH / 2
        const fromY = from.position_y + offsetY + (from.type === 'decision' ? DECISION_HEIGHT : SHAPE_HEIGHT)
        const toX = to.position_x + offsetX + SHAPE_WIDTH / 2
        const toY = to.position_y + offsetY
        
        ctx.beginPath()
        ctx.moveTo(fromX, fromY)
        ctx.lineTo(toX, toY)
        ctx.stroke()
        
        // Flèche
        const angle = Math.atan2(toY - fromY, toX - fromX)
        ctx.beginPath()
        ctx.moveTo(toX, toY)
        ctx.lineTo(toX - 10 * Math.cos(angle - Math.PI / 6), toY - 10 * Math.sin(angle - Math.PI / 6))
        ctx.lineTo(toX - 10 * Math.cos(angle + Math.PI / 6), toY - 10 * Math.sin(angle + Math.PI / 6))
        ctx.closePath()
        ctx.fillStyle = '#6B7280'
        ctx.fill()
        
        // Label
        if (conn.label) {
          ctx.fillStyle = '#374151'
          ctx.font = 'bold 11px Arial'
          ctx.fillText(conn.label, (fromX + toX) / 2 + 5, (fromY + toY) / 2)
        }
      })
      
      // Dessiner les étapes
      steps.forEach(step => {
        const x = step.position_x + offsetX
        const y = step.position_y + offsetY
        const h = step.type === 'decision' ? DECISION_HEIGHT : SHAPE_HEIGHT
        const color = SHAPE_TYPES[step.type]?.color || '#3B82F6'
        
        ctx.fillStyle = color
        ctx.strokeStyle = '#374151'
        ctx.lineWidth = 2
        
        if (step.type === 'start' || step.type === 'end') {
          // Ovale
          ctx.beginPath()
          ctx.ellipse(x + SHAPE_WIDTH / 2, y + h / 2, SHAPE_WIDTH / 2, h / 2, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        } else if (step.type === 'decision') {
          // Losange
          ctx.beginPath()
          ctx.moveTo(x + SHAPE_WIDTH / 2, y)
          ctx.lineTo(x + SHAPE_WIDTH, y + h / 2)
          ctx.lineTo(x + SHAPE_WIDTH / 2, y + h)
          ctx.lineTo(x, y + h / 2)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
        } else if (step.type === 'subprocess') {
          // Rectangle arrondi
          ctx.beginPath()
          ctx.roundRect(x, y, SHAPE_WIDTH, h, 15)
          ctx.fill()
          ctx.stroke()
        } else {
          // Rectangle
          ctx.beginPath()
          ctx.rect(x, y, SHAPE_WIDTH, h)
          ctx.fill()
          ctx.stroke()
        }
        
        // Texte
        ctx.fillStyle = 'white'
        ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // Tronquer le texte si trop long
        let title = step.title || ''
        if (ctx.measureText(title).width > SHAPE_WIDTH - 20) {
          while (ctx.measureText(title + '...').width > SHAPE_WIDTH - 20 && title.length > 0) {
            title = title.slice(0, -1)
          }
          title += '...'
        }
        ctx.fillText(title, x + SHAPE_WIDTH / 2, y + h / 2)
      })
      
      ctx.textAlign = 'left'
      
      // Légende
      const legendX = width - 160
      let legendY = 100
      ctx.fillStyle = '#1F2937'
      ctx.font = 'bold 14px Arial'
      ctx.fillText('Légende', legendX, legendY)
      legendY += 25
      
      Object.entries(SHAPE_TYPES).forEach(([key, { label, color }]) => {
        ctx.fillStyle = color
        ctx.fillRect(legendX, legendY - 10, 20, 15)
        ctx.fillStyle = '#374151'
        ctx.font = '12px Arial'
        ctx.fillText(label, legendX + 28, legendY)
        legendY += 22
      })
      
      // Télécharger
      const link = document.createElement('a')
      link.download = `${selectedProcess.code}-V${selectedProcess.version}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      
      toast.dismiss()
      toast.success('Image exportée !')
      
    } catch (err) {
      console.error('Erreur export:', err)
      toast.dismiss()
      toast.error('Erreur lors de l\'export')
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT DOCUMENT COMPLET
  // ═══════════════════════════════════════════════════════════════════
  
  const handleExportDocument = () => {
    if (!selectedProcess || steps.length === 0) {
      toast.error('Aucun process à exporter')
      return
    }
    
    // Trier les étapes par position Y puis X
    const sortedSteps = [...steps].sort((a, b) => {
      if (Math.abs(a.position_y - b.position_y) < 50) {
        return a.position_x - b.position_x
      }
      return a.position_y - b.position_y
    })
    
    // Générer le HTML
    let html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${selectedProcess.code}-V${selectedProcess.version} - ${selectedProcess.title}</title>
  <style>
    @page { size: A4; margin: 2cm; }
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #3B82F6; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { margin: 0; color: #1F2937; font-size: 28px; }
    .header .code { color: #3B82F6; font-size: 18px; margin-top: 5px; }
    .header .meta { color: #6B7280; font-size: 12px; margin-top: 10px; }
    .section { margin: 30px 0; }
    .section h2 { color: #1F2937; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
    th, td { border: 1px solid #D1D5DB; padding: 10px; text-align: left; }
    th { background: #F3F4F6; font-weight: bold; }
    tr:nth-child(even) { background: #F9FAFB; }
    .step-type { display: inline-block; padding: 3px 8px; border-radius: 4px; color: white; font-size: 11px; font-weight: bold; }
    .type-start { background: #22C55E; }
    .type-end { background: #EF4444; }
    .type-action { background: #3B82F6; }
    .type-decision { background: #F59E0B; }
    .type-document { background: #8B5CF6; }
    .type-subprocess { background: #06B6D4; }
    .legend { display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0; padding: 15px; background: #F9FAFB; border-radius: 8px; }
    .legend-item { display: flex; align-items: center; gap: 8px; }
    .legend-color { width: 20px; height: 15px; border-radius: 3px; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 11px; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${selectedProcess.title}</h1>
    <div class="code">${selectedProcess.code} - Version ${selectedProcess.version}</div>
    <div class="meta">
      Généré le ${new Date().toLocaleDateString('fr-FR')} | Access Formation<br>
      ${selectedProcess.description || ''}
    </div>
  </div>

  <div class="section">
    <h2>📋 Légende des symboles</h2>
    <div class="legend">
      <div class="legend-item"><div class="legend-color" style="background:#22C55E;border-radius:50%;"></div> Début/Fin</div>
      <div class="legend-item"><div class="legend-color" style="background:#3B82F6;"></div> Action</div>
      <div class="legend-item"><div class="legend-color" style="background:#F59E0B;transform:rotate(45deg);"></div> Décision</div>
      <div class="legend-item"><div class="legend-color" style="background:#8B5CF6;"></div> Document</div>
      <div class="legend-item"><div class="legend-color" style="background:#06B6D4;border-radius:5px;"></div> Sous-process</div>
    </div>
  </div>

  <div class="section">
    <h2>📝 Description détaillée des étapes</h2>
    <table>
      <thead>
        <tr>
          <th style="width:5%">N°</th>
          <th style="width:10%">Type</th>
          <th style="width:20%">Titre</th>
          <th style="width:25%">Description</th>
          <th style="width:12%">Responsable</th>
          <th style="width:8%">Délai</th>
          <th style="width:10%">Outil</th>
        </tr>
      </thead>
      <tbody>
`
    
    sortedSteps.forEach((step, index) => {
      const responsible = responsibles.find(r => r.id === step.responsible_id)
      const typeInfo = SHAPE_TYPES[step.type]
      
      html += `
        <tr>
          <td><strong>${index + 1}</strong></td>
          <td><span class="step-type type-${step.type}">${typeInfo?.label || step.type}</span></td>
          <td><strong>${step.title || '-'}</strong></td>
          <td>${step.description || '-'}</td>
          <td>${responsible?.name || '-'}</td>
          <td>${step.delay || '-'}</td>
          <td>${step.tool || '-'}</td>
        </tr>
`
    })
    
    html += `
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>🔗 Connexions entre étapes</h2>
    <table>
      <thead>
        <tr>
          <th>De</th>
          <th>Vers</th>
          <th>Condition</th>
        </tr>
      </thead>
      <tbody>
`
    
    connections.forEach(conn => {
      const from = steps.find(s => s.id === conn.from_step_id)
      const to = steps.find(s => s.id === conn.to_step_id)
      
      html += `
        <tr>
          <td>${from?.title || '-'}</td>
          <td>${to?.title || '-'}</td>
          <td>${conn.label || '-'}</td>
        </tr>
`
    })
    
    html += `
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Document généré automatiquement par Access Campus | ${selectedProcess.code}-V${selectedProcess.version}</p>
    <p>© Access Formation - Tous droits réservés</p>
  </div>
</body>
</html>
`
    
    // Créer et télécharger le fichier
    const blob = new Blob([html], { type: 'text/html' })
    const link = document.createElement('a')
    link.download = `${selectedProcess.code}-V${selectedProcess.version}-Document.html`
    link.href = URL.createObjectURL(blob)
    link.click()
    
    toast.success('Document exporté ! Ouvrez-le dans votre navigateur puis imprimez en PDF (Ctrl+P)')
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDU SVG
  // ═══════════════════════════════════════════════════════════════════
  
  const renderShape = (step) => {
    const { type, position_x: x, position_y: y, title } = step
    const isSelected = selectedStep?.id === step.id
    const h = type === 'decision' ? DECISION_HEIGHT : SHAPE_HEIGHT
    const color = SHAPE_TYPES[type]?.color || '#3B82F6'
    
    let shape
    switch (type) {
      case 'start':
      case 'end':
        shape = (
          <ellipse
            cx={x + SHAPE_WIDTH / 2}
            cy={y + h / 2}
            rx={SHAPE_WIDTH / 2}
            ry={h / 2}
            fill={color}
            stroke={isSelected ? '#000' : '#374151'}
            strokeWidth={isSelected ? 3 : 2}
          />
        )
        break
      case 'decision':
        shape = (
          <polygon
            points={`${x + SHAPE_WIDTH / 2},${y} ${x + SHAPE_WIDTH},${y + h / 2} ${x + SHAPE_WIDTH / 2},${y + h} ${x},${y + h / 2}`}
            fill={color}
            stroke={isSelected ? '#000' : '#374151'}
            strokeWidth={isSelected ? 3 : 2}
          />
        )
        break
      case 'subprocess':
        shape = (
          <rect
            x={x} y={y}
            width={SHAPE_WIDTH} height={h}
            rx={15} ry={15}
            fill={color}
            stroke={isSelected ? '#000' : '#374151'}
            strokeWidth={isSelected ? 3 : 2}
          />
        )
        break
      default:
        shape = (
          <rect
            x={x} y={y}
            width={SHAPE_WIDTH} height={h}
            fill={color}
            stroke={isSelected ? '#000' : '#374151'}
            strokeWidth={isSelected ? 3 : 2}
          />
        )
    }
    
    // Tronquer le titre
    let displayTitle = title || ''
    if (displayTitle.length > 22) {
      displayTitle = displayTitle.substring(0, 20) + '...'
    }
    
    return (
      <g
        key={step.id}
        className="cursor-move"
        onMouseDown={(e) => handleMouseDown(e, step)}
        onDoubleClick={() => setEditingStep(step)}
      >
        {shape}
        <text
          x={x + SHAPE_WIDTH / 2}
          y={y + h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="13"
          fontWeight="bold"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {displayTitle}
        </text>
        {/* Tooltip au survol */}
        <title>{title}</title>
      </g>
    )
  }
  
  const renderConnection = (conn) => {
    const from = steps.find(s => s.id === conn.from_step_id)
    const to = steps.find(s => s.id === conn.to_step_id)
    if (!from || !to) return null
    
    const fromH = from.type === 'decision' ? DECISION_HEIGHT : SHAPE_HEIGHT
    const fromX = from.position_x + SHAPE_WIDTH / 2
    const fromY = from.position_y + fromH
    const toX = to.position_x + SHAPE_WIDTH / 2
    const toY = to.position_y
    
    // Courbe de Bézier
    const midY = (fromY + toY) / 2
    const path = `M${fromX},${fromY} C${fromX},${midY} ${toX},${midY} ${toX},${toY}`
    
    return (
      <g key={conn.id}>
        <path
          d={path}
          fill="none"
          stroke="#6B7280"
          strokeWidth={2}
          markerEnd="url(#arrowhead)"
          className="cursor-pointer hover:stroke-red-500"
          onClick={() => {
            if (confirm('Supprimer cette connexion ?')) {
              handleDeleteConnection(conn.id)
            }
          }}
        />
        {conn.label && (
          <text
            x={(fromX + toX) / 2 + 10}
            y={midY}
            fontSize="12"
            fontWeight="bold"
            fill="#374151"
          >
            {conn.label}
          </text>
        )}
      </g>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDU PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2">Chargement des process...</span>
      </div>
    )
  }
  
  return (
    <div className="h-full flex">
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SIDEBAR GAUCHE - Liste des process */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="w-56 bg-gray-50 border-r flex flex-col">
        <div className="p-3 border-b">
          <h3 className="font-bold text-gray-900 mb-2">Process</h3>
          <button
            onClick={() => setShowNewProcessModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            <Plus className="w-4 h-4" /> Nouveau
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {processes.map(p => (
            <button
              key={p.id}
              onClick={() => loadProcess(p)}
              className={`w-full text-left p-2 rounded-lg text-sm transition ${
                selectedProcess?.id === p.id 
                  ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                  : 'hover:bg-gray-100'
              }`}
            >
              <div className="font-bold">{p.code}</div>
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
              Aucun process créé
            </p>
          )}
        </div>
      </div>
      
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ZONE PRINCIPALE */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col">
        {selectedProcess ? (
          <>
            {/* ══════════════════════════════════════════════════════════ */}
            {/* BARRE D'OUTILS */}
            {/* ══════════════════════════════════════════════════════════ */}
            <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="font-bold text-lg">{selectedProcess.code}-V{selectedProcess.version}</h2>
                  <p className="text-sm text-gray-500">{selectedProcess.title}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Zoom */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                  <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="p-1 hover:bg-gray-200 rounded">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs w-12 text-center font-medium">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(Math.min(1.5, zoom + 0.1))} className="p-1 hover:bg-gray-200 rounded">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
                
                <button
                  onClick={handleSaveVersion}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Sauvegarder
                </button>
                
                <button
                  onClick={handleExportPNG}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Image className="w-4 h-4" />
                  Export PNG
                </button>
                
                <button
                  onClick={handleExportDocument}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  <Printer className="w-4 h-4" />
                  Document
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              {/* ══════════════════════════════════════════════════════════ */}
              {/* PALETTE DE FORMES */}
              {/* ══════════════════════════════════════════════════════════ */}
              <div className="w-44 bg-gray-50 border-r p-3 overflow-y-auto">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Ajouter une forme</p>
                <div className="space-y-2">
                  {Object.entries(SHAPE_TYPES).map(([type, { label, color }]) => (
                    <button
                      key={type}
                      onClick={() => handleAddStep(type)}
                      className="w-full flex items-center gap-2 p-2 bg-white rounded-lg border hover:border-primary-500 hover:shadow transition text-sm"
                    >
                      <div 
                        className={`w-6 h-5 ${type === 'start' || type === 'end' ? 'rounded-full' : type === 'subprocess' ? 'rounded-md' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Actions</p>
                  
                  <button
                    onClick={startConnection}
                    disabled={!selectedStep}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg border text-sm mb-2 ${
                      isConnecting 
                        ? 'bg-orange-100 border-orange-500 text-orange-700' 
                        : 'bg-white hover:border-primary-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Link2 className="w-4 h-4" />
                    {isConnecting ? 'Cliquez la cible...' : 'Connecter'}
                  </button>
                  
                  {selectedStep && (
                    <>
                      <button
                        onClick={() => setEditingStep(selectedStep)}
                        className="w-full flex items-center gap-2 p-2 bg-white rounded-lg border hover:border-blue-500 text-blue-600 text-sm mb-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        Modifier
                      </button>
                      
                      <button
                        onClick={() => handleDeleteStep(selectedStep.id)}
                        className="w-full flex items-center gap-2 p-2 bg-white rounded-lg border hover:border-red-500 text-red-600 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
                
                {/* Légende */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Légende</p>
                  <div className="space-y-1 text-xs">
                    {Object.entries(SHAPE_TYPES).map(([type, { label, color }]) => (
                      <div key={type} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                        <span className="text-gray-600">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* ══════════════════════════════════════════════════════════ */}
              {/* CANVAS SVG */}
              {/* ══════════════════════════════════════════════════════════ */}
              <div 
                ref={canvasRef}
                className="flex-1 overflow-hidden bg-gray-100 relative"
                onMouseDown={(e) => {
                  if (e.target === canvasRef.current || e.target.tagName === 'svg' || e.target.tagName === 'rect') {
                    setSelectedStep(null)
                    if (isConnecting) {
                      setIsConnecting(false)
                      setConnectFrom(null)
                    }
                    setIsPanning(true)
                    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
                  }
                }}
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
                      <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" />
                    </marker>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ddd" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  
                  {/* Grille */}
                  <rect width="3000" height="3000" fill="url(#grid)" />
                  
                  {/* Connexions */}
                  {connections.map(renderConnection)}
                  
                  {/* Étapes */}
                  {steps.map(renderShape)}
                </svg>
                
                {steps.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Ajoutez des étapes depuis la palette de gauche</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* ══════════════════════════════════════════════════════════ */}
              {/* PANNEAU D'ÉDITION */}
              {/* ══════════════════════════════════════════════════════════ */}
              {editingStep && (
                <div className="w-72 bg-white border-l p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">Modifier l'étape</h3>
                    <button 
                      onClick={() => setEditingStep(null)} 
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                      <input
                        type="text"
                        value={editingStep.title || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, title: e.target.value }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { title: e.target.value })
                        }}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={editingStep.description || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, description: e.target.value }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { description: e.target.value })
                        }}
                        rows={3}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                      <select
                        value={editingStep.responsible_id || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, responsible_id: e.target.value || null }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { responsible_id: e.target.value || null })
                        }}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">-- Sélectionner --</option>
                        {responsibles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Délai</label>
                      <input
                        type="text"
                        placeholder="Ex: J+1, 48h, Immédiat"
                        value={editingStep.delay || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, delay: e.target.value }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { delay: e.target.value })
                        }}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Outil</label>
                      <input
                        type="text"
                        placeholder="Ex: Campus, Sellsy, Téléphone"
                        value={editingStep.tool || ''}
                        onChange={(e) => {
                          const updated = { ...editingStep, tool: e.target.value }
                          setEditingStep(updated)
                          handleUpdateStep(editingStep.id, { tool: e.target.value })
                        }}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    
                    {editingStep.type === 'subprocess' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Process lié</label>
                        <select
                          value={editingStep.linked_process_id || ''}
                          onChange={(e) => {
                            const updated = { ...editingStep, linked_process_id: e.target.value || null }
                            setEditingStep(updated)
                            handleUpdateStep(editingStep.id, { linked_process_id: e.target.value || null })
                          }}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
              <p className="text-lg">Sélectionnez un process</p>
              <p className="text-sm">ou créez-en un nouveau</p>
            </div>
          </div>
        )}
      </div>
      
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* MODAL NOUVEAU PROCESS */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {showNewProcessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Nouveau Process</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code (auto-généré)</label>
                <input
                  type="text"
                  value={generateProcessCode()}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  type="text"
                  value={newProcessForm.title}
                  onChange={(e) => setNewProcessForm({ ...newProcessForm, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: Process formation standard"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newProcessForm.description}
                  onChange={(e) => setNewProcessForm({ ...newProcessForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewProcessModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateProcess}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
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
