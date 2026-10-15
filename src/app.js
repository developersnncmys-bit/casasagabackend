const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { UPLOAD_DIR } = require('./middleware/upload');
const { corsOrigins, isProduction } = require('./config/env');

const app = express();

app.set('trust proxy', 1);
// Uploaded images are shown on the website and panel, which run on other origins
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || corsOrigins.length === 0 || corsOrigins.includes(origin)),
  }),
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(isProduction ? 'combined' : 'dev'));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true }));
app.use('/api', routes);

app.get('/', (req, res) => res.json({ success: true, data: { name: 'CasaSaga API', docs: '/api/health' } }));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
