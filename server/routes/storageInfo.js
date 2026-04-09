'use strict';

const express = require('express');
const router  = express.Router();
const { storageStats } = require('../services/storage');

router.get('/', async (_req, res, next) => {
  try { res.json(await storageStats()); }
  catch (err) { next(err); }
});

module.exports = router;
