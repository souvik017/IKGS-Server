const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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

function drawTotals(doc, y, { totals, currency, paymentStatus, roundOff = 0 }) {
  const x = doc.page.width - 400;
  const labelWidth = 150;
  const valueWidth = 200;
  const rows = [
    ['Subtotal', formatCurrency(totals.subtotal, currency)],
    ['Discount', `- ${formatCurrency(totals.discount, currency)}`],
    ['Tax', formatCurrency(totals.tax, currency)],
  ];
  if (Number(roundOff)) rows.push(['Round Off', formatCurrency(roundOff, currency)]);

  doc.font('Helvetica').fontSize(9).fillColor('#374151');
  rows.forEach(([label, value]) => {
    doc.text(label, x, y, { width: labelWidth, align: 'right' });
    doc.text(value, x + labelWidth + 10, y, { width: valueWidth, align: 'right' });
    y += 16;
  });

  doc.rect(x - 6, y + 2, labelWidth + valueWidth + 22, 26).fill(BRAND);
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
    const width = doc.page.width;
    const left = 48;
    const right = width - 48;
    const usable = right - left;
    const defaultLogoPath = path.resolve(__dirname, '../../../Frontend/public/images/logo/logo.jpeg');
    const configuredLogoPath = settings?.logo && !/^https?:\/\//i.test(settings.logo)
      ? path.resolve(process.cwd(), settings.logo.replace(/^\//, ''))
      : null;
    const logoPath = configuredLogoPath && fs.existsSync(configuredLogoPath) ? configuredLogoPath : defaultLogoPath;
    let y;
    const pageCount = () => doc.bufferedPageRange().count;

    const header = (first = false) => {
      if (first) {
        doc.rect(0, 0, width, 148).fill('#0750B5');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(25).text(settings?.businessName || 'IKGS SOLUTION', left, 25, { width: 350 });
        doc.fillColor('#E7F06A').font('Helvetica-Bold').fontSize(10).text(settings?.tagline || 'Ultimate solution for pests and cleanliness', left, 57, { width: 360 });
        const businessLines = [settings?.address && `Regd. address: ${settings.address}`, settings?.phone && `Phone: ${settings.phone}${settings.altPhone ? ` / ${settings.altPhone}` : ''}`, settings?.email && `Email: ${settings.email}`].filter(Boolean);
        doc.fillColor('#FFFFFF').font('Helvetica').fontSize(9).text(businessLines.join('\n'), left, 81, { width: 350, lineGap: 2 });
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
        doc.text(settings?.tax?.number ? `GSTIN No: ${settings.tax.number}` : '', 390, 88, { width: 157, align: 'right' });
        doc.text(`Q No: ${quotation.quotationNumber}`, 405, 106, { width: 142, align: 'right' });
        doc.text(`DATE: ${formatDate(quotation.createdAt)}`, 405, 124, { width: 142, align: 'right' });
        if (fs.existsSync(logoPath)) {
          doc.roundedRect(width - 142, 20, 94, 48, 3).fill('#FFFFFF');
          doc.image(logoPath, width - 137, 24, { fit: [84, 40], align: 'center', valign: 'center' });
        }
        y = 174;
      } else {
        doc.addPage();
        doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(12).text(settings?.businessName || 'IKGS SOLUTION', left, 24);
        doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`Technical & Commercial Proposal · ${quotation.quotationNumber}`, left, 42);
        if (fs.existsSync(logoPath)) doc.image(logoPath, right - 82, 18, { fit: [82, 32], align: 'center', valign: 'center' });
        doc.moveTo(left, 60).lineTo(right, 60).strokeColor('#D1D5DB').stroke();
        y = 78;
      }
    };

    const ensure = (height) => { if (y + height > doc.page.height - 48) header(false); };
    const heading = (label) => {
      ensure(27);
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text(label, left, y, { width: usable });
      y = doc.y + 7;
    };
    const paragraph = (value, { bold = false, size = 9, indent = 0, after = 6 } = {}) => {
      const text = String(value || '').trim();
      if (!text) return;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor('#222222');
      const h = doc.heightOfString(text, { width: usable - indent, lineGap: 2 });
      ensure(h + after);
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor('#222222');
      doc.text(text, left + indent, y, { width: usable - indent, lineGap: 2 });
      y = doc.y + after;
    };
    const bulletList = (values, fallback) => {
      (values?.length ? values : fallback).forEach((entry) => paragraph(`•  ${entry}`, { indent: 8, after: 2 }));
      y += 4;
    };
    const customerAddress = quotation.customer?.address
      ? [quotation.customer.address.street, quotation.customer.address.city, quotation.customer.address.state, quotation.customer.address.zipCode].filter(Boolean).join(', ')
      : '';

    header(true);
    paragraph('TECHNICAL & COMMERCIAL PROPOSAL', { bold: true, size: 14, after: 2 });
    paragraph(quotation.subject || 'For Comprehensive Integrated Pest Management Services', { size: 11, after: 14 });
    paragraph('Submitted to', { after: 2 });
    paragraph(quotation.recipientName || quotation.customer?.name, { bold: true, after: 1 });
    if (quotation.recipientOrganization) paragraph(quotation.recipientOrganization, { bold: true, after: 1 });
    paragraph(quotation.recipientAddress || customerAddress, { after: 10 });
    paragraph('Subject', { after: 2 });
    paragraph(quotation.subject || 'Proposal for Integrated Pest Management (IPM) Services', { after: 9 });
    paragraph('Dear Sir/Madam,', { after: 7 });
    paragraph(quotation.introduction || `We are pleased to submit our technical and commercial proposal for ${quotation.subject || 'Integrated Pest Management services'}${quotation.recipientOrganization ? ` at ${quotation.recipientOrganization}` : ''}. IKGS SOLUTION provides professional pest management through planned treatments, routine inspections, preventive measures, and ongoing monitoring.`, { after: 10 });

    heading('Scope of Services');
    bulletList(quotation.scopeItems, ['Inspection, treatment, monitoring, and preventive pest control.', 'Cockroaches, ants, mosquitoes, flies, spiders, and other common crawling pests.', 'Preventive monitoring and risk assessment.']);
    header(false);
    heading('Treatment Areas');
    bulletList(quotation.treatmentAreas, ['School premises', 'Grounds and public areas', 'Administrative offices', 'Kitchen and canteen', 'Classrooms, laboratories, store rooms, corridors, utility areas, and waste collection points']);
    heading('Service Methodology');
    bulletList(quotation.methodology, ['Detailed site inspection before each treatment.', 'Use of approved professional-use products and safe application methods.', 'Preventive recommendations and follow-up response for reported issues.']);
    if (quotation.serviceFrequency) {
      heading('Service Frequency');
      paragraph(quotation.serviceFrequency, { after: 8 });
    }

    if (y + 220 > doc.page.height - 48) header(false);
    heading('Commercial Proposal');
    const drawProposalTableHeader = () => {
      const tableY = y;
      doc.rect(left, tableY, usable, 23).fill(LIGHT);
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9);
      doc.text('Description', left + 6, tableY + 7, { width: usable - 205 });
      doc.text('Amount', right - 115, tableY + 7, { width: 109, align: 'right' });
      y += 29;
    };
    drawProposalTableHeader();
    (quotation.items || []).forEach((item, index) => {
      const description = `${index + 1}. ${item.item}${item.description ? `\n${item.description}` : ''}`;
      doc.font('Helvetica').fontSize(8).fillColor('#222222');
      const descH = doc.heightOfString(description, { width: usable - 205 });
      if (y + Math.max(24, descH + 12) > doc.page.height - 48) {
        header(false);
        drawProposalTableHeader();
      }
      const rowStart = y;
      doc.text(description, left + 6, rowStart, { width: usable - 205 });
      doc.text(formatCurrency(item.lineTotal, currency), right - 115, rowStart, { width: 109, align: 'right' });
      y += Math.max(24, descH + 10);
      doc.moveTo(left, y).lineTo(right, y).strokeColor('#D1D5DB').stroke();
      y += 5;
    });
    doc.font('Helvetica').fontSize(8).fillColor('#222222');
    paragraph(`${settings?.tax?.label || 'GST'}: Included as applicable.`, { after: 4 });
    ensure(27);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text('Total Quotation Amount', left + 6, y, { width: usable - 130 });
    doc.text(formatCurrency(quotation.total, currency), right - 115, y, { width: 109, align: 'right' });
    y += 24;

    if (quotation.terms) {
      heading('Terms & Conditions');
      String(quotation.terms).split(/\r?\n/).filter(Boolean).forEach((term, index) => paragraph(/^\s*\d+[.)]/.test(term) ? term.trim() : `${index + 1}. ${term.trim()}`, { size: 8.5, after: 3 }));
    }
    if (quotation.notes) {
      heading('Additional Notes');
      paragraph(quotation.notes);
    }
    if (pageCount() === 2) header(false);
    heading('Our Commitment');
    paragraph(quotation.commitment || 'IKGS SOLUTION is committed to delivering reliable, safe, and effective pest management services through professional execution, timely response, and adherence to industry best practices. We appreciate the opportunity to submit this proposal and look forward to serving you.');
    paragraph(`We sincerely appreciate the opportunity to submit this proposal and look forward to serving ${quotation.recipientOrganization || quotation.recipientName || quotation.customer?.name || 'you'}.`);
    paragraph('Thank you for your consideration.');
    paragraph('Yours faithfully,', { after: 10 });
    paragraph(`For ${settings?.businessName || 'IKGS SOLUTION'}`, { bold: true, after: 3 });
    paragraph('Authorized Signatory', { after: 5 });
    paragraph([settings?.phone && `Contact: ${settings.phone}`, settings?.email && `Email: ${settings.email}`, settings?.siteUrl && `Website: ${settings.siteUrl}`].filter(Boolean).join('\n'), { size: 8, after: 0 });
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
      roundOff: invoice.roundOff,
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
    y = drawFooterText(doc, y, { heading: 'TERMS', text: invoice.terms });
    if (invoice.dueDate) {
      drawFooterText(doc, y, {
        heading: 'BANK DETAILS',
        text: `Bank: ${settings?.bankName || 'SBI'} · Branch: ${settings?.bankBranch || 'Kalyani'} · Account: ${settings?.bankAccount || '784512523690'} · IFSC: ${settings?.bankIfsc || 'SBIN0012'}`,
      });
    }
  });
}

module.exports = { generateQuotationPdf, generateInvoicePdf, formatCurrency };
