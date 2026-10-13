/**
 * Safe, idempotent database seed.
 *
 * - Never deletes existing data.
 * - Reads admin credentials from environment variables (never hardcoded).
 * - Creates the initial admin only when one does not already exist.
 * - Seeds the initial service catalogue and site settings only when empty.
 *
 * Usage:  npm run seed
 * For a destructive development reset, use:  npm run reset
 */
require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const Admin = require('../models/Admin');
const Service = require('../models/Service');
const SiteSettings = require('../models/SiteSettings');

const INITIAL_SERVICES = [
  {
    title: 'Cockroach Control',
    shortDescription: 'Targeted gel and spray treatment to eliminate cockroach infestations.',
    description:
      'A professional cockroach control service covering kitchens, drains and harbourage points, using approved gel bait and residual treatment with a follow-up visit.',
    displayOrder: 1,
    featured: true,
  },
  {
    title: 'Termite Control',
    shortDescription: 'Pre and post-construction anti-termite treatment.',
    description:
      'Chemical soil treatment and drilling-based post-construction termite treatment to protect buildings and wooden structures.',
    displayOrder: 2,
    featured: true,
  },
  {
    title: 'Rodent Control',
    shortDescription: 'Baiting and exclusion to control rats and mice.',
    description:
      'Rodent survey, safe baiting stations and exclusion work to reduce rodent activity in homes and commercial premises.',
    displayOrder: 3,
    featured: true,
  },
  {
    title: 'Mosquito Control',
    shortDescription: 'Fogging and larvicidal treatment for mosquito reduction.',
    description:
      'Fogging and larvicidal treatment aimed at breeding sites to reduce mosquito populations in residential and commercial properties.',
    displayOrder: 4,
  },
  {
    title: 'Bed Bug Control',
    shortDescription: 'Multi-stage treatment for bed bug infestations.',
    description:
      'Inspection and multi-stage treatment of mattresses, furniture and crevices to eliminate bed bugs with a scheduled follow-up.',
    displayOrder: 5,
  },
  {
    title: 'Commercial Pest Control',
    shortDescription: 'Contract pest management for businesses and institutions.',
    description:
      'Scheduled pest management programmes for restaurants, hotels, offices, warehouses and institutions including documentation.',
    displayOrder: 6,
    featured: true,
  },
  {
    title: 'Wood Borer Treatment',
    shortDescription: 'Injectable treatment for wood borer damage.',
    description:
      'Injectable and surface treatment for wooden furniture and fittings affected by wood borer infestation.',
    displayOrder: 7,
  },
  {
    title: 'Sanitization & Disinfection',
    shortDescription: 'Surface disinfection and hygiene treatment.',
    description:
      'Surface disinfection and hygiene services for homes, offices and commercial premises.',
    displayOrder: 8,
  },
];

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

async function seedAdmin() {
  const email = (config.seed.adminEmail || '').toLowerCase();
  const password = config.seed.adminPassword;

  if (!email || !password) {
    console.warn(
      '! Skipping admin seed: set ADMIN_EMAIL and ADMIN_PASSWORD environment variables. ' +
        'No admin credentials are ever stored in source control.'
    );
    return;
  }
  if (password.length < 8) {
    console.warn('! Skipping admin seed: ADMIN_PASSWORD must be at least 8 characters.');
    return;
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log(`= Admin already exists: ${email} (left unchanged)`);
    return;
  }

  await Admin.create({
    name: config.seed.adminName,
    email,
    passwordHash: await Admin.hashPassword(password),
    role: 'super_admin',
  });
  console.log(`+ Created initial admin: ${email}`);
}

async function seedServices() {
  let created = 0;
  for (const service of INITIAL_SERVICES) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await Service.findOne({ slug: slugify(service.title) });
    if (exists) continue;
    // eslint-disable-next-line no-await-in-loop
    await Service.create({
      ...service,
      slug: slugify(service.title),
      seoTitle: `${service.title} in West Bengal | IKGS Solution`,
      seoDescription: service.shortDescription,
    });
    created += 1;
  }
  console.log(created ? `+ Created ${created} service(s)` : '= Services already seeded');
}

async function seedSettings() {
  const existing = await SiteSettings.findOne();
  if (existing) {
    console.log('= Site settings already exist (left unchanged)');
    return;
  }
  await SiteSettings.create({
    businessName: 'IKGS Solution',
    tagline: 'Cleaner Spaces, Healthier Tomorrow.',
    siteUrl: process.env.SITE_URL || 'http://localhost:5173',
    serviceAreas: (process.env.SERVICE_AREAS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  });
  console.log('+ Created default site settings');
}

async function run() {
  await connectDB();
  try {
    await seedAdmin();
    await seedServices();
    await seedSettings();
    console.log('\nSeed complete.');
  } finally {
    await disconnectDB();
    await mongoose.connection.close().catch(() => {});
  }
}

run().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
