#!/usr/bin/env node
// build-diag.js — 알트탭 조사용 로깅 HWANSE.EXE 빌드(배포용 아님, nasm 필요).
// node kr-patch/tools/alttab-diag/build-diag.js [--in path] [--out path]
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const inPath = arg('in', path.join(ROOT, 'kr-patch/build/HWANSE.EXE'));
const outPath = arg('out', path.join(ROOT, 'kr-patch/build/HWANSE-diag.EXE'));

const DIAG_VA = 0x5be000;
const DIAG_RVA = 0x1be000;
const fo = (va) => va - 0x401000 + 0x400; // .text only
const rel = (at, target) => {
  const b = Buffer.alloc(4);
  b.writeInt32LE(target - (at + 5));
  return b;
};

function patch(buf, va, oldHex, next) {
  const o = fo(va);
  const old = Buffer.isBuffer(oldHex) ? oldHex : Buffer.from(oldHex, 'hex');
  if (!buf.subarray(o, o + old.length).equals(old)) {
    throw new Error(`unexpected bytes at 0x${va.toString(16)}: ${buf.subarray(o, o + old.length).toString('hex')}`);
  }
  next.copy(buf, o);
}

// diag.asm 어셈블 — 앞 16바이트가 훅 진입점 주소표
const tmp = path.join(os.tmpdir(), `hwanse-diag-${process.pid}.bin`);
execFileSync('nasm', ['-f', 'bin', '-o', tmp, path.join(__dirname, 'diag.asm')]);
const code = fs.readFileSync(tmp);
fs.unlinkSync(tmp);
const [present, present2, act, restore] = [0, 4, 8, 12].map((o) => code.readUInt32LE(o));

let buf = fs.readFileSync(inPath);

// 복구 스텁 (죽은 Flip 래퍼 자리)
const stub = Buffer.alloc(0x4c, 0xcc);
Buffer.from('e8ade9ffff85c0750ce82aefffffe8f29dffff31c0c3', 'hex').copy(stub);
patch(buf, 0x417661, '558bec83ec045356570fbf05', stub); // original wrapper prologue
patch(buf, 0x41756f, 'e89feaffff', Buffer.from('e8ed000000', 'hex'));

// 훅
patch(buf, 0x417be5, '837d80000f8412000000', Buffer.concat([Buffer.from([0xe8]), rel(0x417be5, present), Buffer.from('7415909090', 'hex')]));
patch(buf, 0x417728, '837dfc000f8412000000', Buffer.concat([Buffer.from([0xe8]), rel(0x417728, present2), Buffer.from('7415909090', 'hex')]));
patch(buf, 0x401b2c, Buffer.concat([Buffer.from([0xe8]), rel(0x401b2c, 0x42f460)]), Buffer.concat([Buffer.from([0xe8]), rel(0x401b2c, act)]));
patch(buf, 0x417661, Buffer.concat([Buffer.from([0xe8]), rel(0x417661, 0x416013)]), Buffer.concat([Buffer.from([0xe8]), rel(0x417661, restore)]));

// 새 섹션 .diag를 파일 끝에
const e = buf.readUInt32LE(0x3c);
const opt = e + 24;
const nsec = buf.readUInt16LE(e + 6);
const table = opt + buf.readUInt16LE(e + 20);
const slot = table + nsec * 40;
if (nsec !== 6 || !buf.subarray(slot, slot + 40).equals(Buffer.alloc(40))) throw new Error('unexpected section table');
if (buf.length % 0x200) throw new Error('file not aligned');
if (buf.readUInt32LE(opt + 56) !== DIAG_RVA) throw new Error('unexpected SizeOfImage');
const raw = Buffer.concat([code, Buffer.alloc((0x200 - (code.length % 0x200)) % 0x200)]);
const hdr = Buffer.alloc(40);
hdr.write('.diag', 0, 'latin1');
hdr.writeUInt32LE(0x1000, 8); // VirtualSize
hdr.writeUInt32LE(DIAG_RVA, 12);
hdr.writeUInt32LE(raw.length, 16);
hdr.writeUInt32LE(buf.length, 20);
hdr.writeUInt32LE(0xe0000020, 36); // code | exec | read | write
hdr.copy(buf, slot);
buf.writeUInt16LE(nsec + 1, e + 6);
buf.writeUInt32LE(DIAG_RVA + 0x1000, opt + 56);
buf = Buffer.concat([buf, raw]);
if (code.readUInt32LE(0) - DIAG_VA >= code.length) throw new Error('bad address table');

fs.writeFileSync(outPath, buf);
console.log(`wrote ${path.relative(ROOT, outPath)} (${buf.length} bytes)`);
