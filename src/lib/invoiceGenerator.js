import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'

// ============================================================
// CONSTANTES ACCESS FORMATION
// ============================================================
const ORG = {
  name: 'Access Formation',
  address1: '24 Rue Kerbleiz',
  address2: '29900 Concarneau',
  country: 'France',
  phone: '02 46 56 57 54',
  email: 'contact@accessformation.pro',
  siret: '943 563 866 00012',
  naf: '8559A',
  tva: 'FR71943563866',
  rcs: '943 563 866 R.C.S. Quimper',
  nda: '53 29 10261 29',
  capital: '2 500',
  bank: 'Credit Mutuel de Bretagne - COMPTE CHEQUES 1',
  bic: 'CMBRFR2BXXX',
  iban: 'FR76 1558 9297 0600 0890 6894 048',
}

const CONTACTS = {
  'Hicham Saidi': {
    name: 'Hicham Saidi',
    phone: '02 46 56 57 54',
    email: 'hicham.saidi@accessformation.pro'
  },
  'Maxime Langlais': {
    name: 'Maxime Langlais',
    phone: '02 46 56 57 54',
    email: 'maxime.langlais@accessformation.pro'
  },
}

// ============================================================
// LAYOUT
// ============================================================
var ML = 18
var MR = 192
var FOOTER_Y = 271

// ============================================================
// FORMAT HELPERS
// ============================================================
function fd(d) {
  if (!d) return ''
  return format(new Date(d), 'dd/MM/yyyy')
}

function fm(v) {
  var n = Math.abs(parseFloat(v) || 0).toFixed(2).split('.')
  n[0] = n[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return n.join(',')
}

function fe(v) {
  return (parseFloat(v) < 0 ? '-' : '') + fm(v) + ' EUR'
}

// ============================================================
// LOGO
// ============================================================
var logoCache = null

async function loadLogo() {
  if (logoCache) return logoCache
  try {
    var r = await fetch('/assets/logo-access.png')
    var b = await r.blob()
    return new Promise(function (res) {
      var rd = new FileReader()
      rd.onload = function () {
        logoCache = rd.result
        res(logoCache)
      }
      rd.readAsDataURL(b)
    })
  } catch (e) {
    return null
  }
}

// ============================================================
// FOOTER
// ============================================================
function addFooter(doc, f, p, t) {
  var cx = 105
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(ML, FOOTER_Y, MR, FOOTER_Y)
  doc.setFont(f, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(120, 120, 120)
  doc.text('Access Formation - 24 Rue Kerbleiz - 29900 Concarneau - France', cx, 275, { align: 'center' })
  doc.text("Declaration d'activite enregistree sous le numero 53 29 10261 29 aupres du prefet de la region Bretagne", cx, 279, { align: 'center' })
  doc.text('SARL au capital de 2.500 EUR - Siret : 943 563 866 00012 - Naf : 8559A - TVA : FR71943563866 - RCS 943 563 866 R.C.S. Quimper', cx, 283, { align: 'center' })
  doc.text('Tel : 02 46 56 57 54 - Email : contact@accessformation.pro', cx, 287, { align: 'center' })
  doc.setFont(f, 'bold')
  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  doc.text('Page ' + p + ' / ' + t, MR, 291, { align: 'right' })
  doc.setTextColor(0, 0, 0)
}

// ============================================================
// CALCULS PARTAGES
// ============================================================
export function calcInvoiceTotals(items, discountPercent, tvaApplicable) {
  var subtotalHt = items.reduce(function (s, it) {
    return s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price_ht) || 0)
  }, 0)

  var dp = parseFloat(discountPercent) || 0
  var da = subtotalHt * dp / 100
  var netHt = subtotalHt - da

  var tvaByRate = {}
  items.forEach(function (it) {
    var rate = parseFloat(it.tva_rate) || 20
    var lht = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price_ht) || 0)
    if (!tvaByRate[rate]) tvaByRate[rate] = { base: 0, tva: 0 }
    tvaByRate[rate].base += lht
  })

  if (dp > 0) {
    Object.keys(tvaByRate).forEach(function (r) {
      tvaByRate[r].base -= tvaByRate[r].base * dp / 100
    })
  }

  var totalTva = 0
  if (tvaApplicable !== false) {
    Object.keys(tvaByRate).forEach(function (r) {
      tvaByRate[r].tva = tvaByRate[r].base * parseFloat(r) / 100
      totalTva += tvaByRate[r].tva
    })
  }

  return {
    subtotalHt: subtotalHt,
    discountAmt: da,
    netHt: netHt,
    totalTva: totalTva,
    totalTtc: netHt + totalTva,
    tvaByRate: tvaByRate
  }
}

// ============================================================
// GENERATION PDF FACTURE / AVOIR
// ============================================================
export async function generateInvoicePDF(invoice, items, client, contact, options) {
  contact = contact || null
  options = options || {}
  var isCredit = invoice.type === 'credit_note'
  var doc = new jsPDF()
  var F = 'helvetica'
  var cb = CONTACTS[invoice.created_by] || CONTACTS['Hicham Saidi']
  var logo = await loadLogo()
  var y = 12

  // --- LOGO ---
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', ML, y, 52, 13)
    } catch (e) {
      doc.setFontSize(14)
      doc.setFont(F, 'bold')
      doc.setTextColor(233, 180, 76)
      doc.text('ACCESS FORMATION', ML, y + 14)
      doc.setTextColor(0, 0, 0)
    }
  }

  // --- REFERENCE ---
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(11)
  doc.setFont(F, 'bold')
  doc.text((isCredit ? 'Avoir ' : 'Facture ') + invoice.reference, MR, y + 5, { align: 'right' })

  doc.setFont(F, 'normal')
  doc.setFontSize(8)
  var ry = y + 10

  if (invoice.parent_reference) {
    doc.text('Document parent ' + invoice.parent_reference, MR, ry, { align: 'right' })
    ry += 4
  }

  doc.setFontSize(9)
  doc.text('En date du : ' + fd(invoice.invoice_date), MR, ry, { align: 'right' })
  ry += 5

  if (invoice.client_reference) {
    doc.text('Ref. client : ' + invoice.client_reference, MR, ry, { align: 'right' })
    ry += 5
  }

  if (invoice.session_reference) {
    doc.text('Session : ' + invoice.session_reference, MR, ry, { align: 'right' })
  }

  // --- EMETTEUR ---
  y = 40
  doc.setFontSize(9)
  doc.setFont(F, 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(ORG.address1, ML, y)
  doc.text(ORG.address2, ML, y + 5)
  doc.text(ORG.country, ML, y + 10)
  doc.setTextColor(0, 0, 0)
  doc.setFont(F, 'bold')
  doc.text('Votre contact : ' + cb.name, ML, y + 18)
  doc.setFont(F, 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('Tel : ' + cb.phone, ML, y + 23)

  // --- CLIENT ---
  var billingClient = options.billingClient || null
  var displayClient = billingClient || client  // OPCO si subrogation, sinon client normal
  var cX = 118
  var cy = y
  doc.setFontSize(10)
  doc.setFont(F, 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(displayClient?.name || '', cX, cy)
  cy += 6

  doc.setFont(F, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)

  if (!billingClient && contact) {
    var cn = contact.name || ((contact.first_name || '') + ' ' + (contact.last_name || '')).trim()
    if (cn) {
      doc.text("A l'attention de " + (contact.civilite ? contact.civilite + ' ' : '') + cn, cX, cy)
      cy += 5
    }
  }

  if (displayClient?.address) {
    doc.text(displayClient.address, cX, cy)
    cy += 5
  }

  var cl = [displayClient?.postal_code, (displayClient?.city || '').toUpperCase()].filter(Boolean).join(' ')
  if (cl) {
    doc.text(cl, cX, cy)
    cy += 5
  }
  doc.text('France', cX, cy)
  cy += 5

  if (displayClient?.siret) {
    doc.setFontSize(8)
    doc.text('SIRET : ' + displayClient.siret, cX, cy)
    cy += 4
  }

  // Mention subrogation si OPCO
  if (billingClient && client) {
    cy += 3
    doc.setFontSize(8)
    doc.setFont(F, 'bold')
    doc.setTextColor(180, 120, 0)
    doc.text('Formation réalisée pour le compte de :', cX, cy)
    cy += 4
    doc.setFont(F, 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(client.name || '', cX, cy)
    if (client.siret) {
      cy += 4
      doc.text('SIRET : ' + client.siret, cX, cy)
    }
    doc.setTextColor(0, 0, 0)
  }

  // --- OBJET ---
  y = Math.max(82, cy + 4)
  if (invoice.object) {
    doc.setFontSize(9)
    doc.setFont(F, 'normal')
    doc.setTextColor(0, 0, 0)
    var ol = doc.splitTextToSize('Objet : ' + invoice.object, MR - ML)
    doc.text(ol, ML, y)
    y += ol.length * 4 + 4
  }

  // --- TABLE DES LIGNES ---
  var tb = items.map(function (it) {
    var q = parseFloat(it.quantity) || 0
    var pu = parseFloat(it.unit_price_ht) || 0
    var tv = parseFloat(it.tva_rate) || 20
    var lt = q * pu
    var ta = lt * tv / 100
    var desc = it.description_title || ''
    if (it.description_detail) desc += ' :\n' + it.description_detail
    return [
      it.code || '',
      desc,
      fm(q),
      fm(pu) + '\n' + (it.unit || 'unite'),
      fm(tv) + ' %\n(' + fm(ta) + ')',
      fm(lt)
    ]
  })

  doc.autoTable({
    startY: y,
    margin: { left: ML, right: 18 },
    head: [['Nom / Code', 'Description', 'Qte', 'PU HT', 'TVA', 'Total HT']],
    body: tb,
    theme: 'grid',
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [50, 50, 50],
      fontStyle: 'bold',
      fontSize: 8,
      font: F,
      lineWidth: 0.3,
      lineColor: [180, 180, 180],
      cellPadding: 3
    },
    bodyStyles: {
      fontSize: 8,
      font: F,
      cellPadding: 3,
      lineWidth: 0.2,
      lineColor: [200, 200, 200],
      textColor: [40, 40, 40],
      valign: 'top'
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'right', fontSize: 7 },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
    }
  })
  y = doc.lastAutoTable.finalY + 4

  // --- RECAPITULATIF TVA ---
  var totals = calcInvoiceTotals(items, invoice.discount_percent, invoice.tva_applicable)
  var tvaRates = Object.keys(totals.tvaByRate)

  if (tvaRates.length > 0 && invoice.tva_applicable !== false) {
    doc.setFontSize(7.5)
    doc.setFont(F, 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text("Recapitulatif de l'assiette de TVA :", ML, y)
    y += 3

    var tvb = tvaRates.map(function (r) {
      var e = totals.tvaByRate[r]
      return [fm(r) + ' %', fm(e.base) + ' EUR', fm(e.tva) + ' EUR']
    })

    doc.autoTable({
      startY: y,
      margin: { left: ML, right: 100 },
      head: [['TVA', 'Base', 'Montant TVA']],
      body: tvb,
      theme: 'grid',
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [50, 50, 50],
        fontStyle: 'bold',
        fontSize: 7,
        font: F,
        cellPadding: 2,
        lineWidth: 0.2,
        lineColor: [200, 200, 200]
      },
      bodyStyles: {
        fontSize: 7,
        font: F,
        cellPadding: 2,
        lineWidth: 0.2,
        lineColor: [200, 200, 200]
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { halign: 'right', cellWidth: 30 },
        2: { halign: 'right', cellWidth: 30 }
      }
    })
    y = doc.lastAutoTable.finalY + 4
  }

  // --- TOTAUX ---
  var hd = totals.discountAmt > 0
  var tr = []
  tr.push(['Montant total HT', fe(totals.subtotalHt)])

  if (hd) {
    tr.push(['Reduction HT (' + fm(invoice.discount_percent) + '%)', '-' + fe(totals.discountAmt)])
    tr.push(['Total net apres reduction', fe(totals.netHt)])
  }

  tr.push([
    { content: 'Total net HT', styles: { fontStyle: 'bold' } },
    { content: fe(totals.netHt), styles: { fontStyle: 'bold' } }
  ])

  if (invoice.tva_applicable !== false) {
    tvaRates.forEach(function (r) {
      tr.push(['TVA ' + fm(r) + '%', fe(totals.tvaByRate[r].tva)])
    })
  }

  tr.push([
    { content: 'Montant total TTC', styles: { fontStyle: 'bold', fontSize: 10 } },
    { content: fe(totals.totalTtc), styles: { fontStyle: 'bold', fontSize: 10 } }
  ])

  var ad = totals.totalTtc - (parseFloat(invoice.amount_paid) || 0)
  tr.push([
    { content: 'Total a regler', styles: { fontStyle: 'bold', fontSize: 10 } },
    { content: fe(ad), styles: { fontStyle: 'bold', fontSize: 10 } }
  ])

  doc.autoTable({
    startY: y,
    margin: { left: 108, right: 18 },
    body: tr,
    theme: 'plain',
    styles: {
      fontSize: 9,
      font: F,
      cellPadding: 1.5,
      textColor: [30, 30, 30]
    },
    columnStyles: {
      0: { halign: 'right' },
      1: { halign: 'right', cellWidth: 34 }
    }
  })
  y = doc.lastAutoTable.finalY + 5

  // --- Saut de page si besoin ---
  if (y > 215) {
    doc.addPage()
    y = 20
  }

  // --- CONDITIONS DE REGLEMENT ---
  doc.setFontSize(8)
  doc.setFont(F, 'normal')
  doc.setTextColor(60, 60, 60)

  if (invoice.service_start_date) {
    var sd = 'Dates de service : ' + fd(invoice.service_start_date)
    if (invoice.service_end_date) sd += ' - ' + fd(invoice.service_end_date)
    doc.text(sd, ML, y)
    y += 4
  }

  var cds = [
    ['Moyen de reglement :', invoice.payment_method || 'virement bancaire'],
    ['Delai de reglement :', invoice.payment_terms || 'a 30 jours'],
    ['Date limite de reglement :', fd(invoice.due_date)]
  ]

  for (var i = 0; i < cds.length; i++) {
    doc.text(cds[i][0], ML, y)
    doc.text(cds[i][1], ML + 45, y)
    y += 4
  }

  // Coordonnees bancaires
  y += 1
  doc.text('Banque :', ML, y)
  doc.text(ORG.bank, ML + 45, y)
  y += 3.5
  doc.text('BIC : ' + ORG.bic, ML + 45, y)
  y += 3
  doc.text('IBAN : ' + ORG.iban, ML + 45, y)
  y += 5

  // --- MENTIONS LEGALES ---
  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  var lw = MR - ML

  var l1 = "En cas de retard de paiement, des penalites seront exigibles au taux legal majore de 10 points, ainsi qu'une indemnite forfaitaire de 40 EUR pour frais de recouvrement (art. L441-10 du Code de commerce)."
  var ll = doc.splitTextToSize(l1, lw)
  doc.text(ll, ML, y)
  y += ll.length * 2.5 + 2

  if (invoice.tva_applicable !== false) {
    doc.text("TVA exigible d'apres les encaissements (article 269, 2-c du CGI).", ML, y)
  } else {
    doc.setFont(F, 'bold')
    doc.text("TVA non applicable conformement a l'article 261 du CGI.", ML, y)
  }

  // --- FOOTER SUR TOUTES LES PAGES ---
  var tp = doc.internal.getNumberOfPages()
  for (var p = 1; p <= tp; p++) {
    doc.setPage(p)
    addFooter(doc, F, p, tp)
  }

  if (!options.skipSave) {
    doc.save(invoice.reference + '.pdf')
  }

  return doc
}
