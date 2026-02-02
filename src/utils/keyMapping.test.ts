import { describe, it, expect } from 'vitest';
import { mapKeyCodeToComponentId } from './keyMapping';

describe('Key Mapping', () => {
  it('maps letter keys correctly', () => {
    expect(mapKeyCodeToComponentId('KeyA')).toBe('ka');
    expect(mapKeyCodeToComponentId('KeyQ')).toBe('kq');
    expect(mapKeyCodeToComponentId('KeyZ')).toBe('kz');
  });

  it('maps number keys correctly', () => {
    expect(mapKeyCodeToComponentId('Digit1')).toBe('n1');
    expect(mapKeyCodeToComponentId('Digit0')).toBe('n0');
  });

  it('maps special keys correctly', () => {
    expect(mapKeyCodeToComponentId('Space')).toBe('space');
    expect(mapKeyCodeToComponentId('Escape')).toBe('esc');
    expect(mapKeyCodeToComponentId('Backspace')).toBe('backspace');
  });

  it('returns null for unmapped keys', () => {
    expect(mapKeyCodeToComponentId('F1')).toBeNull();
    expect(mapKeyCodeToComponentId('Unknown')).toBeNull();
  });
});
