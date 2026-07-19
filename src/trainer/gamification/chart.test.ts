import { describe, it, expect } from 'vitest';
import { linePoints } from './chart';

describe('linePoints', () => {
  it('maps values into the box with y inverted', () => {
    // values 0,50,100 over width 100 height 10 -> x 0,50,100 ; y 10,5,0
    expect(linePoints([0, 50, 100], 100, 10)).toBe('0,10 50,5 100,0');
  });
  it('handles a single value (flat line at mid)', () => {
    expect(linePoints([42], 100, 10)).toBe('0,5');
  });
  it('handles empty', () => {
    expect(linePoints([], 100, 10)).toBe('');
  });
});
