// cns-extract.js — standalone, read-only .cns → .bmp extractor for GENSE.FLD archives.
//
// Personal-use utility, NOT part of the kr-patch build/inject pipeline (see NOTES.md
// "2.2 이미지 구조" — reinjection needs per-file real-hardware verification, extraction
// doesn't). Reuses the FLD table parser and CNS LZ decoder validated in cara-fnt.js.
//
// Usage: node kr-patch/tools/cns-extract.js <path/to/GENSE.FLD> <cns-name> [out.bmp]
//   node kr-patch/tools/cns-extract.js original/kr/GENSE.FLD cara_fnt.cns
//   node kr-patch/tools/cns-extract.js original/kr/GENSE.FLD --list
'use strict';

const fs = require('fs');
const path = require('path');
const { decompressCns, parseFld } = require('./cara-fnt.js');

function decodedToBmp(decoded) {
  const width = decoded.readUInt16LE(2);
  const height = decoded.readUInt16LE(4);
  const palCount = decoded.readUInt16LE(6) + 1;
  const bpp = palCount <= 16 ? 4 : 8;
  const palette = decoded.subarray(8, 8 + palCount * 4);

  // The decompressed pixel section is already row-padded to the standard BMP 4-byte
  // boundary at this bpp (verified against cns110.exe's own BMP output for cara_fnt.cns,
  // an 8bpp/80-color image) — so no unpacking/repacking needed, just copy it as-is.
  const rowBytes = ((width * bpp + 31) >> 5) << 2;
  const pixelsStart = 8 + palCount * 4;
  const pixelsLen = rowBytes * height;
  const pixels = decoded.subarray(pixelsStart, pixelsStart + pixelsLen);
  if (pixels.length < pixelsLen) {
    throw new Error(`decoded stream too short for pixel data: have ${pixels.length}, need ${pixelsLen} (width=${width} height=${height} bpp=${bpp})`);
  }

  const offBits = 14 + 40 + palCount * 4;
  const fileSize = offBits + pixelsLen;
  const bmp = Buffer.alloc(fileSize);
  // BITMAPFILEHEADER
  bmp.write('BM', 0, 'ascii');
  bmp.writeUInt32LE(fileSize, 2);
  bmp.writeUInt32LE(0, 6);
  bmp.writeUInt32LE(offBits, 10);
  // BITMAPINFOHEADER
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(width, 18);
  bmp.writeInt32LE(height, 22); // positive = bottom-up, matches decoded pixel row order
  bmp.writeUInt16LE(1, 26); // planes
  bmp.writeUInt16LE(bpp, 28);
  bmp.writeUInt32LE(0, 30); // BI_RGB, uncompressed
  bmp.writeUInt32LE(pixelsLen, 34);
  bmp.writeInt32LE(0, 38); // XPelsPerMeter
  bmp.writeInt32LE(0, 42); // YPelsPerMeter
  bmp.writeUInt32LE(palCount, 46);
  bmp.writeUInt32LE(0, 50); // important colors
  palette.copy(bmp, 54);
  pixels.copy(bmp, offBits);

  return { bmp, width, height, bpp, palCount };
}

function extractOne(fld, target) {
  const raw = fld.subarray(target.offset, target.offset + target.size);
  const decoded = decompressCns(raw, 0);
  return decodedToBmp(decoded);
}

function main() {
  const [, , fldPath, name, outArg] = process.argv;
  if (!fldPath || !name) {
    console.error('usage: node cns-extract.js <GENSE.FLD path> <cns-name | --list | --all> [out.bmp | out-dir]');
    process.exit(1);
  }
  const fld = fs.readFileSync(fldPath);
  const { entries } = parseFld(fld);

  if (name === '--list') {
    for (const e of entries.slice().sort((a, b) => a.offset - b.offset)) {
      console.log(`${e.name.padEnd(14)} offset=0x${e.offset.toString(16).padStart(7, '0')} size=${e.size}`);
    }
    console.log(`${entries.length} entries`);
    return;
  }

  if (name === '--all') {
    const outDir = outArg || path.join(path.dirname(fldPath), 'cns_bmp');
    fs.mkdirSync(outDir, { recursive: true });
    let ok = 0;
    const failed = [];
    for (const e of entries.slice().sort((a, b) => a.offset - b.offset)) {
      try {
        const { bmp, width, height, bpp, palCount } = extractOne(fld, e);
        fs.writeFileSync(path.join(outDir, e.name + '.bmp'), bmp);
        console.log(`${e.name.padEnd(14)} ${width}x${height}x${bpp}bpp, ${palCount} colors`);
        ok++;
      } catch (err) {
        failed.push({ name: e.name, err: err.message });
      }
    }
    console.log(`\n${ok}/${entries.length} extracted to ${outDir}`);
    if (failed.length) {
      console.log(`${failed.length} failed:`);
      for (const f of failed) console.log(`  ${f.name}: ${f.err}`);
    }
    return;
  }

  const target = entries.find((e) => e.name.toLowerCase() === name.toLowerCase());
  if (!target) throw new Error(`${name} not found in ${fldPath} (try --list)`);

  const { bmp, width, height, bpp, palCount } = extractOne(fld, target);
  const out = outArg || path.join(path.dirname(fldPath), target.name + '.bmp');
  fs.writeFileSync(out, bmp);
  console.log(`${target.name}: ${width}x${height}x${bpp}bpp, ${palCount} colors -> ${out} (${bmp.length} bytes)`);
}

if (require.main === module) main();

module.exports = { decodedToBmp };
