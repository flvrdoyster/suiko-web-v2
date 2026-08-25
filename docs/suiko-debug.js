// suiko-debug.js — kr.html/jp.html only, and only when the URL has `?debug`/`&debug`
// (no query param -> this returns immediately, no button, no panel, no IDB open). Modeled on
// gensei-pc98's docs/debug.js (disk-image import/export panel), adapted for a different
// storage shape: gensei-pc98 has one IndexedDB key per disk file (key -> whole binary blob),
// but suiko-save.js keeps ONE key ('savedata') whose value is the *whole SAVEDATA folder* as
// an array of {name, data, times} (see suiko-save.js — SAVEDATA-only persistence via
// fat16.js). So "one row per IDB key" doesn't fit; instead each row here is one save slot
// *inside* that array, and import/export/delete all read-modify-write the whole array under
// the single 'savedata' key, matching by slot name.
(function () {
  'use strict';

  if (!new URLSearchParams(location.search).has('debug')) return;

  // Same DB/store/key as suiko-save.js — duplicated here rather than reaching into that
  // file's closure (it doesn't expose one), matching how suiko-save.js itself duplicates
  // its own tiny IDB helpers rather than sharing a third file for three functions.
  var DB_NAME = 'suiko-web-v2';
  var STORE = 'saves';
  var KEY = 'savedata';

  // The KR retail game writes up to 6 save slots (confirmed against real save files);
  // JP uses the same engine and slot names under GENSEJP/SAVEDATA. Fixed list rather than
  // "whatever's in the array" so an empty/first-run cache still shows all 6 import targets.
  var SLOTS = ['SAVEDAT1.DAT', 'SAVEDAT2.DAT', 'SAVEDAT3.DAT', 'SAVEDAT4.DAT', 'SAVEDAT5.DAT', 'SAVEDAT6.DAT'];

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

  // Current cached array, or [] if nothing saved yet — the shape suiko-save.js's
  // injectSaveData()/capture() use (`{name, data: ArrayBuffer, times: ArrayBuffer|null}`).
  function getSaves() {
    return ensureDB().then(function (d) { return idbGet(d, KEY); }).then(function (v) { return v || []; });
  }

  // gensei-pc98의 docs/debug.js STYLE을 그대로 따른다 — 이 사이트의 style.css는 그쪽과
  // 완전히 같은 파일(문서 상단 주석 "copied verbatim")이라 --font-sm/--font-md 토큰과 전역
  // button{} 규칙(배경·테두리·hover 다 포함)이 이미 있다. 여기서 새로 정의하는 건 그 위에
  // 얹는 값(폭·간격)뿐 — 색·폰트크기를 하드코딩하면 전역 스타일이 바뀔 때 이 패널만 따로
  // 놀게 된다.
  //
  // 위 둘과 다르게 손댄 두 곳은 실제 레이아웃 문제 때문이다: gensei-pc98의 행도 구조는
  // 같지만(라벨 + 버튼 3개) 라벨이 짧은 디스크 파일명이라 줄바꿈이 안 보였을 뿐 — 여기 라벨
  // ("SAVEDAT1.DAT (캐시 없음)")은 더 길어서 원래 규칙(`flex-wrap:wrap` + 폭 360px) 그대로
  // 쓰면 버튼이 다음 줄로 밀렸다. 폭을 420px로 늘리고 행은 nowrap, 라벨은 넘치면 말줄임
  // 처리한다.
  var STYLE =
    '#dbg-panel{position:fixed;top:56px;left:8px;z-index:300;' +
    'background:rgba(38,38,38,0.97);border:1px solid rgba(68,68,68,1);border-radius:6px;' +
    'padding:12px 14px;width:min(420px,calc(100vw - 16px));' +
    'color:rgba(204,204,204,1);font-size:var(--font-sm);' +
    'box-shadow:0 6px 20px rgba(0,0,0,0.45);' +
    '-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}' +
    '#dbg-panel.hidden{display:none}' +
    '#dbg-panel h4{margin:0 0 8px;font-size:var(--font-md);color:rgba(170,170,170,1)}' +
    '#dbg-panel .dbg-row{display:flex;align-items:center;gap:6px;margin:4px 0;flex-wrap:nowrap}' +
    '#dbg-panel .dbg-key{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#dbg-panel .dbg-key.dbg-empty{color:rgba(119,119,119,1)}' +
    '#dbg-panel button{flex-shrink:0;white-space:nowrap;font-size:var(--font-sm);padding:3px 10px}' +
    '#dbg-panel button:disabled{opacity:0.4;cursor:default}' +
    '#dbg-panel .dbg-msg{margin-top:8px;color:rgba(119,119,119,1);min-height:1.4em;word-break:break-all}' +
    '#btn-debug.active{background:rgba(38,38,38,1)}';

  var panel, listEl, msgEl, fileInput, btnToggle;
  var pendingSlot = null;

  function setMsg(text) { if (msgEl) msgEl.textContent = text || ''; }

  function download(name, buf) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function makeBtn(label, onclick, title) {
    var b = document.createElement('button');
    b.textContent = label;
    if (title) b.title = title;
    b.onclick = onclick;
    return b;
  }

  // Read-modify-write the whole array: drop any existing entry named `name`, optionally
  // push a replacement. Both import and delete go through this so the array never ends up
  // with two entries sharing a name.
  function replaceSlot(name, entry) {
    return getSaves().then(function (saves) {
      var next = saves.filter(function (f) { return f.name.toUpperCase() !== name; });
      if (entry) next.push(entry);
      return ensureDB().then(function (d) { return idbPut(d, KEY, next); });
    });
  }

  function refreshList() {
    getSaves().then(function (saves) {
      listEl.innerHTML = '';
      SLOTS.forEach(function (slot) {
        var f = saves.find(function (x) { return x.name.toUpperCase() === slot; });
        var row = document.createElement('div');
        row.className = 'dbg-row';
        var label = document.createElement('span');
        label.className = 'dbg-key' + (f ? '' : ' dbg-empty');
        label.textContent = slot + (f ? '' : ' (캐시 없음)');
        row.appendChild(label);
        row.appendChild(makeBtn('가져오기', function () { pickFile(slot); }, '파일 선택 → 이 슬롯으로 저장(덮어쓰기)'));
        var exp = makeBtn('내보내기', function () {
          if (!f) { setMsg(slot + ': 캐시 없음'); return; }
          download(slot, f.data);
          setMsg(slot + ' 내보냄');
        });
        var del = makeBtn('삭제', function () {
          replaceSlot(slot, null).then(function () {
            setMsg(slot + ' 캐시 삭제됨 — 새로고침하면 빈 슬롯으로 시작합니다');
            refreshList();
          });
        }, '캐시에서 제거(원본은 빈 슬롯이라 새로고침하면 빈 슬롯이 됨)');
        exp.disabled = del.disabled = !f;
        row.appendChild(exp);
        row.appendChild(del);
        listEl.appendChild(row);
      });
    });
  }

  function pickFile(slot) {
    pendingSlot = slot;
    fileInput.click();
  }

  function onFile(e) {
    var file = e.target.files[0];
    fileInput.value = '';
    if (!file || !pendingSlot) return;
    var slot = pendingSlot;
    file.arrayBuffer().then(function (buf) {
      return replaceSlot(slot, { name: slot, data: buf, times: null });
    }).then(function () {
      setMsg(slot + ' 저장됨 (' + file.size + 'B) — 새로고침하세요');
      refreshList();
    }).catch(function (err) {
      setMsg('실패: ' + err);
    });
  }

  function build() {
    var topbar = document.querySelector('.top-bar');
    if (!topbar) return;

    var style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    btnToggle = document.createElement('button');
    btnToggle.className = 'btn-icon';
    btnToggle.id = 'btn-debug';
    btnToggle.title = 'DEBUG 세이브';
    // Generic bug icon (no branding) — same one gensei-pc98's icons.js uses for its own
    // debug toggle, inlined here since this site has no shared icon module.
    btnToggle.innerHTML = '<svg viewBox="2 4 28 24" height="22"><path fill="currentColor" d="M29,15h-5.1c-0.1-1.2-0.5-2.4-1-3.5c1.9-1.5,3.1-3.7,3.1-6.1V5c0-0.6-0.4-1-1-1s-1,0.4-1,1v0.4c0,1.8-0.8,3.4-2.2,4.5c-0.5-0.7-1.2-1.2-1.9-1.7c0-0.1,0-0.1,0-0.2c0-2.2-1.8-4-4-4s-4,1.8-4,4c0,0.1,0,0.1,0,0.2c-0.7,0.5-1.3,1-1.9,1.7C8.8,8.8,8,7.2,8,5.4V5c0-0.6-0.4-1-1-1S6,4.4,6,5v0.4c0,2.4,1.1,4.7,3.1,6.1c-0.5,1-0.9,2.2-1,3.5H3c-0.6,0-1,0.4-1,1s0.4,1,1,1h5.1c0.1,1.2,0.5,2.4,1,3.5C7.1,21.9,6,24.2,6,26.6V27c0,0.6,0.4,1,1,1s1-0.4,1-1v-0.4c0-1.8,0.8-3.4,2.2-4.5c1.5,1.8,3.5,2.9,5.8,2.9s4.4-1.1,5.8-2.9c1.4,1.1,2.2,2.7,2.2,4.5V27c0,0.6,0.4,1,1,1s1-0.4,1-1v-0.4c0-2.4-1.1-4.7-3.1-6.1c0.5-1,0.9-2.2,1-3.5H29c0.6,0,1-0.4,1-1S29.6,15,29,15z"/></svg>';

    // .top-bar는 gensei-pc98와 같은 3열 그리드(1fr auto 1fr — 왼쪽/로고/오른쪽, style.css
    // 확인함). gensei-pc98의 debug.js가 왼쪽 칸(grid-column:1)에 #topbar-left라는 flex
    // 컨테이너를 두고 자기 버튼을 넣는 것과 똑같이 맞춘다 — 이 사이트는 그 칸에 아직 아무것도
    // 없어서(#btn-disk 미사용) 매번 새로 만든다.
    var left = document.getElementById('topbar-left');
    if (!left) {
      left = document.createElement('div');
      left.id = 'topbar-left';
      left.style.cssText = 'grid-column:1;justify-self:start;display:flex;align-items:center';
      topbar.insertBefore(left, topbar.firstChild);
    }
    left.appendChild(btnToggle);

    panel = document.createElement('div');
    panel.id = 'dbg-panel';
    panel.className = 'hidden';

    var h = document.createElement('h4');
    h.textContent = 'DEBUG · 세이브';

    listEl = document.createElement('div');
    msgEl = document.createElement('div');
    msgEl.className = 'dbg-msg';

    panel.appendChild(h);
    panel.appendChild(listEl);
    panel.appendChild(msgEl);
    document.body.appendChild(panel);

    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', onFile);
    document.body.appendChild(fileInput);

    btnToggle.addEventListener('click', function () {
      panel.classList.toggle('hidden');
      btnToggle.classList.toggle('active');
      if (!panel.classList.contains('hidden')) refreshList();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
