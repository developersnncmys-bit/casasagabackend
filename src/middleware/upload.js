const path = require('path');
const multer = require('multer');
const ApiError = require('../helpers/ApiError');

// Older local uploads saved to disk are still served from here
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const TYPES = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
};
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// Images are kept in memory and saved to MongoDB (GridFS) — serverless hosts like
// Vercel have no lasting disk. Vercel also caps a request at 4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024;

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 10 },
  fileFilter: (req, file, cb) =>
    TYPES[file.mimetype] ? cb(null, true) : cb(ApiError.badRequest('Use a JPG, PNG, WebP or AVIF image, or an MP4, WebM or MOV video')),
});

module.exports = { uploadImage, UPLOAD_DIR, TYPES, VIDEO_TYPES, MAX_BYTES };
