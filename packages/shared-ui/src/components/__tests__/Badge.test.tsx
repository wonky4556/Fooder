import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders with correct text', () => {
    render(<Badge text="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies variant-specific classes', () => {
    const { rerender } = render(<Badge text="OK" variant="success" />);
    expect(screen.getByText('OK')).toHaveClass('bg-green-100');

    rerender(<Badge text="Warn" variant="warning" />);
    expect(screen.getByText('Warn')).toHaveClass('bg-yellow-100');
  });
});
