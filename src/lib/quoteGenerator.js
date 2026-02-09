import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

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
  capital: '2 500',
  bank_name: 'Crédit Mutuel de Bretagne - COMPTE CHEQUES 1',
  bic: 'CMBRFR2BXXX',
  iban: 'FR76 1558 9297 0600 0890 6894 048',
}

const CONTACTS = {
  'Hicham Saidi': { name: 'Hicham Saidi', phone: '02 46 56 57 54', email: null },
  'Maxime Langlais': { name: 'Maxime Langlais', phone: '02 46 56 57 54', email: 'maxime.langlais@accessformation.pro' },
}

// ============================================================
// FORMAT HELPERS - Fixed for jsPDF (no non-breaking spaces)
// ============================================================
function fmtDate(d) {
  if (!d) return ''
  return format(new Date(d), 'dd/MM/yyyy')
}

function fmtMoney(val) {
  const num = parseFloat(val) || 0
  // Use regular space, not non-breaking space (jsPDF renders it badly)
  const parts = num.toFixed(2).split('.')
  // Add thousand separator with regular space
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return parts.join(',')
}

function fmtEuro(val) {
  return fmtMoney(val) + ' \u20AC'
}

// ============================================================
// LOAD LOGO AS BASE64
// ============================================================
let logoBase64Cache = null

async function loadLogo() {
  if (logoBase64Cache) return logoBase64Cache
  try {
    const response = await fetch('/assets/logo-access.png')
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        logoBase64Cache = reader.result
        resolve(logoBase64Cache)
      }
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn('Logo loading failed:', e)
    return null
  }
}

// ============================================================
// GENERATE QUOTE PDF
// ============================================================
export async function generateQuotePDF(quote, items, client, contact = null) {
  const doc = new jsPDF()
  const pw = doc.internal.pageSize.getWidth()  // 210
  const ph = doc.internal.pageSize.getHeight() // 297
  const mL = 18
  const mR = pw - 18

  const createdBy = CONTACTS[quote.created_by] || CONTACTS['Hicham Saidi']
  const logo = await loadLogo()

  let y = 12

  // ═══════════════════════════════════════════════
  // LOGO (top left)
  // ═══════════════════════════════════════════════
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', mL, y, 52, 20)
    } catch (e) {
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(233, 180, 76)
      doc.text('ACCESS', mL, y + 10)
      doc.text('FORMATION', mL, y + 18)
      doc.setTextColor(0, 0, 0)
    }
  }

  // ═══════════════════════════════════════════════
  // REFERENCE (top right)
  // ═══════════════════════════════════════════════
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(`Devis ${quote.reference}`, mR, y + 5, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`En date du : ${fmtDate(quote.quote_date)}`, mR, y + 11, { align: 'right' })
  if (quote.client_reference) {
    doc.text(`Ref. client : ${quote.client_reference}`, mR, y + 17, { align: 'right' })
  }

  y = 40

  // ═══════════════════════════════════════════════
  // SENDER INFO (left)
  // ═══════════════════════════════════════════════
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(ORG.address_line1, mL, y)
  doc.text(ORG.address_line2, mL, y + 5)
  doc.text(ORG.country, mL, y + 10)
  y += 18
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(`Votre contact : ${createdBy.name}`, mL, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(`Tel : ${createdBy.phone}`, mL, y + 5)
  if (createdBy.email) {
    doc.text(`Email : ${createdBy.email}`, mL, y + 10)
  }

  // ═══════════════════════════════════════════════
  // CLIENT INFO (right)
  // ═══════════════════════════════════════════════
  const cX = 118
  let cy = 40
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
    const cName = contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    if (cName) {
      doc.text(`A l'attention de ${civ ? civ + ' ' : ''}${cName}`, cX, cy)
      cy += 5
    }
  }
  if (client?.address) { doc.text(client.address, cX, cy); cy += 5 }
  const cityLine = [client?.postal_code, (client?.city || '').toUpperCase()].filter(Boolean).join(' ')
  if (cityLine) { doc.text(cityLine, cX, cy); cy += 5 }
  doc.text('France', cX, cy)

  y = 82

  // ═══════════════════════════════════════════════
  // OBJET
  // ═══════════════════════════════════════════════
  if (quote.object) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(`Objet : ${quote.object}`, mL, y)
    y += 8
  }

  // ═══════════════════════════════════════════════
  // TABLE - Line items
  // ═══════════════════════════════════════════════
  const tableBody = items.map(item => {
    const qty = parseFloat(item.quantity) || 0
    const pu = parseFloat(item.unit_price_ht) || 0
    const tva = parseFloat(item.tva_rate) || 20
    const totalLine = qty * pu
    const tvaAmount = totalLine * tva / 100

    // Description: title bold on first line, detail below
    const title = item.description_title || ''
    const detail = item.description_detail || ''

    return [
      item.code || '',
      title + (detail ? '\n' + detail : ''),
      fmtMoney(qty),
      fmtMoney(pu) + '\n' + (item.unit || 'unite'),
      fmtMoney(tva) + ' %\n(' + fmtMoney(tvaAmount) + ')',
      fmtMoney(totalLine)
    ]
  })

  doc.autoTable({
    startY: y,
    margin: { left: mL, right: 18 },
    head: [['Nom / Code', 'Description', 'Qte', 'PU HT', 'TVA', 'Total HT']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [245, 245, 245],
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
      0: { cellWidth: 22, halign: 'left' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'right', fontSize: 7 },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    // Make title bold in description cells
    didParseCell: function(data) {
      if (data.column.index === 1 && data.section === 'body') {
        const raw = items[data.row.index]
        if (raw && raw.description_title) {
          // We'll use custom styles in didDrawCell
          data.cell.styles.fontSize = 8
        }
      }
    },
  })

  y = doc.lastAutoTable.finalY + 6

  // ═══════════════════════════════════════════════
  // TOTALS (right aligned)
  // ═══════════════════════════════════════════════
  const hasDiscount = parseFloat(quote.discount_percent) > 0
  const subtotalHt = items.reduce((sum, it) => sum + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price_ht) || 0)), 0)
  const discountAmount = subtotalHt * (parseFloat(quote.discount_percent) || 0) / 100
  const totalHt = subtotalHt - discountAmount
  const totalTva = quote.tva_applicable !== false ? totalHt * (parseFloat(quote.tva_rate) || 20) / 100 : 0
  const totalTtc = totalHt + totalTva

  // Use a small autoTable for totals (cleaner alignment)
  const totalsBody = []
  
  if (hasDiscount) {
    totalsBody.push([{ content: 'Montant total HT', styles: { fontStyle: 'normal' } }, fmtEuro(subtotalHt)])
    totalsBody.push([{ content: `Reduction HT (${fmtMoney(quote.discount_percent)}%)`, styles: { fontStyle: 'normal' } }, '-' + fmtEuro(discountAmount)])
  }
  
  totalsBody.push([{ content: 'Total net HT', styles: { fontStyle: 'bold' } }, { content: fmtEuro(totalHt), styles: { fontStyle: 'bold' } }])

  if (quote.tva_applicable !== false) {
    totalsBody.push([{ content: `TVA ${fmtMoney(quote.tva_rate || 20)}%`, styles: { fontStyle: 'normal' } }, fmtEuro(totalTva)])
  } else {
    totalsBody.push([{ content: 'TVA non applicable (art. 261 CGI)', colSpan: 2, styles: { fontStyle: 'italic', fontSize: 7 } }])
  }

  totalsBody.push([
    { content: 'Montant total TTC', styles: { fontStyle: 'bold', fontSize: 10 } },
    { content: fmtEuro(totalTtc), styles: { fontStyle: 'bold', fontSize: 10 } }
  ])

  doc.autoTable({
    startY: y,
    margin: { left: 120, right: 18 },
    body: totalsBody,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      textColor: [30, 30, 30],
    },
    columnStyles: {
      0: { halign: 'right', cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 32 },
    },
    didDrawCell: function(data) {
      // Draw line above TTC row
      if (data.row.index === totalsBody.length - 1 && data.column.index === 0) {
        doc.setDrawColor(80, 80, 80)
        doc.setLineWidth(0.5)
        doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width + 32, data.cell.y)
      }
    }
  })

  y = doc.lastAutoTable.finalY + 8

  // ═══════════════════════════════════════════════
  // NOTES (if any, left side)
  // ═══════════════════════════════════════════════
  if (quote.notes) {
    if (y > ph - 100) { addQuoteFooter(doc); doc.addPage(); y = 20 }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(80, 80, 80)
    doc.text('Note : ' + quote.notes, mL, y)
    doc.setTextColor(0, 0, 0)
    y += 8
  }

  // ═══════════════════════════════════════════════
  // SIGNATURE BLOCK
  // ═══════════════════════════════════════════════
  if (y > ph - 85) { addQuoteFooter(doc); doc.addPage(); y = 20 }

  const sigBoxX = 110
  const sigBoxW = mR - sigBoxX

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 80, 130)
  doc.text("Signature du client precedee de la mention", sigBoxX + sigBoxW / 2, y, { align: 'center' })
  y += 4.5
  doc.text("'Lu et approuve, bon pour accord' :", sigBoxX + sigBoxW / 2, y, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y += 4

  // Signature rectangle
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.rect(sigBoxX, y, sigBoxW, 28)

  // If digital signature exists
  if (quote.signature_base64) {
    try {
      doc.addImage(quote.signature_base64, 'PNG', sigBoxX + 3, y + 2, sigBoxW - 6, 24)
    } catch (e) { /* ignore */ }
  }

  y += 34

  // ═══════════════════════════════════════════════
  // PAYMENT CONDITIONS
  // ═══════════════════════════════════════════════
  if (y > ph - 55) { addQuoteFooter(doc); doc.addPage(); y = 20 }

  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)

  const conditions = [
    ['Date de validite :', fmtDate(quote.validity_date)],
    ['Moyen de reglement :', quote.payment_method || 'virement bancaire'],
    ['Delai de reglement :', quote.payment_terms || 'a 30 jours'],
    ['Date limite de reglement :', fmtDate(quote.payment_deadline)],
  ]

  conditions.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.text(label, mL, y)
    doc.text(value, mL + 50, y)
    y += 5
  })

  // Bank details
  y += 1
  doc.text('Banque :', mL, y)
  doc.text(ORG.bank_name, mL + 50, y)
  y += 5
  doc.text('', mL, y)
  doc.text(`BIC : ${ORG.bic}`, mL + 50, y)
  y += 4
  doc.text('', mL, y)
  doc.text(`IBAN : ${ORG.iban}`, mL + 50, y)
  y += 8

  // ═══════════════════════════════════════════════
  // LEGAL MENTIONS (penalties + TVA)
  // ═══════════════════════════════════════════════
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(
    "En cas de retard de paiement, des penalites seront exigibles au taux legal majore de 10 points, ainsi qu'une indemnite forfaitaire de 40 \u20AC",
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

  // ═══════════════════════════════════════════════
  // FOOTER (all pages)
  // ═══════════════════════════════════════════════
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    addQuoteFooter(doc)
  }

  // Save
  doc.save(`${quote.reference}.pdf`)
  return doc
}

// ============================================================
// FOOTER - 4 lines centered
// ============================================================
function addQuoteFooter(doc) {
  const ph = doc.internal.pageSize.getHeight()
  const pw = doc.internal.pageSize.getWidth()

  // Separator
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(18, ph - 26, pw - 18, ph - 26)

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)

  // Line 1
  doc.text(
    `${ORG.name} - ${ORG.address_line1} - ${ORG.address_line2} - ${ORG.country}`,
    pw / 2, ph - 22, { align: 'center' }
  )

  // Line 2
  doc.text(
    `Declaration d'activite enregistree sous le numero ${ORG.nda} aupres du prefet de la region Bretagne`,
    pw / 2, ph - 18, { align: 'center' }
  )

  // Line 3
  doc.text(
    `SARL au capital de ${ORG.capital} \u20AC - Siret : ${ORG.siret} - Naf : ${ORG.naf} - TVA : ${ORG.tva} - RCS ${ORG.rcs}`,
    pw / 2, ph - 14, { align: 'center' }
  )

  // Line 4
  doc.text(
    `Tel : ${ORG.phone} - Email : ${ORG.email}`,
    pw / 2, ph - 10, { align: 'center' }
  )

  doc.setTextColor(0, 0, 0)
}
