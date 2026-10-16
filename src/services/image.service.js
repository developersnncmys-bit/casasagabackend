const path = require('path');
const mongoose = require('mongoose');
const { TYPES } = require('../middleware/upload');

// Uploaded images live in MongoDB GridFS (collections uploads.files / uploads.chunks)
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

const safeName = (original, mimetype) => {
  const base =
    path
      .parse(original || '')
      .name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'image';
  return `${base}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}${TYPES[mimetype]}`;
};

/** Saves an uploaded file (from multer memory storage) and returns its file name. */
function saveImage(file) {
  const filename = safeName(file.originalname, file.mimetype);
  return new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(filename, { metadata: { contentType: file.mimetype, size: file.size } });
    stream.on('error', reject).on('finish', () => resolve(filename));
    stream.end(file.buffer);
  });
}

/** Finds a stored image by file name; null if there isn't one. */
async function findImage(filename) {
  const [doc] = await bucket().find({ filename }).limit(1).toArray();
  return doc || null;
}

// start/end (inclusive) stream just part of a file — used for video playback
const openImage = (doc, range) => bucket().openDownloadStream(doc._id, range ? { start: range.start, end: range.end + 1 } : undefined);

module.exports = { saveImage, findImage, openImage, safeName, bucket };
