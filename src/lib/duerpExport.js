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
  // PAGES 2-3 : SYNTHÈSE POUR LE DIRIGEANT
  // ───────────────────────────────────────────────────────────
  newPage()
  y = 20

  // Titre
  doc.setFillColor(...COLORS.primary)
  doc.roundedRect(14, y - 4, pw - 28, 14, 2, 2, 'F')
  doc.setTextColor(...COLORS.white)
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text('SYNTHÈSE POUR LE DIRIGEANT', pw / 2, y + 5, { align: 'center' })
  y += 18

  // Texte intro pédagogique
  doc.setTextColor(...COLORS.black)
  doc.setFontSize(9)
  doc.setFont(undefined, 'normal')
  const introText = `Ce document est votre Document Unique d'Évaluation des Risques Professionnels (DUERP). Il recense l'ensemble des risques auxquels vos salariés sont exposés dans le cadre de leur activité, et définit les actions à mettre en place pour les protéger. Cette synthèse vous donne une vision claire et actionnable de la situation.`
  const introLines = doc.splitTextToSize(introText, pw - 32)
  doc.text(introLines, 16, y)
  y += introLines.length * 4.5 + 6

  // ─── VOS POSTES ET UNITÉS DE TRAVAIL ───
  doc.setFillColor(...COLORS.accent)
  doc.rect(14, y, pw - 28, 0.8, 'F')
  y += 5
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('VOS POSTES ET UNITÉS DE TRAVAIL', 16, y)
  y += 7

  doc.setFontSize(8.5)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(...COLORS.black)
  const unitIntro = `Votre entreprise a été découpée en ${units.length} unité(s) de travail, c'est-à-dire des regroupements de postes partageant les mêmes conditions d'exposition aux risques :`
  const unitIntroLines = doc.splitTextToSize(unitIntro, pw - 36)
  doc.text(unitIntroLines, 18, y)
  y += unitIntroLines.length * 4 + 4

  units.forEach(u => {
    if (y > ph - 30) { newPage(); y = 20 }
    const unitRisks = risks.filter(r => r.unit_id === u.id)
    const unitCritique = unitRisks.filter(r => { const s = (r.frequence||0)*(r.gravite||0)*(r.maitrise||1); return s >= 9 }).length
    const unitEval = unitRisks.filter(r => r.frequence && r.gravite).length

    // Pastille colorée
    const maxScore = Math.max(0, ...unitRisks.map(r => (r.frequence||0)*(r.gravite||0)*(r.maitrise||1)))
    const lvlKey = maxScore >= 13 ? 'critique' : maxScore >= 9 ? 'eleve' : maxScore >= 5 ? 'moyen' : 'faible'
    doc.setFillColor(...RISK_COLORS[lvlKey].bg)
    doc.roundedRect(18, y - 3, pw - 40, 12, 1.5, 1.5, 'F')

    doc.setFont(undefined, 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...RISK_COLORS[lvlKey].text)
    doc.text(`${u.name}`, 22, y + 4)

    doc.setFont(undefined, 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.gray)
    const unitInfo = [
      u.effectif ? `${u.effectif} pers.` : null,
      u.metiers || null,
      `${unitRisks.length} risque(s)`,
      unitCritique > 0 ? `dont ${unitCritique} élevé(s)/critique(s)` : null,
    ].filter(Boolean).join(' — ')
    doc.text(unitInfo, pw - 22, y + 4, { align: 'right' })
    y += 14
  })

  // ─── PRINCIPAUX RISQUES IDENTIFIÉS ───
  y += 4
  if (y > ph - 60) { newPage(); y = 20 }
  doc.setFillColor(...COLORS.accent)
  doc.rect(14, y, pw - 28, 0.8, 'F')
  y += 5
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('PRINCIPAUX RISQUES IDENTIFIÉS', 16, y)
  y += 7

  // Trier les risques par score décroissant, prendre les top 10
  const scoredRisks = risks.map(r => {
    const brut = (r.frequence||0) * (r.gravite||0)
    const residuel = brut * (r.maitrise||1)
    return { ...r, _score: residuel || brut }
  }).filter(r => r._score > 0).sort((a, b) => b._score - a._score)

  const topRisks = scoredRisks.slice(0, 10)

  if (topRisks.length === 0) {
    doc.setFontSize(8.5)
    doc.setFont(undefined, 'italic')
    doc.setTextColor(...COLORS.gray)
    doc.text('Aucun risque n\'a encore été évalué. Complétez les cotations pour voir apparaître cette synthèse.', 18, y)
    y += 8
  } else {
    doc.setFontSize(8.5)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(...COLORS.black)
    const riskIntro = `Sur les ${risks.length} risques identifiés, voici les ${topRisks.length} plus importants nécessitant votre attention en priorité :`
    doc.text(riskIntro, 18, y)
    y += 6

    topRisks.forEach((r, i) => {
      if (y > ph - 22) { newPage(); y = 20 }
      const unit = units.find(u => u.id === r.unit_id)
      const lvl = getRiskLevel(r._score)
      const lvlKey = lvl.key

      doc.setFillColor(...RISK_COLORS[lvlKey].bg)
      doc.circle(22, y + 1.5, 2, 'F')

      doc.setFont(undefined, 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...RISK_COLORS[lvlKey].text)
      doc.text(`${i + 1}. ${r.danger || 'Risque non titré'}`, 27, y + 3)

      doc.setFont(undefined, 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...COLORS.gray)
      const detail = `${unit?.name || 'Sans unité'} — Score ${r._score} (${lvl.label}) — F${r.frequence}×G${r.gravite}×M${r.maitrise}`
      doc.text(detail, 27, y + 8)

      if (r.situation) {
        doc.setTextColor(80, 80, 80)
        const sitLines = doc.splitTextToSize(r.situation, pw - 48)
        doc.text(sitLines.slice(0, 2), 27, y + 12.5)
        y += Math.min(sitLines.length, 2) * 3.5
      }
      y += 14
    })
  }

  // ─── CE QUE VOUS DEVEZ FAIRE : ACTIONS PRIORITAIRES ───
  if (y > ph - 50) { newPage(); y = 20 }
  y += 2
  doc.setFillColor(...COLORS.accent)
  doc.rect(14, y, pw - 28, 0.8, 'F')
  y += 5
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('CE QUE VOUS DEVEZ FAIRE : ACTIONS PRIORITAIRES', 16, y)
  y += 7

  const sortedActions = [...actions].sort((a, b) => {
    const pOrder = { critique: 0, haute: 1, moyenne: 2, basse: 3 }
    return (pOrder[a.priorite] ?? 9) - (pOrder[b.priorite] ?? 9)
  })
  const topActions = sortedActions.slice(0, 12)

  if (topActions.length === 0 && scoredRisks.length > 0) {
    doc.setFontSize(8.5)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(...COLORS.black)
    const noActionText = `Aucune action de prévention n'a été définie pour le moment. Il est impératif de définir des actions correctives pour les ${Math.min(critique + eleve, risks.length)} risque(s) élevé(s) ou critique(s) identifié(s). Rendez-vous dans l'onglet "Actions" de votre DUERP pour créer votre plan d'action.`
    const noActionLines = doc.splitTextToSize(noActionText, pw - 36)
    doc.text(noActionLines, 18, y)
    y += noActionLines.length * 4 + 4
  } else if (topActions.length > 0) {
    doc.setFontSize(8.5)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(...COLORS.black)

    const doneActions = actions.filter(a => a.statut === 'fait').length
    const actionIntro = `${actions.length} action(s) de prévention ont été définies, dont ${doneActions} réalisée(s). Voici les actions à mener en priorité :`
    doc.text(actionIntro, 18, y)
    y += 6

    topActions.forEach((a, i) => {
      if (y > ph - 20) { newPage(); y = 20 }
      const risk = risks.find(r => r.id === a.risk_id)
      const priColors = {
        critique: { bg: RISK_COLORS.critique.bg, text: RISK_COLORS.critique.text },
        haute:    { bg: RISK_COLORS.eleve.bg, text: RISK_COLORS.eleve.text },
        moyenne:  { bg: RISK_COLORS.moyen.bg, text: RISK_COLORS.moyen.text },
        basse:    { bg: RISK_COLORS.faible.bg, text: RISK_COLORS.faible.text },
      }
      const pc = priColors[a.priorite] || priColors.moyenne

      // Pastille priorité
      doc.setFillColor(...pc.bg)
      doc.roundedRect(18, y - 2.5, 16, 7, 1, 1, 'F')
      doc.setFontSize(6)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(...pc.text)
      doc.text((PRIO[a.priorite] || '').substring(0, 8), 26, y + 2, { align: 'center' })

      // Action
      doc.setFontSize(8.5)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(...COLORS.black)
      const actionText = a.action || 'Action non décrite'
      const actionLines = doc.splitTextToSize(actionText, pw - 58)
      doc.text(actionLines.slice(0, 2), 37, y + 2)

      // Détails
      doc.setFontSize(7)
      doc.setTextColor(...COLORS.gray)
      const details = [
        a.responsable ? `Resp: ${a.responsable}` : null,
        a.echeance ? `Échéance: ${formatDate(a.echeance)}` : null,
        a.cout_estime ? `Coût: ${a.cout_estime}` : null,
        STAT[a.statut] ? `[${STAT[a.statut]}]` : null,
      ].filter(Boolean).join(' — ')
      const detailY = y + 2 + Math.min(actionLines.length, 2) * 3.5
      doc.text(details, 37, detailY + 1)

      y += Math.min(actionLines.length, 2) * 3.5 + 10
    })
  }

  // ─── VOS OBLIGATIONS : CE QU'IL FAUT RETENIR ───
  if (y > ph - 70) { newPage(); y = 20 }
  y += 4
  doc.setFillColor(...COLORS.accent)
  doc.rect(14, y, pw - 28, 0.8, 'F')
  y += 5
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('VOS OBLIGATIONS : CE QU\'IL FAUT RETENIR', 16, y)
  y += 8

  doc.setFontSize(8.5)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(...COLORS.black)

  const eff = parseInt(project.effectif) || 0
  const obligations = [
    {
      title: 'Mise à jour du DUERP',
      text: eff >= 11
        ? `En tant qu'entreprise de ${eff} salariés (≥ 11), vous devez mettre à jour votre DUERP au minimum une fois par an. Vous devez également le mettre à jour lors de tout aménagement important modifiant les conditions de travail, ou lorsqu'une information nouvelle concernant un risque est portée à votre connaissance (accident du travail, maladie professionnelle, alerte d'un salarié...).`
        : `En tant qu'entreprise de moins de 11 salariés, vous n'êtes pas obligé de mettre à jour votre DUERP chaque année, mais vous devez le faire lors de tout aménagement important ou lorsqu'une information nouvelle sur un risque apparaît. Nous vous recommandons néanmoins une mise à jour annuelle pour maintenir la pertinence de votre évaluation.`,
    },
    {
      title: 'Conservation',
      text: 'Le DUERP et ses mises à jour successives doivent être conservés pendant une durée de 40 ans à compter de leur élaboration. Chaque version doit être datée. Un dépôt dématérialisé sur un portail numérique est prévu par la réglementation.',
    },
    {
      title: eff >= 50 ? 'Programme annuel de prévention (PAPRIPACT)' : 'Liste des actions de prévention',
      text: eff >= 50
        ? 'En tant qu\'entreprise de 50 salariés et plus, vous devez établir un Programme Annuel de Prévention des Risques Professionnels et d\'Amélioration des Conditions de Travail (PAPRIPACT), comprenant les mesures prises, les conditions d\'exécution, les indicateurs de résultat et l\'estimation de leur coût.'
        : 'En tant qu\'entreprise de moins de 50 salariés, vous devez définir des actions de prévention des risques et de protection des salariés. La liste de ces actions et leur condition d\'exécution sont consignées dans le présent DUERP.',
    },
    {
      title: 'Consultation et diffusion',
      text: `Le DUERP doit être tenu à la disposition de vos salariés, des anciens salariés, du médecin du travail, de l'inspection du travail et des agents de la CARSAT.${eff >= 11 ? ' Le Comité Social et Économique (CSE), s\'il existe, doit être consulté sur le DUERP et sur le programme annuel de prévention.' : ''} Pensez à transmettre le DUERP à votre service de prévention et de santé au travail à chaque mise à jour.`,
    },
    {
      title: 'Évaluation différenciée femmes/hommes',
      text: 'Depuis la loi du 2 août 2021, l\'évaluation des risques doit tenir compte de l\'impact différencié de l\'exposition en fonction du sexe. Cela signifie que certains risques peuvent affecter différemment les femmes et les hommes (ergonomie des postes, exposition chimique, risques psychosociaux...) et que votre évaluation doit en tenir compte.',
    },
  ]

  obligations.forEach(ob => {
    if (y > ph - 30) { newPage(); y = 20 }
    doc.setFont(undefined, 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...COLORS.primary)
    doc.text(`▸ ${ob.title}`, 18, y)
    y += 5

    doc.setFont(undefined, 'normal')
    doc.setTextColor(60, 60, 60)
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(ob.text, pw - 40)
    doc.text(lines, 20, y)
    y += lines.length * 3.8 + 6
  })

  // ─── PROCHAINES ÉTAPES ───
  if (y > ph - 40) { newPage(); y = 20 }
  y += 2
  doc.setFillColor(240, 248, 255)
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.5)
  const nextStepsText = [
    '1. Prenez connaissance de cette synthèse et du détail des risques dans les pages suivantes.',
    '2. Vérifiez que tous les risques identifiés correspondent à la réalité de votre entreprise.',
    '3. Complétez si nécessaire avec des risques spécifiques à votre activité.',
    '4. Mettez en œuvre les actions prioritaires (critiques et hautes) dans les plus brefs délais.',
    '5. Planifiez les actions de priorité moyenne et basse sur les prochains mois.',
    '6. Conservez ce document et programmez sa prochaine mise à jour.',
  ]
  const nextH = nextStepsText.length * 5 + 14
  doc.roundedRect(14, y, pw - 28, nextH, 2, 2, 'FD')

  doc.setFontSize(9)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('PROCHAINES ÉTAPES', 20, y + 7)

  doc.setFont(undefined, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(50, 50, 50)
  nextStepsText.forEach((step, i) => {
    doc.text(step, 20, y + 14 + i * 5)
  })

  // ───────────────────────────────────────────────────────────
  // PAGE SUIVANTE : MÉTHODOLOGIE
  // ───────────────────────────────────────────────────────────
  newPage()
  y = 20
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text('2. Méthodologie de cotation', 14, y)

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
  doc.text('3. Inventaire des risques par unité de travail', 14, y)

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
  doc.text("4. Plan d'action de prévention", 14, y)

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
  doc.text('5. Rappels réglementaires et mentions légales', 14, y)

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
  // FEUILLE 0 : Synthèse dirigeant
  // ───────────────────────────────────────────────────────────
  const eff = parseInt(project.effectif) || 0
  const evaluatedX = risks.filter(r => r.frequence && r.gravite).length
  const critiqueX = risks.filter(r => { const s = (r.frequence||0)*(r.gravite||0)*(r.maitrise||1); return s >= 13 }).length
  const eleveX = risks.filter(r => { const s = (r.frequence||0)*(r.gravite||0)*(r.maitrise||1); return s >= 9 && s < 13 }).length
  const doneX = actions.filter(a => a.statut === 'fait').length

  const synthData = [
    ['SYNTHÈSE POUR LE DIRIGEANT — ' + (project.company_name || '')],
    [''],
    ['Ce document est votre Document Unique d\'Évaluation des Risques Professionnels (DUERP). Il recense les risques auxquels vos salariés sont exposés et définit les actions à mettre en place pour les protéger.'],
    [''],
    ['═══ VOS CHIFFRES CLÉS ═══'],
    ['Risques identifiés', risks.length],
    ['Risques évalués', evaluatedX],
    ['Risques critiques + élevés', critiqueX + eleveX],
    ['Actions de prévention', actions.length],
    ['Actions réalisées', doneX],
    [''],
    ['═══ VOS UNITÉS DE TRAVAIL ═══'],
  ]
  units.forEach(u => {
    const ur = risks.filter(r => r.unit_id === u.id)
    const maxS = Math.max(0, ...ur.map(r => (r.frequence||0)*(r.gravite||0)*(r.maitrise||1)))
    synthData.push([
      u.name,
      `${ur.length} risque(s)${maxS > 0 ? ` — Niveau max : ${getRiskLevel(maxS).label} (${maxS})` : ''}`,
    ])
  })

  synthData.push([''])
  synthData.push(['═══ TOP 10 RISQUES PRIORITAIRES ═══'])
  const scoredX = risks.map(r => ({ ...r, _s: (r.frequence||0)*(r.gravite||0)*(r.maitrise||1) }))
    .filter(r => r._s > 0).sort((a, b) => b._s - a._s).slice(0, 10)
  scoredX.forEach((r, i) => {
    const u = units.find(u => u.id === r.unit_id)
    synthData.push([
      `${i+1}. ${r.danger} (${u?.name || 'Sans unité'})`,
      `Score ${r._s} — ${getRiskLevel(r._s).label} — F${r.frequence}×G${r.gravite}×M${r.maitrise}`,
    ])
  })

  synthData.push([''])
  synthData.push(['═══ ACTIONS PRIORITAIRES ═══'])
  const topAx = [...actions].sort((a, b) => {
    const p = { critique: 0, haute: 1, moyenne: 2, basse: 3 }; return (p[a.priorite]??9)-(p[b.priorite]??9)
  }).slice(0, 12)
  topAx.forEach(a => {
    const risk = risks.find(r => r.id === a.risk_id)
    synthData.push([
      `[${(PRIO[a.priorite]||'').toUpperCase()}] ${a.action}`,
      [a.responsable, formatDate(a.echeance), STAT[a.statut], risk?.danger].filter(Boolean).join(' — '),
    ])
  })

  synthData.push([''])
  synthData.push(['═══ VOS OBLIGATIONS ═══'])
  synthData.push(['Mise à jour', eff >= 11
    ? 'Obligatoire au minimum annuelle (≥11 salariés) + lors de tout aménagement important ou nouvelle information sur un risque'
    : 'Obligatoire lors de tout aménagement important ou nouvelle information (recommandée annuellement)'])
  synthData.push(['Conservation', '40 ans — chaque version datée — dépôt dématérialisé prévu'])
  synthData.push(['Plan d\'action', eff >= 50 ? 'PAPRIPACT obligatoire (≥50 salariés)' : 'Liste des actions intégrée au DUERP (<50 salariés)'])
  synthData.push(['Consultation', 'Salariés, anciens salariés, médecin du travail, inspection du travail, CARSAT' + (eff >= 11 ? ', CSE' : '')])
  synthData.push(['Différenciation H/F', 'Évaluation des risques tenant compte de l\'impact différencié selon le sexe'])
  synthData.push([''])
  synthData.push([DISCLAIMER_SHORT])

  const wsSynth = XLSX.utils.aoa_to_sheet(synthData)
  wsSynth['!cols'] = [{ wch: 50 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsSynth, 'Synthèse')

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
