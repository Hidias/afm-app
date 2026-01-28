import jsPDF from 'jspdf'

// ⚠️ FICHIER INDÉPENDANT - Ne modifie PAS pdfGenerator.js
// Ce fichier IMPORTE les infos ORG depuis pdfGenerator.js via setOrganization

// Fonction helper pour obtenir les infos organisation
let ORG_INFO = null

export function setNeedsAnalysisOrg(orgData) {
  ORG_INFO = orgData
}

export const downloadNeedsAnalysisPDF = async (session, analysisData = null, blank = false, orgSettings = null) => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  // Utiliser les infos org passées en paramètre ou valeurs par défaut
  const ORG = orgSettings || {
    name: 'Access Formation',
    nameFull: 'SARL ACCESS FORMATION',
    address: '24 Rue Kerbleiz, 29900 Concarneau',
    phone: '02 46 56 57 54',
    email: 'contact@accessformation.pro',
    siret: '94356386600012',
    nda: '53291026129',
    ndaFull: '53291026129 auprès du préfet de la région Bretagne',
    tva: 'FR71943563866',
    naf: '8559A',
    logo_base64: null
  }

  // Helper pour texte multiligne
  const addMultilineText = (text, x, y, maxWidth) => {
    if (!text) return 0
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, x, y)
    return lines.length * 5
  }

  // ============ HEADER ============
  let yPos = 15
  
  // Logo (si disponible)
  if (ORG.logo_base64) {
    try {
      doc.addImage(ORG.logo_base64, 'PNG', 15, yPos, 40, 20)
    } catch (e) {
      console.warn('Logo non ajouté:', e)
    }
  }
  
  // Infos entreprise (droite)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(ORG.nameFull, pageWidth - 15, yPos, { align: 'right' })
  yPos += 5
  doc.text(ORG.address, pageWidth - 15, yPos, { align: 'right' })
  yPos += 5
  doc.text(`Tél : ${ORG.phone} - Email : ${ORG.email}`, pageWidth - 15, yPos, { align: 'right' })
  yPos += 5
  doc.text(`SIRET : ${ORG.siret} - NDA : ${ORG.nda}`, pageWidth - 15, yPos, { align: 'right' })
  yPos += 10
  
  // N° Session (coin supérieur droit)
  doc.setFontSize(10)
  doc.text(`N° Session : ${blank ? '__________' : session.reference || ''}`, pageWidth - 15, yPos, { align: 'right' })
  yPos += 15

  // ============ TITRE ============
  // Bandeau bleu
  doc.setFillColor(33, 113, 181) // Bleu Access Formation
  doc.rect(15, yPos, pageWidth - 30, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('ANALYSE DU BESOIN DE FORMATION', pageWidth / 2, yPos + 8, { align: 'center' })
  
  yPos += 20
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  // Entreprise et Date
  const clientName = blank ? '________________________' : (session.clients?.name || '')
  const today = blank ? '___/___/______' : new Date().toLocaleDateString('fr-FR')
  doc.text(`Entreprise : ${clientName}`, 15, yPos)
  doc.text(`Date : ${today}`, pageWidth - 15, yPos, { align: 'right' })
  
  yPos += 12

  // ============ SECTION 1 : CONTEXTE ET ENJEUX ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('1. CONTEXTE ET ENJEUX', 15, yPos)
  yPos += 7
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  
  if (!blank && analysisData) {
    // Version remplie
    const reasonsLabels = {
      reglementation: 'Réglementation / Obligations légales',
      accident: 'Suite à un accident / incident',
      renouvellement: 'Renouvellement de certificats',
      nouveaux_embauches: 'Nouveaux embauchés',
      evolution_risques: 'Évolution des risques'
    }
    
    if (analysisData.context_reasons?.length > 0) {
      doc.text('Pourquoi cette formation maintenant ?', 15, yPos)
      yPos += 5
      analysisData.context_reasons.forEach(reason => {
        if (reason === 'autre' && analysisData.context_other) {
          doc.text(`• Autre : ${analysisData.context_other}`, 20, yPos)
        } else if (reasonsLabels[reason]) {
          doc.text(`• ${reasonsLabels[reason]}`, 20, yPos)
        }
        yPos += 5
      })
      yPos += 2
    }
    
    if (analysisData.context_stakes) {
      doc.text('Enjeux spécifiques :', 15, yPos)
      yPos += 5
      yPos += addMultilineText(analysisData.context_stakes, 20, yPos, pageWidth - 40)
      yPos += 5
    }
  } else {
    // Version vierge avec questions guidantes
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text('Pourquoi cette formation maintenant ? (Cochez les cases appropriées)', 15, yPos)
    yPos += 5
    doc.text('☐ Réglementation / Obligations légales', 20, yPos)
    yPos += 4
    doc.text('☐ Suite à un accident / incident', 20, yPos)
    yPos += 4
    doc.text('☐ Renouvellement de certificats', 20, yPos)
    yPos += 4
    doc.text('☐ Nouveaux embauchés', 20, yPos)
    yPos += 4
    doc.text('☐ Évolution des risques', 20, yPos)
    yPos += 4
    doc.text('☐ Autre : ___________________________', 20, yPos)
    yPos += 7
    
    doc.setTextColor(0, 0, 0)
    doc.text('Enjeux spécifiques :', 15, yPos)
    yPos += 2
  }
  
  // Rectangle pour écriture
  doc.setDrawColor(200, 200, 200)
  doc.rect(15, yPos, pageWidth - 30, 25)
  yPos += 30

  // ============ SECTION 2 : OBJECTIFS ATTENDUS ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('2. OBJECTIFS ATTENDUS', 15, yPos)
  yPos += 7
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  
  if (!blank && analysisData) {
    if (analysisData.objectives_description) {
      doc.text('Que souhaitez-vous que les stagiaires sachent faire à l\'issue ?', 15, yPos)
      yPos += 5
      yPos += addMultilineText(analysisData.objectives_description, 20, yPos, pageWidth - 40)
      yPos += 3
    }
    
    if (analysisData.objectives_measurable) {
      doc.text('Résultats mesurables attendus :', 15, yPos)
      yPos += 5
      yPos += addMultilineText(analysisData.objectives_measurable, 20, yPos, pageWidth - 40)
      yPos += 5
    }
  } else {
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text('Que souhaitez-vous que les stagiaires sachent faire à l\'issue ?', 15, yPos)
    yPos += 4
    doc.text('Ex: Être capable de porter secours, Savoir utiliser un extincteur...', 20, yPos)
    yPos += 7
    doc.setTextColor(0, 0, 0)
  }
  
  doc.rect(15, yPos, pageWidth - 30, 25)
  yPos += 30

  // ============ SECTION 3 : PUBLIC CONCERNÉ ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('3. PUBLIC CONCERNÉ', 15, yPos)
  yPos += 7
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  
  if (!blank && analysisData) {
    if (analysisData.participants_count) {
      doc.text(`Nombre de participants : ${analysisData.participants_count}`, 15, yPos)
      yPos += 5
    }
    
    if (analysisData.participants_profiles?.length > 0) {
      const profiles = analysisData.participants_profiles.map(p => {
        return { administratif: 'Administratif', production: 'Production', terrain: 'Terrain', encadrement: 'Encadrement' }[p] || p
      }).join(', ')
      doc.text(`Profils : ${profiles}`, 15, yPos)
      yPos += 5
    }
    
    if (analysisData.level) {
      const levelLabel = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' }[analysisData.level] || analysisData.level
      doc.text(`Niveau : ${levelLabel}`, 15, yPos)
      yPos += 5
    }
    
    if (analysisData.particularities_psh || analysisData.particularities_non_french || analysisData.particularities_other) {
      doc.text('Particularités :', 15, yPos)
      yPos += 5
      if (analysisData.particularities_psh) {
        doc.text(`PSH : ${analysisData.particularities_psh}`, 20, yPos)
        yPos += 5
      }
      if (analysisData.particularities_non_french) {
        doc.text('Public non francophone', 20, yPos)
        yPos += 5
      }
      if (analysisData.particularities_other) {
        doc.text(`Autre : ${analysisData.particularities_other}`, 20, yPos)
        yPos += 5
      }
    }
  } else {
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text('Nombre de participants : _____', 15, yPos)
    yPos += 5
    doc.text('Profils : ☐ Administratif ☐ Production ☐ Terrain ☐ Encadrement', 15, yPos)
    yPos += 5
    doc.text('Prérequis validés : ☐ Oui ☐ Non', 15, yPos)
    yPos += 5
    doc.text('Niveau : ☐ Débutant ☐ Intermédiaire ☐ Avancé', 15, yPos)
    yPos += 5
    doc.text('Particularités : ☐ PSH ☐ Public non francophone ☐ Autre', 15, yPos)
    yPos += 7
    doc.setTextColor(0, 0, 0)
  }
  
  doc.rect(15, yPos, pageWidth - 30, 20)
  yPos += 25

  // ============ SECTION 4 : CONTRAINTES ET MOYENS ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('4. CONTRAINTES ET MOYENS', 15, yPos)
  yPos += 7
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  
  if (!blank && analysisData) {
    if (analysisData.location_type) {
      const locationText = analysisData.location_type === 'client' 
        ? `Chez le client (${analysisData.location_client_address || ''})`
        : 'Dans nos locaux (Access Formation)'
      doc.text(`Lieu : ${locationText}`, 15, yPos)
      yPos += 5
    }
    
    if (analysisData.preferred_schedule) {
      doc.text(`Horaires : ${analysisData.preferred_schedule}`, 15, yPos)
      yPos += 5
    }
    
    if (analysisData.company_equipment) {
      doc.text(`Matériel entreprise : ${analysisData.company_equipment_details || 'Oui'}`, 15, yPos)
      yPos += 5
    }
    
    if (analysisData.other_constraints) {
      doc.text('Autres contraintes :', 15, yPos)
      yPos += 5
      yPos += addMultilineText(analysisData.other_constraints, 20, yPos, pageWidth - 40)
      yPos += 5
    }
  } else {
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text('Lieu : ☐ Dans nos locaux ☐ Chez le client (adresse : _______________)', 15, yPos)
    yPos += 5
    doc.text('Horaires souhaités : _____', 15, yPos)
    yPos += 5
    doc.text('Dates préférentielles : _____', 15, yPos)
    yPos += 5
    doc.text('Matériel spécifique : ☐ Oui ☐ Non (préciser : _______________)', 15, yPos)
    yPos += 5
    doc.text('Équipements de protection fournis : ☐ Oui ☐ Non', 15, yPos)
    yPos += 7
    doc.setTextColor(0, 0, 0)
  }
  
  doc.rect(15, yPos, pageWidth - 30, 20)
  yPos += 25

  // ============ SIGNATURES ============
  yPos = Math.max(yPos, pageHeight - 45) // Forcer en bas
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Signature entreprise :', 20, yPos)
  doc.text('Signature Access Formation :', pageWidth / 2 + 10, yPos)
  
  doc.rect(20, yPos + 3, 70, 25)
  doc.rect(pageWidth / 2 + 10, yPos + 3, 70, 25)

  // ============ FOOTER ============
  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  doc.text(`${ORG.name} - ${ORG.address}`, pageWidth / 2, pageHeight - 15, { align: 'center' })
  doc.text(ORG.ndaFull, pageWidth / 2, pageHeight - 11, { align: 'center' })
  doc.text(`SIRET: ${ORG.siret} - NAF: ${ORG.naf} - TVA: ${ORG.tva}`, pageWidth / 2, pageHeight - 7, { align: 'center' })
  doc.text('AF-BESOIN-V2.5.16', pageWidth - 15, pageHeight - 5, { align: 'right' })

  // Télécharger
  const filename = blank 
    ? 'Analyse_Besoin_Vierge.pdf'
    : `Analyse_Besoin_${session.reference}.pdf`
  doc.save(filename)
}
