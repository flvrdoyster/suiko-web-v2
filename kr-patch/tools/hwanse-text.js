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

// Confirmed noise elsewhere in .data (stray control/pointer bytes coincidentally valid
// CP949, same false-positive class as the jump table above — see gense-text.js's
// NOISE_RANGES for the JP-side equivalent). Found via the KR<->JP anchor-cascade audit:
// each of these decodes to one of exactly 6 garbled strings ("죋l"/"쟡h"/"캾`"/"픜"/"륯"/
// "쟡h4") and sits alone in a multi-KB gap with no other extracted text nearby — unlike
// real dialogue, which is packed with minimal gaps (see NOTES.md's "라인 레코드 구조").
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
// iconv-lite는 매핑 없는 문자를 조용히 '?'(0x3f) 한 바이트로 바꾼다 — 반각이라 길이 검사도
// 못 거른다(예: '・' 두 개 = 1B×2 = 2B로 전각 1글자 슬롯을 통과). 매핑 누락은 실패시킨다.
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

// 포인터 테이블 구간의 "단위"로 묶는다 — tableStart(포인터가 직접 가리키는 줄)에서 시작해
// 다음 tableStart 직전까지. 단위 안의 줄들은 포인터 없이 순차로 이어지므로 경계는 못 옮겨도
// 안에서는 재배치할 수 있다. bake-tables.js 참고.
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

// 한 줄이 넘으면 안 되는 상한. 표시 폭(픽셀) 자체는 모르니(NOTES.md 3.4: 줄 높이·글자 폭은
// `40 15`가 정하고 창마다 다르며 정확한 값은 `40 0d` 핸들러 디스어셈블이 필요해 미착수)
// "실제로 이미 그 길이로 렌더링된 적 있다"는 실측값에서 근거를 가져온다.
//
// **테이블 구간 전체에서 딱 하나**를 쓴다(현재 36B). 처음엔 테이블별로, 다음엔 단위 줄 수별로
// 좁게 잡아봤는데 둘 다 표본이 적은 쪽에서 근거 없이 낮게 잠겼다(요일 8개짜리 표는 원본이
// 전부 한 글자라 cap이 2B). 어차피 줄마다 어디서 끊을지는 사람이 눈으로 맞추는 작업이고,
// 이 상한의 역할은 "합계만 맞추다가 한 줄이 터무니없이 길어지는 것"을 막는 가드레일뿐이라
// 세분할 이유가 없다 — 세분하면 가드레일이 아니라 작업 방해가 된다.
//
// ⚠ 이건 창의 진짜 픽셀 한도가 아니다. **에뮬레이터 실기 검증 전**이니 실제로 길이를 바꾼
// 빌드를 돌리기 전에 인게임 확인이 필요하다.
function computeLineCap(entries) {
  let cap = 0;
  for (const e of entries) if (e.length > cap) cap = e.length;
  return cap;
}

// Re-encode entries' `fixed` (falling back to `text`) into `buf`.
//
// 두 가지 규칙이 있다:
//  1) 일반 대사 — 원본 슬롯에 **같은 바이트 길이로** 덮어쓴다. 장면 진입점에서 `@`를 세며
//     순차로 읽히는 구조라, 한 줄을 늘리면 그 뒤 `.data`가 전부 밀려 relocation이 깨진다.
//  2) 포인터 테이블 구간(`table` 플래그) — **단위 단위로 다시 채운다.** 단위 안에서는 줄
//     사이 바이트를 재분배할 수 있지만 두 조건을 같이 건다: ①단위 합계는 원본과 같아야
//     한다(다음 단위 포인터 침범 방지, 우리가 아는 확실한 사실), ②각 줄은 실측 상한
//     (computeLineCap(), 테이블 구간 전체에서 하나) 이하여야 한다 — 합계만 보면 한 줄이
//     옆줄 자리를 다 뺏어 그 줄만 창 폭을 넘어 잘릴 수 있다. 종결 4바이트(`40 XX 00 00`,
//     XX는 계속/끝 제어코드)는 각 줄의 원본 것을 그대로 따라 옮긴다.
//
// entries에는 **해당 단위의 모든 줄**이 들어와야 한다(수정 안 된 줄 포함) — 앞 줄이 길어지면
// 뒤 줄도 함께 이동해야 하기 때문이다. build.js가 dialogue 전체를 넘긴다.
function build(buf, entries) {
  const out = Buffer.from(buf);
  const sorted = entries.slice().sort((a, b) => a.offset - b.offset);

  for (const e of sorted) {
    if (e.table != null) continue; // 아래 단위 처리에서 다룬다
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
  const cap = computeLineCap(tableEntries);
  for (const unit of tableUnits(tableEntries)) {
    const need = unit.reduce((s, e) => s + e.length, 0);
    const encs = unit.map((e) => encodeCp949(e.fixed != null && e.fixed !== '' ? e.fixed : e.text));
    const over = encs.map((b, i) => (b.length > cap ? i : -1)).filter((i) => i >= 0);
    if (over.length) {
      throw new Error(
        `table unit @0x${unit[0].offset.toString(16)}: line(s) over the observed max (${cap}B): ` +
        over.map((i) => `@0x${unit[i].offset.toString(16)} ${encs[i].length}B ${JSON.stringify(unit[i].fixed || unit[i].text)}`).join(', ')
      );
    }
    const got = encs.reduce((s, b) => s + b.length, 0);
    if (got !== need) {
      throw new Error(
        `table unit @0x${unit[0].offset.toString(16)} (${unit.length} lines) changed total byte ` +
        `length (${need} -> ${got}) — 단위 안에서 재분배는 되지만 합계는 같아야 한다: ` +
        unit.map((e, i) => `${JSON.stringify(e.text)}->${e.length}/${encs[i].length}B`).join(', ')
      );
    }
    // 텍스트 + 그 줄의 원본 종결 4바이트를 순서대로 다시 깐다.
    let p = unit[0].offset;
    for (let i = 0; i < unit.length; i++) {
      encs[i].copy(out, p);
      p += encs[i].length;
      buf.copy(out, p, unit[i].offset + unit[i].length, unit[i].offset + unit[i].length + 4);
      p += 4;
    }
    // 안전장치: 원래 span을 정확히 채웠는가(한 바이트라도 넘으면 다음 단위를 침범한다).
    const last = unit[unit.length - 1];
    const spanEnd = last.offset + last.length + 4;
    if (p !== spanEnd) {
      throw new Error(`table unit @0x${unit[0].offset.toString(16)} repack ended at ${p}, expected ${spanEnd}`);
    }
  }
  return out;
}

module.exports = { extract, build, tableUnits, computeLineCap, decodeCp949, encodeCp949, DATA_RAW, DATA_END };
