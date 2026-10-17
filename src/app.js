const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { UPLOAD_DIR } = require('./middleware/upload');
const { serve: serveUpload } = require('./controllers/upload.controller');
const { corsOrigins, builtInOrigins, isProduction } = require('./config/env');

const app = express();

app.set('trust proxy', 1);
// Uploaded images are shown on the website and panel, which run on other origins
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, cb) =>
      cb(null, !origin || corsOrigins.length === 0 || corsOrigins.includes(origin) || builtInOrigins.some((re) => re.test(origin))),
  }),
);
app.use(compression());
// rawBody: the exact bytes, for checking Razorpay's webhook signature
app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); } }));
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Uploaded images: from MongoDB, or (older local uploads) from the uploads/ folder
app.get('/uploads/:name', serveUpload);
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true }));
app.use('/api', routes);

app.get('/', (req, res) => res.json({ success: true, data: { name: 'CasaSaga API', docs: '/api/health' } }));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
