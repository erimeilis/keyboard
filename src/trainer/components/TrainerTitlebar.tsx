import React, { useState } from 'react';
import { getCurrentWindow, currentMonitor, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';

// Custom macOS-style title strip. Native window decorations (set_decorations) throw an
// NSException on this transparent/NSPanel window, and native minimize/zoom don't work on a
// borderless window — so we draw our own traffic-light controls with behaviours that DO work:
// red = exit trainer (back to the overlay), yellow = hide the window (reopen from the tray),
// green = zoom (fill the screen) / restore, via setSize (not native maximize).
const TRAINER_W = 1000;
const TRAINER_H = 640;

export const TrainerTitlebar: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [zoomed, setZoomed] = useState(false);

  const hide = () => { getCurrentWindow().hide(); };

  const zoom = async () => {
    const win = getCurrentWindow();
    if (zoomed) {
      await win.setSize(new LogicalSize(TRAINER_W, TRAINER_H));
      setZoomed(false);
    } else {
      const mon = await currentMonitor();
      if (mon) {
        const sf = mon.scaleFactor;
        await win.setPosition(new LogicalPosition(mon.position.x / sf, mon.position.y / sf));
        await win.setSize(new LogicalSize(mon.size.width / sf, mon.size.height / sf));
      }
      setZoomed(true);
    }
  };

  return (
    <div className="trainer-titlebar">
      <div className="titlebar-lights" onMouseDown={(e) => e.stopPropagation()}>
        <button className="tl tl-close" onClick={onExit} title="Exit trainer" aria-label="Exit trainer" />
        <button className="tl tl-min" onClick={hide} title="Hide (reopen from the menu-bar icon)" aria-label="Hide" />
        <button className="tl tl-max" onClick={zoom} title="Zoom" aria-label="Zoom" />
      </div>
      <span className="trainer-title" data-tauri-drag-region>Hebrew Keyboard — Trainer</span>
    </div>
  );
};
