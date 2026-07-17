import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomText, sanitizeHebrew } from './CustomText';

describe('CustomText', () => {
  it('sanitizes to typable Hebrew letters + spaces', () => {
    expect(sanitizeHebrew('שָׁלוֹם, world! 123')).toBe('שלום');
  });
  it('handles newlines as word separators', () => {
    expect(sanitizeHebrew('שלום\nעולם')).toBe('שלום עולם');
  });
  it('handles multiple tabs as word separators', () => {
    expect(sanitizeHebrew('שלום\t\tעולם')).toBe('שלום עולם');
  });
  it('collapses multiple spaces and trims', () => {
    expect(sanitizeHebrew('  שלום   עולם  ')).toBe('שלום עולם');
  });
  it('passes sanitized text to onUse', () => {
    const onUse = vi.fn();
    render(<CustomText onUse={onUse} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'שלום עולם' } });
    fireEvent.click(screen.getByRole('button', { name: /practice/i }));
    expect(onUse).toHaveBeenCalledWith('שלום עולם');
  });
});
