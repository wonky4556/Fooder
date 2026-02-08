import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { createTestWrapper } from '../../test-utils/wrapper';
import { MenuItemForm } from '../MenuItemForm';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();

vi.mock('../../api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { displayName: 'Admin', email: 'admin@test.com', role: 'admin', userId: 'u1', tenantId: 'DEFAULT' },
    isAuthenticated: true,
    isLoading: false,
    signOutUser: vi.fn(),
  }),
}));

describe('MenuItemForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create mode renders empty form', () => {
    render(
      <Routes>
        <Route path="/menu-items/new" element={<MenuItemForm />} />
      </Routes>,
      { wrapper: createTestWrapper(['/menu-items/new']) },
    );
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Price')).toHaveValue(null);
  });

  it('edit mode prefills form with existing item', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: { menuItemId: '1', name: 'Burger', description: 'Tasty', price: 9.99, category: 'main', isActive: true } },
    });
    render(
      <Routes>
        <Route path="/menu-items/:id/edit" element={<MenuItemForm />} />
      </Routes>,
      { wrapper: createTestWrapper(['/menu-items/1/edit']) },
    );
    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue('Burger');
    });
  });

  it('validates required fields', async () => {
    render(
      <Routes>
        <Route path="/menu-items/new" element={<MenuItemForm />} />
      </Routes>,
      { wrapper: createTestWrapper(['/menu-items/new']) },
    );
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  it('submits valid form and calls create API', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { menuItemId: '1' } } });
    render(
      <Routes>
        <Route path="/menu-items/new" element={<MenuItemForm />} />
        <Route path="/menu-items" element={<div>List</div>} />
      </Routes>,
      { wrapper: createTestWrapper(['/menu-items/new']) },
    );

    await userEvent.type(screen.getByLabelText('Name'), 'Burger');
    await userEvent.type(screen.getByLabelText('Description'), 'Tasty');
    await userEvent.type(screen.getByLabelText('Price'), '9.99');
    await userEvent.type(screen.getByLabelText('Category'), 'main');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/menu-items', expect.objectContaining({ name: 'Burger' }));
    });
  });

  it('shows error on API failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Server error'));
    render(
      <Routes>
        <Route path="/menu-items/new" element={<MenuItemForm />} />
      </Routes>,
      { wrapper: createTestWrapper(['/menu-items/new']) },
    );

    await userEvent.type(screen.getByLabelText('Name'), 'Burger');
    await userEvent.type(screen.getByLabelText('Description'), 'Tasty');
    await userEvent.type(screen.getByLabelText('Price'), '9.99');
    await userEvent.type(screen.getByLabelText('Category'), 'main');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });
});
