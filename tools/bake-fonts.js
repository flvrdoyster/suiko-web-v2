// bake-fonts.js — pull the newly-installed TrueType fonts + updated registry (SYSTEM.DAT)
// out of a manually-tested "Export Hard Drive" image and bake them into the shared base
// image, so JAFONT.TTF/KOFONT.TTF + their font registration are present with no manual
// Control Panel step at boot.
//
// Usage: node tools/bake-fonts.js <exported-hdd.img> <base.img> <out.img>
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const F = require('../src/fat16.js');

const [, , exportedPath, basePath, outPath] = process.argv;
if (!exportedPath || !basePath || !outPath) {
  console.error('usage: node tools/bake-fonts.js <exported-hdd.img> <base.img> <out.img>');
  process.exit(1);
}

const exported = new Uint8Array(fs.readFileSync(exportedPath));
const exCtx = F.openImage(exported);
const fontsDir = F.resolveDir(exCtx, 'WINDOWS/FONTS');
const jaEntry = F.listDir(exCtx, fontsDir).find((e) => e.shortName.toUpperCase() === 'JAFONT.TTF');
const koEntry = F.listDir(exCtx, fontsDir).find((e) => e.shortName.toUpperCase() === 'KOFONT.TTF');
if (!jaEntry || !koEntry) throw new Error('JAFONT.TTF/KOFONT.TTF not found in exported image FONTS dir');
const jaFont = F.readFileEntry(exCtx, jaEntry);
const koFont = F.readFileEntry(exCtx, koEntry);

const sysDir = F.resolveDir(exCtx, 'WINDOWS');
const sysEntry = F.listDir(exCtx, sysDir).find((e) => e.shortName.toUpperCase() === 'SYSTEM.DAT');
if (!sysEntry) throw new Error('SYSTEM.DAT not found in exported image');
const systemDat = F.readFileEntry(exCtx, sysEntry);

let raw = fs.readFileSync(basePath);
if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw);
let img = new Uint8Array(raw);

img = F.createFile(img, 'WINDOWS/FONTS', 'JAFONT.TTF', new Uint8Array(jaFont));
img = F.createFile(img, 'WINDOWS/FONTS', 'KOFONT.TTF', new Uint8Array(koFont));

const res = F.injectDirFiles(img, 'WINDOWS', [{ name: 'SYSTEM.DAT', data: new Uint8Array(systemDat) }]);
if (res.skipped.length) throw new Error('SYSTEM.DAT not written: ' + res.skipped);
img = res.image;

const gz = zlib.gzipSync(Buffer.from(img), { level: 9 });
fs.writeFileSync(outPath, gz);
console.log('wrote', outPath, gz.length, 'bytes gzip (', img.length, 'raw )');

// verify
const v = F.openImage(img);
const vFonts = F.listDir(v, F.resolveDir(v, 'WINDOWS/FONTS')).filter((e) => /JAFONT|KOFONT/i.test(e.shortName));
console.log('fonts in output:', vFonts.map((e) => e.shortName + ' ' + e.size));
const saves = F.extractDirFiles(img, 'GENSE/SAVEDATA');
console.log('GENSE/SAVEDATA intact:', saves.length, 'files');
const savesJp = F.extractDirFiles(img, 'GENSEJP/SAVEDATA');
console.log('GENSEJP/SAVEDATA intact:', savesJp.length, 'files');
