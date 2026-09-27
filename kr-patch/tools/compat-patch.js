#!/usr/bin/env node
// compat-patch.js — HWANSE.EXE 호환성 수정: 스테이터스 창 기술 버그, NT 계열 글꼴 크기.
// build.js가 적용한다. 단독 실행: node kr-patch/tools/compat-patch.js [--in path] [--out path]
'use strict';

const fs = require('fs');
const path = require('path');
const { parsePE } = require('./pe-reloc.js');

const ROOT = path.join(__dirname, '..', '..');

// ---- .reloc (HIGHLOW 목록을 집합으로 편집해 통째로 다시 씀) ----------------------------
function sectionHeaders(buf) {
  const e = buf.readUInt32LE(0x3c);
  const n = buf.readUInt16LE(e + 6);
  const opt = e + 24;
  const table = opt + buf.readUInt16LE(e + 20);
  return {
    relocDirOff: opt + 96 + 5 * 8,
    sections: Array.from({ length: n }, (_, i) => {
      const o = table + i * 40;
      return { hdrOff: o, name: buf.toString('latin1', o, o + 8).replace(/\0+$/, ''), vsize: buf.readUInt32LE(o + 8),
        rva: buf.readUInt32LE(o + 12), rawSize: buf.readUInt32LE(o + 16), rawOff: buf.readUInt32LE(o + 20) };
    }),
  };
}

function readRelocs(buf) {
  const pe = parsePE(buf);
  const rvas = [];
  let p = pe.relocFileOff;
  const end = p + pe.relocSize;
  while (p < end) {
    const page = buf.readUInt32LE(p);
    const size = buf.readUInt32LE(p + 4);
    if (size === 0) break;
    for (let i = 0; i < (size - 8) / 2; i++) {
      const e = buf.readUInt16LE(p + 8 + i * 2);
      if (e >> 12 === 3) rvas.push(page + (e & 0xfff));
      else if (e >> 12 !== 0) throw new Error(`unexpected reloc type ${e >> 12}`);
    }
    p += size;
  }
  return rvas;
}

function serializeRelocs(rvas) {
  const pages = new Map();
  for (const r of [...new Set(rvas)].sort((a, b) => a - b)) {
    const page = r & ~0xfff;
    if (!pages.has(page)) pages.set(page, []);
    pages.get(page).push(r & 0xfff);
  }
  const blocks = [];
  for (const [page, offs] of pages) {
    const n = offs.length + (offs.length % 2);
    const b = Buffer.alloc(8 + n * 2);
    b.writeUInt32LE(page, 0);
    b.writeUInt32LE(b.length, 4);
    offs.forEach((o, i) => b.writeUInt16LE((3 << 12) | o, 8 + i * 2));
    blocks.push(b);
  }
  return Buffer.concat(blocks);
}

function writeRelocs(buf, rvas) {
  const { relocDirOff, sections } = sectionHeaders(buf);
  const rva = buf.readUInt32LE(relocDirOff);
  const sec = sections.find((s) => s.rva === rva);
  if (!sec) throw new Error('.reloc directory does not start a section');
  const data = serializeRelocs(rvas);
  if (data.length > sec.rawSize) throw new Error('.reloc does not fit its section');
  buf.fill(0, sec.rawOff, sec.rawOff + sec.rawSize);
  data.copy(buf, sec.rawOff);
  buf.writeUInt32LE(data.length, relocDirOff + 4);
  if (data.length > sec.vsize) buf.writeUInt32LE(data.length, sec.hdrOff + 8);
}

function editRelocs(buf, remove, add) {
  const rvas = readRelocs(buf);
  const set = new Set(rvas);
  for (const r of remove) if (!set.delete(r)) throw new Error(`reloc 0x${r.toString(16)} not found`);
  for (const r of add) set.add(r);
  writeRelocs(buf, [...set]);
}

// ---- 1) skill fix -------------------------------------------------------------------
const SKILL_FN_VA = 0x410e40;
const SKILL_FN_LEN = 0xe3;
const SKILL_FN_NEW = Buffer.from(
  '5589e55356570fb6053ee359000fb698e97645008b349d88244d0069dbd80000000fb61541e35900' +
  '8d14528d9c53a67745008b7d0831c93a4d0c732d0fb6140b85d2741f8b14d60fb652118b04853' +
  '0db59000fb7400e39d00f9cc2420fb6053ee3590088140f41ebce83f90c7307c6040f0041ebf4' +
  '5f5e5b5dc3', 'hex');
const SKILL_FN_NEW_RELOCS = [0x09, 0x10, 0x17, 0x24, 0x2e, 0x4e, 0x5f];
const SKILL_BUG_VA = 0x410ecb;
const SKILL_BUG_BYTES = Buffer.from('8b04c588244d0033d28a5011', 'hex');

function applySkillFix(buf) {
  const pe = parsePE(buf);
  const va2fo = (va) => pe.rvaToFile(va - pe.imageBase);
  const fnFo = va2fo(SKILL_FN_VA);
  const bugFo = va2fo(SKILL_BUG_VA);

  if (buf.subarray(fnFo, fnFo + SKILL_FN_NEW.length).equals(SKILL_FN_NEW)) return 'already applied';
  if (!buf.subarray(bugFo, bugFo + SKILL_BUG_BYTES.length).equals(SKILL_BUG_BYTES)) {
    throw new Error('skill fix: unexpected bytes at 0x410ECB (not the original HWANSE.EXE, or the wiki NOP patch is already applied)');
  }

  const fnRVA = SKILL_FN_VA - pe.imageBase;
  const old = readRelocs(buf).filter((r) => r >= fnRVA && r < fnRVA + SKILL_FN_LEN);
  if (old.length !== SKILL_FN_NEW_RELOCS.length) {
    throw new Error(`skill fix: expected ${SKILL_FN_NEW_RELOCS.length} relocs in function, found ${old.length}`);
  }
  editRelocs(buf, old, SKILL_FN_NEW_RELOCS.map((o) => fnRVA + o));

  buf.fill(0xcc, fnFo, fnFo + SKILL_FN_LEN);
  SKILL_FN_NEW.copy(buf, fnFo);
  return 'applied';
}

// ---- 2) font fix --------------------------------------------------------------------
const FONT_STUB_VA = 0x410ec0;
const FONT_STUB = Buffer.from(
  '565783ec3c8b74244889e76a0f59f3a5ff15bc045a0085c0781e833c24007504c60424108b44240485c0' +
  '740c7806ff4c2404eb04ff44240454ff15c4035a0083c43c5f5ec20400', 'hex');
const FONT_STUB_RELOCS = [0x12, 0x3b];
const FONT_CALL_VA = 0x41b140;
const FONT_CALL_OLD = Buffer.from('50ff15c4035a00', 'hex');
const FONT_CALL_RELOC_VA = 0x41b143;

function applyFontFix(buf) {
  const pe = parsePE(buf);
  const va2fo = (va) => pe.rvaToFile(va - pe.imageBase);
  const stubFo = va2fo(FONT_STUB_VA);
  const callFo = va2fo(FONT_CALL_VA);
  const rel = FONT_STUB_VA - (FONT_CALL_VA + 6);
  const callNew = Buffer.alloc(7);
  callNew[0] = 0x50;
  callNew[1] = 0xe8;
  callNew.writeInt32LE(rel, 2);
  callNew[6] = 0x90;

  if (buf.subarray(callFo, callFo + 7).equals(callNew)) return 'already applied';
  if (!buf.subarray(callFo, callFo + 7).equals(FONT_CALL_OLD)) throw new Error('font fix: unexpected bytes at 0x41B140');
  const cave = buf.subarray(stubFo, stubFo + FONT_STUB.length);
  if (!cave.every((b) => b === 0xcc)) throw new Error('font fix: stub space at 0x410EC0 is not free (skill fix missing?)');

  editRelocs(buf, [FONT_CALL_RELOC_VA - pe.imageBase], FONT_STUB_RELOCS.map((o) => FONT_STUB_VA - pe.imageBase + o));
  FONT_STUB.copy(buf, stubFo);
  callNew.copy(buf, callFo);
  return 'applied';
}

module.exports = { applySkillFix, applyFontFix, readRelocs, serializeRelocs };

if (require.main === module) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : fallback;
  };
  const inPath = arg('in', path.join(ROOT, 'kr-patch/build/HWANSE.EXE'));
  const outPath = arg('out', inPath);
  const buf = fs.readFileSync(inPath);
  console.log('skill fix: ' + applySkillFix(buf));
  console.log('font fix: ' + applyFontFix(buf));
  fs.writeFileSync(outPath, buf);
  console.log(`wrote ${path.relative(ROOT, outPath)}`);
}
