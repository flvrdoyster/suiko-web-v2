#!/usr/bin/env node
// editor.js — local web editor for kr-patch/translation/translation.json.
//
// Usage: node kr-patch/tools/editor.js [port]
// Then open http://localhost:<port> (default 8182).
//
// Serves the whole translation.json to the browser once; all browsing/filtering happens
// client-side (editor.html). Edits are saved one entry at a time via POST /api/save,
// which re-validates the byte-length constraint (kr-patch/docs/NOTES.md's "길이 변경은
// 안전하지 않다" policy) server-side before persisting, so a bad edit can't silently land
// in translation.json even if the client-side check is bypassed.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const TRANS_PATH = path.join(__dirname, '../translation/translation.json');
const JP_REF_PATH = path.join(__dirname, '../translation/jp-reference.json');
const HTML_PATH = path.join(__dirname, 'editor.html');

const HWANSE_TEXT = require('./hwanse-text.js');
const HWANSE_NAMES = require('./hwanse-names.js');
const HWANSE_FONT = require('./hwanse-font.js');

const PORT = parseInt(process.argv[2], 10) || 8182;

function loadTranslation() {
  return JSON.parse(fs.readFileSync(TRANS_PATH, 'utf8'));
}
function saveTranslation(t) {
  const tmp = TRANS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(t, null, 2));
  fs.renameSync(tmp, TRANS_PATH);
}

// Returns the byte length a `fixed` replacement must fit within for a given section/entry.
// 'fonts' is a fixed-size NUL-padded buffer (LOGFONT lfFaceName) — a shorter name is fine,
// it just needs to fit; 'dialogue'/'labels' are byte-length-exact slots (see padToFit()).
function requiredLength(section, entry) {
  return section === 'fonts' ? entry.maxLength : entry.length;
}

function encodeFor(section, text) {
  const encode = section === 'labels' ? HWANSE_NAMES.encodeCp949
    : section === 'fonts' ? HWANSE_FONT.encodeCp949
    : HWANSE_TEXT.encodeCp949;
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

let jpRef = null;
function getJpRef() {
  if (!jpRef) jpRef = JSON.parse(fs.readFileSync(JP_REF_PATH, 'utf8'));
  return jpRef;
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

    if (req.method === 'GET' && url.pathname === '/api/jp-search') {
      const q = url.searchParams.get('q') || '';
      const context = parseInt(url.searchParams.get('context'), 10) || 2;
      const ref = getJpRef();
      const entries = ref.dialogue;
      const hits = [];
      entries.forEach((e, i) => {
        if (q && e.text.includes(q)) hits.push(i);
      });
      const results = hits.slice(0, 50).map((i) => {
        const lo = Math.max(0, i - context);
        const hi = Math.min(entries.length - 1, i + context);
        const lines = [];
        for (let k = lo; k <= hi; k++) lines.push({ index: k, text: entries[k].text, isMatch: k === i });
        return { index: i, offset: entries[i].offset, lines };
      });
      const labelHits = q ? ref.labels.filter((e) => e.text.includes(q)) : [];
      return send(res, 200, { total: hits.length, results, labelHits: labelHits.slice(0, 50) });
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

      for (const edit of edits) {
        const { key, section, offset } = edit;
        if (!['dialogue', 'labels', 'fonts'].includes(section)) {
          results[key] = { ok: false, error: 'bad section' };
          continue;
        }
        const entry = (t[section] || []).find((e) => e.offset === offset);
        if (!entry) {
          results[key] = { ok: false, error: 'entry not found' };
          continue;
        }
        let toSave = edit.fixed || '';
        if (toSave) {
          const need = requiredLength(section, entry);
          toSave = padToFit(section, toSave, need);
          const got = encodeFor(section, toSave).length;
          // 'fonts' just needs to fit the fixed NUL-padded buffer; everything else must
          // match the slot exactly (see requiredLength()/padToFit()).
          const okLen = section === 'fonts' ? got <= need : got === need;
          if (!okLen) {
            results[key] = { ok: false, error: `byte ${got}/${need}`, need, got };
            continue;
          }
        }
        entry.fixed = toSave;
        results[key] = { ok: true, fixed: toSave };
        anyApplied = true;
      }

      if (anyApplied) saveTranslation(t);
      return send(res, 200, { results });
    }

    // Toggle the "reviewed, no change needed" flag on one entry. This is a lightweight
    // per-row action (a bool, no byte validation), so it persists immediately rather than
    // going through the batched text-edit save above. Only meaningful when `fixed` is
    // empty (the UI hides the button otherwise) but we don't enforce that server-side.
    if (req.method === 'POST' && url.pathname === '/api/confirm') {
      const body = JSON.parse(await readBody(req));
      const { section, offset, confirmed } = body;
      if (!['dialogue', 'labels', 'fonts'].includes(section)) {
        return send(res, 400, { error: 'bad section' });
      }
      const t = loadTranslation();
      const entry = (t[section] || []).find((e) => e.offset === offset);
      if (!entry) return send(res, 404, { error: 'entry not found' });
      entry.confirmed = !!confirmed;
      saveTranslation(t);
      return send(res, 200, { ok: true, confirmed: entry.confirmed });
    }

    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: String(e && e.stack || e) });
  }
});

server.listen(PORT, () => {
  console.log(`kr-patch editor: http://localhost:${PORT}`);
});
