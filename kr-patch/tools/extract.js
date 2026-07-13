#!/usr/bin/env node
// extract.js — regenerate kr-patch/translation/translation.json (KR, editable) and
// kr-patch/translation/jp-reference.json (JP, read-only reference) from the original game
// files. This replaces the ad-hoc `node -e "..."` one-liners used during development.
//
// Usage:
//   node kr-patch/tools/extract.js [--kr-exe path] [--jp-exe path]
//     [--out-kr path] [--out-jp path]
// Defaults: original/kr/HWANSE.EXE, original/jp/GENSE.EXE,
//   kr-patch/translation/translation.json, kr-patch/translation/jp-reference.json.
//
// Safety:
//   - Refuses to write translation.json if the KR round-trip (dialogue build() + labels
//     build(), applied unchanged, must reproduce the original file byte-for-byte) fails —
//     see NOTES.md's round-trip-first policy.
//   - Re-running this is NOT allowed to silently discard review work: if translation.json
//     already exists, any entry with a non-empty `fixed` is carried over by matching on
//     offset+length. If an old fixed entry's offset/length no longer exists in the new
//     extraction (e.g. after an extractor algorithm change), that's reported loudly as a
//     conflict instead of being silently dropped — resolve it by hand before proceeding.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIALOGUE = require('./hwanse-text.js');
const NAMES = require('./hwanse-names.js');
const FONT = require('./hwanse-font.js');
const JP_TEXT = require('./gense-text.js');
const JP_NAMES = require('./gense-names.js');

const ROOT = path.join(__dirname, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const krExePath = arg('kr-exe', path.join(ROOT, 'original/kr/HWANSE.EXE'));
const jpExePath = arg('jp-exe', path.join(ROOT, 'original/jp/GENSE.EXE'));
const outKrPath = arg('out-kr', path.join(ROOT, 'kr-patch/translation/translation.json'));
const outJpPath = arg('out-jp', path.join(ROOT, 'kr-patch/translation/jp-reference.json'));

function fail(msg) {
  console.error('extract.js: ' + msg);
  process.exit(1);
}

// Carries over review state (`fixed` text edits, the `confirmed` "reviewed, no change
// needed" flag, and — dialogue only — the baked `jp`/`jpOffset` KR<->JP correspondence from
// bake-jp.js) from a previous run's entries, matched by a key (offset+length by default), so
// re-extraction after an extractor tweak doesn't wipe out review work already saved via the
// editor or baked by bake-jp.js. Reports any previously-touched entry that no longer has a
// matching slot.
function mergeReview(oldEntries, newEntries, label, keyOf = (e) => `${e.offset}:${e.length}`) {
  if (!oldEntries) return newEntries;
  const oldByKey = new Map();
  for (const e of oldEntries) {
    if (e.fixed || e.confirmed || e.jp) oldByKey.set(keyOf(e), { fixed: e.fixed || '', confirmed: !!e.confirmed, jp: e.jp || '', jpOffset: e.jpOffset != null ? e.jpOffset : null });
  }
  const matchedKeys = new Set();
  const merged = newEntries.map((e) => {
    const key = keyOf(e);
    const prev = oldByKey.get(key);
    if (prev !== undefined) matchedKeys.add(key);
    return { ...e, fixed: (prev && prev.fixed) || '', confirmed: !!(prev && prev.confirmed), jp: (prev && prev.jp) || '', jpOffset: (prev && prev.jpOffset) != null ? prev.jpOffset : null };
  });
  const orphaned = [...oldByKey.keys()].filter((k) => !matchedKeys.has(k));
  if (orphaned.length) {
    console.warn(
      `\n⚠ ${label}: ${orphaned.length} previously-reviewed entr${orphaned.length === 1 ? 'y' : 'ies'} ` +
      `no longer match any extracted slot — their review state was NOT carried over:`
    );
    for (const k of orphaned.slice(0, 20)) {
      const old = oldEntries.find((e) => keyOf(e) === k);
      console.warn(`  key=${k} fixed=${JSON.stringify(old.fixed)} confirmed=${!!old.confirmed}`);
    }
    if (orphaned.length > 20) console.warn(`  ... and ${orphaned.length - 20} more`);
    console.warn('Resolve these by hand (re-apply at its new offset) before proceeding.\n');
  }
  return merged;
}

function loadExisting(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

// --- KR (editable) ---
if (!fs.existsSync(krExePath)) fail(`KR exe not found: ${krExePath}`);
const krBuf = fs.readFileSync(krExePath);

const dialogue = DIALOGUE.extract(krBuf);
const excludeMask = new Uint8Array(krBuf.length);
for (const e of dialogue) for (let i = e.offset; i < e.offset + e.length; i++) excludeMask[i] = 1;
// Exclude the LOGFONT face-name field(s) before labels runs, so the generic label
// extractor doesn't ALSO capture "굴림체" as its own (undersized, 6-byte) entry —
// hwanse-font.js models the true 32-byte NUL-padded slot instead. See hwanse-font.js.
for (const { offset, maxLength } of FONT.FONT_FIELDS) {
  for (let i = offset; i < offset + maxLength; i++) excludeMask[i] = 1;
}
const labels = NAMES.extract(krBuf, excludeMask);

for (const list of [dialogue, labels]) {
  list.sort((a, b) => a.offset - b.offset);
  for (let i = 1; i < list.length; i++) {
    if (list[i].offset < list[i - 1].offset + list[i - 1].length) {
      fail(`overlapping entries at 0x${list[i - 1].offset.toString(16)} and 0x${list[i].offset.toString(16)}`);
    }
  }
}

let rebuilt = DIALOGUE.build(krBuf, dialogue);
rebuilt = NAMES.build(rebuilt, labels);
if (Buffer.compare(rebuilt, krBuf) !== 0) {
  fail('round-trip check failed: rebuilding with unchanged entries did not reproduce the original file byte-for-byte. Refusing to write translation.json.');
}

const existing = loadExisting(outKrPath);
const mergedDialogue = mergeReview(existing && existing.dialogue, dialogue, 'dialogue');
const mergedLabels = mergeReview(existing && existing.labels, labels, 'labels');

const translation = {
  source_file: path.basename(krExePath),
  source_md5: crypto.createHash('md5').update(krBuf).digest('hex'),
  dialogue: mergedDialogue.map((e) => ({ offset: e.offset, length: e.length, text: e.text, fixed: e.fixed || '', confirmed: !!e.confirmed, jp: e.jp || '', jpOffset: e.jpOffset != null ? e.jpOffset : null })),
  labels: mergedLabels.map((e) => ({ offset: e.offset, length: e.length, text: e.text, fixed: e.fixed || '', confirmed: !!e.confirmed })),
};
fs.writeFileSync(outKrPath, JSON.stringify(translation, null, 2));
console.log(`wrote ${path.relative(ROOT, outKrPath)}: dialogue=${dialogue.length}, labels=${labels.length} (round-trip OK)`);

// --- JP (read-only reference) ---
if (!fs.existsSync(jpExePath)) fail(`JP exe not found: ${jpExePath}`);
const jpBuf = fs.readFileSync(jpExePath);

const jpDialogue = JP_TEXT.extract(jpBuf);
const jpExcludeMask = new Uint8Array(jpBuf.length);
for (const e of jpDialogue) for (let i = e.offset; i < e.offset + e.length; i++) jpExcludeMask[i] = 1;
const jpLabels = JP_NAMES.extract(jpBuf, jpExcludeMask);

const jpRef = {
  source_file: path.basename(jpExePath),
  source_md5: crypto.createHash('md5').update(jpBuf).digest('hex'),
  note: 'JP 원문 참고용 전량 덤프(읽기 전용). KR과 순서가 다르므로 offset/index 대응은 무의미 — labels는 이름/키워드로 직접 대조.',
  dialogue: jpDialogue.map((e) => ({ offset: e.offset, length: e.length, text: e.text })),
  labels: jpLabels.map((e) => ({ offset: e.offset, length: e.length, text: e.text })),
};
fs.writeFileSync(outJpPath, JSON.stringify(jpRef, null, 2));
console.log(`wrote ${path.relative(ROOT, outJpPath)}: dialogue=${jpDialogue.length}, labels=${jpLabels.length}`);
