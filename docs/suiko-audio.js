// suiko-web-v2 audio glue — same #btn-mute contract as gensei-pc98's audio.js.
//
// Mute goes through GAIN, not AudioContext.suspend()/resume(): browsers can silently
// auto-resume a suspended context on the next user gesture (they don't distinguish
// "the app paused this" from "autoplay policy paused this"), so suspend()-based mute
// unmutes itself the moment the player touches a control. Setting gain to 0 keeps the
// context running (audio processing, doswasmx's game logic timing, etc. unaffected)
// while producing silence, and nothing auto-undoes it.
//
// Two pipelines to mute together: doswasmx's own game audio (myApp.gainNode) and the
// separate SC-55 MIDI synth's output (window.SuikoMidi.getGain()).
(function () {
  'use strict';

  var muted = false;

  function gains() {
    var list = [];
    if (window.myApp && myApp.gainNode) list.push(myApp.gainNode);
    if (window.SuikoMidi && SuikoMidi.getGain && SuikoMidi.getGain()) list.push(SuikoMidi.getGain());
    return list;
  }

  function applyMute() {
    gains().forEach(function (g) { g.gain.value = muted ? 0 : 1; });
  }

  // Audio still needs a user gesture to leave the browser's autoplay-blocked state at
  // least once; that's a one-time unlock, separate from our own mute state.
  function unlockAudioContexts() {
    if (window.myApp && myApp.audioContext && myApp.audioContext.state === 'suspended') myApp.audioContext.resume();
    if (window.SuikoMidi && SuikoMidi.getGain && SuikoMidi.getGain()) {
      var ctx = SuikoMidi.getGain().context;
      if (ctx && ctx.state === 'suspended') ctx.resume();
    }
  }

  var muteShown = false;
  function showMuteButton() {
    if (muteShown) return;
    var btn = document.getElementById('btn-mute');
    if (btn && gains().length) { btn.style.display = ''; muteShown = true; applyMute(); }
  }

  window.resumeAudio = function () {
    unlockAudioContexts();
    showMuteButton();
  };

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) resumeAudio();
  });
  document.addEventListener('click', resumeAudio);
  document.addEventListener('keydown', resumeAudio);

  function initMute() {
    var btn = document.getElementById('btn-mute');
    if (!btn) return;
    var SVG_ON = '<svg viewBox="0 0 49.13 70.14" height="22"><path fill="currentColor" d="M7.43,68.29c-2.31-1.26-4.13-3.01-5.45-5.25s-1.98-4.77-1.98-7.58.65-5.41,1.96-7.62c1.3-2.21,3.12-3.93,5.45-5.14,2.33-1.22,4.96-1.82,7.89-1.82s5.45.59,7.73,1.76l-.09-42.63h26.19v14.77h-18.72v40.69c0,2.81-.65,5.34-1.96,7.58-1.3,2.24-3.1,3.99-5.38,5.25s-4.88,1.87-7.78,1.85c-2.93.03-5.55-.59-7.87-1.85Z"/></svg>';
    var SVG_OFF = '<svg viewBox="0 0 56.02 70.14" height="22"><rect fill="currentColor" x="26.51" y="-3.04" width="3" height="76.23" transform="translate(-16.59 30.08) rotate(-45)"/><polygon fill="currentColor" points="33.86 35.68 33.86 14.77 52.58 14.77 52.58 0 26.38 0 26.44 28.27 33.86 35.68"/><path fill="currentColor" d="M26.47,42.63c-2.29-1.17-4.86-1.76-7.73-1.76s-5.56.61-7.89,1.82c-2.33,1.22-4.15,2.93-5.45,5.14-1.3,2.21-1.96,4.75-1.96,7.62s.66,5.34,1.98,7.58,3.13,3.99,5.45,5.25c2.31,1.26,4.94,1.87,7.87,1.85,2.9.03,5.49-.59,7.78-1.85s4.08-3.01,5.38-5.25c1.3-2.24,1.96-4.77,1.96-7.58v-9.12l-7.39-7.39v3.68Z"/></svg>';
    btn.addEventListener('click', function () {
      muted = !muted;
      btn.innerHTML = muted ? SVG_OFF : SVG_ON;
      applyMute();
      btn.blur();
    });
  }

  document.addEventListener('DOMContentLoaded', initMute);
})();
