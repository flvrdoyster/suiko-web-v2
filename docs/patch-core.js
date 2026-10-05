(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SuikoPatch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAGIC = [0x53, 0x4b, 0x50, 0x31];
  var HEADER_SIZE = 24;
  var table = null;

  function crc32(bytes) {
    if (!table) {
      table = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
      }
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function parse(bytes) {
    if (bytes.length < HEADER_SIZE) return null;
    for (var m = 0; m < 4; m++) if (bytes[m] !== MAGIC[m]) return null;
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var head = {
      srcSize: view.getUint32(4, true),
      srcCrc: view.getUint32(8, true),
      dstSize: view.getUint32(12, true),
      dstCrc: view.getUint32(16, true),
      runs: []
    };
    var count = view.getUint32(20, true);
    var pos = HEADER_SIZE;
    var dstPos = 0;

    function varint() {
      var value = 0;
      var scale = 1;
      for (;;) {
        if (pos >= bytes.length) return -1;
        var b = bytes[pos++];
        value += (b & 0x7f) * scale;
        if (b < 0x80) return value;
        scale *= 128;
      }
    }

    for (var r = 0; r < count; r++) {
      var gap = varint();
      var length = varint();
      if (gap < 0 || length < 0 || pos + length > bytes.length) return null;
      dstPos += gap;
      if (dstPos + length > head.dstSize) return null;
      head.runs.push({ gap: gap, data: bytes.subarray(pos, pos + length) });
      pos += length;
      dstPos += length;
    }
    return head;
  }

  function fromHex(hex) {
    var bytes = new Uint8Array(hex.length >> 1);
    for (var i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
  }

  function restore(src, variant) {
    var out = src.slice();
    for (var i = 0; i < variant.fix.length; i++) {
      var at = variant.fix[i][0];
      var bytes = fromHex(variant.fix[i][1]);
      if (at + bytes.length > out.length) return null;
      out.set(bytes, at);
    }
    return out;
  }

  function apply(src, patchBytes, variants) {
    var p = parse(patchBytes);
    if (!p) return { error: 'format' };
    var srcCrc = crc32(src);
    if (src.length === p.dstSize && srcCrc === p.dstCrc) return { error: 'already' };
    var base = null;
    var variant = false;
    if (src.length === p.srcSize && srcCrc === p.srcCrc) {
      base = src;
    } else {
      for (var v = 0; v < (variants || []).length; v++) {
        if (variants[v].size !== src.length || variants[v].crc !== srcCrc) continue;
        base = restore(src, variants[v]);
        if (!base || base.length !== p.srcSize || crc32(base) !== p.srcCrc) return { error: 'variant' };
        variant = true;
        break;
      }
    }
    if (!base) return { error: 'source', size: src.length, crc: srcCrc };
    var out = new Uint8Array(p.dstSize);
    out.set(base.subarray(0, Math.min(base.length, p.dstSize)));
    var pos = 0;
    for (var i = 0; i < p.runs.length; i++) {
      pos += p.runs[i].gap;
      out.set(p.runs[i].data, pos);
      pos += p.runs[i].data.length;
    }
    if (crc32(out) !== p.dstCrc) return { error: 'result' };
    return { out: out, variant: variant };
  }

  return { crc32: crc32, parse: parse, restore: restore, apply: apply, MAGIC: MAGIC, HEADER_SIZE: HEADER_SIZE };
});
