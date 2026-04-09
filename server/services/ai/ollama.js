'use strict';

// Stub — set AI_PROVIDER=ollama to activate. Implement HTTP call to
// OLLAMA_BASE_URL/api/generate when ready. Interface is identical to
// the Anthropic adapter: labelStep(payload) → Promise<string>

async function labelStep() {
  console.warn('[ai/ollama] Ollama adapter not yet implemented. Returning placeholder.');
  return 'Step (Ollama not configured)';
}

module.exports = { labelStep };
