const { Suite, Addon, GalleryImage, Story, Booking, Enquiry, Setting } = require('../models');
const ApiError = require('../helpers/ApiError');
const catchAsync = require('../helpers/catchAsync');
const { prepare } = require('../services/booking.service');

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
      suites: plain(suites),
      addons: plain(addons),
      gallery: plain(gallery).map(({ id, ...g }) => g),
      stories: plain(stories).map(({ id, ...st }) => st),
    },
  });
});

/** POST /api/public/bookings — the website's booking form. Always arrives as a pending request. */
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
    status: 'pending',
    source: 'website',
  });
  // Keep the reference the guest already saw in WhatsApp, if it looks like one of ours
  if (/^CS[A-Z0-9]{4,10}$/.test(str(b.ref, 12)) && !(await Booking.exists({ ref: b.ref }))) data.ref = b.ref;

  const booking = await Booking.create(data);
  res.status(201).json({ success: true, data: { ref: booking.ref, total: booking.total } });
});

/** POST /api/public/enquiries — the website's contact form. */
exports.createEnquiry = catchAsync(async (req, res) => {
  const b = req.body || {};
  const enquiry = await Enquiry.create({
    name: str(b.name, 120),
    email: str(b.email, 160),
    phone: str(b.phone, 30),
    occasion: str(b.occasion, 80),
    message: str(b.message, 5000),
    status: 'new',
  });
  res.status(201).json({ success: true, data: { id: enquiry.id } });
});
