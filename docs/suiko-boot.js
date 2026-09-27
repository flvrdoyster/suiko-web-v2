(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }

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
    if (stickyMsg) { showToast(stickyMsg, 0); return; }
    toastEl.classList.remove('visible');
  }
  function setSticky(msg) {
    stickyMsg = msg;
    if (msg) showToast(msg, 0); else hideToast();
  }
  window.showToast = showToast;

  var overlay = $('overlay');
  var start = $('btn-start');
  var cover = $('boot-cover');
  var blink = $('boot-blink');

  var BLINK_SRC = [null, 'img/splash-blink-1.png', 'img/splash-blink-2.png'];
  var blinkTimer = null;
  BLINK_SRC.forEach(function (s) { if (s) { var im = new Image(); im.src = s; } });
  function setBlinkFrame(f) {
    if (!blink) return;
    if (f === 0) { blink.hidden = true; }
    else { blink.src = BLINK_SRC[f]; blink.hidden = false; }
  }
  function playBlink() {
    var seq = [1, 2, 1, 0], i = 0;
    (function step() {
      setBlinkFrame(seq[i++]);
      if (i < seq.length) blinkTimer = setTimeout(step, 90);
      else blinkTimer = setTimeout(playBlink, 2200 + Math.random() * 2200);
    })();
  }
  function startBlink() { if (blink) blinkTimer = setTimeout(playBlink, 1500); }
  function stopBlink() { clearTimeout(blinkTimer); setBlinkFrame(0); }

  function engineReady() {
    return window.myApp && myApp.rivetsData && !myApp.rivetsData.moduleInitializing;
  }

  function sampleFraction(match) {
    var buf = window.myApp && myApp.rgbaDestination;
    if (!buf || !buf.length) return -1;
    var hit = 0, n = 0;
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
      if (window.SuikoMidi && SuikoMidi.open) SuikoMidi.open();
      myApp.loadRom(true);

      if (!cover) {
        hideToast();
        overlay.classList.add('hidden');
        return;
      }
      start.hidden = true;
      cover.hidden = false;
      startBlink();
      setSticky('게임을 실행하고 있습니다.');
      var revealed = false;
      function reveal() {
        if (revealed) return;
        revealed = true;
        clearInterval(watch);
        stopBlink();
        setSticky(null);
        overlay.classList.add('hidden');
      }
      var sawDesktop = false;
      var watch = setInterval(function () {
        var frac = startFraction();
        if (frac < 0) return;
        if (!sawDesktop) {
          if (frac >= 0.30) { sawDesktop = true; console.log('[suiko-boot] Win95 desktop detected'); }
        } else if (frac <= 0.10) {
          console.log('[suiko-boot] game covering desktop -> reveal');
          clearInterval(watch);
          setTimeout(reveal, 600);
          watchGameExit();
        }
      }, 250);
      setTimeout(reveal, 90000);

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
          overlay.classList.remove('hidden');
          showToast('게임이 종료되어 에뮬레이션을 정지했습니다.', 0);
          setTimeout(function () {
            showToast('다시 플레이하려면 새로고침하세요.', 0);
          }, 5000);
        }, 250);
      }
    });
  }

  var fs = $('btn-fullscreen');
  if (fs) fs.addEventListener('click', async function () {
    var wrap = $('canvasDiv');
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
