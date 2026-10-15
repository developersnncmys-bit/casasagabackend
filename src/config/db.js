const mongoose = require('mongoose');
const { mongoUri } = require('./env');

mongoose.set('strictQuery', true);

/**
 * One connection, however many times this is called. On Vercel a warm instance
 * handles many requests, so the connection is cached on globalThis — a new
 * connection per request would exhaust the Atlas cluster's connection limit.
 */
const cache = globalThis.__casasagaMongo || (globalThis.__casasagaMongo = { conn: null, promise: null });

async function connectDB() {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        // Fail a query at once instead of queueing it against a database that isn't there
        bufferCommands: false,
        maxPoolSize: 10,
      })
      .then((m) => {
        console.log(`MongoDB connected: ${m.connection.name}`);
        return m;
      })
      .catch((err) => {
        // Let the next request try again rather than caching the failure
        cache.promise = null;
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

mongoose.connection.on('disconnected', () => {
  cache.conn = null;
  cache.promise = null;
});

module.exports = { connectDB };
