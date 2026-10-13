/**
 * DESTRUCTIVE development-only database reset.
 *
 * This deletes all IKGS business data. It refuses to run in production and
 * requires an explicit --yes flag so it can never be triggered accidentally.
 *
 * Usage:  npm run reset -- --yes
 */
require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');

const MODELS = [
  'Admin',
  'Employee',
  'Customer',
  'Enquiry',
  'Booking',
  'Appointment',
  'Quotation',
  'Invoice',
  'InventoryItem',
  'InventoryTransaction',
  'AppointmentClosure',
  'Review',
  'GalleryImage',
  'Service',
  'SiteSettings',
  'Counter',
];

async function run() {
  if (config.isProduction) {
    console.error('Refusing to run a destructive reset while NODE_ENV=production.');
    process.exit(1);
  }
  if (!process.argv.includes('--yes')) {
    console.error('This deletes ALL IKGS data. Re-run with:  npm run reset -- --yes');
    process.exit(1);
  }

  await connectDB();
  try {
    for (const name of MODELS) {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const model = require(`../models/${name}`);
      // eslint-disable-next-line no-await-in-loop
      const result = await model.deleteMany({});
      console.log(`- ${name}: removed ${result.deletedCount} document(s)`);
    }
    console.log('\nReset complete. Run "npm run seed" to recreate baseline data.');
  } finally {
    await disconnectDB();
    await mongoose.connection.close().catch(() => {});
  }
}

run().catch((error) => {
  console.error('Reset failed:', error);
  process.exit(1);
});
