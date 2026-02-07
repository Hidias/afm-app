import { useState, useEffect, useRef, useCallback } from 'react'
import { useDataStore } from '../lib/store'
import { 
  Sparkles, Download, RefreshCw, FileText, Send, 
  Minus, Plus, Eye, Save, Loader2, Wand2, ArrowRight, Mic, MicOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import { supabase } from '../lib/supabase'

// Tampon Access Formation (identique à pdfGenerator.js)
const STAMP_BASE64 = 'data:image/jpeg;base64,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'

const DOC_TYPES = [
  { id: 'attestation', label: '📜 Attestation libre', description: 'Attestation officielle Access Formation' },
  { id: 'note_interne', label: '📋 Note interne', description: 'Note de service ou compte-rendu' },
  { id: 'courrier', label: '✉️ Courrier', description: 'Courrier officiel avec en-tête' },
]

const ORG_DEFAULTS = {
  name: 'Access Formation',
  nameFull: 'SARL Access Formation',
  address: '24 rue Kerbleiz, 29900 Concarneau',
  phone: '02 46 56 57 54',
  email: 'contact@accessformation.pro',
  siret: '943 563 866 00012',
  nda: '53 29 10261 29',
  dirigeant: 'Hicham SAIDI',
}

export default function CourierEditor() {
  const { organization } = useDataStore()
  const org = organization ? { ...ORG_DEFAULTS, ...organization } : ORG_DEFAULTS
  
  const [docType, setDocType] = useState('courrier')
  const [destinataire, setDestinataire] = useState('')
  const [objet, setObjet] = useState('')
  const [lieu, setLieu] = useState('Concarneau')
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0])
  const [body, setBody] = useState('')
  const [signataire, setSignataire] = useState('Hicham SAIDI - Directeur')
  const [context, setContext] = useState('')
  
  const [generating, setGenerating] = useState(false)
  const [generatingAction, setGeneratingAction] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  
  const previewTimeout = useRef(null)
  const recognitionRef = useRef(null)

  // Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript = transcript
        }
      }
      if (finalTranscript) {
        setBody(prev => prev + (prev && !prev.endsWith('\n') && !prev.endsWith(' ') ? ' ' : '') + finalTranscript)
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error)
      setListening(false)
      if (event.error === 'not-allowed') {
        toast.error('Autorisez l\'accès au micro dans votre navigateur')
      }
    }

    recognition.onend = () => {
      if (listening) {
        try { recognition.start() } catch {}
      } else {
        setListening(false)
      }
    }

    recognitionRef.current = recognition
    return () => { try { recognition.stop() } catch {} }
  }, [listening])

  function toggleMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Votre navigateur ne supporte pas la dictée vocale')
      return
    }
    if (listening) {
      setListening(false)
      try { recognitionRef.current?.stop() } catch {}
    } else {
      setListening(true)
      try { recognitionRef.current?.start() } catch {}
    }
  }

  // Générer l'aperçu PDF avec debounce
  useEffect(() => {
    if (previewTimeout.current) clearTimeout(previewTimeout.current)
    previewTimeout.current = setTimeout(() => {
      generatePreview()
    }, 500)
    return () => clearTimeout(previewTimeout.current)
  }, [docType, destinataire, objet, lieu, docDate, body, signataire])

  function generatePreview() {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      const pw = doc.internal.pageSize.getWidth()
      const ph = doc.internal.pageSize.getHeight()
      let y = 15

      // === EN-TÊTE ===
      const logoBase64 = org.logo_base64
      if (logoBase64) {
        try {
          const fmt = logoBase64.includes('image/png') ? 'PNG' : 'JPEG'
          doc.addImage(logoBase64, fmt, 15, 10, 50, 12.5)
        } catch {
          doc.setFillColor(26, 54, 72)
          doc.rect(15, 10, 50, 12, 'F')
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(255, 255, 255)
          doc.text('ACCESS FORMATION', 20, 18)
        }
      } else {
        doc.setFillColor(26, 54, 72)
        doc.rect(15, 10, 50, 12, 'F')
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)
        doc.text('ACCESS FORMATION', 20, 18)
      }

      // Infos société à droite du logo
      doc.setTextColor(80, 80, 80)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.text((org.nameFull || org.name).toUpperCase(), 70, 12)
      doc.text(org.address || '24 rue Kerbleiz, 29900 Concarneau', 70, 17)
      doc.text('Tél : ' + (org.phone || '02 46 56 57 54') + ' - ' + (org.email || 'contact@accessformation.pro'), 70, 22)
      doc.text('SIRET : ' + (org.siret || '943 563 866 00012') + ' - NDA : ' + (org.nda || '53 29 10261 29'), 70, 27)

      // Ligne de séparation
      doc.setDrawColor(26, 54, 72)
      doc.setLineWidth(0.5)
      doc.line(15, 32, pw - 15, 32)
      y = 38

      // === DESTINATAIRE (droite) ===
      if (destinataire) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0, 0, 0)
        const destLines = destinataire.split('\n')
        destLines.forEach((line, i) => {
          doc.text(line, pw - 15, y + (i * 5), { align: 'right' })
        })
        y += destLines.length * 5 + 5
      }

      // === LIEU ET DATE ===
      const dateFormatted = docDate ? new Date(docDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
      if (lieu || dateFormatted) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(80, 80, 80)
        doc.text((lieu ? lieu + ', le ' : 'Le ') + dateFormatted, pw - 15, y, { align: 'right' })
        y += 10
      }

      // === OBJET ===
      if (objet) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 54, 72)
        doc.text('Objet : ' + objet, 15, y)
        y += 10
      }

      // === TYPE ATTESTATION : titre centré ===
      if (docType === 'attestation') {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 54, 72)
        doc.text('ATTESTATION', pw / 2, y, { align: 'center' })
        y += 12
      }

      // === CORPS DU DOCUMENT ===
      if (body) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 30, 30)
        
        const paragraphs = body.split('\n')
        paragraphs.forEach(paragraph => {
          if (paragraph.trim() === '') {
            y += 4
          } else {
            const lines = doc.splitTextToSize(paragraph, pw - 35)
            lines.forEach(line => {
              if (y > ph - 40) {
                doc.addPage()
                y = 20
              }
              doc.text(line, 15, y)
              y += 5
            })
            y += 2
          }
        })
      }

      // === FORMULE DE POLITESSE implicite pour courrier ===
      // (l'utilisateur la met dans le body)

      // === SIGNATURE + TAMPON ===
      if (signataire) {
        y = Math.max(y + 10, y)
        if (y > ph - 60) {
          doc.addPage()
          y = 20
        }

        // Tampon (à gauche de la signature)
        const stampImg = org.stamp_base64 || STAMP_BASE64
        if (stampImg) {
          try {
            const fmt = stampImg.includes('image/png') ? 'PNG' : 'JPEG'
            doc.addImage(stampImg, fmt, pw - 90, y - 2, 45, 16)
          } catch {}
        }

        // Texte signataire
        y += 18
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0, 0, 0)
        const sigLines = signataire.split('\n')
        sigLines.forEach((line, i) => {
          doc.text(line, pw - 60, y + (i * 5))
        })
      }

      // === PIED DE PAGE ===
      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(150, 150, 150)
        doc.text(
          (org.nameFull || org.name) + ' - ' + (org.address || '') + ' - SIRET ' + (org.siret || ''),
          pw / 2, ph - 8, { align: 'center' }
        )
        if (totalPages > 1) {
          doc.text('Page ' + i + '/' + totalPages, pw - 15, ph - 8, { align: 'right' })
        }
      }

      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      setPdfUrl(url)
    } catch (err) {
      console.error('Erreur aperçu PDF:', err)
    }
  }

  // IA : générer / reformuler / raccourcir / allonger
  async function handleAI(action) {
    setGenerating(true)
    setGeneratingAction(action)
    try {
      const res = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          docType,
          destinataire,
          objet,
          context,
          currentText: body,
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')

      setBody(data.text)
      toast.success(
        action === 'generate' ? '✨ Texte généré' :
        action === 'reformulate' ? '✨ Texte reformulé' :
        action === 'shorter' ? '✨ Texte raccourci' :
        '✨ Texte enrichi'
      )
    } catch (err) {
      console.error('Erreur IA:', err)
      toast.error('Erreur : ' + err.message)
    } finally {
      setGenerating(false)
      setGeneratingAction(null)
    }
  }

  // Télécharger le PDF
  function handleDownload() {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    const dateStr = docDate ? docDate.replace(/-/g, '') : 'undated'
    const typeStr = docType === 'attestation' ? 'Attestation' : docType === 'note_interne' ? 'Note_interne' : 'Courrier'
    a.download = typeStr + '_Access_Formation_' + dateStr + '.pdf'
    a.click()
    toast.success('PDF téléchargé')
  }

  // Sauvegarder dans Documents uploadés
  async function handleSave() {
    if (!body.trim()) {
      toast.error('Le document est vide')
      return
    }
    setSaving(true)
    try {
      // Générer le PDF blob
      const doc = new jsPDF('p', 'mm', 'a4')
      // Reconstruire le PDF identique à l'aperçu
      generatePreview()
      
      // Utiliser le blob actuel
      const response = await fetch(pdfUrl)
      const blob = await response.blob()
      
      const dateStr = docDate ? docDate.replace(/-/g, '') : 'undated'
      const typeStr = docType === 'attestation' ? 'Attestation' : docType === 'note_interne' ? 'Note_interne' : 'Courrier'
      const fileName = typeStr + '_Access_Formation_' + dateStr + '.pdf'

      // Upload vers Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload('courriers/' + Date.now() + '_' + fileName, blob, { contentType: 'application/pdf' })

      if (uploadError) throw uploadError

      // Enregistrer dans la table uploaded_files
      const { data: publicUrl } = supabase.storage.from('documents').getPublicUrl(uploadData.path)

      const { error: dbError } = await supabase
        .from('uploaded_files')
        .insert({
          name: (objet || typeStr).substring(0, 100),
          filename: fileName,
          file_path: uploadData.path,
          file_url: publicUrl.publicUrl,
          mime_type: 'application/pdf',
          file_size: blob.size,
          category: docType === 'attestation' ? 'attestation' : 'autre',
          notes: 'Créé depuis l\'éditeur de courriers',
        })

      if (dbError) throw dbError

      toast.success('📁 Document sauvegardé dans vos fichiers')
    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      toast.error('Erreur : ' + (err.message || 'Échec sauvegarde'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-280px)] min-h-[600px]">
      {/* Colonne gauche : formulaire */}
      <div className="w-1/2 space-y-4 overflow-y-auto pr-2">
        
        {/* Type de document */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type de document</label>
          <div className="grid grid-cols-3 gap-2">
            {DOC_TYPES.map(t => (
              <button key={t.id} onClick={() => setDocType(t.id)}
                className={'px-3 py-2 rounded-lg border text-sm text-center transition-colors ' +
                  (docType === t.id ? 'bg-primary-50 border-primary-300 text-primary-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Destinataire */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destinataire</label>
          <textarea value={destinataire} onChange={(e) => setDestinataire(e.target.value)}
            placeholder={"M. / Mme ...\nEntreprise\nAdresse"}
            rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" />
        </div>

        {/* Date et Lieu */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
            <input type="text" value={lieu} onChange={(e) => setLieu(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
          </div>
        </div>

        {/* Objet */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Objet</label>
          <input type="text" value={objet} onChange={(e) => setObjet(e.target.value)}
            placeholder={docType === 'attestation' ? "Attestation de formation SST" : "Objet du courrier..."}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
        </div>

        {/* Contexte IA (optionnel) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Sparkles className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
            Contexte pour l'IA <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <input type="text" value={context} onChange={(e) => setContext(e.target.value)}
            placeholder="Ex: Formation SST de 14h pour 8 salariés de l'entreprise X..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-amber-50 focus:ring-2 focus:ring-amber-300 focus:border-transparent" />
        </div>

        {/* Corps du document */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Corps du document</label>
            <div className="flex gap-1">
              <button onClick={() => handleAI('generate')} disabled={generating || !objet}
                title="Générer le texte avec l'IA"
                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-md text-xs font-medium flex items-center gap-1 disabled:opacity-40 transition-colors">
                {generatingAction === 'generate' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Générer
              </button>
              <button onClick={() => handleAI('reformulate')} disabled={generating || !body}
                title="Reformuler le texte"
                className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md text-xs font-medium flex items-center gap-1 disabled:opacity-40 transition-colors">
                {generatingAction === 'reformulate' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Reformuler
              </button>
              <button onClick={() => handleAI('shorter')} disabled={generating || !body}
                title="Raccourcir"
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-xs disabled:opacity-40 transition-colors">
                {generatingAction === 'shorter' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Minus className="w-3 h-3" />}
              </button>
              <button onClick={() => handleAI('longer')} disabled={generating || !body}
                title="Enrichir"
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-xs disabled:opacity-40 transition-colors">
                {generatingAction === 'longer' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              </button>
              <div className="w-px h-5 bg-gray-300 mx-1" />
              <button onClick={toggleMic}
                title={listening ? 'Arrêter la dictée' : 'Dicter (micro)'}
                className={'px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ' +
                  (listening ? 'bg-red-100 text-red-600 animate-pulse hover:bg-red-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}>
                {listening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                {listening ? 'Stop' : 'Dicter'}
              </button>
            </div>
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Rédigez votre texte ici ou utilisez le bouton ✨ Générer pour que l'IA vous propose un brouillon..."
            rows="10" className={'w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y leading-relaxed ' +
              (listening ? 'border-red-400 ring-2 ring-red-200 bg-red-50/30' : 'border-gray-300')} />
          {listening && (
            <div className="flex items-center gap-2 text-xs text-red-600 mt-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Dictée en cours... parlez maintenant
            </div>
          )}
        </div>

        {/* Signataire */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Signataire</label>
          <input type="text" value={signataire} onChange={(e) => setSignataire(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-4">
          <button onClick={handleDownload} disabled={!body.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 font-medium text-sm transition-colors">
            <Download className="w-4 h-4" /> Télécharger PDF
          </button>
          <button onClick={handleSave} disabled={!body.trim() || saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 font-medium text-sm transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Colonne droite : aperçu PDF en direct */}
      <div className="w-1/2 bg-gray-100 rounded-xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="bg-gray-200 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Eye className="w-4 h-4" /> Aperçu en direct
          </span>
          <span className="text-xs text-gray-500">Mise à jour automatique</span>
        </div>
        <div className="flex-1">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full border-0" title="Aperçu PDF" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Commencez à rédiger pour voir l'aperçu</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
