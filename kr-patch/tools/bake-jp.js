#!/usr/bin/env node
// bake-jp.js — resolve the sparse KR<->JP anchors in kr-jp-links.json into an ACTUAL JP
// text/offset on every dialogue entry in translation.json, then write it there directly.
//
// Why: kr-jp-links.json only stores anchor points; every other line's JP counterpart is
// computed live (by the editor, by ad-hoc scripts) by walking both dialogue arrays forward
// in lockstep from the nearest anchor. That's fragile to keep recomputing — this script
// runs that computation ONCE and bakes the result into translation.json itself, so it
// becomes the single source of truth for KR<->JP dialogue correspondence going forward.
//
// Usage: node kr-patch/tools/bake-jp.js [--translation path] [--jp-ref path] [--links path]
// Only bakes entries with a clean, unambiguous match (in range, not conflicting with
// another anchor's cascade — see NOTES.md's anchor-cascade write-up). Anything else is left
// with jp: "" so it's visible (searchable) as unresolved rather than silently wrong.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const transPath = arg('translation', path.join(ROOT, 'kr-patch/translation/translation.json'));
const jpRefPath = arg('jp-ref', path.join(ROOT, 'kr-patch/translation/jp-reference.json'));
const linksPath = arg('links', path.join(ROOT, 'kr-patch/translation/kr-jp-links.json'));

const t = JSON.parse(fs.readFileSync(transPath, 'utf8'));
const jpRef = JSON.parse(fs.readFileSync(jpRefPath, 'utf8'));
const links = fs.existsSync(linksPath) ? JSON.parse(fs.readFileSync(linksPath, 'utf8')) : {};

const kr = t.dialogue;
const jpD = jpRef.dialogue;
const krOffsetToIndex = new Map(kr.map((e, i) => [e.offset, i]));
const jpOffsetToIndex = new Map(jpD.map((e, i) => [e.offset, i]));

const markers = Object.keys(links)
  .map((k) => parseInt(k, 10))
  .map((krOffset) => {
    const krIdx = krOffsetToIndex.get(krOffset);
    const v = links[krOffset];
    if (krIdx === undefined) return null;
    if (v === false) return { krOffset, krIdx, stop: true };
    const jpIdx = jpOffsetToIndex.get(v);
    if (jpIdx === undefined) return null;
    return { krOffset, krIdx, jpIdx };
  })
  .filter(Boolean)
  .sort((a, b) => a.krIdx - b.krIdx);

// jpIdx -> Set(anchor krOffset) claiming it, to detect the same conflict the editor flags.
const claim = new Map();
for (let mi = 0; mi < markers.length; mi++) {
  const m = markers[mi];
  if (m.stop) continue;
  const end = mi + 1 < markers.length ? markers[mi + 1].krIdx : kr.length;
  for (let krIdx = m.krIdx; krIdx < end; krIdx++) {
    const jpIdx = m.jpIdx + (krIdx - m.krIdx);
    if (jpIdx < 0 || jpIdx >= jpD.length) continue;
    if (!claim.has(jpIdx)) claim.set(jpIdx, new Set());
    claim.get(jpIdx).add(m.krOffset);
  }
}

let resolved = 0, unresolved = 0, conflicted = 0, oob = 0;
for (let mi = 0; mi < markers.length; mi++) {
  const m = markers[mi];
  if (m.stop) continue;
  const end = mi + 1 < markers.length ? markers[mi + 1].krIdx : kr.length;
  for (let krIdx = m.krIdx; krIdx < end; krIdx++) {
    const jpIdx = m.jpIdx + (krIdx - m.krIdx);
    const entry = kr[krIdx];
    if (jpIdx < 0 || jpIdx >= jpD.length) { entry.jp = ''; entry.jpOffset = null; oob++; continue; }
    const claimants = claim.get(jpIdx);
    if (claimants && claimants.size > 1) { entry.jp = ''; entry.jpOffset = null; conflicted++; continue; }
    entry.jp = jpD[jpIdx].text;
    entry.jpOffset = jpD[jpIdx].offset;
    resolved++;
  }
}
// entries before the first marker, or in a stopped stretch with no marker at all
for (const e of kr) if (e.jp === undefined) { e.jp = ''; e.jpOffset = null; unresolved++; }

fs.writeFileSync(transPath, JSON.stringify(t, null, 2));
console.log(`baked jp field into ${path.relative(ROOT, transPath)}:`);
console.log(`  resolved: ${resolved} / conflicted: ${conflicted} / out-of-range: ${oob} / no-anchor: ${unresolved}`);
console.log(`  total dialogue entries: ${kr.length}`);
