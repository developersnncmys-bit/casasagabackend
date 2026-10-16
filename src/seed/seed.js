/**
 * Fills MongoDB from the website's content (casasagawebsite/components/data.js)
 * and creates the admin account.
 *
 *   npm run seed         — only fills empty collections; never touches bookings
 *   npm run seed:force   — replaces suites, add-ons, gallery, stories and settings with the website's
 */
require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { Admin, Suite, Addon, GalleryImage, Story, Setting } = require('../models');

const force = process.argv.includes('--force');
const websiteDir = path.resolve(__dirname, '..', '..', process.env.WEBSITE_DIR || '../../casasagawebsite');

async function loadWebsiteData() {
  const file = path.join(websiteDir, 'components', 'data.js');
  try {
    return await import(pathToFileURL(file).href);
  } catch (err) {
    throw new Error(`Could not read ${file} — set WEBSITE_DIR in .env (${err.message})`);
  }
}

async function fill(Model, label, rows) {
  const count = await Model.countDocuments();
  if (count && !force) return console.log(`  ${label}: ${count} already there — skipped`);
  if (force) await Model.deleteMany({});
  await Model.insertMany(rows);
  console.log(`  ${label}: ${rows.length} imported`);
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@casasaga.com').toLowerCase();
  if (await Admin.exists({ email })) return console.log(`  admin: ${email} already exists — password unchanged`);
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const password = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  await Admin.create({ name: 'CasaSaga Admin', email, password });
  console.log(`  admin: created ${email}${generated ? ` with password ${password}  ← save this, it is not shown again` : ''}`);
}

async function main() {
  await connectDB();
  const site = await loadWebsiteData();
  console.log(`Importing from ${websiteDir}${force ? ' (force)' : ''}`);

  await fill(Suite, 'suites', site.suites.map(({ id, ...s }, i) => ({ _id: id, size: '', guests: '', ...s, order: i + 1, active: true })));
  await fill(Addon, 'add-ons', site.addons.map(({ id, ...a }, i) => ({ _id: id, ...a, order: i + 1, active: true })));
  await fill(GalleryImage, 'gallery', site.gallery.map((g, i) => ({ ...g, order: i + 1 })));
  await fill(Story, 'stories', site.stories.map((s, i) => ({ ...s, order: i + 1, active: true })));

  const settings = await Setting.findOne({ key: 'site' });
  if (settings && settings.occasions?.length && !force) {
    console.log('  settings: already there — skipped');
  } else {
    await Setting.findOneAndUpdate(
      { key: 'site' },
      {
        key: 'site',
        contact: site.contact,
        policies: site.policies,
        occasions: site.occasions,
        values: site.values,
        galleryCategories: site.galleryCategories.filter((c) => c !== 'All'),
      },
      { upsert: true },
    );
    console.log('  settings: imported');
  }

  await seedAdmin();
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
