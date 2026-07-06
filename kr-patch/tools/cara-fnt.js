// cara-fnt.js — one-off tool to replace GENSE.FLD's cara_fnt.cns (KR character-name font
// bitmap, 640x240x8bpp indexed) with an edited version and re-inject it into the disk image.
//
// GENSE.FLD structure (reverse-engineered from GENSE.FLD + cns110.exe disassembly, see
// NOTES.md): 8-byte header "FLDF0100" + u32 entry count, then a flat table of fixed
// 20-byte entries (12-byte NUL-padded name + u32 offset + u32 size), followed immediately
// by all file payloads back-to-back with zero padding between them (verified: 0 gaps across
// all 377 entries in the KR file).
//
// Each .cns payload is ONE compressed stream (see decompressCns) whose *decompressed* bytes
// are themselves [2 bytes unknown][u16 width][u16 height][u16 paletteCount-1][palette,
// 4 bytes/color][pixel indices, width*height bytes, bottom-up row order matching BMP].
//
// Two hard constraints, both learned the painful way (see NOTES.md):
//  1. The replacement payload must be EXACTLY the original's stored size — growing the
//     archive shifts every later file's offset and corrupts them.
//  2. The stream must CONSUME exactly that many input bytes when decoded (terminator last).
//     Padding with dead bytes after the terminator satisfies (1) but still corrupted every
//     asset the game loaded after this one — the loader advances by consumed bytes, not by
//     table size. inflateToSize() handles this by de-optimizing the token stream until the
//     encode is exactly the right length.
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const F = require('../../src/fat16.js');

const ROOT = path.join(__dirname, '..', '..');
const FLD_PATH = path.join(ROOT, 'original', 'kr', 'GENSE.FLD');
const BMP_PATH = path.join(ROOT, 'kr-patch', 'translation', 'cara_fnt.cns.bmp');
const LIVE_IMG = path.join(ROOT, 'docs', 'final-shared.img');
const OUT_IMG = path.join(ROOT, 'kr-patch', 'build', 'final-shared.img');
const TARGET_NAME = 'cara_fnt.cns';

// ---- CNS codec ----
//
// Opcode semantics verified against cns110.exe's decompressor at 0x401820 AND validated by
// decoding the original cara_fnt.cns to a byte-exact match of its known-good BMP extract
// (153,928 bytes: 8B header + 320B palette + 640x240 pixels), consuming exactly 7024 input
// bytes with zero out-of-range references:
//   0x00        : end of stream
//   0x01-0x0F   : match, len=(al&0xF)+2, dist=next byte
//   0x10-0x1F   : match, len=(al&0xF)+2, dist=next u16le
//   0x20-0x2F   : match, len=((al&0xF)<<8)|next, dist=1 byte after that
//   0x30-0x3F   : match, len=((al&0xF)<<8)|next, dist=u16le after that
//   0x40-0x5F   : literal run, len=al&0x1F
//   0x60-0x7F   : literal run, len=((al&0x1F)<<8)|next
//   0x80-0xFF   : COMBINED op — copy ((al>>4)&7) literal bytes, THEN a match of
//                 len=(al&0xF)+2 with dist=next byte (read after the literals).
//                 (An earlier read of the disassembly missed the fall-through at 0x401893
//                 and treated 0x90+ as literal-only — that desynced the whole stream parse
//                 and led to a bogus "shared decode buffer" theory. See NOTES.md.)

function decompressCns(data, start) {
  const out = [];
  let i = start || 0;
  const n = data.length;
  while (i < n) {
    const al = data[i++];
    if (al === 0) break;
    let length, dist;
    if (al >= 0x80) {
      const lit = (al >> 4) & 7;
      for (let k = 0; k < lit; k++) out.push(data[i++]);
      length = (al & 0xf) + 2;
      dist = data[i++];
    } else if (al >= 0x60) {
      length = ((al & 0x1f) << 8) | data[i++];
      for (let k = 0; k < length; k++) out.push(data[i++]);
      continue;
    } else if (al >= 0x40) {
      length = al & 0x1f;
      for (let k = 0; k < length; k++) out.push(data[i++]);
      continue;
    } else if (al >= 0x30) {
      length = ((al & 0xf) << 8) | data[i++];
      dist = data[i] | (data[i + 1] << 8); i += 2;
    } else if (al >= 0x20) {
      length = ((al & 0xf) << 8) | data[i++];
      dist = data[i++];
    } else if (al >= 0x10) {
      length = (al & 0xf) + 2;
      dist = data[i] | (data[i + 1] << 8); i += 2;
    } else {
      length = (al & 0xf) + 2;
      dist = data[i++];
    }
    let src = out.length - dist;
    for (let k = 0; k < length; k++) { out.push(src >= 0 ? out[src] : 0); src++; }
  }
  return Buffer.from(out);
}

// Bytes of input a decode consumes (including the terminator). The game's loader appears to
// advance its read cursor by consumed bytes rather than seeking per table entry — injecting
// a shorter stream (even zero-padded to the same file size) corrupted every asset loaded
// AFTER ours at runtime, while identical-length streams are fine. So an encode is only
// safe when consumedBytes(encoded) === consumedBytes(original) === stored size.
function consumedBytes(data) {
  let i = 0;
  const n = data.length;
  while (i < n) {
    const al = data[i++];
    if (al === 0) return i;
    if (al >= 0x80) i += ((al >> 4) & 7) + 1;
    else if (al >= 0x60) i += 1 + (((al & 0x1f) << 8) | data[i]);
    else if (al >= 0x40) i += al & 0x1f;
    else if (al >= 0x30) i += 3;
    else if (al >= 0x20) i += 2;
    else if (al >= 0x10) i += 2;
    else i += 1;
  }
  return i;
}

// Cost-optimal (DP) hash-chain LZ over cns110.exe's opcode set. For every position we find
// the longest match in each cost class (near = dist<=255 cheaper, far = dist<=65535), then a
// backward DP picks the minimum-total-byte tiling. This beats greedy comfortably — enough to
// land the edited 640x240 image under the original 7024-byte budget so the archive doesn't
// grow (see NOTES.md: growing GENSE.FLD shifts every later file's offset and corrupts the
// game, so we MUST stay <= the original size). maxChain trades build time for ratio; this is
// a one-off asset build, not run per-request.
function compressCns(data, maxChain) {
  maxChain = maxChain || 4096;
  const n = data.length;
  const head = new Int32Array(1 << 16).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const hkey = (i) => ((data[i] * 131 + data[i + 1]) * 131 + data[i + 2]) & 0xffff;

  const lenNear = new Int32Array(n), distNear = new Int32Array(n);
  const lenFar = new Int32Array(n), distFar = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (i + 3 <= n) {
      const k = hkey(i);
      let p = head[k], tries = 0;
      const lcap = Math.min(4095, n - i);
      let ln = 0, dn = 0, lf = 0, df = 0;
      while (p >= 0 && tries < maxChain) {
        const dist = i - p;
        if (dist > 65535) break;
        let l = 0;
        while (l < lcap && data[p + l] === data[i + l]) l++;
        if (dist <= 255) { if (l > ln) { ln = l; dn = dist; } }
        else { if (l > lf) { lf = l; df = dist; } }
        if (l >= lcap && dist <= 255) break;
        tries++; p = prev[p];
      }
      prev[i] = head[k]; head[k] = i;
      lenNear[i] = ln; distNear[i] = dn; lenFar[i] = lf; distFar[i] = df;
    }
  }

  const dp = new Float64Array(n + 1).fill(Infinity); dp[n] = 0;
  const decL = new Int32Array(n), decD = new Int32Array(n); // decL === 0 → literal
  for (let i = n - 1; i >= 0; i--) {
    let c = 1 + dp[i + 1], bl = 0, bd = 0;
    const ln = lenNear[i], dn = distNear[i], lf = lenFar[i], df = distFar[i];
    if (ln >= 3) {
      const L = Math.min(17, ln);
      if (L >= 3) { const cc = 2 + dp[i + L]; if (cc < c) { c = cc; bl = L; bd = dn; } }
      if (ln > 17) { const cc = 3 + dp[i + ln]; if (cc < c) { c = cc; bl = ln; bd = dn; } }
    }
    if (lf >= 3) {
      const L = Math.min(17, lf);
      if (L >= 3) { const cc = 3 + dp[i + L]; if (cc < c) { c = cc; bl = L; bd = df; } }
      if (lf > 17) { const cc = 4 + dp[i + lf]; if (cc < c) { c = cc; bl = lf; bd = df; } }
    }
    dp[i] = c; decL[i] = bl; decD[i] = bd;
  }

  // Emit as a token list so the caller can inflate to an exact byte size before serializing.
  const tokens = [];
  let litRun = [];
  function flushLit() {
    while (litRun.length) {
      const chunk = litRun.splice(0, 8191);
      tokens.push({ lit: chunk });
    }
  }
  let i = 0;
  while (i < n) {
    if (decL[i] === 0) {
      litRun.push(data[i]); i++;
    } else {
      flushLit();
      tokens.push({ L: decL[i], dist: decD[i] });
      i += decL[i];
    }
  }
  flushLit();
  return tokens;
}

function serializeTokens(tokens) {
  const out = [];
  for (const t of tokens) {
    if (t.lit) {
      const L = t.lit.length;
      if (L <= 31) out.push(0x40 | L);
      else { out.push(0x60 | (L >> 8)); out.push(L & 0xff); }
      for (const b of t.lit) out.push(b);
    } else {
      const { L, dist } = t;
      const wide = t.wide || dist > 255; // t.wide: force u16-dist form (used for +1 inflation)
      if (L <= 17) {
        if (!wide) { out.push(0x80 | (L - 2)); out.push(dist); }
        else { out.push(0x10 | (L - 2)); out.push(dist & 0xff); out.push((dist >> 8) & 0xff); }
      } else {
        if (!wide) { out.push(0x20 | (L >> 8)); out.push(L & 0xff); out.push(dist); }
        else { out.push(0x30 | (L >> 8)); out.push(L & 0xff); out.push(dist & 0xff); out.push((dist >> 8) & 0xff); }
      }
    }
  }
  out.push(0x00);
  return Buffer.from(out);
}

// Inflate the token stream to EXACTLY targetSize encoded bytes without changing its decoded
// output: splitting a literal run in two adds +1 byte (extra run header); splitting a match
// of length >=6 into 3+(L-3) adds +2. The decoded output is identical either way — only the
// token structure (and thus encoded size) changes.
function inflateToSize(tokens, targetSize) {
  let size = serializeTokens(tokens).length;
  if (size > targetSize) throw new Error(`encoded ${size} > target ${targetSize}; cannot fit`);
  let guard = 0;
  while (size < targetSize) {
    if (++guard > 200000) throw new Error('inflation not converging');
    let did = false;
    // cheapest +1 step: re-encode a narrow-dist match in its u16-dist form (output identical)
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k];
      if (!t.lit && !t.wide && t.dist <= 255) {
        t.wide = true;
        size += 1; did = true; break;
      }
    }
    if (did) continue;
    // +1: split a short-form literal run (2..31 bytes) into 1 + rest
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k];
      if (t.lit && t.lit.length >= 2 && t.lit.length <= 31) {
        tokens.splice(k, 0, { lit: t.lit.splice(0, 1) });
        size += 1; did = true; break;
      }
    }
    if (did) continue;
    // long literal runs: peel one byte off the front (+1: long header stays 2B, new 1B run
    // costs 2). Requires length > 32 — at exactly 32 the remainder drops to short form and
    // the net change is +0, which would stall the loop.
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k];
      if (t.lit && t.lit.length > 32) {
        tokens.splice(k, 0, { lit: t.lit.splice(0, 1) });
        size += 1; did = true; break;
      }
    }
    if (did) continue;
    // fall back to +2: split a match
    for (let k = 0; k < tokens.length && size <= targetSize - 2; k++) {
      const t = tokens[k];
      if (!t.lit && t.L >= 6 && t.L <= 17) {
        const rest = { L: t.L - 3, dist: t.dist };
        t.L = 3;
        tokens.splice(k + 1, 0, rest);
        size += 2; did = true; break;
      }
    }
    if (!did) throw new Error(`cannot inflate further at ${size}/${targetSize}`);
  }
  return tokens;
}

// ---- GENSE.FLD archive ----

function parseFld(buf) {
  const magic = buf.subarray(0, 8).toString('ascii');
  if (magic !== 'FLDF0100') throw new Error('unexpected FLD magic: ' + magic);
  const count = buf.readUInt32LE(8);
  const entries = [];
  let pos = 12;
  for (let idx = 0; idx < count; idx++) {
    const nameRaw = buf.subarray(pos, pos + 12);
    const nulIdx = nameRaw.indexOf(0);
    const name = nameRaw.subarray(0, nulIdx >= 0 ? nulIdx : 12).toString('ascii');
    const offset = buf.readUInt32LE(pos + 12);
    const size = buf.readUInt32LE(pos + 20 - 4);
    entries.push({ name, offset, size, tableOffset: pos });
    pos += 20;
  }
  return { magic, count, tableEnd: pos, entries };
}

function rebuildFld(buf, targetName, newPayload) {
  const { entries, tableEnd } = parseFld(buf);
  const target = entries.find((e) => e.name === targetName);
  if (!target) throw new Error(targetName + ' not found in GENSE.FLD');
  const delta = newPayload.length - target.size;

  const byOffset = entries.slice().sort((a, b) => a.offset - b.offset);
  for (let i = 0; i < byOffset.length - 1; i++) {
    const expectedNext = byOffset[i].offset + byOffset[i].size;
    if (expectedNext !== byOffset[i + 1].offset) {
      throw new Error(`GENSE.FLD is not gap-free between ${byOffset[i].name} and ${byOffset[i + 1].name} — rebuild logic assumes contiguous packing`);
    }
  }

  const out = Buffer.alloc(buf.length + delta);
  buf.copy(out, 0, 0, tableEnd); // header + table, patched below
  for (const e of entries) {
    const newOffset = e.offset > target.offset ? e.offset + delta : e.offset;
    const newSize = e.name === targetName ? newPayload.length : e.size;
    out.writeUInt32LE(newOffset, e.tableOffset + 12);
    out.writeUInt32LE(newSize, e.tableOffset + 16);
  }
  // payload region: copy everything up to target unchanged, splice in new payload,
  // then copy everything after target unchanged (shifted by delta automatically since
  // we're appending sequentially into `out`).
  let w = tableEnd;
  buf.copy(out, w, tableEnd, target.offset); w += target.offset - tableEnd;
  newPayload.copy(out, w); w += newPayload.length;
  buf.copy(out, w, target.offset + target.size, buf.length); w += buf.length - (target.offset + target.size);
  if (w !== out.length) throw new Error(`rebuild size mismatch: wrote ${w}, expected ${out.length}`);
  return out;
}

// ---- main ----

function main() {
  const fld = fs.readFileSync(FLD_PATH);
  const { entries } = parseFld(fld);
  const target = entries.find((e) => e.name === TARGET_NAME);
  if (!target) throw new Error(TARGET_NAME + ' not found');
  console.log(`${TARGET_NAME}: offset=0x${target.offset.toString(16)} size=${target.size}`);

  const rawCns = fld.subarray(target.offset, target.offset + target.size);
  const origConsumed = consumedBytes(rawCns);
  if (origConsumed !== target.size) {
    throw new Error(`original stream consumes ${origConsumed} != stored size ${target.size} — layout assumption broken`);
  }
  const decoded = decompressCns(rawCns, 0);
  const header = decoded.subarray(0, 8);
  const width = header.readUInt16LE(2);
  const height = header.readUInt16LE(4);
  const palCount = header.readUInt16LE(6) + 1;
  const palette = decoded.subarray(8, 8 + palCount * 4);
  console.log(`decoded original: width=${width} height=${height} palCount=${palCount}, stream consumes ${origConsumed} bytes`);

  const bmp = fs.readFileSync(BMP_PATH);
  const bfOffBits = bmp.readUInt32LE(10);
  const biWidth = bmp.readInt32LE(18);
  const biHeight = bmp.readInt32LE(22);
  const biBitCount = bmp.readUInt16LE(28);
  if (biWidth !== width || Math.abs(biHeight) !== height || biBitCount !== 8) {
    throw new Error(`BMP dimensions ${biWidth}x${biHeight}x${biBitCount} don't match original ${width}x${height}x8`);
  }
  const pixels = bmp.subarray(bfOffBits, bfOffBits + width * height);

  const full = Buffer.concat([header, palette, pixels]);
  console.log('full logical (header+palette+pixels):', full.length);

  console.log('compressing (optimal parse, ~60-90s)...');
  const t0 = Date.now();
  const tokens = compressCns(full, 4096);
  const rawSize = serializeTokens(tokens).length;
  console.log(`encoded: ${rawSize} bytes (budget ${target.size}), ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Inflate to EXACTLY the original stored size. Zero-padding after the terminator is NOT
  // enough: the game's loader advances by bytes the decoder consumed, so a stream that ends
  // early desyncs every asset loaded after this one (observed in-game as corrupted sprites
  // from the next loaded file onward). Structural inflation keeps the decoded output
  // identical while making the stream consume exactly target.size bytes, terminator last.
  const payload = serializeTokens(inflateToSize(tokens, target.size));
  if (payload.length !== target.size) throw new Error(`inflated to ${payload.length}, wanted ${target.size}`);
  const ourConsumed = consumedBytes(payload);
  if (ourConsumed !== target.size) throw new Error(`our stream consumes ${ourConsumed} != ${target.size}`);
  console.log(`inflated to exactly ${payload.length} bytes (stream consumes all of it, terminator last)`);

  const roundTrip = decompressCns(payload, 0);
  if (!roundTrip.equals(full)) throw new Error('round-trip mismatch — refusing to inject a broken encode');
  if (roundTrip.length !== decoded.length) throw new Error(`decoded length ${roundTrip.length} != original ${decoded.length}`);
  console.log('round-trip verified byte-exact, decoded length matches original.');

  const newFld = rebuildFld(fld, TARGET_NAME, payload);
  console.log(`new GENSE.FLD size: ${newFld.length} (was ${fld.length}, delta ${newFld.length - fld.length})`);
  if (newFld.length !== fld.length) throw new Error('FLD size changed despite exact-size payload — bug');

  // inject into a fresh copy of the live disk image
  const liveRaw = fs.readFileSync(LIVE_IMG);
  const liveImg = liveRaw[0] === 0x1f && liveRaw[1] === 0x8b ? new Uint8Array(zlib.gunzipSync(liveRaw)) : new Uint8Array(liveRaw);
  const res = F.injectDirFiles(liveImg, 'GENSE', [{ name: 'GENSE.FLD', data: newFld }]);
  if (res.skipped.length) throw new Error('inject skipped: ' + res.skipped.join(','));

  // verify readback
  const vol = F.openImage(res.image);
  const geCluster = F.resolveDir(vol, 'GENSE');
  const fldEntry = F.listDir(vol, geCluster).find((e) => (e.longName || e.shortName).toUpperCase() === 'GENSE.FLD');
  const readBack = Buffer.from(F.readFileEntry(vol, fldEntry));
  if (!readBack.equals(newFld)) throw new Error('readback from injected image does not match — injection is corrupt');
  console.log('readback from disk image verified byte-exact.');
  for (const dir of ['GENSE/SAVEDATA', 'GENSEJP/SAVEDATA']) {
    const n = F.extractDirFiles(res.image, dir).length;
    console.log(`${dir} intact: ${n} files`);
  }

  const gz = zlib.gzipSync(Buffer.from(res.image), { level: 9 });
  fs.mkdirSync(path.dirname(OUT_IMG), { recursive: true });
  fs.writeFileSync(OUT_IMG, gz);
  console.log(`wrote ${path.relative(ROOT, OUT_IMG)} (${gz.length} bytes gzip)`);
  console.log('Next: serve docs/ with this file swapped in and check the character-name font in the emulator.');
}

if (require.main === module) main();

module.exports = {
  decompressCns, compressCns, consumedBytes, serializeTokens, inflateToSize,
  parseFld, rebuildFld,
};
