const express = require('express');
const ctrl = require('../controllers/upload.controller');
const { protect } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

const router = express.Router();
router.post('/', protect, uploadImage.array('file', 10), ctrl.upload);

module.exports = router;
