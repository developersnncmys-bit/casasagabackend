const crypto = require('crypto');
const mongoose = require('mongoose');
const ApiError = require('../helpers/ApiError');
const { safeName, bucket } = require('./image.service');
const { TYPES, VIDEO_TYPES } = require('../middleware/upload');

/**
 * Large files (videos) arrive in pieces, because Vercel rejects requests over 4.5 MB:
 *   start → one request per piece → finish (the pieces are joined into one GridFS file).
 * Unfinished uploads are cleared out after a day.
 */
const CHUNK_BYTES = 3 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const sessions = () => mongoose.connection.db.collection('upload_sessions');
const parts = () => mongoose.connection.db.collection('upload_parts');

let indexed = false;
async function ensureIndexes() {
  if (indexed) return;
  await Promise.all([
    sessions().createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }),
    parts().createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }),
    parts().createIndex({ uploadId: 1, index: 1 }, { unique: true }),
  ]);
  indexed = true;
}

async function start({ name, type, size }) {
  if (!TYPES[type]) throw ApiError.badRequest('Use an MP4, WebM or MOV video, or a JPG, PNG, WebP or AVIF image');
  const max = VIDEO_TYPES.includes(type) ? MAX_VIDEO_BYTES : 4 * 1024 * 1024;
  if (!(size > 0) || size > max) throw ApiError.badRequest(`Files must be ${Math.round(max / 1024 / 1024)} MB or smaller`);
  await ensureIndexes();
  const uploadId = crypto.randomBytes(12).toString('hex');
  const total = Math.ceil(size / CHUNK_BYTES);
  await sessions().insertOne({ _id: uploadId, filename: safeName(name, type), type, size, total, createdAt: new Date() });
  return { uploadId, chunkSize: CHUNK_BYTES, total };
}

async function putPart(uploadId, index, buffer) {
  const session = await sessions().findOne({ _id: uploadId });
  if (!session) throw ApiError.notFound('Upload not found — start again');
  if (!(index >= 0 && index < session.total)) throw ApiError.badRequest('That piece is out of range');
  if (!buffer?.length || buffer.length > CHUNK_BYTES) throw ApiError.badRequest('Each piece must be 3 MB or smaller');
  await parts().updateOne(
    { uploadId, index },
    { $set: { uploadId, index, data: buffer, createdAt: new Date() } },
    { upsert: true },
  );
  return { received: index };
}

async function finish(uploadId) {
  const session = await sessions().findOne({ _id: uploadId });
  if (!session) throw ApiError.notFound('Upload not found — start again');
  const count = await parts().countDocuments({ uploadId });
  if (count !== session.total) throw ApiError.badRequest(`Only ${count} of ${session.total} pieces arrived — try again`);

  await new Promise((resolve, reject) => {
    const out = bucket().openUploadStream(session.filename, { metadata: { contentType: session.type, size: session.size } });
    out.on('error', reject).on('finish', resolve);
    (async () => {
      const cursor = parts().find({ uploadId }).sort({ index: 1 });
      for await (const p of cursor) {
        const chunk = Buffer.from(p.data.buffer || p.data);
        if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      }
      out.end();
    })().catch(reject);
  });

  await Promise.all([parts().deleteMany({ uploadId }), sessions().deleteOne({ _id: uploadId })]);
  return session.filename;
}

module.exports = { start, putPart, finish, CHUNK_BYTES, MAX_VIDEO_BYTES };
