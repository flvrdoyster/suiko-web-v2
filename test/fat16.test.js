// Round-trip test for src/fat16.js against the real KR game image.
// Run: node test/fat16.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const Fat16 = require('../src/fat16.js');

const IMG_PATH = process.env.SUIKO_IMG || '/Users/oyster/GitHub/suiko-web/game.img';
const SAVE_DIR = 'GENSE/SAVEDATA';

let failures = 0;
function check(cond, msg) {
  if (cond) { console.log('  ok  ' + msg); }
  else { console.log('FAIL  ' + msg); failures++; }
}

const base = new Uint8Array(fs.readFileSync(IMG_PATH));
console.log(`image: ${IMG_PATH} (${base.length} bytes)`);

// 1. Extraction finds the real save slots and skips macOS junk.
const files = Fat16.extractDirFiles(base, SAVE_DIR);
const names = files.map((f) => f.name).sort();
console.log('extracted:', names.join(', '));
check(names.length === 6, 'extracts exactly 6 save files');
check(names.every((n) => /^SAVEDAT[1-6]\.DAT$/i.test(n)), 'all extracted names are SAVEDATn.DAT');
check(files.every((f) => f.data.length === 1274), 'every save file is 1274 bytes');
check(!names.some((n) => n.startsWith('._')), 'AppleDouble ._ files are skipped');

// 2. Injecting the SAME files back yields a byte-identical image (no unintended change).
const { image: reinjected, skipped } = Fat16.injectDirFiles(base, SAVE_DIR, files);
check(skipped.length === 0, 'no files skipped on identity re-inject');
check(Buffer.compare(Buffer.from(base), Buffer.from(reinjected)) === 0,
  'identity re-inject is byte-identical to base');

// 3. Injecting MODIFIED save data changes only that file's cluster; everything else
//    outside SAVEDATA stays identical.
const modified = files.map((f, i) => {
  if (i !== 0) return f;
  const d = f.data.slice();
  d[0] ^= 0xff; d[100] ^= 0xff; d[1273] ^= 0xff; // flip a few bytes in slot 1
  return { name: f.name, data: d };
});
const { image: changed } = Fat16.injectDirFiles(base, SAVE_DIR, modified);

// Re-extract from the changed image: slot 1 must reflect the edit, others unchanged.
const after = Fat16.extractDirFiles(changed, SAVE_DIR);
const byName = (arr, n) => arr.find((f) => f.name.toUpperCase() === n);
check(Buffer.compare(Buffer.from(byName(after, 'SAVEDAT1.DAT').data),
  Buffer.from(byName(files, 'SAVEDAT1.DAT').data)) !== 0, 'slot 1 differs after edit');
check(Buffer.compare(Buffer.from(byName(after, 'SAVEDAT2.DAT').data),
  Buffer.from(byName(files, 'SAVEDAT2.DAT').data)) === 0, 'slot 2 unchanged after editing slot 1');

// Count how many bytes changed in the whole image — should be tiny (one cluster region).
let diffBytes = 0;
for (let i = 0; i < base.length; i++) if (base[i] !== changed[i]) diffBytes++;
console.log(`total image bytes changed by 1-slot edit: ${diffBytes}`);
check(diffBytes > 0 && diffBytes <= 8192, 'change is confined to <= one 8KB cluster');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
