
'use strict';

const ATTR_LONG_NAME = 0x0f;
const ATTR_DIRECTORY = 0x10;
const ATTR_VOLUME_ID = 0x08;

function u16(view, off) { return view[off] | (view[off + 1] << 8); }
function u32(view, off) {
  return (view[off] | (view[off + 1] << 8) | (view[off + 2] << 16) | (view[off + 3] << 24)) >>> 0;
}

function openImage(bytes) {
  const img = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  const PT = 0x1be;
  let partLBA = null;
  for (let i = 0; i < 4; i++) {
    const off = PT + i * 16;
    const type = img[off + 4];
    if (type === 0x06 || type === 0x0e || type === 0x04) {
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

  const fatEntries = new Uint16Array(sectorsPerFAT * bytesPerSector / 2);
  for (let i = 0; i < fatEntries.length; i++) fatEntries[i] = u16(img, fatStart + i * 2);

  return {
    img, bytesPerSector, sectorsPerCluster, bytesPerCluster,
    rootOffset, rootSizeBytes, dataOffset, fatEntries,
    fatStart, numFATs, sectorsPerFAT,
  };
}

function clusterOffset(ctx, cluster) {
  return ctx.dataOffset + (cluster - 2) * ctx.bytesPerCluster;
}

function clusterChain(ctx, firstCluster) {
  const chain = [];
  let c = firstCluster;
  while (c >= 2 && c < 0xfff8) {
    chain.push(c);
    c = ctx.fatEntries[c];
  }
  return chain;
}

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

function shortNameChecksum(img, entryOff) {
  let sum = 0;
  for (let j = 0; j < 11; j++) sum = (((sum & 1) ? 0x80 : 0) + (sum >> 1) + img[entryOff + j]) & 0xff;
  return sum;
}

function parseDirRegions(ctx, regions) {
  const img = ctx.img;
  const out = [];
  let longName = '';
  let longChecksum = null;
  for (const { off, size } of regions) {
    for (let i = 0; i < size; i += 32) {
      const entryOff = off + i;
      const first = img[entryOff];
      if (first === 0x00) return out;
      if (first === 0xe5) { longName = ''; longChecksum = null; continue; }
      const attr = img[entryOff + 11];
      if (attr === ATTR_LONG_NAME) {
        longName = lfnChars(img, entryOff) + longName;
        longChecksum = img[entryOff + 13];
        continue;
      }

      let name = '';
      for (let j = 0; j < 8; j++) { const c = img[entryOff + j]; if (c !== 0x20) name += String.fromCharCode(c); }
      let ext = '';
      for (let j = 0; j < 3; j++) { const c = img[entryOff + 8 + j]; if (c !== 0x20) ext += String.fromCharCode(c); }
      const shortName = ext ? name + '.' + ext : name;

      if (longName && longChecksum !== shortNameChecksum(img, entryOff)) longName = '';

      out.push({
        shortName,
        longName: longName || '',
        attr,
        firstCluster: u16(img, entryOff + 26),
        size: u32(img, entryOff + 28),
        entryOffset: entryOff,
        times: img.slice(entryOff + 13, entryOff + 26),
      });
      longName = '';
      longChecksum = null;
    }
  }
  return out;
}

function dirRegions(ctx, firstCluster) {
  if (firstCluster === 0) return [{ off: ctx.rootOffset, size: ctx.rootSizeBytes }];
  return clusterChain(ctx, firstCluster).map((c) => ({ off: clusterOffset(ctx, c), size: ctx.bytesPerCluster }));
}

function listDir(ctx, firstCluster) {
  return parseDirRegions(ctx, dirRegions(ctx, firstCluster));
}

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

function extractDirFiles(bytes, dirPath) {
  const ctx = openImage(bytes);
  const cluster = resolveDir(ctx, dirPath);
  if (cluster === null) throw new Error('directory not found: ' + dirPath);
  const files = [];
  for (const e of listDir(ctx, cluster)) {
    if (e.shortName === '.' || e.shortName === '..') continue;
    if (e.attr & (ATTR_DIRECTORY | ATTR_VOLUME_ID)) continue;
    const name = e.longName || e.shortName;
    if (name.startsWith('._')) continue;
    files.push({ name, data: readFileEntry(ctx, e), times: e.times });
  }
  return files;
}

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
  const so = entry.entryOffset + 28;
  ctx.img[so] = data.length & 0xff;
  ctx.img[so + 1] = (data.length >> 8) & 0xff;
  ctx.img[so + 2] = (data.length >> 16) & 0xff;
  ctx.img[so + 3] = (data.length >> 24) & 0xff;

  if (times && times.length === 13) ctx.img.set(times, entry.entryOffset + 13);
}

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

function setFatEntry(ctx, cluster, value) {
  ctx.fatEntries[cluster] = value & 0xffff;
  for (let f = 0; f < ctx.numFATs; f++) {
    const off = ctx.fatStart + f * ctx.sectorsPerFAT * ctx.bytesPerSector + cluster * 2;
    ctx.img[off] = value & 0xff;
    ctx.img[off + 1] = (value >> 8) & 0xff;
  }
}

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

function name83(name) {
  const dot = name.lastIndexOf('.');
  let base = (dot >= 0 ? name.slice(0, dot) : name).toUpperCase();
  let ext = (dot >= 0 ? name.slice(dot + 1) : '').toUpperCase();
  base = (base + '        ').slice(0, 8);
  ext = (ext + '   ').slice(0, 3);
  return base + ext;
}

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

  // 이 슬롯 바로 앞의 고아 LFN 엔트리도 지운다
  for (let p = slotOff - 32; p >= regionOff && ctx.img[p + 11] === ATTR_LONG_NAME && ctx.img[p] !== 0x00 && ctx.img[p] !== 0xe5; p -= 32) {
    ctx.img[p] = 0xe5;
  }

  for (let i = 0; i < 11; i++) ctx.img[slotOff + i] = nm.charCodeAt(i);
  ctx.img[slotOff + 11] = 0x20;
  for (let i = 12; i < 26; i++) ctx.img[slotOff + i] = 0;
  ctx.img[slotOff + 26] = chain[0] & 0xff;
  ctx.img[slotOff + 27] = (chain[0] >> 8) & 0xff;
  ctx.img[slotOff + 28] = payload.length & 0xff;
  ctx.img[slotOff + 29] = (payload.length >> 8) & 0xff;
  ctx.img[slotOff + 30] = (payload.length >> 16) & 0xff;
  ctx.img[slotOff + 31] = (payload.length >> 24) & 0xff;
  if (times && times.length === 13) ctx.img.set(times, slotOff + 13);
}

function createFile(bytes, dirPath, name, data) {
  const copy = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
  const ctx = openImage(copy);
  const dirCluster = resolveDir(ctx, dirPath);
  if (dirCluster === null) throw new Error('directory not found: ' + dirPath);
  createFileInDir(ctx, dirCluster, name, data, null);
  return copy;
}

function freeChain(ctx, firstCluster) {
  for (const c of clusterChain(ctx, firstCluster)) setFatEntry(ctx, c, 0);
}

function deleteEntry(ctx, entry) {
  if (entry.attr & ATTR_DIRECTORY) {
    for (const child of listDir(ctx, entry.firstCluster)) {
      if (child.shortName === '.' || child.shortName === '..') continue;
      deleteEntry(ctx, child);
    }
  }
  if (entry.firstCluster >= 2) freeChain(ctx, entry.firstCluster);
  ctx.img[entry.entryOffset] = 0xe5;
}

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

function createDir(bytes, dirPath, name) {
  const copy = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
  const ctx = openImage(copy);
  const parentCluster = resolveDir(ctx, dirPath);
  if (parentCluster === null) throw new Error('directory not found: ' + dirPath);

  const [newCluster] = allocateClusters(ctx, 1);
  const clusOff = clusterOffset(ctx, newCluster);
  ctx.img.fill(0, clusOff, clusOff + ctx.bytesPerCluster);
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
