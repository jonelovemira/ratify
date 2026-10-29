# Ratify — clean-room prototype

> **Generated ≠ accepted.** Automated checks are support. A human has to see the change with their own eyes and sign off before anything ships.

Ratify is an AI agent platform for air-gapped enterprises. Coding agents work inside the customer's private network and produce a **stream of diffs** — faster than any person can review one at a time. Every diff becomes a live local preview; previews run in parallel; a human works through the queue and accepts or rejects each change visually. Only an accepted change becomes a branch, a merge request, a report and an audit trail.

This folder is a working prototype of that loop, single or parallel. It runs locally and deterministically: **no network calls beyond localhost, no model calls, no runtime dependencies.**

**In 30 seconds:** agents produce a stream of diffs → each diff opens as a **live localhost preview** → N previews run **in parallel** behind one review index → a **human looks at each change and clicks Accept/Reject** → accepted changes become **branches + MR descriptions + reports + audit trails**, with an aggregate summary. Automated checks are support, not acceptance.

## Demo video

[`demo/boundary-demo.mp4`](demo/boundary-demo.mp4) — a 41.8-second, 1920x1080 motion-graphics film: the left quarter is a live diff feed (1,000+ a day), the right three quarters are a persistent preview grid that snaps from 1 to 4 windows and then scales 4 → 9 → 16 → 25 in calm bursts (at most 3 cards in the air, ~1.3s between claims), driven by reviewer avatars; each stage swaps in a new bottom line ("One diff. One human review." → "Reviews run in parallel." → "Review capacity scales." → "The queue becomes a grid." → "Human review at agent speed."), and each preview is stamped ACCEPTED or REJECTED on its own beat before its window disappears and the slot refills, then *"Diffs arrive in parallel. Review them in parallel."* and *"A human must see it before it ships."* Silent; timed voiceover script in [`demo.md`](demo.md). Rendered from code with Remotion, so it always matches the prototype's real output.

To re-render after editing the film: `cd demo-video && npm install && npm run render` — see `demo-video/README.md`.

## The loop

```
   stream of tasks (same repo)
   task-001  task-002  task-003  task-004  ...        agents keep producing diffs
      |          |          |          |
      v          v          v          v
   workspace  workspace  workspace  workspace         one copy each, inside the boundary
      |          |          |          |
      v          v          v          v
   live preview live preview live preview ...          N localhost preview servers, at once
      \          |          |          /
       +---------+----------+---------+
                 |
        /review queue index: diff stats + links
                 |
     human looks at each change and clicks
          ACCEPT / REJECT (each independent)
                 |
        +--------+---------+
        v                  v
  accepted: branch,    rejected: nothing
  commit, mr.md,       committed; report.md
  report.md,           still records REJECTED
  audit.json           + reason
                 |
                 v
   summary.md + summary.json (accepted/rejected counts, elapsed, branches)
```

## How to run

Requires Node.js 18+ and `git` on PATH (git is used only after a human accepts, to create the review branch). Nothing to install.

**Single change (interactive):**

```bash
cd boundary-prototype
node run.js --task task.json --workspace ./workspace
# terminal prints "Preview: http://localhost:PORT/"; open it, look at the change,
# click Accept (or Reject) in the review bar
cat report.md && cat mr.md && cat audit.json
```

**Parallel queue (interactive) — the product's real shape:**

```bash
node run.js --task task.json --workspace ./workspace --parallel 4
# default N=4, allowed 1-8. Prints a table of task branches + preview URLs,
# a review index URL, and waits for one human decision per task.
# The review index is a swimlane board: IN REVIEW / ACCEPTED / REJECTED.
# "Open review" opens the task's two-panel preview inside a slide-in drawer
# (72% width; close with ×, ESC, or the scrim) — the board stays behind and keeps
# polling. Cards move when a decision is posted (the board polls every 1.5s) and
# the drawer closes automatically ~0.8s after the decision; when every task is
# decided the board shows a run-complete banner with accepted/rejected counts,
# branches created, elapsed time and links to summary.md / summary.json.
# Embedded views use ?embed=1, which hides the review-queue link.
```

**Parallel queue (deterministic test path — simulated acceptance, clearly labeled):**

```bash
node run.js --task task.json --workspace ./workspace --parallel 2 --auto-accept
node run.js --task task.json --workspace ./workspace --parallel 8 --auto-accept   # up to 8
node test.js     # runs --parallel 2 --auto-accept and checks everything below
```

Outputs: single mode writes `report.md`, `mr.md`, `audit.json` next to `run.js`. Parallel mode writes per-task artifacts in `runs/<task-id>/` (`report.md`, `audit.json`, and `mr.md` only for accepted tasks) plus aggregate `summary.md` and `summary.json` (task count, accepted/rejected counts, branches created, elapsed time, review-index URL). `workspace/` is recreated on every run and never committed.

## What you will see

A single run prints the input, then the change, then the preview — in this order:

1. **Task block** — before the agent runs (read straight from `task.json`):

   ```text
   TASK task-001 — Add a health card to the counter page
   repo: ./demo-repo (base: main)
   visible change: A green 'Health check: ok' card appears below the counter.
   acceptance:
     AC1 — index.html contains the health card element
     AC2 — the page shows 'Health check: ok'
     AC3 — app.js exposes health() returning status ok
   ```

2. **Change block** — after the agent finishes, before the preview URL:

   ```text
   WHAT THE AGENT CHANGED
    app.js     | 9 +++++++++
    index.html | 8 ++++++++
    2 files changed, 17 insertions(+)

   --- diff (first 30 lines) ---
   <git diff of the working tree vs. HEAD, truncated>
   ```

3. **Preview** — the URL, plus one line restating the change:
   `Preview: http://localhost:PORT/` then
   `Showing the change: +17 −0 · 2 files`. Open the URL: it is a **two-panel review page** — task title, visible change, acceptance criteria (PASS/FAIL + evidence), the agent's diff and a compact action list on the left; the real rendered page in an iframe on the right; the RATIFY REVIEW accept/reject bar at the bottom. The raw page stays available at `/__page/index.html` (used by the iframe).

4. **Sign-off** — your Accept/Reject is recorded with actor, timestamp, decision and what was shown: `Human sign-off: ACCEPTED at <time>` in `report.md`, `sign_off` in `audit.json`.

5. **Branch** — only after acceptance: a commit on the feature branch, `mr.md`, and the report ends with `Branch ready for review: task-001`.

## The acceptance rule

Automated checks passing does not ship a change. The prototype enforces one gate: an explicit human decision in the preview page (single mode) or in each preview from the review index (parallel mode). The audit trail records it as `sign_off` with `actor: human`, a timestamp, the decision, and what was shown (preview URL + visible-change summary). Branch commits and `mr.md` happen only after that event. In tests, `--auto-accept` simulates the click and is labeled **simulated acceptance** everywhere — stdout, `report.md`, `audit.json`, `summary.md`/`summary.json`.

## Files

| Path | What it is |
|---|---|
| `run.js` | CLI: single change or `--parallel [N]`; workspaces, agent, checks, previews, human decisions, branches, artifacts, summary |
| `preview.js` | Localhost-only preview server(s): serves a workspace, injects the Accept/Reject review bar, serves the shared `/review` queue index |
| `task.json` | Sample task: id, repo, base branch, visible change, 3 deterministic criteria (used as the template for N tasks) |
| `demo-repo/` | Tiny generic sample project the agent modifies (`index.html`, `app.js`, `README.md`) |
| `agent.js` | Mock agent: visible page change + `health()`, 6 journaled actions per task |
| `test.js` | End-to-end self-check: 2-task parallel queue with simulated acceptance + single-mode smoke check |
| `demo.md` | Timed voiceover script for the 67-second film |
| `demo/boundary-demo.mp4` | The motion-graphics demo (silent, 1920x1080) |
| `demo-video/` | Remotion source for the film — build-time tooling only |

## What is real vs. mocked

| Part | In this prototype |
|---|---|
| Task stream | N copies of one sample task, created on the fly — not a real ticketing feed |
| Parallel workspaces | N real folders under `workspace/`, each with its own base commit and branch |
| Coding agent | `agent.js`, a fixed script — not a model |
| Action journal | real, append-only JSONL per workspace |
| Automated checks | real and deterministic — explicitly framed as support, not acceptance |
| Live previews | N real localhost HTTP servers at once, 127.0.0.1 only |
| Review queue | a real `/review` index listing diffs + links, auto-refreshing decision status |
| Human sign-off | real clicks in the browser review bar; per-task gate for branch/commit; `--auto-accept` is clearly labeled simulated test mode |
| Branch + MR | real git branch/commit per accepted task and a generated `mr.md` (no forge integration) |
| Artifacts | per-task `report.md`/`audit.json` (+`mr.md`) and aggregate `summary.md`/`summary.json` |
| Demo film | rendered from code with Remotion; prototype numbers are real, the rest of the stream is illustrative |

Status: **clean-room prototype; no model calls.** It is built to show the parallel human-acceptance loop, not to prove production isolation or security.

## Deliberately out of scope

Model quality and autonomy, network egress control, sandbox hardening, identity, multi-tenancy, persistence, and real forge/CI integration. Each of those is a real product requirement — none of them is demonstrated here.
