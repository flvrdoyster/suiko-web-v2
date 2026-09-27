'use strict';

const DATA_RAW = 0x03A000;
const DATA_SIZE = 0x11DE00;
const DATA_END = DATA_RAW + DATA_SIZE;

const JUMP_TABLE_RANGES = [[0x3e538, 0x3e8ac]];

const NOISE_RANGES = [
  [0x44f45, 0x44f48], [0x57ee6, 0x57ee8], [0x69445, 0x69448], [0x94ef1, 0x94ef4],
  [0x94f11, 0x94f14], [0x94f2d, 0x94f30], [0xacefd, 0xacf00], [0xc0b29, 0xc0b2c],
  [0xc4451, 0xc4454], [0xf1c45, 0xf1c48], [0xf1fe5, 0xf1fe9], [0xf2005, 0xf2009],
  [0xf2021, 0xf2025], [0xf20d1, 0xf20d4], [0xf20f1, 0xf20f4], [0xf212d, 0xf2130],
  [0xf6e45, 0xf6e48], [0xfce4d, 0xfce50], [0x100e45, 0x100e48], [0x10c225, 0x10c228],
  [0x10c745, 0x10c748], [0x111ef9, 0x111efb], [0x12124d, 0x121250],
];

function inExcludedRange(off) {
  return JUMP_TABLE_RANGES.some(([s, e]) => off >= s && off < e)
    || NOISE_RANGES.some(([s, e]) => off >= s && off < e);
}

function isAsciiPrintable(b) {
  return b === 0x20 || (b >= 0x21 && b <= 0x7e);
}

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

function isFullwidthAlnum(buf, off) {
  const code = decodeCp949(buf.subarray(off, off + 2));
  if (!code) return false;
  const cp = code.codePointAt(0);
  return (cp >= 0xff10 && cp <= 0xff19) || (cp >= 0xff21 && cp <= 0xff3a) || (cp >= 0xff41 && cp <= 0xff5a);
}

const REAL_PUNCT_CODEPOINTS = new Set([0x2026, 0x3000, 0x300c, 0x300d, 0xff1f, 0xff01, 0xff0f, 0xff1a, 0xff08, 0xff09]);
function isRealPunct(buf, off) {
  const code = decodeCp949(buf.subarray(off, off + 2));
  if (!code) return false;
  return REAL_PUNCT_CODEPOINTS.has(code.codePointAt(0));
}

const iconv = require('iconv-lite');
function decodeCp949(bytes) {
  try {
    return iconv.decode(Buffer.from(bytes), 'cp949');
  } catch (e) {
    return null;
  }
}
// iconv-lite는 매핑 없는 문자를 '?' 1바이트로 바꿔 길이 검사를 통과시키므로 직접 거부한다
function encodeCp949(str) {
  const out = iconv.encode(str, 'cp949');
  const lost = [...str].filter((ch, i) => ch !== '?' && iconv.encode(ch, 'cp949')[0] === 0x3f
    && iconv.encode(ch, 'cp949').length === 1);
  if (lost.length) {
    const shown = [...new Set(lost)].map((c) =>
      `${JSON.stringify(c)}(U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ');
    throw new Error(`CP949로 인코딩할 수 없는 문자: ${shown} — ${JSON.stringify(str)}`);
  }
  return out;
}

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

function tableUnits(entries) {
  const units = [];
  let cur = null;
  for (const e of entries) {
    if (!cur || e.tableStart || cur[0].table !== e.table) { if (cur) units.push(cur); cur = [e]; }
    else cur.push(e);
  }
  if (cur) units.push(cur);
  return units;
}

const LINE_CAP = 24;
function capByteLen(str) {
  return encodeCp949(String(str).replace(/　+$/u, '')).length;
}

function build(buf, entries) {
  const out = Buffer.from(buf);
  const sorted = entries.slice().sort((a, b) => a.offset - b.offset);

  for (const e of sorted) {
    if (e.table != null) continue;
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

  const tableEntries = sorted.filter((e) => e.table != null);
  for (const unit of tableUnits(tableEntries)) {
    const need = unit.reduce((s, e) => s + e.length, 0);
    const encs = unit.map((e) => encodeCp949(e.fixed != null && e.fixed !== '' ? e.fixed : e.text));
    const got = encs.reduce((s, b) => s + b.length, 0);
    if (got !== need) {
      throw new Error(
        `table unit @0x${unit[0].offset.toString(16)} (${unit.length} lines) changed total byte ` +
        `length (${need} -> ${got}) — 단위 안에서 재분배는 되지만 합계는 같아야 한다: ` +
        unit.map((e, i) => `${JSON.stringify(e.text)}->${e.length}/${encs[i].length}B`).join(', ')
      );
    }
    let p = unit[0].offset;
    for (let i = 0; i < unit.length; i++) {
      encs[i].copy(out, p);
      p += encs[i].length;
      buf.copy(out, p, unit[i].offset + unit[i].length, unit[i].offset + unit[i].length + 4);
      p += 4;
    }
    const last = unit[unit.length - 1];
    const spanEnd = last.offset + last.length + 4;
    if (p !== spanEnd) {
      throw new Error(`table unit @0x${unit[0].offset.toString(16)} repack ended at ${p}, expected ${spanEnd}`);
    }
  }
  return out;
}

module.exports = { extract, build, tableUnits, LINE_CAP, capByteLen, decodeCp949, encodeCp949, DATA_RAW, DATA_END };
