// Typed view over the generated Siddur corpus.
//
// siddur.corpus.json is produced by scripts/ingest-siddur.mjs + scripts/build-corpus.mjs
// and is never hand-edited. Term glosses live in glosses.he.ts and are hand-maintained.

import corpusJson from './siddur.corpus.json';
import { TERM_GLOSSES } from './glosses.he';

interface CorpusJson {
  credit: { hebrew: string; english: string; license: string; via: string };
  themes: string[];
  sources: string[];
  glosses: string[];
  lines: Array<[string, number, number, number]>;
  terms: Array<[string, number]>;
}

const corpus = corpusJson as unknown as CorpusJson;

export interface SiddurLine {
  text: string;
  /** Metsudah's translation of the segment this line came from, quoted verbatim. Empty
   *  when Sefaria publishes no English version for the source ref (about 44% of lines). */
  gloss: string;
  theme: string;
  source: string;
}

export const SIDDUR_CREDIT = corpus.credit;

export const SIDDUR_LINES: SiddurLine[] = corpus.lines.map(([text, g, th, src]) => ({
  text,
  gloss: g >= 0 ? corpus.glosses[g] : '',
  theme: corpus.themes[th],
  source: corpus.sources[src],
}));

/** Terms in descending frequency, so callers that take a prefix take the common ones. */
export const SIDDUR_TERMS: string[] = corpus.terms.map(([term]) => term);

export const SIDDUR_TERM_COUNTS: ReadonlyMap<string, number> = new Map(corpus.terms);

/** The derived English gloss for a term, or null when it has not been glossed yet. */
export function glossFor(term: string): string | null {
  return TERM_GLOSSES[term] ?? null;
}

/**
 * How much of the corpus the hand-maintained glosses actually cover — reported rather
 * than assumed, since the gloss list is extended in frequency order over time.
 */
export function glossCoverage(): { terms: number; termsGlossed: number; occurrences: number; occurrencesGlossed: number } {
  let occurrences = 0;
  let occurrencesGlossed = 0;
  let termsGlossed = 0;
  for (const [term, count] of corpus.terms) {
    occurrences += count;
    if (TERM_GLOSSES[term] != null) {
      termsGlossed++;
      occurrencesGlossed += count;
    }
  }
  return { terms: corpus.terms.length, termsGlossed, occurrences, occurrencesGlossed };
}
