import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useKeyboardLayout } from './useKeyboardLayout';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('useKeyboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns "en" for US layout', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValue('com.apple.keylayout.US');

    const { result } = renderHook(() => useKeyboardLayout());

    await waitFor(() => {
      expect(result.current).toBe('en');
    });
  });

  it('returns "he" for Hebrew layout', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValue('com.apple.keylayout.Hebrew');

    const { result } = renderHook(() => useKeyboardLayout());

    await waitFor(() => {
      expect(result.current).toBe('he');
    });
  });

  it('polls layout every 500ms', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValue('com.apple.keylayout.US');

    renderHook(() => useKeyboardLayout());

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_active_keyboard_layout');
    });

    // Wait for second poll
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
