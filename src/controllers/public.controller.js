const { Suite, Addon, GalleryImage, Story, Booking, Setting } = require('../models');
const ApiError = require('../helpers/ApiError');
const catchAsync = require('../helpers/catchAsync');
const { prepare, assertAvailable, availability, stampStatus } = require('../services/booking.service');
const { WEBSITE_SOURCES, PAYMENT_HOLD_MINUTES } = require('../config/constants');
const payments = require('../services/razorpay.service');

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
      refundPolicy: s.refundPolicy,
      houseRules: s.houseRules,
      galleryCategories: ['All', ...(s.galleryCategories || [])],
      locations: s.locations || [],
      reels: s.reels || [],
      // Whether the booking form takes payment online (Razorpay)
      onlinePayment: payments.enabled(),
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

/**
 * POST /api/public/bookings — the website's booking form. Without Razorpay keys the stay is
 * confirmed straight away; with them it holds the room while the guest pays (see confirmPayment).
 */
exports.createBooking = catchAsync(async (req, res) => {
  const b = req.body || {};
  const suite = await Suite.findOne({ _id: str(b.suite, 60), active: true });
  if (!suite) throw ApiError.badRequest('Choose a suite');

  // Only add-ons offered at this suite's location (e.g. decorations at Banashankari 6th Stage only)
  const asked = Array.isArray(b.addons) ? b.addons.map((a) => str(a, 60)) : [];
  const offered = asked.length
    ? (await Addon.find({ _id: { $in: asked }, active: true }).select('locations'))
        .filter((a) => !a.locations?.length || a.locations.includes(suite.location))
        .map((a) => a._id)
    : [];

  const data = await prepare({
    suite: suite._id,
    checkIn: str(b.checkIn, 10),
    checkOut: str(b.checkOut, 10),
    guests: Math.min(Math.max(Math.round(Number(b.guests)) || 2, 1), 10),
    addons: offered,
    name: str(b.name, 120),
    phone: str(b.phone, 30),
    email: str(b.email, 160),
    occasion: str(b.occasion, 80),
    notes: str(b.notes),
    // With online payment the stay is confirmed once it's paid; until then it holds the room for a while
    status: payments.enabled() ? 'pending' : 'confirmed',
    online: true,
    // e.g. "instagram" when the guest followed a link from Instagram
    source: WEBSITE_SOURCES.includes(str(b.source, 20)) ? str(b.source, 20) : 'website',
  });
  Object.assign(data, stampStatus(data, null));
  // Another guest may have taken the last room since the form loaded
  await assertAvailable(data);
  // Keep the reference the guest already saw in WhatsApp, if it looks like one of ours
  if (/^CS[A-Z0-9]{4,10}$/.test(str(b.ref, 12)) && !(await Booking.exists({ ref: b.ref }))) data.ref = b.ref;

  if (!payments.enabled()) {
    const booking = await Booking.create(data);
    return res.status(201).json({ success: true, data: guestView(booking) });
  }

  // Online payment: hold the room, then ask Razorpay for an order the guest pays in Checkout
  data.paymentStatus = 'awaiting';
  data.holdUntil = new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60000);
  const booking = await Booking.create(data);
  try {
    const order = await payments.createOrder({ amount: booking.total, receipt: booking.ref, notes: { booking: booking.ref, suite: booking.suiteName } });
    booking.razorpayOrderId = order.id;
    await booking.save();
  } catch (err) {
    await booking.deleteOne(); // nothing to pay — don't keep the room held
    throw err;
  }
  res.status(201).json({ success: true, data: { ...guestView(booking), payment: checkoutFor(booking) } });
});

// What the guest's confirmation screen shows — no internal fields
function guestView(booking) {
  const { ref, suiteName, checkIn, checkOut, nights, guests, addonItems, rate, roomTotal, extraGuests, extraGuestRate, extraGuestTotal, addonTotal, convenienceFee, discount, taxRate, addonTaxAmount, taxAmount, total, amountPaid, status, paymentStatus } = booking.toJSON();
  return { ref, suiteName, checkIn, checkOut, nights, guests, addonItems, rate, roomTotal, extraGuests, extraGuestRate, extraGuestTotal, addonTotal, convenienceFee, discount, taxRate, addonTaxAmount, taxAmount, total, amountPaid, status, paymentStatus };
}

// What Razorpay Checkout needs to open for this booking
const checkoutFor = (booking) => ({
  keyId: payments.keyId(),
  orderId: booking.razorpayOrderId,
  amount: Math.round(booking.total * 100),
  currency: 'INR',
  holdUntil: booking.holdUntil,
  prefill: { name: booking.name, contact: booking.phone, email: booking.email || undefined },
});

/** Marks a booking paid in full and confirmed (once — repeat calls change nothing). */
async function markPaid(booking, paymentId) {
  if (booking.paymentStatus === 'paid') return booking;
  booking.paymentStatus = 'paid';
  booking.razorpayPaymentId = paymentId;
  booking.paidAt = new Date();
  booking.amountPaid = booking.total;
  booking.paymentMode = 'razorpay';
  booking.holdUntil = undefined;
  if (booking.status === 'pending' || booking.status === 'cancelled') {
    booking.status = 'confirmed';
    booking.confirmedAt = booking.confirmedAt || new Date();
    booking.cancelledAt = undefined;
  }
  return booking.save();
}

/**
 * POST /api/public/bookings/:ref/pay — Checkout's success reply
 * ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }). The signature proves it
 * came from Razorpay; the booking is then paid and confirmed.
 */
exports.confirmPayment = catchAsync(async (req, res) => {
  const b = req.body || {};
  const orderId = str(b.razorpay_order_id, 60);
  const paymentId = str(b.razorpay_payment_id, 60);
  const booking = orderId && (await Booking.findOne({ ref: str(req.params.ref, 20), razorpayOrderId: orderId }));
  if (!booking || !paymentId || !payments.verifyPayment(orderId, paymentId, str(b.razorpay_signature, 200))) {
    throw ApiError.badRequest("We couldn't verify this payment. If money was taken, call us with your booking reference");
  }
  await markPaid(booking, paymentId);
  res.json({ success: true, data: guestView(booking) });
});

/**
 * POST /api/public/razorpay/webhook — Razorpay tells us about payments directly, so a booking
 * is still confirmed if the guest closes the page right after paying.
 */
exports.razorpayWebhook = catchAsync(async (req, res) => {
  if (!payments.verifyWebhook(req.rawBody || '', req.get('x-razorpay-signature'))) throw ApiError.badRequest('Invalid signature');
  const event = req.body || {};
  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    const payment = event.payload?.payment?.entity || {};
    const orderId = payment.order_id || event.payload?.order?.entity?.id;
    const booking = orderId && (await Booking.findOne({ razorpayOrderId: orderId }));
    if (booking && payment.id) await markPaid(booking, payment.id);
  }
  res.json({ success: true });
});

/**
 * GET /api/public/availability?checkIn=&checkOut= — which suites still have a room for
 * every night of the stay. Only ids and counts; no guest details.
 */
exports.availability = catchAsync(async (req, res) => {
  const rows = await availability(str(req.query.checkIn, 10), str(req.query.checkOut, 10));
  res.json({ success: true, data: rows.map(({ id, available, free }) => ({ id, available, free })) });
});
