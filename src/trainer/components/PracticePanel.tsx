import React, { useEffect, useState } from 'react';
import { activeTerm } from '../engine/terms';
import { glossFor } from '../data/siddur.he';
import './trainer.css';

interface Mistake { expected: string; typed: string }

interface Props {
  target: string;
  statuses: ('pending'|'correct'|'error')[];
  index: number;
  lastMistake?: Mistake | null;
  /** The line's own translation, quoted from the source. Omitted when there is none. */
  gloss?: string;
}

export const PracticePanel: React.FC<Props> = ({ target, statuses, index, lastMistake, gloss }) => {
  const chars = [...target];
  // The term being typed, with its derived gloss. Absent glosses render nothing at all
  // rather than a placeholder — a wrong or empty meaning is worse than none.
  const term = activeTerm(target, index);
  const termGloss = term ? glossFor(term.term) : null;
  // Dismissible: the user can close the callout; a new mistake (any change
  // to the expected/typed pair) brings it back.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { setDismissed(false); }, [lastMistake?.expected, lastMistake?.typed]);

  return (
    <>
      {lastMistake && !dismissed && (
        <div className="mistake-callout" role="status">
          <span>נכתב: {lastMistake.typed} — היעד: {lastMistake.expected}</span>
          <button type="button" aria-label="סגור" onClick={() => setDismissed(true)}>×</button>
        </div>
      )}
      <div className="practice-text" dir="rtl">
        {chars.map((ch, i) => {
          const isCursor = i === index;
          // Error takes precedence over the neutral "current" highlight, so a wrong key
          // turns the current character red instead of hiding the fault.
          const status = statuses[i] === 'error' ? 'error' : isCursor ? 'current' : (statuses[i] ?? 'pending');
          return (
            <span key={i} className={`practice-char char-${status}${isCursor ? ' char-cursor' : ''}`}>
              {ch === ' ' ? ' ' : ch}
            </span>
          );
        })}
      </div>
      {gloss && <div className="practice-gloss">{gloss}</div>}
      {term && termGloss && (
        <div className="practice-term">
          <span className="practice-term-he" dir="rtl">{term.term}</span>
          <span className="practice-term-en">{termGloss}</span>
        </div>
      )}
    </>
  );
};
