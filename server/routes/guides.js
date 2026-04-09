'use strict';

const express      = require('express');
const router       = express.Router();
const path         = require('path');
const sanitizeHtml = require('sanitize-html');
const { v4: uuidv4 } = require('uuid');
const { listGuides, getGuide, saveGuide, deleteGuide, thumbPath } = require('../services/storage');

function sanitizeText(str) {
  return sanitizeHtml(String(str || ''), { allowedTags: [], allowedAttributes: {} }).trim();
}

function validateId(id) {
  return /^[0-9a-f-]{36}$/.test(id);
}

router.get('/', async (_req, res, next) => {
  try {
    res.json(await listGuides());
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const title = sanitizeText(req.body.title) || 'Untitled guide';
    const guide = {
      id:        uuidv4(),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps:     [],
    };
    await saveGuide(guide);
    res.status(201).json(guide);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    res.json(await getGuide(req.params.id));
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Guide not found' });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const existing = await getGuide(req.params.id).catch(() => null);
    if (!existing) return res.status(404).json({ error: 'Guide not found' });

    const title    = sanitizeText(req.body.title) || existing.title;
    const rawSteps = Array.isArray(req.body.steps) ? req.body.steps : existing.steps;
    const MAX_STEPS = parseInt(process.env.MAX_STEPS_PER_GUIDE || '100', 10);

    const steps = rawSteps.slice(0, 500).map((s, i) => ({
      id:       validateId(String(s.id || '')) ? String(s.id) : uuidv4(),
      order:    i,
      label:    sanitizeText(s.label),
      hasImage: Boolean(s.hasImage),
      clickX:   typeof s.clickX === 'number' ? Math.min(1, Math.max(0, s.clickX)) : null,
      clickY:   typeof s.clickY === 'number' ? Math.min(1, Math.max(0, s.clickY)) : null,
    }));

    const guide = await saveGuide({ ...existing, title, steps });
    res.json({ guide, warned: steps.length > MAX_STEPS });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    await deleteGuide(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Guide not found' });
    next(err);
  }
});

router.get('/:id/thumb/:stepId', async (req, res) => {
  if (!validateId(req.params.id) || !validateId(req.params.stepId)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  res.sendFile(path.resolve(thumbPath(req.params.stepId)), err => {
    if (err) res.status(404).json({ error: 'Thumbnail not found' });
  });
});

module.exports = router;
