'use strict';

const express  = require('express');
const router   = express.Router();
const { getGuide }   = require('../services/storage');
const { exportWord } = require('../services/exporter/word');
const { exportHtml } = require('../services/exporter/html');

function validateId(id) { return /^[0-9a-f-]{36}$/.test(id); }
function safeFilename(title) {
  return title.replace(/[^a-z0-9_\-\s]/gi, '').replace(/\s+/g, '_').slice(0, 80) || 'guide';
}

router.get('/:id/word', async (req, res, next) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const guide  = await getGuide(req.params.id);
    const buffer = await exportWord(guide);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(guide.title)}.docx"`);
    res.send(buffer);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Guide not found' });
    next(err);
  }
});

router.get('/:id/html', async (req, res, next) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const guide = await getGuide(req.params.id);
    const html  = await exportHtml(guide);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(guide.title)}.html"`);
    res.send(html);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Guide not found' });
    next(err);
  }
});

module.exports = router;
