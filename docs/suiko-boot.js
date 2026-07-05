// suiko-web-v2 boot glue — wires the start overlay + top-bar buttons to the doswasmx
// engine. gamepad.js (copied from gensei-pc98, unmodified) handles the virtual gamepad,
// mobile auto-activation, and the top-bar collapse button already.
//
// This script is a plain (non-module, non-deferred) <script> placed near the end of
// <body>, so it executes at that point during parsing — after #overlay/#toast/etc.
// already exist, but before deferred/module scripts (like suiko-midi-synth.js) run.
// window.showToast is defined here, at the top level, so it's ready by the time that
// module's own loading-progress messages call it.
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }

  // ---- single shared notification channel (gensei-pc98's #toast convention) ----
  // Normal calls auto-hide after `duration` (default 2s), matching gensei-pc98's one-off
  // hints (save restored, ESC-to-exit-fullscreen, etc). Pass duration 0 for a persistent
  // message — used here for the loading state, which doesn't have a fixed lifetime.
  var toastEl = $('toast');
  var toastTimer = null;
  function showToast(msg, duration) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('visible');
    clearTimeout(toastTimer);
    if (duration !== 0) toastTimer = setTimeout(hideToast, duration || 2000);
  }
  function hideToast() {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.classList.remove('visible');
  }
  window.showToast = showToast;

  var overlay = $('overlay');
  var start = $('btn-start');

  function engineReady() {
    return window.myApp && myApp.rivetsData && !myApp.rivetsData.moduleInitializing;
  }

  // Enable Start once the doswasmx WASM module has initialised.
  if (start) {
    start.disabled = true;
    showToast('에뮬레이터를 불러오는 중입니다.', 0);
    var poll = setInterval(function () {
      if (engineReady()) {
        clearInterval(poll);
        start.disabled = false;
        showToast('에뮬레이터를 불러왔습니다.', 0);
      }
    }, 300);

    start.addEventListener('click', function () {
      if (start.disabled) return;
      // the click is the user gesture that lets the SC-55 AudioContext start
      if (window.SuikoMidi && SuikoMidi.open) SuikoMidi.open();
      hideToast();
      overlay.classList.add('hidden');
      myApp.loadRom(true); // boot Win95 + auto-launch the game
    });
  }

  // Fullscreen: same behavior as gensei-pc98 — ESC is locked to the page while
  // fullscreen (Keyboard Lock API) so a short ESC press reaches the emulator as a
  // game input (Cancel/Shift) instead of instantly exiting fullscreen; only a
  // long-press (browser's own hold-to-exit prompt) actually leaves fullscreen.
  var fs = $('btn-fullscreen');
  if (fs) fs.addEventListener('click', async function () {
    var wrap = $('canvasDiv'); // doswasmx's own fullscreen target (see suiko-overrides.css)
    if (!wrap) return;
    await (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap);
    if (navigator.keyboard && navigator.keyboard.lock) {
      try { await navigator.keyboard.lock(['Escape']); } catch (e) {}
    }
  });
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && navigator.keyboard && navigator.keyboard.unlock) {
      navigator.keyboard.unlock();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.fullscreenElement) {
      showToast('ESC를 길게 눌러 전체화면을 해제합니다.');
    }
  });
})();
