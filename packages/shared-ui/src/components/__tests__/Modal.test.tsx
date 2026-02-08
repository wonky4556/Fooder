import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';

describe('Modal', () => {
  it('renders when isOpen is true', () => {
    render(<Modal isOpen onClose={() => {}}>Modal content</Modal>);
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<Modal isOpen={false} onClose={() => {}}>Modal content</Modal>);
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('fires onClose when backdrop clicked', async () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose}>Content</Modal>);
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onClose when Escape pressed', async () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose}>Content</Modal>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
