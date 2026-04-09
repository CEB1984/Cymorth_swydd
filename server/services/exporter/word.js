'use strict';

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
  headerParts.push(new TextRun({ text: '\t' + guide.title, font: styles.fontFamily, size: pt(9), color: hex(colors.heading) }));

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
      new TextRun({ text: '\t', font: styles.fontFamily }),
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
