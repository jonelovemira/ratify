import React from 'react';
import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop, ProgressLine, TopBar } from './components';
import { SCENES, THEME } from './theme';
import { ChecksNoteScene, EndEyesScene, EndParallelScene, OneDiffScene, TitleScene } from './scenes';
import { FlowScene } from './stream';

export const BoundaryDemo = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.ink, fontFamily: THEME.sans }}>
      <Backdrop />
      <Series>
        <Series.Sequence durationInFrames={SCENES.title}>
          <TitleScene duration={SCENES.title} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.checksNote}>
          <ChecksNoteScene duration={SCENES.checksNote} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.oneDiff}>
          <OneDiffScene duration={SCENES.oneDiff} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.flow}>
          <FlowScene duration={SCENES.flow} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.endParallel}>
          <EndParallelScene duration={SCENES.endParallel} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.endEyes}>
          <EndEyesScene duration={SCENES.endEyes} />
        </Series.Sequence>
      </Series>
      <TopBar />
      <ProgressLine progress={frame / Math.max(1, durationInFrames - 1)} />
    </AbsoluteFill>
  );
};
