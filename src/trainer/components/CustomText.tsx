import React, { useState } from 'react';
import { byLetter } from '../data/hebrewLayout';

export function sanitizeHebrew(input: string): string {
  // Keep only letters present in the layout and any whitespace; drop niqqud/punctuation.
  const kept = [...input].filter(ch => /\s/.test(ch) || byLetter[ch] != null).join('');
  return kept.replace(/\s+/g, ' ').trim();
}

export const CustomText: React.FC<{ onUse: (text: string) => void }> = ({ onUse }) => {
  const [value, setValue] = useState('');
  return (
    <div className="custom-text">
      <textarea dir="rtl" value={value} onChange={e => setValue(e.target.value)} placeholder="הדביקו טקסט לתרגול" />
      <button onClick={() => onUse(sanitizeHebrew(value))}>Practice this</button>
    </div>
  );
};
