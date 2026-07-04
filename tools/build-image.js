// build-image.js — turn a raw KR/JP game disk image into the "intended" base image:
//   * bakes the MIDI mapper default to "External MIDI Port" so the game's music routes
//     to the MPU-401 path (→ our JS SC-55 synth) with no manual Control Panel step.
//     Done via a .reg imported at every boot by regedit (the immutable base has no
//     MIDIMap registry key otherwise).
//   * the game auto-launches on boot (via a startup batch that runs regedit first).
//
// Usage: node tools/build-image.js <in.img> <out.img> <GAME_DIR> <GAME_EXE>
//   e.g. node tools/build-image.js game.img intended-kr.img \GENSE HWANSE.EXE
'use strict';
const fs = require('fs');
const F = require('../src/fat16.js');

const [, , inPath, outPath, gameDir, gameExe] = process.argv;
if (!inPath || !outPath || !gameDir || !gameExe) {
  console.error('usage: node tools/build-image.js <in.img> <out.img> <GAME_DIR> <GAME_EXE>');
  process.exit(1);
}

const CRLF = '\r\n';
const REG = [
  'REGEDIT4', '',
  '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Multimedia\\MIDIMap]',
  '"CurrentInstrument"="External MIDI Port"',
  '"UseScheme"=dword:00000000', '',
].join(CRLF);
// cd into the game dir first so the game finds its data files (pcmdata.wlk etc.),
// which it opens by relative path; then launch it (start = non-blocking, DOS box closes).
const BAT = ['@echo off', 'regedit /s c:\\midifix.reg', 'c:', 'cd ' + gameDir, 'start ' + gameExe, ''].join(CRLF);

let img = new Uint8Array(fs.readFileSync(inPath));

// 1. create the two boot files in the root directory
img = F.createFile(img, '', 'MIDIFIX.REG', new Uint8Array(Buffer.from(REG, 'latin1')));
img = F.createFile(img, '', 'SETUP.BAT', new Uint8Array(Buffer.from(BAT, 'latin1')));

// 2. rewrite WIN.INI: don't let load= launch the game (SETUP.BAT does), run SETUP.BAT
const ctx = F.openImage(img);
const winEntry = F.listDir(ctx, F.resolveDir(ctx, 'WINDOWS')).find((e) => e.shortName.toUpperCase() === 'WIN.INI');
let wini = Buffer.from(F.readFileEntry(ctx, winEntry)).toString('latin1');
wini = wini.replace(/load=c:\\gense\\hwanse\.exe/i, 'load=').replace(/^run=\s*$/im, 'run=c:\\setup.bat');
const res = F.injectDirFiles(img, 'WINDOWS', [{ name: 'WIN.INI', data: new Uint8Array(Buffer.from(wini, 'latin1')) }]);
img = res.image;
if (res.skipped.length) throw new Error('WIN.INI not written: ' + res.skipped);

fs.writeFileSync(outPath, Buffer.from(img));
console.log('wrote', outPath, img.length, 'bytes');

// 3. verify by reading the created files + game data back
const v = F.openImage(img);
function readRoot(name) {
  const e = F.listDir(v, 0).find((x) => x.shortName.toUpperCase() === name);
  return e ? Buffer.from(F.readFileEntry(v, e)).toString('latin1') : null;
}
console.log('--- MIDIFIX.REG ---\n' + readRoot('MIDIFIX.REG'));
console.log('--- SETUP.BAT ---\n' + readRoot('SETUP.BAT'));
const winiOut = Buffer.from(F.readFileEntry(v, F.listDir(v, F.resolveDir(v, 'WINDOWS')).find((e) => e.shortName.toUpperCase() === 'WIN.INI'))).toString('latin1');
console.log('--- WIN.INI load/run ---\n' + winiOut.split('\n').filter((l) => /^(load|run)=/i.test(l)).join('\n'));
const saves = F.extractDirFiles(img, 'GENSE/SAVEDATA');
console.log('--- SAVEDATA intact:', saves.length, 'files,', saves.map((s) => s.name).join(','));
const exe = F.listDir(v, F.resolveDir(v, 'GENSE')).find((e) => e.shortName.toUpperCase() === 'HWANSE.EXE');
console.log('--- HWANSE.EXE size:', exe ? exe.size : 'MISSING');
