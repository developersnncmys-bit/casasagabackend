const express = require('express');
const ctrl = require('../controllers/setting.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);
router.route('/').get(ctrl.get).put(ctrl.update);

module.exports = router;
