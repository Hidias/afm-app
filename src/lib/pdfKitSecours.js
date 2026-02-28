// ═══════════════════════════════════════════════════════════════
// pdfKitSecours.js — Kit Secours Formation
// Génère un ZIP complet prêt à imprimer pour chaque type de formation
// Page de garde + Intercalaires + Documents x10 + Grilles + SST INRS
// ═══════════════════════════════════════════════════════════════

import jsPDF from 'jspdf'
import { PDFDocument, rgb } from 'pdf-lib'
import JSZip from 'jszip'
import { generatePDF } from './pdfGenerator'
import { generateCompetencyGridPDF } from './pdfCompetencyGrids'

// ─── Configuration des kits par formation ─────────────────
export const KIT_CONFIG = {
  sst_fi: {
    label: 'SST — Formation Initiale',
    shortLabel: 'SST FI',
    color: '#22c55e',
    emoji: '🩺',
    documents: [
      { type: 'emargement', copies: 1, label: 'Feuille d\'émargement' },
      { type: 'ficheRenseignements', copies: 10, label: 'Fiches de renseignements' },
      { type: 'evaluation', copies: 10, label: 'Évaluations à chaud' },
      { type: 'evaluationFroid', copies: 10, label: 'Évaluations à froid' },
      { type: 'evaluationFormateur', copies: 1, label: 'Évaluation formateur' },
      { type: 'sst_template', subtype: 'FI', copies: 10, label: 'Grilles SST INRS (FI)' },
    ],
    hasPositionnement: true,
    competencyGrid: null,
  },
  sst_mac: {
    label: 'SST — MAC (Recyclage)',
    shortLabel: 'SST MAC',
    color: '#16a34a',
    emoji: '🩺',
    documents: [
      { type: 'emargement', copies: 1, label: 'Feuille d\'émargement' },
      { type: 'ficheRenseignements', copies: 10, label: 'Fiches de renseignements' },
      { type: 'evaluation', copies: 10, label: 'Évaluations à chaud' },
      { type: 'evaluationFroid', copies: 10, label: 'Évaluations à froid' },
      { type: 'evaluationFormateur', copies: 1, label: 'Évaluation formateur' },
      { type: 'sst_template', subtype: 'MAC', copies: 10, label: 'Grilles SST INRS (MAC)' },
    ],
    hasPositionnement: true,
    competencyGrid: null,
  },
  incendie: {
    label: 'Incendie / EPI',
    shortLabel: 'Incendie',
    color: '#ef4444',
    emoji: '🔥',
    documents: [
      { type: 'emargement', copies: 1, label: 'Feuille d\'émargement' },
      { type: 'ficheRenseignements', copies: 10, label: 'Fiches de renseignements' },
      { type: 'evaluation', copies: 10, label: 'Évaluations à chaud' },
      { type: 'evaluationFroid', copies: 10, label: 'Évaluations à froid' },
      { type: 'evaluationFormateur', copies: 1, label: 'Évaluation formateur' },
    ],
    hasPositionnement: true,
    competencyGrid: 'incendie',
  },
  gestes_postures: {
    label: 'Gestes & Postures / TMS',
    shortLabel: 'Gestes & Postures',
    color: '#3b82f6',
    emoji: '🏋️',
    documents: [
      { type: 'emargement', copies: 1, label: 'Feuille d\'émargement' },
      { type: 'ficheRenseignements', copies: 10, label: 'Fiches de renseignements' },
      { type: 'evaluation', copies: 10, label: 'Évaluations à chaud' },
      { type: 'evaluationFroid', copies: 10, label: 'Évaluations à froid' },
      { type: 'evaluationFormateur', copies: 1, label: 'Évaluation formateur' },
    ],
    hasPositionnement: true,
    competencyGrid: 'gestes_postures',
  },
  r489: {
    label: 'Conduite Chariot R489',
    shortLabel: 'R489',
    color: '#1f2937',
    emoji: '🏗️',
    documents: [
      { type: 'emargement', copies: 1, label: 'Feuille d\'émargement' },
      { type: 'ficheRenseignements', copies: 10, label: 'Fiches de renseignements' },
      { type: 'evaluation', copies: 10, label: 'Évaluations à chaud' },
      { type: 'evaluationFroid', copies: 10, label: 'Évaluations à froid' },
      { type: 'evaluationFormateur', copies: 1, label: 'Évaluation formateur' },
    ],
    hasPositionnement: true,
    competencyGrid: 'r489',
  },
  r485: {
    label: 'Conduite Gerbeur R485',
    shortLabel: 'R485',
    color: '#6b7280',
    emoji: '🏭',
    documents: [
      { type: 'emargement', copies: 1, label: 'Feuille d\'émargement' },
      { type: 'ficheRenseignements', copies: 10, label: 'Fiches de renseignements' },
      { type: 'evaluation', copies: 10, label: 'Évaluations à chaud' },
      { type: 'evaluationFroid', copies: 10, label: 'Évaluations à froid' },
      { type: 'evaluationFormateur', copies: 1, label: 'Évaluation formateur' },
    ],
    hasPositionnement: true,
    competencyGrid: 'r485',
  },
  habilitation_electrique: {
    label: 'Habilitation Électrique',
    shortLabel: 'Hab. Élec.',
    color: '#eab308',
    emoji: '⚡',
    documents: [
      { type: 'emargement', copies: 1, label: 'Feuille d\'émargement' },
      { type: 'ficheRenseignements', copies: 10, label: 'Fiches de renseignements' },
      { type: 'evaluation', copies: 10, label: 'Évaluations à chaud' },
      { type: 'evaluationFroid', copies: 10, label: 'Évaluations à froid' },
      { type: 'evaluationFormateur', copies: 1, label: 'Évaluation formateur' },
    ],
    hasPositionnement: true,
    competencyGrid: null,
  },
}

// ─── Helpers ──────────────────────────────────────────────

// Convertir hex en RGB
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

// Convertir jsPDF en ArrayBuffer
function jspdfToArrayBuffer(doc) {
  return doc.output('arraybuffer')
}

// Dupliquer un PDF N fois avec numérotation "1/N" et recto-verso (pages paires)
async function duplicatePages(sourceBuffer, copies, label) {
  const sourcePdf = await PDFDocument.load(sourceBuffer)
  const resultPdf = await PDFDocument.create()
  const sourcePageCount = sourcePdf.getPageCount()

  for (let copy = 0; copy < copies; copy++) {
    // Copier toutes les pages de la source
    const copiedPages = await resultPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
    copiedPages.forEach((page) => {
      resultPdf.addPage(page)
    })

    // Ajouter numérotation "1/10" sur la première page de chaque copie
    if (copies > 1) {
      const firstPageIdx = resultPdf.getPageCount() - sourcePageCount
      const firstPage = resultPdf.getPage(firstPageIdx)
      const { width, height } = firstPage.getSize()

      firstPage.drawText(`${copy + 1}/${copies}`, {
        x: width - 45,
        y: height - 18,
        size: 9,
        color: rgb(0.5, 0.5, 0.5),
      })
    }

    // Recto-verso : ajouter page blanche si nombre impair de pages par copie
    if (sourcePageCount % 2 !== 0) {
      const blankPage = resultPdf.addPage()
      const { width, height } = blankPage.getSize()
      // Page intentionnellement vide (petit texte discret)
    }
  }

  return resultPdf.save()
}

// ─── Générer la page de garde ─────────────────────────────
function generatePageDeGarde(config, documentsList) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()

  const [r, g, b] = hexToRgb(config.color)

  // Bandeau couleur en haut
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, pw, 55, 'F')

  // Logo/Titre
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('ACCESS FORMATION', pw / 2, 22, { align: 'center' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('24 rue Kerbleiz — 29900 Concarneau — 02 46 56 57 54', pw / 2, 32, { align: 'center' })
  doc.text('NDA 53 29 10261 29 — Qualiopi certifié', pw / 2, 39, { align: 'center' })
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${config.emoji}  KIT SECOURS FORMATION`, pw / 2, 50, { align: 'center' })

  doc.setTextColor(0, 0, 0)

  // Formation
  let y = 70
  doc.setFillColor(245, 245, 245)
  doc.roundedRect(15, y, pw - 30, 12, 2, 2, 'F')
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(config.label, pw / 2, y + 8.5, { align: 'center' })
  y += 20

  // Champs à remplir
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const fields = [
    'Client / Entreprise : _________________________________________________________________',
    'Dates : du ___/___/______ au ___/___/______',
    'Lieu : ________________________________________________________________________________',
    'Formateur : ___________________________________________________________________________',
    'Nombre de stagiaires : ______',
  ]
  fields.forEach(f => {
    doc.text(f, 20, y)
    y += 9
  })

  y += 8

  // Checklist documents inclus
  doc.setFillColor(r, g, b)
  doc.rect(15, y, pw - 30, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('DOCUMENTS INCLUS DANS CE KIT', pw / 2, y + 5.5, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 14

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  documentsList.forEach(item => {
    // Checkbox
    doc.rect(22, y - 3, 4, 4)
    doc.text(`${item.label}${item.copies > 1 ? ` (×${item.copies})` : ''}`, 30, y)
    // Nombre de pages
    if (item.pages) {
      doc.setTextColor(150, 150, 150)
      doc.text(`${item.pages} pages`, pw - 50, y)
      doc.setTextColor(0, 0, 0)
    }
    y += 7
  })

  y += 10

  // Encadré important
  doc.setFillColor(255, 250, 230)
  doc.setDrawColor(234, 179, 8)
  doc.setLineWidth(0.5)
  doc.roundedRect(15, y, pw - 30, 30, 2, 2, 'FD')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('⚠️  MODE DÉGRADÉ — INSTRUCTIONS', 20, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Ce kit est prévu en cas d\'indisponibilité de la plateforme Access Campus.', 20, y + 13)
  doc.text('1. Distribuer les fiches de renseignements dès l\'arrivée des stagiaires', 20, y + 18)
  doc.text('2. Faire émarger matin et après-midi sur la feuille d\'émargement', 20, y + 23)
  doc.text('3. À la fin de la session, récupérer toutes les évaluations remplies', 20, y + 28)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(`Kit généré le ${new Date().toLocaleDateString('fr-FR')} — Access Campus V3.0`, pw / 2, ph - 10, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  // Page blanche verso (recto-verso)
  doc.addPage()

  return jspdfToArrayBuffer(doc)
}

// ─── Générer un intercalaire ──────────────────────────────
function generateIntercalaire(label, copies, color, index, total) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()

  const [r, g, b] = hexToRgb(color)

  // Fond coloré pleine page (léger)
  doc.setFillColor(
    Math.min(255, r + Math.round((255 - r) * 0.85)),
    Math.min(255, g + Math.round((255 - g) * 0.85)),
    Math.min(255, b + Math.round((255 - b) * 0.85))
  )
  doc.rect(0, 0, pw, ph, 'F')

  // Bandeau central coloré
  doc.setFillColor(r, g, b)
  doc.rect(0, ph / 2 - 25, pw, 50, 'F')

  // Texte
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text(label.toUpperCase(), pw / 2, ph / 2 - 5, { align: 'center' })

  if (copies > 1) {
    doc.setFontSize(16)
    doc.setFont('helvetica', 'normal')
    doc.text(`${copies} exemplaires`, pw / 2, ph / 2 + 10, { align: 'center' })
  }

  doc.setTextColor(0, 0, 0)

  // Numéro de section
  doc.setFontSize(60)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(r, g, b)
  doc.text(String(index), pw / 2, 60, { align: 'center' })
  doc.setFontSize(10)
  doc.setTextColor(150, 150, 150)
  doc.text(`Section ${index} sur ${total}`, pw / 2, 70, { align: 'center' })

  doc.setTextColor(0, 0, 0)

  // Page blanche verso (recto-verso)
  doc.addPage()

  return jspdfToArrayBuffer(doc)
}

// ─── Charger le template SST INRS ─────────────────────────
async function loadSSTTemplate(subtype) {
  const path = `/templates/sst/${subtype}.pdf`
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Impossible de charger ${path}`)
  return response.arrayBuffer()
}

// ─── Générer un document vierge standard ──────────────────
async function generateBlankDocument(docType, questions = null) {
  // Pour les documents standards, utiliser generatePDF
  const options = { isBlank: true }
  if (questions) {
    options.questions = questions
  }

  const result = await generatePDF(docType, null, options)
  if (!result) throw new Error(`Échec génération ${docType}`)

  // Convertir base64 en ArrayBuffer
  const binaryStr = atob(result.base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes.buffer
}

// ═══════════════════════════════════════════════════════════
// EXPORT PRINCIPAL — Génère le ZIP du kit secours
// ═══════════════════════════════════════════════════════════

export async function downloadKitSecours(kitKey, options = {}) {
  const { questions = null, onProgress = () => {} } = options
  const config = KIT_CONFIG[kitKey]
  if (!config) throw new Error(`Kit inconnu: ${kitKey}`)

  const zip = new JSZip()
  const documentsList = [] // Pour la page de garde
  let fileIndex = 0

  // Calculer le total d'étapes pour la progression
  let totalSteps = config.documents.length + 2 // +page de garde +ZIP
  if (config.competencyGrid) totalSteps++
  if (config.hasPositionnement && questions?.length > 0) totalSteps++
  let currentStep = 0

  const report = (label) => {
    currentStep++
    onProgress(currentStep, totalSteps, label)
  }

  // ═══ 1. Générer chaque document ═══
  for (const docDef of config.documents) {
    report(`Génération : ${docDef.label}...`)

    try {
      let pdfBuffer

      if (docDef.type === 'sst_template') {
        // Template INRS SST
        const templateBuffer = await loadSSTTemplate(docDef.subtype)
        pdfBuffer = await duplicatePages(templateBuffer, docDef.copies, docDef.label)
      } else {
        // Document standard
        const singleBuffer = await generateBlankDocument(docDef.type)
        if (docDef.copies > 1) {
          pdfBuffer = await duplicatePages(singleBuffer, docDef.copies, docDef.label)
        } else {
          // Pour 1 copie, assurer pages paires (recto-verso)
          const singlePdf = await PDFDocument.load(singleBuffer)
          if (singlePdf.getPageCount() % 2 !== 0) {
            singlePdf.addPage()
          }
          pdfBuffer = await singlePdf.save()
        }
      }

      fileIndex++
      const paddedIdx = String(fileIndex).padStart(2, '0')
      const safeName = docDef.label.replace(/[^a-zA-Z0-9éèêëàâäùûüôöïîç\s\-()]/g, '').replace(/\s+/g, '_')
      const filename = `${paddedIdx}_${safeName}.pdf`

      zip.file(filename, pdfBuffer)

      // Calculer pages pour la checklist
      const tempPdf = await PDFDocument.load(pdfBuffer)
      documentsList.push({
        label: docDef.label,
        copies: docDef.copies,
        pages: tempPdf.getPageCount(),
      })
    } catch (err) {
      console.error(`Erreur génération ${docDef.label}:`, err)
      documentsList.push({
        label: `${docDef.label} (ERREUR)`,
        copies: docDef.copies,
        pages: 0,
      })
    }
  }

  // ═══ 2. Grille de compétences ═══
  if (config.competencyGrid) {
    report(`Génération : Grille de compétences...`)
    try {
      const gridResult = generateCompetencyGridPDF(config.competencyGrid)
      if (gridResult) {
        const gridBuffer = gridResult.output('arraybuffer')
        const gridPdf = await duplicatePages(gridBuffer, 10, 'Grille de compétences')

        fileIndex++
        const paddedIdx = String(fileIndex).padStart(2, '0')
        zip.file(`${paddedIdx}_Grille_Competences_x10.pdf`, gridPdf)

        const tempPdf = await PDFDocument.load(gridPdf)
        documentsList.push({
          label: 'Grilles de compétences',
          copies: 10,
          pages: tempPdf.getPageCount(),
        })
      }
    } catch (err) {
      console.error('Erreur grille compétences:', err)
    }
  }

  // ═══ 3. Test de positionnement ═══
  if (config.hasPositionnement && questions && questions.length > 0) {
    report(`Génération : Test de positionnement...`)
    try {
      const testBuffer = await generateBlankDocument('positionnement', questions)
      const testPdf = await duplicatePages(testBuffer, 10, 'Test de positionnement')

      fileIndex++
      const paddedIdx = String(fileIndex).padStart(2, '0')
      zip.file(`${paddedIdx}_Test_Positionnement_x10.pdf`, testPdf)

      const tempPdf = await PDFDocument.load(testPdf)
      documentsList.push({
        label: 'Tests de positionnement',
        copies: 10,
        pages: tempPdf.getPageCount(),
      })
    } catch (err) {
      console.error('Erreur test positionnement:', err)
    }
  }

  // ═══ 4. Page de garde (générée en dernier car elle a besoin de la liste) ═══
  report('Génération : Page de garde...')
  try {
    const coverBuffer = generatePageDeGarde(config, documentsList)
    zip.file('00_Page_de_garde.pdf', coverBuffer)
  } catch (err) {
    console.error('Erreur page de garde:', err)
  }

  // ═══ 5. Intercalaires ═══
  try {
    const allDocs = [...documentsList]
    allDocs.forEach((item, idx) => {
      const intercalaireBuffer = generateIntercalaire(
        item.label,
        item.copies,
        config.color,
        idx + 1,
        allDocs.length
      )
      const paddedIdx = String(idx + 1).padStart(2, '0')
      zip.file(`${paddedIdx}_00_Intercalaire.pdf`, intercalaireBuffer)
    })
  } catch (err) {
    console.error('Erreur intercalaires:', err)
  }

  // ═══ 6. Générer le ZIP ═══
  report('Compilation du ZIP...')
  const zipBlob = await zip.generateAsync({ type: 'blob' })

  // Télécharger
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Kit_Secours_${config.shortLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`
  a.click()
  URL.revokeObjectURL(url)

  return { success: true, documents: documentsList }
}
