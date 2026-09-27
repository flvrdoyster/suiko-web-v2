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
