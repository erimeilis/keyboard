// src/trainer/PlacementTest.tsx
import React from 'react';
import type { KeySource, SessionLog } from './types';
import { useTypingSession } from './useTypingSession';
import { PracticePanel } from './PracticePanel';
import { computeSessionResult } from './scoring';
import { seedFromPlacement } from './placement';

const PLACEMENT_TEXT = 'שלום עולם זה מבחן קצר של מהירות הקלדה';

export const PlacementTest: React.FC<{
  source: KeySource;
  onDone: (seed: { unlockedStageIndex: number; currentStageIndex: number }) => void;
}> = ({ source, onDone }) => {
  const handleComplete = (log: SessionLog) => onDone(seedFromPlacement(computeSessionResult(log)));
  const s = useTypingSession({ source, target: PLACEMENT_TEXT, strictness: 'markThrough', onComplete: handleComplete });
  return (
    <div className="placement">
      <h3>Placement — type this once</h3>
      <PracticePanel target={PLACEMENT_TEXT} statuses={s.statuses} index={s.index} />
    </div>
  );
};
