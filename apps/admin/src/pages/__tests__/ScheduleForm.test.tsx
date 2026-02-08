import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { createTestWrapper } from '../../test-utils/wrapper';
import { ScheduleForm } from '../ScheduleForm';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../../api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: vi.fn(),
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

describe('ScheduleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Menu items query for item selection
    mockGet.mockResolvedValue({
      data: { data: [{ menuItemId: 'm1', name: 'Burger', price: 9.99, category: 'main', isActive: true }] },
    });
  });

  it('renders date/time inputs and item selection', async () => {
    render(
      <Routes><Route path="/schedules/new" element={<ScheduleForm />} /></Routes>,
      { wrapper: createTestWrapper(['/schedules/new']) },
    );
    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
    });
  });

  it('loads and displays available menu items for selection', async () => {
    render(
      <Routes><Route path="/schedules/new" element={<ScheduleForm />} /></Routes>,
      { wrapper: createTestWrapper(['/schedules/new']) },
    );
    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });
  });

  it('validates that at least one item is required', async () => {
    render(
      <Routes><Route path="/schedules/new" element={<ScheduleForm />} /></Routes>,
      { wrapper: createTestWrapper(['/schedules/new']) },
    );
    await waitFor(() => expect(screen.getByLabelText('Title')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Title'), 'Lunch');
    await userEvent.type(screen.getByLabelText('Description'), 'Lunch menu');
    await userEvent.type(screen.getByLabelText(/pickup/i), 'Front desk');

    const startInput = screen.getByLabelText(/start time/i);
    const endInput = screen.getByLabelText(/end time/i);
    await userEvent.clear(startInput);
    await userEvent.type(startInput, '2026-03-01T12:00');
    await userEvent.clear(endInput);
    await userEvent.type(endInput, '2026-03-01T14:00');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least one item/i)).toBeInTheDocument();
    });
  });

  it('validates endTime must be after startTime', async () => {
    render(
      <Routes><Route path="/schedules/new" element={<ScheduleForm />} /></Routes>,
      { wrapper: createTestWrapper(['/schedules/new']) },
    );
    await waitFor(() => expect(screen.getByLabelText('Title')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Title'), 'Lunch');
    await userEvent.type(screen.getByLabelText('Description'), 'Lunch menu');
    await userEvent.type(screen.getByLabelText(/pickup/i), 'Front desk');

    const startInput = screen.getByLabelText(/start time/i);
    const endInput = screen.getByLabelText(/end time/i);
    await userEvent.clear(startInput);
    await userEvent.type(startInput, '2026-03-01T14:00');
    await userEvent.clear(endInput);
    await userEvent.type(endInput, '2026-03-01T12:00');

    // Add an item so that validation focuses on the time issue
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/end time must be after start time/i)).toBeInTheDocument();
    });
  });

  it('submits valid form and calls create API', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { scheduleId: 's1' } } });
    render(
      <Routes>
        <Route path="/schedules/new" element={<ScheduleForm />} />
        <Route path="/schedules" element={<div>List</div>} />
      </Routes>,
      { wrapper: createTestWrapper(['/schedules/new']) },
    );
    await waitFor(() => expect(screen.getByLabelText('Title')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Title'), 'Lunch');
    await userEvent.type(screen.getByLabelText('Description'), 'Lunch menu');
    await userEvent.type(screen.getByLabelText(/pickup/i), 'Front desk');

    const startInput = screen.getByLabelText(/start time/i);
    const endInput = screen.getByLabelText(/end time/i);
    await userEvent.clear(startInput);
    await userEvent.type(startInput, '2026-03-01T12:00');
    await userEvent.clear(endInput);
    await userEvent.type(endInput, '2026-03-01T14:00');

    // Add an item
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    const qtyInput = screen.getByLabelText(/quantity/i);
    await userEvent.clear(qtyInput);
    await userEvent.type(qtyInput, '10');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/schedules', expect.objectContaining({ title: 'Lunch' }));
    });
  });
});
