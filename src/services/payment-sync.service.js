const { Booking } = require('../models');
const payments = require('./razorpay.service');
const { sendBookingConfirmation } = require('./mail.service');

// Today in India, YYYY-MM-DD
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/**
 * Marks a booking paid in full and confirmed (once — repeat calls change nothing), then emails the
 * confirmation unless `email` is false.
 */
async function markPaid(booking, paymentId, { email = true } = {}) {
  if (booking.paymentStatus === 'paid') return booking;
  booking.paymentStatus = 'paid';
  booking.razorpayPaymentId = paymentId;
  booking.paidAt = new Date();
  booking.amountPaid = booking.onlineAmount || booking.total; // ₹1 for a test booking
  booking.paymentMode = 'razorpay';
  booking.holdUntil = undefined;
  if (booking.status === 'pending' || booking.status === 'cancelled') {
    booking.status = 'confirmed';
    booking.confirmedAt = booking.confirmedAt || new Date();
    booking.cancelledAt = undefined;
  }
  await booking.save();
  // The stay is confirmed now that it's paid — email the confirmation (once)
  if (email && !booking.confirmationEmailAt) await sendBookingConfirmation(booking);
  return booking;
}

/**
 * Asks Razorpay whether a booking still waiting for payment was in fact paid — the guest's phone
 * can lose the page while they pay in their UPI app, so Checkout's reply never arrives. Only a
 * payment that is "captured", on this booking's own order, for the full amount counts.
 * Resolves to true when the booking was marked paid.
 */
async function syncPayment(booking) {
  if (!booking?.razorpayOrderId || booking.paymentStatus === 'paid' || !payments.enabled()) return false;
  const list = await payments.fetchOrderPayments(booking.razorpayOrderId);
  if (!list) return false;
  const expected = Math.round((booking.onlineAmount || booking.total) * 100);
  const paid = list.find((p) => p.status === 'captured' && p.order_id === booking.razorpayOrderId && p.amount === expected);
  if (!paid) return false;
  // A stay that is already over is marked paid quietly; otherwise the guest gets the confirmation
  await markPaid(booking, paid.id, { email: booking.checkIn >= todayIST() });
  console.log(`[payments] ${booking.ref} paid in Razorpay (${paid.id}) — marked confirmed`);
  return true;
}

/** Checks every booking still waiting for payment (made in the last `days` days, or all). */
async function syncAwaiting({ days } = {}) {
  if (!payments.enabled()) return 0;
  const query = { paymentStatus: 'awaiting', razorpayOrderId: { $nin: ['', null] } };
  if (days) query.createdAt = { $gte: new Date(Date.now() - days * 86400000) };
  let fixed = 0;
  for (const booking of await Booking.find(query)) {
    try {
      if (await syncPayment(booking)) fixed++;
    } catch (err) {
      console.error('[payments] check failed', booking.ref, err.message);
    }
  }
  return fixed;
}

/**
 * On the server (pm2): check every waiting booking once at start, then the last few days' every
 * few minutes — so a paid booking is confirmed even when neither Checkout's reply nor a webhook arrives.
 */
const EVERY_MINUTES = 3;
function startPaymentSync() {
  if (!payments.enabled()) return;
  setTimeout(() => syncAwaiting().catch(() => {}), 10000);
  setInterval(() => syncAwaiting({ days: 3 }).catch(() => {}), EVERY_MINUTES * 60000).unref();
}

module.exports = { markPaid, syncPayment, syncAwaiting, startPaymentSync };
