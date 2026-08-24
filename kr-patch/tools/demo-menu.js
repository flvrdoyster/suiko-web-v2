#!/usr/bin/env node
// demo-menu.js — add a third item to HWANSE.EXE's title menu, wired to the leftover debug
// scenario-warp menu that ships (unreachable) in the retail KR build.
//
// Usage:
//   node kr-patch/tools/demo-menu.js [--exe path] [--out path] [--target select|scen9]
//                                     [--window id] [--frame-y y] [--blank]
// Defaults: --exe kr-patch/build/HWANSE.EXE (build.js output), --out overwrites --exe,
//   --target select (the 시나리오 선택 menu, which already lists 시나리오９（체험판）;
//   --target scen9 skips straight into that submenu instead).
//
// --window/--frame-y/--blank retune the title window frame. The defaults leave it exactly as
// the retail build had it (window 42 at y=280) with three choices and no blank row, which is
// the combination verified in the emulator. See the frame section below before changing them.
//
// Background — what's actually in the retail EXE
// ----------------------------------------------
// HWANSE.EXE's .data holds the game's script bytecode as 4-byte tokens. Relevant ones:
//   0x0000032f              MENU <ptr to menu-text block> 0x84
//   0xNN3AC113 <ptr>        "if the player picked choice NN, go to <ptr>"
//   0x00000003 <ptr>        GOTO      0x00000004 <ptr>   CALL      0x00000005  RET
//
// A complete debug warp menu (시나리오１～９ + 데모 + 미니게임 + 기타, with 시나리오９
// labelled （체험판）) sits at VA 0x4A3460, immediately after the title menu block at
// 0x4A3440. Nothing reaches it: the title menu only defines a case for choice 1
// (이어서하기) and choice 0 (처음부터) falls through to `0x81 <scene>; RET`, and the only
// 12 inbound references to 0x4A3460 are the "되돌아감" GOTOs from its own submenus. No
// .text code references it either. So it's dead code — the data is there, the door isn't.
//
// Menu-text block format (derived from all 12 scenario submenus, which agree exactly):
//   40 09 00 00  <ptr>        window-setup script (position/line-height)
//   <CP949 text> 40 02 00 00  one per line, repeated
//   40 3a 00 00               (title menu only — a non-selectable trailing line)
//   40 18 3a HH               HH & 0x3f = number of selectable choices
//                             HH >> 6   = number of non-selectable lines
//   40 00 00 00               end
//
// Why the blocks get relocated instead of edited in place
// ------------------------------------------------------
// Both the title menu's text block and its dispatch block are immediately followed by the
// scenario menu's equivalents, so growing either one in place would shift every pointer in
// .data. Instead both are rebuilt in the 141 bytes of zero padding at the tail of .data's
// raw data, and the single CALL that reaches the title menu is repointed at the copy.
//
// Caveat: pointers written into that padding have no .reloc entries, so this patch assumes
// the image loads at its preferred base (0x400000). That always holds for a primary EXE on
// Win9x, and nothing in this repo rebases HWANSE.EXE (pe-reloc.js only reads relocations).
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

// Everything that reaches the title menu block. In the retail KR build:
//   659100  CALL from the main flow — the one entry point
//   660688  GOTO at the end of the 시나리오 선택 block (backing out lands here)
//   661464  GOTO from the 이어서하기 path (e.g. backing out of the load screen)
// The CALL is the entry; the GOTOs are returns. `direct` mode only needs the entry, so
// backing out of the debug menu still drops you on the real title screen.
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
  // --- direct: boot straight into the debug menu -------------------------------------------
  // One pointer. The entry CALL goes to the scenario menu instead of the title menu, and the
  // return GOTOs are left alone, so backing out of the debug menu lands on the untouched
  // retail title screen with 처음부터/이어서하기 working normally.
  //
  // This sidesteps the whole title-menu-frame problem: window definition 42 has room for
  // exactly three rows with no bottom padding, so a third choice always sits flush against the
  // bottom border, and every other definition is either far too tall or full-width (see the
  // `menu` branch below and NOTES.md 3.4). The scenario menu draws its own 14-row frame
  // correctly already.
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

// --- Title window frame -------------------------------------------------------------------
// `40 0d`'s second word is an index into a table of predefined window definitions, and
// `40 07`'s first two words are the frame's x and y. Both live in a setup script (0x4BFDE4)
// referenced exactly once in the whole file — by the title menu's own text block — so editing
// them in place affects no other window.
//
// Each definition has a FIXED frame height; nothing auto-sizes, and the row count in
// `40 18 3a HH` does not affect it. Measured in the emulator by sweeping --frame-y with
// window 4 (screen is 640x480; the frame's top edge is the y, and there is a hard clip at
// y≈348 that silently eats the bottom border):
//   y=280 -> 68px shown, y=264 -> 84px shown, y=200 -> 148px shown with the border finally
//   visible, i.e. window 4's real height is ~148px and everything above was just clipped.
// So window 4 is a ~9-row frame — far too tall for three items, leaving a huge empty band.
// Windows 0 and 9 are the full-width dialogue frames, and 41 sits at the dialogue x.
//
// That leaves window 42, the retail title's own: ~57px, which is exactly three 16px rows plus
// the top padding and no bottom padding. So the third choice sitting flush against the bottom
// border is correct rendering for this frame, not clipping — and it is the best fit available
// without editing the window-definition table itself, which pattern-searching did not locate
// (2887 candidates matched the height pair 42→57/4→148, none corroborated by a width field).
//
// Values outside the table hang the game (58 did), so --window only takes real ids.
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

// --- Build the replacement menu-text block ------------------------------------------------
// Both existing labels are right-aligned to 7 full-width cells ("　　　처음부터",
// "　　이어서하기"), so the new one is padded to 7 cells the same way.
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

// The retail block is two choices plus the blank row `40 3a` emits — hence `40 18 3a 42` =
// 1 non-selectable + 2 choices. Window definition 42 only has room for those three rows (and
// the last of them sits partly outside the frame, which never showed because it was blank),
// so the blank row is kept and the frame moved to window 4 instead. See the frame section
// below. --no-blank drops it, which is what window 42 needs if you switch back.
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

// --- Find room: the alignment padding at the tail of .text's raw data ---------------------
// NOT the equivalent gap in .data. That one looks identical on disk (zeros past the last
// meaningful byte) but is really zero-initialised globals: .text references 0x559D98 and its
// neighbours a dozen times, so blocks placed there get overwritten the moment the game runs
// — the symptom was two characters of a menu label rendering as garbage while the bytes on
// disk stayed correct. .text's tail is padding to FileAlignment past its VirtualSize: still
// mapped (raw end lands inside the section's virtual span), referenced by nothing, and in a
// section with no MEM_WRITE, so nothing can clobber it.
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
// Every reference, entry and returns alike: the new block is a strict superset of the original
// (same 이어서하기 handler, same 처음부터 fall-through, plus the new choice), so the 3-item menu
// is what you get no matter which path lands on the title screen.
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

// --- Optional: emit the patch as data, for docs/suiko-demo.js to apply in the browser ----
// The whole patch lands at fixed offsets that have nothing to do with translation content
// (new blocks in .text padding, three repointed pointers in .data), so one emitted file stays
// valid across translation edits and there is no need to reimplement any of this in JS.
// `expect` lets the browser confirm it is patching the build this was generated from.
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
    note:
      `Generated by kr-patch/tools/demo-menu.js --mode ${mode} --emit-patch. ` +
      (mode === 'direct'
        ? `Boots HWANSE.EXE straight into the ${TARGET_LABEL} instead of the title menu.`
        : `Adds a third item to HWANSE.EXE's title menu, opening the ${TARGET_LABEL}.`) +
      ' Applied to the in-memory disk image before boot by docs/suiko-demo.js;' +
      ' see NOTES.md 3.4.',
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
