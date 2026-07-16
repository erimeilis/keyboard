import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Keyboard } from './Keyboard';

describe('Keyboard trainer view', () => {
  it('applies the next-target class to the mapped key', () => {
    const { container } = render(<Keyboard trainerView={{ ka: { isNextTarget: true } }} />);
    // The A/ש key must carry the highlight
    const highlighted = container.querySelector('.key-next-target');
    expect(highlighted).not.toBeNull();
  });
});
