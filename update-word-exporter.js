#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const content = `'use strict';

const fs2 = require('fs');
const fs  = require('fs/promises');

const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Header, Footer, HeadingLevel, PageNumber,
  TabStopType, BorderStyle, AlignmentType,
  ShadingType,
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

// Thin separator line paragraph between steps
function makeSeparator(borderColor) {
  return new Paragraph({
    children: [],
    spacing: { before: 240, after: 0 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 2, color: borderColor, space: 1 },
    },
  });
}

async function exportWord(guide, templateName) {
  templateName = templateName || 'wwt';
  const tmpl = getTemplate(templateName);
  const { styles, layout, footer } = tmpl;
  const { colors } = styles;
  const isWwt = !!tmpl.assets;

  // Load brand assets if WWT template
  let logoBuffer         = null;
  let monogramBuffer     = null;
  let gradientRuleBuffer = null;

  if (isWwt && tmpl.assets) {
    if (fs2.existsSync(tmpl.assets.monogram))     monogramBuffer     = fs2.readFileSync(tmpl.assets.monogram);
    if (fs2.existsSync(tmpl.assets.logo))         logoBuffer         = fs2.readFileSync(tmpl.assets.logo);
    if (fs2.existsSync(tmpl.assets.gradientRule)) gradientRuleBuffer = fs2.readFileSync(tmpl.assets.gradientRule);
  }

  const children = [];

  // ── Guide title ─────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    heading:  HeadingLevel.HEADING_1,
    children: [new TextRun({ text: guide.title, bold: true })],
    spacing:  { before: 0, after: 160 },
  }));

  // Gradient rule after title
  if (gradientRuleBuffer) {
    const ruleRun = makeGradientRuleRun(gradientRuleBuffer, layout.imageMaxWidthDXA, tmpl.gradientRuleRatio);
    if (ruleRun) children.push(new Paragraph({ children: [ruleRun], spacing: { before: 0, after: 360 } }));
  }

  // ── Steps ───────────────────────────────────────────────────────────────────
  const sorted = (guide.steps || []).slice().sort((a, b) => a.order - b.order);

  for (let i = 0; i < sorted.length; i++) {
    const step = sorted[i];

    // Separator between steps (not before the first)
    if (i > 0) {
      children.push(makeSeparator('DDDDDD'));
      children.push(new Paragraph({ children: [], spacing: { before: 0, after: 240 } }));
    }

    // "STEP N" — small muted label
    children.push(new Paragraph({
      children: [new TextRun({
        text:      'STEP ' + (i + 1),
        font:      styles.fontFamily,
        size:      pt(8),
        color:     '999999',
        bold:      false,
        allCaps:   false,
      })],
      spacing: { before: i === 0 ? 0 : 120, after: 80 },
    }));

    // Step label — larger, bold, WWT blue
    children.push(new Paragraph({
      children: [new TextRun({
        text:  step.label || 'Step ' + (i + 1),
        font:  styles.fontFamily,
        size:  pt(13),
        bold:  true,
        color: hex(colors.heading),
      })],
      spacing: { before: 0, after: 180 },
    }));

    // Screenshot
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

        // Screenshot with light border
        children.push(new Paragraph({
          children: [new ImageRun({
            data: imgBuf,
            transformation: { width: widthEMU / 9525, height: heightEMU / 9525 },
            type: 'png',
          })],
          spacing: { before: 0, after: 120 },
          border: {
            top:    { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD', space: 4 },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD', space: 4 },
            left:   { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD', space: 4 },
            right:  { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD', space: 4 },
          },
        }));

        // Caption below screenshot
        children.push(new Paragraph({
          children: [new TextRun({
            text:   'Figure ' + (i + 1) + ': ' + (step.label || 'Step ' + (i + 1)),
            font:   styles.fontFamily,
            size:   pt(8),
            color:  'AAAAAA',
            italics: true,
          })],
          spacing: { before: 60, after: 0 },
        }));
      }
    }
  }

  // ── Header ──────────────────────────────────────────────────────────────────
  const headerParts = [];

  const logoRun = monogramBuffer
    ? makeLogoRun(monogramBuffer, layout.monogramWidthPt, tmpl.monogramAspectRatio)
    : (logoBuffer ? makeLogoRun(logoBuffer, layout.logoWidthPt, tmpl.logoAspectRatio) : null);

  if (logoRun) {
    headerParts.push(logoRun);
  } else {
    headerParts.push(new TextRun({
      text: 'World Wide Technology',
      font: styles.fontFamily, size: pt(9), color: hex(colors.heading),
    }));
  }

  headerParts.push(new TextRun({
    text: '\\t' + guide.title,
    font: styles.fontFamily, size: pt(9), color: hex(colors.heading),
  }));

  const headerPara = new Paragraph({
    children: headerParts,
    tabStops: [{ type: TabStopType.RIGHT, position: layout.imageMaxWidthDXA }],
    spacing:  { after: 60 },
  });

  const headerChildren = [headerPara];
  if (gradientRuleBuffer) {
    const ruleRun = makeGradientRuleRun(gradientRuleBuffer, layout.imageMaxWidthDXA, tmpl.gradientRuleRatio);
    if (ruleRun) headerChildren.push(new Paragraph({ children: [ruleRun], spacing: { before: 0, after: 0 } }));
  } else {
    headerChildren[0] = new Paragraph({
      children: headerParts,
      tabStops: [{ type: TabStopType.RIGHT, position: layout.imageMaxWidthDXA }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: hex(colors.border), space: 1 } },
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
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

  // ── Document ─────────────────────────────────────────────────────────────────
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

fs.writeFileSync(path.join(process.cwd(), 'server/services/exporter/word.js'), content);
console.log('word.js written ok');
