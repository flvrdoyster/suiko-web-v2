#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const keyword = args[0];
if (!keyword) {
  console.error('usage: node kr-patch/tools/search-jp.js <keyword> [--context N]');
  process.exit(1);
}
const ctxFlagIdx = args.indexOf('--context');
const context = ctxFlagIdx >= 0 ? parseInt(args[ctxFlagIdx + 1], 10) : 2;

const jpRef = JSON.parse(fs.readFileSync(path.join(__dirname, '../translation/jp-reference.json'), 'utf8'));

const dialogue = jpRef.dialogue;
const dHits = [];
dialogue.forEach((e, i) => { if (e.text.includes(keyword)) dHits.push(i); });

const labels = jpRef.labels;
const lHits = labels.filter((e) => e.text.includes(keyword));

if (!dHits.length && !lHits.length) {
  console.log(`no matches for ${JSON.stringify(keyword)}`);
  process.exit(0);
}

if (dHits.length) {
  console.log(`=== dialogue: ${dHits.length} match(es) ===\n`);
  for (const i of dHits) {
    const lo = Math.max(0, i - context);
    const hi = Math.min(dialogue.length - 1, i + context);
    console.log(`--- match at index ${i} (offset 0x${dialogue[i].offset.toString(16)}) ---`);
    for (let k = lo; k <= hi; k++) {
      const marker = k === i ? '>> ' : '   ';
      console.log(`${marker}[${k}] ${dialogue[k].text}`);
    }
    console.log();
  }
}

if (lHits.length) {
  console.log(`=== labels: ${lHits.length} match(es) ===\n`);
  for (const e of lHits) console.log(`  0x${e.offset.toString(16)}  ${e.text}`);
}
