const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { getSettings } = require('../services/settingsService');

const EDITABLE_FIELDS = [
  'businessName',
  'tagline',
  'description',
  'phone',
  'altPhone',
  'email',
  'whatsapp',
  'address',
  'businessHours',
  'googleMapsUrl',
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'logo',
  'favicon',
  'serviceAreas',
  'siteUrl',
  'defaultSeoTitle',
  'defaultSeoDescription',
  'quotationPrefix',
  'invoicePrefix',
  'defaultQuotationValidityDays',
  'defaultTerms',
];

// @desc    Get site settings
// @route   GET /api/settings
// @access  Private
exports.get = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  return sendSuccess(res, { settings });
});

// @desc    Update site settings
// @route   PUT /api/settings
// @access  Private
exports.update = asyncHandler(async (req, res) => {
  const settings = await getSettings();

  EDITABLE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) settings[field] = req.body[field];
  });

  if (req.body.tax !== undefined) {
    settings.tax = {
      enabled: Boolean(req.body.tax.enabled),
      label: req.body.tax.label !== undefined ? req.body.tax.label : settings.tax.label,
      rate: req.body.tax.rate !== undefined ? Number(req.body.tax.rate) : settings.tax.rate,
      number: req.body.tax.number !== undefined ? req.body.tax.number : settings.tax.number,
    };
  }

  await settings.save();
  return sendSuccess(res, { settings });
});
