import jsPDF from 'jspdf'

// Helper pour sécuriser les valeurs
const safe = (value, defaultValue = '') => {
  if (value === null || value === undefined) return defaultValue
  return String(value)
}

export const downloadNeedsAnalysisPDF = async (session, analysisData = null, blank = false, orgSettings = null) => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)
  
  // Utiliser les infos org passées en paramètre (depuis organization_settings)
  // Si pas de orgSettings, utiliser valeurs par défaut (fallback)
  const ORG = orgSettings ? {
    name: orgSettings.name || 'Access Formation',
    nameFull: orgSettings.name ? `SARL ${orgSettings.name}` : 'SARL ACCESS FORMATION',
    address: orgSettings.address && orgSettings.postal_code && orgSettings.city
      ? `${orgSettings.address}, ${orgSettings.postal_code} ${orgSettings.city}`
      : '24 Rue Kerbleiz, 29900 Concarneau',
    addressFull: orgSettings.address && orgSettings.postal_code && orgSettings.city
      ? `${orgSettings.address} - ${orgSettings.postal_code} ${orgSettings.city}`
      : '24 Rue Kerbleiz - 29900 Concarneau',
    phone: orgSettings.phone || '02 46 56 57 54',
    email: orgSettings.email || 'contact@accessformation.pro',
    siret: orgSettings.siret || '94356386600012',
    nda: orgSettings.nda || '53291026129',
    ndaFull: orgSettings.nda 
      ? `${orgSettings.nda} auprès du préfet de la région Bretagne`
      : '53291026129 auprès du préfet de la région Bretagne',
    tva: orgSettings.tva || 'FR71943563866',
    naf: orgSettings.naf || '8559A',
    logo_base64: orgSettings.logo_base64 || null
  } : {
    // Valeurs par défaut si pas de orgSettings du tout
    name: 'Access Formation',
    nameFull: 'SARL ACCESS FORMATION',
    address: '24 Rue Kerbleiz, 29900 Concarneau',
    addressFull: '24 Rue Kerbleiz - 29900 Concarneau',
    phone: '02 46 56 57 54',
    email: 'contact@accessformation.pro',
    siret: '94356386600012',
    nda: '53291026129',
    ndaFull: '53291026129 auprès du préfet de la région Bretagne',
    tva: 'FR71943563866',
    naf: '8559A',
    logo_base64: null
  }

  // Helper pour texte multiligne avec retour de hauteur
  const addText = (text, x, y, maxWidth, fontSize = 9) => {
    if (!text) return 0
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(String(text), maxWidth)
    doc.text(lines, x, y)
    return lines.length * (fontSize * 0.5) // Hauteur approximative
  }

  // ============ HEADER ============
  let yPos = 15
  
  // Logo (si disponible)
  if (ORG.logo_base64) {
    try {
      doc.addImage(ORG.logo_base64, 'PNG', margin, yPos, 35, 18)
    } catch (e) {
      console.warn('Logo non ajouté:', e)
    }
  }
  
  // Infos entreprise (droite)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(safe(ORG.nameFull), pageWidth - margin, yPos, { align: 'right' })
  yPos += 4
  doc.text(safe(ORG.address), pageWidth - margin, yPos, { align: 'right' })
  yPos += 4
  doc.text(`Tél : ${safe(ORG.phone)} - Email : ${safe(ORG.email)}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 4
  doc.text(`SIRET : ${safe(ORG.siret)} - NDA : ${safe(ORG.nda)}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 10
  
  // N° Session (coin supérieur droit)
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  const sessionRef = blank ? '__________' : safe(session?.reference, '__________')
  doc.text(`N° Session : ${sessionRef}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 12

  // ============ TITRE ============
  doc.setFillColor(33, 113, 181)
  doc.rect(margin, yPos, contentWidth, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('ANALYSE DU BESOIN DE FORMATION', pageWidth / 2, yPos + 7, { align: 'center' })
  
  yPos += 15
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  // Entreprise et Date
  // Support 2 formats : session.clients.name (sessions) OU session.name (prospects)
  const clientName = blank 
    ? '________________________' 
    : safe(session?.clients?.name || session?.name, '________________________')
  const today = blank 
    ? '___/___/______' 
    : (analysisData?.analysis_date 
        ? new Date(analysisData.analysis_date).toLocaleDateString('fr-FR')
        : new Date().toLocaleDateString('fr-FR'))
  doc.text(`Entreprise : ${clientName}`, margin, yPos)
  doc.text(`Date : ${today}`, pageWidth - margin, yPos, { align: 'right' })
  
  yPos += 10

  // ============ SECTION 1 : CONTEXTE ET ENJEUX ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, yPos, contentWidth, 7, 'F')
  doc.text('1. CONTEXTE ET ENJEUX', margin + 2, yPos + 5)
  yPos += 9
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  
  if (!blank && analysisData) {
    // VERSION REMPLIE
    const reasonsLabels = {
      reglementation: '• Réglementation / Obligations légales',
      accident: '• Suite à un accident / incident',
      renouvellement: '• Renouvellement de certificats',
      nouveaux_embauches: '• Nouveaux embauchés',
      evolution_risques: '• Évolution des risques'
    }
    
    if (analysisData.context_reasons?.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.text('Pourquoi cette formation maintenant ?', margin, yPos)
      yPos += 4
      doc.setFont('helvetica', 'normal')
      
      analysisData.context_reasons.forEach(reason => {
        if (reason === 'autre' && analysisData.context_other) {
          doc.text(`• Autre : ${safe(analysisData.context_other)}`, margin + 3, yPos)
        } else if (reasonsLabels[reason]) {
          doc.text(reasonsLabels[reason], margin + 3, yPos)
        }
        yPos += 4
      })
      yPos += 1
    }
    
    if (analysisData.context_stakes) {
      doc.setFont('helvetica', 'bold')
      doc.text('Enjeux spécifiques :', margin, yPos)
      yPos += 4
      doc.setFont('helvetica', 'normal')
      yPos += addText(analysisData.context_stakes, margin + 3, yPos, contentWidth - 6, 9)
      yPos += 2
    }
  } else {
    // VERSION VIERGE
    doc.setFont('helvetica', 'bold')
    doc.text('Pourquoi cette formation maintenant ?', margin, yPos)
    yPos += 4
    doc.setFont('helvetica', 'normal')
    
    const options = [
      '[ ] Réglementation / Obligations légales',
      '[ ] Suite à un accident / incident',
      '[ ] Renouvellement de certificats',
      '[ ] Nouveaux embauchés',
      '[ ] Évolution des risques',
      '[ ] Autre : ___________________________________'
    ]
    
    options.forEach(opt => {
      doc.text(opt, margin + 3, yPos)
      yPos += 4
    })
    
    yPos += 1
    doc.setFont('helvetica', 'bold')
    doc.text('Enjeux spécifiques :', margin, yPos)
    yPos += 4
    doc.setFont('helvetica', 'normal')
    doc.setDrawColor(200, 200, 200)
    for (let i = 0; i < 2; i++) {
      doc.line(margin + 3, yPos, pageWidth - margin, yPos)
      yPos += 4
    }
  }
  
  yPos += 3

  // ============ SECTION 2 : OBJECTIFS ATTENDUS ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, yPos, contentWidth, 7, 'F')
  doc.text('2. OBJECTIFS ATTENDUS', margin + 2, yPos + 5)
  yPos += 9
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  
  if (!blank && analysisData) {
    // VERSION REMPLIE
    if (analysisData.objectives_description) {
      doc.setFont('helvetica', 'bold')
      doc.text('Que souhaitez-vous que les stagiaires sachent faire à l\'issue ?', margin, yPos)
      yPos += 4
      doc.setFont('helvetica', 'normal')
      yPos += addText(analysisData.objectives_description, margin + 3, yPos, contentWidth - 6, 9)
      yPos += 2
    }
    
    if (analysisData.objectives_measurable) {
      doc.setFont('helvetica', 'bold')
      doc.text('Résultats mesurables attendus :', margin, yPos)
      yPos += 4
      doc.setFont('helvetica', 'normal')
      yPos += addText(analysisData.objectives_measurable, margin + 3, yPos, contentWidth - 6, 9)
      yPos += 2
    }
  } else {
    // VERSION VIERGE
    doc.setFont('helvetica', 'bold')
    doc.text('Que souhaitez-vous que les stagiaires sachent faire à l\'issue ?', margin, yPos)
    yPos += 4
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.setFontSize(8)
    doc.text('Ex: Être capable de porter secours, Savoir utiliser un extincteur...', margin + 3, yPos)
    yPos += 4
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)
    doc.setDrawColor(200, 200, 200)
    for (let i = 0; i < 2; i++) {
      doc.line(margin + 3, yPos, pageWidth - margin, yPos)
      yPos += 4
    }
    
    yPos += 1
    doc.setFont('helvetica', 'bold')
    doc.text('Résultats mesurables attendus :', margin, yPos)
    yPos += 4
    doc.setFont('helvetica', 'normal')
    for (let i = 0; i < 2; i++) {
      doc.line(margin + 3, yPos, pageWidth - margin, yPos)
      yPos += 4
    }
  }
  
  yPos += 3

  // ============ SECTION 3 : PUBLIC CONCERNÉ ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, yPos, contentWidth, 7, 'F')
  doc.text('3. PUBLIC CONCERNÉ', margin + 2, yPos + 5)
  yPos += 9
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  
  if (!blank && analysisData) {
    // VERSION REMPLIE - Layout structuré
    const items = []
    
    if (analysisData.participants_count) {
      items.push(`Nombre de participants : ${safe(analysisData.participants_count)}`)
    }
    
    if (analysisData.participants_profiles?.length > 0) {
      const profiles = analysisData.participants_profiles.map(p => {
        return { administratif: 'Administratif', production: 'Production', terrain: 'Terrain', encadrement: 'Encadrement' }[p] || p
      }).join(', ')
      items.push(`Profils : ${safe(profiles)}`)
    }
    
    if (analysisData.level) {
      const levelLabel = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' }[analysisData.level] || analysisData.level
      items.push(`Niveau : ${safe(levelLabel)}`)
    }
    
    if (analysisData.prerequisites_validated !== null) {
      items.push(`Prérequis validés : ${analysisData.prerequisites_validated ? 'Oui' : 'Non'}`)
    }
    
    items.forEach(item => {
      doc.text(item, margin, yPos)
      yPos += 5
    })
    
    if (analysisData.particularities_psh || analysisData.particularities_non_french || analysisData.particularities_other) {
      yPos += 2
      doc.setFont('helvetica', 'bold')
      doc.text('Particularités :', margin, yPos)
      yPos += 5
      doc.setFont('helvetica', 'normal')
      
      if (analysisData.particularities_psh) {
        doc.text(`• PSH : ${safe(analysisData.particularities_psh)}`, margin + 3, yPos)
        yPos += 5
      }
      if (analysisData.particularities_non_french) {
        doc.text('• Public non francophone', margin + 3, yPos)
        yPos += 5
      }
      if (analysisData.particularities_other) {
        doc.text(`• Autre : ${safe(analysisData.particularities_other)}`, margin + 3, yPos)
        yPos += 5
      }
    }
  } else {
    // VERSION VIERGE
    doc.text('Nombre de participants : _____', margin, yPos)
    yPos += 4
    doc.text('Profils : [ ] Administratif  [ ] Production  [ ] Terrain  [ ] Encadrement', margin, yPos)
    yPos += 4
    doc.text('Prérequis validés : [ ] Oui  [ ] Non', margin, yPos)
    yPos += 4
    doc.text('Niveau : [ ] Débutant  [ ] Intermédiaire  [ ] Avancé', margin, yPos)
    yPos += 4
    yPos += 1
    doc.text('Particularités : [ ] PSH  [ ] Public non francophone  [ ] Autre', margin, yPos)
    yPos += 4
    doc.setDrawColor(200, 200, 200)
    for (let i = 0; i < 2; i++) {
      doc.line(margin + 3, yPos, pageWidth - margin, yPos)
      yPos += 4
    }
  }
  
  yPos += 3

  // ============ SECTION 4 : CONTRAINTES ET MOYENS ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, yPos, contentWidth, 7, 'F')
  doc.text('4. CONTRAINTES ET MOYENS', margin + 2, yPos + 5)
  yPos += 9
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  
  if (!blank && analysisData) {
    // VERSION REMPLIE
    if (analysisData.location_type) {
      const locationText = analysisData.location_type === 'client' 
        ? `Chez le client (${safe(analysisData.location_client_address, '')})`
        : 'Dans nos locaux (Access Formation)'
      doc.text(`Lieu : ${safe(locationText)}`, margin, yPos)
      yPos += 5
    }
    
    if (analysisData.preferred_schedule) {
      doc.text(`Horaires : ${safe(analysisData.preferred_schedule)}`, margin, yPos)
      yPos += 5
    }
    
    if (analysisData.preferred_dates) {
      doc.text(`Dates préférentielles : ${safe(analysisData.preferred_dates)}`, margin, yPos)
      yPos += 5
    }
    
    if (analysisData.company_equipment !== null) {
      const equipText = analysisData.company_equipment 
        ? `Oui${analysisData.company_equipment_details ? ' (' + safe(analysisData.company_equipment_details) + ')' : ''}`
        : 'Non'
      doc.text(`Matériel spécifique entreprise : ${equipText}`, margin, yPos)
      yPos += 5
    }
    
    if (analysisData.ppe_provided !== null) {
      doc.text(`Équipements de protection fournis : ${analysisData.ppe_provided ? 'Oui' : 'Non'}`, margin, yPos)
      yPos += 5
    }
    
    if (analysisData.other_constraints) {
      yPos += 2
      doc.setFont('helvetica', 'bold')
      doc.text('Autres contraintes :', margin, yPos)
      yPos += 5
      doc.setFont('helvetica', 'normal')
      yPos += addText(analysisData.other_constraints, margin + 3, yPos, contentWidth - 6, 9)
      yPos += 3
    }
  } else {
    // VERSION VIERGE
    doc.text('Lieu : [ ] Dans nos locaux  [ ] Chez le client', margin, yPos)
    yPos += 4
    doc.text('Adresse si chez le client : ___________________________________', margin + 3, yPos)
    yPos += 4
    doc.text('Horaires souhaités : ___________________________________', margin, yPos)
    yPos += 4
    doc.text('Dates préférentielles : ___________________________________', margin, yPos)
    yPos += 4
    doc.text('Matériel spécifique entreprise : [ ] Oui  [ ] Non', margin, yPos)
    yPos += 4
    doc.text('Précisions : ___________________________________', margin + 3, yPos)
    yPos += 4
    doc.text('Équipements de protection fournis : [ ] Oui  [ ] Non', margin, yPos)
    yPos += 4
  }
  
  yPos += 3

  // ============ SIGNATURES ============
  // Calculer espace restant et ajuster si nécessaire
  const spaceForFooter = 18 // Espace réservé pour footer
  const spaceForSignatures = 26 // Hauteur signatures
  const minYForSignatures = pageHeight - spaceForFooter - spaceForSignatures
  
  if (yPos > minYForSignatures) {
    yPos = minYForSignatures
  } else {
    yPos += 3
  }
  
  // Dimensions des rectangles
  const signatureBoxWidth = 68
  const signatureBoxHeight = 18
  const signatureBoxY = yPos + 1
  
  // Titres
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Signature entreprise :', margin + 2, yPos)
  doc.text('Signature Access Formation :', pageWidth / 2 + 2, yPos)
  
  // Dessiner les rectangles
  doc.setDrawColor(100, 100, 100)
  doc.setLineWidth(0.3)
  doc.rect(margin, signatureBoxY, signatureBoxWidth, signatureBoxHeight)
  doc.rect(pageWidth / 2, signatureBoxY, signatureBoxWidth, signatureBoxHeight)
  
  // Afficher les signatures SI ELLES EXISTENT et qu'on n'est pas en mode vierge
  if (!blank && analysisData) {
    // Signature client (rectangle gauche)
    if (analysisData.signature_client) {
      try {
        // Dimensions image : rectangle - 4px de marge interne
        const imgWidth = signatureBoxWidth - 4
        const imgHeight = signatureBoxHeight - 4
        const imgX = margin + 2
        const imgY = signatureBoxY + 2
        
        doc.addImage(
          analysisData.signature_client,
          'PNG',
          imgX,
          imgY,
          imgWidth,
          imgHeight
        )
      } catch (e) {
        console.warn('Erreur signature client:', e)
      }
    }
    
    // Signature formateur (rectangle droite)
    if (analysisData.signature_trainer) {
      try {
        // Dimensions image : rectangle - 4px de marge interne
        const imgWidth = signatureBoxWidth - 4
        const imgHeight = signatureBoxHeight - 4
        const imgX = pageWidth / 2 + 2
        const imgY = signatureBoxY + 2
        
        doc.addImage(
          analysisData.signature_trainer,
          'PNG',
          imgX,
          imgY,
          imgWidth,
          imgHeight
        )
      } catch (e) {
        console.warn('Erreur signature formateur:', e)
      }
    }
  }

  // ============ FOOTER ============
  // Position fixe en bas de page avec espace suffisant
  const footerStartY = pageHeight - 15
  doc.setFontSize(6.5)
  doc.setTextColor(80, 80, 80)
  doc.setFont('helvetica', 'normal')
  doc.text(`${safe(ORG.name)} - ${safe(ORG.addressFull)}`, pageWidth / 2, footerStartY, { align: 'center' })
  doc.text(safe(ORG.ndaFull), pageWidth / 2, footerStartY + 3, { align: 'center' })
  doc.text(`SIRET: ${safe(ORG.siret)} - NAF: ${safe(ORG.naf)} - TVA: ${safe(ORG.tva)}`, pageWidth / 2, footerStartY + 6, { align: 'center' })
  doc.text('AF-BESOIN-V2.5.16', pageWidth - margin, footerStartY + 9, { align: 'right' })

  // Télécharger
  const filename = blank 
    ? 'Analyse_Besoin_Vierge.pdf'
    : `Analyse_Besoin_${safe(session?.reference, 'Session')}.pdf`
  doc.save(filename)
}
