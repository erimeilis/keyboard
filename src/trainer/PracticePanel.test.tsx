import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PracticePanel } from './PracticePanel';

describe('PracticePanel', () => {
  it('renders RTL and marks per-char status', () => {
    const { container } = render(
      <PracticePanel target="לו" statuses={['correct', 'pending']} index={1} />
    );
    const root = container.querySelector('.practice-text')!;
    expect(root.getAttribute('dir')).toBe('rtl');
    const chars = container.querySelectorAll('.practice-char');
    expect(chars[0].className).toContain('char-correct');
    expect(chars[1].className).toContain('char-current');
  });
});
