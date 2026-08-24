#!/usr/bin/env node
// editor.js — local web editor for kr-patch/translation/translation.json.
//
// Usage: node kr-patch/tools/editor.js [port]
// Then open http://localhost:<port> (default 8182).
//
// Serves the whole translation.json to the browser once; all browsing/filtering happens
// client-side (editor.html). Edits are saved one entry at a time via POST /api/save,
// which re-validates the byte-length constraint (NOTES.md's "길이 변경은
// 안전하지 않다" policy) server-side before persisting, so a bad edit can't silently land
// in translation.json even if the client-side check is bypassed.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const TRANS_PATH = path.join(__dirname, '../translation/translation.json');
const TRANS_REL = 'kr-patch/translation/translation.json';
const BOOKMARK_PATH = path.join(__dirname, '../translation/bookmark.json');
const FINDINGS_PATH = path.join(__dirname, '../translation/review-findings.json');
const BUILD_JS = path.join(__dirname, 'build.js');
const INJECT_JS = path.join(__dirname, 'inject.js');
const BUILD_IMG = path.join(ROOT, 'kr-patch/build/final-shared.img');
const DOCS_IMG = path.join(ROOT, 'docs/final-shared.img');
const HTML_PATH = path.join(__dirname, 'editor.html');

const HWANSE_TEXT = require('./hwanse-text.js');
const HWANSE_NAMES = require('./hwanse-names.js');

const PORT = parseInt(process.argv[2], 10) || 8182;

function loadTranslation() {
  return JSON.parse(fs.readFileSync(TRANS_PATH, 'utf8'));
}
function saveTranslation(t) {
  const tmp = TRANS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(t, null, 2));
  fs.renameSync(tmp, TRANS_PATH);
}

// Single-slot "bookmark" — a KR dialogue offset the reviewer explicitly marks (see POST
// /api/bookmark below), so they can pick up where they left off across a non-linear review
// pass without it being tied to whatever row happened to be edited/focused last.
function loadBookmark() {
  if (!fs.existsSync(BOOKMARK_PATH)) return null;
  const v = JSON.parse(fs.readFileSync(BOOKMARK_PATH, 'utf8')).offset;
  return typeof v === 'number' ? v : null;
}
function saveBookmark(offset) {
  fs.writeFileSync(BOOKMARK_PATH, JSON.stringify({ offset }, null, 2));
}

// Returns the byte length a `fixed` replacement must fit within for a given section/entry —
// 'dialogue'/'labels' are byte-length-exact slots (see padToFit()).
function requiredLength(section, entry) {
  return entry.length;
}

function encodeFor(section, text) {
  const encode = section === 'labels' ? HWANSE_NAMES.encodeCp949 : HWANSE_TEXT.encodeCp949;
  return encode(text);
}

// 'labels' entries commonly include trailing full-width-space slot padding as part of
// their captured `text` (see hwanse-names.js) — a reviewer editing the visible name isn't
// expected to retype that padding by hand, so pad a shorter replacement back out with '　'
// (U+3000, 2 bytes) to refill the slot. 'dialogue' entries have no such padding concept
// ('@'-terminated, not slot-based), so those still require an exact-length match. If the
// shortfall is an odd number of bytes, whole '　' characters can't fill it exactly — leave
// the text as-is and let the normal length check reject it with a clear error instead of
// silently returning something that's still one byte off.
function padToFit(section, text, need) {
  if (section !== 'labels') return text;
  const shortfall = need - encodeFor(section, text).length;
  if (shortfall <= 0 || shortfall % 2 !== 0) return text;
  return text + '　'.repeat(shortfall / 2);
}

// Per-section count of entries whose `fixed` value differs from the last-committed
// (HEAD) translation.json, for the deploy commit body ("바뀐 내용 개수"). Returns null if
// HEAD has no translation.json (e.g. very first commit) — deploy falls back to no counts.
function countChangedFixed() {
  let headRaw;
  try {
    headRaw = execFileSync('git', ['show', `HEAD:${TRANS_REL}`], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    return null;
  }
  const head = JSON.parse(headRaw);
  const current = loadTranslation();
  const counts = {};
  for (const section of ['dialogue', 'labels']) {
    const headMap = new Map((head[section] || []).map((e) => [e.offset, e.fixed || '']));
    counts[section] = (current[section] || []).reduce(
      (n, e) => n + ((e.fixed || '') !== (headMap.get(e.offset) || '') ? 1 : 0), 0);
  }
  return counts;
}

function send(res, status, body, contentType) {
  res.writeHead(status, { 'Content-Type': contentType || 'application/json; charset=utf-8' });
  const raw = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.end(raw);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, fs.readFileSync(HTML_PATH), 'text/html; charset=utf-8');
    }

    if (req.method === 'GET' && url.pathname === '/api/translation') {
      return send(res, 200, loadTranslation());
    }

    if (req.method === 'GET' && url.pathname === '/api/bookmark') {
      return send(res, 200, { offset: loadBookmark() });
    }

    // Rubric-driven LLM review pass results (offset/category/reason per flagged line) — see
    // NOTES.md. Static reference data, not edited through the UI; missing file (before the
    // review has been run) just means the dropdown filter's AI options find nothing.
    if (req.method === 'GET' && url.pathname === '/api/findings') {
      if (!fs.existsSync(FINDINGS_PATH)) return send(res, 200, []);
      return send(res, 200, JSON.parse(fs.readFileSync(FINDINGS_PATH, 'utf8')));
    }

    // Batch save (PC98-style): the client accumulates edits and sends them all at once.
    // Each edit is { key ("section:offset"), section, offset, fixed }. Every edit is
    // validated (and label-padded) individually; valid ones are applied and the file is
    // written once, invalid ones are reported back per-key so the client can flag those
    // rows without losing the rest. A single bad edit never blocks the good ones.
    if (req.method === 'POST' && url.pathname === '/api/save') {
      const body = JSON.parse(await readBody(req));
      const edits = Array.isArray(body.edits) ? body.edits : [];
      const t = loadTranslation();
      const results = {};
      let anyApplied = false;
      const priorFixed = new Map(); // 단위 합계 검사에서 되돌릴 때 쓸 저장 전 값

      for (const edit of edits) {
        const { key, section, offset } = edit;
        if (!['dialogue', 'labels'].includes(section)) {
          results[key] = { ok: false, error: 'bad section' };
          continue;
        }
        const entry = (t[section] || []).find((e) => e.offset === offset);
        if (!entry) {
          results[key] = { ok: false, error: 'entry not found' };
          continue;
        }
        let toSave = edit.fixed || '';
        // 포인터 테이블 구간(`table`)은 줄 단위가 아니라 **단위 합계**로 검사한다 — 아래에서
        // 편집을 다 반영한 뒤 한 번에 본다. 여기서는 인코딩 가능 여부만 확인하고 통과시킨다.
        const unitChecked = section === 'dialogue' && entry.table != null;
        if (toSave) {
          const need = requiredLength(section, entry);
          // encodeCp949는 매핑 없는 문자를 만나면 던진다 — 그대로 올리면 배치 전체가 500으로
          // 죽으므로, 이 편집만 실패로 기록하고 나머지는 계속 처리한다.
          let got;
          try {
            toSave = padToFit(section, toSave, need);
            got = encodeFor(section, toSave).length;
          } catch (err) {
            results[key] = { ok: false, error: String(err.message || err) };
            continue;
          }
          if (!unitChecked && got !== need) {
            results[key] = { ok: false, error: `byte ${got}/${need}`, need, got };
            continue;
          }
        }
        if (unitChecked) priorFixed.set(key, entry.fixed || '');
        entry.fixed = toSave;
        results[key] = { ok: true, fixed: toSave, unit: unitChecked || undefined };
        anyApplied = true;
      }

      // 단위 합계 검사: 위에서 통과시킨 테이블 구간 편집들을 반영한 상태로 각 단위의 합을 잰다.
      // 안 맞으면 그 단위에 걸린 편집을 전부 되돌린다 — 한 줄만 롤백하면 남은 편집이 여전히
      // 합계를 깨뜨린 채로 저장돼, 다음 빌드가 통째로 실패한다.
      const touchedUnits = new Map(); // 단위 첫 줄 offset -> { lines, keys }
      const dialogueSorted = (t.dialogue || []).slice().sort((a, b) => a.offset - b.offset);
      const editedOffsets = new Set(edits
        .filter((x) => x.section === 'dialogue' && results[x.key] && results[x.key].unit)
        .map((x) => x.offset));
      if (editedOffsets.size) {
        for (const unit of HWANSE_TEXT.tableUnits(dialogueSorted.filter((e) => e.table != null))) {
          const keys = unit.filter((e) => editedOffsets.has(e.offset))
            .map((e) => `dialogue:${e.offset}`);
          if (keys.length) touchedUnits.set(unit[0].offset, { lines: unit, keys });
        }
      }
      // 테이블 구간 전체에서 하나뿐인 실측 상한 — hwanse-text.js의 computeLineCap() 주석 참고.
      const cap = HWANSE_TEXT.computeLineCap(dialogueSorted.filter((e) => e.table != null));
      for (const [unitOffset, { lines, keys }] of touchedUnits) {
        // 두 조건을 같이 본다: ①단위 합계가 원본과 같은가(다음 단위 포인터 침범 방지),
        // ②각 줄이 실측 상한 이하인가 — 합계만 보면 한 줄이 옆줄 자리를 다 뺏어 그 줄만
        // 창 폭을 넘어 잘릴 수 있다(hwanse-text.js build() 주석 참고). 둘 중 하나라도
        // 어긋나면 이 단위에 걸린 편집을 전부 되돌린다 — 일부만 롤백하면 남은 편집이
        // 여전히 규칙을 깨뜨린 채 저장돼 다음 빌드가 실패한다.
        const need = lines.reduce((s, e) => s + e.length, 0);
        let got = 0, overCap = null;
        try {
          for (const e of lines) {
            const n = encodeFor('dialogue', e.fixed || e.text).length;
            if (n > cap && !overCap) overCap = { offset: e.offset, n };
            got += n;
          }
        } catch (err) { got = -1; }
        if (got === need && !overCap) continue;
        const reason = overCap
          ? `줄 @${overCap.offset} ${overCap.n}B가 실측 최대 ${cap}B 초과`
          : `단위 합계 byte ${got}/${need}`;
        for (const k of keys) {
          const off = parseInt(k.slice(k.indexOf(':') + 1), 10);
          const e = dialogueSorted.find((x) => x.offset === off);
          if (e) e.fixed = priorFixed.has(k) ? priorFixed.get(k) : '';
          results[k] = { ok: false, error: `${reason} (@${unitOffset}, ${lines.length}줄)`, need, got };
        }
      }
      anyApplied = Object.values(results).some((r) => r.ok);

      if (anyApplied) saveTranslation(t);
      return send(res, 200, { results });
    }

    // Set the bookmark to an explicit offset (see loadBookmark()/saveBookmark() above) —
    // a deliberate per-row action, not tied to editing/saving, since review often jumps
    // around non-linearly and the point of this feature is marking "covered up to here"
    // on demand rather than wherever an edit happened to land.
    if (req.method === 'POST' && url.pathname === '/api/bookmark') {
      const body = JSON.parse(await readBody(req));
      if (typeof body.offset !== 'number') return send(res, 400, { error: 'offset required' });
      saveBookmark(body.offset);
      return send(res, 200, { ok: true, offset: body.offset });
    }

    // Toggle the "reviewed, no change needed" flag on one entry. This is a lightweight
    // per-row action (a bool, no byte validation), so it persists immediately rather than
    // going through the batched text-edit save above. Only meaningful when `fixed` is
    // empty (the UI hides the button otherwise) but we don't enforce that server-side.
    if (req.method === 'POST' && url.pathname === '/api/confirm') {
      const body = JSON.parse(await readBody(req));
      const { section, offset, confirmed } = body;
      if (!['dialogue', 'labels'].includes(section)) {
        return send(res, 400, { error: 'bad section' });
      }
      const t = loadTranslation();
      const entry = (t[section] || []).find((e) => e.offset === offset);
      if (!entry) return send(res, 404, { error: 'entry not found' });
      entry.confirmed = !!confirmed;
      saveTranslation(t);
      return send(res, 200, { ok: true, confirmed: entry.confirmed });
    }

    // Build (translation.json's `fixed` entries -> patched HWANSE.EXE) then inject that
    // exe into a test copy of the shared disk image, in one click (gensei-pc98's editor.py
    // has the same "빌드" button pattern). This only writes kr-patch/build/ (gitignored) —
    // it deliberately does NOT touch docs/final-shared.img, same safety boundary inject.js
    // already documents; promoting the test copy to the live deployed image stays a manual
    // step (`cp kr-patch/build/final-shared.img docs/final-shared.img`).
    if (req.method === 'POST' && url.pathname === '/api/build-inject') {
      let buildOut;
      try {
        buildOut = execFileSync('node', [BUILD_JS], { encoding: 'utf8', timeout: 60000 });
      } catch (e) {
        const out = ((e.stdout || '') + (e.stderr || '')).trim();
        const last = out.split('\n').filter(Boolean).pop() || String(e.message || e);
        return send(res, 200, { ok: false, message: `빌드 실패: ${last}` });
      }
      const m = buildOut.match(/applied: (\d+) dialogue entries, (\d+) label entries/);
      const buildMsg = m
        ? `대사 ${m[1]}건·라벨 ${m[2]}건 반영`
        : buildOut.includes('nothing to do') ? '반영할 항목 없음' : '빌드 완료';

      let injectOut;
      try {
        injectOut = execFileSync('node', [INJECT_JS], { encoding: 'utf8', timeout: 60000 });
      } catch (e) {
        const out = ((e.stdout || '') + (e.stderr || '')).trim();
        const last = out.split('\n').filter(Boolean).pop() || String(e.message || e);
        return send(res, 200, { ok: false, message: `빌드는 완료(${buildMsg}), 삽입 실패: ${last}` });
      }
      const sizeMatch = injectOut.match(/wrote .*\(([\d,]+) bytes gzip\)/);
      const injectMsg = sizeMatch
        ? `삽입 완료 (kr-patch/build/final-shared.img, ${sizeMatch[1]} bytes gzip)`
        : '삽입 완료';

      return send(res, 200, { ok: true, message: `${buildMsg} · ${injectMsg}` });
    }

    // Promote the test image (built by /api/build-inject) to the live deployed asset and
    // commit it, alongside translation.json (the source of the entries that produced it).
    // Does NOT push — pushing stays a separate, explicit step (see NOTES.md's "커밋/푸시는
    // 사용자가 명시적으로 요청할 때만 진행").
    if (req.method === 'POST' && url.pathname === '/api/deploy') {
      if (!fs.existsSync(BUILD_IMG)) {
        return send(res, 200, { ok: false, message: '빌드 및 삽입을 먼저 실행하세요 (kr-patch/build/final-shared.img 없음)' });
      }
      const counts = countChangedFixed();
      fs.copyFileSync(BUILD_IMG, DOCS_IMG);

      try {
        execFileSync('git', ['add', 'docs/final-shared.img', TRANS_REL], { cwd: ROOT });
        const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: ROOT, encoding: 'utf8' }).trim();
        if (!staged) {
          return send(res, 200, { ok: false, message: '변경 사항 없음 — 커밋할 게 없습니다' });
        }
        const body = counts
          ? `대사 ${counts.dialogue}건·라벨 ${counts.labels}건 수정`
          : '';
        const commitArgs = ['commit', '-m', '번역 추가 수정'];
        if (body) commitArgs.push('-m', body);
        execFileSync('git', commitArgs, { cwd: ROOT, encoding: 'utf8' });
        const hash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
        return send(res, 200, { ok: true, message: `배포 완료 — 커밋 ${hash}${body ? ' (' + body + ')' : ''}` });
      } catch (e) {
        const out = ((e.stdout || '') + (e.stderr || '')).trim();
        return send(res, 200, { ok: false, message: `커밋 실패: ${out || e.message}` });
      }
    }

    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: String(e && e.stack || e) });
  }
});

server.listen(PORT, () => {
  console.log(`kr-patch editor: http://localhost:${PORT}`);
});
