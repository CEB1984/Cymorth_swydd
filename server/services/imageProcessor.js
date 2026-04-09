'use strict';

const sharp  = require('sharp');
const { fullPath, thumbPath } = require('./storage');

const THUMB_MAX_WIDTH = parseInt(process.env.THUMBNAIL_MAX_WIDTH || '400', 10);
const THUMB_QUALITY   = parseInt(process.env.THUMBNAIL_QUALITY   || '70',  10);

async function processScreenshot(stepId, pngBuffer) {
  const image = sharp(pngBuffer);
  const meta  = await image.metadata();

  await sharp(pngBuffer).png().toFile(fullPath(stepId));

  await sharp(pngBuffer)
    .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY })
    .toFile(thumbPath(stepId));

  return { width: meta.width, height: meta.height };
}

module.exports = { processScreenshot };
