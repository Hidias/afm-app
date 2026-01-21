import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * Génère le PDF de certification SST selon le référentiel INRS
 * Reproduction exacte des grilles officielles
 */
export async function generateSSTCertificationPDF(certification, trainee, session, trainer) {
  const doc = new jsPDF('portrait', 'mm', 'a4')
  const isFI = certification.formation_type === 'FI'
  
  // Charger les logos
  const logoINRS = '/logos/inrs-logo.png' // À placer dans public/logos/
  const logoSST = '/logos/sst-logo.png'   // À placer dans public/logos/
  
  // Page 1
  generatePage1(doc, certification, trainee, session, trainer, isFI, logoINRS, logoSST)
  
  // Page 2
  doc.addPage()
  generatePage2(doc, certification, trainer, isFI, logoINRS, logoSST)
  
  // Télécharger
  const filename = `Grille_SST_${isFI ? 'FI' : 'MAC'}_${trainee.last_name}_${trainee.first_name}.pdf`
  doc.save(filename)
  
  return filename
}

function generatePage1(doc, cert, trainee, session, trainer, isFI, logoINRS, logoSST) {
  const pageWidth = 210
  const margin = 15
  
  // En-tête avec logos
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  
  // Logo INRS (à gauche)
  // doc.addImage(logoINRS, 'PNG', margin, 10, 40, 15)
  doc.text('INRS', margin, 15)
  
  // Titre centré
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 128, 0) // Vert SST
  doc.text('Grille de certification des compétences du SST', pageWidth / 2, 20, { align: 'center' })
  
  doc.setFontSize(14)
  doc.text(isFI ? 'Formation initiale' : 'Maintien et Actualisation des Compétences', pageWidth / 2, 27, { align: 'center' })
  
  // Logo SST (à droite)
  // doc.addImage(logoSST, 'PNG', pageWidth - margin - 30, 10, 30, 30)
  doc.setFontSize(10)
  doc.text('SST', pageWidth - margin - 10, 20, { align: 'right' })
  
  // Informations candidat et session
  let y = 45
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  
  // Encadré candidat
  doc.rect(margin, y, (pageWidth - 2 * margin) / 2 - 2, 25)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 100, 0)
  doc.text('Candidat :', margin + 3, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(`Nom : ${trainee.last_name}`, margin + 3, y + 10)
  doc.text(`Prénom : ${trainee.first_name}`, margin + 3, y + 15)
  doc.text(`Date de naissance : ${trainee.birth_date ? format(new Date(trainee.birth_date), 'dd/MM/yyyy') : ''}`, margin + 3, y + 20)
  
  // Encadré session
  doc.rect(pageWidth / 2 + 2, y, (pageWidth - 2 * margin) / 2 - 2, 25)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 100, 0)
  doc.text('Session :', pageWidth / 2 + 5, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text(`Du : ${format(new Date(session.start_date), 'dd/MM/yyyy')}`, pageWidth / 2 + 5, y + 10)
  doc.text(`Au : ${format(new Date(session.end_date), 'dd/MM/yyyy')}`, pageWidth / 2 + 5, y + 15)
  
  y += 32
  
  // ÉPREUVE 1
  doc.setFillColor(0, 100, 0)
  doc.rect(margin, y, pageWidth - 2 * margin, 15, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(
    isFI 
      ? "EPREUVE 1 : Lors d'une mise en situation d'accident du travail simulée (action / analyse),"
      : "EPREUVE 1 : A partir d'une mise en situation d'accident du travail proposée par le formateur,",
    pageWidth / 2,
    y + 6,
    { align: 'center' }
  )
  doc.text(
    isFI
      ? "le candidat devra montrer sa capacité à mettre en œuvre l'intégralité des compétences"
      : "le candidat devra montrer sa capacité à mettre en œuvre les compétences",
    pageWidth / 2,
    y + 11,
    { align: 'center' }
  )
  
  y += 18
  
  // Tableau des compétences (Épreuve 1)
  const competencesEpreuve1 = isFI 
    ? [
        { code: 'C2', label: 'Identifier les dangers persistants et repérer les personnes...', acquis: cert.c2_acquis },
        { code: 'C3', label: 'Rechercher, suivant un ordre déterminé...', acquis: cert.c3_acquis },
        { code: 'C4', label: 'Garantir une alerte favorisant l\'arrivée de secours...', acquis: cert.c4_acquis },
        { code: 'C5', label: 'Choisir et réaliser l\'action, surveiller...', acquis: cert.c5_acquis },
      ]
    : [
        { code: 'C2', label: 'Supprimer ou isoler le danger...', acquis: cert.c2_acquis },
        { code: 'C3', label: 'Rechercher les signes de vie menacée...', acquis: cert.c3_acquis },
        { code: 'C4', label: 'Garantir une alerte...', acquis: cert.c4_acquis },
        { code: 'C5', label: 'Choisir l\'action et surveiller...', acquis: cert.c5_acquis },
      ]
  
  competencesEpreuve1.forEach((comp, idx) => {
    const rowHeight = 15
    const rowY = y + (idx * rowHeight)
    
    // Bordure
    doc.setDrawColor(0, 0, 0)
    doc.rect(margin, rowY, pageWidth - 2 * margin, rowHeight)
    
    // Code compétence
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(comp.code, margin + 5, rowY + 10)
    
    // Label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(comp.label, margin + 15, rowY + 10, { maxWidth: 120 })
    
    // Case Acquis/Non acquis
    const checkboxX = pageWidth - margin - 25
    doc.rect(checkboxX, rowY + 3, 10, 9)
    doc.text('Acquis', checkboxX + 12, rowY + 10)
    if (comp.acquis) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('✓', checkboxX + 2, rowY + 10)
    }
    
    doc.rect(checkboxX, rowY + 3, 10, 9)
  })
  
  // Footer page 1
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('INRS – Département formation – 65, bd Richard Lenoir – 75011 Paris', pageWidth / 2, 285, { align: 'center' })
  doc.text(isFI ? 'Juin 2020' : 'Juillet 2023', pageWidth / 2, 290, { align: 'center' })
  doc.text('Page 1/2', pageWidth - margin, 290, { align: 'right' })
}

function generatePage2(doc, cert, trainer, isFI, logoINRS, logoSST) {
  const pageWidth = 210
  const margin = 15
  let y = 20
  
  // En-tête page 2
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 128, 0)
  doc.text('Grille de certification des compétences du SST', pageWidth / 2, y, { align: 'center' })
  y += 7
  doc.setFontSize(14)
  doc.text(isFI ? 'Formation initiale' : 'Maintien et Actualisation des Compétences', pageWidth / 2, y, { align: 'center' })
  
  y += 15
  
  // ÉPREUVE 2
  doc.setFillColor(0, 100, 0)
  doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.text(
    isFI
      ? "EPREUVE 2 : Lors d'un entretien avec le formateur, le candidat devra répondre à un questionnement simple"
      : "EPREUVE 2 : Le candidat répondra à un questionnement simple portant sur ses compétences en matière de prévention",
    pageWidth / 2,
    y + 7,
    { align: 'center' }
  )
  
  y += 13
  
  // Compétences Épreuve 2
  const competencesEpreuve2 = isFI 
    ? [
        { code: 'C1', label: 'Délimiter son champ d\'intervention...', acquis: cert.c1_acquis },
        { code: 'C6', label: 'Situer son rôle de SST...', acquis: cert.c6_acquis },
        { code: 'C7', label: 'Caractériser des risques professionnels...', acquis: cert.c7_acquis },
        { code: 'C8', label: 'Participer à la maîtrise des risques...', acquis: cert.c8_acquis },
      ]
    : [
        { code: 'C6', label: 'Situer son rôle de SST...', acquis: cert.c6_acquis },
        { code: 'C7', label: 'Caractériser des risques...', acquis: cert.c7_acquis },
        { code: 'C8', label: 'Participer à la maîtrise...', acquis: cert.c8_acquis },
      ]
  
  competencesEpreuve2.forEach((comp, idx) => {
    const rowHeight = 15
    const rowY = y + (idx * rowHeight)
    
    doc.setDrawColor(0, 0, 0)
    doc.rect(margin, rowY, pageWidth - 2 * margin, rowHeight)
    
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(comp.code, margin + 5, rowY + 10)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(comp.label, margin + 15, rowY + 10, { maxWidth: 120 })
    
    const checkboxX = pageWidth - margin - 25
    doc.rect(checkboxX, rowY + 3, 10, 9)
    doc.text('Acquis', checkboxX + 12, rowY + 10)
    if (comp.acquis) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('✓', checkboxX + 2, rowY + 10)
    }
  })
  
  y += (competencesEpreuve2.length * 15) + 10
  
  // Bloc formateur et résultat
  doc.setDrawColor(0, 0, 0)
  doc.rect(margin, y, (pageWidth - 2 * margin) / 2 - 2, 50)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Formateur / évaluateur :', margin + 3, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.text(`NOM : ${trainer?.last_name || ''}`, margin + 3, y + 14)
  doc.text(`Prénom : ${trainer?.first_name || ''}`, margin + 3, y + 21)
  doc.text('Signature :', margin + 3, y + 28)
  
  // Résultat à droite
  const rightX = pageWidth / 2 + 2
  doc.rect(rightX, y, (pageWidth - 2 * margin) / 2 - 2, 50)
  
  const competencesList = isFI 
    ? ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']
    : ['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']
  
  doc.setFontSize(9)
  competencesList.forEach((code, idx) => {
    const compY = y + 7 + (idx * 5)
    const key = `${code.toLowerCase()}_acquis`
    const acquis = cert[key]
    
    doc.text(`Compétence ${code} :`, rightX + 3, compY)
    doc.rect(rightX + 35, compY - 3, 4, 4)
    if (acquis) doc.text('✓', rightX + 36, compY)
    doc.text('Acquise', rightX + 42, compY)
    
    doc.rect(rightX + 60, compY - 3, 4, 4)
    if (acquis === false) doc.text('✓', rightX + 61, compY)
    doc.text('Non acquise', rightX + 67, compY)
  })
  
  y += 52
  
  // Date et résultat final
  doc.rect(margin, y, pageWidth - 2 * margin, 20)
  doc.setFont('helvetica', 'bold')
  doc.text('Date de certification :', margin + 3, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.text(format(new Date(cert.date_certification), 'dd/MM/yyyy'), margin + 50, y + 7)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Résultat :', margin + 3, y + 15)
  doc.text('Candidat certifié', margin + 25, y + 15)
  
  // Case OUI/NON
  doc.rect(margin + 70, y + 11, 5, 5)
  if (cert.candidat_certifie) doc.text('✓', margin + 71, y + 15)
  doc.text('OUI*', margin + 78, y + 15)
  
  doc.rect(margin + 95, y + 11, 5, 5)
  if (!cert.candidat_certifie) doc.text('✓', margin + 96, y + 15)
  doc.text('NON', margin + 103, y + 15)
  
  // Note
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text(`* : ${isFI ? '8' : '7'} compétences acquises donnent la certification`, margin + 3, y + 25)
  
  // Footer
  doc.setTextColor(100, 100, 100)
  doc.text('INRS – Département formation – 65, bd Richard Lenoir – 75011 Paris', pageWidth / 2, 285, { align: 'center' })
  doc.text(isFI ? 'Juin 2020' : 'Juillet 2023', pageWidth / 2, 290, { align: 'center' })
  doc.text('Page 2/2', pageWidth - margin, 290, { align: 'right' })
}
