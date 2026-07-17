import type { Letter } from './types';
import { SOFIT_PAIRS } from './data/hebrewLayout';
import { CONFUSABLE_GROUPS } from './curriculum';

const sofitSet = new Set(SOFIT_PAIRS.flatMap(p => [p.sofit + p.regular, p.regular + p.sofit]));

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
