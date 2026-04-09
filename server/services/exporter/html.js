'use strict';

const fs2      = require('fs');
const fs       = require('fs/promises');
const sanitize = require('sanitize-html');
const { getTemplate } = require('./template');
const { fullPath }    = require('../storage');

function esc(str) {
  return sanitize(String(str || ''), { allowedTags: [], allowedAttributes: {} });
}

async function loadImageBase64(stepId) {
  try {
    const buf = await fs.readFile(fullPath(stepId));
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch (_) { return null; }
}

function assetToBase64(filePath, mime) {
  try {
    if (!fs2.existsSync(filePath)) return null;
    return 'data:' + mime + ';base64,' + fs2.readFileSync(filePath).toString('base64');
  } catch (_) { return null; }
}

function proportionalHeight(widthPx, aspectRatio) {
  if (!aspectRatio) return Math.round(widthPx / 4);
  return Math.round(widthPx / aspectRatio);
}

async function exportHtml(guide, templateName) {
  templateName = templateName || 'wwt';
  const tmpl = getTemplate(templateName);
  const { styles, footer } = tmpl;
  const { colors } = styles;
  const isWwt = !!tmpl.assets;

  // Load brand assets as base64 for self-contained HTML
  let logoDataUrl        = null;
  let gradientRuleDataUrl = null;

  if (isWwt && tmpl.assets) {
    logoDataUrl         = assetToBase64(tmpl.assets.monogram, 'image/png')
                       || assetToBase64(tmpl.assets.logo,     'image/png');
    gradientRuleDataUrl = assetToBase64(tmpl.assets.gradientRule, 'image/png');
  }

  const logoWidthPx = 120;
  const logoHeightPx = proportionalHeight(logoWidthPx, tmpl.monogramAspectRatio || tmpl.logoAspectRatio);

  const sorted = (guide.steps || []).slice().sort((a, b) => a.order - b.order);
  let stepsHtml = '';

  for (let i = 0; i < sorted.length; i++) {
    const step = sorted[i];
    let imageBlock = '';

    if (step.hasImage) {
      const dataUrl = await loadImageBase64(step.id);
      if (dataUrl) {
        let overlay = '';
        if (step.clickX != null && step.clickY != null) {
          const cx = (step.clickX * 100).toFixed(2);
          const cy = (step.clickY * 100).toFixed(2);
          overlay = '<svg class="click-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">'
                  + '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="none" stroke="#E63946" stroke-width="1.2" opacity="0.9"/>'
                  + '</svg>';
        }
        imageBlock = '<div class="step-image-wrap">'
                   + '<img class="step-image" src="' + dataUrl + '" alt="Step ' + (i + 1) + ' screenshot" loading="lazy">'
                   + overlay + '</div>';
      }
    }

    stepsHtml += '<section class="step">'
               + '<h2 class="step-heading">Step ' + (i + 1) + '</h2>'
               + '<p class="step-label">' + esc(step.label) + '</p>'
               + imageBlock
               + '</section>';
  }

  const footerText = esc(footer.right || '').replace('{page}', '');
  const footerLeft = esc(footer.left || '');

  const logoHtml = logoDataUrl
    ? '<img src="' + logoDataUrl + '" alt="WWT Logo" style="height:' + logoHeightPx + 'px;width:auto;">'
    : '<span class="header-brand-text">World Wide Technology</span>';

  const gradientRuleHtml = gradientRuleDataUrl
    ? '<img src="' + gradientRuleDataUrl + '" alt="" class="gradient-rule" aria-hidden="true">'
    : '<div class="gradient-rule-fallback"></div>';

  const css = [
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
    'body { font-family: Arial, sans-serif; font-size: ' + styles.baseFontSize + 'pt; color: #' + colors.body + '; background: #' + colors.background + '; line-height: 1.5; }',
    '.page { max-width: 900px; margin: 0 auto; padding: 0 0 4rem; }',
    // Header
    '.doc-header { padding: 1rem 2rem .5rem; display: flex; align-items: center; justify-content: space-between; }',
    '.header-brand-text { font-size: 11pt; color: #' + colors.heading + '; font-weight: 600; }',
    '.header-title { font-size: 9pt; color: #' + colors.heading + '; text-align: right; max-width: 50%; }',
    '.gradient-rule { display: block; width: 100%; height: auto; max-height: 6px; }',
    '.gradient-rule-fallback { height: 4px; background: #' + colors.heading + '; width: 100%; }',
    // Content
    '.content { padding: 1.5rem 2rem; }',
    'h1.guide-title { font-size: ' + styles.headingSize + 'pt; font-weight: 700; color: #' + colors.heading + '; margin-bottom: 1rem; }',
    '.step { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e0e0e0; }',
    '.step-heading { font-size: ' + styles.subheadSize + 'pt; font-weight: 700; color: #' + colors.heading + '; margin-bottom: .25rem; }',
    '.step-label { margin-bottom: .75rem; color: #' + colors.body + '; }',
    '.step-image-wrap { position: relative; display: inline-block; max-width: 100%; }',
    '.step-image { display: block; max-width: 100%; border: 1px solid #e0e0e0; }',
    '.click-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }',
    // Footer
    '.doc-footer { padding: .5rem 2rem; display: flex; justify-content: space-between; font-size: 9pt; color: #888; }',
    '@media print { .step { page-break-inside: avoid; } }',
  ].join('\n');

  return '<!DOCTYPE html>\n'
       + '<html lang="en">\n'
       + '<head>\n'
       + '<meta charset="UTF-8">\n'
       + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
       + '<title>' + esc(guide.title) + '</title>\n'
       + '<style>\n' + css + '\n</style>\n'
       + '</head>\n'
       + '<body>\n'
       + '<div class="page">\n'
       + '<header class="doc-header">' + logoHtml + '<span class="header-title">' + esc(guide.title) + '</span></header>\n'
       + gradientRuleHtml + '\n'
       + '<div class="content">\n'
       + '<h1 class="guide-title">' + esc(guide.title) + '</h1>\n'
       + '<main>' + stepsHtml + '</main>\n'
       + '</div>\n'
       + '<div class="gradient-rule-wrapper">' + gradientRuleHtml + '</div>\n'
       + '<footer class="doc-footer"><span>' + footerLeft + '</span><span>' + footerText + '</span></footer>\n'
       + '</div>\n'
       + '</body>\n'
       + '</html>';
}

module.exports = { exportHtml };
