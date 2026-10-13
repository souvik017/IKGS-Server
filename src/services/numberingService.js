const { nextDocumentNumber } = require('../utils/ids');
const { getSettings } = require('./settingsService');

async function nextQuotationNumber() {
  const settings = await getSettings();
  return nextDocumentNumber(settings.quotationPrefix || 'QT');
}

async function nextInvoiceNumber() {
  const settings = await getSettings();
  return nextDocumentNumber(settings.invoicePrefix || 'INV');
}

module.exports = { nextQuotationNumber, nextInvoiceNumber };
