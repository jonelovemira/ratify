#!/usr/bin/env node
// Ratify prototype — the whole loop, single change or a parallel queue:
//   task(s) -> workspace copy inside the boundary -> agent diff -> checks (support)
//   -> localhost preview(s) -> human ACCEPT/REJECT -> branch + report + audit (+ summary).
// Zero dependencies, no network calls beyond localhost, no model calls.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { startPreview } = require('./preview');

const USAGE = `Usage: node run.js [--task task.json] [--workspace ./workspace] [--parallel [N]] [--auto-accept]

Single change (default):
  copies the repo into the workspace, runs the mock agent, checks the change,
  opens a localhost preview and waits for a human to Accept or Reject it. On accept
  it commits on a branch and writes report.md, audit.json and mr.md.

Parallel queue:
  --parallel [N]   run N independent tasks from the same repo (default 4, max 8),
                   open N previews at once plus a /review queue index, record one
                   human decision per task, then write per-task artifacts in runs/
                   and summary.md / summary.json next to this file.

  --auto-accept    simulated acceptance for tests (no human click; labeled as such)`;

const log = (message) => console.log(`[ratify] ${message}`);
const fail = (message) => { throw new Error(message); };
const unique = (items) => [...new Set(items)];
const diffLine = (diff) => `${diff.files} file${diff.files === 1 ? '' : 's'} · +${diff.added} −${diff.removed}`;

function rel(target) {
  const relative = path.relative(process.cwd(), target);
  return relative === '' ? '.' : relative.startsWith('..') ? target : relative;
}

function formatTime(iso) {
  const date = new Date(iso);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function parseCli(argv) {
  const opts = { task: 'task.json', workspace: './workspace', autoAccept: false, parallel: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') {
      opts.help = true;
    } else if (flag === '--auto-accept') {
      opts.autoAccept = true;
    } else if (flag === '--parallel') {
      const maybe = argv[i + 1];
      if (maybe && /^\d+$/.test(maybe)) { opts.parallel = Number(maybe); i += 1; } else { opts.parallel = 4; }
    } else if (flag === '--task' || flag === '--workspace') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) fail(`${flag} needs a value`);
      opts[flag.slice(2)] = value;
      i += 1;
    } else {
      fail(`unknown argument: ${flag}`);
    }
  }
  if (opts.parallel !== null && (!Number.isInteger(opts.parallel) || opts.parallel < 1 || opts.parallel > 8)) {
    fail('--parallel must be an integer between 1 and 8');
  }
  return opts;
}

function assertInsideWorkspace(relativePath, label) {
  const unsafe = typeof relativePath !== 'string'
    || relativePath === ''
    || path.isAbsolute(relativePath)
    || relativePath.split(/[\\/]/).includes('..');
  if (unsafe) fail(`${label}: path must stay inside the workspace (got "${relativePath}")`);
}

function validateTask(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) fail('task file must contain a JSON object');
  for (const field of ['id', 'repo', 'baseBranch', 'visibleChange']) {
    if (typeof task[field] !== 'string' || task[field].trim() === '') fail(`task.${field} must be a non-empty string`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(task.id)) fail('task.id must be a safe branch name (letters, digits, . _ -)');
  if (!Array.isArray(task.acceptanceCriteria) || task.acceptanceCriteria.length === 0) fail('task.acceptanceCriteria must be a non-empty array');
  for (const criterion of task.acceptanceCriteria) {
    if (!criterion || typeof criterion !== 'object') fail('each acceptance criterion must be an object');
    for (const key of ['id', 'description', 'type']) {
      if (typeof criterion[key] !== 'string' || criterion[key] === '') fail(`acceptance criterion is missing "${key}"`);
    }
    if (criterion.type === 'file-exists' || criterion.type === 'file-contains') {
      assertInsideWorkspace(criterion.path, criterion.id);
      if (criterion.type === 'file-contains' && typeof criterion.text !== 'string') fail(`${criterion.id}: file-contains needs a "text" string`);
    } else if (criterion.type === 'node-assert') {
      if (typeof criterion.code !== 'string' || criterion.code === '') fail(`${criterion.id}: node-assert needs a "code" string`);
    } else {
      fail(`${criterion.id}: unknown check type "${criterion.type}"`);
    }
  }
}

function loadTask(opts) {
  const taskPath = path.resolve(opts.task);
  if (!fs.existsSync(taskPath)) fail(`task file not found: ${opts.task}`);
  let task;
  try {
    task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
  } catch {
    fail(`task file is not valid JSON: ${opts.task}`);
  }
  validateTask(task);
  const repoPath = path.resolve(path.dirname(taskPath), task.repo);
  if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) fail(`task repo not found: ${task.repo}`);
  return { task, repoPath };
}

function copyWorkspace(repoPath, workspacePath) {
  fs.rmSync(workspacePath, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(workspacePath), { recursive: true });
  fs.cpSync(repoPath, workspacePath, { recursive: true });
}

function runGit(workspacePath, args) {
  const result = spawnSync('git', args, { cwd: workspacePath, encoding: 'utf8' });
  if (result.error) fail(`git is required for the review step: ${result.error.message}`);
  if (result.status !== 0) fail(`git ${args[0]} failed: ${(result.stderr || result.stdout || '').trim()}`);
  return result.stdout.trim();
}

function runGitRaw(workspacePath, args) {
  const result = spawnSync('git', args, { cwd: workspacePath, encoding: 'utf8' });
  if (result.error) fail(`git is required for the review step: ${result.error.message}`);
  if (result.status !== 0) fail(`git ${args[0]} failed: ${(result.stderr || result.stdout || '').trim()}`);
  return result.stdout.replace(/\n$/, '');
}

function ensureBaseRepo(workspacePath, baseBranch) {
  if (fs.existsSync(path.join(workspacePath, '.git'))) return;
  const identity = ['-c', 'user.name=Ratify', '-c', 'user.email=ratify@localhost'];
  runGit(workspacePath, ['init', '-q', '-b', baseBranch]);
  runGit(workspacePath, ['add', '-A']);
  runGit(workspacePath, [...identity, 'commit', '-qm', `base: import demo-repo (${baseBranch})`]);
}

function commitChange(workspacePath, task, actions) {
  const files = unique(actions.filter((action) => action.type === 'write').map((action) => action.target));
  if (files.length === 0) fail('nothing to commit for the accepted change');
  const identity = ['-c', 'user.name=Ratify', '-c', 'user.email=ratify@localhost'];
  runGit(workspacePath, ['checkout', '-q', '-b', task.id]);
  runGit(workspacePath, ['add', '--', ...files]);
  runGit(workspacePath, [...identity, 'commit', '-qm', `${task.id}: ${task.title}`]);
  return { branch: task.id, commit: runGit(workspacePath, ['rev-parse', '--short', 'HEAD']), files };
}

function runMockAgent(workspacePath, quiet) {
  const agent = spawnSync(process.execPath, [path.join(__dirname, 'agent.js'), workspacePath], { cwd: workspacePath, encoding: 'utf8' });
  if (!quiet) {
    if (agent.stdout) process.stdout.write(agent.stdout);
    if (agent.stderr) process.stderr.write(agent.stderr);
  }
  if (agent.status !== 0) fail(`mock agent exited with ${agent.status === null ? 'no status' : agent.status}`);
}

function readActions(workspacePath) {
  const file = path.join(workspacePath, '.ratify', 'actions.jsonl');
  if (!fs.existsSync(file)) fail('agent did not write .ratify/actions.jsonl');
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) fail('agent journal is empty');
  return lines.map((line, index) => {
    let action;
    try {
      action = JSON.parse(line);
    } catch {
      fail(`invalid JSON on action line ${index + 1}`);
    }
    for (const key of ['type', 'target']) {
      if (typeof action[key] !== 'string' || action[key] === '') fail(`action line ${index + 1} is missing "${key}"`);
    }
    return { id: `a${index + 1}`, ...action };
  });
}

function firstLine(text) {
  const line = String(text || '').trim().split('\n')[0];
  if (!line) return '(no output)';
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

function verdict(criterion, passed, evidence) {
  return { id: criterion.id, description: criterion.description, status: passed ? 'PASS' : 'FAIL', evidence };
}

function evaluate(criterion, workspacePath, actions) {
  const fileAction = (file) => {
    const write = [...actions].reverse().find((action) => action.type === 'write' && action.target === file);
    return write ? ` (action ${write.id})` : '';
  };
  try {
    if (criterion.type === 'file-exists') {
      const exists = fs.existsSync(path.join(workspacePath, criterion.path));
      return verdict(criterion, exists, exists ? `${criterion.path} exists${fileAction(criterion.path)}` : `${criterion.path} is missing`);
    }
    if (criterion.type === 'file-contains') {
      const full = path.join(workspacePath, criterion.path);
      if (!fs.existsSync(full)) return verdict(criterion, false, `${criterion.path} is missing`);
      const found = fs.readFileSync(full, 'utf8').includes(criterion.text);
      return verdict(criterion, found, found
        ? `${criterion.path} contains ${JSON.stringify(criterion.text)}${fileAction(criterion.path)}`
        : `${criterion.path} does not contain ${JSON.stringify(criterion.text)}`);
    }
    const check = spawnSync(process.execPath, ['-e', criterion.code], { cwd: workspacePath, encoding: 'utf8' });
    const passed = check.status === 0;
    return verdict(criterion, passed, passed
      ? `node check exited 0${criterion.evidenceFile ? fileAction(criterion.evidenceFile) : ''}`
      : `node check exited ${check.status}: ${firstLine(check.stderr)}`);
  } catch (error) {
    return verdict(criterion, false, `check error: ${error.message}`);
  }
}

function diffStat(workspacePath) {
  const rows = runGit(workspacePath, ['diff', '--numstat']).split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => line.split('\t'));
  return {
    files: rows.length,
    added: rows.reduce((sum, row) => sum + (Number(row[0]) || 0), 0),
    removed: rows.reduce((sum, row) => sum + (Number(row[1]) || 0), 0),
  };
}

function printTaskBlock(task) {
  console.log('');
  console.log(`TASK ${task.id} — ${task.title}`);
  console.log(`repo: ${task.repo} (base: ${task.baseBranch})`);
  console.log(`visible change: ${task.visibleChange}`);
  console.log('acceptance:');
  for (const criterion of task.acceptanceCriteria) {
    console.log(`  ${criterion.id} — ${criterion.description}`);
  }
  console.log('');
}

function printChangeBlock(prepared) {
  const stat = prepared.changes.stat;
  const diff = prepared.changes.unified;
  console.log('');
  console.log('WHAT THE AGENT CHANGED');
  if (!stat || !diff) {
    console.log('(no working-tree changes)');
    console.log('');
    return;
  }
  console.log(stat);
  const lines = diff.split('\n');
  const LIMIT = 30;
  console.log('');
  console.log(`--- diff (first ${LIMIT} lines) ---`);
  console.log(lines.slice(0, LIMIT).join('\n'));
  if (lines.length > LIMIT) console.log(`... (${lines.length - LIMIT} more lines truncated — full change is in the workspace/report)`);
  console.log('');
}

function changeDetails(workspacePath) {
  return {
    stat: runGitRaw(workspacePath, ['diff', '--stat']),
    unified: runGitRaw(workspacePath, ['diff']),
  };
}

function buildReviewData(prepared) {
  const { task, results, changes, actions } = prepared;
  const diffLines = changes.unified ? changes.unified.split('\n') : [];
  const LIMIT = 40;
  return {
    taskId: task.id,
    title: task.title,
    visibleChange: task.visibleChange,
    results: results.map((result) => ({
      id: result.id,
      description: result.description,
      status: result.status,
      evidence: result.evidence,
    })),
    diffStat: changes.stat,
    diffLines: diffLines.slice(0, LIMIT),
    diffTruncated: diffLines.length > LIMIT,
    diffExtra: Math.max(0, diffLines.length - LIMIT),
    actions: actions.map((action) => ({ type: action.type, target: action.target, detail: action.detail })),
  };
}

function makeParallelTasks(baseTask, count) {
  const match = baseTask.id.match(/^(.*?)(\d+)$/);
  const prefix = match ? match[1] : `${baseTask.id}-`;
  const width = match ? match[2].length : 3;
  const first = match ? Number(match[2]) : 1;
  return Array.from({ length: count }, (_, index) => ({ ...baseTask, id: `${prefix}${String(first + index).padStart(width, '0')}` }));
}

function prepareTask({ task, repoPath, workspacePath, quiet }) {
  copyWorkspace(repoPath, workspacePath);
  ensureBaseRepo(workspacePath, task.baseBranch);
  runMockAgent(workspacePath, quiet);
  const actions = readActions(workspacePath);
  const results = task.acceptanceCriteria.map((criterion) => evaluate(criterion, workspacePath, actions));
  return {
    task,
    workspacePath,
    actions,
    results,
    checksPassed: results.every((result) => result.status === 'PASS'),
    diff: diffStat(workspacePath),
    changes: changeDetails(workspacePath),
  };
}

function simulatedDecision(preview, task) {
  return { actor: 'simulated', decision: 'accepted', method: 'test_mode', ts: new Date().toISOString(), reason: '', shown: { url: preview.url, summary: task.visibleChange } };
}

function signOffEvent(decision) {
  return { ts: decision.ts, type: 'sign_off', actor: decision.actor, decision: decision.decision, method: decision.method, reason: decision.reason, shown: decision.shown };
}

function acceptChange(prepared) {
  const review = commitChange(prepared.workspacePath, prepared.task, prepared.actions);
  const ts = new Date().toISOString();
  prepared.preview.events.push({ ts, type: 'branch_created', branch: review.branch });
  prepared.preview.events.push({ ts, type: 'commit_created', branch: review.branch, commit: review.commit });
  log(`${prepared.task.id}: committed on branch ${review.branch} (${review.commit})`);
  return review;
}

function buildReport({ prepared, decision, preview, review, status, finishedAt }) {
  const { task, actions, results, diff } = prepared;
  const writes = actions.filter((action) => action.type === 'write');
  const passed = results.filter((result) => result.status === 'PASS').length;
  const accepted = decision.decision === 'accepted';
  const lines = [
    '# Ratify run report', '',
    `Task: **${task.id} — ${task.title}**`,
    `Repo: \`${task.repo}\` (branch \`${task.baseBranch}\`)`,
    'Agent: mock agent (deterministic, no model calls)',
    `Diff: ${diffLine(diff)}`,
    `Finished: ${finishedAt}`, '',
    '## Checks (support, not acceptance)', '',
    ...results.map((result) => `- ${result.status} — ${result.id}: ${result.description} — evidence: ${result.evidence}`), '',
    '## Preview (where a human decides)', '',
    `- Preview URL: ${preview.url} (localhost only)`,
    `- Visible change: ${task.visibleChange}`,
    `- Opened by the reviewer: ${preview.openedAt ? formatTime(preview.openedAt) : 'not opened (simulated test mode)'}`, '',
    '## Changes', '',
    ...(writes.length === 0 ? ['- no files changed'] : writes.map((action) => `- \`${action.target}\` (action ${action.id}) — ${action.detail}`)), '',
    '## Human sign-off', '',
    `- **Human sign-off: ${accepted ? 'ACCEPTED' : 'REJECTED'} at ${formatTime(decision.ts)}**`,
    decision.actor === 'simulated' ? '- Actor: simulated (test mode — no human clicked)' : '- Actor: human (via the preview review bar)',
    `- What was shown: ${decision.shown.url} — ${decision.shown.summary}`,
  ];
  if (!accepted) lines.push(`- Reason: ${decision.reason || 'No reason given'}`);
  lines.push('');
  if (status === 'ACCEPTED') lines.push(`**Final status: ACCEPTED** — ${passed}/${results.length} checks passed, and a human accepted the change.`);
  else if (status === 'REJECTED') lines.push('**Final status: REJECTED** — human review rejected the change; nothing was committed.');
  else lines.push(`**Final status: FAIL** — ${passed}/${results.length} checks passed; the change is blocked.`);
  if (review) {
    lines.push('', '## Review', '',
      '- MR description: `mr.md`',
      `- Audit trail: \`audit.json\` (\`${actions.length}\` agent actions, \`${preview.events.length}\` review events)`,
      `- Branch ready for review: ${review.branch} (commit ${review.commit})`);
  }
  return `${lines.join('\n')}\n`;
}

function buildMr({ prepared, decision, review }) {
  const { task, actions, results, diff } = prepared;
  const writes = actions.filter((action) => action.type === 'write');
  const lines = [
    `# MR: ${task.title}`, '',
    `- Task: \`${task.id}\``,
    `- Branch: \`${review.branch}\``,
    `- Base branch: \`${task.baseBranch}\``,
    `- Commit: \`${review.commit}\``,
    `- Diff: ${diffLine(diff)}`,
    `- Preview URL: ${decision.shown.url}`, '',
    '## What changed', '',
    ...writes.map((action) => `- \`${action.target}\` — ${action.detail}`), '',
    '## Checks (support)', '',
    ...results.map((result) => `- ${result.status} — ${result.id}: ${result.description}`), '',
    '## Human sign-off', '',
    `- ACCEPTED at ${formatTime(decision.ts)} by ${decision.actor === 'simulated' ? 'simulated test mode' : 'a human in the preview review bar'}`,
    `- What was shown: ${decision.shown.summary}`, '',
    '## Audit trail', '',
    `- \`audit.json\` — ${actions.length} agent actions and the review events, in order.`,
  ];
  return `${lines.join('\n')}\n`;
}

function buildSummary(summary) {
  const lines = [
    '# Ratify parallel review summary', '',
    `- Tasks: ${summary.parallel}`,
    `- Accepted: ${summary.accepted}`,
    `- Rejected: ${summary.rejected}`,
    `- Branches created: ${summary.branchesCreated.length ? summary.branchesCreated.join(', ') : 'none'}`,
    `- Elapsed: ${(summary.elapsedMs / 1000).toFixed(2)}s`,
    `- Review index: ${summary.reviewUrl}`, '',
    '| Task | Diff | Decision | Branch | Commit | Artifacts |',
    '|---|---|---|---|---|---|',
    ...summary.tasks.map((task) => `| ${task.taskId} | ${diffLine(task.diff)} | ${task.status} | ${task.branch || '—'} | ${task.commit || '—'} | \`${task.artifacts.report}\` |`),
    '',
    summary.rejected > 0 ? 'Rejected changes were not committed; their reports and audit trails are still written.' : 'All accepted changes were committed on their own branches.',
    '',
    'The human decision is the gate: automated checks are support, not acceptance.',
  ];
  return `${lines.join('\n')}\n`;
}

function boardSnapshot(state) {
  const tasks = state.tasks.map((entry) => ({
    id: entry.task.id,
    title: entry.task.title,
    files: entry.prepared.diff.files,
    added: entry.prepared.diff.added,
    removed: entry.prepared.diff.removed,
    status: entry.status || 'PENDING',
    decision: entry.decision ? entry.decision.decision : null,
    actor: entry.decision ? entry.decision.actor : null,
    ts: entry.decision ? entry.decision.ts : null,
    reason: entry.decision ? entry.decision.reason || '' : '',
    previewUrl: entry.preview.url,
    branch: entry.review ? entry.review.branch : null,
    artifacts: {
      report: rel(path.join('runs', entry.task.id, 'report.md')),
      audit: rel(path.join('runs', entry.task.id, 'audit.json')),
      mr: entry.review ? rel(path.join('runs', entry.task.id, 'mr.md')) : null,
    },
  }));
  const pending = tasks.filter((task) => task.status === 'PENDING').length;
  const accepted = tasks.filter((task) => task.status === 'ACCEPTED').length;
  const rejected = tasks.filter((task) => task.status === 'REJECTED').length;
  return {
    tasks,
    total: tasks.length,
    pending,
    accepted,
    rejected,
    branches: tasks.filter((task) => task.branch).length,
    complete: tasks.length > 0 && pending === 0,
    elapsedMs: state.startedAtMs ? Date.now() - state.startedAtMs : 0,
    reviewUrl: state.reviewUrl,
    summaryReady: Boolean(state.summaryReady),
  };
}

function buildReviewPage(state) {
  const snapshot = boardSnapshot(state);
  const initial = JSON.stringify(snapshot).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><title>RATIFY REVIEW BOARD — ${snapshot.total} changes</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #070a11; color: #e9eff8; font: 14px/1.5 -apple-system, 'Helvetica Neue', system-ui, sans-serif; }
  .wrap { max-width: 1280px; margin: 0 auto; padding: 40px 28px 70px; }
  .kicker { font: 12px Menlo, monospace; letter-spacing: .28em; color: #8b7cff; }
  h1 { font-size: 34px; margin: 14px 0 8px; letter-spacing: -.02em; }
  .sub { color: #94a3ba; font-size: 15px; margin: 0 0 26px; }
  .sub b { color: #c9d4e6; font-weight: 600; }
  .lanes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: start; }
  .lane { background: rgba(16,23,36,.7); border: 1px solid #26354f; border-radius: 14px; min-height: 220px; padding: 14px; }
  .lane h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font: 11px Menlo, monospace; letter-spacing: .2em; color: #94a3ba; font-weight: 600; }
  .lane h2 .count { margin-left: auto; font-size: 12px; letter-spacing: 0; color: #c9d4e6; border: 1px solid #3a4a66; border-radius: 999px; padding: 1px 8px; }
  .lane.inreview h2 .dot { width: 8px; height: 8px; border-radius: 50%; background: #f5c04a; }
  .lane.accepted h2 .dot { width: 8px; height: 8px; border-radius: 50%; background: #2ea043; }
  .lane.rejected h2 .dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; }
  .cards { display: flex; flex-direction: column; gap: 10px; }
  .empty { color: #5f718c; font: 12px Menlo, monospace; padding: 14px 4px; }
  .card { background: #0d1524; border: 1px solid #26354f; border-radius: 11px; padding: 12px 13px; }
  .card.ACCEPTED { border-color: rgba(46,160,67,.5); background: rgba(46,160,67,.07); }
  .card.REJECTED { border-color: rgba(239,68,68,.5); background: rgba(239,68,68,.07); }
  .card-top { display: flex; align-items: center; gap: 8px; }
  .tid { font: 600 12px Menlo, monospace; color: #8b7cff; }
  .badge { margin-left: auto; font: 700 10px Menlo, monospace; letter-spacing: .1em; border-radius: 999px; padding: 3px 8px; border: 1px solid; }
  .badge.PENDING { color: #f5c04a; border-color: rgba(245,192,74,.5); background: rgba(245,192,74,.08); }
  .badge.ACCEPTED { color: #2ea043; border-color: rgba(46,160,67,.55); background: rgba(46,160,67,.12); }
  .badge.REJECTED { color: #ef4444; border-color: rgba(239,68,68,.55); background: rgba(239,68,68,.12); }
  .title { font-size: 14px; font-weight: 600; margin: 7px 0 4px; line-height: 1.35; }
  .meta { font: 11px Menlo, monospace; color: #94a3ba; }
  .when { margin-top: 5px; font: 10.5px Menlo, monospace; color: #7386a1; }
  .reason { margin-top: 5px; font: 10.5px Menlo, monospace; color: #ef9a9a; }
  .open { display: inline-block; margin-top: 9px; font: 600 12px system-ui, sans-serif; color: #c9c1ff; border: 1px solid #3a4a66; border-radius: 7px; padding: 5px 10px; background: transparent; cursor: pointer; }
  .open:hover { border-color: #8b7cff; color: #fff; }
  .scrim { position: fixed; inset: 0; z-index: 30; background: rgba(3,6,12,.62); opacity: 0; pointer-events: none; transition: opacity .18s ease; }
  .scrim.show { opacity: 1; pointer-events: auto; }
  .drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 31; width: 72%; min-width: 520px; display: flex; flex-direction: column; background: #0b1220; border-left: 1px solid #26354f; box-shadow: -30px 0 80px rgba(0,0,0,.5); transform: translateX(100%); transition: transform .2s ease; }
  .drawer.open { transform: translateX(0); }
  .drawer-head { flex: 0 0 58px; display: flex; align-items: center; gap: 14px; padding: 0 18px; border-bottom: 1px solid #26354f; background: #0d1524; }
  .drawer-title { font: 600 14px system-ui, sans-serif; color: #e9eff8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .drawer-close { margin-left: auto; width: 34px; height: 34px; border-radius: 8px; border: 1px solid #3a4a66; background: transparent; color: #e9eff8; font: 20px/1 system-ui, sans-serif; cursor: pointer; }
  .drawer-close:hover { border-color: #8b7cff; color: #fff; }
  .drawer iframe { flex: 1; width: 100%; border: 0; background: #fff; }
  .banner { display: none; margin-top: 22px; border: 1px solid rgba(46,160,67,.5); background: rgba(46,160,67,.08); border-radius: 14px; padding: 18px 20px; }
  .banner.show { display: block; }
  .banner h3 { margin: 0 0 6px; font: 700 15px Menlo, monospace; letter-spacing: .12em; color: #4ade80; }
  .banner .stats { display: flex; gap: 22px; flex-wrap: wrap; color: #c9d4e6; font-size: 13px; }
  .banner .stats b { color: #fff; }
  .banner .links { margin-top: 10px; display: flex; gap: 10px; }
  .banner a { color: #c9c1ff; font: 12px Menlo, monospace; border: 1px solid #3a4a66; border-radius: 7px; padding: 5px 10px; text-decoration: none; }
  .banner a:hover { border-color: #8b7cff; color: #fff; }
</style></head>
<body><div class="wrap">
  <div class="kicker">RATIFY REVIEW BOARD</div>
  <h1 id="headline">${snapshot.total} changes waiting for human review</h1>
  <p class="sub" id="subline">Every card opens its own two-panel preview. Decisions move cards between lanes; the board polls every 1.5s.</p>
  <div class="lanes">
    <section class="lane inreview"><h2><span class="dot"></span>IN REVIEW<span class="count" id="count-PENDING">0</span></h2><div class="cards" id="lane-PENDING"></div></section>
    <section class="lane accepted"><h2><span class="dot"></span>ACCEPTED<span class="count" id="count-ACCEPTED">0</span></h2><div class="cards" id="lane-ACCEPTED"></div></section>
    <section class="lane rejected"><h2><span class="dot"></span>REJECTED<span class="count" id="count-REJECTED">0</span></h2><div class="cards" id="lane-REJECTED"></div></section>
  </div>
  <div class="banner" id="banner">
    <h3>RUN COMPLETE</h3>
    <div class="stats" id="banner-stats"></div>
    <div class="links" id="banner-links"></div>
  </div>
</div>
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" aria-hidden="true">
  <div class="drawer-head">
    <div class="drawer-title" id="drawer-title">review</div>
    <button class="drawer-close" id="drawer-close" aria-label="Close review">×</button>
  </div>
  <iframe id="drawer-iframe" title="Task review" src="about:blank"></iframe>
</aside>
<script>
  const initial = ${initial};
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmtElapsed = (ms) => {
    const total = Math.max(0, Math.round(ms / 100) / 10);
    return total < 60 ? total.toFixed(1) + 's' : Math.floor(total / 60) + 'm ' + (total % 60).toFixed(0) + 's';
  };
  function card(task) {
    const when = task.ts ? '<div class="when">' + esc(task.actor) + ' · ' + esc(new Date(task.ts).toLocaleTimeString()) + '</div>' : '';
    const reason = task.reason ? '<div class="reason">reason: ' + esc(task.reason) + '</div>' : '';
    return '<div class="card ' + esc(task.status) + '">' +
      '<div class="card-top"><span class="tid">' + esc(task.id) + '</span><span class="badge ' + esc(task.status) + '">' + esc(task.status) + '</span></div>' +
      '<div class="title">' + esc(task.title) + '</div>' +
      '<div class="meta">+' + task.added + ' −' + task.removed + ' · ' + task.files + ' file' + (task.files === 1 ? '' : 's') + '</div>' +
      when + reason +
      '<button class="open" data-open-review="' + esc(task.id) + '">Open review ↗</button>' +
    '</div>';
  }
  let currentData = initial;
  let drawerTaskId = null;
  let drawerCloseTimer = null;

  function openDrawer(taskId) {
    const task = (currentData.tasks || []).find((item) => item.id === taskId);
    if (!task) return;
    if (drawerCloseTimer) { clearTimeout(drawerCloseTimer); drawerCloseTimer = null; }
    drawerTaskId = taskId;
    document.getElementById('drawer-title').textContent = task.id + ' — ' + task.title;
    document.getElementById('drawer-iframe').src = task.previewUrl + '?embed=1';
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawer').setAttribute('aria-hidden', 'false');
    document.getElementById('scrim').classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    if (drawerCloseTimer) { clearTimeout(drawerCloseTimer); drawerCloseTimer = null; }
    drawerTaskId = null;
    const drawer = document.getElementById('drawer');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.getElementById('scrim').classList.remove('show');
    document.getElementById('drawer-iframe').src = 'about:blank';
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open-review]');
    if (opener) {
      event.preventDefault();
      openDrawer(opener.getAttribute('data-open-review'));
    }
    if (event.target.id === 'scrim') closeDrawer();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);

  function render(data) {
    currentData = data;
    for (const lane of ['PENDING', 'ACCEPTED', 'REJECTED']) {
      const tasks = data.tasks.filter((task) => task.status === lane);
      const el = document.getElementById('lane-' + lane);
      const count = document.getElementById('count-' + lane);
      if (el) el.innerHTML = tasks.length ? tasks.map(card).join('') : '<div class="empty">none yet</div>';
      if (count) count.textContent = tasks.length;
    }
    const headline = document.getElementById('headline');
    if (headline) headline.textContent = data.complete ? 'All decisions are in — run complete' : data.total + ' changes waiting for human review';
    const subline = document.getElementById('subline');
    if (subline) subline.innerHTML = '<b>' + data.pending + '</b> in review · <b>' + data.accepted + '</b> accepted · <b>' + data.rejected + '</b> rejected · branches created: <b>' + data.branches + '</b>';
    if (drawerTaskId) {
      const openTask = data.tasks.find((task) => task.id === drawerTaskId);
      if (openTask && openTask.status !== 'PENDING' && !drawerCloseTimer) {
        drawerCloseTimer = setTimeout(closeDrawer, 800);
      }
    }
    const banner = document.getElementById('banner');
    const stats = document.getElementById('banner-stats');
    const links = document.getElementById('banner-links');
    if (banner && stats && links) {
      if (data.complete) {
        banner.classList.add('show');
        stats.innerHTML = '<span>Accepted: <b>' + data.accepted + '</b></span><span>Rejected: <b>' + data.rejected + '</b></span><span>Branches created: <b>' + data.branches + '</b></span><span>Elapsed: <b>' + fmtElapsed(data.elapsedMs) + '</b></span>';
        links.innerHTML = data.summaryReady
          ? '<a href="/__ratify/artifact/summary.md">summary.md</a><a href="/__ratify/artifact/summary.json">summary.json</a>'
          : '<span class="empty">writing summary…</span>';
      } else {
        banner.classList.remove('show');
      }
    }
  }
  async function tick() {
    try {
      const response = await fetch('/__ratify/board', { cache: 'no-store' });
      if (response.ok) render(await response.json());
    } catch (error) { /* server closing at the end of the run — keep the last render */ }
  }
  render(initial);
  setInterval(tick, 1500);
  tick();
</script>
</body></html>`;
}

function writeTaskArtifacts({ prepared, preview, decision, review, status, artifactsDir, startedAt, finishedAt }) {
  const { task, actions, results } = prepared;
  const audit = {
    taskId: task.id,
    title: task.title,
    repo: task.repo,
    baseBranch: task.baseBranch,
    workspace: rel(prepared.workspacePath),
    agent: 'mock agent (deterministic, no model calls)',
    startedAt,
    finishedAt,
    diff: prepared.diff,
    actions,
    filesRead: unique(actions.filter((action) => action.type === 'read').map((action) => action.target)),
    filesWritten: unique(actions.filter((action) => action.type === 'write').map((action) => action.target)),
    commandsRun: unique(actions.filter((action) => action.type === 'command').map((action) => action.target)),
    preview: { url: preview.url, startedAt: preview.events[0].ts, openedAt: preview.openedAt || null, summary: task.visibleChange },
    signOff: decision,
    events: preview.events,
    review: review ? { branch: review.branch, commit: review.commit, files: review.files, mr: 'mr.md' } : null,
    acceptance: results,
    status,
  };
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, 'report.md'), buildReport({ prepared, decision, preview, review, status, finishedAt }));
  fs.writeFileSync(path.join(artifactsDir, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
  const mrPath = path.join(artifactsDir, 'mr.md');
  if (review) fs.writeFileSync(mrPath, buildMr({ prepared, decision, review }));
  else fs.rmSync(mrPath, { force: true });
  return audit;
}

async function runSingle(opts, { task, repoPath }) {
  const startedMs = Date.now();
  const startedAt = new Date().toISOString();
  const workspacePath = path.resolve(opts.workspace);
  printTaskBlock(task);

  const prepared = prepareTask({ task, repoPath, workspacePath, quiet: false });
  prepared.preview = null;
  log(`workspace ready: ${rel(workspacePath)} (copy of ${task.repo} @ ${task.baseBranch})`);
  log(`collected ${prepared.actions.length} actions from .ratify/actions.jsonl`);
  printChangeBlock(prepared);
  for (const result of prepared.results) log(`${result.status} ${result.id} — ${result.description} — evidence: ${result.evidence}`);

  const preview = await startPreview(workspacePath, task.visibleChange, { review: buildReviewData(prepared) });
  prepared.preview = preview;
  log(`Preview: ${preview.url}`);
  log(`Showing the change: +${prepared.diff.added} −${prepared.diff.removed} · ${prepared.diff.files} file${prepared.diff.files === 1 ? '' : 's'}`);
  log(`visible change: ${task.visibleChange}`);
  let decision;
  if (opts.autoAccept) {
    decision = simulatedDecision(preview, task);
    log('simulated acceptance (test mode) — no human clicked');
  } else {
    log('open the URL above and click Accept change or Reject in the review bar');
    log('waiting for a human decision in the browser...');
    decision = await preview.waitForDecision();
    log(`${decision.actor} sign-off: ${decision.decision.toUpperCase()} at ${formatTime(decision.ts)}`);
  }
  await preview.close();
  preview.events.push(signOffEvent(decision));

  let review = null;
  if (prepared.checksPassed && decision.decision === 'accepted') review = acceptChange(prepared);
  const status = !prepared.checksPassed ? 'FAIL' : decision.decision === 'accepted' ? 'ACCEPTED' : 'REJECTED';
  const finishedAt = new Date().toISOString();
  writeTaskArtifacts({ prepared, preview, decision, review, status, artifactsDir: __dirname, startedAt, finishedAt });
  log(`wrote report.md${review ? ', mr.md' : ''} and audit.json (${Date.now() - startedMs}ms)`);
  log(`final status: ${status}`);
  if (status === 'FAIL') process.exitCode = 1;
}

async function runParallel(opts, { task: baseTask, repoPath }) {
  const runStarted = Date.now();
  const startedAt = new Date().toISOString();
  const tasks = makeParallelTasks(baseTask, opts.parallel);
  const workspaceRoot = path.resolve(opts.workspace);
  const runsRoot = path.join(__dirname, 'runs');
  fs.rmSync(runsRoot, { recursive: true, force: true });
  fs.rmSync(path.join(__dirname, 'summary.md'), { force: true });
  fs.rmSync(path.join(__dirname, 'summary.json'), { force: true });
  log(`parallel mode: ${tasks.length} independent tasks from ${baseTask.repo}`);

  const preparedTasks = tasks.map((task) => {
    const workspacePath = path.join(workspaceRoot, task.id);
    const prepared = prepareTask({ task, repoPath, workspacePath, quiet: true });
    log(`prepared ${task.id} — ${task.title} — ${diffLine(prepared.diff)} — checks ${prepared.checksPassed ? 'passing (support only)' : 'FAILED'}`);
    return prepared;
  });

  const state = { tasks: [], reviewUrl: null, startedAtMs: runStarted, summaryReady: false };
  for (const prepared of preparedTasks) {
    const preview = await startPreview(prepared.workspacePath, prepared.task.visibleChange, {
      getReviewHtml: () => buildReviewPage(state),
      getReviewState: () => boardSnapshot(state),
      artifacts: {
        md: path.join(__dirname, 'summary.md'),
        json: path.join(__dirname, 'summary.json'),
      },
      review: buildReviewData(prepared),
    });
    prepared.preview = preview;
    state.tasks.push({ task: prepared.task, prepared, preview, status: 'PENDING', decision: null });
  }
  state.reviewUrl = `${state.tasks[0].preview.url}review`;

  log(`${state.tasks.length} previews running in parallel (localhost only)`);
  console.log('');
  console.log(`  ${'task'.padEnd(11)} ${'diff'.padEnd(18)} preview`);
  for (const entry of state.tasks) {
    console.log(`  ${entry.task.id.padEnd(11)} ${diffLine(entry.prepared.diff).padEnd(18)} ${entry.preview.url}`);
  }
  console.log('');
  log(`review index: ${state.reviewUrl}`);

  if (opts.autoAccept) {
    for (const entry of state.tasks) {
      entry.decision = simulatedDecision(entry.preview, entry.task);
      entry.status = 'ACCEPTED';
      entry.preview.events.push(signOffEvent(entry.decision));
      log(`simulated acceptance (test mode) — ${entry.task.id}`);
    }
  } else {
    log('open the review index (or any preview URL); accept or reject each change independently');
    await Promise.all(state.tasks.map(async (entry) => {
      const decision = await entry.preview.waitForDecision();
      entry.decision = decision;
      entry.status = decision.decision === 'accepted' ? 'ACCEPTED' : 'REJECTED';
      entry.preview.events.push(signOffEvent(decision));
      log(`human sign-off — ${entry.task.id}: ${decision.decision.toUpperCase()} at ${formatTime(decision.ts)}`);
    }));
  }
  const results = state.tasks.map((entry) => {
    const { prepared } = entry;
    let review = null;
    if (prepared.checksPassed && entry.decision.decision === 'accepted') review = acceptChange(prepared);
    const status = !prepared.checksPassed ? 'FAIL' : entry.decision.decision === 'accepted' ? 'ACCEPTED' : 'REJECTED';
    entry.status = status;
    entry.review = review;
    const finishedAt = new Date().toISOString();
    const artifactsDir = path.join(runsRoot, entry.task.id);
    writeTaskArtifacts({ prepared, preview: entry.preview, decision: entry.decision, review, status, artifactsDir, startedAt, finishedAt });
    return {
      taskId: entry.task.id,
      title: entry.task.title,
      status,
      decision: entry.decision.decision,
      actor: entry.decision.actor,
      branch: review ? review.branch : null,
      commit: review ? review.commit : null,
      previewUrl: entry.preview.url,
      diff: prepared.diff,
      checksPassed: prepared.checksPassed,
      artifacts: {
        report: rel(path.join(artifactsDir, 'report.md')),
        audit: rel(path.join(artifactsDir, 'audit.json')),
        mr: review ? rel(path.join(artifactsDir, 'mr.md')) : null,
      },
    };
  });

  const elapsedMs = Date.now() - runStarted;
  const summary = {
    generatedAt: new Date().toISOString(),
    parallel: state.tasks.length,
    accepted: results.filter((result) => result.status === 'ACCEPTED').length,
    rejected: results.filter((result) => result.status === 'REJECTED').length,
    branchesCreated: results.filter((result) => result.branch).map((result) => result.branch),
    elapsedMs,
    reviewUrl: state.reviewUrl,
    tasks: results,
  };
  fs.writeFileSync(path.join(__dirname, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(__dirname, 'summary.md'), buildSummary(summary));
  state.summaryReady = true;
  log(`summary: ${summary.tasks.length} tasks · ${summary.accepted} accepted · ${summary.rejected} rejected · ${summary.branchesCreated.length} branches · ${elapsedMs}ms`);
  log('wrote summary.md, summary.json and per-task artifacts in runs/');
  // Give the board (polling every 1.5s) a moment to show the run-complete banner
  // before the per-task preview servers shut down (interactive runs only; the
  // automated --auto-accept path stays fast).
  if (!opts.autoAccept) {
    await new Promise((resolve) => setTimeout(resolve, 2600));
  }
  for (const entry of state.tasks) await entry.preview.close();
  if (results.some((result) => result.status === 'FAIL')) process.exitCode = 1;
}

async function main() {
  const opts = parseCli(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }
  const loaded = loadTask(opts);
  if (opts.parallel) await runParallel(opts, loaded);
  else await runSingle(opts, loaded);
}

main().catch((error) => {
  console.error(`[ratify] error: ${error.message}`);
  process.exitCode = 1;
});
