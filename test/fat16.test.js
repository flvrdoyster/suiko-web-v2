'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const MODULE_PATH = path.resolve(ROOT, process.env.FAT16_MODULE || 'src/fat16.js');
const Fat16 = require(MODULE_PATH);
const IMG_PATH = path.resolve(ROOT, process.env.SUIKO_IMG || 'docs/final-shared.img');
const SAVE_DIR = 'GENSE/SAVEDATA';

let failures = 0;
function check(cond, msg) {
  if (cond) { console.log('  ok  ' + msg); }
  else { console.log('FAIL  ' + msg); failures++; }
}
const same = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

let raw = fs.readFileSync(IMG_PATH);
if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw);
const shipped = new Uint8Array(raw);
console.log(`module: ${path.relative(ROOT, MODULE_PATH)}`);
console.log(`image: ${path.relative(ROOT, IMG_PATH)} (${shipped.length} bytes)`);

check(same(fs.readFileSync(path.join(ROOT, 'src/fat16.js')), fs.readFileSync(path.join(ROOT, 'docs/fat16.js'))),
  'docs/fat16.js is identical to src/fat16.js');

const fixture = (n) => new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', `SAVEDAT${n}.DAT`)));
const saves = [1, 2, 3, 4, 5, 6].map((n) => {
  const data = fixture(n % 2 ? 1 : 2);
  if (n > 2) data[0] ^= n;
  const times = new Uint8Array(13);
  times[11] = 0x3b; times[12] = 0x5b;
  return { name: `SAVEDAT${n}.DAT`, data, times };
});

check(Fat16.extractDirFiles(shipped, SAVE_DIR).length === 0, 'shipped SAVEDATA is empty');
const injected = Fat16.injectDirFiles(shipped, SAVE_DIR, saves);
check(injected.skipped.length === 0, 'all 6 saves injected into the empty folder');
const base = injected.image;
const files = Fat16.extractDirFiles(base, SAVE_DIR);
const names = files.map((f) => f.name.toUpperCase()).sort();
console.log('extracted:', names.join(', '));
check(names.length === 6 && names.every((n, i) => n === `SAVEDAT${i + 1}.DAT`),
  'extracts exactly SAVEDAT1..6.DAT (no save lost to an orphaned long name)');
check(files.every((f) => f.data.length === 1274), 'every save file is 1274 bytes');
check(saves.every((s) => { const f = files.find((x) => x.name.toUpperCase() === s.name); return f && same(f.data, s.data); }),
  'every save reads back byte-identical');
if (names.length !== 6) {
  console.log(`\n${failures} FAILURE(S) — the remaining checks need all six slots, stopping here`);
  process.exit(1);
}

const { image: reinjected, skipped } = Fat16.injectDirFiles(base, SAVE_DIR, files);
check(skipped.length === 0, 'no files skipped on identity re-inject');
check(same(base, reinjected), 'identity re-inject is byte-identical to base');

const modified = files.map((f) => {
  if (f.name.toUpperCase() !== 'SAVEDAT1.DAT') return f;
  const d = f.data.slice();
  d[0] ^= 0xff; d[100] ^= 0xff; d[1273] ^= 0xff;
  return { name: f.name, data: d };
});
const { image: changed } = Fat16.injectDirFiles(base, SAVE_DIR, modified);
const after = Fat16.extractDirFiles(changed, SAVE_DIR);
const byName = (arr, n) => arr.find((f) => f.name.toUpperCase() === n);
check(!same(byName(after, 'SAVEDAT1.DAT').data, byName(files, 'SAVEDAT1.DAT').data), 'slot 1 differs after edit');
check(same(byName(after, 'SAVEDAT2.DAT').data, byName(files, 'SAVEDAT2.DAT').data), 'slot 2 unchanged after editing slot 1');
let diffBytes = 0;
for (let i = 0; i < base.length; i++) if (base[i] !== changed[i]) diffBytes++;
console.log(`total image bytes changed by 1-slot edit: ${diffBytes}`);
check(diffBytes > 0 && diffBytes <= 8192, 'change is confined to <= one 8KB cluster');

check(files.every((f) => f.times && same(f.times, saves[0].times)), 'created entries carry the given times');
const newTimes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
const retimed = files.map((f) => (f.name.toUpperCase() === 'SAVEDAT1.DAT' ? { name: f.name, data: f.data, times: newTimes } : f));
const { image: tsChanged } = Fat16.injectDirFiles(base, SAVE_DIR, retimed);
check(same(byName(Fat16.extractDirFiles(tsChanged, SAVE_DIR), 'SAVEDAT1.DAT').times, newTimes),
  'injected times are written back to the directory entry');

const emptied = files.reduce((img, f) => Fat16.deletePath(img, `${SAVE_DIR}/${f.name}`).image, base);
check(Fat16.extractDirFiles(emptied, SAVE_DIR).length === 0, 'save dir is empty after deleting all slots');
const restored = Fat16.injectDirFiles(emptied, SAVE_DIR, [files[0]]);
check(restored.skipped.length === 0, 'injecting into an empty dir is not skipped');
const restoredFiles = Fat16.extractDirFiles(restored.image, SAVE_DIR);
check(restoredFiles.length === 1 && restoredFiles[0].name.toUpperCase() === files[0].name.toUpperCase(),
  'the created entry has the right name');
check(same(restoredFiles[0].data, files[0].data), 'the created entry has the right content');

const [exe] = Fat16.extractDirFiles(shipped, 'GENSE').filter((f) => f.name.toUpperCase() === 'HWANSE.EXE');
const grown = new Uint8Array(exe.data.length + 8192);
grown.set(exe.data);
const { image: withGrown, skipped: growSkipped } = Fat16.injectDirFiles(shipped, 'GENSE', [{ name: 'HWANSE.EXE', data: grown }]);
check(growSkipped.length === 0, 'oversized HWANSE.EXE replacement is not skipped');
const [grownBack] = Fat16.extractDirFiles(withGrown, 'GENSE').filter((f) => f.name.toUpperCase() === 'HWANSE.EXE');
check(grownBack && same(grownBack.data, grown), 'oversized HWANSE.EXE reads back byte-identical after reallocation');
const { image: shrunkBack } = Fat16.injectDirFiles(withGrown, 'GENSE', [{ name: 'HWANSE.EXE', data: exe.data }]);
const [shrunkExe] = Fat16.extractDirFiles(shrunkBack, 'GENSE').filter((f) => f.name.toUpperCase() === 'HWANSE.EXE');
check(shrunkExe && same(shrunkExe.data, exe.data), 'HWANSE.EXE fits back in place once it shrinks again');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
