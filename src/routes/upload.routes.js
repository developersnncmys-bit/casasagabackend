const express = require('express');
const ctrl = require('../controllers/upload.controller');
const { protect } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

const router = express.Router();
router.post('/', protect, uploadImage.array('file', 10), ctrl.upload);
// Videos and other large files, sent in pieces of up to 3 MB
router.post('/chunks', protect, ctrl.chunkStart);
router.put('/chunks/:id/:index', protect, express.raw({ type: '*/*', limit: '4mb' }), ctrl.chunkPart);
router.post('/chunks/:id/finish', protect, ctrl.chunkFinish);

module.exports = router;
