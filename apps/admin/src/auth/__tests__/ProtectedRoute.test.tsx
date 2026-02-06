import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { AuthProvider } from '../AuthProvider';

const mockGetCurrentUser = vi.fn();
const mockFetchAuthSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  fetchAuthSession: () => mockFetchAuthSession(),
  signOut: () => mockSignOut(),
}));

const mockApiGet = vi.fn();

vi.mock('../../api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

function renderWithRouter(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Admin Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/unauthorized" element={<div>Unauthorized</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders for admin users', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ userId: 'admin-1' });
    mockFetchAuthSession.mockResolvedValueOnce({
      tokens: { idToken: 'mock-token' },
    });
    mockApiGet.mockResolvedValueOnce({
      data: {
        data: {
          userId: 'admin-1',
          email: 'admin@test.com',
          displayName: 'Admin User',
          role: 'admin',
          tenantId: 'DEFAULT',
        },
      },
    });

    renderWithRouter('/');

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });
  });

  it('redirects non-admin to unauthorized', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ userId: 'customer-1' });
    mockFetchAuthSession.mockResolvedValueOnce({
      tokens: { idToken: 'mock-token' },
    });
    mockApiGet.mockResolvedValueOnce({
      data: {
        data: {
          userId: 'customer-1',
          email: 'customer@test.com',
          displayName: 'Customer User',
          role: 'customer',
          tenantId: 'DEFAULT',
        },
      },
    });

    renderWithRouter('/');

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });
});
