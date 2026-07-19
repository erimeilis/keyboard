import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { Keyboard } from './components/Keyboard';
import { useKeyboardLayout } from './hooks/useKeyboardLayout';
import { TrainerMode } from './trainer/TrainerMode';
import './App.css';

const CONTROLS_HEIGHT = 24;
const PILL_SIZE = 48;
const SNAP_THRESHOLD = 20;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.5;

function App() {
  const activeLayout = useKeyboardLayout();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [scale, setScale] = useState(1);
  const [preCollapseSize, setPreCollapseSize] = useState<{ width: number; height: number } | null>(null);
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

  // Tray menu "Typing Trainer" → toggle trainer mode
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen('toggle-trainer', () => setIsTraining((t) => !t)).then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, []);

  // Trainer mode uses a normal-sized common window; exiting restores the keyboard overlay size
  useEffect(() => {
    const win = getCurrentWindow();
    if (isTraining) {
      win.setSize(new LogicalSize(1000, 640));
    } else if (!isCollapsed && baseSizeRef.current.width > 0) {
      const w = Math.round(baseSizeRef.current.width * scaleRef.current);
      const h = Math.round((baseSizeRef.current.height + CONTROLS_HEIGHT) * scaleRef.current);
      win.setSize(new LogicalSize(w, h));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTraining]);

  // Only the drag bar triggers window dragging
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (e.buttons === 1) {
      getCurrentWindow().startDragging();
    }
  }, []);

  const handleClose = useCallback(async () => {
    await getCurrentWindow().hide();
  }, []);

  const handleCollapse = useCallback(async () => {
    const win = getCurrentWindow();

    if (!isCollapsed) {
      const scaleFactor = await win.scaleFactor();
      const size = (await win.outerSize()).toLogical(scaleFactor);
      const pos = await win.outerPosition();
      setPreCollapseSize({ width: size.width, height: size.height });
      setPreCollapsePos({ x: pos.x / scaleFactor, y: pos.y / scaleFactor });

      await win.setSize(new LogicalSize(PILL_SIZE, PILL_SIZE));
      setIsCollapsed(true);
    } else {
      if (preCollapseSize && preCollapsePos) {
        await win.setSize(new LogicalSize(preCollapseSize.width, preCollapseSize.height));
        await win.setPosition(new LogicalPosition(preCollapsePos.x, preCollapsePos.y));
      }
      setIsCollapsed(false);
    }
  }, [isCollapsed, preCollapseSize, preCollapsePos]);

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
    return <TrainerMode onExit={() => setIsTraining(false)} />;
  }

  if (isCollapsed) {
    return (
      <div className="app-container collapsed">
        <div className="pill-drag-area" data-tauri-drag-region>
          <button
            className="pill"
            onClick={handleCollapse}
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
      {/* Drag bar — only place that triggers window dragging */}
      <div className="drag-bar" onMouseDown={handleDragStart}>
        <div className="window-controls" onMouseDown={(e) => e.stopPropagation()}>
          <button className="control-btn close" onClick={handleClose} title="Hide window" />
          <button className="control-btn collapse" onClick={handleCollapse} title="Collapse" />
          <button className="control-btn trainer" onClick={() => setIsTraining(true)} title="Typing trainer" />
        </div>
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
