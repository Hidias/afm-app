import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// Informations de l'organisme de formation
const ORG_INFO = {
  name: 'SARL Access Formation',
  siret: '943 563 866 00012',
  nda: '53 29 10412 29',
  address: '22 rue de Concarneau',
  city: '29900 Concarneau',
  phone: '02 46 56 57 54',
  email: 'contact@accessformation.pro',
  website: 'www.accessformation.pro',
  dirigeant: 'Hicham SAÏDI',
}

// Fonction utilitaire pour formater les dates
const formatDate = (date) => {
  if (!date) return ''
  return format(new Date(date), 'd MMMM yyyy', { locale: fr })
}

const formatDateShort = (date) => {
  if (!date) return ''
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr })
}

// ============================================================
// CONVENTION DE FORMATION PROFESSIONNELLE
// ============================================================
export function generateConvention(session, client, trainees, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20
  
  // En-tête avec logo fictif
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(ORG_INFO.name, 20, y)
  doc.text(`SIRET : ${ORG_INFO.siret}`, 20, y + 5)
  doc.text(`N° DA : ${ORG_INFO.nda}`, 20, y + 10)
  
  y = 45
  
  // Titre
  doc.setFontSize(16)
  doc.setTextColor(0)
  doc.setFont(undefined, 'bold')
  doc.text('CONVENTION DE FORMATION PROFESSIONNELLE', pageWidth / 2, y, { align: 'center' })
  
  y += 8
  doc.setFontSize(9)
  doc.setFont(undefined, 'normal')
  doc.text('Conformément aux articles L6353-1 à L6353-9 et D6313-3-1 du Code du travail', pageWidth / 2, y, { align: 'center' })
  
  y += 15
  
  // Entre les soussignés
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.text('ENTRE LES SOUSSIGNÉS', 20, y)
  
  y += 10
  doc.setFont(undefined, 'normal')
  doc.setFontSize(10)
  
  // Organisme de formation
  doc.setFont(undefined, 'bold')
  doc.text("L'Organisme de formation :", 20, y)
  doc.setFont(undefined, 'normal')
  y += 6
  doc.text(`${ORG_INFO.name}`, 25, y)
  y += 5
  doc.text(`SIRET : ${ORG_INFO.siret}`, 25, y)
  y += 5
  doc.text(`Déclaration d'activité (NDA) : ${ORG_INFO.nda}`, 25, y)
  y += 5
  doc.text(`Adresse : ${ORG_INFO.address}, ${ORG_INFO.city}`, 25, y)
  y += 5
  doc.text(`Représenté par : ${ORG_INFO.dirigeant}`, 25, y)
  y += 5
  doc.text('Ci-après dénommé « l\'Organisme »', 25, y)
  
  y += 12
  doc.setFont(undefined, 'bold')
  doc.text('ET', pageWidth / 2, y, { align: 'center' })
  
  y += 10
  doc.text("L'entreprise bénéficiaire :", 20, y)
  doc.setFont(undefined, 'normal')
  y += 6
  doc.text(`Raison sociale : ${client.name}`, 25, y)
  y += 5
  doc.text(`Adresse : ${client.address || ''}, ${client.postal_code || ''} ${client.city || ''}`, 25, y)
  y += 5
  if (client.siret) {
    doc.text(`SIRET : ${client.siret}`, 25, y)
    y += 5
  }
  doc.text('Ci-après dénommée « le Bénéficiaire »', 25, y)
  
  y += 15
  
  // Article 1 - Objet
  doc.setFont(undefined, 'bold')
  doc.text('Article 1 – Objet, durée et effectif de la formation', 20, y)
  doc.setFont(undefined, 'normal')
  y += 8
  
  doc.text('Le Bénéficiaire souhaite faire participer une partie de son personnel à la formation suivante :', 20, y)
  y += 8
  
  doc.text(`Intitulé : ${session.courses?.title || 'Formation'}`, 25, y)
  y += 5
  doc.text(`Type d'action : Action de formation`, 25, y)
  y += 5
  
  const objectives = session.courses?.objectives || 'À définir'
  const objectivesLines = doc.splitTextToSize(`Objectif(s) : ${objectives}`, 160)
  doc.text(objectivesLines, 25, y)
  y += objectivesLines.length * 5 + 3
  
  doc.text(`Durée : ${session.courses?.duration_hours || 0} heures`, 25, y)
  y += 5
  doc.text(`Dates : du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 25, y)
  y += 5
  doc.text(`Horaires : ${session.start_time || '09:00'} - ${session.end_time || '17:00'}`, 25, y)
  y += 5
  doc.text(`Lieu : ${session.location || 'À définir'}`, 25, y)
  y += 5
  doc.text(`Effectif : ${trainees.length} participant(s)`, 25, y)
  y += 5
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 25, y)
  
  y += 10
  
  // Liste des stagiaires
  if (trainees.length > 0) {
    doc.text('Liste des apprenants désignés par le Bénéficiaire :', 25, y)
    y += 6
    trainees.forEach((t, i) => {
      doc.text(`${i + 1}. ${t.last_name?.toUpperCase() || ''} ${t.first_name || ''}`, 30, y)
      y += 5
    })
  }
  
  // Vérifier si on doit passer à une nouvelle page
  if (y > 230) {
    doc.addPage()
    y = 20
  }
  
  y += 10
  
  // Article 2 - Prix
  doc.setFont(undefined, 'bold')
  doc.text('Article 2 – Prix de la formation', 20, y)
  doc.setFont(undefined, 'normal')
  y += 8
  doc.text(`Le coût total de la formation est fixé à : ________ € HT`, 25, y)
  y += 5
  doc.text(`Soit ________ € TTC (TVA non applicable, article 261.4.4°a du CGI)`, 25, y)
  
  y += 15
  
  // Article 3 - Modalités
  doc.setFont(undefined, 'bold')
  doc.text('Article 3 – Modalités de règlement', 20, y)
  doc.setFont(undefined, 'normal')
  y += 8
  doc.text('Le règlement sera effectué à réception de la facture, à l\'issue de la formation.', 25, y)
  
  y += 15
  
  // Article 4 - Dédit
  doc.setFont(undefined, 'bold')
  doc.text('Article 4 – Clause de dédit ou d\'annulation', 20, y)
  doc.setFont(undefined, 'normal')
  y += 8
  const deditText = 'En cas d\'annulation par le Bénéficiaire moins de 10 jours ouvrés avant le début de la formation, l\'Organisme facturera une indemnité de 30% du prix de la formation.'
  const deditLines = doc.splitTextToSize(deditText, 165)
  doc.text(deditLines, 25, y)
  
  // Nouvelle page pour les signatures
  doc.addPage()
  y = 20
  
  // Article 5 - Obligations
  doc.setFont(undefined, 'bold')
  doc.text('Article 5 – Obligations des parties', 20, y)
  doc.setFont(undefined, 'normal')
  y += 8
  doc.text("L'Organisme s'engage à :", 25, y)
  y += 5
  doc.text('• Dispenser la formation conformément au programme annexé', 30, y)
  y += 5
  doc.text('• Fournir les moyens pédagogiques et techniques nécessaires', 30, y)
  y += 5
  doc.text('• Remettre une attestation de fin de formation', 30, y)
  
  y += 10
  doc.text('Le Bénéficiaire s\'engage à :', 25, y)
  y += 5
  doc.text('• Assurer la présence du ou des participants', 30, y)
  y += 5
  doc.text('• Régler le prix de la formation selon les modalités convenues', 30, y)
  
  y += 20
  
  // Signatures
  doc.setFont(undefined, 'bold')
  doc.text(`Fait en deux exemplaires, à ${ORG_INFO.city.split(' ')[1] || 'Concarneau'}, le ${formatDateShort(new Date())}`, 20, y)
  
  y += 20
  
  // Zone signatures côte à côte
  doc.text('Pour l\'Organisme de formation', 30, y)
  doc.text('Pour le Bénéficiaire', 130, y)
  
  y += 5
  doc.setFont(undefined, 'normal')
  doc.text(ORG_INFO.dirigeant, 30, y)
  doc.text('(Nom, fonction, cachet et signature)', 130, y)
  
  y += 25
  doc.text('Signature :', 30, y)
  doc.text('Signature :', 130, y)
  
  // Cadres pour signatures
  doc.rect(30, y + 5, 60, 30)
  doc.rect(130, y + 5, 60, 30)
  
  return doc
}

// ============================================================
// CONVOCATION À LA FORMATION
// ============================================================
export function generateConvocation(session, trainee, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20
  
  // En-tête
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(ORG_INFO.name, 20, y)
  doc.text(ORG_INFO.address, 20, y + 4)
  doc.text(ORG_INFO.city, 20, y + 8)
  doc.text(`Tél : ${ORG_INFO.phone}`, 20, y + 12)
  
  // Date en haut à droite
  doc.text(`Concarneau, le ${formatDateShort(new Date())}`, pageWidth - 60, y)
  
  y = 50
  
  // Destinataire
  doc.setTextColor(0)
  doc.setFontSize(11)
  doc.text(`${trainee.first_name} ${trainee.last_name}`, pageWidth - 70, y)
  if (trainee.email) {
    doc.text(trainee.email, pageWidth - 70, y + 5)
  }
  
  y = 80
  
  // Titre
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('CONVOCATION À LA FORMATION', pageWidth / 2, y, { align: 'center' })
  
  y += 20
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  doc.text(`Madame, Monsieur ${trainee.last_name},`, 20, y)
  
  y += 10
  doc.text('Nous avons le plaisir de vous confirmer votre inscription à la formation suivante :', 20, y)
  
  y += 15
  
  // Détails de la formation
  doc.setFillColor(245, 245, 245)
  doc.rect(20, y - 5, 170, 60, 'F')
  
  doc.setFont(undefined, 'bold')
  doc.text('Intitulé de la formation :', 25, y)
  doc.setFont(undefined, 'normal')
  doc.text(session.courses?.title || 'Formation', 80, y)
  
  y += 8
  doc.setFont(undefined, 'bold')
  doc.text('Dates :', 25, y)
  doc.setFont(undefined, 'normal')
  doc.text(`Du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 80, y)
  
  y += 8
  doc.setFont(undefined, 'bold')
  doc.text('Horaires :', 25, y)
  doc.setFont(undefined, 'normal')
  doc.text(`${session.start_time || '09:00'} - ${session.end_time || '17:00'}`, 80, y)
  
  y += 8
  doc.setFont(undefined, 'bold')
  doc.text('Durée totale :', 25, y)
  doc.setFont(undefined, 'normal')
  doc.text(`${session.courses?.duration_hours || 0} heures`, 80, y)
  
  y += 8
  doc.setFont(undefined, 'bold')
  doc.text('Lieu :', 25, y)
  doc.setFont(undefined, 'normal')
  doc.text(session.location || 'À définir', 80, y)
  
  y += 8
  doc.setFont(undefined, 'bold')
  doc.text('Formateur :', 25, y)
  doc.setFont(undefined, 'normal')
  doc.text(`${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 80, y)
  
  y += 20
  
  // Instructions
  doc.setFont(undefined, 'bold')
  doc.text('Informations pratiques :', 20, y)
  doc.setFont(undefined, 'normal')
  y += 8
  doc.text('• Merci de vous munir d\'une tenue adaptée et du matériel indiqué par le formateur', 25, y)
  y += 6
  doc.text('• En cas d\'empêchement, veuillez nous prévenir au plus tôt', 25, y)
  
  y += 15
  
  // Accessibilité
  doc.setFont(undefined, 'bold')
  doc.text('Accessibilité :', 20, y)
  doc.setFont(undefined, 'normal')
  y += 6
  const accessText = 'En cas de besoins spécifiques (mobilité, auditif, visuel...), merci de nous en informer afin que nous puissions adapter les conditions de la formation.'
  const accessLines = doc.splitTextToSize(accessText, 165)
  doc.text(accessLines, 20, y)
  
  y += accessLines.length * 6 + 10
  
  // Contact
  doc.setFont(undefined, 'bold')
  doc.text('Contact :', 20, y)
  doc.setFont(undefined, 'normal')
  y += 6
  doc.text(`Pour toute question, contactez-nous au ${ORG_INFO.phone} ou par mail à ${ORG_INFO.email}`, 20, y)
  
  y += 20
  doc.text('Nous vous remercions pour votre ponctualité et votre participation active.', 20, y)
  
  y += 20
  doc.text('Cordialement,', 20, y)
  
  y += 15
  doc.setFont(undefined, 'bold')
  doc.text(ORG_INFO.dirigeant, 20, y)
  doc.setFont(undefined, 'normal')
  doc.text('Dirigeant Access Formation', 20, y + 5)
  
  return doc
}

// ============================================================
// FEUILLE D'ÉMARGEMENT
// ============================================================
export function generateEmargement(session, trainees, trainer, attendances = []) {
  const doc = new jsPDF('landscape')
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 15
  
  // En-tête
  doc.setFontSize(10)
  doc.text(ORG_INFO.name, 15, y)
  doc.text(`N° DA : ${ORG_INFO.nda}`, pageWidth - 60, y)
  
  y = 25
  
  // Titre
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text('FEUILLE D\'ÉMARGEMENT', pageWidth / 2, y, { align: 'center' })
  
  y = 35
  
  // Infos formation
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Intitulé de la formation : ${session.courses?.title || 'Formation'}`, 15, y)
  y += 6
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 15, y)
  doc.text(`Dates : du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 150, y)
  y += 6
  doc.text(`Lieu : ${session.location || 'À définir'}`, 15, y)
  doc.text(`Effectif prévu : ${trainees.length} participants`, 150, y)
  
  y += 10
  
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Rappel : Chaque demi-journée doit être signée par le stagiaire et le formateur.', 15, y)
  doc.setTextColor(0)
  
  y += 8
  
  // Calculer les jours de formation
  const startDate = new Date(session.start_date)
  const endDate = new Date(session.end_date)
  const days = []
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  
  // Tableau d'émargement
  const headers = [
    { content: 'N°', styles: { halign: 'center', cellWidth: 10 } },
    { content: 'NOM Prénom', styles: { cellWidth: 50 } },
  ]
  
  // Ajouter les colonnes pour chaque jour (matin + après-midi)
  days.slice(0, 4).forEach((day, i) => { // Max 4 jours en paysage
    headers.push({ content: `${format(day, 'dd/MM')}\nMatin`, styles: { halign: 'center' } })
    headers.push({ content: `${format(day, 'dd/MM')}\nAprès-midi`, styles: { halign: 'center' } })
  })
  
  const rows = trainees.map((t, i) => {
    const row = [
      { content: String(i + 1), styles: { halign: 'center' } },
      `${t.last_name?.toUpperCase() || ''} ${t.first_name || ''}`,
    ]
    
    days.slice(0, 4).forEach(day => {
      // Vérifier si signé le matin
      const amSigned = attendances.some(a => 
        a.trainee_id === t.id && 
        a.date === format(day, 'yyyy-MM-dd') && 
        (a.period === 'am' || a.period === 'full')
      )
      // Vérifier si signé l'après-midi
      const pmSigned = attendances.some(a => 
        a.trainee_id === t.id && 
        a.date === format(day, 'yyyy-MM-dd') && 
        (a.period === 'pm' || a.period === 'full')
      )
      
      row.push({ content: amSigned ? '✓' : '', styles: { halign: 'center' } })
      row.push({ content: pmSigned ? '✓' : '', styles: { halign: 'center' } })
    })
    
    return row
  })
  
  // Ajouter une ligne pour le formateur
  const trainerRow = [
    '',
    { content: `Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, styles: { fontStyle: 'bold' } },
  ]
  days.slice(0, 4).forEach(() => {
    trainerRow.push('')
    trainerRow.push('')
  })
  rows.push(trainerRow)
  
  doc.autoTable({
    startY: y,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 50 },
    },
  })
  
  // Pied de page
  const finalY = doc.autoTable.previous.finalY + 10
  doc.setFontSize(8)
  doc.text('La feuille d\'émargement est à conserver par l\'organisme de formation conformément aux obligations légales.', 15, finalY)
  
  return doc
}

// ============================================================
// ATTESTATION DE PRÉSENCE
// ============================================================
export function generateAttestation(session, trainee, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20
  
  // En-tête
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(ORG_INFO.name, 20, y)
  doc.text(`SIRET : ${ORG_INFO.siret}`, 20, y + 5)
  doc.text(`N° DA : ${ORG_INFO.nda}`, 20, y + 10)
  
  y = 50
  
  // Titre
  doc.setFontSize(18)
  doc.setTextColor(0)
  doc.setFont(undefined, 'bold')
  doc.text('ATTESTATION DE PRÉSENCE', pageWidth / 2, y, { align: 'center' })
  
  y = 80
  
  // Corps
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  
  doc.text(`Je soussigné, ${ORG_INFO.dirigeant}, représentant l'organisme de formation ${ORG_INFO.name}, atteste que :`, 20, y)
  
  y += 20
  
  // Nom du stagiaire en gras
  doc.setFont(undefined, 'bold')
  doc.setFontSize(13)
  doc.text(`${trainee.first_name} ${trainee.last_name}`, pageWidth / 2, y, { align: 'center' })
  
  y += 15
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  doc.text('A participé à la formation intitulée :', 20, y)
  
  y += 10
  doc.setFont(undefined, 'bold')
  doc.text(session.courses?.title || 'Formation', pageWidth / 2, y, { align: 'center' })
  
  y += 20
  doc.setFont(undefined, 'normal')
  
  // Tableau des informations
  const infos = [
    ['Dates', `Du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`],
    ['Durée totale', `${session.courses?.duration_hours || 0} heures`],
    ['Lieu', session.location || 'À définir'],
    ['Formateur', `${trainer?.first_name || ''} ${trainer?.last_name || ''}`],
    ['Horaires', `${session.start_time || '09:00'} - ${session.end_time || '17:00'}`],
  ]
  
  infos.forEach(([label, value]) => {
    doc.setFont(undefined, 'bold')
    doc.text(`${label} :`, 40, y)
    doc.setFont(undefined, 'normal')
    doc.text(value, 90, y)
    y += 8
  })
  
  y += 20
  
  doc.text('Fait pour servir et valoir ce que de droit.', 20, y)
  
  y += 30
  
  // Signature
  doc.text(`Fait à Concarneau, le ${formatDateShort(new Date())}`, 20, y)
  
  y += 15
  doc.text('Pour Access Formation', 20, y)
  y += 8
  doc.setFont(undefined, 'bold')
  doc.text(ORG_INFO.dirigeant, 20, y)
  
  // Zone signature
  doc.rect(20, y + 5, 60, 25)
  doc.setFontSize(8)
  doc.setFont(undefined, 'normal')
  doc.text('Signature et cachet', 35, y + 35)
  
  return doc
}

// ============================================================
// CERTIFICAT DE RÉALISATION
// ============================================================
export function generateCertificat(session, trainee, client, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20
  
  // En-tête
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(ORG_INFO.name, 20, y)
  doc.text(`SIRET : ${ORG_INFO.siret} - N° DA : ${ORG_INFO.nda}`, 20, y + 5)
  
  y = 45
  
  // Titre
  doc.setFontSize(18)
  doc.setTextColor(0)
  doc.setFont(undefined, 'bold')
  doc.text('CERTIFICAT DE RÉALISATION', pageWidth / 2, y, { align: 'center' })
  
  y = 65
  
  // Corps
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  
  const introText = `Je soussigné, ${ORG_INFO.dirigeant}, représentant légal du dispensateur de l'action concourant au développement des compétences ${ORG_INFO.name},`
  const introLines = doc.splitTextToSize(introText, 170)
  doc.text(introLines, 20, y)
  y += introLines.length * 6 + 10
  
  doc.setFont(undefined, 'bold')
  doc.text('Atteste que :', 20, y)
  
  y += 15
  
  // Encadré stagiaire
  doc.setFillColor(245, 245, 245)
  doc.rect(20, y - 5, 170, 25, 'F')
  
  doc.setFont(undefined, 'bold')
  doc.setFontSize(12)
  doc.text(`${trainee.first_name} ${trainee.last_name}`, pageWidth / 2, y + 3, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Salarié(e) de l'entreprise : ${client?.name || ''}`, pageWidth / 2, y + 12, { align: 'center' })
  
  y += 35
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.text('A suivi l\'action :', 20, y)
  y += 10
  
  // Type d'action
  doc.setFont(undefined, 'normal')
  doc.text('Nature de l\'action concourant au développement des compétences :', 20, y)
  y += 6
  doc.setFont(undefined, 'bold')
  doc.text('☑ Action de formation', 25, y)
  
  y += 15
  
  doc.setFont(undefined, 'bold')
  doc.text(session.courses?.title || 'Formation', pageWidth / 2, y, { align: 'center' })
  
  y += 15
  
  doc.setFont(undefined, 'normal')
  doc.text(`Qui s'est déroulée du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 20, y)
  y += 8
  doc.text(`Pour une durée de ${session.courses?.duration_hours || 0} heures.`, 20, y)
  
  y += 20
  
  // Engagement
  const engagementText = 'Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m\'engage à conserver l\'ensemble des pièces justificatives qui ont permis d\'établir le présent certificat pendant une durée de 3 ans à compter de la fin de l\'année du dernier paiement.'
  const engagementLines = doc.splitTextToSize(engagementText, 170)
  doc.setFontSize(9)
  doc.text(engagementLines, 20, y)
  
  y += engagementLines.length * 5 + 20
  
  // Signature
  doc.setFontSize(11)
  doc.text(`Fait à : Concarneau`, 20, y)
  y += 6
  doc.text(`Le : ${formatDateShort(new Date())}`, 20, y)
  
  y += 15
  
  doc.text('Cachet et signature du responsable du dispensateur de formation :', 20, y)
  y += 10
  doc.setFont(undefined, 'bold')
  doc.text(`${ORG_INFO.dirigeant}, Dirigeant Access Formation`, 20, y)
  
  // Zone signature
  doc.rect(20, y + 5, 60, 30)
  
  return doc
}

// ============================================================
// PROGRAMME DE FORMATION
// ============================================================
export function generateProgramme(course, session, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20
  
  // En-tête
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(ORG_INFO.name, 20, y)
  doc.text(`N° DA : ${ORG_INFO.nda}`, pageWidth - 50, y)
  
  y = 35
  
  // Titre
  doc.setFontSize(14)
  doc.setTextColor(0)
  doc.setFont(undefined, 'bold')
  doc.text('PROGRAMME DE FORMATION', pageWidth / 2, y, { align: 'center' })
  
  y += 10
  doc.setFontSize(16)
  doc.text(course.title || 'Formation', pageWidth / 2, y, { align: 'center' })
  
  y += 20
  
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  
  // Objectifs
  if (course.objectives) {
    doc.setFont(undefined, 'bold')
    doc.text('Objectifs de la formation', 20, y)
    doc.setFont(undefined, 'normal')
    y += 6
    const objLines = doc.splitTextToSize(course.objectives, 170)
    doc.text(objLines, 20, y)
    y += objLines.length * 5 + 10
  }
  
  // Public et prérequis
  doc.setFont(undefined, 'bold')
  doc.text('Public concerné et prérequis', 20, y)
  doc.setFont(undefined, 'normal')
  y += 6
  doc.text(`Public : ${course.target_audience || 'Tout public'}`, 20, y)
  y += 5
  doc.text(`Prérequis : ${course.prerequisites || 'Aucun'}`, 20, y)
  
  y += 15
  
  // Durée et lieu
  doc.setFont(undefined, 'bold')
  doc.text('Durée, lieu et formateur', 20, y)
  doc.setFont(undefined, 'normal')
  y += 6
  doc.text(`Durée : ${course.duration_hours} heures`, 20, y)
  y += 5
  if (session) {
    doc.text(`Lieu : ${session.location || 'À définir'}`, 20, y)
    y += 5
  }
  if (trainer) {
    doc.text(`Formateur : ${trainer.first_name} ${trainer.last_name}`, 20, y)
    y += 5
  }
  
  y += 10
  
  // Programme / Contenu
  if (course.program) {
    doc.setFont(undefined, 'bold')
    doc.text('Contenu de la formation', 20, y)
    doc.setFont(undefined, 'normal')
    y += 6
    const progLines = doc.splitTextToSize(course.program, 170)
    doc.text(progLines, 20, y)
    y += progLines.length * 5 + 10
  }
  
  // Moyens pédagogiques
  doc.setFont(undefined, 'bold')
  doc.text('Moyens pédagogiques et techniques', 20, y)
  doc.setFont(undefined, 'normal')
  y += 6
  doc.text('Formation en présentiel basée sur des méthodes actives : mises en situation,', 20, y)
  y += 5
  doc.text('démonstrations, études de cas, exercices pratiques.', 20, y)
  
  y += 15
  
  // Évaluation
  doc.setFont(undefined, 'bold')
  doc.text('Modalités d\'évaluation', 20, y)
  doc.setFont(undefined, 'normal')
  y += 6
  doc.text('Évaluation continue durant la formation. Remise d\'une attestation de fin de formation.', 20, y)
  
  y += 15
  
  // Accessibilité
  doc.setFont(undefined, 'bold')
  doc.text('Accessibilité aux personnes en situation de handicap', 20, y)
  doc.setFont(undefined, 'normal')
  y += 6
  const accessText = 'Access Formation adapte ses dispositifs aux besoins spécifiques des stagiaires. Merci de signaler toute situation particulière.'
  const accessLines = doc.splitTextToSize(accessText, 170)
  doc.text(accessLines, 20, y)
  
  // Pied de page
  y = 270
  doc.setFontSize(9)
  doc.text(`Fait à Concarneau, le ${formatDateShort(new Date())}`, 20, y)
  y += 5
  doc.setFont(undefined, 'bold')
  doc.text(`${ORG_INFO.dirigeant} – Gérant`, 20, y)
  
  return doc
}

// ============================================================
// FICHE ÉVALUATION SATISFACTION
// ============================================================
export function generateEvaluationSatisfaction(session, trainee, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 15
  
  // En-tête
  doc.setFontSize(10)
  doc.text(ORG_INFO.name, 20, y)
  
  y = 25
  
  // Titre
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text('FICHE D\'ÉVALUATION DE SATISFACTION STAGIAIRE', pageWidth / 2, y, { align: 'center' })
  
  y = 40
  
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text('Merci de prendre quelques instants pour évaluer cette formation.', 20, y)
  doc.text('Votre avis contribue à l\'amélioration continue de nos prestations.', 20, y + 5)
  
  y = 55
  
  // Infos formation
  doc.setFillColor(245, 245, 245)
  doc.rect(20, y, 170, 20, 'F')
  doc.text(`Formation : ${session.courses?.title || 'Formation'}`, 25, y + 7)
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 25, y + 14)
  doc.text(`Dates : du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 120, y + 7)
  
  y = 85
  
  // Légende
  doc.setFontSize(9)
  doc.text('1 = Non satisfait | 2 = Peu satisfait | 3 = Moyennement satisfait | 4 = Satisfait | 5 = Très satisfait', 20, y)
  
  y = 95
  
  // Questions
  const questions = [
    'Les objectifs de la formation étaient-ils clairs ?',
    'Le contenu était-il adapté à vos attentes ?',
    'Les méthodes pédagogiques étaient-elles adaptées ?',
    'Le formateur maîtrisait-il le sujet ?',
    'La documentation fournie était-elle de qualité ?',
    'L\'organisation matérielle était-elle satisfaisante ?',
    'La durée de la formation était-elle adaptée ?',
    'Recommanderiez-vous cette formation ?',
  ]
  
  // Tableau d'évaluation
  const tableData = questions.map(q => [q, '☐', '☐', '☐', '☐', '☐'])
  
  doc.autoTable({
    startY: y,
    head: [['Critères', '1', '2', '3', '4', '5']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [66, 139, 202], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 10, halign: 'center' },
    },
  })
  
  y = doc.autoTable.previous.finalY + 15
  
  // Commentaires
  doc.setFont(undefined, 'bold')
  doc.text('Commentaires / Suggestions :', 20, y)
  doc.setFont(undefined, 'normal')
  y += 5
  doc.rect(20, y, 170, 30)
  
  y += 40
  
  // Recommandation
  doc.text('Souhaitez-vous recommander cette formation ?   ☐ Oui    ☐ Non', 20, y)
  
  y += 15
  
  // Signature
  doc.text(`Nom du stagiaire : ${trainee?.first_name || ''} ${trainee?.last_name || ''}`, 20, y)
  y += 10
  doc.text('Signature : __________________________', 20, y)
  
  y += 20
  doc.setFontSize(9)
  doc.text('Merci pour votre participation !', pageWidth / 2, y, { align: 'center' })
  
  return doc
}

// ============================================================
// FONCTION PRINCIPALE - Télécharger un document
// ============================================================
export function downloadDocument(docType, session, options = {}) {
  const { trainees = [], trainee = null, client = null, trainer = null, course = null, attendances = [] } = options
  
  let doc
  let filename
  
  switch (docType) {
    case 'convention':
      doc = generateConvention(session, client || session.clients, trainees, trainer)
      filename = `Convention_${session.reference}.pdf`
      break
      
    case 'convocation':
      if (!trainee) throw new Error('Trainee required for convocation')
      doc = generateConvocation(session, trainee, trainer)
      filename = `Convocation_${trainee.last_name}_${session.reference}.pdf`
      break
      
    case 'emargement':
      doc = generateEmargement(session, trainees, trainer, attendances)
      filename = `Emargement_${session.reference}.pdf`
      break
      
    case 'attestation':
      if (!trainee) throw new Error('Trainee required for attestation')
      doc = generateAttestation(session, trainee, trainer)
      filename = `Attestation_${trainee.last_name}_${session.reference}.pdf`
      break
      
    case 'certificat':
      if (!trainee) throw new Error('Trainee required for certificat')
      doc = generateCertificat(session, trainee, client || session.clients, trainer)
      filename = `Certificat_${trainee.last_name}_${session.reference}.pdf`
      break
      
    case 'programme':
      doc = generateProgramme(course || session.courses, session, trainer)
      filename = `Programme_${course?.code || session?.reference || 'formation'}.pdf`
      break
      
    case 'evaluation':
      doc = generateEvaluationSatisfaction(session, trainee, trainer)
      filename = `Evaluation_${trainee?.last_name || ''}_${session.reference}.pdf`
      break
      
    default:
      throw new Error(`Unknown document type: ${docType}`)
  }
  
  doc.save(filename)
  return filename
}

// Export pour générer sans télécharger (preview)
export function generateDocumentBlob(docType, session, options = {}) {
  const { trainees = [], trainee = null, client = null, trainer = null, course = null, attendances = [] } = options
  
  let doc
  
  switch (docType) {
    case 'convention':
      doc = generateConvention(session, client || session.clients, trainees, trainer)
      break
    case 'convocation':
      doc = generateConvocation(session, trainee, trainer)
      break
    case 'emargement':
      doc = generateEmargement(session, trainees, trainer, attendances)
      break
    case 'attestation':
      doc = generateAttestation(session, trainee, trainer)
      break
    case 'certificat':
      doc = generateCertificat(session, trainee, client || session.clients, trainer)
      break
    case 'programme':
      doc = generateProgramme(course || session.courses, session, trainer)
      break
    case 'evaluation':
      doc = generateEvaluationSatisfaction(session, trainee, trainer)
      break
    default:
      throw new Error(`Unknown document type: ${docType}`)
  }
  
  return doc.output('blob')
}
