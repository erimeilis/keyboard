import { describe, it, expect } from 'vitest';
import { DomKeySource } from './DomKeySource';
import type { KeyEvent } from '../types';

describe('DomKeySource', () => {
  it('emits down then up with the physical code', () => {
    const target = new EventTarget();
    const src = new DomKeySource(target);
    const events: KeyEvent[] = [];
    src.start(e => events.push(e));

    const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyA' });
    const keyupEvent = new KeyboardEvent('keyup', { code: 'KeyA' });
    Object.defineProperty(keydownEvent, 'timeStamp', { value: 100, configurable: true });
    Object.defineProperty(keyupEvent, 'timeStamp', { value: 150, configurable: true });

    target.dispatchEvent(keydownEvent);
    target.dispatchEvent(keyupEvent);

    expect(events).toEqual([
      { code: 'KeyA', ts: 100, down: true },
      { code: 'KeyA', ts: 150, down: false },
    ]);
  });

  it('stops listening after stop()', () => {
    const target = new EventTarget();
    const src = new DomKeySource(target);
    const events: KeyEvent[] = [];
    src.start(e => events.push(e));
    src.stop();
    const keydownEvent = new KeyboardEvent('keydown', { code: 'KeyA' });
    Object.defineProperty(keydownEvent, 'timeStamp', { value: 1, configurable: true });
    target.dispatchEvent(keydownEvent);
    expect(events).toHaveLength(0);
  });
});
