// Term spans over a practice line, used to show the English gloss for whichever
// term the learner is currently typing.

export interface TermSpan { term: string; start: number; end: number }

export function splitTerms(text: string): TermSpan[] {
  const spans: TermSpan[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    spans.push({ term: m[0], start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

/**
 * The term the cursor belongs to. A cursor resting on the space between two terms
 * still belongs to the term just finished — the learner has not started the next one,
 * and flipping the gloss early reads as a glitch.
 */
export function activeTerm(text: string, index: number): TermSpan | null {
  const spans = splitTerms(text);
  if (spans.length === 0) return null;

  let current: TermSpan = spans[0];
  for (const span of spans) {
    if (span.start > index) break;
    current = span;
  }
  return current;
}
