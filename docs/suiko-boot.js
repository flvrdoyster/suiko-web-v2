// suiko-web-v2 boot glue — wires the start overlay + top-bar buttons to the doswasmx
// engine. gamepad.js (based on gensei-pc98's, with Z/X/C key bindings for this game's
// actual controls instead of Enter/Escape) handles the virtual gamepad, mobile
// auto-activation, and the top-bar collapse button already.
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
  //
  // A "sticky" message (setSticky) is the background the toast falls back to: transient
  // toasts still show and take priority, but when one auto-hides we restore the sticky
  // instead of clearing the bar. Used during the boot splash so incidental toasts (save
  // restored, MIDI loading) don't wipe out the persistent "게임을 실행하고 있습니다." line.
  var toastEl = $('toast');
  var toastTimer = null;
  var stickyMsg = null;
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
    if (stickyMsg) { showToast(stickyMsg, 0); return; } // fall back to the sticky line
    toastEl.classList.remove('visible');
  }
  function setSticky(msg) { // null clears it
    stickyMsg = msg;
    if (msg) showToast(msg, 0); else hideToast();
  }
  window.showToast = showToast;

  var overlay = $('overlay');
  var start = $('btn-start');
  var cover = $('boot-cover');
  var blink = $('boot-blink');

  // ---- splash eye-blink ----
  // The face overlay cycles rest(0)→half(1)→closed(2)→half(1)→rest(0). Frame 0 is the
  // base splash's own open eyes (overlay hidden); 1 and 2 are the blink PNGs. We play a
  // quick blink, then idle a couple seconds, and repeat until the cover lifts.
  var BLINK_SRC = [null, 'img/splash-blink-1.png', 'img/splash-blink-2.png'];
  var blinkTimer = null;
  BLINK_SRC.forEach(function (s) { if (s) { var im = new Image(); im.src = s; } }); // preload
  function setBlinkFrame(f) {
    if (!blink) return;
    if (f === 0) { blink.hidden = true; }
    else { blink.src = BLINK_SRC[f]; blink.hidden = false; }
  }
  function playBlink() {
    var seq = [1, 2, 1, 0], i = 0; // resting state (0) is where we start/end
    (function step() {
      setBlinkFrame(seq[i++]);
      if (i < seq.length) blinkTimer = setTimeout(step, 90);
      else blinkTimer = setTimeout(playBlink, 2200 + Math.random() * 2200); // idle, then blink again
    })();
  }
  function startBlink() { if (blink) blinkTimer = setTimeout(playBlink, 1500); }
  function stopBlink() { clearTimeout(blinkTimer); setBlinkFrame(0); }

  function engineReady() {
    return window.myApp && myApp.rivetsData && !myApp.rivetsData.moduleInitializing;
  }

  // ---- game-start/exit detection (canvas pixels) ----
  // Trying to observe boot from inside the guest (a flag file written by Win95) proved
  // unworkable — Win95's WIN.INI run=/load= + PIF quirks and disk write-back caching made
  // it unreliable. Instead we watch what's actually on screen: the emulator writes every
  // frame's RGBA into myApp.rgbaDestination before painting it, so we can read pixels
  // straight from there (no disk, no canvas contention, guest-agnostic).
  //
  // The Win95 desktop used to be the default teal (0,128,128), but the game's own screens
  // hit that same range often enough that watching for it *re-appearing* (to detect the
  // player quitting to the desktop) false-triggered mid-play and paused a live session.
  // Fixed at the source rather than in the detector: the shared disk image's desktop
  // background is now a fully saturated, off-palette pure cyan (0,255,255), set through
  // Display Properties and baked into docs/final-shared.img (2026-08). Game art doesn't
  // use flat fully-saturated cyan, so it's a far cleaner signal than the default ever was.
  //
  // ⚠ This script and final-shared.img are separate files with independent cache lifetimes
  // (both max-age=600 on Pages), so a client can briefly hold one new and one old. That
  // desync is why the two detections below use *different* color tests:
  //
  //   startFraction() — teal OR cyan. Tolerant on purpose. A false positive here is
  //     harmless (one-shot at boot, worst case the cover lifts a moment early), while a
  //     false negative strands the player on the splash until the 90s failsafe. Accepting
  //     the old color too means a new script + stale old image still boots correctly.
  //   exitFraction() — cyan only. Strict, because this is where a false positive actually
  //     hurts: it pauses a live session. With a stale old (teal) image this simply never
  //     fires — auto-stop is quietly unavailable, which is a harmless degradation.
  //
  // (The reverse skew — an old cached script against the new image — can't be fixed from
  // here, and resolves itself once the 10-minute cache window lapses.)
  function sampleFraction(match) {
    var buf = window.myApp && myApp.rgbaDestination;
    if (!buf || !buf.length) return -1;
    var hit = 0, n = 0;
    // ~3000 samples is plenty and cheap; step in whole pixels (4 bytes).
    var step = Math.max(1, Math.floor(buf.length / 4 / 3000)) * 4;
    for (var i = 0; i + 2 < buf.length; i += step) {
      n++;
      if (match(buf[i], buf[i + 1], buf[i + 2])) hit++;
    }
    return n ? hit / n : -1;
  }
  function isCyan(r, g, b) { return r < 48 && g > 200 && b > 200; }
  function isTeal(r, g, b) { return r < 48 && g > 80 && g < 176 && b > 80 && b < 176; }
  function startFraction() {
    return sampleFraction(function (r, g, b) { return isCyan(r, g, b) || isTeal(r, g, b); });
  }
  function exitFraction() { return sampleFraction(isCyan); }

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
      myApp.loadRom(true); // boot Win95 + auto-launch the game

      if (!cover) { // no splash image on this page: old behavior, show the boot as-is
        hideToast();
        overlay.classList.add('hidden');
        return;
      }
      // Swap the start button for the splash image and keep the overlay covering the
      // canvas through the whole DOS→Win95 boot; reveal once the game covers the desktop.
      start.hidden = true;
      cover.hidden = false;
      startBlink();
      // sticky: stays under any incidental boot toasts and persists until the splash lifts
      setSticky('게임을 실행하고 있습니다.');
      var revealed = false;
      function reveal() {
        if (revealed) return;
        revealed = true;
        clearInterval(watch);
        stopBlink();
        setSticky(null); // drop the sticky and clear the bar as the cover lifts
        overlay.classList.add('hidden');
      }
      var sawDesktop = false;
      var watch = setInterval(function () {
        var frac = startFraction(); // tolerant: teal OR cyan — see the comment above
        if (frac < 0) return; // no frame yet
        if (!sawDesktop) {
          if (frac >= 0.30) { sawDesktop = true; console.log('[suiko-boot] Win95 desktop detected'); }
        } else if (frac <= 0.10) {
          console.log('[suiko-boot] game covering desktop -> reveal');
          clearInterval(watch);
          setTimeout(reveal, 600); // let the first game frame settle
          watchGameExit();
        }
      }, 250);
      // failsafe: if detection never fires, don't leave the cover stuck forever
      setTimeout(reveal, 90000);

      // ---- game-exit detection (mirror of the above) ----
      // Once the game has covered the desktop, watch for the cyan fraction rising back up —
      // the player quit the game and Win95 is showing its desktop again. Same 250ms cadence
      // as the boot watch above; still needs 2 consecutive high samples (~500ms) so a
      // one-frame flicker doesn't false-trigger a stop mid-play. Strictly cyan (never teal):
      // this is the detection that used to false-trigger on the default teal during real
      // gameplay, and a false positive here pauses a live session — see the color note above.
      function watchGameExit() {
        var highStreak = 0;
        var watchExit = setInterval(function () {
          var frac = exitFraction();
          if (frac < 0) return;
          if (frac < 0.30) { highStreak = 0; return; }
          if (++highStreak < 2) return;
          clearInterval(watchExit);
          console.log('[suiko-boot] desktop reappeared -> stopping emulation');
          Module._neil_toggle_pause();
          // cover는 시작 클릭 때 이미 hidden=false로 켜둔 채 안 꺼서, overlay만 다시
          // 보이면 그 스플래시 이미지가 뜬다(정지된 데스크톱 대신 첫 화면처럼 보임).
          overlay.classList.remove('hidden');
          showToast('게임이 종료되어 에뮬레이션을 정지했습니다. 다시 플레이하려면 새로고침하세요.', 0);
        }, 250);
      }
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
