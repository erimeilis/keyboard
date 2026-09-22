import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Mirrors the window's key/inactive state onto `<html data-window-inactive>`.
 *
 * macOS dims a window's chrome — most visibly its traffic lights — while the window is
 * not key. A page that paints its own title strip has to follow suit or the strip stays
 * stubbornly bright behind whatever the user switched to, which is the clearest tell
 * that the chrome is drawn rather than native.
 */
export function useWindowActive(): void {
  useEffect(() => {
    const root = document.documentElement;
    const set = (active: boolean) => {
      if (active) root.removeAttribute('data-window-inactive');
      else root.setAttribute('data-window-inactive', '');
    };

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const win = getCurrentWindow();
    win.isFocused()
      .then(f => { if (!cancelled) set(f); })
      .catch(err => console.error('[window] could not read focus state', err));

    win.onFocusChanged(({ payload: focused }) => set(focused))
      .then(u => { if (cancelled) u(); else unlisten = u; })
      .catch(err => console.error('[window] could not subscribe to focus changes', err));

    // The browser events are the fallback path when the Tauri listener is unavailable.
    const onFocus = () => set(true);
    const onBlur = () => set(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      cancelled = true;
      unlisten?.();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
