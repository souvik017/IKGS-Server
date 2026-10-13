/**
 * Development gallery placeholders.
 *
 * Creates clearly-labelled placeholder graphics (not photographs) so the public
 * gallery can be built and reviewed before real company photographs are
 * uploaded. They are intentionally marked as placeholders and are only created
 * outside production.
 *
 * Replace them from the admin panel (Gallery) with genuine photographs.
 *
 * Usage:  npm run seed:gallery
 */
require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const GalleryImage = require('../models/GalleryImage');

/** Varied dimensions so the masonry layout looks realistic. */
const SPECS = [
  { title: 'Sample image 01', category: 'Field Work', w: 1200, h: 900, order: 1 },
  { title: 'Sample image 02', category: 'Equipment', w: 1000, h: 1250, order: 2 },
  { title: 'Sample image 03', category: 'Residential', w: 1200, h: 800, order: 3 },
  { title: 'Sample image 04', category: 'Commercial', w: 1000, h: 1000, order: 4 },
  { title: 'Sample image 05', category: 'Hygiene', w: 1200, h: 1000, order: 5 },
  { title: 'Sample image 06', category: 'Equipment', w: 1000, h: 1200, order: 6 },
  { title: 'Sample image 07', category: 'Field Work', w: 1200, h: 850, order: 7 },
  { title: 'Sample image 08', category: 'Commercial', w: 1000, h: 1300, order: 8 },
  { title: 'Sample image 09', category: 'Residential', w: 1200, h: 950, order: 9 },
];

const escapeXml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Branded placeholder graphic with a clear "placeholder" label.
 */
function buildSvg({ index, title, category, w, h }) {
  const label = `Placeholder ${String(index).padStart(2, '0')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3568F5"/>
      <stop offset="1" stop-color="#294EAD"/>
    </linearGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.6" fill="#ffffff" fill-opacity="0.16"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#dots)"/>
  <g fill="#ffffff" font-family="Manrope, Inter, Arial, sans-serif">
    <text x="60" y="${h / 2 - 10}" font-size="${Math.round(w / 12)}" font-weight="800" fill-opacity="0.95">${escapeXml(label)}</text>
    <text x="60" y="${h / 2 + Math.round(w / 22)}" font-size="${Math.round(w / 34)}" font-weight="600" fill-opacity="0.75">${escapeXml(category)}</text>
    <text x="60" y="${h - 56}" font-size="${Math.round(w / 44)}" font-weight="500" fill-opacity="0.6">Replace from the admin panel</text>
  </g>
  <rect x="60" y="52" width="${Math.round(w / 6)}" height="8" rx="4" fill="#DCE8FF" fill-opacity="0.9"/>
</svg>
`;
}

async function createGalleryPlaceholders({ force = false, log = console.log } = {}) {
  const existing = await GalleryImage.countDocuments();
  if (existing > 0 && !force) {
    log(`= Gallery already has ${existing} image(s) (left unchanged). Use --force to add placeholders anyway.`);
    return { created: 0, skipped: true };
  }

  const dir = path.join(process.cwd(), config.upload.localDir, 'gallery');
  await fs.mkdir(dir, { recursive: true });

  let created = 0;
  for (let i = 0; i < SPECS.length; i += 1) {
    const spec = SPECS[i];
    const filename = `placeholder-${String(i + 1).padStart(2, '0')}.svg`;
    const publicPath = `/uploads/gallery/${filename}`;

    // eslint-disable-next-line no-await-in-loop
    await fs.writeFile(
      path.join(dir, filename),
      buildSvg({ index: i + 1, title: spec.title, category: spec.category, w: spec.w, h: spec.h }),
      'utf8'
    );

    // eslint-disable-next-line no-await-in-loop
    const exists = await GalleryImage.findOne({ image: publicPath });
    if (exists) continue;

    // eslint-disable-next-line no-await-in-loop
    await GalleryImage.create({
      title: spec.title,
      alt: `Placeholder gallery image ${i + 1}`,
      caption: 'Development placeholder — replace with a real photograph from the admin panel.',
      image: publicPath,
      category: spec.category,
      displayOrder: spec.order,
      published: true,
    });
    created += 1;
  }

  log(`+ Created ${created} gallery placeholder image(s) in ${config.upload.localDir}/gallery`);
  return { created, skipped: false };
}

async function run() {
  if (config.isProduction) {
    console.error('Refusing to create placeholder gallery images while NODE_ENV=production.');
    process.exit(1);
  }
  await connectDB();
  try {
    await createGalleryPlaceholders({ force: process.argv.includes('--force') });
  } finally {
    await disconnectDB();
    await mongoose.connection.close().catch(() => {});
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Gallery placeholder seeding failed:', error);
    process.exit(1);
  });
}

module.exports = { createGalleryPlaceholders, SPECS };
