import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeBackground, knownTheme } from './ThemeBackground';

describe('ThemeBackground', () => {
  it('maps known and unknown themes', () => {
    expect(knownTheme('sea')).toBe('sea');
    expect(knownTheme('banana')).toBe('default');
  });
  it('renders the theme class', () => {
    const { container } = render(<ThemeBackground theme="space" />);
    expect(container.querySelector('.theme-space')).not.toBeNull();
  });
});
