// Local preview server for workspace copies. Serves the human review UI on `/`
// (two-panel page: task/diff/actions on the left, the real rendered page in an
// iframe on the right, RATIFY REVIEW bar at the bottom), the raw page without
// any review chrome on `/__page/`, and the parallel queue index on `/review`.
// 127.0.0.1 only. No external assets, no network, zero dependencies.
// `?embed=1` hides the queue link so the page can live inside the board drawer.
//
// Exports startPreview(workspacePath, summary, options) ->
//   { url, events, openedAt, waitForDecision(), close() }
// options:
//   review        -> { taskId, title, visibleChange, results, diffStat,
//                      diffLines, diffTruncated, diffExtra, actions }
//   getReviewHtml -> () => HTML for the parallel review index (optional)

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.md': 'text/plain; charset=utf-8',
};

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const PASS_COLOR = '#2ea043';
const FAIL_COLOR = '#ef4444';
const VIOLET = '#8b7cff';

function sidebar(review, showQueue) {
  if (!review) {
    return `<div class="side"><div class="kicker">RATIFY REVIEW</div><div class="empty">Review data unavailable — look at the page on the right.</div></div>`;
  }
  const criteria = (review.results || []).map((result) => {
    const pass = result.status === 'PASS';
    return `<div class="crit">
      <span class="badge" style="color:${pass ? PASS_COLOR : FAIL_COLOR};border-color:${pass ? PASS_COLOR : FAIL_COLOR}66">${pass ? 'PASS' : 'FAIL'}</span>
      <div class="crit-body"><div><b>${escapeHtml(result.id)}</b> — ${escapeHtml(result.description)}</div>
      <div class="ev">${escapeHtml(result.evidence)}</div></div>
    </div>`;
  }).join('');
  const diff = (review.diffLines || []).join('\n');
  const diffBlock = review.diffStat || diff
    ? `<pre class="stat">${escapeHtml(review.diffStat || '')}</pre>
       <pre class="diff">${escapeHtml(diff)}</pre>
       ${review.diffTruncated ? `<div class="trunc">… ${review.diffExtra} more lines truncated — full change in the workspace / report.md</div>` : ''}`
    : `<div class="empty">No working-tree changes.</div>`;
  const typeColor = { read: '#93a2ba', write: VIOLET, command: '#e3a008' };
  const actions = (review.actions || []).map((action) => `<div class="action">
      <span class="atype" style="color:${typeColor[action.type] || '#93a2ba'};border-color:${typeColor[action.type] || '#93a2ba'}55">${escapeHtml(action.type)}</span>
      <span class="atarget">${escapeHtml(action.target)}</span>
      <span class="adetail">${escapeHtml(action.detail)}</span>
    </div>`).join('');
  return `<div class="side">
    <div class="kicker">RATIFY REVIEW</div>
    <h1 class="task"><span class="tid">${escapeHtml(review.taskId)}</span> — ${escapeHtml(review.title)}</h1>
    <div class="visible"><span class="dot"></span>${escapeHtml(review.visibleChange)}</div>

    <h2>ACCEPTANCE CRITERIA</h2>
    ${criteria || '<div class="empty">none</div>'}

    <h2>WHAT THE AGENT CHANGED</h2>
    ${diffBlock}

    <h2>AGENT ACTIONS</h2>
    <div class="actions">${actions || '<div class="empty">none</div>'}</div>
  </div>`;
}

function reviewPage(review, showQueue, embedded) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>RATIFY REVIEW — ${escapeHtml(review ? `${review.taskId}${review.title ? ` — ${review.title}` : ''}` : 'preview')}</title>
<style>
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { margin: 0; display: flex; flex-direction: column; background: #0b1220; color: #e9eff8; font: 14px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; }
  .main { flex: 1; display: flex; min-height: 0; }
  .side { width: 39%; min-width: 420px; max-width: 780px; overflow-y: auto; padding: 26px 28px 120px; background: #0d1524; border-right: 1px solid #26354f; }
  .right { flex: 1; display: flex; padding: 18px; background: #101a2b; min-width: 0; }
  iframe { flex: 1; width: 100%; height: 100%; border: 0; border-radius: 10px; background: #fff; box-shadow: 0 24px 60px rgba(0,0,0,.45); }
  .kicker { font: 11px/1.4 Menlo, monospace; letter-spacing: .22em; color: ${VIOLET}; }
  h1.task { margin: 10px 0 12px; font-size: 21px; line-height: 1.3; font-weight: 700; letter-spacing: -.01em; }
  .tid { color: ${VIOLET}; font-family: Menlo, monospace; font-size: 15px; }
  .visible { display: flex; align-items: flex-start; gap: 9px; color: #aebbd0; font-size: 13px; padding: 10px 12px; border: 1px solid #26354f; border-radius: 9px; background: #111c2e; }
  .visible .dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: ${VIOLET}; flex: 0 0 auto; }
  h2 { margin: 24px 0 10px; font: 11px/1.4 Menlo, monospace; letter-spacing: .2em; color: #8494ad; font-weight: 600; }
  .crit { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px solid #1b2740; }
  .badge { font: 10px/1 Menlo, monospace; font-weight: 700; border: 1px solid; border-radius: 999px; padding: 4px 8px; height: fit-content; }
  .crit-body { font-size: 12.5px; color: #d7e0ee; }
  .ev { margin-top: 3px; font: 11px/1.45 Menlo, monospace; color: #7386a1; word-break: break-word; }
  pre.stat { margin: 0 0 8px; padding: 10px 12px; background: #0a1120; border: 1px solid #26354f; border-radius: 8px; font: 11px/1.5 Menlo, monospace; color: #c9d4e6; white-space: pre; overflow-x: auto; }
  pre.diff { margin: 0; padding: 10px 12px; background: #070d18; border: 1px solid #1b2740; border-radius: 8px; font: 11px/1.5 Menlo, monospace; color: #c9d4e6; white-space: pre; overflow: auto; max-height: 300px; }
  .trunc { margin-top: 6px; font: 11px/1.5 Menlo, monospace; color: #8494ad; }
  .actions { display: flex; flex-direction: column; gap: 6px; }
  .action { display: grid; grid-template-columns: 74px 170px 1fr; gap: 10px; align-items: baseline; padding: 6px 8px; border: 1px solid #1b2740; border-radius: 7px; background: #0a1120; }
  .atype { justify-self: start; font: 10px/1 Menlo, monospace; border: 1px solid; border-radius: 999px; padding: 3px 7px; }
  .atarget { font: 11px/1.5 Menlo, monospace; color: #d7e0ee; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .adetail { font: 11px/1.5 Menlo, monospace; color: #8494ad; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { color: #7386a1; font-size: 13px; }
  .bar { flex: 0 0 70px; display: flex; align-items: center; gap: 14px; padding: 0 22px; background: #0b1220; border-top: 1px solid #26354f; box-shadow: 0 -10px 30px rgba(0,0,0,.35); }
  .rbadge { border: 1px solid #8b7cff66; background: #8b7cff1a; color: #c9c1ff; border-radius: 999px; padding: 6px 12px; font: 12px/1 Menlo, monospace; letter-spacing: .14em; }
  .queue { color: #c9c1ff; text-decoration: none; font: 13px system-ui, sans-serif; border: 1px solid #3a4a66; border-radius: 8px; padding: 7px 12px; }
  form { margin-left: auto; display: flex; align-items: center; gap: 10px; }
  input[name=reason] { width: 230px; border: 1px solid #3a4a66; background: #111a2a; color: #e9eff8; border-radius: 8px; padding: 8px 10px; font: 14px system-ui, sans-serif; }
  button { cursor: pointer; border-radius: 8px; padding: 9px 16px; font: 600 14px system-ui, sans-serif; }
  button.reject { border: 1px solid #3a4a66; background: transparent; color: #e9eff8; }
  button.accept { border: 1px solid #2ea043; background: #238636; color: #fff; }
</style></head>
<body>
  <div class="main">
    ${sidebar(review, showQueue)}
    <div class="right"><iframe src="/__page/index.html" title="Live preview of the change"></iframe></div>
  </div>
  <div class="bar">
    <span class="rbadge">RATIFY REVIEW</span>
    ${showQueue ? '<a class="queue" href="/review">← review queue</a>' : ''}
    <span style="color:#93a2ba;font-size:13px">Look at the page on the right, then accept or reject.</span>
    <form method="POST" action="/__ratify/decision">
      <input name="reason" placeholder="Reason (only for reject)">
      <button class="reject" name="decision" value="reject">Reject</button>
      <button class="accept" name="decision" value="accept">Accept change</button>
    </form>
  </div>
</body></html>`;
}

function confirmationPage(accepted) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Ratify review</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1220;color:#e9eff8;font:16px/1.5 system-ui,sans-serif"><div style="text-align:center;max-width:440px"><div style="font-size:13px;letter-spacing:.18em;color:#8b7cff;margin-bottom:14px">RATIFY REVIEW</div><h1 style="margin:0 0 10px;font-size:34px">${accepted ? 'Accepted' : 'Rejected'}</h1><p style="color:#93a2ba">You can close this tab and return to the review queue. ${accepted ? 'The change is being committed and the report written.' : 'This change will not be committed.'}</p></div></body></html>`;
}

function startPreview(workspacePath, summary, options = {}) {
  return new Promise((resolve, reject) => {
    const root = path.resolve(workspacePath);
    const events = [];
    let url = '';
    let openedAt = null;
    let settle;
    const decision = new Promise((done) => { settle = done; });

    const server = http.createServer((req, res) => {
      const incoming = new URL(req.url, 'http://127.0.0.1');
      const showQueue = Boolean(options.getReviewHtml);

      if (req.method === 'GET' && incoming.pathname === '/__ratify/board' && options.getReviewState) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(options.getReviewState()));
        return;
      }
      if (req.method === 'GET' && incoming.pathname.startsWith('/__ratify/artifact/') && options.artifacts) {
        const name = incoming.pathname.slice('/__ratify/artifact/'.length);
        const file = name === 'summary.md' ? options.artifacts.md : name === 'summary.json' ? options.artifacts.json : null;
        if (!file) { res.writeHead(404); res.end('not found'); return; }
        fs.readFile(file, (error, data) => {
          if (error) { res.writeHead(404); res.end('not written yet'); return; }
          res.writeHead(200, {
            'Content-Type': name.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
          });
          res.end(data);
        });
        return;
      }
      if (req.method === 'GET' && incoming.pathname === '/review' && options.getReviewHtml) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(options.getReviewHtml());
        return;
      }
      if (req.method === 'POST' && incoming.pathname === '/__ratify/decision') {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
          const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
          const accepted = form.get('decision') === 'accept';
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
          res.end(confirmationPage(accepted));
          settle({
            actor: 'human',
            decision: accepted ? 'accepted' : 'rejected',
            method: 'browser_button',
            ts: new Date().toISOString(),
            reason: accepted ? '' : (form.get('reason') || '').trim(),
            shown: { url, summary },
          });
        });
        return;
      }
      if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }

      // `/` is the two-panel review UI; `/__page/...` is the raw page for the iframe.
      if (incoming.pathname === '/') {
        const embedded = incoming.searchParams.get('embed') === '1';
        const html = reviewPage(options.review, showQueue && !embedded, embedded);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(html);
        if (!openedAt) {
          openedAt = new Date().toISOString();
          events.push({ ts: openedAt, type: 'preview_opened', url });
        }
        return;
      }

      const isRaw = incoming.pathname === '/__page' || incoming.pathname.startsWith('/__page/');
      const relative = isRaw
        ? (incoming.pathname.replace(/^\/__page/, '') || '/index.html')
        : incoming.pathname;
      const filePath = path.resolve(root, `.${relative}`);
      if (!filePath.startsWith(root + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
      fs.readFile(filePath, (error, data) => {
        if (error) { res.writeHead(404); res.end('not found'); return; }
        const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      url = `http://localhost:${server.address().port}/`;
      events.push({ ts: new Date().toISOString(), type: 'preview_started', url });
      resolve({
        get url() { return url; },
        get openedAt() { return openedAt; },
        events,
        waitForDecision: () => decision,
        close: () => new Promise((done) => {
          server.close(() => done());
          if (server.closeAllConnections) server.closeAllConnections();
        }),
      });
    });
  });
}

module.exports = { startPreview };
