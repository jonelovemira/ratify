import React from 'react';
import { THEME } from './theme';

export type DemoTask = { id: string; added: number; removed: number; files: number };

// Diff stats shown in the film. task-001 uses the real prototype diff (+17 −0, 2 files).
export const TASKS: DemoTask[] = [
  { id: 'task-001', added: 17, removed: 0, files: 2 },
  { id: 'task-002', added: 8, removed: 2, files: 1 },
  { id: 'task-003', added: 31, removed: 7, files: 3 },
  { id: 'task-004', added: 4, removed: 1, files: 1 },
  { id: 'task-005', added: 22, removed: 5, files: 2 },
  { id: 'task-006', added: 13, removed: 3, files: 2 },
  { id: 'task-007', added: 9, removed: 4, files: 1 },
  { id: 'task-008', added: 27, removed: 6, files: 3 },
  { id: 'task-009', added: 6, removed: 0, files: 1 },
  { id: 'task-010', added: 18, removed: 4, files: 2 },
  { id: 'task-011', added: 11, removed: 2, files: 1 },
  { id: 'task-012', added: 24, removed: 8, files: 3 },
  { id: 'task-013', added: 5, removed: 1, files: 1 },
  { id: 'task-014', added: 16, removed: 3, files: 2 },
  { id: 'task-015', added: 29, removed: 5, files: 3 },
  { id: 'task-016', added: 7, removed: 2, files: 1 },
  { id: 'task-017', added: 20, removed: 6, files: 2 },
  { id: 'task-018', added: 12, removed: 3, files: 2 },
  { id: 'task-019', added: 14, removed: 4, files: 2 },
  { id: 'task-020', added: 10, removed: 2, files: 1 },
  { id: 'task-021', added: 25, removed: 7, files: 3 },
  { id: 'task-022', added: 6, removed: 1, files: 1 },
  { id: 'task-023', added: 19, removed: 5, files: 2 },
  { id: 'task-024', added: 8, removed: 3, files: 1 },
  { id: 'task-025', added: 21, removed: 6, files: 2 },
  { id: 'task-026', added: 7, removed: 1, files: 1 },
  { id: 'task-027', added: 30, removed: 9, files: 3 },
  { id: 'task-028', added: 9, removed: 2, files: 1 },
  { id: 'task-029', added: 15, removed: 4, files: 2 },
  { id: 'task-030', added: 26, removed: 5, files: 3 },
  { id: 'task-031', added: 6, removed: 2, files: 1 },
  { id: 'task-032', added: 19, removed: 3, files: 2 },
  { id: 'task-033', added: 12, removed: 5, files: 2 },
  { id: 'task-034', added: 28, removed: 8, files: 3 },
  { id: 'task-035', added: 5, removed: 1, files: 1 },
  { id: 'task-036', added: 23, removed: 4, files: 2 },
];

export const diffStats = (task: DemoTask) => `+${task.added} −${task.removed} · ${task.files} file${task.files === 1 ? '' : 's'}`;

export const Mono = ({
  children,
  color = THEME.text,
  size = 20,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
  style?: React.CSSProperties;
}) => <span style={{ fontFamily: THEME.mono, fontSize: size, color, ...style }}>{children}</span>;

export const DiffCard = ({ task, compact, style }: { task: DemoTask; compact?: boolean; style?: React.CSSProperties }) => (
  <div
    style={{
      background: 'rgba(16,23,36,0.95)',
      border: `1px solid ${THEME.border}`,
      borderRadius: 14,
      padding: compact ? '11px 14px' : '18px 22px',
      boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
      boxSizing: 'border-box',
      ...style,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Mono color={THEME.violet} size={compact ? 13 : 16}>{task.id}</Mono>
      {!compact && <Mono color={THEME.dim} size={12}>main → {task.id}</Mono>}
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: compact ? 6 : 12 }}>
      <span style={{ fontSize: compact ? 22 : 38, fontWeight: 700, letterSpacing: '-0.02em', color: THEME.text }}>
        +{task.added} <span style={{ color: THEME.red }}>−{task.removed}</span>
      </span>
      <Mono color={THEME.muted} size={compact ? 11 : 14}>{task.files} files</Mono>
    </div>
  </div>
);

export const MiniPreview = ({
  task,
  accepted = false,
  large = false,
}: {
  task: DemoTask;
  accepted?: boolean;
  large?: boolean;
}) => {
  const pageHeight = large ? 210 : 160;
  return (
    <div style={{ position: 'relative', background: '#0d1320', border: `1px solid ${accepted ? `${THEME.green}88` : THEME.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: large ? '9px 12px' : '6px 10px', borderBottom: `1px solid ${THEME.border}` }}>
        {[THEME.red, THEME.amber, THEME.green].map((color) => (
          <span key={color} style={{ width: large ? 9 : 7, height: large ? 9 : 7, borderRadius: 99, background: color, opacity: 0.75 }} />
        ))}
        <span style={{ marginLeft: 8, fontFamily: THEME.mono, fontSize: large ? 12 : 10, color: THEME.dim }}>{task.id}.preview.internal</span>
        <span style={{ marginLeft: 'auto', fontFamily: THEME.mono, fontSize: large ? 11 : 9, color: accepted ? THEME.green : THEME.muted }}>
          {accepted ? 'ACCEPTED' : 'PREVIEW'}
        </span>
      </div>
      <div style={{ position: 'relative', height: pageHeight, background: '#f7f8fa', color: '#1c2430', padding: large ? '16px 20px' : '10px 13px', paddingBottom: large ? 58 : 42, overflow: 'hidden' }}>
        <div style={{ fontFamily: THEME.mono, fontSize: large ? 12 : 9, letterSpacing: '0.14em', color: '#8a94a6' }}>DEMO APP</div>
        <div style={{ fontSize: large ? 28 : 19, fontWeight: 700, marginTop: large ? 2 : 1 }}>Counter</div>
        <div style={{ fontSize: large ? 14 : 11, color: '#4a5568', marginTop: large ? 6 : 4 }}>Count: 0</div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: large ? 8 : 6,
            marginTop: large ? 14 : 9,
            padding: large ? '9px 13px' : '6px 9px',
            border: '1px solid #2e7d32',
            borderRadius: large ? 9 : 7,
            background: '#e8f5e9',
            color: '#1b5e20',
            fontSize: large ? 15 : 11,
          }}
        >
          <span style={{ width: large ? 9 : 6, height: large ? 9 : 6, borderRadius: 99, background: '#2e7d32' }} />
          Health check: ok
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 6, padding: large ? '9px 12px' : '6px 9px', background: '#0b1220' }}>
          <span style={{ fontFamily: THEME.mono, fontSize: large ? 10 : 8, letterSpacing: '0.12em', color: '#c9c1ff', border: '1px solid #8b7cff66', background: '#8b7cff1a', borderRadius: 999, padding: large ? '3px 8px' : '2px 6px' }}>
            RATIFY REVIEW
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
            <span style={{ fontFamily: THEME.sans, fontSize: large ? 11 : 9, color: '#e9eff8', border: '1px solid #3a4a66', borderRadius: 4, padding: large ? '4px 8px' : '3px 6px' }}>
              Reject
            </span>
            <span style={{ fontFamily: THEME.sans, fontSize: large ? 11 : 9, fontWeight: 700, color: '#fff', background: accepted ? '#1b6e2f' : '#238636', borderRadius: 4, padding: large ? '4px 8px' : '3px 6px' }}>
              {accepted ? '✓ Accepted' : 'Accept'}
            </span>
          </div>
        </div>
        {accepted && (
          <div style={{ position: 'absolute', right: large ? 18 : 12, top: large ? 16 : 10, transform: 'rotate(-3deg)', border: `2px solid #2e7d32`, background: 'rgba(232,245,233,0.95)', color: '#1b5e20', borderRadius: 8, padding: large ? '8px 12px' : '5px 9px', fontFamily: THEME.mono, fontWeight: 700, fontSize: large ? 14 : 10, letterSpacing: '0.08em', opacity: 0.95 }}>
            ACCEPTED
          </div>
        )}
      </div>
    </div>
  );
};

export const PreviewThumb = ({
  task,
  accepted = false,
  large = false,
  style,
}: {
  task: DemoTask;
  accepted?: boolean;
  large?: boolean;
  style?: React.CSSProperties;
}) => (
  <div style={{ position: 'absolute', background: THEME.panel, border: `1px solid ${accepted ? `${THEME.green}88` : THEME.border}`, borderRadius: 16, padding: large ? 16 : 12, boxShadow: '0 20px 60px rgba(0,0,0,0.38)', ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: large ? 12 : 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <Mono color={THEME.violet} size={large ? 16 : 14}>{task.id}</Mono>
        <Mono color={THEME.muted} size={large ? 14 : 12}>{diffStats(task)}</Mono>
      </div>
      <Mono color={accepted ? THEME.green : THEME.dim} size={large ? 12 : 10}>{accepted ? 'accepted' : 'preview'}</Mono>
    </div>
    <MiniPreview task={task} accepted={accepted} large={large} />
  </div>
);

export const CursorPointer = ({ x, y, pressing }: { x: number; y: number; pressing: boolean }) => (
  <svg width="34" height="38" viewBox="0 0 30 34" style={{ position: 'absolute', left: x, top: y, zIndex: 50, filter: 'drop-shadow(0 5px 12px rgba(0,0,0,0.5))', transform: `scale(${pressing ? 0.92 : 1})` }}>
    <path d="M4 2l21 14-10 2 5 12-4 2-5-12-7 7z" fill="#ffffff" stroke="#1c2430" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
