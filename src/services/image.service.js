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

/**
 * Shrinks a photo for the website: at most 2400 px on the long side, re-encoded at good quality
 * (a 4 MB phone photo becomes ~300–500 KB and looks the same). Keeps the format so the file name
 * stays right. Returns the original when it can't be made smaller (or sharp isn't installed).
 */
const SHRINK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
async function shrinkImage(buffer, type) {
  if (!SHRINK_TYPES.includes(type) || buffer.length < 300 * 1024) return buffer;
  try {
    const sharp = require('sharp');
    const img = sharp(buffer, { failOn: 'none' }).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true });
    const out = await (type === 'image/jpeg'
      ? img.jpeg({ quality: 80, mozjpeg: true })
      : type === 'image/png'
        ? img.png({ compressionLevel: 9, effort: 9 })
        : img.webp({ quality: 80 })
    ).toBuffer();
    return out.length < buffer.length * 0.9 ? out : buffer;
  } catch (err) {
    console.error('[uploads] could not shrink image:', err.message);
    return buffer;
  }
}

/** Saves a whole file in the database (photos are shrunk first) and returns its file name. */
async function saveBuffer(filename, buffer, type) {
  const data = await shrinkImage(buffer, type);
  await new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(filename, { metadata: { contentType: type, size: data.length } });
    stream.on('error', reject).on('finish', resolve);
    stream.end(data);
  });
  return filename;
}

/** Saves an uploaded file (from multer memory storage) and returns its file name. */
function saveImage(file) {
  return saveBuffer(safeName(file.originalname, file.mimetype), file.buffer, file.mimetype);
}

/** Finds a stored image by file name; null if there isn't one. */
async function findImage(filename) {
  const [doc] = await bucket().find({ filename }).limit(1).toArray();
  return doc || null;
}

// start/end (inclusive) stream just part of a file — used for video playback
const openImage = (doc, range) => bucket().openDownloadStream(doc._id, range ? { start: range.start, end: range.end + 1 } : undefined);

module.exports = { saveImage, saveBuffer, shrinkImage, SHRINK_TYPES, findImage, openImage, safeName, bucket };
