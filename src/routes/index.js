const express = require('express');
const { revalidateWebsite } = require('../middleware/revalidate');

const router = express.Router();

router.get('/health', (req, res) => res.json({ success: true, data: { ok: true, time: new Date().toISOString() } }));

// Website (no sign-in)
router.use('/public', require('./public.routes'));

// Admin panel (signed in)
router.use('/auth', require('./auth.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/bookings', require('./booking.routes'));
// Dates closed to bookings — refreshes the website so blocked nights show as unavailable
router.use('/blocks', revalidateWebsite, require('./block.routes'));
// Website content — every change refreshes the public site
router.use('/suites', revalidateWebsite, require('./suite.routes'));
router.use('/addons', revalidateWebsite, require('./addon.routes'));
router.use('/gallery', revalidateWebsite, require('./gallery.routes'));
router.use('/stories', revalidateWebsite, require('./story.routes'));
router.use('/settings', revalidateWebsite, require('./setting.routes'));
router.use('/uploads', require('./upload.routes'));

module.exports = router;
