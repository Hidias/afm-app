// src/lib/duerpExport.js
// Génération des rapports DUERP — PDF & Excel
// Access Formation — Refonte v2

import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { LOGO_BASE64 } from './duerpLogo'

// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════
const C = {
  teal: [34, 85, 96],
  tealDark: [20, 60, 70],
  amber: [233, 180, 76],
  red: [185, 28, 28],
  orange: [194, 65, 12],
  yellow: [161, 98, 7],
  green: [22, 101, 52],
  gray: [107, 114, 128],
  grayLight: [156, 163, 175],
  grayBg: [243, 244, 246],
  white: [255, 255, 255],
  black: [30, 30, 30],
}

const LVL = {
  critique: { label: 'Critique', bg: [254, 226, 226], text: [153, 27, 27], hex: 'FEE2E2' },
  eleve:    { label: 'Eleve',    bg: [255, 237, 213], text: [154, 52, 18], hex: 'FFEDD5' },
  moyen:    { label: 'Moyen',    bg: [254, 249, 195], text: [113, 63, 18], hex: 'FEF9C3' },
  faible:   { label: 'Faible',   bg: [220, 252, 231], text: [22, 101, 52], hex: 'DCFCE7' },
}

const riskLevel = (score) => score >= 13 ? LVL.critique : score >= 9 ? LVL.eleve : score >= 5 ? LVL.moyen : LVL.faible
const riskLevelKey = (score) => score >= 13 ? 'critique' : score >= 9 ? 'eleve' : score >= 5 ? 'moyen' : 'faible'
const riskScore = (r) => Math.round((r.frequence || 0) * (r.gravite || 0) * (r.maitrise || 1))

const FREQ = { 1: 'Occasionnel', 2: 'Frequent', 3: 'Tres frequent', 4: 'Permanent' }
const GRAV = { 1: 'Minime', 2: 'Significatif', 3: 'Grave', 4: 'Tres grave' }
const MAIT = { 0.5: 'Bonne', 0.75: 'Partielle', 1: 'Insuffisante' }
const PRIO = { critique: 'CRITIQUE', haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' }
const STAT = { a_faire: 'A faire', en_cours: 'En cours', fait: 'Fait', annule: 'Annule' }
const TYPE_A = {
  prevention: 'Prevention', protection: 'Protection', formation: 'Formation',
  organisationnelle: 'Organisation', technique: 'Technique',
}

const fmtDate = (d) => {
  if (!d) return '--'
  try { return new Date(d).toLocaleDateString('fr-FR') } catch { return String(d) }
}

const DISCLAIMER_SHORT = "Document elabore avec l'assistance d'Access Formation. L'employeur reste seul responsable de l'exhaustivite, de l'exactitude de l'evaluation des risques et de la mise en oeuvre des actions de prevention (Art. L.4121-1 et suivants du Code du travail)."

const DISCLAIMER_FULL = [
  'AVERTISSEMENT IMPORTANT -- LIMITES DE RESPONSABILITE',
  '',
  "Le present Document Unique d'Evaluation des Risques Professionnels (DUERP) a ete elabore avec l'assistance d'Access Formation dans le cadre d'une prestation d'accompagnement et de conseil.",
  '',
  "Access Formation intervient en tant que prestataire d'aide a la redaction et a la structuration du DUERP. Cette prestation ne se substitue en aucun cas a l'obligation legale de l'employeur.",
  '',
  'Conformement aux articles L.4121-1 a L.4121-5 et R.4121-1 a R.4121-4 du Code du travail :',
  "  - L'employeur est seul responsable de la transcription et de la mise a jour du DUERP",
  "  - L'employeur est seul responsable de l'exhaustivite et de l'exactitude de l'evaluation des risques",
  "  - L'employeur est seul responsable de la mise en oeuvre des actions de prevention",
  "  - L'employeur est seul garant de la consultation des representants du personnel (CSE le cas echeant)",
  '',
  "Access Formation ne saurait etre tenue responsable d'eventuelles omissions, inexactitudes ou insuffisances dans le present document. L'employeur s'engage a verifier, completer et valider l'ensemble des informations avant finalisation.",
  '',
  "Ce document constitue un outil d'aide a la decision et ne remplace pas l'expertise d'un IPRP (Intervenant en Prevention des Risques Professionnels) pour les situations complexes.",
]

// ═══════════════════════════════════════════════════════════
// PDF GENERATION
// ═══════════════════════════════════════════════════════════
export function generateDuerpPDF({ project, units, risks, actions, categories }) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const ml = 14, mr = 14
  const cw = pw - ml - mr
  const footerY = ph - 12
  const safeY = ph - 24

  let pageNum = 0

  // ── Computed ──
  const evaluated = risks.filter(r => r.frequence && r.gravite).length
  const scored = risks.map(r => ({ ...r, _score: riskScore(r) }))
  const critiqueCount = scored.filter(r => r._score >= 13).length
  const eleveCount = scored.filter(r => r._score >= 9 && r._score < 13).length
  const doneActions = actions.filter(a => a.statut === 'fait').length
  const eff = parseInt(project.effectif) || 0

  // ── Footer ──
  const addFooter = () => {
    pageNum++
    doc.setDrawColor(...C.amber)
    doc.setLineWidth(0.4)
    doc.line(ml, footerY - 2, pw - mr, footerY - 2)
    doc.setFontSize(7)
    doc.setTextColor(...C.grayLight)
    doc.text(`DUERP -- ${project.company_name} -- ${project.reference || ''}`, ml, footerY + 2)
    doc.text(`Page ${pageNum}`, pw / 2, footerY + 2, { align: 'center' })
    doc.text(`${new Date().toLocaleDateString('fr-FR')} -- Access Formation`, pw - mr, footerY + 2, { align: 'right' })
  }

  // ── Header (pages after cover) ──
  const addHeader = () => {
    try { doc.addImage(LOGO_BASE64, 'JPEG', ml, 4, 18, 18) } catch (e) { /* fallback sans logo */ }
    doc.setFontSize(8)
    doc.setTextColor(...C.gray)
    doc.text(`DUERP -- ${project.company_name}`, ml + 22, 12)
    doc.text(project.reference || '', ml + 22, 17)
    doc.setDrawColor(...C.teal)
    doc.setLineWidth(0.3)
    doc.line(ml, 24, pw - mr, 24)
  }

  // ── New page ──
  const newPage = () => {
    doc.addPage()
    addHeader()
    addFooter()
    return 30
  }

  // ── Check Y ──
  const checkY = (y, needed = 20) => (y + needed > safeY) ? newPage() : y

  // ── Section title ──
  const sectionTitle = (y, num, title) => {
    y = checkY(y, 20)
    doc.setFillColor(...C.teal)
    doc.roundedRect(ml, y - 5, cw, 12, 2, 2, 'F')
    doc.setTextColor(...C.white)
    doc.setFontSize(13)
    doc.setFont(undefined, 'bold')
    doc.text(`${num}. ${title}`, ml + 5, y + 3)
    doc.setFont(undefined, 'normal')
    return y + 14
  }

  // ── Sub-title ──
  const subTitle = (y, title) => {
    y = checkY(y, 16)
    doc.setFillColor(...C.amber)
    doc.rect(ml, y, cw, 0.8, 'F')
    y += 5
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(...C.teal)
    doc.text(title, ml + 2, y)
    doc.setFont(undefined, 'normal')
    return y + 7
  }

  // ── Paragraph ──
  const para = (y, text, opts = {}) => {
    const sz = opts.size || 8.5
    doc.setFontSize(sz)
    doc.setTextColor(...(opts.color || C.black))
    if (opts.bold) doc.setFont(undefined, 'bold')
    else if (opts.italic) doc.setFont(undefined, 'italic')
    else doc.setFont(undefined, 'normal')
    const lines = doc.splitTextToSize(text, opts.maxW || (cw - 4))
    const lh = sz * 0.42
    lines.forEach(line => {
      if (y > safeY) y = newPage()
      doc.text(line, opts.x || (ml + 2), y)
      y += lh
    })
    return y + 2
  }

  // ════════════════════════════════════════════════════════
  // PAGE 1 : COUVERTURE
  // ════════════════════════════════════════════════════════

  // Bandeau teal pleine largeur
  doc.setFillColor(...C.teal)
  doc.rect(0, 0, pw, 55, 'F')
  doc.setFillColor(...C.amber)
  doc.rect(0, 55, pw, 3, 'F')

  // Logo centré dans le bandeau
  try { doc.addImage(LOGO_BASE64, 'JPEG', pw / 2 - 22, 5, 44, 44) } catch (e) {}

  // Titre
  let y = 70
  doc.setTextColor(...C.teal)
  doc.setFontSize(22)
  doc.setFont(undefined, 'bold')
  doc.text('DOCUMENT UNIQUE', pw / 2, y, { align: 'center' })
  y += 9
  doc.setFontSize(12)
  doc.text("d'Evaluation des Risques Professionnels", pw / 2, y, { align: 'center' })
  y += 5
  doc.setDrawColor(...C.amber)
  doc.setLineWidth(1)
  doc.line(pw / 2 - 50, y, pw / 2 + 50, y)

  // Nom entreprise
  y += 14
  doc.setTextColor(...C.black)
  doc.setFontSize(22)
  doc.text(project.company_name || '', pw / 2, y, { align: 'center' })

  // Infos
  y += 14
  doc.setFontSize(9.5)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(...C.gray)
  const infoLines = [
    `Reference : ${project.reference || ''}`,
    project.siret ? `SIRET : ${project.siret}` : null,
    project.naf_code ? `Code NAF : ${project.naf_code} -- ${project.naf_label || ''}` : null,
    project.address ? `Adresse : ${project.address}, ${project.postal_code || ''} ${project.city || ''}` : null,
    project.effectif ? `Effectif : ${project.effectif} salarie(s)` : null,
    project.evaluateur ? `Evaluateur : ${project.evaluateur}` : null,
    `Date d'elaboration : ${fmtDate(project.date_elaboration)}`,
  ].filter(Boolean)
  infoLines.forEach(line => { doc.text(line, pw / 2, y, { align: 'center' }); y += 6 })

  // Stats
  y += 8
  doc.setFillColor(...C.grayBg)
  doc.roundedRect(25, y, pw - 50, 28, 3, 3, 'F')
  const statsData = [
    [`${risks.length}`, 'risques identifies'],
    [`${evaluated}`, 'evalues'],
    [`${critiqueCount + eleveCount}`, 'critiques/eleves'],
    [`${actions.length}`, 'actions prevention'],
  ]
  const sw = (pw - 50) / 4
  statsData.forEach((s, i) => {
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(...C.teal)
    doc.text(s[0], 25 + sw * i + sw / 2, y + 11, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(...C.gray)
    doc.text(s[1], 25 + sw * i + sw / 2, y + 18, { align: 'center' })
  })

  // Disclaimer bas de page couverture
  y = ph - 40
  doc.setFontSize(6)
  doc.setFont(undefined, 'italic')
  doc.setTextColor(...C.grayLight)
  doc.text(doc.splitTextToSize(DISCLAIMER_SHORT, pw - 40), 20, y)

  addFooter()

  // ════════════════════════════════════════════════════════
  // PAGE 2 : SOMMAIRE
  // ════════════════════════════════════════════════════════
  y = newPage()

  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...C.teal)
  doc.text('SOMMAIRE', pw / 2, y, { align: 'center' })
  y += 14

  const tocItems = [
    { num: '1', title: 'Synthese pour le dirigeant', desc: 'Vue d\'ensemble : postes, risques, actions, obligations' },
    { num: '2', title: 'Methodologie de cotation', desc: 'Grille Frequence x Gravite x Maitrise et matrice' },
    { num: '3', title: 'Inventaire des risques par unite', desc: `${units.length} unite(s), ${risks.length} risque(s) identifies` },
    { num: '4', title: 'Plan d\'action de prevention', desc: `${actions.length} action(s) dont ${doneActions} realisee(s)` },
    { num: '5', title: 'Mentions legales et signatures', desc: 'Obligations, avertissement, signatures' },
  ]

  tocItems.forEach((item, i) => {
    doc.setFillColor(...C.teal)
    doc.circle(ml + 8, y + 2, 5, 'F')
    doc.setTextColor(...C.white)
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.text(item.num, ml + 8, y + 4.5, { align: 'center' })
    doc.setTextColor(...C.black)
    doc.setFontSize(11)
    doc.text(item.title, ml + 18, y + 3)
    doc.setFontSize(8)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(...C.gray)
    doc.text(item.desc, ml + 18, y + 9)
    if (i < tocItems.length - 1) {
      doc.setDrawColor(...C.grayBg)
      doc.setLineWidth(0.3)
      doc.line(ml + 18, y + 14, pw - mr, y + 14)
    }
    y += 22
  })

  // Encadré guide de lecture
  y += 6
  doc.setFillColor(240, 248, 255)
  doc.setDrawColor(...C.teal)
  doc.setLineWidth(0.5)
  doc.roundedRect(ml, y, cw, 28, 2, 2, 'FD')
  doc.setFontSize(9)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...C.teal)
  doc.text('Comment lire ce document ?', ml + 5, y + 7)
  doc.setFont(undefined, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.text('Dirigeant presse : lisez uniquement la section 1 (Synthese) pour une vision complete.', ml + 5, y + 14)
  doc.text('Pour le detail : les sections 2 a 4 contiennent l\'inventaire complet et le plan d\'action.', ml + 5, y + 20)
  doc.text('Reglementaire : la section 5 rappelle vos obligations et contient les zones de signatures.', ml + 5, y + 26)

  // ════════════════════════════════════════════════════════
  // SECTION 1 : SYNTHÈSE DIRIGEANT
  // ════════════════════════════════════════════════════════
  y = newPage()
  y = sectionTitle(y, 1, 'SYNTHESE POUR LE DIRIGEANT')

  y = para(y, "Ce document est votre Document Unique d'Evaluation des Risques Professionnels (DUERP). Il recense l'ensemble des risques auxquels vos salaries sont exposes et definit les actions a mettre en place. Cette synthese vous donne une vision claire et actionnable.")

  // -- Unités --
  y += 2
  y = subTitle(y, 'VOS POSTES ET UNITES DE TRAVAIL')
  y = para(y, `Votre entreprise a ete decoupee en ${units.length} unite(s) de travail :`)
  y += 2

  units.forEach(u => {
    y = checkY(y, 14)
    const unitRisks = scored.filter(r => r.unit_id === u.id)
    const highCount = unitRisks.filter(r => r._score >= 9).length
    const maxScore = Math.max(0, ...unitRisks.map(r => r._score))
    const lvl = riskLevel(maxScore || 0)

    doc.setFillColor(...lvl.bg)
    doc.roundedRect(ml + 2, y - 3.5, cw - 4, 11, 1.5, 1.5, 'F')
    doc.setDrawColor(...lvl.text)
    doc.setLineWidth(1.5)
    doc.line(ml + 2, y - 3.5, ml + 2, y + 7.5)

    doc.setFont(undefined, 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...lvl.text)
    doc.text(u.name, ml + 7, y + 3)

    doc.setFont(undefined, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.gray)
    const info = [
      u.effectif ? `${u.effectif} pers.` : null,
      u.metiers || null,
      `${unitRisks.length} risque(s)`,
      highCount > 0 ? `dont ${highCount} eleve(s)/critique(s)` : null,
    ].filter(Boolean).join(' -- ')
    const infoW = doc.getTextWidth(info)
    if (infoW < cw - 12) {
      doc.text(info, pw - mr - 2, y + 3, { align: 'right' })
    } else {
      doc.text(doc.splitTextToSize(info, cw - 60).slice(0, 1), ml + 7, y + 8)
    }
    y += 14
  })

  // -- Top 10 risques --
  y += 2
  y = subTitle(y, 'PRINCIPAUX RISQUES IDENTIFIES')
  const topRisks = scored.filter(r => r._score > 0).sort((a, b) => b._score - a._score).slice(0, 10)

  if (topRisks.length === 0) {
    y = para(y, 'Aucun risque evalue. Completez les cotations.', { italic: true, color: C.gray })
  } else {
    y = para(y, `Sur les ${risks.length} risques identifies, voici les ${topRisks.length} plus importants :`)
    y += 2

    topRisks.forEach((r, i) => {
      y = checkY(y, 20)
      const unit = units.find(u => u.id === r.unit_id)
      const lvl = riskLevel(r._score)

      doc.setFillColor(...lvl.bg)
      doc.circle(ml + 5, y + 1.5, 3.5, 'F')
      doc.setFontSize(8)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(...lvl.text)
      doc.text(`${i + 1}`, ml + 5, y + 3, { align: 'center' })

      doc.setFontSize(8.5)
      doc.text((r.danger || '').substring(0, 70), ml + 12, y + 3)

      doc.setFont(undefined, 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...C.gray)
      doc.text(`${unit?.name || '--'} -- Score ${r._score} (${lvl.label}) -- F${r.frequence}xG${r.gravite}xM${r.maitrise}`, ml + 12, y + 8)

      if (r.situation) {
        doc.setTextColor(80, 80, 80)
        const sitLines = doc.splitTextToSize(r.situation, cw - 18).slice(0, 2)
        sitLines.forEach((line, li) => {
          const lineY = y + 12 + li * 3.5
          if (lineY < safeY) doc.text(line, ml + 12, lineY)
        })
        y += sitLines.length * 3.5
      }
      y += 14
    })
  }

  // -- Actions prioritaires --
  y = checkY(y, 30)
  y = subTitle(y, 'CE QUE VOUS DEVEZ FAIRE : ACTIONS PRIORITAIRES')

  const sortedAct = [...actions].sort((a, b) => {
    const p = { critique: 0, haute: 1, moyenne: 2, basse: 3 }
    return (p[a.priorite] ?? 9) - (p[b.priorite] ?? 9)
  })
  const topAct = sortedAct.slice(0, 12)

  if (topAct.length > 0) {
    y = para(y, `${actions.length} action(s) definies, dont ${doneActions} realisee(s). Prioritaires :`)
    y += 2

    topAct.forEach(a => {
      y = checkY(y, 14)
      const priCol = { critique: LVL.critique, haute: LVL.eleve, moyenne: LVL.moyen, basse: LVL.faible }
      const pc = priCol[a.priorite] || LVL.moyen

      doc.setFillColor(...pc.bg)
      doc.roundedRect(ml + 2, y - 2.5, 18, 7, 1, 1, 'F')
      doc.setFontSize(5.5)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(...pc.text)
      doc.text((PRIO[a.priorite] || '').substring(0, 8), ml + 11, y + 2, { align: 'center' })

      doc.setFontSize(8)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(...C.black)
      const actLines = doc.splitTextToSize(a.action || '', cw - 28).slice(0, 2)
      doc.text(actLines, ml + 23, y + 2)

      doc.setFontSize(6.5)
      doc.setTextColor(...C.gray)
      const det = [
        a.responsable ? `Resp: ${a.responsable}` : null,
        a.echeance ? `Ech: ${fmtDate(a.echeance)}` : null,
        a.cout_estime ? `Cout: ${a.cout_estime}` : null,
        STAT[a.statut] ? `[${STAT[a.statut]}]` : null,
      ].filter(Boolean).join(' -- ')
      const detY = y + 2 + Math.min(actLines.length, 2) * 3.5
      if (detY < safeY) doc.text(det, ml + 23, detY)

      y += Math.min(actLines.length, 2) * 3.5 + 10
    })
  } else {
    y = para(y, 'Aucune action definie. Definissez des actions pour les risques critiques/eleves.', { italic: true })
  }

  // -- Obligations --
  y = checkY(y, 40)
  y = subTitle(y, 'VOS OBLIGATIONS : CE QU\'IL FAUT RETENIR')

  const oblis = [
    { title: 'Mise a jour du DUERP',
      text: eff >= 11
        ? `Entreprise >= 11 salaries : mise a jour annuelle obligatoire + lors de tout changement significatif.`
        : `Entreprise < 11 salaries : MAJ lors de tout changement significatif. Annuelle recommandee.` },
    { title: 'Conservation',
      text: 'Le DUERP et ses versions successives doivent etre conserves 40 ans. Chaque version datee. Depot dematerialise prevu.' },
    { title: eff >= 50 ? 'PAPRIPACT (>= 50 sal.)' : 'Liste des actions',
      text: eff >= 50
        ? 'Programme Annuel de Prevention obligatoire avec mesures, indicateurs et cout.'
        : 'Actions de prevention et conditions d\'execution consignees dans le DUERP.' },
    { title: 'Consultation et diffusion',
      text: `A disposition des salaries, anciens salaries, medecin du travail, inspection, CARSAT.${eff >= 11 ? ' Consultation du CSE obligatoire.' : ''}` },
    { title: 'Evaluation H/F',
      text: 'Loi du 2 aout 2021 : l\'evaluation doit tenir compte de l\'impact differencie selon le sexe.' },
  ]

  oblis.forEach(ob => {
    y = checkY(y, 18)
    doc.setFont(undefined, 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...C.teal)
    doc.text(`> ${ob.title}`, ml + 2, y)
    y += 4.5
    doc.setFont(undefined, 'normal')
    doc.setTextColor(60, 60, 60)
    doc.setFontSize(7.5)
    const lines = doc.splitTextToSize(ob.text, cw - 8)
    lines.forEach(line => {
      if (y > safeY) y = newPage()
      doc.text(line, ml + 4, y)
      y += 3.5
    })
    y += 4
  })

  // -- Prochaines étapes --
  y = checkY(y, 50)
  const nextDateStr = fmtDate(project.date_prochaine_maj) !== '--'
    ? fmtDate(project.date_prochaine_maj)
    : (eff >= 11 ? `avant le ${fmtDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1)))}` : 'lors du prochain changement significatif')

  const steps = [
    '1. Prenez connaissance de cette synthese et du detail dans les pages suivantes.',
    '2. Verifiez que tous les risques correspondent a la realite de votre entreprise.',
    '3. Completez si necessaire avec des risques specifiques.',
    '4. Mettez en oeuvre les actions prioritaires (critiques et hautes) en premier.',
    '5. Planifiez les actions moyenne et basse priorite sur les prochains mois.',
    `6. Prochaine mise a jour recommandee : ${nextDateStr}.`,
  ]
  const boxH = steps.length * 5 + 14
  doc.setFillColor(240, 248, 255)
  doc.setDrawColor(...C.teal)
  doc.setLineWidth(0.5)
  doc.roundedRect(ml, y, cw, boxH, 2, 2, 'FD')
  doc.setFontSize(9)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...C.teal)
  doc.text('PROCHAINES ETAPES', ml + 5, y + 8)
  doc.setFont(undefined, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(50, 50, 50)
  steps.forEach((s, i) => doc.text(s, ml + 5, y + 15 + i * 5))

  // ════════════════════════════════════════════════════════
  // SECTION 2 : MÉTHODOLOGIE
  // ════════════════════════════════════════════════════════
  y = newPage()
  y = sectionTitle(y, 2, 'METHODOLOGIE DE COTATION')

  y = para(y, 'La cotation des risques repose sur 3 criteres multiplies entre eux :')
  y = para(y, 'Risque residuel = Frequence x Gravite x Maitrise', { bold: true, size: 10, color: C.teal })
  y += 4

  // Fréquence
  doc.autoTable({
    startY: y,
    head: [['Niveau', 'Frequence', 'Description']],
    body: [
      ['1', 'Occasionnel', 'Quelques fois par mois'],
      ['2', 'Frequent', 'Plusieurs fois par jour'],
      ['3', 'Tres frequent', 'Plusieurs fois par heure'],
      ['4', 'Permanent', 'Exposition continue'],
    ],
    theme: 'grid', styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: C.teal, textColor: C.white, fontSize: 8 },
    columnStyles: { 0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' } },
    margin: { left: ml, right: mr, bottom: 24 },
  })
  y = doc.lastAutoTable.finalY + 6

  // Gravité
  doc.autoTable({
    startY: y,
    head: [['Niveau', 'Gravite', 'Description']],
    body: [
      ['1', 'Minime', 'Premiers soins, incident benin'],
      ['2', 'Significatif', 'Accident sans arret de travail'],
      ['3', 'Grave', 'Accident avec arret, maladie pro.'],
      ['4', 'Tres grave', 'IPP, deces'],
    ],
    theme: 'grid', styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: C.teal, textColor: C.white, fontSize: 8 },
    columnStyles: { 0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' } },
    margin: { left: ml, right: mr, bottom: 24 },
  })
  y = doc.lastAutoTable.finalY + 6

  // Maîtrise
  doc.autoTable({
    startY: y,
    head: [['Coeff.', 'Maitrise', 'Description']],
    body: [
      ['x0.5', 'Bonne', 'Mesures 100% en place et verifiees'],
      ['x0.75', 'Partielle', 'Mesures partielles ou non systematiques'],
      ['x1', 'Insuffisante', 'Aucune mesure ou mesures inefficaces'],
    ],
    theme: 'grid', styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: C.teal, textColor: C.white, fontSize: 8 },
    columnStyles: { 0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' } },
    margin: { left: ml, right: mr, bottom: 24 },
  })
  y = doc.lastAutoTable.finalY + 10

  // Matrice
  y = checkY(y, 40)
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...C.teal)
  doc.text('Matrice Frequence x Gravite', ml, y)
  y += 4

  const matrixBody = []
  for (let f = 4; f >= 1; f--) {
    const row = [`${f} -- ${FREQ[f]}`]
    for (let g = 1; g <= 4; g++) {
      const score = f * g
      const count = risks.filter(r => r.frequence === f && r.gravite === g).length
      row.push(count > 0 ? `${score} (${count})` : `${score}`)
    }
    matrixBody.push(row)
  }

  doc.autoTable({
    startY: y,
    head: [['F \\ G', '1 Minime', '2 Significatif', '3 Grave', '4 Tres grave']],
    body: matrixBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
    headStyles: { fillColor: C.teal, textColor: C.white },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 35 } },
    margin: { left: ml, right: mr, bottom: 24 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0) {
        const f = 4 - data.row.index
        const g = data.column.index
        const lvl = riskLevel(f * g)
        data.cell.styles.fillColor = lvl.bg
        data.cell.styles.textColor = lvl.text
      }
    },
  })

  // ════════════════════════════════════════════════════════
  // SECTION 3 : INVENTAIRE PAR UNITÉ
  // ════════════════════════════════════════════════════════
  y = newPage()
  y = sectionTitle(y, 3, 'INVENTAIRE DES RISQUES PAR UNITE')

  // Helper pour ajouter header+footer sur les pages autoTable
  const autoTablePageHook = () => { addHeader(); addFooter() }

  units.forEach(u => {
    const unitRisks = risks.filter(r => r.unit_id === u.id)
    y = checkY(y, 30)

    doc.setFillColor(...C.teal)
    doc.roundedRect(ml, y - 4, cw, 10, 1.5, 1.5, 'F')
    doc.setTextColor(...C.white)
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text(`${(u.code || '').toUpperCase()} -- ${u.name}`, ml + 4, y + 2.5)
    if (u.effectif) {
      doc.setFont(undefined, 'normal')
      doc.setFontSize(8)
      doc.text(`${u.effectif} pers.`, pw - mr - 4, y + 2.5, { align: 'right' })
    }
    y += 10

    if (unitRisks.length === 0) {
      doc.setFontSize(8)
      doc.setFont(undefined, 'italic')
      doc.setTextColor(...C.gray)
      doc.text('Aucun risque identifie pour cette unite.', ml + 4, y)
      y += 8
      return
    }

    const tbody = unitRisks.map(r => {
      const cat = categories.find(c => c.code === r.category_code)
      const score = riskScore(r)
      const lvl = score > 0 ? riskLevel(score) : null
      return [
        cat?.label || r.category_code || '--',
        r.danger || '--',
        r.situation || '--',
        r.frequence ? `F${r.frequence} G${r.gravite}` : '--',
        r.maitrise != null ? `x${r.maitrise}` : '--',
        score > 0 ? `${score}` : '--',
        score > 0 ? lvl.label : 'Non eval.',
        r.prevention_existante || '--',
      ]
    })

    doc.autoTable({
      startY: y,
      head: [['Categorie', 'Danger', 'Situation', 'FxG', 'M.', 'Score', 'Niveau', 'Prevention existante']],
      body: tbody,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak', lineWidth: 0.1 },
      headStyles: { fillColor: C.amber, textColor: C.black, fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 20 }, 1: { cellWidth: 26 }, 2: { cellWidth: 38 },
        3: { cellWidth: 13, halign: 'center' }, 4: { cellWidth: 9, halign: 'center' },
        5: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }, 6: { cellWidth: 16, halign: 'center' }, 7: { cellWidth: 42 },
      },
      margin: { left: ml, right: mr, bottom: 24 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const val = data.cell.raw
          const key = val === 'Critique' ? 'critique' : val === 'Eleve' ? 'eleve' : val === 'Moyen' ? 'moyen' : val === 'Faible' ? 'faible' : null
          if (key) {
            data.cell.styles.fillColor = LVL[key].bg
            data.cell.styles.textColor = LVL[key].text
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
      didDrawPage: autoTablePageHook,
    })
    y = doc.lastAutoTable.finalY + 10
  })

  // Risques orphelins (sans unité)
  const orphans = risks.filter(r => !r.unit_id)
  if (orphans.length > 0) {
    y = checkY(y, 30)
    doc.setFillColor(...C.gray)
    doc.roundedRect(ml, y - 4, cw, 10, 1.5, 1.5, 'F')
    doc.setTextColor(...C.white)
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('RISQUES NON RATTACHES A UNE UNITE', ml + 4, y + 2.5)
    y += 10

    const orphBody = orphans.map(r => {
      const cat = categories.find(c => c.code === r.category_code)
      const score = riskScore(r)
      const lvl = score > 0 ? riskLevel(score) : null
      return [
        cat?.label || '--', r.danger || '--', r.situation || '--',
        r.frequence ? `F${r.frequence} G${r.gravite}` : '--',
        r.maitrise != null ? `x${r.maitrise}` : '--',
        score > 0 ? `${score}` : '--',
        score > 0 ? lvl.label : 'Non eval.',
        r.prevention_existante || '--',
      ]
    })

    doc.autoTable({
      startY: y,
      head: [['Categorie', 'Danger', 'Situation', 'FxG', 'M.', 'Score', 'Niveau', 'Prevention']],
      body: orphBody,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak', lineWidth: 0.1 },
      headStyles: { fillColor: C.gray, textColor: C.white, fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 20 }, 1: { cellWidth: 26 }, 2: { cellWidth: 38 },
        3: { cellWidth: 13, halign: 'center' }, 4: { cellWidth: 9, halign: 'center' },
        5: { cellWidth: 10, halign: 'center' }, 6: { cellWidth: 16, halign: 'center' }, 7: { cellWidth: 42 },
      },
      margin: { left: ml, right: mr, bottom: 24 },
      didDrawPage: autoTablePageHook,
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // ════════════════════════════════════════════════════════
  // SECTION 4 : PLAN D'ACTION
  // ════════════════════════════════════════════════════════
  y = newPage()
  y = sectionTitle(y, 4, "PLAN D'ACTION DE PREVENTION")

  if (actions.length === 0) {
    y = para(y, 'Aucune action definie.', { italic: true, color: C.gray })
  } else {
    const actBody = sortedAct.map(a => {
      const risk = risks.find(r => r.id === a.risk_id)
      return [
        PRIO[a.priorite] || a.priorite || '--',
        a.action || '--',
        TYPE_A[a.type_action] || a.type_action || '--',
        a.responsable || '--',
        fmtDate(a.echeance),
        a.cout_estime || '--',
        STAT[a.statut] || a.statut || '--',
        (risk?.danger || '').substring(0, 35) || '--',
      ]
    })

    doc.autoTable({
      startY: y,
      head: [['Priorite', 'Action', 'Type', 'Responsable', 'Echeance', 'Cout', 'Statut', 'Risque lie']],
      body: actBody,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak', lineWidth: 0.1 },
      headStyles: { fillColor: C.teal, textColor: C.white, fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 17, halign: 'center' }, 1: { cellWidth: 42 }, 2: { cellWidth: 17 },
        3: { cellWidth: 22 }, 4: { cellWidth: 17, halign: 'center' }, 5: { cellWidth: 15 },
        6: { cellWidth: 14, halign: 'center' }, 7: { cellWidth: 30 },
      },
      margin: { left: ml, right: mr, bottom: 24 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const val = data.cell.raw
          if (val === 'CRITIQUE') { data.cell.styles.fillColor = LVL.critique.bg; data.cell.styles.textColor = LVL.critique.text; data.cell.styles.fontStyle = 'bold' }
          else if (val === 'Haute') { data.cell.styles.fillColor = LVL.eleve.bg; data.cell.styles.textColor = LVL.eleve.text }
        }
        if (data.section === 'body' && data.column.index === 6) {
          if (data.cell.raw === 'Fait') { data.cell.styles.fillColor = LVL.faible.bg; data.cell.styles.textColor = LVL.faible.text; data.cell.styles.fontStyle = 'bold' }
        }
      },
      didDrawPage: autoTablePageHook,
    })
  }

  // ════════════════════════════════════════════════════════
  // SECTION 5 : MENTIONS LÉGALES + SIGNATURES
  // ════════════════════════════════════════════════════════
  y = newPage()
  y = sectionTitle(y, 5, 'RAPPELS REGLEMENTAIRES ET MENTIONS LEGALES')

  const reglItems = [
    'Conservation obligatoire du DUERP pendant 40 ans (Art. L.4121-3-1 V)',
    `Mise a jour : ${eff >= 11 ? 'annuelle obligatoire (>= 11 sal.)' : 'lors de tout changement significatif'} + amenagement important`,
    'Consultation du CSE (si applicable) sur le DUERP et ses mises a jour',
    'Evaluation tenant compte de l\'impact differencie selon le sexe (Art. L.4121-3)',
    eff >= 50 ? 'PAPRIPACT obligatoire (>= 50 sal.)' : 'Liste actions de prevention integree au DUERP (< 50 sal.)',
    'Transmission au service de sante au travail a chaque mise a jour',
    'Mise a disposition des travailleurs, anciens travailleurs et personnes justifiant d\'un interet',
    'Depot dematerialise prevu par la reglementation',
  ]
  reglItems.forEach(item => {
    y = checkY(y, 8)
    doc.setFontSize(8)
    doc.setTextColor(...C.black)
    doc.text(`  - ${item}`, ml + 2, y)
    y += 5.5
  })

  // Disclaimer encadré
  y += 6
  y = checkY(y, 65)
  const dlLines = doc.splitTextToSize(DISCLAIMER_FULL.join('\n'), cw - 12)
  const dlH = dlLines.length * 3 + 16
  doc.setFillColor(255, 250, 240)
  doc.setDrawColor(...C.amber)
  doc.setLineWidth(0.8)
  doc.roundedRect(ml, y, cw, dlH, 2, 2, 'FD')
  doc.setFontSize(9)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...C.amber)
  doc.text('/!\\ AVERTISSEMENT', ml + 5, y + 8)
  doc.setFontSize(6.5)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(dlLines, ml + 6, y + 14)
  y += dlH + 10

  // Signatures
  y = checkY(y, 55)
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...C.teal)
  doc.text('Signatures', ml, y)
  y += 8

  const sigW = (cw - 14) / 2

  // Employeur
  doc.setDrawColor(...C.teal)
  doc.setLineWidth(0.5)
  doc.roundedRect(ml, y, sigW, 40, 2, 2, 'D')
  doc.setFontSize(9)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...C.teal)
  doc.text("L'employeur", ml + sigW / 2, y + 8, { align: 'center' })
  doc.setFont(undefined, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.black)
  doc.text(project.contact_name || '(Nom et prenom)', ml + sigW / 2, y + 15, { align: 'center' })
  doc.setFontSize(7)
  doc.setTextColor(...C.grayLight)
  doc.text('Date et signature', ml + sigW / 2, y + 35, { align: 'center' })

  // Évaluateur
  const sig2X = ml + sigW + 14
  doc.roundedRect(sig2X, y, sigW, 40, 2, 2, 'D')
  doc.setFontSize(9)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...C.teal)
  doc.text("L'evaluateur", sig2X + sigW / 2, y + 8, { align: 'center' })
  doc.setFont(undefined, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.black)
  doc.text(project.evaluateur || '(Nom et prenom)', sig2X + sigW / 2, y + 15, { align: 'center' })
  doc.setFontSize(7)
  doc.setTextColor(...C.grayLight)
  doc.text('Date et signature', sig2X + sigW / 2, y + 35, { align: 'center' })

  // ── Save ──
  const fname = `DUERP_${(project.company_name || 'export').replace(/[^a-zA-Z0-9]/g, '_')}_${project.reference || ''}.pdf`
  doc.save(fname)
  return fname
}

// ═══════════════════════════════════════════════════════════
// EXCEL GENERATION (xlsx — max features)
// ═══════════════════════════════════════════════════════════
export function generateDuerpExcel({ project, units, risks, actions, categories }) {
  const wb = XLSX.utils.book_new()
  const eff = parseInt(project.effectif) || 0
  const scored = risks.map(r => ({ ...r, _score: riskScore(r) }))
  const doneAct = actions.filter(a => a.statut === 'fait').length

  // Helper : sheet with cols + freeze + autofilter
  const makeSheet = (data, colWidths, opts = {}) => {
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = colWidths.map(w => ({ wch: w }))
    const freezeRow = opts.freezeRow ?? 1
    if (freezeRow > 0) {
      ws['!views'] = [{ state: 'frozen', ySplit: freezeRow, xSplit: 0 }]
    }
    if (opts.autoFilter !== false && data.length > 1 && data[0]) {
      const lastCol = XLSX.utils.encode_col(data[0].length - 1)
      ws['!autofilter'] = { ref: `A1:${lastCol}${data.length}` }
    }
    return ws
  }

  // ═══ Synthèse ═══
  const synthRows = [
    ['SYNTHESE POUR LE DIRIGEANT'],
    [],
    ['INFORMATIONS GENERALES'],
    ['Entreprise', project.company_name, '', 'Reference', project.reference],
    ['SIRET', project.siret || '', '', 'NAF', `${project.naf_code || ''} ${project.naf_label || ''}`],
    ['Adresse', `${project.address || ''}, ${project.postal_code || ''} ${project.city || ''}`, '', 'Effectif', `${project.effectif || ''} salarie(s)`],
    ['Evaluateur', project.evaluateur || '', '', 'Date', fmtDate(project.date_elaboration)],
    [],
    ['CHIFFRES CLES'],
    ['', 'Nombre', '', '', ''],
    ['Risques identifies', risks.length, '', 'Actions de prevention', actions.length],
    ['Risques evalues', scored.filter(r => r._score > 0).length, '', 'Actions realisees', doneAct],
    ['Risques critiques/eleves', scored.filter(r => r._score >= 9).length, '', 'Actions a faire', actions.filter(a => a.statut === 'a_faire').length],
    [],
    ['UNITES DE TRAVAIL'],
    ['Unite', 'Effectif', 'Nb risques', 'Niveau max'],
  ]
  units.forEach(u => {
    const ur = scored.filter(r => r.unit_id === u.id)
    const maxS = Math.max(0, ...ur.map(r => r._score))
    synthRows.push([u.name, u.effectif || '', ur.length, maxS > 0 ? `${riskLevel(maxS).label} (${maxS})` : '--'])
  })
  synthRows.push([])
  synthRows.push(['TOP 10 RISQUES'])
  synthRows.push(['N.', 'Danger', 'Unite', 'Score', 'Niveau'])
  scored.filter(r => r._score > 0).sort((a, b) => b._score - a._score).slice(0, 10).forEach((r, i) => {
    const u = units.find(u => u.id === r.unit_id)
    synthRows.push([i + 1, r.danger, u?.name || '', r._score, riskLevel(r._score).label])
  })
  synthRows.push([])
  synthRows.push(['ACTIONS PRIORITAIRES'])
  synthRows.push(['Priorite', 'Action', 'Responsable', 'Echeance', 'Statut'])
  const sortedActX = [...actions].sort((a, b) => {
    const p = { critique: 0, haute: 1, moyenne: 2, basse: 3 }; return (p[a.priorite] ?? 9) - (p[b.priorite] ?? 9)
  })
  sortedActX.slice(0, 15).forEach(a => {
    synthRows.push([PRIO[a.priorite] || '', a.action, a.responsable || '', fmtDate(a.echeance), STAT[a.statut] || ''])
  })
  synthRows.push([])
  synthRows.push(['OBLIGATIONS REGLEMENTAIRES'])
  synthRows.push(['Mise a jour', eff >= 11 ? 'Annuelle obligatoire + changement significatif' : 'Lors de changement significatif (annuelle recommandee)'])
  synthRows.push(['Conservation', '40 ans -- chaque version datee'])
  synthRows.push(['Plan action', eff >= 50 ? 'PAPRIPACT obligatoire' : 'Liste actions integree au DUERP'])
  synthRows.push(['Diffusion', 'Salaries, medecin travail, inspection, CARSAT' + (eff >= 11 ? ', CSE' : '')])
  synthRows.push(['Evaluation H/F', 'Impact differencie selon le sexe (loi 2 aout 2021)'])
  synthRows.push([])
  synthRows.push([DISCLAIMER_SHORT])

  const wsSynth = XLSX.utils.aoa_to_sheet(synthRows)
  wsSynth['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 12 }, { wch: 18 }, { wch: 25 }]
  // Merge titre
  wsSynth['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 4 } },
  ]
  XLSX.utils.book_append_sheet(wb, wsSynth, 'Synthese')

  // ═══ Unités ═══
  const unitData = [
    ['Code', 'Unite de travail', 'Effectif', 'Metiers / Postes', 'Nb risques', 'Risques >= eleve', 'Score max', 'Niveau max'],
    ...units.map(u => {
      const ur = scored.filter(r => r.unit_id === u.id)
      const maxS = Math.max(0, ...ur.map(r => r._score))
      return [u.code, u.name, u.effectif || '', u.metiers || '', ur.length, ur.filter(r => r._score >= 9).length, maxS || '', maxS > 0 ? riskLevel(maxS).label : '--']
    })
  ]
  XLSX.utils.book_append_sheet(wb, makeSheet(unitData, [10, 28, 8, 38, 10, 13, 10, 12]), 'Unites')

  // ═══ Risques ═══
  const riskData = [
    ['Unite', 'Categorie', 'Danger', 'Situation', 'Consequences', 'F', 'Frequence', 'G', 'Gravite', 'M', 'Maitrise', 'Brut', 'Residuel', 'Niveau', 'Prevention existante'],
    ...risks.map(r => {
      const unit = units.find(u => u.id === r.unit_id)
      const cat = categories.find(c => c.code === r.category_code)
      const brut = (r.frequence || 0) * (r.gravite || 0)
      const score = riskScore(r)
      return [
        unit?.name || 'Sans unite', cat?.label || r.category_code || '', r.danger || '', r.situation || '', r.consequences || '',
        r.frequence || '', FREQ[r.frequence] || '', r.gravite || '', GRAV[r.gravite] || '', r.maitrise || '', MAIT[r.maitrise] || '',
        brut || '', score || '', score > 0 ? riskLevel(score).label : 'Non evalue', r.prevention_existante || '',
      ]
    })
  ]
  XLSX.utils.book_append_sheet(wb, makeSheet(riskData, [18, 18, 28, 35, 25, 4, 14, 4, 14, 5, 12, 9, 10, 10, 38]), 'Risques')

  // ═══ Actions ═══
  const actData = [
    ['Priorite', 'Action', 'Type', 'Responsable', 'Echeance', 'Cout estime', 'Statut', 'Date realisation', 'Risque lie', 'Unite'],
    ...sortedActX.map(a => {
      const risk = risks.find(r => r.id === a.risk_id)
      const unit = risk ? units.find(u => u.id === risk.unit_id) : null
      return [
        PRIO[a.priorite] || a.priorite || '', a.action || '', TYPE_A[a.type_action] || a.type_action || '',
        a.responsable || '', fmtDate(a.echeance), a.cout_estime || '', STAT[a.statut] || '',
        fmtDate(a.date_realisation), risk?.danger || '', unit?.name || '',
      ]
    })
  ]
  XLSX.utils.book_append_sheet(wb, makeSheet(actData, [12, 45, 14, 22, 12, 12, 10, 13, 30, 18]), 'Actions')

  // ═══ Matrice ═══
  const matData = [
    ['F \\ G', '1 Minime', '2 Significatif', '3 Grave', '4 Tres grave'],
    ...([4, 3, 2, 1].map(f => {
      const row = [`${f} -- ${FREQ[f]}`]
      for (let g = 1; g <= 4; g++) {
        const count = risks.filter(r => r.frequence === f && r.gravite === g).length
        row.push(count > 0 ? `${f * g} (${count} risque${count > 1 ? 's' : ''})` : `${f * g}`)
      }
      return row
    }))
  ]
  XLSX.utils.book_append_sheet(wb, makeSheet(matData, [22, 18, 18, 18, 18]), 'Matrice')

  // ═══ Mentions légales ═══
  const legalRows = [
    ['MENTIONS LEGALES ET AVERTISSEMENT'],
    [''],
    ...DISCLAIMER_FULL.map(l => [l]),
    [''],
    ['RAPPELS REGLEMENTAIRES'],
    ['Conservation obligatoire 40 ans (Art. L.4121-3-1 V)'],
    [`Mise a jour : ${eff >= 11 ? 'annuelle obligatoire' : 'lors de changement significatif'}`],
    ['Consultation CSE obligatoire le cas echeant'],
    ['Evaluation differenciee H/F (Art. L.4121-3)'],
    [eff >= 50 ? 'PAPRIPACT obligatoire' : 'Liste actions integree au DUERP'],
    ['Transmission medecine du travail a chaque MAJ'],
    [''],
    [`Document genere le ${new Date().toLocaleDateString('fr-FR')} -- Access Campus -- Access Formation, Concarneau`],
  ]
  const wsLegal = XLSX.utils.aoa_to_sheet(legalRows)
  wsLegal['!cols'] = [{ wch: 95 }]
  XLSX.utils.book_append_sheet(wb, wsLegal, 'Mentions legales')

  // Save
  const fname = `DUERP_${(project.company_name || 'export').replace(/[^a-zA-Z0-9]/g, '_')}_${project.reference || ''}.xlsx`
  XLSX.writeFile(wb, fname)
  return fname
}
