import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KeyEvent } from '../types';

let handler: ((e: { payload: { code: string; down: boolean } }) => void) | null = null;
const unlisten = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_name: string, cb: any) => { handler = cb; return unlisten; }),
}));

import { TauriTapKeySource } from './TauriTapKeySource';

describe('TauriTapKeySource', () => {
  beforeEach(() => { handler = null; unlisten.mockClear(); });

  it('emits KeyEvents stamped with the injected clock', async () => {
    let t = 1000;
    const src = new TauriTapKeySource({ now: () => t });
    const events: KeyEvent[] = [];
    src.start(e => events.push(e));
    await Promise.resolve(); // let listen() resolve

    handler!({ payload: { code: 'KeyA', down: true } });
    t = 1080;
    handler!({ payload: { code: 'KeyA', down: false } });

    expect(events).toEqual([
      { code: 'KeyA', ts: 1000, down: true },
      { code: 'KeyA', ts: 1080, down: false },
    ]);
  });

  it('unlistens on stop()', async () => {
    const src = new TauriTapKeySource();
    src.start(() => {});
    await Promise.resolve();
    src.stop();
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalled();
  });

  it('unlistens even when stop() is called before listen() resolves (race)', async () => {
    const src = new TauriTapKeySource();
    const events: KeyEvent[] = [];

    // No `await` between start() and stop(): stop() runs while listen()'s
    // promise is still pending, so the guard inside the .then() callback
    // (`if (this.stopped) { un(); return; }`) is what must fire the unlisten.
    src.start(e => events.push(e));
    src.stop();

    expect(unlisten).not.toHaveBeenCalled(); // guard hasn't run yet — still pending

    // Flush microtasks so the mocked listen() promise resolves and its
    // .then() callback executes.
    await Promise.resolve();
    await Promise.resolve();

    expect(unlisten).toHaveBeenCalledTimes(1);

    // Teardown happened before any event was ever delivered.
    expect(events).toEqual([]);
  });
});
