import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Key } from './Key';

describe('Key Component', () => {
  it('applies pressed class when isPressed is true', () => {
    render(
      <Key
        variant="single"
        label="A"
        isPressed={true}
      />
    );

    const keyElement = screen.getByText('A').closest('.key');
    expect(keyElement).toHaveClass('key-pressed');
  });

  it('does not apply pressed class when isPressed is false', () => {
    render(
      <Key
        variant="single"
        label="A"
        isPressed={false}
      />
    );

    const keyElement = screen.getByText('A').closest('.key');
    expect(keyElement).not.toHaveClass('key-pressed');
  });
});
