import jsPDF from 'jspdf'

// Configuration commune
const CONFIG = {
  margin: 20,
  lineHeight: 6,
  fontSize: {
    title: 16,
    subtitle: 12,
    normal: 10,
    small: 8
  },
  colors: {
    primary: [41, 128, 185],
    text: [51, 51, 51],
    gray: [128, 128, 128],
    lightGray: [200, 200, 200]
  }
}

// Utilitaires
const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const formatDateLong = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

// Ajouter le logo
const addLogo = (doc, logoBase64, x = 20, y = 15, maxWidth = 50) => {
  if (!logoBase64) return 30
  try {
    doc.addImage(logoBase64, 'PNG', x, y, maxWidth, 0)
    return y + 25
  } catch (e) {
    console.warn('Erreur ajout logo:', e)
    return y
  }
}

// Ajouter le pied de page
const addFooter = (doc, reference, version = 'V2.0') => {
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...CONFIG.colors.gray)
    
    // Référence à gauche
    doc.text(`${reference}`, CONFIG.margin, 285)
    
    // Version au centre (filigrane)
    doc.text(version, 105, 285, { align: 'center' })
    
    // Page à droite
    doc.text(`Page ${i}/${pageCount}`, 190, 285, { align: 'right' })
  }
}

// ============================================================================
// CONVENTION (AF-CONV)
// ============================================================================
export const generateConvention = (session, options = {}) => {
  const doc = new jsPDF()
  const { course, client, trainer } = session
  const price = session.use_custom_price ? session.custom_price_ht : course?.price_ht
  
  let y = addLogo(doc, options.logoBase64)
  y += 10
  
  // Titre
  doc.setFontSize(CONFIG.fontSize.title)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('CONVENTION DE FORMATION PROFESSIONNELLE', 105, y, { align: 'center' })
  
  y += 10
  doc.setFontSize(CONFIG.fontSize.small)
  doc.setTextColor(...CONFIG.colors.gray)
  doc.text(`Référence : ${session.reference}`, 105, y, { align: 'center' })
  
  y += 15
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  doc.setFont('helvetica', 'normal')
  
  // Entre les soussignés
  doc.text('Entre les soussignés :', CONFIG.margin, y)
  y += 10
  
  doc.setFont('helvetica', 'bold')
  doc.text("L'organisme de formation :", CONFIG.margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(options.organizationName || 'Access Formation', CONFIG.margin + 5, y)
  y += 6
  if (options.organizationAddress) {
    doc.text(options.organizationAddress, CONFIG.margin + 5, y)
    y += 6
  }
  if (options.organizationSiret) {
    doc.text(`SIRET : ${options.organizationSiret}`, CONFIG.margin + 5, y)
    y += 6
  }
  
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text("L'entreprise cliente :", CONFIG.margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(client?.name || '', CONFIG.margin + 5, y)
  y += 6
  if (client?.address) {
    doc.text(`${client.address}, ${client.postal_code} ${client.city}`, CONFIG.margin + 5, y)
    y += 6
  }
  if (client?.siret) {
    doc.text(`SIRET : ${client.siret}`, CONFIG.margin + 5, y)
    y += 6
  }
  
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text('Article 1 - Objet', CONFIG.margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`La présente convention a pour objet la formation intitulée :`, CONFIG.margin, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text(course?.title || '', CONFIG.margin + 5, y)
  
  y += 12
  doc.setFont('helvetica', 'bold')
  doc.text('Article 2 - Durée et dates', CONFIG.margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Durée : ${course?.duration_days} jour(s) soit ${course?.duration_hours} heures`, CONFIG.margin, y)
  y += 6
  doc.text(`Du ${formatDate(session.start_date)} au ${formatDate(session.end_date || session.start_date)}`, CONFIG.margin, y)
  y += 6
  doc.text(`Horaires : ${session.start_time} - ${session.end_time}`, CONFIG.margin, y)
  
  y += 12
  doc.setFont('helvetica', 'bold')
  doc.text('Article 3 - Lieu', CONFIG.margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  if (session.is_intra) {
    doc.text(`Dans les locaux de l'entreprise : ${client?.address}, ${client?.postal_code} ${client?.city}`, CONFIG.margin, y)
  } else {
    doc.text(session.location || 'À définir', CONFIG.margin, y)
  }
  
  y += 12
  doc.setFont('helvetica', 'bold')
  doc.text('Article 4 - Coût de la formation', CONFIG.margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Coût total HT : ${price || 0} €`, CONFIG.margin, y)
  y += 6
  doc.text(`(TVA non applicable - Article 261 du CGI)`, CONFIG.margin, y)
  
  // Signatures
  y = 220
  doc.setFont('helvetica', 'bold')
  doc.text('Signatures', CONFIG.margin, y)
  y += 10
  
  doc.setFont('helvetica', 'normal')
  doc.text("Pour l'organisme de formation", CONFIG.margin, y)
  doc.text("Pour l'entreprise", 120, y)
  y += 5
  doc.text('Date et signature :', CONFIG.margin, y)
  doc.text('Date, signature et cachet :', 120, y)
  
  // Cadres signature
  doc.setDrawColor(...CONFIG.colors.lightGray)
  doc.rect(CONFIG.margin, y + 5, 70, 30)
  doc.rect(120, y + 5, 70, 30)
  
  addFooter(doc, `AF-CONV - ${session.reference}`)
  
  doc.save(`Convention_${session.reference}.pdf`)
}

// ============================================================================
// PROGRAMME (AF-PROG)
// ============================================================================
export const generateProgramme = (session, options = {}) => {
  const doc = new jsPDF()
  const { course } = session
  
  let y = addLogo(doc, options.logoBase64)
  y += 10
  
  // Titre
  doc.setFontSize(CONFIG.fontSize.title)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('PROGRAMME DE FORMATION', 105, y, { align: 'center' })
  
  y += 15
  doc.setFontSize(14)
  doc.setTextColor(...CONFIG.colors.text)
  doc.text(course?.title || '', 105, y, { align: 'center' })
  
  y += 5
  doc.setFontSize(CONFIG.fontSize.small)
  doc.setTextColor(...CONFIG.colors.gray)
  doc.text(`Code : ${course?.code || 'N/A'} | Réf : ${session.reference}`, 105, y, { align: 'center' })
  
  y += 15
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  
  // Durée
  doc.setFont('helvetica', 'bold')
  doc.text('Durée :', CONFIG.margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${course?.duration_days} jour(s) - ${course?.duration_hours} heures`, CONFIG.margin + 25, y)
  
  y += 12
  
  // Objectifs
  if (course?.objectives?.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('Objectifs pédagogiques :', CONFIG.margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    
    course.objectives.forEach((obj, i) => {
      doc.text(`• ${obj}`, CONFIG.margin + 5, y)
      y += 6
    })
    y += 6
  }
  
  // Public cible
  if (course?.target_audience) {
    doc.setFont('helvetica', 'bold')
    doc.text('Public concerné :', CONFIG.margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(course.target_audience, 170)
    doc.text(lines, CONFIG.margin + 5, y)
    y += lines.length * 5 + 6
  }
  
  // Prérequis
  if (course?.prerequisites) {
    doc.setFont('helvetica', 'bold')
    doc.text('Prérequis :', CONFIG.margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(course.prerequisites, 170)
    doc.text(lines, CONFIG.margin + 5, y)
    y += lines.length * 5 + 6
  }
  
  // Méthodes pédagogiques
  if (course?.pedagogical_methods) {
    doc.setFont('helvetica', 'bold')
    doc.text('Méthodes pédagogiques :', CONFIG.margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(course.pedagogical_methods, 170)
    doc.text(lines, CONFIG.margin + 5, y)
    y += lines.length * 5 + 6
  }
  
  // Matériel
  if (course?.materials) {
    doc.setFont('helvetica', 'bold')
    doc.text('Matériel à apporter :', CONFIG.margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(course.materials, 170)
    doc.text(lines, CONFIG.margin + 5, y)
    y += lines.length * 5 + 6
  }
  
  addFooter(doc, `AF-PROG - ${session.reference}`)
  
  doc.save(`Programme_${session.reference}.pdf`)
}

// ============================================================================
// CONVOCATION (AF-CONVOC)
// ============================================================================
export const generateConvocation = (session, trainee, options = {}) => {
  const doc = new jsPDF()
  const { course, client, trainer } = session
  
  let y = addLogo(doc, options.logoBase64)
  y += 10
  
  // Destinataire
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  doc.text(`${trainee.first_name} ${trainee.last_name}`, 130, y)
  if (client?.name) {
    y += 5
    doc.text(client.name, 130, y)
  }
  
  y += 20
  
  // Titre
  doc.setFontSize(CONFIG.fontSize.title)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('CONVOCATION À LA FORMATION', 105, y, { align: 'center' })
  
  y += 15
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  doc.setFont('helvetica', 'normal')
  
  doc.text('Madame, Monsieur,', CONFIG.margin, y)
  y += 10
  
  doc.text('Nous avons le plaisir de vous convoquer à la formation suivante :', CONFIG.margin, y)
  
  y += 12
  doc.setFont('helvetica', 'bold')
  doc.text(course?.title || '', CONFIG.margin, y)
  
  y += 12
  doc.setFont('helvetica', 'normal')
  
  // Tableau récapitulatif
  const tableData = [
    ['Date(s)', `Du ${formatDate(session.start_date)} au ${formatDate(session.end_date || session.start_date)}`],
    ['Horaires', `${session.start_time} - ${session.end_time}`],
    ['Durée', `${course?.duration_days} jour(s) - ${course?.duration_hours} heures`],
    ['Lieu', session.is_intra ? `${client?.address}, ${client?.postal_code} ${client?.city}` : (session.location || 'À confirmer')],
    ['Formateur', trainer ? `${trainer.first_name} ${trainer.last_name}` : 'À confirmer']
  ]
  
  tableData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(`${label} :`, CONFIG.margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, CONFIG.margin + 35, y)
    y += 7
  })
  
  y += 10
  
  // Matériel à apporter
  if (course?.materials) {
    doc.setFont('helvetica', 'bold')
    doc.text('Matériel à apporter :', CONFIG.margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(course.materials, 170)
    doc.text(lines, CONFIG.margin, y)
    y += lines.length * 5 + 10
  }
  
  // Accessibilité
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.text('Notre organisme est sensible à l\'accueil des personnes en situation de handicap.', CONFIG.margin, y)
  y += 5
  doc.text('Merci de nous contacter pour adapter votre accueil si nécessaire.', CONFIG.margin, y)
  
  y += 15
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.text('Dans l\'attente de vous accueillir, veuillez agréer nos salutations distinguées.', CONFIG.margin, y)
  
  y += 20
  doc.text(options.organizationName || 'Access Formation', CONFIG.margin, y)
  
  addFooter(doc, `AF-CONVOC - ${session.reference}`)
  
  doc.save(`Convocation_${trainee.first_name}_${trainee.last_name}_${session.reference}.pdf`)
}

// ============================================================================
// FEUILLE D'ÉMARGEMENT (AF-EMARG)
// ============================================================================
export const generateEmargement = (session, trainees, options = {}) => {
  const doc = new jsPDF('landscape')
  const { course, client } = session
  
  let y = 15
  
  // Logo
  if (options.logoBase64) {
    try {
      doc.addImage(options.logoBase64, 'PNG', 15, y, 40, 0)
    } catch (e) {}
  }
  
  // Titre
  doc.setFontSize(14)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('FEUILLE D\'ÉMARGEMENT', 148.5, y + 5, { align: 'center' })
  
  doc.setFontSize(10)
  doc.setTextColor(...CONFIG.colors.gray)
  doc.text(`Réf : ${session.reference}`, 148.5, y + 12, { align: 'center' })
  
  y += 25
  
  // Infos session
  doc.setFontSize(10)
  doc.setTextColor(...CONFIG.colors.text)
  doc.setFont('helvetica', 'normal')
  
  doc.text(`Formation : ${course?.title}`, 15, y)
  doc.text(`Client : ${client?.name}`, 150, y)
  y += 6
  doc.text(`Date(s) : ${formatDate(session.start_date)} - ${formatDate(session.end_date || session.start_date)}`, 15, y)
  doc.text(`Horaires : ${session.start_time} - ${session.end_time}`, 150, y)
  
  y += 15
  
  // Tableau
  const colWidths = [60, 50, 45, 45, 45, 45]
  const headers = ['Nom et Prénom', 'N° Sécurité Sociale', 'Matin Arrivée', 'Matin Départ', 'Après-midi Arrivée', 'Après-midi Départ']
  
  let x = 15
  doc.setFillColor(240, 240, 240)
  doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), 10, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  headers.forEach((header, i) => {
    doc.text(header, x + 2, y + 7)
    x += colWidths[i]
  })
  
  y += 10
  doc.setFont('helvetica', 'normal')
  
  // Lignes stagiaires
  trainees.forEach((trainee, index) => {
    x = 15
    
    // Alternance couleur
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250)
      doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), 12, 'F')
    }
    
    // Bordures
    doc.setDrawColor(...CONFIG.colors.lightGray)
    colWidths.forEach(width => {
      doc.rect(x, y, width, 12)
      x += width
    })
    
    // Contenu
    x = 15
    doc.setFontSize(9)
    doc.text(`${trainee.first_name} ${trainee.last_name}`, x + 2, y + 8)
    x += colWidths[0]
    doc.setFontSize(7)
    doc.text(trainee.social_security_number || '', x + 2, y + 8)
    
    y += 12
    
    // Nouvelle page si nécessaire
    if (y > 180) {
      doc.addPage('landscape')
      y = 20
    }
  })
  
  // Note sans signature formateur
  y += 15
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...CONFIG.colors.gray)
  doc.text('Note : La signature du formateur sera apposée manuscritement sur le document original.', 15, y)
  
  addFooter(doc, `AF-EMARG - ${session.reference}`)
  
  doc.save(`Emargement_${session.reference}.pdf`)
}

// ============================================================================
// ATTESTATION DE PRÉSENCE (AF-ATTP)
// ============================================================================
export const generateAttestationPresence = (session, trainee, options = {}) => {
  const doc = new jsPDF()
  const { course, client } = session
  
  let y = addLogo(doc, options.logoBase64)
  y += 15
  
  // Titre
  doc.setFontSize(CONFIG.fontSize.title)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('ATTESTATION DE PRÉSENCE', 105, y, { align: 'center' })
  
  y += 20
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  doc.setFont('helvetica', 'normal')
  
  doc.text('Je soussigné(e), responsable de l\'organisme de formation,', CONFIG.margin, y)
  y += 10
  doc.text('atteste que :', CONFIG.margin, y)
  
  y += 15
  doc.setFont('helvetica', 'bold')
  doc.text(`${trainee.first_name} ${trainee.last_name}`, 105, y, { align: 'center' })
  
  y += 10
  doc.setFont('helvetica', 'normal')
  if (client?.name) {
    doc.text(`Entreprise : ${client.name}`, 105, y, { align: 'center' })
    y += 10
  }
  
  doc.text('a suivi la formation :', CONFIG.margin, y)
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text(course?.title || '', 105, y, { align: 'center' })
  
  y += 15
  doc.setFont('helvetica', 'normal')
  
  // Tableau récap
  const details = [
    ['Durée', `${course?.duration_hours} heures`],
    ['Date(s)', `Du ${formatDate(session.start_date)} au ${formatDate(session.end_date || session.start_date)}`],
    ['Lieu', session.is_intra ? `${client?.address}, ${client?.postal_code} ${client?.city}` : (session.location || '')]
  ]
  
  details.forEach(([label, value]) => {
    doc.text(`${label} : ${value}`, CONFIG.margin, y)
    y += 7
  })
  
  y += 20
  doc.text(`Fait à ______________________, le ${formatDate(new Date())}`, CONFIG.margin, y)
  
  y += 25
  doc.text('Signature et cachet :', CONFIG.margin, y)
  doc.setDrawColor(...CONFIG.colors.lightGray)
  doc.rect(CONFIG.margin, y + 5, 70, 35)
  
  addFooter(doc, `AF-ATTP - ${session.reference}`)
  
  doc.save(`Attestation_${trainee.first_name}_${trainee.last_name}_${session.reference}.pdf`)
}

// ============================================================================
// CERTIFICAT DE RÉALISATION (AF-CERT)
// ============================================================================
export const generateCertificat = (session, trainee, results = {}, options = {}) => {
  const doc = new jsPDF()
  const { course, client } = session
  
  let y = addLogo(doc, options.logoBase64)
  y += 15
  
  // Titre
  doc.setFontSize(CONFIG.fontSize.title)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('CERTIFICAT DE RÉALISATION', 105, y, { align: 'center' })
  
  y += 20
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  doc.setFont('helvetica', 'normal')
  
  doc.text('Je soussigné(e), représentant(e) de l\'organisme de formation,', CONFIG.margin, y)
  y += 8
  doc.text('certifie que :', CONFIG.margin, y)
  
  y += 15
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`${trainee.first_name} ${trainee.last_name}`, 105, y, { align: 'center' })
  
  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(CONFIG.fontSize.normal)
  if (trainee.birth_date) {
    doc.text(`Né(e) le ${formatDate(trainee.birth_date)}${trainee.birth_place ? ` à ${trainee.birth_place}` : ''}`, 105, y, { align: 'center' })
    y += 8
  }
  
  y += 10
  doc.text('a suivi l\'action de formation suivante :', CONFIG.margin, y)
  
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text(course?.title || '', 105, y, { align: 'center' })
  
  y += 15
  doc.setFont('helvetica', 'normal')
  
  // Détails
  doc.text(`Du ${formatDate(session.start_date)} au ${formatDate(session.end_date || session.start_date)}`, CONFIG.margin, y)
  y += 7
  doc.text(`Durée : ${course?.duration_hours} heures`, CONFIG.margin, y)
  
  y += 15
  
  // Cases à cocher (carrés graphiques)
  doc.setFont('helvetica', 'bold')
  doc.text('Résultats :', CONFIG.margin, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  
  const drawCheckbox = (x, y, checked) => {
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.rect(x, y - 3, 4, 4)
    if (checked) {
      doc.setFont('helvetica', 'bold')
      doc.text('✓', x + 0.5, y)
      doc.setFont('helvetica', 'normal')
    }
  }
  
  drawCheckbox(CONFIG.margin, y, results.completed !== false)
  doc.text('Formation suivie intégralement', CONFIG.margin + 7, y)
  y += 7
  
  drawCheckbox(CONFIG.margin, y, results.objectives_achieved !== false)
  doc.text('Objectifs atteints', CONFIG.margin + 7, y)
  y += 7
  
  drawCheckbox(CONFIG.margin, y, !results.completed)
  doc.text('Formation suivie partiellement', CONFIG.margin + 7, y)
  
  // Date du certificat = date de fin
  y += 25
  doc.text(`Fait à ______________________, le ${formatDate(session.end_date || session.start_date)}`, CONFIG.margin, y)
  
  y += 25
  doc.text('Signature et cachet :', CONFIG.margin, y)
  doc.setDrawColor(...CONFIG.colors.lightGray)
  doc.rect(CONFIG.margin, y + 5, 70, 35)
  
  addFooter(doc, `AF-CERT - ${session.reference}`)
  
  doc.save(`Certificat_${trainee.first_name}_${trainee.last_name}_${session.reference}.pdf`)
}

// ============================================================================
// ÉVALUATION À CHAUD (AF-EVAL)
// ============================================================================
export const generateEvaluationChaud = (session, trainee, options = {}) => {
  const doc = new jsPDF()
  const { course } = session
  
  let y = addLogo(doc, options.logoBase64)
  y += 10
  
  // Titre
  doc.setFontSize(CONFIG.fontSize.title)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('ÉVALUATION À CHAUD', 105, y, { align: 'center' })
  
  y += 8
  doc.setFontSize(CONFIG.fontSize.subtitle)
  doc.text(course?.title || '', 105, y, { align: 'center' })
  
  y += 5
  doc.setFontSize(CONFIG.fontSize.small)
  doc.setTextColor(...CONFIG.colors.gray)
  doc.text(`Réf : ${session.reference} | Date : ${formatDate(session.end_date || session.start_date)}`, 105, y, { align: 'center' })
  
  if (trainee) {
    y += 5
    doc.text(`Stagiaire : ${trainee.first_name} ${trainee.last_name}`, 105, y, { align: 'center' })
  }
  
  y += 15
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  doc.setFont('helvetica', 'normal')
  
  // Légende
  doc.setFontSize(8)
  doc.text('1 = Très insuffisant | 2 = Passable | 3 = Moyen | 4 = Satisfaisant | 5 = Très satisfaisant', 105, y, { align: 'center' })
  
  y += 10
  
  // Questions
  const questions = [
    'Les objectifs de la formation étaient-ils clairement définis ?',
    'Le contenu correspondait-il à vos attentes ?',
    'Les méthodes pédagogiques étaient-elles adaptées ?',
    'La durée de la formation était-elle adaptée ?',
    'Les supports de formation étaient-ils de qualité ?',
    'Le formateur maîtrisait-il le sujet ?'
  ]
  
  // Tableau
  const colWidth = 25
  const labelWidth = 120
  
  // En-tête
  doc.setFillColor(240, 240, 240)
  doc.rect(CONFIG.margin, y, labelWidth + colWidth * 5, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Critères', CONFIG.margin + 2, y + 7)
  
  for (let i = 1; i <= 5; i++) {
    doc.text(String(i), CONFIG.margin + labelWidth + (i - 1) * colWidth + colWidth / 2, y + 7, { align: 'center' })
  }
  
  y += 10
  doc.setFont('helvetica', 'normal')
  
  questions.forEach((q, index) => {
    // Ligne
    doc.setDrawColor(...CONFIG.colors.lightGray)
    doc.rect(CONFIG.margin, y, labelWidth, 12)
    
    const lines = doc.splitTextToSize(q, labelWidth - 4)
    doc.text(lines, CONFIG.margin + 2, y + (lines.length === 1 ? 8 : 5))
    
    // Cases avec cercles
    for (let i = 1; i <= 5; i++) {
      const cx = CONFIG.margin + labelWidth + (i - 1) * colWidth + colWidth / 2
      doc.rect(CONFIG.margin + labelWidth + (i - 1) * colWidth, y, colWidth, 12)
      doc.circle(cx, y + 6, 3)
    }
    
    y += 12
  })
  
  y += 10
  
  // Question recommandation
  doc.setFont('helvetica', 'bold')
  doc.text('Recommanderiez-vous cette formation ?', CONFIG.margin, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  
  // Cercles Oui/Non
  doc.circle(CONFIG.margin + 3, y, 3)
  doc.text('Oui', CONFIG.margin + 10, y + 1)
  doc.circle(CONFIG.margin + 40, y, 3)
  doc.text('Non', CONFIG.margin + 47, y + 1)
  
  y += 15
  
  // Commentaires
  doc.setFont('helvetica', 'bold')
  doc.text('Commentaires et suggestions :', CONFIG.margin, y)
  y += 5
  doc.setDrawColor(...CONFIG.colors.lightGray)
  doc.rect(CONFIG.margin, y, 170, 40)
  
  addFooter(doc, `AF-EVAL - ${session.reference}`)
  
  const filename = trainee 
    ? `Evaluation_chaud_${trainee.first_name}_${trainee.last_name}_${session.reference}.pdf`
    : `Evaluation_chaud_${session.reference}.pdf`
  
  doc.save(filename)
}

// ============================================================================
// ÉVALUATION À FROID (AF-EVALF)
// ============================================================================
export const generateEvaluationFroid = (session, trainee, options = {}) => {
  const doc = new jsPDF()
  const { course } = session
  
  let y = addLogo(doc, options.logoBase64)
  y += 10
  
  // Titre
  doc.setFontSize(CONFIG.fontSize.title)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('ÉVALUATION À FROID', 105, y, { align: 'center' })
  
  y += 8
  doc.setFontSize(CONFIG.fontSize.subtitle)
  doc.text(course?.title || '', 105, y, { align: 'center' })
  
  y += 5
  doc.setFontSize(CONFIG.fontSize.small)
  doc.setTextColor(...CONFIG.colors.gray)
  doc.text(`Formation du ${formatDate(session.start_date)}`, 105, y, { align: 'center' })
  
  if (trainee) {
    y += 5
    doc.text(`Stagiaire : ${trainee.first_name} ${trainee.last_name}`, 105, y, { align: 'center' })
  }
  
  y += 15
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  doc.setFont('helvetica', 'normal')
  
  // Légende
  doc.setFontSize(8)
  doc.text('1 = Très insuffisant | 2 = Passable | 3 = Moyen | 4 = Satisfaisant | 5 = Très satisfaisant', 105, y, { align: 'center' })
  
  y += 12
  
  const questions = [
    'Avez-vous pu mettre en application les acquis de la formation ?',
    'La formation a-t-elle eu un impact positif sur votre travail ?',
    'Estimez-vous avoir développé de nouvelles compétences ?',
    'Êtes-vous globalement satisfait(e) de cette formation ?'
  ]
  
  // Tableau
  const colWidth = 25
  const labelWidth = 120
  
  doc.setFillColor(240, 240, 240)
  doc.rect(CONFIG.margin, y, labelWidth + colWidth * 5, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Questions', CONFIG.margin + 2, y + 7)
  
  for (let i = 1; i <= 5; i++) {
    doc.text(String(i), CONFIG.margin + labelWidth + (i - 1) * colWidth + colWidth / 2, y + 7, { align: 'center' })
  }
  
  y += 10
  doc.setFont('helvetica', 'normal')
  
  questions.forEach((q) => {
    doc.setDrawColor(...CONFIG.colors.lightGray)
    doc.rect(CONFIG.margin, y, labelWidth, 12)
    
    const lines = doc.splitTextToSize(q, labelWidth - 4)
    doc.text(lines, CONFIG.margin + 2, y + (lines.length === 1 ? 8 : 5))
    
    for (let i = 1; i <= 5; i++) {
      const cx = CONFIG.margin + labelWidth + (i - 1) * colWidth + colWidth / 2
      doc.rect(CONFIG.margin + labelWidth + (i - 1) * colWidth, y, colWidth, 12)
      doc.circle(cx, y + 6, 3)
    }
    
    y += 12
  })
  
  y += 15
  
  // Questions ouvertes
  doc.setFont('helvetica', 'bold')
  doc.text('Pouvez-vous donner des exemples concrets de mise en application ?', CONFIG.margin, y)
  y += 5
  doc.setDrawColor(...CONFIG.colors.lightGray)
  doc.rect(CONFIG.margin, y, 170, 30)
  
  y += 40
  
  doc.setFont('helvetica', 'bold')
  doc.text('Avez-vous des besoins de formation complémentaires ?', CONFIG.margin, y)
  y += 5
  doc.rect(CONFIG.margin, y, 170, 30)
  
  addFooter(doc, `AF-EVALF - ${session.reference}`)
  
  const filename = trainee 
    ? `Evaluation_froid_${trainee.first_name}_${trainee.last_name}_${session.reference}.pdf`
    : `Evaluation_froid_${session.reference}.pdf`
  
  doc.save(filename)
}

// ============================================================================
// ÉVALUATION FORMATEUR (AF-EVAL-F)
// ============================================================================
export const generateEvaluationFormateur = (session, options = {}) => {
  const doc = new jsPDF()
  const { course, trainer } = session
  
  let y = addLogo(doc, options.logoBase64)
  y += 10
  
  // Titre
  doc.setFontSize(CONFIG.fontSize.title)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('ÉVALUATION PAR LE FORMATEUR', 105, y, { align: 'center' })
  
  y += 8
  doc.setFontSize(CONFIG.fontSize.subtitle)
  doc.text(course?.title || '', 105, y, { align: 'center' })
  
  y += 5
  doc.setFontSize(CONFIG.fontSize.small)
  doc.setTextColor(...CONFIG.colors.gray)
  doc.text(`Réf : ${session.reference} | Date : ${formatDate(session.end_date || session.start_date)}`, 105, y, { align: 'center' })
  
  if (trainer) {
    y += 5
    doc.text(`Formateur : ${trainer.first_name} ${trainer.last_name}`, 105, y, { align: 'center' })
  }
  
  y += 15
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  doc.setFont('helvetica', 'normal')
  
  // Légende
  doc.setFontSize(8)
  doc.text('1 = Très insuffisant | 2 = Passable | 3 = Moyen | 4 = Satisfaisant | 5 = Très satisfaisant', 105, y, { align: 'center' })
  
  y += 12
  
  const criteria = [
    'Motivation et implication du groupe',
    'Niveau initial des stagiaires',
    'Conditions matérielles de la formation',
    'Organisation générale',
    'Atteinte des objectifs pédagogiques',
    'Ambiance générale'
  ]
  
  // Tableau
  const colWidth = 25
  const labelWidth = 120
  
  doc.setFillColor(240, 240, 240)
  doc.rect(CONFIG.margin, y, labelWidth + colWidth * 5, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Critères', CONFIG.margin + 2, y + 7)
  
  for (let i = 1; i <= 5; i++) {
    doc.text(String(i), CONFIG.margin + labelWidth + (i - 1) * colWidth + colWidth / 2, y + 7, { align: 'center' })
  }
  
  y += 10
  doc.setFont('helvetica', 'normal')
  
  criteria.forEach((c) => {
    doc.setDrawColor(...CONFIG.colors.lightGray)
    doc.rect(CONFIG.margin, y, labelWidth, 10)
    doc.text(c, CONFIG.margin + 2, y + 7)
    
    for (let i = 1; i <= 5; i++) {
      const cx = CONFIG.margin + labelWidth + (i - 1) * colWidth + colWidth / 2
      doc.rect(CONFIG.margin + labelWidth + (i - 1) * colWidth, y, colWidth, 10)
      doc.circle(cx, y + 5, 3)
    }
    
    y += 10
  })
  
  y += 15
  
  // Questions ouvertes
  doc.setFont('helvetica', 'bold')
  doc.text('Points positifs :', CONFIG.margin, y)
  y += 5
  doc.setDrawColor(...CONFIG.colors.lightGray)
  doc.rect(CONFIG.margin, y, 170, 25)
  
  y += 35
  
  doc.setFont('helvetica', 'bold')
  doc.text('Difficultés rencontrées :', CONFIG.margin, y)
  y += 5
  doc.rect(CONFIG.margin, y, 170, 25)
  
  y += 35
  
  doc.setFont('helvetica', 'bold')
  doc.text('Suggestions d\'amélioration :', CONFIG.margin, y)
  y += 5
  doc.rect(CONFIG.margin, y, 170, 25)
  
  addFooter(doc, `AF-EVAL-F - ${session.reference}`)
  
  doc.save(`Evaluation_formateur_${session.reference}.pdf`)
}

// ============================================================================
// TEST DE POSITIONNEMENT (AF-POS)
// ============================================================================
export const generatePositionnement = (session, trainee, questions, options = {}) => {
  const doc = new jsPDF()
  const { course } = session
  
  let y = addLogo(doc, options.logoBase64)
  y += 10
  
  // Titre
  doc.setFontSize(CONFIG.fontSize.title)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('TEST DE POSITIONNEMENT', 105, y, { align: 'center' })
  
  y += 8
  doc.setFontSize(CONFIG.fontSize.subtitle)
  doc.text(course?.title || '', 105, y, { align: 'center' })
  
  y += 5
  doc.setFontSize(CONFIG.fontSize.small)
  doc.setTextColor(...CONFIG.colors.gray)
  doc.text(`Réf : ${session.reference}`, 105, y, { align: 'center' })
  
  if (trainee) {
    y += 5
    doc.text(`Stagiaire : ${trainee.first_name} ${trainee.last_name}`, 105, y, { align: 'center' })
  }
  
  y += 15
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  doc.setFont('helvetica', 'normal')
  
  doc.text('Merci d\'évaluer votre niveau pour chaque compétence (1 = Débutant, 5 = Expert)', CONFIG.margin, y)
  
  y += 12
  
  if (questions && questions.length > 0) {
    questions.forEach((q, index) => {
      doc.setFont('helvetica', 'bold')
      doc.text(`${index + 1}. ${q.text}`, CONFIG.margin, y)
      y += 8
      
      // Échelle 1-5
      doc.setFont('helvetica', 'normal')
      for (let i = 1; i <= 5; i++) {
        doc.circle(CONFIG.margin + 20 + (i - 1) * 25, y, 4)
        doc.text(String(i), CONFIG.margin + 20 + (i - 1) * 25, y + 1, { align: 'center' })
      }
      
      y += 15
      
      if (y > 260) {
        doc.addPage()
        y = 20
      }
    })
  } else {
    doc.text('Aucune question de positionnement définie pour cette formation.', CONFIG.margin, y)
  }
  
  addFooter(doc, `AF-POS - ${session.reference}`)
  
  const filename = trainee 
    ? `Positionnement_${trainee.first_name}_${trainee.last_name}_${session.reference}.pdf`
    : `Positionnement_${session.reference}.pdf`
  
  doc.save(filename)
}

// ============================================================================
// ANALYSE DE BESOIN (AF-BESOIN)
// ============================================================================
export const generateAnalyseBesoin = (session, client, options = {}) => {
  const doc = new jsPDF()
  const { course } = session
  
  let y = addLogo(doc, options.logoBase64)
  y += 10
  
  // Titre
  doc.setFontSize(CONFIG.fontSize.title)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('ANALYSE DE BESOIN', 105, y, { align: 'center' })
  
  y += 8
  doc.setFontSize(CONFIG.fontSize.small)
  doc.setTextColor(...CONFIG.colors.gray)
  doc.text(`Indicateur Qualiopi n°4`, 105, y, { align: 'center' })
  
  y += 15
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  
  // Infos client
  doc.setFont('helvetica', 'bold')
  doc.text('Entreprise :', CONFIG.margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(client?.name || '', CONFIG.margin + 35, y)
  y += 7
  
  doc.setFont('helvetica', 'bold')
  doc.text('Contact :', CONFIG.margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(client?.contact_name || '', CONFIG.margin + 35, y)
  y += 7
  
  doc.setFont('helvetica', 'bold')
  doc.text('Formation :', CONFIG.margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(course?.title || '', CONFIG.margin + 35, y)
  
  y += 15
  
  // Questions
  const sections = [
    { title: '1. Contexte de la demande', height: 30 },
    { title: '2. Objectifs attendus par l\'entreprise', height: 30 },
    { title: '3. Public concerné et prérequis', height: 25 },
    { title: '4. Contraintes organisationnelles', height: 25 },
    { title: '5. Modalités souhaitées (présentiel/distanciel)', height: 20 },
    { title: '6. Budget envisagé', height: 20 },
    { title: '7. Critères de réussite', height: 25 }
  ]
  
  sections.forEach(section => {
    doc.setFont('helvetica', 'bold')
    doc.text(section.title, CONFIG.margin, y)
    y += 5
    doc.setDrawColor(...CONFIG.colors.lightGray)
    doc.rect(CONFIG.margin, y, 170, section.height)
    y += section.height + 8
    
    if (y > 250) {
      doc.addPage()
      y = 20
    }
  })
  
  // Date et signature
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Date : ${formatDate(new Date())}`, CONFIG.margin, y)
  
  y += 15
  doc.text('Signature client :', CONFIG.margin, y)
  doc.rect(CONFIG.margin, y + 5, 60, 25)
  
  doc.text('Signature organisme :', 110, y)
  doc.rect(110, y + 5, 60, 25)
  
  addFooter(doc, `AF-BESOIN - ${session.reference}`)
  
  doc.save(`Analyse_besoin_${session.reference}.pdf`)
}

// ============================================================================
// DOCUMENTS VIERGES (RI, Livret d'accueil)
// ============================================================================
export const generateBlankDocument = (type, options = {}) => {
  const doc = new jsPDF()
  
  let y = addLogo(doc, options.logoBase64)
  y += 15
  
  // Titre
  doc.setFontSize(CONFIG.fontSize.title)
  doc.setTextColor(...CONFIG.colors.primary)
  doc.setFont('helvetica', 'bold')
  
  if (type === 'reglement_interieur') {
    doc.text('RÈGLEMENT INTÉRIEUR', 105, y, { align: 'center' })
  } else {
    doc.text("LIVRET D'ACCUEIL", 105, y, { align: 'center' })
  }
  
  y += 5
  doc.setFontSize(CONFIG.fontSize.small)
  doc.setTextColor(...CONFIG.colors.gray)
  doc.text(options.version || 'V1.0', 105, y, { align: 'center' })
  
  y += 15
  doc.setFontSize(CONFIG.fontSize.normal)
  doc.setTextColor(...CONFIG.colors.text)
  doc.setFont('helvetica', 'normal')
  
  // Contenu HTML simplifié
  if (options.content) {
    // Convertir HTML en texte simple
    const text = options.content
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n$1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
    
    const lines = doc.splitTextToSize(text, 170)
    
    lines.forEach(line => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      doc.text(line, CONFIG.margin, y)
      y += 5
    })
  }
  
  addFooter(doc, type === 'reglement_interieur' ? 'AF-RI' : 'AF-LA', options.version)
  
  doc.save(`${type === 'reglement_interieur' ? 'Reglement_interieur' : 'Livret_accueil'}.pdf`)
}

// ============================================================================
// ROUTER PRINCIPAL
// ============================================================================
export const generatePDF = async (docType, data) => {
  const { session, course, client, trainer, trainees, organization } = data
  
  // Préparer les options communes
  const options = {
    logoBase64: organization?.logo_base64 || null,
    organization
  }
  
  // Préparer les données session enrichies
  const sessionData = {
    ...session,
    course,
    client,
    trainer,
    trainees
  }
  
  switch (docType) {
    case 'convention':
      generateConvention(sessionData, options)
      break
      
    case 'programme':
      generateProgramme(sessionData, options)
      break
      
    case 'convocation':
      // Générer une convocation par stagiaire
      if (trainees && trainees.length > 0) {
        trainees.forEach(trainee => {
          generateConvocation({ ...sessionData, trainee }, options)
        })
      } else {
        throw new Error('Aucun stagiaire inscrit à cette session')
      }
      break
      
    case 'emargement':
      generateEmargement(sessionData, options)
      break
      
    case 'attestation':
      // Générer une attestation par stagiaire
      if (trainees && trainees.length > 0) {
        trainees.forEach(trainee => {
          generateAttestationPresence({ ...sessionData, trainee }, options)
        })
      } else {
        throw new Error('Aucun stagiaire inscrit à cette session')
      }
      break
      
    case 'certificat':
      // Générer un certificat par stagiaire
      if (trainees && trainees.length > 0) {
        trainees.forEach(trainee => {
          generateCertificat({ ...sessionData, trainee }, options)
        })
      } else {
        throw new Error('Aucun stagiaire inscrit à cette session')
      }
      break
      
    case 'eval_chaud':
      generateEvaluationChaud(sessionData, options)
      break
      
    case 'eval_froid':
      generateEvaluationFroid(sessionData, options)
      break
      
    case 'eval_formateur':
      generateEvaluationFormateur(sessionData, options)
      break
      
    case 'positionnement':
      // Générer un test par stagiaire
      if (trainees && trainees.length > 0) {
        trainees.forEach(trainee => {
          generatePositionnement({ ...sessionData, trainee }, options)
        })
      } else {
        throw new Error('Aucun stagiaire inscrit à cette session')
      }
      break
      
    case 'besoin':
      generateAnalyseBesoin(sessionData, options)
      break
      
    default:
      throw new Error(`Type de document inconnu: ${docType}`)
  }
}

// ============================================================================
// EXPORT GLOBAL
// ============================================================================
export default {
  generatePDF,
  generateConvention,
  generateProgramme,
  generateConvocation,
  generateEmargement,
  generateAttestationPresence,
  generateCertificat,
  generateEvaluationChaud,
  generateEvaluationFroid,
  generateEvaluationFormateur,
  generatePositionnement,
  generateAnalyseBesoin,
  generateBlankDocument
}
