#!/usr/bin/env node
// bake-tables.js — mark the dialogue entries that live in a *pointer-addressed* text block,
// writing `table`/`tableStart` onto them in translation.json.
//
// Usage: node kr-patch/tools/bake-tables.js [--translation path] [--exe path] [--dry]
//
// Why this matters — 길이 확장 가능 여부:
// 대부분의 대사는 relocation이 가리키는 "장면 진입점"에서 `@`를 세며 순차로 읽히므로, 한 줄을
// 늘리면 그 뒤 전부가 밀려 참조가 깨진다(그래서 build()가 원본 바이트 길이를 강제한다 —
// NOTES.md 3.3). 그런데 일부 구간은 그렇지 않고 **연속된 4바이트 포인터 슬롯 테이블**이 각
// 단위의 시작을 개별적으로 가리킨다. 그런 구간은 포인터만 다시 써 주면 단위 경계를 옮길 수
// 있고, 한 단위 안에서는(시작점에서 순차로 읽히므로) 포인터를 건드리지 않고도 줄 사이에
// 바이트를 재분배할 수 있다.
//
// 판정은 순전히 원본 EXE에서 나온다 — 사람이 채운 값이 아니므로 재추출 후 그냥 다시 돌리면
// 된다(bake-jp.js와 같은 위치의 파생 단계). extract.js는 필드를 화이트리스트로 추리므로
// 재추출하면 이 필드는 사라진다. **extract.js를 돌렸으면 이 스크립트도 다시 돌릴 것.**
//
// 붙는 필드(테이블에 속한 항목에만 — 나머지는 필드 자체가 없다):
//   table      그 구간을 가리키는 포인터 테이블의 첫 슬롯 파일 오프셋 (구간 식별자)
//   tableStart true면 이 줄의 시작을 포인터가 직접 가리킨다 = 단위(설명/항목) 경계
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

// .data 안에서 "텍스트 줄 시작을 가리키는" HIGHLOW relocation 슬롯을 전부 모은다.
const slots = [];
let p = pe.relocFileOff;
const end = p + pe.relocSize;
while (p < end) {
  const pageRVA = buf.readUInt32LE(p);
  const blockSize = buf.readUInt32LE(p + 4);
  if (blockSize === 0) break;
  for (let i = 0; i < (blockSize - 8) / 2; i++) {
    const entry = buf.readUInt16LE(p + 8 + i * 2);
    if ((entry >> 12) !== 3) continue; // HIGHLOW only
    const at = pe.rvaToFile(pageRVA + (entry & 0xfff));
    if (at === null) continue;
    const target = pe.rvaToFile(buf.readUInt32LE(at) - pe.imageBase);
    if (target !== null && lineStart.has(target)) slots.push({ at, target });
  }
  p += blockSize;
}
slots.sort((a, b) => a.at - b.at);

// 슬롯 위치가 촘촘히 이어지면 하나의 테이블로 본다. 틈 허용치 32B는 실측 기준 — 설명
// 테이블(945876~)이 그룹 사이에 12~36B 짜리 비포인터 데이터를 끼워 두고 있어 4B 간격만
// 고집하면 한 테이블이 조각난다.
//
// 슬롯 2개부터 테이블로 친다 — "런"(4B 간격으로 촘촘히 붙은 슬롯 묶음) 자체가 이미 신호다.
// 일반 대사의 620개 장면 진입점은 각자 **단 하나의** 고립된 relocation이라, 슬롯이 둘 이상
// 뭉쳐 있는 건 배열이 코드에 박혀 있다는 뜻이지 우연이 아니다(예전엔 8개 미만을 노이즈로
// 의심해 걸렀는데, 실측해보니 254598(대사 선택지 4갈래) · 942800(무기/방어구 2갈래) ·
// 945824(필살기/장기/달인기/신기 4갈래) · 943848(설정 메뉴 6갈래) 등 2~7개짜리 런 12개가
// 전부 진짜 배열이었고 노이즈는 0건이었다 — 임계값을 8로 둔 근거가 없었다).
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

// 각 타겟(포인터가 가리키는 단위 시작)에서 독립적으로 걷는다 — 테이블 전체를 하나의
// 연속 구간으로 보고 걸으면 안 된다: 지명 테이블(957468)처럼 타겟 사이에 다른 항목이 끼는
// 경우가 있어, "이전 단위 끝난 뒤 dialogue 배열의 바로 다음 항목이 다음 타겟이어야 한다"고
// 가정하면 그 자리에서 조기 종료해 뒤 타겟들을 통째로 놓친다.
//
// 한 단위 안에서는 여전히 제어바이트를 따라간다 — 줄 종결은 `40(@) XX 00 00`이고 XX=0x02면
// 같은 단위 안에서 다음 줄로 이어진다(다른 값이면 그 줄에서 단위가 끝난다 — 실측 0x00/0x0a).
// 이어지는데 다음 dialogue 항목이 바로 그 자리에 붙어있지 않으면(제어바이트 해석이 이
// 데이터엔 안 맞을 가능성) 그 단위만 방어적으로 잘라내고 경고한다 — 조용히 잘못 묶느니
// 빠뜨리는 쪽이 안전하다.
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
    if (idx == null) continue; // 이미 다른 실행에서 확인됨(findEntryPointOffsets류 안전망) — 실측상 없음
    let e = dialogue[idx];
    e.tableStart = true; markedStarts++;
    for (;;) {
      e.table = run[0].at;
      lines++; markedLines++;
      const ctrl = buf[e.offset + e.length + 1];
      if (ctrl !== CONTINUE_CTRL) break; // 이 단위는 여기서 끝
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
