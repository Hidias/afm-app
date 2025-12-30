import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ============================================================
// INFORMATIONS ORGANISME DE FORMATION - CORRIGÉES
// ============================================================
const ORG_INFO = {
  name: 'SARL ACCESS FORMATION',
  address: '24 Rue Kerbleiz',
  city: '29900 Concarneau',
  phone: '02 46 56 57 54',
  email: 'contact@accessformation.pro',
  siret: '943 563 866 00012',
  ape: '85.59A',
  tva: 'FR71943563866',
  nda: '53 29 10412 29',
  dirigeant: 'Hicham SAÏDI',
}

// ============================================================
// IMAGES EN BASE64 (Logo et Tampon) - Chargées dynamiquement
// ============================================================
let LOGO_BASE64 = null
let STAMP_BASE64 = null

export async function loadImages() {
  try {
    const logoResponse = await fetch('/assets/logo.png')
    if (logoResponse.ok) {
      const logoBlob = await logoResponse.blob()
      LOGO_BASE64 = await blobToBase64(logoBlob)
    }
    
    const stampResponse = await fetch('/assets/stamp.png')
    if (stampResponse.ok) {
      const stampBlob = await stampResponse.blob()
      STAMP_BASE64 = await blobToBase64(stampBlob)
    }
  } catch (e) {
    console.warn('Could not load images:', e)
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Permet de charger les images depuis des URLs externes (Supabase Storage)
export function setImages(logoUrl, stampUrl) {
  if (logoUrl) LOGO_BASE64 = logoUrl
  if (stampUrl) STAMP_BASE64 = stampUrl
}

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================
const formatDate = (date) => {
  if (!date) return ''
  return format(new Date(date), 'd MMMM yyyy', { locale: fr })
}

const formatDateShort = (date) => {
  if (!date) return ''
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr })
}

function addHeader(doc, y = 15) {
  const pageWidth = doc.internal.pageSize.getWidth()
  
  if (LOGO_BASE64) {
    try {
      doc.addImage(LOGO_BASE64, 'PNG', 15, 10, 40, 40)
    } catch (e) {
      console.warn('Could not add logo:', e)
    }
  }
  
  const startX = LOGO_BASE64 ? 60 : 15
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  doc.text(ORG_INFO.name, startX, y)
  
  doc.setFont(undefined, 'normal')
  doc.setFontSize(9)
  doc.text(ORG_INFO.address + ', ' + ORG_INFO.city, startX, y + 5)
  doc.text('Tél : ' + ORG_INFO.phone, startX, y + 10)
  doc.text('Email : ' + ORG_INFO.email, startX, y + 15)
  doc.text('SIRET : ' + ORG_INFO.siret + ' / APE : ' + ORG_INFO.ape, startX, y + 20)
  doc.text('N° Déclaration d\'activité : ' + ORG_INFO.nda, startX, y + 25)
  
  return y + 35
}

function addStampSignature(doc, y) {
  if (STAMP_BASE64) {
    try {
      doc.addImage(STAMP_BASE64, 'PNG', 20, y, 60, 35)
    } catch (e) {
      console.warn('Could not add stamp:', e)
    }
  } else {
    doc.setFontSize(9)
    doc.text('Cachet et signature :', 20, y)
    doc.rect(20, y + 5, 60, 30)
  }
  return y + 40
}

// ============================================================
// CONVENTION DE FORMATION PROFESSIONNELLE
// ============================================================
export function generateConvention(session, client, trainees, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = addHeader(doc)
  
  y += 10
  
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text('CONVENTION DE FORMATION PROFESSIONNELLE', pageWidth / 2, y, { align: 'center' })
  
  y += 6
  doc.setFontSize(9)
  doc.setFont(undefined, 'italic')
  doc.text('Conformément aux articles L6353-1 à L6353-9 et D6313-3-1 du Code du travail', pageWidth / 2, y, { align: 'center' })
  
  y += 15
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.text('ENTRE LES SOUSSIGNÉS', 20, y)
  
  y += 10
  doc.setFontSize(10)
  doc.text("L'Organisme de formation :", 20, y)
  doc.setFont(undefined, 'normal')
  y += 6
  doc.text(`${ORG_INFO.name}`, 25, y)
  y += 5
  doc.text(`Adresse : ${ORG_INFO.address}, ${ORG_INFO.city}`, 25, y)
  y += 5
  doc.text(`SIRET : ${ORG_INFO.siret} - N° DA : ${ORG_INFO.nda}`, 25, y)
  y += 5
  doc.text(`Représenté par : ${ORG_INFO.dirigeant}, en qualité de Gérant`, 25, y)
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
  
  doc.setFont(undefined, 'bold')
  doc.text('Article 1 – Objet, durée et effectif de la formation', 20, y)
  doc.setFont(undefined, 'normal')
  y += 8
  
  doc.text('Le Bénéficiaire souhaite faire participer une partie de son personnel à la formation suivante :', 20, y)
  y += 10
  
  const formationInfos = [
    ['Intitulé', session.courses?.title || 'Formation'],
    ['Type d\'action', 'Action de formation'],
    ['Durée', `${session.courses?.duration_hours || 0} heures`],
    ['Dates', `Du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`],
    ['Horaires', `${session.start_time || '09:00'} - ${session.end_time || '17:00'}`],
    ['Lieu', session.location || 'À définir'],
    ['Effectif', `${trainees.length} participant(s)`],
    ['Formateur', `${trainer?.first_name || ''} ${trainer?.last_name || ''}`],
  ]
  
  doc.autoTable({
    startY: y,
    body: formationInfos,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { cellWidth: 130 },
    },
  })
  
  y = doc.autoTable.previous.finalY + 10
  
  if (session.courses?.objectives) {
    doc.setFont(undefined, 'bold')
    doc.text('Objectifs :', 20, y)
    doc.setFont(undefined, 'normal')
    y += 5
    const objLines = doc.splitTextToSize(session.courses.objectives, 165)
    doc.text(objLines, 25, y)
    y += objLines.length * 5 + 5
  }
  
  if (trainees.length > 0) {
    doc.setFont(undefined, 'bold')
    doc.text('Liste des apprenants désignés par le Bénéficiaire :', 20, y)
    doc.setFont(undefined, 'normal')
    y += 6
    trainees.forEach((t, i) => {
      doc.text(`${i + 1}. ${t.last_name?.toUpperCase() || ''} ${t.first_name || ''}`, 30, y)
      y += 5
      if (y > 260) {
        doc.addPage()
        y = 20
      }
    })
  }
  
  doc.addPage()
  y = 20
  
  doc.setFont(undefined, 'bold')
  doc.text('Article 2 – Prix de la formation', 20, y)
  doc.setFont(undefined, 'normal')
  y += 8
  doc.text(`Le coût total de la formation est fixé à : ____________ € HT`, 25, y)
  y += 6
  doc.text(`Soit ____________ € TTC (TVA non applicable, article 261.4.4°a du CGI)`, 25, y)
  
  y += 15
  
  doc.setFont(undefined, 'bold')
  doc.text('Article 3 – Modalités de règlement', 20, y)
  doc.setFont(undefined, 'normal')
  y += 8
  doc.text('Le règlement sera effectué à réception de la facture, à l\'issue de la formation.', 25, y)
  
  y += 15
  
  doc.setFont(undefined, 'bold')
  doc.text('Article 4 – Clause de dédit ou d\'annulation', 20, y)
  doc.setFont(undefined, 'normal')
  y += 8
  const deditText = 'En cas d\'annulation par le Bénéficiaire moins de 10 jours ouvrés avant le début de la formation, l\'Organisme facturera une indemnité forfaitaire de 30% du prix total de la formation.'
  const deditLines = doc.splitTextToSize(deditText, 165)
  doc.text(deditLines, 25, y)
  y += deditLines.length * 5 + 10
  
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
  doc.text('• Remettre une attestation de fin de formation à chaque participant', 30, y)
  
  y += 10
  doc.text('Le Bénéficiaire s\'engage à :', 25, y)
  y += 5
  doc.text('• Assurer la présence du ou des participants aux dates convenues', 30, y)
  y += 5
  doc.text('• Régler le prix de la formation selon les modalités convenues', 30, y)
  
  y += 20
  
  doc.setFont(undefined, 'bold')
  doc.text(`Fait en deux exemplaires, à Concarneau, le ${formatDateShort(new Date())}`, 20, y)
  
  y += 15
  
  doc.setFontSize(10)
  doc.text('Pour l\'Organisme de formation', 25, y)
  doc.text('Pour le Bénéficiaire', 120, y)
  
  y += 5
  doc.setFont(undefined, 'normal')
  doc.setFontSize(9)
  doc.text(ORG_INFO.dirigeant + ', Gérant', 25, y)
  doc.text('(Nom, fonction, cachet et signature)', 120, y)
  doc.text('Précédé de "Lu et approuvé"', 120, y + 5)
  
  y += 15
  
  addStampSignature(doc, y)
  doc.rect(115, y, 70, 35)
  
  return doc
}

// ============================================================
// CONVOCATION À LA FORMATION
// ============================================================
export function generateConvocation(session, trainee, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = addHeader(doc)
  
  doc.setFontSize(10)
  doc.text(`Concarneau, le ${formatDateShort(new Date())}`, pageWidth - 60, 20)
  
  y += 15
  
  doc.setFontSize(11)
  doc.text(`À l'attention de :`, 120, y)
  y += 6
  doc.setFont(undefined, 'bold')
  doc.text(`${trainee.first_name} ${trainee.last_name}`, 120, y)
  doc.setFont(undefined, 'normal')
  
  y += 25
  
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('CONVOCATION À LA FORMATION', pageWidth / 2, y, { align: 'center' })
  
  y += 20
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  doc.text(`Madame, Monsieur,`, 20, y)
  
  y += 10
  doc.text('Nous avons le plaisir de vous confirmer votre inscription à la formation suivante :', 20, y)
  
  y += 15
  
  doc.setFillColor(245, 245, 245)
  doc.rect(20, y - 5, 170, 55, 'F')
  
  const infos = [
    ['Intitulé', session.courses?.title || 'Formation'],
    ['Dates', `Du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`],
    ['Horaires', `${session.start_time || '09:00'} - ${session.end_time || '17:00'}`],
    ['Durée totale', `${session.courses?.duration_hours || 0} heures`],
    ['Lieu', session.location || 'À définir'],
    ['Formateur', `${trainer?.first_name || ''} ${trainer?.last_name || ''}`],
  ]
  
  infos.forEach(([label, value], i) => {
    doc.setFont(undefined, 'bold')
    doc.text(`${label} :`, 25, y + (i * 8))
    doc.setFont(undefined, 'normal')
    doc.text(value, 70, y + (i * 8))
  })
  
  y += 65
  
  doc.setFont(undefined, 'bold')
  doc.text('Informations pratiques :', 20, y)
  doc.setFont(undefined, 'normal')
  y += 8
  doc.text('• Merci de vous munir d\'une pièce d\'identité', 25, y)
  y += 6
  doc.text('• Présentez-vous 10 minutes avant le début de la formation', 25, y)
  
  y += 15
  
  doc.setFont(undefined, 'bold')
  doc.text('Contact :', 20, y)
  doc.setFont(undefined, 'normal')
  y += 6
  doc.text(`Pour toute question : ${ORG_INFO.phone} ou ${ORG_INFO.email}`, 20, y)
  
  y += 20
  doc.text('Nous vous remercions pour votre confiance.', 20, y)
  
  y += 15
  doc.text('Cordialement,', 20, y)
  
  y += 20
  doc.setFont(undefined, 'bold')
  doc.text(ORG_INFO.dirigeant, 20, y)
  doc.setFont(undefined, 'normal')
  doc.text('Gérant - Access Formation', 20, y + 5)
  
  return doc
}

// ============================================================
// ATTESTATION DE PRÉSENCE
// ============================================================
export function generateAttestation(session, trainee, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = addHeader(doc)
  
  y += 20
  
  doc.setFontSize(18)
  doc.setFont(undefined, 'bold')
  doc.text('ATTESTATION DE PRÉSENCE', pageWidth / 2, y, { align: 'center' })
  
  y += 25
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  
  doc.text(`Je soussigné, ${ORG_INFO.dirigeant}, représentant l'organisme de formation`, 20, y)
  y += 6
  doc.text(`${ORG_INFO.name}, atteste que :`, 20, y)
  
  y += 20
  
  doc.setFont(undefined, 'bold')
  doc.setFontSize(14)
  doc.setFillColor(240, 240, 240)
  doc.rect(20, y - 6, 170, 12, 'F')
  doc.text(`${trainee.first_name} ${trainee.last_name}`, pageWidth / 2, y, { align: 'center' })
  
  y += 20
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  doc.text('A suivi avec assiduité la formation intitulée :', 20, y)
  
  y += 10
  doc.setFont(undefined, 'bold')
  doc.text(session.courses?.title || 'Formation', pageWidth / 2, y, { align: 'center' })
  
  y += 20
  doc.setFont(undefined, 'normal')
  
  const infos = [
    ['Dates', `Du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`],
    ['Durée totale', `${session.courses?.duration_hours || 0} heures`],
    ['Horaires', `${session.start_time || '09:00'} - ${session.end_time || '17:00'}`],
    ['Lieu', session.location || 'À définir'],
    ['Formateur', `${trainer?.first_name || ''} ${trainer?.last_name || ''}`],
  ]
  
  doc.autoTable({
    startY: y,
    body: infos,
    theme: 'plain',
    styles: { fontSize: 11, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 120 },
    },
  })
  
  y = doc.autoTable.previous.finalY + 25
  
  doc.text('Cette attestation est délivrée pour servir et valoir ce que de droit.', 20, y)
  
  y += 25
  
  doc.text(`Fait à Concarneau, le ${formatDateShort(new Date())}`, 20, y)
  
  y += 15
  doc.text('Pour Access Formation,', 20, y)
  y += 8
  doc.setFont(undefined, 'bold')
  doc.text(ORG_INFO.dirigeant + ', Gérant', 20, y)
  
  y += 10
  addStampSignature(doc, y)
  
  return doc
}

// ============================================================
// CERTIFICAT DE RÉALISATION
// ============================================================
export function generateCertificat(session, trainee, client, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = addHeader(doc)
  
  y += 15
  
  doc.setFontSize(18)
  doc.setFont(undefined, 'bold')
  doc.text('CERTIFICAT DE RÉALISATION', pageWidth / 2, y, { align: 'center' })
  
  y += 20
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  
  const intro = `Je soussigné, ${ORG_INFO.dirigeant}, représentant légal du dispensateur de l'action concourant au développement des compétences ${ORG_INFO.name},`
  const introLines = doc.splitTextToSize(intro, 170)
  doc.text(introLines, 20, y)
  y += introLines.length * 6 + 10
  
  doc.setFont(undefined, 'bold')
  doc.text('Atteste que :', 20, y)
  
  y += 15
  
  doc.setFillColor(245, 245, 245)
  doc.rect(20, y - 5, 170, 20, 'F')
  
  doc.setFontSize(12)
  doc.text(`${trainee.first_name} ${trainee.last_name}`, pageWidth / 2, y + 2, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Salarié(e) de l'entreprise : ${client?.name || 'Non renseigné'}`, pageWidth / 2, y + 10, { align: 'center' })
  
  y += 30
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.text('A suivi l\'action concourant au développement des compétences :', 20, y)
  
  y += 12
  
  doc.setFont(undefined, 'normal')
  doc.text('Nature de l\'action :', 20, y)
  y += 6
  doc.text('☑ Action de formation (article L. 6313-1, 1° du code du travail)', 25, y)
  
  y += 15
  
  doc.setFont(undefined, 'bold')
  doc.setFontSize(12)
  doc.text(session.courses?.title || 'Formation', pageWidth / 2, y, { align: 'center' })
  
  y += 15
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  doc.text(`Qui s'est déroulée du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 20, y)
  y += 8
  doc.text(`Pour une durée de ${session.courses?.duration_hours || 0} heures.`, 20, y)
  
  y += 20
  
  const engagement = 'Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m\'engage à conserver l\'ensemble des pièces justificatives qui ont permis d\'établir le présent certificat pendant une durée de 3 ans à compter de la fin de l\'année du dernier paiement.'
  doc.setFontSize(9)
  const engLines = doc.splitTextToSize(engagement, 170)
  doc.text(engLines, 20, y)
  
  y += engLines.length * 4 + 20
  
  doc.setFontSize(11)
  doc.text(`Fait à Concarneau, le ${formatDateShort(new Date())}`, 20, y)
  
  y += 15
  doc.text('Cachet et signature du responsable', 20, y)
  doc.text('du dispensateur de formation :', 20, y + 5)
  
  y += 15
  doc.setFont(undefined, 'bold')
  doc.text(`${ORG_INFO.dirigeant}`, 20, y)
  doc.setFont(undefined, 'normal')
  doc.text('Gérant Access Formation', 20, y + 5)
  
  y += 15
  addStampSignature(doc, y)
  
  return doc
}

// ============================================================
// FEUILLE D'ÉMARGEMENT
// ============================================================
export function generateEmargement(session, trainees, trainer, attendances = []) {
  const doc = new jsPDF('landscape')
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 15
  
  if (LOGO_BASE64) {
    try {
      doc.addImage(LOGO_BASE64, 'PNG', 10, 8, 30, 30)
    } catch (e) {}
  }
  
  doc.setFontSize(9)
  doc.text(ORG_INFO.name, 45, 15)
  doc.text(`N° DA : ${ORG_INFO.nda}`, 45, 20)
  doc.text(`Tél : ${ORG_INFO.phone}`, 45, 25)
  
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text('FEUILLE D\'ÉMARGEMENT', pageWidth / 2, y, { align: 'center' })
  
  y = 40
  
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Intitulé : ${session.courses?.title || 'Formation'}`, 15, y)
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 150, y)
  y += 6
  doc.text(`Dates : du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 15, y)
  doc.text(`Lieu : ${session.location || 'À définir'}`, 150, y)
  y += 6
  doc.text(`Client : ${session.clients?.name || ''}`, 15, y)
  doc.text(`Effectif : ${trainees.length} participant(s)`, 150, y)
  
  y += 10
  
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Rappel : Chaque demi-journée doit être signée par le stagiaire et le formateur.', 15, y)
  doc.setTextColor(0)
  
  y += 8
  
  const startDate = new Date(session.start_date)
  const endDate = new Date(session.end_date)
  const days = []
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  
  const maxDays = Math.min(days.length, 5)
  
  const headers = [
    { content: 'N°', styles: { halign: 'center', cellWidth: 8 } },
    { content: 'NOM Prénom', styles: { cellWidth: 45 } },
  ]
  
  days.slice(0, maxDays).forEach(day => {
    headers.push({ content: `${format(day, 'EEE dd/MM', { locale: fr })}\nMatin`, styles: { halign: 'center', fontSize: 8 } })
    headers.push({ content: `${format(day, 'EEE dd/MM', { locale: fr })}\nAprès-midi`, styles: { halign: 'center', fontSize: 8 } })
  })
  
  const rows = trainees.map((t, i) => {
    const row = [
      { content: String(i + 1), styles: { halign: 'center' } },
      `${t.last_name?.toUpperCase() || ''} ${t.first_name || ''}`,
    ]
    
    days.slice(0, maxDays).forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const amSigned = attendances.some(a => 
        a.trainee_id === t.id && a.date === dateStr && (a.period === 'am' || a.period === 'full')
      )
      const pmSigned = attendances.some(a => 
        a.trainee_id === t.id && a.date === dateStr && (a.period === 'pm' || a.period === 'full')
      )
      
      row.push({ content: amSigned ? '✓' : '', styles: { halign: 'center' } })
      row.push({ content: pmSigned ? '✓' : '', styles: { halign: 'center' } })
    })
    
    return row
  })
  
  const trainerRow = [
    { content: '', styles: { fillColor: [230, 230, 230] } },
    { content: `FORMATEUR : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } },
  ]
  days.slice(0, maxDays).forEach(() => {
    trainerRow.push({ content: '', styles: { fillColor: [230, 230, 230] } })
    trainerRow.push({ content: '', styles: { fillColor: [230, 230, 230] } })
  })
  rows.push(trainerRow)
  
  doc.autoTable({
    startY: y,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4, minCellHeight: 12 },
    headStyles: { fillColor: [51, 122, 183], textColor: 255, fontStyle: 'bold' },
  })
  
  const finalY = doc.autoTable.previous.finalY + 8
  doc.setFontSize(8)
  doc.text(`Document généré le ${formatDateShort(new Date())} - ${ORG_INFO.name}`, 15, finalY)
  
  return doc
}

// ============================================================
// PROGRAMME DE FORMATION
// ============================================================
export function generateProgramme(course, session = null, trainer = null) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = addHeader(doc)
  
  y += 10
  
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  doc.text('PROGRAMME DE FORMATION', pageWidth / 2, y, { align: 'center' })
  
  y += 10
  doc.setFontSize(16)
  doc.setTextColor(51, 122, 183)
  doc.text(course.title || 'Formation', pageWidth / 2, y, { align: 'center' })
  doc.setTextColor(0)
  
  y += 15
  
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  
  const sections = [
    { title: 'OBJECTIFS DE LA FORMATION', content: course.objectives },
    { title: 'PUBLIC CONCERNÉ ET PRÉREQUIS', content: `Public : ${course.target_audience || 'Tout public'}\nPrérequis : ${course.prerequisites || 'Aucun'}` },
    { title: 'DURÉE ET MODALITÉS', content: `Durée : ${course.duration_hours} heures\nModalité : ${course.modality === 'presential' ? 'Présentiel' : course.modality === 'remote' ? 'Distanciel' : 'Mixte'}${session ? '\nLieu : ' + (session.location || 'À définir') : ''}${trainer ? '\nFormateur : ' + trainer.first_name + ' ' + trainer.last_name : ''}` },
    { title: 'CONTENU DE LA FORMATION', content: course.program },
  ]
  
  sections.forEach(section => {
    if (section.content) {
      doc.setFont(undefined, 'bold')
      doc.setFillColor(51, 122, 183)
      doc.setTextColor(255)
      doc.rect(20, y - 5, 170, 8, 'F')
      doc.text(section.title, 25, y)
      doc.setTextColor(0)
      doc.setFont(undefined, 'normal')
      y += 8
      const lines = doc.splitTextToSize(section.content, 165)
      doc.text(lines, 25, y)
      y += lines.length * 5 + 10
      
      if (y > 250) {
        doc.addPage()
        y = 20
      }
    }
  })
  
  // Moyens pédagogiques
  doc.setFont(undefined, 'bold')
  doc.setFillColor(51, 122, 183)
  doc.setTextColor(255)
  doc.rect(20, y - 5, 170, 8, 'F')
  doc.text('MOYENS PÉDAGOGIQUES ET TECHNIQUES', 25, y)
  doc.setTextColor(0)
  doc.setFont(undefined, 'normal')
  y += 8
  doc.text('• Apports théoriques et méthodologiques', 25, y)
  y += 5
  doc.text('• Mises en situation pratiques et exercices', 25, y)
  y += 5
  doc.text('• Support de formation remis aux participants', 25, y)
  
  y += 15
  
  // Évaluation
  doc.setFont(undefined, 'bold')
  doc.setFillColor(51, 122, 183)
  doc.setTextColor(255)
  doc.rect(20, y - 5, 170, 8, 'F')
  doc.text('MODALITÉS D\'ÉVALUATION', 25, y)
  doc.setTextColor(0)
  doc.setFont(undefined, 'normal')
  y += 8
  doc.text('• Évaluation continue des acquis', 25, y)
  y += 5
  doc.text('• Attestation de fin de formation', 25, y)
  
  y += 15
  
  // Accessibilité
  doc.setFont(undefined, 'bold')
  doc.setFillColor(51, 122, 183)
  doc.setTextColor(255)
  doc.rect(20, y - 5, 170, 8, 'F')
  doc.text('ACCESSIBILITÉ', 25, y)
  doc.setTextColor(0)
  doc.setFont(undefined, 'normal')
  y += 8
  doc.text('Formation accessible aux personnes en situation de handicap. Contactez-nous.', 25, y)
  
  // Pied de page
  y = 275
  doc.setFontSize(9)
  doc.text(`${ORG_INFO.name} - ${ORG_INFO.address}, ${ORG_INFO.city}`, pageWidth / 2, y, { align: 'center' })
  
  return doc
}

// ============================================================
// FICHE ÉVALUATION SATISFACTION
// ============================================================
export function generateEvaluationSatisfaction(session, trainee = null, trainer = null) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = addHeader(doc)
  
  y += 5
  
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text('FICHE D\'ÉVALUATION DE SATISFACTION', pageWidth / 2, y, { align: 'center' })
  
  y += 15
  
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.setFillColor(245, 245, 245)
  doc.rect(20, y - 5, 170, 18, 'F')
  doc.text(`Formation : ${session.courses?.title || 'Formation'}`, 25, y)
  y += 6
  doc.text(`Dates : du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 25, y)
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 110, y)
  
  y += 15
  
  doc.setFontSize(8)
  doc.text('1 = Non satisfait | 2 = Peu satisfait | 3 = Moyennement satisfait | 4 = Satisfait | 5 = Très satisfait', 20, y)
  
  y += 8
  
  const questions = [
    'Les objectifs de la formation étaient-ils clairement définis ?',
    'Le contenu correspondait-il à vos attentes ?',
    'Les méthodes pédagogiques étaient-elles adaptées ?',
    'Le formateur maîtrisait-il son sujet ?',
    'Le formateur était-il à l\'écoute ?',
    'Les supports pédagogiques étaient-ils de qualité ?',
    'L\'organisation matérielle était-elle satisfaisante ?',
    'La durée de la formation était-elle adaptée ?',
  ]
  
  const tableData = questions.map(q => [q, '☐', '☐', '☐', '☐', '☐'])
  
  doc.autoTable({
    startY: y,
    head: [['Critères d\'évaluation', '1', '2', '3', '4', '5']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [51, 122, 183], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 125 },
      1: { cellWidth: 9, halign: 'center' },
      2: { cellWidth: 9, halign: 'center' },
      3: { cellWidth: 9, halign: 'center' },
      4: { cellWidth: 9, halign: 'center' },
      5: { cellWidth: 9, halign: 'center' },
    },
  })
  
  y = doc.autoTable.previous.finalY + 10
  
  doc.setFont(undefined, 'bold')
  doc.text('Points à améliorer :', 20, y)
  doc.setFont(undefined, 'normal')
  y += 4
  doc.rect(20, y, 170, 20)
  
  y += 28
  
  doc.text('Recommanderiez-vous cette formation ?   ☐ Oui   ☐ Non', 20, y)
  
  y += 15
  
  if (trainee) {
    doc.text(`Nom : ${trainee.first_name} ${trainee.last_name}`, 20, y)
  } else {
    doc.text('Nom : ______________________________', 20, y)
  }
  doc.text('Signature :', 130, y)
  
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
      if (!trainee) throw new Error('Trainee required')
      doc = generateConvocation(session, trainee, trainer)
      filename = `Convocation_${trainee.last_name}_${session.reference}.pdf`
      break
    case 'emargement':
      doc = generateEmargement(session, trainees, trainer, attendances)
      filename = `Emargement_${session.reference}.pdf`
      break
    case 'attestation':
      if (!trainee) throw new Error('Trainee required')
      doc = generateAttestation(session, trainee, trainer)
      filename = `Attestation_${trainee.last_name}_${session.reference}.pdf`
      break
    case 'certificat':
      if (!trainee) throw new Error('Trainee required')
      doc = generateCertificat(session, trainee, client || session.clients, trainer)
      filename = `Certificat_${trainee.last_name}_${session.reference}.pdf`
      break
    case 'programme':
      doc = generateProgramme(course || session.courses, session, trainer)
      filename = `Programme_${course?.code || session?.reference || 'formation'}.pdf`
      break
    case 'evaluation':
      doc = generateEvaluationSatisfaction(session, trainee, trainer)
      filename = `Evaluation_${trainee?.last_name || 'stagiaire'}_${session.reference}.pdf`
      break
    default:
      throw new Error(`Unknown document type: ${docType}`)
  }
  
  doc.save(filename)
  return filename
}
