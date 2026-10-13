const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      default: 'IKGS Solution',
      trim: true,
    },
    tagline: {
      type: String,
      default: 'Cleaner Spaces, Healthier Tomorrow.',
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default:
        'IKGS Solution provides professional pest control and hygiene services across West Bengal.',
    },
    phone: { type: String, trim: true, default: '' },
    altPhone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    whatsapp: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    businessHours: { type: String, trim: true, default: '' },
    googleMapsUrl: { type: String, trim: true, default: '' },
    facebook: { type: String, trim: true, default: '' },
    instagram: { type: String, trim: true, default: '' },
    linkedin: { type: String, trim: true, default: '' },
    youtube: { type: String, trim: true, default: '' },
    logo: { type: String, default: '' },
    favicon: { type: String, default: '' },
    // Service coverage areas shown on the public site.
    serviceAreas: { type: [String], default: [] },
    // SEO defaults.
    siteUrl: { type: String, trim: true, default: 'http://localhost:5173' },
    defaultSeoTitle: { type: String, trim: true, default: '' },
    defaultSeoDescription: { type: String, trim: true, default: '' },
    // Financial configuration. Tax is never applied unless enabled here.
    tax: {
      enabled: { type: Boolean, default: false },
      label: { type: String, trim: true, default: 'GST' },
      rate: { type: Number, default: 0, min: 0, max: 100 },
      number: { type: String, trim: true, default: '' },
    },
    quotationPrefix: { type: String, trim: true, default: 'QT' },
    invoicePrefix: { type: String, trim: true, default: 'INV' },
    defaultQuotationValidityDays: { type: Number, default: 30, min: 1 },
    defaultTerms: {
      type: String,
      trim: true,
      default: 'Standard terms and conditions apply.',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
