// suiko-demo.js — demo.html 전용: demo-patch.json을 부팅 전 EXE에 적용.
(function () {
  'use strict';
  var PATCH_URL = 'demo-patch.json';

  function b64ToBytes(s) {
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function readU32(bytes, off) {
    return (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;
  }

  function patchDemoMenu(baseName) {
    // KR 전용(JP GENSE.EXE는 배치가 다름)
    if (window.SUIKO_LANG !== 'kr') {
      console.warn('[suiko-demo] KR 전용 패치 — SUIKO_LANG=' + window.SUIKO_LANG + ', 건너뜀');
      return Promise.resolve();
    }
    return fetch(PATCH_URL)
      .then(function (r) {
        if (!r.ok) throw new Error(PATCH_URL + ' ' + r.status);
        return r.json();
      })
      .then(function (patch) {
        var path = '/' + baseName + '.img';
        var img = Module.FS.readFile(path);
        var ctx = Fat16.openImage(img);
        var dir = Fat16.resolveDir(ctx, patch.dir);
        var entry = Fat16.listDir(ctx, dir).find(function (e) {
          return e.shortName.toUpperCase() === patch.target;
        });
        if (!entry) throw new Error(patch.dir + '\\' + patch.target + ' not found in the image');

        // Copy: readFileEntry may hand back a view onto the image buffer.
        var exe = new Uint8Array(Fat16.readFileEntry(ctx, entry));
        if (exe.length !== patch.size) {
          throw new Error('size mismatch: image has ' + exe.length + ', patch expects ' + patch.size);
        }
        // 이 패치를 만든 EXE인지 확인
        patch.expect.forEach(function (e) {
          var got = readU32(exe, e.offset);
          if (got !== e.u32 >>> 0) {
            throw new Error(
              'unexpected bytes at ' + e.offset + ': got 0x' + got.toString(16) +
                ', expected 0x' + (e.u32 >>> 0).toString(16) + ' — regenerate demo-patch.json'
            );
          }
        });

        patch.writes.forEach(function (w) {
          exe.set(b64ToBytes(w.bytes), w.offset);
        });

        var res = Fat16.injectDirFiles(img, patch.dir, [{ name: patch.target, data: exe }]);
        if (res.skipped.length) throw new Error('inject skipped: ' + res.skipped.join(','));
        Module.FS.writeFile(path, res.image);
        console.log('[suiko-demo] patched (' + patch.mode + ', ' + patch.writes.length + ' runs)');
        if (window.showToast) window.showToast('데모 빌드: 시나리오 선택으로 시작합니다.');
      })
      .catch(function (e) {
        console.warn('[suiko-demo] 패치 실패, 원본으로 부팅합니다:', e);
        if (window.showToast) window.showToast('데모 메뉴 패치 실패 — 원본으로 실행');
      });
  }

  window.SuikoDemo = { patchDemoMenu: patchDemoMenu };
})();
