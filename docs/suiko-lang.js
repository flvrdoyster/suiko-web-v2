// suiko-lang.js — one shared disk image serves both kr.html and jp.html. Each page sets
// window.SUIKO_LANG ('kr' or 'jp') before this runs; we patch WIN.INI's `load=` line in
// the in-FS disk image (right before Module.callMain(), alongside the SAVEDATA inject in
// suiko-save.js) so Windows auto-launches the right exe. Avoids two full ~90MB installs
// for what's really just a <5MB difference in game files (see tools/build-jp-image.js).
(function () {
  'use strict';
  var LOAD_LINE = {
    kr: 'load=c:\\gense\\hwanse.exe',
    jp: 'load=c:\\gensejp\\gense.exe',
  };

  function patchLanguage(baseName) {
    var lang = window.SUIKO_LANG;
    var line = LOAD_LINE[lang];
    if (!line) { console.warn('[suiko-lang] unknown SUIKO_LANG:', lang); return; }
    var path = '/' + baseName + '.img';
    var img = Module.FS.readFile(path);
    var ctx = Fat16.openImage(img);
    var windowsDir = Fat16.resolveDir(ctx, 'WINDOWS');
    var entry = Fat16.listDir(ctx, windowsDir).find(function (e) { return e.shortName.toUpperCase() === 'WIN.INI'; });
    var text = new TextDecoder('latin1').decode(Fat16.readFileEntry(ctx, entry));
    var replaced = text.replace(/load=.*/i, line);
    var res = Fat16.injectDirFiles(img, 'WINDOWS', [
      { name: 'WIN.INI', data: new TextEncoder().encode(replaced) },
    ]);
    if (res.skipped.length) { console.warn('[suiko-lang] WIN.INI not patched:', res.skipped); return; }
    Module.FS.writeFile(path, res.image);
    console.log('[suiko-lang] WIN.INI load= set for', lang, '->', line);
  }

  window.SuikoLang = { patchLanguage: patchLanguage };
})();
