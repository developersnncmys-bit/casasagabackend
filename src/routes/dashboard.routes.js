const express = require('express');
const ctrl = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.get('/', protect, ctrl.summary);

module.exports = router;
