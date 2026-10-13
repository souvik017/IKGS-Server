const SiteSettings = require('../models/SiteSettings');

/**
 * Retrieve the single settings document, creating defaults on first access.
 */
async function getSettings() {
  let settings = await SiteSettings.findOne();
  if (!settings) {
    settings = await SiteSettings.create({});
  }
  return settings;
}

/** Fields safe to expose on the public website. */
function toPublicSettings(settings) {
  const s = settings.toObject();
  return {
    businessName: s.businessName,
    tagline: s.tagline,
    description: s.description,
    phone: s.phone,
    altPhone: s.altPhone,
    email: s.email,
    whatsapp: s.whatsapp,
    address: s.address,
    businessHours: s.businessHours,
    googleMapsUrl: s.googleMapsUrl,
    facebook: s.facebook,
    instagram: s.instagram,
    linkedin: s.linkedin,
    youtube: s.youtube,
    logo: s.logo,
    favicon: s.favicon,
    serviceAreas: s.serviceAreas,
    siteUrl: s.siteUrl,
    defaultSeoTitle: s.defaultSeoTitle,
    defaultSeoDescription: s.defaultSeoDescription,
    // Tax information is public-safe (used to render invoice labels on the site).
    tax: { enabled: s.tax?.enabled, label: s.tax?.label, rate: s.tax?.rate },
  };
}

module.exports = { getSettings, toPublicSettings };
