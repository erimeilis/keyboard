// Practice vocabulary, drawn from the Siddur Ashkenaz corpus in descending frequency so
// the trainer drills the terms a learner actually meets. See siddur.he.ts for provenance.
//
// Replaces the former 50-term hand-typed seed. Selection still filters by unlocked keys,
// so early stages naturally see only the short, reachable terms.
import { SIDDUR_TERMS } from './siddur.he';

export const COMMON_WORDS_HE: string[] = SIDDUR_TERMS;
