import { useEffect, useRef, useState } from 'react';
import type { KeySource, KeyEvent, KeyCode, Strictness, SessionLog, PosOutcome } from './types';
import { codeForLetter, letterForCode } from './data/hebrewLayout';
import { detectRealWordMistake } from './errors';

interface UseSessionOpts { source: KeySource; target: string; strictness: Strictness; onComplete: (log: SessionLog) => void }
interface Mistake { expected: string; typed: string }
interface SessionState {
  index: number;
  expectedCodes: KeyCode[];
  statuses: ('pending'|'correct'|'error')[];
  nextCode: KeyCode | null;
  lastMistake: Mistake | null;
}

function buildExpected(target: string): { codes: KeyCode[]; wordOf: number[]; wordTexts: string[]; wordPos: number[] } {
  const codes: KeyCode[] = [];
  const wordOf: number[] = [];
  const wordTexts: string[] = [];
  const wordPos: number[] = [];
  let word = 0;
  let posInWord = 0;
  for (const ch of target) {
    if (ch === ' ') {
      codes.push('Space'); wordOf.push(word); wordPos.push(posInWord);
      word += 1; posInWord = 0;
    } else {
      const c = codeForLetter(ch);
      if (c) {
        codes.push(c); wordOf.push(word); wordPos.push(posInWord);
        wordTexts[word] = (wordTexts[word] ?? '') + ch;
        posInWord += 1;
      }
    }
  }
  return { codes, wordOf, wordTexts, wordPos };
}

export function useTypingSession(opts: UseSessionOpts): SessionState {
  const { source, target, strictness, onComplete } = opts;
  const { codes, wordOf, wordTexts, wordPos } = buildExpected(target);

  const [index, setIndex] = useState(0);
  const [statuses, setStatuses] = useState<('pending'|'correct'|'error')[]>(() => codes.map(() => 'pending'));
  const [lastMistake, setLastMistake] = useState<Mistake | null>(null);

  // Refs so the event handler always sees current values without re-subscribing.
  const idx = useRef(0);
  const hadErrorHere = useRef(false);
  const lastTs = useRef<number | null>(null);
  const startTs = useRef<number | null>(null);
  const outcomes = useRef<PosOutcome[]>([]);
  // Best-effort: the letters actually "consumed" so far for the word in
  // progress (every keypress in markThrough mode; only the eventually-correct
  // keypress in stop mode, since stop mode never lets a wrong letter stick).
  const wordBuffer = useRef('');

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
    wordBuffer.current = '';
    setIndex(0);
    setStatuses(codes.map(() => 'pending'));
    setLastMistake(null);

    // Best-effort meaning check: compares the word just completed against
    // what was actually typed. If they differ and the typed word is itself a
    // real word, surface it as a teaching moment. Never affects scoring.
    const checkWordMistake = (w: number) => {
      const expected = wordTexts[w];
      const typed = wordBuffer.current;
      if (expected == null || typed === expected) return;
      const result = detectRealWordMistake(expected, typed);
      if (result.isRealWord) setLastMistake({ expected, typed });
    };

    const onKey = (e: KeyEvent) => {
      if (!e.down) return;
      const i = idx.current;
      if (i >= codes.length) return;
      if (startTs.current === null) startTs.current = e.ts;

      const w = wordOf[i];
      const isSpace = codes[i] === 'Space';

      if (e.code === codes[i]) {
        const latency = lastTs.current === null ? 0 : e.ts - lastTs.current;
        lastTs.current = e.ts;
        outcomes.current.push({ code: codes[i], firstTryCorrect: !hadErrorHere.current, latencyMs: latency });
        hadErrorHere.current = false;
        setStatuses(s => { const n = [...s]; n[i] = 'correct'; return n; });
        if (!isSpace) {
          const letter = letterForCode(e.code);
          if (letter) wordBuffer.current += letter;
        }
        const next = i + 1;
        idx.current = next; setIndex(next);
        const reachedEnd = next >= codes.length;
        if (isSpace || reachedEnd || (!reachedEnd && wordOf[next] !== w)) {
          checkWordMistake(w);
          wordBuffer.current = '';
        }
        if (reachedEnd) {
          const words: PosOutcome[][] = [];
          outcomes.current.forEach((o, k) => { const wi = wordOf[k]; (words[wi] ??= []).push(o); });
          onCompleteRef.current({ words: words.filter(Boolean), startTs: startTs.current!, endTs: e.ts });
        }
      } else {
        const isFirstErrorAtPos = !hadErrorHere.current;
        hadErrorHere.current = true;
        setStatuses(s => { const n = [...s]; n[i] = 'error'; return n; });
        if (strictnessRef.current === 'markThrough') {
          outcomes.current.push({ code: codes[i], firstTryCorrect: false, latencyMs: 0 });
          if (!isSpace) {
            const letter = letterForCode(e.code);
            if (letter) wordBuffer.current += letter;
          }
          const next = i + 1; idx.current = next; setIndex(next);
          hadErrorHere.current = false;
          const reachedEnd = next >= codes.length;
          if (isSpace || reachedEnd || (!reachedEnd && wordOf[next] !== w)) {
            checkWordMistake(w);
            wordBuffer.current = '';
          }
        } else if (isFirstErrorAtPos && !isSpace) {
          // stop mode never lets a full-word mismatch reach completion (every
          // position must eventually be typed correctly), so the only
          // teachable moment is the hypothetical word this one wrong letter
          // would spell if the rest of the word matched the target.
          const expected = wordTexts[w];
          const letter = letterForCode(e.code);
          if (expected && letter) {
            const pos = wordPos[i];
            const hypothetical = expected.slice(0, pos) + letter + expected.slice(pos + 1);
            const result = detectRealWordMistake(expected, hypothetical);
            if (result.isRealWord) setLastMistake({ expected, typed: hypothetical });
          }
        }
      }
    };
    source.start(onKey);
    return () => source.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return { index, expectedCodes: codes, statuses, nextCode: codes[index] ?? null, lastMistake };
}
