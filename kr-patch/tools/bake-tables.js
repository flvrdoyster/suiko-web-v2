#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parsePE } = require('./pe-reloc.js');

const ROOT = path.join(__dirname, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const dry = process.argv.includes('--dry');
const transPath = arg('translation', path.join(ROOT, 'kr-patch/translation/translation.json'));
const exePath = arg('exe', path.join(ROOT, 'original/kr/HWANSE.EXE'));

if (!fs.existsSync(exePath)) {
  console.error(`bake-tables.js: ${path.relative(ROOT, exePath)} 없음 — 원본 EXE가 필요하다 (README "로컬 준비").`);
  process.exit(1);
}

const buf = fs.readFileSync(exePath);
const t = JSON.parse(fs.readFileSync(transPath, 'utf8'));
const pe = parsePE(buf);

const dialogue = t.dialogue.slice().sort((a, b) => a.offset - b.offset);
const lineStart = new Set(dialogue.map((e) => e.offset));
const byOffset = new Map(dialogue.map((e) => [e.offset, e]));
const dialogueIndexByOffset = new Map(dialogue.map((e, i) => [e.offset, i]));

const slots = [];
let p = pe.relocFileOff;
const end = p + pe.relocSize;
while (p < end) {
  const pageRVA = buf.readUInt32LE(p);
  const blockSize = buf.readUInt32LE(p + 4);
  if (blockSize === 0) break;
  for (let i = 0; i < (blockSize - 8) / 2; i++) {
    const entry = buf.readUInt16LE(p + 8 + i * 2);
    if ((entry >> 12) !== 3) continue;
    const at = pe.rvaToFile(pageRVA + (entry & 0xfff));
    if (at === null) continue;
    const target = pe.rvaToFile(buf.readUInt32LE(at) - pe.imageBase);
    if (target !== null && lineStart.has(target)) slots.push({ at, target });
  }
  p += blockSize;
}
slots.sort((a, b) => a.at - b.at);

const MAX_SLOT_GAP = 32;
const MIN_SLOTS = 2;
const runs = [];
let cur = slots.length ? [slots[0]] : [];
for (let i = 1; i < slots.length; i++) {
  if (slots[i].at - slots[i - 1].at <= MAX_SLOT_GAP) cur.push(slots[i]);
  else { runs.push(cur); cur = [slots[i]]; }
}
if (cur.length) runs.push(cur);
const tables = runs.filter((r) => r.length >= MIN_SLOTS);

const CONTINUE_CTRL = 0x02;
for (const e of dialogue) { delete e.table; delete e.tableStart; }
let markedLines = 0, markedStarts = 0;
const summary = [];
const warnings = [];
for (const run of tables) {
  const targets = [...new Set(run.map((s) => s.target))].sort((a, b) => a - b);
  let lines = 0;
  for (const target of targets) {
    let idx = dialogueIndexByOffset.get(target);
    if (idx == null) continue;
    let e = dialogue[idx];
    e.tableStart = true; markedStarts++;
    for (;;) {
      e.table = run[0].at;
      lines++; markedLines++;
      const ctrl = buf[e.offset + e.length + 1];
      if (ctrl !== CONTINUE_CTRL) break;
      const next = dialogue[idx + 1];
      if (!next || next.offset !== e.offset + e.length + 4) {
        warnings.push(`table@${run[0].at}: 단위 @0x${target.toString(16)} — @0x${e.offset.toString(16)} 제어바이트는 계속인데 다음 줄이 안 붙어 있음, 여기서 자름`);
        break;
      }
      idx++; e = next;
    }
  }
  summary.push({ table: run[0].at, slots: run.length, units: targets.length, lo: targets[0], lines });
}
if (warnings.length) { console.warn('⚠ 방어적으로 자른 단위:'); for (const w of warnings) console.warn('  ' + w); }

summary.sort((a, b) => b.lines - a.lines);
console.log(`포인터 테이블 ${tables.length}개 (슬롯 ${MIN_SLOTS}개 이상)`);
for (const s of summary) {
  console.log(`  table@${s.table}  슬롯 ${String(s.slots).padStart(3)}  단위 ${String(s.units).padStart(3)}  ` +
    `텍스트 ${s.lo}~  줄 ${s.lines}`);
}
console.log(`\n표시된 줄: ${markedLines} / ${dialogue.length}  (단위 시작 ${markedStarts})`);

if (dry) { console.log('--dry: 파일은 쓰지 않았다.'); process.exit(0); }
fs.writeFileSync(transPath, JSON.stringify(t, null, 2));
console.log(`wrote ${path.relative(ROOT, transPath)}`);
