(function () {
  'use strict';

  function fetchOptional(url) {
    return fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).catch(function () { return null; });
  }

  function imgPath(baseName) { return '/' + baseName + '.img'; }

  function nowTimes() {
    var d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var t = new Uint8Array(13);
    var v = new DataView(t.buffer);
    v.setUint16(1, time, true);
    v.setUint16(3, date, true);
    v.setUint16(5, date, true);
    v.setUint16(9, time, true);
    v.setUint16(11, date, true);
    return t;
  }

  function patch(baseName) {
    var saveNames = [1, 2, 3, 4, 5, 6].map(function (n) { return 'SAVEDAT' + n + '.DAT'; });
    return Promise.all([fetchOptional('probe/FNTPROBE.EXE'), fetchOptional('probe/HWANSE.EXE')]
      .concat(saveNames.map(function (n) { return fetchOptional('probe/' + n); })))
      .then(function (got) {
        var probe = got[0], exe = got[1];
        var saves = saveNames.map(function (n, i) { return { name: n, data: got[2 + i] }; })
          .filter(function (f) { return f.data; })
          .map(function (f) { return { name: f.name, data: new Uint8Array(f.data), times: nowTimes() }; });
        var path = imgPath(baseName);
        var img = Module.FS.readFile(path);
        var res;
        if (saves.length) {
          res = Fat16.injectDirFiles(img, 'GENSE/SAVEDATA', saves);
          if (res.skipped.length) throw new Error('saves not written: ' + res.skipped);
          img = res.image;
          console.log('[suiko-probe] saves injected:', saves.map(function (f) { return f.name; }).join(' '));
        }
        if (exe) {
          res = Fat16.injectDirFiles(img, 'GENSE', [{ name: 'HWANSE.EXE', data: new Uint8Array(exe) }]);
          if (res.skipped.length) throw new Error('HWANSE.EXE not replaced: ' + res.skipped);
          img = res.image;
          console.log('[suiko-probe] HWANSE.EXE replaced with probe/HWANSE.EXE');
        }
        if (probe) {
          img = Fat16.createFile(img, 'GENSE', 'FNTPROBE.EXE', new Uint8Array(probe));
          var ctx = Fat16.openImage(img);
          var entry = Fat16.listDir(ctx, Fat16.resolveDir(ctx, 'WINDOWS')).find(function (e) {
            return e.shortName.toUpperCase() === 'WIN.INI';
          });
          var text = new TextDecoder('latin1').decode(Fat16.readFileEntry(ctx, entry));
          res = Fat16.injectDirFiles(img, 'WINDOWS', [
            { name: 'WIN.INI', data: new TextEncoder().encode(text.replace(/^run=.*$/im, 'run=c:\\gense\\fntprobe.exe')) },
          ]);
          if (res.skipped.length) throw new Error('WIN.INI not patched: ' + res.skipped);
          img = res.image;
          console.log('[suiko-probe] FNTPROBE.EXE injected, WIN.INI run= set');
        }
        Module.FS.writeFile(path, img);
        if (probe) showButton(baseName);
        if (!exe && !probe && !saves.length) console.warn('[suiko-probe] docs/probe/ is empty — plain kr.html boot');
      })
      .catch(function (e) { console.error('[suiko-probe]', e); alert('[suiko-probe] ' + e.message); });
  }

  function download(name, data) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data]));
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function showButton(baseName) {
    var b = document.createElement('button');
    b.textContent = '프로브 결과 받기';
    b.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999';
    b.onclick = function () {
      var files = Fat16.extractDirFiles(Module.FS.readFile(imgPath(baseName)), 'GENSE')
        .filter(function (f) { return /^FNTPROBE\.(TXT|BMP)$/i.test(f.name); });
      if (files.length < 2) {
        alert('아직 디스크에 결과가 없습니다. 게임 타이틀이 뜨고 10초쯤 뒤에 다시 눌러 주세요.');
        return;
      }
      files.forEach(function (f) { download('win95-' + f.name.toLowerCase(), f.data); });
    };
    document.body.appendChild(b);
  }

  window.SuikoProbe = { patch: patch };
})();
