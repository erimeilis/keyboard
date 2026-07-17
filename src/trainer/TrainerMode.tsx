import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Keyboard } from '../components/Keyboard';
import { PracticePanel } from './PracticePanel';
import { SessionSummary } from './SessionSummary';
import { StatsView } from './StatsView';
import { PlacementTest } from './PlacementTest';
import { CustomText } from './CustomText';
import { useTypingSession } from './useTypingSession';
import { Celebration, useFaultFlash } from './Celebration';
import { GhostBar } from './GhostBar';
import { ThemeBackground } from './ThemeBackground';
import { buildGhost, isFasterGhost } from './ghost';
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
  loadHistory, saveHistory, loadStreak, saveStreak, loadGhosts, saveGhosts,
} from './useTrainerState';
import type { HistoryEntry } from './useTrainerState';
import { updateStreak } from './streak';
import { computeStars } from './stars';
import { DomKeySource } from './keySource/DomKeySource';
import { TauriTapKeySource } from './keySource/TauriTapKeySource';
import type { KeySource, KeyCode, KeyStat, Settings, SessionLog, SessionResult, StreakState } from './types';
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
  const [streak, setStreak] = useState<StreakState>(() => loadStreak(store));
  const [ghosts, setGhosts] = useState<Record<number, number[]>>(() => loadGhosts(store));
  const [mode, setMode] = useState<PracticeMode>('words');
  const [customText, setCustomText] = useState('');
  const [celebrateTrigger, setCelebrateTrigger] = useState(0);

  const source = useMemo<KeySource>(
    () => (makeSource ? makeSource(settings)
      : settings.captureSource === 'tap' ? new TauriTapKeySource() : new DomKeySource()),
    [makeSource, settings],
  );

  useEffect(() => {
    invoke('set_trainer_mode', { active: true }).catch(console.error);
    return () => { invoke('set_trainer_mode', { active: false }).catch(console.error); };
  }, []);

  // text and theme must come from the same selectSentence() call — computing them
  // via two separate memoized calls could desync (different rng draw) across renders.
  const targetInfo = useMemo<{ text: string; theme: string }>(() => {
    if (fixedTarget != null) return { text: fixedTarget, theme: 'default' };
    // Custom mode: the sanitized pasted text is the fixed session target —
    // never re-derived from the curriculum/corpus selection below.
    if (mode === 'custom') return { text: customText, theme: 'default' };
    const unlocked = unlockedCodesForStage(progress.currentStageIndex);
    const confByCode: Record<KeyCode, number> = {};
    for (const [code, st] of Object.entries(stats)) confByCode[code] = confidenceFor(st);

    // Prose mode is explicit; "words" mode also graduates to sentences once the
    // curriculum reaches sofit finals. "drills" is a deliberate raw-letter drill
    // override, so it never gets silently swapped for a sentence.
    const preferProse = mode === 'prose' || (mode === 'words' && progress.currentStageIndex >= SOFIT_STAGE_INDEX);
    if (preferProse) {
      const sentence = selectSentence({ unlocked, corpus: PROSE_HE, rng: Math.random });
      if (sentence) return { text: sentence.text, theme: sentence.theme };
    }
    const corpus = mode === 'drills' ? [] : COMMON_WORDS_HE;
    return {
      text: selectPractice({ unlocked, confByCode, corpus, targetChars: 40, rng: Math.random }),
      theme: 'default',
    };
  }, [progress.currentStageIndex, stats, fixedTarget, phase, mode, customText]);
  const target = targetInfo.text;
  const theme = targetInfo.theme;

  const finishSession = (log: SessionLog) => {
    const r = computeSessionResult(log);
    const merged = mergeSessionStats(stats, r);
    setStats(merged); saveStats(store, merged);
    const stageIndex = progress.currentStageIndex;
    const newGhost = buildGhost(log);
    if (isFasterGhost(newGhost, ghosts[stageIndex])) {
      const nextGhosts = { ...ghosts, [stageIndex]: newGhost };
      setGhosts(nextGhosts); saveGhosts(store, nextGhosts);
    }
    const advanced = canAdvance(progress.currentStageIndex, merged);
    if (advanced) {
      const next = { ...progress, currentStageIndex: progress.currentStageIndex + 1, unlockedStageIndex: progress.currentStageIndex + 1 };
      setProgress(next); saveProgress(store, next);
    }
    const nextHistory = [...history, { wpm: r.wpm, accuracy: r.accuracy }].slice(-100);
    setHistory(nextHistory); saveHistory(store, nextHistory);
    const todayISO = new Date().toISOString().slice(0, 10);
    const addedMinutes = r.durationMs / 60_000;
    const nextStreak = updateStreak(streak, todayISO, addedMinutes);
    setStreak(nextStreak); saveStreak(store, nextStreak);
    if (advanced || computeStars(r) === 3) setCelebrateTrigger(t => t + 1);
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
      <Celebration trigger={celebrateTrigger} />
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
          <SessionSummary
            result={result}
            onNext={() => { setResult(null); setPhase('typing'); }}
            streak={streak}
            stars={computeStars(result)}
          />
          <StatsView history={history} />
          <Keyboard />
        </>
      ) : (
        <>
          {mode === 'custom' && <CustomText onUse={setCustomText} />}
          <TypingSession source={source} target={target} theme={theme} strictness={settings.strictness}
            stats={stats} guidance={settings.guidanceMode} onComplete={finishSession}
            ghost={ghosts[progress.currentStageIndex] ?? []} />
        </>
      )}
    </div>
  );
};

// Inner component so the session hook can drive the keyboard view.
const TypingSession: React.FC<{
  source: KeySource; target: string; theme: string; strictness: Settings['strictness'];
  stats: Record<KeyCode, KeyStat>; guidance: Settings['guidanceMode'];
  onComplete: (log: SessionLog) => void;
  ghost: number[];
}> = ({ source, target, theme, strictness, stats, guidance, onComplete, ghost }) => {
  const { faultClass, flash } = useFaultFlash();
  // Remembers which key the flash belongs to: in markThrough mode `index` (and thus
  // `nextCode`) advances past the mistyped position on the very keystroke that triggers
  // the flash, so `s.nextCode` at render time would otherwise point at the wrong key.
  const lastFaultCodeRef = useRef<KeyCode | null>(null);
  const s = useTypingSession({
    source, target, strictness, onComplete,
    onError: (code) => { lastFaultCodeRef.current = code; flash(); },
  });
  const faultCode = faultClass ? lastFaultCodeRef.current : null;
  const view = buildKeyboardView({ nextCode: s.nextCode, statsByCode: stats, guidance, faultCode });

  // Ghost-race clock: wall time since this session's text was set, driven by
  // requestAnimationFrame. Lives here (not in useTypingSession) so it never
  // touches the KeySource/session-completion logic; resets whenever a new
  // target starts and is always cancelled on unmount or target change.
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const sessionStart = performance.now();
    setElapsedMs(0);
    let frame = requestAnimationFrame(tick);
    function tick(now: number) {
      setElapsedMs(now - sessionStart);
      frame = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <>
      <GhostBar ghost={ghost} elapsedMs={elapsedMs} total={s.expectedCodes.length} />
      <ThemeBackground theme={theme} />
      <PracticePanel target={target} statuses={s.statuses} index={s.index} lastMistake={s.lastMistake} />
      <Keyboard trainerView={view} />
    </>
  );
};
