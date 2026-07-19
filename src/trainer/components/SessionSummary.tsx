// src/trainer/SessionSummary.tsx
import React from 'react';
import type { SessionResult, StreakState } from '../types';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const starGlyphs = (stars: 0 | 1 | 2 | 3) => '★'.repeat(stars) + '☆'.repeat(3 - stars);

export const SessionSummary: React.FC<{
  result: SessionResult;
  onNext: () => void;
  streak?: StreakState;
  stars?: 0 | 1 | 2 | 3;
}> = ({ result, onNext, streak, stars }) => (
  <div className="session-summary">
    <div className="stat"><span className="stat-value">{Math.round(result.wpm)}</span><span className="stat-label">WPM</span></div>
    <div className="stat"><span className="stat-value">{pct(result.accuracy)}</span><span className="stat-label">Accuracy</span></div>
    <div className="stat"><span className="stat-value">{pct(result.wholeWordAccuracy)}</span><span className="stat-label">Whole words</span></div>
    {stars !== undefined && (
      <div className="stat"><span className="stat-value">{starGlyphs(stars)}</span><span className="stat-label">Stars</span></div>
    )}
    {streak !== undefined && (
      <div className="stat"><span className="stat-value">{streak.current}</span><span className="stat-label">Day streak</span></div>
    )}
    <button onClick={onNext}>Continue</button>
  </div>
);
