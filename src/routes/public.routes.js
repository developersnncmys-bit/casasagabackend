const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/public.controller');

const router = express.Router();

// The website's forms — no sign-in, so keep them from being flooded
const formLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests — please try again in a few minutes' } });

router.get('/content', ctrl.content);
router.get('/availability', ctrl.availability);
router.post('/bookings', formLimit, ctrl.createBooking);
router.post('/enquiries', formLimit, ctrl.createEnquiry);

module.exports = router;
