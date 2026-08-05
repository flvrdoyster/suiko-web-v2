#!/usr/bin/env node
// find-punct-issues.js — surface dialogue lines where KR punctuation looks tampered with
// relative to JP: repeated marks (particularly "！！！" runs), marks added that aren't in
// JP at all, or a different terminal mark than JP's. Report-only (prints candidates with
// offsets for manual review in the editor) — does not touch translation.json.
'use strict';

const fs = require('fs');
const path = require('path');

const TRANS_PATH = path.join(__dirname, '../translation/translation.json');
const t = JSON.parse(fs.readFileSync(TRANS_PATH, 'utf8'));

// Repeat-detection (A) stays broad — any punctuation mark repeating back-to-back is
// inherently suspicious regardless of type. Excludes UI-hint arrows (←→↓) and decorative
// symbols (♥★☆○×◎％＆) since those repeating isn't a translation-tampering signal.
const REPEAT_SET = new Set(['！', '？', '…', '、', '，', '。', '．', '「', '」', '『', '』', '～', '∼']);

// Add/swap-detection (B, C) is narrowed to just the tone-carrying terminal marks the
// reviewer actually flagged (exclamation/question/ellipsis). 「」 vs 『』 is a KR/JP quote
// *convention* difference (GUIDE.md §5 "조작키는「」로 감싼다"), not a translation error, so
// brackets are deliberately excluded here even though A still catches them if repeated.
const TONE_SET = new Set(['！', '？', '…']);

// D. stammer detection (GUIDE.md 2-6): JP marks a stammer as a single kana syllable
// followed by a full-width space (な　なんだって), and this game's established KR
// convention joins the repeated syllable with a full-width comma (뭐，뭐라구) rather than
// JP's space. Flags KR that already repeats the syllable but joins it with a full-width
// space instead — narrower than "any repeated char" (which also matches laughter/onomatopoeia
// like 호호호 or 헉헉 and would be mostly noise) and narrower than "no comma at all" (which
// also matches lines that just dropped the stammer entirely, a translation-completeness
// question rather than a punctuation-consistency one).
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

  // C. terminal tone mark type differs (JP ends in one, KR ends in another) —
  // approximate "swapped" signal. Only when both sides actually end in a tone mark (skip
  // plain-text endings, e.g. lines ending in a padding space).
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
