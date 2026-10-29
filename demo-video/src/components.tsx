import React, { type CSSProperties, type ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from './theme';

export const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Eased 0→1 progress starting at `start` and lasting `duration` frames. */
export const easeOut = (frame: number, start: number, duration = 18): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });

/** Springy 0→1 entrance, delayed by `delay` frames. */
export const springIn = (frame: number, fps: number, delay: number, damping = 200): number =>
  spring({ frame, fps, delay, durationInFrames: 28, config: { damping } });

/** Fade a scene in at its start and out at its end. */
export const SceneFrame = ({ duration, children }: { duration: number; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    easeOut(frame, 0, 12),
    interpolate(frame, [duration - 14, duration - 2], [1, 0], CLAMP),
  );
  const lift = interpolate(frame, [0, 18], [16, 0], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  return <AbsoluteFill style={{ opacity, transform: `translateY(${lift}px)` }}>{children}</AbsoluteFill>;
};

export const Backdrop = () => (
  <AbsoluteFill style={{ backgroundColor: THEME.ink }}>
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(1100px 700px at 16% -10%, rgba(139,124,255,0.22), transparent 62%), radial-gradient(900px 620px at 88% 110%, rgba(94,212,230,0.13), transparent 62%)',
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage:
          'linear-gradient(rgba(148,163,186,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,186,0.055) 1px, transparent 1px)',
        backgroundSize: '72px 72px',
      }}
    />
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(1250px 820px at 50% 46%, transparent 38%, rgba(4,6,10,0.62) 100%)',
      }}
    />
  </AbsoluteFill>
);

const LogoMark = () => (
  <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
    <rect x="1.5" y="1.5" width="31" height="31" rx="8" stroke={THEME.violet} strokeWidth="1.6" opacity="0.95" />
    <path d="M10 17.5 L15 22.5 L24 12.5" stroke={THEME.text} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Persistent header: wordmark left, clean-room badge right. */
export const TopBar = () => (
  <div
    style={{
      position: 'absolute',
      top: 42,
      left: 80,
      right: 80,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <LogoMark />
      <span
        style={{
          fontSize: 21,
          fontWeight: 600,
          letterSpacing: '0.3em',
          color: THEME.text,
        }}
      >
        RATIFY
      </span>
    </div>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: `1px solid ${THEME.border}`,
        borderRadius: 999,
        padding: '10px 20px',
        fontFamily: THEME.mono,
        fontSize: 16,
        letterSpacing: '0.16em',
        color: THEME.muted,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 4, background: THEME.green }} />
      CLEAN-ROOM PROTOTYPE
    </div>
  </div>
);

/** Thin progress line pinned to the very bottom. */
export const ProgressLine = ({ progress }: { progress: number }) => (
  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(148,163,186,0.14)' }}>
    <div
      style={{
        width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
        height: '100%',
        background: `linear-gradient(90deg, ${THEME.violet}, ${THEME.cyan})`,
      }}
    />
  </div>
);

export const SectionLabel = ({ index, title }: { index: string; title: string }) => (
  <div style={{ position: 'absolute', top: 156, left: 96, display: 'flex', alignItems: 'center', gap: 18 }}>
    <span style={{ fontFamily: THEME.mono, fontSize: 19, color: THEME.violet }}>{index}</span>
    <span style={{ width: 44, height: 1, background: THEME.border }} />
    <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.26em', color: THEME.muted }}>{title}</span>
  </div>
);

export const Heading = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      position: 'absolute',
      left: 96,
      top: 200,
      fontSize: 60,
      fontWeight: 700,
      letterSpacing: '-0.025em',
      color: THEME.text,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      position: 'absolute',
      background: THEME.panel,
      border: `1px solid ${THEME.border}`,
      borderRadius: 20,
      boxShadow: '0 30px 90px rgba(0,0,0,0.45)',
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
  </div>
);

export const PanelHeader = ({ label, right }: { label: string; right?: ReactNode }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderBottom: `1px solid ${THEME.border}`,
      background: 'rgba(255,255,255,0.02)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, background: THEME.violet }} />
      <span style={{ fontFamily: THEME.mono, fontSize: 20, letterSpacing: '0.05em', color: THEME.muted }}>{label}</span>
    </div>
    {right}
  </div>
);

export const Pill = ({
  children,
  color = THEME.violet,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      border: `1px solid ${color}55`,
      background: `${color}14`,
      color,
      borderRadius: 999,
      padding: '6px 14px',
      fontFamily: THEME.mono,
      fontSize: 17,
      letterSpacing: '0.04em',
      ...style,
    }}
  >
    {children}
  </span>
);

export const Typewriter = ({
  text,
  start,
  speed = 1.1,
  style,
}: {
  text: string;
  start: number;
  speed?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const visible = Math.max(0, Math.min(text.length, Math.floor((frame - start) / speed)));
  return <span style={style}>{text.slice(0, visible)}</span>;
};

export const Cursor = ({ start = 0, color = THEME.violet }: { start?: number; color?: string }) => {
  const frame = useCurrentFrame();
  if (frame < start) return null;
  const visible = Math.floor((frame - start) / 15) % 2 === 0;
  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: '1.05em',
        marginLeft: 4,
        background: color,
        opacity: visible ? 1 : 0,
        transform: 'translateY(2px)',
      }}
    />
  );
};

export const PassStamp = ({ start, label = 'PASS' }: { start: number; label?: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < start) return null;
  const s = springIn(frame, fps, start, 16);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        border: `2px solid ${THEME.green}`,
        background: `${THEME.green}16`,
        color: THEME.green,
        borderRadius: 10,
        padding: '8px 18px',
        fontFamily: THEME.mono,
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: '0.12em',
        opacity: Math.min(1, s * 1.5),
        transform: `scale(${0.72 + s * 0.28}) rotate(-2deg)`,
      }}
    >
      ✓ {label}
    </span>
  );
};

/** Horizontal arrow that draws itself, optionally labelled. */
export const Arrow = ({
  from,
  to,
  y,
  start,
  label,
}: {
  from: number;
  to: number;
  y: number;
  start: number;
  label?: string;
}) => {
  const frame = useCurrentFrame();
  const p = easeOut(frame, start, 20);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: from,
          top: y,
          width: Math.max(0, (to - from) * p),
          height: 2,
          background: `linear-gradient(90deg, ${THEME.violet}00, ${THEME.violet})`,
        }}
      />
      {p > 0.96 && (
        <div
          style={{
            position: 'absolute',
            left: to - 16,
            top: y - 9,
            width: 0,
            height: 0,
            borderTop: '10px solid transparent',
            borderBottom: '10px solid transparent',
            borderLeft: `16px solid ${THEME.violet}`,
          }}
        />
      )}
      {label && (
        <div
          style={{
            position: 'absolute',
            left: from + (to - from) / 2 - 80,
            top: y - 50,
            width: 160,
            textAlign: 'center',
            fontFamily: THEME.mono,
            fontSize: 18,
            color: THEME.violet,
            opacity: easeOut(frame, start + 8, 12),
          }}
        >
          {label}
        </div>
      )}
    </>
  );
};

/** File row used in the repo and workspace listings. */
export const FileRow = ({ name, detail, start, accent }: { name: string; detail?: string; start: number; accent?: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = springIn(frame, fps, start);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '11px 4px',
        opacity: Math.min(1, s * 1.4),
        transform: `translateX(${(1 - s) * 18}px)`,
      }}
    >
      <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
        <path d="M2 1.5h9l5 5v14H2z" stroke={accent ?? THEME.dim} strokeWidth="1.4" />
        <path d="M11 1.5v5h5" stroke={accent ?? THEME.dim} strokeWidth="1.4" />
      </svg>
      <span style={{ fontFamily: THEME.mono, fontSize: 21, color: accent ?? THEME.text }}>{name}</span>
      {detail && (
        <span style={{ marginLeft: 'auto', fontFamily: THEME.mono, fontSize: 16, color: THEME.dim }}>{detail}</span>
      )}
    </div>
  );
};

export const Caption = ({ text, start = 24 }: { text: string; start?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = springIn(frame, fps, start, 200);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 78,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: Math.min(1, s * 1.6),
        transform: `translateY(${(1 - s) * 14}px)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          border: `1px solid ${THEME.border}`,
          background: 'rgba(10,15,24,0.78)',
          borderRadius: 999,
          padding: '15px 32px',
          fontSize: 27,
          color: THEME.muted,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 5, background: THEME.violet }} />
        {text}
      </div>
    </div>
  );
};
