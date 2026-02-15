// src/lib/duerpExport.js
// Génération des rapports DUERP en PDF et Excel
// Access Formation — Module DUERP

import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'

// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════
const COLORS = {
  primary: [34, 85, 96],       // #225560 — Access Formation teal
  accent: [233, 180, 76],      // #E9B44C — amber
  danger: [220, 38, 38],       // red
  warning: [245, 158, 11],     // orange
  caution: [234, 179, 8],      // yellow
  success: [22, 163, 74],      // green
  gray: [107, 114, 128],
  lightGray: [243, 244, 246],
  white: [255, 255, 255],
  black: [30, 30, 30],
}

const RISK_COLORS = {
  critique: { bg: [254, 226, 226], text: [153, 27, 27] },
  eleve:    { bg: [255, 237, 213], text: [154, 52, 18] },
  moyen:    { bg: [254, 249, 195], text: [113, 63, 18] },
  faible:   { bg: [220, 252, 231], text: [22, 101, 52] },
}

const getRiskLevel = (score) => {
  if (score >= 13) return { label: 'Critique', key: 'critique' }
  if (score >= 9) return { label: 'Élevé', key: 'eleve' }
  if (score >= 5) return { label: 'Moyen', key: 'moyen' }
  return { label: 'Faible', key: 'faible' }
}

const FREQ = { 1: 'Occasionnel', 2: 'Fréquent', 3: 'Très fréquent', 4: 'Permanent' }
const GRAV = { 1: 'Minime', 2: 'Significatif', 3: 'Grave', 4: 'Très grave' }
const MAIT = { 0.5: 'Bonne', 0.75: 'Partielle', 1: 'Insuffisante' }
const PRIO = { critique: 'CRITIQUE', haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' }
const STAT = { a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait', annule: 'Annulé' }
const TYPE_ACTION = {
  prevention: 'Prévention', protection: 'Protection', formation: 'Formation',
  organisationnelle: 'Organisation', technique: 'Technique',
}

const DISCLAIMER = `AVERTISSEMENT IMPORTANT — LIMITES DE RESPONSABILITÉ

Le présent Document Unique d'Évaluation des Risques Professionnels (DUERP) a été élaboré avec l'assistance d'Access Formation dans le cadre d'une prestation d'accompagnement et de conseil.

Access Formation intervient en tant que prestataire d'aide à la rédaction et à la structuration du DUERP. Cette prestation ne se substitue en aucun cas à l'obligation légale de l'employeur.

Conformément aux articles L.4121-1 à L.4121-5 et R.4121-1 à R.4121-4 du Code du travail :
• L'employeur est seul responsable de la transcription et de la mise à jour du DUERP
• L'employeur est seul responsable de l'exhaustivité et de l'exactitude de l'évaluation des risques
• L'employeur est seul responsable de la mise en œuvre des actions de prévention
• L'employeur est seul garant de la consultation des représentants du personnel (CSE le cas échéant)

Access Formation ne saurait être tenue responsable d'éventuelles omissions, inexactitudes ou insuffisances dans le présent document. L'employeur s'engage à vérifier, compléter et valider l'ensemble des informations avant finalisation.

Ce document constitue un outil d'aide à la décision et ne remplace pas l'expertise d'un IPRP (Intervenant en Prévention des Risques Professionnels) pour les situations complexes.`

const DISCLAIMER_SHORT = `Document élaboré avec l'assistance d'Access Formation. L'employeur reste seul responsable de l'exhaustivité, de l'exactitude de l'évaluation des risques et de la mise en œuvre des actions de prévention (Art. L.4121-1 et suivants du Code du travail). Access Formation intervient en aide à la rédaction et ne saurait être tenue responsable d'éventuelles omissions ou insuffisances.`

const formatDate = (d) => {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d }
}

// ═══════════════════════════════════════════════════════════
// EXPORT PDF
// ═══════════════════════════════════════════════════════════
export function generateDuerpPDF({ project, units, risks, actions, categories }) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  let pageNum = 0

  // Helper: footer sur chaque page
  const addFooter = () => {
    pageNum++
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.gray)
    doc.text(`DUERP — ${project.company_name} — ${project.reference} — Page ${pageNum}`, 14, ph - 8)
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — Access Formation`, pw - 14, ph - 8, { align: 'right' })
    doc.setDrawColor(...COLORS.accent)
    doc.setLineWidth(0.5)
    doc.line(14, ph - 12, pw - 14, ph - 12)
  }

  const newPage = () => {
    doc.addPage()
    addFooter()
  }

  // ───────────────────────────────────────────────────────────
  // PAGE 1 : COUVERTURE
  // ───────────────────────────────────────────────────────────
  // Bandeau supérieur
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, pw, 50, 'F')
  doc.setFillColor(...COLORS.accent)
  doc.rect(0, 50, pw, 4, 'F')

  doc.setTextColor(...COLORS.white)
  doc.setFontSize(10)
  doc.text('ACCESS FORMATION', 14, 18)
  doc.setFontSize(7)
  doc.text('Organisme de formation professionnelle — Concarneau', 14, 25)

  doc.setFontSize(24)
  doc.setFont(undefined, 'bold')
  doc.text('DOCUMENT UNIQUE', pw / 2, 37, { align: 'center' })
  doc.setFontSize(13)
  doc.text("d'Évaluation des Risques Professionnels", pw / 2, 45, { align: 'center' })

  // Infos entreprise
  let y = 68
  doc.setTextColor(...COLORS.black)
  doc.setFontSize(20)
  doc.setFont(undefined, 'bold')
  doc.text(project.company_name || '', pw / 2, y, { align: 'center' })

  y += 12
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(...COLORS.gray)
  const infoLines = [
    `Référence : ${project.reference}`,
    project.siret ? `SIRET : ${project.siret}` : null,
    project.naf_code ? `Code NAF : ${project.naf_code} — ${project.naf_label || ''}` : null,
    project.address ? `Adresse : ${project.address}, ${project.postal_code} ${project.city}` : null,
    project.effectif ? `Effectif : ${project.effectif} salarié(s)` : null,
    project.evaluateur ? `Évaluateur : ${project.evaluateur}` : null,
    `Date d'élaboration : ${formatDate(project.date_elaboration)}`,
    project.date_mise_a_jour ? `Dernière mise à jour : ${formatDate(project.date_mise_a_jour)}` : null,
  ].filter(Boolean)

  infoLines.forEach(line => {
    doc.text(line, pw / 2, y, { align: 'center' })
    y += 6
  })

  // Encadré stats
  y += 10
  const evaluated = risks.filter(r => r.frequence && r.gravite).length
  const critique = risks.filter(r => { const s = (r.frequence||0)*(r.gravite||0)*(r.maitrise||1); return s >= 13 }).length
  const eleve = risks.filter(r => { const s = (r.frequence||0)*(r.gravite||0)*(r.maitrise||1); return s >= 9 && s < 13 }).length

  doc.setFillColor(...COLORS.lightGray)
  doc.roundedRect(30, y, pw - 60, 30, 3, 3, 'F')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.black)
  doc.setFont(undefined, 'bold')
  const stats = [
    `${risks.length} risques identifiés`,
    `${evaluated} évalués`,
    `${critique + eleve} critiques/élevés`,
    `${actions.length} actions de prévention`,
  ]
  const statW = (pw - 60) / stats.length
  stats.forEach((s, i) => {
    doc.text(s, 30 + statW * i + statW / 2, y + 18, { align: 'center' })
  })

  // Disclaimer en bas de couverture
  y = ph - 65
  doc.setFontSize(6.5)
  doc.setFont(undefined, 'italic')
  doc.setTextColor(...COLORS.gray)
  const disclaimerLines = doc.splitTextToSize(DISCLAIMER_SHORT, pw - 40)
  doc.text(disclaimerLines, 20, y)

  addFooter()

  // ───────────────────────────────────────────────────────────
  // PAGE 2 : MÉTHODOLOGIE
  // ───────────────────────────────────────────────────────────
  newPage()
  y = 20
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('1. Méthodologie de cotation', 14, y)

  y += 10
  doc.setFontSize(9)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(...COLORS.black)
  const methodo = [
    'La cotation des risques repose sur 3 critères multipliés entre eux :',
    '',
    'Risque résiduel = Fréquence × Gravité × Maîtrise',
    '',
    '• Fréquence d\'exposition (1 à 4) : d\'occasionnel à permanent',
    '• Gravité des dommages (1 à 4) : de minime à très grave (IPP/décès)',
    '• Niveau de maîtrise (0.5 à 1) : de bonne maîtrise à insuffisante',
  ]
  methodo.forEach(line => {
    doc.text(line, 14, y)
    y += 5
  })

  // Table fréquence
  y += 5
  doc.autoTable({
    startY: y,
    head: [['Niveau', 'Fréquence', 'Description']],
    body: [
      ['1', 'Occasionnel', 'Quelques fois par mois'],
      ['2', 'Fréquent', 'Plusieurs fois par jour'],
      ['3', 'Très fréquent', 'Plusieurs fois par heure'],
      ['4', 'Permanent', 'Exposition continue'],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white },
    columnStyles: { 0: { cellWidth: 15, halign: 'center' } },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 8
  doc.autoTable({
    startY: y,
    head: [['Niveau', 'Gravité', 'Description']],
    body: [
      ['1', 'Minime', 'Premiers soins, incident bénin'],
      ['2', 'Significatif', 'Accident sans arrêt de travail'],
      ['3', 'Grave', 'Accident avec arrêt, maladie pro.'],
      ['4', 'Très grave', 'IPP, décès'],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white },
    columnStyles: { 0: { cellWidth: 15, halign: 'center' } },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 8
  doc.autoTable({
    startY: y,
    head: [['Coeff.', 'Maîtrise', 'Description']],
    body: [
      ['×0.5', 'Bonne', 'Mesures 100% en place et vérifiées'],
      ['×0.75', 'Partielle', 'Mesures partielles ou non systématiques'],
      ['×1', 'Insuffisante', 'Aucune mesure ou mesures inefficaces'],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white },
    columnStyles: { 0: { cellWidth: 15, halign: 'center' } },
    margin: { left: 14, right: 14 },
  })

  // Matrice F×G
  y = doc.lastAutoTable.finalY + 12
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('Matrice Fréquence × Gravité', 14, y)
  y += 2

  const matrixData = []
  for (let f = 4; f >= 1; f--) {
    const row = [`${f} — ${FREQ[f]}`]
    for (let g = 1; g <= 4; g++) {
      const score = f * g
      const count = risks.filter(r => r.frequence === f && r.gravite === g).length
      row.push(count > 0 ? `${score} (${count})` : `${score}`)
    }
    matrixData.push(row)
  }

  doc.autoTable({
    startY: y,
    head: [['F \\ G', '1 — Minime', '2 — Significatif', '3 — Grave', '4 — Très grave']],
    body: matrixData,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0) {
        const f = 4 - data.row.index
        const g = data.column.index
        const score = f * g
        const lvl = getRiskLevel(score)
        data.cell.styles.fillColor = RISK_COLORS[lvl.key].bg
        data.cell.styles.textColor = RISK_COLORS[lvl.key].text
      }
    },
  })

  // ───────────────────────────────────────────────────────────
  // PAGES : INVENTAIRE DES RISQUES PAR UNITÉ
  // ───────────────────────────────────────────────────────────
  newPage()
  y = 20
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('2. Inventaire des risques par unité de travail', 14, y)

  units.forEach((unit, ui) => {
    const unitRisks = risks.filter(r => r.unit_id === unit.id)
    if (y > ph - 60) { newPage(); y = 20 }

    y += 12
    doc.setFillColor(...COLORS.primary)
    doc.roundedRect(14, y - 5, pw - 28, 10, 1, 1, 'F')
    doc.setTextColor(...COLORS.white)
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text(`${unit.code?.toUpperCase()} — ${unit.name}`, 18, y + 2)
    doc.setFont(undefined, 'normal')
    doc.setFontSize(8)
    if (unit.effectif) doc.text(`${unit.effectif} pers.`, pw - 18, y + 2, { align: 'right' })
    y += 10

    if (unitRisks.length === 0) {
      doc.setTextColor(...COLORS.gray)
      doc.setFontSize(8)
      doc.text('Aucun risque identifié pour cette unité.', 18, y)
      y += 8
      return
    }

    const tableBody = unitRisks.map(r => {
      const cat = categories.find(c => c.code === r.category_code)
      const brut = (r.frequence || 0) * (r.gravite || 0)
      const residuel = brut * (r.maitrise || 1)
      const lvl = getRiskLevel(residuel || brut)
      return [
        cat?.label || r.category_code || '—',
        r.danger || '—',
        r.situation || '—',
        r.frequence ? `F${r.frequence} G${r.gravite}` : '—',
        r.maitrise ? `×${r.maitrise}` : '—',
        residuel > 0 ? `${residuel}` : '—',
        residuel > 0 ? lvl.label : 'Non évalué',
        r.prevention_existante || '—',
      ]
    })

    doc.autoTable({
      startY: y,
      head: [['Catégorie', 'Danger', 'Situation', 'F×G', 'Maîtr.', 'Score', 'Niveau', 'Prévention existante']],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak', lineWidth: 0.1 },
      headStyles: { fillColor: COLORS.accent, textColor: COLORS.black, fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 40 },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const val = data.cell.raw
          const key = val === 'Critique' ? 'critique' : val === 'Élevé' ? 'eleve' : val === 'Moyen' ? 'moyen' : val === 'Faible' ? 'faible' : null
          if (key) {
            data.cell.styles.fillColor = RISK_COLORS[key].bg
            data.cell.styles.textColor = RISK_COLORS[key].text
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })
    y = doc.lastAutoTable.finalY + 4
  })

  // Risques sans unité
  const orphanRisks = risks.filter(r => !r.unit_id)
  if (orphanRisks.length) {
    if (y > ph - 60) { newPage(); y = 20 }
    y += 8
    doc.setFillColor(...COLORS.gray)
    doc.roundedRect(14, y - 5, pw - 28, 10, 1, 1, 'F')
    doc.setTextColor(...COLORS.white)
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text('RISQUES NON RATTACHÉS À UNE UNITÉ', 18, y + 2)
    y += 10

    const tableBody = orphanRisks.map(r => {
      const cat = categories.find(c => c.code === r.category_code)
      const brut = (r.frequence||0) * (r.gravite||0)
      const residuel = brut * (r.maitrise||1)
      const lvl = getRiskLevel(residuel || brut)
      return [cat?.label || '—', r.danger || '—', r.situation || '—',
        r.frequence ? `F${r.frequence} G${r.gravite}` : '—', r.maitrise ? `×${r.maitrise}` : '—',
        residuel > 0 ? `${residuel}` : '—', residuel > 0 ? lvl.label : 'Non évalué', r.prevention_existante || '—']
    })

    doc.autoTable({
      startY: y,
      head: [['Catégorie', 'Danger', 'Situation', 'F×G', 'Maîtr.', 'Score', 'Niveau', 'Prévention existante']],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak', lineWidth: 0.1 },
      headStyles: { fillColor: COLORS.accent, textColor: COLORS.black, fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 22 }, 1: { cellWidth: 25 }, 2: { cellWidth: 35 },
        3: { cellWidth: 14, halign: 'center' }, 4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 12, halign: 'center' }, 6: { cellWidth: 18, halign: 'center' }, 7: { cellWidth: 40 },
      },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 4
  }

  // ───────────────────────────────────────────────────────────
  // PAGES : PLAN D'ACTION
  // ───────────────────────────────────────────────────────────
  newPage()
  y = 20
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text("3. Plan d'action de prévention", 14, y)

  y += 10
  if (actions.length === 0) {
    doc.setFontSize(9)
    doc.setFont(undefined, 'italic')
    doc.setTextColor(...COLORS.gray)
    doc.text('Aucune action de prévention définie pour le moment.', 14, y)
  } else {
    const sortedActions = [...actions].sort((a, b) => {
      const pOrder = { critique: 0, haute: 1, moyenne: 2, basse: 3 }
      return (pOrder[a.priorite] ?? 9) - (pOrder[b.priorite] ?? 9)
    })
    const actionBody = sortedActions.map(a => {
      const risk = risks.find(r => r.id === a.risk_id)
      return [
        PRIO[a.priorite] || a.priorite || '—',
        a.action || '—',
        TYPE_ACTION[a.type_action] || a.type_action || '—',
        a.responsable || '—',
        formatDate(a.echeance),
        a.cout_estime || '—',
        STAT[a.statut] || a.statut || '—',
        risk?.danger?.substring(0, 30) || '—',
      ]
    })

    doc.autoTable({
      startY: y,
      head: [['Priorité', 'Action', 'Type', 'Responsable', 'Échéance', 'Coût est.', 'Statut', 'Risque lié']],
      body: actionBody,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak', lineWidth: 0.1 },
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' },
        1: { cellWidth: 42 },
        2: { cellWidth: 18 },
        3: { cellWidth: 22 },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 15 },
        6: { cellWidth: 16, halign: 'center' },
        7: { cellWidth: 28 },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const p = data.cell.raw
          if (p === 'CRITIQUE') { data.cell.styles.fillColor = RISK_COLORS.critique.bg; data.cell.styles.textColor = RISK_COLORS.critique.text }
          else if (p === 'Haute') { data.cell.styles.fillColor = RISK_COLORS.eleve.bg; data.cell.styles.textColor = RISK_COLORS.eleve.text }
        }
        if (data.section === 'body' && data.column.index === 6) {
          if (data.cell.raw === 'Fait') { data.cell.styles.fillColor = RISK_COLORS.faible.bg; data.cell.styles.textColor = RISK_COLORS.faible.text }
        }
      },
    })
  }

  // ───────────────────────────────────────────────────────────
  // DERNIÈRE PAGE : MENTIONS LÉGALES + DISCLAIMER
  // ───────────────────────────────────────────────────────────
  newPage()
  y = 20
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('4. Rappels réglementaires et mentions légales', 14, y)

  y += 12
  doc.setFontSize(8)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(...COLORS.black)
  const reglementaire = [
    '• Conservation obligatoire du DUERP pendant 40 ans (Art. L.4121-3-1 V du Code du travail)',
    '• Mise à jour : au minimum annuelle pour les entreprises ≥ 11 salariés, et lors de tout aménagement',
    '  important modifiant les conditions de travail ou lorsqu\'une information nouvelle est portée à connaissance',
    '• Consultation obligatoire du CSE (si applicable) sur le DUERP et ses mises à jour',
    '• Évaluation des risques tenant compte de l\'impact différencié de l\'exposition selon le sexe (Art. L.4121-3)',
    `• ${(parseInt(project.effectif) || 0) >= 50 ? 'Programme Annuel de Prévention (PAPRIPACT) obligatoire pour les entreprises ≥ 50 salariés' : 'Liste des actions de prévention et de protection intégrée au DUERP (entreprises < 50 salariés)'}`,
    '• Transmission au service de prévention et de santé au travail à chaque mise à jour',
    '• Mise à disposition des travailleurs, anciens travailleurs et toute personne justifiant d\'un intérêt',
    '• Dépôt dématérialisé sur le portail numérique prévu par la réglementation',
  ]
  reglementaire.forEach(line => {
    doc.text(line, 14, y)
    y += 5
  })

  // Disclaimer encadré
  y += 10
  doc.setFillColor(255, 250, 240)
  doc.setDrawColor(...COLORS.accent)
  doc.setLineWidth(0.8)
  const disclaimerSplit = doc.splitTextToSize(DISCLAIMER, pw - 36)
  const disclaimerH = disclaimerSplit.length * 3.8 + 16
  doc.roundedRect(14, y, pw - 28, disclaimerH, 2, 2, 'FD')

  doc.setFontSize(9)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('⚠️ AVERTISSEMENT', 20, y + 8)

  doc.setFontSize(7)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(disclaimerSplit, 20, y + 16)

  // Signatures
  y += disclaimerH + 15
  if (y < ph - 50) {
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.black)
    doc.setFont(undefined, 'bold')
    doc.text("Signatures", 14, y)
    y += 8
    doc.setFont(undefined, 'normal')
    doc.setFontSize(8)

    const sigW = (pw - 42) / 2
    // Employeur
    doc.setDrawColor(...COLORS.gray)
    doc.rect(14, y, sigW, 35)
    doc.text("L'employeur", 14 + sigW / 2, y + 6, { align: 'center' })
    doc.text(`${project.contact_name || '(Nom et prénom)'}`, 14 + sigW / 2, y + 12, { align: 'center' })
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.gray)
    doc.text('Date et signature', 14 + sigW / 2, y + 30, { align: 'center' })

    // Évaluateur
    doc.setTextColor(...COLORS.black)
    doc.setFontSize(8)
    doc.rect(14 + sigW + 14, y, sigW, 35)
    doc.text("L'évaluateur", 14 + sigW + 14 + sigW / 2, y + 6, { align: 'center' })
    doc.text(`${project.evaluateur || '(Nom et prénom)'}`, 14 + sigW + 14 + sigW / 2, y + 12, { align: 'center' })
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.gray)
    doc.text('Date et signature', 14 + sigW + 14 + sigW / 2, y + 30, { align: 'center' })
  }

  // Sauvegarder
  const filename = `DUERP_${project.company_name?.replace(/[^a-zA-Z0-9]/g, '_')}_${project.reference}.pdf`
  doc.save(filename)
  return filename
}

// ═══════════════════════════════════════════════════════════
// EXPORT EXCEL
// ═══════════════════════════════════════════════════════════
export function generateDuerpExcel({ project, units, risks, actions, categories }) {
  const wb = XLSX.utils.book_new()

  // ───────────────────────────────────────────────────────────
  // FEUILLE 1 : Informations générales
  // ───────────────────────────────────────────────────────────
  const infoData = [
    ['DOCUMENT UNIQUE D\'ÉVALUATION DES RISQUES PROFESSIONNELS (DUERP)'],
    [''],
    ['Référence', project.reference],
    ['Entreprise', project.company_name],
    ['SIRET', project.siret || ''],
    ['Code NAF', `${project.naf_code || ''} — ${project.naf_label || ''}`],
    ['Adresse', `${project.address || ''}, ${project.postal_code || ''} ${project.city || ''}`],
    ['Effectif', project.effectif || ''],
    ['Évaluateur', project.evaluateur || ''],
    ['Date élaboration', formatDate(project.date_elaboration)],
    ['Date mise à jour', formatDate(project.date_mise_a_jour)],
    ['Statut', project.status],
    [''],
    ['Statistiques'],
    ['Risques identifiés', risks.length],
    ['Risques évalués', risks.filter(r => r.frequence && r.gravite).length],
    ['Actions de prévention', actions.length],
    [''],
    ['AVERTISSEMENT'],
    [DISCLAIMER_SHORT],
  ]
  const wsInfo = XLSX.utils.aoa_to_sheet(infoData)
  wsInfo['!cols'] = [{ wch: 25 }, { wch: 60 }]
  wsInfo['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 18, c: 0 }, e: { r: 18, c: 1 } },
    { s: { r: 19, c: 0 }, e: { r: 19, c: 1 } },
  ]
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Infos')

  // ───────────────────────────────────────────────────────────
  // FEUILLE 2 : Unités de travail
  // ───────────────────────────────────────────────────────────
  const unitHeader = ['Code', 'Nom', 'Effectif', 'Métiers', 'Nb risques', 'Risque max']
  const unitRows = units.map(u => {
    const unitRisks = risks.filter(r => r.unit_id === u.id)
    const maxScore = Math.max(0, ...unitRisks.map(r => (r.frequence||0) * (r.gravite||0) * (r.maitrise||1)))
    return [u.code, u.name, u.effectif || '', u.metiers || '', unitRisks.length, maxScore > 0 ? `${maxScore} (${getRiskLevel(maxScore).label})` : '—']
  })
  const wsUnits = XLSX.utils.aoa_to_sheet([unitHeader, ...unitRows])
  wsUnits['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsUnits, 'Unités')

  // ───────────────────────────────────────────────────────────
  // FEUILLE 3 : Inventaire des risques
  // ───────────────────────────────────────────────────────────
  const riskHeader = [
    'Unité', 'Catégorie', 'Danger', 'Situation à risque', 'Conséquences',
    'Fréquence', 'F (label)', 'Gravité', 'G (label)', 'Maîtrise', 'M (label)',
    'Risque brut', 'Risque résiduel', 'Niveau', 'Prévention existante', 'Description travail', 'Notes'
  ]
  const riskRows = risks.map(r => {
    const unit = units.find(u => u.id === r.unit_id)
    const cat = categories.find(c => c.code === r.category_code)
    const brut = (r.frequence || 0) * (r.gravite || 0)
    const residuel = brut * (r.maitrise || 1)
    return [
      unit?.name || 'Sans unité',
      cat?.label || r.category_code || '',
      r.danger || '',
      r.situation || '',
      r.consequences || '',
      r.frequence || '',
      FREQ[r.frequence] || '',
      r.gravite || '',
      GRAV[r.gravite] || '',
      r.maitrise || '',
      MAIT[r.maitrise] || '',
      brut || '',
      residuel || '',
      residuel > 0 ? getRiskLevel(residuel).label : (brut > 0 ? getRiskLevel(brut).label : 'Non évalué'),
      r.prevention_existante || '',
      r.description_travail || '',
      r.notes || '',
    ]
  })
  const wsRisks = XLSX.utils.aoa_to_sheet([riskHeader, ...riskRows])
  wsRisks['!cols'] = [
    { wch: 18 }, { wch: 20 }, { wch: 25 }, { wch: 35 }, { wch: 25 },
    { wch: 5 }, { wch: 14 }, { wch: 5 }, { wch: 14 }, { wch: 5 }, { wch: 14 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 25 }, { wch: 20 },
  ]
  XLSX.utils.book_append_sheet(wb, wsRisks, 'Risques')

  // ───────────────────────────────────────────────────────────
  // FEUILLE 4 : Plan d'action
  // ───────────────────────────────────────────────────────────
  const actionHeader = [
    'Priorité', 'Action', 'Type', 'Responsable', 'Échéance', 'Coût estimé',
    'Statut', 'Date réalisation', 'Risque lié', 'Unité', 'Notes'
  ]
  const actionRows = actions.map(a => {
    const risk = risks.find(r => r.id === a.risk_id)
    const unit = risk ? units.find(u => u.id === risk.unit_id) : null
    return [
      PRIO[a.priorite] || a.priorite || '',
      a.action || '',
      TYPE_ACTION[a.type_action] || a.type_action || '',
      a.responsable || '',
      formatDate(a.echeance),
      a.cout_estime || '',
      STAT[a.statut] || a.statut || '',
      formatDate(a.date_realisation),
      risk?.danger || '',
      unit?.name || '',
      a.notes || '',
    ]
  })
  const wsActions = XLSX.utils.aoa_to_sheet([actionHeader, ...actionRows])
  wsActions['!cols'] = [
    { wch: 12 }, { wch: 40 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 18 }, { wch: 25 },
  ]
  XLSX.utils.book_append_sheet(wb, wsActions, 'Actions')

  // ───────────────────────────────────────────────────────────
  // FEUILLE 5 : Matrice
  // ───────────────────────────────────────────────────────────
  const matrixHeader = ['F \\ G', '1 — Minime', '2 — Significatif', '3 — Grave', '4 — Très grave']
  const matrixRows = []
  for (let f = 4; f >= 1; f--) {
    const row = [`${f} — ${FREQ[f]}`]
    for (let g = 1; g <= 4; g++) {
      const count = risks.filter(r => r.frequence === f && r.gravite === g).length
      const score = f * g
      row.push(count > 0 ? `${score} (${count} risque${count > 1 ? 's' : ''})` : `${score}`)
    }
    matrixRows.push(row)
  }
  const wsMatrix = XLSX.utils.aoa_to_sheet([matrixHeader, ...matrixRows])
  wsMatrix['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Matrice')

  // ───────────────────────────────────────────────────────────
  // FEUILLE 6 : Mentions légales
  // ───────────────────────────────────────────────────────────
  const legalData = [
    ['MENTIONS LÉGALES ET AVERTISSEMENT'],
    [''],
    ...DISCLAIMER.split('\n').map(line => [line]),
    [''],
    [''],
    ['Rappels réglementaires'],
    ['Conservation obligatoire du DUERP pendant 40 ans (Art. L.4121-3-1 V)'],
    ['Mise à jour annuelle obligatoire (≥11 salariés) + aménagement important + nouvelle info'],
    ['Consultation CSE obligatoire le cas échéant'],
    ['Évaluation différenciée H/F (Art. L.4121-3)'],
    [(parseInt(project.effectif) || 0) >= 50 ? 'PAPRIPACT obligatoire (≥50 salariés)' : 'Liste actions intégrée au DUERP (<50 salariés)'],
    ['Transmission médecine du travail à chaque mise à jour'],
    ['Mise à disposition des travailleurs et anciens travailleurs'],
    [''],
    ['Document généré le ' + new Date().toLocaleDateString('fr-FR') + ' via Access Campus — Access Formation, Concarneau'],
  ]
  const wsLegal = XLSX.utils.aoa_to_sheet(legalData)
  wsLegal['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(wb, wsLegal, 'Mentions légales')

  // Télécharger
  const filename = `DUERP_${project.company_name?.replace(/[^a-zA-Z0-9]/g, '_')}_${project.reference}.xlsx`
  XLSX.writeFile(wb, filename)
  return filename
}
