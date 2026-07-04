// suiko-save.js — persist ONLY the game's SAVEDATA folder, not the whole 90MB disk.
//
// doswasmx's built-in save writes the entire disk image to IndexedDB on demand; that's
// what made v1 lose saves to browser storage eviction. Instead we treat the base image
// as immutable and, using fat16.js:
//   * on boot (before Module.callMain): inject the player's saved SAVEDATA files into
//     the in-FS disk image,
//   * during play (polling + on unload): extract C:\GENSE\SAVEDATA back out and store
//     just those few KB in IndexedDB.
// The IndexedDB key is language-independent so a KR save also loads under jp.html.
(function () {
  'use strict';
  var DB_NAME = 'suiko-web-v2';
  var STORE = 'saves';
  var KEY = 'savedata';
  var SAVE_DIR_BY_LANG = { kr: 'GENSE/SAVEDATA', jp: 'GENSEJP/SAVEDATA' };
  var POLL_MS = 8000;

  function saveDir() { return SAVE_DIR_BY_LANG[window.SUIKO_LANG] || SAVE_DIR_BY_LANG.kr; }

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) { e.target.result.createObjectStore(STORE); };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }
  function idbGet(db, key) {
    return new Promise(function (resolve, reject) {
      var r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = function (e) { resolve(e.target.result); };
      r.onerror = function (e) { reject(e.target.error); };
    });
  }
  function idbPut(db, key, val) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function (e) { reject(e.target.error); };
    });
  }

  var db = null;
  function ensureDB() { return db ? Promise.resolve(db) : openDB().then(function (d) { db = d; return d; }); }

  function imgPath(baseName) { return '/' + baseName + '.img'; }

  function checksum(files) {
    // order-independent enough: fold name + every byte
    var s = 0;
    files.forEach(function (f) {
      for (var i = 0; i < f.name.length; i++) s = (s + f.name.charCodeAt(i)) >>> 0;
      var d = f.data;
      for (var j = 0; j < d.length; j++) s = (s * 31 + d[j]) >>> 0;
    });
    return s;
  }

  // Called right before boot: put the player's saved SAVEDATA into the fresh base image.
  function injectSaveData(baseName) {
    return ensureDB().then(function (d) {
      return idbGet(d, KEY);
    }).then(function (saved) {
      if (!saved || !saved.length) return; // first run: keep the base image's own saves
      var path = imgPath(baseName);
      var img = Module.FS.readFile(path); // Uint8Array (in-memory FS)
      var files = saved.map(function (f) {
        return { name: f.name, data: new Uint8Array(f.data), times: f.times ? new Uint8Array(f.times) : null };
      });
      var res = Fat16.injectDirFiles(img, saveDir(), files);
      Module.FS.writeFile(path, res.image);
      // seed lastChecksum so the first poll doesn't re-save unchanged data
      lastChecksum = checksum(Fat16.extractDirFiles(res.image, saveDir()));
      console.log('[suiko-save] restored', files.length - res.skipped.length, 'save files',
        res.skipped.length ? '(skipped: ' + res.skipped.join(',') + ')' : '');
      if (window.showToast) window.showToast('세이브 데이터를 복원했습니다.');
    }).catch(function (e) { console.warn('[suiko-save] inject failed', e); });
  }

  var lastChecksum = null;

  // Extract SAVEDATA from the live disk image and store it if it changed.
  function capture(baseName) {
    var files;
    try {
      var img = Module.FS.readFile(imgPath(baseName));
      files = Fat16.extractDirFiles(img, saveDir());
    } catch (e) { return Promise.resolve(); } // image not mounted yet, etc.
    var csum = checksum(files);
    if (csum === lastChecksum) return Promise.resolve();
    lastChecksum = csum;
    var stored = files.map(function (f) {
      return {
        name: f.name,
        data: f.data.buffer.slice(f.data.byteOffset, f.data.byteOffset + f.data.byteLength),
        times: f.times ? f.times.buffer.slice(f.times.byteOffset, f.times.byteOffset + f.times.byteLength) : null,
      };
    });
    return ensureDB().then(function (d) { return idbPut(d, KEY, stored); })
      .then(function () {
        console.log('[suiko-save] saved', files.length, 'files');
        if (window.showToast) window.showToast('세이브 데이터가 저장되었습니다.');
      })
      .catch(function (e) { console.warn('[suiko-save] save failed', e); });
  }

  var timer = null;
  function startAutoSave(baseName) {
    if (timer) return;
    timer = setInterval(function () { capture(baseName); }, POLL_MS);
    // best-effort final flush (async may not finish, but the poll usually caught it)
    window.addEventListener('pagehide', function () { capture(baseName); });
    window.addEventListener('beforeunload', function () { capture(baseName); });
  }

  window.SuikoSave = { injectSaveData: injectSaveData, startAutoSave: startAutoSave, saveNow: capture };
})();
