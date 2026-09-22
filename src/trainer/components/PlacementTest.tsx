// src/trainer/PlacementTest.tsx
import React from 'react';
import type { KeySource, SessionLog } from '../types';
import { useTypingSession } from '../hooks/useTypingSession';
import { PracticePanel } from './PracticePanel';
import { LiveStats } from './LiveStats';
import { Keyboard } from '../../components/Keyboard';
import { buildKeyboardView } from '../engine/keyboardView';
import { computeSessionResult } from '../engine/scoring';
import { seedFromPlacement } from '../engine/placement';

const PLACEMENT_TEXT = 'שלום עולם זה מבחן קצר של מהירות הקלדה';

export const PlacementTest: React.FC<{
  source: KeySource;
  onDone: (seed: { unlockedStageIndex: number; currentStageIndex: number }) => void;
}> = ({ source, onDone }) => {
  const handleComplete = (log: SessionLog) => onDone(seedFromPlacement(computeSessionResult(log)));
  // Stop-on-error (like the app default): only the correct key advances, so you can't race
  // through by mashing keys. Placement still measures speed/accuracy on the corrected run.
  const s = useTypingSession({ source, target: PLACEMENT_TEXT, strictness: 'stop', onComplete: handleComplete });
  // Full guidance during placement: no stats yet, so highlight the next key + finger.
  const view = buildKeyboardView({ nextCode: s.nextCode, statsByCode: {}, guidance: 'full' });
  const correct = s.statuses.filter((st) => st === 'correct').length;
  return (
    <div className="placement">
      <div className="placement-head">
        <h3>Placement — type this once to gauge your level</h3>
        <button
          className="placement-skip"
          onClick={() => onDone({ unlockedStageIndex: 0, currentStageIndex: 0 })}
        >
          Skip → start from lesson 1
        </button>
      </div>
      <LiveStats correct={correct} errors={s.errorCount} />
      <PracticePanel target={PLACEMENT_TEXT} statuses={s.statuses} index={s.index} />
      <Keyboard trainerView={view} />
    </div>
  );
};
