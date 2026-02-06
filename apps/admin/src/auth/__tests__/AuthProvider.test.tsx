import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthProvider';

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

function TestConsumer() {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Not authenticated</div>;
  return <div>Hello {user?.displayName}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when authenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ userId: 'user-1' });
    mockFetchAuthSession.mockResolvedValueOnce({
      tokens: { idToken: 'mock-token' },
    });
    mockApiGet.mockResolvedValueOnce({
      data: {
        data: {
          userId: 'user-1',
          email: 'admin@test.com',
          displayName: 'Admin User',
          role: 'admin',
          tenantId: 'DEFAULT',
        },
      },
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Hello Admin User')).toBeInTheDocument();
    });
  });

  it('shows not authenticated when no current user', async () => {
    mockGetCurrentUser.mockRejectedValueOnce(new Error('No user'));

    render(
      <MemoryRouter>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });
  });
});
