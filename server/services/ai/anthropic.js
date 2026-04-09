'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = process.env.AI_MODEL || 'claude-sonnet-4-20250514';

function buildDomPrompt(domContext, clickX, clickY, visibleText) {
  const parts = [
    'You are generating a step label for a how-to guide. The user clicked on a UI element.',
    '',
    'Generate a concise action label (5-12 words) starting with a verb, describing what the user did.',
    'Use the element information below. Be specific — include the element\'s label or name if available.',
    'Return ONLY the label text, nothing else.',
    '',
    `Page title:    ${domContext.pageTitle || '(unknown)'}`,
    `Element type:  ${domContext.elementTag || '(unknown)'}`,
    `Element text:  ${domContext.elementText || '(none)'}`,
    `Nearest label: ${domContext.nearestLabel || '(none)'}`,
  ];
  if (domContext.elementAttributes && Object.keys(domContext.elementAttributes).length) {
    parts.push(`Attributes:    ${JSON.stringify(domContext.elementAttributes)}`);
  }
  if (domContext.surroundingHTML) {
    parts.push(`Surrounding HTML:\n${domContext.surroundingHTML}`);
  }
  if (visibleText) parts.push(`Additional visible text: ${visibleText}`);
  if (clickX != null && clickY != null) {
    parts.push(`Click position: ${Math.round(clickX * 100)}% from left, ${Math.round(clickY * 100)}% from top`);
  }
  return parts.join('\n');
}

function buildVisionPrompt(clickX, clickY, visibleText) {
  const parts = [
    'You are generating a step label for a how-to guide. The user clicked somewhere in this screenshot.',
    '',
    'Generate a concise action label (5-12 words) starting with a verb, describing what the user did.',
    'Base your label on visible UI elements, button labels, form fields, or page context.',
    'Return ONLY the label text, nothing else.',
    '',
  ];
  if (clickX != null && clickY != null) {
    parts.push(`The click occurred at approximately ${Math.round(clickX * 100)}% from the left and ${Math.round(clickY * 100)}% from the top.`);
  }
  if (visibleText) parts.push(`Visible text near the click: ${visibleText}`);
  return parts.join('\n');
}

async function labelStep({ screenshotBuffer, domContext, visibleText, clickX, clickY }) {
  let messages;

  if (domContext) {
    messages = [{ role: 'user', content: buildDomPrompt(domContext, clickX, clickY, visibleText) }];
  } else {
    messages = [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshotBuffer.toString('base64') } },
        { type: 'text',  text: buildVisionPrompt(clickX, clickY, visibleText) },
      ],
    }];
  }

  const response = await client.messages.create({ model: MODEL, max_tokens: 64, messages });

  const label = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()
    .replace(/^["']|["']$/g, '');

  return label || 'Step';
}

module.exports = { labelStep };
