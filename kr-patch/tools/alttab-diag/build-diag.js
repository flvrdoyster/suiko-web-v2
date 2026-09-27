#!/usr/bin/env node
// build-diag.js — builds a logging HWANSE.EXE for the Alt+Tab black-screen investigation.
// Not for distribution.
//
// Usage: node kr-patch/tools/alttab-diag/build-diag.js [--in path] [--out path]
// Defaults: kr-patch/build/HWANSE.EXE (build.js output) -> kr-patch/build/HWANSE-diag.EXE.
// Needs nasm on PATH.
//
// On top of the input exe it applies:
//   - the restore stub that was tried as a fix (no effect on Win11): the dead Flip wrapper
//     0x417661 becomes `call 0x416013 / if ok: call 0x416599 (palette), call 0x411466
//     (full redraw)`, and the game's only restore call (0x41756F) goes through it;
//   - a new RWX section .diag (VA 0x5BE000, diag.asm) and four hooks that log to HWDIAG.TXT:
//     0x417BE5 present-strip Blt HRESULT, 0x417728 generic Blt wrapper HRESULT (both only
//     when the value changes), 0x401B2C WM_ACTIVATEAPP + primary IsLost, and the restore
//     result.
// .reloc is not updated for the new code: the exe always loads at its preferred base.
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

// Assemble diag.asm; its first 16 bytes are the addresses of the four hook entry points.
const tmp = path.join(os.tmpdir(), `hwanse-diag-${process.pid}.bin`);
execFileSync('nasm', ['-f', 'bin', '-o', tmp, path.join(__dirname, 'diag.asm')]);
const code = fs.readFileSync(tmp);
fs.unlinkSync(tmp);
const [present, present2, act, restore] = [0, 4, 8, 12].map((o) => code.readUInt32LE(o));

let buf = fs.readFileSync(inPath);

// Restore stub in the dead Flip wrapper (see header), padded with INT3 to the wrapper's end.
const stub = Buffer.alloc(0x4c, 0xcc);
Buffer.from('e8ade9ffff85c0750ce82aefffffe8f29dffff31c0c3', 'hex').copy(stub);
patch(buf, 0x417661, '558bec83ec045356570fbf05', stub); // original wrapper prologue
patch(buf, 0x41756f, 'e89feaffff', Buffer.from('e8ed000000', 'hex'));

// Hooks.
patch(buf, 0x417be5, '837d80000f8412000000', Buffer.concat([Buffer.from([0xe8]), rel(0x417be5, present), Buffer.from('7415909090', 'hex')]));
patch(buf, 0x417728, '837dfc000f8412000000', Buffer.concat([Buffer.from([0xe8]), rel(0x417728, present2), Buffer.from('7415909090', 'hex')]));
patch(buf, 0x401b2c, Buffer.concat([Buffer.from([0xe8]), rel(0x401b2c, 0x42f460)]), Buffer.concat([Buffer.from([0xe8]), rel(0x401b2c, act)]));
patch(buf, 0x417661, Buffer.concat([Buffer.from([0xe8]), rel(0x417661, 0x416013)]), Buffer.concat([Buffer.from([0xe8]), rel(0x417661, restore)]));

// New section .diag appended at the end of the file.
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
