const ApiError = require('../helpers/ApiError');
const catchAsync = require('../helpers/catchAsync');
const { publicUrl } = require('../config/env');

const urlFor = (req, file) => `${publicUrl || `${req.protocol}://${req.get('host')}`}/uploads/${file.filename}`;

/** POST /api/uploads with one or more `file` fields → their public URLs. */
exports.upload = catchAsync(async (req, res) => {
  if (!req.files?.length) throw ApiError.badRequest('Choose an image to upload');
  const urls = req.files.map((f) => urlFor(req, f));
  res.status(201).json({ success: true, data: { url: urls[0], urls } });
});
