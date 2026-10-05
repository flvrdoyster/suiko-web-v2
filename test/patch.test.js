'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const Patch = require(path.join(ROOT, 'docs', 'patch-core.js'));
const sandbox = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'docs', 'patch-data.js'), 'utf8'))(sandbox);
const DATA = sandbox.SUIKO_PATCHES;

let failures = 0;
function check(cond, msg) {
  if (cond) { console.log('  ok  ' + msg); }
  else { console.log('FAIL  ' + msg); failures++; }
}
const same = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

const names = Object.keys(DATA);
check(names.length === 2 && names.includes('HWANSE.EXE') && names.includes('GENSE.FLD'),
  'patch-data.js has HWANSE.EXE and GENSE.FLD');

for (const name of names) {
  const meta = DATA[name];
  const patch = new Uint8Array(zlib.gunzipSync(Buffer.from(meta.gz, 'base64')));
  const variants = meta.variants;
  const head = Patch.parse(patch);
  check(head && head.srcSize === meta.size && head.srcCrc === meta.crc &&
    head.dstSize === meta.outSize && head.dstCrc === meta.outCrc,
    `${name}: metadata matches the patch header`);

  const srcPath = path.join(ROOT, 'original', 'kr', name);
  if (!fs.existsSync(srcPath)) { console.log(`  skip  ${name}: original/kr missing`); continue; }
  const src = new Uint8Array(fs.readFileSync(srcPath));

  const res = Patch.apply(src, patch);
  check(res.out && res.out.length === meta.outSize && Patch.crc32(res.out) === meta.outCrc,
    `${name}: patch turns the retail file into the expected output`);

  const buildPath = path.join(ROOT, 'kr-patch', 'build', name);
  if (fs.existsSync(buildPath)) {
    check(res.out && same(res.out, fs.readFileSync(buildPath)),
      `${name}: output is byte-identical to kr-patch/build/${name}`);
  }

  check(Patch.apply(res.out, patch).error === 'already', `${name}: patched file is reported as already patched`);

  const wrong = src.slice();
  wrong[wrong.length >> 1] ^= 0xff;
  const bad = Patch.apply(wrong, patch);
  check(bad.error === 'source' && bad.size === wrong.length, `${name}: modified source is rejected`);
  check(Patch.apply(src.subarray(0, src.length - 1), patch).error === 'source', `${name}: truncated source is rejected`);
  check(Patch.apply(src, patch.subarray(0, patch.length - 1)).error !== undefined &&
    Patch.apply(src, patch.subarray(0, patch.length - 1)).out === undefined,
    `${name}: truncated patch does not produce output`);

  const edited = src.slice();
  edited[16] ^= 0xff;
  edited[17] ^= 0xff;
  const synthetic = [{ size: edited.length, crc: Patch.crc32(edited), fix: [[16, Buffer.from(src.subarray(16, 18)).toString('hex')]] }];
  const fromEdited = Patch.apply(edited, patch, synthetic);
  check(fromEdited.variant === true && fromEdited.out && same(fromEdited.out, res.out),
    `${name}: known edited copy is restored and patched to the same output`);
  const wrongFix = [{ size: edited.length, crc: Patch.crc32(edited), fix: [[16, '0000']] }];
  check(Patch.apply(edited, patch, wrongFix).error === 'variant', `${name}: variant whose restore misses the original is rejected`);
  check(Patch.apply(edited, patch, variants).error === 'source', `${name}: unknown edited copy is rejected`);

  const variantDir = path.join(ROOT, 'original', 'kr-variants');
  if (fs.existsSync(variantDir)) {
    for (const f of fs.readdirSync(variantDir).filter((f) => !f.startsWith('.'))) {
      const bytes = new Uint8Array(fs.readFileSync(path.join(variantDir, f)));
      if (bytes.length !== src.length) continue;
      const out = Patch.apply(bytes, patch, variants);
      check(out.out && same(out.out, res.out), `${name}: original/kr-variants/${f} patches to the same output`);
    }
  }
}

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
