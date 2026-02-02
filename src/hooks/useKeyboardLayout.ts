import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type KeyboardLayout = 'en' | 'he';

export function useKeyboardLayout(): KeyboardLayout {
  const [layout, setLayout] = useState<KeyboardLayout>('en');

  useEffect(() => {
    const checkLayout = async () => {
      try {
        const layoutId = await invoke<string>('get_active_keyboard_layout');

        // Detect Hebrew layout
        if (layoutId.toLowerCase().includes('hebrew')) {
          setLayout('he');
        } else {
          setLayout('en');
        }
      } catch (error) {
        console.error('Failed to get keyboard layout:', error);
      }
    };

    // Initial check
    checkLayout();

    // Poll every 500ms
    const interval = setInterval(checkLayout, 500);

    return () => clearInterval(interval);
  }, []);

  return layout;
}
