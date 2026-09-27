#!/usr/bin/env node
// find-punct-issues.js — 문장부호 결함 후보 CLI 보고(translation.json은 안 건드림).
'use strict';

const fs = require('fs');
const path = require('path');

const TRANS_PATH = path.join(__dirname, '../translation/translation.json');
const t = JSON.parse(fs.readFileSync(TRANS_PATH, 'utf8'));

// A 반복: 화살표·장식 기호 제외
const REPEAT_SET = new Set(['！', '？', '…', '、', '，', '。', '．', '「', '」', '『', '』', '～', '∼']);

// B·C 추가/종결 불일치: 어조 부호만
const TONE_SET = new Set(['！', '？', '…']);

// D 더듬음: 반복 음절을 전각 공백으로 이은 KR
const JP_STAMMER_RE = /^「?[ぁ-んァ-ヶー]　/u;
function krStammerSpaceSep(str) {
  const body = str.replace(/^「/u, '');
  const chars = [...body];
  return chars.length >= 3 && chars[1] === '　' && chars[0] === chars[2];
}

function activeText(e) {
  return e.fixed || e.text;
}

function toneMarks(str) {
  return [...str].filter((ch) => TONE_SET.has(ch));
}

function repeatedRuns(str) {
  const runs = [];
  const chars = [...str];
  let i = 0;
  while (i < chars.length) {
    if (!REPEAT_SET.has(chars[i])) { i++; continue; }
    let j = i;
    while (j < chars.length && chars[j] === chars[i]) j++;
    if (j - i >= 2) runs.push({ ch: chars[i], len: j - i });
    i = j;
  }
  return runs;
}

const results = { repeated: [], added: [], swapped: [], stammer: [] };

for (const e of t.dialogue) {
  const kr = activeText(e);
  const jp = e.jp || '';
  if (!kr || !jp) continue;

  // A. repeated punctuation run in KR (e.g. "！！！")
  const runs = repeatedRuns(kr);
  for (const r of runs) {
    results.repeated.push({ offset: e.offset, kr, jp, ch: r.ch, len: r.len });
  }

  // B. KR has a tone mark (！／？／…) that JP doesn't have anywhere in the line
  const krSet = new Set(toneMarks(kr));
  const jpSet = new Set(toneMarks(jp));
  for (const ch of krSet) {
    if (!jpSet.has(ch)) {
      results.added.push({ offset: e.offset, kr, jp, ch });
    }
  }

  // C: 양쪽 다 어조 부호로 끝나는데 종류가 다름
  const krTrim = kr.replace(/　+$/u, '');
  const jpTrim = jp.replace(/　+$/u, '');
  const krLast = krTrim.slice(-1);
  const jpLast = jpTrim.slice(-1);
  if (TONE_SET.has(krLast) && TONE_SET.has(jpLast) && krLast !== jpLast) {
    results.swapped.push({ offset: e.offset, kr, jp, krLast, jpLast });
  }

  // D. JP stammer + KR repeats the syllable but joins it with a space instead of a comma
  if (JP_STAMMER_RE.test(jp) && krStammerSpaceSep(kr)) {
    results.stammer.push({ offset: e.offset, kr, jp });
  }
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((x) => {
    const k = x.offset + ':' + (x.ch || '') + ':' + (x.krLast || '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

results.repeated = dedupe(results.repeated);
results.added = dedupe(results.added);
results.swapped = dedupe(results.swapped);
results.stammer = dedupe(results.stammer);

console.log(`A. 반복 문장부호 (연속 2회 이상): ${results.repeated.length}건`);
console.log(`B. JP에 없는 부호가 KR에 추가됨: ${results.added.length}건`);
console.log(`C. 종결 부호 타입이 JP와 다름: ${results.swapped.length}건`);
console.log(`D. 더듬음 구분자가 쉼표가 아닌 공백: ${results.stammer.length}건`);
console.log('');

const args = process.argv.slice(2);
const category = args[0]; // 'A' | 'B' | 'C' | undefined(=summary only)
const limit = parseInt(args[1], 10) || 30;

function printList(list, label) {
  console.log(`=== ${label} (최대 ${limit}건 표시, 총 ${list.length}건) ===`);
  for (const x of list.slice(0, limit)) {
    console.log(`  ${x.offset}`);
    console.log(`    KR: ${x.kr}`);
    console.log(`    JP: ${x.jp}`);
  }
  console.log('');
}

if (category === 'A') printList(results.repeated, 'A. 반복 문장부호');
else if (category === 'B') printList(results.added, 'B. JP에 없는 부호 추가');
else if (category === 'C') printList(results.swapped, 'C. 종결 부호 타입 다름');
else if (category === 'D') printList(results.stammer, 'D. 더듬음 구분자 공백');
