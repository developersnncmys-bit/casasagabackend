const ApiError = require('../helpers/ApiError');
const catchAsync = require('../helpers/catchAsync');
const { publicUrl } = require('../config/env');
const { saveImage, findImage, openImage } = require('../services/image.service');
const chunked = require('../services/chunked.service');

const MAX_RANGE = 2 * 1024 * 1024;

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
  const type = doc.metadata?.contentType || 'application/octet-stream';
  // File names are unique, so the file never changes
  res.set({ 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable' });

  // Videos are fetched in parts (the browser asks with a Range header), at most 2 MB at a time
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const big = doc.length > MAX_RANGE;
  if (range || (big && type.startsWith('video/'))) {
    let start = range && range[1] !== '' ? Number(range[1]) : 0;
    let end = range && range[2] !== '' ? Number(range[2]) : doc.length - 1;
    if (range && range[1] === '' && range[2] !== '') {
      start = Math.max(doc.length - Number(range[2]), 0);
      end = doc.length - 1;
    }
    if (start >= doc.length) {
      res.status(416).set('Content-Range', `bytes */${doc.length}`);
      return res.end();
    }
    end = Math.min(end, doc.length - 1, start + MAX_RANGE - 1);
    res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${doc.length}`, 'Content-Length': end - start + 1 });
    return openImage(doc, { start, end }).on('error', next).pipe(res);
  }
  res.set('Content-Length', doc.length);
  openImage(doc).on('error', next).pipe(res);
});

/* Large files (videos) in pieces: start → piece by piece → finish */
exports.chunkStart = catchAsync(async (req, res) => {
  res.status(201).json({ success: true, data: await chunked.start(req.body || {}) });
});

exports.chunkPart = catchAsync(async (req, res) => {
  res.json({ success: true, data: await chunked.putPart(req.params.id, Number(req.params.index), req.body) });
});

exports.chunkFinish = catchAsync(async (req, res) => {
  const filename = await chunked.finish(req.params.id);
  res.status(201).json({ success: true, data: { url: urlFor(req, filename) } });
});
