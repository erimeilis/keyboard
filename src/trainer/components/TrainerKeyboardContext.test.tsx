import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Key } from '../../components/Key';
import { TrainerKeyboardProvider } from './TrainerKeyboardContext';

describe('Key trainer visuals', () => {
  it('adds next-target and finger classes from the context view', () => {
    const view = { ka: { isNextTarget: true, finger: 'l-pinky' as const, heat: 0.5 } };
    const { container } = render(
      <TrainerKeyboardProvider value={view}>
        <Key variant="dualPos" primary="A" secondary="ש" id="ka" />
      </TrainerKeyboardProvider>
    );
    const el = container.querySelector('.key')!;
    expect(el.className).toContain('key-next-target');
    expect(el.className).toContain('key-finger-l-pinky');
  });

  it('hides the key legend when view.hidden is set', () => {
    const view = { ka: { hidden: true } };
    const { container } = render(
      <TrainerKeyboardProvider value={view}>
        <Key variant="dualPos" primary="A" secondary="ש" id="ka" />
      </TrainerKeyboardProvider>
    );
    expect(container.querySelector('.key')!.className).toContain('key-hidden');
  });

  it('renders normally with no provider', () => {
    const { container } = render(<Key variant="single" label="esc" />);
    expect(container.querySelector('.key')!.className).not.toContain('key-next-target');
  });

  it('adds key-fault when view.fault is set', () => {
    const view = { ka: { fault: true } };
    const { container } = render(
      <TrainerKeyboardProvider value={view}>
        <Key variant="dualPos" primary="A" secondary="ש" id="ka" />
      </TrainerKeyboardProvider>
    );
    expect(container.querySelector('.key')!.className).toContain('key-fault');
  });

  it('does not add key-fault when view.fault is unset', () => {
    const view = { ka: { isNextTarget: true } };
    const { container } = render(
      <TrainerKeyboardProvider value={view}>
        <Key variant="dualPos" primary="A" secondary="ש" id="ka" />
      </TrainerKeyboardProvider>
    );
    expect(container.querySelector('.key')!.className).not.toContain('key-fault');
  });
});
