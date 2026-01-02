import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const APP_VERSION = 'V2.5.5'
const DOC_CODES = {
  convention: 'AF-CONV', convocation: 'AF-CONVOC', attestation: 'AF-ATTP',
  certificat: 'AF-CERT', emargement: 'AF-EMARG', programme: 'AF-PROG',
  evaluation: 'AF-EVAL', evaluationFroid: 'AF-EVALF', reglement: 'AF-RI',
  livret: 'AF-LIVRET', analyseBesoin: 'AF-BESOIN', evaluationFormateur: 'AF-EVFORM',
  positionnement: 'AF-POS',
}

// Organisation par défaut (peut être surchargée par setOrganization)
let ORG = {
  name: 'Access Formation', nameFull: 'SARL Access Formation',
  address: '24 rue Kerbleiz, 29900 Concarneau',
  addressFull: '24 Rue Kerbleiz - 29900 Concarneau - France',
  city: 'Concarneau',
  phone: '02 46 56 57 54', email: 'contact@accessformation.pro',
  siret: '943 563 866 00012', naf: '8559A', tva: 'FR71943563866',
  nda: '53 29 10261 29', ndaFull: '53291026129 auprès du préfet de la région Bretagne',
  iban: 'FR76 1558 9297 0600 0890 6894 048', bic: 'CMBRFR2BXXXX',
  dirigeant: 'Hicham SAIDI',
  logo_base64: null,
  stamp_base64: null,
}

// Fonction pour mettre à jour les infos organisation depuis les paramètres
export function setOrganization(orgSettings) {
  if (orgSettings) {
    ORG = {
      ...ORG,
      name: orgSettings.name || ORG.name,
      nameFull: orgSettings.name ? `SARL ${orgSettings.name}` : ORG.nameFull,
      address: orgSettings.address ? `${orgSettings.address}, ${orgSettings.postal_code} ${orgSettings.city}` : ORG.address,
      addressFull: orgSettings.address ? `${orgSettings.address} - ${orgSettings.postal_code} ${orgSettings.city} - France` : ORG.addressFull,
      city: orgSettings.city || ORG.city,
      phone: orgSettings.phone || ORG.phone,
      email: orgSettings.email || ORG.email,
      siret: orgSettings.siret || ORG.siret,
      nda: orgSettings.nda || ORG.nda,
      ndaFull: orgSettings.nda ? `${orgSettings.nda} auprès du préfet de la région Bretagne` : ORG.ndaFull,
      logo_base64: orgSettings.logo_base64 || null,
      stamp_base64: orgSettings.stamp_base64 || null,
    }
  }
}

const STAMP_BASE64 = 'data:image/jpeg;base64,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'

const formatDate = (d) => d ? format(new Date(d), 'dd/MM/yyyy') : ''
const formatDateLong = (d) => d ? format(new Date(d), 'd MMMM yyyy', { locale: fr }) : ''

// ============================================================
// HELPERS - DESSINER DES FORMES (PAS DE CARACTÈRES UNICODE)
// ============================================================

// Dessine une case à cocher vide (carré)
function drawCheckbox(doc, x, y, size = 3, checked = false) {
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.rect(x, y - size + 0.5, size, size)
  if (checked) {
    // Dessiner un X ou checkmark
    doc.setLineWidth(0.5)
    doc.line(x + 0.5, y - size + 1, x + size - 0.5, y - 0.5)
    doc.line(x + 0.5, y - 0.5, x + size - 0.5, y - size + 1)
  }
}

// Dessine un carré vide (pour les choix multiples)
function drawSquare(doc, x, y, size = 3, filled = false) {
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  if (filled) {
    doc.setFillColor(0)
    doc.rect(x, y - size, size, size, 'FD')
  } else {
    doc.rect(x, y - size, size, size, 'S')
  }
}

// Alias pour compatibilité
function drawCircle(doc, x, y, radius = 1.5, filled = false) {
  drawSquare(doc, x, y, radius * 2, filled)
}

// ============================================================
// HEADER AVEC LOGO
// ============================================================
function addHeader(doc, sessionRef = null, options = {}) {
  const pw = doc.internal.pageSize.getWidth()
  // Utilise le logo de ORG si disponible
  const logoBase64 = options.logoBase64 || ORG.logo_base64
  const org = options.orgInfo || ORG
  
  // Logo: soit image paramétrable, soit rectangle bleu par défaut
  if (logoBase64) {
    try {
      // Détecter le format (PNG ou JPEG)
      const format = logoBase64.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(logoBase64, format, 15, 8, 40, 20)
    } catch (e) {
      console.warn('Erreur chargement logo:', e)
      // Fallback: rectangle bleu + texte
      doc.setFillColor(0, 102, 204)
      doc.rect(15, 10, 40, 15, 'F')
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('ACCESS', 17, 18)
      doc.text('FORMATION', 17, 23)
      doc.setTextColor(0, 0, 0)
    }
  } else {
    // Rectangle bleu + texte par défaut
    doc.setFillColor(0, 102, 204)
    doc.rect(15, 10, 40, 15, 'F')
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('ACCESS', 17, 18)
    doc.text('FORMATION', 17, 23)
    doc.setTextColor(0, 0, 0)
  }
  
  // Infos société (depuis ORG global)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.text((org.nameFull || org.name).toUpperCase(), 60, 14)
  doc.text(org.address, 60, 19)
  doc.text(`Tél : ${org.phone} - Email : ${org.email}`, 60, 24)
  doc.text(`SIRET : ${org.siret} - NDA : ${org.nda}`, 60, 29)
  
  // Référence session en haut à droite
  if (sessionRef) {
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(sessionRef, pw - 15, 12, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }
  
  return 40
}

function addTitle(doc, title, y) {
  const pw = doc.internal.pageSize.getWidth()
  doc.setFillColor(0, 102, 204)
  doc.rect(15, y, pw - 30, 10, 'F')
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(title, pw / 2, y + 7, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  return y + 18
}

function addFooter(doc, docCode, pageNum = null) {
  const ph = doc.internal.pageSize.getHeight()
  const pw = doc.internal.pageSize.getWidth()
  doc.setDrawColor(200)
  doc.setLineWidth(0.3)
  doc.line(15, ph - 22, pw - 15, ph - 22)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`${ORG.name} - ${ORG.addressFull}`, pw / 2, ph - 17, { align: 'center' })
  doc.text(`NDA : ${ORG.ndaFull}`, pw / 2, ph - 13, { align: 'center' })
  doc.text(`SIRET: ${ORG.siret} - NAF: ${ORG.naf} - TVA: ${ORG.tva}`, pw / 2, ph - 9, { align: 'center' })
  doc.setFontSize(6)
  doc.setTextColor(180)
  doc.text(`${docCode}-${APP_VERSION}`, pw - 15, ph - 5, { align: 'right' })
  if (pageNum) doc.text(`Page ${pageNum}`, 15, ph - 5)
  doc.setTextColor(0)
}

// ============================================================
// HELPER - Obtenir le lieu (Intra = adresse client)
// ============================================================
function getLocation(session) {
  if (session?.is_intra && session?.clients?.address) {
    return session.clients.address
  }
  return session?.location || ''
}

// ============================================================
// CONVENTION DE FORMATION
// ============================================================
function generateConvention(session, trainees = [], trainer = null) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const client = session?.clients || {}
  const course = session?.courses || {}
  const ref = session?.reference || ''
  const lieu = getLocation(session)
  
  let y = addHeader(doc, ref)
  y = addTitle(doc, 'CONVENTION DE FORMATION PROFESSIONNELLE', y)
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text('Conformément aux articles L6353-1 à L6353-9 et D6313-3-1 du Code du travail', pw / 2, y, { align: 'center' })
  y += 8
  
  // ENTRE LES SOUSSIGNÉS
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('ENTRE LES SOUSSIGNÉS', pw / 2, y, { align: 'center' })
  y += 8
  
  // Organisme
  doc.setFont('helvetica', 'bold')
  doc.text("L'Organisme de formation :", 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(ORG.nameFull, 20, y); y += 4
  doc.text(`SIRET : ${ORG.siret}`, 20, y); y += 4
  doc.text(`Déclaration d'activité (NDA) : ${ORG.nda} -- DREETS Bretagne`, 20, y); y += 4
  doc.text(`Siège social : ${ORG.address}`, 20, y); y += 4
  doc.text(`Représenté par : ${ORG.dirigeant}, Dirigeant`, 20, y); y += 4
  doc.text(`Tél. : ${ORG.phone} -- Courriel : ${ORG.email}`, 20, y); y += 5
  doc.text('Ci-après dénommé « l\'Organisme de Formation »', 20, y); y += 8
  
  // ET
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('ET', pw / 2, y, { align: 'center' })
  y += 6
  doc.text("L'entreprise bénéficiaire :", 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Raison sociale : ${client.name || ''}`, 20, y); y += 4
  doc.text(`Adresse : ${client.address || ''}`, 20, y); y += 4
  doc.text(`Représentée par : ${client.contact_name || ''}`, 20, y); y += 4
  if (client.contact_function) { doc.text(`Fonction : ${client.contact_function}`, 20, y); y += 4 }
  doc.text(`N° SIRET : ${client.siret || ''}`, 20, y); y += 5
  doc.text('Ci-après dénommée « le Bénéficiaire »', 20, y); y += 10
  
  // Article 1
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Article 1 – Objet, durée et effectif de la formation', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Le Bénéficiaire souhaite faire participer une partie de son personnel à la formation suivante :', 20, y)
  y += 6
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Intitulé : ${course.title || ''}`, 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  doc.text("Type d'action : Action de formation", 20, y); y += 5
  
  const objLines = doc.splitTextToSize(`Objectif(s) professionnel(s) : ${course.objectives || ''}`, 170)
  objLines.forEach(l => { doc.text(l, 20, y); y += 4 })
  y += 3
  
  if (trainees.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('Liste des apprenants désignés par le Bénéficiaire :', 20, y); y += 5
    doc.setFont('helvetica', 'normal')
    trainees.forEach(t => { 
      doc.text(`${t.last_name?.toUpperCase() || ''} ${t.first_name || ''}`, 25, y); y += 4 
    })
    y += 2
  }
  
  doc.text(`Durée (heures) : ${course.duration_hours || course.duration || '7'}`, 20, y); y += 5
  doc.text(`Dates du : ${formatDate(session?.start_date)} au : ${formatDate(session?.end_date)}   Horaires : ${session?.start_time || ''} - ${session?.end_time || ''}`, 20, y); y += 5
  doc.text(`Effectif (participants) : ${trainees.length}`, 20, y); y += 5
  doc.text(`Lieu : ${lieu}`, 20, y); y += 5
  doc.text(`Public concerné : ${course.target_audience || 'Tout public'}`, 20, y); y += 5
  doc.text(`Prérequis : ${course.prerequisites || 'Aucun'}`, 20, y); y += 5
  doc.text(`Formateur référent : ${trainer ? `${trainer.first_name} ${trainer.last_name}` : ORG.dirigeant}`, 20, y); y += 8
  
  // Calculer le coût HT
  const coutHT = session?.total_price || course.price_ht || course.price_per_day || ''
  
  // Articles 2-10
  const articles = [
    { title: 'Article 2 – Engagements des parties', text: "Le Bénéficiaire s'engage à assurer la présence des stagiaires inscrits et à fournir les moyens nécessaires à la réalisation de la formation (salle, matériel, conditions d'accueil). L'Organisme de Formation s'engage à mettre en œuvre les moyens pédagogiques, techniques et d'encadrement nécessaires pour atteindre les objectifs visés." },
    { title: 'Article 3 – Dispositions financières', text: `Coût total de la formation (en € HT) : ${coutHT} € HT\n\nModalités de paiement : conformément au devis validé par virement bancaire\n\nIBAN : ${ORG.iban} -- BIC : ${ORG.bic}\n\nAucun acompte ne sera demandé avant la formation.` },
    { title: 'Article 4 – Moyens et modalités pédagogiques', text: "La formation est dispensée selon une pédagogie active et participative : alternance d'apports théoriques, démonstrations pratiques et mises en situation ; utilisation de supports visuels et matériels spécifiques (mannequins, extincteurs, matériel électrique selon le thème).\n\nUne feuille d'émargement par demi-journée est signée par chaque stagiaire et le formateur." },
    { title: "Article 5 – Modalités de suivi et d'évaluation", text: "Évaluation formative pendant la formation (mises en situation, QCM, exercices pratiques). Validation des acquis selon les critères du référentiel concerné (INRS, prévention incendie, etc.). Délivrance d'un certificat de réalisation indiquant le niveau d'atteinte des objectifs : Acquis / Non acquis." },
    { title: 'Article 6 – Sanction et documents délivrés', text: "À l'issue de la formation, l'Organisme de Formation délivrera : une attestation de présence, un certificat de réalisation (Acquis / Non acquis) et, le cas échéant, une attestation officielle selon le module suivi." },
    { title: 'Article 7 – Annulation, dédommagement, force majeure', text: "En cas de désistement du Bénéficiaire moins de 14 jours avant le début de la formation, une indemnité forfaitaire de 50 % du coût total sera facturée. En cas de désistement du Bénéficiaire moins de 7 jours avant le début de la formation, une indemnité forfaitaire de 75 % du coût total sera facturée. En cas d'annulation par Access Formation moins de 7 jours avant le démarrage, une nouvelle date sera proposée sans frais." },
    { title: 'Article 8 – Accessibilité et personnes en situation de handicap', text: `Access Formation s'engage à favoriser l'accès à ses formations pour toute personne en situation de handicap. Toute demande d'adaptation doit être signalée en amont à ${ORG.email} afin de mettre en place les mesures nécessaires.` },
    { title: 'Article 9 – Protection des données (RGPD)', text: "Les données personnelles collectées sont utilisées exclusivement dans le cadre de la gestion administrative et pédagogique des formations. Elles sont conservées 5 ans et accessibles sur demande conformément au RGPD." },
    { title: 'Article 10 – Litiges', text: "En cas de différend, les parties s'efforceront de trouver une solution amiable. À défaut, le litige sera porté devant le tribunal de commerce de Quimper." },
  ]
  
  articles.forEach(art => {
    if (y > 250) { addFooter(doc, DOC_CODES.convention); doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(art.title, 20, y); y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(art.text, 170)
    lines.forEach(l => { doc.text(l, 20, y); y += 4 })
    y += 4
  })
  
  // Signatures
  if (y > 230) { addFooter(doc, DOC_CODES.convention); doc.addPage(); y = 20 }
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`Fait à Concarneau, le ${formatDate(new Date())}`, 20, y)
  y += 10
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text("Pour l'Organisme de Formation", 25, y)
  doc.text('Pour le Bénéficiaire', pw / 2 + 15, y); y += 4
  doc.text(ORG.name, 25, y)
  doc.text('(Cachet et signature)', pw / 2 + 15, y); y += 4
  doc.text('(Cachet et signature)', 25, y); y += 5
  try { doc.addImage(STAMP_BASE64, 'JPEG', 25, y, 50, 18) } catch {}
  
  addFooter(doc, DOC_CODES.convention)
  return doc
}

// ============================================================
// CONVOCATION
// ============================================================
function generateConvocation(session, trainee, trainer = null) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const course = session?.courses || {}
  const client = session?.clients || {}
  const ref = session?.reference || ''
  const lieu = getLocation(session)
  
  let y = addHeader(doc, ref)
  y = addTitle(doc, 'CONVOCATION À LA FORMATION', y)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`${trainee?.first_name || ''} ${trainee?.last_name?.toUpperCase() || ''}`, pw / 2, y, { align: 'center' })
  y += 10
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Merci de vous présenter à la session de formation selon les informations suivantes :', 20, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Intitulé de la formation : ${course.title || ''}`, 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  if (course.objectives) {
    const objLines = doc.splitTextToSize(`Objectif(s) : ${course.objectives}`, 170)
    objLines.forEach(l => { doc.text(l, 20, y); y += 5 })
  }
  y += 3
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Date(s) de formation : ${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`, 20, y); y += 6
  doc.text(`Horaires : ${session?.start_time || ''} - ${session?.end_time || ''}`, 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Durée totale : ${course.duration_hours || course.duration || '7'} heures`, 20, y); y += 8
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Lieu de formation : ${lieu}`, 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Formateur : ${trainer ? `${trainer.first_name} ${trainer.last_name}` : ORG.dirigeant}`, 20, y); y += 10
  
  // Documents requis
  doc.setFont('helvetica', 'bold')
  doc.text('Nous vous demandons de venir avec :', 20, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('• Votre pièce d\'identité', 25, y); y += 5
  doc.text('• Votre numéro de sécurité sociale', 25, y); y += 8
  
  if (course.material) {
    doc.text(`Merci de vous munir d'une tenue adaptée et du matériel indiqué par le formateur, le cas échéant : ${course.material}`, 20, y, { maxWidth: 170 }); y += 10
  } else {
    doc.text("Merci de vous munir d'une tenue adaptée et du matériel indiqué par le formateur, le cas échéant.", 20, y, { maxWidth: 170 }); y += 8
  }
  
  doc.text(`Accessibilité : en cas de besoins spécifiques (mobilité, auditif, visuel...), merci de nous en informer à ${ORG.email} au moins 72 heures avant la formation.`, 20, y, { maxWidth: 170 }); y += 12
  
  doc.text(`Contact Access Formation : Pour toute question, contactez-nous au ${ORG.phone} ou par mail à ${ORG.email}`, 20, y, { maxWidth: 170 }); y += 8
  
  if (client.contact_name) {
    doc.text(`Contact de votre entreprise : ${client.contact_name}${client.contact_function ? ' - ' + client.contact_function : ''}`, 20, y, { maxWidth: 170 }); y += 10
  }
  
  doc.text('Nous vous remercions pour votre ponctualité et votre participation active.', 20, y); y += 15
  
  // Signature et tampon
  doc.setFont('helvetica', 'normal')
  doc.text(`Fait à ${ORG.city}, le ${new Date().toLocaleDateString('fr-FR')}`, 20, y); y += 10
  
  try { doc.addImage(LOGO_BASE64, 'PNG', 140, y - 5, 25, 25) } catch {}
  try { doc.addImage(STAMP_BASE64, 'PNG', 165, y - 5, 30, 30) } catch {}
  
  doc.text(`${ORG.dirigeant}`, 20, y + 5)
  doc.text(`Dirigeant ${ORG.name}`, 20, y + 10)
  
  addFooter(doc, DOC_CODES.convocation)
  return doc
}

// ============================================================
// ÉMARGEMENT - AVEC N° SÉCU, SANS SIGNATURE FORMATEUR
// ============================================================
function generateEmargement(session, trainees = [], trainer = null, isBlank = false) {
  const doc = new jsPDF('landscape')
  const pw = doc.internal.pageSize.getWidth()
  const course = session?.courses || {}
  const ref = session?.reference || ''
  const lieu = isBlank ? '________________________________' : getLocation(session)
  
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(isBlank ? '' : ref, pw - 15, 10, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  
  let y = 15
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text("FEUILLE D'ÉMARGEMENT", pw / 2, y, { align: 'center' })
  y += 10
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Formation : ${isBlank ? '________________________________________' : (course.title || '')}`, 15, y)
  doc.text(`Client : ${isBlank ? '________________________' : (session?.clients?.name || '')}`, pw / 2, y); y += 5
  doc.text(`Dates : ${isBlank ? '___/___/______ au ___/___/______' : `${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`}`, 15, y)
  doc.text(`Lieu : ${lieu}`, pw / 2, y); y += 5
  doc.text(`Formateur : ${isBlank ? '________________________________' : (trainer ? `${trainer.first_name} ${trainer.last_name}` : ORG.dirigeant)}`, 15, y); y += 8
  
  let days = []
  if (session?.start_date && session?.end_date) {
    try { days = eachDayOfInterval({ start: parseISO(session.start_date), end: parseISO(session.end_date) }) } catch {}
  }
  if (days.length === 0) days = [new Date()]
  
  const nameColW = 45
  const secuColW = 40
  const emailColW = 35
  const remainingW = pw - 30 - nameColW - secuColW - emailColW
  const dayColW = Math.min(25, remainingW / (days.length * 2))
  const startX = 15
  
  doc.setFillColor(240, 240, 240)
  doc.rect(startX, y, nameColW + secuColW + emailColW + days.length * dayColW * 2, 14, 'F')
  
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('Nom Prénom', startX + 2, y + 10)
  doc.text('N° Sécurité Sociale', startX + nameColW + 2, y + 10)
  doc.text('Email', startX + nameColW + secuColW + 2, y + 10)
  
  let x = startX + nameColW + secuColW + emailColW
  days.forEach(day => {
    const dateStr = format(day, 'dd/MM', { locale: fr })
    const centerX = x + dayColW
    doc.text(dateStr, centerX, y + 4, { align: 'center' })
    doc.text('Matin', x + dayColW / 2, y + 10, { align: 'center' })
    doc.text('A-midi', x + dayColW + dayColW / 2, y + 10, { align: 'center' })
    x += dayColW * 2
  })
  y += 14
  
  const rows = trainees.length > 0 ? trainees : Array(10).fill({})
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  rows.forEach(t => {
    doc.rect(startX, y, nameColW, 10)
    doc.rect(startX + nameColW, y, secuColW, 10)
    doc.rect(startX + nameColW + secuColW, y, emailColW, 10)
    
    if (t.first_name) doc.text(`${t.last_name?.toUpperCase() || ''} ${t.first_name || ''}`, startX + 1, y + 7)
    if (t.social_security_number) doc.text(t.social_security_number, startX + nameColW + 1, y + 7)
    if (t.email) doc.text(t.email.substring(0, 22), startX + nameColW + secuColW + 1, y + 7)
    
    let xx = startX + nameColW + secuColW + emailColW
    days.forEach(() => {
      doc.rect(xx, y, dayColW, 10)
      doc.rect(xx + dayColW, y, dayColW, 10)
      xx += dayColW * 2
    })
    y += 10
  })
  
  y += 8
  doc.setFontSize(9)
  doc.text('Signature du formateur :', 15, y)
  doc.rect(15, y + 2, 60, 18)
  
  addFooter(doc, DOC_CODES.emargement)
  return doc
}

// ============================================================
// ATTESTATION DE PRÉSENCE
// ============================================================
function generateAttestation(session, trainee, trainer = null) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const course = session?.courses || {}
  const client = session?.clients || {}
  const ref = session?.reference || ''
  const lieu = getLocation(session)
  
  let y = addHeader(doc, ref)
  y = addTitle(doc, 'ATTESTATION DE PRÉSENCE', y)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Je soussigné, ${ORG.dirigeant}, représentant l'organisme de formation ${ORG.name}, atteste que :`, 20, y, { maxWidth: 170 })
  y += 12
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`${trainee?.first_name || ''} ${trainee?.last_name?.toUpperCase() || ''}`, pw / 2, y, { align: 'center' })
  y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Entreprise : ${client.name || ''}`, 20, y); y += 8
  doc.text(`A participé à la formation intitulée : ${course.title || ''}`, 20, y); y += 8
  doc.text(`Dates : du ${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`, 20, y); y += 8
  doc.text(`Durée totale : ${course.duration_hours || course.duration || '7'} heures`, 20, y); y += 8
  doc.text(`Lieu : ${lieu}`, 20, y); y += 8
  doc.text(`Cette formation a été animée par : ${trainer ? `${trainer.first_name} ${trainer.last_name}` : ORG.dirigeant}`, 20, y); y += 8
  doc.text(`Horaires suivis : ${session?.start_time || ''} - ${session?.end_time || ''}`, 20, y); y += 8
  doc.text(`Nombre total d'heures de présence : ${course.duration_hours || course.duration || '7'}`, 20, y); y += 12
  
  doc.text('Fait pour servir et valoir ce que de droit.', 20, y); y += 10
  doc.text(`Fait à ${ORG.city}, le ${formatDate(new Date())}`, 20, y); y += 10
  
  doc.text(`Pour ${ORG.name}`, 20, y); y += 5
  try { doc.addImage(LOGO_BASE64, 'PNG', 130, y - 5, 25, 25) } catch {}
  try { doc.addImage(STAMP_BASE64, 'PNG', 155, y - 5, 30, 30) } catch {}
  doc.text(ORG.dirigeant, 20, y + 10)
  
  addFooter(doc, DOC_CODES.attestation)
  return doc
}

// ============================================================
// CERTIFICAT DE RÉALISATION - AVEC CASES GRAPHIQUES
// ============================================================
function generateCertificat(session, trainee, trainer = null) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const course = session?.courses || {}
  const client = session?.clients || {}
  const ref = session?.reference || ''
  
  let y = addHeader(doc, ref)
  y = addTitle(doc, 'CERTIFICAT DE RÉALISATION', y)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Je soussigné, ${ORG.dirigeant}, représentant légal du dispensateur de l'action concourant au développement des compétences ${ORG.name}, ${ORG.address}`, 20, y, { maxWidth: 170 })
  y += 14
  
  doc.setFont('helvetica', 'bold')
  doc.text('Atteste que :', 20, y)
  y += 8
  
  doc.setFontSize(12)
  doc.text(`${trainee?.first_name || ''} ${trainee?.last_name?.toUpperCase() || ''}`, pw / 2, y, { align: 'center' })
  y += 8
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Salarié(e) de l'entreprise : ${client.name || ''}`, 20, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text("A suivi l'action :", 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`${course.title || ''}`, pw / 2, y, { align: 'center' })
  y += 12
  
  doc.setFont('helvetica', 'bold')
  doc.text("Nature de l'action concourant au développement des compétences :", 20, y)
  y += 8
  
  // Cases à cocher graphiques
  doc.setFont('helvetica', 'normal')
  
  // Action de formation - cochée
  drawCheckbox(doc, 25, y, 3, true)
  doc.text('  Action de formation', 30, y)
  y += 6
  
  // Bilan de compétences - non cochée
  doc.setTextColor(150, 150, 150)
  drawCheckbox(doc, 25, y, 3, false)
  doc.text('  Bilan de compétences', 30, y)
  y += 6
  
  // Action de VAE - non cochée
  drawCheckbox(doc, 25, y, 3, false)
  doc.text('  Action de VAE', 30, y)
  y += 6
  
  // Formation par apprentissage - non cochée
  drawCheckbox(doc, 25, y, 3, false)
  doc.text('  Action de formation par apprentissage', 30, y)
  y += 10
  
  doc.setTextColor(0, 0, 0)
  
  doc.text(`Qui s'est déroulée du ${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`, 20, y)
  y += 6
  doc.text(`Pour une durée de ${course.duration_hours || course.duration || '7'} heures.`, 20, y)
  y += 12
  
  doc.setFontSize(8)
  doc.text("Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m'engage à conserver l'ensemble des pièces justificatives ayant permis d'établir le présent certificat pendant une durée de 3 ans à compter de la fin de l'année du dernier paiement. En cas de cofinancement des fonds européens, la durée de conservation est étendue conformément aux obligations conventionnelles spécifiques.", 20, y, { maxWidth: 170 })
  y += 18
  
  doc.setFontSize(10)
  doc.text(`Fait à : Concarneau`, 20, y); y += 6
  doc.text(`Le : ${formatDate(new Date())}`, 20, y); y += 10
  
  doc.text('Cachet et signature du responsable du dispensateur de formation :', 20, y); y += 5
  try { doc.addImage(STAMP_BASE64, 'JPEG', 20, y, 50, 18) } catch {}
  doc.text(`${ORG.dirigeant}, Dirigeant ${ORG.name}`, 75, y + 10)
  
  addFooter(doc, DOC_CODES.certificat)
  return doc
}

// ============================================================
// ÉVALUATION À CHAUD - AVEC CERCLES GRAPHIQUES (9 critères Qualiopi)
// ============================================================
function generateEvaluation(session, trainee = null, isBlank = false) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ref = session?.reference || ''
  const course = session?.courses || {}
  
  let y = addHeader(doc, isBlank ? '' : ref)
  y = addTitle(doc, 'ÉVALUATION À CHAUD', y)
  
  doc.setFontSize(9)
  doc.text(`Formation : ${isBlank ? '________________________' : (course?.title || '')}`, 20, y)
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(session?.start_date)}`, 130, y)
  y += 6
  doc.text(`Stagiaire : ${isBlank ? '________________________' : (trainee ? `${trainee.first_name} ${trainee.last_name}` : '')}`, 20, y)
  y += 8
  
  // Objectifs de la formation
  const objectives = (course?.objectives || '').split('\n').map(o => o.trim()).filter(o => o.length > 0)
  if (objectives.length > 0 && !isBlank) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Objectifs de la formation :', 20, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    objectives.forEach((obj, idx) => {
      doc.text(`• ${obj}`, 22, y)
      y += 4
    })
    y += 4
  }
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Merci de noter chaque critère :', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('1 = Insuffisant   2 = Passable   3 = Moyen   4 = Satisfaisant   5 = Très Satisfaisant', 20, y)
  y += 8
  
  // 9 critères Qualiopi
  const criteres = [
    'Clarté des objectifs de la formation',
    'Qualité de l\'accueil et de l\'organisation',
    'Pertinence du contenu par rapport à vos attentes',
    'Qualité des supports pédagogiques',
    'Disponibilité et pédagogie du formateur',
    'Rythme et durée de la formation',
    'Conditions matérielles',
    'Utilité de la formation pour votre activité professionnelle',
    'Satisfaction globale de la formation',
  ]
  
  const colW = 14
  const labelW = pw - 40 - colW * 5
  
  // En-tête tableau
  doc.setFillColor(240, 240, 240)
  doc.rect(20, y, labelW, 7, 'F')
  for (let i = 1; i <= 5; i++) {
    doc.rect(20 + labelW + (i - 1) * colW, y, colW, 7, 'F')
  }
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Critère', 22, y + 5)
  for (let i = 1; i <= 5; i++) {
    doc.text(String(i), 20 + labelW + (i - 1) * colW + colW / 2, y + 5, { align: 'center' })
  }
  y += 7
  
  // Lignes avec cercles graphiques
  doc.setFont('helvetica', 'normal')
  criteres.forEach(c => {
    doc.rect(20, y, labelW, 7)
    for (let i = 1; i <= 5; i++) {
      doc.rect(20 + labelW + (i - 1) * colW, y, colW, 7)
      drawCircle(doc, 20 + labelW + (i - 1) * colW + colW / 2 - 1.5, y + 5, 1.5, false)
    }
    doc.text(c, 22, y + 5)
    y += 7
  })
  
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Recommanderiez-vous cette formation ?', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  
  // Cercles pour Oui/Non
  drawCircle(doc, 30, y, 1.5, false)
  doc.text('  Oui', 34, y)
  drawCircle(doc, 60, y, 1.5, false)
  doc.text('  Non', 64, y)
  y += 8
  
  doc.setFont('helvetica', 'bold')
  doc.text('Commentaires et suggestions :', 20, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.rect(20, y, 170, 30)
  y += 35
  
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(new Date())}`, 20, y)
  doc.text('Signature :', 120, y)
  
  addFooter(doc, DOC_CODES.evaluation)
  return doc
}

// ============================================================
// ÉVALUATION À FROID - AVEC CERCLES GRAPHIQUES
// ============================================================
function generateEvaluationFroid(session, trainee = null, isBlank = false) {
  const doc = new jsPDF()
  const ref = session?.reference || ''
  const course = session?.courses || {}
  
  let y = addHeader(doc, isBlank ? '' : ref)
  y = addTitle(doc, 'ÉVALUATION À FROID', y)
  
  doc.setFontSize(9)
  doc.text(`Formation : ${isBlank ? '________________________' : (course?.title || '')}`, 20, y)
  y += 6
  doc.text(`Date de formation : ${isBlank ? '___/___/______' : formatDate(session?.start_date)}`, 20, y)
  y += 6
  doc.text(`Stagiaire : ${isBlank ? '________________________' : (trainee ? `${trainee.first_name} ${trainee.last_name}` : '')}`, 20, y)
  y += 8
  
  // Objectifs de la formation
  const objectives = (course?.objectives || '').split('\n').map(o => o.trim()).filter(o => o.length > 0)
  if (objectives.length > 0 && !isBlank) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Objectifs de la formation :', 20, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    objectives.forEach((obj, idx) => {
      doc.text(`• ${obj}`, 22, y)
      y += 4
    })
    y += 4
  }
  
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.text('Cette évaluation est à remplir 1 à 3 mois après la formation.', 20, y)
  y += 10
  
  const questions = [
    'Avez-vous pu mettre en pratique les compétences acquises ?',
    'Les objectifs de la formation ont-ils été atteints ?',
    'La formation a-t-elle répondu à vos besoins professionnels ?',
    'Avez-vous constaté une amélioration dans votre travail ?',
  ]
  
  doc.setFont('helvetica', 'normal')
  questions.forEach(q => {
    doc.setFont('helvetica', 'bold')
    doc.text(q, 20, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    
    // Cercles graphiques Oui/Non
    drawCircle(doc, 25, y, 1.5, false)
    doc.text(' Oui', 29, y)
    drawCircle(doc, 55, y, 1.5, false)
    doc.text(' Non', 59, y)
    y += 10
  })
  
  doc.setFont('helvetica', 'bold')
  doc.text('Commentaires :', 20, y)
  y += 5
  doc.rect(20, y, 170, 30)
  y += 38
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Date : ${isBlank ? '___/___/______' : ''}`, 20, y)
  doc.text('Signature :', 120, y)
  
  addFooter(doc, DOC_CODES.evaluationFroid)
  return doc
}

// ============================================================
// ÉVALUATION FORMATEUR - AVEC CERCLES GRAPHIQUES
// ============================================================
function generateEvaluationFormateur(session = null, isBlank = false) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ref = session?.reference || ''
  
  let y = addHeader(doc, isBlank ? '' : ref)
  y = addTitle(doc, 'ÉVALUATION DE LA SESSION PAR LE FORMATEUR', y)
  
  doc.setFontSize(9)
  doc.text(`Formation : ${isBlank ? '________________________' : (session?.courses?.title || '')}`, 20, y)
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(session?.start_date)}`, 130, y)
  y += 6
  doc.text(`Client : ${isBlank ? '________________________' : (session?.clients?.name || '')}`, 20, y)
  y += 6
  doc.text(`Formateur : ${isBlank ? '________________________' : ''}`, 20, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('Évaluez chaque critère :', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('1 = Insuffisant   2 = Passable   3 = Satisfaisant   4 = Bien   5 = Très Satisfaisant', 20, y)
  y += 10
  
  const criteres = ['Motivation du groupe', 'Niveau des stagiaires', 'Conditions matérielles', 'Organisation', 'Documentation fournie', 'Appréciation globale']
  
  const colW = 15
  const labelW = pw - 40 - colW * 5
  
  doc.setFillColor(240, 240, 240)
  doc.rect(20, y, labelW, 8, 'F')
  for (let i = 1; i <= 5; i++) doc.rect(20 + labelW + (i - 1) * colW, y, colW, 8, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Critère', 22, y + 5.5)
  for (let i = 1; i <= 5; i++) doc.text(String(i), 20 + labelW + (i - 1) * colW + colW / 2, y + 5.5, { align: 'center' })
  y += 8
  
  doc.setFont('helvetica', 'normal')
  criteres.forEach(c => {
    doc.rect(20, y, labelW, 8)
    for (let i = 1; i <= 5; i++) {
      doc.rect(20 + labelW + (i - 1) * colW, y, colW, 8)
      drawCircle(doc, 20 + labelW + (i - 1) * colW + colW / 2 - 1.5, y + 5.5, 1.5, false)
    }
    doc.text(c, 22, y + 5.5)
    y += 8
  })
  
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.text('Commentaires :', 20, y)
  y += 5
  doc.rect(20, y, 170, 40)
  y += 48
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(new Date())}`, 20, y)
  doc.text('Signature :', 130, y)
  
  addFooter(doc, DOC_CODES.evaluationFormateur)
  return doc
}

// ============================================================
// TEST DE POSITIONNEMENT - AVEC CERCLES GRAPHIQUES
// ============================================================
function generatePositionnement(session, questions = [], isBlank = false, trainee = null) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const course = session?.courses || {}
  const ref = session?.reference || ''
  
  let y = addHeader(doc, isBlank ? '' : ref)
  y = addTitle(doc, 'TEST DE POSITIONNEMENT', y)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(course.title || '', pw / 2, y, { align: 'center' })
  y += 10
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  if (trainee) {
    doc.text(`Nom : ${trainee.last_name?.toUpperCase() || ''}`, 20, y)
    doc.text(`Prénom : ${trainee.first_name || ''}`, 110, y)
  } else {
    doc.text(`Nom : ${isBlank ? '________________________________________' : ''}`, 20, y)
    doc.text(`Prénom : ${isBlank ? '________________________________' : ''}`, 110, y)
  }
  y += 7
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(new Date())}`, 20, y)
  doc.text(`Entreprise : ${isBlank ? '________________________________' : (session?.clients?.name || '')}`, 110, y)
  y += 12
  
  let pageNum = 1
  
  if (questions.length === 0) {
    doc.text('Aucune question configurée pour cette formation.', 20, y)
  } else {
    questions.sort((a, b) => (a.position || 0) - (b.position || 0))
    
    questions.forEach((q, idx) => {
      const neededHeight = q.question_type === 'qcm' ? 35 : 30
      if (y + neededHeight > ph - 30) {
        addFooter(doc, DOC_CODES.positionnement, pageNum)
        doc.addPage()
        pageNum++
        y = 20
      }
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      const qText = `${idx + 1}. ${q.question_text}`
      const qLines = doc.splitTextToSize(qText, 170)
      qLines.forEach(l => { doc.text(l, 20, y); y += 5 })
      y += 3
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      
      if (q.question_type === 'qcm') {
        // QCM avec cercles graphiques
        if (q.option_a) { 
          drawCircle(doc, 25, y, 1.5, false)
          doc.text(`  ${q.option_a}`, 30, y)
          y += 6 
        }
        if (q.option_b) { 
          drawCircle(doc, 25, y, 1.5, false)
          doc.text(`  ${q.option_b}`, 30, y)
          y += 6 
        }
        if (q.option_c) { 
          drawCircle(doc, 25, y, 1.5, false)
          doc.text(`  ${q.option_c}`, 30, y)
          y += 6 
        }
      } else {
        // Question ouverte - rectangle à remplir
        doc.rect(25, y, 165, 14)
        y += 18
      }
      
      y += 5
    })
  }
  
  addFooter(doc, DOC_CODES.positionnement, pageNum)
  return doc
}

// ============================================================
// AUTRES DOCUMENTS (inchangés mais avec lieu Intra)
// ============================================================
function generateProgramme(session, trainer = null) {
  const doc = new jsPDF()
  const course = session?.courses || {}
  const ref = session?.reference || ''
  let y = addHeader(doc, ref)
  y = addTitle(doc, 'PROGRAMME DE FORMATION', y)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(course.title || '', 20, y)
  y += 10
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Durée : ${course.duration_hours || course.duration || '7'} heures`, 20, y); y += 6
  doc.text(`Public : ${course.target_audience || 'Tout public'}`, 20, y); y += 6
  doc.text(`Prérequis : ${course.prerequisites || 'Aucun'}`, 20, y); y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('Objectifs :', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const objLines = doc.splitTextToSize(course.objectives || '', 170)
  objLines.forEach(l => { doc.text(l, 25, y); y += 5 })
  y += 5
  
  doc.setFont('helvetica', 'bold')
  doc.text('Contenu :', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  const contLines = doc.splitTextToSize(course.content || '', 170)
  contLines.forEach(l => { doc.text(l, 25, y); y += 5 })
  y += 5
  
  doc.setFont('helvetica', 'bold')
  doc.text('Méthodes pédagogiques :', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(course.methods || 'Apports théoriques, exercices pratiques, mises en situation.', 25, y, { maxWidth: 165 })
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('Évaluation :', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('Évaluation formative continue. QCM et/ou mise en situation pratique.', 25, y)
  
  addFooter(doc, DOC_CODES.programme)
  return doc
}

function generateReglement() {
  const doc = new jsPDF()
  let y = addHeader(doc)
  y = addTitle(doc, 'RÈGLEMENT INTÉRIEUR', y)
  doc.setFontSize(9)
  const sections = [
    { title: 'Article 1 - Objet et champ d\'application', text: 'Le présent règlement est établi conformément aux articles L.6352-3 et L.6352-4 du Code du travail. Il s\'applique à tous les stagiaires participant aux formations dispensées par Access Formation.' },
    { title: 'Article 2 - Discipline', text: 'Les stagiaires doivent respecter les horaires, les consignes de sécurité et les règles de fonctionnement de l\'établissement.' },
    { title: 'Article 3 - Sanctions', text: 'Tout manquement aux règles pourra faire l\'objet d\'une sanction pouvant aller jusqu\'à l\'exclusion.' },
    { title: 'Article 4 - Représentation des stagiaires', text: 'Pour les formations de plus de 500 heures, un délégué des stagiaires sera élu.' },
    { title: 'Article 5 - Hygiène et sécurité', text: 'Les stagiaires doivent respecter les consignes d\'hygiène et de sécurité, notamment l\'interdiction de fumer.' },
  ]
  sections.forEach(s => {
    doc.setFont('helvetica', 'bold')
    doc.text(s.title, 20, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(s.text, 170)
    lines.forEach(l => { doc.text(l, 20, y); y += 4 })
    y += 5
  })
  addFooter(doc, DOC_CODES.reglement)
  return doc
}

function generateLivret(session = null) {
  const doc = new jsPDF()
  let y = addHeader(doc, session?.reference)
  y = addTitle(doc, "LIVRET D'ACCUEIL DU STAGIAIRE", y)
  doc.setFontSize(10)
  doc.text('Bienvenue chez Access Formation !', 20, y)
  y += 10
  const sections = [
    { title: 'Qui sommes-nous ?', text: `${ORG.nameFull} est un organisme de formation spécialisé dans la sécurité au travail.` },
    { title: 'Vos interlocuteurs', text: `Responsable : ${ORG.dirigeant}\nContact : ${ORG.phone} - ${ORG.email}` },
    { title: 'Déroulement de la formation', text: 'Horaires habituels : 9h00-12h30 / 13h30-17h00\nPauses : 10h30 et 15h30' },
    { title: 'Règles de vie', text: '- Ponctualité\n- Téléphones en silencieux\n- Respect des autres participants' },
    { title: 'En cas de problème', text: `Contactez-nous : ${ORG.phone}` },
  ]
  sections.forEach(s => {
    doc.setFont('helvetica', 'bold')
    doc.text(s.title, 20, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(s.text, 170)
    lines.forEach(l => { doc.text(l, 25, y); y += 5 })
    y += 5
  })
  addFooter(doc, DOC_CODES.livret)
  return doc
}

function generateAnalyseBesoin(session = null, isBlank = false) {
  const doc = new jsPDF()
  let y = addHeader(doc, isBlank ? '' : session?.reference)
  y = addTitle(doc, 'ANALYSE DU BESOIN DE FORMATION', y)
  doc.setFontSize(9)
  doc.text(`Entreprise : ${isBlank ? '________________________' : (session?.clients?.name || '')}`, 20, y)
  doc.text(`Date : ${isBlank ? '___/___/______' : formatDate(new Date())}`, 130, y)
  y += 10
  const sections = ['1. CONTEXTE ET ENJEUX', '2. OBJECTIFS ATTENDUS', '3. PUBLIC CONCERNÉ', '4. CONTRAINTES ET MOYENS']
  sections.forEach(s => {
    doc.setFont('helvetica', 'bold')
    doc.text(s, 20, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.rect(20, y, 170, 22)
    y += 28
  })
  doc.text('Signature entreprise :', 20, y)
  doc.rect(20, y + 3, 60, 18)
  doc.text('Signature Access Formation :', 110, y)
  doc.rect(110, y + 3, 60, 18)
  addFooter(doc, DOC_CODES.analyseBesoin)
  return doc
}

// ============================================================
// EXPORT
// ============================================================
export function downloadDocument(docType, session, options = {}) {
  const { trainees = [], trainee = null, trainer = null, isBlank = false, questions = [] } = options
  const ref = session?.reference || 'VIERGE'
  let doc, filename
  
  switch (docType) {
    case 'convention': doc = generateConvention(session, trainees, trainer); filename = `Convention_${ref}.pdf`; break
    case 'certificat': doc = generateCertificat(session, trainee, trainer); filename = `Certificat_${ref}_${trainee?.last_name || ''}.pdf`; break
    case 'emargement': doc = generateEmargement(session, trainees, trainer, isBlank); filename = isBlank ? 'Emargement_Vierge.pdf' : `Emargement_${ref}.pdf`; break
    case 'convocation': doc = generateConvocation(session, trainee, trainer); filename = `Convocation_${ref}_${trainee?.last_name || ''}.pdf`; break
    case 'attestation': doc = generateAttestation(session, trainee, trainer); filename = `Attestation_${ref}_${trainee?.last_name || ''}.pdf`; break
    case 'programme': doc = generateProgramme(session, trainer); filename = `Programme_${ref}.pdf`; break
    case 'evaluation': doc = generateEvaluation(session, trainee, isBlank); filename = isBlank ? 'Evaluation_Vierge.pdf' : `Evaluation_${ref}.pdf`; break
    case 'evaluationFroid': doc = generateEvaluationFroid(session, trainee, isBlank); filename = isBlank ? 'EvaluationFroid_Vierge.pdf' : `EvaluationFroid_${ref}.pdf`; break
    case 'reglement': doc = generateReglement(); filename = 'Reglement_Interieur.pdf'; break
    case 'livret': doc = generateLivret(session); filename = `Livret_Accueil_${ref}.pdf`; break
    case 'analyseBesoin': doc = generateAnalyseBesoin(session, isBlank); filename = isBlank ? 'Analyse_Besoin_Vierge.pdf' : `Analyse_Besoin_${ref}.pdf`; break
    case 'evaluationFormateur': doc = generateEvaluationFormateur(session, isBlank); filename = isBlank ? 'Evaluation_Formateur_Vierge.pdf' : `Evaluation_Formateur_${ref}.pdf`; break
    case 'positionnement': doc = generatePositionnement(session, questions, isBlank, trainee); filename = isBlank ? 'Test_Positionnement_Vierge.pdf' : `Test_Positionnement_${ref}_${trainee?.last_name || ''}.pdf`; break
    default: console.error('Type inconnu:', docType); return
  }
  if (doc) doc.save(filename)
}

// Fonction pour générer un PDF multi-pages avec tous les stagiaires
export function downloadAllDocuments(docType, session, trainees, options = {}) {
  if (!trainees || trainees.length === 0) return
  
  const ref = session?.reference || 'VIERGE'
  const { trainer = null, questions = [] } = options
  
  // Créer un seul PDF pour tous les stagiaires
  const doc = new jsPDF('p', 'mm', 'a4')
  
  trainees.forEach((trainee, idx) => {
    // Ajouter une nouvelle page pour chaque stagiaire (sauf le premier)
    if (idx > 0) doc.addPage()
    
    // Générer le contenu selon le type de document
    switch (docType) {
      case 'certificat': generateCertificatContent(doc, session, trainee, trainer); break
      case 'convocation': generateConvocationContent(doc, session, trainee, trainer); break
      case 'attestation': generateAttestationContent(doc, session, trainee, trainer); break
      case 'evaluation': generateEvaluationContent(doc, session, trainee); break
      case 'evaluationFroid': generateEvaluationFroidContent(doc, session, trainee); break
      case 'positionnement': generatePositionnementContent(doc, session, questions, trainee); break
      default: return
    }
  })
  
  // Nom du fichier selon le type
  const docNames = {
    certificat: 'Certificats',
    convocation: 'Convocations', 
    attestation: 'Attestations',
    evaluation: 'Evaluations',
    evaluationFroid: 'Evaluations_Froid',
    positionnement: 'Tests_Positionnement'
  }
  
  doc.save(`${docNames[docType] || 'Documents'}_${ref}_Tous.pdf`)
}

// ============================================================
// CONTENT GENERATORS FOR MULTI-PAGE PDFs
// ============================================================

function generateCertificatContent(doc, session, trainee, trainer) {
  const course = session?.courses || {}
  const client = session?.clients || {}
  const pw = doc.internal.pageSize.getWidth()
  const ref = session?.reference || ''
  
  let y = addHeader(doc, ref)
  y = addTitle(doc, 'CERTIFICAT DE RÉALISATION', y)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Je soussigné, ${ORG.dirigeant}, représentant légal du dispensateur de l'action concourant au développement des compétences ${ORG.name}, ${ORG.address}`, 20, y, { maxWidth: 170 })
  y += 14
  
  doc.setFont('helvetica', 'bold')
  doc.text('Atteste que :', 20, y)
  y += 8
  
  doc.setFontSize(12)
  doc.text(`${trainee?.first_name || ''} ${trainee?.last_name?.toUpperCase() || ''}`, pw / 2, y, { align: 'center' })
  y += 8
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  if (client?.name) {
    doc.text(`Salarié(e) de l'entreprise : ${client.name}`, 20, y)
    y += 10
  }
  
  doc.setFont('helvetica', 'bold')
  doc.text("A suivi l'action :", 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`${course.title || ''}`, pw / 2, y, { align: 'center' })
  y += 12
  
  doc.setFont('helvetica', 'bold')
  doc.text("Nature de l'action concourant au développement des compétences :", 20, y)
  y += 8
  
  doc.setFont('helvetica', 'normal')
  drawCheckbox(doc, 25, y, 3, true)
  doc.text('  Action de formation', 30, y)
  y += 6
  doc.setTextColor(150, 150, 150)
  drawCheckbox(doc, 25, y, 3, false)
  doc.text('  Bilan de compétences', 30, y)
  y += 6
  drawCheckbox(doc, 25, y, 3, false)
  doc.text('  Action de VAE', 30, y)
  y += 6
  drawCheckbox(doc, 25, y, 3, false)
  doc.text('  Action de formation par apprentissage', 30, y)
  y += 10
  doc.setTextColor(0, 0, 0)
  
  doc.text(`Qui s'est déroulée du ${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`, 20, y)
  y += 6
  doc.text(`Pour une durée de ${course.duration_hours || course.duration || '7'} heures.`, 20, y)
  y += 12
  
  doc.setFontSize(8)
  doc.text("Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je m'engage à conserver l'ensemble des pièces justificatives pendant une durée de 3 ans à compter de la fin de l'année du dernier paiement.", 20, y, { maxWidth: 170 })
  y += 14
  
  // Résultat basé sur trainee.result si disponible
  const isAcquis = trainee?.result === 'acquired'
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Résultat obtenu :', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  drawCheckbox(doc, 25, y, 3, isAcquis)
  doc.text('  Acquis', 30, y)
  drawCheckbox(doc, 70, y, 3, !isAcquis && trainee?.result === 'not_acquired')
  doc.text('  Non acquis', 75, y)
  y += 12
  
  doc.text(`Fait à : Concarneau`, 20, y); y += 6
  doc.text(`Le : ${formatDate(new Date())}`, 20, y); y += 10
  
  doc.text('Cachet et signature du responsable du dispensateur de formation :', 20, y); y += 5
  try { doc.addImage(STAMP_BASE64, 'JPEG', 20, y, 50, 18) } catch {}
  doc.text(`${ORG.dirigeant}, Dirigeant ${ORG.name}`, 75, y + 10)
  
  addFooter(doc, DOC_CODES.certificat)
}

function generateConvocationContent(doc, session, trainee, trainer) {
  const course = session?.courses || {}
  const client = session?.clients || {}
  const ref = session?.reference || ''
  const lieu = getLocation(session)
  
  let y = addHeader(doc, ref)
  y = addTitle(doc, 'CONVOCATION', y)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`${ORG.city}, le ${formatDate(new Date())}`, 150, y, { align: 'right' })
  y += 10
  
  doc.text(`À l'attention de : ${trainee?.first_name || ''} ${trainee?.last_name?.toUpperCase() || ''}`, 20, y)
  y += 5
  if (client?.name) { doc.text(`Entreprise : ${client.name}`, 20, y); y += 5 }
  y += 8
  
  doc.text('Madame, Monsieur,', 20, y)
  y += 8
  
  const intro = `Nous avons le plaisir de vous informer que vous êtes convoqué(e) à la formation "${course.title || ''}" qui se déroulera selon les modalités suivantes :`
  doc.splitTextToSize(intro, 170).forEach(line => { doc.text(line, 20, y); y += 5 })
  y += 6
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Dates : `, 20, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`Du ${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`, 50, y)
  y += 5
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Horaires : `, 20, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${session?.start_time || '09:00'} - ${session?.end_time || '17:00'}`, 50, y)
  y += 5
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Lieu : `, 20, y)
  doc.setFont('helvetica', 'normal')
  doc.text(lieu || 'À définir', 50, y)
  y += 5
  
  doc.setFont('helvetica', 'bold')
  doc.text(`Durée : `, 20, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${course.duration_hours || course.duration || '7'} heures`, 50, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text('Nous vous demandons de venir avec :', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text('• Votre pièce d\'identité', 25, y); y += 5
  doc.text('• Votre numéro de sécurité sociale', 25, y); y += 8
  
  doc.text('Restant à votre disposition, nous vous adressons nos salutations distinguées.', 20, y)
  y += 15
  
  doc.text(`Fait à ${ORG.city}, le ${formatDate(new Date())}`, 20, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text(ORG.dirigeant, 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(ORG.name, 20, y)
  
  try { doc.addImage(LOGO_BASE64, 'PNG', 130, y - 25, 25, 25) } catch(e) {}
  try { doc.addImage(STAMP_BASE64, 'PNG', 155, y - 25, 30, 30) } catch(e) {}
  
  addFooter(doc, DOC_CODES.convocation)
}

function generateAttestationContent(doc, session, trainee, trainer) {
  const course = session?.courses || {}
  const client = session?.clients || {}
  const pw = doc.internal.pageSize.getWidth()
  const ref = session?.reference || ''
  const lieu = getLocation(session)
  
  let y = addHeader(doc, ref)
  y = addTitle(doc, 'ATTESTATION DE PRÉSENCE', y)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Je soussigné, ${ORG.dirigeant}, représentant l'organisme de formation ${ORG.name}, atteste que :`, 20, y, { maxWidth: 170 })
  y += 12
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`${trainee?.first_name || ''} ${trainee?.last_name?.toUpperCase() || ''}`, pw / 2, y, { align: 'center' })
  y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Entreprise : ${client.name || ''}`, 20, y); y += 8
  doc.text(`A participé à la formation intitulée : ${course.title || ''}`, 20, y); y += 8
  doc.text(`Dates : du ${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`, 20, y); y += 8
  doc.text(`Durée totale : ${course.duration_hours || course.duration || '7'} heures`, 20, y); y += 8
  doc.text(`Lieu : ${lieu}`, 20, y); y += 8
  doc.text(`Cette formation a été animée par : ${trainer ? `${trainer.first_name} ${trainer.last_name}` : ORG.dirigeant}`, 20, y); y += 8
  doc.text(`Horaires suivis : ${session?.start_time || ''} - ${session?.end_time || ''}`, 20, y); y += 8
  doc.text(`Nombre total d'heures de présence : ${course.duration_hours || course.duration || '7'}`, 20, y); y += 12
  
  doc.text('Fait pour servir et valoir ce que de droit.', 20, y); y += 10
  doc.text(`Fait à ${ORG.city}, le ${formatDate(new Date())}`, 20, y); y += 10
  
  doc.text(`Pour ${ORG.name}`, 20, y); y += 5
  try { doc.addImage(LOGO_BASE64, 'PNG', 130, y - 5, 25, 25) } catch {}
  try { doc.addImage(STAMP_BASE64, 'PNG', 155, y - 5, 30, 30) } catch {}
  doc.text(ORG.dirigeant, 20, y + 10)
  
  addFooter(doc, DOC_CODES.attestation)
}

function generateEvaluationContent(doc, session, trainee) {
  const course = session?.courses || {}
  const pw = doc.internal.pageSize.getWidth()
  const ref = session?.reference || ''
  
  let y = addHeader(doc, ref)
  y = addTitle(doc, 'ÉVALUATION À CHAUD', y)
  
  doc.setFontSize(9)
  doc.text(`Formation : ${course.title || ''}`, 20, y)
  doc.text(`Date : ${formatDate(session?.start_date)}`, 130, y)
  y += 5
  if (trainee) { doc.text(`Stagiaire : ${trainee.first_name || ''} ${trainee.last_name?.toUpperCase() || ''}`, 20, y); y += 5 }
  y += 4
  
  // Objectifs de la formation
  const objectives = (course?.objectives || '').split('\n').map(o => o.trim()).filter(o => o.length > 0)
  if (objectives.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Objectifs de la formation :', 20, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    objectives.forEach((obj, idx) => {
      doc.text(`• ${obj}`, 22, y)
      y += 3.5
    })
    y += 4
  }
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Merci de noter chaque critère :', 20, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('1 = Insuffisant   2 = Passable   3 = Moyen   4 = Satisfaisant   5 = Très Satisfaisant', 20, y)
  y += 6
  
  // 9 critères Qualiopi
  const criteres = [
    'Clarté des objectifs',
    'Accueil et organisation',
    'Pertinence du contenu',
    'Supports pédagogiques',
    'Pédagogie du formateur',
    'Rythme et durée',
    'Conditions matérielles',
    'Utilité professionnelle',
    'Satisfaction globale',
  ]
  
  const colW = 12, labelW = pw - 40 - colW * 5
  
  doc.setFillColor(240, 240, 240)
  doc.rect(20, y, labelW, 6, 'F')
  for (let i = 1; i <= 5; i++) doc.rect(20 + labelW + (i - 1) * colW, y, colW, 6, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Critère', 22, y + 4)
  for (let i = 1; i <= 5; i++) doc.text(String(i), 20 + labelW + (i - 1) * colW + colW / 2, y + 4, { align: 'center' })
  y += 6
  
  doc.setFont('helvetica', 'normal')
  criteres.forEach(c => {
    doc.rect(20, y, labelW, 6)
    for (let i = 1; i <= 5; i++) {
      doc.rect(20 + labelW + (i - 1) * colW, y, colW, 6)
      drawCircle(doc, 20 + labelW + (i - 1) * colW + colW / 2 - 1, y + 4, 1.2, false)
    }
    doc.text(c, 22, y + 4)
    y += 6
  })
  
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text('Recommanderiez-vous cette formation ?', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  drawCircle(doc, 30, y, 1.5, false); doc.text('  Oui', 34, y)
  drawCircle(doc, 60, y, 1.5, false); doc.text('  Non', 64, y)
  y += 7
  
  doc.setFont('helvetica', 'bold')
  doc.text('Commentaires :', 20, y); y += 4
  doc.rect(20, y, 170, 22); y += 26
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Date : ${formatDate(new Date())}`, 20, y)
  doc.text('Signature :', 120, y)
  
  addFooter(doc, DOC_CODES.evaluation)
}

function generateEvaluationFroidContent(doc, session, trainee) {
  const course = session?.courses || {}
  const ref = session?.reference || ''
  
  let y = addHeader(doc, ref)
  y = addTitle(doc, 'ÉVALUATION À FROID', y)
  
  doc.setFontSize(9)
  doc.text(`Formation : ${course.title || ''}`, 20, y)
  y += 5
  doc.text(`Date de la formation : du ${formatDate(session?.start_date)} au ${formatDate(session?.end_date)}`, 20, y)
  y += 5
  if (trainee) { doc.text(`Stagiaire : ${trainee.first_name || ''} ${trainee.last_name?.toUpperCase() || ''}`, 20, y); y += 5 }
  y += 4
  
  // Objectifs de la formation
  const objectives = (course?.objectives || '').split('\n').map(o => o.trim()).filter(o => o.length > 0)
  if (objectives.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Objectifs de la formation :', 20, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    objectives.forEach((obj, idx) => {
      doc.text(`• ${obj}`, 22, y)
      y += 3.5
    })
    y += 4
  }
  
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.text('Cette évaluation est à compléter 1 à 3 mois après la formation.', 20, y)
  y += 8
  
  const questions = [
    'Avez-vous pu mettre en pratique les compétences acquises ?',
    'Les connaissances acquises sont-elles toujours présentes ?',
    'La formation a-t-elle eu un impact positif sur votre travail ?',
    'Les objectifs de la formation ont-ils été atteints ?',
  ]
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Veuillez répondre aux questions suivantes :', 20, y); y += 7
  
  questions.forEach((q, idx) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`${idx + 1}. ${q}`, 20, y); y += 5
    drawCircle(doc, 25, y, 1.5, false)
    doc.text(' Oui', 29, y)
    drawCircle(doc, 55, y, 1.5, false)
    doc.text(' Non', 59, y)
    y += 9
  })
  
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.text('Recommanderiez-vous cette formation ?', 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  drawCircle(doc, 30, y, 1.5, false); doc.text('  Oui', 35, y)
  drawCircle(doc, 70, y, 1.5, false); doc.text('  Non', 75, y)
  y += 8
  
  doc.setFont('helvetica', 'bold')
  doc.text('Commentaires :', 20, y); y += 4
  doc.rect(20, y, 170, 30); y += 35
  
  doc.setFont('helvetica', 'normal')
  doc.text(`Date : ${formatDate(new Date())}`, 20, y)
  doc.text('Signature :', 120, y)
  
  addFooter(doc, DOC_CODES.evaluationFroid)
}

function generatePositionnementContent(doc, session, questions, trainee) {
  const course = session?.courses || {}
  
  addHeader(doc, ORG.logo_base64)
  
  let y = 50
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('TEST DE POSITIONNEMENT', 105, y, { align: 'center' })
  y += 10
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Formation : ${course.title || 'Formation'}`, 20, y); y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Date : ${formatDate(session?.start_date)}`, 20, y); y += 5
  if (trainee) { doc.text(`Stagiaire : ${trainee.first_name || ''} ${trainee.last_name?.toUpperCase() || ''}`, 20, y); y += 5 }
  y += 10
  
  if (!questions || questions.length === 0) {
    doc.text('Aucune question configurée pour cette formation.', 20, y)
  } else {
    questions.forEach((q, idx) => {
      if (y > 250) { addFooter(doc, DOC_CODES.positionnement); doc.addPage(); y = 20 }
      
      doc.setFont('helvetica', 'bold')
      doc.splitTextToSize(`${idx + 1}. ${q.question}`, 170).forEach(line => { doc.text(line, 20, y); y += 5 })
      y += 3
      
      doc.setFont('helvetica', 'normal')
      if (q.type === 'qcm' && q.options) {
        const opts = Array.isArray(q.options) ? q.options : (q.options || '').split('\n').filter(o => o.trim())
        opts.forEach(opt => { drawCheckbox(doc, 25, y - 3, 3, false); doc.text(`  ${opt}`, 30, y); y += 6 })
      } else {
        doc.rect(20, y, 170, 15); y += 18
      }
      y += 5
    })
  }
  
  addFooter(doc, DOC_CODES.positionnement)
}

