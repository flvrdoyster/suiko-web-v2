#!/usr/bin/env node
// demo-menu.js — 시나리오 선택(디버그) 메뉴로 들어가는 패치 / demo-patch.json 생성.
// node kr-patch/tools/demo-menu.js [--exe] [--out] [--mode direct|menu] [--target select|scen9]
//   [--window id] [--frame-y y] [--blank] [--emit-patch path]
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
const pristine = Buffer.from(buf); // kept so --emit-patch can diff against the input

// --- PE section table -> file/VA mapping --------------------------------------------------
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

const delta = (s) => imageBase + s.va - s.rawOff; // file offset -> VA, per section
const f2vaIn = (s, f) => f + delta(s);
function va2f(v) {
  for (const s of sections) {
    const lo = imageBase + s.va;
    if (v >= lo && v < lo + Math.max(s.virtualSize, s.rawSize)) return v - delta(s);
  }
  fail(`VA 0x${v.toString(16)} maps to no section`);
}
const DATA_END = data.rawOff + data.rawSize;

// --- Known landmarks (verified against the retail KR HWANSE.EXE) --------------------------
const TITLE_BLOCK_VA = 0x4a3440; // dispatch block for 처음부터/이어서하기
const SCEN_SELECT_VA = 0x4a3460; // dispatch block for the debug 시나리오 선택 menu
const SCEN9_VA = 0x4a36ac; // dispatch block for the 시나리오９（체험판） submenu
const CONTINUE_VA = 0x4a37a4; // handler for 이어서하기
const NEWGAME_SCENE_VA = 0x4cff78; // operand of the 0x81 that 처음부터 falls through to

const MENU = 0x0000032f;
const MENU_FLAG = 0x00000084;
const GOTO = 0x00000003;
const CALL = 0x00000004;
const RET = 0x00000005;
const OP_SCENE = 0x00000081;
const caseTok = (n) => (0x3ac113 | (n << 24)) >>> 0;

// 타이틀 메뉴 블록을 참조하는 곳: 659100 진입 CALL, 660688·661464 복귀 GOTO
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
  // --- direct: 진입 CALL만 시나리오 메뉴로 ---
  for (const site of entrySites) buf.writeUInt32LE(TARGET_VA, site);
  log.push(`  진입 CALL 재지정  0x${TITLE_BLOCK_VA.toString(16)} -> 0x${TARGET_VA.toString(16)} (${TARGET_LABEL})`);
  log.push(`                    at file ${entrySites.join(', ')}`);
  log.push(`  복귀 GOTO         file ${returnSites.join(', ')} 는 타이틀 메뉴로 그대로 둠`);
} else {
  buildTitleMenu();
}

function buildTitleMenu() {
// The existing title menu-text block, so the copy reuses its window-setup pointer verbatim
// (position/line-height stay whatever the original title screen used).
const titleTextVA = buf.readUInt32LE(va2f(TITLE_BLOCK_VA) + 4);
const windowSetupVA = buf.readUInt32LE(va2f(titleTextVA) + 4);

// --- 타이틀 창 프레임(40 0d = 창 정의 인덱스, 40 07 = x, y) ---
const frameWindow = arg('window', 42);
const frameY = arg('frame-y', 280);

// Walk the setup script to find op 0x0d (window id) and op 0x07 (x, y) rather than hardcoding
// offsets. Ops 0x07/0x0d/0x15 carry three words; every other op carries one.
let so = va2f(windowSetupVA);
let windowAt = null;
let yAt = null;
for (let k = 0; k < 40 && buf[so] === 0x40; k++) {
  const op = buf[so + 1];
  const wide = op === 0x07 || op === 0x0d || op === 0x15;
  // Both carry (word0, word1, word2) starting at +2; the interesting one is word1 in each:
  // 0x0d's is the window-definition id, 0x07's is the frame's bottom y (its word0 is x).
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

// --- 새 메뉴 텍스트 블록(라벨은 전각 7칸 오른쪽 정렬) ---
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

// 원본은 선택지 2 + 빈 행(40 3a) — --blank로 빈 행 유지
const withBlank = process.argv.includes('--blank');
const CHOICES = 3; // 처음부터 / 이어서하기 / 시나리오선택
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

// --- 빈 공간: .text raw 꼬리의 정렬 패딩(.data 꼬리는 0 초기화 전역변수라 안 됨) ---
const padStart = (text.rawOff + text.virtualSize + 3) & ~3;
const padEnd = text.rawOff + text.rawSize;
const padBytes = padEnd - padStart;

for (let o = padStart; o < padEnd; o++) {
  if (buf[o] !== 0) fail(`.text tail padding is not empty at file ${o}`);
}
// Cheap version of the check that caught the .data mistake: if anything anywhere in the file
// holds an address inside this range, it is not free space.
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
  // choice 0 (처음부터) falls through to exactly what the original block did
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
// 진입·복귀 참조 전부를 새 블록으로
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

// --- 선택: 패치를 데이터로 내보내기(docs/suiko-demo.js가 적용) ---
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
    // Only the offsets this mode actually writes over, so a patch built for one mode cannot
    // be applied on top of an EXE the other mode already touched.
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
