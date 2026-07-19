import type { SessionLog, SessionResult, KeyCode } from '../types';
import { median } from './confidence';

export function computeSessionResult(log: SessionLog): SessionResult {
  const positions = log.words.flat();
  const typedChars = positions.length;
  const correctFirst = positions.filter(p => p.firstTryCorrect).length;
  const durationMs = Math.max(1, log.endTs - log.startTs);
  const minutes = durationMs / 60000;

  const perKeyLatencies: Record<KeyCode, number[]> = {};
  const perKey: SessionResult['perKey'] = {};
  for (const p of positions) {
    perKey[p.code] ??= { attempts: 0, errors: 0, medianLatency: 0 };
    perKey[p.code].attempts += 1;
    if (!p.firstTryCorrect) perKey[p.code].errors += 1;
    (perKeyLatencies[p.code] ??= []).push(p.latencyMs);
  }
  for (const code of Object.keys(perKey)) perKey[code].medianLatency = median(perKeyLatencies[code]);

  const wholeWords = log.words.length;
  const perfectWords = log.words.filter(w => w.every(p => p.firstTryCorrect)).length;

  return {
    wpm: (typedChars / 5) / minutes,
    accuracy: typedChars ? correctFirst / typedChars : 0,
    wholeWordAccuracy: wholeWords ? perfectWords / wholeWords : 0,
    durationMs,
    typedChars,
    perKey,
  };
}
