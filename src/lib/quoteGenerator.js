import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'

// ============================================================
// CONSTANTES ACCESS FORMATION
// ============================================================
const ORG = {
  name: 'Access Formation',
  address_line1: '24 Rue Kerbleiz',
  address_line2: '29900 Concarneau',
  country: 'France',
  phone: '02 46 56 57 54',
  email: 'contact@accessformation.pro',
  siret: '943 563 866 00012',
  naf: '8559A',
  tva: 'FR71943563866',
  rcs: '943 563 866 R.C.S. Quimper',
  nda: '53 29 10261 29',
  capital: '2.500',
  bank_name: 'Credit Mutuel de Bretagne - COMPTE CHEQUES 1',
  bic: 'CMBRFR2BXXX',
  iban: 'FR76 1558 9297 0600 0890 6894 048',
}

const CONTACTS = {
  'Hicham Saidi': { name: 'Hicham Saidi', phone: '02 46 56 57 54', email: null },
  'Maxime Langlais': { name: 'Maxime Langlais', phone: '02 46 56 57 54', email: 'maxime.langlais@accessformation.pro' },
}

// ============================================================
// FORMAT HELPERS
// jsPDF Helvetica renders ASCII space (0x20) as "/" in some
// contexts. Use PERIOD as thousands separator instead.
// 1175.00 => "1.175,00"  (standard French alternate format)
// ============================================================
function fmtDate(d) {
  if (!d) return ''
  return format(new Date(d), 'dd/MM/yyyy')
}

function fmtMoney(val) {
  const num = Math.abs(parseFloat(val) || 0)
  const fixed = num.toFixed(2)
  const parts = fixed.split('.')
  // Use period as thousands separator (jsPDF-safe)
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return parts.join(',')
}

function fmtEuro(val) {
  const prefix = parseFloat(val) < 0 ? '-' : ''
  return prefix + fmtMoney(val) + ' EUR'
}

// ============================================================
// LOAD LOGO
// ============================================================
let logoCache = null

async function loadLogo() {
  if (logoCache) return logoCache
  try {
    const resp = await fetch('/assets/logo-access.png')
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => { logoCache = reader.result; resolve(logoCache) }
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn('Logo load failed:', e)
    return null
  }
}

// ============================================================
// MAIN: GENERATE QUOTE PDF
// ============================================================
export async function generateQuotePDF(quote, items, client, contact = null) {
  const doc = new jsPDF()
  const pw = 210
  const ph = 297
  const mL = 18
  const mR = pw - 18

  const createdBy = CONTACTS[quote.created_by] || CONTACTS['Hicham Saidi']
  const logo = await loadLogo()

  let y = 12

  // ───────────────────────────────────────────────
  // LOGO top left
  // ───────────────────────────────────────────────
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', mL, y, 52, 20)
    } catch (e) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(233, 180, 76)
      doc.text('ACCESS FORMATION', mL, y + 14)
      doc.setTextColor(0, 0, 0)
    }
  }

  // ───────────────────────────────────────────────
  // REFERENCE top right
  // ───────────────────────────────────────────────
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Devis ' + quote.reference, mR, y + 5, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('En date du : ' + fmtDate(quote.quote_date), mR, y + 11, { align: 'right' })
  if (quote.client_reference) {
    doc.text('Ref. client : ' + quote.client_reference, mR, y + 17, { align: 'right' })
  }

  y = 40

  // ───────────────────────────────────────────────
  // SENDER (left column)
  // ───────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(ORG.address_line1, mL, y)
  doc.text(ORG.address_line2, mL, y + 5)
  doc.text(ORG.country, mL, y + 10)

  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('Votre contact : ' + createdBy.name, mL, y + 18)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('Tel : ' + createdBy.phone, mL, y + 23)
  if (createdBy.email) {
    doc.text('Email : ' + createdBy.email, mL, y + 28)
  }

  // ───────────────────────────────────────────────
  // CLIENT (right column)
  // ───────────────────────────────────────────────
  const cX = 118
  let cy = y
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(client?.name || '', cX, cy)
  cy += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  if (contact) {
    const civ = contact.civilite || ''
    const cName = contact.name || ((contact.first_name || '') + ' ' + (contact.last_name || '')).trim()
    if (cName) {
      doc.text("A l'attention de " + (civ ? civ + ' ' : '') + cName, cX, cy)
      cy += 5
    }
  }
  if (client?.address) { doc.text(client.address, cX, cy); cy += 5 }
  const cityLine = [client?.postal_code, (client?.city || '').toUpperCase()].filter(Boolean).join(' ')
  if (cityLine) { doc.text(cityLine, cX, cy); cy += 5 }
  doc.text('France', cX, cy)

  y = 82

  // ───────────────────────────────────────────────
  // OBJET
  // ───────────────────────────────────────────────
  if (quote.object) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text('Objet : ' + quote.object, mL, y)
    y += 8
  }

  // ───────────────────────────────────────────────
  // TABLE ITEMS
  // IMPORTANT: No didDrawCell / didParseCell to avoid
  // text superposition bugs
  // ───────────────────────────────────────────────
  const tableBody = items.map(item => {
    const qty = parseFloat(item.quantity) || 0
    const pu = parseFloat(item.unit_price_ht) || 0
    const tva = parseFloat(item.tva_rate) || 20
    const lineTotal = qty * pu
    const tvaAmt = lineTotal * tva / 100

    let desc = item.description_title || ''
    if (item.description_detail) {
      desc += ' :\n' + item.description_detail
    }

    return [
      item.code || '',
      desc,
      fmtMoney(qty),
      fmtMoney(pu) + '\n' + (item.unit || 'unite'),
      fmtMoney(tva) + ' %\n(' + fmtMoney(tvaAmt) + ')',
      fmtMoney(lineTotal)
    ]
  })

  doc.autoTable({
    startY: y,
    margin: { left: mL, right: 18 },
    head: [['Nom / Code', 'Description', 'Qte', 'PU HT', 'TVA', 'Total HT']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [50, 50, 50],
      fontStyle: 'bold',
      fontSize: 8,
      lineWidth: 0.3,
      lineColor: [180, 180, 180],
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
      lineWidth: 0.2,
      lineColor: [200, 200, 200],
      textColor: [40, 40, 40],
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'right', fontSize: 7 },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
  })

  y = doc.lastAutoTable.finalY + 6

  // ───────────────────────────────────────────────
  // TOTALS
  // ───────────────────────────────────────────────
  const hasDiscount = parseFloat(quote.discount_percent) > 0
  const subtotalHt = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price_ht) || 0), 0)
  const discountAmt = subtotalHt * (parseFloat(quote.discount_percent) || 0) / 100
  const totalHt = subtotalHt - discountAmt
  const totalTva = quote.tva_applicable !== false ? totalHt * (parseFloat(quote.tva_rate) || 20) / 100 : 0
  const totalTtc = totalHt + totalTva

  const totRows = []
  if (hasDiscount) {
    totRows.push(['Montant total HT', fmtEuro(subtotalHt)])
    totRows.push(['Reduction HT (' + fmtMoney(quote.discount_percent) + '%)', '-' + fmtEuro(discountAmt)])
  }
  totRows.push([
    { content: 'Total net HT', styles: { fontStyle: 'bold' } },
    { content: fmtEuro(totalHt), styles: { fontStyle: 'bold' } }
  ])
  if (quote.tva_applicable !== false) {
    totRows.push(['TVA ' + fmtMoney(quote.tva_rate || 20) + '%', fmtEuro(totalTva)])
  }
  totRows.push([
    { content: 'Montant total TTC', styles: { fontStyle: 'bold', fontSize: 10 } },
    { content: fmtEuro(totalTtc), styles: { fontStyle: 'bold', fontSize: 10 } }
  ])

  doc.autoTable({
    startY: y,
    margin: { left: 118, right: 18 },
    body: totRows,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2, textColor: [30, 30, 30] },
    columnStyles: {
      0: { halign: 'right' },
      1: { halign: 'right', cellWidth: 34 },
    },
  })

  y = doc.lastAutoTable.finalY + 8

  // ───────────────────────────────────────────────
  // NOTES
  // ───────────────────────────────────────────────
  if (quote.notes) {
    if (y > ph - 100) { addFooter(doc); doc.addPage(); y = 20 }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(80, 80, 80)
    doc.text('Note : ' + quote.notes, mL, y)
    doc.setTextColor(0, 0, 0)
    y += 8
  }

  // ───────────────────────────────────────────────
  // SIGNATURE BLOCK
  // ───────────────────────────────────────────────
  if (y > ph - 85) { addFooter(doc); doc.addPage(); y = 20 }

  const sigX = 110
  const sigW = mR - sigX

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 80, 130)
  doc.text("Signature du client precedee de la mention", sigX + sigW / 2, y, { align: 'center' })
  doc.text("'Lu et approuve, bon pour accord' :", sigX + sigW / 2, y + 5, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 9

  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.rect(sigX, y, sigW, 28)

  if (quote.signature_base64) {
    try {
      doc.addImage(quote.signature_base64, 'PNG', sigX + 3, y + 2, sigW - 6, 24)
    } catch (e) { /* ignore */ }
  }

  y += 34

  // ───────────────────────────────────────────────
  // PAYMENT CONDITIONS
  // ───────────────────────────────────────────────
  if (y > ph - 55) { addFooter(doc); doc.addPage(); y = 20 }

  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.setFont('helvetica', 'normal')

  const conds = [
    ['Date de validite :', fmtDate(quote.validity_date)],
    ['Moyen de reglement :', quote.payment_method || 'virement bancaire'],
    ['Delai de reglement :', quote.payment_terms || 'a 30 jours'],
    ['Date limite de reglement :', fmtDate(quote.payment_deadline)],
  ]
  conds.forEach(function(row) {
    doc.text(row[0], mL, y)
    doc.text(row[1], mL + 50, y)
    y += 5
  })

  y += 1
  doc.text('Banque :', mL, y)
  doc.text(ORG.bank_name, mL + 50, y)
  y += 5
  doc.text('BIC : ' + ORG.bic, mL + 50, y)
  y += 4
  doc.text('IBAN : ' + ORG.iban, mL + 50, y)
  y += 8

  // ───────────────────────────────────────────────
  // LEGAL MENTIONS
  // ───────────────────────────────────────────────
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  doc.text(
    "En cas de retard de paiement, des penalites seront exigibles au taux legal majore de 10 points, ainsi qu'une indemnite forfaitaire de 40 EUR",
    mL, y
  )
  y += 3.5
  doc.text("pour frais de recouvrement (art. L441-10 du Code de commerce).", mL, y)
  y += 5
  if (quote.tva_applicable !== false) {
    doc.text("TVA exigible d'apres les encaissements (article 269, 2-c du CGI).", mL, y)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.text("TVA non applicable conformement a l'article 261 du CGI.", mL, y)
  }

  // ───────────────────────────────────────────────
  // FOOTER on all pages
  // ───────────────────────────────────────────────
  var totalPages = doc.internal.getNumberOfPages()
  for (var i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addFooter(doc)
  }

  doc.save(quote.reference + '.pdf')
  return doc
}

// ============================================================
// FOOTER
// ============================================================
function addFooter(doc) {
  var cx = 105

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(18, 271, 192, 271)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(120, 120, 120)

  doc.text('Access Formation - 24 Rue Kerbleiz - 29900 Concarneau - France', cx, 275, { align: 'center' })
  doc.text("Declaration d'activite enregistree sous le numero 53 29 10261 29 aupres du prefet de la region Bretagne", cx, 279, { align: 'center' })
  doc.text('SARL au capital de 2.500 EUR - Siret : 943 563 866 00012 - Naf : 8559A - TVA : FR71943563866 - RCS 943 563 866 R.C.S. Quimper', cx, 283, { align: 'center' })
  doc.text('Tel : 02 46 56 57 54 - Email : contact@accessformation.pro', cx, 287, { align: 'center' })

  doc.setTextColor(0, 0, 0)
}
