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

  describe('not letting keystrokes reach native controls', () => {
    const dispatch = (target: EventTarget, init: KeyboardEventInit & { type?: string } = {}) => {
      const { type = 'keydown', ...rest } = init;
      const ev = new KeyboardEvent(type, { code: 'KeyJ', cancelable: true, ...rest });
      target.dispatchEvent(ev);
      return ev;
    };

    it('swallows a practice keystroke so a focused select cannot act on it', () => {
      // A <select> keeps focus after its value changes, and letter keys then drive its
      // native type-ahead and open the menu instead of reaching the trainer.
      const target = new EventTarget();
      const src = new DomKeySource(target);
      src.start(() => {});
      expect(dispatch(target).defaultPrevented).toBe(true);
    });

    it('lets system shortcuts through', () => {
      const target = new EventTarget();
      const src = new DomKeySource(target);
      src.start(() => {});
      expect(dispatch(target, { metaKey: true }).defaultPrevented).toBe(false);
      expect(dispatch(target, { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(dispatch(target, { altKey: true }).defaultPrevented).toBe(false);
    });

    it('ignores typing aimed at a real text field', () => {
      // The Custom-text textarea is genuine text entry; swallowing keys there, or
      // counting them as practice, would make it impossible to paste a passage.
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      const src = new DomKeySource(textarea);
      const events: KeyEvent[] = [];
      src.start(e => events.push(e));

      const ev = new KeyboardEvent('keydown', { code: 'KeyJ', cancelable: true });
      textarea.dispatchEvent(ev);

      expect(events).toHaveLength(0);
      expect(ev.defaultPrevented).toBe(false);
      textarea.remove();
    });
  });
});
