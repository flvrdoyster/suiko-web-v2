// strip-image.js — shrink a Win95+game disk image for web delivery by deleting files
// that aren't needed to boot Win95 and run the game, then zeroing freed space so the
// image compresses far better over the wire (the base image ships gzip'd and immutable).
//
// Usage: node tools/strip-image.js <in.img> <out.img>
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const F = require('../src/fat16.js');

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error('usage: node tools/strip-image.js <in.img> <out.img>'); process.exit(1); }

// Safe to remove: not needed to boot or run the game. FONTS is kept (Korean game needs
// fonts). INF = hardware-setup files, only used when adding hardware (our HW is fixed).
const STRIP = [
  'WINDOWS/INF',       // ~7MB hardware .inf setup files
  'WINDOWS/SYSBCKUP',  // ~2MB registry backup cabs
  'WINDOWS/SYSTEM.DA0', // ~1MB backup registry hive
  'WINDOWS/TEMP',      // temp
  'WINDOWS/HELP',      // help files (if present)
  'WINDOWS/MEDIA',     // sound-scheme WAVs (if present)
];

// Fonts: keep the Korean font (GULIM.TTC) the user wants, MARLETT (window-control
// glyphs), and all the small system bitmap fonts (.FON, needed by the Win95 UI).
// Delete the Western TrueType faces (Arial/Times/Courier/Verdana/…) — not needed.
const FONT_KEEP = new Set(['GULIM.TTC', 'MARLETT.TTF']);

let img = new Uint8Array(fs.readFileSync(inPath));
const gz = (b) => zlib.gzipSync(Buffer.from(b), { level: 9 }).length;
const before = { size: img.length, gzip: gz(img) };

for (const p of STRIP) {
  const r = F.deletePath(img, p);
  img = r.image;
  console.log((r.found ? 'deleted ' : 'absent  ') + p);
}

// delete Western TrueType fonts under WINDOWS\FONTS
{
  const ctx = F.openImage(img);
  const fontsCluster = F.resolveDir(ctx, 'WINDOWS/FONTS');
  if (fontsCluster !== null) {
    let n = 0, freed = 0;
    for (const e of F.listDir(ctx, fontsCluster)) {
      if (e.attr & 0x10) continue;
      const name = (e.shortName || '').toUpperCase();
      if (!/\.(TTF|TTC)$/.test(name)) continue;      // only TrueType
      if (FONT_KEEP.has(name)) continue;             // keep Gulim + Marlett
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

// sanity: game files + boot files still intact
const v = F.openImage(img);
const gense = F.resolveDir(v, 'GENSE');
console.log('\nGENSE present:', gense !== null,
  '| SAVEDATA files:', F.extractDirFiles(img, 'GENSE/SAVEDATA').length);
