import type { Letter } from './types';
import { SOFIT_PAIRS } from './data/hebrewLayout';
import { CONFUSABLE_GROUPS } from './curriculum';
import { COMMON_WORDS_HE } from './data/words.he';

const sofitSet = new Set(SOFIT_PAIRS.flatMap(p => [p.sofit + p.regular, p.regular + p.sofit]));
const COMMON_SET = new Set(COMMON_WORDS_HE);

export function errorKind(expected: Letter, typed: Letter): 'sofit' | 'confusable' | 'other' {
  if (sofitSet.has(expected + typed)) return 'sofit';
  for (const group of CONFUSABLE_GROUPS) {
    if (group.includes(expected) && group.includes(typed)) return 'confusable';
  }
  return 'other';
}

export function classifyMistype(
  expectedWord: string,
  typedWord: string,
  wordSet: Set<string>,
): { isRealWord: boolean; typedWord: string } {
  return { isRealWord: typedWord !== expectedWord && wordSet.has(typedWord), typedWord };
}

// Bound to the curated common-word set: flags a mistype that landed on a
// *different real word* rather than gibberish — the teaching moment this
// task surfaces to the user.
export function detectRealWordMistake(
  expectedWord: string,
  typedWord: string,
): { isRealWord: boolean; typedWord: string } {
  return classifyMistype(expectedWord, typedWord, COMMON_SET);
}
