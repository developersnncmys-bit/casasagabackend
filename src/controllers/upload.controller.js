const ApiError = require('../helpers/ApiError');
const catchAsync = require('../helpers/catchAsync');
const { publicUrl } = require('../config/env');
const { saveImage, findImage, openImage } = require('../services/image.service');

const urlFor = (req, filename) => `${publicUrl || `${req.protocol}://${req.get('host')}`}/uploads/${filename}`;

/** POST /api/uploads with one or more `file` fields → their public URLs. */
exports.upload = catchAsync(async (req, res) => {
  if (!req.files?.length) throw ApiError.badRequest('Choose an image to upload');
  const names = [];
  for (const file of req.files) names.push(await saveImage(file));
  const urls = names.map((n) => urlFor(req, n));
  res.status(201).json({ success: true, data: { url: urls[0], urls } });
});

/** GET /uploads/:name — streams an uploaded image from MongoDB. */
exports.serve = catchAsync(async (req, res, next) => {
  const doc = await findImage(req.params.name);
  if (!doc) return next(); // not in the database — fall through to 404
  res.set({
    'Content-Type': doc.metadata?.contentType || 'application/octet-stream',
    'Content-Length': doc.length,
    // File names are unique, so the image never changes
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  openImage(doc).on('error', next).pipe(res);
});
