'use strict';

// No-op adapter — returns a placeholder label.
// Replace by setting AI_PROVIDER=anthropic in .env once an API key is available.

async function labelStep() {
  return 'Step';
}

module.exports = { labelStep };
