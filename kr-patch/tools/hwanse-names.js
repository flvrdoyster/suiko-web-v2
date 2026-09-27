// hwanse-names.js — HWANSE.EXE 아이템·의상·기술 이름표 추출/빌드.
'use strict';

const iconv = require('iconv-lite');
const { DATA_RAW, DATA_END } = require('./hwanse-text.js');

const NUMERIC_TABLE_RANGES = [
  [0xca300, 0xcaaf6],
  [0xcab08, 0xcb308],
];

// 노이즈로 확인된 개별 시작 오프셋
const NOISE_OFFSETS = new Set([
  0x561c1, 0x561f9, 0x56231, 0x56892, // "뼬뼬" ×3, "뻚뼎"
  0xd4c21, 0xd514d, 0xd9b6d,          // "햊 큞", "햊.늫", "픜 쑝"
]);

// 둘로 끊기던 오류 메시지 문자열을 하나로
const JOIN_OFFSETS = { 0x10e18c: 26 };

// 틈 없이 붙은 16바이트 슬롯 레이블(설정 메뉴)을 나눔
const SPLIT_INTO_16_OFFSETS = new Set([0x8a042]);

function isLatinLetter(b) {
  return (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a);
}
// 레이블에 허용하는 ASCII: 공백·마침표·숫자·영문
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

// 첫 영문 노이즈 런 [start, end) 또는 null
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
    // 패딩 바로 뒤, 구간 끝의 숫자는 노이즈
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

// 0xa1 0xdb = full-width ○ (a censor/placeholder circle, e.g. "○○책" — the retail
// translators' redaction of an adult joke item name, same device as "Ｈな本" in JP).
function hasCircle(buf, off, len) {
  for (let i = off; i + 1 < off + len; i++) {
    if (buf[i] === 0xa1 && buf[i + 1] === 0xdb) return true;
  }
  return false;
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
    // 한글 2음절 이상(○○책 예외)
    const hangul = countHangul(buf, start, end - start);
    const clean = hangul >= 2 || (hangul >= 1 && hasCircle(buf, start, end - start));
    if (!NOISE_OFFSETS.has(start) && clean) {
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
      // JOIN_OFFSETS 구간은 통째로 한 항목
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

// 같은 바이트 길이만 허용(짧으면 전각 공백 패딩은 편집 쪽에서)
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
