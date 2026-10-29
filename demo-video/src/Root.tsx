import React from 'react';
import { Composition } from 'remotion';
import { BoundaryDemo } from './BoundaryDemo';
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from './theme';

export const RemotionRoot = () => (
  <Composition
    id="BoundaryDemo"
    component={BoundaryDemo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
