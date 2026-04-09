'use strict';

const PROVIDER = (process.env.AI_PROVIDER || 'noop').toLowerCase();

let adapter;
if (PROVIDER === 'anthropic') {
  adapter = require('./anthropic');
} else if (PROVIDER === 'ollama') {
  adapter = require('./ollama');
} else {
  adapter = require('./noop');
}

async function labelStep(payload) {
  try {
    return await adapter.labelStep(payload);
  } catch (err) {
    console.error('[ai/' + PROVIDER + '] labeling failed:', err.message);
    return 'Step';
  }
}

module.exports = { labelStep };
