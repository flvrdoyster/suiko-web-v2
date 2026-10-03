#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { applySkillFixJp } = require('./compat-patch');

const ROOT = path.join(__dirname, '..', '..');
const LOGFONT_TABLE = 0xac100;
const LOGFONT_SIZE = 0x3c;
const LOGFONT_COUNT = 5;
const WEIGHT_OFFSET = 16;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const weight = parseInt(arg('weight', '500'), 10);
const src = arg('src', path.join(ROOT, 'original/jp/GENSE.EXE'));
const dst = arg('dst', path.join(ROOT, 'kr-patch/build/jp/GENSE.EXE'));

let buf = Buffer.from(fs.readFileSync(src));
applySkillFixJp(buf);
for (let i = 0; i < LOGFONT_COUNT; i++) {
  buf.writeInt32LE(weight, LOGFONT_TABLE + i * LOGFONT_SIZE + WEIGHT_OFFSET);
}
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.writeFileSync(dst, buf);
console.log(`${dst} (weight ${weight})`);
