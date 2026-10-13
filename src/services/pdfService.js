const PDFDocument = require('pdfkit');

const BRAND = '#2563EB';
const DARK = '#0D0B1B';
const MUTED = '#6B7280';
const LIGHT = '#F3F4F6';

const formatCurrency = (amount, currency = 'INR') =>
  `${currency === 'INR' ? 'Rs. ' : `${currency} `}${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Draw the shared header: brand block + document title/meta.
 */
function drawHeader(doc, { settings, title, metaLines }) {
  doc.rect(0, 0, doc.page.width, 104).fill(DARK);

  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(settings.businessName || 'IKGS Solution', 48, 30);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#C7CBD8')
    .text(settings.tagline || '', 48, 56)
    .text(
      [settings.address, settings.phone, settings.email].filter(Boolean).join('  |  '),
      48,
      70,
      { width: doc.page.width - 250 }
    );

  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(title, doc.page.width - 260, 30, { width: 212, align: 'right' });

  let y = 60;
  metaLines.forEach((line) => {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#C7CBD8')
      .text(line, doc.page.width - 260, y, { width: 212, align: 'right' });
    y += 14;
  });

  return 130;
}

function drawPartyBlock(doc, y, { heading, customer }) {
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text(heading, 48, y);
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text(customer?.name || '-', 48, y + 14);
  doc.font('Helvetica').fontSize(9).fillColor('#374151');
  let lineY = y + 30;
  const lines = [
    customer?.phone,
    customer?.email,
    customer?.address
      ? [customer.address.street, customer.address.city, customer.address.state, customer.address.zipCode]
          .filter(Boolean)
          .join(', ')
      : undefined,
  ].filter(Boolean);
  lines.forEach((line) => {
    doc.text(line, 48, lineY, { width: 240 });
    lineY += 13;
  });
  return lineY;
}

function drawItemsTable(doc, y, items, currency) {
  const columns = [
    { label: '#', x: 48, width: 24 },
    { label: 'Description', x: 72, width: 210 },
    { label: 'Qty', x: 288, width: 46, align: 'right' },
    { label: 'Unit Price', x: 338, width: 80, align: 'right' },
    { label: 'Discount', x: 420, width: 70, align: 'right' },
    { label: 'Line Total', x: 494, width: 90, align: 'right' },
  ];

  doc.rect(48, y, doc.page.width - 96, 22).fill(LIGHT);
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9);
  columns.forEach((c) =>
    doc.text(c.label, c.x + 4, y + 7, { width: c.width - 8, align: c.align || 'left' })
  );
  y += 30;

  doc.font('Helvetica').fontSize(9).fillColor('#374151');
  items.forEach((item, index) => {
    const rowHeight = 20;
    if (y > doc.page.height - 220) {
      doc.addPage();
      y = 48;
    }
    const values = [
      String(index + 1),
      item.item,
      String(item.quantity),
      formatCurrency(item.unitPrice, currency),
      formatCurrency(item.discount || 0, currency),
      formatCurrency(item.lineTotal || 0, currency),
    ];
    columns.forEach((c, i) =>
      doc.text(values[i], c.x + 4, y, { width: c.width - 8, align: c.align || 'left' })
    );
    y += rowHeight;
  });

  doc.moveTo(48, y).lineTo(doc.page.width - 48, y).strokeColor('#E5E7EB').stroke();
  return y + 14;
}

function drawTotals(doc, y, { totals, currency, paymentStatus }) {
  const x = doc.page.width - 280;
  const labelWidth = 140;
  const valueWidth = 90;
  const rows = [
    ['Subtotal', formatCurrency(totals.subtotal, currency)],
    ['Discount', `- ${formatCurrency(totals.discount, currency)}`],
    ['Tax', formatCurrency(totals.tax, currency)],
  ];

  doc.font('Helvetica').fontSize(9).fillColor('#374151');
  rows.forEach(([label, value]) => {
    doc.text(label, x, y, { width: labelWidth, align: 'right' });
    doc.text(value, x + labelWidth + 10, y, { width: valueWidth, align: 'right' });
    y += 16;
  });

  doc.rect(x - 6, y + 2, labelWidth + valueWidth + 12, 26).fill(BRAND);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11);
  doc.text('Grand Total', x, y + 9, { width: labelWidth, align: 'right' });
  doc.text(formatCurrency(totals.total, currency), x + labelWidth + 10, y + 9, {
    width: valueWidth,
    align: 'right',
  });
  y += 40;

  if (paymentStatus) {
    doc
      .fillColor(MUTED)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(`Payment Status: ${String(paymentStatus).replace('-', ' ').toUpperCase()}`, x, y, {
        width: labelWidth + valueWidth,
        align: 'right',
      });
    y += 16;
  }
  return y;
}

function drawFooterText(doc, y, { heading, text }) {
  if (!text) return y;
  if (y > doc.page.height - 140) {
    doc.addPage();
    y = 48;
  }
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text(heading, 48, y);
  doc.fillColor('#374151').font('Helvetica').fontSize(9).text(text, 48, y + 14, {
    width: doc.page.width - 96,
  });
  return y + 60;
}

function renderPdf(build) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      build(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Quotation PDF. Totals are read from the stored quotation, never recomputed.
 */
function generateQuotationPdf(quotation, { settings }) {
  const currency = quotation.currency || 'INR';
  return renderPdf((doc) => {
    let y = drawHeader(doc, {
      settings,
      title: 'QUOTATION',
      metaLines: [
        `Quotation No: ${quotation.quotationNumber}`,
        `Date: ${formatDate(quotation.createdAt)}`,
        `Valid Until: ${formatDate(quotation.validUntil)}`,
        `Status: ${quotation.status}`,
      ],
    });

    y = drawPartyBlock(doc, y, { heading: 'BILL TO', customer: quotation.customer });
    y = Math.max(y, 210);
    y = drawItemsTable(doc, y, quotation.items, currency);
    y = drawTotals(doc, y, {
      totals: {
        subtotal: quotation.subtotal,
        discount: quotation.discount,
        tax: quotation.tax,
        total: quotation.total,
      },
      currency,
    });
    drawFooterText(doc, y, {
      heading: 'TERMS & CONDITIONS',
      text: quotation.terms,
    });
  });
}

/**
 * Invoice PDF. Supports appointment-based and general/monthly invoices and
 * always renders persisted totals.
 */
function generateInvoicePdf(invoice, { settings }) {
  const currency = invoice.currency || 'INR';
  return renderPdf((doc) => {
    const metaLines = [
      `Invoice No: ${invoice.invoiceNumber}`,
      `Date: ${formatDate(invoice.createdAt)}`,
    ];
    if (invoice.appointment?.appointmentId) {
      metaLines.push(`Appointment: ${invoice.appointment.appointmentId}`);
    }
    if (invoice.billingPeriod) {
      metaLines.push(`Billing Period: ${invoice.billingPeriod}`);
    }
    if (invoice.dueDate) {
      metaLines.push(`Due Date: ${formatDate(invoice.dueDate)}`);
    }

    let y = drawHeader(doc, { settings, title: 'INVOICE', metaLines });

    y = drawPartyBlock(doc, y, { heading: 'BILL TO', customer: invoice.customer });
    y = Math.max(y, 220);
    y = drawItemsTable(doc, y, invoice.items, currency);
    y = drawTotals(doc, y, {
      totals: {
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        tax: invoice.tax,
        total: invoice.total,
      },
      currency,
      paymentStatus: invoice.paymentStatus,
    });

    if (invoice.paymentStatus !== 'paid') {
      y = drawFooterText(doc, y, {
        heading: 'PAYMENT DETAILS',
        text: `Amount Paid: ${formatCurrency(invoice.amountPaid, currency)}    Balance Due: ${formatCurrency(
          invoice.balanceDue,
          currency
        )}`,
      });
    }
    drawFooterText(doc, y, { heading: 'TERMS', text: invoice.terms });
  });
}

module.exports = { generateQuotationPdf, generateInvoicePdf, formatCurrency };
