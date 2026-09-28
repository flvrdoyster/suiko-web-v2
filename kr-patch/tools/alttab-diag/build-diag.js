#!/usr/bin/env node
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

const DIAG_VA = 0x5bf000;
const DIAG_RVA = 0x1bf000;
const fo = (va) => va - 0x401000 + 0x400;
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

const tmp = path.join(os.tmpdir(), `hwanse-diag-${process.pid}.bin`);
execFileSync('nasm', ['-f', 'bin', '-o', tmp, path.join(__dirname, 'diag.asm')]);
const code = fs.readFileSync(tmp);
fs.unlinkSync(tmp);
const [present, present2, act, restore, log] = [0, 4, 8, 12, 16].map((o) => code.readUInt32LE(o));

let buf = fs.readFileSync(inPath);

const winTmp = path.join(os.tmpdir(), `hwanse-diag-win-${process.pid}.bin`);
execFileSync('nasm', ['-f', 'bin', '-DDIAG', `-DDIAG_LOG=0x${log.toString(16)}`, '-o', winTmp,
  path.join(__dirname, '..', 'compat-window.asm')]);
const winCode = fs.readFileSync(winTmp);
if (winCode.length > 0xb00) throw new Error('diag .patch code overlaps its data at 0x5BEB00');
fs.unlinkSync(winTmp);
{
  const e = buf.readUInt32LE(0x3c);
  const table = e + 24 + buf.readUInt16LE(e + 20);
  const n = buf.readUInt16LE(e + 6);
  const hdr = table + (n - 1) * 40;
  if (buf.toString('latin1', hdr, hdr + 8).replace(/\0+$/, '') !== '.patch') throw new Error('last section is not .patch');
  const rawOff = buf.readUInt32LE(hdr + 20);
  if (rawOff + buf.readUInt32LE(hdr + 16) !== buf.length) throw new Error('.patch is not at the end of the file');
  const raw = Buffer.concat([winCode, Buffer.alloc((0x200 - (winCode.length % 0x200)) % 0x200)]);
  buf = Buffer.concat([buf.subarray(0, rawOff), raw]);
  buf.writeUInt32LE(raw.length, hdr + 16);
}

patch(buf, 0x41756f, 'e89feaffff', Buffer.concat([Buffer.from([0xe8]), rel(0x41756f, restore)]));

patch(buf, 0x417be5, '837d80000f8412000000', Buffer.concat([Buffer.from([0xe8]), rel(0x417be5, present), Buffer.from('7415909090', 'hex')]));
patch(buf, 0x417728, '837dfc000f8412000000', Buffer.concat([Buffer.from([0xe8]), rel(0x417728, present2), Buffer.from('7415909090', 'hex')]));
patch(buf, 0x401b2c, Buffer.concat([Buffer.from([0xe8]), rel(0x401b2c, 0x42f460)]), Buffer.concat([Buffer.from([0xe8]), rel(0x401b2c, act)]));

const e = buf.readUInt32LE(0x3c);
const opt = e + 24;
const nsec = buf.readUInt16LE(e + 6);
const table = opt + buf.readUInt16LE(e + 20);
const slot = table + nsec * 40;
if (nsec !== 7 || !buf.subarray(slot, slot + 40).equals(Buffer.alloc(40))) throw new Error('unexpected section table');
if (buf.length % 0x200) throw new Error('file not aligned');
if (buf.readUInt32LE(opt + 56) !== DIAG_RVA) throw new Error('unexpected SizeOfImage');
const raw = Buffer.concat([code, Buffer.alloc((0x200 - (code.length % 0x200)) % 0x200)]);
const hdr = Buffer.alloc(40);
hdr.write('.diag', 0, 'latin1');
hdr.writeUInt32LE(0x1000, 8);
hdr.writeUInt32LE(DIAG_RVA, 12);
hdr.writeUInt32LE(raw.length, 16);
hdr.writeUInt32LE(buf.length, 20);
hdr.writeUInt32LE(0xe0000020, 36);
hdr.copy(buf, slot);
buf.writeUInt16LE(nsec + 1, e + 6);
buf.writeUInt32LE(DIAG_RVA + 0x1000, opt + 56);
buf = Buffer.concat([buf, raw]);
if (code.readUInt32LE(0) - DIAG_VA >= code.length) throw new Error('bad address table');

fs.writeFileSync(outPath, buf);
console.log(`wrote ${path.relative(ROOT, outPath)} (${buf.length} bytes)`);
