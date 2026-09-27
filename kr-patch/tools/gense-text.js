'use strict';

const iconv = require('iconv-lite');

const DATA_RAW = 0x039e00;
const DATA_SIZE = 0x120200;
const DATA_END = DATA_RAW + DATA_SIZE;

const NOISE_RANGES = [[0x054490, 0x05450e], [0x08d07d, 0x08d080], [0x14aafa, 0x14ab98], [0x0771f2, 0x0771f4]];
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
  return (cp >= 0x3040 && cp <= 0x30ff) || (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3000 && cp <= 0x303f);
}

function isFullwidthAlnum(buf, off) {
  const s = decodeCp932(buf.subarray(off, off + 2));
  if (!s) return false;
  const cp = s.codePointAt(0);
  return (cp >= 0xff10 && cp <= 0xff19) || (cp >= 0xff21 && cp <= 0xff3a) || (cp >= 0xff41 && cp <= 0xff5a);
}

const REAL_PUNCT_CODEPOINTS = new Set([0x2026, 0xff1f, 0xff01, 0xff0f, 0xff1a, 0xff08, 0xff09]);
function isRealPunct(buf, off) {
  const s = decodeCp932(buf.subarray(off, off + 2));
  if (!s) return false;
  return REAL_PUNCT_CODEPOINTS.has(s.codePointAt(0));
}

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
