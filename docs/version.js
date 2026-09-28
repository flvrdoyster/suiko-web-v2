(function () {
  var VERSION = 'v1.1.5';

  function inject() {
    if (document.querySelector('.site-version')) return true;
    var credits = document.querySelector('#footer .footer-credits');
    if (!credits) return false;
    var sep = document.createElement('span');
    sep.className = 'footer-sep';
    sep.textContent = ' · ';
    var v = document.createElement('span');
    v.className = 'site-version';
    v.textContent = VERSION;
    credits.appendChild(sep);
    credits.appendChild(v);
    return true;
  }

  var tries = 0;
  var timer = setInterval(function () {
    if (inject() || ++tries > 40) clearInterval(timer);
  }, 100);
})();
