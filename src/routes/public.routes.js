const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/public.controller');

const router = express.Router();

// The website's booking form — no sign-in, so keep it from being flooded
const formLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests — please try again in a few minutes' } });

router.get('/content', ctrl.content);
router.get('/availability', ctrl.availability);
router.post('/bookings', formLimit, ctrl.createBooking);
// Online payment (Razorpay): Checkout's success reply, and Razorpay's own notification
router.post('/bookings/:ref/pay', formLimit, ctrl.confirmPayment);
router.post('/razorpay/webhook', ctrl.razorpayWebhook);

module.exports = router;
