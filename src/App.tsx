import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getCurrentWindow, currentMonitor, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Keyboard } from './components/Keyboard';
import { useKeyboardLayout } from './hooks/useKeyboardLayout';
import { useAccentColor } from './hooks/useAccentColor';
import { useWindowActive } from './hooks/useWindowActive';
import { TrainerMode } from './trainer/TrainerMode';
import './App.css';

// Must match .drag-bar's height in App.css, which is the measured macOS titlebar
// height (32px) so the native window buttons sit correctly in it. The window is sized
// as keyboard height + this, so a mismatch clips the bottom row of keys.
const CONTROLS_HEIGHT = 32;
// Trainer window size; also what the green button restores to after a zoom.
const TRAINER_W = 1000;
const TRAINER_H = 640;
const PILL_SIZE = 48;
const SNAP_THRESHOLD = 20;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.5;

function App() {
  const activeLayout = useKeyboardLayout();
  useAccentColor();
  useWindowActive();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [scale, setScale] = useState(1);
  const [preCollapsePos, setPreCollapsePos] = useState<{ x: number; y: number } | null>(null);
  const scaleRef = useRef(scale);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const baseSizeRef = useRef({ width: 0, height: 0 });
  const isDraggingScale = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScale = useRef(1);

  scaleRef.current = scale;

  // Measure base keyboard dimensions once at mount (zoom=1)
  useEffect(() => {
    if (keyboardRef.current) {
      const kbd = keyboardRef.current.querySelector('.keyboard') as HTMLElement;
      if (kbd) {
        baseSizeRef.current = { width: kbd.offsetWidth, height: kbd.offsetHeight };
      }
    }
  }, []);

  // Sync window size from cached base dimensions * scale
  useEffect(() => {
    if (isCollapsed || baseSizeRef.current.width === 0) return;
    const w = Math.round(baseSizeRef.current.width * scale);
    const h = Math.round((baseSizeRef.current.height + CONTROLS_HEIGHT) * scale);
    getCurrentWindow().setSize(new LogicalSize(w, h));
  }, [scale, isCollapsed]);

  // Screen-edge snapping on window move
  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await win.onMoved(async ({ payload: position }) => {
        if (isCollapsed) return;

        const scaleFactor = await win.scaleFactor();
        const x = position.x / scaleFactor;
        const y = position.y / scaleFactor;

        let snappedX = x;
        let snappedY = y;
        let didSnap = false;

        if (x < SNAP_THRESHOLD && x > -SNAP_THRESHOLD) {
          snappedX = 0;
          didSnap = true;
        }
        if (y < SNAP_THRESHOLD && y > -SNAP_THRESHOLD) {
          snappedY = 0;
          didSnap = true;
        }

        if (didSnap) {
          await win.setPosition(new LogicalPosition(snappedX, snappedY));
        }
      });
    };

    setup();
    return () => { unlisten?.(); };
  }, [isCollapsed]);

  // The three native window buttons report clicks as ONE event, and this is its ONLY
  // subscriber. Tauri's event plugin keys its listener table per event name, so a
  // second listen() on the same name — the trainer titlebar used to have one — tramples
  // the first registration, and whichever tears down second throws
  // `listeners[eventId].handlerId` as an unhandled rejection. Routing by mode here
  // keeps a single registration for the app's lifetime.
  //
  // The subscription is created once, so the handlers go through a ref. Capturing them
  // directly would freeze the first render's handleCollapse — which closes over
  // isCollapsed — and expanding back from the pill would silently never work.
  const isCollapsedRef = useRef(isCollapsed);
  isCollapsedRef.current = isCollapsed;
  const actionsRef = useRef({
    isTraining,
    handleClose: () => {},
    collapseToPill: (_remember: boolean) => {},
    zoomTrainer: () => {},
  });

  // The only two ways in and out of the trainer. Entering ALWAYS un-collapses: the
  // trainer needs its titlebar buttons, and those are hidden while the pill is showing.
  // Opening it from the pill (via the tray) used to leave isCollapsed=true behind, so
  // the trainer came up with no buttons and no way to leave it.
  const enterTrainer = useCallback(() => { setIsCollapsed(false); setIsTraining(true); }, []);
  const exitTrainer = useCallback(() => setIsTraining(false), []);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listen<string>('titlebar-action', ({ payload }) => {
      const a = actionsRef.current;
      // Routed into the Rust log so a click can be traced end to end.
      invoke('frontend_log', { msg: `titlebar-action '${payload}' with isTraining=${a.isTraining} collapsed=${isCollapsedRef.current}` })
        .catch(() => {});
      // Yellow means the same thing in both modes: minimise to the pill. It used to hide
      // the window in trainer mode, and hidden-while-collapsed had no way back — the
      // pill is always recoverable because the pill itself is the button.
      if (a.isTraining) {
        // red = back to the overlay, yellow = pill, green = zoom / restore
        if (payload === 'close') exitTrainer();
        else if (payload === 'miniaturize') { exitTrainer(); a.collapseToPill(false); }
        else if (payload === 'zoom') a.zoomTrainer();
      } else {
        // red = hide (tray brings it back), yellow = pill, green = open the trainer
        if (payload === 'close') a.handleClose();
        else if (payload === 'miniaturize') a.collapseToPill(true);
        else if (payload === 'zoom') enterTrainer();
      }
    })
      .then((u) => { if (cancelled) u(); else unlisten = u; })
      .catch((err) => console.error('[titlebar] could not subscribe to button clicks', err));
    return () => { cancelled = true; unlisten?.(); };
  }, []);

  // The collapsed pill is a 48px circle with no titlebar for the buttons to sit in.
  useEffect(() => {
    invoke('set_window_buttons_visible', { visible: !isCollapsed })
      .catch((err) => console.error('[titlebar] could not toggle the window buttons', err));
  }, [isCollapsed]);

  // Tray menu "Typing Trainer" → toggle trainer mode, through the same two doors as the
  // buttons so entering from the pill un-collapses.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen('toggle-trainer', () => {
      if (actionsRef.current.isTraining) exitTrainer(); else enterTrainer();
    }).then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, [enterTrainer, exitTrainer]);

  // Tray "Show/Hide" and a Dock click both end in window.show() on the Rust side, which
  // then emits this. Showing a collapsed window would surface only the 48px pill — easy
  // to read as "nothing came back" — so the show path always restores a usable overlay.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen('restore-window', () => setIsCollapsed(false)).then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, []);

  // The native panel<->window conversion follows the mode STATE, not the trainer's
  // mount. It used to run from TrainerMode's mount effect with the reverse in its
  // cleanup, and React.StrictMode double-invokes mount effects in dev — so one click
  // sent true -> false -> true: three conversions in a second, with an Accessory-policy
  // panel in the middle that could be ordered out and "hide" the app. No cleanup here on
  // purpose: apply_trainer_mode is idempotent, so a StrictMode re-run is a harmless
  // repeat of the same value rather than a reversal.
  useEffect(() => {
    invoke('set_trainer_mode', { active: isTraining }).catch(console.error);
  }, [isTraining]);

  // The window size is a function of the combined state, decided in one place. Trainer
  // wins; otherwise the pill; otherwise the scaled keyboard. Depending on both flags is
  // what makes "leave the trainer into the pill" and "open the trainer from the pill"
  // land on the right size instead of whatever the previous mode left behind.
  useEffect(() => {
    const win = getCurrentWindow();
    if (isTraining) {
      win.setSize(new LogicalSize(TRAINER_W, TRAINER_H));
    } else if (isCollapsed) {
      win.setSize(new LogicalSize(PILL_SIZE, PILL_SIZE));
    } else if (baseSizeRef.current.width > 0) {
      const w = Math.round(baseSizeRef.current.width * scaleRef.current);
      const h = Math.round((baseSizeRef.current.height + CONTROLS_HEIGHT) * scaleRef.current);
      win.setSize(new LogicalSize(w, h));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTraining, isCollapsed]);

  // Only the drag bar triggers window dragging
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (e.buttons === 1) {
      getCurrentWindow().startDragging();
    }
  }, []);

  const handleClose = useCallback(async () => {
    invoke('frontend_log', { msg: 'handleClose -> window.hide()' }).catch(() => {});
    await getCurrentWindow().hide();
  }, []);

  // Shrink to the pill. `remember` keeps the current position so expanding returns to
  // it; from the trainer there is nothing worth remembering. Size is never stored — the
  // effect above recomputes the overlay's own geometry, so a pill left from the trainer
  // cannot expand into a 1000x640 keyboard.
  const collapseToPill = useCallback(async (remember: boolean) => {
    if (remember) {
      const win = getCurrentWindow();
      const scaleFactor = await win.scaleFactor();
      const pos = await win.outerPosition();
      setPreCollapsePos({ x: pos.x / scaleFactor, y: pos.y / scaleFactor });
    } else {
      setPreCollapsePos(null);
    }
    setIsCollapsed(true);
  }, []);

  // Clicking the pill. Position is restored here; size is owned by the effect above.
  const expandFromPill = useCallback(async () => {
    if (preCollapsePos) {
      await getCurrentWindow().setPosition(new LogicalPosition(preCollapsePos.x, preCollapsePos.y));
    }
    setIsCollapsed(false);
  }, [preCollapsePos]);

  // Green in trainer mode: fill the current monitor, or restore the trainer size.
  const zoomedRef = useRef(false);
  const zoomTrainer = useCallback(async () => {
    const win = getCurrentWindow();
    if (zoomedRef.current) {
      await win.setSize(new LogicalSize(TRAINER_W, TRAINER_H));
      zoomedRef.current = false;
      return;
    }
    const mon = await currentMonitor();
    if (mon) {
      const sf = mon.scaleFactor;
      await win.setPosition(new LogicalPosition(mon.position.x / sf, mon.position.y / sf));
      await win.setSize(new LogicalSize(mon.size.width / sf, mon.size.height / sf));
    }
    zoomedRef.current = true;
  }, []);

  // Kept current for the titlebar-action subscription above.
  actionsRef.current = { isTraining, handleClose, collapseToPill, zoomTrainer };

  const handleScaleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingScale.current = true;
    dragStartY.current = e.clientY;
    dragStartScale.current = scaleRef.current;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingScale.current) return;
      const deltaY = ev.clientY - dragStartY.current;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, dragStartScale.current + deltaY / 300));
      setScale(newScale);
    };

    const handleMouseUp = () => {
      isDraggingScale.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  if (isTraining) {
    return <TrainerMode />;
  }

  if (isCollapsed) {
    return (
      <div className="app-container collapsed">
        <div className="pill-drag-area" data-tauri-drag-region>
          <button
            className="pill"
            onClick={expandFromPill}
            title="Expand keyboard"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <line x1="6" y1="10" x2="8" y2="10" />
              <line x1="10" y1="10" x2="12" y2="10" />
              <line x1="14" y1="10" x2="18" y2="10" />
              <line x1="8" y1="14" x2="16" y2="14" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Drag bar — only place that triggers window dragging. The three controls in it
          are real AppKit window buttons drawn over the webview by titlebar_macos.rs,
          so only their footprint is reserved here. */}
      <div className="drag-bar" onMouseDown={handleDragStart}>
        <div className="window-controls" aria-hidden />
      </div>
      {/* Zoomed keyboard — no drag handler here */}
      <div
        ref={keyboardRef}
        className="keyboard-wrapper"
        data-active-lang={activeLayout}
        style={{ zoom: scale }}
      >
        <Keyboard />
        <div
          className="scale-handle"
          onMouseDown={handleScaleMouseDown}
          title="Drag to resize"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="rgba(255,255,255,0.3)">
            <circle cx="11" cy="11" r="1.5" />
            <circle cx="7" cy="11" r="1.5" />
            <circle cx="11" cy="7" r="1.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default App;
