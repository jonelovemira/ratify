import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, CLAMP, easeOut, SceneFrame } from './components';
import { THEME } from './theme';
import { DiffCard, Mono, TASKS, diffStats } from './preview-ui';

const FLOW = 580;
const INSERT_EVERY = 16;
const LANE_TOP = 252;
const LANE_H = 640;
const LANE_W = 432;
const LANE_STEP = 96;
const ACCEPT_BASE = 1208;

/* Fast, bursty pacing: 1 preview in ~2s, 1→4 snaps, then 4→9→16→25 in 2–2.5s stages. */
const AREA = { x: 512, y: 252, w: 1388, h: 650 };
const PHASES = [
  { cols: 1, rows: 1, gap: 0 },
  { cols: 2, rows: 2, gap: 24 },
  { cols: 3, rows: 3, gap: 18 },
  { cols: 4, rows: 4, gap: 14 },
  { cols: 5, rows: 5, gap: 12 },
];
const SLOT_COUNTS = [1, 4, 9, 16, 25];
const PHASE_STARTS = [0, 70, 170, 280, 410];
const FLIGHT = 20;

/* deterministic pseudo-randomness: every panel reviews on its own beat */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const shuffled = (list: number[], seed: number) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(hash(seed + i * 17) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const phaseAt = (frame: number) => {
  if (frame < 70) return 0;
  if (frame < 170) return 1;
  if (frame < 280) return 2;
  if (frame < 410) return 3;
  return 4;
};

const gridRect = (phase: number, index: number) => {
  if (phase === 0) {
    return { x: AREA.x + 120, y: AREA.y + 40, w: AREA.w - 240, h: AREA.h - 80 };
  }
  const layout = PHASES[phase];
  const cellW = (AREA.w - layout.gap * (layout.cols - 1)) / layout.cols;
  const cellH = (AREA.h - layout.gap * (layout.rows - 1)) / layout.rows;
  const col = index % layout.cols;
  const row = Math.floor(index / layout.cols);
  return { x: AREA.x + col * (cellW + layout.gap), y: AREA.y + row * (cellH + layout.gap), w: cellW, h: cellH };
};
const inset = (rect: { x: number; y: number; w: number; h: number }) => ({
  x: rect.x + rect.w * 0.14,
  y: rect.y + rect.h * 0.14,
  w: rect.w * 0.72,
  h: rect.h * 0.72,
});

type Claim = {
  start: number;
  slot: number;
  avatar: number;
  taskIndex: number;
  variant: number;
  action: 'accept' | 'reject';
  acceptAt: number;
  disappearAt: number;
  sourceOffset: number;
};

/* Each slot runs its own loop: diff dragged in -> preview -> stamp -> disappear -> immediate refill. */
const SLOT_FIRST_START: Record<number, number> = (() => {
  const map: Record<number, number> = { 0: 0 };
  [1, 2, 3].forEach((slot) => {
    map[slot] = 75;
  });
  [4, 5, 6, 7, 8].forEach((slot) => {
    map[slot] = slot <= 5 ? 175 : slot <= 7 ? 211 : 247;
  });
  [9, 10, 11, 12, 13, 14, 15].forEach((slot) => {
    map[slot] = 285 + Math.floor((slot - 9) / 2) * 36;
  });
  [16, 17, 18, 19, 20, 21, 22, 23, 24].forEach((slot) => {
    map[slot] = slot <= 17 ? 415 : slot <= 19 ? 451 : slot <= 21 ? 487 : 523;
  });
  return map;
})();

const CLAIMS: Claim[] = [];
const CLAIM_WINDOWS: Array<[number, number]> = [];
let claimSeed = 0;
const overlapCount = (start: number) =>
  CLAIM_WINDOWS.filter(([from, to]) => start < to && start + FLIGHT > from).length;

const makeClaim = (slot: number, requestedStart: number): Claim => {
  let start = requestedStart;
  while (start < FLOW && overlapCount(start) >= 3) start += 8;
  const idx = claimSeed;
  claimSeed += 1;
  const acceptAt = start + FLIGHT + 12 + Math.floor(hash(idx * 29 + 11) * 26);
  const hold = 16 + Math.floor(hash(idx * 37 + 13) * 12);
  const disappearAt = acceptAt + hold;
  const action: 'accept' | 'reject' = idx > 0 && hash(idx * 43 + 17) < 0.22 ? 'reject' : 'accept';
  const claim: Claim = {
    start,
    slot,
    avatar: idx % 6,
    taskIndex: (idx * 5 + 3) % TASKS.length,
    variant: (idx * 2 + 1) % 6,
    action,
    acceptAt,
    disappearAt,
    sourceOffset: Math.floor(hash(idx * 31 + 3) * 6),
  };
  CLAIMS.push(claim);
  CLAIM_WINDOWS.push([start, start + FLIGHT]);
  return claim;
};

/* expansion seeds: clean bursts with at most 3 cards in the air */
Array.from({ length: 25 })
  .map((_, slot) => ({ slot, start: SLOT_FIRST_START[slot] ?? 0 }))
  .sort((a, b) => a.start - b.start)
  .forEach((seed) => {
    if (seed.start < FLOW) makeClaim(seed.slot, seed.start);
  });

/* refills: after a panel disappears, wait ~1.3s, then claim the next diff */
let pendingRefills: Array<{ slot: number; desired: number }> = CLAIMS.map((claim) => ({
  slot: claim.slot,
  desired: claim.disappearAt + 40,
}));
while (pendingRefills.length > 0) {
  pendingRefills.sort((a, b) => a.desired - b.desired);
  const next = pendingRefills.shift();
  if (!next || next.desired >= FLOW) continue;
  const claim = makeClaim(next.slot, next.desired);
  if (claim.start < FLOW) pendingRefills.push({ slot: claim.slot, desired: claim.disappearAt + 40 });
}
CLAIMS.sort((a, b) => a.start - b.start);

const CLAIMS_BY_SLOT = new Map<number, Claim[]>();
for (const claim of CLAIMS) {
  const list = CLAIMS_BY_SLOT.get(claim.slot) ?? [];
  list.push(claim);
  CLAIMS_BY_SLOT.set(claim.slot, list);
}
for (const list of CLAIMS_BY_SLOT.values()) list.sort((a, b) => a.start - b.start);

const AVATARS = [
  { initial: 'A', color: '#8b7cff' },
  { initial: 'K', color: '#2ea043' },
  { initial: 'M', color: '#e3a008' },
  { initial: 'R', color: '#db61a2' },
  { initial: 'S', color: '#38bdf8' },
  { initial: 'T', color: '#f97316' },
];

const Avatar = ({ index, size = 28, dim = false }: { index: number; size?: number; dim?: boolean }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      background: AVATARS[index].color,
      display: 'grid',
      placeItems: 'center',
      color: '#fff',
      fontWeight: 700,
      fontSize: size * 0.42,
      fontFamily: THEME.sans,
      border: '2px solid rgba(255,255,255,0.16)',
      opacity: dim ? 0.45 : 1,
      flex: '0 0 auto',
    }}
  >
    {AVATARS[index].initial}
  </div>
);

const TITLES = ['Counter', 'Tasks', 'Settings', 'Usage', 'Profile', 'Deployments'];
const ROWS = [
  ['Count: 0', 'Add one'],
  ['Rotate keys ✓', 'Ship audit log ✓'],
  ['SSO: ON', 'Audit log: ON'],
  ['12.4k runs', '+18% week'],
  ['Mira K.', 'Platform admin'],
  ['v2.4.1 · healthy', 'v2.4.0 · healthy'],
];

/* Page mock inside the browser window (no review bar here anymore). */
const PageMock = ({ variant, tier }: { variant: number; tier: 'large' | 'medium' | 'small' }) => {
  if (tier === 'large') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#f7f8fa', color: '#1c2430', padding: '16px 20px', overflow: 'hidden' }}>
        <Mono color="#8a94a6" size={10} style={{ letterSpacing: '0.14em' }}>DEMO APP</Mono>
        <div style={{ fontSize: 26, fontWeight: 700 }}>{TITLES[variant]}</div>
        {ROWS[variant].map((line, i) => (
          <div key={line} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginRight: 10, marginTop: 10, padding: '6px 10px', border: '1px solid #dde3ec', borderRadius: 7, background: '#fff', fontSize: 13, color: '#1c2430' }}>
            {i === 0 && <span style={{ width: 7, height: 7, borderRadius: 4, background: '#2e7d32' }} />}
            {line}
          </div>
        ))}
      </div>
    );
  }
  const compact = tier === 'small';
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#f7f8fa', color: '#1c2430', padding: compact ? '4px 6px' : '9px 11px', overflow: 'hidden' }}>
      {!compact && <Mono color="#8a94a6" size={8} style={{ letterSpacing: '0.14em' }}>DEMO APP</Mono>}
      <div style={{ fontSize: compact ? 9 : 15, fontWeight: 700, lineHeight: 1.15 }}>{TITLES[variant]}</div>
      {!compact &&
        ROWS[variant].map((line) => (
          <div key={line} style={{ marginTop: 4, padding: '3px 6px', background: '#fff', border: '1px solid #dde3ec', borderRadius: 4, fontSize: 9 }}>
            {line}
          </div>
        ))}
      {compact && (
        <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
          <div style={{ height: 4, flex: 2, borderRadius: 2, background: '#2e7d32' }} />
          <div style={{ height: 4, flex: 3, borderRadius: 2, background: '#c7d2e0' }} />
        </div>
      )}
    </div>
  );
};

const chromeHeight = (tier: 'large' | 'medium' | 'small') => (tier === 'large' ? 34 : tier === 'medium' ? 24 : 16);
const footerHeight = (tier: 'large' | 'medium' | 'small') => (tier === 'large' ? 34 : tier === 'medium' ? 24 : 16);

/* Browser chrome: traffic lights + URL pill (+ tab title / reviewer on larger tiers). */
const BrowserChrome = ({
  claim,
  tier,
  title,
  accepted,
  rejected,
}: {
  claim: Claim | null;
  tier: 'large' | 'medium' | 'small';
  title?: string;
  accepted?: boolean;
  rejected?: boolean;
}) => {
  const h = chromeHeight(tier);
  const dot = tier === 'large' ? 7 : tier === 'medium' ? 5 : 4;
  const url = claim ? `${TASKS[claim.taskIndex].id}.preview.internal` : 'preview.internal/…';
  return (
    <div style={{ height: h, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: tier === 'small' ? 5 : 9, padding: tier === 'small' ? '0 6px' : '0 10px', background: '#0b1220', borderBottom: `1px solid ${THEME.border}` }}>
      <div style={{ display: 'flex', gap: tier === 'small' ? 2 : 4 }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((color) => (
          <span key={color} style={{ width: dot, height: dot, borderRadius: dot, background: color, opacity: 0.92 }} />
        ))}
      </div>
      <span
        style={{
          fontFamily: THEME.mono,
          fontSize: tier === 'large' ? 10 : tier === 'medium' ? 8 : 6,
          color: '#9aa7bd',
          background: '#141d2c',
          border: `1px solid ${THEME.border}`,
          borderRadius: 999,
          padding: tier === 'small' ? '0 4px' : '1px 7px',
          maxWidth: tier === 'small' ? '46%' : '52%',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {url}
      </span>
      {tier === 'large' && title && (
        <span style={{ fontFamily: THEME.sans, fontSize: 11, color: THEME.muted, whiteSpace: 'nowrap' }}>{title}</span>
      )}
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: tier === 'small' ? 3 : 6 }}>
        {claim && <Avatar index={claim.avatar} size={tier === 'large' ? 16 : tier === 'medium' ? 12 : 8} />}
        {tier !== 'small' && (
          <span style={{ fontFamily: THEME.mono, fontSize: tier === 'large' ? 9 : 8, color: rejected ? '#ef4444' : accepted ? THEME.green : THEME.dim }}>
            {rejected ? '✕' : accepted ? '✓' : 'live'}
          </span>
        )}
      </span>
    </div>
  );
};

/* RATIFY REVIEW bar lives inside the browser window, under the page. */
const ReviewFooter = ({ tier, accepted, rejected }: { tier: 'large' | 'medium' | 'small'; accepted: boolean; rejected: boolean }) => {
  const h = footerHeight(tier);
  const compact = tier === 'small';
  return (
    <div style={{ height: h, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: compact ? 4 : 8, padding: compact ? '0 6px' : '0 10px', background: '#0b1220', borderTop: `1px solid ${THEME.border}` }}>
      {!compact && (
        <span style={{ fontFamily: THEME.mono, fontSize: tier === 'large' ? 9 : 7, letterSpacing: '0.12em', color: '#c9c1ff', border: '1px solid #8b7cff66', background: '#8b7cff1a', borderRadius: 999, padding: tier === 'large' ? '3px 7px' : '2px 6px' }}>RATIFY REVIEW</span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: compact ? 3 : 6 }}>
        <span style={{ fontFamily: THEME.sans, fontSize: compact ? 7 : 10, color: '#e9eff8', border: '1px solid #3a4a66', borderRadius: 4, padding: compact ? '1px 4px' : '4px 8px' }}>Reject</span>
        <span style={{ fontFamily: THEME.sans, fontSize: compact ? 7 : 10, fontWeight: 700, color: '#fff', background: rejected ? '#b91c1c' : accepted ? '#1b6e2f' : '#238636', borderRadius: 4, padding: compact ? '1px 4px' : '4px 8px' }}>
          {rejected ? '✕ Rejected' : accepted ? '✓ Accepted' : 'Accept'}
        </span>
      </div>
    </div>
  );
};

/* Big ACCEPT / REJECT stamp — stamped on the page area, never on the chrome. */
const Stamp = ({ action, tier, progress }: { action: 'accept' | 'reject'; tier: 'large' | 'medium' | 'small'; progress: number }) => {
  const color = action === 'accept' ? '#2ea043' : '#ef4444';
  const scale = 2.2 - 1.2 * progress;
  const fontSize = tier === 'large' ? 30 : tier === 'medium' ? 18 : 10;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 8 }}>
      <div
        style={{
          transform: `rotate(${action === 'accept' ? -8 : 7}deg) scale(${scale})`,
          opacity: Math.min(1, progress * 2.2),
          border: `3px solid ${color}`,
          color,
          background: 'rgba(8,14,24,0.55)',
          borderRadius: tier === 'small' ? 5 : 10,
          padding: tier === 'small' ? '2px 5px' : tier === 'medium' ? '4px 9px' : '7px 14px',
          fontFamily: THEME.mono,
          fontWeight: 800,
          fontSize,
          letterSpacing: '0.06em',
          boxShadow: `0 0 24px ${color}55`,
        }}
      >
        {action === 'accept' ? 'ACCEPTED' : 'REJECTED'}
      </div>
    </div>
  );
};

const DragGhost = ({ claim, rect, startY, progress }: { claim: Claim; rect: { x: number; y: number; w: number; h: number }; startY: number; progress: number }) => {
  const tier = rect.w >= 600 ? 'large' : rect.w >= 380 ? 'medium' : 'small';
  const headerH = tier === 'large' ? 38 : tier === 'medium' ? 26 : 20;
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x + (24 - rect.x) * (1 - progress),
        top: rect.y + (startY - rect.y) * (1 - progress),
        width: rect.w,
        height: rect.h,
        transform: `scale(${0.55 + 0.45 * progress}) rotate(${-3 * (1 - progress)}deg)`,
        transformOrigin: 'top left',
        zIndex: 40,
        background: THEME.panel,
        border: `1px solid ${THEME.violet}`,
        borderRadius: tier === 'small' ? 8 : 14,
        overflow: 'hidden',
        boxShadow: '0 40px 90px rgba(0,0,0,0.6), 0 0 0 2px rgba(139,124,255,0.45)',
      }}
    >
      <div style={{ height: headerH, display: 'flex', alignItems: 'center', gap: tier === 'small' ? 5 : 9, padding: tier === 'small' ? '0 7px' : '0 12px', borderBottom: `1px solid ${THEME.border}` }}>
        <Avatar index={claim.avatar} size={tier === 'large' ? 18 : tier === 'medium' ? 14 : 11} />
        <Mono color={THEME.violet} size={tier === 'large' ? 13 : tier === 'medium' ? 10 : 8}>{TASKS[claim.taskIndex].id}</Mono>
        {tier !== 'small' && <Mono color={THEME.muted} size={9}>{diffStats(TASKS[claim.taskIndex])}</Mono>}
        <span style={{ marginLeft: 'auto', fontFamily: THEME.mono, fontSize: tier === 'small' ? 7 : 9, color: THEME.violet }}>→ preview</span>
      </div>
      <div style={{ padding: tier === 'small' ? '6px 7px' : '12px 14px' }}>
        <div style={{ fontSize: tier === 'large' ? 24 : tier === 'medium' ? 16 : 10, fontWeight: 700, color: THEME.text }}>{TITLES[claim.variant]}</div>
        <div style={{ marginTop: tier === 'small' ? 5 : 9, height: tier === 'small' ? 4 : 6, width: '80%', borderRadius: 3, background: THEME.violet, opacity: 0.7 }} />
        {tier !== 'small' && <div style={{ marginTop: 6, height: 5, width: '55%', borderRadius: 3, background: THEME.border }} />}
      </div>
    </div>
  );
};

export const FlowScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phase = phaseAt(frame);
  const phaseStart = PHASE_STARTS[phase];
  const layoutProgress = easeOut(frame - phaseStart, 0, 10);
  const incoming = 1000 + Math.floor(frame / INSERT_EVERY);
  const acceptCount = CLAIMS.filter((claim) => claim.action === 'accept' && claim.start <= frame && frame >= claim.acceptAt).length;
  const rejectCount = CLAIMS.filter((claim) => claim.action === 'reject' && claim.start <= frame && frame >= claim.acceptAt).length;
  const accepted = ACCEPT_BASE + acceptCount;
  const liveCount = SLOT_COUNTS[phase];
  const inFlight = CLAIMS.filter((claim) => frame >= claim.start && frame < claim.start + FLIGHT);
  const busyAvatars = new Set(inFlight.map((claim) => claim.avatar));
  const claimedOffsets = new Set(inFlight.map((claim) => claim.sourceOffset));

  const expansionAge = phase === 0 ? 999 : frame - phaseStart;

  return (
    <SceneFrame duration={duration}>
      {/* LEFT 1/4: diff generation swim lane */}
      <div style={{ position: 'absolute', left: 24, top: 104, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: THEME.violet }} />
        <Mono color={THEME.muted} size={14} style={{ letterSpacing: '0.22em' }}>DIFF FEED</Mono>
        {(() => {
          const age = frame % INSERT_EVERY;
          return <span style={{ marginLeft: 10, fontFamily: THEME.mono, fontSize: 12, fontWeight: 700, color: THEME.violet, opacity: 1 - age / INSERT_EVERY }}>+1 generated</span>;
        })()}
      </div>
      <div style={{ position: 'absolute', left: 24, top: 134 }}>
        <Mono color={THEME.dim} size={12} style={{ letterSpacing: '0.16em' }}>INCOMING TODAY</Mono>
        <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05, color: THEME.text }}>{incoming.toLocaleString('en-US')}</div>
        <span style={{ display: 'inline-block', marginTop: 6, fontFamily: THEME.mono, fontSize: 12, color: THEME.amber, border: `1px solid ${THEME.amber}55`, background: `${THEME.amber}14`, borderRadius: 999, padding: '4px 10px' }}>
          ≈ 1,000+ / day
        </span>
      </div>

      <div style={{ position: 'absolute', left: 480, top: 110, bottom: 120, width: 1, background: THEME.border }} />

      <div style={{ position: 'absolute', left: 24, top: LANE_TOP, width: LANE_W, height: LANE_H, overflow: 'hidden' }}>
        {(() => {
          const latest = Math.floor(frame / INSERT_EVERY);
          const settle = spring({ frame: frame - latest * INSERT_EVERY, fps, config: { damping: 200 }, durationInFrames: 12 });
          return Array.from({ length: 9 }).map((_, offset) => {
            const index = latest - offset;
            if (index < 0) return null;
            const y = offset === 0 ? 0 : (offset - 1 + settle) * LANE_STEP;
            if (y > LANE_H || y < -LANE_STEP) return null;
            const age = frame - index * INSERT_EVERY;
            const isNew = offset === 0 && age < 20;
            const isClaimed = claimedOffsets.has(offset);
            const task = TASKS[((index % TASKS.length) + TASKS.length) % TASKS.length];
            const appear = offset === 0 ? Math.min(1, settle * 1.9) : 1;
            return (
              <div key={index} style={{ position: 'absolute', left: 0, top: y, width: LANE_W, opacity: appear, zIndex: 20 - offset, transform: `scale(${offset === 0 ? 0.93 + 0.07 * settle : 1})`, transformOrigin: 'center top' }}>
                <DiffCard task={task} compact style={{ width: '100%', borderColor: isNew || isClaimed ? THEME.violet : undefined, boxShadow: isNew || isClaimed ? '0 0 0 1px rgba(139,124,255,0.6), 0 14px 36px rgba(0,0,0,0.5)' : undefined }} />
                {(isNew || isClaimed) && (
                  <div style={{ position: 'absolute', right: 24, top: 9, fontFamily: THEME.mono, fontSize: 9, letterSpacing: '0.14em', color: '#fff', background: THEME.violet, borderRadius: 999, padding: '2px 7px' }}>
                    {isClaimed ? 'CLAIMED' : '+ NEW'}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
      <div style={{ position: 'absolute', left: 24, top: LANE_TOP + LANE_H - 90, width: LANE_W, height: 90, background: `linear-gradient(0deg, ${THEME.ink}, ${THEME.ink}00)` }} />

      {/* RIGHT 3/4: persistent browser-window preview grid */}
      <div style={{ position: 'absolute', left: 512, top: 104, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: THEME.green }} />
        <Mono color={THEME.muted} size={14} style={{ letterSpacing: '0.22em' }}>PARALLEL REVIEW</Mono>
      </div>
      <div style={{ position: 'absolute', left: 512, top: 128, fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', color: THEME.text }}>
        So review them in parallel.
      </div>
      <div style={{ position: 'absolute', left: 512, top: 182 }}>
        <Mono color={THEME.dim} size={13}>bursts of diffs are dragged in — every preview is a browser window</Mono>
      </div>
      <div style={{ position: 'absolute', right: 40, top: 104, textAlign: 'right' }}>
        <Mono color={THEME.muted} size={13} style={{ letterSpacing: '0.2em' }}>ACCEPTED TODAY</Mono>
        <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: '-0.02em', color: THEME.green, lineHeight: 1.05 }}>{accepted.toLocaleString('en-US')}</div>
        <div style={{ marginTop: 2, fontFamily: THEME.mono, fontSize: 11, color: '#ef4444' }}>{rejectCount} rejected</div>
      </div>
      {/* reviewer dock: avatars mark WHO claimed each preview */}
      <div style={{ position: 'absolute', left: 512, top: 206, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Mono color={THEME.muted} size={11} style={{ letterSpacing: '0.18em' }}>REVIEWERS</Mono>
        {AVATARS.map((avatar, index) => (
          <Avatar key={avatar.initial} index={index} size={26} dim={busyAvatars.has(index)} />
        ))}
        <Mono color={THEME.dim} size={10}>{inFlight.length > 1 ? `${inFlight.length} claiming…` : inFlight.length === 1 ? '1 claiming…' : 'ready'}</Mono>
      </div>

      {/* snap/ripple on each expansion */}
      {phase > 0 && expansionAge < 14 && (
        <>
          <div style={{ position: 'absolute', left: AREA.x + AREA.w / 2 - 30, top: AREA.y + AREA.h / 2 - 30, width: 60, height: 60, borderRadius: 60, border: `2px solid ${THEME.violet}`, opacity: (1 - expansionAge / 14) * 0.7, transform: `scale(${0.5 + (expansionAge / 14) * 14})` }} />
          <div style={{ position: 'absolute', left: AREA.x, top: AREA.y, width: AREA.w, height: 4, background: `linear-gradient(90deg, ${THEME.violet}00, ${THEME.violet}, ${THEME.violet}00)`, opacity: (1 - expansionAge / 14) * 0.9 }} />
        </>
      )}

      {/* persistent grid slots, each one a browser window */}
      {Array.from({ length: liveCount }).map((_, slot) => {
        const current = gridRect(phase, slot);
        const previous = phase === 0 || slot >= SLOT_COUNTS[phase - 1] ? inset(current) : gridRect(phase - 1, slot);
        const progress = phase === 0 ? easeOut(frame, 0, 12) : layoutProgress;
        const rect = {
          x: previous.x + (current.x - previous.x) * progress,
          y: previous.y + (current.y - previous.y) * progress,
          w: previous.w + (current.w - previous.w) * progress,
          h: previous.h + (current.h - previous.h) * progress,
        };
        const slotClaims = CLAIMS_BY_SLOT.get(slot) ?? [];
        const shown = slotClaims.filter((candidate) => candidate.start <= frame).slice(-1)[0] ?? null;
        const next = slotClaims.find((candidate) => candidate.start > frame) ?? null;
        const t = shown ? frame - shown.start : -1;
        const visible = shown ? easeOut(t, FLIGHT, 6) : 0;
        const decided = shown ? frame >= shown.acceptAt : false;
        const acceptedPanel = decided && shown.action === 'accept';
        const rejectedPanel = decided && shown.action === 'reject';
        const stamp = shown ? spring({ frame: Math.max(0, frame - shown.acceptAt), fps, config: { damping: 11, mass: 0.7 }, durationInFrames: 20 }) : 0;
        const tier: 'large' | 'medium' | 'small' = current.w >= 600 ? 'large' : current.w >= 380 ? 'medium' : 'small';
        const waiting = !shown || t < FLIGHT;
        const exit = shown && next ? easeOut(frame, next.start - 8, 8) : 0;

        return (
          <div
            key={`slot-${slot}`}
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              display: 'flex',
              flexDirection: 'column',
              background: '#0b1220',
              border: `1px ${waiting ? 'dashed' : 'solid'} ${rejectedPanel ? '#ef4444aa' : acceptedPanel ? `${THEME.green}99` : waiting ? THEME.border : `${THEME.violet}66`}`,
              borderRadius: tier === 'small' ? 8 : 14,
              overflow: 'hidden',
              opacity: shown ? (waiting ? 0.9 : 0.4 + 0.6 * visible) * (1 - exit) : 0.9,
              transform: shown ? `scale(${1 - 0.07 * exit})` : undefined,
              boxShadow: rejectedPanel ? '0 0 0 2px rgba(239,68,68,0.25)' : acceptedPanel ? '0 0 0 2px rgba(74,222,128,0.2)' : '0 18px 44px rgba(0,0,0,0.3)',
            }}
          >
            <BrowserChrome shown={shown ?? null} tier={tier} title={shown ? TITLES[shown.variant] : undefined} accepted={acceptedPanel} rejected={rejectedPanel} />
            <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
              {waiting ? (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(139,124,255,0.04)' }}>
                  {shown ? (
                    <div style={{ textAlign: 'center' }}>
                      <Mono color={THEME.violet} size={tier === 'small' ? 7 : 10} style={{ letterSpacing: '0.14em' }}>DROP DIFF HERE</Mono>
                      {tier === 'large' && <div style={{ marginTop: 4, fontFamily: THEME.mono, fontSize: 13, color: THEME.text }}>{TASKS[shown.taskIndex].id}</div>}
                    </div>
                  ) : (
                    <Mono color={THEME.dim} size={tier === 'small' ? 7 : 10} style={{ letterSpacing: '0.14em' }}>WAITING</Mono>
                  )}
                </div>
              ) : (
                <div style={{ position: 'absolute', inset: 0, opacity: visible }}>
                  <PageMock variant={shown.variant} tier={tier} />
                  {rejectedPanel && <div style={{ position: 'absolute', inset: 0, background: 'rgba(180,40,40,0.10)', pointerEvents: 'none' }} />}
                  {decided && <Stamp action={shown.action} tier={tier} progress={stamp} />}
                </div>
              )}
            </div>
            {shown && !waiting && <ReviewFooter tier={tier} accepted={acceptedPanel} rejected={rejectedPanel} />}
          </div>
        );
      })}

      {/* in-flight drag: bursts fly in from random spots in the feed */}
      {inFlight.map((claim) => {
        const targetPhase = phaseAt(claim.start);
        const rect = gridRect(targetPhase, claim.slot);
        const startY = LANE_TOP + claim.sourceOffset * LANE_STEP;
        const p = interpolate(frame, [claim.start, claim.start + FLIGHT], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.quad) });
        return (
          <React.Fragment key={`drag-${claim.start}-${claim.slot}`}>
            <div style={{ position: 'absolute', left: 470, top: startY + (rect.y + rect.h / 2 - startY) * p, width: Math.max(0, rect.x - 470), height: 1, background: `linear-gradient(90deg, ${THEME.violet}00, ${THEME.violet}99, ${THEME.violet}00)`, opacity: 0.7 * (1 - p) }} />
            <DragGhost claim={claim} rect={rect} startY={startY} progress={p} />
          </React.Fragment>
        );
      })}

      {(() => {
        const stageLines = [
          'One diff. One human review.',
          'Reviews run in parallel.',
          'Review capacity scales.',
          'The queue becomes a grid.',
          'Human review at agent speed.',
        ];
        const lineStart = phase === 0 ? 30 : PHASE_STARTS[phase];
        const appear =
          phase === 0
            ? easeOut(frame, 30, 16)
            : Math.min(1, spring({ frame: Math.max(0, frame - lineStart), fps, config: { damping: 200 }, durationInFrames: 18 }) * 1.5);
        return (
          <div style={{ position: 'absolute', bottom: 78, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: appear, transform: `translateY(${(1 - appear) * 14}px)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, border: `1px solid ${THEME.border}`, background: 'rgba(10,15,24,0.78)', borderRadius: 999, padding: '15px 32px', fontSize: 27, color: THEME.muted }}>
              <span style={{ width: 9, height: 9, borderRadius: 5, background: THEME.violet }} />
              {stageLines[phase]}
            </div>
          </div>
        );
      })()}
    </SceneFrame>
  );
};
