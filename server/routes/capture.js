'use strict';

const express            = require('express');
const router             = express.Router();
const cors               = require('cors');
const multer             = require('multer');
const sanitizeHtml       = require('sanitize-html');
const { v4: uuidv4 }     = require('uuid');
const { processScreenshot } = require('../services/imageProcessor');
const { getGuide, saveGuide } = require('../services/storage');
const { labelStep }      = require('../services/ai/index');

// Allow cross-origin requests from bookmarklet running in target tabs
const corsAny = cors({ origin: true, methods: ['POST', 'OPTIONS'] });

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'image/png') return cb(null, true);
    cb(new Error('Only PNG screenshots are accepted'));
  },
});

const domContextStore = new Map();
const DOM_TTL_MS = 10000;

function pruneDomContextStore() {
  const now = Date.now();
  for (const [key, val] of domContextStore) {
    if (val.expiresAt < now) domContextStore.delete(key);
  }
}

function sanitizeText(str) {
  return sanitizeHtml(String(str || ''), { allowedTags: [], allowedAttributes: {} }).trim().slice(0, 5000);
}

function sanitizeAttributes(attrs) {
  if (!attrs || typeof attrs !== 'object') return {};
  const safe = {};
  for (const key of ['id','class','name','type','href','aria-label','placeholder','value']) {
    if (attrs[key] !== undefined) safe[key] = sanitizeText(String(attrs[key]));
  }
  return safe;
}

function sanitizeDomContext(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    elementTag:        sanitizeText(raw.elementTag),
    elementText:       sanitizeText(raw.elementText),
    elementAttributes: sanitizeAttributes(raw.elementAttributes),
    nearestLabel:      sanitizeText(raw.nearestLabel),
    pageTitle:         sanitizeText(raw.pageTitle),
    surroundingHTML:   sanitizeHtml(String(raw.surroundingHTML || ''), {
      allowedTags: ['form','div','section','button','a','input','select','label','span','p','h1','h2','h3','h4','td','th','tr','table'],
      allowedAttributes: { '*': ['id','class','name','type','href','aria-label','placeholder'] },
    }).slice(0, 3000),
  };
}

// ── DOM context — called by bookmarklet on each click ─────────────────────────
router.options('/dom-context', corsAny);
router.post('/dom-context', corsAny, express.json({ limit: '100kb' }), (req, res) => {
  pruneDomContextStore();
  const token   = sanitizeText(req.body.token || '');
  const context = sanitizeDomContext(req.body.context);
  if (!token || !context) return res.status(400).json({ error: 'token and context are required' });
  domContextStore.set(token, { context, expiresAt: Date.now() + DOM_TTL_MS });
  res.json({ ok: true });
});

// ── SSE trigger — recorder tab listens, bookmarklet fires ─────────────────────
const triggerListeners = new Set();

router.get('/trigger-listen', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  triggerListeners.add(res);
  req.on('close', () => triggerListeners.delete(res));
});

router.options('/trigger', corsAny);
router.post('/trigger', corsAny, express.json({ limit: '1kb' }), (req, res) => {
  for (const client of triggerListeners) {
    client.write('data: capture\n\n');
  }
  res.json({ ok: true, listeners: triggerListeners.size });
});

// ── Screenshot ingest ─────────────────────────────────────────────────────────
router.post('/screenshot', upload.single('screenshot'), async (req, res, next) => {
  try {
    const guideId = sanitizeText(req.body.guideId);
    if (!guideId) return res.status(400).json({ error: 'guideId is required' });

    const guide = await getGuide(guideId).catch(() => null);
    if (!guide) return res.status(404).json({ error: 'Guide not found' });
    if (!req.file) return res.status(400).json({ error: 'screenshot file is required' });

    const clickX = parseFloat(req.body.clickX);
    const clickY = parseFloat(req.body.clickY);

    let domContext = null;
    const domToken = sanitizeText(req.body.domToken || '');
    if (domToken && domContextStore.has(domToken)) {
      domContext = domContextStore.get(domToken).context;
      domContextStore.delete(domToken);
    } else if (req.body.domContext) {
      try { domContext = sanitizeDomContext(JSON.parse(req.body.domContext)); } catch (_) {}
    }

    const stepId = uuidv4();
    await processScreenshot(stepId, req.file.buffer);

    const label = await labelStep({
      screenshotBuffer: req.file.buffer,
      domContext,
      visibleText: sanitizeText(req.body.visibleText || ''),
      clickX: isNaN(clickX) ? null : clickX,
      clickY: isNaN(clickY) ? null : clickY,
    });

    const MAX_STEPS = parseInt(process.env.MAX_STEPS_PER_GUIDE || '100', 10);
    const step = {
      id:       stepId,
      order:    guide.steps.length,
      label:    sanitizeText(label),
      hasImage: true,
      clickX:   isNaN(clickX) ? null : Math.min(1, Math.max(0, clickX)),
      clickY:   isNaN(clickY) ? null : Math.min(1, Math.max(0, clickY)),
    };

    guide.steps.push(step);
    await saveGuide(guide);
    res.status(201).json({ step, warned: guide.steps.length > MAX_STEPS });
  } catch (err) { next(err); }
});

module.exports = router;
