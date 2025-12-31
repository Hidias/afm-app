import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const APP_VERSION = 'V2.3'
const DOC_CODES = {
  convention: 'AF-CONV', convocation: 'AF-CONVOC', attestation: 'AF-ATTP',
  certificat: 'AF-CERT', emargement: 'AF-EMARG', programme: 'AF-PROG',
  evaluation: 'AF-EVAL', evaluationFroid: 'AF-EVALF', reglement: 'AF-RI',
  livret: 'AF-LIVRET', analyseBesoin: 'AF-BESOIN', evaluationFormateur: 'AF-EVFORM',
  positionnementSST: 'AF-POS-SST', positionnementIncendie: 'AF-POS-INC',
  positionnementGP: 'AF-POS-GP', positionnementElec: 'AF-POS-ELEC',
  positionnementR485: 'AF-POS-R485', positionnementR489: 'AF-POS-R489',
}

const ORG = {
  name: 'Access Formation', nameFull: 'SARL Access Formation',
  address: '24 rue Kerbleiz, 29900 Concarneau',
  addressFull: '24 Rue Kerbleiz - 29900 Concarneau - France',
  phone: '02 46 56 57 54', email: 'contact@accessformation.pro',
  siret: '943 563 866 00012', naf: '8559A', tva: 'FR71943563866',
  capital: '2500 €', nda: '53 29 10261 29',
  ndaFull: '53291026129 auprès du préfet de la région Bretagne',
  iban: 'FR76 1558 9297 0600 0890 6894 048', bic: 'CMBRFR2BXXXX',
  dirigeant: 'Hicham SAIDI',
}

const LOGO_BASE64 = 'data:image/jpeg;base64,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'
const STAMP_BASE64 = 'data:image/jpeg;base64,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'

const formatDate = (d) => d ? format(new Date(d), 'dd/MM/yyyy') : ''
const formatDateLong = (d) => d ? format(new Date(d), 'd MMMM yyyy', { locale: fr }) : ''

function addHeader(doc) {
  try { doc.addImage(LOGO_BASE64, 'JPEG', 15, 10, 35, 35) } catch {}
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.text(ORG.nameFull.toUpperCase(), 55, 18)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.text(ORG.address, 55, 24)
  doc.text(`Tél : ${ORG.phone}`, 55, 29)
  doc.text(`Email : ${ORG.email}`, 55, 34)
  doc.text(`SIRET : ${ORG.siret} - APE ${ORG.naf}`, 55, 39)
  return 55
}

function addHeaderWithTitle(doc, title, sessionRef = null) {
  let y = addHeader(doc)
  const pw = doc.internal.pageSize.getWidth()
  // Référence session en haut à droite
  if (sessionRef) {
    doc.setFontSize(8); doc.setTextColor(150, 150, 150)
    doc.text(sessionRef, pw - 15, 15, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }
  doc.setFillColor(30, 30, 30)
  doc.rect(0, y, pw, 12, 'F')
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
  doc.text(title, pw / 2, y + 8, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  return y + 20
}

function addFooter(doc, docCode, pageNum = null) {
  const ph = doc.internal.pageSize.getHeight()
  const pw = doc.internal.pageSize.getWidth()
  doc.setDrawColor(200); doc.setLineWidth(0.3)
  doc.line(15, ph - 25, pw - 15, ph - 25)
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100)
  doc.text(`${ORG.name} - ${ORG.addressFull}`, pw / 2, ph - 20, { align: 'center' })
  doc.text(`Déclaration d'activité : ${ORG.ndaFull}`, pw / 2, ph - 16, { align: 'center' })
  doc.text(`SIRET: ${ORG.siret} - NAF: ${ORG.naf} - TVA: ${ORG.tva}`, pw / 2, ph - 12, { align: 'center' })
  doc.setFontSize(6); doc.setTextColor(180)
  doc.text(`${docCode}-${APP_VERSION}`, pw - 15, ph - 5, { align: 'right' })
  if (pageNum) doc.text(`Page ${pageNum}`, 15, ph - 5)
  doc.setTextColor(0)
}

// ============================================================
// CONVENTION - TEXTE EXACT
// ============================================================
function generateConvention(session, trainees = [], trainer = null) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const client = session?.clients || {}
  const course = session?.courses || {}
  const ref = session?.reference || ''
  
  let y = addHeaderWithTitle(doc, 'CONVENTION DE FORMATION PROFESSIONNELLE', ref)
  
  doc.setFontSize(8); doc.setFont('helvetica', 'italic')
  doc.text('Conformément aux articles L6353-1 à L6353-9 et D6313-3-1 du Code du travail', pw / 2, y, { align: 'center' })
  y += 10
  
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.text('ENTRE LES SOUSSIGNÉS', pw / 2, y, { align: 'center' }); y += 8
  
  doc.setFont('helvetica', 'bold'); doc.text("L'Organisme de formation :", 20, y); y += 5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`${ORG.nameFull}`, 20, y); y += 4
  doc.text(`SIRET : ${ORG.siret}`, 20, y); y += 4
  doc.text(`Déclaration d'activité (NDA) : ${ORG.nda} - DREETS Bretagne`, 20, y); y += 4
  doc.text(`Siège social : ${ORG.address}`, 20, y); y += 4
  doc.text(`Représenté par : ${ORG.dirigeant}, Dirigeant`, 20, y); y += 4
  doc.text(`Tél. : ${ORG.phone} - Courriel : ${ORG.email}`, 20, y); y += 4
  doc.text('Ci-après dénommé « l\'Organisme de Formation »', 20, y); y += 10
  
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('ET', pw / 2, y, { align: 'center' }); y += 6
  doc.text("L'entreprise bénéficiaire :", 20, y); y += 5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Raison sociale : ${client.name || ''}`, 20, y); y += 4
  doc.text(`Adresse : ${client.address || ''}`, 20, y); y += 4
  doc.text(`Représentée par : ${client.contact_name || ''}`, 20, y); y += 4
  doc.text(`N° SIRET : ${client.siret || ''}`, 20, y); y += 4
  doc.text('Ci-après dénommée « le Bénéficiaire »', 20, y); y += 12
  
  // Article 1
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('Article 1 – Objet, durée et effectif de la formation', 20, y); y += 6
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('Le Bénéficiaire souhaite faire participer une partie de son personnel à la formation suivante :', 20, y); y += 6
  doc.setFont('helvetica', 'bold')
  doc.text(`Intitulé : ${course.title || ''}`, 25, y); y += 5
  doc.setFont('helvetica', 'normal')
  doc.text("Type d'action : Action de formation", 25, y); y += 5
  doc.text(`Objectif(s) professionnel(s) : ${course.objectives || ''}`, 25, y, { maxWidth: 160 }); y += 10
  
  if (trainees.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('Liste des apprenants désignés par le Bénéficiaire :', 25, y); y += 5
    doc.setFont('helvetica', 'normal')
    trainees.forEach(t => { doc.text(`${t.last_name?.toUpperCase()} ${t.first_name}`, 30, y); y += 4 })
    y += 3
  }
  
  doc.text(`Durée (heures) : ${course.duration || ''}`, 25, y); y += 5
  doc.text(`Dates du : ${formatDate(session?.start_date)} au : ${formatDate(session?.end_date)}   Horaires : ${session?.start_time || ''} - ${session?.end_time || ''}`, 25, y); y += 5
  doc.text(`Effectif (participants) : ${trainees.length}`, 25, y); y += 5
  doc.text(`Lieu : ${session?.location || ''}`, 25, y); y += 5
  doc.text(`Public concerné : ${course.target_audience || 'Tout public'}`, 25, y); y += 5
  doc.text(`Prérequis : ${course.prerequisites || 'Aucun'}`, 25, y); y += 5
  doc.text(`Formateur référent : ${trainer ? `${trainer.first_name} ${trainer.last_name}` : ORG.dirigeant}`, 25, y); y += 10
  
  // Articles 2-10
  const articles = [
    { title: 'Article 2 – Engagements des parties', text: "Le Bénéficiaire s'engage à assurer la présence des stagiaires inscrits et à fournir les moyens nécessaires à la réalisation de la formation (salle, matériel, conditions d'accueil). L'Organisme de Formation s'engage à mettre en œuvre les moyens pédagogiques, techniques et d'encadrement nécessaires pour atteindre les objectifs visés." },
    { title: 'Article 3 – Dispositions financières', text: `Coût total de la formation (en € HT) : ${session?.total_price || course.price_per_day || ''} € HT\nModalités de paiement : conformément au devis validé par virement bancaire\nIBAN : ${ORG.iban} - BIC : ${ORG.bic}\nAucun acompte ne sera demandé avant la formation.` },
    { title: 'Article 4 – Moyens et modalités pédagogiques', text: "La formation est dispensée selon une pédagogie active et participative : alternance d'apports théoriques, démonstrations pratiques et mises en situation ; utilisation de supports visuels et matériels spécifiques.\nUne feuille d'émargement par demi-journée est signée par chaque stagiaire et le formateur." },
    { title: "Article 5 – Modalités de suivi et d'évaluation", text: "Évaluation formative pendant la formation (mises en situation, QCM, exercices pratiques). Validation des acquis selon les critères du référentiel concerné. Délivrance d'un certificat de réalisation indiquant le niveau d'atteinte des objectifs : Acquis / Non acquis." },
    { title: 'Article 6 – Sanction et documents délivrés', text: "À l'issue de la formation, l'Organisme de Formation délivrera : une attestation de présence, un certificat de réalisation (Acquis / Non acquis) et, le cas échéant, une attestation officielle selon le module suivi." },
    { title: 'Article 7 – Annulation, dédommagement, force majeure', text: "En cas de désistement du Bénéficiaire moins de 14 jours avant le début de la formation, une indemnité forfaitaire de 50 % du coût total sera facturée. En cas de désistement moins de 7 jours avant, 75 % sera facturé. En cas d'annulation par Access Formation moins de 7 jours avant, une nouvelle date sera proposée sans frais." },
    { title: 'Article 8 – Accessibilité et personnes en situation de handicap', text: `Access Formation s'engage à favoriser l'accès à ses formations pour toute personne en situation de handicap. Toute demande d'adaptation doit être signalée en amont à ${ORG.email}.` },
    { title: 'Article 9 – Protection des données (RGPD)', text: "Les données personnelles collectées sont utilisées exclusivement dans le cadre de la gestion administrative et pédagogique des formations. Elles sont conservées 5 ans et accessibles sur demande conformément au RGPD." },
    { title: 'Article 10 – Litiges', text: "En cas de différend, les parties s'efforceront de trouver une solution amiable. À défaut, le litige sera porté devant le tribunal de commerce de Quimper." },
  ]
  
  articles.forEach(art => {
    if (y > 250) { addFooter(doc, DOC_CODES.convention); doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text(art.title, 20, y); y += 5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    const lines = doc.splitTextToSize(art.text, 170)
    lines.forEach(l => { doc.text(l, 20, y); y += 4 })
    y += 5
  })
  
  // Signatures
  if (y > 230) { addFooter(doc, DOC_CODES.convention); doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text(`Fait à Concarneau, le ${formatDate(new Date())}`, 20, y); y += 10
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text("Pour l'Organisme de Formation", 25, y)
  doc.text('Pour le Bénéficiaire', pw / 2 + 20, y); y += 4
  doc.text(`${ORG.name}`, 25, y)
  doc.text('(Cachet et signature)', pw / 2 + 20, y); y += 4
  doc.text('(Cachet et signature)', 25, y); y += 5
  try { doc.addImage(STAMP_BASE64, 'JPEG', 25, y, 50, 18) } catch {}
  
  addFooter(doc, DOC_CODES.convention)
  return doc
}

// ============================================================
// CERTIFICAT - TEXTE EXACT
// ============================================================
function generateCertificat(session, trainee, trainer = null) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const course = session?.courses || {}
  const client = session?.clients || {}
  const ref = session?.reference || ''
  
  let y = addHeaderWithTitle(doc, 'CERTIFICAT DE RÉALISATION', ref)
  
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text(`Je soussigné, ${ORG.dirigeant}, représentant légal du dispensateur de l'action concourant`, 20, y); y += 5
  doc.text(`au développement des compétences ${ORG.name}, ${ORG.address}`, 20, y); y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('Atteste que :', 20, y); y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.text(`${trainee?.first_name || ''} ${trainee?.last_name?.toUpperCase() || ''}`, pw / 2, y, { align: 'center' }); y += 6
  doc.text(`Salarié(e) de l'entreprise : ${client.name || ''}`, 20, y); y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('A suivi l\'action :', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`${course.title || ''}`, pw / 2, y, { align: 'center' }); y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text("Nature de l'action concourant au développement des compétences :", 20, y); y += 8
  
  // Cases à cocher - ☐ pour non coché, ☑ pour coché
  doc.setFont('helvetica', 'normal')
  doc.text('☑  Action de formation', 25, y); y += 6
  doc.setTextColor(150); doc.text('☐  Bilan de compétences', 25, y); y += 6
  doc.text('☐  Action de VAE', 25, y); y += 6
  doc.text('☐  Action de formation par apprentissage', 25, y); y += 10
  doc.setTextColor(0)
  
  doc.text(`Qui s'est déroulée du ${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`, 20, y); y += 6
  doc.text(`Pour une durée de ${course.duration || ''} heures.`, 20, y); y += 12
  
  doc.setFontSize(8)
  doc.text("Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m'engage", 20, y); y += 4
  doc.text("à conserver l'ensemble des pièces justificatives ayant permis d'établir le présent certificat pendant", 20, y); y += 4
  doc.text("une durée de 3 ans à compter de la fin de l'année du dernier paiement.", 20, y); y += 10
  
  doc.setFontSize(10)
  doc.text(`Fait à : Concarneau`, 20, y); y += 6
  doc.text(`Le : ${formatDate(new Date())}`, 20, y); y += 10
  
  doc.text('Cachet et signature du responsable du dispensateur de formation :', 20, y); y += 5
  try { doc.addImage(STAMP_BASE64, 'JPEG', 20, y, 55, 20) } catch {}
  doc.text(`${ORG.dirigeant}, Dirigeant ${ORG.name}`, 80, y + 10)
  
  addFooter(doc, DOC_CODES.certificat)
  return doc
}

// ============================================================
// ÉMARGEMENT - AVEC DATES CENTRÉES ET EMAIL
// ============================================================
function generateEmargement(session, trainees = [], trainer = null) {
  const doc = new jsPDF('landscape')
  const pw = doc.internal.pageSize.getWidth()
  const course = session?.courses || {}
  const ref = session?.reference || ''
  
  // Référence en haut à droite
  doc.setFontSize(8); doc.setTextColor(150)
  doc.text(ref, pw - 15, 10, { align: 'right' })
  doc.setTextColor(0)
  
  let y = 15
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text("FEUILLE D'ÉMARGEMENT", pw / 2, y, { align: 'center' }); y += 8
  
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text(`Formation : ${course.title || ''}`, 15, y)
  doc.text(`Client : ${session?.clients?.name || ''}`, pw / 2, y); y += 5
  doc.text(`Dates : ${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`, 15, y)
  doc.text(`Lieu : ${session?.location || ''}`, pw / 2, y); y += 5
  doc.text(`Formateur : ${trainer ? `${trainer.first_name} ${trainer.last_name}` : ORG.dirigeant}`, 15, y); y += 8
  
  // Obtenir les jours
  let days = []
  if (session?.start_date && session?.end_date) {
    try { days = eachDayOfInterval({ start: parseISO(session.start_date), end: parseISO(session.end_date) }) } catch {}
  }
  if (days.length === 0) days = [new Date()]
  
  // Tableau avec dates centrées au-dessus des colonnes
  const colWidth = Math.min(25, (pw - 100) / (days.length * 2))
  const startX = 15
  const nameColW = 50
  const emailColW = 35
  
  // En-tête
  doc.setFillColor(240, 240, 240)
  doc.rect(startX, y, nameColW + emailColW + days.length * colWidth * 2, 14, 'F')
  
  doc.setFontSize(8); doc.setFont('helvetica', 'bold')
  doc.text('Nom Prénom', startX + 2, y + 9)
  doc.text('Email', startX + nameColW + 2, y + 9)
  
  let x = startX + nameColW + emailColW
  days.forEach(day => {
    const dateStr = format(day, 'dd/MM', { locale: fr })
    const centerX = x + colWidth
    doc.text(dateStr, centerX, y + 4, { align: 'center' })
    doc.text('Matin', x + colWidth / 2, y + 10, { align: 'center' })
    doc.text('Après-midi', x + colWidth + colWidth / 2, y + 10, { align: 'center' })
    x += colWidth * 2
  })
  y += 14
  
  // Lignes
  const rows = trainees.length > 0 ? trainees : Array(10).fill({})
  doc.setFont('helvetica', 'normal')
  rows.forEach((t, i) => {
    doc.rect(startX, y, nameColW, 12)
    doc.rect(startX + nameColW, y, emailColW, 12)
    if (t.first_name) doc.text(`${t.last_name?.toUpperCase() || ''} ${t.first_name || ''}`, startX + 2, y + 8)
    if (t.email) {
      doc.setFontSize(6)
      doc.text(t.email.substring(0, 25), startX + nameColW + 2, y + 8)
      doc.setFontSize(8)
    }
    let xx = startX + nameColW + emailColW
    days.forEach(() => {
      doc.rect(xx, y, colWidth, 12)
      doc.rect(xx + colWidth, y, colWidth, 12)
      xx += colWidth * 2
    })
    y += 12
  })
  
  y += 10
  doc.setFontSize(9)
  doc.text('Signature du formateur :', 15, y)
  doc.rect(15, y + 2, 60, 20)
  try { doc.addImage(STAMP_BASE64, 'JPEG', 18, y + 4, 40, 15) } catch {}
  
  addFooter(doc, DOC_CODES.emargement)
  return doc
}

// ============================================================
// ÉVALUATION À CHAUD - AVEC RECOMMANDATION
// ============================================================
function generateEvaluation(session, trainee = null, isBlank = false) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ref = session?.reference || ''
  
  let y = addHeaderWithTitle(doc, 'ÉVALUATION À CHAUD', isBlank ? '' : ref)
  
  doc.setFontSize(9)
  doc.text(`Formation : ${isBlank ? '________________________' : (session?.courses?.title || '')}`, 20, y)
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(session?.start_date)}`, pw / 2 + 20, y); y += 6
  doc.text(`Stagiaire : ${isBlank ? '________________________' : (trainee ? `${trainee.first_name} ${trainee.last_name}` : '')}`, 20, y); y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('Merci de noter chaque critère de 1 (insuffisant) à 5 (excellent)', 20, y); y += 8
  
  const criteres = [
    'Organisation générale de la formation',
    'Qualité des supports pédagogiques',
    'Compétences du formateur',
    'Clarté des explications',
    'Réponses aux questions',
    'Rythme de la formation',
    'Conditions matérielles (salle, équipements)',
    "Adéquation avec vos attentes",
  ]
  
  doc.setFont('helvetica', 'normal')
  criteres.forEach(c => {
    doc.text(c, 25, y)
    for (let i = 1; i <= 5; i++) doc.text(`☐ ${i}`, 145 + (i - 1) * 10, y)
    y += 7
  })
  
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text('Recommanderiez-vous cette formation ?', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('☐  Oui', 30, y)
  doc.text('☐  Non', 60, y); y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('Commentaires et suggestions :', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(20, y, 170, 40); y += 50
  
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(new Date())}`, 20, y)
  doc.text('Signature :', 120, y)
  
  addFooter(doc, DOC_CODES.evaluation)
  return doc
}

// ============================================================
// AUTRES GÉNÉRATEURS
// ============================================================
function generateConvocation(session, trainee, trainer) {
  const doc = new jsPDF()
  const ref = session?.reference || ''
  let y = addHeaderWithTitle(doc, 'CONVOCATION', ref)
  doc.setFontSize(10)
  doc.text(`${trainee?.first_name || ''} ${trainee?.last_name || ''}`, 20, y); y += 10
  doc.text(`Vous êtes convoqué(e) à la formation :`, 20, y); y += 6
  doc.setFont('helvetica', 'bold')
  doc.text(`${session?.courses?.title || ''}`, 25, y); y += 10
  doc.setFont('helvetica', 'normal')
  doc.text(`Date(s) : ${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`, 25, y); y += 6
  doc.text(`Horaires : ${session?.start_time || ''} - ${session?.end_time || ''}`, 25, y); y += 6
  doc.text(`Lieu : ${session?.location || ''}`, 25, y); y += 6
  doc.text(`Formateur : ${trainer ? `${trainer.first_name} ${trainer.last_name}` : ORG.dirigeant}`, 25, y); y += 15
  doc.text('Merci de vous présenter 10 minutes avant le début de la formation.', 20, y); y += 20
  doc.text(`Fait à Concarneau, le ${formatDate(new Date())}`, 20, y); y += 15
  try { doc.addImage(STAMP_BASE64, 'JPEG', 20, y, 50, 18) } catch {}
  addFooter(doc, DOC_CODES.convocation)
  return doc
}

function generateAttestation(session, trainee, trainer) {
  const doc = new jsPDF()
  const ref = session?.reference || ''
  let y = addHeaderWithTitle(doc, 'ATTESTATION DE PRÉSENCE', ref)
  doc.setFontSize(10)
  doc.text(`Je soussigné, ${ORG.dirigeant}, représentant ${ORG.name}, atteste que :`, 20, y); y += 10
  doc.setFont('helvetica', 'bold')
  doc.text(`${trainee?.first_name || ''} ${trainee?.last_name?.toUpperCase() || ''}`, 25, y); y += 8
  doc.setFont('helvetica', 'normal')
  doc.text(`A suivi la formation : ${session?.courses?.title || ''}`, 25, y); y += 6
  doc.text(`Du ${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`, 25, y); y += 6
  doc.text(`Durée : ${session?.courses?.duration || ''} heures`, 25, y); y += 15
  doc.text(`Fait à Concarneau, le ${formatDate(new Date())}`, 20, y); y += 15
  try { doc.addImage(STAMP_BASE64, 'JPEG', 20, y, 50, 18) } catch {}
  addFooter(doc, DOC_CODES.attestation)
  return doc
}

function generateProgramme(session, trainer = null) {
  const doc = new jsPDF()
  const course = session?.courses || {}
  const ref = session?.reference || ''
  let y = addHeaderWithTitle(doc, 'PROGRAMME DE FORMATION', ref)
  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.text(course.title || '', 20, y); y += 10
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text(`Durée : ${course.duration || ''} heures`, 20, y); y += 6
  doc.text(`Public : ${course.target_audience || 'Tout public'}`, 20, y); y += 6
  doc.text(`Prérequis : ${course.prerequisites || 'Aucun'}`, 20, y); y += 10
  doc.setFont('helvetica', 'bold'); doc.text('Objectifs :', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  const objLines = doc.splitTextToSize(course.objectives || '', 170)
  objLines.forEach(l => { doc.text(l, 25, y); y += 5 }); y += 5
  doc.setFont('helvetica', 'bold'); doc.text('Contenu :', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  const contLines = doc.splitTextToSize(course.content || '', 170)
  contLines.forEach(l => { doc.text(l, 25, y); y += 5 }); y += 5
  doc.setFont('helvetica', 'bold'); doc.text('Méthodes pédagogiques :', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(course.methods || 'Apports théoriques, exercices pratiques, mises en situation.', 25, y); y += 10
  doc.setFont('helvetica', 'bold'); doc.text('Évaluation :', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('Évaluation formative continue. QCM et/ou mise en situation pratique.', 25, y)
  addFooter(doc, DOC_CODES.programme)
  return doc
}

function generateEvaluationFroid(session, trainee = null, isBlank = false) {
  const doc = new jsPDF()
  const ref = session?.reference || ''
  let y = addHeaderWithTitle(doc, 'ÉVALUATION À FROID', isBlank ? '' : ref)
  doc.setFontSize(9)
  doc.text(`Formation : ${isBlank ? '________________________' : (session?.courses?.title || '')}`, 20, y); y += 6
  doc.text(`Date de formation : ${isBlank ? '___/___/______' : formatDate(session?.start_date)}`, 20, y); y += 6
  doc.text(`Stagiaire : ${isBlank ? '________________________' : (trainee ? `${trainee.first_name} ${trainee.last_name}` : '')}`, 20, y); y += 10
  doc.text('Cette évaluation est à remplir 1 à 3 mois après la formation.', 20, y); y += 10
  const questions = [
    'Avez-vous pu mettre en pratique les compétences acquises ?',
    'Les objectifs de la formation ont-ils été atteints ?',
    'La formation a-t-elle répondu à vos besoins professionnels ?',
    'Avez-vous constaté une amélioration dans votre travail ?',
  ]
  questions.forEach(q => {
    doc.setFont('helvetica', 'bold'); doc.text(q, 20, y); y += 6
    doc.setFont('helvetica', 'normal')
    doc.text('☐ Oui  ☐ Non  ☐ Partiellement', 25, y); y += 10
  })
  doc.setFont('helvetica', 'bold'); doc.text('Commentaires :', 20, y); y += 5
  doc.rect(20, y, 170, 30); y += 40
  doc.setFont('helvetica', 'normal')
  doc.text(`Date : ${isBlank ? '___/___/______' : ''}`, 20, y)
  doc.text('Signature :', 120, y)
  addFooter(doc, DOC_CODES.evaluationFroid)
  return doc
}

function generateReglement() {
  const doc = new jsPDF()
  let y = addHeaderWithTitle(doc, 'RÈGLEMENT INTÉRIEUR')
  doc.setFontSize(9)
  const sections = [
    { title: 'Article 1 - Objet et champ d\'application', text: 'Le présent règlement est établi conformément aux articles L.6352-3 et L.6352-4 du Code du travail. Il s\'applique à tous les stagiaires participant aux formations dispensées par Access Formation.' },
    { title: 'Article 2 - Discipline', text: 'Les stagiaires doivent respecter les horaires, les consignes de sécurité et les règles de fonctionnement de l\'établissement.' },
    { title: 'Article 3 - Sanctions', text: 'Tout manquement aux règles pourra faire l\'objet d\'une sanction pouvant aller jusqu\'à l\'exclusion.' },
    { title: 'Article 4 - Représentation des stagiaires', text: 'Pour les formations de plus de 500 heures, un délégué des stagiaires sera élu.' },
    { title: 'Article 5 - Hygiène et sécurité', text: 'Les stagiaires doivent respecter les consignes d\'hygiène et de sécurité, notamment l\'interdiction de fumer.' },
  ]
  sections.forEach(s => {
    doc.setFont('helvetica', 'bold'); doc.text(s.title, 20, y); y += 5
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(s.text, 170)
    lines.forEach(l => { doc.text(l, 20, y); y += 4 }); y += 5
  })
  addFooter(doc, DOC_CODES.reglement)
  return doc
}

function generateLivret(session = null) {
  const doc = new jsPDF()
  let y = addHeaderWithTitle(doc, "LIVRET D'ACCUEIL DU STAGIAIRE", session?.reference)
  doc.setFontSize(10)
  doc.text('Bienvenue chez Access Formation !', 20, y); y += 10
  const sections = [
    { title: 'Qui sommes-nous ?', text: `${ORG.nameFull} est un organisme de formation spécialisé dans la sécurité au travail.` },
    { title: 'Vos interlocuteurs', text: `Responsable : ${ORG.dirigeant}\nContact : ${ORG.phone} - ${ORG.email}` },
    { title: 'Déroulement de la formation', text: 'Horaires habituels : 9h00-12h30 / 13h30-17h00\nPauses : 10h30 et 15h30' },
    { title: 'Règles de vie', text: '- Ponctualité\n- Téléphones en silencieux\n- Respect des autres participants' },
    { title: 'En cas de problème', text: `Contactez-nous : ${ORG.phone}` },
  ]
  sections.forEach(s => {
    doc.setFont('helvetica', 'bold'); doc.text(s.title, 20, y); y += 6
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(s.text, 170)
    lines.forEach(l => { doc.text(l, 25, y); y += 5 }); y += 5
  })
  addFooter(doc, DOC_CODES.livret)
  return doc
}

function generateAnalyseBesoin(session = null, isBlank = false) {
  const doc = new jsPDF()
  let y = addHeaderWithTitle(doc, 'ANALYSE DU BESOIN DE FORMATION', isBlank ? '' : session?.reference)
  doc.setFontSize(9)
  doc.text(`Entreprise : ${isBlank ? '________________________' : (session?.clients?.name || '')}`, 20, y)
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(new Date())}`, 130, y); y += 10
  const sections = ['1. CONTEXTE', '2. OBJECTIFS', '3. PUBLIC CONCERNÉ', '4. CONTRAINTES']
  sections.forEach(s => {
    doc.setFont('helvetica', 'bold'); doc.text(s, 20, y); y += 5
    doc.setFont('helvetica', 'normal'); doc.rect(20, y, 170, 25); y += 30
  })
  doc.text('Signature entreprise :', 20, y); doc.rect(20, y + 3, 60, 20)
  doc.text('Signature Access Formation :', 110, y); doc.rect(110, y + 3, 60, 20)
  addFooter(doc, DOC_CODES.analyseBesoin)
  return doc
}

function generatePositionnement(type, session = null, isBlank = false) {
  const doc = new jsPDF()
  const configs = {
    SST: { title: 'TEST DE POSITIONNEMENT - SST', code: DOC_CODES.positionnementSST, questions: [
      { q: 'Que signifie SST ?', opts: ['Sauveteur Secouriste du Travail', 'Service de Sécurité au Travail', 'Système de Santé du Travailleur'] },
      { q: 'Quel est le premier réflexe face à un accident ?', opts: ['Protéger', 'Alerter', 'Secourir'] },
      { q: 'La PLS signifie :', opts: ['Position Latérale de Sécurité', 'Premiers gestes de Libération', 'Protection Locale Sécuritaire'] },
    ]},
    Incendie: { title: 'TEST DE POSITIONNEMENT - INCENDIE', code: DOC_CODES.positionnementIncendie, questions: [
      { q: 'Quels sont les 3 éléments du triangle du feu ?', opts: ['Combustible, Comburant, Énergie', 'Eau, Terre, Air', 'Chaleur, Fumée, Flamme'] },
      { q: 'Quel extincteur pour un feu électrique ?', opts: ['Eau', 'CO2', 'Mousse'] },
    ]},
    GP: { title: 'TEST DE POSITIONNEMENT - GESTES ET POSTURES', code: DOC_CODES.positionnementGP, questions: [
      { q: 'Les TMS signifient :', opts: ['Troubles Musculo-Squelettiques', 'Techniques de Manutention', 'Tests de Mobilité'] },
      { q: 'Bonne posture pour soulever :', opts: ['Dos droit, genoux fléchis', 'Dos courbé', 'Bras tendus'] },
    ]},
    Elec: { title: 'TEST DE POSITIONNEMENT - HABILITATION ÉLECTRIQUE', code: DOC_CODES.positionnementElec, questions: [
      { q: 'B0H0V signifie :', opts: ['Non électricien en zone électrique', 'Électricien haute tension', 'Basse tension niveau 0'] },
      { q: 'Tension dangereuse en alternatif :', opts: ['Au-dessus de 50V', 'Au-dessus de 1000V', 'Au-dessus de 12V'] },
    ]},
    R485: { title: 'TEST DE POSITIONNEMENT - CACES R485', code: DOC_CODES.positionnementR485, questions: [
      { q: 'CACES signifie :', opts: ['Certificat d\'Aptitude à la Conduite En Sécurité', 'Contrôle Annuel des Chariots', 'Certification Automobile'] },
      { q: 'Avant utilisation, il faut :', opts: ['Vérifier l\'état du chariot', 'Faire le plein', 'Appeler le chef'] },
    ]},
    R489: { title: 'TEST DE POSITIONNEMENT - CACES R489', code: DOC_CODES.positionnementR489, questions: [
      { q: 'CACES signifie :', opts: ['Certificat d\'Aptitude à la Conduite En Sécurité', 'Contrôle Annuel des Chariots', 'Certification Automobile'] },
      { q: 'Les fourches doivent être :', opts: ['Au ras du sol', 'À hauteur d\'homme', 'Le plus haut possible'] },
    ]},
  }
  
  const cfg = configs[type] || configs.SST
  let y = addHeaderWithTitle(doc, cfg.title, isBlank ? '' : session?.reference)
  
  doc.setFontSize(9)
  doc.text(`Nom : ${isBlank ? '________________________' : ''}`, 20, y)
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(new Date())}`, 130, y); y += 10
  
  cfg.questions.forEach((q, i) => {
    doc.setFont('helvetica', 'bold')
    doc.text(`${i + 1}. ${q.q}`, 20, y); y += 6
    doc.setFont('helvetica', 'normal')
    q.opts.forEach(o => { doc.text(`☐  ${o}`, 30, y); y += 5 }); y += 5
  })
  
  addFooter(doc, cfg.code)
  return doc
}

function generateEvaluationFormateur(session = null, isBlank = false) {
  const doc = new jsPDF()
  let y = addHeaderWithTitle(doc, 'ÉVALUATION DE LA SESSION PAR LE FORMATEUR', isBlank ? '' : session?.reference)
  
  doc.setFontSize(9)
  doc.text(`Formation : ${isBlank ? '________________________' : (session?.courses?.title || '')}`, 20, y)
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(session?.start_date)}`, 130, y); y += 6
  doc.text(`Client : ${isBlank ? '________________________' : (session?.clients?.name || '')}`, 20, y); y += 6
  doc.text(`Formateur : ${isBlank ? '________________________' : ''}`, 20, y); y += 12
  
  doc.setFont('helvetica', 'bold')
  doc.text('Évaluez chaque critère de 1 à 5 :', 20, y); y += 8
  
  const criteres = ['Motivation du groupe', 'Niveau des stagiaires', 'Conditions matérielles', 'Organisation', 'Documentation fournie', 'Appréciation globale']
  doc.setFont('helvetica', 'normal')
  criteres.forEach(c => {
    doc.text(c, 25, y)
    for (let i = 1; i <= 5; i++) doc.text(`☐ ${i}`, 140 + (i - 1) * 10, y)
    y += 7
  })
  
  y += 5
  doc.setFont('helvetica', 'bold'); doc.text('Commentaires :', 20, y); y += 5
  doc.rect(20, y, 170, 40); y += 50
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(new Date())}`, 20, y)
  doc.text('Signature :', 130, y)
  
  addFooter(doc, DOC_CODES.evaluationFormateur)
  return doc
}

// ============================================================
// EXPORT
// ============================================================
export function downloadDocument(docType, session, options = {}) {
  const { trainees = [], trainee = null, trainer = null, isBlank = false } = options
  const ref = session?.reference || 'VIERGE'
  let doc, filename
  
  switch (docType) {
    case 'convention': doc = generateConvention(session, trainees, trainer); filename = `Convention_${ref}.pdf`; break
    case 'certificat': doc = generateCertificat(session, trainee, trainer); filename = `Certificat_${ref}_${trainee?.last_name || ''}.pdf`; break
    case 'emargement': doc = generateEmargement(session, trainees, trainer); filename = `Emargement_${ref}.pdf`; break
    case 'convocation': doc = generateConvocation(session, trainee, trainer); filename = `Convocation_${ref}_${trainee?.last_name || ''}.pdf`; break
    case 'attestation': doc = generateAttestation(session, trainee, trainer); filename = `Attestation_${ref}_${trainee?.last_name || ''}.pdf`; break
    case 'programme': doc = generateProgramme(session, trainer); filename = `Programme_${ref}.pdf`; break
    case 'evaluation': doc = generateEvaluation(session, trainee, isBlank); filename = isBlank ? 'Evaluation_Vierge.pdf' : `Evaluation_${ref}.pdf`; break
    case 'evaluationFroid': doc = generateEvaluationFroid(session, trainee, isBlank); filename = isBlank ? 'EvaluationFroid_Vierge.pdf' : `EvaluationFroid_${ref}.pdf`; break
    case 'reglement': doc = generateReglement(); filename = 'Reglement_Interieur.pdf'; break
    case 'livret': doc = generateLivret(session); filename = `Livret_Accueil_${ref}.pdf`; break
    case 'analyseBesoin': doc = generateAnalyseBesoin(session, isBlank); filename = isBlank ? 'Analyse_Besoin_Vierge.pdf' : `Analyse_Besoin_${ref}.pdf`; break
    case 'positionnementSST': doc = generatePositionnement('SST', session, isBlank); filename = isBlank ? 'Positionnement_SST_Vierge.pdf' : `Positionnement_SST_${ref}.pdf`; break
    case 'positionnementIncendie': doc = generatePositionnement('Incendie', session, isBlank); filename = isBlank ? 'Positionnement_Incendie_Vierge.pdf' : `Positionnement_Incendie_${ref}.pdf`; break
    case 'positionnementGP': doc = generatePositionnement('GP', session, isBlank); filename = isBlank ? 'Positionnement_GP_Vierge.pdf' : `Positionnement_GP_${ref}.pdf`; break
    case 'positionnementElec': doc = generatePositionnement('Elec', session, isBlank); filename = isBlank ? 'Positionnement_Elec_Vierge.pdf' : `Positionnement_Elec_${ref}.pdf`; break
    case 'positionnementR485': doc = generatePositionnement('R485', session, isBlank); filename = isBlank ? 'Positionnement_R485_Vierge.pdf' : `Positionnement_R485_${ref}.pdf`; break
    case 'positionnementR489': doc = generatePositionnement('R489', session, isBlank); filename = isBlank ? 'Positionnement_R489_Vierge.pdf' : `Positionnement_R489_${ref}.pdf`; break
    case 'evaluationFormateur': doc = generateEvaluationFormateur(session, isBlank); filename = isBlank ? 'Evaluation_Formateur_Vierge.pdf' : `Evaluation_Formateur_${ref}.pdf`; break
    default: console.error('Type inconnu:', docType); return
  }
  if (doc) doc.save(filename)
}

export function downloadAllDocuments(docType, session, trainees, options = {}) {
  trainees.forEach(trainee => downloadDocument(docType, session, { ...options, trainee }))
}
