// src/trainer/SessionSummary.tsx
import React from 'react';
import type { SessionResult } from './types';

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const SessionSummary: React.FC<{ result: SessionResult; onNext: () => void }> = ({ result, onNext }) => (
  <div className="session-summary">
    <div className="stat"><span className="stat-value">{Math.round(result.wpm)}</span><span className="stat-label">WPM</span></div>
    <div className="stat"><span className="stat-value">{pct(result.accuracy)}</span><span className="stat-label">Accuracy</span></div>
    <div className="stat"><span className="stat-value">{pct(result.wholeWordAccuracy)}</span><span className="stat-label">Whole words</span></div>
    <button onClick={onNext}>Continue</button>
  </div>
);
