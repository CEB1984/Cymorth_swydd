#!/usr/bin/env node
'use strict';

/**
 * Run this script from /workspaces/doc-creator to install WWT branding.
 * node install-wwt-brand.js
 */

const fs = require('fs');
const path = require('path');

// ── 1. WWT template definition ────────────────────────────────────────────────

const templateContent = `'use strict';

const ASSET_BASE = '/mnt/skills/organization/wwt-brand/assets/';

const wwtTemplate = {
  name:        'WWT',
  description: 'World Wide Technology brand template.',
  assetBase:   ASSET_BASE,
  assets: {
    logo:         ASSET_BASE + 'wwt-logo.png',
    logoWhite:    ASSET_BASE + 'wwt-logo-white.png',
    monogram:     ASSET_BASE + 'wwt-monogram.png',
    gradientRule: ASSET_BASE + 'wwt-gradient-rule.png',
  },
  logoAspectRatio:     4.7900,
  monogramAspectRatio: 1.9793,
  gradientRuleRatio:   132.7083,
  styles: {
    fontFamily:   'Arial',
    baseFontSize: 11,
    headingSize:  22,
    subheadSize:  16,
    colors: {
      heading:    '0086EA',
      body:       '262626',
      accent:     '0086EA',
      border:     '0086EA',
      background: 'FFFFFF',
    },
  },
  layout: {
    pageWidth:        12240,
    pageHeight:       15840,
    marginTop:        1440,
    marginRight:      1440,
    marginBottom:     1440,
    marginLeft:       1440,
    imageMaxWidthDXA: 9360,
    logoWidthPt:      108,
    monogramWidthPt:  64,
  },
  header: { left: 'LOGO', right: null },
  footer: { left: 'World Wide Technology', right: 'Page {page}' },
};

module.exports = wwtTemplate;
`;

// ── 2. Updated template registry ──────────────────────────────────────────────

const templateRegistryContent = `'use strict';

const defaultTemplate = {
  name:        'Default',
  description: 'Neutral placeholder styling.',
  styles: {
    fontFamily:   'Arial',
    baseFontSize: 11,
    headingSize:  16,
    subheadSize:  12,
    colors: {
      heading:    '222222',
      body:       '333333',
      accent:     '0066CC',
      border:     'CCCCCC',
      background: 'FFFFFF',
    },
  },
  layout: {
    pageWidth:        12240,
    pageHeight:       15840,
    marginTop:        1440,
    marginRight:      1440,
    marginBottom:     1440,
    marginLeft:       1440,
    imageMaxWidthDXA: 9360,
  },
  header: { left: null, right: null },
  footer: { left: null, right: 'Page {page}' },
};

const templates = {
  default: defaultTemplate,
  wwt:     require('./wwt'),
};

function getTemplate(name) { return templates[name] || templates.wwt; }
function listTemplates() {
  return Object.entries(templates).map(([key, t]) => ({ key, name: t.name, description: t.description }));
}

module.exports = { getTemplate, listTemplates };
`;

// ── 3. Word exporter ──────────────────────────────────────────────────────────

const wordContent = `'use strict';

const fs2 = require('fs');
const fs  = require('fs/promises');

const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Header, Footer, HeadingLevel, PageNumber,
  TabStopType, BorderStyle, AlignmentType,
} = require('docx');

const { getTemplate } = require('./template');
const { fullPath }    = require('../storage');

const pt  = n => n * 2;
const hex = c => String(c).replace('#', '');

async function loadImage(stepId) {
  try { return await fs.readFile(fullPath(stepId)); }
  catch (_) { return null; }
}

function fitImageEMU(imgWidth, imgHeight, maxWidthDXA) {
  const maxEMU   = maxWidthDXA * 635;
  const aspect   = imgHeight / imgWidth;
  const widthEMU = Math.min(imgWidth * 9525, maxEMU);
  return { widthEMU, heightEMU: Math.round(widthEMU * aspect) };
}

function proportionalHeight(widthPt, aspectRatio) {
  if (!aspectRatio) return Math.round(widthPt / 4);
  return Math.round(widthPt / aspectRatio);
}

function makeLogoRun(buffer, widthPt, aspectRatio) {
  if (!buffer) return null;
  return new ImageRun({
    data: buffer,
    transformation: {
      width:  Math.round(widthPt),
      height: proportionalHeight(widthPt, aspectRatio),
    },
    type: 'png',
  });
}

function makeGradientRuleRun(buffer, widthDXA, aspectRatio) {
  if (!buffer) return null;
  const widthPt = widthDXA / 20;
  return new ImageRun({
    data: buffer,
    transformation: {
      width:  Math.round(widthPt),
      height: Math.max(3, proportionalHeight(widthPt, aspectRatio)),
    },
    type: 'png',
  });
}

async function exportWord(guide, templateName) {
  templateName = templateName || 'wwt';
  const tmpl = getTemplate(templateName);
  const { styles, layout, footer } = tmpl;
  const { colors } = styles;
  const isWwt = !!tmpl.assets;

  // Load brand assets if WWT template
  let logoBuffer        = null;
  let monogramBuffer    = null;
  let gradientRuleBuffer = null;

  if (isWwt && tmpl.assets) {
    if (fs2.existsSync(tmpl.assets.monogram))     monogramBuffer     = fs2.readFileSync(tmpl.assets.monogram);
    if (fs2.existsSync(tmpl.assets.logo))         logoBuffer         = fs2.readFileSync(tmpl.assets.logo);
    if (fs2.existsSync(tmpl.assets.gradientRule)) gradientRuleBuffer = fs2.readFileSync(tmpl.assets.gradientRule);
  }

  const children = [];

  // Guide title
  children.push(new Paragraph({
    heading:  HeadingLevel.HEADING_1,
    children: [new TextRun({ text: guide.title, bold: true })],
  }));

  // Gradient rule after title
  if (gradientRuleBuffer) {
    const ruleRun = makeGradientRuleRun(gradientRuleBuffer, layout.imageMaxWidthDXA, tmpl.gradientRuleRatio);
    if (ruleRun) children.push(new Paragraph({ children: [ruleRun], spacing: { after: 200 } }));
  }

  // Steps
  const sorted = (guide.steps || []).slice().sort((a, b) => a.order - b.order);

  for (let i = 0; i < sorted.length; i++) {
    const step = sorted[i];

    children.push(new Paragraph({
      heading:  HeadingLevel.HEADING_2,
      children: [new TextRun({ text: 'Step ' + (i + 1) + ': ' + step.label })],
      spacing:  { before: 240, after: 120 },
    }));

    if (step.hasImage) {
      const imgBuf = await loadImage(step.id);
      if (imgBuf) {
        let w = 1280, h = 720;
        try {
          const sharp = require('sharp');
          const meta  = await sharp(imgBuf).metadata();
          w = meta.width || w;
          h = meta.height || h;
        } catch (_) {}
        const { widthEMU, heightEMU } = fitImageEMU(w, h, layout.imageMaxWidthDXA);
        children.push(new Paragraph({
          children: [new ImageRun({
            data: imgBuf,
            transformation: { width: widthEMU / 9525, height: heightEMU / 9525 },
            type: 'png',
          })],
          spacing: { after: 240 },
        }));
      }
    }
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  const headerParts = [];

  // Logo or monogram on left
  const logoRun = monogramBuffer
    ? makeLogoRun(monogramBuffer, layout.monogramWidthPt, tmpl.monogramAspectRatio)
    : (logoBuffer ? makeLogoRun(logoBuffer, layout.logoWidthPt, tmpl.logoAspectRatio) : null);

  if (logoRun) {
    headerParts.push(logoRun);
  } else {
    headerParts.push(new TextRun({ text: 'World Wide Technology', font: styles.fontFamily, size: pt(9), color: hex(colors.heading) }));
  }

  // Guide title on right
  headerParts.push(new TextRun({ text: '\\t' + guide.title, font: styles.fontFamily, size: pt(9), color: hex(colors.heading) }));

  const headerPara = new Paragraph({
    children: headerParts,
    tabStops: [{ type: TabStopType.RIGHT, position: layout.imageMaxWidthDXA }],
    spacing:  { after: 60 },
  });

  // Gradient rule in header
  const headerChildren = [headerPara];
  if (gradientRuleBuffer) {
    const ruleRun = makeGradientRuleRun(gradientRuleBuffer, layout.imageMaxWidthDXA, tmpl.gradientRuleRatio);
    if (ruleRun) headerChildren.push(new Paragraph({ children: [ruleRun], spacing: { before: 0, after: 0 } }));
  } else {
    // Fallback: colored border line
    headerChildren[0] = new Paragraph({
      children: headerParts,
      tabStops: [{ type: TabStopType.RIGHT, position: layout.imageMaxWidthDXA }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: hex(colors.border), space: 1 } },
    });
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footerRight = footer.right || '';
  const footerParts = footerRight.includes('{page}')
    ? [
        new TextRun({ text: footerRight.split('{page}')[0], font: styles.fontFamily, size: pt(9), color: hex(colors.body) }),
        new TextRun({ children: [PageNumber.CURRENT], font: styles.fontFamily, size: pt(9), color: hex(colors.body) }),
        new TextRun({ text: footerRight.split('{page}')[1] || '', font: styles.fontFamily, size: pt(9), color: hex(colors.body) }),
      ]
    : [new TextRun({ text: footerRight, font: styles.fontFamily, size: pt(9), color: hex(colors.body) })];

  const footerPara = new Paragraph({
    children: [
      new TextRun({ text: footer.left || '', font: styles.fontFamily, size: pt(9), color: hex(colors.body) }),
      new TextRun({ text: '\\t', font: styles.fontFamily }),
      ...footerParts,
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: layout.imageMaxWidthDXA }],
    spacing:  { before: 60 },
  });

  const footerChildren = [];
  if (gradientRuleBuffer) {
    const ruleRun = makeGradientRuleRun(gradientRuleBuffer, layout.imageMaxWidthDXA, tmpl.gradientRuleRatio);
    if (ruleRun) footerChildren.push(new Paragraph({ children: [ruleRun], spacing: { before: 0, after: 60 } }));
  } else {
    footerChildren.push(new Paragraph({
      children: [],
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: hex(colors.border), space: 1 } },
    }));
  }
  footerChildren.push(footerPara);

  // ── Document ────────────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: styles.fontFamily, size: pt(styles.baseFontSize), color: hex(colors.body) } },
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run:       { size: pt(styles.headingSize), bold: true, font: styles.fontFamily, color: hex(colors.heading) },
          paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run:       { size: pt(styles.subheadSize), bold: true, font: styles.fontFamily, color: hex(colors.heading) },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size:   { width: layout.pageWidth, height: layout.pageHeight },
          margin: { top: layout.marginTop, right: layout.marginRight, bottom: layout.marginBottom, left: layout.marginLeft },
        },
      },
      headers: { default: new Header({ children: headerChildren }) },
      footers: { default: new Footer({ children: footerChildren }) },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { exportWord };
`;

// ── 4. HTML exporter ──────────────────────────────────────────────────────────

const htmlContent = `'use strict';

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
  ].join('\\n');

  return '<!DOCTYPE html>\\n'
       + '<html lang="en">\\n'
       + '<head>\\n'
       + '<meta charset="UTF-8">\\n'
       + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\\n'
       + '<title>' + esc(guide.title) + '</title>\\n'
       + '<style>\\n' + css + '\\n</style>\\n'
       + '</head>\\n'
       + '<body>\\n'
       + '<div class="page">\\n'
       + '<header class="doc-header">' + logoHtml + '<span class="header-title">' + esc(guide.title) + '</span></header>\\n'
       + gradientRuleHtml + '\\n'
       + '<div class="content">\\n'
       + '<h1 class="guide-title">' + esc(guide.title) + '</h1>\\n'
       + '<main>' + stepsHtml + '</main>\\n'
       + '</div>\\n'
       + '<div class="gradient-rule-wrapper">' + gradientRuleHtml + '</div>\\n'
       + '<footer class="doc-footer"><span>' + footerLeft + '</span><span>' + footerText + '</span></footer>\\n'
       + '</div>\\n'
       + '</body>\\n'
       + '</html>';
}

module.exports = { exportHtml };
`;

// ── Write files ───────────────────────────────────────────────────────────────

const base = process.cwd();

fs.writeFileSync(path.join(base, 'server/services/exporter/wwt.js'), templateContent);
console.log('wrote server/services/exporter/wwt.js');

fs.writeFileSync(path.join(base, 'server/services/exporter/template.js'), templateRegistryContent);
console.log('wrote server/services/exporter/template.js');

fs.writeFileSync(path.join(base, 'server/services/exporter/word.js'), wordContent);
console.log('wrote server/services/exporter/word.js');

fs.writeFileSync(path.join(base, 'server/services/exporter/html.js'), htmlContent);
console.log('wrote server/services/exporter/html.js');

console.log('\nAll done. Run: npm install image-size');
