'use strict';

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initStorage } = require('./services/storage');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'blob:', 'data:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({ origin: process.env.CORS_ORIGIN || false }));

// Bookmarklet endpoints need cross-origin access since they are called from target tabs

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});
app.use(limiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/guides',  require('./routes/guides'));
app.use('/api/capture', require('./routes/capture'));
app.use('/api/export',  require('./routes/export'));
app.use('/api/storage', require('./routes/storageInfo'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  await initStorage();
  app.listen(PORT, () => {
    console.log(`[doc-creator] listening on http://localhost:${PORT}`);
    console.log(`[doc-creator] data directory: ${process.env.DATA_DIR || './data'}`);
    console.log(`[doc-creator] AI provider: ${process.env.AI_PROVIDER || 'anthropic'}`);
  });
}

start().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
