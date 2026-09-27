#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const ROOT = path.join(__dirname, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const exePath = arg('exe', path.join(ROOT, 'kr-patch/build/HWANSE.EXE'));
const outPath = arg('out', exePath);
const target = arg('target', 'select');
const mode = arg('mode', 'direct');

function fail(msg) {
  console.error('demo-menu.js: ' + msg);
  process.exit(1);
}

if (!['scen9', 'select'].includes(target)) fail(`--target must be scen9 or select`);
if (!['direct', 'menu'].includes(mode)) fail(`--mode must be direct or menu`);
if (!fs.existsSync(exePath)) fail(`exe not found: ${exePath}`);

const buf = Buffer.from(fs.readFileSync(exePath));
const pristine = Buffer.from(buf);

const peOff = buf.readUInt32LE(0x3c);
if (buf.readUInt32LE(peOff) !== 0x00004550) fail('not a PE file');
const numSections = buf.readUInt16LE(peOff + 6);
const optSize = buf.readUInt16LE(peOff + 20);
const imageBase = buf.readUInt32LE(peOff + 24 + 28);
const secOff = peOff + 24 + optSize;
const sections = [];
for (let i = 0; i < numSections; i++) {
  const o = secOff + i * 40;
  sections.push({
    name: buf.slice(o, o + 8).toString('latin1').replace(/\0+$/, ''),
    virtualSize: buf.readUInt32LE(o + 8),
    va: buf.readUInt32LE(o + 12),
    rawSize: buf.readUInt32LE(o + 16),
    rawOff: buf.readUInt32LE(o + 20),
  });
}
const byName = (n) => sections.find((s) => s.name === n);
const data = byName('.data');
const text = byName('.text');
if (!data || !text) fail('missing .data/.text section');

const delta = (s) => imageBase + s.va - s.rawOff;
const f2vaIn = (s, f) => f + delta(s);
function va2f(v) {
  for (const s of sections) {
    const lo = imageBase + s.va;
    if (v >= lo && v < lo + Math.max(s.virtualSize, s.rawSize)) return v - delta(s);
  }
  fail(`VA 0x${v.toString(16)} maps to no section`);
}
const DATA_END = data.rawOff + data.rawSize;

const TITLE_BLOCK_VA = 0x4a3440;
const SCEN_SELECT_VA = 0x4a3460;
const SCEN9_VA = 0x4a36ac;
const CONTINUE_VA = 0x4a37a4;
const NEWGAME_SCENE_VA = 0x4cff78;

const MENU = 0x0000032f;
const MENU_FLAG = 0x00000084;
const GOTO = 0x00000003;
const CALL = 0x00000004;
const RET = 0x00000005;
const OP_SCENE = 0x00000081;
const caseTok = (n) => (0x3ac113 | (n << 24)) >>> 0;

const entrySites = [];
const returnSites = [];
for (let o = data.rawOff; o < DATA_END - 4; o += 4) {
  if (buf.readUInt32LE(o) !== TITLE_BLOCK_VA) continue;
  const prev = o >= 4 ? buf.readUInt32LE(o - 4) : 0;
  if (prev === CALL) entrySites.push(o);
  else if (prev === GOTO) returnSites.push(o);
  else console.warn(`demo-menu.js: 경고 — file ${o}의 0x4A3440 참조가 GOTO/CALL이 아님, 건너뜀`);
}
if (!entrySites.length) {
  fail('no CALL reaching the title menu — is this the retail KR HWANSE.EXE?');
}

const TARGET_VA = target === 'scen9' ? SCEN9_VA : SCEN_SELECT_VA;
const TARGET_LABEL = target === 'scen9' ? '시나리오９（체험판） 서브메뉴' : '시나리오 선택 메뉴';
const log = [];

if (mode === 'direct') {
  for (const site of entrySites) buf.writeUInt32LE(TARGET_VA, site);
  log.push(`  진입 CALL 재지정  0x${TITLE_BLOCK_VA.toString(16)} -> 0x${TARGET_VA.toString(16)} (${TARGET_LABEL})`);
  log.push(`                    at file ${entrySites.join(', ')}`);
  log.push(`  복귀 GOTO         file ${returnSites.join(', ')} 는 타이틀 메뉴로 그대로 둠`);
} else {
  buildTitleMenu();
}

function buildTitleMenu() {
const titleTextVA = buf.readUInt32LE(va2f(TITLE_BLOCK_VA) + 4);
const windowSetupVA = buf.readUInt32LE(va2f(titleTextVA) + 4);

const frameWindow = arg('window', 42);
const frameY = arg('frame-y', 280);

let so = va2f(windowSetupVA);
let windowAt = null;
let yAt = null;
for (let k = 0; k < 40 && buf[so] === 0x40; k++) {
  const op = buf[so + 1];
  const wide = op === 0x07 || op === 0x0d || op === 0x15;
  if (op === 0x0d) windowAt = so + 4;
  if (op === 0x07) yAt = so + 4;
  so += wide ? 8 : 4;
  if (op === 0x0a) break;
}
if (windowAt === null || yAt === null) fail('could not locate the frame geometry ops');
const oldWindow = buf.readUInt16LE(windowAt);
const oldY = buf.readUInt16LE(yAt);
if (frameWindow !== null) buf.writeUInt16LE(+frameWindow, windowAt);
if (frameY !== null) buf.writeUInt16LE(+frameY, yAt);

const NEW_LABEL = target === 'scen9' ? '　　　　체험판' : '　시나리오선택';
const item = (s) => Buffer.concat([iconv.encode(s, 'cp949'), tok(0x02)]);
function tok(op, arg = 0) {
  const b = Buffer.alloc(4);
  b[0] = 0x40;
  b[1] = op;
  b.writeUInt16LE(arg, 2);
  return b;
}
function dword(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v >>> 0);
  return b;
}

const withBlank = process.argv.includes('--blank');
const CHOICES = 3;
const NONSEL = withBlank ? 1 : 0;

const textBlock = Buffer.concat([
  tok(0x09),
  dword(windowSetupVA),
  item('　　　처음부터'),
  item('　　이어서하기'),
  item(NEW_LABEL),
  ...(withBlank ? [tok(0x3a)] : []),
  Buffer.from([0x40, 0x18, 0x3a, (NONSEL << 6) | CHOICES]),
  tok(0x00),
]);

const padStart = (text.rawOff + text.virtualSize + 3) & ~3;
const padEnd = text.rawOff + text.rawSize;
const padBytes = padEnd - padStart;

for (let o = padStart; o < padEnd; o++) {
  if (buf[o] !== 0) fail(`.text tail padding is not empty at file ${o}`);
}
const padLo = f2vaIn(text, padStart);
const padHi = f2vaIn(text, padEnd);
for (let o = 0; o <= buf.length - 4; o++) {
  const v = buf.readUInt32LE(o);
  if (v >= padLo && v < padHi) fail(`file ${o} references 0x${v.toString(16)} inside the padding`);
}

const textAt = padStart;
const dispatchAt = (textAt + textBlock.length + 3) & ~3;

const dispatchBlock = Buffer.concat([
  dword(MENU),
  dword(f2vaIn(text, textAt)),
  dword(MENU_FLAG),
  dword(caseTok(1)),
  dword(CONTINUE_VA),
  dword(caseTok(2)),
  dword(TARGET_VA),
  dword(OP_SCENE),
  dword(NEWGAME_SCENE_VA),
  dword(RET),
]);

const need = dispatchAt + dispatchBlock.length - padStart;
if (need > padBytes) {
  fail(`need ${need} bytes of .text padding but only ${padBytes} available`);
}

textBlock.copy(buf, textAt);
dispatchBlock.copy(buf, dispatchAt);
const newVA = f2vaIn(text, dispatchAt);
const allSites = entrySites.concat(returnSites);
for (const site of allSites) buf.writeUInt32LE(newVA, site);

log.push(`  타이틀 메뉴 3항목화 (처음부터 / 이어서하기 /${NEW_LABEL.trim()}) -> ${TARGET_LABEL}`);
log.push(
  `  텍스트 블록   file ${textAt} (VA 0x${f2vaIn(text, textAt).toString(16)}) ${textBlock.length}B` +
    `, ${CHOICES + NONSEL}행 (선택지 ${CHOICES}${withBlank ? ' + 40 3a 여백 1' : ', 여백 없음'})`
);
log.push(`  디스패치 블록 file ${dispatchAt} (VA 0x${newVA.toString(16)}) ${dispatchBlock.length}B`);
log.push(`  참조 재지정   0x${TITLE_BLOCK_VA.toString(16)} -> 0x${newVA.toString(16)} at file ${allSites.join(', ')}`);
log.push(
  `  창 프레임     window=${oldWindow}${+frameWindow !== oldWindow ? ` -> ${frameWindow}` : ' (그대로)'}` +
    `, y=${oldY}${+frameY !== oldY ? ` -> ${frameY}` : ' (그대로)'}`
);
log.push(`  .text 패딩    ${need}/${padBytes} bytes 사용`);
}

fs.writeFileSync(outPath, buf);

const emitPatch = arg('emit-patch', null);
if (emitPatch) {
  const writes = [];
  let runStart = -1;
  for (let o = 0; o <= buf.length; o++) {
    const differs = o < buf.length && buf[o] !== pristine[o];
    if (differs && runStart < 0) runStart = o;
    else if (!differs && runStart >= 0) {
      writes.push({ offset: runStart, bytes: buf.slice(runStart, o).toString('base64') });
      runStart = -1;
    }
  }
  const patch = {
    mode,
    target: 'HWANSE.EXE',
    dir: 'GENSE',
    size: buf.length,
    expect: writes
      .filter((w) => w.offset >= data.rawOff && w.offset < DATA_END)
      .map((w) => ({ offset: w.offset & ~3, u32: pristine.readUInt32LE(w.offset & ~3) })),
    writes,
  };
  fs.writeFileSync(emitPatch, JSON.stringify(patch, null, 2) + '\n');
  log.push(
    `  패치 파일     ${path.relative(ROOT, emitPatch)} (${writes.length} runs, ` +
      `${writes.reduce((n, w) => n + Buffer.from(w.bytes, 'base64').length, 0)}B)`
  );
}

console.log(`demo-menu.js: ${path.relative(ROOT, outPath)}  [--mode ${mode}]`);
for (const line of log) console.log(line);
