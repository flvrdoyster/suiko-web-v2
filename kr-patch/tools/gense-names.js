// gense-names.js — extract the JP item/costume/technique/label text embedded in
// GENSE.EXE, for cross-checking hwanse-names.js's KR extraction (same tables, different
// locale build). Read-only reference — no build().
//
// Same maximal-valid-run approach as hwanse-names.js (see that file's doc comment for the
// full rationale): capture Katakana/Kanji/ASCII/full-width-space/middle-dot runs bounded
// by non-text control bytes, rather than anchoring on a padding run (which breaks when a
// full-width space is a real word separator, or when a name has zero trailing padding).
// The full-width space/middle-dot byte pairs differ from the KR side because CP949 and
// Shift-JIS encode U+3000/U+30FB differently — see kr-patch/docs/NOTES.md.
'use strict';

const iconv = require('iconv-lite');

const DATA_RAW = 0x039e00;
const DATA_SIZE = 0x120200;
const DATA_END = DATA_RAW + DATA_SIZE;

function isLatinLetter(b) {
  return (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a);
}
function isAllowedAscii(b) {
  return b === 0x20 || b === 0x2e || (b >= 0x30 && b <= 0x39) || isLatinLetter(b);
}
function charLenAt(buf, off) {
  const b = buf[off];
  if (isAllowedAscii(b)) return 1;
  if (b === 0x81 && (buf[off + 1] === 0x40 || buf[off + 1] === 0x41)) return 2; // 　or ・
  if ((b >= 0x81 && b <= 0x9f) || (b >= 0xe0 && b <= 0xfc)) {
    if (off + 1 >= buf.length) return 0;
    const t = buf[off + 1];
    if ((t >= 0x40 && t <= 0x7e) || (t >= 0x80 && t <= 0xfc)) return 2;
  }
  return 0;
}
function decodeCp932(bytes) {
  try {
    return iconv.decode(Buffer.from(bytes), 'cp932');
  } catch (e) {
    return null;
  }
}
function encodeCp932(str) {
  return iconv.encode(str, 'cp932');
}
function isJapaneseChar(buf, off) {
  if (buf[off] === 0x81) return false; // full-width space/middle-dot, not a JP letter
  const s = decodeCp932(buf.subarray(off, off + 2));
  if (!s) return false;
  const cp = s.codePointAt(0);
  return (cp >= 0x3040 && cp <= 0x30ff) || (cp >= 0x4e00 && cp <= 0x9fff);
}

function isUpper(b) {
  return b >= 0x41 && b <= 0x5a;
}

// Same noise guard as hwanse-names.js: a Latin-letter run shorter than 3 bytes, mixed-case,
// or containing 3+ identical consecutive letters ("xxxddd"), was always coincidental
// stat-byte noise in the KR file; applying the same rule here since the record format is
// shared. Returns [start, end) of the first noise run, or null if clean — noise can
// precede real text too (e.g. a leading digit+letter from the previous record's stat
// bytes), so the caller splits and re-checks both sides rather than just truncating the
// tail. See hwanse-names.js's findNoiseRun()/emitCleanEntries() for the full rationale.
function findNoiseRun(buf, off, len) {
  let i = off;
  while (i < off + len) {
    const l = charLenAt(buf, i);
    if (l === 1 && isLatinLetter(buf[i])) {
      let runLen = 1;
      let mixedCase = false;
      let maxRepeat = 1;
      let curRepeat = 1;
      let j = i + 1;
      while (j < off + len && charLenAt(buf, j) === 1 && isLatinLetter(buf[j])) {
        if (isUpper(buf[j]) !== isUpper(buf[i])) mixedCase = true;
        curRepeat = buf[j] === buf[j - 1] ? curRepeat + 1 : 1;
        if (curRepeat > maxRepeat) maxRepeat = curRepeat;
        runLen++;
        j++;
      }
      if (runLen < 3 || mixedCase || maxRepeat >= 3) return [i, j];
      i = j;
      continue;
    }
    i += l || 1;
  }
  return null;
}

function countJapanese(buf, off, len) {
  let count = 0;
  let i = off;
  while (i < off + len) {
    const l = charLenAt(buf, i);
    if (l === 2 && isJapaneseChar(buf, i)) count++;
    i += l || 1;
  }
  return count;
}

function emitCleanEntries(buf, start, end, entries) {
  if (end <= start) return;
  const noise = findNoiseRun(buf, start, end - start);
  if (!noise) {
    if (countJapanese(buf, start, end - start) >= 2) {
      const text = decodeCp932(buf.subarray(start, end));
      if (text) entries.push({ offset: start, length: end - start, text });
    }
    return;
  }
  const [noiseStart, noiseEnd] = noise;
  emitCleanEntries(buf, start, noiseStart, entries);
  emitCleanEntries(buf, noiseEnd, end, entries);
}

function extract(buf, excludeMask) {
  const entries = [];
  let i = DATA_RAW;
  let segStart = i;
  while (i < DATA_END) {
    if (excludeMask && excludeMask[i]) {
      emitCleanEntries(buf, segStart, i, entries);
      segStart = i + 1;
      i++;
      continue;
    }
    const len = charLenAt(buf, i);
    if (len === 0) {
      emitCleanEntries(buf, segStart, i, entries);
      segStart = i + 1;
      i++;
      continue;
    }
    i += len;
  }
  return entries;
}

module.exports = { extract, decodeCp932, encodeCp932 };
