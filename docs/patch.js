(function () {
  'use strict';

  var DATA = window.SUIKO_PATCHES || {};
  var input = document.getElementById('file');
  var drop = document.getElementById('drop');
  var list = document.getElementById('results');
  var patchCache = {};
  var urls = [];

  function hex(n) { return ('00000000' + n.toString(16)).slice(-8); }

  function inflate(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  function patchFor(name) {
    if (!patchCache[name]) patchCache[name] = inflate(DATA[name].gz);
    return patchCache[name];
  }

  function row(name) {
    var li = document.createElement('li');
    var title = document.createElement('div');
    title.className = 'name';
    title.textContent = name;
    var msg = document.createElement('div');
    li.appendChild(title);
    li.appendChild(msg);
    list.appendChild(li);
    return { li: li, msg: msg };
  }

  function fail(r, text) {
    r.msg.className = 'bad';
    r.msg.textContent = text;
  }

  function target(file) {
    var names = Object.keys(DATA);
    for (var i = 0; i < names.length; i++) {
      var meta = DATA[names[i]];
      if (file.size === meta.size || file.size === meta.outSize) return names[i];
      for (var v = 0; v < meta.variants.length; v++) if (file.size === meta.variants[v].size) return names[i];
    }
    return null;
  }

  function handle(file) {
    var name = target(file);
    var r = row(file.name);
    var meta = DATA[name];
    if (!meta) {
      fail(r, '정식판의 HWANSE.EXE·GENSE.FLD와 크기가 다릅니다 (크기 ' + file.size.toLocaleString() + 'B). 원본은 ' +
        Object.keys(DATA).map(function (n) { return n + ' ' + DATA[n].size.toLocaleString() + 'B'; }).join(', ') + '입니다.');
      return Promise.resolve();
    }
    r.msg.textContent = '확인하는 중…';
    return Promise.all([file.arrayBuffer(), patchFor(name)]).then(function (got) {
      var res = window.SuikoPatch.apply(new Uint8Array(got[0]), got[1], meta.variants);
      if (res.error === 'already') return fail(r, '이미 패치가 적용된 ' + name + '입니다.');
      if (res.error === 'source') {
        if (res.size === meta.outSize) return fail(r, '다른 버전의 패치가 적용된 ' + name + '로 보입니다. 정식판 원본 파일을 넣어 주세요.');
        return fail(r, name + '와 크기는 같지만 정식판 원본이 아닙니다 (CRC ' + hex(res.crc) +
          '). 원본의 CRC는 ' + hex(meta.crc) + '입니다.');
      }
      if (res.error === 'variant') return fail(r, '알려진 수정본을 원본으로 되돌리지 못했습니다.');
      if (!res.out) return fail(r, '패치를 적용하지 못했습니다.');
      var url = URL.createObjectURL(new Blob([res.out], { type: 'application/octet-stream' }));
      urls.push(url);
      r.msg.textContent = (res.variant ? name + '의 알려진 수정본이라 원본으로 되돌린 뒤 패치를 적용했습니다. ' : name + ' 원본에 패치를 적용했습니다. ') +
        '내려받아 게임 폴더에 넣으세요.';
      var a = document.createElement('a');
      a.className = 'save';
      a.href = url;
      a.download = name;
      a.textContent = name + ' 내려받기';
      r.li.appendChild(a);
    }).catch(function () {
      fail(r, '파일을 처리하지 못했습니다. 최신 브라우저에서 다시 시도해 주세요.');
    });
  }

  function take(files) {
    urls.forEach(function (u) { URL.revokeObjectURL(u); });
    urls = [];
    list.textContent = '';
    if (typeof DecompressionStream === 'undefined') {
      fail(row('브라우저'), '이 브라우저는 지원하지 않습니다. 최신 Chrome·Edge·Firefox·Safari에서 열어 주세요.');
      return;
    }
    Array.prototype.forEach.call(files, handle);
  }

  input.addEventListener('change', function () {
    if (input.files.length) take(input.files);
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    drop.addEventListener(t, function () { drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) take(e.dataTransfer.files);
  });
})();
