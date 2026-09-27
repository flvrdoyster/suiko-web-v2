#!/usr/bin/env node
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

    if (req.method === 'GET' && url.pathname === '/api/kr-dialogue') {
      return send(res, 200, loadTranslation().dialogue);
    }

    if (req.method === 'GET' && url.pathname === '/api/jp-reference') {
      return send(res, 200, loadJpReference());
    }

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
