import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomText, sanitizeHebrew } from './CustomText';

describe('CustomText', () => {
  it('sanitizes to typable Hebrew letters + spaces', () => {
    expect(sanitizeHebrew('שָׁלוֹם, world! 123')).toBe('שלום');
  });
  it('passes sanitized text to onUse', () => {
    const onUse = vi.fn();
    render(<CustomText onUse={onUse} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'שלום עולם' } });
    fireEvent.click(screen.getByRole('button', { name: /practice/i }));
    expect(onUse).toHaveBeenCalledWith('שלום עולם');
  });
});
