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
// backward from there. That approach broke on two real cases (see NOTES.md
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

// Individual offsets that decode as short 2-syllable Hangul runs but are binary noise, not
// real labels (manually confirmed: "뼬뼬", "햊 큞", etc). Excluded by exact start offset
// rather than a range, since a range could swallow a genuine label sitting between them.
const NOISE_OFFSETS = new Set([
  0x561c1, 0x561f9, 0x56231, 0x56892, // "뼬뼬" ×3, "뻚뼎"
  0xd4c21, 0xd514d, 0xd9b6d,          // "햊 큞", "햊.늫", "픜 쑝"
]);

// 0x10e18c is a NUL-terminated printf-style error message template — 파일 "%s" 가
// 열리지 않음 ("File \"%s\" could not be opened") — sitting among unrelated
// non-Korean debug/driver strings ("playing", "WLKF", "SOUND LO..."). Its `"` and `%`
// bytes aren't in the allowed-ASCII set (kept narrow deliberately — see isAllowedAscii —
// broadening it risks readmitting the stat-byte noise that set was built to keep out), so
// the scanner split it into two fragments ("파일 " / " 가　열리지　않음") at those bytes.
// Rather than broaden the general charset, this one known-good span is force-joined into
// a single entry, byte range fixed by inspection (a NUL immediately follows at the end).
const JOIN_OFFSETS = { 0x10e18c: 26 };

// 0x8a042 is a settings-menu list ("커서 위치"/"문자 표시속도"/"사운드"/"묘화 스킵"/
// "게임 종료") where five real 16-byte-slot labels sit back-to-back with NO invalid byte
// between them (unlike the costume/weapon table, where records are separated by stat
// bytes) — so the maximal-run scanner merged all five into one 80-byte entry instead of
// five 16-byte ones. Confirmed each 16-byte chunk decodes to a standalone real label.
// Listed by offset since this concatenation-with-no-gap shape hasn't been seen elsewhere;
// promote to a general rule if more turn up.
const SPLIT_INTO_16_OFFSETS = new Set([0x8a042]);

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
// 매핑 없는 문자를 '?'로 뭉개지 않고 실패시킨다 — 이유는 hwanse-text.js 동명 함수 주석 참고.
function encodeCp949(str) {
  const out = iconv.encode(str, 'cp949');
  const lost = [...str].filter((ch) => ch !== '?' && iconv.encode(ch, 'cp949').length === 1
    && iconv.encode(ch, 'cp949')[0] === 0x3f);
  if (lost.length) {
    const shown = [...new Set(lost)].map((c) =>
      `${JSON.stringify(c)}(U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ');
    throw new Error(`CP949로 인코딩할 수 없는 문자: ${shown} — ${JSON.stringify(str)}`);
  }
  return out;
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

// Scans [off, off+len) for the FIRST Latin-letter run that looks like coincidental
// stat-byte noise rather than real text — shorter than 3 bytes, mixed-case ("sZnPdd"), or
// containing 3+ identical consecutive letters ("xxxddd" is two back-to-back triples of
// that shape) all matched noise empirically, while every real example found was a single
// consistently-cased whole word ("ver") with no repeated-letter run. See module doc
// comment and NOTES.md.
//
// Returns [start, end) of the noise run, or null if the span is clean. The caller doesn't
// just truncate at `start` — noise can precede real text too (a leading digit+letter from
// the previous record's stat bytes, e.g. "9A인민복" where "9A" is noise and "인민복" is a
// real name that would otherwise be discarded along with it), so the span on *both* sides
// of the noise run needs to be considered separately. See emitCleanEntries().
function isDigit(b) {
  return b >= 0x30 && b <= 0x39;
}
function isPadPairAt(buf, off) {
  return buf[off] === 0xa1 && buf[off + 1] === 0xa1;
}

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
    // A digit run immediately preceded by full-width-space padding is coincidental
    // stat-byte noise, not real content — real numbers in this table always sit right
    // after real text (e.g. "환세취호전 ver.1.0", digit after "ver."), never right after a
    // padding run. Confirmed on two real cases: "호랑이발톱　　　2" / "마인아수라　　　2"
    // (the trailing '2' is stat-byte 0x32, not the 0x01-0x04 raw level-id byte the real
    // record structure uses — see NOTES.md). Only fires when the digit run
    // sits at the very end of the whole span (i.e. immediately hits an invalid byte next),
    // matching both confirmed cases and avoiding false positives on real mid-string digits.
    if (l === 1 && isDigit(buf[i]) && i - 2 >= off && isPadPairAt(buf, i - 2)) {
      let j = i;
      while (j < off + len && charLenAt(buf, j) === 1 && isDigit(buf[j])) j++;
      if (j === off + len) return [i, j];
    }
    i += l || 1;
  }
  return null;
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

// Emits clean sub-spans of [start, end), splitting around every noise run found inside
// (noise can appear before, after, or between real text — see findNoiseRun()).
function emitCleanEntries(buf, start, end, entries) {
  if (end <= start) return;
  if (SPLIT_INTO_16_OFFSETS.has(start)) {
    for (let s = start; s < end; s += 16) {
      const text = decodeCp949(buf.subarray(s, s + 16));
      if (text) entries.push({ offset: s, length: 16, text });
    }
    return;
  }
  const noise = findNoiseRun(buf, start, end - start);
  if (!noise) {
    if (!NOISE_OFFSETS.has(start) && countHangul(buf, start, end - start) >= 2) {
      const text = decodeCp949(buf.subarray(start, end));
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
    if (i in JOIN_OFFSETS) {
      // Flush whatever ran up to here normally, then force the whole known span through
      // as one entry (its embedded '"'/'%' bytes aren't otherwise valid chars, so the
      // normal walk below would treat them as a segment break — see JOIN_OFFSETS).
      emitCleanEntries(buf, segStart, i, entries);
      const len = JOIN_OFFSETS[i];
      const text = decodeCp949(buf.subarray(i, i + len));
      if (text) entries.push({ offset: i, length: len, text });
      i += len;
      segStart = i;
      continue;
    }
    if ((excludeMask && excludeMask[i]) || inNumericTable(i)) {
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

// Same conservative policy as hwanse-text.js/hwanse-strings.js: the replacement must
// encode to the exact same byte length as the original (NOTES.md's "길이
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
