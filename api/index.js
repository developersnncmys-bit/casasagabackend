/**
 * What Vercel runs. Nothing calls listen() here: the platform hands over each
 * request, so the database is connected first and then Express answers it.
 * Locally, server.js is used instead.
 */
const app = require('../src/app');
const { connectDB } = require('../src/config/db');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Database unavailable:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, message: 'The database is unavailable — try again shortly' }));
  }
  return app(req, res);
};
