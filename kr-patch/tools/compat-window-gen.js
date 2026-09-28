#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ASM = path.join(__dirname, 'compat-window.asm');
const JS = path.join(__dirname, 'compat-patch.js');
const SHIFT = 0x100000;
const ENTRIES = 8;
const MAX_CODE = 0xb00;

function assemble(base) {
  const out = path.join(os.tmpdir(), `compat-window-${process.pid}-${base.toString(16)}.bin`);
  execFileSync('nasm', ['-f', 'bin', `-DBASE=0x${base.toString(16)}`, '-o', out, ASM]);
  const code = fs.readFileSync(out);
  fs.unlinkSync(out);
  return code;
}

const a = assemble(0x400000);
const b = assemble(0x400000 + SHIFT);
if (a.length !== b.length) throw new Error('code size depends on the base address');
if (a.length > MAX_CODE) throw new Error(`code is 0x${a.length.toString(16)} bytes, over 0x${MAX_CODE.toString(16)}`);
for (let i = 0; i < ENTRIES; i++) {
  if (a[i * 5] !== 0xe9) throw new Error(`entry ${i} is not a 5-byte jmp`);
}

const relocs = [];
const covered = new Uint8Array(a.length);
for (let i = 0; i + 4 <= a.length; i++) {
  if (b.readUInt32LE(i) - a.readUInt32LE(i) === SHIFT) {
    relocs.push(i);
    covered.fill(1, i, i + 4);
    i += 3;
  }
}
for (let i = 0; i < a.length; i++) {
  if (a[i] !== b[i] && !covered[i]) throw new Error(`byte 0x${i.toString(16)} moves with the base but is not a whole address`);
}

const hex = a.toString('hex');
const lines = [];
for (let i = 0; i < hex.length; i += 100) lines.push(`'${hex.slice(i, i + 100)}'`);
const rel = [];
for (let i = 0; i < relocs.length; i += 10) rel.push(relocs.slice(i, i + 10).map((r) => '0x' + r.toString(16)).join(', '));

let js = fs.readFileSync(JS, 'utf8');
const code = `const PATCH_CODE = Buffer.from(\n  ${lines.join(' +\n  ')}, 'hex');`;
const relList = `const PATCH_RELOCS = [\n  ${rel.join(',\n  ')},\n];`;
if (!/const PATCH_CODE = Buffer\.from\([\s\S]*?, 'hex'\);/.test(js) || !/const PATCH_RELOCS = \[[\s\S]*?\];/.test(js)) {
  throw new Error('PATCH_CODE / PATCH_RELOCS not found in compat-patch.js');
}
js = js.replace(/const PATCH_CODE = Buffer\.from\([\s\S]*?, 'hex'\);/, code)
  .replace(/const PATCH_RELOCS = \[[\s\S]*?\];/, relList);
fs.writeFileSync(JS, js);
console.log(`compat-window: ${a.length} bytes, ${relocs.length} relocations -> ${path.relative(process.cwd(), JS)}`);
