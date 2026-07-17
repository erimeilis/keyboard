import React from 'react';
import './trainer.css';

interface Props { target: string; statuses: ('pending'|'correct'|'error')[]; index: number }

export const PracticePanel: React.FC<Props> = ({ target, statuses, index }) => {
  const chars = [...target];
  return (
    <div className="practice-text" dir="rtl">
      {chars.map((ch, i) => {
        const status = i === index ? 'current' : statuses[i] ?? 'pending';
        return (
          <span key={i} className={`practice-char char-${status}`}>
            {ch === ' ' ? ' ' : ch}
          </span>
        );
      })}
    </div>
  );
};
