const path = require('path');
const multer = require('multer');
const ApiError = require('../helpers/ApiError');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const base =
      path
        .parse(file.originalname)
        .name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'image';
    cb(null, `${base}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}${TYPES[file.mimetype]}`);
  },
});

const uploadImage = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) =>
    TYPES[file.mimetype] ? cb(null, true) : cb(ApiError.badRequest('Use a JPG, PNG, WebP or AVIF image')),
});

module.exports = { uploadImage, UPLOAD_DIR };
