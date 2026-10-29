#!/usr/bin/env node
// End-to-end self-check: runs a 2-task parallel queue with SIMULATED acceptance,
// then verifies per-task branches/artifacts, the aggregate summary, and single mode.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const here = __dirname;
const summaryPath = path.join(here, 'summary.json');
const summaryMdPath = path.join(here, 'summary.md');
const taskIds = ['task-001', 'task-002'];

function check(label, assertion) {
  assertion();
  console.log(`ok — ${label}`);
}

// --auto-accept = simulated acceptance, so this test is deterministic and needs no browser.
const started = Date.now();
const run = spawnSync(process.execPath, ['run.js', '--task', 'task.json', '--workspace', './workspace', '--parallel', '2', '--auto-accept'], { cwd: here, encoding: 'utf8' });
const elapsed = Date.now() - started;

check('run.js exits 0 (acceptance was simulated)', () => assert.equal(run.status, 0, `run.js failed:\n${run.stdout}\n${run.stderr}`));
check('the automated parallel run finishes in under 5 seconds', () => assert.ok(elapsed < 5000, `took ${elapsed}ms`));
check('output labels simulated acceptance and parallel previews', () => {
  assert.match(run.stdout, /simulated acceptance \(test mode\)/i);
  assert.match(run.stdout, /previews running in parallel/);
});
check('output prints a review index URL and per-task preview URLs', () => {
  assert.match(run.stdout, /review index: http:\/\/localhost:\d+\/review/);
  const urls = run.stdout.match(/http:\/\/localhost:\d+\//g) || [];
  assert.ok(urls.length >= 2, 'expected at least two preview URLs');
});
check('summary.json and summary.md exist', () => {
  assert.ok(fs.existsSync(summaryPath), 'summary.json is missing');
  assert.ok(fs.existsSync(summaryMdPath), 'summary.md is missing');
});

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const summaryMd = fs.readFileSync(summaryMdPath, 'utf8');

check('summary counts and metadata are correct', () => {
  assert.equal(summary.parallel, 2);
  assert.equal(summary.tasks.length, 2);
  assert.equal(summary.accepted, 2);
  assert.equal(summary.rejected, 0);
  assert.equal(summary.branchesCreated.length, 2);
  assert.ok(Number.isFinite(summary.elapsedMs) && summary.elapsedMs >= 0);
  assert.match(summary.reviewUrl, /^http:\/\/localhost:\d+\/review$/);
});
check('summary.md lists the aggregate counts and both tasks', () => {
  assert.match(summaryMd, /Accepted: 2/);
  assert.match(summaryMd, /Rejected: 0/);
  for (const id of taskIds) assert.match(summaryMd, new RegExp(id));
});
check('per-task artifacts, branches and previews are independent', () => {
  for (const id of taskIds) {
    const dir = path.join(here, 'runs', id);
    for (const file of ['report.md', 'audit.json', 'mr.md']) assert.ok(fs.existsSync(path.join(dir, file)), `${id}/${file} is missing`);

    const audit = JSON.parse(fs.readFileSync(path.join(dir, 'audit.json'), 'utf8'));
    assert.equal(audit.taskId, id);
    assert.equal(audit.status, 'ACCEPTED');
    assert.equal(audit.signOff.actor, 'simulated');
    assert.equal(audit.signOff.decision, 'accepted');
    assert.deepEqual(audit.events.map((event) => event.type), ['preview_started', 'sign_off', 'branch_created', 'commit_created']);
    assert.match(audit.review.commit, /^[0-9a-f]{7,}$/);
    assert.equal(audit.review.branch, id);
    assert.equal(audit.acceptance.length, 3);
    assert.ok(audit.acceptance.every((criterion) => criterion.status === 'PASS'));

    const report = fs.readFileSync(path.join(dir, 'report.md'), 'utf8');
    assert.match(report, /Human sign-off: ACCEPTED at \d{4}-\d{2}-\d{2}/);
    assert.match(report, /Branch ready for review: task-/);
    assert.match(report, /simulated \(test mode — no human clicked\)/i);

    const mr = fs.readFileSync(path.join(dir, 'mr.md'), 'utf8');
    assert.match(mr, /^# MR:/m);
    assert.match(mr, /audit\.json/);

    const workspace = path.join(here, 'workspace', id);
    const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workspace, encoding: 'utf8' });
    assert.equal(branch.stdout.trim(), id);
    const lastCommit = spawnSync('git', ['log', '--format=%s', '-1'], { cwd: workspace, encoding: 'utf8' });
    assert.match(lastCommit.stdout, new RegExp(id));
    assert.match(fs.readFileSync(path.join(workspace, 'index.html'), 'utf8'), /id="health-card"/);
  }
});

const single = spawnSync(process.execPath, ['run.js', '--task', 'task.json', '--workspace', './workspace', '--auto-accept'], { cwd: here, encoding: 'utf8' });
check('single-change mode still works', () => {
  assert.equal(single.status, 0, `single run failed:\n${single.stdout}\n${single.stderr}`);
  assert.match(single.stdout, /final status: ACCEPTED/);
  assert.ok(fs.existsSync(path.join(here, 'report.md')));
  assert.ok(fs.existsSync(path.join(here, 'mr.md')));
});

console.log('\ntest.js — all checks passed (2 parallel tasks + single mode; human acceptance simulated)');
