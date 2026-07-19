import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { KeySource, KeyEvent } from '../types';

export class TauriTapKeySource implements KeySource {
  private now: () => number;
  private unlisten: UnlistenFn | null = null;
  private stopped = false;

  constructor(opts: { now?: () => number } = {}) {
    this.now = opts.now ?? (() => performance.now());
  }

  start(onKey: (e: KeyEvent) => void): void {
    this.stopped = false;
    listen<{ code: string; down: boolean }>('key-event', (event) => {
      onKey({ code: event.payload.code, ts: this.now(), down: event.payload.down });
    }).then((un) => {
      if (this.stopped) { un(); return; }
      this.unlisten = un;
    });
  }

  stop(): void {
    this.stopped = true;
    this.unlisten?.();
    this.unlisten = null;
  }
}
