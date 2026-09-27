'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const F = require('../../src/fat16.js');

const ROOT = path.join(__dirname, '..', '..');
const LIVE = path.join(ROOT, 'docs', 'final-shared.img');
const OUT = path.join(ROOT, 'kr-patch', 'build', 'final-shared.img');

function loadImage(p) {
  const raw = fs.readFileSync(p);
  return raw[0] === 0x1f && raw[1] === 0x8b ? new Uint8Array(zlib.gunzipSync(raw)) : new Uint8Array(raw);
}

function findRootEntry(img, name) {
  const vol = F.openImage(img);
  return F.listDir(vol, 0).find(
    (e) => (e.longName || e.shortName).toUpperCase() === name.toUpperCase()
  );
}

let img = loadImage(LIVE);
const beforeRaw = img.length;

for (const p of ['/WINDOWS/WIN386.SWP', '/WINDOWS/FONTS/KOFONT.TTF']) {
  const { image, found } = F.deletePath(img, p);
  if (!found) throw new Error(`${p} not found in image — aborting, nothing written`);
  img = image;
  console.log(`deleted ${p}`);
}

{
  const vol = F.openImage(img);
  const entry = findRootEntry(img, 'MSDOS.SYS');
  if (!entry) throw new Error('MSDOS.SYS not found');
  const text = Buffer.from(F.readFileEntry(vol, entry)).toString('latin1');
  if (/^Logo=/m.test(text)) throw new Error('MSDOS.SYS already has a Logo= line');
  const updated = text.replace(/\[Options\]\r\n/, '[Options]\r\nLogo=0\r\nBootDelay=0\r\n');
  if (updated === text) throw new Error('MSDOS.SYS: [Options] section not found');
  const res = F.injectDirFiles(img, '/', [{ name: 'MSDOS.SYS', data: Buffer.from(updated, 'latin1') }]);
  if (res.skipped.length) throw new Error('MSDOS.SYS inject skipped: ' + res.skipped.join(', '));
  img = res.image;
  console.log('MSDOS.SYS: added Logo=0, BootDelay=0');
}

const zeroed = F.zeroFreeClusters(img);
console.log(`zeroed ${zeroed} free clusters`);

{
  const vol = F.openImage(img);
  if (findRootEntry(img, 'WIN386.SWP')) throw new Error('verify: WIN386.SWP still present');
  const fontsCluster = F.resolveDir(vol, 'WINDOWS/FONTS');
  if (F.listDir(vol, fontsCluster).some((e) => (e.longName || e.shortName).toUpperCase() === 'KOFONT.TTF'))
    throw new Error('verify: KOFONT.TTF still present');
  const msdos = Buffer.from(F.readFileEntry(vol, findRootEntry(img, 'MSDOS.SYS'))).toString('latin1');
  if (!msdos.includes('Logo=0\r\nBootDelay=0')) throw new Error('verify: MSDOS.SYS edit missing');
  for (const dir of ['GENSE/SAVEDATA', 'GENSEJP/SAVEDATA']) {
    const c = F.resolveDir(vol, dir);
    if (c === null) throw new Error(`verify: ${dir} missing`);
    const n = F.listDir(vol, c).filter((e) => !(e.attr & 0x10)).length;
    console.log(`${dir} intact: ${n} files`);
  }
}

const gz = zlib.gzipSync(Buffer.from(img), { level: 9 });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, gz);
const liveSize = fs.statSync(LIVE).size;
console.log(`wrote ${path.relative(ROOT, OUT)}: ${gz.length} bytes gzip (live: ${liveSize}, saved ${((liveSize - gz.length) / 1048576).toFixed(1)} MB)`);
console.log('Next: swap into docs/, boot-test both KR and JP in the emulator, then deploy.');
