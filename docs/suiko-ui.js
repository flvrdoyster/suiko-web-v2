// suiko-web-v2 UI glue — wires the clean start overlay / top-bar to the doswasmx engine.
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', function () {
    var overlay = $('overlay');
    var start = $('btn-start');
    var status = overlay ? overlay.querySelector('.status') : null;
    if (!start) return;

    function setStatus(t) { if (status) status.textContent = t; }
    function engineReady() {
      return window.myApp && myApp.rivetsData && !myApp.rivetsData.moduleInitializing;
    }

    // Enable Start once the doswasmx WASM module has initialised.
    start.disabled = true;
    setStatus('엔진 로딩 중…');
    var poll = setInterval(function () {
      if (engineReady()) {
        clearInterval(poll);
        start.disabled = false;
        setStatus('준비 완료 — 시작을 누르세요');
      }
    }, 300);

    start.addEventListener('click', function () {
      if (start.disabled) return;
      // the click is the user gesture that lets the SC-55 AudioContext start
      if (window.SuikoMidi && SuikoMidi.open) SuikoMidi.open();
      overlay.classList.add('hidden');
      myApp.loadRom(true); // boot Win95 + auto-launch the game
    });

    // top-bar fullscreen → reuse doswasmx's fullscreen (targets the canvas container)
    var fs = $('btn-fullscreen');
    if (fs) fs.addEventListener('click', function () {
      if (window.myApp && myApp.fullscreen) myApp.fullscreen();
      else {
        var d = $('canvasDiv');
        if (d && d.requestFullscreen) d.requestFullscreen();
      }
    });
  });
})();
