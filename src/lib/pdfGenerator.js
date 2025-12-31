import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ============================================================
// VERSION ET CODES DOCUMENTS
// ============================================================
const APP_VERSION = 'V2.3'
const DOC_CODES = {
  convention: 'AF-CONV',
  convocation: 'AF-CONVOC',
  attestation: 'AF-ATTP',
  certificat: 'AF-CERT',
  emargement: 'AF-EMARG',
  programme: 'AF-PROG',
  evaluation: 'AF-EVAL',
  evaluationFroid: 'AF-EVALF',
  reglement: 'AF-RI',
  livret: 'AF-LIVRET',
  analyseBesoin: 'AF-BESOIN',
  positionnementSST: 'AF-POS-SST',
  positionnementIncendie: 'AF-POS-INCENDIE',
  positionnementGP: 'AF-POS-GP',
  positionnementElec: 'AF-POS-ELEC',
  positionnementR485: 'AF-POS-R485',
  positionnementR489: 'AF-POS-R489',
}

// ============================================================
// IMAGES EN BASE64
// ============================================================
const LOGO_BASE64 = 'data:image/jpeg;base64,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'

const STAMP_BASE64 = 'data:image/jpeg;base64,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'

// ============================================================
// INFORMATIONS ORGANISME
// ============================================================
const ORG = {
  name: 'Access Formation',
  nameFull: 'SARL Access Formation',
  address: '24 rue Kerbleiz, 29900 Concarneau',
  addressFull: '24 Rue Kerbleiz - 29900 Concarneau - France',
  phone: '02 46 56 57 54',
  email: 'contact@accessformation.pro',
  siret: '943 563 866 00012',
  naf: '8559A',
  tva: 'FR71943563866',
  rcs: '943 563 866 R.C.S. Quimper',
  capital: '2500 €',
  nda: '53291026129',
  ndaFull: '53291026129 -- DREETS Bretagne',
  iban: 'FR76 1558 9297 0600 0890 6894 048',
  bic: 'CMBRFR2BXXXX',
  dirigeant: 'Hicham SAIDI',
}

// Format date
const formatDate = (date) => {
  if (!date) return ''
  return format(new Date(date), 'dd/MM/yyyy')
}

// Format date vide (pour documents vierges)
const formatDateEmpty = () => '___ / ___ / ______'

// Format horaires
const formatTime = (time) => {
  if (!time) return ''
  const parts = time.split(':')
  return `${parts[0]}h${parts[1]}`
}

// ============================================================
// EN-TÊTE STANDARD (Logo à gauche)
// ============================================================
function addHeader(doc) {
  try {
    doc.addImage(LOGO_BASE64, 'JPEG', 15, 10, 35, 35)
  } catch (e) {}
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(ORG.nameFull.toUpperCase(), 55, 18)
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(ORG.address, 55, 24)
  doc.text(`Tél : ${ORG.phone}`, 55, 29)
  doc.text(`Email : ${ORG.email}`, 55, 34)
  doc.text(`SIRET : ${ORG.siret} - APE ${ORG.naf}`, 55, 39)
  doc.text(`TVA Intra : ${ORG.tva}`, 55, 44)
  
  return 55
}

// ============================================================
// EN-TÊTE AVEC TITRE (bandeau noir)
// ============================================================
function addHeaderWithTitle(doc, title) {
  let y = addHeader(doc)
  const pageWidth = doc.internal.pageSize.getWidth()
  
  doc.setFillColor(30, 30, 30)
  doc.rect(0, y, pageWidth, 12, 'F')
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(title, pageWidth / 2, y + 8, { align: 'center' })
  
  doc.setTextColor(0, 0, 0)
  
  return y + 20
}

// ============================================================
// PIED DE PAGE AVEC CODE VERSION - MARGE AUGMENTÉE
// ============================================================
function addFooter(doc, docCode, pageNum = null) {
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(15, pageHeight - 25, pageWidth - 15, pageHeight - 25)
  
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  
  doc.text(`${ORG.name} - ${ORG.addressFull}`, pageWidth / 2, pageHeight - 20, { align: 'center' })
  doc.text(`Déclaration d'activité enregistrée sous le numéro ${ORG.ndaFull}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
  doc.text(`SARL au capital de ${ORG.capital} - Siret : ${ORG.siret} - Naf : ${ORG.naf}`, pageWidth / 2, pageHeight - 12, { align: 'center' })
  doc.text(`Tel : ${ORG.phone} - Email : ${ORG.email}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
  
  doc.setFontSize(6)
  doc.setTextColor(180, 180, 180)
  doc.text(`${docCode}-${APP_VERSION}`, pageWidth - 15, pageHeight - 5, { align: 'right' })
  
  if (pageNum) {
    doc.text(`Page ${pageNum}`, 15, pageHeight - 5)
  }
  
  doc.setTextColor(0, 0, 0)
}

// ============================================================
// FORMAT OBJECTIFS (multi-lignes)
// ============================================================
function formatObjectives(objectives) {
  if (!objectives) return []
  return objectives.split('\n').filter(o => o.trim())
}

function displayObjectives(doc, objectives, startX, startY, maxWidth) {
  const objList = formatObjectives(objectives)
  let y = startY
  
  objList.forEach((obj, idx) => {
    const lines = doc.splitTextToSize(`• ${obj.trim()}`, maxWidth)
    lines.forEach((line, lineIdx) => {
      if (lineIdx === 0) {
        doc.text(line, startX, y)
      } else {
        doc.text(line, startX + 3, y)
      }
      y += 5
    })
  })
  
  return y
}

// ============================================================
// GÉNÉRER CONVENTION - TEXTE EXACT
// ============================================================
function generateConvention(session, trainees = [], trainer = null) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const course = session.courses || {}
  const client = session.clients || {}
  
  let y = addHeader(doc)
  
  // Référence articles
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('Conformément aux articles L6353-1 à L6353-9 et D6313-3-1 du Code du travail', pageWidth / 2, y, { align: 'center' })
  y += 10
  
  // Titre
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('CONVENTION DE FORMATION PROFESSIONNELLE', pageWidth / 2, y, { align: 'center' })
  y += 12
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('ENTRE LES SOUSSIGNÉS', 20, y)
  y += 8
  
  // Organisme
  doc.text("L'Organisme de formation :", 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(ORG.nameFull, 20, y); y += 5
  doc.text(`SIRET : ${ORG.siret}`, 20, y); y += 5
  doc.text(`Déclaration d'activité (NDA) : ${ORG.ndaFull}`, 20, y); y += 5
  doc.text(`Siège social : ${ORG.address}`, 20, y); y += 5
  doc.text(`Représenté par : ${ORG.dirigeant}, Dirigeant`, 20, y); y += 5
  doc.text(`Tél. : ${ORG.phone} -- Courriel : ${ORG.email}`, 20, y); y += 5
  doc.text('Ci-après dénommé « l\'Organisme de Formation »', 20, y); y += 10
  
  // Client
  doc.setFont('helvetica', 'bold')
  doc.text('ET', 20, y); y += 5
  doc.text("L'entreprise bénéficiaire :", 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Raison sociale : ${client.name || ''}`, 20, y); y += 5
  doc.text(`Adresse : ${client.address || ''}`, 20, y); y += 5
  doc.text(`Représentée par : ${client.contact_name || ''}`, 20, y); y += 5
  doc.text(`Fonction : ${client.contact_function || ''}`, 20, y); y += 5
  doc.text(`N° SIRET : ${client.siret || ''}`, 20, y); y += 5
  doc.text('Ci-après dénommée « le Bénéficiaire »', 20, y); y += 12
  
  // Article 1
  doc.setFont('helvetica', 'bold')
  doc.text('Article 1 -- Objet, durée et effectif de la formation', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('Le Bénéficiaire souhaite faire participer une partie de son personnel à la formation suivante :', 20, y); y += 8
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Intitulé : ${course.title || ''}`, 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  doc.text('Type d\'action : Action de formation', 20, y); y += 5
  
  // Objectifs
  doc.setFont('helvetica', 'bold')
  doc.text('Objectif(s) professionnel(s) :', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  y = displayObjectives(doc, course.objectives, 20, y, 170)
  y += 3
  
  // Liste des apprenants
  doc.setFont('helvetica', 'bold')
  doc.text('Liste des apprenants désignés par le Bénéficiaire :', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  trainees.forEach(t => {
    doc.text(`${(t.last_name || '').toUpperCase()} ${t.first_name || ''}`, 20, y)
    y += 4
  })
  y += 3
  
  // Durée et dates
  doc.text(`Durée (heures) : ${course.duration_hours || 0}`, 20, y); y += 5
  const startTime = formatTime(session.start_time) || '08h30'
  const endTime = formatTime(session.end_time) || '17h00'
  doc.text(`Dates du : ${formatDate(session.start_date)} au : ${formatDate(session.end_date)} Horaires : ${startTime} - 12h00 et 13h30 - ${endTime}`, 20, y); y += 5
  doc.text(`Effectif (participants) : ${trainees.length}`, 20, y); y += 5
  doc.text(`Lieu : ${session.location || ''}`, 20, y); y += 5
  doc.text(`Public concerné : ${course.target_audience || 'Tout public'}`, 20, y); y += 5
  doc.text(`Prérequis : ${course.prerequisites || 'Aucun'}`, 20, y); y += 5
  doc.text(`Formateur référent : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 20, y); y += 10
  
  // Vérifier si on dépasse la page
  if (y > pageHeight - 80) {
    addFooter(doc, DOC_CODES.convention, 1)
    doc.addPage()
    y = 20
  }
  
  // Article 2
  doc.setFont('helvetica', 'bold')
  doc.text('Article 2 -- Engagements des parties', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  const art2Text = "Le Bénéficiaire s'engage à assurer la présence des stagiaires inscrits et à fournir les moyens nécessaires à la réalisation de la formation (salle, matériel, conditions d'accueil). L'Organisme de Formation s'engage à mettre en œuvre les moyens pédagogiques, techniques et d'encadrement nécessaires pour atteindre les objectifs visés."
  const art2Lines = doc.splitTextToSize(art2Text, 170)
  doc.text(art2Lines, 20, y)
  y += art2Lines.length * 4 + 8
  
  // Article 3
  doc.setFont('helvetica', 'bold')
  doc.text('Article 3 -- Dispositions financières', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  const price = session.total_price || 0
  doc.text(`Coût total de la formation (en € HT) : ${price} € HT`, 20, y); y += 5
  doc.text('Modalités de paiement : conformément au devis validé par virement bancaire', 20, y); y += 5
  doc.text(`IBAN : ${ORG.iban} -- BIC : ${ORG.bic}`, 20, y); y += 5
  doc.text('Aucun acompte ne sera demandé avant la formation.', 20, y); y += 10
  
  if (y > pageHeight - 80) {
    addFooter(doc, DOC_CODES.convention, doc.internal.getNumberOfPages())
    doc.addPage()
    y = 20
  }
  
  // Article 4
  doc.setFont('helvetica', 'bold')
  doc.text('Article 4 -- Moyens et modalités pédagogiques', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  const art4Text = "La formation est dispensée selon une pédagogie active et participative : alternance d'apports théoriques, démonstrations pratiques et mises en situation ; utilisation de supports visuels et matériels spécifiques (mannequins, extincteurs, matériel électrique selon le thème). Une feuille d'émargement par demi-journée est signée par chaque stagiaire et le formateur."
  const art4Lines = doc.splitTextToSize(art4Text, 170)
  doc.text(art4Lines, 20, y)
  y += art4Lines.length * 4 + 8
  
  // Article 5
  doc.setFont('helvetica', 'bold')
  doc.text('Article 5 -- Modalités de suivi et d\'évaluation', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  const art5Text = "Évaluation formative pendant la formation (mises en situation, QCM, exercices pratiques). Validation des acquis selon les critères du référentiel concerné (INRS, prévention incendie, etc.). Délivrance d'un certificat de réalisation indiquant le niveau d'atteinte des objectifs : Acquis / Non acquis."
  const art5Lines = doc.splitTextToSize(art5Text, 170)
  doc.text(art5Lines, 20, y)
  y += art5Lines.length * 4 + 8
  
  // Article 6
  doc.setFont('helvetica', 'bold')
  doc.text('Article 6 -- Sanction et documents délivrés', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  const art6Text = "À l'issue de la formation, l'Organisme de Formation délivrera : une attestation de présence, un certificat de réalisation (Acquis / Non acquis) et, le cas échéant, une attestation officielle selon le module suivi."
  const art6Lines = doc.splitTextToSize(art6Text, 170)
  doc.text(art6Lines, 20, y)
  y += art6Lines.length * 4 + 8
  
  if (y > pageHeight - 100) {
    addFooter(doc, DOC_CODES.convention, doc.internal.getNumberOfPages())
    doc.addPage()
    y = 20
  }
  
  // Article 7
  doc.setFont('helvetica', 'bold')
  doc.text('Article 7 -- Annulation, dédommagement, force majeure', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  const art7Text = "En cas de désistement du Bénéficiaire moins de 14 jours avant le début de la formation, une indemnité forfaitaire de 50 % du coût total sera facturée. En cas de désistement du Bénéficiaire moins de 7 jours avant le début de la formation, une indemnité forfaitaire de 75 % du coût total sera facturée. En cas d'annulation par Access Formation moins de 7 jours avant le démarrage, une nouvelle date sera proposée sans frais."
  const art7Lines = doc.splitTextToSize(art7Text, 170)
  doc.text(art7Lines, 20, y)
  y += art7Lines.length * 4 + 8
  
  // Article 8
  doc.setFont('helvetica', 'bold')
  doc.text('Article 8 -- Accessibilité et personnes en situation de handicap', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  const art8Text = "Access Formation s'engage à favoriser l'accès à ses formations pour toute personne en situation de handicap. Toute demande d'adaptation doit être signalée en amont à contact@accessformation.pro afin de mettre en place les mesures nécessaires."
  const art8Lines = doc.splitTextToSize(art8Text, 170)
  doc.text(art8Lines, 20, y)
  y += art8Lines.length * 4 + 8
  
  // Article 9
  doc.setFont('helvetica', 'bold')
  doc.text('Article 9 -- Protection des données (RGPD)', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  const art9Text = "Les données personnelles collectées sont utilisées exclusivement dans le cadre de la gestion administrative et pédagogique des formations. Elles sont conservées 5 ans et accessibles sur demande conformément au RGPD."
  const art9Lines = doc.splitTextToSize(art9Text, 170)
  doc.text(art9Lines, 20, y)
  y += art9Lines.length * 4 + 8
  
  // Article 10
  doc.setFont('helvetica', 'bold')
  doc.text('Article 10 -- Litiges', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  const art10Text = "En cas de différend, les parties s'efforceront de trouver une solution amiable. À défaut, le litige sera porté devant le tribunal de commerce de Quimper."
  const art10Lines = doc.splitTextToSize(art10Text, 170)
  doc.text(art10Lines, 20, y)
  y += art10Lines.length * 4 + 10
  
  if (y > pageHeight - 70) {
    addFooter(doc, DOC_CODES.convention, doc.internal.getNumberOfPages())
    doc.addPage()
    y = 20
  }
  
  // Fait à
  doc.setFont('helvetica', 'bold')
  doc.text(`Fait à Concarneau, le ${formatDate(session.start_date)}`, 20, y)
  y += 15
  
  // Signatures
  doc.setFontSize(9)
  doc.text('Pour l\'Organisme de Formation', 30, y)
  doc.text('Pour le Bénéficiaire', pageWidth - 70, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text('Access Formation', 30, y)
  doc.text('(Cachet et signature)', pageWidth - 70, y)
  y += 4
  doc.text('(Cachet et signature)', 30, y)
  y += 8
  
  // Tampon organisme
  try {
    doc.addImage(STAMP_BASE64, 'JPEG', 25, y, 50, 25)
  } catch (e) {}
  
  addFooter(doc, DOC_CODES.convention, doc.internal.getNumberOfPages())
  
  return doc
}

// ============================================================
// GÉNÉRER CERTIFICAT DE RÉALISATION - FORMAT EXACT
// ============================================================
function generateCertificat(session, trainee, trainer = null) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const course = session.courses || {}
  const client = session.clients || {}
  
  let y = addHeaderWithTitle(doc, 'CERTIFICAT DE RÉALISATION')
  
  y += 5
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  // Texte principal
  const introText = `Je soussigné, ${ORG.dirigeant}, représentant légal du dispensateur de l'action concourant au développement des compétences ${ORG.name}, ${ORG.address}`
  const introLines = doc.splitTextToSize(introText, 170)
  doc.text(introLines, 20, y)
  y += introLines.length * 5 + 8
  
  doc.text('Atteste que :', 20, y)
  y += 8
  
  // Nom du stagiaire
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`${trainee.first_name} ${(trainee.last_name || '').toUpperCase()}`, pageWidth / 2, y, { align: 'center' })
  y += 6
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Salarié(e) de l'entreprise ${client.name || ''}`, pageWidth / 2, y, { align: 'center' })
  y += 10
  
  doc.text(`A suivi l'action`, 20, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text(course.title || '', pageWidth / 2, y, { align: 'center' })
  y += 10
  
  doc.setFont('helvetica', 'normal')
  doc.text('Nature de l\'action concourant au développement des compétences :', 20, y)
  y += 8
  
  // Cases à cocher avec ☐
  const boxX = 25
  const lineHeight = 7
  
  // Option 1 : Action de formation (cochée)
  doc.setFillColor(0, 0, 0)
  doc.rect(boxX, y - 4, 5, 5, 'F') // Case remplie
  doc.setFont('helvetica', 'normal')
  doc.text('Action de formation', boxX + 8, y)
  y += lineHeight
  
  // Option 2 : Bilan de compétences (barré)
  doc.rect(boxX, y - 4, 5, 5) // Case vide
  const text1 = 'Bilan de compétences'
  doc.text(text1, boxX + 8, y)
  const tw1 = doc.getTextWidth(text1)
  doc.line(boxX + 8, y - 1.5, boxX + 8 + tw1, y - 1.5) // Barré
  y += lineHeight
  
  // Option 3 : Action de VAE (barré)
  doc.rect(boxX, y - 4, 5, 5)
  const text2 = 'Action de VAE'
  doc.text(text2, boxX + 8, y)
  const tw2 = doc.getTextWidth(text2)
  doc.line(boxX + 8, y - 1.5, boxX + 8 + tw2, y - 1.5)
  y += lineHeight
  
  // Option 4 : Action de formation par apprentissage (barré)
  doc.rect(boxX, y - 4, 5, 5)
  const text3 = 'Action de formation par apprentissage'
  doc.text(text3, boxX + 8, y)
  const tw3 = doc.getTextWidth(text3)
  doc.line(boxX + 8, y - 1.5, boxX + 8 + tw3, y - 1.5)
  y += 12
  
  // Dates
  doc.text(`Qui s'est déroulée du ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, 20, y)
  y += 6
  doc.text(`Pour une durée de ${course.duration_hours || 0} heures.`, 20, y)
  y += 10
  
  // Texte conservation
  const conservText = "Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m'engage à conserver l'ensemble des pièces justificatives ayant permis d'établir le présent certificat pendant une durée de 3 ans à compter de la fin de l'année du dernier paiement. En cas de cofinancement des fonds européens, la durée de conservation est étendue conformément aux obligations conventionnelles spécifiques."
  const conservLines = doc.splitTextToSize(conservText, 170)
  doc.text(conservLines, 20, y)
  y += conservLines.length * 5 + 10
  
  // Fait à / Le
  doc.text('Fait à : Concarneau', 20, y)
  y += 5
  doc.text(`Le : ${formatDate(session.end_date)}`, 20, y)
  y += 10
  
  // Signature et tampon
  doc.text('Cachet et signature du responsable du dispensateur de formation :', 20, y)
  y += 12
  
  doc.setFont('helvetica', 'bold')
  doc.text(`${ORG.dirigeant}, Dirigeant ${ORG.name}`, pageWidth - 20, y, { align: 'right' })
  
  const stampY = Math.min(y + 5, pageHeight - 60)
  try {
    doc.addImage(STAMP_BASE64, 'JPEG', pageWidth - 75, stampY, 55, 28)
  } catch (e) {}
  
  addFooter(doc, DOC_CODES.certificat)
  
  return doc
}

// ============================================================
// GÉNÉRER ÉMARGEMENT - AVEC DATES CENTRÉES + EMAIL
// ============================================================
function generateEmargement(session, trainees = [], trainer = null) {
  const doc = new jsPDF('landscape')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const course = session.courses || {}
  
  // Calculer les dates de formation
  const startDate = new Date(session.start_date)
  const endDate = new Date(session.end_date)
  const dates = []
  let currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  // En-tête
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(ORG.nameFull.toUpperCase(), 15, 15)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(ORG.address, 15, 20)
  doc.text(`Tél : ${ORG.phone} - ${ORG.email}`, 15, 25)
  
  // Titre
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('FEUILLE D\'ÉMARGEMENT', pageWidth / 2, 18, { align: 'center' })
  
  // Infos formation
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Formation : ${course.title || ''}`, pageWidth - 15, 15, { align: 'right' })
  doc.text(`Du ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, pageWidth - 15, 20, { align: 'right' })
  doc.text(`Lieu : ${session.location || ''}`, pageWidth - 15, 25, { align: 'right' })
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, pageWidth - 15, 30, { align: 'right' })
  
  // Calcul des colonnes
  // Colonnes: Nom Prénom | Entreprise | Email | Date1 Matin | Date1 AM | Date2 Matin | Date2 AM | ...
  const baseColWidth = 35
  const emailColWidth = 40
  const sigColWidth = 22
  const numDates = Math.min(dates.length, 5) // Max 5 dates par feuille
  
  // Construction des colonnes
  const columns = [
    { header: 'Nom Prénom', dataKey: 'name' },
    { header: 'Entreprise', dataKey: 'company' },
    { header: 'Email', dataKey: 'email' },
  ]
  
  // Ajouter colonnes pour chaque date (matin + après-midi)
  for (let i = 0; i < numDates; i++) {
    const dateStr = format(dates[i], 'dd/MM', { locale: fr })
    columns.push({ header: `${dateStr}\nMatin`, dataKey: `d${i}m` })
    columns.push({ header: `${dateStr}\nAprès-midi`, dataKey: `d${i}a` })
  }
  
  // Données
  const data = trainees.map(t => {
    const row = {
      name: `${(t.last_name || '').toUpperCase()} ${t.first_name || ''}`,
      company: t.company || '',
      email: '', // Vide pour écriture manuelle
    }
    for (let i = 0; i < numDates; i++) {
      row[`d${i}m`] = ''
      row[`d${i}a`] = ''
    }
    return row
  })
  
  // Ajouter des lignes vides si moins de 10 stagiaires
  while (data.length < 10) {
    const row = { name: '', company: '', email: '' }
    for (let i = 0; i < numDates; i++) {
      row[`d${i}m`] = ''
      row[`d${i}a`] = ''
    }
    data.push(row)
  }
  
  // Calcul des largeurs
  const columnStyles = {
    name: { cellWidth: baseColWidth },
    company: { cellWidth: 30 },
    email: { cellWidth: emailColWidth },
  }
  for (let i = 0; i < numDates; i++) {
    columnStyles[`d${i}m`] = { cellWidth: sigColWidth, halign: 'center' }
    columnStyles[`d${i}a`] = { cellWidth: sigColWidth, halign: 'center' }
  }
  
  doc.autoTable({
    columns: columns,
    body: data,
    startY: 38,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      minCellHeight: 12,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [50, 50, 50],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      minCellHeight: 14,
    },
    columnStyles: columnStyles,
    margin: { left: 10, right: 10 },
  })
  
  // Signature formateur en bas
  const finalY = doc.lastAutoTable.finalY + 10
  doc.setFontSize(9)
  doc.text('Signature du formateur :', 15, finalY)
  doc.rect(15, finalY + 2, 60, 20)
  
  // Légende
  doc.setFontSize(7)
  doc.text('Les stagiaires émargent par demi-journée pour attester de leur présence.', pageWidth / 2, pageHeight - 30, { align: 'center' })
  
  addFooter(doc, DOC_CODES.emargement)
  
  return doc
}

// ============================================================
// GÉNÉRER CONVOCATION
// ============================================================
function generateConvocation(session, trainee, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  const client = session.clients || {}
  
  let y = addHeaderWithTitle(doc, 'CONVOCATION À LA FORMATION')
  
  y += 5
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${trainee.first_name} ${trainee.last_name?.toUpperCase()}`, pageWidth / 2, y, { align: 'center' })
  y += 12
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Merci de vous présenter à la session de formation selon les informations suivantes :', pageWidth / 2, y, { align: 'center' })
  y += 15
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Intitulé de la formation : ${course.title || ''}`, 20, y)
  y += 8
  
  const startTime = formatTime(session.start_time) || '09h00'
  const endTime = formatTime(session.end_time) || '17h00'
  
  doc.text(`Date(s) de formation : ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, 20, y)
  y += 6
  doc.text(`Horaires : ${startTime} - ${endTime}`, 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Durée totale : ${course.duration_hours || 0} heures`, 20, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text(`Lieu de formation : ${session.location || ''}`, 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 20, y)
  y += 15
  
  doc.text(`Contact ${ORG.name} : ${ORG.phone} ou ${ORG.email}`, 20, y)
  y += 6
  
  if (client.contact_name) {
    doc.text(`Contact de votre entreprise : ${client.contact_name}${client.contact_function ? ' - ' + client.contact_function : ''}`, 20, y)
    y += 10
  }
  y += 5
  
  doc.text('Nous vous remercions pour votre ponctualité et votre participation active.', 20, y)
  y += 25
  
  doc.setFont('helvetica', 'bold')
  doc.text(`${ORG.dirigeant}`, pageWidth - 60, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Dirigeant ${ORG.name}`, pageWidth - 60, y)
  
  addFooter(doc, DOC_CODES.convocation)
  
  return doc
}

// ============================================================
// GÉNÉRER ATTESTATION DE PRÉSENCE
// ============================================================
function generateAttestation(session, trainee, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  const client = session.clients || {}
  
  let y = addHeaderWithTitle(doc, 'ATTESTATION DE PRÉSENCE')
  
  y += 10
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Je soussigné, ${ORG.dirigeant}, représentant l'organisme de formation ${ORG.name}, atteste que :`, 20, y)
  y += 15
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${trainee.first_name} ${trainee.last_name?.toUpperCase()}`, pageWidth / 2, y, { align: 'center' })
  y += 10
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Salarié(e) de l'entreprise ${client.name || ''}`, pageWidth / 2, y, { align: 'center' })
  y += 15
  
  doc.text('A suivi la formation :', pageWidth / 2, y, { align: 'center' })
  y += 10
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(course.title || '', pageWidth / 2, y, { align: 'center' })
  y += 15
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Du ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, pageWidth / 2, y, { align: 'center' })
  y += 6
  doc.text(`Durée : ${course.duration_hours || 0} heures`, pageWidth / 2, y, { align: 'center' })
  y += 6
  doc.text(`Lieu : ${session.location || ''}`, pageWidth / 2, y, { align: 'center' })
  y += 20
  
  doc.text(`Fait à Concarneau, le ${formatDate(session.end_date)}`, 20, y)
  y += 20
  
  doc.setFont('helvetica', 'bold')
  doc.text(`${ORG.dirigeant}`, pageWidth - 60, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Dirigeant ${ORG.name}`, pageWidth - 60, y)
  y += 10
  
  try {
    doc.addImage(STAMP_BASE64, 'JPEG', pageWidth - 75, y, 55, 28)
  } catch (e) {}
  
  addFooter(doc, DOC_CODES.attestation)
  
  return doc
}

// ============================================================
// GÉNÉRER PROGRAMME
// ============================================================
function generateProgramme(session, trainer = null) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  
  let y = addHeaderWithTitle(doc, 'PROGRAMME DE FORMATION')
  
  y += 5
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(course.title || '', pageWidth / 2, y, { align: 'center' })
  y += 15
  
  // Infos générales
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Informations générales', 20, y)
  y += 6
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Durée : ${course.duration_hours || 0} heures`, 25, y); y += 5
  doc.text(`Public visé : ${course.target_audience || 'Tout public'}`, 25, y); y += 5
  doc.text(`Prérequis : ${course.prerequisites || 'Aucun'}`, 25, y); y += 10
  
  // Objectifs
  doc.setFont('helvetica', 'bold')
  doc.text('Objectifs pédagogiques', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  y = displayObjectives(doc, course.objectives, 25, y, 165)
  y += 8
  
  // Contenu
  if (course.content) {
    doc.setFont('helvetica', 'bold')
    doc.text('Contenu de la formation', 20, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    const contentLines = doc.splitTextToSize(course.content, 165)
    doc.text(contentLines, 25, y)
    y += contentLines.length * 5 + 8
  }
  
  // Méthodes pédagogiques
  doc.setFont('helvetica', 'bold')
  doc.text('Moyens pédagogiques et techniques', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const methodsText = "Alternance d'apports théoriques et de mises en situation pratiques. Supports visuels, matériel spécifique selon le thème. Remise d'un livret de formation."
  const methodsLines = doc.splitTextToSize(methodsText, 165)
  doc.text(methodsLines, 25, y)
  y += methodsLines.length * 5 + 8
  
  // Modalités d'évaluation
  doc.setFont('helvetica', 'bold')
  doc.text("Modalités d'évaluation", 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('Évaluation formative continue. QCM et/ou mise en situation pratique.', 25, y)
  y += 10
  
  // Sanction
  if (course.certification) {
    doc.setFont('helvetica', 'bold')
    doc.text('Sanction de la formation', 20, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.text(course.certification, 25, y)
  }
  
  addFooter(doc, DOC_CODES.programme)
  
  return doc
}

// ============================================================
// GÉNÉRER ÉVALUATION À CHAUD - AVEC ☐
// ============================================================
function generateEvaluation(session, trainee = null) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  
  let y = addHeaderWithTitle(doc, 'QUESTIONNAIRE D\'ÉVALUATION À CHAUD')
  
  y += 3
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Formation : ${course.title || ''}`, 20, y)
  doc.text(`Date : ${formatDate(session.start_date)}`, pageWidth - 60, y)
  y += 5
  doc.text(`Stagiaire : ${trainee ? `${trainee.first_name} ${trainee.last_name}` : '________________________'}`, 20, y)
  y += 10
  
  // Questions avec cases ☐
  const questions = [
    "Les objectifs de la formation ont été atteints",
    "Le contenu était adapté à mes attentes",
    "Les méthodes pédagogiques étaient adaptées",
    "Le formateur maîtrisait son sujet",
    "Le formateur était à l'écoute du groupe",
    "Les supports de formation étaient de qualité",
    "Les conditions matérielles étaient satisfaisantes",
    "Je recommanderais cette formation"
  ]
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Évaluez de 1 (pas du tout) à 5 (tout à fait)', 20, y)
  y += 6
  
  // En-tête tableau
  const colX = [120, 135, 150, 165, 180]
  doc.setFont('helvetica', 'normal')
  doc.text('1', colX[0], y, { align: 'center' })
  doc.text('2', colX[1], y, { align: 'center' })
  doc.text('3', colX[2], y, { align: 'center' })
  doc.text('4', colX[3], y, { align: 'center' })
  doc.text('5', colX[4], y, { align: 'center' })
  y += 5
  
  doc.setFontSize(9)
  questions.forEach((q, idx) => {
    doc.text(`${idx + 1}. ${q}`, 20, y)
    // Cases ☐ au lieu de &
    colX.forEach(x => {
      doc.rect(x - 3, y - 3.5, 5, 5) // Case vide
    })
    y += 8
  })
  
  y += 5
  
  // Points forts / axes d'amélioration
  doc.setFont('helvetica', 'bold')
  doc.text('Points forts de la formation :', 20, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.rect(20, y, 170, 20)
  y += 25
  
  doc.setFont('helvetica', 'bold')
  doc.text("Axes d'amélioration :", 20, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.rect(20, y, 170, 20)
  y += 25
  
  doc.setFont('helvetica', 'bold')
  doc.text('Commentaires libres :', 20, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.rect(20, y, 170, 25)
  
  addFooter(doc, DOC_CODES.evaluation)
  
  return doc
}

// ============================================================
// GÉNÉRER ÉVALUATION À FROID - AVEC ☐
// ============================================================
function generateEvaluationFroid(session, trainee = null) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  
  let y = addHeaderWithTitle(doc, 'QUESTIONNAIRE D\'ÉVALUATION À FROID')
  
  y += 3
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('À compléter 3 mois après la formation', pageWidth / 2, y, { align: 'center' })
  y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Formation suivie : ${course.title || ''}`, 20, y)
  y += 5
  doc.text(`Date de la formation : ${formatDate(session.start_date)}`, 20, y)
  y += 5
  doc.text(`Stagiaire : ${trainee ? `${trainee.first_name} ${trainee.last_name}` : '________________________'}`, 20, y)
  y += 12
  
  const questions = [
    "J'ai pu mettre en pratique les acquis de la formation",
    "La formation a eu un impact positif sur mon travail",
    "Les compétences acquises sont toujours utiles aujourd'hui",
    "Je me sens plus à l'aise dans les situations concernées",
    "La formation a répondu aux besoins identifiés initialement"
  ]
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Évaluez de 1 (pas du tout) à 5 (tout à fait)', 20, y)
  y += 6
  
  const colX = [120, 135, 150, 165, 180]
  doc.setFont('helvetica', 'normal')
  doc.text('1', colX[0], y, { align: 'center' })
  doc.text('2', colX[1], y, { align: 'center' })
  doc.text('3', colX[2], y, { align: 'center' })
  doc.text('4', colX[3], y, { align: 'center' })
  doc.text('5', colX[4], y, { align: 'center' })
  y += 5
  
  doc.setFontSize(9)
  questions.forEach((q, idx) => {
    doc.text(`${idx + 1}. ${q}`, 20, y)
    colX.forEach(x => {
      doc.rect(x - 3, y - 3.5, 5, 5)
    })
    y += 8
  })
  
  y += 8
  
  doc.setFont('helvetica', 'bold')
  doc.text('Exemples concrets d\'application des acquis :', 20, y)
  y += 4
  doc.rect(20, y, 170, 25)
  y += 30
  
  doc.setFont('helvetica', 'bold')
  doc.text('Difficultés rencontrées dans l\'application :', 20, y)
  y += 4
  doc.rect(20, y, 170, 25)
  y += 30
  
  doc.setFont('helvetica', 'bold')
  doc.text('Besoins complémentaires de formation :', 20, y)
  y += 4
  doc.rect(20, y, 170, 20)
  
  addFooter(doc, DOC_CODES.evaluationFroid)
  
  return doc
}

// ============================================================
// GÉNÉRER RÈGLEMENT INTÉRIEUR
// ============================================================
function generateReglement() {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  let y = addHeaderWithTitle(doc, 'RÈGLEMENT INTÉRIEUR')
  
  const sections = [
    {
      title: 'Article 1 - Objet et champ d\'application',
      content: 'Le présent règlement intérieur s\'applique à toutes les personnes participant à une action de formation organisée par Access Formation. Il a vocation à préciser certaines dispositions relatives à la santé et la sécurité, ainsi que les règles relatives à la discipline.'
    },
    {
      title: 'Article 2 - Assiduité et ponctualité',
      content: 'Les stagiaires doivent se conformer aux horaires fixés et communiqués au préalable. Toute absence ou retard doit être justifié auprès du formateur ou du responsable de formation. En cas d\'absence non justifiée, l\'organisme de formation se réserve le droit d\'en informer l\'employeur et/ou le financeur.'
    },
    {
      title: 'Article 3 - Comportement',
      content: 'Il est demandé aux stagiaires d\'avoir un comportement garantissant le respect des règles élémentaires de savoir-vivre et de savoir-être en collectivité. Sont notamment interdits : les comportements agressifs ou irrespectueux, l\'utilisation du téléphone portable pendant les sessions (sauf autorisation), la consommation d\'alcool ou de substances illicites.'
    },
    {
      title: 'Article 4 - Sécurité',
      content: 'Chaque stagiaire doit veiller à sa sécurité personnelle et à celle des autres en respectant les consignes générales et particulières de sécurité et d\'hygiène en vigueur sur le lieu de formation. Il est interdit de fumer dans les locaux de formation.'
    },
    {
      title: 'Article 5 - Sanctions',
      content: 'Tout manquement aux dispositions du présent règlement pourra faire l\'objet d\'une sanction. Les sanctions applicables sont : l\'avertissement, l\'exclusion temporaire ou définitive de la formation. L\'exclusion sera prononcée après entretien avec le stagiaire.'
    },
    {
      title: 'Article 6 - Réclamations',
      content: 'Les réclamations relatives à l\'application du présent règlement peuvent être adressées au responsable de l\'organisme de formation par courrier ou par email à l\'adresse : contact@accessformation.pro'
    },
    {
      title: 'Article 7 - Publicité',
      content: 'Le présent règlement est remis à chaque stagiaire avant toute inscription définitive. Un exemplaire est disponible dans les locaux de l\'organisme de formation.'
    }
  ]
  
  doc.setFontSize(9)
  
  sections.forEach((section, idx) => {
    if (y > pageHeight - 50) {
      addFooter(doc, DOC_CODES.reglement, doc.internal.getNumberOfPages())
      doc.addPage()
      y = 20
    }
    
    doc.setFont('helvetica', 'bold')
    doc.text(section.title, 20, y)
    y += 5
    
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(section.content, 170)
    doc.text(lines, 20, y)
    y += lines.length * 4 + 8
  })
  
  addFooter(doc, DOC_CODES.reglement, doc.internal.getNumberOfPages())
  
  return doc
}

// ============================================================
// GÉNÉRER LIVRET D'ACCUEIL
// ============================================================
function generateLivret(session = null) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const course = session?.courses || {}
  
  let y = addHeaderWithTitle(doc, 'LIVRET D\'ACCUEIL DU STAGIAIRE')
  
  // Bienvenue
  y += 5
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Bienvenue !', pageWidth / 2, y, { align: 'center' })
  y += 8
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const welcomeText = `Nous sommes heureux de vous accueillir au sein de ${ORG.name}. Ce livret a pour objectif de vous présenter notre organisme et de vous accompagner durant votre formation.`
  const welcomeLines = doc.splitTextToSize(welcomeText, 170)
  doc.text(welcomeLines, 20, y)
  y += welcomeLines.length * 5 + 10
  
  // Présentation
  doc.setFont('helvetica', 'bold')
  doc.text('Présentation de l\'organisme', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const presentText = `${ORG.nameFull} est un organisme de formation spécialisé dans les formations en sécurité et prévention des risques professionnels : SST, habilitations électriques, CACES, incendie, gestes et postures, etc.`
  const presentLines = doc.splitTextToSize(presentText, 170)
  doc.text(presentLines, 20, y)
  y += presentLines.length * 5 + 10
  
  // Contact
  doc.setFont('helvetica', 'bold')
  doc.text('Vos contacts', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Responsable pédagogique : ${ORG.dirigeant}`, 25, y); y += 5
  doc.text(`Téléphone : ${ORG.phone}`, 25, y); y += 5
  doc.text(`Email : ${ORG.email}`, 25, y); y += 5
  doc.text(`Référent handicap : ${ORG.dirigeant}`, 25, y); y += 10
  
  // Déroulement
  doc.setFont('helvetica', 'bold')
  doc.text('Déroulement de votre formation', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const deroulementText = 'Votre formation alterne apports théoriques et exercices pratiques. Une feuille d\'émargement vous sera présentée chaque demi-journée. Un questionnaire d\'évaluation vous sera remis en fin de formation.'
  const deroulementLines = doc.splitTextToSize(deroulementText, 170)
  doc.text(deroulementLines, 20, y)
  y += deroulementLines.length * 5 + 10
  
  // Règles
  doc.setFont('helvetica', 'bold')
  doc.text('Règles de vie', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('• Respecter les horaires', 25, y); y += 5
  doc.text('• Éteindre son téléphone portable', 25, y); y += 5
  doc.text('• Respecter les consignes de sécurité', 25, y); y += 5
  doc.text('• Adopter un comportement respectueux', 25, y); y += 10
  
  // Réclamations
  doc.setFont('helvetica', 'bold')
  doc.text('Réclamations', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const reclaText = `Pour toute réclamation, vous pouvez contacter : ${ORG.email}. Nous nous engageons à traiter votre demande dans les meilleurs délais.`
  const reclaLines = doc.splitTextToSize(reclaText, 170)
  doc.text(reclaLines, 20, y)
  
  addFooter(doc, DOC_CODES.livret)
  
  return doc
}

// ============================================================
// GÉNÉRER ANALYSE DU BESOIN
// ============================================================
function generateAnalyseBesoin(session = null, isBlank = false) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const client = session?.clients || {}
  const course = session?.courses || {}
  
  let y = addHeaderWithTitle(doc, 'ANALYSE DU BESOIN DE FORMATION')
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text('Indicateur 4 - Référentiel Qualiopi', pageWidth - 20, y - 8, { align: 'right' })
  
  // Section 1 - Identification
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('1. IDENTIFICATION DU DEMANDEUR', 20, y)
  y += 6
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const blank = isBlank ? '________________________' : ''
  doc.text(`Entreprise : ${isBlank ? blank : (client.name || blank)}`, 25, y); y += 5
  doc.text(`Contact : ${isBlank ? blank : (client.contact_name || blank)}`, 25, y); y += 5
  doc.text(`Fonction : ${isBlank ? blank : (client.contact_function || blank)}`, 25, y); y += 5
  doc.text(`Email : ${isBlank ? blank : (client.email || blank)}`, 25, y); y += 5
  doc.text(`Téléphone : ${isBlank ? blank : (client.phone || blank)}`, 25, y); y += 5
  doc.text(`Date de l'entretien : ${isBlank ? formatDateEmpty() : formatDate(new Date())}`, 25, y); y += 10
  
  // Section 2 - Formation demandée
  doc.setFont('helvetica', 'bold')
  doc.text('2. FORMATION DEMANDÉE', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Intitulé souhaité : ${isBlank ? blank : (course.title || blank)}`, 25, y); y += 5
  doc.text(`Nombre de participants prévus : ${isBlank ? '____' : (session?.trainees_count || '____')}`, 25, y); y += 5
  doc.text(`Dates souhaitées : ${isBlank ? formatDateEmpty() : formatDate(session?.start_date)}`, 25, y); y += 5
  doc.text(`Lieu envisagé : ${isBlank ? blank : (session?.location || blank)}`, 25, y); y += 10
  
  // Section 3 - Contexte
  doc.setFont('helvetica', 'bold')
  doc.text('3. CONTEXTE DE LA DEMANDE', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('Origine de la demande :', 25, y); y += 5
  doc.rect(30, y - 3.5, 4, 4); doc.text('Obligation réglementaire', 36, y); y += 5
  doc.rect(30, y - 3.5, 4, 4); doc.text('Besoin identifié en interne', 36, y); y += 5
  doc.rect(30, y - 3.5, 4, 4); doc.text('Accident / incident', 36, y); y += 5
  doc.rect(30, y - 3.5, 4, 4); doc.text('Évolution de poste', 36, y); y += 5
  doc.rect(30, y - 3.5, 4, 4); doc.text('Autre : ________________________', 36, y); y += 10
  
  // Section 4 - Objectifs
  doc.setFont('helvetica', 'bold')
  doc.text('4. OBJECTIFS ATTENDUS', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('Compétences à acquérir / renforcer :', 25, y); y += 4
  doc.rect(25, y, 165, 20)
  y += 25
  
  doc.text('Résultats concrets attendus :', 25, y); y += 4
  doc.rect(25, y, 165, 15)
  y += 20
  
  // Section 5 - Profil
  doc.setFont('helvetica', 'bold')
  doc.text('5. PROFIL DES STAGIAIRES', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('Fonctions / postes concernés : ________________________', 25, y); y += 5
  doc.text('Niveau de connaissance actuel : ________________________', 25, y); y += 5
  doc.text('Contraintes particulières (handicap, horaires...) : ________________________', 25, y); y += 10
  
  if (y > pageHeight - 70) {
    addFooter(doc, DOC_CODES.analyseBesoin, 1)
    doc.addPage()
    y = 20
  }
  
  // Section 6 - Contraintes
  doc.setFont('helvetica', 'bold')
  doc.text('6. CONTRAINTES ET MOYENS', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('Budget disponible : ________________________', 25, y); y += 5
  doc.text('Financement prévu (OPCO, entreprise...) : ________________________', 25, y); y += 5
  doc.text('Moyens mis à disposition (salle, matériel...) : ________________________', 25, y); y += 10
  
  // Section 7 - Synthèse
  doc.setFont('helvetica', 'bold')
  doc.text('7. SYNTHÈSE ET VALIDATION', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('Formation proposée : ________________________', 25, y); y += 5
  doc.text('Adaptation prévue : ________________________', 25, y); y += 5
  doc.text('Devis n° : ________________________', 25, y); y += 15
  
  // Signatures
  doc.text('Pour l\'entreprise :', 25, y)
  doc.text('Pour Access Formation :', pageWidth / 2 + 20, y)
  y += 4
  doc.rect(25, y, 70, 20)
  doc.rect(pageWidth / 2 + 20, y, 70, 20)
  
  addFooter(doc, DOC_CODES.analyseBesoin, doc.internal.getNumberOfPages())
  
  return doc
}

// ============================================================
// TESTS DE POSITIONNEMENT
// ============================================================
function generatePositionnementGeneric(title, questions, docCode, session = null, isBlank = false) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  let y = addHeaderWithTitle(doc, title)
  
  // Référence session en haut à droite
  if (session?.reference && !isBlank) {
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(session.reference, pageWidth - 15, 15, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }
  
  // Infos stagiaire
  doc.setFontSize(10)
  doc.text('Nom : ' + (isBlank ? '________________________' : ''), 20, y)
  doc.text('Prénom : ' + (isBlank ? '________________________' : ''), pageWidth/2, y)
  y += 7
  doc.text('Date : ' + (isBlank ? '___/___/______' : ''), 20, y)
  doc.text('Formation : ' + (isBlank ? '________________________' : (session?.courses?.title || '')), pageWidth/2, y)
  y += 15
  
  // Questions
  questions.forEach((q, idx) => {
    if (y > pageHeight - 60) {
      addFooter(doc, docCode, doc.internal.getNumberOfPages())
      doc.addPage()
      y = 25
    }
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`${idx + 1}. ${q.question}`, 20, y)
    y += 6
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    
    if (q.options) {
      q.options.forEach(opt => {
        doc.text(`☐  ${opt}`, 30, y)
        y += 5
      })
    }
    
    if (q.openAnswer) {
      doc.rect(25, y, 165, 15)
      y += 20
    }
    
    y += 5
  })
  
  addFooter(doc, docCode, doc.internal.getNumberOfPages())
  return doc
}

function generatePositionnementSST(session = null, isBlank = false) {
  const questions = [
    { question: 'Que signifie SST ?', options: ['Sauveteur Secouriste du Travail', 'Service de Sécurité au Travail', 'Système de Santé du Travailleur'] },
    { question: 'Quel est le premier réflexe face à un accident ?', options: ['Protéger', 'Alerter', 'Secourir'] },
    { question: 'Qui peut pratiquer les gestes de premiers secours ?', options: ['Uniquement les médecins', 'Tout citoyen formé', 'Uniquement les pompiers'] },
    { question: 'La PLS signifie :', options: ['Position Latérale de Sécurité', 'Premiers gestes de Libération et Secours', 'Protection Locale et Sécuritaire'] },
    { question: 'En cas d\'hémorragie, il faut :', options: ['Appuyer fortement sur la plaie', 'Mettre la victime debout', 'Donner à boire'] },
    { question: 'Décrivez les étapes de la chaîne de secours :', openAnswer: true },
    { question: 'Quels sont les numéros d\'urgence en France ?', openAnswer: true }
  ]
  return generatePositionnementGeneric('TEST DE POSITIONNEMENT - SST', questions, DOC_CODES.positionnementSST, session, isBlank)
}

function generatePositionnementIncendie(session = null, isBlank = false) {
  const questions = [
    { question: 'Quels sont les 3 éléments du triangle du feu ?', options: ['Combustible, Comburant, Énergie', 'Eau, Terre, Air', 'Chaleur, Fumée, Flamme'] },
    { question: 'Quel extincteur utiliser sur un feu électrique ?', options: ['Eau pulvérisée', 'CO2', 'Mousse'] },
    { question: 'Que faire en cas de début d\'incendie ?', options: ['Fuir immédiatement', 'Donner l\'alerte et tenter d\'éteindre', 'Ouvrir les fenêtres'] },
    { question: 'Le point de rassemblement sert à :', options: ['Comptabiliser les personnes', 'Stocker le matériel', 'Appeler les secours'] },
    { question: 'Un RIA est :', options: ['Un Robinet d\'Incendie Armé', 'Un Registre Incendie Annuel', 'Un Rapport d\'Inspection Automatique'] },
    { question: 'Décrivez la procédure d\'évacuation de votre entreprise :', openAnswer: true }
  ]
  return generatePositionnementGeneric('TEST DE POSITIONNEMENT - INCENDIE / ÉVACUATION', questions, DOC_CODES.positionnementIncendie, session, isBlank)
}

function generatePositionnementGP(session = null, isBlank = false) {
  const questions = [
    { question: 'Les TMS signifient :', options: ['Troubles Musculo-Squelettiques', 'Techniques de Manutention Sécurisée', 'Tests de Mobilité et Souplesse'] },
    { question: 'La bonne posture pour soulever une charge est :', options: ['Dos droit, genoux fléchis', 'Dos courbé, jambes tendues', 'Bras tendus, dos en torsion'] },
    { question: 'Le poids maximum recommandé pour un homme est :', options: ['25 kg', '55 kg', '15 kg'] },
    { question: 'Les zones du corps les plus touchées par les TMS sont :', options: ['Dos, épaules, poignets', 'Yeux, oreilles, nez', 'Pieds, chevilles, genoux'] },
    { question: 'Pour réduire les risques, il faut :', options: ['Utiliser des aides mécaniques', 'Porter plus lourd pour s\'entraîner', 'Travailler plus vite'] },
    { question: 'Décrivez une situation à risque dans votre travail :', openAnswer: true }
  ]
  return generatePositionnementGeneric('TEST DE POSITIONNEMENT - GESTES ET POSTURES', questions, DOC_CODES.positionnementGP, session, isBlank)
}

function generatePositionnementElec(session = null, isBlank = false) {
  const questions = [
    { question: 'Que signifie B0H0V ?', options: ['Non électricien travaillant en zone électrique', 'Électricien haute tension', 'Basse tension niveau 0'] },
    { question: 'La tension dangereuse en courant alternatif est :', options: ['Au-dessus de 50V', 'Au-dessus de 1000V', 'Au-dessus de 12V'] },
    { question: 'Avant d\'intervenir sur une installation, il faut :', options: ['Consigner l\'installation', 'Mettre des gants', 'Prévenir un collègue'] },
    { question: 'L\'habilitation électrique est :', options: ['Délivrée par l\'employeur', 'Obtenue après un examen médical', 'Valable à vie'] },
    { question: 'Un EPI pour travaux électriques est :', options: ['Des gants isolants', 'Un casque de chantier', 'Des chaussures de sport'] },
    { question: 'Citez les 5 règles de sécurité pour une intervention :', openAnswer: true }
  ]
  return generatePositionnementGeneric('TEST DE POSITIONNEMENT - HABILITATION ÉLECTRIQUE', questions, DOC_CODES.positionnementElec, session, isBlank)
}

function generatePositionnementCaces(type = 'R489', session = null, isBlank = false) {
  const docCode = type === 'R485' ? DOC_CODES.positionnementR485 : DOC_CODES.positionnementR489
  const questions = [
    { question: 'Que signifie CACES ?', options: ['Certificat d\'Aptitude à la Conduite En Sécurité', 'Contrôle Annuel des Chariots En Service', 'Certification Automobile et Cariste'] },
    { question: 'Avant d\'utiliser un chariot, il faut :', options: ['Vérifier l\'état du chariot', 'Faire le plein', 'Appeler le chef'] },
    { question: 'La charge maximale d\'un chariot est indiquée sur :', options: ['La plaque de charge', 'Le manuel', 'Le volant'] },
    { question: 'Pour circuler en sécurité, les fourches doivent être :', options: ['Au ras du sol', 'À hauteur d\'homme', 'Le plus haut possible'] },
    { question: 'Le port de la ceinture de sécurité est :', options: ['Obligatoire', 'Optionnel', 'Réservé aux débutants'] },
    { question: 'Décrivez la procédure de prise de poste :', openAnswer: true }
  ]
  return generatePositionnementGeneric(`TEST DE POSITIONNEMENT - CACES ${type}`, questions, docCode, session, isBlank)
}

// ============================================================
// ÉVALUATION FORMATEUR
// ============================================================
function generateEvaluationFormateur(session = null, isBlank = false) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  let y = addHeaderWithTitle(doc, 'ÉVALUATION DE LA SESSION PAR LE FORMATEUR')
  
  // Référence session
  if (session?.reference && !isBlank) {
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(session.reference, pageWidth - 15, 15, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }
  
  // Infos session
  doc.setFontSize(10)
  doc.text('Formation : ' + (isBlank ? '________________________' : (session?.courses?.title || '')), 20, y)
  y += 7
  doc.text('Date(s) : ' + (isBlank ? '___/___/______ au ___/___/______' : ''), 20, y)
  doc.text('Lieu : ' + (isBlank ? '________________________' : (session?.location || '')), pageWidth/2, y)
  y += 7
  doc.text('Client : ' + (isBlank ? '________________________' : (session?.clients?.name || '')), 20, y)
  y += 7
  doc.text('Formateur : ' + (isBlank ? '________________________' : ''), 20, y)
  y += 15
  
  // Critères d'évaluation
  doc.setFont('helvetica', 'bold')
  doc.text('Évaluez chaque critère de 1 (insuffisant) à 5 (excellent) :', 20, y)
  y += 10
  
  const criteres = [
    'Motivation et implication du groupe',
    'Niveau général des stagiaires',
    'Conditions matérielles (salle, équipements)',
    'Organisation logistique',
    'Documentation et supports fournis',
    'Appréciation globale de la session'
  ]
  
  doc.setFont('helvetica', 'normal')
  criteres.forEach(critere => {
    doc.text(critere, 25, y)
    // Cases à cocher 1-5
    for (let i = 1; i <= 5; i++) {
      doc.text(`☐ ${i}`, 140 + (i-1) * 12, y)
    }
    y += 8
  })
  
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text('Commentaires et observations :', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(20, y, 170, 40)
  y += 50
  
  doc.text('Points positifs :', 20, y)
  y += 5
  doc.rect(20, y, 170, 25)
  y += 35
  
  doc.text('Points à améliorer :', 20, y)
  y += 5
  doc.rect(20, y, 170, 25)
  y += 35
  
  // Signature
  doc.text('Date : ___/___/______', 20, y)
  doc.text('Signature du formateur :', pageWidth/2, y)
  y += 5
  doc.rect(pageWidth/2, y, 60, 20)
  
  addFooter(doc, 'AF-EVALF', 1)
  return doc
}

// ============================================================
// TÉLÉCHARGER UN DOCUMENT
// ============================================================
export function downloadDocument(docType, session, options = {}) {
  const { trainees = [], trainee = null, trainer = null, isBlank = false } = options
  
  let doc, filename
  const ref = session?.reference || 'VIERGE'
  
  switch (docType) {
    case 'convention':
      doc = generateConvention(session, trainees, trainer)
      filename = `Convention_${ref}.pdf`
      break
    case 'certificat':
      doc = generateCertificat(session, trainee, trainer)
      filename = `Certificat_${ref}_${trainee?.last_name || ''}.pdf`
      break
    case 'emargement':
      doc = generateEmargement(session, trainees, trainer)
      filename = `Emargement_${ref}.pdf`
      break
    case 'convocation':
      doc = generateConvocation(session, trainee, trainer)
      filename = `Convocation_${ref}_${trainee?.last_name || ''}.pdf`
      break
    case 'attestation':
      doc = generateAttestation(session, trainee, trainer)
      filename = `Attestation_${ref}_${trainee?.last_name || ''}.pdf`
      break
    case 'programme':
      doc = generateProgramme(session, trainer)
      filename = `Programme_${ref}.pdf`
      break
    case 'evaluation':
      doc = generateEvaluation(session, trainee)
      filename = `Evaluation_${ref}.pdf`
      break
    case 'evaluationFroid':
      doc = generateEvaluationFroid(session, trainee)
      filename = `EvaluationFroid_${ref}.pdf`
      break
    case 'reglement':
      doc = generateReglement()
      filename = 'Reglement_Interieur.pdf'
      break
    case 'livret':
      doc = generateLivret(session)
      filename = `Livret_Accueil_${ref}.pdf`
      break
    case 'analyseBesoin':
      doc = generateAnalyseBesoin(session, isBlank)
      filename = isBlank ? 'Analyse_Besoin_Vierge.pdf' : `Analyse_Besoin_${ref}.pdf`
      break
    case 'positionnementSST':
      doc = generatePositionnementSST(session, isBlank)
      filename = isBlank ? 'Positionnement_SST_Vierge.pdf' : `Positionnement_SST_${ref}.pdf`
      break
    case 'positionnementIncendie':
      doc = generatePositionnementIncendie(session, isBlank)
      filename = isBlank ? 'Positionnement_Incendie_Vierge.pdf' : `Positionnement_Incendie_${ref}.pdf`
      break
    case 'positionnementGP':
      doc = generatePositionnementGP(session, isBlank)
      filename = isBlank ? 'Positionnement_GP_Vierge.pdf' : `Positionnement_GP_${ref}.pdf`
      break
    case 'positionnementElec':
      doc = generatePositionnementElec(session, isBlank)
      filename = isBlank ? 'Positionnement_Elec_Vierge.pdf' : `Positionnement_Elec_${ref}.pdf`
      break
    case 'positionnementR485':
      doc = generatePositionnementCaces('R485', session, isBlank)
      filename = isBlank ? 'Positionnement_R485_Vierge.pdf' : `Positionnement_R485_${ref}.pdf`
      break
    case 'positionnementR489':
      doc = generatePositionnementCaces('R489', session, isBlank)
      filename = isBlank ? 'Positionnement_R489_Vierge.pdf' : `Positionnement_R489_${ref}.pdf`
      break
    case 'evaluationFormateur':
      doc = generateEvaluationFormateur(session, isBlank)
      filename = isBlank ? 'Evaluation_Formateur_Vierge.pdf' : `Evaluation_Formateur_${ref}.pdf`
      break
    default:
      console.error('Type de document inconnu:', docType)
      return
  }
  
  if (doc) {
    doc.save(filename)
  }
}

export function downloadAllDocuments(docType, session, trainees, options = {}) {
  const { trainer = null } = options
  
  trainees.forEach(trainee => {
    downloadDocument(docType, session, { trainee, trainer })
  })
}
