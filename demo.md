# Demo — 67-second stream film + voiceover

The application demo is a **rendered motion-graphics film**, not a screen recording: `demo/boundary-demo.mp4` (1920x1080, 30fps, 41.8 seconds, silent). It is generated from code, so it is repeatable and always matches the prototype's real output.

**The argument the film has to land:** agents now produce a stream of diffs faster than humans can review them one by one. Automated checks passing is not acceptance. Previews run in parallel on the platform — so human review can run in parallel too. **Human eyes are the acceptance layer.**

The middle is one continuous split screen: the **left quarter** is a live diff-generation swim lane (1,000+ a day, cards flowing continuously); the **right three quarters** are a big-screen parallel review wall. New diffs are inserted at the top of the left lane (a `+ NEW` card pops in above the stack, the column shifts down, old cards slide out the bottom). On the right, each claim is the previous drag: a **diff card is pulled out of the feed and dropped into a preview slot**, while the claiming reviewer's avatar (six different users) rides on the card and stays in the panel header. Claims arrive in **shuffled slot order**, and the grid scales **1 → 4 → 9 → 16 → 25 live previews** — existing panels are **never cleared**, they keep their content and smoothly re-lay out into the smaller cells as new slots are claimed. Accepted previews get a big green ACCEPTED stamp, rejected ones a red REJECTED stamp — each on its own randomized beat. On-screen detail is deliberately stripped to diff stats (`+X −Y`, files), preview thumbnails, and Accept/Reject — there are **no AC1/AC2/AC3 explanations in the film**.

- Film: `demo/boundary-demo.mp4`
- Poster: `demo/boundary-demo-poster.png`
- Source: `demo-video/` (Remotion; `demo-video/README.md` explains how to re-render)

## Exact timeline for the voiceover

| Time | Length | Scene | On screen | Say |
|---|---|---|---|---|
| 0:00.0–0:03.5 | 3.5s | Title | RATIFY; "Coding agents that work inside the enterprise boundary." | "This is Ratify: a coding agent platform for companies that keep their code behind a wall." |
| 0:03.5–0:07.5 | 4s | **00 THE PREMISE** | **"Checks passed. ≠ ACCEPTED."** (≠ in violet) / "a human still has to look" | "Checks passed is not ACCEPTED — a human has to look with their own eyes." |
| 0:07.5–0:12.5 | 5s | 01 EVERY TASK DIFF | diff card `task-001 · main → task-001 · +17 −0 · 2 files`; **"served live by the platform"**; footer **"a human can only accept what they can see"** | "The agent produces a diff — here, a health card on a page. The platform serves it as a live preview, so a human can actually see it." |
| 0:12.5–0:31.8 | 19.3s | 02 DIFF FEED → PARALLEL REVIEW | first preview in ~2s; **snap to 4 windows**; then **4 → 9 → 16 → 25** stages, each a calm burst (max 3 cards in the air, ~1.3s between claims); each expansion swaps the bottom line — "One diff. One human review." → "Reviews run in parallel." → "Review capacity scales." → "The queue becomes a grid." → "Human review at agent speed."; every preview gets its own ACCEPTED/REJECTED stamp, then the window disappears and its slot refills after a short pause | "The first preview takes a look. Then the grid snaps wide: four, nine, sixteen, twenty-five windows — diffs fly in a calm burst, not a swarm. And the scale readout climbs as the board grows: the team's review capacity keeps scaling with the work." |
| 0:31.8–0:36.8 | 5s | End card 1 | **"Diffs arrive in parallel. Review them in parallel."** | "Diffs arrive in parallel. Review them in parallel." |
| 0:36.8–0:41.8 | 5s | End card 2 | **"A human must see it before it ships."** / GENERATED ≠ ACCEPTED | "A human must see it before it ships." |

Total: **41.8 seconds.** Target pace: about 105 spoken words. The film is silent, so your voice sits on top of it without ducking.

## Why it is cut this way

- **The opening establishes the unit.** One diff is served live by the platform as a preview — a human can only accept what they can see. The stream scene then scales that unit to many.
- **The middle is one flow, not two stages.** Left 1/4 = diff generation lane; right 3/4 = a persistent preview grid that snaps 1 → 4 → 9 → 16 → 25 without clearing, then hands off to the end cards. Claims are pulled from random spots in the feed and fly in as calm bursts (at most 3 cards in the air, ~1.3s between claims), each tagged with the reviewer's avatar; each expansion changes the bottom line ("One diff. One human review." → "Reviews run in parallel." → "Review capacity scales." → "The queue becomes a grid." → "Human review at agent speed.") so the scale-up is felt through copy rather than numbers. Every panel is stamped independently — big green ACCEPTED or red REJECTED, on its own randomized beat — then the window shrinks away and its slot refills after a short pause: a continuous stream of reviewers, not one queue and not a batch update.
- **The premise is stated once, up front.** "Checks passed. ≠ ACCEPTED." is the opening statement, before the preview thread starts. After that the film never cuts back to checks or explains a checks stage — it assumes the premise and spends its middle showing the answer: live previews + human acceptance.
- **The sequence is preview-first throughout:** premise → diff → live preview → queue of live previews → human accepts in parallel → ship. No interruption of the preview thread.
- **Human review is the longest human beat.** The cursor accepts previews one by one; accepted count climbs 3 → 4 → 5 while the stream keeps refilling. The point is parallel throughput, not one hero task.
- **End cards state the thesis**, ending on "A human must see it before it ships."

## Recording it

1. Watch the film once with the timeline above in front of you.
2. Record the voiceover in one take (phone or QuickTime, quiet room). Give the premise (0:03.5) a beat of air so "that's not acceptance" lands before the preview thread starts.
3. Lay the voiceover over `demo/boundary-demo.mp4` in any editor and export H.264, 1920x1080.
4. Check that "not acceptance" lands in the checks beat, and that "A human must see it before it ships." lands on the final card.
5. Upload where the application asks for a video link; keep the silent film as fallback if time runs short.

## Say this, not that

- Say: "stream of diffs", "parallel previews", "human visual acceptance", "human sign-off", "prototype", "mock agent", "no network calls", "no model calls".
- Do not claim: production-grade isolation, compliance certification, or real model quality — none of that is demonstrated.
- The agent in this prototype is a fixed script, and the queue is generated from one sample task. The film shows the acceptance loop, not AI autonomy or real customer volume.

## Appendix — live interactive demo fallback

Run a parallel queue and work the review index on screen:

```bash
node run.js --task task.json --workspace ./workspace --parallel 4
```

The terminal prints a preview table and `review index: http://localhost:PORT/review`. Open the review index, open any preview, look at the green "Health check: ok" card, and click **Accept change** (or **Reject** with a reason) in the Ratify review bar for each task. The run finishes when every task has a decision; then show `cat summary.md` and `git -C workspace/task-001 log --oneline --decorate -1`.

Do **not** use `--auto-accept` on camera: that flag is a labeled simulation for tests only.
