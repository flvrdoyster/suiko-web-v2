// hwanse-names.js — extract the item/costume/technique name table embedded in HWANSE.EXE.
//
// This is a THIRD text shape distinct from hwanse-text.js's '@'-terminated dialogue and
// hwanse-strings.js's NUL-terminated system strings: a maximal run of Hangul/ASCII/
// full-width-space(0xA1A1)/middle-dot(0xA1A4) characters, immediately followed by a
// non-text control byte (a level-id 0x01-0x04 for multi-level techniques, or a 0xFF
// sentinel for single-level ones — either way NOT a valid CP949/ASCII lead byte, so the
// character-boundary walk stops there on its own with no special-casing needed).
//
// This replaced an earlier version that anchored on "padding run start" to find names
// backward from there. That approach broke on two real cases (see kr-patch/docs/NOTES.md
// for the full trail):
//   - the full-width space is NOT always trailing padding — some display names have a
//     REAL internal space ("지옥　다리후리기" = "Hell Leg Sweep", one name, one word each
//     side of the space), which the old anchor-from-padding approach split into two
//     separate entries ("지옥" and "다리후리기").
//   - some names have ZERO trailing padding at all (nameEnd bumps directly into the next
//     control byte), which the old approach — anchored on finding a padding run — could
//     never discover in the first place ("다리후리기" alone was invisible to it).
// Both are fixed by not trying to distinguish "name" from "padding" at extraction time at
// all: capture the whole maximal run (trailing padding spaces included) as one entry, and
// let build() re-pad on save. This does mean a captured `text` may have visible trailing
// full-width spaces — that's real slot padding a reviewer can leave alone.
//
// Two ~2KB regions (0x39F600 offset range around 0xca300-0xcaaf6 and 0xcab08-0xcb308) are
// hard-excluded: they're monotonically-increasing 16-bit lookup tables (likely animation/
// rotation data) whose bytes coincidentally decode as CP949 Hangul often enough to leak
// past the hangul-count filter otherwise.
'use strict';

const iconv = require('iconv-lite');
const { DATA_RAW, DATA_END } = require('./hwanse-text.js');

const NUMERIC_TABLE_RANGES = [
  [0xca300, 0xcaaf6],
  [0xcab08, 0xcb308],
];

function isLatinLetter(b) {
  return (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a);
}
// Deliberately narrower than "printable ASCII": labels only ever legitimately contain
// space/period/digit/letter (e.g. "환세취호전 ver.1.0"). Other single-byte punctuation
// (!, #, etc.) only ever showed up as coincidental stat-byte noise directly after a real
// name — including it here previously let the run swallow that noise byte, which then
// made the WHOLE run (real name included) get discarded by looksLikeNoise(). Stopping
// the run right at the punctuation instead keeps the real name intact.
function isAllowedAscii(b) {
  return b === 0x20 || b === 0x2e || (b >= 0x30 && b <= 0x39) || isLatinLetter(b);
}
function charLenAt(buf, off) {
  const b = buf[off];
  if (isAllowedAscii(b)) return 1;
  if (b === 0xa1 && (buf[off + 1] === 0xa1 || buf[off + 1] === 0xa4)) return 2; // 　or ・
  if (b >= 0x81 && b <= 0xfe && off + 1 < buf.length) {
    const t = buf[off + 1];
    if (t >= 0x41 && t <= 0xfe && t !== 0x7f) return 2;
  }
  return 0;
}
function decodeCp949(bytes) {
  try {
    return iconv.decode(Buffer.from(bytes), 'cp949');
  } catch (e) {
    return null;
  }
}
function encodeCp949(str) {
  return iconv.encode(str, 'cp949');
}
function isHangulSyllable(buf, off) {
  if (buf[off] === 0xa1) return false; // full-width space/middle-dot, not Hangul
  const s = decodeCp949(buf.subarray(off, off + 2));
  if (!s) return false;
  const cp = s.codePointAt(0);
  return cp >= 0xac00 && cp <= 0xd7a3;
}

function isUpper(b) {
  return b >= 0x41 && b <= 0x5a;
}

// Scans [off, off+len) for a Latin-letter run that looks like coincidental stat-byte
// noise rather than real text — shorter than 3 bytes, mixed-case ("sZnPdd"), or containing
// 3+ identical consecutive letters ("xxxddd" is two back-to-back triples of that shape)
// all matched noise empirically, while every real example found was a single
// consistently-cased whole word ("ver") with no repeated-letter run. See module doc
// comment and kr-patch/docs/NOTES.md.
//
// Returns the offset where the noise run starts, or -1 if the span is clean. A caller
// truncates the entry there instead of discarding the whole span — a real name
// immediately followed by noise (no invalid byte in between, e.g. "대폭발　　　　　xxxddd")
// would otherwise lose its real portion too.
function findNoiseStart(buf, off, len) {
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
      if (runLen < 3 || mixedCase || maxRepeat >= 3) return i;
      i = j;
      continue;
    }
    i += l || 1;
  }
  return -1;
}

function countHangul(buf, off, len) {
  let count = 0;
  let i = off;
  while (i < off + len) {
    const l = charLenAt(buf, i);
    if (l === 2 && isHangulSyllable(buf, i)) count++;
    i += l || 1;
  }
  return count;
}

function inNumericTable(off) {
  return NUMERIC_TABLE_RANGES.some(([s, e]) => off >= s && off < e);
}

function extract(buf, excludeMask) {
  const entries = [];
  let i = DATA_RAW;
  let segStart = i;
  while (i < DATA_END) {
    if ((excludeMask && excludeMask[i]) || inNumericTable(i)) {
      segStart = i + 1;
      i++;
      continue;
    }
    const len = charLenAt(buf, i);
    if (len === 0) {
      const noiseAt = findNoiseStart(buf, segStart, i - segStart);
      const trueEnd = noiseAt >= 0 ? noiseAt : i;
      if (trueEnd > segStart && countHangul(buf, segStart, trueEnd - segStart) >= 2) {
        const text = decodeCp949(buf.subarray(segStart, trueEnd));
        if (text) entries.push({ offset: segStart, length: trueEnd - segStart, text });
      }
      segStart = i + 1;
      i++;
      continue;
    }
    i += len;
  }
  return entries;
}

// Same conservative policy as hwanse-text.js/hwanse-strings.js: the replacement must
// encode to the exact same byte length as the original (kr-patch/docs/NOTES.md's "길이
// 변경은 안전하지 않다" policy) — but here that length commonly includes trailing
// full-width-space padding, so a reviewer shortening the visible name should pad it back
// out with '　' themselves (the editor does this automatically).
function build(buf, entries) {
  const out = Buffer.from(buf);
  for (const e of entries) {
    const newText = e.fixed != null && e.fixed !== '' ? e.fixed : e.text;
    const encoded = encodeCp949(newText);
    if (encoded.length !== e.length) {
      throw new Error(
        `name @0x${e.offset.toString(16)} changed byte length ` +
        `(${e.length} -> ${encoded.length}): ${JSON.stringify(e.text)} -> ${JSON.stringify(newText)}`
      );
    }
    encoded.copy(out, e.offset);
  }
  return out;
}

module.exports = { extract, build, decodeCp949, encodeCp949 };
