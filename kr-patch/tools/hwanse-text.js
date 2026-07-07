// hwanse-text.js — extract/rebuild the Korean dialogue text embedded in HWANSE.EXE.
//
// Findings this format is based on (see NOTES.md for the full trail):
//   * Text lives as literal CP949 bytes inline in the PE .data section (not in GENSE.FLD,
//     which contains no readable Korean at all — confirmed by anchor-word frequency scan).
//   * Each line is terminated by a literal '@' (0x40) byte, not NUL. Lines use full-width
//     spaces/punctuation (　？！「」…) consistent with a fixed-width text renderer.
//   * No code or data in the whole file references these strings' file offset, RVA, or
//     absolute VA as a 32-bit immediate (checked for several samples) — so there is no
//     pointer table pointing at individual strings. The engine appears to consume this
//     region as a linear byte stream. This means in-place edits are not constrained to
//     preserve byte length the way pointer-table-driven formats are, though we still
//     default to same-length patches as the conservative choice (see build()).
//
// extract(buf) -> [{offset, length, text}]  (length excludes the trailing '@')
// build(buf, entries) -> Buffer with each entry's text re-encoded in place, replacing the
//   original [offset, offset+length) span; if the new encoded length differs, the file
//   grows/shrinks starting at that point (every later offset shifts) unless entries are
//   applied longest-first is NOT done automatically — see build()'s same-length assertion.
'use strict';

const DATA_RAW = 0x03A000;
const DATA_SIZE = 0x11DE00;
const DATA_END = DATA_RAW + DATA_SIZE;

// 0x3e538-0x3e8ac is a binary jump/address table: 4-byte records shaped
// [2-byte offset][0x40 or 0x41][0x00] repeating with a fixed stride. The lead 2 bytes
// coincidentally decode as valid single CP949 Hangul syllables often enough, and the
// record's own 0x40 byte is indistinguishable from the real dialogue line terminator '@'
// — together they were leaking ~38 bogus single-syllable "dialogue lines" into extract()
// (all with the tell: the byte right after their '@' was always 0x00, whereas every real
// dialogue line — including genuine short ones like the day-of-week labels 일/월/화/…— is
// followed by a documented control byte such as 0x02/0x06/0x0A/0x10). See NOTES.md.
const JUMP_TABLE_RANGES = [[0x3e538, 0x3e8ac]];
function inExcludedRange(off) {
  return JUMP_TABLE_RANGES.some(([s, e]) => off >= s && off < e);
}

function isAsciiPrintable(b) {
  return b === 0x20 || (b >= 0x21 && b <= 0x7e);
}

// Returns char byte-length (1 or 2) if `buf[off]` starts a valid CP949/ASCII character, else 0.
function charLenAt(buf, off) {
  const b = buf[off];
  if (isAsciiPrintable(b)) return 1;
  if (b >= 0x81 && b <= 0xfe && off + 1 < buf.length) {
    const t = buf[off + 1];
    if (t >= 0x41 && t <= 0xfe && t !== 0x7f) return 2;
  }
  return 0;
}

function isHangulSyllable(buf, off) {
  const code = decodeCp949(buf.subarray(off, off + 2));
  if (!code) return false;
  const cp = code.codePointAt(0);
  return cp >= 0xac00 && cp <= 0xd7a3;
}

// Fullwidth Latin letters/digits (U+FF10-FF19/FF21-FF3A/FF41-FF5A) — the credits' romanized
// staff names are written this way in places ("Ｔｈａｎｋｓ", 2 bytes/char), not as
// halfwidth ASCII, so they don't trip charLenAt's 1-byte path at all.
function isFullwidthAlnum(buf, off) {
  const code = decodeCp949(buf.subarray(off, off + 2));
  if (!code) return false;
  const cp = code.codePointAt(0);
  return (cp >= 0xff10 && cp <= 0xff19) || (cp >= 0xff21 && cp <= 0xff3a) || (cp >= 0xff41 && cp <= 0xff5a);
}

// Real dialogue punctuation that can appear with NO Hangul/alnum at all — silent-reaction
// lines like "「………」"/"「？？？」" are common in this game. Found by exhaustively listing
// every codepoint in every currently-dropped (hangul=0, letterCount<3) segment: this exact
// set (…　「」？！／：（）) covers every one of them, and nothing else — genuine noise
// (stray control bytes that happen to decode as valid CP949) never lands on one of these
// specific codepoints, only on unrelated ones (single ASCII letters, U+FFFD, etc.).
const REAL_PUNCT_CODEPOINTS = new Set([0x2026, 0x3000, 0x300c, 0x300d, 0xff1f, 0xff01, 0xff0f, 0xff1a, 0xff08, 0xff09]);
function isRealPunct(buf, off) {
  const code = decodeCp949(buf.subarray(off, off + 2));
  if (!code) return false;
  return REAL_PUNCT_CODEPOINTS.has(code.codePointAt(0));
}

// Minimal CP949 decoder sufficient for this file's byte ranges. We only need this to
// classify bytes and to produce human-readable text; we round-trip through it symmetrically
// (decodeCp949 / encodeCp949) so re-encoding never depends on Node's absent native cp949.
const iconv = require('iconv-lite');
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

// Walks the buffer one character (not byte) at a time — see gense-text.js's extract for
// why this matters for Shift-JIS; CP949 trail bytes never equal 0x40 so this ambiguity
// can't occur here, but the same walk shape is used for consistency between both sides.
//
// A segment with zero Hangul is normally noise (stray bytes that happen to decode as valid
// CP949/ASCII — same class of false positive as JUMP_TABLE_RANGES above), EXCEPT genuine
// untranslated English content, e.g. the staff-credits block's romanized names ("Kawachi
// Yumedaiko", "& ALL COMPILE STAFF" — Compile kept these in Latin script even in the KR
// build). Exhaustively scanning every zero-Hangul segment in .data found a clean split: the
// 19 real credits entries all have >=3 letters, every noise segment (stray control bytes
// that happen to look like "d"/"00"/"H"/etc.) has <=2 — so that's the threshold.
function extract(buf) {
  const entries = [];
  let i = DATA_RAW;
  let segStart = i;
  let hangulCount = 0;
  let letterCount = 0;
  let punctCount = 0;
  const flushSegment = (end) => {
    if (end > segStart && (hangulCount >= 1 || letterCount >= 3 || punctCount >= 1)) {
      const seg = buf.subarray(segStart, end);
      const text = decodeCp949(seg);
      if (text) entries.push({ offset: segStart, length: seg.length, text });
    }
  };
  while (i < DATA_END) {
    if (inExcludedRange(i)) {
      segStart = i + 1;
      hangulCount = 0;
      letterCount = 0;
      punctCount = 0;
      i += 1;
      continue;
    }
    const len = charLenAt(buf, i);
    if (len === 0) {
      segStart = i + 1;
      hangulCount = 0;
      letterCount = 0;
      punctCount = 0;
      i += 1;
      continue;
    }
    if (len === 1 && buf[i] === 0x40) {
      flushSegment(i);
      i += 1;
      segStart = i;
      hangulCount = 0;
      letterCount = 0;
      punctCount = 0;
      continue;
    }
    if (len === 2 && isHangulSyllable(buf, i)) hangulCount++;
    if (len === 1 && /[A-Za-z0-9]/.test(String.fromCharCode(buf[i]))) letterCount++;
    if (len === 2 && isFullwidthAlnum(buf, i)) letterCount++;
    if (len === 2 && isRealPunct(buf, i)) punctCount++;
    i += len;
  }
  return entries;
}

// Re-encode entries' `fixed` (falling back to `text`) into `buf` at [offset, offset+length).
// Refuses (throws) if any replacement's CP949 byte length differs from the original slot,
// since we have not yet proven the engine tolerates a shifted region (see NOTES.md — no
// pointer table was found, which suggests shifting is *probably* safe, but that has not
// been verified in the emulator, so build() stays conservative until it is).
function build(buf, entries) {
  const out = Buffer.from(buf);
  for (const e of entries) {
    const newText = e.fixed != null && e.fixed !== '' ? e.fixed : e.text;
    const encoded = encodeCp949(newText);
    if (encoded.length !== e.length) {
      throw new Error(
        `entry @0x${e.offset.toString(16)} changed byte length ` +
        `(${e.length} -> ${encoded.length}): ${JSON.stringify(e.text)} -> ${JSON.stringify(newText)}`
      );
    }
    encoded.copy(out, e.offset);
  }
  return out;
}

module.exports = { extract, build, decodeCp949, encodeCp949, DATA_RAW, DATA_END };
