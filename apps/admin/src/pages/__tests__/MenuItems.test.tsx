import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { createTestWrapper } from '../../test-utils/wrapper';
import { MenuItems } from '../MenuItems';

const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
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

describe('MenuItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading spinner while fetching', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<MenuItems />, { wrapper: createTestWrapper(['/menu-items']) });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders list of menu items', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { menuItemId: '1', name: 'Burger', description: 'Tasty', price: 9.99, category: 'main', isActive: true },
          { menuItemId: '2', name: 'Fries', description: 'Crispy', price: 4.99, category: 'side', isActive: true },
        ],
      },
    });
    render(<MenuItems />, { wrapper: createTestWrapper(['/menu-items']) });
    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
      expect(screen.getByText('Fries')).toBeInTheDocument();
    });
  });

  it('renders empty state when no items', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    render(<MenuItems />, { wrapper: createTestWrapper(['/menu-items']) });
    await waitFor(() => {
      expect(screen.getByText('No menu items')).toBeInTheDocument();
    });
  });

  it('Add Item button navigates to /menu-items/new', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [{ menuItemId: '1', name: 'Burger', description: '', price: 9.99, category: 'main', isActive: true }] },
    });

    function TestApp() {
      return (
        <Routes>
          <Route path="/menu-items" element={<MenuItems />} />
          <Route path="/menu-items/new" element={<div>New Item Form</div>} />
        </Routes>
      );
    }

    render(<TestApp />, { wrapper: createTestWrapper(['/menu-items']) });
    await waitFor(() => expect(screen.getByText('Burger')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('link', { name: /add/i }));
    expect(screen.getByText('New Item Form')).toBeInTheDocument();
  });

  it('delete button shows confirmation modal', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [{ menuItemId: '1', name: 'Burger', description: '', price: 9.99, category: 'main', isActive: true }] },
    });
    render(<MenuItems />, { wrapper: createTestWrapper(['/menu-items']) });
    await waitFor(() => expect(screen.getByText('Burger')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });
});
