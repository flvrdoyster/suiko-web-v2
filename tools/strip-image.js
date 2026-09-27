'use strict';
const fs = require('fs');
const zlib = require('zlib');
const F = require('../src/fat16.js');

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error('usage: node tools/strip-image.js <in.img> <out.img>'); process.exit(1); }

const STRIP = [
  'WINDOWS/INF',
  'WINDOWS/SYSBCKUP',
  'WINDOWS/SYSTEM.DA0',
  'WINDOWS/TEMP',
  'WINDOWS/HELP',
  'WINDOWS/MEDIA',
];

const FONT_KEEP = new Set(['GULIM.TTC', 'MARLETT.TTF']);

let img = new Uint8Array(fs.readFileSync(inPath));
const gz = (b) => zlib.gzipSync(Buffer.from(b), { level: 9 }).length;
const before = { size: img.length, gzip: gz(img) };

for (const p of STRIP) {
  const r = F.deletePath(img, p);
  img = r.image;
  console.log((r.found ? 'deleted ' : 'absent  ') + p);
}

{
  const ctx = F.openImage(img);
  const fontsCluster = F.resolveDir(ctx, 'WINDOWS/FONTS');
  if (fontsCluster !== null) {
    let n = 0, freed = 0;
    for (const e of F.listDir(ctx, fontsCluster)) {
      if (e.attr & 0x10) continue;
      const name = (e.shortName || '').toUpperCase();
      if (!/\.(TTF|TTC)$/.test(name)) continue;
      if (FONT_KEEP.has(name)) continue;
      const r = F.deletePath(img, 'WINDOWS/FONTS/' + (e.longName || e.shortName));
      img = r.image; if (r.found) { n++; freed += e.size; }
    }
    console.log('deleted ' + n + ' Western TrueType fonts (~' + (freed / 1048576).toFixed(1) + 'MB)');
  }
}
const zeroed = F.zeroFreeClusters(img);
console.log('zeroed free clusters:', zeroed);

fs.writeFileSync(outPath, Buffer.from(img));
const after = { size: img.length, gzip: gz(img) };
const mb = (n) => (n / 1048576).toFixed(1) + 'MB';
console.log('\n--- transfer size (what the browser downloads) ---');
console.log('before: raw', mb(before.size), 'gzip', mb(before.gzip));
console.log('after : raw', mb(after.size), 'gzip', mb(after.gzip));
console.log('gzip saved:', mb(before.gzip - after.gzip));

const v = F.openImage(img);
const gense = F.resolveDir(v, 'GENSE');
console.log('\nGENSE present:', gense !== null,
  '| SAVEDATA files:', F.extractDirFiles(img, 'GENSE/SAVEDATA').length);
