const crypto = require('crypto');
const { razorpay } = require('../config/env');
const ApiError = require('../helpers/ApiError');

/** True once the Razorpay keys are set — website bookings then need payment. */
const enabled = () => Boolean(razorpay.keyId && razorpay.keySecret);

/**
 * Creates a Razorpay order for an amount in rupees (sent to Razorpay in paise).
 * https://razorpay.com/docs/api/orders/create/
 */
async function createOrder({ amount, receipt, notes }) {
  let res;
  try {
    res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${razorpay.keyId}:${razorpay.keySecret}`).toString('base64'),
      },
      body: JSON.stringify({ amount: Math.round(amount * 100), currency: 'INR', receipt, notes }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(502, "Online payment isn't available right now — please try again in a minute");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[razorpay] order failed', res.status, data.error);
    throw new ApiError(502, "Online payment isn't available right now — please try again in a minute");
  }
  return data; // { id: "order_…", amount, currency, … }
}

// Constant-time comparison of two hex signatures
const same = (a, b) => {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const hmac = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex');

/** Checkout's success reply is genuine: HMAC-SHA256(order_id|payment_id, key secret). */
const verifyPayment = (orderId, paymentId, signature) => same(hmac(razorpay.keySecret, `${orderId}|${paymentId}`), signature);

/** A webhook really came from Razorpay: HMAC-SHA256(raw body, webhook secret). */
const verifyWebhook = (rawBody, signature) => Boolean(razorpay.webhookSecret) && same(hmac(razorpay.webhookSecret, rawBody), signature);

module.exports = { enabled, createOrder, verifyPayment, verifyWebhook, keyId: () => razorpay.keyId };
