# Ratify demo video (Remotion)

The application demo is a **41.8-second, 1920x1080, 30fps motion-graphics film** built from code in this folder (no screen recording, no stock footage). Rendered output:

- `../demo/boundary-demo.mp4` — the film (silent; every beat carries on-screen text)
- `../demo/boundary-demo-poster.png` — poster frame

This folder is **build-time tooling only**. The prototype itself (`run.js`, `preview.js`, `agent.js`, `test.js`) remains zero-dependency and offline — Remotion is needed only to re-render the film.

## What the film argues

**Generated ≠ accepted.** Diffs now arrive faster than a person can review them one by one. Previews run in parallel; human visual acceptance is the layer that turns the stream into shipped changes. The film is a stream visualization, not a fixed grid:

0. **The premise, stated once up front:** *"Checks passed. ≠ ACCEPTED."* — a human still has to look. It is never revisited in the middle.
1. One diff is served live by the platform as a preview (brief setup): *"One diff. One live preview."* — *"a human can only accept what they can see"*.
2. One continuous split screen: the **left 1/4** is a live diff-generation swim lane (1,000+ incoming counter). New diffs are **inserted at the top** every ~0.9s — they pop in with a `+ NEW` marker, the column shifts down, old cards slide out the bottom.
3. **Diffs are dragged from the feed into a persistent preview grid — in bursts.** The single preview lands in under 2s; then the grid snaps to **4** almost instantly (one ripple), and expands **4 → 9 → 16 → 25** in calm bursts — at most 3 cards in the air, ~1.3s between claims — each stage triggered by a burst of 3–5 diff cards flying in at once. The reviewer's avatar rides on the card and stays in the panel header (six different users A/K/M/R/S/T). Panels are **never cleared**: existing previews keep their content and re-lay out into the smaller cells. Consumption is also **out of order**: the cards are pulled from random positions in the feed, not always the first one. Every panel then reviews on its **own randomized beat** — a big **ACCEPTED** (green) or **REJECTED** (red) stamp slams onto each preview independently, so the grid keeps settling at different times instead of pulsing in sync.
4. End cards: *"Diffs arrive in parallel. Review them in parallel."* then *"A human must see it before it ships."*

The middle never cuts back to checks: automated checks are support, not a stage — the premise is assumed, the human layer is shown.

On-screen detail is deliberately stripped to diff stats (`+X −Y`, files), preview thumbnails, and Accept/Reject. There are no AC1/AC2/AC3 explanations in the film.

## Timeline

| Time | Scene | Beat |
|---|---|---|
| 0:00.0–0:03.5 | Title | Ratify — "Human acceptance for AI agent work, inside your network." |
| 0:03.5–0:07.5 | 00 THE PREMISE | cold statement **"Checks passed. ≠ ACCEPTED."** (≠ in violet) — stated once, up front |
| 0:07.5–0:12.5 | 01 EVERY TASK DIFF | **"Every task diff. Its own live preview."**; `task-001 · main → task-001 · +17 −0 · 2 files`; *"served live by the platform"*; page + review bar |
| 0:12.5–0:34.5 | 02 DIFF FEED → PARALLEL REVIEW | left 1/4 diff swim lane; right 3/4 persistent preview grid: 1 preview in ~2s, near-instant snap to 4, then 4→9→16→25 in ~2s stages with bursts of 3–5 diff cards flying in together; acceptance sweeps the grid in batches (several ACCEPTED stamps per beat) |
| 0:31.8–0:36.8 | End card | **"Diffs arrive in parallel. Review them in parallel."** |
| 0:36.8–0:41.8 | End card | **"A human must see it before it ships."** / `GENERATED ≠ ACCEPTED` |

Every technical number that refers to the prototype (task-001 diff +17 −0, 2 files, the preview page, the review bar) matches a real `run.js` run. The remaining stream cards are illustrative of a busy queue.

## Re-render

```bash
cd demo-video
npm install
npm run render      # -> ../demo/boundary-demo.mp4
npm run poster      # -> ../demo/boundary-demo-poster.png
npm run studio      # interactive preview / timeline editor
```

Remotion downloads a headless Chrome shell on first render, or reuse an installed browser:

```bash
REMOTION_BROWSER_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run render
```

## Editing

| File | Responsibility |
|---|---|
| `src/theme.ts` | colors, fonts, and the scene durations (`SCENES`) — change timings here |
| `src/scenes.tsx` | title, opening premise, one-diff, and the two end cards |
| `src/stream.tsx` | the split diff-feed + big-screen parallel-review flow scene |
| `src/preview-ui.tsx` | diff cards, mini browser previews with the review bar, cursor, task stream data |
| `src/components.tsx` | shared motion primitives: panels, captions, typewriter, PASS stamp, arrows |
| `src/BoundaryDemo.tsx` (component name kept for file-path stability) | assembles the scenes, header, and progress line |

All motion is frame-driven with `useCurrentFrame()` / `spring()` / `interpolate()`; there are no CSS transitions, so the render is deterministic.

## Constraints kept

- No external assets, no downloaded fonts, no audio: the film is silent by design so a founder voiceover can be layered on (script in `../demo.md`).
- No company names, no internal system names, no customer data.
- The preview UI in the film mirrors the real localhost preview page and review bar from `preview.js`.
