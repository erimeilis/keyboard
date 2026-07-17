import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// vi.mock factories are hoisted above top-level statements, so a plain `const invoke =
// vi.fn()` referenced inside the factory throws "Cannot access before initialization"
// on this vitest version. vi.hoisted() defines the mock in the same hoisted scope,
// letting the factory (and later assertions) reference the same fn instance.
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn(async () => {}) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

// Keyboard (rendered inside TrainerMode) sets up a `keyboard-state` listener via
// @tauri-apps/api/event — mock it so mounting TrainerMode doesn't leave an unhandled
// rejection dangling (see Keyboard.test.tsx for the same pattern).
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((_event, _callback) => Promise.resolve(() => {})),
}));

import { TrainerMode } from './TrainerMode';
import { createMemoryStore } from './storage';
import { loadSettings } from './useTrainerState';

describe('TrainerMode', () => {
  it('enters trainer mode on mount and exits on unmount', () => {
    const onExit = vi.fn();
    const { unmount } = render(<TrainerMode onExit={onExit} />);
    expect(invoke).toHaveBeenCalledWith('set_trainer_mode', { active: true });
    unmount();
    expect(invoke).toHaveBeenCalledWith('set_trainer_mode', { active: false });
  });

  it('calls onExit when the Exit button is clicked', () => {
    const onExit = vi.fn();
    render(<TrainerMode onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /exit/i }));
    expect(onExit).toHaveBeenCalled();
  });

  it('updates and persists settings when the topbar controls change', () => {
    const store = createMemoryStore();
    // Pre-seed stats so the component skips the placement phase (which has no
    // settings controls) and lands directly on the typing topbar.
    store.set('trainer.stats', { KeyF: { code: 'KeyF', attempts: 1, errors: 0, latencies: [200] } });
    render(<TrainerMode onExit={() => {}} store={store} />);

    const guidanceSelect = screen.getByLabelText(/guidance/i) as HTMLSelectElement;
    expect(guidanceSelect.value).toBe('full');
    fireEvent.change(guidanceSelect, { target: { value: 'hidden' } });
    expect(guidanceSelect.value).toBe('hidden');
    expect(loadSettings(store).guidanceMode).toBe('hidden');

    const errorsSelect = screen.getByLabelText(/errors/i) as HTMLSelectElement;
    expect(errorsSelect.value).toBe('stop');
    fireEvent.change(errorsSelect, { target: { value: 'markThrough' } });
    expect(loadSettings(store).strictness).toBe('markThrough');
    // Previously-set guidance change must survive an unrelated later update (merge, not replace).
    expect(loadSettings(store).guidanceMode).toBe('hidden');

    const captureSelect = screen.getByLabelText(/capture/i) as HTMLSelectElement;
    expect(captureSelect.value).toBe('dom');
    fireEvent.change(captureSelect, { target: { value: 'tap' } });
    expect(loadSettings(store).captureSource).toBe('tap');
  });
});
