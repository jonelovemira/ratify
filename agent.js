#!/usr/bin/env node
// Mock agent: stands in for the AI coding agent that runs inside a workspace.
// It follows a fixed plan and records every read / write / command as one JSON
// line in <workspace>/.ratify/actions.jsonl. No model calls, no network.
//
// Usage: node agent.js <workspace-path>

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workspace = path.resolve(process.argv[2] || '.');
const ratifyDir = path.join(workspace, '.ratify');
const actionsFile = path.join(ratifyDir, 'actions.jsonl');

fs.mkdirSync(ratifyDir, { recursive: true });
fs.writeFileSync(actionsFile, ''); // one fresh journal per run

function record(type, target, detail) {
  const action = { ts: new Date().toISOString(), type, target, detail };
  fs.appendFileSync(actionsFile, `${JSON.stringify(action)}\n`);
  console.log(`[agent] ${type.padEnd(7)} ${target} — ${detail}`);
}

function readFile(relativePath) {
  const content = fs.readFileSync(path.join(workspace, relativePath), 'utf8');
  record('read', relativePath, `${content.split('\n').length} lines, ${content.length} chars`);
  return content;
}

function writeFile(relativePath, content, detail) {
  fs.writeFileSync(path.join(workspace, relativePath), content);
  record('write', relativePath, detail);
}

function runCommand(display, args, detail) {
  const result = spawnSync(process.execPath, args, { cwd: workspace, encoding: 'utf8' });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().replace(/\s*\n\s*/g, ' | ');
  record('command', display, `${detail} → exit ${result.status}${output ? `: ${output}` : ''}`);
  return result;
}

// 1. Inspect the project.
const pageSource = readFile('index.html');
const appSource = readFile('app.js');

// 2. Check the runtime is available.
runCommand('node -v', ['-v'], 'check the runtime');

// 3. Make the visible change: a health card on the page.
if (pageSource.includes('id="health-card"')) {
  throw new Error('index.html already has a health card');
}
const card = [
  '      <style>',
  '        .health-card { display: inline-flex; align-items: center; gap: 10px; margin-top: 22px; padding: 12px 16px; border: 1px solid #2e7d32; border-radius: 10px; background: #e8f5e9; color: #1b5e20; font: 15px/1.4 system-ui, sans-serif; }',
  '        .health-card .dot { width: 10px; height: 10px; border-radius: 50%; background: #2e7d32; }',
  '      </style>',
  '      <section id="health-card" class="health-card">',
  '        <span class="dot"></span>',
  '        <span>Health check: ok</span>',
  '      </section>',
  '    </main>',
].join('\n');
writeFile('index.html', pageSource.replace('    </main>', card), 'added a visible health card');

// 4. Make the change executable too: a health() function.
if (appSource.includes('function health()')) {
  throw new Error('app.js already has a health() function');
}
const healthBlock = [
  '',
  '// Added by the Ratify agent: a small health check other tools can call.',
  'function health() {',
  "  return { status: 'ok' };",
  '}',
  '',
  "if (typeof module !== 'undefined') {",
  '  module.exports = { health };',
  '}',
  '',
].join('\n');
writeFile('app.js', appSource.trimEnd() + '\n' + healthBlock, 'added health() and a module export');

// 5. Verify the change before handing it back.
const selfCheckCode = "const { health } = require(process.cwd() + '/app.js'); console.log(JSON.stringify(health()));";
runCommand('node -e <health self-check>', ['-e', selfCheckCode], 'run the new health() inside the workspace');

console.log('[agent] done: 2 files written, 2 commands run');
