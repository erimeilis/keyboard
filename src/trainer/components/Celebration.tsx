import React, { useEffect, useRef, useState } from 'react';

export const Celebration: React.FC<{ trigger: number }> = ({ trigger }) => {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (trigger === 0) return;
    setActive(true);
    const id = setTimeout(() => setActive(false), 900);
    return () => clearTimeout(id);
  }, [trigger]);
  return <div className={`celebration ${active ? 'active' : ''}`} aria-hidden />;
};

// Brief flash of the `key-fault` class (added back in Task 6's Keyboard.css) on
// the current key, driven by the session's wrong-key path. `flash()` is
// idempotent to call repeatedly: each call (re)starts the ~180ms window.
export function useFaultFlash(durationMs = 180): { faultClass: string; flash: () => void } {
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
  }, []);

  const flash = () => {
    if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    setActive(true);
    timeoutRef.current = setTimeout(() => setActive(false), durationMs);
  };

  return { faultClass: active ? 'key-fault' : '', flash };
}
