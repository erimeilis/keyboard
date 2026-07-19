import React, { useEffect, useState } from 'react';
import './trainer.css';

interface Mistake { expected: string; typed: string }

interface Props {
  target: string;
  statuses: ('pending'|'correct'|'error')[];
  index: number;
  lastMistake?: Mistake | null;
}

export const PracticePanel: React.FC<Props> = ({ target, statuses, index, lastMistake }) => {
  const chars = [...target];
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
    </>
  );
};
