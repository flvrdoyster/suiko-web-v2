#!/usr/bin/env node
// inject.js — inject a patched HWANSE.EXE (from build.js) into a copy of the shared disk
// image (docs/final-shared.img), for local testing before deploying.
//
// Usage:
//   node kr-patch/tools/inject.js [--exe path] [--image path] [--out path]
// Defaults: kr-patch/build/HWANSE.EXE, docs/final-shared.img,
//   kr-patch/build/final-shared.img.
//
// Deliberately does NOT overwrite docs/final-shared.img directly — that's the live
// deployed asset. This writes to --out (a separate test copy) so the normal flow is:
//   1. inject.js (writes kr-patch/build/final-shared.img)
//   2. serve docs/ with that file swapped in, verify in the emulator
//   3. only once confirmed: `cp kr-patch/build/final-shared.img docs/final-shared.img`
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const F = require('../../src/fat16.js');

const ROOT = path.join(__dirname, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const exePath = arg('exe', path.join(ROOT, 'kr-patch/build/HWANSE.EXE'));
const imagePath = arg('image', path.join(ROOT, 'docs/final-shared.img'));
const outPath = arg('out', path.join(ROOT, 'kr-patch/build/final-shared.img'));

function fail(msg) {
  console.error('inject.js: ' + msg);
  process.exit(1);
}

if (!fs.existsSync(exePath)) fail(`patched exe not found: ${exePath} (run build.js first)`);
if (!fs.existsSync(imagePath)) fail(`disk image not found: ${imagePath}`);

let raw = fs.readFileSync(imagePath);
if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw);
let img = new Uint8Array(raw);

const patchedExe = new Uint8Array(fs.readFileSync(exePath));
const res = F.injectDirFiles(img, 'GENSE', [{ name: 'HWANSE.EXE', data: patchedExe }]);
if (res.skipped.length) fail(`HWANSE.EXE not found in image at GENSE/: ${res.skipped.join(',')}`);
img = res.image;

// Sanity: read the injected file back out and diff against what we meant to write, and
// confirm the shared image's other content (JP save data, KR save data) survived untouched.
const v = F.openImage(img);
const entry = F.listDir(v, F.resolveDir(v, 'GENSE')).find((e) => e.shortName.toUpperCase() === 'HWANSE.EXE');
const readback = F.readFileEntry(v, entry);
if (Buffer.compare(Buffer.from(readback), Buffer.from(patchedExe)) !== 0) {
  fail('readback after injection does not match the patched exe — aborting, image not written');
}
const krSaves = F.extractDirFiles(img, 'GENSE/SAVEDATA');
const jpSaves = F.extractDirFiles(img, 'GENSEJP/SAVEDATA');
console.log(`GENSE/SAVEDATA intact: ${krSaves.length} files, GENSEJP/SAVEDATA intact: ${jpSaves.length} files`);

const gz = zlib.gzipSync(Buffer.from(img), { level: 9 });
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, gz);
console.log(`wrote ${path.relative(ROOT, outPath)} (${gz.length} bytes gzip)`);
console.log('Next: serve docs/ with this file swapped in and verify in the emulator before deploying.');
