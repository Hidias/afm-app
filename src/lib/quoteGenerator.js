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
  capital: '2500',
  bank_name: 'Crédit Mutuel de Bretagne - COMPTE CHEQUES 1',
  bic: 'CMBRFR2BXXX',
  iban: 'FR7615589297060008906894048',
}

const CONTACTS = {
  'Hicham Saidi': { name: 'Hicham Saidi', phone: '02 46 56 57 54', email: null },
  'Maxime Langlais': { name: 'Maxime Langlais', phone: '02 46 56 57 54', email: 'maxime.langlais@accessformation.pro' },
}

// ============================================================
// FORMAT HELPERS
// ============================================================
function fmtDate(d) {
  if (!d) return ''
  return format(new Date(d), 'dd/MM/yyyy')
}

function fmtMoney(val) {
  const num = parseFloat(val) || 0
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtMoneyEuro(val) {
  return fmtMoney(val) + ' €'
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
  const pw = doc.internal.pageSize.getWidth() // 210
  const ph = doc.internal.pageSize.getHeight() // 297
  const marginL = 18
  const marginR = pw - 18
  const colMid = 108

  const createdBy = CONTACTS[quote.created_by] || CONTACTS['Hicham Saidi']

  // Load logo
  const logo = await loadLogo()

  // ═══════════════════════════════════════════════
  // PAGE HEADER - Logo + Ref
  // ═══════════════════════════════════════════════
  let y = 12

  // Logo top left
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', marginL, y, 55, 22)
    } catch (e) {
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('ACCESS', marginL, y + 10)
      doc.text('FORMATION', marginL, y + 18)
    }
  }

  // Reference block top right
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Devis ${quote.reference}`, marginR, y + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`En date du : ${fmtDate(quote.quote_date)}`, marginR, y + 10, { align: 'right' })
  if (quote.client_reference) {
    doc.text(`Réf. client : ${quote.client_reference}`, marginR, y + 16, { align: 'right' })
  }

  y = 40

  // ═══════════════════════════════════════════════
  // SENDER INFO (left) + CLIENT INFO (right)
  // ═══════════════════════════════════════════════
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(ORG.address_line1, marginL, y)
  doc.text(ORG.address_line2, marginL, y + 4)
  doc.text(ORG.country, marginL, y + 8)
  doc.setFont('helvetica', 'bold')
  doc.text(`Votre contact : ${createdBy.name}`, marginL, y + 14)
  doc.setFont('helvetica', 'normal')
  doc.text(`Tel : ${createdBy.phone}`, marginL, y + 18)
  if (createdBy.email) {
    doc.text(`Email : ${createdBy.email}`, marginL, y + 22)
  }

  // Client block right
  const clientX = colMid + 8
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(client?.name || '', clientX, y)
  
  doc.setFont('helvetica', 'normal')
  let cy = y + 5
  
  // Contact line
  if (contact) {
    const civilite = contact.civilite === 'M.' ? 'M' : contact.civilite === 'Mme' ? 'Mme' : ''
    const contactName = contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    if (contactName) {
      doc.text(`A l'attention de ${civilite ? civilite + ' ' : ''}${contactName}`, clientX, cy)
      cy += 4
    }
  }
  
  if (client?.address) { doc.text(client.address, clientX, cy); cy += 4 }
  const cityLine = [client?.postal_code, client?.city?.toUpperCase()].filter(Boolean).join(' ')
  if (cityLine) { doc.text(cityLine, clientX, cy); cy += 4 }
  doc.text('France', clientX, cy)

  y = Math.max(y + 28, cy + 8)

  // ═══════════════════════════════════════════════
  // OBJET
  // ═══════════════════════════════════════════════
  if (quote.object) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Objet : ${quote.object}`, marginL + 4, y)
    y += 8
  }

  // ═══════════════════════════════════════════════
  // TABLE - Lignes du devis
  // ═══════════════════════════════════════════════
  const tableBody = items.map(item => {
    const tvaAmount = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price_ht) || 0) * (parseFloat(item.tva_rate) || 20) / 100
    const desc = item.description_title 
      ? (item.description_title + (item.description_detail ? ' :\n' + item.description_detail : ''))
      : item.description_detail || ''
    
    return [
      item.code || '',
      desc,
      fmtMoney(item.quantity),
      fmtMoney(item.unit_price_ht) + '\n' + (item.unit || 'unité'),
      fmtMoney(item.tva_rate) + ' %\n(' + fmtMoney(tvaAmount) + ')',
      fmtMoney(item.total_ht || ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price_ht) || 0)))
    ]
  })

  doc.autoTable({
    startY: y,
    margin: { left: marginL, right: 18 },
    head: [['Nom / Code', 'Description', 'Qte', 'PU HT', 'TVA', 'Total HT']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [60, 60, 60],
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
      0: { cellWidth: 24 },
      1: { cellWidth: 'auto', fontStyle: 'normal' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 22, halign: 'right', fontSize: 7 },
      5: { cellWidth: 24, halign: 'right' },
    },
    didParseCell: function(data) {
      // Bold the title part of description
      if (data.column.index === 1 && data.section === 'body') {
        const text = data.cell.raw || ''
        const titleEnd = text.indexOf(' :\n')
        if (titleEnd > -1) {
          // We'll handle this with custom rendering
        }
      }
    },
    didDrawCell: function(data) {
      // Bold title in description column
      if (data.column.index === 1 && data.section === 'body') {
        const raw = items[data.row.index]
        if (raw && raw.description_title && raw.description_detail) {
          const x = data.cell.x + 3
          const cellY = data.cell.y + 5
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(40, 40, 40)
          const titleLines = doc.splitTextToSize(raw.description_title + ' :', data.cell.width - 6)
          doc.text(titleLines, x, cellY)
          
          const titleH = titleLines.length * 4
          doc.setFont('helvetica', 'normal')
          const detailLines = doc.splitTextToSize(raw.description_detail, data.cell.width - 6)
          doc.text(detailLines, x, cellY + titleH)
          
          // Clear original text by overwriting with white
          // Actually autoTable handles this, we just override
        }
      }
    },
  })

  y = doc.lastAutoTable.finalY + 4

  // ═══════════════════════════════════════════════
  // NOTES (if any)
  // ═══════════════════════════════════════════════
  if (quote.notes) {
    // Check if we need a new page
    if (y > ph - 120) { addQuoteFooter(doc); doc.addPage(); y = 20 }
    
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    const noteW = 75
    doc.rect(marginL, y, noteW, 18)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Notes :', marginL + 2, y + 5)
    doc.setFont('helvetica', 'bold')
    const noteLines = doc.splitTextToSize(quote.notes, noteW - 4)
    doc.text(noteLines, marginL + 2, y + 10)
    doc.setFont('helvetica', 'normal')
  }

  // ═══════════════════════════════════════════════
  // TOTALS (right side)
  // ═══════════════════════════════════════════════
  const totalsX = 128
  const totalsW = marginR - totalsX
  let ty = y

  const hasDiscount = parseFloat(quote.discount_percent) > 0
  const subtotalHt = items.reduce((sum, it) => sum + ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price_ht) || 0)), 0)
  const discountAmount = subtotalHt * (parseFloat(quote.discount_percent) || 0) / 100
  const totalHt = subtotalHt - discountAmount
  const totalTva = quote.tva_applicable !== false ? totalHt * (parseFloat(quote.tva_rate) || 20) / 100 : 0
  const totalTtc = totalHt + totalTva

  function totalLine(label, value, bold = false, rightAlign = true) {
    doc.setFontSize(8)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(label, marginR - 28, ty, { align: 'right' })
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(value, marginR, ty, { align: 'right' })
    ty += 5
  }

  if (hasDiscount) {
    totalLine('Montant total HT', fmtMoneyEuro(subtotalHt), true)
    totalLine(`Réduction HT (${fmtMoney(quote.discount_percent)}%)`, '-' + fmtMoneyEuro(discountAmount))
    totalLine('Total net après réduction', fmtMoneyEuro(totalHt))
    ty += 2
  }

  // Separator line
  doc.setDrawColor(180)
  doc.line(totalsX, ty - 2, marginR, ty - 2)

  totalLine('Total net HT', fmtMoneyEuro(totalHt), true)

  if (quote.tva_applicable !== false) {
    totalLine(`TVA ${fmtMoney(quote.tva_rate || 20)}%`, fmtMoneyEuro(totalTva))
  }

  // Bold separator before TTC
  doc.setDrawColor(100)
  doc.setLineWidth(0.5)
  doc.line(totalsX, ty - 2, marginR, ty - 2)
  doc.setLineWidth(0.2)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Montant total TTC', marginR - 28, ty + 1, { align: 'right' })
  doc.text(fmtMoneyEuro(totalTtc), marginR, ty + 1, { align: 'right' })
  ty += 8

  y = Math.max(y + (quote.notes ? 24 : 0), ty + 4)

  // ═══════════════════════════════════════════════
  // SIGNATURE BLOCK
  // ═══════════════════════════════════════════════
  if (y > ph - 90) { addQuoteFooter(doc); doc.addPage(); y = 20 }

  const sigX = colMid
  const sigW = marginR - sigX
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 80, 120)
  const sigText = "Signature du client précédée de la mention 'Lu et\napprouvé, bon pour accord' :"
  doc.text(sigText, sigX + sigW / 2, y + 4, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  // Signature box
  doc.setDrawColor(200)
  doc.setLineWidth(0.2)
  doc.rect(sigX, y + 12, sigW, 30)

  // If digital signature exists
  if (quote.signature_base64) {
    try {
      doc.addImage(quote.signature_base64, 'PNG', sigX + 5, y + 14, sigW - 10, 26)
    } catch (e) { /* ignore */ }
  }

  y += 50

  // ═══════════════════════════════════════════════
  // PAYMENT CONDITIONS
  // ═══════════════════════════════════════════════
  if (y > ph - 65) { addQuoteFooter(doc); doc.addPage(); y = 20 }

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const conditionsData = [
    ['Date de validité :', fmtDate(quote.validity_date)],
    ['Moyen de règlement :', quote.payment_method || 'virement bancaire'],
    ['Délai de règlement :', quote.payment_terms || 'à 30 jours'],
    ['Date limite de règlement :', fmtDate(quote.payment_deadline)],
  ]

  conditionsData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.text(label, marginL, y)
    doc.text(value, marginL + 48, y)
    y += 5
  })

  // Bank details
  doc.setFont('helvetica', 'normal')
  doc.text('Banque :', marginL, y)
  doc.text(ORG.bank_name, marginL + 48, y)
  y += 4
  doc.text(`BIC : ${ORG.bic}`, marginL + 48, y)
  y += 4
  doc.text(`IBAN : ${ORG.iban}`, marginL + 48, y)
  y += 8

  // ═══════════════════════════════════════════════
  // LEGAL MENTIONS
  // ═══════════════════════════════════════════════
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(
    "En cas de retard de paiement, des pénalités seront exigibles au taux légal majoré de 10 points, ainsi qu'une indemnité forfaitaire de 40 €",
    marginL, y
  )
  y += 3.5
  doc.text("pour frais de recouvrement (art. L441-10 du Code de commerce).", marginL, y)
  y += 5

  if (quote.tva_applicable !== false) {
    doc.text("TVA exigible d'après les encaissements (article 269, 2-c du CGI).", marginL, y)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.text("TVA non applicable conformément à l'article 261 du CGI", marginL, y)
    doc.setFont('helvetica', 'normal')
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
// FOOTER - Centered, matching Sellsy format exactly
// ============================================================
function addQuoteFooter(doc) {
  const ph = doc.internal.pageSize.getHeight()
  const pw = doc.internal.pageSize.getWidth()

  // Separator line
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(15, ph - 24, pw - 15, ph - 24)

  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)

  // Line 1: Name + Address
  doc.setFont('helvetica', 'bold')
  doc.text('Access Formation', pw / 2 - 0.5, ph - 20, { align: 'center' })
  // Append address in normal
  const line1 = `Access Formation - ${ORG.address_line1} - ${ORG.address_line2} - ${ORG.country}`
  doc.setFont('helvetica', 'normal')
  doc.text(line1, pw / 2, ph - 20, { align: 'center' })

  // Line 2: NDA
  doc.text(
    `Déclaration d'activité enregistrée sous le numéro ${ORG.nda} auprès du préfet de la région Bretagne`,
    pw / 2, ph - 16, { align: 'center' }
  )

  // Line 3: Legal info (SARL bold)
  const line3 = `SARL au capital de ${ORG.capital} € Siret : ${ORG.siret} - Naf : ${ORG.naf} - TVA : ${ORG.tva} - RCS ${ORG.rcs}`
  doc.setFont('helvetica', 'bold')
  doc.text('SARL', pw / 2 - doc.getTextWidth(line3) / 2, ph - 12)
  doc.setFont('helvetica', 'normal')
  doc.text(line3, pw / 2, ph - 12, { align: 'center' })

  // Line 4: Contact
  doc.text(`Tel : ${ORG.phone} - Email : ${ORG.email}`, pw / 2, ph - 8, { align: 'center' })

  doc.setTextColor(0, 0, 0)
}
