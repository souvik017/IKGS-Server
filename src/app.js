const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const routes = require('./routes');
const { globalLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

// Security headers. Cross-origin resource policy is relaxed so the SPA on a
// different origin can load uploaded images.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Restrictive CORS: only the configured frontend origins may call the API.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

if (!config.isProduction) {
  app.use(morgan('dev'));
}

// Serve locally stored uploads when not using Cloudinary.
app.use('/uploads', express.static(path.join(process.cwd(), config.upload.localDir)));

app.use('/api', globalLimiter, routes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    env: config.env,
    storage: config.upload.provider,
    transactions: config.mongoTransactions,
    timestamp: new Date().toISOString(),
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
