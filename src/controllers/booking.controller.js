const Booking = require('../models/Booking');
const Counter = require('../models/Counter');
const Setting = require('../models/Setting');
const ApiError = require('../helpers/ApiError');
const catchAsync = require('../helpers/catchAsync');
const { crud } = require('../helpers/crud');
const { prepare, assertAvailable, availability, stampStatus } = require('../services/booking.service');

// Fields only the server sets
const SERVER_ONLY = ['invoiceNo', 'invoiceDate', 'suiteName', 'nights', 'roomTotal', 'extraGuests', 'extraGuestRate', 'extraGuestTotal', 'addonTotal', 'addonTaxAmount', 'taxAmount', 'total', 'online',
  // online payment — only Razorpay's confirmation changes these
  'paymentStatus', 'holdUntil', 'razorpayOrderId', 'razorpayPaymentId', 'paidAt'];

const base = crud(Booking, {
  name: 'Booking',
  sort: { createdAt: -1 },
  beforeCreate: (data) => ({ status: 'confirmed', source: 'phone', ...data }),
  beforeSave: async (data, req, doc) => {
    const sent = { ...data };
    if (!doc) SERVER_ONLY.forEach((k) => delete sent[k]);
    else SERVER_ONLY.forEach((k) => (sent[k] = doc[k]));
    const next = stampStatus(await prepare(sent, doc), doc?.status);
    await assertAvailable(next, doc?._id);
    return { ...next, guests: Number(next.guests) || 2 };
  },
});

exports.list = base.list;
exports.getOne = base.getOne;
exports.create = base.create;
exports.update = base.update;
exports.remove = base.remove;

/** GET /api/bookings/availability?checkIn=&checkOut=&exclude= — rooms free per suite, hidden suites included. */
exports.availability = catchAsync(async (req, res) => {
  const { checkIn, checkOut, exclude } = req.query;
  const rows = await availability(checkIn, checkOut, { excludeId: exclude || undefined, includeHidden: true });
  res.json({ success: true, data: rows });
});

/** Moves a booking along: confirm → check in → check out, or cancel. */
const TRANSITIONS = {
  confirm: { from: ['pending'], to: 'confirmed' },
  'check-in': { from: ['pending', 'confirmed'], to: 'checked-in' },
  'check-out': { from: ['checked-in'], to: 'completed' },
  cancel: { from: ['pending', 'confirmed'], to: 'cancelled' },
  reopen: { from: ['cancelled'], to: 'pending' },
};

exports.transition = catchAsync(async (req, res) => {
  const step = TRANSITIONS[req.params.action];
  if (!step) throw ApiError.notFound('Unknown action');
  const doc = await Booking.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Booking not found');
  if (!step.from.includes(doc.status)) throw ApiError.conflict(`A ${doc.status} booking can't be moved to ${step.to}`);

  const next = stampStatus({ ...doc.toObject(), status: step.to }, doc.status);
  // Re-opening a cancelled stay needs the room to still be free
  await assertAvailable(next, doc._id);
  ['status', 'confirmedAt', 'checkedInAt', 'checkedOutAt', 'cancelledAt'].forEach((k) => next[k] !== undefined && doc.set(k, next[k]));
  // Paying in full at check-out is common — record it when asked
  if (req.params.action === 'check-out' && req.body?.settle) {
    doc.amountPaid = doc.total;
    if (req.body.paymentMode) doc.paymentMode = req.body.paymentMode;
  }
  await doc.save();
  res.json({ success: true, data: doc });
});

/** POST /api/bookings/:id/invoice — gives the booking an invoice number (once) and returns what the PDF needs. */
exports.invoice = catchAsync(async (req, res) => {
  const doc = await Booking.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Booking not found');
  if (doc.status === 'cancelled') throw ApiError.conflict("A cancelled booking can't be invoiced");

  const settings = await Setting.get();
  if (!doc.invoiceNo) {
    const now = new Date();
    const year = now.getFullYear();
    const seq = await Counter.next(`invoice-${year}`);
    doc.invoiceNo = `${settings.invoice?.prefix || 'CS'}-${year}-${String(seq).padStart(4, '0')}`;
    doc.invoiceDate = now;
    await doc.save();
  }
  res.json({ success: true, data: { booking: doc, settings } });
});
