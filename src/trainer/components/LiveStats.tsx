import React from 'react';

// Live positive/negative tally shown while typing (placement and practice sessions).
export const LiveStats: React.FC<{ correct: number; errors: number }> = ({ correct, errors }) => (
  <div className="live-stats" aria-live="polite">
    <span className="live-correct">✓ {correct}</span>
    <span className="live-errors">✗ {errors}</span>
  </div>
);
