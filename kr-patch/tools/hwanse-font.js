// hwanse-font.js — special-cased extractor/builder for the ONE Win32 LOGFONT face-name
// field found in HWANSE.EXE.
//
// At file offset 0x52858 sits a byte-for-byte valid ANSI LOGFONT struct (60 bytes):
// lfHeight=-48, lfWidth=-24, lfEscapement=0, lfOrientation=0, lfWeight=1000,
// lfItalic/lfUnderline/lfStrikeOut=0, lfCharSet=0x81 (HANGUL_CHARSET — confirmed against
// the Win32 constant), lfOutPrecision/lfClipPrecision/lfQuality=0 (all *_DEFAULT),
// lfPitchAndFamily=0x11 (FIXED_PITCH | FF_ROMAN — FIXED_PITCH matches "GulimChe" being the
// fixed-pitch variant of Gulim), then a 32-byte (LF_FACESIZE) NUL-padded face name field
// at offset 0x52874 containing "굴림체" (GulimChe). A file-wide scan for the same
// lfWeight=1000 marker found ~20 other LOGFONT-shaped structs, but all the rest have
// lfCharSet=ANSI_CHARSET(0) — this is the only Hangul one, i.e. the one call plausibly
// worth changing if the game's KR font ever needs to be swapped by name instead of by
// charset substitution (see NOTES.md's still-unresolved GULIM.TTC issue).
//
// This is NOT the same shape as hwanse-names.js's labels: the face name is a C string in
// a FIXED 32-byte buffer, NUL-terminated/padded (not full-width-space padded), and its
// content is a literal Windows font family name, not game text. Treated as its own
// "fonts" section (single entry today; FONT_FIELDS is a list in case more show up).
'use strict';

const iconv = require('iconv-lite');

const LF_FACESIZE = 32;
const FONT_FIELDS = [{ offset: 0x52874, maxLength: LF_FACESIZE }];

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

function extract(buf) {
  return FONT_FIELDS.map(({ offset, maxLength }) => {
    const field = buf.subarray(offset, offset + maxLength);
    const nul = field.indexOf(0);
    const raw = nul >= 0 ? field.subarray(0, nul) : field;
    return { offset, maxLength, text: decodeCp949(raw) || '' };
  });
}

// Zeroes the whole 32-byte field first (so no trailing bytes of a longer previous name
// can leak past a NUL) then writes the encoded name. Throws if it doesn't fit.
function build(buf, entries) {
  const out = Buffer.from(buf);
  for (const e of entries) {
    const newText = e.fixed != null && e.fixed !== '' ? e.fixed : e.text;
    const encoded = encodeCp949(newText);
    if (encoded.length > e.maxLength) {
      throw new Error(
        `font name @0x${e.offset.toString(16)} too long for its ${e.maxLength}-byte ` +
        `LOGFONT face name field: ${JSON.stringify(newText)} (${encoded.length} bytes)`
      );
    }
    out.fill(0, e.offset, e.offset + e.maxLength);
    encoded.copy(out, e.offset);
  }
  return out;
}

module.exports = { extract, build, decodeCp949, encodeCp949, FONT_FIELDS };
