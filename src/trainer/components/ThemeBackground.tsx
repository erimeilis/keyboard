import React from 'react';

const KNOWN = new Set(['sea', 'space', 'wisdom', 'default']);
export function knownTheme(theme: string): string { return KNOWN.has(theme) ? theme : 'default'; }

export const ThemeBackground: React.FC<{ theme: string }> = ({ theme }) => (
  <div className={`theme-bg theme-${knownTheme(theme)}`} aria-hidden />
);
