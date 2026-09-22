import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';

// vi.mock factories are hoisted above top-level statements, so anything they reference
// has to be created inside vi.hoisted() (see TrainerMode.test.tsx for the same pattern).
const { invoke, listenSpy, listeners, win, monitor } = vi.hoisted(() => {
  const listeners = new Map<string, (e: { payload: unknown }) => void>();
  const win = {
    hide: vi.fn(async () => {}),
    setSize: vi.fn(async () => {}),
    setPosition: vi.fn(async () => {}),
    startDragging: vi.fn(async () => {}),
    isFocused: vi.fn(async () => true),
    onFocusChanged: vi.fn(async () => () => {}),
    onMoved: vi.fn(async () => () => {}),
    scaleFactor: vi.fn(async () => 2),
    outerSize: vi.fn(async () => ({ toLogical: () => ({ width: 932, height: 308 }) })),
    outerPosition: vi.fn(async () => ({ x: 0, y: 0 })),
  };
  const monitor = { scaleFactor: 2, position: { x: 0, y: 0 }, size: { width: 6880, height: 2880 } };
  return {
    listeners,
    win,
    monitor,
    // Two-arg signature so tests can read the payload of commands like set_trainer_mode.
    invoke: vi.fn(async (cmd: string, _args?: unknown) =>
      cmd === 'get_active_keyboard_layout' ? 'com.apple.keylayout.Hebrew'
      : cmd === 'get_accent_color' ? '#f7821b'
      : undefined,
    ),
    listenSpy: vi.fn((event: string, cb: (e: { payload: unknown }) => void) => {
      listeners.set(event, cb);
      return Promise.resolve(() => { listeners.delete(event); });
    }),
  };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: listenSpy }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => win,
  currentMonitor: async () => monitor,
  LogicalSize: class { constructor(public width: number, public height: number) {} },
  LogicalPosition: class { constructor(public x: number, public y: number) {} },
}));

import App from './App';

const fire = (payload: string) => act(() => listeners.get('titlebar-action')!({ payload }));
const subscribed = () => waitFor(() => expect(listeners.has('titlebar-action')).toBe(true));
const titlebarSubscriptions = () =>
  listenSpy.mock.calls.filter(([event]) => event === 'titlebar-action').length;

// The three native window buttons are AppKit views, not DOM nodes, so they report clicks
// as one `titlebar-action` event. App is its single subscriber and routes it by mode.
describe('App titlebar-action routing', () => {
  beforeEach(() => {
    listeners.clear();
    listenSpy.mockClear();
    Object.values(win).forEach(fn => fn.mockClear());
  });

  it('performs exactly one native transition per mode change', async () => {
    // This used to run from TrainerMode's mount effect, which StrictMode double-invokes
    // in dev: one click produced true -> false -> true, three panel<->window swizzles.
    const transitions = () => invoke.mock.calls
      .filter(([cmd]) => cmd === 'set_trainer_mode')
      .map(([, args]) => (args as { active: boolean } | undefined)?.active);
    render(<App />);
    await subscribed();
    invoke.mockClear();
    fire('zoom');
    await screen.findByText('Hebrew Keyboard — Trainer');
    expect(transitions()).toEqual([true]);
    fire('close');
    await waitFor(() => expect(screen.queryByText('Hebrew Keyboard — Trainer')).toBeNull());
    expect(transitions()).toEqual([true, false]);
  });

  it('subscribes to titlebar-action exactly once, across mode changes', async () => {
    // The whole point of routing here: a second subscription to the same event name
    // trampled the first inside Tauri's event plugin, and the loser's unlisten threw.
    render(<App />);
    await subscribed();
    fire('zoom');                                  // overlay -> trainer
    await screen.findByText('Hebrew Keyboard — Trainer');
    fire('close');                                 // trainer -> overlay
    await waitFor(() => expect(screen.queryByText('Hebrew Keyboard — Trainer')).toBeNull());
    expect(titlebarSubscriptions()).toBe(1);
  });

  describe('on the keyboard overlay', () => {
    it('green opens the trainer', async () => {
      render(<App />);
      await subscribed();
      fire('zoom');
      expect(await screen.findByText('Hebrew Keyboard — Trainer')).toBeTruthy();
    });

    it('red hides the window', async () => {
      render(<App />);
      await subscribed();
      fire('close');
      await waitFor(() => expect(win.hide).toHaveBeenCalled());
    });

    it('yellow collapses to the pill', async () => {
      render(<App />);
      await subscribed();
      fire('miniaturize');
      // Collapsing shrinks the window to the pill size.
      await waitFor(() => expect(win.setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 48, height: 48 })));
    });
  });

  describe('recovering from the pill', () => {
    const collapse = async () => {
      fire('miniaturize');
      await waitFor(() => expect(win.setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 48, height: 48 })));
    };

    it('opening the trainer from the pill un-collapses first', async () => {
      // The trap: trainer entered with isCollapsed still true came up with its buttons
      // hidden and no way to leave.
      render(<App />);
      await subscribed();
      await collapse();
      invoke.mockClear();
      act(() => listeners.get('toggle-trainer')!({ payload: undefined }));
      await screen.findByText('Hebrew Keyboard — Trainer');
      await waitFor(() => expect(invoke).toHaveBeenCalledWith('set_window_buttons_visible', { visible: true }));
      await waitFor(() => expect(win.setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 1000, height: 640 })));
    });

    it('a tray or Dock show restores the full overlay, not the pill', async () => {
      // jsdom reports offsetWidth 0, so the overlay-size branch never runs here; the
      // observable fact is the state: the pill is gone and the keyboard is back.
      render(<App />);
      await subscribed();
      await collapse();
      expect(document.querySelector('.pill')).not.toBeNull();
      act(() => listeners.get('restore-window')!({ payload: undefined }));
      await waitFor(() => expect(document.querySelector('.pill')).toBeNull());
      expect(document.querySelector('.drag-bar')).not.toBeNull();
    });
  });

  describe('in the trainer', () => {
    it('red returns to the overlay rather than hiding', async () => {
      render(<App />);
      await subscribed();
      fire('zoom');
      await screen.findByText('Hebrew Keyboard — Trainer');
      fire('close');
      await waitFor(() => expect(screen.queryByText('Hebrew Keyboard — Trainer')).toBeNull());
      expect(win.hide).not.toHaveBeenCalled();
    });

    it('yellow minimises to the pill and never hides', async () => {
      // Hiding from the trainer left a state with no way back; the pill is always
      // recoverable because the pill itself is the button.
      render(<App />);
      await subscribed();
      fire('zoom');
      await screen.findByText('Hebrew Keyboard — Trainer');
      fire('miniaturize');
      await waitFor(() => expect(screen.queryByText('Hebrew Keyboard — Trainer')).toBeNull());
      await waitFor(() => expect(win.setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 48, height: 48 })));
      expect(win.hide).not.toHaveBeenCalled();
    });

    it('green zooms to the monitor, then restores the trainer size', async () => {
      render(<App />);
      await subscribed();
      fire('zoom');
      await screen.findByText('Hebrew Keyboard — Trainer');
      win.setSize.mockClear();
      fire('zoom');
      await waitFor(() => expect(win.setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 3440, height: 1440 })));
      fire('zoom');
      await waitFor(() => expect(win.setSize).toHaveBeenCalledWith(expect.objectContaining({ width: 1000, height: 640 })));
    });
  });
});
