import React from 'react';
import { ghostCharsAt } from '../gamification/ghost';

export const GhostBar: React.FC<{ ghost: number[]; elapsedMs: number; total: number }> = ({ ghost, elapsedMs, total }) => {
  const pct = total ? (ghostCharsAt(ghost, elapsedMs) / total) * 100 : 0;
  return (
    <div className="ghost-bar" aria-hidden>
      <div className="ghost-marker" style={{ width: `${pct}%` }} />
    </div>
  );
};
