import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

  it('renders no callout when lastMistake is absent', () => {
    const { container } = render(
      <PracticePanel target="לו" statuses={['correct', 'pending']} index={1} />
    );
    expect(container.querySelector('.mistake-callout')).toBeNull();
  });

  it('renders a dismissible callout when lastMistake is present', () => {
    const { container, getByText, queryByText } = render(
      <PracticePanel
        target="של"
        statuses={['correct', 'correct']}
        index={2}
        lastMistake={{ expected: 'של', typed: 'על' }}
      />
    );
    const callout = container.querySelector('.mistake-callout');
    expect(callout).not.toBeNull();
    expect(getByText(/נכתב: על/)).toBeTruthy();
    expect(getByText(/היעד: של/)).toBeTruthy();

    const dismissButton = container.querySelector('.mistake-callout button')!;
    fireEvent.click(dismissButton);
    expect(queryByText(/נכתב: על/)).toBeNull();
  });

  describe('translation', () => {
    it('shows the line translation under the text', () => {
      const { container } = render(
        <PracticePanel
          target="ברוך אתה"
          statuses={[]}
          index={0}
          gloss="Blessed are You"
        />
      );
      expect(container.querySelector('.practice-gloss')!.textContent).toBe('Blessed are You');
    });

    it('renders no translation block when the line has none', () => {
      const { container } = render(
        <PracticePanel target="ברוך אתה" statuses={[]} index={0} />
      );
      expect(container.querySelector('.practice-gloss')).toBeNull();
    });

    it('shows the gloss for the term under the cursor', () => {
      const { container } = render(
        <PracticePanel target="ברוך אתה" statuses={[]} index={0} />
      );
      const term = container.querySelector('.practice-term')!;
      expect(term.textContent).toContain('ברוך');
      expect(term.textContent).toContain('blessed');
    });

    it('follows the cursor to the next term', () => {
      const { container } = render(
        <PracticePanel target="ברוך אתה" statuses={[]} index={6} />
      );
      const term = container.querySelector('.practice-term')!;
      expect(term.textContent).toContain('אתה');
      expect(term.textContent).toContain('You');
    });

    it('renders nothing for a term with no gloss rather than inventing one', () => {
      const { container } = render(
        <PracticePanel target="זzzz" statuses={[]} index={0} />
      );
      expect(container.querySelector('.practice-term')).toBeNull();
    });
  });
});
