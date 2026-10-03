#!/usr/bin/env node
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

const withJp = process.argv.includes('--jp');
const jpExePath = arg('jp-exe', path.join(ROOT, 'kr-patch/build/jp/GENSE.EXE'));
const jpFontPath = arg('jp-font', path.join(ROOT, 'kr-patch/build/jp/JAFONT.TTF'));

const patchedExe = new Uint8Array(fs.readFileSync(exePath));
const res = F.injectDirFiles(img, 'GENSE', [{ name: 'HWANSE.EXE', data: patchedExe }]);
if (res.skipped.length) fail(`HWANSE.EXE not found in image at GENSE/: ${res.skipped.join(',')}`);
img = res.image;

const v = F.openImage(img);
const entry = F.listDir(v, F.resolveDir(v, 'GENSE')).find((e) => e.shortName.toUpperCase() === 'HWANSE.EXE');
const readback = F.readFileEntry(v, entry);
if (Buffer.compare(Buffer.from(readback), Buffer.from(patchedExe)) !== 0) {
  fail('readback after injection does not match the patched exe — aborting, image not written');
}
if (withJp) {
  for (const p of [jpExePath, jpFontPath]) if (!fs.existsSync(p)) fail(`not found: ${p} (run build-jp.js / adapt-jafont.py first)`);
  const jpExe = new Uint8Array(fs.readFileSync(jpExePath));
  const jpFont = new Uint8Array(fs.readFileSync(jpFontPath));
  const jpSteps = [['GENSEJP', 'GENSE.EXE', jpExe], ['WINDOWS/FONTS', 'JAFONT.TTF', jpFont]];
  for (const [dir, name, data] of jpSteps) {
    const r = F.injectDirFiles(img, dir, [{ name, data }]);
    if (r.skipped.length) fail(`${dir}/${name} could not be written`);
    img = r.image;
    const view = F.openImage(img);
    const ent = F.listDir(view, F.resolveDir(view, dir)).find((e) => e.shortName.toUpperCase() === name);
    if (!ent || Buffer.compare(Buffer.from(F.readFileEntry(view, ent)), Buffer.from(data)) !== 0) {
      fail(`readback mismatch for ${dir}/${name} — aborting, image not written`);
    }
    console.log(`injected ${dir}/${name} (${data.length} bytes)`);
  }
}
const krSaves = F.extractDirFiles(img, 'GENSE/SAVEDATA');
const jpSaves = F.extractDirFiles(img, 'GENSEJP/SAVEDATA');
console.log(`GENSE/SAVEDATA intact: ${krSaves.length} files, GENSEJP/SAVEDATA intact: ${jpSaves.length} files`);

const gz = zlib.gzipSync(Buffer.from(img), { level: 9 });
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, gz);
console.log(`wrote ${path.relative(ROOT, outPath)} (${gz.length} bytes gzip)`);
console.log('Next: serve docs/ with this file swapped in and verify in the emulator before deploying.');
