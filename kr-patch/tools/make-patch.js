'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Patch = require('../../docs/patch-core.js');

const ROOT = path.join(__dirname, '..', '..');
const ORIGINAL_DIR = path.join(ROOT, 'original', 'kr');
const VARIANT_DIR = path.join(ROOT, 'original', 'kr-variants');
const BUILD_DIR = path.join(ROOT, 'kr-patch', 'build');
const OUT_PATH = path.join(ROOT, 'docs', 'patch-data.js');
const FILES = ['HWANSE.EXE', 'GENSE.FLD'];
const MERGE_GAP = 8;
const VARIANT_MAX_BYTES = 256;

function writeVarint(out, value) {
  while (value >= 0x80) {
    out.push((value % 0x80) | 0x80);
    value = Math.floor(value / 0x80);
  }
  out.push(value);
}

function diffRuns(src, dst) {
  const runs = [];
  let i = 0;
  while (i < dst.length) {
    if (i < src.length && src[i] === dst[i]) { i++; continue; }
    const start = i;
    let end = i + 1;
    let probe = end;
    while (probe < dst.length && probe - end < MERGE_GAP) {
      if (probe >= src.length || src[probe] !== dst[probe]) end = probe + 1;
      probe++;
    }
    runs.push([start, end]);
    i = end;
  }
  return runs;
}

function makePatch(src, dst) {
  const runs = diffRuns(src, dst);
  const body = [];
  let last = 0;
  for (const [start, end] of runs) {
    writeVarint(body, start - last);
    writeVarint(body, end - start);
    for (let k = start; k < end; k++) body.push(dst[k]);
    last = end;
  }
  const head = Buffer.alloc(Patch.HEADER_SIZE);
  Buffer.from(Patch.MAGIC).copy(head, 0);
  head.writeUInt32LE(src.length, 4);
  head.writeUInt32LE(Patch.crc32(src), 8);
  head.writeUInt32LE(dst.length, 12);
  head.writeUInt32LE(Patch.crc32(dst), 16);
  head.writeUInt32LE(runs.length, 20);
  return { bytes: Buffer.concat([head, Buffer.from(body)]), runs: runs.length };
}

function variantFiles() {
  if (!fs.existsSync(VARIANT_DIR)) return [];
  return fs.readdirSync(VARIANT_DIR)
    .filter((f) => !f.startsWith('.'))
    .map((f) => ({ name: f, bytes: new Uint8Array(fs.readFileSync(path.join(VARIANT_DIR, f))) }));
}

function makeVariant(src, file) {
  const fix = [];
  let count = 0;
  let i = 0;
  while (i < src.length) {
    if (src[i] === file.bytes[i]) { i++; continue; }
    const start = i;
    while (i < src.length && src[i] !== file.bytes[i]) i++;
    fix.push([start, Buffer.from(src.subarray(start, i)).toString('hex')]);
    count += i - start;
  }
  return { variant: { size: file.bytes.length, crc: Patch.crc32(file.bytes), fix }, count };
}

function variantsFor(name, src, files) {
  const srcCrc = Patch.crc32(src);
  const out = [];
  for (const file of files) {
    if (file.bytes.length !== src.length) continue;
    const crc = Patch.crc32(file.bytes);
    if (crc === srcCrc) {
      console.log(`  ${file.name}: ${name} 원본과 같음`);
      continue;
    }
    if (out.some((v) => v.crc === crc)) continue;
    const { variant, count } = makeVariant(src, file);
    if (count > VARIANT_MAX_BYTES) {
      console.log(`  ${file.name}: ${name}와 ${count}B 달라 수정본으로 받지 않음`);
      continue;
    }
    const restored = Patch.restore(file.bytes, variant);
    if (!restored || Patch.crc32(restored) !== srcCrc) {
      console.error(`${file.name}: 원본으로 되돌린 결과가 ${name} 원본과 다릅니다`);
      process.exit(1);
    }
    out.push(variant);
    console.log(`  ${file.name}: ${name} 수정본 · ${variant.fix.length}곳 ${count}B · CRC ${crc.toString(16)}`);
  }
  return out;
}

function main() {
  const files = variantFiles();
  const data = {};
  for (const name of FILES) {
    const srcPath = path.join(ORIGINAL_DIR, name);
    const dstPath = path.join(BUILD_DIR, name);
    for (const p of [srcPath, dstPath]) {
      if (!fs.existsSync(p)) {
        console.error(`없음: ${path.relative(ROOT, p)}`);
        process.exit(1);
      }
    }
    const src = new Uint8Array(fs.readFileSync(srcPath));
    const dst = new Uint8Array(fs.readFileSync(dstPath));
    const { bytes, runs } = makePatch(src, dst);

    const applied = Patch.apply(src, new Uint8Array(bytes));
    if (!applied.out || Buffer.compare(Buffer.from(applied.out), Buffer.from(dst)) !== 0) {
      console.error(`${name}: 패치를 원본에 적용한 결과가 빌드 결과와 다릅니다`);
      process.exit(1);
    }

    const variants = variantsFor(name, src, files);
    for (const v of variants) {
      const res = Patch.apply(files.find((f) => f.bytes.length === v.size && Patch.crc32(f.bytes) === v.crc).bytes,
        new Uint8Array(bytes), variants);
      if (!res.out || !res.variant || Buffer.compare(Buffer.from(res.out), Buffer.from(dst)) !== 0) {
        console.error(`${name}: 수정본에 적용한 결과가 빌드 결과와 다릅니다`);
        process.exit(1);
      }
    }

    const gz = zlib.gzipSync(bytes, { level: 9 });
    data[name] = {
      size: src.length,
      crc: Patch.crc32(src),
      outSize: dst.length,
      outCrc: Patch.crc32(dst),
      variants,
      gz: gz.toString('base64'),
    };
    console.log(`${name}: ${runs}구간 · 패치 ${bytes.length}B → gzip ${gz.length}B · ` +
      `원본 CRC ${Patch.crc32(src).toString(16)} → ${Patch.crc32(dst).toString(16)}`);
  }
  fs.writeFileSync(OUT_PATH, `window.SUIKO_PATCHES = ${JSON.stringify(data)};\n`);
  console.log(`쓴 파일: ${path.relative(ROOT, OUT_PATH)} (${fs.statSync(OUT_PATH).size}B)`);
}

main();
