// build-jp-image.js — add a C:\GENSEJP\ folder (JP game files) to the already-fixed
// image that has KR installed at C:\GENSE\ (MIDI mapper baked, AutoScan off, stripped).
// One shared image serves both languages — kr.html/jp.html each patch WIN.INI's `load=`
// at boot time (see suiko-lang.js) to point at their own exe, instead of needing two
// full ~90MB Windows installs for a <5MB difference in game files.
//
// Usage: node tools/build-jp-image.js <kr-fixed.img> <out-shared.img>
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('../src/fat16.js');

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error('usage: node tools/build-jp-image.js <kr-fixed.img> <out-shared.img>'); process.exit(1); }

const jpDir = path.join(__dirname, '..', 'original', 'jp');
const jpExe = fs.readFileSync(path.join(jpDir, 'GENSE.EXE'));
const jpFld = fs.readFileSync(path.join(jpDir, 'GENSE.FLD'));
const midData = fs.readFileSync(path.join(jpDir, 'MIDDATA.MLK')); // identical to KR's, verified by MD5
const pcmData = fs.readFileSync(path.join(jpDir, 'PCMDATA.WLK'));

let img = new Uint8Array(fs.readFileSync(inPath));

img = F.createDir(img, '', 'GENSEJP');
img = F.createFile(img, 'GENSEJP', 'GENSE.EXE', new Uint8Array(jpExe));
img = F.createFile(img, 'GENSEJP', 'GENSE.FLD', new Uint8Array(jpFld));
img = F.createFile(img, 'GENSEJP', 'MIDDATA.MLK', new Uint8Array(midData));
img = F.createFile(img, 'GENSEJP', 'PCMDATA.WLK', new Uint8Array(pcmData));
img = F.createDir(img, 'GENSEJP', 'SAVEDATA');
console.log('created C:\\GENSEJP\\ with GENSE.EXE/GENSE.FLD/MIDDATA.MLK/PCMDATA.WLK');

// Our save mechanism (suiko-save.js) only overwrites EXISTING slot files in place — it
// never allocates new directory entries. So GENSEJP\SAVEDATA needs the same 6 fresh
// (never-saved) slot files as GENSE\SAVEDATA, byte-for-byte, or a KR save would have
// nothing to inject into under jp.html. Copy KR's own fresh slots verbatim.
{
  const krSaves = F.extractDirFiles(img, 'GENSE/SAVEDATA');
  for (const f of krSaves) img = F.createFile(img, 'GENSEJP/SAVEDATA', f.name, f.data);
  console.log('seeded GENSEJP\\SAVEDATA with', krSaves.length, 'fresh slot files (copied from GENSE\\SAVEDATA)');
}

fs.writeFileSync(outPath, Buffer.from(img));
console.log('wrote', outPath, img.length, 'bytes');

// verify: both GENSE (KR) and GENSEJP (JP) present and intact
const v = F.openImage(img);
for (const dir of ['GENSE', 'GENSEJP']) {
  const entries = F.listDir(v, F.resolveDir(v, dir)).filter((e) => !['.', '..'].includes(e.shortName));
  console.log(dir + '/:', entries.map((e) => e.shortName + '(' + e.size + ')').join(', '));
}
console.log('KR SAVEDATA:', F.extractDirFiles(img, 'GENSE/SAVEDATA').length, 'files');
console.log('JP SAVEDATA:', F.extractDirFiles(img, 'GENSEJP/SAVEDATA').length, 'files (expected 0, fresh)');
