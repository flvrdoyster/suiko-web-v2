#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const TRANS_PATH = path.join(__dirname, '../translation/translation.json');
const t = JSON.parse(fs.readFileSync(TRANS_PATH, 'utf8'));

const REPEAT_SET = new Set(['！', '？', '…', '、', '，', '。', '．', '「', '」', '『', '』', '～', '∼']);

const TONE_SET = new Set(['！', '？', '…']);

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

  const runs = repeatedRuns(kr);
  for (const r of runs) {
    results.repeated.push({ offset: e.offset, kr, jp, ch: r.ch, len: r.len });
  }

  const krSet = new Set(toneMarks(kr));
  const jpSet = new Set(toneMarks(jp));
  for (const ch of krSet) {
    if (!jpSet.has(ch)) {
      results.added.push({ offset: e.offset, kr, jp, ch });
    }
  }

  const krTrim = kr.replace(/　+$/u, '');
  const jpTrim = jp.replace(/　+$/u, '');
  const krLast = krTrim.slice(-1);
  const jpLast = jpTrim.slice(-1);
  if (TONE_SET.has(krLast) && TONE_SET.has(jpLast) && krLast !== jpLast) {
    results.swapped.push({ offset: e.offset, kr, jp, krLast, jpLast });
  }

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
const category = args[0];
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
