require('dotenv').config();

const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { port } = require('./src/config/env');

// Nothing listens until the database is up
connectDB()
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`CasaSaga API listening on http://localhost:${port}`);
    });

    const shutdown = (signal) => () => {
      console.log(`\n${signal} received — closing the server`);
      server.close(() => process.exit(0));
    };
    process.on('SIGINT', shutdown('SIGINT'));
    process.on('SIGTERM', shutdown('SIGTERM'));
  })
  .catch((err) => {
    console.error('Could not start:', err.message);
    process.exit(1);
  });
