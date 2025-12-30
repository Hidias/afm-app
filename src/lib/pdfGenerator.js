import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ============================================================
// IMAGES EN BASE64 - INTÉGRÉES DIRECTEMENT
// ============================================================
const LOGO_BASE64 = 'data:image/jpeg;base64,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'

const STAMP_BASE64 = 'data:image/jpeg;base64,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'

// ============================================================
// INFORMATIONS ORGANISME DE FORMATION
// ============================================================
const ORG = {
  name: 'SARL ACCESS FORMATION',
  address: '24 Rue Kerbleiz, 29900 Concarneau',
  phone: '02 46 56 57 54',
  email: 'contact@accessformation.pro',
  siret: '943 563 866 00012',
  ape: '85.59A',
  tva: 'FR71943563866',
  nda: '53 29 10412 29',
  ndaFull: '53 29 10412 29 attribué par la DREETS de la Bretagne',
  iban: 'FR76 1558 9297 0600 0890 6894 048',
  bic: 'CMBRFR2BXXXX',
  dirigeant: 'Hicham SAIDI',
}

// Formatage dates
const formatDateShort = (date) => {
  if (!date) return ''
  return format(new Date(date), 'dd/MM/yyyy')
}

// ============================================================
// EN-TÊTE AVEC LOGO (style original)
// ============================================================
function addHeader(doc) {
  try {
    doc.addImage(LOGO_BASE64, 'JPEG', 15, 10, 35, 35)
  } catch (e) {
    console.warn('Logo error:', e)
  }
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(ORG.name, 55, 15)
  
  doc.setFont('helvetica', 'normal')
  doc.text(ORG.address, 55, 20)
  doc.text(ORG.phone, 55, 25)
  doc.text(ORG.email, 55, 30)
  doc.text(`SIRET ${ORG.siret} / APE ${ORG.ape}`, 55, 35)
  doc.text(`TVA Intra : ${ORG.tva}`, 55, 40)
  
  return 50
}

// ============================================================
// TAMPON + SIGNATURE
// ============================================================
function addStamp(doc, x, y, width = 55, height = 28) {
  try {
    doc.addImage(STAMP_BASE64, 'JPEG', x, y, width, height)
  } catch (e) {
    doc.rect(x, y, width, height)
    doc.setFontSize(8)
    doc.text('Cachet + Signature', x + 5, y + 12)
  }
}

// ============================================================
// CONVENTION DE FORMATION - IDENTIQUE À L'ORIGINAL
// ============================================================
export function generateConvention(session, client, trainees, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  let y = addHeader(doc)
  
  // Sous-titre légal centré
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text('Conformément aux articles L6353-1 à L6353-9 et D6313-3-1 du Code du travail', pageWidth / 2, y, { align: 'center' })
  y += 10
  
  // ENTRE LES SOUSSIGNÉS
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('ENTRE LES SOUSSIGNÉS', 20, y)
  y += 8
  
  // Organisme de formation
  doc.text("L'Organisme de formation :", 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(ORG.name, 20, y)
  y += 4
  doc.text(`SIRET : ${ORG.siret}`, 20, y)
  y += 4
  doc.text(`Déclaration d'activité (NDA) : ${ORG.ndaFull}`, 20, y)
  y += 8
  
  // ET + Entreprise bénéficiaire
  doc.setFont('helvetica', 'bold')
  doc.text('ET', 20, y)
  y += 6
  doc.text("L'entreprise bénéficiaire :", 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Raison sociale : ${client?.name || ''}`, 20, y)
  y += 4
  doc.text(`Adresse : ${client?.address || ''}, ${client?.postal_code || ''} ${client?.city || ''}`, 20, y)
  y += 4
  if (client?.siret) {
    doc.text(`SIRET : ${client.siret}`, 20, y)
    y += 4
  }
  if (client?.contact_name) {
    doc.text(`Représentée par : ${client.contact_name}${client.contact_function ? ', ' + client.contact_function : ''}`, 20, y)
    y += 4
  }
  doc.text('Ci-après dénommée « le Bénéficiaire »', 20, y)
  y += 10
  
  // Article 1
  doc.setFont('helvetica', 'bold')
  doc.text('Article 1 – Objet, durée et effectif de la formation', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text('Le Bénéficiaire souhaite faire participer une partie de son personnel à la formation suivante :', 20, y)
  y += 7
  
  // Détails formation
  doc.setFont('helvetica', 'bold')
  doc.text(`Intitulé : ${course.title || 'Formation'}`, 20, y)
  y += 4
  doc.text(`Type d'action : Action de formation`, 20, y)
  y += 4
  
  if (course.objectives) {
    const objText = `Objectif(s) professionnel(s) : ${course.objectives}`
    const objLines = doc.splitTextToSize(objText, 170)
    doc.text(objLines, 20, y)
    y += objLines.length * 4 + 2
  }
  
  // Liste des apprenants
  doc.text('Liste des apprenants désignés par le Bénéficiaire :', 20, y)
  y += 4
  trainees.forEach(t => {
    doc.text(`${t.last_name?.toUpperCase() || ''}\t${t.first_name || ''}`, 25, y)
    y += 4
  })
  y += 2
  
  doc.text(`Durée (heures) : ${course.duration_hours || 0}`, 20, y)
  y += 4
  doc.text(`Dates du : ${formatDateShort(session.start_date)} au : ${formatDateShort(session.end_date)} Horaires : ${session.start_time || '08h30'} - ${session.end_time || '17h00'}`, 20, y)
  y += 4
  doc.text(`Effectif (participants) : ${trainees.length}`, 20, y)
  y += 4
  doc.text(`Lieu : ${session.location || 'À définir'}`, 20, y)
  y += 4
  doc.text(`Public concerné : ${course.target_audience || 'Tout public'}`, 20, y)
  y += 4
  doc.text(`Prérequis : ${course.prerequisites || 'Aucun'}`, 20, y)
  y += 4
  doc.text(`Formateur référent : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 20, y)
  
  // Page 2
  doc.addPage()
  y = 20
  
  // Article 2
  doc.setFont('helvetica', 'bold')
  doc.text('Article 2 – Engagements des parties', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const art2 = "Le Bénéficiaire s'engage à assurer la présence des stagiaires inscrits et à fournir les informations nécessaires au bon déroulement de la formation. L'organisme de formation s'engage à réaliser la formation selon le programme convenu."
  const art2Lines = doc.splitTextToSize(art2, 170)
  doc.text(art2Lines, 20, y)
  y += art2Lines.length * 4 + 8
  
  // Article 3
  doc.setFont('helvetica', 'bold')
  doc.text('Article 3 – Dispositions financières', 20, y)
  y += 5
  doc.text(`Coût total de la formation (en € HT) : ${course.price_ht ? course.price_ht + ' € HT' : '__________ € HT'}`, 20, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text('Modalités de paiement : conformément au devis validé par virement bancaire', 20, y)
  y += 4
  doc.text(`IBAN : ${ORG.iban} – BIC : ${ORG.bic}`, 20, y)
  y += 4
  doc.text("Aucun acompte ne sera demandé avant la formation.", 20, y)
  y += 8
  
  // Article 4
  doc.setFont('helvetica', 'bold')
  doc.text('Article 4 – Moyens et modalités pédagogiques', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const art4 = course.pedagogical_methods || "La formation est dispensée selon une pédagogie active et participative : alternance d'apports théoriques, d'exercices pratiques et de mises en situation. Les supports de formation sont remis aux participants."
  const art4Lines = doc.splitTextToSize(art4, 170)
  doc.text(art4Lines, 20, y)
  y += art4Lines.length * 4 + 3
  doc.text("Une feuille d'émargement par demi-journée est signée par chaque stagiaire et le formateur.", 20, y)
  y += 8
  
  // Article 5
  doc.setFont('helvetica', 'bold')
  doc.text("Article 5 – Modalités de suivi et d'évaluation", 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const art5 = course.evaluation_methods || "Évaluation formative pendant la formation (mises en situation, QCM, exercices pratiques). Évaluation sommative en fin de formation."
  const art5Lines = doc.splitTextToSize(art5, 170)
  doc.text(art5Lines, 20, y)
  y += art5Lines.length * 4 + 8
  
  // Article 6
  doc.setFont('helvetica', 'bold')
  doc.text('Article 6 – Sanction et documents délivrés', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const art6 = course.delivered_documents || "À l'issue de la formation, l'Organisme de Formation délivrera : une attestation de fin de formation, un certificat de réalisation."
  const art6Lines = doc.splitTextToSize(art6, 170)
  doc.text(art6Lines, 20, y)
  y += art6Lines.length * 4 + 8
  
  // Article 7
  doc.setFont('helvetica', 'bold')
  doc.text('Article 7 – Annulation, dédommagement, force majeure', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const art7 = "En cas de désistement du Bénéficiaire moins de 14 jours avant le début de la formation, une indemnité forfaitaire de 30% du coût total sera due. En cas de force majeure (maladie, accident...), un report sera proposé sans frais."
  const art7Lines = doc.splitTextToSize(art7, 170)
  doc.text(art7Lines, 20, y)
  y += art7Lines.length * 4 + 8
  
  // Article 8
  doc.setFont('helvetica', 'bold')
  doc.text('Article 8 – Accessibilité et personnes en situation de handicap', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const art8 = "Access Formation s'engage à favoriser l'accès à ses formations pour tous. Pour toute situation de handicap, merci de nous contacter afin d'étudier les adaptations possibles."
  const art8Lines = doc.splitTextToSize(art8, 170)
  doc.text(art8Lines, 20, y)
  y += art8Lines.length * 4 + 8
  
  // Article 9
  doc.setFont('helvetica', 'bold')
  doc.text('Article 9 – Protection des données (RGPD)', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const art9 = "Les données personnelles collectées sont utilisées exclusivement dans le cadre de la formation et conservées conformément à la réglementation RGPD. Les participants disposent d'un droit d'accès, de rectification et de suppression."
  const art9Lines = doc.splitTextToSize(art9, 170)
  doc.text(art9Lines, 20, y)
  y += art9Lines.length * 4 + 8
  
  // Article 10
  doc.setFont('helvetica', 'bold')
  doc.text('Article 10 – Litiges', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text("En cas de différend, les parties s'efforceront de trouver une solution amiable. À défaut, le tribunal de Quimper sera compétent.", 20, y)
  y += 12
  
  // Date
  doc.setFont('helvetica', 'bold')
  doc.text(`Fait à Concarneau, le ${formatDateShort(new Date())}`, 20, y)
  y += 12
  
  // Tableau signatures
  doc.autoTable({
    startY: y,
    head: [["Pour l'Organisme de Formation", "Pour le Bénéficiaire"]],
    body: [
      [ORG.dirigeant, `(Cachet et signature)\n${client?.contact_name || ''}\n${client?.contact_function || ''}`],
      ['', ''],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, minCellHeight: 35 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 85 },
      1: { cellWidth: 85 },
    },
  })
  
  // Tampon dans la cellule organisme
  const tableY = y + 8
  addStamp(doc, 25, tableY + 20, 50, 25)
  
  return doc
}

// ============================================================
// CONVOCATION À LA FORMATION
// ============================================================
export function generateConvocation(session, trainee, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  const client = session.clients || {}
  let y = addHeader(doc)
  
  y += 10
  
  // Titre
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('CONVOCATION À LA FORMATION', pageWidth / 2, y, { align: 'center' })
  y += 10
  
  // Nom stagiaire
  doc.setFontSize(16)
  doc.text(`${trainee.first_name} ${trainee.last_name}`, pageWidth / 2, y, { align: 'center' })
  y += 10
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Merci de vous présenter à la session de formation selon les informations suivantes :', pageWidth / 2, y, { align: 'center' })
  y += 12
  
  // Détails
  doc.setFont('helvetica', 'bold')
  doc.text(`Intitulé de la formation : ${course.title || ''}`, 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  if (course.objectives) {
    const obj = `Objectif(s) : ${course.objectives}`
    const objLines = doc.splitTextToSize(obj, 170)
    doc.text(objLines, 20, y)
    y += objLines.length * 4 + 2
  }
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Date(s) de formation : ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 20, y)
  y += 5
  doc.text(`Horaires : ${session.start_time || '08h30'} - ${session.end_time || '17h00'}`, 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Durée totale : ${course.duration_hours || 0} heures`, 20, y)
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text(`Lieu de formation : ${session.location || 'À définir'}`, 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 20, y)
  y += 10
  
  doc.text("Merci de vous munir d'une tenue adaptée et du matériel indiqué par le formateur, le cas échéant.", 20, y)
  y += 8
  doc.text("Accessibilité : en cas de besoins spécifiques (mobilité, auditif, visuel...), merci de nous en informer.", 20, y)
  y += 10
  
  doc.text(`Contact Access Formation : Pour toute question, contactez-nous au ${ORG.phone} ou par mail à ${ORG.email}`, 20, y)
  y += 6
  
  // Contact entreprise
  if (client.contact_name) {
    doc.text(`Contact de votre entreprise : ${client.contact_name}${client.contact_function ? ' - ' + client.contact_function : ''}`, 20, y)
    y += 6
  }
  
  y += 8
  doc.text('Nous vous remercions pour votre ponctualité et votre participation active.', 20, y)
  y += 15
  
  // Signature à droite
  doc.setFont('helvetica', 'bold')
  doc.text(ORG.dirigeant, pageWidth - 60, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text('Dirigeant Access Formation', pageWidth - 60, y)
  
  return doc
}

// ============================================================
// ATTESTATION DE PRÉSENCE
// ============================================================
export function generateAttestation(session, trainee, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  const client = session.clients || {}
  let y = addHeader(doc)
  
  y += 10
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('ATTESTATION DE PRÉSENCE', pageWidth / 2, y, { align: 'center' })
  y += 15
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Je soussigné, ${ORG.dirigeant}, représentant l'organisme de formation ${ORG.name}, atteste que :`, 20, y)
  y += 12
  
  // Nom stagiaire
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`${trainee.first_name} ${trainee.last_name}`, pageWidth / 2, y, { align: 'center' })
  y += 7
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (client.name) {
    doc.text(`Entreprise : ${client.name}`, 20, y)
    y += 6
  }
  
  doc.text(`A participé à la formation intitulée : ${course.title || ''}`, 20, y)
  y += 6
  doc.text(`Dates : du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 20, y)
  y += 5
  doc.text(`Durée totale : ${course.duration_hours || 0} heures`, 20, y)
  y += 5
  doc.text(`Lieu : ${session.location || ''}`, 20, y)
  y += 8
  doc.text(`Cette formation a été animée par : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 20, y)
  y += 5
  doc.text(`Horaires suivis : ${session.start_time || '09:00'} - ${session.end_time || '17:00'}`, 20, y)
  y += 5
  doc.text(`Nombre total d'heures de présence : ${course.duration_hours || 0}`, 20, y)
  y += 15
  
  doc.text('Fait pour servir et valoir ce que de droit.', 20, y)
  y += 20
  
  // Signature à droite
  doc.text(`Fait à Concarneau, le ${formatDateShort(new Date())}`, pageWidth - 80, y)
  y += 5
  doc.text('Pour Access Formation', pageWidth - 80, y)
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text(ORG.dirigeant, pageWidth - 80, y)
  
  y += 8
  addStamp(doc, pageWidth - 80, y, 55, 28)
  
  return doc
}

// ============================================================
// CERTIFICAT DE RÉALISATION (Modèle officiel)
// ============================================================
export function generateCertificat(session, trainee, client, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  const clientData = client || session.clients || {}
  let y = addHeader(doc)
  
  y += 10
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('CERTIFICAT DE RÉALISATION', pageWidth / 2, y, { align: 'center' })
  y += 12
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const intro = `Je soussigné, ${ORG.dirigeant}, représentant légal du dispensateur de l'action concourant au développement des compétences ${ORG.name},`
  const introLines = doc.splitTextToSize(intro, 170)
  doc.text(introLines, 20, y)
  y += introLines.length * 5 + 5
  
  doc.setFont('helvetica', 'bold')
  doc.text('Atteste que :', 20, y)
  y += 10
  
  // Stagiaire
  doc.setFillColor(245, 245, 245)
  doc.rect(25, y - 3, 160, 16, 'F')
  doc.setFontSize(11)
  doc.text(`${trainee.first_name} ${trainee.last_name}`, pageWidth / 2, y + 2, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Salarié(e) de l'entreprise ${clientData.name || ''}`, pageWidth / 2, y + 9, { align: 'center' })
  y += 22
  
  doc.setFont('helvetica', 'bold')
  doc.text("A suivi l'action", pageWidth / 2, y, { align: 'center' })
  y += 10
  
  doc.setFont('helvetica', 'normal')
  doc.text("Nature de l'action concourant au développement des compétences :", 20, y)
  y += 6
  doc.text('☑ Action de formation (article L. 6313-1, 1° du code du travail)', 25, y)
  y += 4
  doc.text('☐ Bilan de compétences', 25, y)
  y += 4
  doc.text('☐ Action de VAE', 25, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(course.title || 'Formation', pageWidth / 2, y, { align: 'center' })
  y += 10
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Qui s'est déroulée du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 20, y)
  y += 5
  doc.text(`Pour une durée de ${course.duration_hours || 0} heures.`, 20, y)
  y += 12
  
  // Engagement conservation
  doc.setFontSize(9)
  const engagement = "Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m'engage à conserver l'ensemble des pièces justificatives qui ont permis d'établir le présent certificat pendant une durée de 3 ans à compter de la fin de l'année du dernier paiement."
  const engLines = doc.splitTextToSize(engagement, 170)
  doc.text(engLines, 20, y)
  y += engLines.length * 4 + 12
  
  doc.setFontSize(10)
  doc.text('Fait à : Concarneau', 20, y)
  y += 5
  doc.text(`Le : ${formatDateShort(new Date())}`, 20, y)
  y += 10
  
  doc.text('Cachet et signature du responsable du dispensateur de formation :', 20, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text(`${ORG.dirigeant}, Dirigeant Access Formation`, pageWidth - 80, y)
  
  y += 8
  addStamp(doc, pageWidth - 80, y, 55, 28)
  
  return doc
}

// ============================================================
// FEUILLE D'ÉMARGEMENT (Demi-journées)
// ============================================================
export function generateEmargement(session, trainees, trainer, attendances = []) {
  const doc = new jsPDF('landscape')
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  const client = session.clients || {}
  let y = 12
  
  // Logo
  try {
    doc.addImage(LOGO_BASE64, 'JPEG', 10, 8, 25, 25)
  } catch (e) {}
  
  // Titre
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('FEUILLE D\'ÉMARGEMENT', pageWidth / 2, y, { align: 'center' })
  y = 38
  
  // Infos
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`Intitulé de la formation : ${course.title || ''}`, 15, y)
  doc.setFont('helvetica', 'normal')
  y += 4
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 15, y)
  y += 4
  doc.text(`Dates : du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 15, y)
  y += 4
  doc.text(`Entreprise : ${client.name || ''}  Lieu : ${session.location || ''}`, 15, y)
  y += 4
  doc.text(`Effectif prévu : ${trainees.length} participants`, 15, y)
  y += 4
  doc.setFontSize(8)
  doc.text("Rappel : Chaque demi-journée doit être signée par le stagiaire et le formateur.", 15, y)
  doc.text("La feuille est à conserver par l'organisme de formation conformément aux obligations légales.", 15, y + 3)
  y += 10
  
  // Jours
  const startDate = new Date(session.start_date)
  const endDate = new Date(session.end_date)
  const days = []
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  
  // Headers
  const headers = ['Nom et prénom du stagiaire', 'N° Sécurité sociale']
  days.slice(0, 4).forEach(day => {
    const dayStr = format(day, 'EEE dd/MM', { locale: fr })
    headers.push(`${dayStr}\nMatin`)
    headers.push(`${dayStr}\nAprès-midi`)
  })
  headers.push('Signature formateur')
  
  // Rows
  const rows = trainees.map(t => {
    const row = [
      `${t.last_name?.toUpperCase() || ''} ${t.first_name || ''}`,
      ''
    ]
    days.slice(0, 4).forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const amSigned = attendances.some(a => a.trainee_id === t.id && a.date === dateStr && (a.period === 'am' || a.period === 'full'))
      const pmSigned = attendances.some(a => a.trainee_id === t.id && a.date === dateStr && (a.period === 'pm' || a.period === 'full'))
      row.push(amSigned ? '✓' : '')
      row.push(pmSigned ? '✓' : '')
    })
    row.push('')
    return row
  })
  
  doc.autoTable({
    startY: y,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, minCellHeight: 10 },
    headStyles: { fillColor: [100, 100, 100], textColor: 255, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 35 },
    }
  })
  
  return doc
}

// ============================================================
// PROGRAMME DE FORMATION
// ============================================================
export function generateProgramme(course, session = null, trainer = null) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = addHeader(doc)
  
  y += 5
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('PROGRAMME DE FORMATION', pageWidth / 2, y, { align: 'center' })
  y += 8
  
  doc.setFontSize(14)
  doc.text(course.title || 'Formation', pageWidth / 2, y, { align: 'center' })
  y += 12
  
  doc.setFontSize(10)
  
  // Objectifs
  if (course.objectives) {
    doc.setFont('helvetica', 'bold')
    doc.text('Objectifs de la formation', 20, y)
    doc.setFont('helvetica', 'normal')
    y += 5
    const lines = doc.splitTextToSize(course.objectives, 170)
    doc.text(lines, 20, y)
    y += lines.length * 4 + 8
  }
  
  // Public et prérequis
  doc.setFont('helvetica', 'bold')
  doc.text('Public concerné et prérequis', 20, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.text(`Public : ${course.target_audience || 'Tout public'}`, 20, y)
  y += 4
  doc.text(`Prérequis : ${course.prerequisites || 'Aucun'}`, 20, y)
  y += 10
  
  // Durée
  doc.setFont('helvetica', 'bold')
  doc.text('Durée et modalités', 20, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.text(`Durée : ${course.duration_hours || 0} heures`, 20, y)
  if (session?.location) {
    y += 4
    doc.text(`Lieu : ${session.location}`, 20, y)
  }
  if (trainer) {
    y += 4
    doc.text(`Formateur : ${trainer.first_name} ${trainer.last_name}`, 20, y)
  }
  y += 10
  
  // Contenu
  if (course.program) {
    doc.setFont('helvetica', 'bold')
    doc.text('Contenu de la formation', 20, y)
    doc.setFont('helvetica', 'normal')
    y += 5
    const progLines = doc.splitTextToSize(course.program, 170)
    doc.text(progLines, 20, y)
    y += progLines.length * 4 + 10
  }
  
  // Moyens pédagogiques
  doc.setFont('helvetica', 'bold')
  doc.text('Moyens et modalités pédagogiques', 20, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  const methods = course.pedagogical_methods || "Formation en présentiel basée sur des méthodes actives : mises en situation, démonstrations, études de cas, exercices pratiques."
  const methodLines = doc.splitTextToSize(methods, 170)
  doc.text(methodLines, 20, y)
  y += methodLines.length * 4 + 10
  
  // Évaluation
  doc.setFont('helvetica', 'bold')
  doc.text("Modalités d'évaluation", 20, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  const evalText = course.evaluation_methods || "Évaluation continue. Attestation de fin de formation remise à chaque participant."
  doc.text(evalText, 20, y)
  y += 10
  
  // Accessibilité
  doc.setFont('helvetica', 'bold')
  doc.text('Accessibilité', 20, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.text("Access Formation adapte ses dispositifs aux besoins spécifiques des stagiaires.", 20, y)
  
  // Tarif
  if (course.price_ht) {
    y += 10
    doc.setFont('helvetica', 'bold')
    doc.text('Tarif', 20, y)
    doc.setFont('helvetica', 'normal')
    y += 5
    doc.text(`${course.price_ht} € HT${course.price_ttc ? ' / ' + course.price_ttc + ' € TTC' : ''}`, 20, y)
  }
  
  return doc
}

// ============================================================
// ÉVALUATION DE SATISFACTION
// ============================================================
export function generateEvaluationSatisfaction(session, trainee = null, trainer = null) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  let y = addHeader(doc)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text("FICHE D'ÉVALUATION DE SATISFACTION STAGIAIRE", pageWidth / 2, y, { align: 'center' })
  y += 8
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text("Merci de prendre quelques instants pour évaluer cette formation. Votre avis contribue à l'amélioration continue.", 20, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Formation : ${course.title || ''}`, 20, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 20, y)
  y += 5
  doc.text(`Dates : du ${formatDateShort(session.start_date)} au ${formatDateShort(session.end_date)}`, 20, y)
  y += 10
  
  doc.setFontSize(8)
  doc.text('1 = Non satisfait | 2 = Peu satisfait | 3 = Moyennement satisfait | 4 = Satisfait | 5 = Très satisfait', 20, y)
  y += 8
  
  const questions = [
    "Les objectifs de la formation étaient-ils clairement définis ?",
    "Le contenu correspondait-il à vos attentes ?",
    "Les méthodes pédagogiques étaient-elles adaptées ?",
    "Le formateur maîtrisait-il son sujet ?",
    "Les supports pédagogiques étaient-ils de qualité ?",
    "L'organisation matérielle était-elle satisfaisante ?",
    "La durée de la formation était-elle adaptée ?",
    "Cette formation vous sera-t-elle utile ?",
  ]
  
  const tableData = questions.map(q => [q, '☐', '☐', '☐', '☐', '☐'])
  
  doc.autoTable({
    startY: y,
    head: [['Critères', '1', '2', '3', '4', '5']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [100, 100, 100] },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 12, halign: 'center' },
    }
  })
  
  y = doc.autoTable.previous.finalY + 10
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Commentaires / Suggestions :', 20, y)
  y += 3
  doc.rect(20, y, 170, 25)
  y += 30
  
  doc.text('Souhaitez-vous recommander cette formation ?  ☐ Oui   ☐ Non', 20, y)
  y += 10
  
  doc.setFont('helvetica', 'normal')
  const nomStagiaire = trainee ? `${trainee.first_name} ${trainee.last_name}` : '________________________'
  doc.text(`Nom du stagiaire : ${nomStagiaire}`, 20, y)
  y += 8
  doc.text('Signature : __________________________', 20, y)
  
  return doc
}

// ============================================================
// TÉLÉCHARGER UN DOCUMENT
// ============================================================
export function downloadDocument(docType, session, options = {}) {
  const { trainees = [], trainee = null, client = null, trainer = null, course = null, attendances = [] } = options
  
  let doc, filename
  
  switch (docType) {
    case 'convention':
      doc = generateConvention(session, client || session.clients, trainees, trainer)
      filename = `Convention_${session.reference}.pdf`
      break
    case 'convocation':
      doc = generateConvocation(session, trainee, trainer)
      filename = `Convocation_${trainee?.last_name || ''}_${session.reference}.pdf`
      break
    case 'emargement':
      doc = generateEmargement(session, trainees, trainer, attendances)
      filename = `Emargement_${session.reference}.pdf`
      break
    case 'attestation':
      doc = generateAttestation(session, trainee, trainer)
      filename = `Attestation_${trainee?.last_name || ''}_${session.reference}.pdf`
      break
    case 'certificat':
      doc = generateCertificat(session, trainee, client || session.clients, trainer)
      filename = `Certificat_${trainee?.last_name || ''}_${session.reference}.pdf`
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
      throw new Error(`Type de document inconnu: ${docType}`)
  }
  
  doc.save(filename)
  return filename
}
