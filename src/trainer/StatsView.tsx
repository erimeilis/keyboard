// src/trainer/StatsView.tsx
import React from 'react';
import { linePoints } from './chart';

export const StatsView: React.FC<{ history: { wpm: number; accuracy: number }[] }> = ({ history }) => {
  const wpm = history.map(h => h.wpm);
  const acc = history.map(h => h.accuracy * 100);
  return (
    <div className="stats-view">
      <div className="chart"><span>WPM</span>
        <svg viewBox="0 0 200 40" width="200" height="40"><polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={linePoints(wpm, 200, 40)} /></svg>
      </div>
      <div className="chart"><span>Accuracy</span>
        <svg viewBox="0 0 200 40" width="200" height="40"><polyline fill="none" stroke="#4ade80" strokeWidth="2" points={linePoints(acc, 200, 40)} /></svg>
      </div>
    </div>
  );
};
