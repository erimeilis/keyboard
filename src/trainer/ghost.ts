import type { SessionLog } from './types';

export function ghostCharsAt(ghost: number[], elapsedMs: number): number {
  let n = 0;
  for (const t of ghost) { if (t <= elapsedMs) n++; else break; }
  return n;
}

// Builds a ghost timeline from a finished session: the cumulative ms elapsed
// at which each character (in typed order, across all words) was completed —
// the prefix sums of every recorded PosOutcome.latencyMs.
export function buildGhost(log: SessionLog): number[] {
  let cumulative = 0;
  return log.words.flat().map(p => (cumulative += p.latencyMs));
}

// Average ms/char — the pace metric used to compare ghosts whose underlying
// session text length may differ.
function ghostPaceMs(ghost: number[]): number {
  return ghost[ghost.length - 1] / ghost.length;
}

// True when `next` beats `prev` (lower ms/char), or there is no previous
// best yet to beat. An empty `next` never becomes (or replaces) a best.
export function isFasterGhost(next: number[], prev: number[] | undefined): boolean {
  if (next.length === 0) return false;
  if (!prev || prev.length === 0) return true;
  return ghostPaceMs(next) < ghostPaceMs(prev);
}
