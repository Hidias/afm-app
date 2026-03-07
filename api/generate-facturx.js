// api/generate-facturx.js
// Génère un PDF Factur-X (PDF/A-3b + XML CII EN16931) depuis une facture AFM
// Usage : POST { invoice_id, pdf_base64 }
// Retour : PDF/A-3 binaire (application/pdf)

import { getSupabaseAdmin } from './_lib/mailer.js'
import { generate } from '@stafyniaksacha/facturx'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 30,
}

// ─── Helpers ──────────────────────────────────────────────────

function ciiDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return (
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  )
}

function ciiAmt(v) {
  return (parseFloat(v) || 0).toFixed(2)
}

function cleanSiret(s) {
  return (s || '').replace(/\D/g, '')
}

function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function unitCode(unit) {
  const map = {
    jour: 'DAY',
    'jour(s)': 'DAY',
    heure: 'HUR',
    'heure(s)': 'HUR',
    h: 'HUR',
    mois: 'MON',
    forfait: 'C62',
    unite: 'C62',
    'unité': 'C62',
    pers: 'C62',
    personne: 'C62',
    stagiaire: 'C62',
  }
  return map[(unit || '').toLowerCase()] || 'C62'
}

// ─── Générateur XML CII (profil EN16931 / Factur-X COMFORT) ──

function generateCIIXML(invoice, items, client) {
  const isCredit = invoice.type === 'credit_note'
  const typeCode = isCredit ? '381' : '380'
  const tvaApplicable = invoice.tva_applicable !== false

  // Calculs HT
  const subtotalHt = items.reduce(
    (s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price_ht) || 0),
    0
  )
  const dp = parseFloat(invoice.discount_percent) || 0
  const discountAmt = subtotalHt * dp / 100
  const netHt = subtotalHt - discountAmt

  // TVA par taux
  const tvaByRate = {}
  items.forEach((it) => {
    const rate = parseFloat(it.tva_rate) || 20
    const lht =
      (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price_ht) || 0)
    if (!tvaByRate[rate]) tvaByRate[rate] = { base: 0, tva: 0 }
    tvaByRate[rate].base += lht
  })

  if (dp > 0) {
    Object.keys(tvaByRate).forEach((r) => {
      tvaByRate[r].base -= tvaByRate[r].base * dp / 100
    })
  }

  let totalTva = 0
  if (tvaApplicable) {
    Object.keys(tvaByRate).forEach((r) => {
      tvaByRate[r].tva = tvaByRate[r].base * parseFloat(r) / 100
      totalTva += tvaByRate[r].tva
    })
  }

  const totalTtc = netHt + totalTva
  const amountPaid = parseFloat(invoice.amount_paid) || 0
  const dueAmount = totalTtc - amountPaid

  // ── Lignes ────────────────────────────────────────────────
  const linesXml = items
    .map((it, idx) => {
      const q = parseFloat(it.quantity) || 0
      const pu = parseFloat(it.unit_price_ht) || 0
      const rate = parseFloat(it.tva_rate) || 20
      const lineTotal = q * pu
      const catCode = tvaApplicable ? 'S' : 'E'
      const rateVal = tvaApplicable ? rate : 0
      const name = esc(it.description_title || '')
      const detail = esc(it.description_detail || '')
      const fullName = detail ? `${name} - ${detail}` : name

      return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${fullName}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${ciiAmt(pu)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode(it.unit)}">${ciiAmt(q)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${catCode}</ram:CategoryCode>
          <ram:RateApplicablePercent>${rateVal}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${ciiAmt(lineTotal)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
    })
    .join('\n')

  // ── Blocs TVA ────────────────────────────────────────────
  const tvaBlocksXml = tvaApplicable
    ? Object.entries(tvaByRate)
        .map(
          ([rate, data]) => `    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${ciiAmt(data.tva)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      <ram:BasisAmount>${ciiAmt(data.base)}</ram:BasisAmount>
      <ram:CategoryCode>S</ram:CategoryCode>
      <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`
        )
        .join('\n')
    : `    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>0.00</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      <ram:ExemptionReasonCode>VATEX-EU-132-1-i</ram:ExemptionReasonCode>
      <ram:ExemptionReason>Formation professionnelle continue - article 261 du CGI</ram:ExemptionReason>
      <ram:BasisAmount>${ciiAmt(netHt)}</ram:BasisAmount>
      <ram:CategoryCode>E</ram:CategoryCode>
      <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`

  // ── Remise globale ───────────────────────────────────────
  const discountXml =
    discountAmt > 0
      ? `    <ram:SpecifiedTradeAllowanceCharge>
      <ram:ChargeIndicator>
        <udt:Indicator>false</udt:Indicator>
      </ram:ChargeIndicator>
      <ram:CalculationPercent>${dp}</ram:CalculationPercent>
      <ram:BasisAmount>${ciiAmt(subtotalHt)}</ram:BasisAmount>
      <ram:ActualAmount>${ciiAmt(discountAmt)}</ram:ActualAmount>
      <ram:CategoryTradeTax>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:CategoryCode>${tvaApplicable ? 'S' : 'E'}</ram:CategoryCode>
        <ram:RateApplicablePercent>${tvaApplicable ? Object.keys(tvaByRate)[0] || 20 : 0}</ram:RateApplicablePercent>
      </ram:CategoryTradeTax>
      <ram:Reason>Remise</ram:Reason>
    </ram:SpecifiedTradeAllowanceCharge>`
      : ''

  // ── Conditions de règlement ──────────────────────────────
  const dueDateXml = invoice.due_date
    ? `    <ram:SpecifiedTradePaymentTerms>
      <ram:DueDateDateTime>
        <udt:DateTimeString format="102">${ciiDate(invoice.due_date)}</udt:DateTimeString>
      </ram:DueDateDateTime>
    </ram:SpecifiedTradePaymentTerms>`
    : ''

  // ── Totaux ───────────────────────────────────────────────
  const prepaidXml =
    amountPaid > 0
      ? `      <ram:TotalPrepaidAmount>${ciiAmt(amountPaid)}</ram:TotalPrepaidAmount>`
      : ''

  const allowanceXml =
    discountAmt > 0
      ? `      <ram:AllowanceTotalAmount>${ciiAmt(discountAmt)}</ram:AllowanceTotalAmount>`
      : ''

  // ── Données client ───────────────────────────────────────
  const clientSiret = cleanSiret(client.siret)
  const clientSiren = client.siren || (clientSiret.length >= 9 ? clientSiret.substring(0,9) : '')
  const clientId = clientSiret || clientSiren
  const clientName = esc(client.name || '')
  const clientAddress = esc(client.address || '')
  const clientCity = esc((client.city || '').toUpperCase())
  const clientPostal = esc(client.postal_code || '')

  const buyerSiretXml = clientId
    ? `        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${clientId}</ram:ID>
        </ram:SpecifiedLegalOrganization>`
    : ''

  const buyerRefXml = invoice.client_reference
    ? `      <ram:BuyerOrderReferencedDocument>
        <ram:IssuerAssignedID>${esc(invoice.client_reference)}</ram:IssuerAssignedID>
      </ram:BuyerOrderReferencedDocument>`
    : ''

  const deliveryXml = invoice.service_start_date
    ? `    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${ciiDate(invoice.service_start_date)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>`
    : '    <ram:ApplicableHeaderTradeDelivery/>'

  const noteXml = invoice.notes
    ? `    <ram:IncludedNote>
      <ram:Content>${esc(invoice.notes)}</ram:Content>
    </ram:IncludedNote>`
    : ''

  return `<?xml version='1.0' encoding='UTF-8'?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>S</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${esc(invoice.reference)}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${ciiDate(invoice.invoice_date)}</udt:DateTimeString>
    </ram:IssueDateTime>
${noteXml}
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>

${linesXml}

    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>Access Formation</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">94356386600012</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:LineOne>24 Rue Kerbleiz</ram:LineOne>
          <ram:CityName>Concarneau</ram:CityName>
          <ram:PostcodeCode>29900</ram:PostcodeCode>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">FR71943563866</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${clientName}</ram:Name>
${buyerSiretXml}
        <ram:PostalTradeAddress>
          <ram:LineOne>${clientAddress}</ram:LineOne>
          <ram:CityName>${clientCity}</ram:CityName>
          <ram:PostcodeCode>${clientPostal}</ram:PostcodeCode>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
${buyerRefXml}
    </ram:ApplicableHeaderTradeAgreement>

${deliveryXml}

    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>${esc(invoice.reference)}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
${isCredit && invoice.parent_reference ? `      <ram:InvoiceReferencedDocument>\n        <ram:IssuerAssignedID>${esc(invoice.parent_reference)}</ram:IssuerAssignedID>\n      </ram:InvoiceReferencedDocument>` : ''}

${tvaBlocksXml}

${discountXml}

${dueDateXml}

      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${ciiAmt(subtotalHt)}</ram:LineTotalAmount>
${allowanceXml}
        <ram:TaxBasisTotalAmount>${ciiAmt(netHt)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${ciiAmt(totalTva)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${ciiAmt(totalTtc)}</ram:GrandTotalAmount>
${prepaidXml}
        <ram:DuePayableAmount>${ciiAmt(dueAmount > 0 ? dueAmount : totalTtc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}

// ─── Handler principal ────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { invoice_id, pdf_base64 } = req.body

    if (!invoice_id || !pdf_base64) {
      return res.status(400).json({ error: 'invoice_id et pdf_base64 requis' })
    }

    const supabase = getSupabaseAdmin()

    // 1. Récupérer la facture
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single()

    if (invErr || !invoice) {
      return res.status(404).json({ error: 'Facture introuvable' })
    }

    // 2. Récupérer les lignes
    const { data: items, error: itemsErr } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('position')

    if (itemsErr) {
      return res.status(500).json({ error: 'Erreur chargement lignes' })
    }

    // 3. Récupérer le client (billing_client_id en priorité si subrogation)
    const clientId = invoice.billing_client_id || invoice.client_id
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, address, postal_code, city, siret, siren')
      .eq('id', clientId)
      .single()

    if (clientErr || !client) {
      return res.status(404).json({ error: 'Client introuvable' })
    }

    // 4. Générer le XML CII
    const xmlString = generateCIIXML(invoice, items || [], client)

    // 5. Embarquer l'XML dans le PDF → PDF/A-3b Factur-X
    const pdfBuffer = Buffer.from(pdf_base64, 'base64')
    const xmlBuffer = Buffer.from(xmlString, 'utf-8')

    const facturxBuffer = await generate({
      pdf: pdfBuffer,
      xml: xmlBuffer,
      check: false, // désactiver validation XSD (pas besoin de libxml2-wasm)
      flavor: 'facturx',
      level: 'en16931',
      language: 'fr-FR',
      meta: {
        author: 'Access Formation',
        title: invoice.reference,
        subject: `${invoice.type === 'credit_note' ? 'Avoir' : 'Facture'} ${invoice.reference}`,
        keywords: ['facture', 'formation', 'access-formation'],
        date: new Date(invoice.invoice_date),
      },
    })

    // 6. Retourner le PDF/A-3
    const filename = `${invoice.reference}_facturx.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', facturxBuffer.length)
    return res.status(200).send(facturxBuffer)
  } catch (err) {
    console.error('[generate-facturx] Erreur :', err)
    return res.status(500).json({ error: err.message || 'Erreur interne' })
  }
}
