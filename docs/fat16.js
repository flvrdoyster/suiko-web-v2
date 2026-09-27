// fat16.js — minimal FAT16 reader + in-place file writer.
//
// Purpose in suiko-web-v2: the game (환세취호전) writes its save files only into
// C:\GENSE\SAVEDATA\. The base disk image is immutable, so instead of persisting the
// whole 94MB image we extract just the SAVEDATA files after a save and re-inject them
// into a fresh copy of the base image before the next boot.
//
// Scope on purpose: this reads an MBR+FAT16 image, walks directories (reassembling long
// file names), reads files, and overwrites existing files *in place* (reusing their
// cluster chain). It intentionally does NOT allocate new clusters or create/delete
// entries — the game's save slots always pre-exist at a fixed size (1274 bytes, one
// cluster each), so in-place overwrite is sufficient and far simpler/safer than a full
// FAT writer. writeFileInPlace throws if a file would need more space than it already
// occupies, so a future caller can notice rather than silently corrupt the image.
//
// Works in both Node (Buffer/Uint8Array) and the browser (Uint8Array). No dependencies.

'use strict';

const ATTR_LONG_NAME = 0x0f;
const ATTR_DIRECTORY = 0x10;
const ATTR_VOLUME_ID = 0x08;

function u16(view, off) { return view[off] | (view[off + 1] << 8); }
function u32(view, off) {
  return (view[off] | (view[off + 1] << 8) | (view[off + 2] << 16) | (view[off + 3] << 24)) >>> 0;
}

// Parse the MBR partition table + FAT16 BPB into geometry we can navigate.
// Returns a context object shared by the read/write helpers below.
function openImage(bytes) {
  const img = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // First MBR partition entry (0x1BE). We support the first FAT16 partition.
  const PT = 0x1be;
  let partLBA = null;
  for (let i = 0; i < 4; i++) {
    const off = PT + i * 16;
    const type = img[off + 4];
    if (type === 0x06 || type === 0x0e || type === 0x04) { // FAT16 variants
      partLBA = u32(img, off + 8);
      break;
    }
  }
  if (partLBA === null) throw new Error('no FAT16 partition found in MBR');

  const pOff = partLBA * 512;
  const bytesPerSector = u16(img, pOff + 11);
  const sectorsPerCluster = img[pOff + 13];
  const reservedSectors = u16(img, pOff + 14);
  const numFATs = img[pOff + 16];
  const maxRootEntries = u16(img, pOff + 17);
  const sectorsPerFAT = u16(img, pOff + 22);

  const fatStart = pOff + reservedSectors * bytesPerSector;
  const rootOffset = fatStart + numFATs * sectorsPerFAT * bytesPerSector;
  const rootSectors = Math.ceil((maxRootEntries * 32) / bytesPerSector);
  const rootSizeBytes = rootSectors * bytesPerSector;
  const dataOffset = rootOffset + rootSizeBytes;
  const bytesPerCluster = bytesPerSector * sectorsPerCluster;

  // Read the first FAT into an array of 16-bit entries.
  const fatEntries = new Uint16Array(sectorsPerFAT * bytesPerSector / 2);
  for (let i = 0; i < fatEntries.length; i++) fatEntries[i] = u16(img, fatStart + i * 2);

  return {
    img, bytesPerSector, sectorsPerCluster, bytesPerCluster,
    rootOffset, rootSizeBytes, dataOffset, fatEntries,
    fatStart, numFATs, sectorsPerFAT, // needed for writing new files
  };
}

// Byte offset of a cluster's data.
function clusterOffset(ctx, cluster) {
  return ctx.dataOffset + (cluster - 2) * ctx.bytesPerCluster;
}

// Follow the FAT chain starting at firstCluster; returns the list of cluster numbers.
function clusterChain(ctx, firstCluster) {
  const chain = [];
  let c = firstCluster;
  while (c >= 2 && c < 0xfff8) {
    chain.push(c);
    c = ctx.fatEntries[c];
  }
  return chain;
}

// Decode the 13 UTF-16LE chars packed into one long-file-name directory entry.
function lfnChars(img, off) {
  let s = '';
  const slots = [[1, 10], [14, 25], [28, 31]];
  for (const [a, b] of slots) {
    for (let p = a; p <= b; p += 2) {
      const code = img[off + p] | (img[off + p + 1] << 8);
      if (code === 0x0000 || code === 0xffff) return s;
      s += String.fromCharCode(code);
    }
  }
  return s;
}

// VFAT checksum of an 11-byte raw 8.3 name (the standard "sum, rotate, add" algorithm).
// Every LFN entry that names a given short entry carries this same byte at offset 13 —
// it's how a reader confirms the LFN entries immediately before a short entry actually
// belong to it, rather than being leftovers from a since-deleted file that used to sit
// in that slot.
function shortNameChecksum(img, entryOff) {
  let sum = 0;
  for (let j = 0; j < 11; j++) sum = (((sum & 1) ? 0x80 : 0) + (sum >> 1) + img[entryOff + j]) & 0xff;
  return sum;
}

// List entries of a directory whose raw bytes span the given [offset,size] regions.
// `regions` is an array of {off, size}. Returns entries with reassembled long names.
function parseDirRegions(ctx, regions) {
  const img = ctx.img;
  const out = [];
  let longName = '';
  let longChecksum = null;
  for (const { off, size } of regions) {
    for (let i = 0; i < size; i += 32) {
      const entryOff = off + i;
      const first = img[entryOff];
      if (first === 0x00) return out; // end of directory
      if (first === 0xe5) { longName = ''; longChecksum = null; continue; }   // deleted
      const attr = img[entryOff + 11];
      if (attr === ATTR_LONG_NAME) {
        longName = lfnChars(img, entryOff) + longName;
        longChecksum = img[entryOff + 13]; // same on every LFN entry in the set
        continue;
      }

      let name = '';
      for (let j = 0; j < 8; j++) { const c = img[entryOff + j]; if (c !== 0x20) name += String.fromCharCode(c); }
      let ext = '';
      for (let j = 0; j < 3; j++) { const c = img[entryOff + 8 + j]; if (c !== 0x20) ext += String.fromCharCode(c); }
      const shortName = ext ? name + '.' + ext : name;

      // Deleting a file marks only its short entry 0xE5; the LFN entries just above it
      // keep their sequence-number first byte (0x01/0x42/…), which isn't 0x00 or 0xE5,
      // so a later create that reuses this now-free short-entry slot leaves those LFN
      // entries sitting there unclaimed. Without this check they'd get glued onto
      // whatever new short entry lands here next — silently reporting the wrong name
      // for a file that's actually fine on disk (found injecting saves into
      // final-shared.img: even-numbered savedatN.dat entries landed right after such
      // orphans and vanished from extractDirFiles() under a garbled name).
      if (longName && longChecksum !== shortNameChecksum(img, entryOff)) longName = '';

      out.push({
        shortName,
        longName: longName || '',
        attr,
        firstCluster: u16(img, entryOff + 26),
        size: u32(img, entryOff + 28),
        entryOffset: entryOff, // where this 8.3 entry lives, for writing size back
        // create/access/write date-time fields (offsets 13..25); the game shows the
        // last-write time, so these must be carried through an extract→inject round trip
        // or restored saves would keep the base image's old timestamp.
        times: img.slice(entryOff + 13, entryOff + 26),
      });
      longName = '';
      longChecksum = null;
    }
  }
  return out;
}

// Regions (offset+size) that hold a directory's entries: the fixed root, or a cluster chain.
function dirRegions(ctx, firstCluster) {
  if (firstCluster === 0) return [{ off: ctx.rootOffset, size: ctx.rootSizeBytes }];
  return clusterChain(ctx, firstCluster).map((c) => ({ off: clusterOffset(ctx, c), size: ctx.bytesPerCluster }));
}

function listDir(ctx, firstCluster) {
  return parseDirRegions(ctx, dirRegions(ctx, firstCluster));
}

// Resolve a path like "GENSE/SAVEDATA" (case-insensitive) to its directory entry.
// Returns the entry (with firstCluster) or null. Root is firstCluster 0.
function resolveDir(ctx, path) {
  const segments = String(path).replace(/^[\\/]+|[\\/]+$/g, '').split(/[\\/]+/).filter(Boolean);
  let cluster = 0;
  for (const seg of segments) {
    const entries = listDir(ctx, cluster);
    const match = entries.find(
      (e) => (e.attr & ATTR_DIRECTORY) &&
        (e.shortName.toUpperCase() === seg.toUpperCase() || e.longName.toUpperCase() === seg.toUpperCase())
    );
    if (!match) return null;
    cluster = match.firstCluster;
  }
  return cluster;
}

// Read a file's bytes given its directory entry.
function readFileEntry(ctx, entry) {
  const chain = clusterChain(ctx, entry.firstCluster);
  const buf = new Uint8Array(entry.size);
  let p = 0;
  for (const c of chain) {
    const off = clusterOffset(ctx, c);
    const n = Math.min(ctx.bytesPerCluster, entry.size - p);
    buf.set(ctx.img.subarray(off, off + n), p);
    p += n;
    if (p >= entry.size) break;
  }
  return buf;
}

// Extract every real file directly inside `dirPath` as [{name, data}].
// Skips '.', '..', volume labels, subdirectories, and macOS AppleDouble junk ('._*').
function extractDirFiles(bytes, dirPath) {
  const ctx = openImage(bytes);
  const cluster = resolveDir(ctx, dirPath);
  if (cluster === null) throw new Error('directory not found: ' + dirPath);
  const files = [];
  for (const e of listDir(ctx, cluster)) {
    if (e.shortName === '.' || e.shortName === '..') continue;
    if (e.attr & (ATTR_DIRECTORY | ATTR_VOLUME_ID)) continue;
    const name = e.longName || e.shortName;
    if (name.startsWith('._')) continue; // macOS AppleDouble metadata, not game data
    files.push({ name, data: readFileEntry(ctx, e), times: e.times });
  }
  return files;
}

// Overwrite one existing file's contents in place, reusing its cluster chain.
// Throws if `data` needs more clusters than the file already occupies (we never grow).
// Updates the directory entry's size field (and its date-time fields if `times` is
// given — the 13 bytes at offset 13..25 captured by extractDirFiles). Mutates ctx.img.
function writeFileInPlace(ctx, entry, data, times) {
  const chain = clusterChain(ctx, entry.firstCluster);
  const capacity = chain.length * ctx.bytesPerCluster;
  if (data.length > capacity) {
    throw new Error(
      `file ${entry.shortName} needs ${data.length} bytes but only ${capacity} allocated`
    );
  }
  let p = 0;
  for (const c of chain) {
    if (p >= data.length) break;
    const off = clusterOffset(ctx, c);
    const n = Math.min(ctx.bytesPerCluster, data.length - p);
    ctx.img.set(data.subarray(p, p + n), off);
    p += n;
  }
  // Cluster slack past the file length is left untouched, matching real FAT behavior
  // (the game only ever reads `size` bytes). This keeps identity re-injects byte-exact.
  // write the 32-bit size back into the 8.3 directory entry
  const so = entry.entryOffset + 28;
  ctx.img[so] = data.length & 0xff;
  ctx.img[so + 1] = (data.length >> 8) & 0xff;
  ctx.img[so + 2] = (data.length >> 16) & 0xff;
  ctx.img[so + 3] = (data.length >> 24) & 0xff;

  // restore create/access/write date-time (offsets 13..25) so the save keeps the time
  // it was actually made at, not the base image's timestamp. (26..27 = first cluster,
  // left untouched — the data lives in the base's existing clusters.)
  if (times && times.length === 13) ctx.img.set(times, entry.entryOffset + 13);
}

// Inject a set of {name, data} files into `dirPath`, matching by name against the
// existing entries and overwriting in place. Returns a NEW Uint8Array (base is not
// mutated). If a name has no existing entry (e.g. the base image ships with an empty
// SAVEDATA folder — see NOTES.md), a fresh 8.3-only entry is created instead via
// createFileInDir() rather than silently dropping it — a returning player's save must
// always land back on disk, whether or not the shipped base image already had that slot.
function injectDirFiles(bytes, dirPath, files) {
  const copy = (bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes));
  const ctx = openImage(copy);
  const cluster = resolveDir(ctx, dirPath);
  if (cluster === null) throw new Error('directory not found: ' + dirPath);
  const entries = listDir(ctx, cluster);
  const skipped = [];
  for (const f of files) {
    const target = entries.find(
      (e) => !(e.attr & (ATTR_DIRECTORY | ATTR_VOLUME_ID)) &&
        (e.longName.toUpperCase() === f.name.toUpperCase() ||
          e.shortName.toUpperCase() === f.name.toUpperCase())
    );
    const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
    const times = f.times && f.times.length === 13
      ? (f.times instanceof Uint8Array ? f.times : new Uint8Array(f.times)) : null;
    if (!target) {
      try { createFileInDir(ctx, cluster, f.name, data, times); }
      catch (e) { skipped.push(f.name); }
      continue;
    }
    writeFileInPlace(ctx, target, data, times);
  }
  return { image: copy, skipped };
}

// Write a FAT entry value into every FAT copy.
function setFatEntry(ctx, cluster, value) {
  ctx.fatEntries[cluster] = value & 0xffff;
  for (let f = 0; f < ctx.numFATs; f++) {
    const off = ctx.fatStart + f * ctx.sectorsPerFAT * ctx.bytesPerSector + cluster * 2;
    ctx.img[off] = value & 0xff;
    ctx.img[off + 1] = (value >> 8) & 0xff;
  }
}

// Allocate `count` free clusters, chain them, mark the last as EOF. Returns the chain.
function allocateClusters(ctx, count) {
  const dataClusters = Math.floor((ctx.img.length - ctx.dataOffset) / ctx.bytesPerCluster);
  const free = [];
  for (let c = 2; c < ctx.fatEntries.length && c < dataClusters + 2 && free.length < count; c++) {
    if (ctx.fatEntries[c] === 0) free.push(c);
  }
  if (free.length < count) throw new Error('not enough free clusters');
  for (let i = 0; i < free.length; i++) setFatEntry(ctx, free[i], i < free.length - 1 ? free[i + 1] : 0xffff);
  return free;
}

// Build an 8.3 directory-entry name (11 bytes: 8 name + 3 ext, space-padded, uppercased).
function name83(name) {
  const dot = name.lastIndexOf('.');
  let base = (dot >= 0 ? name.slice(0, dot) : name).toUpperCase();
  let ext = (dot >= 0 ? name.slice(dot + 1) : '').toUpperCase();
  base = (base + '        ').slice(0, 8);
  ext = (ext + '   ').slice(0, 3);
  return base + ext;
}

// Core of createFile(), operating directly on an already-open ctx (no image copy) so
// injectDirFiles() can fall back to it per-file without re-copying/re-opening the whole
// image each time. Allocates clusters, writes the data, and fills a free 8.3 directory
// slot (0x00 = end, 0xE5 = deleted) in dirCluster. Optionally restores `times` (the 13-byte
// create/access/write timestamp blob used elsewhere in this file) so an injected save keeps
// the time it was actually made at rather than the moment of injection.
function createFileInDir(ctx, dirCluster, name, data, times) {
  const payload = data instanceof Uint8Array ? data : new Uint8Array(data);

  const needClusters = Math.max(1, Math.ceil(payload.length / ctx.bytesPerCluster));
  const chain = allocateClusters(ctx, needClusters);
  let p = 0;
  for (const c of chain) {
    const off = clusterOffset(ctx, c);
    const n = Math.min(ctx.bytesPerCluster, payload.length - p);
    ctx.img.set(payload.subarray(p, p + n), off);
    p += n;
  }

  const regions = dirRegions(ctx, dirCluster);
  const nm = name83(name);
  let slotOff = -1, regionOff = -1;
  outer:
  for (const { off, size } of regions) {
    for (let i = 0; i < size; i += 32) {
      const first = ctx.img[off + i];
      if (first === 0x00 || first === 0xe5) { slotOff = off + i; regionOff = off; break outer; }
    }
  }
  if (slotOff < 0) throw new Error('no free directory slot (root full)');

  // A slot picked above by first-byte alone can still have live-looking LFN entries
  // sitting right before it — deleting a file only marks its short entry 0xE5, so any
  // LFN entries that named it keep their sequence-number first byte (0x01/0x42/…) and
  // never match the 0x00/0xE5 scan above. Left alone they'd get glued onto whatever
  // short entry we're about to write here (see parseDirRegions' checksum check) —
  // clear them so the slot we're filling is actually clean, not just its own byte.
  for (let p = slotOff - 32; p >= regionOff && ctx.img[p + 11] === ATTR_LONG_NAME && ctx.img[p] !== 0x00 && ctx.img[p] !== 0xe5; p -= 32) {
    ctx.img[p] = 0xe5;
  }

  for (let i = 0; i < 11; i++) ctx.img[slotOff + i] = nm.charCodeAt(i);
  ctx.img[slotOff + 11] = 0x20; // attr = archive
  for (let i = 12; i < 26; i++) ctx.img[slotOff + i] = 0;
  ctx.img[slotOff + 26] = chain[0] & 0xff;
  ctx.img[slotOff + 27] = (chain[0] >> 8) & 0xff;
  ctx.img[slotOff + 28] = payload.length & 0xff;
  ctx.img[slotOff + 29] = (payload.length >> 8) & 0xff;
  ctx.img[slotOff + 30] = (payload.length >> 16) & 0xff;
  ctx.img[slotOff + 31] = (payload.length >> 24) & 0xff;
  if (times && times.length === 13) ctx.img.set(times, slotOff + 13);
}

// Create a new file (8.3 name only, no LFN) in `dirPath` with `data`. Returns a NEW image.
// Fails if the name already exists — use injectDirFiles to overwrite instead.
function createFile(bytes, dirPath, name, data) {
  const copy = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
  const ctx = openImage(copy);
  const dirCluster = resolveDir(ctx, dirPath);
  if (dirCluster === null) throw new Error('directory not found: ' + dirPath);
  createFileInDir(ctx, dirCluster, name, data, null);
  return copy;
}

// Free a cluster chain (set every FAT entry back to 0 in all FAT copies).
function freeChain(ctx, firstCluster) {
  for (const c of clusterChain(ctx, firstCluster)) setFatEntry(ctx, c, 0);
}

// Delete one directory entry (mark 0xE5) and free its clusters. Recurses into
// subdirectories. `entry` is a listing entry from listDir; `img` is mutated.
function deleteEntry(ctx, entry) {
  if (entry.attr & ATTR_DIRECTORY) {
    for (const child of listDir(ctx, entry.firstCluster)) {
      if (child.shortName === '.' || child.shortName === '..') continue;
      deleteEntry(ctx, child);
    }
  }
  if (entry.firstCluster >= 2) freeChain(ctx, entry.firstCluster);
  ctx.img[entry.entryOffset] = 0xe5; // mark deleted
}

// Delete a path (file or directory subtree) from a NEW image copy. Returns { image,
// found }. Missing paths are reported (found:false) rather than throwing, so a strip
// list can include optional entries.
function deletePath(bytes, path) {
  const copy = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
  const ctx = openImage(copy);
  const segments = String(path).replace(/^[\\/]+|[\\/]+$/g, '').split(/[\\/]+/).filter(Boolean);
  const parent = segments.slice(0, -1).join('/');
  const leaf = segments[segments.length - 1];
  const parentCluster = resolveDir(ctx, parent);
  if (parentCluster === null) return { image: copy, found: false };
  const entry = listDir(ctx, parentCluster).find(
    (e) => e.shortName.toUpperCase() === leaf.toUpperCase() || e.longName.toUpperCase() === leaf.toUpperCase()
  );
  if (!entry) return { image: copy, found: false };
  deleteEntry(ctx, entry);
  return { image: copy, found: true };
}

// Overwrite every free cluster's data region with zeros so the image compresses well
// (freed/unused space otherwise holds stale bytes that don't gzip away). Mutates in place.
function zeroFreeClusters(bytes) {
  const ctx = openImage(bytes);
  const dataClusters = Math.floor((ctx.img.length - ctx.dataOffset) / ctx.bytesPerCluster);
  let zeroed = 0;
  for (let c = 2; c < ctx.fatEntries.length && c < dataClusters + 2; c++) {
    if (ctx.fatEntries[c] === 0) {
      ctx.img.fill(0, clusterOffset(ctx, c), clusterOffset(ctx, c) + ctx.bytesPerCluster);
      zeroed++;
    }
  }
  return zeroed;
}

// Write one 32-byte 8.3 directory entry (name, attr, firstCluster, size) at `slotOff`.
function writeDirEntry(ctx, slotOff, name8_3, attr, firstCluster, size) {
  for (let i = 0; i < 11; i++) ctx.img[slotOff + i] = name8_3.charCodeAt(i);
  ctx.img[slotOff + 11] = attr;
  for (let i = 12; i < 26; i++) ctx.img[slotOff + i] = 0;
  ctx.img[slotOff + 26] = firstCluster & 0xff;
  ctx.img[slotOff + 27] = (firstCluster >> 8) & 0xff;
  ctx.img[slotOff + 28] = size & 0xff;
  ctx.img[slotOff + 29] = (size >> 8) & 0xff;
  ctx.img[slotOff + 30] = (size >> 16) & 0xff;
  ctx.img[slotOff + 31] = (size >> 24) & 0xff;
}

// Find a free 32-byte slot (0x00 = end of directory, 0xE5 = deleted) in a directory's
// cluster chain (or the fixed root if firstCluster is 0).
function findFreeSlot(ctx, dirCluster) {
  const regions = dirRegions(ctx, dirCluster);
  for (const { off, size } of regions) {
    for (let i = 0; i < size; i += 32) {
      const first = ctx.img[off + i];
      if (first === 0x00 || first === 0xe5) return off + i;
    }
  }
  throw new Error('no free directory slot');
}

// Create a new empty subdirectory (8.3 name only) inside `dirPath`. Returns a NEW image.
function createDir(bytes, dirPath, name) {
  const copy = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
  const ctx = openImage(copy);
  const parentCluster = resolveDir(ctx, dirPath);
  if (parentCluster === null) throw new Error('directory not found: ' + dirPath);

  const [newCluster] = allocateClusters(ctx, 1);
  const clusOff = clusterOffset(ctx, newCluster);
  ctx.img.fill(0, clusOff, clusOff + ctx.bytesPerCluster);
  // "." and ".." are literal-dot 8.3 names, NOT run through name83()'s "last dot is the
  // extension" logic — that would encode "." as an empty name and ".." as ".", which
  // decode back as bogus/blank directory entries (found via a listDir() ghost-entry bug).
  writeDirEntry(ctx, clusOff, '.          '.slice(0, 11), ATTR_DIRECTORY, newCluster, 0);
  writeDirEntry(ctx, clusOff + 32, '..         '.slice(0, 11), ATTR_DIRECTORY, parentCluster, 0);

  const slotOff = findFreeSlot(ctx, parentCluster);
  writeDirEntry(ctx, slotOff, name83(name), ATTR_DIRECTORY, newCluster, 0);
  return copy;
}

const api = {
  openImage, listDir, resolveDir, readFileEntry, extractDirFiles, injectDirFiles,
  createFile, createDir, deletePath, zeroFreeClusters,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.Fat16 = api;
