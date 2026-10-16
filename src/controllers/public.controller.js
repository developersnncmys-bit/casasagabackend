const { Suite, Addon, GalleryImage, Story, Booking, Setting } = require('../models');
const ApiError = require('../helpers/ApiError');
const catchAsync = require('../helpers/catchAsync');
const { prepare, assertAvailable, availability, stampStatus } = require('../services/booking.service');
const { WEBSITE_SOURCES } = require('../config/constants');

const str = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const strip = ({ active, order, createdAt, updatedAt, ...rest }) => rest;
const plain = (docs) => docs.map((d) => strip(d.toJSON()));

/**
 * GET /api/public/content — everything the website shows, in the same shape as
 * casasagawebsite/components/data.js. Hidden items are left out.
 */
exports.content = catchAsync(async (req, res) => {
  const [settings, suites, addons, gallery, stories] = await Promise.all([
    Setting.get(),
    Suite.find({ active: true }).sort({ order: 1 }),
    Addon.find({ active: true }).sort({ order: 1 }),
    GalleryImage.find().sort({ order: 1 }),
    Story.find({ active: true }).sort({ order: 1 }),
  ]);
  const s = settings.toJSON();
  res.json({
    success: true,
    data: {
      contact: s.contact,
      policies: s.policies,
      occasions: s.occasions,
      values: s.values,
      galleryCategories: ['All', ...(s.galleryCategories || [])],
      locations: s.locations || [],
      reels: s.reels || [],
      pricing: {
        taxRate: s.invoice?.taxRate || 0,
        addonTaxRate: s.invoice?.addonTaxRate ?? 18,
        convenienceFee: s.invoice?.convenienceFee || 0,
        convenienceFeeType: s.invoice?.convenienceFeeType || 'fixed',
      },
      suites: plain(suites),
      addons: plain(addons),
      gallery: plain(gallery).map(({ id, ...g }) => g),
      stories: plain(stories).map(({ id, ...st }) => st),
    },
  });
});

/** POST /api/public/bookings — the website's booking form. The stay is confirmed straight away. */
exports.createBooking = catchAsync(async (req, res) => {
  const b = req.body || {};
  const suite = await Suite.findOne({ _id: str(b.suite, 60), active: true });
  if (!suite) throw ApiError.badRequest('Choose a suite');

  const data = await prepare({
    suite: suite._id,
    checkIn: str(b.checkIn, 10),
    checkOut: str(b.checkOut, 10),
    guests: Math.min(Math.max(Number(b.guests) || 2, 1), 10),
    addons: Array.isArray(b.addons) ? b.addons.map((a) => str(a, 60)) : [],
    name: str(b.name, 120),
    phone: str(b.phone, 30),
    email: str(b.email, 160),
    occasion: str(b.occasion, 80),
    notes: str(b.notes),
    status: 'confirmed',
    online: true,
    // e.g. "instagram" when the guest followed a link from Instagram
    source: WEBSITE_SOURCES.includes(str(b.source, 20)) ? str(b.source, 20) : 'website',
  });
  Object.assign(data, stampStatus(data, null));
  // Another guest may have taken the last room since the form loaded
  await assertAvailable(data);
  // Keep the reference the guest already saw in WhatsApp, if it looks like one of ours
  if (/^CS[A-Z0-9]{4,10}$/.test(str(b.ref, 12)) && !(await Booking.exists({ ref: b.ref }))) data.ref = b.ref;

  const booking = await Booking.create(data);
  // What the guest's confirmation screen shows — no internal fields
  const { ref, suiteName, checkIn, checkOut, nights, guests, addonItems, rate, roomTotal, addonTotal, convenienceFee, discount, taxRate, addonTaxAmount, taxAmount, total, status } = booking.toJSON();
  res.status(201).json({
    success: true,
    data: { ref, suiteName, checkIn, checkOut, nights, guests, addonItems, rate, roomTotal, addonTotal, convenienceFee, discount, taxRate, addonTaxAmount, taxAmount, total, status },
  });
});

/**
 * GET /api/public/availability?checkIn=&checkOut= — which suites still have a room for
 * every night of the stay. Only ids and counts; no guest details.
 */
exports.availability = catchAsync(async (req, res) => {
  const rows = await availability(str(req.query.checkIn, 10), str(req.query.checkOut, 10));
  res.json({ success: true, data: rows.map(({ id, available, free }) => ({ id, available, free })) });
});
