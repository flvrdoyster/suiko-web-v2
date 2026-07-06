// gense-text.js — extract the Japanese dialogue text embedded in GENSE.EXE (JP original),
// for side-by-side comparison against the KR translation extracted by hwanse-text.js.
// Same structure as the KR side: literal Shift-JIS bytes inline in PE .data, lines
// terminated by literal '@' (0x40). See NOTES.md.
'use strict';

const iconv = require('iconv-lite');

const DATA_RAW = 0x039e00;
const DATA_SIZE = 0x120200;
const DATA_END = DATA_RAW + DATA_SIZE;

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

// Walks the buffer one character (not byte) at a time so a DBCS trail byte that happens
// to equal 0x40 ('@') is never mistaken for the literal single-byte '@' line terminator
// (Shift-JIS trail bytes span 0x40-0x7E/0x80-0xFC, unlike CP949's 0x41-0xFE, so this
// ambiguity is JP-specific — see NOTES.md).
function extract(buf) {
  const entries = [];
  let i = DATA_RAW;
  let segStart = i;
  let jpCount = 0;
  const flushSegment = (end) => {
    if (end > segStart && jpCount >= 1) {
      const seg = buf.subarray(segStart, end);
      const text = decodeCp932(seg);
      if (text) entries.push({ offset: segStart, length: seg.length, text });
    }
  };
  while (i < DATA_END) {
    const len = charLenAt(buf, i);
    if (len === 0) {
      segStart = i + 1;
      jpCount = 0;
      i += 1;
      continue;
    }
    if (len === 1 && buf[i] === 0x40) {
      flushSegment(i);
      i += 1;
      segStart = i;
      jpCount = 0;
      continue;
    }
    if (len === 2 && isJapaneseChar(buf, i)) jpCount++;
    i += len;
  }
  return entries;
}

module.exports = { extract, decodeCp932, encodeCp932, DATA_RAW, DATA_END };
