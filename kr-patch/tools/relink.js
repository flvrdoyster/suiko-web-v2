#!/usr/bin/env node
// relink.js — standalone tool to fix individual KR<->JP dialogue correspondence
// (translation.json's `jp`/`jpOffset` fields), separate from the main editor.js/editor.html.
//
// Why separate: the anchor-cascade linking UI was removed from the main editor once jp/
// jpOffset got baked once and treated as settled (see NOTES.md "KR↔JP 매칭"). But the
// cascade's linear interpolation between kr-jp-links.json anchors can still be wrong in
// spots where the game reuses a generic scene at multiple points whose relative KR/JP
// occurrence order differs (confirmed: 13 anchor pairs are non-monotonic in JP offset,
// ~745 KR lines sit in those interpolated gaps) — this tool is for fixing those spot
// cases by hand, not for resurrecting the full cascade system.
//
// Usage: node kr-patch/tools/relink.js [port]  (default 8183, separate from editor.js's 8182)
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const TRANS_PATH = path.join(__dirname, '../translation/translation.json');
const JP_REF_PATH = path.join(__dirname, '../translation/jp-reference.json');
const HTML_PATH = path.join(__dirname, 'relink.html');

const PORT = parseInt(process.argv[2], 10) || 8183;

function loadTranslation() {
  return JSON.parse(fs.readFileSync(TRANS_PATH, 'utf8'));
}
function saveTranslation(t) {
  const tmp = TRANS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(t, null, 2));
  fs.renameSync(tmp, TRANS_PATH);
}
function loadJpReference() {
  const j = JSON.parse(fs.readFileSync(JP_REF_PATH, 'utf8'));
  return j.dialogue || j;
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

    // Full KR dialogue array — used only to look up/display the entry being relinked
    // (search box works against this too, so a reviewer can find the KR row by text).
    if (req.method === 'GET' && url.pathname === '/api/kr-dialogue') {
      return send(res, 200, loadTranslation().dialogue);
    }

    // Full JP reference array — the candidate pool a KR entry gets relinked against.
    if (req.method === 'GET' && url.pathname === '/api/jp-reference') {
      return send(res, 200, loadJpReference());
    }

    // Apply a corrected link for one KR dialogue offset. Looks the JP text up by offset
    // (not trusted from the client) so what gets written always matches an entry that
    // actually exists in jp-reference.json.
    if (req.method === 'POST' && url.pathname === '/api/relink') {
      const body = JSON.parse(await readBody(req));
      const { offset, jpOffset } = body;
      if (typeof offset !== 'number' || typeof jpOffset !== 'number') {
        return send(res, 400, { error: 'offset, jpOffset(둘 다 number) 필요' });
      }
      const t = loadTranslation();
      const entry = t.dialogue.find((e) => e.offset === offset);
      if (!entry) return send(res, 404, { error: 'KR entry not found' });
      const jpList = loadJpReference();
      const jpEntry = jpList.find((e) => e.offset === jpOffset);
      if (!jpEntry) return send(res, 404, { error: 'JP entry not found' });
      entry.jp = jpEntry.text;
      entry.jpOffset = jpEntry.offset;
      saveTranslation(t);
      return send(res, 200, { ok: true, jp: entry.jp, jpOffset: entry.jpOffset });
    }

    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: String((e && e.stack) || e) });
  }
});

server.listen(PORT, () => {
  console.log(`kr-patch relink tool: http://localhost:${PORT}`);
});
