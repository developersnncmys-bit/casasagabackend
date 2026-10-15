const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Slows down password guessing
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts — try again in 15 minutes' } });

router.post('/login', loginLimit, ctrl.login);
router.get('/me', protect, ctrl.me);
router.put('/password', protect, ctrl.changePassword);

module.exports = router;
