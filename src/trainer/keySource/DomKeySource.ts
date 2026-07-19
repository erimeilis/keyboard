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
    this.onKey({ code: ev.code, ts: ev.timeStamp, down });
  }
}
