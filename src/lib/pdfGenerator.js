import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ============================================================
// VERSION ET CODES DOCUMENTS
// ============================================================
const APP_VERSION = 'V2.2'
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
  nda: '53 29 10261 29',
  ndaFull: '53 29 10261 29 auprès du préfet de la région Bretagne',
  iban: 'FR76 1558 9297 0600 0890 6894 048',
  bic: 'CMBRFR2BXXXX',
  dirigeant: 'Hicham SAIDI',
}

// Format date
const formatDate = (date) => {
  if (!date) return ''
  return format(new Date(date), 'dd/MM/yyyy')
}

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
  // Logo à gauche
  try {
    doc.addImage(LOGO_BASE64, 'JPEG', 15, 10, 35, 35)
  } catch (e) {
    console.warn('Logo error:', e)
  }
  
  // Infos organisme à droite du logo
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
  
  // Bandeau noir
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
// PIED DE PAGE AVEC CODE VERSION
// ============================================================
function addFooter(doc, docCode, pageNum = null) {
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(15, pageHeight - 28, pageWidth - 15, pageHeight - 28)
  
  // Infos en pied de page
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  
  doc.text(`${ORG.name} - ${ORG.addressFull}`, pageWidth / 2, pageHeight - 23, { align: 'center' })
  doc.text(`Déclaration d'activité enregistrée sous le numéro ${ORG.ndaFull}`, pageWidth / 2, pageHeight - 19, { align: 'center' })
  doc.text(`SARL au capital de ${ORG.capital} - Siret : ${ORG.siret} - Naf : ${ORG.naf} - TVA : ${ORG.tva} - RCS ${ORG.rcs}`, pageWidth / 2, pageHeight - 15, { align: 'center' })
  doc.text(`Tel : ${ORG.phone} - Email : ${ORG.email}`, pageWidth / 2, pageHeight - 11, { align: 'center' })
  
  // Code version en filigrane (bas droite)
  doc.setFontSize(6)
  doc.setTextColor(180, 180, 180)
  doc.text(`${docCode}-${APP_VERSION}`, pageWidth - 15, pageHeight - 5, { align: 'right' })
  
  // Numéro de page si fourni
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
  // Découper par retour à la ligne et filtrer les lignes vides
  return objectives.split('\n').filter(obj => obj.trim() !== '').map(obj => obj.trim())
}

// Fonction pour afficher les objectifs avec retour à la ligne automatique
function displayObjectives(doc, objectives, startX, startY, maxWidth) {
  let y = startY
  const formattedObjs = formatObjectives(objectives)
  
  formattedObjs.forEach((obj) => {
    // Ajouter le bullet et calculer la largeur restante
    const bulletText = '• '
    const bulletWidth = doc.getTextWidth(bulletText)
    
    // Diviser le texte pour qu'il tienne dans la largeur
    const lines = doc.splitTextToSize(obj, maxWidth - bulletWidth - 5)
    
    // Première ligne avec bullet
    doc.text(bulletText + lines[0], startX, y)
    y += 5
    
    // Lignes suivantes indentées (sans bullet)
    for (let i = 1; i < lines.length; i++) {
      doc.text('  ' + lines[i], startX, y)
      y += 5
    }
  })
  
  return y
}

// ============================================================
// GÉNÉRER CONVENTION DE FORMATION
// ============================================================
function generateConvention(session, client, trainees, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  
  // Déterminer le prix (override ou prix formation)
  const priceHT = session.price_override_enabled && session.price_override 
    ? session.price_override 
    : (course.price_ht || null)
  const priceDisplay = priceHT ? `${priceHT} € HT` : '__________ € HT'
  
  // ========== PAGE 1 ==========
  let y = addHeaderWithTitle(doc, 'CONVENTION DE FORMATION PROFESSIONNELLE')
  
  // Sous-titre
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text("Conformément aux articles L6353-1 à L6353-9 et D6313-3-1 du Code du travail", pageWidth / 2, y, { align: 'center' })
  y += 12
  
  // Entre les soussignés
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('ENTRE LES SOUSSIGNÉS :', 20, y)
  y += 10
  
  // Organisme de formation
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text("L'Organisme de formation :", 20, y)
  y += 6
  
  doc.setFont('helvetica', 'normal')
  doc.text(`${ORG.nameFull}`, 25, y)
  y += 5
  doc.text(`Adresse : ${ORG.address}`, 25, y)
  y += 5
  doc.text(`N° de déclaration d'activité : ${ORG.ndaFull}`, 25, y)
  y += 5
  doc.text(`N° SIRET : ${ORG.siret}`, 25, y)
  y += 5
  doc.text(`Représenté par : ${ORG.dirigeant}, Dirigeant`, 25, y)
  y += 5
  doc.text(`Tél. : ${ORG.phone} – Courriel : ${ORG.email}`, 25, y)
  y += 5
  doc.setFont('helvetica', 'italic')
  doc.text('Ci-après dénommé "l\'Organisme de Formation"', 25, y)
  y += 10
  
  // Client
  doc.setFont('helvetica', 'bold')
  doc.text('ET', 20, y)
  y += 8
  
  doc.text('Le Bénéficiaire :', 20, y)
  y += 6
  
  doc.setFont('helvetica', 'normal')
  doc.text(`${client?.name || ''}`, 25, y)
  y += 5
  doc.text(`Adresse : ${client?.address || ''} ${client?.postal_code || ''} ${client?.city || ''}`, 25, y)
  y += 5
  if (client?.contact_name) {
    doc.text(`Représentée par : ${client.contact_name}`, 25, y)
    y += 5
  }
  if (client?.contact_function) {
    doc.text(`Fonction : ${client.contact_function}`, 25, y)
    y += 5
  }
  doc.text(`N° SIRET : ${client?.siret || ''}`, 25, y)
  y += 5
  doc.setFont('helvetica', 'italic')
  doc.text('Ci-après dénommé "le Bénéficiaire"', 25, y)
  y += 12
  
  doc.setFont('helvetica', 'normal')
  doc.text('Il a été convenu ce qui suit :', 20, y)
  
  addFooter(doc, DOC_CODES.convention, 1)
  
  // ========== PAGE 2 ==========
  doc.addPage()
  y = addHeaderWithTitle(doc, 'CONVENTION DE FORMATION PROFESSIONNELLE')
  
  // Article 1
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Article 1 – Objet, durée et effectif de la formation', 20, y)
  y += 7
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Le Bénéficiaire souhaite faire participer une partie de son personnel à la formation suivante :', 20, y)
  y += 8
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Intitulé : ${course.title || ''}`, 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Type d'action : Action de formation`, 20, y)
  y += 5
  
  // Objectifs - avec retour à la ligne automatique
  if (course.objectives) {
    doc.text(`Objectif(s) professionnel(s) :`, 20, y)
    y += 5
    y = displayObjectives(doc, course.objectives, 25, y, 160)
  }
  y += 3
  
  // Liste des stagiaires
  doc.setFont('helvetica', 'bold')
  doc.text('Liste des apprenants désignés par le Bénéficiaire :', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  
  if (trainees && trainees.length > 0) {
    trainees.forEach(trainee => {
      doc.text(`   • ${trainee.first_name} ${trainee.last_name?.toUpperCase()}`, 25, y)
      y += 5
    })
  }
  y += 5
  
  // Infos pratiques
  const startTime = formatTime(session.start_time) || '09h00'
  const endTime = formatTime(session.end_time) || '17h00'
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Durée (heures) : ${course.duration_hours || ''}`, 20, y)
  y += 5
  doc.text(`Dates du : ${formatDate(session.start_date)} au : ${formatDate(session.end_date)}  Horaires : ${startTime} - ${endTime}`, 20, y)
  y += 5
  doc.text(`Effectif (participants) : ${trainees?.length || 0}`, 20, y)
  y += 5
  doc.text(`Lieu : ${session.location || ''}`, 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Public concerné : ${course.target_audience || 'Tout public'}`, 20, y)
  y += 5
  doc.text(`Prérequis : ${course.prerequisites || 'Aucun'}`, 20, y)
  y += 5
  doc.text(`Formateur référent : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 20, y)
  y += 12
  
  // Article 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Article 2 – Engagements des parties', 20, y)
  y += 7
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const art2Text = `Le Bénéficiaire s'engage à assurer la présence des stagiaires inscrits et à fournir les moyens nécessaires à la réalisation de la formation (salle, matériel, conditions d'accueil). L'Organisme de Formation s'engage à mettre en œuvre les moyens pédagogiques, techniques et d'encadrement nécessaires pour atteindre les objectifs visés.`
  const art2Lines = doc.splitTextToSize(art2Text, 170)
  doc.text(art2Lines, 20, y)
  y += art2Lines.length * 5 + 5
  
  addFooter(doc, DOC_CODES.convention, 2)
  
  // ========== PAGE 3 ==========
  doc.addPage()
  y = addHeaderWithTitle(doc, 'CONVENTION DE FORMATION PROFESSIONNELLE')
  
  // Article 3
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Article 3 – Dispositions financières', 20, y)
  y += 7
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Coût total de la formation (en € HT) : ${priceDisplay}`, 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('Modalités de paiement : conformément au devis validé par virement bancaire', 20, y)
  y += 5
  doc.text(`IBAN : ${ORG.iban} – BIC : ${ORG.bic}`, 20, y)
  y += 5
  doc.text('Aucun acompte ne sera demandé avant la formation.', 20, y)
  y += 12
  
  // Article 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Article 4 – Moyens et modalités pédagogiques', 20, y)
  y += 7
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const art4Text = `La formation est dispensée selon une pédagogie active et participative : alternance d'apports théoriques, démonstrations pratiques et mises en situation ; utilisation de supports visuels et matériels spécifiques.`
  const art4Lines = doc.splitTextToSize(art4Text, 170)
  doc.text(art4Lines, 20, y)
  y += art4Lines.length * 5 + 3
  doc.text("Une feuille d'émargement par demi-journée est signée par chaque stagiaire et le formateur.", 20, y)
  y += 12
  
  // Article 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text("Article 5 – Modalités de suivi et d'évaluation", 20, y)
  y += 7
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const art5Text = `Évaluation formative pendant la formation (mises en situation, QCM, exercices pratiques). Validation des acquis selon les critères du référentiel concerné. Délivrance d'un certificat de réalisation indiquant le niveau d'atteinte des objectifs : Acquis / Non acquis.`
  const art5Lines = doc.splitTextToSize(art5Text, 170)
  doc.text(art5Lines, 20, y)
  y += art5Lines.length * 5 + 8
  
  // Article 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Article 6 – Sanction et documents délivrés', 20, y)
  y += 7
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const art6Text = `À l'issue de la formation, l'Organisme de Formation délivrera : une attestation de présence, un certificat de réalisation (Acquis / Non acquis) et, le cas échéant, une attestation officielle selon le référentiel de certification de la formation.`
  const art6Lines = doc.splitTextToSize(art6Text, 170)
  doc.text(art6Lines, 20, y)
  y += art6Lines.length * 5 + 8
  
  // Article 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Article 7 – Délai de rétractation', 20, y)
  y += 7
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const art7Text = `Conformément à l'article L.6353-5 du Code du travail, le Bénéficiaire dispose d'un délai de 10 jours à compter de la signature pour se rétracter par lettre recommandée avec accusé de réception.`
  const art7Lines = doc.splitTextToSize(art7Text, 170)
  doc.text(art7Lines, 20, y)
  
  addFooter(doc, DOC_CODES.convention, 3)
  
  // ========== PAGE 4 ==========
  doc.addPage()
  y = addHeaderWithTitle(doc, 'CONVENTION DE FORMATION PROFESSIONNELLE')
  
  // Article 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text("Article 8 – Cas de différend", 20, y)
  y += 7
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const art8Text = `En cas de différend né de l'exécution de la présente convention, les parties s'efforceront de le régler à l'amiable. À défaut, le litige sera porté devant les tribunaux compétents.`
  const art8Lines = doc.splitTextToSize(art8Text, 170)
  doc.text(art8Lines, 20, y)
  y += art8Lines.length * 5 + 8
  
  // Article 9
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Article 9 – Protection des données personnelles', 20, y)
  y += 7
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const art9Text = `Les informations recueillies font l'objet d'un traitement informatique destiné à la gestion de la formation. Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression des données vous concernant.`
  const art9Lines = doc.splitTextToSize(art9Text, 170)
  doc.text(art9Lines, 20, y)
  y += art9Lines.length * 5 + 8
  
  // Article 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Article 10 – Dispositions générales', 20, y)
  y += 7
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text("La présente convention est régie par le droit français.", 20, y)
  y += 15
  
  // Date et lieu
  doc.text(`Fait à Concarneau, le ${formatDate(new Date())}`, 20, y)
  doc.text('En deux exemplaires originaux.', 20, y + 5)
  y += 20
  
  // Signatures
  doc.setFont('helvetica', 'bold')
  doc.text("Pour l'Organisme de Formation", 30, y)
  doc.text("Pour le Bénéficiaire", 130, y)
  y += 5
  
  doc.setFont('helvetica', 'normal')
  doc.text(`${ORG.dirigeant}`, 30, y)
  doc.text(`${client?.contact_name || ''}`, 130, y)
  y += 5
  doc.text('Dirigeant', 30, y)
  doc.text(`${client?.contact_function || ''}`, 130, y)
  y += 5
  
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.text('(Signature et cachet)', 30, y)
  doc.text('(Signature et cachet)', 130, y)
  
  // Tampon organisme
  y += 10
  try {
    doc.addImage(STAMP_BASE64, 'JPEG', 20, y, 50, 25)
  } catch (e) {}
  
  addFooter(doc, DOC_CODES.convention, 4)
  
  return doc
}

// ============================================================
// GÉNÉRER CERTIFICAT DE RÉALISATION (Conforme modèle)
// ============================================================
function generateCertificat(session, trainee, clientData, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const course = session.courses || {}
  
  // En-tête avec logo
  let y = addHeader(doc)
  y += 15
  
  // Titre
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('CERTIFICAT DE RÉALISATION', pageWidth / 2, y, { align: 'center' })
  y += 12
  
  // Introduction
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const introText = `Je soussigné, ${ORG.dirigeant}, représentant légal du dispensateur de l'action concourant au développement des compétences ${ORG.name}, 24 rue Kerbleiz à 29900 Concarneau`
  const introLines = doc.splitTextToSize(introText, 170)
  doc.text(introLines, 20, y)
  y += introLines.length * 5 + 8
  
  // Atteste que
  doc.text('Atteste que :', 20, y)
  y += 10
  
  // Nom du stagiaire (centré, gras)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${trainee.first_name} ${trainee.last_name?.toUpperCase()}`, pageWidth / 2, y, { align: 'center' })
  y += 6
  
  // Entreprise
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Salarié(e) de l'entreprise ${clientData?.name || session.clients?.name || ''}`, pageWidth / 2, y, { align: 'center' })
  y += 6
  
  // A suivi l'action
  doc.text('A suivi l\'action', pageWidth / 2, y, { align: 'center' })
  y += 6
  
  // Titre formation (gras)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(course.title || '', pageWidth / 2, y, { align: 'center' })
  y += 10
  
  // Nature de l'action
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text("Nature de l'action concourant au développement des compétences :", 20, y)
  y += 6
  
  // ========== ENCADRÉ AVEC LES 4 OPTIONS ==========
  const boxX = 20
  const boxY = y
  const boxWidth = 170
  const boxHeight = 32
  const lineHeight = 7
  
  // Dessiner l'encadré
  doc.setDrawColor(0)
  doc.setLineWidth(0.5)
  doc.rect(boxX, boxY, boxWidth, boxHeight)
  
  let optionY = boxY + 7
  
  // Option 1 : Action de formation (cochée)
  doc.setLineWidth(0.3)
  doc.rect(boxX + 5, optionY - 4, 5, 5) // Case plus grande
  // Coche bien visible
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('✓', boxX + 5.5, optionY + 0.5)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Action de formation', boxX + 13, optionY)
  optionY += lineHeight
  
  // Option 2 : Bilan de compétences (non cochée, barré)
  doc.rect(boxX + 5, optionY - 4, 5, 5)
  const text1 = 'Bilan de compétences'
  doc.text(text1, boxX + 13, optionY)
  const tw1 = doc.getTextWidth(text1)
  doc.line(boxX + 13, optionY - 1.5, boxX + 13 + tw1, optionY - 1.5)
  optionY += lineHeight
  
  // Option 3 : Action de VAE (non cochée, barré)
  doc.rect(boxX + 5, optionY - 4, 5, 5)
  const text2 = 'Action de VAE'
  doc.text(text2, boxX + 13, optionY)
  const tw2 = doc.getTextWidth(text2)
  doc.line(boxX + 13, optionY - 1.5, boxX + 13 + tw2, optionY - 1.5)
  optionY += lineHeight
  
  // Option 4 : Action de formation par apprentissage (non cochée, barré)
  doc.rect(boxX + 5, optionY - 4, 5, 5)
  const text3 = 'Action de formation par apprentissage'
  doc.text(text3, boxX + 13, optionY)
  const tw3 = doc.getTextWidth(text3)
  doc.line(boxX + 13, optionY - 1.5, boxX + 13 + tw3, optionY - 1.5)
  
  y = boxY + boxHeight + 10
  
  // Dates
  doc.text(`Qui s'est déroulée du ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, 20, y)
  y += 6
  doc.text(`Pour une durée de ${course.duration_hours || 0} heures.`, 20, y)
  y += 10
  
  // Texte conservation
  const conservText = `Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m'engage à conserver l'ensemble des pièces justificatives ayant permis d'établir le présent certificat pendant une durée de 3 ans à compter de la fin de l'année du dernier paiement. En cas de cofinancement des fonds européens, la durée de conservation est étendue conformément aux obligations conventionnelles spécifiques.`
  const conservLines = doc.splitTextToSize(conservText, 170)
  doc.text(conservLines, 20, y)
  y += conservLines.length * 5 + 10
  
  // Fait à / Le
  doc.text('Fait à : Concarneau', 20, y)
  y += 5
  doc.text(`Le : ${formatDate(session.end_date)}`, 20, y)
  y += 10
  
  // Signature et tampon - Position fixe pour éviter chevauchement avec pied de page
  doc.text('Cachet et signature du responsable du dispensateur de formation :', 20, y)
  y += 12
  
  // Nom et fonction à droite
  doc.setFont('helvetica', 'bold')
  doc.text(`${ORG.dirigeant}, Dirigeant ${ORG.name}`, pageWidth - 20, y, { align: 'right' })
  
  // Tampon positionné à droite - position fixe pour ne pas chevaucher le footer
  // Le footer commence à pageHeight - 28, le tampon fait 28mm de haut
  // Donc stampY max = pageHeight - 28 - 28 - 5 = pageHeight - 61
  const stampY = Math.min(y + 5, pageHeight - 70)
  try {
    doc.addImage(STAMP_BASE64, 'JPEG', pageWidth - 75, stampY, 55, 28)
  } catch (e) {}
  
  // Pied de page (bien en bas)
  addFooter(doc, DOC_CODES.certificat)
  
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
  
  // Infos formation
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
  
  // Contacts
  doc.text(`Contact ${ORG.name} : ${ORG.phone} ou ${ORG.email}`, 20, y)
  y += 6
  
  if (client.contact_name) {
    doc.text(`Contact de votre entreprise : ${client.contact_name}${client.contact_function ? ' - ' + client.contact_function : ''}`, 20, y)
    y += 10
  }
  y += 5
  
  doc.text('Nous vous remercions pour votre ponctualité et votre participation active.', 20, y)
  y += 25
  
  // Signature
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
  
  // Nom du stagiaire
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${trainee.first_name} ${trainee.last_name?.toUpperCase()}`, pageWidth / 2, y, { align: 'center' })
  y += 10
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (client.name) {
    doc.text(`Entreprise : ${client.name}`, 20, y)
    y += 8
  }
  
  doc.text(`A participé à la formation intitulée : ${course.title || ''}`, 20, y)
  y += 6
  doc.text(`Dates : du ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, 20, y)
  y += 6
  doc.text(`Durée totale : ${course.duration_hours || 0} heures`, 20, y)
  y += 6
  doc.text(`Lieu : ${session.location || ''}`, 20, y)
  y += 10
  doc.text(`Cette formation a été animée par : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 20, y)
  y += 20
  
  doc.text('Fait pour servir et valoir ce que de droit.', 20, y)
  y += 25
  
  doc.text(`Fait à Concarneau, le ${formatDate(new Date())}`, pageWidth - 80, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text(ORG.dirigeant, pageWidth - 80, y)
  
  y += 10
  try {
    doc.addImage(STAMP_BASE64, 'JPEG', pageWidth - 80, y, 55, 28)
  } catch (e) {}
  
  addFooter(doc, DOC_CODES.attestation)
  
  return doc
}

// ============================================================
// GÉNÉRER FEUILLE D'ÉMARGEMENT
// ============================================================
function generateEmargement(session, trainees, trainer, attendances = []) {
  const doc = new jsPDF('landscape') // Mode paysage pour plus de place
  const course = session.courses || {}
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  // En-tête simplifié en mode paysage
  try {
    doc.addImage(LOGO_BASE64, 'JPEG', 10, 8, 30, 30)
  } catch (e) {}
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text("FEUILLE D'ÉMARGEMENT", pageWidth / 2, 20, { align: 'center' })
  
  let y = 45
  
  // Infos formation
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`Formation : ${course.title || ''}`, 15, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`Du ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, 15, y + 5)
  doc.text(`Lieu : ${session.location || ''}`, 15, y + 10)
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 200, y)
  y += 18
  
  // Calculer les dates de formation
  const startDate = new Date(session.start_date)
  const endDate = new Date(session.end_date)
  const dates = []
  let currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  // Limiter à 2 jours max pour l'affichage (sinon trop de colonnes)
  const displayDates = dates.slice(0, 2)
  
  // Préparer les données du tableau - MINIMUM 10 LIGNES
  const minRows = 10
  const tableData = []
  
  // Ajouter les stagiaires existants
  trainees.forEach(trainee => {
    const row = [
      `${trainee.first_name} ${trainee.last_name?.toUpperCase()}`,
      '', // N° SS à remplir
    ]
    // Ajouter colonnes matin/après-midi pour chaque date
    displayDates.forEach(() => {
      row.push('') // Matin
      row.push('') // Après-midi
    })
    tableData.push(row)
  })
  
  // Compléter avec des lignes vides jusqu'à 10
  while (tableData.length < minRows) {
    const emptyRow = ['', '']
    displayDates.forEach(() => {
      emptyRow.push('')
      emptyRow.push('')
    })
    tableData.push(emptyRow)
  }
  
  // Construire l'en-tête avec les dates
  const headerRow1 = ['', '']
  const headerRow2 = ['Nom Prénom', 'N° Sécurité Sociale']
  
  displayDates.forEach(date => {
    const dateStr = formatDate(date)
    headerRow1.push(dateStr)
    headerRow1.push('')
    headerRow2.push('Matin')
    headerRow2.push('Après-midi')
  })
  
  // Tableau avec en-tête à 2 niveaux
  doc.autoTable({
    startY: y,
    head: [headerRow2], // En-tête simple
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, minCellHeight: 10 },
    headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 40 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 30, halign: 'center' },
      5: { cellWidth: 30, halign: 'center' },
    },
    didDrawPage: function(data) {
      // Ajouter les dates au-dessus des colonnes
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      if (displayDates[0]) {
        doc.text(formatDate(displayDates[0]), 155, y - 3, { align: 'center' })
      }
      if (displayDates[1]) {
        doc.text(formatDate(displayDates[1]), 215, y - 3, { align: 'center' })
      }
    }
  })
  
  y = doc.autoTable.previous.finalY + 10
  
  // Signature formateur
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Signature du formateur :', 15, y)
  doc.text('____________________________', 15, y + 6)
  
  // Pied de page complet
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(15, pageHeight - 22, pageWidth - 15, pageHeight - 22)
  
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(`${ORG.name} - ${ORG.addressFull}`, pageWidth / 2, pageHeight - 18, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Déclaration d'activité enregistrée sous le numéro ${ORG.nda} auprès du préfet de la région Bretagne`, pageWidth / 2, pageHeight - 14, { align: 'center' })
  doc.text(`SARL au capital de ${ORG.capital} Siret : ${ORG.siret} - Naf : ${ORG.naf} - TVA : ${ORG.tva} - RCS ${ORG.rcs}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
  doc.text(`Tel : ${ORG.phone} - Email : ${ORG.email}`, pageWidth / 2, pageHeight - 6, { align: 'center' })
  
  // Code document
  doc.setTextColor(150, 150, 150)
  doc.text(`${DOC_CODES.emargement}-${APP_VERSION}`, pageWidth - 15, pageHeight - 3, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  
  return doc
}

// ============================================================
// GÉNÉRER PROGRAMME DE FORMATION
// ============================================================
function generateProgramme(course, session, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  let y = addHeaderWithTitle(doc, 'PROGRAMME DE FORMATION')
  
  // Titre formation
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(course?.title || '', pageWidth / 2, y, { align: 'center' })
  y += 12
  
  // Infos générales
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  doc.setFont('helvetica', 'bold')
  doc.text('Durée :', 20, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${course?.duration_hours || 0} heures`, 50, y)
  y += 6
  
  doc.setFont('helvetica', 'bold')
  doc.text('Public :', 20, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${course?.target_audience || 'Tout public'}`, 50, y)
  y += 6
  
  doc.setFont('helvetica', 'bold')
  doc.text('Prérequis :', 20, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${course?.prerequisites || 'Aucun'}`, 50, y)
  y += 12
  
  // Objectifs
  doc.setFont('helvetica', 'bold')
  doc.text('Objectifs pédagogiques :', 20, y)
  y += 6
  
  const objectives = formatObjectives(course?.objectives)
  doc.setFont('helvetica', 'normal')
  if (objectives.length > 0) {
    objectives.forEach(obj => {
      doc.text(`• ${obj.trim()}`, 25, y)
      y += 5
    })
  }
  y += 8
  
  // Contenu
  if (course?.program) {
    doc.setFont('helvetica', 'bold')
    doc.text('Contenu de la formation :', 20, y)
    y += 6
    
    doc.setFont('helvetica', 'normal')
    const programLines = doc.splitTextToSize(course.program, 165)
    doc.text(programLines, 20, y)
    y += programLines.length * 5 + 8
  }
  
  // Moyens pédagogiques
  doc.setFont('helvetica', 'bold')
  doc.text('Moyens pédagogiques :', 20, y)
  y += 6
  
  doc.setFont('helvetica', 'normal')
  const moyens = [
    'Alternance d\'apports théoriques et de mises en situation pratiques',
    'Supports pédagogiques remis aux participants',
    'Matériel et équipements adaptés à la formation',
  ]
  moyens.forEach(m => {
    doc.text(`• ${m}`, 25, y)
    y += 5
  })
  y += 8
  
  // Évaluation
  doc.setFont('helvetica', 'bold')
  doc.text('Modalités d\'évaluation :', 20, y)
  y += 6
  
  doc.setFont('helvetica', 'normal')
  const evals = [
    'Évaluation continue tout au long de la formation',
    'Exercices pratiques et mises en situation',
    'Test de validation des acquis en fin de formation',
  ]
  evals.forEach(e => {
    doc.text(`• ${e}`, 25, y)
    y += 5
  })
  
  addFooter(doc, DOC_CODES.programme)
  
  return doc
}

// ============================================================
// GÉNÉRER ÉVALUATION DE SATISFACTION (À CHAUD)
// ============================================================
function generateEvaluationSatisfaction(session, trainee, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  
  let y = addHeaderWithTitle(doc, "FICHE D'ÉVALUATION DE SATISFACTION")
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text("(Évaluation à chaud - À remplir à l'issue de la formation)", pageWidth / 2, y, { align: 'center' })
  y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.text("Merci de prendre quelques instants pour évaluer cette formation.", 20, y)
  y += 10
  
  // Infos formation
  doc.setFont('helvetica', 'bold')
  doc.text(`Formation : ${course.title || ''}`, 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 20, y)
  y += 5
  doc.text(`Dates : du ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, 20, y)
  y += 10
  
  // Légende
  doc.setFontSize(8)
  doc.text('1 = Non satisfait | 2 = Peu satisfait | 3 = Moyennement satisfait | 4 = Satisfait | 5 = Très satisfait', 20, y)
  y += 8
  
  // Questions
  const questions = [
    "Les objectifs de la formation étaient-ils clairement définis ?",
    "Le contenu correspondait-il à vos attentes ?",
    "Les méthodes pédagogiques étaient-elles adaptées ?",
    "Le formateur maîtrisait-il son sujet ?",
    "Les supports pédagogiques étaient-ils de qualité ?",
    "L'organisation matérielle était-elle satisfaisante ?",
    "La durée de la formation était-elle adaptée ?",
    "Cette formation vous sera-t-elle utile dans votre travail ?",
  ]
  
  // Cases vides avec espace insécable pour éviter les artefacts
  const emptyCell = ' '
  const tableData = questions.map(q => [q, emptyCell, emptyCell, emptyCell, emptyCell, emptyCell])
  
  doc.autoTable({
    startY: y,
    head: [['Critères', '1', '2', '3', '4', '5']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, minCellHeight: 8 },
    headStyles: { fillColor: [60, 60, 60] },
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
  
  // Commentaires
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Commentaires / Suggestions :', 20, y)
  y += 3
  doc.setLineWidth(0.3)
  doc.rect(20, y, 170, 25)
  y += 30
  
  // Signature
  doc.setFont('helvetica', 'normal')
  doc.text(`Nom du stagiaire : ${trainee?.first_name || ''} ${trainee?.last_name?.toUpperCase() || ''}`, 20, y)
  y += 8
  doc.text('Signature : __________________________', 20, y)
  
  addFooter(doc, DOC_CODES.evaluation)
  
  return doc
}

// ============================================================
// GÉNÉRER ÉVALUATION À FROID
// ============================================================
function generateEvaluationFroid(session, trainee, trainer) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session.courses || {}
  
  let y = addHeaderWithTitle(doc, "ÉVALUATION À FROID")
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text("(À remplir quelques semaines/mois après la formation)", pageWidth / 2, y, { align: 'center' })
  y += 10
  
  doc.setFont('helvetica', 'normal')
  doc.text("Ce questionnaire nous permet d'évaluer l'impact de la formation sur votre activité professionnelle.", 20, y)
  y += 10
  
  // Infos
  doc.setFont('helvetica', 'bold')
  doc.text(`Formation suivie : ${course.title || ''}`, 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Dates de la formation : du ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, 20, y)
  y += 12
  
  // Questions ouvertes
  const questionsOuvertes = [
    "1. Avez-vous pu mettre en application les connaissances acquises lors de la formation ?",
    "2. Si oui, dans quelles situations ? Si non, pourquoi ?",
    "3. Quels bénéfices concrets avez-vous tirés de cette formation dans votre travail quotidien ?",
    "4. Avez-vous rencontré des difficultés dans l'application des acquis ?",
    "5. Auriez-vous besoin d'une formation complémentaire ? Si oui, sur quels sujets ?",
  ]
  
  questionsOuvertes.forEach(q => {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(q, 20, y)
    y += 5
    doc.setLineWidth(0.3)
    doc.rect(20, y, 170, 15)
    y += 20
  })
  
  // Note globale
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Note globale sur l\'impact de la formation (de 1 à 10) : _____', 20, y)
  y += 15
  
  // Signature
  doc.setFont('helvetica', 'normal')
  doc.text(`Nom : ${trainee?.first_name || ''} ${trainee?.last_name?.toUpperCase() || ''}`, 20, y)
  y += 6
  doc.text(`Date : __________________`, 20, y)
  y += 6
  doc.text('Signature : __________________________', 20, y)
  
  addFooter(doc, DOC_CODES.evaluationFroid)
  
  return doc
}

// ============================================================
// GÉNÉRER RÈGLEMENT INTÉRIEUR
// ============================================================
function generateReglementInterieur(content, title = 'Règlement Intérieur') {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  let y = addHeaderWithTitle(doc, 'RÈGLEMENT INTÉRIEUR')
  
  // Convertir HTML en texte simple (basique)
  const textContent = content
    .replace(/<h1[^>]*>/gi, '**TITRE**')
    .replace(/<h2[^>]*>/gi, '\n**')
    .replace(/<\/h2>/gi, '**\n')
    .replace(/<\/h1>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ul>/gi, '')
    .replace(/<strong>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<em>/gi, '')
    .replace(/<\/em>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  const lines = textContent.split('\n')
  lines.forEach(line => {
    if (line.trim() === '') {
      y += 3
      return
    }
    
    if (line.startsWith('**') && line.endsWith('**')) {
      doc.setFont('helvetica', 'bold')
      doc.text(line.replace(/\*\*/g, ''), 20, y)
      doc.setFont('helvetica', 'normal')
      y += 7
    } else {
      const wrappedLines = doc.splitTextToSize(line, 170)
      wrappedLines.forEach(wl => {
        if (y > 270) {
          addFooter(doc, DOC_CODES.reglement)
          doc.addPage()
          y = addHeaderWithTitle(doc, 'RÈGLEMENT INTÉRIEUR')
        }
        doc.text(wl, 20, y)
        y += 5
      })
    }
  })
  
  addFooter(doc, DOC_CODES.reglement)
  
  return doc
}

// ============================================================
// GÉNÉRER LIVRET D'ACCUEIL
// ============================================================
function generateLivretAccueil(content, title = "Livret d'Accueil") {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  let y = addHeaderWithTitle(doc, "LIVRET D'ACCUEIL DU STAGIAIRE")
  
  // Même traitement que RI
  const textContent = content
    .replace(/<h1[^>]*>/gi, '**TITRE**')
    .replace(/<h2[^>]*>/gi, '\n**')
    .replace(/<\/h2>/gi, '**\n')
    .replace(/<\/h1>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ul>/gi, '')
    .replace(/<strong>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<em>/gi, '')
    .replace(/<\/em>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  const lines = textContent.split('\n')
  lines.forEach(line => {
    if (line.trim() === '') {
      y += 3
      return
    }
    
    if (line.startsWith('**') && line.endsWith('**')) {
      doc.setFont('helvetica', 'bold')
      doc.text(line.replace(/\*\*/g, ''), 20, y)
      doc.setFont('helvetica', 'normal')
      y += 7
    } else {
      const wrappedLines = doc.splitTextToSize(line, 170)
      wrappedLines.forEach(wl => {
        if (y > 270) {
          addFooter(doc, DOC_CODES.livret)
          doc.addPage()
          y = addHeaderWithTitle(doc, "LIVRET D'ACCUEIL DU STAGIAIRE")
        }
        doc.text(wl, 20, y)
        y += 5
      })
    }
  })
  
  addFooter(doc, DOC_CODES.livret)
  
  return doc
}

// ============================================================
// GÉNÉRER ANALYSE DU BESOIN EN FORMATION (Indicateur 4 Qualiopi)
// ============================================================
function generateAnalyseBesoin(session, client, course) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  
  let y = addHeaderWithTitle(doc, "ANALYSE DU BESOIN EN FORMATION")
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text("(Conformément à l'indicateur 4 du référentiel Qualiopi)", pageWidth / 2, y, { align: 'center' })
  y += 10
  
  // Infos entreprise
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('1. IDENTIFICATION DU DEMANDEUR', 20, y)
  y += 7
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Entreprise : ${client?.name || '_______________________'}`, 25, y)
  y += 6
  doc.text(`Contact : ${client?.contact_name || '_______________________'}`, 25, y)
  y += 6
  doc.text(`Fonction : ${client?.contact_function || '_______________________'}`, 25, y)
  y += 6
  doc.text(`Tél : ${client?.phone || '_______________________'}`, 25, y)
  y += 6
  doc.text(`Email : ${client?.email || '_______________________'}`, 25, y)
  y += 6
  doc.text(`Date de l'entretien : ___ / ___ / ______`, 25, y)
  y += 12
  
  // Formation demandée
  doc.setFont('helvetica', 'bold')
  doc.text('2. FORMATION DEMANDÉE', 20, y)
  y += 7
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Intitulé : ${course?.title || '_______________________'}`, 25, y)
  y += 6
  doc.text(`Nombre de participants prévus : ______`, 25, y)
  y += 6
  doc.text(`Dates souhaitées : _______________________`, 25, y)
  y += 6
  doc.text(`Lieu souhaité : ☐ Intra-entreprise   ☐ Inter-entreprises   ☐ À distance`, 25, y)
  y += 12
  
  // Contexte de la demande
  doc.setFont('helvetica', 'bold')
  doc.text('3. CONTEXTE DE LA DEMANDE', 20, y)
  y += 7
  
  doc.setFont('helvetica', 'normal')
  doc.text('Origine de la demande :', 25, y)
  y += 5
  doc.text('☐ Obligation réglementaire   ☐ Besoin identifié en interne   ☐ Évolution du poste', 30, y)
  y += 5
  doc.text('☐ Demande client   ☐ Accident/incident   ☐ Autre : _______________', 30, y)
  y += 8
  
  doc.text('Contexte (décrivez le besoin) :', 25, y)
  y += 5
  doc.rect(25, y, 165, 25)
  y += 30
  
  // Objectifs attendus
  doc.setFont('helvetica', 'bold')
  doc.text('4. OBJECTIFS ATTENDUS PAR L\'ENTREPRISE', 20, y)
  y += 7
  
  doc.setFont('helvetica', 'normal')
  doc.text('Quels résultats concrets attendez-vous à l\'issue de la formation ?', 25, y)
  y += 5
  doc.rect(25, y, 165, 20)
  y += 25
  
  // Profil des stagiaires
  doc.setFont('helvetica', 'bold')
  doc.text('5. PROFIL DES STAGIAIRES', 20, y)
  y += 7
  
  doc.setFont('helvetica', 'normal')
  doc.text('Fonctions/postes occupés : _______________________', 25, y)
  y += 6
  doc.text('Niveau d\'expérience sur le sujet :', 25, y)
  y += 5
  doc.text('☐ Débutant   ☐ Initié   ☐ Confirmé   ☐ Mixte', 30, y)
  y += 6
  doc.text('Formations/certifications déjà obtenues sur le sujet : _______________________', 25, y)
  y += 6
  doc.text('Difficultés ou besoins particuliers identifiés : _______________________', 25, y)
  
  addFooter(doc, DOC_CODES.analyseBesoin, 1)
  
  // Page 2
  doc.addPage()
  y = addHeaderWithTitle(doc, "ANALYSE DU BESOIN EN FORMATION")
  
  // Contraintes
  doc.setFont('helvetica', 'bold')
  doc.text('6. CONTRAINTES ET ATTENTES PARTICULIÈRES', 20, y)
  y += 7
  
  doc.setFont('helvetica', 'normal')
  doc.text('Contraintes horaires : _______________________', 25, y)
  y += 6
  doc.text('Contraintes matérielles : _______________________', 25, y)
  y += 6
  doc.text('Budget alloué : _______________________', 25, y)
  y += 6
  doc.text('Prise en charge OPCO : ☐ Oui   ☐ Non   ☐ En cours', 25, y)
  y += 12
  
  // Évaluation
  doc.setFont('helvetica', 'bold')
  doc.text('7. MODALITÉS D\'ÉVALUATION SOUHAITÉES', 20, y)
  y += 7
  
  doc.setFont('helvetica', 'normal')
  doc.text('☐ Évaluation des acquis (QCM, mise en situation)', 25, y)
  y += 5
  doc.text('☐ Évaluation de satisfaction à chaud', 25, y)
  y += 5
  doc.text('☐ Évaluation à froid (J+30 ou J+90)', 25, y)
  y += 5
  doc.text('☐ Certification / Attestation officielle', 25, y)
  y += 12
  
  // Synthèse
  doc.setFont('helvetica', 'bold')
  doc.text('8. SYNTHÈSE ET PRÉCONISATIONS', 20, y)
  y += 7
  
  doc.setFont('helvetica', 'normal')
  doc.text('(À remplir par Access Formation)', 25, y)
  y += 5
  doc.rect(25, y, 165, 40)
  y += 50
  
  // Signatures
  doc.setFont('helvetica', 'bold')
  doc.text('9. VALIDATION', 20, y)
  y += 10
  
  doc.setFont('helvetica', 'normal')
  doc.text('Pour Access Formation :', 25, y)
  doc.text('Pour le client :', 120, y)
  y += 5
  doc.text('Date : ___ / ___ / ______', 25, y)
  doc.text('Date : ___ / ___ / ______', 120, y)
  y += 10
  doc.text('Signature :', 25, y)
  doc.text('Signature :', 120, y)
  
  addFooter(doc, DOC_CODES.analyseBesoin, 2)
  
  return doc
}

// ============================================================
// GÉNÉRER TEST DE POSITIONNEMENT SST
// ============================================================
function generatePositionnementSST(session, trainee) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session?.courses || {}
  
  let y = addHeaderWithTitle(doc, "TEST DE POSITIONNEMENT - SST")
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text("(À remplir par le stagiaire en début de formation)", pageWidth / 2, y, { align: 'center' })
  y += 8
  
  // Infos stagiaire
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nom : ${trainee?.last_name?.toUpperCase() || '_____________'}  Prénom : ${trainee?.first_name || '_____________'}`, 20, y)
  y += 6
  doc.text(`Formation : ${course?.title || 'SST'}`, 20, y)
  y += 6
  doc.text(`Date : ${formatDate(session?.start_date) || '___ / ___ / ______'}`, 20, y)
  y += 10
  
  // QCM
  doc.setFont('helvetica', 'bold')
  doc.text('PARTIE 1 : QUESTIONS À CHOIX MULTIPLES', 20, y)
  y += 8
  
  const qcmQuestions = [
    { q: "1. Que signifie SST ?", options: ["Sauveteur Secouriste du Travail", "Service de Santé au Travail", "Secours Spécialisé Technique"] },
    { q: "2. Quel est le premier réflexe face à un accident ?", options: ["Appeler les secours", "Protéger", "Alerter la direction"] },
    { q: "3. Le numéro d'urgence européen est :", options: ["15", "112", "18"] },
    { q: "4. Face à une victime qui ne répond pas mais respire, il faut :", options: ["La secouer", "La mettre en PLS", "Faire un massage cardiaque"] },
    { q: "5. Le DAE (défibrillateur) sert à :", options: ["Mesurer le pouls", "Choquer un cœur en fibrillation", "Donner de l'oxygène"] },
  ]
  
  doc.setFont('helvetica', 'normal')
  qcmQuestions.forEach(item => {
    doc.setFont('helvetica', 'bold')
    doc.text(item.q, 20, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    item.options.forEach(opt => {
      doc.text(`☐ ${opt}`, 30, y)
      y += 5
    })
    y += 3
  })
  
  // Questions ouvertes
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text('PARTIE 2 : QUESTIONS OUVERTES', 20, y)
  y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.text("6. Avez-vous déjà été formé au SST ? Si oui, quand ?", 20, y)
  y += 5
  doc.rect(20, y, 170, 12)
  y += 17
  
  doc.text("7. Avez-vous déjà été confronté à une situation d'urgence ? Décrivez brièvement.", 20, y)
  y += 5
  doc.rect(20, y, 170, 15)
  y += 20
  
  doc.text("8. Quelles sont vos attentes concernant cette formation ?", 20, y)
  y += 5
  doc.rect(20, y, 170, 15)
  
  addFooter(doc, DOC_CODES.positionnementSST)
  
  return doc
}

// ============================================================
// GÉNÉRER TEST DE POSITIONNEMENT INCENDIE
// ============================================================
function generatePositionnementIncendie(session, trainee) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session?.courses || {}
  
  let y = addHeaderWithTitle(doc, "TEST DE POSITIONNEMENT - SÉCURITÉ INCENDIE")
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text("(À remplir par le stagiaire en début de formation)", pageWidth / 2, y, { align: 'center' })
  y += 8
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nom : ${trainee?.last_name?.toUpperCase() || '_____________'}  Prénom : ${trainee?.first_name || '_____________'}`, 20, y)
  y += 6
  doc.text(`Formation : ${course?.title || 'Sécurité Incendie'}`, 20, y)
  y += 6
  doc.text(`Date : ${formatDate(session?.start_date) || '___ / ___ / ______'}`, 20, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('PARTIE 1 : QUESTIONS À CHOIX MULTIPLES', 20, y)
  y += 8
  
  const qcmQuestions = [
    { q: "1. Quels sont les 3 éléments du triangle du feu ?", options: ["Eau, air, chaleur", "Combustible, comburant, chaleur", "Fumée, flamme, chaleur"] },
    { q: "2. Quel extincteur utiliser sur un feu électrique ?", options: ["Eau", "CO2", "Mousse"] },
    { q: "3. Face à un début d'incendie, la première action est :", options: ["Éteindre le feu", "Donner l'alarme", "Ouvrir les fenêtres"] },
    { q: "4. Un guide-file doit :", options: ["Rester en dernier", "Guider vers la sortie", "Appeler les pompiers"] },
    { q: "5. Le point de rassemblement sert à :", options: ["Se protéger", "Compter les personnes évacuées", "Attendre les pompiers"] },
  ]
  
  doc.setFont('helvetica', 'normal')
  qcmQuestions.forEach(item => {
    doc.setFont('helvetica', 'bold')
    doc.text(item.q, 20, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    item.options.forEach(opt => {
      doc.text(`☐ ${opt}`, 30, y)
      y += 5
    })
    y += 3
  })
  
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text('PARTIE 2 : QUESTIONS OUVERTES', 20, y)
  y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.text("6. Connaissez-vous l'emplacement des extincteurs sur votre lieu de travail ?", 20, y)
  y += 5
  doc.rect(20, y, 170, 12)
  y += 17
  
  doc.text("7. Avez-vous déjà participé à un exercice d'évacuation ? Décrivez.", 20, y)
  y += 5
  doc.rect(20, y, 170, 15)
  
  addFooter(doc, DOC_CODES.positionnementIncendie)
  
  return doc
}

// ============================================================
// GÉNÉRER TEST DE POSITIONNEMENT GESTES ET POSTURES
// ============================================================
function generatePositionnementGP(session, trainee) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session?.courses || {}
  
  let y = addHeaderWithTitle(doc, "TEST DE POSITIONNEMENT - GESTES ET POSTURES")
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text("(À remplir par le stagiaire en début de formation)", pageWidth / 2, y, { align: 'center' })
  y += 8
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nom : ${trainee?.last_name?.toUpperCase() || '_____________'}  Prénom : ${trainee?.first_name || '_____________'}`, 20, y)
  y += 6
  doc.text(`Formation : ${course?.title || 'Gestes et Postures'}`, 20, y)
  y += 6
  doc.text(`Date : ${formatDate(session?.start_date) || '___ / ___ / ______'}`, 20, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('PARTIE 1 : QUESTIONS À CHOIX MULTIPLES', 20, y)
  y += 8
  
  const qcmQuestions = [
    { q: "1. Que signifie TMS ?", options: ["Troubles Musculo-Squelettiques", "Technique de Manutention Sécurisée", "Test Médical Standard"] },
    { q: "2. Pour soulever une charge, il faut :", options: ["Plier le dos", "Plier les jambes", "Tendre les bras"] },
    { q: "3. La posture idéale au bureau est :", options: ["Dos droit, pieds au sol", "Jambes croisées", "Penché vers l'écran"] },
    { q: "4. Le port de charges lourdes répété peut causer :", options: ["Des migraines", "Des lombalgies", "De la fatigue visuelle"] },
    { q: "5. Pour éviter les TMS, il est conseillé de :", options: ["Rester immobile", "Faire des pauses et bouger", "Travailler plus vite"] },
  ]
  
  doc.setFont('helvetica', 'normal')
  qcmQuestions.forEach(item => {
    doc.setFont('helvetica', 'bold')
    doc.text(item.q, 20, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    item.options.forEach(opt => {
      doc.text(`☐ ${opt}`, 30, y)
      y += 5
    })
    y += 3
  })
  
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text('PARTIE 2 : QUESTIONS OUVERTES', 20, y)
  y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.text("6. Ressentez-vous des douleurs liées à votre activité ? Où ?", 20, y)
  y += 5
  doc.rect(20, y, 170, 15)
  y += 20
  
  doc.text("7. Décrivez les gestes répétitifs ou efforts dans votre travail quotidien.", 20, y)
  y += 5
  doc.rect(20, y, 170, 15)
  
  addFooter(doc, DOC_CODES.positionnementGP)
  
  return doc
}

// ============================================================
// GÉNÉRER TEST DE POSITIONNEMENT HABILITATION ÉLECTRIQUE
// ============================================================
function generatePositionnementElec(session, trainee) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session?.courses || {}
  
  let y = addHeaderWithTitle(doc, "TEST DE POSITIONNEMENT - HABILITATION ÉLECTRIQUE")
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text("(À remplir par le stagiaire en début de formation)", pageWidth / 2, y, { align: 'center' })
  y += 8
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nom : ${trainee?.last_name?.toUpperCase() || '_____________'}  Prénom : ${trainee?.first_name || '_____________'}`, 20, y)
  y += 6
  doc.text(`Formation : ${course?.title || 'Habilitation Électrique'}`, 20, y)
  y += 6
  doc.text(`Habilitation visée : ☐ B0H0V   ☐ BS   ☐ BE Manœuvre`, 20, y)
  y += 6
  doc.text(`Date : ${formatDate(session?.start_date) || '___ / ___ / ______'}`, 20, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('PARTIE 1 : QUESTIONS À CHOIX MULTIPLES', 20, y)
  y += 8
  
  const qcmQuestions = [
    { q: "1. La tension domestique en France est de :", options: ["110V", "230V", "380V"] },
    { q: "2. Le risque principal de l'électricité est :", options: ["Le bruit", "L'électrocution", "La chaleur"] },
    { q: "3. B0 signifie :", options: ["Travaux sous tension", "Non électricien - basse tension", "Électricien confirmé"] },
    { q: "4. Avant d'intervenir sur un équipement, il faut :", options: ["Vérifier l'absence de tension", "Mettre des gants", "Prévenir un collègue"] },
    { q: "5. Le VAT (Vérificateur d'Absence de Tension) sert à :", options: ["Mesurer la puissance", "Vérifier qu'il n'y a pas de courant", "Réparer un câble"] },
  ]
  
  doc.setFont('helvetica', 'normal')
  qcmQuestions.forEach(item => {
    doc.setFont('helvetica', 'bold')
    doc.text(item.q, 20, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    item.options.forEach(opt => {
      doc.text(`☐ ${opt}`, 30, y)
      y += 5
    })
    y += 3
  })
  
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text('PARTIE 2 : QUESTIONS OUVERTES', 20, y)
  y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.text("6. Avez-vous déjà été habilité électriquement ? Si oui, quel niveau ?", 20, y)
  y += 5
  doc.rect(20, y, 170, 12)
  y += 17
  
  doc.text("7. Décrivez les opérations électriques que vous réalisez dans votre travail.", 20, y)
  y += 5
  doc.rect(20, y, 170, 15)
  
  addFooter(doc, DOC_CODES.positionnementElec)
  
  return doc
}

// ============================================================
// GÉNÉRER TEST DE POSITIONNEMENT CACES R485/R489
// ============================================================
function generatePositionnementCaces(session, trainee, type = 'R489') {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const course = session?.courses || {}
  
  const title = type === 'R485' ? 'CACES R485 - Chariots gerbeurs' : 'CACES R489 - Chariots automoteurs'
  
  let y = addHeaderWithTitle(doc, `TEST DE POSITIONNEMENT - ${title}`)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text("(À remplir par le stagiaire en début de formation)", pageWidth / 2, y, { align: 'center' })
  y += 8
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Nom : ${trainee?.last_name?.toUpperCase() || '_____________'}  Prénom : ${trainee?.first_name || '_____________'}`, 20, y)
  y += 6
  doc.text(`Formation : ${course?.title || title}`, 20, y)
  y += 6
  doc.text(`Catégorie visée : _____________`, 20, y)
  y += 6
  doc.text(`Date : ${formatDate(session?.start_date) || '___ / ___ / ______'}`, 20, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('PARTIE 1 : QUESTIONS À CHOIX MULTIPLES', 20, y)
  y += 8
  
  const qcmQuestions = [
    { q: "1. Que signifie CACES ?", options: ["Certificat d'Aptitude à la Conduite En Sécurité", "Contrôle Annuel des Chariots En Service", "Certification Automobile et Cariste"] },
    { q: "2. Avant d'utiliser un chariot, il faut :", options: ["Faire le plein", "Vérifier l'état du chariot", "Appeler le chef"] },
    { q: "3. La charge maximale d'un chariot est indiquée sur :", options: ["Le manuel", "La plaque de charge", "Le volant"] },
    { q: "4. Pour circuler en sécurité, les fourches doivent être :", options: ["Au ras du sol", "À hauteur d'homme", "Le plus haut possible"] },
    { q: "5. Le port de la ceinture de sécurité est :", options: ["Optionnel", "Obligatoire", "Réservé aux débutants"] },
  ]
  
  doc.setFont('helvetica', 'normal')
  qcmQuestions.forEach(item => {
    doc.setFont('helvetica', 'bold')
    doc.text(item.q, 20, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    item.options.forEach(opt => {
      doc.text(`☐ ${opt}`, 30, y)
      y += 5
    })
    y += 3
  })
  
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text('PARTIE 2 : EXPÉRIENCE ET PRATIQUE', 20, y)
  y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.text("6. Avez-vous déjà conduit un chariot élévateur ? Depuis combien de temps ?", 20, y)
  y += 5
  doc.rect(20, y, 170, 12)
  y += 17
  
  doc.text("7. Quels types de chariots avez-vous déjà utilisés ?", 20, y)
  y += 5
  doc.rect(20, y, 170, 12)
  y += 17
  
  doc.text("8. Avez-vous un CACES en cours de validité ? Si oui, lequel ?", 20, y)
  y += 5
  doc.rect(20, y, 170, 12)
  
  const codeDoc = type === 'R485' ? DOC_CODES.positionnementR485 : DOC_CODES.positionnementR489
  addFooter(doc, codeDoc)
  
  return doc
}

// ============================================================
// TÉLÉCHARGER UN DOCUMENT
// ============================================================
export function downloadDocument(docType, session, options = {}) {
  const { trainees = [], trainee = null, client = null, trainer = null, course = null, attendances = [], content = '' } = options
  
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
    case 'evaluationFroid':
      doc = generateEvaluationFroid(session, trainee, trainer)
      filename = `EvaluationFroid_${trainee?.last_name || ''}_${session.reference}.pdf`
      break
    case 'reglement':
      doc = generateReglementInterieur(content)
      filename = `Reglement_Interieur.pdf`
      break
    case 'livret':
      doc = generateLivretAccueil(content)
      filename = `Livret_Accueil.pdf`
      break
    case 'analyseBesoin':
      doc = generateAnalyseBesoin(session, client || session?.clients, course || session?.courses)
      filename = `Analyse_Besoin_${session?.reference || 'formation'}.pdf`
      break
    case 'positionnementSST':
      doc = generatePositionnementSST(session, trainee)
      filename = `Positionnement_SST_${trainee?.last_name || ''}.pdf`
      break
    case 'positionnementIncendie':
      doc = generatePositionnementIncendie(session, trainee)
      filename = `Positionnement_Incendie_${trainee?.last_name || ''}.pdf`
      break
    case 'positionnementGP':
      doc = generatePositionnementGP(session, trainee)
      filename = `Positionnement_GP_${trainee?.last_name || ''}.pdf`
      break
    case 'positionnementElec':
      doc = generatePositionnementElec(session, trainee)
      filename = `Positionnement_Elec_${trainee?.last_name || ''}.pdf`
      break
    case 'positionnementR485':
      doc = generatePositionnementCaces(session, trainee, 'R485')
      filename = `Positionnement_R485_${trainee?.last_name || ''}.pdf`
      break
    case 'positionnementR489':
      doc = generatePositionnementCaces(session, trainee, 'R489')
      filename = `Positionnement_R489_${trainee?.last_name || ''}.pdf`
      break
    default:
      throw new Error(`Type de document inconnu: ${docType}`)
  }
  
  doc.save(filename)
  return filename
}

// ============================================================
// TÉLÉCHARGER TOUS LES DOCUMENTS D'UN TYPE (GROUPÉ)
// ============================================================
export function downloadAllDocuments(docType, session, trainees, options = {}) {
  const { client = null, trainer = null } = options
  
  if (!trainees || trainees.length === 0) {
    throw new Error('Aucun stagiaire')
  }
  
  const doc = new jsPDF()
  let filename = ''
  let isFirst = true
  
  trainees.forEach((trainee, index) => {
    if (!isFirst) {
      doc.addPage()
    }
    isFirst = false
    
    let y
    const course = session.courses || {}
    const pageWidth = doc.internal.pageSize.getWidth()
    
    switch (docType) {
      case 'convocation':
        filename = `Convocations_${session.reference}.pdf`
        // Générer convocation dans le doc
        y = addHeaderWithTitle(doc, 'CONVOCATION À LA FORMATION')
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
        doc.text(`Intitulé : ${course.title || ''}`, 20, y)
        y += 6
        doc.text(`Dates : ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, 20, y)
        y += 6
        doc.text(`Horaires : ${formatTime(session.start_time) || '09h00'} - ${formatTime(session.end_time) || '17h00'}`, 20, y)
        y += 6
        doc.text(`Lieu : ${session.location || ''}`, 20, y)
        y += 6
        doc.setFont('helvetica', 'normal')
        doc.text(`Formateur : ${trainer?.first_name || ''} ${trainer?.last_name || ''}`, 20, y)
        addFooter(doc, DOC_CODES.convocation)
        break
        
      case 'attestation':
        filename = `Attestations_${session.reference}.pdf`
        y = addHeaderWithTitle(doc, 'ATTESTATION DE PRÉSENCE')
        y += 10
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`Je soussigné, ${ORG.dirigeant}, représentant l'organisme de formation ${ORG.name}, atteste que :`, 20, y)
        y += 12
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(`${trainee.first_name} ${trainee.last_name?.toUpperCase()}`, pageWidth / 2, y, { align: 'center' })
        y += 10
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`A participé à la formation : ${course.title || ''}`, 20, y)
        y += 6
        doc.text(`Du ${formatDate(session.start_date)} au ${formatDate(session.end_date)} - Durée : ${course.duration_hours || 0} heures`, 20, y)
        y += 20
        doc.text('Fait pour servir et valoir ce que de droit.', 20, y)
        y += 15
        doc.text(`Fait à Concarneau, le ${formatDate(new Date())}`, pageWidth - 80, y)
        y += 6
        doc.setFont('helvetica', 'bold')
        doc.text(ORG.dirigeant, pageWidth - 80, y)
        try { doc.addImage(STAMP_BASE64, 'JPEG', pageWidth - 80, y + 5, 55, 28) } catch (e) {}
        addFooter(doc, DOC_CODES.attestation)
        break
        
      case 'certificat':
        filename = `Certificats_${session.reference}.pdf`
        // Certificat complet
        y = addHeader(doc)
        y += 10
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text('CERTIFICAT DE RÉALISATION', pageWidth / 2, y, { align: 'center' })
        y += 12
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        const introText = `Je soussigné, ${ORG.dirigeant}, représentant légal du dispensateur de l'action concourant au développement des compétences ${ORG.name}, ${ORG.address}`
        const introLines = doc.splitTextToSize(introText, 170)
        doc.text(introLines, 20, y)
        y += introLines.length * 5 + 8
        doc.text('Atteste que :', 20, y)
        y += 10
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(`${trainee.first_name} ${trainee.last_name?.toUpperCase()}`, pageWidth / 2, y, { align: 'center' })
        y += 7
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`Salarié(e) de l'entreprise ${client?.name || session.clients?.name || ''}`, pageWidth / 2, y, { align: 'center' })
        y += 10
        doc.text('A suivi l\'action', pageWidth / 2, y, { align: 'center' })
        y += 8
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text(course.title || '', pageWidth / 2, y, { align: 'center' })
        y += 10
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text("Nature de l'action :", 20, y)
        y += 8
        doc.rect(25, y - 4, 4, 4)
        doc.setFont('helvetica', 'bold')
        doc.text('✓', 25.5, y - 0.5)
        doc.setFont('helvetica', 'normal')
        doc.text('Action de formation', 32, y)
        y += 6
        doc.rect(25, y - 4, 4, 4)
        const t1 = 'Bilan de compétences'
        doc.text(t1, 32, y)
        doc.line(32, y - 1.5, 32 + doc.getTextWidth(t1), y - 1.5)
        y += 6
        doc.rect(25, y - 4, 4, 4)
        const t2 = 'Action de VAE'
        doc.text(t2, 32, y)
        doc.line(32, y - 1.5, 32 + doc.getTextWidth(t2), y - 1.5)
        y += 6
        doc.rect(25, y - 4, 4, 4)
        const t3 = 'Action de formation par apprentissage'
        doc.text(t3, 32, y)
        doc.line(32, y - 1.5, 32 + doc.getTextWidth(t3), y - 1.5)
        y += 12
        doc.text(`Qui s'est déroulée du ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, 20, y)
        y += 5
        doc.text(`Pour une durée de ${course.duration_hours || 0} heures.`, 20, y)
        y += 15
        doc.text('Fait à : Concarneau', 20, y)
        y += 5
        doc.text(`Le : ${formatDate(session.end_date)}`, 20, y)
        y += 12
        doc.setFont('helvetica', 'bold')
        doc.text(`${ORG.dirigeant}, Dirigeant ${ORG.name}`, pageWidth - 20, y, { align: 'right' })
        try { doc.addImage(STAMP_BASE64, 'JPEG', pageWidth - 75, y + 5, 55, 28) } catch (e) {}
        addFooter(doc, DOC_CODES.certificat)
        break
        
      case 'evaluation':
        filename = `Evaluations_${session.reference}.pdf`
        y = addHeaderWithTitle(doc, "FICHE D'ÉVALUATION DE SATISFACTION")
        doc.setFontSize(9)
        doc.text(`Formation : ${course.title || ''}`, 20, y)
        y += 5
        doc.text(`Stagiaire : ${trainee.first_name} ${trainee.last_name?.toUpperCase()}`, 20, y)
        y += 5
        doc.text(`Dates : ${formatDate(session.start_date)} au ${formatDate(session.end_date)}`, 20, y)
        y += 8
        doc.setFontSize(8)
        doc.text('1 = Non satisfait | 2 = Peu satisfait | 3 = Moyennement satisfait | 4 = Satisfait | 5 = Très satisfait', 20, y)
        y += 6
        const questions = [
          "Les objectifs étaient-ils clairement définis ?",
          "Le contenu correspondait-il à vos attentes ?",
          "Les méthodes pédagogiques étaient-elles adaptées ?",
          "Le formateur maîtrisait-il son sujet ?",
          "Les supports étaient-ils de qualité ?",
          "L'organisation était-elle satisfaisante ?",
          "La durée était-elle adaptée ?",
          "Cette formation vous sera-t-elle utile ?",
        ]
        const tableData = questions.map(q => [q, '☐', '☐', '☐', '☐', '☐'])
        doc.autoTable({
          startY: y,
          head: [['Critères', '1', '2', '3', '4', '5']],
          body: tableData,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [60, 60, 60] },
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 12, halign: 'center' },
            2: { cellWidth: 12, halign: 'center' },
            3: { cellWidth: 12, halign: 'center' },
            4: { cellWidth: 12, halign: 'center' },
            5: { cellWidth: 12, halign: 'center' },
          }
        })
        y = doc.autoTable.previous.finalY + 8
        doc.setFontSize(9)
        doc.text('Commentaires :', 20, y)
        doc.rect(20, y + 2, 170, 20)
        y += 25
        doc.text('Signature : __________________________', 20, y)
        addFooter(doc, DOC_CODES.evaluation)
        break
    }
  })
  
  doc.save(filename)
  return filename
}
