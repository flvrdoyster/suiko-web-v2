// gense-text.js — extract the Japanese dialogue text embedded in GENSE.EXE (JP original),
// for side-by-side comparison against the KR translation extracted by hwanse-text.js.
// Same structure as the KR side: literal Shift-JIS bytes inline in PE .data, lines
// terminated by literal '@' (0x40). See NOTES.md.
'use strict';

const iconv = require('iconv-lite');

const DATA_RAW = 0x039e00;
const DATA_SIZE = 0x120200;
const DATA_END = DATA_RAW + DATA_SIZE;

// Confirmed noise (stray control/pointer bytes that happen to decode as valid-looking
// Shift-JIS text — same class of false positive as hwanse-text.js's JUMP_TABLE_RANGES):
// found via the KR<->JP anchor-cascade "untouched JP line" audit, then verified by
// inspecting the surrounding raw bytes — all three sit in the middle of large gaps with no
// other extracted text nearby (338494→350524, 577052→620228, 1320330→1366732), unlike real
// dialogue; the third also has control byte 0xff, never seen on genuine dialogue lines.
const NOISE_RANGES = [[0x054490, 0x05450e], [0x08d07d, 0x08d080], [0x14aafa, 0x14ab98]]; // 345232-345358, 577661-577664, 1354490-1354648
function inExcludedRange(off) {
  return NOISE_RANGES.some(([s, e]) => off >= s && off < e);
}

function isAsciiPrintable(b) {
  return b === 0x20 || (b >= 0x21 && b <= 0x7e);
}

function charLenAt(buf, off) {
  const b = buf[off];
  if (isAsciiPrintable(b)) return 1;
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
  const s = decodeCp932(buf.subarray(off, off + 2));
  if (!s) return false;
  const cp = s.codePointAt(0);
  // hiragana, katakana, CJK unified ideographs, JIS punctuation block
  return (cp >= 0x3040 && cp <= 0x30ff) || (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3000 && cp <= 0x303f);
}

// Fullwidth Latin letters/digits (U+FF10-FF19/FF21-FF3A/FF41-FF5A) — e.g. a standalone
// currency "Ｇ" symbol. Same signal as hwanse-text.js's isFullwidthAlnum (KR side).
function isFullwidthAlnum(buf, off) {
  const s = decodeCp932(buf.subarray(off, off + 2));
  if (!s) return false;
  const cp = s.codePointAt(0);
  return (cp >= 0xff10 && cp <= 0xff19) || (cp >= 0xff21 && cp <= 0xff3a) || (cp >= 0xff41 && cp <= 0xff5a);
}

// Real dialogue punctuation with no other Japanese char at all — silent-reaction lines like
// "………" are common. isJapaneseChar's 0x3000-0x303f block already covers 「」　, so this
// only needs to add the ones outside it. Same exhaustive-scan method as hwanse-text.js's
// REAL_PUNCT_CODEPOINTS (kept as one shared set there; duplicated here since these two
// files intentionally don't share code — see their own file-top comments).
const REAL_PUNCT_CODEPOINTS = new Set([0x2026, 0xff1f, 0xff01, 0xff0f, 0xff1a, 0xff08, 0xff09]);
function isRealPunct(buf, off) {
  const s = decodeCp932(buf.subarray(off, off + 2));
  if (!s) return false;
  return REAL_PUNCT_CODEPOINTS.has(s.codePointAt(0));
}

// Walks the buffer one character (not byte) at a time so a DBCS trail byte that happens
// to equal 0x40 ('@') is never mistaken for the literal single-byte '@' line terminator
// (Shift-JIS trail bytes span 0x40-0x7E/0x80-0xFC, unlike CP949's 0x41-0xFE, so this
// ambiguity is JP-specific — see NOTES.md).
function extract(buf) {
  const entries = [];
  let i = DATA_RAW;
  let segStart = i;
  let jpCount = 0;
  let letterCount = 0;
  let punctCount = 0;
  const flushSegment = (end) => {
    if (end > segStart && (jpCount >= 1 || letterCount >= 3 || punctCount >= 1)) {
      const seg = buf.subarray(segStart, end);
      const text = decodeCp932(seg);
      if (text) entries.push({ offset: segStart, length: seg.length, text });
    }
  };
  while (i < DATA_END) {
    if (inExcludedRange(i)) {
      segStart = i + 1;
      jpCount = 0;
      letterCount = 0;
      punctCount = 0;
      i += 1;
      continue;
    }
    const len = charLenAt(buf, i);
    if (len === 0) {
      segStart = i + 1;
      jpCount = 0;
      letterCount = 0;
      punctCount = 0;
      i += 1;
      continue;
    }
    if (len === 1 && buf[i] === 0x40) {
      flushSegment(i);
      i += 1;
      segStart = i;
      jpCount = 0;
      letterCount = 0;
      punctCount = 0;
      continue;
    }
    if (len === 2 && isJapaneseChar(buf, i)) jpCount++;
    if (len === 1 && /[A-Za-z0-9]/.test(String.fromCharCode(buf[i]))) letterCount++;
    if (len === 2 && isFullwidthAlnum(buf, i)) letterCount++;
    if (len === 2 && isRealPunct(buf, i)) punctCount++;
    i += len;
  }
  return entries;
}

module.exports = { extract, decodeCp932, encodeCp932, DATA_RAW, DATA_END };
