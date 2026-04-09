'use strict';

const fs   = require('fs/promises');
const path = require('path');

function dataDir()   { return path.resolve(process.env.DATA_DIR || './data'); }
function guidesDir() { return path.join(dataDir(), 'guides'); }
function fullDir()   { return path.join(dataDir(), 'images', 'full'); }
function thumbDir()  { return path.join(dataDir(), 'images', 'thumb'); }

function guidePath(id) { return path.join(guidesDir(), `${id}.json`); }
function fullPath(id)  { return path.join(fullDir(),   `${id}.png`); }
function thumbPath(id) { return path.join(thumbDir(),  `${id}.jpg`); }

async function initStorage() {
  for (const dir of [guidesDir(), fullDir(), thumbDir()]) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function listGuides() {
  const files = await fs.readdir(guidesDir());
  const guides = await Promise.all(
    files
      .filter(f => f.endsWith('.json'))
      .map(async f => {
        const raw = await fs.readFile(path.join(guidesDir(), f), 'utf8');
        const g   = JSON.parse(raw);
        return {
          id:        g.id,
          title:     g.title,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
          stepCount: (g.steps || []).length,
        };
      })
  );
  return guides.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function getGuide(id) {
  const raw = await fs.readFile(guidePath(id), 'utf8');
  return JSON.parse(raw);
}

async function saveGuide(guide) {
  guide.updatedAt = new Date().toISOString();
  await fs.writeFile(guidePath(guide.id), JSON.stringify(guide, null, 2), 'utf8');
  return guide;
}

async function deleteGuide(id) {
  const guide = await getGuide(id);
  for (const step of guide.steps || []) {
    if (step.hasImage) {
      await fs.unlink(fullPath(step.id)).catch(() => {});
      await fs.unlink(thumbPath(step.id)).catch(() => {});
    }
  }
  await fs.unlink(guidePath(id));
}

async function storageStats() {
  const guideFiles = (await fs.readdir(guidesDir())).filter(f => f.endsWith('.json'));
  const fullFiles  = await fs.readdir(fullDir());
  const thumbFiles = await fs.readdir(thumbDir());

  async function dirSize(dir, files) {
    let bytes = 0;
    for (const f of files) {
      const stat = await fs.stat(path.join(dir, f)).catch(() => ({ size: 0 }));
      bytes += stat.size;
    }
    return bytes;
  }

  const [guideBytes, fullBytes, thumbBytes] = await Promise.all([
    dirSize(guidesDir(), guideFiles),
    dirSize(fullDir(),   fullFiles),
    dirSize(thumbDir(),  thumbFiles),
  ]);

  return {
    guideCount: guideFiles.length,
    imageCount: fullFiles.length,
    totalBytes: guideBytes + fullBytes + thumbBytes,
    totalMB:    ((guideBytes + fullBytes + thumbBytes) / 1024 / 1024).toFixed(2),
    maxGuides:  parseInt(process.env.MAX_GUIDES || '50', 10),
  };
}

module.exports = { initStorage, listGuides, getGuide, saveGuide, deleteGuide, storageStats, fullPath, thumbPath };
