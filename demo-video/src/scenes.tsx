import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption, CLAMP, easeOut, Heading, Pill, SceneFrame, SectionLabel, springIn } from './components';
import { THEME } from './theme';
import { DiffCard, Mono, PreviewThumb, TASKS } from './preview-ui';

/* 01 — TITLE */
export const TitleScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = springIn(frame, fps, 4, 18);
  const tracking = interpolate(frame, [8, 64], ['0.34em', '0.11em'], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const tagline = easeOut(frame, 28, 18);

  return (
    <SceneFrame duration={duration}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 40 }}>
        <div style={{ fontFamily: THEME.mono, fontSize: 20, letterSpacing: '0.32em', color: THEME.violet, opacity: easeOut(frame, 2, 14), marginBottom: 34 }}>
          DIFF → PREVIEW → HUMAN ACCEPT
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26, transform: `scale(${0.94 + mark * 0.06})` }}>
          <svg width="86" height="86" viewBox="0 0 34 34" fill="none">
            <rect x="1.5" y="1.5" width="31" height="31" rx="8" stroke={THEME.violet} strokeWidth="1.5" />
            <path d="M10 17.5 L15 22.5 L24 12.5" stroke={THEME.text} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 118, fontWeight: 700, letterSpacing: tracking, color: THEME.text, lineHeight: 1 }}>RATIFY</span>
        </div>
        <div style={{ marginTop: 36, fontSize: 40, color: THEME.muted, opacity: tagline, transform: `translateY(${(1 - tagline) * 12}px)` }}>
          Human acceptance for AI agent work, inside your network.
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 54, opacity: easeOut(frame, 56, 18) }}>
          <Pill color={THEME.violet}>parallel previews</Pill>
          <Pill color={THEME.green}>human acceptance</Pill>
          <Pill color={THEME.cyan}>no data leaves</Pill>
        </div>
      </div>
    </SceneFrame>
  );
};

/* 02 — ONE DIFF */
export const OneDiffScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = springIn(frame, fps, 2, 200);
  const arrow = easeOut(frame, 52, 16);
  const preview = easeOut(frame, 70, 16);
  const task = TASKS[0];

  return (
    <SceneFrame duration={duration}>
      <SectionLabel index="01" title="EVERY TASK DIFF" />
      <Heading>Every task diff. Its own live preview.</Heading>
      <div style={{ position: 'absolute', left: interpolate(card, [0, 1], [1320, 110]), top: 372, width: 620, opacity: Math.min(1, card * 1.5) }}>
        <DiffCard task={task} />
        <div style={{ marginTop: 16, opacity: easeOut(frame, 26, 12) }}>
          <Mono color={THEME.dim} size={16}>a human can only accept what they can see</Mono>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 756, top: 448, width: 240, opacity: arrow }}>
        <Mono color={THEME.violet} size={14}>served live by the platform</Mono>
        <div style={{ marginTop: 14, width: 170 * arrow, height: 2, background: `linear-gradient(90deg, ${THEME.violet}00, ${THEME.violet})` }} />
        {arrow > 0.95 && (
          <div style={{ marginLeft: 168, marginTop: -9, width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: `14px solid ${THEME.violet}` }} />
        )}
      </div>
      <div style={{ position: 'absolute', left: 1000, top: 350, width: 780, opacity: preview, transform: `translateY(${(1 - preview) * 16}px)` }}>
        <PreviewThumb task={task} large style={{ position: 'relative', width: '100%' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16, opacity: easeOut(frame, 100, 14) }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: THEME.amber }} />
          <Mono color={THEME.muted} size={16}>waiting for a human</Mono>
        </div>
      </div>
      <Caption start={96} text="The platform serves every diff as a live preview." />
    </SceneFrame>
  );
};

/* OPENING PREMISE: stated up front, never revisited in the middle */
export const ChecksNoteScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();
  const lineOne = easeOut(frame, 8, 12);
  const lineTwo = easeOut(frame, 24, 12);
  const note = easeOut(frame, 62, 14);

  return (
    <SceneFrame duration={duration}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: THEME.mono, fontSize: 18, letterSpacing: '0.3em', color: THEME.dim, opacity: lineOne, marginBottom: 28 }}>THE PREMISE</div>
        <div style={{ fontSize: 62, fontWeight: 700, letterSpacing: '-0.02em', color: THEME.text, opacity: lineOne }}>Checks passed.</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, opacity: lineTwo, marginTop: 8 }}>
          <span style={{ fontSize: 62, fontWeight: 700, letterSpacing: '-0.02em', color: THEME.violet }}>≠</span>
          <span style={{ fontSize: 62, fontWeight: 700, letterSpacing: '-0.02em', color: THEME.text }}>ACCEPTED.</span>
        </div>
        <div style={{ marginTop: 34, width: 130, height: 2, background: THEME.border, opacity: lineTwo }} />
        <div style={{ marginTop: 32, fontFamily: THEME.mono, fontSize: 16, letterSpacing: '0.08em', color: THEME.muted, opacity: note }}>
          a human still has to look
        </div>
      </div>
    </SceneFrame>
  );
};

/* 06 — END CARD: parallel contention */
export const EndParallelScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const first = springIn(frame, fps, 6, 200);
  const second = springIn(frame, fps, 26, 200);

  return (
    <SceneFrame duration={duration}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 30 }}>
        <div style={{ fontFamily: THEME.mono, fontSize: 18, letterSpacing: '0.3em', color: THEME.violet, opacity: easeOut(frame, 0, 12), marginBottom: 34 }}>THE BOTTLENECK MOVED</div>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: '-0.03em', color: THEME.text, opacity: first, transform: `translateY(${(1 - first) * 18}px)` }}>Diffs arrive in parallel.</div>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: '-0.03em', color: THEME.violet, marginTop: 6, opacity: second, transform: `translateY(${(1 - second) * 18}px)` }}>Review them in parallel.</div>
      </div>
    </SceneFrame>
  );
};

/* 07 — END CARD: the human layer */
export const EndEyesScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = springIn(frame, fps, 6, 200);

  return (
    <SceneFrame duration={duration}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 30 }}>
        <div style={{ fontFamily: THEME.mono, fontSize: 18, letterSpacing: '0.3em', color: THEME.violet, opacity: easeOut(frame, 0, 12), marginBottom: 32 }}>RATIFY</div>
        <div style={{ fontSize: 80, fontWeight: 700, letterSpacing: '-0.035em', color: THEME.text, opacity: title, transform: `translateY(${(1 - title) * 18}px)`, textAlign: 'center' }}>
          A human must see it<br />before it ships.
        </div>
        <div style={{ marginTop: 30, fontFamily: THEME.mono, fontSize: 20, letterSpacing: '0.24em', color: THEME.muted, opacity: easeOut(frame, 34, 16) }}>
          GENERATED <span style={{ color: THEME.violet }}>≠</span> ACCEPTED
        </div>
        <div style={{ marginTop: 44, opacity: easeOut(frame, 92, 14) }}>
          <Mono color={THEME.dim} size={18}>boundary-prototype/ · node run.js --parallel 4</Mono>
        </div>
      </div>
    </SceneFrame>
  );
};
