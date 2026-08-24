// pe-reloc.js — generic PE32 helpers: section table lookup + base-relocation walk.
// Used to find "scene entry point" dialogue lines (ones a HIGHLOW relocation target lands
// on exactly) in HWANSE.EXE/GENSE.EXE. Reimplements what was first done ad-hoc for KR only
// (see NOTES.md 3.3 "텍스트 구조") with the actual PE section table instead of
// hand-derived constants, so it works unmodified for JP's differently-sized .data section
// too (verified: produces the same 620 KR entry points the hand-derived version found).
'use strict';

function parsePE(buf) {
  const e_lfanew = buf.readUInt32LE(0x3c);
  if (buf.readUInt32LE(e_lfanew) !== 0x00004550) throw new Error('not a PE file');
  const coffOff = e_lfanew + 4;
  const numSections = buf.readUInt16LE(coffOff + 2);
  const optHeaderSize = buf.readUInt16LE(coffOff + 16);
  const optOff = coffOff + 20;
  const imageBase = buf.readUInt32LE(optOff + 28);
  const dataDirOff = optOff + 96;
  const relocRVA = buf.readUInt32LE(dataDirOff + 5 * 8);
  const relocSize = buf.readUInt32LE(dataDirOff + 5 * 8 + 4);
  const sectionTableOff = optOff + optHeaderSize;
  const sections = [];
  for (let i = 0; i < numSections; i++) {
    const off = sectionTableOff + i * 40;
    sections.push({
      virtualSize: buf.readUInt32LE(off + 8),
      virtualAddress: buf.readUInt32LE(off + 12),
      sizeOfRawData: buf.readUInt32LE(off + 16),
      pointerToRawData: buf.readUInt32LE(off + 20),
    });
  }
  function rvaToFile(rva) {
    for (const s of sections) {
      if (rva >= s.virtualAddress && rva < s.virtualAddress + Math.max(s.virtualSize, s.sizeOfRawData)) {
        return rva - s.virtualAddress + s.pointerToRawData;
      }
    }
    return null;
  }
  function fileToVA(fo) {
    for (const s of sections) {
      if (fo >= s.pointerToRawData && fo < s.pointerToRawData + s.sizeOfRawData) {
        return fo - s.pointerToRawData + s.virtualAddress + imageBase;
      }
    }
    return null;
  }
  return { imageBase, relocFileOff: rvaToFile(relocRVA), relocSize, rvaToFile, fileToVA };
}

// entries: [{offset, length, ...}] (file offsets into buf). Returns sorted file-offset list
// of dialogue-entry starts that a HIGHLOW relocation target lands on exactly.
function findEntryPointOffsets(buf, entries) {
  const pe = parsePE(buf);
  const lineStartVAs = new Set(entries.map((e) => pe.fileToVA(e.offset)));
  let minVA = Infinity, maxVA = 0;
  for (const e of entries) {
    const va = pe.fileToVA(e.offset);
    if (va < minVA) minVA = va;
    if (va + e.length > maxVA) maxVA = va + e.length;
  }
  const targets = new Set();
  let p = pe.relocFileOff;
  const end = p + pe.relocSize;
  while (p < end) {
    const pageRVA = buf.readUInt32LE(p);
    const blockSize = buf.readUInt32LE(p + 4);
    if (blockSize === 0) break;
    const count = (blockSize - 8) / 2;
    for (let i = 0; i < count; i++) {
      const entry = buf.readUInt16LE(p + 8 + i * 2);
      if ((entry >> 12) !== 3) continue; // HIGHLOW only
      const at = pe.rvaToFile(pageRVA + (entry & 0xfff));
      if (at === null) continue;
      const targetVA = buf.readUInt32LE(at);
      if (targetVA >= minVA && targetVA < maxVA && lineStartVAs.has(targetVA)) targets.add(targetVA);
    }
    p += blockSize;
  }
  return [...targets].map((va) => va - pe.imageBase)
    .map((rva) => pe.rvaToFile(rva))
    .sort((a, b) => a - b);
}

module.exports = { parsePE, findEntryPointOffsets };
