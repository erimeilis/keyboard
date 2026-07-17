import { describe, it, expect } from 'vitest';
import { buildKeyboardView } from './keyboardView';
import type { KeyStat } from './types';

const strong = (code: string): KeyStat => ({ code, attempts: 50, errors: 0, latencies: [180] });

describe('buildKeyboardView', () => {
  it('marks the next target and its finger', () => {
    const v = buildKeyboardView({ nextCode: 'KeyA', statsByCode: {}, guidance: 'full' });
    expect(v['ka'].isNextTarget).toBe(true);
    expect(v['ka'].finger).toBe('l-pinky');
  });
  it('auto guidance hides mastered keys but keeps the next target visible', () => {
    const v = buildKeyboardView({ nextCode: 'KeyF', statsByCode: { KeyA: strong('KeyA'), KeyF: strong('KeyF') }, guidance: 'auto' });
    expect(v['ka'].hidden).toBe(true);     // mastered, not next
    expect(v['kf'].hidden).toBeFalsy();    // next target stays visible
  });
  it('hidden guidance hides everything except the next target', () => {
    const v = buildKeyboardView({ nextCode: 'KeyA', statsByCode: {}, guidance: 'hidden' });
    expect(v['ks'].hidden).toBe(true);
    expect(v['ka'].hidden).toBeFalsy();
  });
  it('marks the faulted key when faultCode is set, and no key otherwise', () => {
    const withFault = buildKeyboardView({ nextCode: 'KeyA', statsByCode: {}, guidance: 'full', faultCode: 'KeyA' });
    expect(withFault['ka'].fault).toBe(true);
    expect(withFault['ks'].fault).toBeFalsy();

    const withoutFault = buildKeyboardView({ nextCode: 'KeyA', statsByCode: {}, guidance: 'full' });
    expect(withoutFault['ka'].fault).toBeFalsy();
  });
});
