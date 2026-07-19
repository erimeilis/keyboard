import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// vi.mock factories are hoisted above top-level statements, so a plain `const invoke =
// vi.fn()` referenced inside the factory throws "Cannot access before initialization"
// on this vitest version. vi.hoisted() defines the mock in the same hoisted scope,
// letting the factory reference the same fn instance.
const { invoke } = vi.hoisted(() => ({
  // Report Hebrew as the active input source so the trainer's language gate lets keystrokes count.
  invoke: vi.fn(async (cmd: string) =>
    cmd === 'get_active_keyboard_layout' ? 'com.apple.keylayout.Hebrew' : undefined,
  ),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

// TrainerMode renders <Keyboard/> (summary phase) which sets up a `keyboard-state`
// listener via @tauri-apps/api/event — mock it so mounting doesn't leave an unhandled
// rejection dangling (see Keyboard.test.tsx for the same pattern).
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((_event, _callback) => Promise.resolve(() => {})),
}));

// TrainerMode's focus gate + TrainerTitlebar call getCurrentWindow(); stub it under jsdom.
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: vi.fn(() => Promise.resolve(() => {})),
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    setSize: vi.fn(),
  }),
}));

import { TrainerMode } from './TrainerMode';
import { createMemoryStore } from './storage';
import type { KeySource, KeyEvent } from './types';

function fakeSource() {
  let cb: ((e: KeyEvent) => void) | null = null;
  const src: KeySource = { start: f => { cb = f; }, stop: () => { cb = null; } };
  return { src, press: (code: string, ts: number) => act(() => cb!({ code, ts, down: true })) };
}

describe('TrainerMode loop', () => {
  it('runs a session and shows a summary on completion', async () => {
    const store = createMemoryStore();
    // Pre-seed progress past placement so it goes straight to a session with known text.
    store.set('trainer.progress', { unlockedStageIndex: 0, currentStageIndex: 0, bestByStage: {} });
    store.set('trainer.stats', { KeyF: { code: 'KeyF', attempts: 1, errors: 0, latencies: [200] } });
    const { src, press } = fakeSource();
    render(<TrainerMode onExit={() => {}} store={store} makeSource={() => src} fixedTarget="כ" />);
    await act(async () => { await Promise.resolve(); }); // let the layout poll resolve to Hebrew
    press('KeyF', 100); // 'כ' == KeyF
    // Scoped to SessionSummary's stat label: the summary phase now also renders
    // StatsView, which has its own "WPM" sparkline label, so an unscoped query
    // would match both and throw.
    expect(screen.getByText('WPM', { selector: '.stat-label' })).toBeTruthy();
  });

  it('bursts a celebration when the completed session scores 3 stars', async () => {
    const store = createMemoryStore();
    store.set('trainer.progress', { unlockedStageIndex: 0, currentStageIndex: 0, bestByStage: {} });
    store.set('trainer.stats', { KeyF: { code: 'KeyF', attempts: 1, errors: 0, latencies: [200] } });
    const { src, press } = fakeSource();
    const { container } = render(<TrainerMode onExit={() => {}} store={store} makeSource={() => src} fixedTarget="כ" />);
    await act(async () => { await Promise.resolve(); }); // let the layout poll resolve to Hebrew
    // No burst before any session completes.
    expect(container.querySelector('.celebration.active')).toBeNull();
    press('KeyF', 100); // a single, instant, error-free keystroke -> 100% accuracy, huge wpm -> 3 stars
    expect(container.querySelector('.celebration.active')).not.toBeNull();
  });
});
