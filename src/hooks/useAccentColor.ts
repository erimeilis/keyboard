import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

/** Relative luminance (WCAG 2.x). */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255)
    + 0.7152 * channel((n >> 8) & 255)
    + 0.0722 * channel(n & 255);
}

/**
 * Readable foreground for an accent background, matching what AppKit does: white on most
 * accents, dark on the bright ones (yellow, orange, green).
 *
 * The rule is a measured contrast floor rather than a luminance midpoint. A midpoint gets
 * saturated accents wrong — orange (#f7821b) sits at luminance 0.36, which a 0.45
 * threshold calls "dark" and pairs with white for 2.6:1. Maximising contrast instead
 * overcorrects, putting dark text on the default blue and making the app look un-Mac-like
 * for everyone whose accent is blue.
 *
 * So: keep white, unless white falls below 3:1 — the WCAG AA floor for the bold 12px the
 * pill label uses — and then switch. Blue (3.7:1) and purple (3.5:1) keep white; orange
 * (2.6:1), yellow (1.4:1) and green (2.0:1) go dark.
 */
const MIN_CONTRAST_BOLD_TEXT = 3;

function readableOn(hex: string): string {
  const whiteContrast = 1.05 / (luminance(hex) + 0.05);
  return whiteContrast >= MIN_CONTRAST_BOLD_TEXT ? '#ffffff' : '#101216';
}

/**
 * Publishes the macOS accent colour as the `--accent` / `--accent-text` custom properties.
 *
 * The stylesheet cannot read it on its own: this WKWebView does not support the
 * `AccentColor` CSS system colour, so `@supports (color: AccentColor)` is false and the
 * declared fallback (Apple's default blue) wins — while AppKit draws the native
 * `<select>` popup in the user's real accent. The result is a blue pill beside an orange
 * menu highlight. `get_accent_color` reads `NSColor.controlAccentColor`, the same source
 * AppKit uses, so the two match.
 *
 * On failure the CSS fallback simply stays in place.
 */
export function useAccentColor(): void {
  useEffect(() => {
    let cancelled = false;

    invoke<string | null>('get_accent_color')
      .then(hex => {
        if (cancelled || !hex || !/^#[0-9a-f]{6}$/i.test(hex)) return;
        const root = document.documentElement;
        root.style.setProperty('--accent', hex);
        root.style.setProperty('--accent-text', readableOn(hex));
      })
      .catch(err => {
        // Surfaced rather than swallowed: silence here looks identical to "the accent
        // really is blue", which is the bug this hook exists to fix.
        console.error('[accent] could not read the system accent colour', err);
      });

    return () => { cancelled = true; };
  }, []);
}
