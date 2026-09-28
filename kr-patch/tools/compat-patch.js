#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parsePE } = require('./pe-reloc.js');

const ROOT = path.join(__dirname, '..', '..');

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

const PATCH_SECTION = { name: '.patch', va: 0x5be000, init: 0x5be000, createSurface: 0x5be005, palAttach: 0x5be00a, presentC: 0x5be00f, palHook1: 0x5be014, palHook2: 0x5be019, fillB: 0x5be01e };
const PATCH_CODE = Buffer.from(
  'e91e000000e983000000e940010000e97a010000e98f010000e996010000e9ba010000689ce45b00ff15c8045a0089c668a9' +
  'e45b0056ff1548045a00a390e45b0068a3e45b00ff15c8045a0089c668b2e45b0056ff1548045a00a388e45b0068c4e45b00' +
  '56ff1548045a00a38ce45b0068d5e45b0056ff1548045a00a394e45b006a006860044400e9d337e4ff66833dec764600010f' +
  '85ab0000008b442408f74068000200007419c7406840000000c74008e0010000c7400c800200008348040681480400100000' +
  'c7404820000000c7404c60000000c7405000000000c7405408000000c7405800000000c7405c00000000c7406000000000c7' +
  '406400000000816068ffbfffff81486800080000ff742410ff742410ff742410ff7424108b04248b00ff501885c075198b0d' +
  'c476460085c9740f8b54240c8b1251528b02ff507c31c0c210008b4424048b00ff601866833dec7646000175308b3dc47646' +
  '0085ff7426be010000008b04b5d8ab550085c0740d8b0085c0740757508b10ff527c4681fec000000072dfe9cf83e5ffff75' +
  '0cff7508e8b900000083c408c745fc00000000e9499be5ffe81300000031c0e9be84e5ffe80700000031c0e97185e5ff6683' +
  '3dec7646000175126878e45b006878e45b00e87900000083c408c3833d8ce45b00007460833d90e45b00007457ff35f07646' +
  '00ff15ec045a0089c7e8c90100000fb64ddc85c074088d8100000001eb0e8b15e87646008b048a25ffffff0050ff158ce45b' +
  '0089c6568d8570ffffff5057ff1590e45b0089f8e82a02000056ff158c035a00c7458000000000e99399e5ff5589e5535657' +
  '833d88e45b00000f8461010000a1e876460085c00f845401000081eca004000089e70fbf05d07646008b0485d8ab550085c0' +
  '0f84300100008b3089b794040000578dbf2804000031c0b91b000000f3ab5fc787280400006c0000006a006a018d87280400' +
  '00506a00568b06ff506485c00f85f200000083bf7c040000080f85d00000008b5d088b430c2b43040f8ec1000000f7d88947' +
  '08c707280000008b8738040000894704c7470c0100080031c089471089471489471889471c894720894724ff35f0764600ff' +
  '15ec045a00898798040000e89b00000089879c04000031c985c0740b66894c4f28fec175f7eb168b15e87646008b048a0fc8' +
  'c1e80889448f28fec175f08b5d088b550c8b43040faf873804000003874c0400008b4b0c2b4b04ffb79c0400005750516a00' +
  '6a00ff33518b43082b0350ff7204ff32ffb798040000ff1588e45b008b8798040000e8be0000008bb794040000ffb74c0400' +
  '00568b06ff908000000081c4a00400005f5e5b5dc353565789c3833d94e45b00000f84860000006a2653ff1594e45b00a900' +
  '0100007476c70500eb5b00000300018b15e876460031c931f68b048a25ffffff003b048d04eb5b00740889048d04eb5b0046' +
  '4181f90001000072dea198e45b0085c0740b85f6741b50ff158c035a006800eb5b00ff15bc035a00a398e45b0085c074186a' +
  '005053ff1590035a0053ff15ac035a00b801000000eb0231c05f5e5bc350ff35f0764600ff15f4045a00c390000000000000' +
  '000080020000e001000000000000000000000000000000000000000000005553455233320047444933320046696c6c526563' +
  '7400536574444942697473546f44657669636500437265617465536f6c696442727573680047657444657669636543617073' +
  '00', 'hex');
const PATCH_RELOCS = [
  0x24, 0x2a, 0x31, 0x38, 0x3d, 0x42, 0x48, 0x4f, 0x56, 0x5b,
  0x60, 0x67, 0x6c, 0x71, 0x78, 0x7d, 0x84, 0x90, 0x12c, 0x152,
  0x15b, 0x16b, 0x1c3, 0x1cb, 0x1d0, 0x1df, 0x1e8, 0x1f1, 0x1f7, 0x214,
  0x223, 0x234, 0x242, 0x25a, 0x266, 0x27d, 0x284, 0x31b, 0x321, 0x349,
  0x39c, 0x3d2, 0x3e2, 0x3ef, 0x3f9, 0x40c, 0x415, 0x424, 0x433, 0x438,
  0x43e, 0x443, 0x451, 0x458, 0x46c, 0x472,
];

const jmp = (from, to, pad) => {
  const b = Buffer.alloc(5 + pad, 0xcc);
  b[0] = 0xe9;
  b.writeInt32LE(to - (from + 5), 1);
  return b.toString('hex');
};

const call = (from, to) => {
  const b = Buffer.alloc(5);
  b[0] = 0xe8;
  b.writeInt32LE(to - (from + 5), 1);
  return b.toString('hex');
};

const WINDOW_EDITS = [
  { va: 0x401e5e, old: 'c745e86c000000', new: 'c745e800000000' },
  { va: 0x401ef6, old: '6a006a01680000cf00', new: '6a006a00680000ca00' },
  { va: 0x401f2b, old: '680000cf00', new: '680000ca00' },
  {
    va: 0x401b9f,
    old: '8b4514c74018800200008b4514c7401ce00100008b4514c7402080020000' +
      '8b4514c74024e0010000e91b020000',
    new: 'a1aca1550085c0741e3b450874198b4514b980020000bae001000089481889501c' +
      '894820895024e91c020000cc',
    relocs: [0x1],
  },
  {
    va: 0x43a790,
    old: '00'.repeat(76),
    new: '8b45b83d000100000f847b74fcff83c8023d06010000752f837d100d7529f64517207423' +
      '807db8067416f64517407510e8a1b9fdff9883f00150e8ed77fcff5931c0e92b76fcffe90b76fcff',
  },
  { va: 0x401d6c, old: '817db8000100000f84a0feffffe969000000', new: 'e91f8a0300' + 'cc'.repeat(13) },
  { va: 0x401d66, old: '0f84e0feffff', new: '0f847b000000' },
  {
    va: 0x401c4c,
    old: '8b45108945ace920000000e92d0000008b45102d429c000050e8228d010083c404e917000000e912000000' +
      '817dac419c00000f8405000000e9d3ffffffe959010000',
    new: '68e001000068800200006a006a0089e06a006a00680000ca0050ff155c055a0058595a29c25829c86a46' +
      '50526a006a006a00ff35aca15500ff15f0045a00c3' + 'cc'.repeat(3),
    relocs: [0x1c, 0x34, 0x3a],
  },
  { va: 0x4020a3, old: '6a05a1aca1550050ff1504055a00', new: 'e8a4fbffff' + '90'.repeat(9), oldRelocs: [0x3, 0xa] },
  { va: 0x401859, old: '6a006860044400', new: jmp(0x401859, PATCH_SECTION.init, 2).replace(/cc/g, '90'), oldRelocs: [0x3] },
  { va: 0x417c86, old: 'c745f400000000', new: jmp(0x417c86, PATCH_SECTION.presentC, 2) },
  { va: 0x417b95, old: '8d458450a1f0764600', new: jmp(0x417b95, PATCH_SECTION.fillB, 4), oldRelocs: [0x5] },
  { va: 0x41666b, old: '33c0e900000000', new: jmp(0x41666b, PATCH_SECTION.palHook1, 2) },
  { va: 0x41672a, old: '33c0e900000000', new: jmp(0x41672a, PATCH_SECTION.palHook2, 2) },
  { va: 0x41579b, old: '8b00ff5018', new: call(0x41579b, PATCH_SECTION.createSurface) },
  { va: 0x415a0d, old: '8b00ff5018', new: call(0x415a0d, PATCH_SECTION.createSurface) },
  { va: 0x41914b, old: '8b00ff5018', new: call(0x41914b, PATCH_SECTION.createSurface) },
  { va: 0x416558, old: 'e900000000', new: jmp(0x416558, PATCH_SECTION.palAttach, 0) },
];
const TEXT_VSIZE_OLD = 0x3978c;
const TEXT_VSIZE_NEW = 0x39800;

function addSection(buf, name, va, data) {
  const e = buf.readUInt32LE(0x3c);
  const opt = e + 24;
  const n = buf.readUInt16LE(e + 6);
  const slot = opt + buf.readUInt16LE(e + 20) + n * 40;
  const rva = va - buf.readUInt32LE(opt + 28);
  if (buf.readUInt32LE(opt + 56) !== rva) throw new Error(`window fix: SizeOfImage is not 0x${rva.toString(16)}`);
  if (slot + 40 > buf.readUInt32LE(opt + 60) || !buf.subarray(slot, slot + 40).equals(Buffer.alloc(40))) {
    throw new Error('window fix: no free section header slot');
  }
  if (buf.length % 0x200) throw new Error('window fix: file not aligned');
  const raw = Buffer.concat([data, Buffer.alloc((0x200 - (data.length % 0x200)) % 0x200)]);
  const hdr = Buffer.alloc(40);
  hdr.write(name, 0, 'latin1');
  hdr.writeUInt32LE(0x1000, 8);
  hdr.writeUInt32LE(rva, 12);
  hdr.writeUInt32LE(raw.length, 16);
  hdr.writeUInt32LE(buf.length, 20);
  hdr.writeUInt32LE(0xe0000020, 36);
  hdr.copy(buf, slot);
  buf.writeUInt16LE(n + 1, e + 6);
  buf.writeUInt32LE(rva + 0x1000, opt + 56);
  return Buffer.concat([buf, raw]);
}

function applyWindowFix(input) {
  const pe = parsePE(input);
  const va2fo = (va) => pe.rvaToFile(va - pe.imageBase);
  const at = (e) => input.subarray(va2fo(e.va), va2fo(e.va) + e.old.length / 2);
  const text = sectionHeaders(input).sections.find((sec) => sec.name === '.text');

  if (sectionHeaders(input).sections.some((sec) => sec.name === PATCH_SECTION.name)) {
    if (!WINDOW_EDITS.every((e) => at(e).equals(Buffer.from(e.new, 'hex')))) throw new Error('window fix: partially applied');
    return { buf: input, status: 'already applied' };
  }
  for (const e of WINDOW_EDITS) {
    if (!at(e).equals(Buffer.from(e.old, 'hex'))) throw new Error(`window fix: unexpected bytes at 0x${e.va.toString(16).toUpperCase()}`);
  }
  if (text.vsize !== TEXT_VSIZE_OLD || text.rawSize < TEXT_VSIZE_NEW) throw new Error('window fix: unexpected .text size');
  if (![0, 5, 10, 15, 20, 25, 30].every((o) => PATCH_CODE[o] === 0xe9)) throw new Error('window fix: .patch entry table is not 7 near jumps');
  if (PATCH_CODE.length > 0xb00) throw new Error('window fix: .patch code overlaps its data at 0x5BEB00');

  const buf = addSection(input, PATCH_SECTION.name, PATCH_SECTION.va, PATCH_CODE);
  const rvas = (key) => WINDOW_EDITS.flatMap((e) => (e[key] || []).map((o) => e.va - pe.imageBase + o));
  editRelocs(buf, rvas('oldRelocs'), [...rvas('relocs'), ...PATCH_RELOCS.map((o) => PATCH_SECTION.va - pe.imageBase + o)]);
  for (const e of WINDOW_EDITS) Buffer.from(e.new, 'hex').copy(buf, va2fo(e.va));
  buf.writeUInt32LE(TEXT_VSIZE_NEW, text.hdrOff + 8);
  return { buf, status: 'applied' };
}

module.exports = { applySkillFix, applyFontFix, applyWindowFix, readRelocs, serializeRelocs };

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
  const win = applyWindowFix(buf);
  console.log('window fix: ' + win.status);
  fs.writeFileSync(outPath, win.buf);
  console.log(`wrote ${path.relative(ROOT, outPath)}`);
}
