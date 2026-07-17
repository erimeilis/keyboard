import { useEffect, useRef, useState } from 'react';
import type { KeySource, KeyEvent, KeyCode, Strictness, SessionLog, PosOutcome } from './types';
import { codeForLetter } from './data/hebrewLayout';

interface UseSessionOpts { source: KeySource; target: string; strictness: Strictness; onComplete: (log: SessionLog) => void }
interface SessionState { index: number; expectedCodes: KeyCode[]; statuses: ('pending'|'correct'|'error')[]; nextCode: KeyCode | null }

function buildExpected(target: string): { codes: KeyCode[]; wordOf: number[] } {
  const codes: KeyCode[] = [];
  const wordOf: number[] = [];
  let word = 0;
  for (const ch of target) {
    if (ch === ' ') { codes.push('Space'); wordOf.push(word); word += 1; }
    else { const c = codeForLetter(ch); if (c) { codes.push(c); wordOf.push(word); } }
  }
  return { codes, wordOf };
}

export function useTypingSession(opts: UseSessionOpts): SessionState {
  const { source, target, strictness, onComplete } = opts;
  const { codes, wordOf } = buildExpected(target);

  const [index, setIndex] = useState(0);
  const [statuses, setStatuses] = useState<('pending'|'correct'|'error')[]>(() => codes.map(() => 'pending'));

  // Refs so the event handler always sees current values without re-subscribing.
  const idx = useRef(0);
  const hadErrorHere = useRef(false);
  const lastTs = useRef<number | null>(null);
  const startTs = useRef<number | null>(null);
  const outcomes = useRef<PosOutcome[]>([]);

  // Updated on every render so onKey never sees a stale strictness/onComplete
  // captured from the render when the [target] effect last (re)subscribed.
  const strictnessRef = useRef(strictness);
  strictnessRef.current = strictness;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // (Re)starting for a new target: wipe any state left over from a
    // previous session so this hook instance can be reused across targets.
    idx.current = 0;
    hadErrorHere.current = false;
    lastTs.current = null;
    startTs.current = null;
    outcomes.current = [];
    setIndex(0);
    setStatuses(codes.map(() => 'pending'));

    const onKey = (e: KeyEvent) => {
      if (!e.down) return;
      const i = idx.current;
      if (i >= codes.length) return;
      if (startTs.current === null) startTs.current = e.ts;

      if (e.code === codes[i]) {
        const latency = lastTs.current === null ? 0 : e.ts - lastTs.current;
        lastTs.current = e.ts;
        outcomes.current.push({ code: codes[i], firstTryCorrect: !hadErrorHere.current, latencyMs: latency });
        hadErrorHere.current = false;
        setStatuses(s => { const n = [...s]; n[i] = 'correct'; return n; });
        const next = i + 1;
        idx.current = next; setIndex(next);
        if (next >= codes.length) {
          const words: PosOutcome[][] = [];
          outcomes.current.forEach((o, k) => { const w = wordOf[k]; (words[w] ??= []).push(o); });
          onCompleteRef.current({ words: words.filter(Boolean), startTs: startTs.current!, endTs: e.ts });
        }
      } else {
        hadErrorHere.current = true;
        setStatuses(s => { const n = [...s]; n[i] = 'error'; return n; });
        if (strictnessRef.current === 'markThrough') {
          outcomes.current.push({ code: codes[i], firstTryCorrect: false, latencyMs: 0 });
          const next = i + 1; idx.current = next; setIndex(next);
          hadErrorHere.current = false;
        }
      }
    };
    source.start(onKey);
    return () => source.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return { index, expectedCodes: codes, statuses, nextCode: codes[index] ?? null };
}
