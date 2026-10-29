// Shared visual language for the Ratify demo video.
export const THEME = {
  ink: '#070A11',
  panel: 'rgba(16, 23, 36, 0.94)',
  panelSoft: 'rgba(22, 31, 48, 0.55)',
  border: 'rgba(126, 148, 184, 0.22)',
  text: '#E9EFF8',
  muted: '#94A3BA',
  dim: '#5D6C84',
  violet: '#8B7CFF',
  cyan: '#5ED4E6',
  green: '#4ADE80',
  amber: '#F5C04A',
  red: '#FF6B6B',
  sans: '-apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif',
  mono: 'Menlo, "SF Mono", "Courier New", monospace',
} as const;

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;

// Scene durations in frames (total = 41.8s at 30fps, calm-burst cut).
export const SCENES = {
  title: 105,
  checksNote: 120,
  oneDiff: 150,
  flow: 580,
  endParallel: 150,
  endEyes: 150,
} as const;

export const TOTAL_FRAMES = Object.values(SCENES).reduce((sum, frames) => sum + frames, 0);
