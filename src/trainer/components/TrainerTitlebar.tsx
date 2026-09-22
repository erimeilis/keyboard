import React from 'react';

// Title strip for a borderless window. Native decorations (set_decorations) throw an
// NSException on this transparent/NSPanel window, so the strip is drawn here — but the
// three lights are the real AppKit buttons, hosted by titlebar_macos.rs, because their
// macOS 27 glass appearance, hover glyphs and inactive dimming cannot be reproduced in
// CSS.
//
// Purely presentational. Button clicks arrive as one `titlebar-action` event that App
// subscribes to exactly once and routes by mode. This component used to hold a second
// subscription to the same event; Tauri's event plugin keys its listener table per event,
// so the two registrations trampled each other and the loser's unlisten threw
// `listeners[eventId].handlerId` as an unhandled rejection on trainer exit.
export const TrainerTitlebar: React.FC = () => (
  // The whole strip drags, as a real titlebar does. It used to be the title span, but
  // centring that absolutely shrank the draggable area to the text itself, which left
  // the window stuck.
  <div className="trainer-titlebar" data-tauri-drag-region>
    {/* Space reserved for the native buttons, which AppKit draws over the webview:
        3 x 14px plus two 9px gaps. */}
    <div className="titlebar-lights-space" aria-hidden />
    <span className="trainer-title" data-tauri-drag-region>Hebrew Keyboard — Trainer</span>
  </div>
);
