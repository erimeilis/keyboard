import type { KeySource, KeyEvent } from '../types';

export class DomKeySource implements KeySource {
  private target: EventTarget;
  private onKey: ((e: KeyEvent) => void) | null = null;
  private downHandler = (ev: Event) => this.emit(ev as KeyboardEvent, true);
  private upHandler = (ev: Event) => this.emit(ev as KeyboardEvent, false);

  constructor(target: EventTarget = window) {
    this.target = target;
  }

  start(onKey: (e: KeyEvent) => void): void {
    this.onKey = onKey;
    this.target.addEventListener('keydown', this.downHandler);
    this.target.addEventListener('keyup', this.upHandler);
  }

  stop(): void {
    this.target.removeEventListener('keydown', this.downHandler);
    this.target.removeEventListener('keyup', this.upHandler);
    this.onKey = null;
  }

  private emit(ev: KeyboardEvent, down: boolean): void {
    if (!this.onKey) return;
    if (isTextEntry(ev.target)) return;

    this.onKey({ code: ev.code, ts: ev.timeStamp, down });

    // A practice keystroke belongs to the trainer and nothing else. Left to propagate, it
    // also reaches whatever control happens to hold focus — a <select> keeps focus after
    // its value changes, and letter keys then drive its native type-ahead and pop its
    // menu open instead of registering as typing.
    //
    // Modifier combinations are left alone so the system keeps its shortcuts (⌘Q, ⌘W).
    if (!ev.metaKey && !ev.ctrlKey && !ev.altKey) ev.preventDefault();
  }
}

/** Somewhere the user is deliberately entering text, such as the custom-text textarea. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'TEXTAREA' || tag === 'INPUT';
}
