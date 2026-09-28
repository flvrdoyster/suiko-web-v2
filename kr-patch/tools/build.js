#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DIALOGUE = require('./hwanse-text.js');
const NAMES = require('./hwanse-names.js');
const COMPAT = require('./compat-patch.js');

const ROOT = path.join(__dirname, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const krExePath = arg('kr-exe', path.join(ROOT, 'original/kr/HWANSE.EXE'));
const translationPath = arg('translation', path.join(ROOT, 'kr-patch/translation/translation.json'));
const outPath = arg('out', path.join(ROOT, 'kr-patch/build/HWANSE.EXE'));

function fail(msg) {
  console.error('build.js: ' + msg);
  process.exit(1);
}

if (!fs.existsSync(krExePath)) fail(`KR exe not found: ${krExePath}`);
if (!fs.existsSync(translationPath)) fail(`translation.json not found: ${translationPath}`);

const buf = fs.readFileSync(krExePath);
const t = JSON.parse(fs.readFileSync(translationPath, 'utf8'));

if (t.source_file && t.source_file !== path.basename(krExePath)) {
  console.warn(`⚠ translation.json was extracted from ${JSON.stringify(t.source_file)}, building against ${JSON.stringify(path.basename(krExePath))}`);
}

const fixedDialogue = t.dialogue.filter((e) => e.fixed);
const fixedLabels = t.labels.filter((e) => e.fixed);

if (!fixedDialogue.length && !fixedLabels.length) {
  console.log('build.js: no entries have a `fixed` value set — nothing to do.');
  process.exit(0);
}

let out;
try {
  out = DIALOGUE.build(buf, t.dialogue);
  out = NAMES.build(out, fixedLabels);
  const skill = COMPAT.applySkillFix(out);
  const font = COMPAT.applyFontFix(out);
  const win = COMPAT.applyWindowFix(out);
  out = win.buf;
  console.log(`compat: skill fix ${skill}, font fix ${font}, window fix ${win.status}`);
} catch (e) {
  fail(e.message);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);

console.log(`wrote ${path.relative(ROOT, outPath)}`);
console.log(`applied: ${fixedDialogue.length} dialogue entries, ${fixedLabels.length} label entries`);
for (const e of [...fixedDialogue, ...fixedLabels]) {
  console.log(`  0x${e.offset.toString(16)}  ${JSON.stringify(e.text)} -> ${JSON.stringify(e.fixed)}`);
}
