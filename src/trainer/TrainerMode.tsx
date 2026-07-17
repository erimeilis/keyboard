import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Keyboard } from '../components/Keyboard';
import { PracticePanel } from './PracticePanel';
import { SessionSummary } from './SessionSummary';
import { StatsView } from './StatsView';
import { PlacementTest } from './PlacementTest';
import { CustomText } from './CustomText';
import { useTypingSession } from './useTypingSession';
import { buildKeyboardView } from './keyboardView';
import { computeSessionResult } from './scoring';
import { selectPractice, selectSentence } from './textSelection';
import { COMMON_WORDS_HE } from './data/words.he';
import { PROSE_HE } from './data/prose.he';
import { unlockedCodesForStage, SOFIT_STAGE_INDEX } from './curriculum';
import { confidenceFor } from './engine/confidence';
import { canAdvance } from './engine/gating';
import { createLocalStorageStore } from './storage';
import type { TrainerStore } from './storage';
import {
  loadSettings, loadProgress, saveProgress, loadStats, saveStats, mergeSessionStats,
  loadHistory, saveHistory,
} from './useTrainerState';
import type { HistoryEntry } from './useTrainerState';
import { DomKeySource } from './keySource/DomKeySource';
import { TauriTapKeySource } from './keySource/TauriTapKeySource';
import type { KeySource, KeyCode, KeyStat, Settings, SessionLog, SessionResult } from './types';
import './trainer.css';

type PracticeMode = 'drills' | 'words' | 'prose' | 'custom';

interface Props {
  onExit: () => void;
  store?: TrainerStore;
  makeSource?: (s: Settings) => KeySource;
  fixedTarget?: string; // test hook; when set, skip selection randomness
}

export const TrainerMode: React.FC<Props> = ({ onExit, store: injStore, makeSource, fixedTarget }) => {
  const store = useMemo(() => injStore ?? createLocalStorageStore(), [injStore]);
  const settings = useMemo(() => loadSettings(store), [store]);
  const [progress, setProgress] = useState(() => loadProgress(store));
  const [stats, setStats] = useState<Record<KeyCode, KeyStat>>(() => loadStats(store));
  const [phase, setPhase] = useState<'placement' | 'typing' | 'summary'>(
    () => (Object.keys(loadStats(store)).length === 0 ? 'placement' : 'typing'),
  );
  const [result, setResult] = useState<SessionResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory(store));
  const [mode, setMode] = useState<PracticeMode>('words');
  const [customText, setCustomText] = useState('');

  const source = useMemo<KeySource>(
    () => (makeSource ? makeSource(settings)
      : settings.captureSource === 'tap' ? new TauriTapKeySource() : new DomKeySource()),
    [makeSource, settings],
  );

  useEffect(() => {
    invoke('set_trainer_mode', { active: true }).catch(console.error);
    return () => { invoke('set_trainer_mode', { active: false }).catch(console.error); };
  }, []);

  const target = useMemo(() => {
    if (fixedTarget != null) return fixedTarget;
    // Custom mode: the sanitized pasted text is the fixed session target —
    // never re-derived from the curriculum/corpus selection below.
    if (mode === 'custom') return customText;
    const unlocked = unlockedCodesForStage(progress.currentStageIndex);
    const confByCode: Record<KeyCode, number> = {};
    for (const [code, st] of Object.entries(stats)) confByCode[code] = confidenceFor(st);

    // Prose mode is explicit; "words" mode also graduates to sentences once the
    // curriculum reaches sofit finals. "drills" is a deliberate raw-letter drill
    // override, so it never gets silently swapped for a sentence.
    const preferProse = mode === 'prose' || (mode === 'words' && progress.currentStageIndex >= SOFIT_STAGE_INDEX);
    if (preferProse) {
      const sentence = selectSentence({ unlocked, corpus: PROSE_HE, rng: Math.random });
      if (sentence) return sentence.text;
    }
    const corpus = mode === 'drills' ? [] : COMMON_WORDS_HE;
    return selectPractice({ unlocked, confByCode, corpus, targetChars: 40, rng: Math.random });
  }, [progress.currentStageIndex, stats, fixedTarget, phase, mode, customText]);

  const finishSession = (log: SessionLog) => {
    const r = computeSessionResult(log);
    const merged = mergeSessionStats(stats, r);
    setStats(merged); saveStats(store, merged);
    if (canAdvance(progress.currentStageIndex, merged)) {
      const next = { ...progress, currentStageIndex: progress.currentStageIndex + 1, unlockedStageIndex: progress.currentStageIndex + 1 };
      setProgress(next); saveProgress(store, next);
    }
    const nextHistory = [...history, { wpm: r.wpm, accuracy: r.accuracy }].slice(-100);
    setHistory(nextHistory); saveHistory(store, nextHistory);
    setResult(r); setPhase('summary');
  };

  if (phase === 'placement') {
    return (
      <div className="trainer-mode">
        <div className="trainer-topbar"><button onClick={onExit}>Exit trainer</button></div>
        <PlacementTest source={source} onDone={(seed) => {
          const next = { ...progress, ...seed }; setProgress(next); saveProgress(store, next); setPhase('typing');
        }} />
      </div>
    );
  }

  return (
    <div className="trainer-mode">
      <div className="trainer-topbar">
        <button onClick={onExit}>Exit trainer</button>
        <div className="mode-toggle" role="group" aria-label="Practice mode">
          {(['drills', 'words', 'prose', 'custom'] as const).map(m => (
            <button
              key={m}
              type="button"
              className={m === mode ? 'active' : ''}
              aria-pressed={m === mode}
              onClick={() => setMode(m)}
            >
              {m === 'drills' ? 'Drills' : m === 'words' ? 'Words' : m === 'prose' ? 'Prose' : 'Custom'}
            </button>
          ))}
        </div>
      </div>
      {phase === 'summary' && result ? (
        <>
          <SessionSummary result={result} onNext={() => { setResult(null); setPhase('typing'); }} />
          <StatsView history={history} />
          <Keyboard />
        </>
      ) : (
        <>
          {mode === 'custom' && <CustomText onUse={setCustomText} />}
          <TypingSession source={source} target={target} strictness={settings.strictness}
            stats={stats} guidance={settings.guidanceMode} onComplete={finishSession} />
        </>
      )}
    </div>
  );
};

// Inner component so the session hook can drive the keyboard view.
const TypingSession: React.FC<{
  source: KeySource; target: string; strictness: Settings['strictness'];
  stats: Record<KeyCode, KeyStat>; guidance: Settings['guidanceMode'];
  onComplete: (log: SessionLog) => void;
}> = ({ source, target, strictness, stats, guidance, onComplete }) => {
  const s = useTypingSession({ source, target, strictness, onComplete });
  const view = buildKeyboardView({ nextCode: s.nextCode, statsByCode: stats, guidance });
  return (
    <>
      <PracticePanel target={target} statuses={s.statuses} index={s.index} />
      <Keyboard trainerView={view} />
    </>
  );
};
