import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { createTestWrapper } from '../../test-utils/wrapper';
import { Schedules } from '../Schedules';

const mockGet = vi.fn();

vi.mock('../../api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
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

const mockSchedules = [
  {
    scheduleId: '1', title: 'Lunch', description: 'Lunch menu', status: 'active',
    startTime: '2026-01-01T12:00:00Z', endTime: '2026-01-01T14:00:00Z', items: [{ menuItemId: 'm1', name: 'Burger', price: 9.99, totalQuantity: 10, remainingQuantity: 5 }],
  },
  {
    scheduleId: '2', title: 'Dinner', description: 'Dinner menu', status: 'draft',
    startTime: '2026-01-01T18:00:00Z', endTime: '2026-01-01T20:00:00Z', items: [],
  },
];

describe('Schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders list of schedules with status badges', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: mockSchedules } });
    render(<Schedules />, { wrapper: createTestWrapper(['/schedules']) });
    await waitFor(() => {
      expect(screen.getByText('Lunch')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('Dinner')).toBeInTheDocument();
      expect(screen.getByText('draft')).toBeInTheDocument();
    });
  });

  it('renders empty state when no schedules', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    render(<Schedules />, { wrapper: createTestWrapper(['/schedules']) });
    await waitFor(() => {
      expect(screen.getByText('No schedules')).toBeInTheDocument();
    });
  });

  it('filters by status', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: mockSchedules } });
    render(<Schedules />, { wrapper: createTestWrapper(['/schedules']) });
    await waitFor(() => expect(screen.getByText('Lunch')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.queryByText('Dinner')).not.toBeInTheDocument();
  });

  it('Create Schedule button navigates to /schedules/new', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: mockSchedules } });

    function TestApp() {
      return (
        <Routes>
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/schedules/new" element={<div>New Schedule Form</div>} />
        </Routes>
      );
    }

    render(<TestApp />, { wrapper: createTestWrapper(['/schedules']) });
    await waitFor(() => expect(screen.getByText('Lunch')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('link', { name: /create/i }));
    expect(screen.getByText('New Schedule Form')).toBeInTheDocument();
  });
});
